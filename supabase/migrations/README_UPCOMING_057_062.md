# SQL migration numbering and staging drafts (updated Phase 0)

**Production migration 057 is now:** `057_lock_down_legacy_catalog_tables.sql`.
It enables RLS and revokes public, anon and authenticated privileges on two unused legacy catalog tables without deleting rows.
Run it in a separate staging database and perform an executable SQL test before production release.

The older drafts labelled **057–062** remain quarantined under `supabase/staging-review/` and are **not** ready for live Supabase. Their historical stage labels now collide with the production 057 security repair. They must be independently reviewed, reconciled, **renumbered to the next free migration numbers**, and revalidated before any promotion. Never copy them into `supabase/migrations/` using their old names.

The existing 062 governance objects may already be installed manually in the target database. Do not rerun that installer or assume a folder label confirms production schema state. First execute the read-only diagnostics and audit user-scoped and legacy definer permissions.

Never modify or replay migrations 001–056. See `MD/PHASE_0_SECURITY_HARDENING.md` for tests and gates.
