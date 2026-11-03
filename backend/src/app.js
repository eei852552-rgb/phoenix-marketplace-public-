import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const app = express();
app.disable("x-powered-by");
app.use(helmet());
const allowedOrigins = (process.env.WEB_ORIGIN || "http://localhost:5500").split(",").map(v => v.trim()).filter(Boolean);
app.use(cors({ origin(origin, cb) { if (!origin || allowedOrigins.includes(origin)) return cb(null, true); return cb(new Error("Origin not allowed")); }, methods:["GET","POST","PATCH","DELETE"], allowedHeaders:["Content-Type","Authorization"] }));
app.use(express.json({ limit:"32kb" }));
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders:"draft-7", legacyHeaders:false }));
app.get("/healthz", (_req,res) => res.json({ status:"ok", service:"phoenix-marketplace-api" }));

const emailSchema = z.string().trim().email().max(254).transform(v => v.toLowerCase());
const passwordSchema = z.string().min(12).max(128);
const tokenHash = token => createHash("sha256").update(token).digest("hex");
const db = () => {
  if (!globalThis.pool) throw new Error("Database is not configured");
  return globalThis.pool;
};
async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `${salt.toString("hex")}:${Buffer.from(derived).toString("hex")}`;
}
async function verifyPassword(password, stored) {
  const [saltHex, hashHex] = String(stored).split(":");
  if (!saltHex || !hashHex) return false;
  const actual = Buffer.from(await scrypt(password, Buffer.from(saltHex,"hex"), 64));
  const expected = Buffer.from(hashHex,"hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
async function createSession(userId) {
  const token = randomBytes(32).toString("base64url");
  await db().query("INSERT INTO sessions(user_id, token_hash, expires_at) VALUES($1,$2,now()+interval '7 days')", [userId, tokenHash(token)]);
  return token;
}
async function auth(req,res,next) {
  try {
    const raw = req.get("authorization") || "";
    if (!raw.startsWith("Bearer ")) return res.status(401).json({error:"Authentication required"});
    const result = await db().query("SELECT u.id,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.status='active'", [tokenHash(raw.slice(7))]);
    if (!result.rowCount) return res.status(401).json({error:"Session invalid or expired"});
    req.user = result.rows[0]; next();
  } catch { res.status(503).json({error:"Authentication service unavailable"}); }
}
const registerLimiter = rateLimit({windowMs:60*60*1000,limit:5,standardHeaders:"draft-7",legacyHeaders:false});
const loginLimiter = rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:"draft-7",legacyHeaders:false});

app.get("/readyz", async (_req,res) => {
  try { await db().query("SELECT 1"); res.json({status:"ready"}); }
  catch { res.status(503).json({status:"not_ready"}); }
});
app.post("/api/auth/register", registerLimiter, async (req,res) => {
  const parsed = z.object({email:emailSchema,password:passwordSchema}).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error:"Valid email and a password of at least 12 characters are required"});
  try {
    const password_hash = await hashPassword(parsed.data.password);
    const result = await db().query("INSERT INTO users(email,password_hash,role) VALUES($1,$2,'buyer') RETURNING id,email,role,created_at", [parsed.data.email,password_hash]);
    const token = await createSession(result.rows[0].id);
    res.status(201).json({user:result.rows[0],token,token_type:"Bearer",expires_in:604800});
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({error:"An account with this email already exists"});
    res.status(503).json({error:"Registration temporarily unavailable"});
  }
});
app.post("/api/auth/login", loginLimiter, async (req,res) => {
  const parsed = z.object({email:emailSchema,password:z.string().min(1).max(128)}).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error:"Invalid credentials"});
  try {
    const result = await db().query("SELECT id,email,role,password_hash FROM users WHERE email=$1 AND status='active'",[parsed.data.email]);
    if (!result.rowCount || !(await verifyPassword(parsed.data.password,result.rows[0].password_hash))) return res.status(401).json({error:"Invalid credentials"});
    const user = {id:result.rows[0].id,email:result.rows[0].email,role:result.rows[0].role};
    const token = await createSession(user.id);
    res.json({user,token,token_type:"Bearer",expires_in:604800});
  } catch { res.status(503).json({error:"Login temporarily unavailable"}); }
});
app.post("/api/auth/logout", auth, async (req,res) => {
  await db().query("DELETE FROM sessions WHERE user_id=$1 AND token_hash=$2",[req.user.id,tokenHash(req.get("authorization").slice(7))]);
  res.status(204).end();
});
app.get("/api/me", auth, (req,res) => res.json({user:req.user}));

app.get("/api/categories", (_req,res) => res.json({categories:[
  {slug:"electronics",name_my:"အီလက်ထရွန်းနစ်"},{slug:"fashion",name_my:"ဖက်ရှင်"},
  {slug:"home",name_my:"အိမ်သုံး"},{slug:"beauty",name_my:"အလှအပ"},
  {slug:"services",name_my:"ဝန်ဆောင်မှု"},{slug:"digital",name_my:"ဒစ်ဂျစ်တယ်"}
]}));
app.get("/api/products", async (req,res) => {
  const parsed = z.object({q:z.string().trim().max(100).optional(),category:z.string().max(40).optional(),sort:z.enum(["newest","price_asc","price_desc"]).default("newest"),limit:z.coerce.number().int().min(1).max(40).default(20),offset:z.coerce.number().int().min(0).max(10000).default(0)}).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({error:"Invalid search parameters"});
  try {
    const p=parsed.data, values=[], where=["p.status='published'"];
    if(p.q){values.push("%"+p.q+"%");where.push("(p.title ILIKE $"+values.length+" OR p.description ILIKE $"+values.length+")");}
    if(p.category){values.push(p.category);where.push("p.category=$"+values.length);}
    const order=p.sort==="price_asc"?"p.price_minor ASC":p.sort==="price_desc"?"p.price_minor DESC":"p.created_at DESC";
    values.push(p.limit,p.offset);
    const result=await db().query("SELECT p.id,p.title,p.description,p.category,p.price_minor,p.currency,p.created_at,u.display_name AS seller_name FROM products p JOIN users u ON u.id=p.seller_id WHERE "+where.join(" AND ")+" ORDER BY "+order+" LIMIT $"+(values.length-1)+" OFFSET $"+values.length,values);
    res.json({products:result.rows,pagination:{limit:p.limit,offset:p.offset}});
  } catch { res.status(503).json({error:"Product catalogue temporarily unavailable"}); }
});
const productSchema=z.object({title:z.string().trim().min(3).max(120),description:z.string().trim().min(10).max(3000),category:z.enum(["electronics","fashion","home","beauty","services","digital"]),price_minor:z.number().int().positive().max(100000000000),currency:z.literal("MMK")});
app.post("/api/seller/products",auth,async(req,res)=>{
  if(req.user.role!=="seller") return res.status(403).json({error:"Seller account required"});
  const parsed=productSchema.safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:"Invalid product details"});
  try{
    const p=parsed.data;
    const result=await db().query("INSERT INTO products(seller_id,title,description,category,price_minor,currency,status) VALUES($1,$2,$3,$4,$5,$6,'pending_review') RETURNING id,title,category,price_minor,currency,status,created_at",[req.user.id,p.title,p.description,p.category,p.price_minor,p.currency]);
    res.status(201).json({product:result.rows[0],message:"စာရင်းကို စစ်ဆေးရန် ပေးပို့ပြီးပါပြီ။ အတည်ပြုပြီးမှသာ အများမြင်ရပါမည်။"});
  }catch{res.status(503).json({error:"Could not submit listing"});}
});

const sellerApplicationSchema=z.object({display_name:z.string().trim().min(2).max(80),phone:z.string().trim().min(7).max(24),region:z.string().trim().min(2).max(80),about:z.string().trim().max(1000).optional()});
app.post("/api/seller/applications",auth,async(req,res)=>{
  const parsed=sellerApplicationSchema.safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:"Valid seller application details are required"});
  if(req.user.role!=="buyer") return res.status(409).json({error:"This account cannot submit a seller application"});
  try{
    const p=parsed.data;
    const result=await db().query("INSERT INTO seller_applications(user_id,display_name,phone,region,about,status) VALUES($1,$2,$3,$4,$5,'pending') ON CONFLICT(user_id) DO UPDATE SET display_name=EXCLUDED.display_name,phone=EXCLUDED.phone,region=EXCLUDED.region,about=EXCLUDED.about,status='pending',reviewed_at=NULL,reviewed_by=NULL RETURNING id,status,created_at",[req.user.id,p.display_name,p.phone,p.region,p.about||null]);
    res.status(201).json({application:result.rows[0],message:"ရောင်းသူလျှောက်လွှာကို စစ်ဆေးရန် ပေးပို့ပြီးပါပြီ။"});
  }catch{res.status(503).json({error:"Seller application temporarily unavailable"});}
});
app.get("/api/seller/applications/me",auth,async(req,res)=>{
  try{const r=await db().query("SELECT id,display_name,region,status,created_at,reviewed_at FROM seller_applications WHERE user_id=$1",[req.user.id]);res.json({application:r.rows[0]||null});}
  catch{res.status(503).json({error:"Could not load application"});}
});
app.get("/api/seller/products",auth,async(req,res)=>{
  if(!["seller","admin"].includes(req.user.role)) return res.status(403).json({error:"Seller account required"});
  try{const r=await db().query("SELECT id,title,category,price_minor,currency,status,created_at FROM products WHERE seller_id=$1 ORDER BY created_at DESC LIMIT 100",[req.user.id]);res.json({products:r.rows});}
  catch{res.status(503).json({error:"Could not load seller listings"});}
});
app.post("/api/orders",auth,async(req,res)=>{
  const parsed=z.object({product_id:z.string().uuid(),quantity:z.number().int().min(1).max(20),delivery_address:z.string().trim().min(10).max(500),buyer_note:z.string().trim().max(500).optional()}).safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:"Invalid order details"});
  if(req.user.role!=="buyer") return res.status(403).json({error:"Buyer account required"});
  const client=await db().connect();
  try{
    await client.query("BEGIN");
    const p=await client.query("SELECT id,seller_id,title,price_minor,currency FROM products WHERE id=$1 AND status='published' FOR SHARE",[parsed.data.product_id]);
    if(!p.rowCount) {await client.query("ROLLBACK");return res.status(404).json({error:"Product is not available"});}
    if(p.rows[0].seller_id===req.user.id){await client.query("ROLLBACK");return res.status(400).json({error:"You cannot order your own listing"});}
    const total=BigInt(p.rows[0].price_minor)*BigInt(parsed.data.quantity);
    if(total>9000000000000000n){await client.query("ROLLBACK");return res.status(400).json({error:"Order amount is too large"});}
    const o=await client.query("INSERT INTO orders(buyer_id,seller_id,status,payment_method,currency,subtotal_minor,total_minor,delivery_address,buyer_note) VALUES($1,$2,'pending','cod',$3,$4,$4,$5,$6) RETURNING id,status,payment_method,currency,total_minor,created_at",[req.user.id,p.rows[0].seller_id,p.rows[0].currency,total.toString(),parsed.data.delivery_address,parsed.data.buyer_note||null]);
    await client.query("INSERT INTO order_items(order_id,product_id,product_title,unit_price_minor,quantity) VALUES($1,$2,$3,$4,$5)",[o.rows[0].id,p.rows[0].id,p.rows[0].title,p.rows[0].price_minor,parsed.data.quantity]);
    await client.query("COMMIT");
    res.status(201).json({order:o.rows[0],message:"COD အော်ဒါကို လက်ခံရန် ပေးပို့ပြီးပါပြီ။"});
  }catch{await client.query("ROLLBACK");res.status(503).json({error:"Could not create order"});}
  finally{client.release();}
});
app.get("/api/orders",auth,async(req,res)=>{
  try{const r=await db().query("SELECT o.id,o.status,o.payment_method,o.currency,o.total_minor,o.created_at,oi.product_title,oi.quantity FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE o.buyer_id=$1 OR o.seller_id=$1 ORDER BY o.created_at DESC LIMIT 100",[req.user.id]);res.json({orders:r.rows});}
  catch{res.status(503).json({error:"Could not load orders"});}
});
app.patch("/api/orders/:id/cancel",auth,async(req,res)=>{
  const parsed=z.string().uuid().safeParse(req.params.id);if(!parsed.success)return res.status(400).json({error:"Invalid order id"});
  try{const r=await db().query("UPDATE orders SET status='cancelled',updated_at=now() WHERE id=$1 AND buyer_id=$2 AND status='pending' RETURNING id,status",[parsed.data,req.user.id]);if(!r.rowCount)return res.status(409).json({error:"Order cannot be cancelled"});res.json({order:r.rows[0]});}
  catch{res.status(503).json({error:"Could not cancel order"});}
});
app.get("/api/admin/moderation/products",auth,async(req,res)=>{
  if(req.user.role!=="admin"&&req.user.role!=="moderator")return res.status(403).json({error:"Moderator access required"});
  try{const r=await db().query("SELECT p.id,p.title,p.description,p.category,p.price_minor,p.currency,p.created_at,u.email AS seller_email FROM products p JOIN users u ON u.id=p.seller_id WHERE p.status='pending_review' ORDER BY p.created_at ASC LIMIT 100");res.json({products:r.rows});}
  catch{res.status(503).json({error:"Could not load moderation queue"});}
});
app.patch("/api/admin/products/:id/review",auth,async(req,res)=>{
  if(req.user.role!=="admin"&&req.user.role!=="moderator")return res.status(403).json({error:"Moderator access required"});
  const id=z.string().uuid().safeParse(req.params.id), body=z.object({decision:z.enum(["publish","reject"]),reason:z.string().trim().min(3).max(500)}).safeParse(req.body);
  if(!id.success||!body.success)return res.status(400).json({error:"Invalid moderation request"});
  try{const status=body.data.decision==="publish"?"published":"rejected";const r=await db().query("UPDATE products SET status=$1,updated_at=now() WHERE id=$2 AND status='pending_review' RETURNING id,status",[status,id.data]);if(!r.rowCount)return res.status(409).json({error:"Listing is not pending review"});await db().query("INSERT INTO moderation_events(product_id,moderator_id,decision,reason) VALUES($1,$2,$3,$4)",[id.data,req.user.id,body.data.decision,body.data.reason]);res.json({product:r.rows[0]});}
  catch{res.status(503).json({error:"Could not review listing"});}
});

app.use((err,_req,res,_next)=>{ if(err.message==="Origin not allowed") return res.status(403).json({error:"Origin not allowed"}); res.status(500).json({error:"Unexpected server error"}); });
export default app;
