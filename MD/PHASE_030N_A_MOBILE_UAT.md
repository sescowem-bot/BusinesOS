# BusinessOS Phase 030N-A — Mobile & User Experience Staging Tests

Record tester, device, browser, elapsed time, screenshot and pass/fail. These are **planned** tests; they have not been executed on a live instance.

| ID | Test | Expected outcome |
|---|---|---|
| UX01 | New account or test business opens workspace on 375px phone | Clear readable navigation and prominent Getting started |
| UX02 | Owner opens `/getting-started` | Customers, products and orders are queried by `head: true`, not downloaded |
| UX03 | Empty business opens onboarding | Clear steps with direct actions and no fake success |
| UX04 | A step's count query fails | Page still loads but flags unavailable setup progress |
| UX05 | Sales user opens customer directory | Create order link appears for permitted role only |
| UX06 | Staff user without sales authority opens directory | No misleading payment/creation action |
| UX07 | Click Create order from Customer A | Customer A is preselected in the order form |
| UX08 | Manually tamper `?customer=` to another business's ID | Parameter ignored; no foreign customer preselected |
| UX09 | Ordinary unregistered VAT workspace opens New Order | Only ordinary order form shown; VAT supply queries skipped |
| UX10 | Reviewed registered VAT workspace opens New Order | Only reviewed-tax form shown with approved current supplies |
| UX11 | Registered but unreviewed VAT workspace | Order form blocked; tax setup route shown |
| UX12 | Supabase tax profile query fails | Order form blocked; no unsafe tax fallback |
| UX13 | Select Not paid and create order | One order; zero initial payments; full balance due |
| UX14 | Select Part payment and enter valid amount | One order and one recorded payment; correct remaining balance |
| UX15 | Select Paid in full | Exact database-calculated total recorded; zero balance |
| UX16 | Duplicate Save / network retry with same key | No duplicate order or payment |
| UX17 | Orders shows unpaid and part-paid entries | Clear status wording and Next step action |
| UX18 | Tap Review / receive payment | Opens specific order scrolled to payment-history section |
| UX19 | Order role without payment permission | Action says Review balance, no false promise to record payment |
| UX20 | Search and status filter | Results update instantly over loaded data without extra DB query |
| UX21 | On iPhone 320/375/430px, open Orders and Customers | Each record displayed as labelled card, no hidden monetary values |
| UX22 | Keyboard-only or screen reader | Search label, record headings, order actions and focus visible |
| UX23 | Load on poor mobile network | Core text/forms usable, no heavyweight chart bundle added |
| UX24 | Existing POS, cashier, returns, tax, admin and team workflows | No regressions or route removal |
| UX25 | Desktop 1024/1440px | Tables retain readable column layout and no wrapping into mobile cards |
| UX26 | Lighthouse before/after or Web Vitals | Record real LCP, INP, CLS, TTFB, not just subjective speed |
| UX27 | Clean `npm ci`, `npm run typecheck`, `npm run build` | Pass on fresh checkout with compatible lockfile |

**Production go/no-go:** Block rollout on failed tax isolation, cross-tenant preselection, duplicate payment, broken navigation, or failed build. Do not infer performance improvement from fewer source queries alone.
