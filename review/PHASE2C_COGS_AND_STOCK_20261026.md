# BusinessOS Phase 2C — Tracked-stock COGS and inventory asset integration

**Applied to production on 26 October 2026.** This release extends Phase 2A/2B's POS revenue, VAT and refund integration without rewriting earlier sales, payments, stock or posted journals.

## Scope installed and verified

Four Supabase migrations (archived in `review/sql/*_APPLIED_DO_NOT_RERUN.sql`):

- `businessos_phase2c_inventory_cogs_account_mapping` — creates dedicated `gl_inventory_cost_settings` with tenant-bound asset and expense foreign keys, restricted finance read, and audited `gl_configure_inventory_cost_accounts` RPC. Revokes public/anon EXECUTE of the existing `gl_post_journal` function.
- `businessos_phase2c_atomic_stock_cost_ledger_trigger` — `gl_pos_inventory_cost_after_post` appends two new journal lines atomically only when a POS/refund source event transitions to Posted. Cost is taken from original `order_items.unit_cost`, and a sale inventory movement must substantiate stock movement.
- `businessos_phase2c_stock_cogs_financial_health_metrics` — adds `stock_cost_mapping_ready`, `uncosted_posted_pos_sales` and `unreversed_restock_costs` to the authenticated read-only financial integrity summary.
- `businessos_phase2c_stock_account_mapping_collision_guards` — updates both financial integration configuration RPCs to prohibit using cash/receivables as inventory asset or ordinary operating expenses as COGS, and prohibits enabling automatic posting for an existing tracked-product business without inventory cost mappings.

**Journal impact on newly posted source events:**

| Event | Debit | Credit | Conditions |
|---|---|---|---|
| Tracked-stock POS sale | COGS expense, historical purchase cost | Inventory asset, same historical cost | Sale line has actual negative inventory movement; cost mapping present |
| Restocked POS refund | Inventory asset, returned historical cost | COGS expense, same amount | Approved external refund, credit note says restocked, original sale-stock movement exists |
| Non-restocked POS refund | No inventory/COGS entry | No inventory/COGS entry | Revenue and VAT reverse through Phase 2A's existing refund journal; cost remains consumed |
| Non-stocked service | No inventory entry | No inventory entry | Phase 2A posts revenue/VAT/payment as appropriate |

Fractional restocks use cumulative unit-cost rounding so a full return matches the original cost up to cents. A zero historical item cost produces no cost amount but still requires a reviewed mapping for tracked inventory. Duplicate source events are prevented by their source unique key and already-posted journals do not get new lines.

If the cost mappings are missing or invalid when tracked-stock POS posting occurs, the source event is marked Error/Pending by the existing accounting queue; this prevents silent posting of a sales journal without its COGS and inventory offset. Never manually invent new account mapping IDs to bypass errors. The source transaction itself still stands.

## Application

Accounting / General Ledger now offers **Inventory Asset** and **Cost of Goods Sold** selectors, an explicit valuation acknowledgement, and a save operation guarded by the Accounting:Edit action and finance roles. When the business has tracked products, the accounting integration also checks that a cost mapping exists before enabling automatic posting.

The Accounting integrity panel now reports missing posted stock-cost lines and missing restock reversals, alongside its prior VAT/refund/journal checks.

## Critical financial limitation

**This is POS stock cost relief, not a complete inventory valuation or inventory costing subsystem.** Goods purchases, opening stock, supplier bills, stock counts, transfers, damaged goods, and inventory valuation policy are *not* independently posted by this phase. An accountant must establish the opening Inventory Asset value and record approved stock purchases/adjustments before interpreting the stock balance or profit. Warehouse location balances are quantities; they do not by themselves prove an accounting asset value. Service/nontracked product costs also require a separately verified costing policy.

The cost basis comes from the item snapshot at checkout, not FIFO, weighted-average costing, or later product price changes. Any difference between supplier acquisition cost and `order_items.unit_cost` is an accounting reconciliation issue; no silent cost correction is made.

## Acceptance and limitations

Verified against the **live production database**:
- All four migration versions exist and completed.
- The posted-event trigger exists on `gl_source_events`.
- Only authenticated finance roles can call the cost-mapping RPC; neither anonymous clients nor authenticated clients can directly execute the internal trigger.
- Anonymous EXECUTE on `gl_post_journal` has been removed.
- Cross-business account mappings are blocked by composite foreign keys; class and active-status checks are performed inside the authenticated RPC.
- Current database has **0 active cost mappings, 0 accounting integrations, 0 posted journals and 0 POS sales/refunds**. Existing records were preserved.
- Read-only Professional Owner diagnostic returns both cost counters as zero, and mapping-ready=false, matching current baseline.

**Not yet completed:** real, authenticated POS payment → invoice → GL journal → restocked/non-restocked refund acceptance with a funded or configured accounting ledger; real cost adjustments/stock acquisition postings; and audited profit/tax returns. No external transfers or charges were initiated, and no fictitious production sale was inserted.

Run `review/sql/20261026_phase2c_READ_ONLY.sql` after release for system-catalog verification. The migration snapshots must NOT be replayed. Accounting integration should remain paused until the business's opening stock, chart of accounts, period, VAT and inventory costing policy are reviewed.
