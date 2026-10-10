# Phase 030I — Staging acceptance matrix

Do not use real customer funds. Record status, tester, date, evidence and actual SQL row IDs for each scenario.

| ID | Scenario | Required result |
|---|---|---|
| R01 | Paid POS sale with 2 items: return 1 item | Request pending; no immediate stock/payment mutation |
| R02 | Cashier tries to approve | Denied by RPC |
| R03 | Manager approves cashier return | Approved; no credit note/refund/stock movement yet |
| R04 | Manager requests then attempts self-approval | Denied unless requester is owner |
| R05 | Manager rejects request | Rejected, item quantity can be requested again |
| R06 | Same request_id submitted twice | Same return ID, not a duplicate |
| R07 | Two simultaneous pending requests for same order item | At most one open return; quantities never exceed sold |
| R08 | Attempt return > originally sold | Denied |
| R09 | Attempt next partial return > remaining after completion | Denied |
| R10 | Fully paid original POS order with standard and zero-rated items | Net and VAT credit follow recorded item classifications |
| R11 | VAT-inclusive discounted sale | Refund follows original discounted taxable base; no new VAT evaluation |
| R12 | Sequential partial quantities (e.g. 1/3, 1/3, 1/3) | Cumulative credits equal full original item gross to cent |
| R13 | Different business attempts return RPC | Denied, no data cross-tenant |
| R14 | Disable POS subscription / revoke grant | No return RPC access |
| R15 | Unpaid or partially paid POS order | Denied |
| R16 | Non-POS order / order with delivery fee | Denied |
| R17 | Attempt completion before owner/manager approval | Denied |
| R18 | Refund reference missing or unconfirmed checkbox | Rejected |
| R19 | Complete approved refund with `restock=no` | Exactly one refund, one credit note, no stock movement |
| R20 | Complete approved refund with `restock=yes`, tracked product | Exactly one return movement, stock increases by returned quantity |
| R21 | Attempt restock for untracked/deleted product | Entire transaction fails; no refund or credit note |
| R22 | Retry already completed return | Denied; refund and credit note counts remain 1 |
| R23 | Original invoice before and after credit note | Original immutable and unchanged |
| R24 | Credit-note print on iPhone and desktop | All details fit A4/mobile; seller snapshot, original order, tax, evidence |
| R25 | Existing gross sales, invoices, payments and GL | Do not accidentally present unreconciled amounts as net revenue |
| R26 | Force failure midway in transaction (staging only) | All writes roll back together |
| R27 | Attempt direct table INSERT/UPDATE by ordinary authenticated user | Denied by database privileges |
| R28 | Full Next.js typecheck/build and automated regression suite | Pass before promotion |

**Production gate:** do not enable customer refunds until high-risk cases R07–R13, R19–R23 and R26–R28 have been verified in staging.
