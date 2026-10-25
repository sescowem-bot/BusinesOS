-- ALREADY APPLIED TO PRODUCTION (20261025215511)
-- ARCHIVAL COPY. DO NOT REAPPLY.

-- BusinessOS Phase 1G: activate audited per-role action decisions on existing production.
-- Baseline verified in rolled-back SQL: all 2736 decisions identical with flag OFF vs ON
-- for 4 current plans x 6 simulated roles x 19 modules x 6 actions.
-- No override defaults are inserted; existing subscription entitlements remain authoritative.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='12000ms';
DO $preflight$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.platform_plan_action_enforcement WHERE id=true AND enabled=false)
 THEN RAISE EXCEPTION 'Activation refused: unexpected current enforcement state'; END IF;
 IF EXISTS(SELECT 1 FROM public.platform_plan_action_overrides)
 THEN RAISE EXCEPTION 'Activation refused: action preferences already configured'; END IF;
 IF (SELECT count(*) FROM public.platform_plan_core_features WHERE enabled)<>32
 THEN RAISE EXCEPTION 'Activation refused: core plan baseline changed'; END IF;
 IF (SELECT count(*) FROM public.public_site_plans WHERE id IN ('free','starter','growth','professional') AND published=true)<>4
 THEN RAISE EXCEPTION 'Activation refused: published plans changed'; END IF;
 IF EXISTS(SELECT 1 FROM public.business_members WHERE role<>'owner')
 THEN RAISE EXCEPTION 'Activation refused: new staff roles require additional acceptance'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.business_can_perform_action(uuid,text,text)')
  AND prosrc LIKE '%business_plan_core_feature_allowed%')
 THEN RAISE EXCEPTION 'Activation refused: core feature check missing'; END IF;
END $preflight$;
UPDATE public.platform_plan_action_enforcement
 SET enabled=true,changed_at=now(),
 reason='Phase 1G: activated after rollback-only 2736-decision parity and 24 plan-role inheritance checks; zero preset overrides, preserved legacy role checks'
 WHERE id=true AND enabled=false;
DO $verify$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.platform_plan_action_enforcement WHERE id=true AND enabled=true)
 THEN RAISE EXCEPTION 'Enforcement activation did not persist within transaction'; END IF;
 IF EXISTS(SELECT 1 FROM public.platform_plan_action_overrides)
 THEN RAISE EXCEPTION 'Unexpected override created'; END IF;
END $verify$;
COMMIT;
