# Where are SQL 057–062?

The staging-review drafts named 057–062 are separate from the production migrations in this directory. Do not copy them over or execute them as production migrations. If SQL 062 reports "Stage 063 deletion requests already exist", run the read-only diagnostic and reconcile existing database objects first.

Current production migration sequence in this directory:
- 057_lock_down_legacy_catalog_tables.sql — applied to live Supabase.
- 058_businessos_shared_rate_limits.sql — applied to live Supabase.
- 059_restrict_internal_security_definer_functions.sql — in security PR review; not yet applied.

Never edit installed migrations 001–056. Keep production migration numbering separate from the staging-review drafts.
