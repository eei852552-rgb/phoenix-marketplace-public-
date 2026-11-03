# Phoenix Marketplace Club — Product Roadmap

မြန်မာနိုင်ငံအတွက် Burmese-first marketplace. This roadmap records the complete intended product scope. A roadmap item is a plan, not a claim that the feature is live.

## Release 0 — Public front-end demo (current)
- [x] Mobile-responsive Burmese-first storefront
- [x] Sample catalog, categories, search and price sorting
- [x] Demo-only product detail and seller contact notices
- [x] GitHub Pages deployment and custom 404 page
- [x] Clear disclosure that sample listings are not real offers
- [ ] Accessibility and cross-device review beyond the basic smoke test

## Release 1 — Safe marketplace foundation
- [ ] Select and approve a backend/database provider and data region
- [ ] Threat model, data-flow map, retention policy and backup/restore plan
- [ ] Database schema and migrations reviewed before application
- [ ] Authentication: verified email/phone flow, session expiry, recovery and rate limits
- [ ] Roles: buyer, seller, moderator, support, administrator; enforce permissions server-side
- [ ] Profiles with privacy-by-default fields
- [ ] Seller onboarding and verification workflow appropriate to local law
- [ ] Product create/edit/archive; image validation, size limits and safe storage
- [ ] Server-side validation for all user input
- [ ] Audit trail for sensitive moderation and administrative actions

## Release 2 — Listings and discovery
- [ ] Listing states: draft, pending review, published, rejected, suspended, archived
- [ ] Categories, tags, condition, location/region, delivery options and clear pricing
- [ ] Search, filters, sorting, pagination and empty/error states
- [ ] Duplicate/spam detection and prohibited-item policy
- [ ] Report listing / report seller flow
- [ ] Moderation queue with reason codes and appeal process
- [ ] Seller dashboard with listing status and basic performance metrics

## Release 3 — Buyer/seller transactions
- [ ] Cart and checkout backed by server-side order creation
- [ ] Order states and allowed state transitions
- [ ] COD only for the initial transaction release, if operationally supported
- [ ] Delivery method, delivery fee disclosure and delivery status tracking
- [ ] Buyer/seller order history and cancellation/refund/dispute rules
- [ ] Never trust client-side price, seller ID, discount or order total
- [ ] Idempotency and duplicate-order protection

## Release 4 — Communication and trust
- [ ] Private buyer/seller messaging with abuse reporting and blocking
- [ ] Contact privacy controls; do not expose phone numbers by default
- [ ] Reviews only after an eligible completed order
- [ ] Review moderation, fraud/spam controls and seller response
- [ ] Notifications with user preferences
- [ ] Support ticket flow and escalation process

## Release 5 — Revenue and operations
- [ ] Commission rules, fee disclosure and seller statements
- [ ] Optional paid promotion/advertising only with clear labeling and consent
- [ ] Admin dashboard, role separation and audit logs
- [ ] Reconciliation and dispute handling before any online payment method
- [ ] Analytics with data minimization and retention controls

## Release 6 — Scale and future capabilities
- [ ] English language option alongside Burmese
- [ ] Digital goods and service listings with category-specific rules
- [ ] Seller storefronts, wishlists and saved searches
- [ ] Recommendations with transparent controls
- [ ] Performance, CDN/image optimization and search indexing
- [ ] Android app only after the mobile web product is stable
- [ ] Multi-region resilience and documented incident response

## Architecture principles
- Frontend is untrusted. Authorization, validation, pricing and order state belong on the server.
- Use least-privilege database policies; deny by default and test access for every role.
- Keep secrets in deployment secrets, never in browser JavaScript or Git history.
- Separate development, test and production environments.
- Use versioned migrations, backups and restore drills; never run an unreviewed production migration.
- Store only necessary personal data, define retention/deletion processes, and restrict staff access.
- Use accessible controls, keyboard support, readable contrast and responsive layouts.

## Launch gates (must all pass before real customers)
1. Product owner approves provider, budget, legal terms, fee model and operational responsibilities.
2. Privacy notice, terms, prohibited-items policy, returns/refunds and support contact are reviewed for the launch jurisdiction.
3. Authentication, authorization, RLS/permissions, input validation and rate limits pass security tests.
4. Order lifecycle, COD operations, duplicate requests, cancellation and dispute cases pass end-to-end tests.
5. Backup restoration, monitoring, incident response and rollback are demonstrated.
6. Accessibility, mobile browser and performance checks pass.
7. No demo data is mixed with real listings; no placeholder controls imply a live transaction.
8. A staged release is monitored before broad public launch.

## Current truth
The published site is a static demonstration. No real accounts, seller submissions, persistent listings, messaging, orders, checkout, payments, moderation console or admin console are active. Do not collect customer information or accept money through this demo.
