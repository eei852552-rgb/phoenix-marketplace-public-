# Phoenix Marketplace API

Node.js 22 + Express + PostgreSQL API foundation. This is source code only; it is **not deployed or connected to a live database** yet.

## Included
- Health and readiness endpoints
- Buyer registration, login, logout and current-user endpoint
- Scrypt password hashing; only SHA-256 hashes of opaque session tokens are stored
- Rate-limited authentication endpoints
- Public published-product catalogue and category endpoint
- Seller-only listing submission; new listings enter `pending_review`
- Parameterized SQL, request validation, Helmet and exact-origin CORS allowlist

## Local setup
1. Install Node.js 22+ and PostgreSQL 15+.
2. Create an empty development database.
3. Copy `.env.example` to `.env` and set `DATABASE_URL`.
4. Apply `db/schema.sql` to the development database.
5. Run `npm install`, then `npm start`.
6. Check `GET /healthz` and `GET /readyz`.

Never commit `.env`, database passwords, API keys or customer data.

## Endpoints
- `GET /healthz` — process health
- `GET /readyz` — database readiness
- `GET /api/categories`
- `GET /api/products?q=&category=&sort=newest|price_asc|price_desc&limit=20&offset=0`
- `POST /api/auth/register` — JSON: `{ "email": "...", "password": "at-least-12-characters" }`
- `POST /api/auth/login`
- `POST /api/auth/logout` — Bearer token
- `GET /api/me` — Bearer token
- `POST /api/seller/products` — seller role only; JSON product fields

## Important limitations / next implementation work
- Registration currently creates buyer accounts only. Seller role assignment requires a separately reviewed admin verification workflow; there is no public role escalation.
- Email verification, password reset, MFA, seller identity checks, image upload/storage, moderation console, orders, delivery, chat, payments, reviews and support tickets are not implemented.
- Rate limits are in-memory and need a shared store for multi-instance deployment.
- Access tokens are returned to the client; production frontend integration needs a secure token-storage design, rotation/revocation policy and XSS review.
- Add automated integration tests, security review, database backups/restore drills and operational monitoring.
- Do not connect this API to the public demo or collect real user data until the deployment provider, database, privacy terms and security gates are approved.

## Deployment
Deploy this directory as a Node web service on a provider that supports persistent PostgreSQL connectivity and environment secrets. Set `DATABASE_URL`, `WEB_ORIGIN`, `NODE_ENV=production`, `PORT` (if required), and `PGSSL=true` when the provider mandates verified TLS. Run migrations as a controlled release step, not automatically on every server boot.

The existing GitHub Pages site remains static and unchanged until a backend deployment and end-to-end verification are complete.
