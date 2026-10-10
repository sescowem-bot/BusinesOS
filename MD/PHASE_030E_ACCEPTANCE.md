# Phase 030E staging acceptance record (complete using real data)

| ID | Scenario | Expected result | Status |
|---|---|---|---|
| 01 | POS disabled for current plan | Module denied | Not tested |
| 02 | Grant POS to business A only | Business A gets access, B denied | Not tested |
| 03 | Grant POS without inventory permission | Cashier can sell, cannot manually adjust stock | Not tested |
| 04 | Sales role checkout | Allowed with POS feature | Not tested |
| 05 | Other staff role checkout | Denied | Not tested |
| 06 | Two-product paid checkout | 1 order, 2 lines, 1 payment, 2 stock movements | Not tested |
| 07 | Two-product unpaid checkout | 1 order, 0 payment, stock decremented | Not tested |
| 08 | Repeat request UUID | No duplicate order/payment/stock movement | Not tested |
| 09 | Insufficient stock | No order/payment/movement; unchanged stock | Not tested |
| 10 | Two simultaneous last-unit sales | At most one succeeds; stock nonnegative | Not tested |
| 11 | Cross-business product/customer | Rejected | Not tested |
| 12 | Supplier creation permissions | Non-purchasing users denied | Not tested |
| 13 | Create draft PO | Stock unchanged; correct line costs | Not tested |
| 14 | Receipt without inventory entitlement | Rejected | Not tested |
| 15 | Receive draft once | Correct stock changes and audit movements | Not tested |
| 16 | Double receipt | Rejected; no second stock change | Not tested |
| 17 | Cross-business supplier/PO | Rejected | Not tested |
| 18 | Responsive 320px/375px/desktop | All controls visible & operable | Not tested |
| 19 | Receipt/invoice printing | Accurate amounts; not labelled statutory tax invoice | Not tested |
| 20 | TS typecheck and Next.js build | Both pass in CI | Not tested |

Record actual tester, date, evidence, failure notes and environment in your Pilot Readiness centre. These rows are not claims that the tests have passed.
