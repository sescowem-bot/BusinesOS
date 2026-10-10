# Phase 11 — Campaigns and Automations (safe first release)

## Included
- Contact segments using existing customer records (all, email present, phone present).
- Draft campaigns with recipient previews using SECURITY DEFINER transaction and tenant/owner checks.
- Automation definitions connected to existing communication templates, always disabled.
- Preview queue locked to preview/cancelled; no live sending.
- Business-owner-only creation permissions, RLS and tenant-scoped foreign keys.

## Not implemented / must be built before sending
- Explicit, recorded marketing consent; suppression/unsubscribe/DND lists; legal compliance review.
- Durable worker, schedule execution, event triggers, idempotency, delivery receipt webhooks, retry policy, provider integrations, budgets, approvals.
- Segment counts currently reflect availability of email/phone only, NOT permission to message.
- Scheduling is a future-facing schema field, not an executable schedule yet.
- No webhook/API keys/paid sending in this phase.

## Deployment
Apply migrations 001 to 012 in sequence to a staging database (not production first). Verify RLS tenant isolation, internal approval workflow and queue restrictions. Run `npm install`, `npm run typecheck`, `npm run build` in a network-enabled CI environment. This package has not been live-tested.

## Known technical caveat
Existing Phase 10 database permissions and authentication are not fully production audited. Perform independent security assessment before using contact data in real campaigns. Dynamic template variables need escaping and a strict allowlist when added.
