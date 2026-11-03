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
    const result = await db().query("SELECT u.id,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()", [tokenHash(raw.slice(7))]);
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
app.use((err,_req,res,_next)=>{ if(err.message==="Origin not allowed") return res.status(403).json({error:"Origin not allowed"}); res.status(500).json({error:"Unexpected server error"}); });
export default app;
