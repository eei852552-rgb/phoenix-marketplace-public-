import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../src/app.js";

test("health endpoint responds without exposing configuration", async () => {
  const response = await request(app).get("/healthz");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {status:"ok",service:"phoenix-marketplace-api"});
  assert.equal(JSON.stringify(response.body).includes("DATABASE_URL"), false);
});

test("category endpoint exposes the supported categories", async () => {
  const response = await request(app).get("/api/categories");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.categories.map(x=>x.slug), ["electronics","fashion","home","beauty","services","digital"]);
});

test("protected seller listing endpoint rejects unauthenticated requests", async () => {
  const response = await request(app).post("/api/seller/products").send({});
  assert.equal(response.status, 401);
  assert.deepEqual(response.body,{error:"Authentication required"});
});

test("seller application endpoint rejects unauthenticated requests", async () => {
  const response = await request(app).post("/api/seller/applications").send({display_name:"Demo",phone:"091234567",region:"Yangon"});
  assert.equal(response.status, 401);
});

test("registration validates malformed email and short password before database access", async () => {
  const response = await request(app).post("/api/auth/register").send({email:"not-an-email",password:"short"});
  assert.equal(response.status, 400);
});

test("catalogue rejects invalid pagination before database access", async () => {
  const response = await request(app).get("/api/products?limit=1000");
  assert.equal(response.status, 400);
});

test("database readiness reports unavailable when no database is configured", async () => {
  const response = await request(app).get("/readyz");
  assert.equal(response.status, 503);
  assert.deepEqual(response.body,{status:"not_ready"});
});
