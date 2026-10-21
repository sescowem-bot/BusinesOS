# Where are SQL 057–062?

SQL drafts **057–062 have not been approved as production migrations**. They are kept in [`../staging-review/`](../staging-review/) with a status guide and a read-only SQL 062 diagnostic. This prevents confusing draft SQL with ready-to-apply migrations.

Current active version in this directory: **056**. Do not run the staging SQLs on live Supabase. If SQL 062 reports "Stage 063 deletion requests already exist", run the read-only diagnostic and reconcile existing database objects first.
