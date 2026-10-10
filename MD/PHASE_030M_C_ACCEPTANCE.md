# Phase 030M-C staging acceptance — Professional dashboard and support

Use a **staging database**, test accounts for two different businesses, owner, manager, finance, sales, staff and one active/inactive platform admin. Record a timestamp, test order ID, actual values and screenshots for each scenario.

1. Apply SQL 042 once after 041. Confirm its three tables, seven RPC functions, RLS and SELECT-only client table grants.
2. Open the dashboard with an empty business: no fabricated amounts; usable empty-state messaging and eight-or-fewer order rows.
3. Create ordinary order ₦5,000, initially unpaid: dashboard sales change, recent order says Unpaid and balance ₦5,000.
4. Record ₦2,000 initial/next payment: dashboard recent order says Part payment, balance ₦3,000.
5. Record final ₦3,000: dashboard recent order says Paid in full, balance ₦0.
6. Confirm payment amount is counted in the period when recorded, not the order's original sale period.
7. Cancel a test order: its outstanding balance and new-period sales are not counted as valid sales.
8. Create a new order with an evidenced nonzero unit cost; assert one order + one payment + one cost evidence record, atomically.
9. Create reviewed-VAT order with unit cost and verify VAT, discounts, payment total and cost evidence remain separate.
10. Reuse an order request ID with a changed cost; reject without duplicate order/payment.
11. Open an old manual order with no cost: show missing cost field; record correct cost once, verify dashboard gross margin coverage increases.
12. Retry historic manual cost update: reject; confirm no overwrite of first cost evidence.
13. Try a POS order for manual cost backfill: reject. Historical POS cost snapshots remain unchanged.
14. Try a cancelled order for manual cost backfill: reject.
15. Confirm the original invoice totals, payments, customer balance and VAT remain unchanged after cost entry.
16. Verify estimated gross profit is not called audited net profit and includes only eligible POS and cost-evidenced manual orders; unknown costs are not treated as free.
17. Confirm sales-role account cannot write cost evidence or view profit; staff cannot see financial amounts through the dashboard RPC.
18. Confirm owner, manager and finance users only see profit when Financial Reporting plan permissions allow it.
19. Business owner opens `/team`, changes an existing staff role. Confirm business membership updated and exactly one role-audit row created.
20. Business owner cannot promote a business member to Owner or Platform Admin via team edit.
21. Staff account cannot call `business_update_team_role` directly.
22. Owner submits `/support` role-change request for a specific non-owner member, specifying the proposed role.
23. Admin views `/admin/support` and executes exactly the owner-requested role change; audit records actor and request.
24. Admin attempts to assign a different role or different target by manipulating form payload: database must ignore the attempted choice; uses stored owner request only.
25. Current owner withdraws/loses ownership before support action: execution must reject.
26. Platform Admin cannot promote an Owner, transfer business ownership, silently impersonate users or gain access to their sessions.
27. A general support request gets an admin response without changing any role.
28. An inactive/non-admin account cannot access `/admin/support` or its RPCs.
29. Business A staff cannot read Business B support requests, cost evidence, team audit history or dashboard summary.
30. Open all screens on 360px Android/iPhone, tablet and desktop; confirm no overflow, large touch targets and clear errors.
31. Test all 73 application routes and old POS, payments, VAT, invoices, team invitations, subscriptions and returns regressions.
32. Confirm `npm ci`, `npm run typecheck`, full Next.js production build and Vercel Preview build pass with pinned lockfile.
33. Inspect query timings and `EXPLAIN (ANALYZE, BUFFERS)` with thousands of transactions. Compare dashboard response payload size and first load time with previous release. Block deployment on unacceptable regressions.
34. Confirm SQL 042 is deployed before the matching app source; rollback procedure preserves already-issued invoices and recorded transactions.

**Deployment gate:** Do not treat these source-level tests as live Supabase verification. Finance, membership, audit and business isolation must pass in staging before enabling for real customer data.
