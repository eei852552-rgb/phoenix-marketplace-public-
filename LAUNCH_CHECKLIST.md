# Production Launch Readiness Checklist

Do not mark the marketplace production-ready until every applicable item is evidenced and approved.

## Product and operations
- [ ] Owner/operator and support contact published
- [ ] Target regions, language coverage and age requirements approved
- [ ] Seller onboarding and verification process staffed
- [ ] Delivery, COD collection and failed-delivery operations tested
- [ ] Commission, advertising and fee rules disclosed
- [ ] Prohibited goods/services and takedown process published

## Legal and privacy
- [ ] Privacy notice reviewed for actual data flows
- [ ] Terms, seller terms and buyer terms reviewed
- [ ] Returns, refunds, cancellation and dispute policy published
- [ ] Cookie/analytics disclosure reviewed if applicable
- [ ] Data retention, deletion and user-rights process documented

## Engineering and security
- [ ] Separate dev/staging/production environments
- [ ] Secrets stored only in secure environment settings
- [ ] Authentication, recovery, session expiry and rate limits tested
- [ ] Server-side authorization and database row policies tested for every role
- [ ] Upload validation, malware/content moderation and storage permissions tested
- [ ] XSS, CSRF, injection, IDOR and abuse cases reviewed
- [ ] Audit logging, monitoring and alerting configured
- [ ] Backups automated and restoration drill passed
- [ ] Dependency and workflow permissions reviewed
- [ ] Rollback procedure tested

## Quality assurance
- [ ] Unit, integration and end-to-end suites pass
- [ ] Buyer, seller, moderator, support and admin journeys tested
- [ ] Duplicate order, stale price, invalid state transition and race conditions tested
- [ ] Mobile Android browsers and desktop browsers checked
- [ ] Keyboard, screen-reader labels, contrast and focus states reviewed
- [ ] Performance and error states checked
- [ ] No sample listings or fake testimonials presented as real
- [ ] No dead buttons or placeholder links presented as live functionality

## Release approval
- [ ] Owner approves budget and any paid services
- [ ] Owner approves production migration and release window
- [ ] Staged rollout and monitoring plan agreed
- [ ] Incident contact and escalation process confirmed

**Current state:** Static demo only. This checklist is a plan; none of the production gates should be assumed complete.
