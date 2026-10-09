# Phase 06 — Catalogue and Inventory

Implemented: persistent product/service/package catalogue, authenticated product form, service inventory exclusion, stock movement tracking, guarded adjustment RPC, stock summary and movement history.

Deployment: apply existing migrations 001–006 followed by `007_catalog_inventory.sql` in a staging Supabase environment. This SQL is NOT applied automatically. Previous permissive catalog/inventory write RLS policies are replaced with read-only access; RPC operations handle controlled writes.

Outstanding: purchasing/supplier bills, reserved stock, stock costing models, order-connected inventory deduction, refunds and multi-warehouse transfer flows. No automatic stock deduction is claimed for Phase 05 orders. Services and packages are not stock-tracked by default. No tax is charged until validated tax rules exist.

Test: create product with stock, create service (untracked), adjust stock up/down, reject overdraw, reject unauthorized membership, isolate businesses, ensure opening movement matches stock, verify UI on mobile, run `npm install && npm run typecheck && npm run build`.
