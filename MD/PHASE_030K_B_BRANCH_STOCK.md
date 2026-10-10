# BusinessOS Phase 030K-B — Branch Stock and Transfers (Migration 039)

**Status:** source implementation ready for staging review only. Not certified for live inventory operations. No paid platform, terminal or AI API required.

## Installation order

1. Back up the database and repository. Confirm Migration 038 exists and has passed its read-only checker. **Do not rerun migrations 001–038.**
2. Deploy this source to a Vercel Preview branch. Run all CI checks including `npm run check:branch-stock`, TypeScript typecheck and `next build`.
3. In a **staging Supabase project**, apply `supabase/migrations/039_branch_stock_locations_and_transfers.sql` **once** using SQL Editor. Trigger and function grants require an authorised database administrator.
4. Execute `MD/VERIFY_SQL_039_READ_ONLY.sql` and review any nonzero reconciliation exceptions before using stock operations.
5. Test concurrent POS checkout in each location and user-role isolation before considering production deployment.

## Changes

- `/inventory/locations`: new branch stock manager showing company totals and balances by location; enable existing active business branches, transfer stock between locations and count stock per location.
- `/pos`: select the physical location before checkout. A location change clears the cart. Only the selected location's available quantity can be sold. The server verifies access and sets transaction-scoped location context; database triggers attribute stock deductions to that location.
- Migration 039 creates branch location balances, immutable transfer and count audit records, and a product-stock synchronization trigger. **All existing tracked stock is initially assigned to an explicit `Unallocated / receiving` location; there is no guessed branch attribution.**
- Existing purchase goods receipts, non-location adjustments and refunds enter *Unallocated*. Use a separately audited transfer to move received stock into a physical branch. Company-wide `products.stock_quantity` remains the canonical total; transfers never increase that total.
- If legacy checkout or a legacy stock adjustment tries to consume more *Unallocated* stock than exists, it fails rather than borrowing from an unrelated branch. Deploy code and migration together in staging.
- Legacy aggregate stock count is rejected when branch balances exist; use the new location-specific count with an optimistic expected quantity and audit history.

## Important bounded scope

- This is **not** advanced warehouse orchestration, a valuation engine or complete branch-specific financial accounting. Location reports show **stock quantities**, not branch profit or cost of goods sold.
- Existing posted POS sales retain their historical unknown location; this migration does **not** falsely backfill an individual branch on past sales. No financial journal history is changed.
- Supplier deliveries and returned items default to *Unallocated*. Partial receipts remain available; branch allocation is a second controlled step.
- Location activation requires Owner/Manager inventory rights; transfer requires Owner/Manager; location counts allow Owner/Manager/Inventory. Sales staff must be assigned to a selected branch. Server-side feature entitlements and business isolation are verified in SQL; an active business member cannot read another business's stock ledger.
- Company-wide inventory read surfaces still show the aggregate number. Do not use the older inventory counting form for distributed stock.
- Only **50 locations, 300 products, 7,000 balance records** are loaded on the management screen, and **500 products, 7,000 balances** on POS. Hitting a limit disables the relevant operations. Large retailers need server-side paging and product search before deployment.
- `SQL 039` is not tested against a running PostgreSQL/Supabase instance here; run the staging acceptance suite and check the exact PostgreSQL error messages. If migration installation fails, the transaction rolls back.

## Staging acceptance scenarios

1. Migration creates one `Unallocated` location for each business and attributed balances equal existing company-wide stock.
2. Creating a new tracked product adds its opening quantity to Unallocated, not a branch.
3. Enable a branch already present in Team & Branches; no stock moves automatically.
4. Transfer 4 of 10 units from Unallocated to branch; confirm Unallocated = 6, branch = 4, company total = 10; audit record exists.
5. Same transfer request key repeated returns same transfer without moving additional stock; a changed request with same key is rejected.
6. Transfer 20 units from a source holding only 6: reject and leave all balances unchanged.
7. POS checkout 2 units from branch: branch and company total both reduce by 2, Unallocated unchanged. Record location on sale.
8. Repeat the same checkout request: one order/payment/stock change only.
9. POS checkout 5 units from branch now holding 2: reject without partial stock/order/payment.
10. POS cashier not assigned to the branch: reject; approved Manager/Owner can use the branch.
11. POS sold from Unallocated: only Unallocated decreases.
12. Purchase receipt adds to Unallocated; manual transfer moves to branch; total remains consistent.
13. POS return restocked to Unallocated, with no implied branch provenance.
14. Physical stock count at branch with matching expected quantity records variance and adjusts branch plus company total together.
15. A stale count, over-count, invalid location and unassigned inventory member are rejected.
16. Legacy aggregate physical stock count rejects when product has assigned branch stock; original balance remains unchanged.
17. Two simultaneous cashiers checking out the last item cannot oversell.
18. Business A account cannot see or change Business B's stock locations and transfers.
19. Reader roles cannot write to balances, transfers or counts directly via Supabase REST.
20. Preview build and typecheck pass; run `MD/VERIFY_SQL_039_READ_ONLY.sql` with zero reconciliation exceptions after each scenario.

**No external cash or bank movement occurs from this upgrade.**
