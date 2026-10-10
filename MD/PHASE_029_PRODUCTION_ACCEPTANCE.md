# Phase 029 — Staging acceptance matrix

Record the actual result, evidence and environment for every test. `PASS` must mean the workflow completed with real accounts and persistent Supabase records; opening a page is insufficient.

| ID | Test | Expected result | Status |
|---|---|---|---|
| AUTH-01 | Signup, confirmation, login, logout, reset-password | Correct verified user, valid session, working redirects | NOT TESTED |
| AUTH-02 | Deactivate System Owner while session is open | Next privileged request is denied | NOT TESTED |
| AUTH-03 | Switch between two owned businesses | Data and selected workspace reflect the correct business | NOT TESTED |
| SEC-01 | Ordinary staff directly visit `/admin`, `/admin/website`, `/admin/businesses` | Denied without disclosure of platform or customer data | NOT TESTED |
| SEC-02 | Business A user changes IDs/cookies to Business B | No access or mutation permitted by RLS and RPCs | NOT TESTED |
| SEC-03 | Staff member calls premium feature RPC without plan permission | Database enforces restriction despite any page links | NOT TESTED |
| SEC-04 | Anonymous visit to `/api/setup-status` | 403 JSON, no environment configuration disclosed | NOT TESTED |
| SEC-05 | Cross-business access to `/api/reports/export` | Only current authorised tenant's data | NOT TESTED |
| BIZ-01 | Register customer, product, sales order | Records persist; totals and membership correct | NOT TESTED |
| BIZ-02 | Record partial payment then final payment | Remaining balance reaches zero; no double payment | NOT TESTED |
| BIZ-03 | Issue invoice twice/concurrently for the same order | One durable numbered issued invoice | NOT TESTED |
| INV-01 | Stock-count from two sessions after concurrent movement | Conflict detected; no silent overwrite | NOT TESTED |
| GL-01 | Record paid expense then post to chart of accounts | Balanced journal after configured automation; no duplicate source | NOT TESTED |
| GL-02 | Reconciliation with missing chart/paused automation | Clear pending/errors; never claim complete financial report | NOT TESTED |
| RPT-01 | Export a small valid ledger and tax schedule | Correct rows with business scope, CSV safety, no caching | NOT TESTED |
| RPT-02 | Export a row set larger than Supabase response limit | HTTP 409 with explanatory JSON; no partial CSV download | NOT TESTED |
| ADM-01 | Request and approve a plan change | Correct audit, approved plan and feature gates | NOT TESTED |
| CMS-01 | Change name/logo/favicon | Public site, admin, business dashboard, email previews reflect saved settings | NOT TESTED |
| MAIL-01 | Send a branded Resend test email | Test log and provider status can be reconciled | NOT TESTED |
| MAIL-02 | Send forged Resend delivery webhook | Rejected; no log change | NOT TESTED |
| MAIL-03 | Replace Auth email hook only in staging | All email actions arrive; rollback to current service verified | NOT TESTED |
| UX-01 | Desktop and mobile navigation, full keyboard use | All relevant routes accessible; no clipped/overlapping controls | NOT TESTED |
| BUILD-01 | `npm run typecheck`, `npm run build`, GitHub CI and Deno check | All pass without warnings hiding actual errors | NOT TESTED |

## Evidence template

- Environment, branch, commit SHA, deployment URL:
- Role and business used (do not include personal secrets):
- Test ID, expected result, actual result:
- Timestamp, steps to reproduce, application URL:
- Relevant redacted Vercel log / Supabase error code:
- Reviewer and verification date:

Launch is blocked by any failed critical AUTH, SEC, financial data integrity, or BUILD check. Do not move to a commercial pilot until those blockers are repaired and retested.
