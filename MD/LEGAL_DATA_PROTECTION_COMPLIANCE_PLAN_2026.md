# BusinessOS — Data Protection, Consumer Rights & Security Compliance Implementation Plan
**Status:** Implementation specification; NOT a legal compliance certification.
**Prepared:** 19 October 2026
**Product:** BusinessOS, a multi-tenant SaaS business platform initially serving Nigerian small businesses.
**Approval gate:** Operator and qualified Nigerian data-protection/legal adviser must verify facts, policies and controls before publication or full commercial launch.

## A. Current source-code observations (GitHub main branch, 19 October 2026)
- Routes `/privacy`, `/terms`, `/cookies` exist through `app/(public)/[slug]/page.tsx`; default pages in `lib/server/public-cms.ts` are expressly **under review** and unpublished.
- `app/admin/cms-actions.ts` rejects certain placeholder phrases on legal-page publication, but has no legal approval signature, policy version history or evidence register. Current controls do not prove legal review.
- `app/(auth)/signup/signup-form.tsx` and `actions.ts` do not capture and store versioned agreement to Terms; there is no distinct voluntary marketing opt-in.
- Core architecture includes Supabase authentication, tenant-related SQL/RLS and server-side authorization, but **the entirety of RLS, storage, third-party sharing, backups, logging, deletion and cross-border transfers has NOT been audited**.
- The company legal name, registration details, contact address, privacy contact, vendor subprocessors, actual cookie inventory, retention periods and processing purposes are not sufficiently verified to publish unqualified claims.
- These observations are a scoped code review, not penetration testing, NDPC registration verification, a legal opinion or proof of compliance.

## B. Statutory and regulatory context
1. Nigeria Data Protection Act 2023 (NDPA): lawful processing, transparency, minimisation, safeguarding personal data, enforceable rights, breach response, controllers/processors and transfers.
2. NDPC General Application and Implementation Directive (GAID) 2025: operational obligations in force from 19 September 2025, including registration/classification, applicable compliance-audit returns, risk assessments and accountability.
3. Federal Competition and Consumer Protection Act 2018: accurate plan advertising, disclosure of total prices and billing terms, complaints, remedies and fairness.
4. Cybercrimes (Prohibition, Prevention, etc.) Act as amended: assess applicable security, cybercrime cooperation and retention requirements with qualified counsel.
5. Applicable cross-border laws only after geographic and user-scope assessment (e.g. EU GDPR, UK GDPR); do not claim global compliance by default.
6. Specific tax, record-keeping or regulated-business obligations apply based on a merchant's type of activity. BusinessOS software does not replace those requirements.

Primary materials:
- https://ndpc.gov.ng/ndp-act-2023/
- https://ndpc.gov.ng/faqs/
- https://ndpc.gov.ng/ (official GAID 2025 resource)
- https://fccpc.gov.ng/consumers/consumer-rights-responsibilities/rights-responsibilities/

## C. Roles and information map (to be validated contractually)
**Platform operator as controller:** registration identities, account authentication, support tickets, subscriptions, billing records, platform analytics/telemetry and security incidents it determines purposes for.
**Merchant/business as controller:** its own customers, order contacts, debtors, invoice recipients and staff records, where the merchant determines why and how personal data is collected.
**Platform operator as processor:** merchant-managed personal data processed strictly to deliver its subscribed business software under documented instructions, except any independently determined processing purpose.
**Suppliers/subprocessors:** inventory actual Vercel, Supabase, authentication/email vendor, Paystack, logging, object storage and any future SMS/WhatsApp/analytics tool; confirm contractual roles, location, retention and transfer safeguards. Do NOT invent subprocessor countries or privacy guarantees.

## D. Work packages / release gates
### P0 — No unreviewed legal claims or undocumented collection
- Determine operating legal entity, CAC details (where applicable), physical/service address, operator support contact and dedicated privacy contact.
- Build processing inventory: data category, source, user/merchant purpose, controller/processor role, lawful basis, recipients, storage country, transfer mechanism, retention, erasure exception, security owner.
- Complete Nigerian counsel/DPCO review of Privacy Notice, Terms, Cookie Notice, merchant Data Processing Agreement (DPA), Subscription/Refund Policy, Acceptable Use and Data Retention & Deletion policy.
- Retain version, reviewer, approval time, effective date and policy hash for each published legal document. Avoid inaccurate 'certified' or '100% compliant' statements.
- Publish only final content in admin CMS, with audit trail and clear last-updated/effective dates. Keep current under-review notices pending approval.
- After approval implement mandatory unticked Terms agreement on account registration, displaying current version and recording exact document version, user ID, time, policy hash, action context, and evidence (minimum necessary). Existing users need a documented material-terms update flow.
- Provide a **separate** unticked, withdrawable marketing consent; never require marketing consent for core service.
- Make optional analytics/advertising scripts contingent on real cookie preferences with reject-all and granular settings; necessary session cookies remain essential. If no optional trackers exist, do not create a misleading banner.
- State full plan prices/fees, monthly and annual renewal conditions, cancellations and any applicable refunds before purchase. Never promise a refund or no-refund term that conflicts with law.

### P1 — Real security and data-subject rights
- Validate tenant isolation by testing every table, RPC and storage bucket through client and staff roles; check cross-tenant IDs and public-directory exposure.
- Enforce permissions on server/database, not only hidden UI, least privilege, owner/staff role separation, and safe admin support access with time-bound and audited authorisation.
- Enforce secret management, encrypted traffic, secure session handling, MFA for privileged users where supported, login abuse controls, rate limits, safe file upload, webhook signature verification, signed URLs, backup access and restore drills.
- Implement `/settings/privacy` and owner-accessible requests: access/copy, rectification, portability, erasure, restriction/objection, withdrawal of consent, and contact/escalation. Verify requester identity; do not reveal another business's data.
- Maintain request receipts, responsible party, action status, deadline, secure delivery and appeal/escalation; do not assume every erasure request overrides legitimate tax/accounting or legal retention duties.
- Implement merchant-account and customer-record deletion workflow with documented backup expiry, dependent invoice records and legally mandatory record retention. Provide a practical export before closure.
- Configure logs without credentials, tokens, private medical data or unnecessary personal data. Keep audit events for account access, privileged actions, data exports, deletion and changes to published policies.
- Implement security incident detection, impact assessment, breach register, response playbook and regulator/customer notifications where thresholds apply. NDPA section 40 provides a **72-hour notification window to NDPC** for qualifying risk breaches; affected people may also require notification where risk is high. Record discovery timestamp, decisions and delivery evidence.
- Carry out a DPIA for processing that is likely to result in high risk. Specifically review debt reminders, behavioural profiling, automated messaging, directory publication, financial information and any sensitive data.

### P2 — Governance, contracts and repeatable compliance
- Ask NDPC/licensed DPCO to determine whether platform operator is a Data Controller/Processor of Major Importance (DCPMI) and which category applies. Number of companies alone is not the classification test; account for actual individual data subjects, categories and statutory criteria. Complete any applicable registration, fee, DPO and Compliance Audit Returns.
- Sign appropriate DPA/controller–processor terms with merchant customers and contracts with each relevant subprocessor; review transfers outside Nigeria and legal safeguards.
- Written internal policies: access control, secure development, incident handling, vendor procurement, retention schedule, backup/restore, employee confidentiality and privacy training.
- Monthly metrics: open data rights requests, incidents, vendor changes, role reviews, deletion jobs, backup/restore checks, expired consents and new high-risk features.
- Independent security review before commercial scale; re-review at material releases and significant vendor changes.

## E. Proposed engineering assets (not yet implemented)
- `public.legal_documents`: unique code, version, effective_at, approved_by, approval_evidence_id, content_checksum, is_current; published current versions are immutable.
- `public.user_legal_acceptances`: auth_user_id, document_id, version, accepted_at, scope. Restrict access through RLS; server writes; never allow backdating.
- `public.marketing_preferences`: user_id, channel, granted, changed_at, legal_basis, consent_source with withdrawal history.
- `public.privacy_requests`: requester, target_scope, verified_at, requested_action, status, due_at, staff_owner, resolution_evidence; distinguish platform-controller vs merchant-controller requests.
- `public.security_incidents`: limited privileged access, first_detected_at, likelihood/risk assessment, reporting deadlines, actions and notifications; do not store raw compromised credentials.
- `public.processing_register` and `public.subprocessor_registry`: approved processing purposes, recipients, locations, contract review.
- `public.data_retention_rules`: record class, controlling purpose, required period, expiry action, exception/legal hold and owner.
- New server actions with idempotency, explicit authorisation and audit logging; migration must be additive, tenant-aware, staged and rollback-documented.

## F. Non-negotiable acceptance criteria
- [ ] Real operator identity and legal contact verified; privacy counsel reviewed current documents and legal bases.
- [ ] Public Privacy/Terms/Cookies accurate and approved; version history and public effective dates present.
- [ ] Registration cannot falsely assert legal consent; Terms acceptance and optional marketing preference recorded separately after review.
- [ ] Cookie scanner results match the notice and actual runtime; optional tracking respects preferences.
- [ ] RLS/storage/auth checks cover two isolated merchants, staff, anonymous, owner and platform admin.
- [ ] Data export, update, identity-checked requests, deletion/retention exceptions and backup lifecycle demonstrated.
- [ ] Live incident runbook exists and notification clocks are rehearsed.
- [ ] Valid controller–processor agreements and vendor register maintained; transfers documented.
- [ ] NDPC classification/registration/CAR/DPO/DPIA determinations signed off.
- [ ] All claims about compliance supported by dated evidence; avoid certification claims without a certificate.

## G. Decision register — must be supplied by operator
1. Legal trading/registered entity, registration number if any, address, billing entity and privacy contact.
2. Countries where users/visitors are deliberately served.
3. Definitive list of vendors enabled in production (Vercel, Supabase, Resend, Paystack, etc.).
4. Current volume of individual subjects processed and categories of sensitive data, to assess registration/DPIA.
5. Actual consented marketing channels, analytics and cookies in production.
6. Merchant account deletion policy and retention law advice, including financial records.
7. Incident-reporting roles, accountable owner, and assigned data protection lead.
8. Legal and DPCO approvals.

**Important:** This document is an implementation plan. No regulatory registration, agreement, data-protection compliance, security certification or code deployment is implied by creating it.
