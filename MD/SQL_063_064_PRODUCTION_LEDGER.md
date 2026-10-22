# SQL 063 and SQL 064: confirmed manual production applications

The bank owner supplied SQL Editor verification:
- SQL 063: `public.subscription_plans` and `public.partner_organizations` both have RLS enabled, and `anon` and `authenticated` SELECT privileges are false.
- SQL 064: `businessos_inclusive_checkout_integrity_before_insert` is enabled on `public.business_pos_pricing_contexts` (trigger status `O`).

This document is an **audit reference**, not an executable migration. The manually applied SQL numbers conflict with earlier draft stage labels 057–062. Reconcile the applied migration ledger before adding any of those stage drafts to `supabase/migrations/`.

Do not assume a trigger's existence proves full checkout correctness or that the database-wide Security Advisor is clear.
