-- APPLIED IN PRODUCTION: 20261025213253 (businessos_phase1f_one_query_workspace_visible_modules).
-- ARCHIVAL COPY ONLY; DO NOT EXECUTE OR REPLAY.
-- Captured from supabase_migrations.schema_migrations on 25 October 2026.

-- BusinessOS Phase 1F: single-query navigation authorization, including View overrides.
-- Does not enable action-matrix enforcement or modify business records.
CREATE OR REPLACE FUNCTION public.business_visible_modules(p_business uuid)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=public,pg_temp
AS $fn$
  SELECT CASE
    WHEN auth.uid() IS NULL OR p_business IS NULL
      OR NOT public.business_membership_is_active(p_business,auth.uid())
      THEN ARRAY[]::text[]
    ELSE COALESCE(ARRAY(
      SELECT module_key FROM (VALUES
        (1,'dashboard'),(2,'customers'),(3,'orders'),(4,'payments'),
        (5,'products'),(6,'expenses'),(7,'documents'),(8,'settings'),
        (9,'pos'),(10,'purchasing'),(11,'inventory'),(12,'team'),
        (13,'accounting'),(14,'financial_reports'),(15,'tax'),
        (16,'communications'),(17,'campaigns'),(18,'insights'),(19,'growth')
      ) AS modules(ord,module_key)
      WHERE public.business_can_perform_action(p_business,module_key,'view')
      ORDER BY ord
    ), ARRAY[]::text[])
  END;
$fn$;
REVOKE ALL ON FUNCTION public.business_visible_modules(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_visible_modules(uuid) TO authenticated;
