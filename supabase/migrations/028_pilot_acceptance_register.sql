-- Migration 028: auditable pilot acceptance register, NOT a deployment gate.
-- Additive. Apply after 027 in staging first. No customer business data is changed.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.platform_admins') IS NULL THEN
  RAISE EXCEPTION 'Migration 028 requires platform_admins and previous migrations';
 END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.platform_pilot_results (
 test_id text NOT NULL CHECK (test_id ~ '^(AUTH|SEC|BIZ|INV|GL|RPT|ADM|CMS|MAIL|UX|BUILD)-[0-9]{2}$'),
 environment text NOT NULL CHECK (environment IN ('preview','production')),
 status text NOT NULL DEFAULT 'not_tested' CHECK (status IN ('not_tested','pass','fail','blocked')),
 evidence text NOT NULL DEFAULT '' CHECK (length(evidence)<=3000),
 reviewed_by uuid NOT NULL REFERENCES auth.users(id),
 reviewed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(test_id,environment)
);
CREATE TABLE IF NOT EXISTS public.platform_pilot_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 test_id text NOT NULL,
 environment text NOT NULL,
 previous_status text,
 next_status text NOT NULL,
 evidence text NOT NULL DEFAULT '',
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_pilot_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_pilot_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_pilot_results,public.platform_pilot_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.platform_pilot_results,public.platform_pilot_audit TO authenticated;
DROP POLICY IF EXISTS platform_pilot_results_owner_read ON public.platform_pilot_results;
CREATE POLICY platform_pilot_results_owner_read ON public.platform_pilot_results
 FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.platform_admins a WHERE a.user_id=auth.uid() AND a.active=true)
);
DROP POLICY IF EXISTS platform_pilot_audit_owner_read ON public.platform_pilot_audit;
CREATE POLICY platform_pilot_audit_owner_read ON public.platform_pilot_audit
 FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.platform_admins a WHERE a.user_id=auth.uid() AND a.active=true)
);
-- Only the current active Platform Admin may record a result. Direct writes remain revoked.
CREATE OR REPLACE FUNCTION public.platform_record_pilot_check(
 p_test_id text,p_environment text,p_status text,p_evidence text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_prior text;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active=true
 ) THEN RAISE EXCEPTION 'Platform administrator permission required' USING ERRCODE='42501'; END IF;
 IF p_test_id IS NULL OR p_test_id !~ '^(AUTH|SEC|BIZ|INV|GL|RPT|ADM|CMS|MAIL|UX|BUILD)-[0-9]{2}$'
 OR p_environment NOT IN ('preview','production')
 OR p_status NOT IN ('not_tested','pass','fail','blocked') THEN
  RAISE EXCEPTION 'Invalid pilot check'; END IF;
 IF length(coalesce(p_evidence,''))>3000 OR (
  p_status IN ('pass','fail','blocked') AND length(trim(coalesce(p_evidence,'')))<12
 ) THEN RAISE EXCEPTION 'Add a concise evidence reference or failure explanation (12 to 3000 characters)'; END IF;
 -- Serialize review updates on this one test/environment even under competing editors.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_test_id||':'||p_environment,0));
 SELECT status INTO v_prior FROM public.platform_pilot_results
 WHERE test_id=p_test_id AND environment=p_environment FOR UPDATE;
 INSERT INTO public.platform_pilot_results(test_id,environment,status,evidence,reviewed_by,reviewed_at)
 VALUES(p_test_id,p_environment,p_status,CASE WHEN p_status='not_tested' THEN '' ELSE trim(p_evidence) END,auth.uid(),now())
 ON CONFLICT (test_id,environment) DO UPDATE SET status=excluded.status,
 evidence=excluded.evidence,reviewed_by=excluded.reviewed_by,reviewed_at=now();
 INSERT INTO public.platform_pilot_audit(test_id,environment,previous_status,next_status,evidence,actor_id)
 VALUES(p_test_id,p_environment,v_prior,p_status,CASE WHEN p_status='not_tested' THEN '' ELSE trim(p_evidence) END,auth.uid());
END;$$;
REVOKE ALL ON FUNCTION public.platform_record_pilot_check(text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_record_pilot_check(text,text,text,text) TO authenticated;
COMMIT;
