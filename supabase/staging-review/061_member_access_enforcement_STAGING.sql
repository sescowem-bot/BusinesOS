-- BusinessOS Stage 062 — additional active-membership write protection (STAGING ONLY)
-- Apply AFTER Stage 061's 060_registered_business_member_lifecycle_STAGING.sql.
-- Do not apply to production until all SECURITY DEFINER and RLS paths have been audited.
-- Requires independent staging database, backups, and tests with real role-scoped tokens.
-- Preserves historical business_members rows, invoices, transactions and audit data.
BEGIN;

DO $$
BEGIN
 IF to_regclass('public.business_members') IS NULL OR
    to_regclass('public.business_lifecycle_state') IS NULL OR
    to_regclass('public.business_member_access') IS NULL OR
    to_regprocedure('public.business_membership_is_active(uuid,uuid)') IS NULL THEN
   RAISE EXCEPTION 'Stage 061 access-control objects missing. Install/reconcile Stage 061 in STAGING first.';
 END IF;
 IF to_regprocedure('public.enforce_active_member_tenant_write()') IS NOT NULL THEN
   RAISE EXCEPTION 'Stage 062 already installed or partially installed; inspect before reapplying.';
 END IF;
END $$;

-- A pre-existing FOR ALL owner RLS policy allowed unrestricted direct updates and
-- DELETEs on membership rows. Owners must use vetted RPCs for role/status changes.
-- The existing SECURITY DEFINER invitation/role-management functions can retain
-- their intended capabilities, whereas user-scoped direct table modifications cannot.
REVOKE INSERT,UPDATE,DELETE ON public.business_members FROM PUBLIC,anon,authenticated;

-- Server-side write boundary. Runs inside data-modifying SQL even when an old
-- SECURITY DEFINER RPC bypasses tenant RLS. It protects the listed tables only.
CREATE FUNCTION public.enforce_active_member_tenant_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_new_business uuid; v_old_business uuid; v_user uuid := auth.uid();
        v_before jsonb; v_after jsonb;
BEGIN
 -- A service-role integration (e.g. verified payment webhook) has its own
 -- independent authentication and must not impersonate a browser member.
 -- Browser sessions must never be allowed to choose the role claim.
 IF auth.role()='service_role' OR v_user IS NULL THEN
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
 END IF;

 IF TG_OP IN ('UPDATE','DELETE') THEN
  v_before:=to_jsonb(OLD);
  IF NULLIF(v_before->>'business_id','') IS NULL THEN
   RAISE EXCEPTION 'Tenant guard missing original business identifier on %.%',TG_TABLE_SCHEMA,TG_TABLE_NAME
     USING ERRCODE='42501';
  END IF;
  v_old_business:=(v_before->>'business_id')::uuid;
  IF NOT public.business_membership_is_active(v_old_business,v_user) THEN
   RAISE EXCEPTION 'Business access is unavailable for this operation' USING ERRCODE='42501';
  END IF;
 END IF;

 IF TG_OP IN ('INSERT','UPDATE') THEN
  v_after:=to_jsonb(NEW);
  IF NULLIF(v_after->>'business_id','') IS NULL THEN
   RAISE EXCEPTION 'Tenant guard missing business identifier on %.%',TG_TABLE_SCHEMA,TG_TABLE_NAME
    USING ERRCODE='42501';
  END IF;
  v_new_business:=(v_after->>'business_id')::uuid;
  IF NOT public.business_membership_is_active(v_new_business,v_user) THEN
   RAISE EXCEPTION 'Business access is unavailable for this operation' USING ERRCODE='42501';
  END IF;
 END IF;

 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;$$;
REVOKE ALL ON FUNCTION public.enforce_active_member_tenant_write() FROM PUBLIC,anon,authenticated;

-- EXPLICIT list only. Different tables may require different worker rules and
-- business-id sources. Never attach to platform administration, subscription,
-- payment activation, or Auth tables automatically.
DO $$
DECLARE v_table text; v_reg regclass;
BEGIN
 FOREACH v_table IN ARRAY ARRAY[
   'orders','payments','expenses','products','business_customers',
   'inventory_movements','quotes','business_tasks','business_team_updates',
   'business_approval_requests','business_pos_sales'
 ] LOOP
  v_reg:=to_regclass(format('public.%I',v_table));
  IF v_reg IS NOT NULL THEN
   IF NOT EXISTS(
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid=v_reg AND a.attname='business_id'
      AND a.attnum>0 AND NOT a.attisdropped
   ) THEN
    RAISE EXCEPTION 'Expected tenant column missing from %. Stop to review schema.',v_table;
   END IF;
   EXECUTE format('CREATE TRIGGER businessos_guard_active_member_writes
     BEFORE INSERT OR UPDATE OR DELETE ON public.%I
     FOR EACH ROW EXECUTE FUNCTION public.enforce_active_member_tenant_write()',v_table);
  END IF;
 END LOOP;
END $$;

COMMIT;

-- IMPORTANT: This guard covers the listed direct-write tables, not every possible
-- old RPC, nested line-item table, storage operation, job or public read.
-- A full SECURITY DEFINER audit and real staging user testing are required.
-- Do not describe Stage 062 as full revocation of all access until proven.
