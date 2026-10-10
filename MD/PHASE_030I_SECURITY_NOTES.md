# Phase 030I security and finance limitations

- There are no write RLS policies on the three new tables; direct authenticated write access is revoked. Mutations only occur through 3 audited, tenant- and role-checked RPCs.
- SQL locks orders and order_items before calculating returns, allocates exact cents cumulatively and restricts each item to one outstanding request.
- No card reversal or bank transfer occurs. Manually entered refund confirmations require independent human evidence.
- Original orders/payments/invoices remain immutable. Existing gross reports **must not** be represented as net sales without return reconciliation.
- Customer tax treatment is never freshly inferred during a return. The original item-level tax evidence is used.
- A complete migration and staging acceptance test is mandatory before enabling the module in production.
