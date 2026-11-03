# Phoenix Marketplace API

Node.js 22 + Express + PostgreSQL backend source. **Not deployed or connected to a live database.** The public GitHub Pages storefront remains a separate static demo.

## Implemented API foundation
- Health/readiness endpoints, Helmet, exact-origin CORS allowlist and request-size limit
- Buyer registration/login/logout and current-user endpoint; scrypt password hashes and hashed random session tokens
- Rate-limited auth routes and server-side session expiry
- Public published catalogue with search/category/sort/pagination
- Seller application submission and status lookup
- Seller-only listing submission, initially `pending_review`
- Moderator/admin listing review queue and publish/reject action with audit event
- Admin-only seller application approval/rejection; approval promotes buyer to seller
- COD order creation using server-side product price, transaction and immutable order-item snapshot
- Buyer/seller order history, buyer cancellation of pending order and seller order progression

## Local setup
1. Install Node.js 22+ and PostgreSQL 15+.
2. Create an empty development database.
3. Copy `.env.example` to `.env` and set `DATABASE_URL`.
4. Apply `db/schema.sql` to that empty database.
5. Run `npm install`, then `npm test`, then `npm start`.
6. Check `GET /healthz` and `GET /readyz`.

Never commit `.env`, database passwords, API keys or customer data.

## Main routes
- `GET /healthz`, `GET /readyz`
- `GET /api/categories`, `GET /api/products`
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/me`
- `POST /api/seller/applications`, `GET /api/seller/applications/me`
- `POST /api/seller/products`, `GET /api/seller/products`
- `POST /api/orders`, `GET /api/orders`, `PATCH /api/orders/:id/cancel`
- `PATCH /api/seller/orders/:id/status`
- `GET /api/admin/seller-applications`, `PATCH /api/admin/seller-applications/:id/review`
- `GET /api/admin/moderation/products`, `PATCH /api/admin/products/:id/review`

All protected routes require `Authorization: Bearer <token>`. Registration creates buyer accounts only. Seller privileges are granted only after admin approval. Never expose a public role-change endpoint.

## Admin bootstrap
There is deliberately no public admin-creation route. Before launch, register the intended owner account and promote that exact account to admin using a private, audited database administration session. Restrict database credentials, verify the account identity out-of-band, and rotate/revoke the privileged credential after bootstrap. Never place the database password in source control or a chat.

## Hosting outline (free-tier caveats)
- The API can be deployed as a Node web service on Render or another Node host.
- A PostgreSQL provider such as Neon can supply `DATABASE_URL`; create the database under the owner's account and store the connection string as a host secret.
- Set `WEB_ORIGIN` to the exact public storefront origin, `NODE_ENV=production`, and provider-required TLS settings.
- Free-tier quotas, sleeping/cold starts, database limits and provider terms can change. Check current pricing and limits before choosing.
- Apply schema only to a new development database first. Production migration requires a backup, review and explicit owner approval.

## Not yet production-complete
Email verification, password reset, MFA, seller identity verification, image uploads and safe image storage, inventory/stock reservation, full delivery operations, buyer/seller messaging, reviews, support tickets, refunds/disputes, payment integrations, shared distributed rate limiting, monitoring, backups/restore automation, full integration/E2E tests, penetration testing and privacy/legal review remain outstanding.

The current API uses bearer tokens returned in JSON. Before frontend integration, choose and test secure token storage/rotation and XSS protections. This API must not collect real customer information until hosting, database, security and legal launch gates are approved.
