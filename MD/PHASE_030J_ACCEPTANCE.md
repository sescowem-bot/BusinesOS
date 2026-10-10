# Phase 030J — Staging acceptance checklist

For every test, record the test account, expected and observed result, evidence screenshot/log, and pass/fail decision. Perform tests on **staging only** using separate owner, manager, sales and unrelated-business accounts.

## Prerequisites

1. Migration 036 was applied before 037; no partial migration remains.
2. `MD/VERIFY_SQL_037_READ_ONLY.sql` reports all objects installed and RLS enabled.
3. CI `npm ci`, `npm run typecheck`, all source checks and `npm run build` pass.
4. POS entitlement is granted to the intended staging business and relevant staff roles.
5. Two businesses with overlapping product labels and two sales staff accounts exist.

## Cashier workflow

6. Sales user opens a shift with zero opening cash.
7. Another shift for the **same** cashier and business is rejected.
8. A second cashier can open their own shift for that business.
9. POS cash sale is linked to cashier's open shift, once.
10. Repeated POS checkout request ID does not duplicate sale/shift receipt.
11. POS transfer/card sale does **not** increase cash in till.
12. Unpaid POS sale does **not** increase cash in till.
13. Later POS cash payment during the cashier's open shift is captured once.
14. Later cash payment posted **without** an open shift appears as an exception.
15. A POS sale without an open shift appears in the unassigned-sale exception count.
16. Cash-in movement increases expected till cash; duplicated voucher is rejected.
17. Cash-out movement decreases expected till cash; duplicated voucher is rejected.
18. Negative, precision-invalid, oversized or zero-value movement is rejected.
19. Cash movement without a detailed reason/reference is rejected.
20. Cashier cannot alter or create movements on another cashier's shift.
21. Cashier closes with exactly expected amount; variance is zero.
22. Cashier closes with less than expected; negative variance is preserved.
23. Cashier closes with more than expected; positive variance is preserved.
24. Further cash movement or second close on same shift is rejected.
25. Manager cannot approve own shift; manager can review another cashier's closed shift.
26. Owner can accept or flag shift and reason is required for variances/flagging.
27. Approval does not erase variance or post journals.

## Reconciliation and data security

28. Completed **cash** refund without matching cash-out reference shows control exception; matching voucher and amount clears indicator.
29. Browser-limited rows do not truncate SQL totals (more than 100 receipt and movement rows).
30. Unrelated business cannot read, close, record movements, or review another business's shifts, even by direct RPC.
31. App user cannot directly INSERT/UPDATE/DELETE any new till audit table.
32. Owner daily report groups open date in Africa/Lagos and does not include unfinished shifts as closed.
33. Payment edited after cash capture raises a changed-payment exception; cashier cannot silently rewrite snapshot.
34. Desktop, small iPhone and Android layouts allow every cashier form and report; no fixed menu overlaps confirmation.
35. Concurrent checkout and shift close cannot silently omit a cash receipt: verify row-lock ordering.
36. Prior POS, returns, invoice, VAT, stock, order and initial-payment workflows still pass regression testing.

**Go/no-go:** Any failed cash-capture, tenant isolation, double-counting, duplicate submission, RLS or build test blocks production activation.
