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

test("seller listing endpoint rejects unauthenticated requests", async () => {
  const response = await request(app).post("/api/seller/products").send({});
  assert.equal(response.status, 401);
});
