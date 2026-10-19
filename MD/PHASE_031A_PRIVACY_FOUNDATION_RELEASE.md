# BusinessOS Phase 031A — Privacy & Legal Evidence Foundation
Status: REVIEW BRANCH — NOT DEPLOYED TO PRODUCTION; LEGAL CONTENT NOT APPROVED.
Date: 19 October 2026.
Branch: compliance/data-protection-foundation-2026.
Migration: supabase/migrations/051_privacy_rights_legal_evidence.sql.

## Delivered
- /settings/privacy: submit an individual privacy enquiry and view your own requests; business-wide requests are owner-only.
- /admin/privacy: review and respond to private requests, gated by active platform administrator access.
- SQL 051: RLS-protected privacy rights queue, secure user submission RPC with rate limit, admin-only review RPC, append-only status audit events.
- SQL 051: immutable published legal document version evidence (key, version, SHA-256, review record, approver and effective date). No approved versions are pre-seeded.
- SQL 051: user acceptance evidence tied to the exact approved Terms version via auth signup trigger and authenticated acceptance RPC.
- Signup and onboarding are Terms-aware only after a reviewed, effective Terms version is available and its checksum matches the published /terms page.

## Installation — protect customer records
1. Back up production. Confirm migration 050 and every prerequisite really ran in Supabase before 051. GitHub files alone do not mean migrations ran.
2. Run 051 exactly once in a separate staging Supabase project; inspect errors and validate table RLS, RPC grants and auth triggers.
3. Validate the two-merchant role matrix in staging (anonymous, staff, owner, platform admin). Do not use real customer records as fixtures.
4. Only after the staging acceptance checks pass, apply 051 to production, then merge source with approved review and inspect Vercel deployment.
5. Keep Privacy, Terms and Cookies as unapproved drafts until verified operating entity, vendors, retention, transfer safeguards, and legal review. Do not seed fictional legal approvals.
6. Publishing a legal version is a separate trusted database operation, not a public-CMS checkbox. The document checksum must be calculated from the same rendered CMS page the user reads.

## Tests required before production
- A and B businesses cannot read or alter each other's requests.
- Staff cannot request business-wide disclosure without owner permissions.
- A request cannot be submitted anonymously or as another user.
- Direct SQL/API writes to legal versions, acceptance evidence, decision status or audit events are denied to ordinary authenticated users.
- A user can view their own request, and the System Owner can review; status changes create events.
- Request throttling caps accounts at ten submissions within 24 hours, and does not bypass owner role checks.
- Auth signup works when no approved version exists; after approval it records the correct document ID; onboarding handles missing acceptance.
- Invites and password reset flows are unaffected by the signup trigger.
- Completed request status does NOT itself delete data or send a regulator notice; those require separate verified workflows.
- Run npm run check:routes, npm run typecheck, npm run build, then preview test, including supported mobiles.

## Document checksum contract
The current Terms helper obtains the published legal page through getPublicPage('terms').
It hashes JavaScript JSON.stringify of an object with keys in this order:
slug, title, eyebrow, description, sections.
The content_sha256 on the approved Terms version must match the resulting lowercase hexadecimal digest. Any mismatch blocks signup/onboarding until corrected. A fresh reviewed version is required for substantive changes.

## Still to implement
- Version-controlled optional marketing consents and withdrawal.
- Real production cookie inventory and consent settings, if optional tracking exists.
- Verified data export, correction, deletion, backup expiry and legal-retention workflow.
- Tenant-wide RLS and storage penetration tests, privacy DPIA, independent security review.
- Vendor/subprocessor registers, cross-border contracts, NDPC classification and registrations as applicable.
- Current-account material Terms change re-acceptance and incident response runbook.

This technical upgrade does not itself constitute NDPC registration, independent certification, legal review or full statutory compliance. Do not claim that it does.
