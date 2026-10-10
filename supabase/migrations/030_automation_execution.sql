-- Phase 030D: controlled scheduled internal reminders; opt-in email outbox.
-- Requires migration 029. Does NOT activate cron, email or paid providers.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.business_automation_requests') IS NULL OR
    to_regclass('public.user_notifications') IS NULL OR
    to_regclass('public.notification_preferences') IS NULL THEN
  RAISE EXCEPTION 'Missing migration 029/020. Install prerequisites first; no objects changed.';
 END IF;
 IF to_regclass('public.business_automation_rules') IS NOT NULL
   OR to_regclass('public.business_automation_runs') IS NOT NULL
   OR to_regclass('public.business_automation_email_jobs') IS NOT NULL
   OR to_regclass('public.business_automation_email_daily_budget') IS NOT NULL THEN
  RAISE EXCEPTION 'Automation rules already exist. Inspect partial migration before rerunning.';
 END IF;
END $$;

CREATE TABLE public.business_automation_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL UNIQUE REFERENCES public.business_automation_requests(id) ON DELETE RESTRICT,
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 title text NOT NULL CHECK (char_length(title) BETWEEN 5 AND 160),
 message text NOT NULL CHECK (char_length(message) BETWEEN 8 AND 500),
 channel text NOT NULL CHECK (channel IN ('in_app','email')),
 cadence_hours integer NOT NULL CHECK (cadence_hours IN (24,168)),
 next_run_at timestamptz NOT NULL,
 max_runs integer NOT NULL CHECK (max_runs BETWEEN 1 AND 365),
 run_count integer NOT NULL DEFAULT 0 CHECK (run_count>=0),
 enabled boolean NOT NULL DEFAULT false,
 created_by uuid NOT NULL REFERENCES auth.users(id),
 updated_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX automation_rules_due_idx ON public.business_automation_rules(next_run_at) WHERE enabled;
CREATE INDEX automation_rules_business_idx ON public.business_automation_rules(business_id);
ALTER TABLE public.business_automation_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_automation_rules FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.business_automation_rules TO authenticated;
CREATE POLICY automation_rules_admin_owner_read ON public.business_automation_rules FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.platform_admins a WHERE a.user_id=auth.uid() AND a.active)
 OR EXISTS(SELECT 1 FROM public.business_members m WHERE m.business_id=business_automation_rules.business_id AND m.user_id=auth.uid() AND m.role='owner')
);

CREATE TABLE public.business_automation_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 rule_id uuid NOT NULL REFERENCES public.business_automation_rules(id) ON DELETE CASCADE,
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 scheduled_for timestamptz NOT NULL,
 status text NOT NULL CHECK(status IN ('completed','queued_email','skipped')),
 reason text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(rule_id,scheduled_for)
);
CREATE INDEX automation_runs_business_idx ON public.business_automation_runs(business_id,created_at DESC);
ALTER TABLE public.business_automation_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_automation_runs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.business_automation_runs TO authenticated;
CREATE POLICY automation_runs_admin_owner_read ON public.business_automation_runs FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.platform_admins a WHERE a.user_id=auth.uid() AND a.active)
 OR EXISTS(SELECT 1 FROM public.business_members m WHERE m.business_id=business_automation_runs.business_id AND m.user_id=auth.uid() AND m.role='owner')
);

CREATE TABLE public.business_automation_email_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 run_id uuid NOT NULL UNIQUE REFERENCES public.business_automation_runs(id) ON DELETE CASCADE,
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 subject text NOT NULL CHECK(char_length(subject) BETWEEN 5 AND 160),
 body text NOT NULL CHECK(char_length(body) BETWEEN 8 AND 500),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','retry','accepted','failed','skipped','delivered','bounced','complained')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
 available_at timestamptz NOT NULL DEFAULT now(),
 lease_until timestamptz,
 claim_token uuid,
 provider_message_id text,
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX automation_email_jobs_due_idx ON public.business_automation_email_jobs(available_at) WHERE status IN ('pending','retry','processing');
-- Global ceiling for automation-specific Resend attempts, distinct from other emails.
CREATE TABLE public.business_automation_email_daily_budget (
 day date PRIMARY KEY, claimed_count integer NOT NULL DEFAULT 0 CHECK (claimed_count BETWEEN 0 AND 40)
);
ALTER TABLE public.business_automation_email_daily_budget ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_automation_email_daily_budget FROM PUBLIC,anon,authenticated;

ALTER TABLE public.business_automation_email_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_automation_email_jobs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.business_automation_email_jobs TO authenticated;
CREATE POLICY automation_email_jobs_admin_owner_read ON public.business_automation_email_jobs FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.platform_admins a WHERE a.user_id=auth.uid() AND a.active)
 OR EXISTS(SELECT 1 FROM public.business_members m WHERE m.business_id=business_automation_email_jobs.business_id AND m.user_id=auth.uid() AND m.role='owner')
);

-- Only platform Super Admins can configure rules. Every edit pauses execution.
CREATE FUNCTION public.admin_configure_automation_rule(
 p_request_id uuid,p_message text,p_cadence_hours integer,p_next_run_at timestamptz,p_max_runs integer
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_req public.business_automation_requests%ROWTYPE;v_rule uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active)
 THEN RAISE EXCEPTION 'Platform admin required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_req FROM public.business_automation_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND OR v_req.status <> 'configured' OR v_req.category <> 'task_reminders'
 THEN RAISE EXCEPTION 'Only configured task-reminder requests can be scheduled'; END IF;
 IF length(trim(coalesce(p_message,''))) NOT BETWEEN 8 AND 500 OR p_cadence_hours NOT IN (24,168)
 OR p_next_run_at IS NULL OR p_next_run_at<=now() OR p_next_run_at>now()+interval '365 days'
 OR p_max_runs IS NULL OR p_max_runs NOT BETWEEN 1 AND 365
 THEN RAISE EXCEPTION 'Invalid reminder schedule or message'; END IF;
 INSERT INTO public.business_automation_rules(request_id,business_id,recipient_id,title,message,channel,cadence_hours,next_run_at,max_runs,created_by,updated_by)
 VALUES(p_request_id,v_req.business_id,v_req.requested_by,v_req.title,trim(p_message),v_req.delivery_channel,p_cadence_hours,p_next_run_at,p_max_runs,auth.uid(),auth.uid())
 ON CONFLICT(request_id) DO UPDATE SET message=EXCLUDED.message,cadence_hours=EXCLUDED.cadence_hours,
 next_run_at=EXCLUDED.next_run_at,max_runs=EXCLUDED.max_runs,channel=EXCLUDED.channel,
 enabled=false,updated_by=auth.uid(),updated_at=now()
 RETURNING id INTO v_rule;
 IF (SELECT run_count FROM public.business_automation_rules WHERE id=v_rule)>p_max_runs
 THEN RAISE EXCEPTION 'Max runs must not be below already executed count'; END IF;
 RETURN v_rule;
END $$;
REVOKE ALL ON FUNCTION public.admin_configure_automation_rule(uuid,text,integer,timestamptz,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_configure_automation_rule(uuid,text,integer,timestamptz,integer) TO authenticated;

CREATE FUNCTION public.admin_set_automation_rule_enabled(p_rule_id uuid,p_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_rule public.business_automation_rules%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active)
 THEN RAISE EXCEPTION 'Platform admin required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_rule FROM public.business_automation_rules WHERE id=p_rule_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Rule not found'; END IF;
 IF p_enabled AND (v_rule.next_run_at<=now() OR v_rule.run_count>=v_rule.max_runs OR NOT EXISTS (
  SELECT 1 FROM public.business_automation_requests WHERE id=v_rule.request_id AND status='configured'))
 THEN RAISE EXCEPTION 'Rule requires a future schedule and a configured request'; END IF;
 UPDATE public.business_automation_rules SET enabled=p_enabled,updated_by=auth.uid(),updated_at=now() WHERE id=p_rule_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_set_automation_rule_enabled(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_automation_rule_enabled(uuid,boolean) TO authenticated;

-- The scheduler runs only with privileged service credentials or a trusted postgres cron job.
CREATE FUNCTION public.automation_process_due(p_limit integer DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_rule record;v_run uuid;v_total integer:=0;v_skipped integer:=0;v_queued integer:=0;
 v_inapp boolean;v_email boolean;v_status text;v_reason text;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Invalid processing limit'; END IF;
 FOR v_rule IN SELECT r.* FROM public.business_automation_rules r
  JOIN public.business_automation_requests q ON q.id=r.request_id AND q.status='configured'
  WHERE r.enabled AND r.run_count<r.max_runs AND r.next_run_at<=now()
  ORDER BY r.next_run_at,r.id LIMIT p_limit FOR UPDATE OF r SKIP LOCKED LOOP
  -- Serialize quota checks across concurrent workers for the same business.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_rule.business_id::text,41030));
  IF NOT EXISTS (SELECT 1 FROM public.business_members m WHERE m.business_id=v_rule.business_id
    AND m.user_id=v_rule.recipient_id AND m.role='owner') THEN
    UPDATE public.business_automation_rules SET enabled=false,updated_at=now() WHERE id=v_rule.id;
    CONTINUE;
  END IF;
  -- Per-business quota: 30 scheduled executions per UTC calendar day.
  IF (SELECT count(*) FROM public.business_automation_runs x WHERE x.business_id=v_rule.business_id
    AND x.created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')>=30 THEN CONTINUE; END IF;
  SELECT coalesce(p.in_app_business,true),coalesce(p.email_business,true) INTO v_inapp,v_email
    FROM (SELECT 1) anchor LEFT JOIN public.notification_preferences p ON p.user_id=v_rule.recipient_id;
  v_status:='completed';v_reason:='';
  IF NOT v_inapp AND (v_rule.channel='in_app' OR NOT v_email) THEN v_status:='skipped';v_reason:='Recipient notifications disabled'; END IF;
  IF v_rule.channel='email' AND v_email THEN v_status:='queued_email'; END IF;
  INSERT INTO public.business_automation_runs(rule_id,business_id,scheduled_for,status,reason)
  VALUES(v_rule.id,v_rule.business_id,v_rule.next_run_at,v_status,v_reason) RETURNING id INTO v_run;
  IF v_inapp THEN
   INSERT INTO public.user_notifications(recipient_id,business_id,category,title,body,action_url,priority,idempotency_key)
   VALUES(v_rule.recipient_id,v_rule.business_id,'business',left(v_rule.title,160),v_rule.message,'/automations/requests','normal','automation-run:'||v_run::text)
   ON CONFLICT DO NOTHING;
  END IF;
  IF v_status='queued_email' THEN
   INSERT INTO public.business_automation_email_jobs(run_id,business_id,recipient_id,subject,body)
   VALUES(v_run,v_rule.business_id,v_rule.recipient_id,v_rule.title,v_rule.message);
   v_queued:=v_queued+1;
  ELSIF v_status='skipped' THEN v_skipped:=v_skipped+1; END IF;
  UPDATE public.business_automation_rules SET run_count=run_count+1,
   next_run_at=greatest(next_run_at,now())+make_interval(hours=>cadence_hours),
   enabled=(run_count+1<max_runs),updated_at=now() WHERE id=v_rule.id;
  v_total:=v_total+1;
 END LOOP;
 RETURN jsonb_build_object('processed',v_total,'queued_email',v_queued,'skipped',v_skipped);
END $$;
REVOKE ALL ON FUNCTION public.automation_process_due(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.automation_process_due(integer) TO service_role,postgres;

CREATE FUNCTION public.automation_claim_email_jobs(p_limit integer DEFAULT 10)
RETURNS TABLE(id uuid,run_id uuid,recipient_id uuid,subject text,body text,claim_token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_remaining integer;v_claimed integer;v_day date:=(now() AT TIME ZONE 'UTC')::date;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 4 THEN RAISE EXCEPTION 'Invalid email processing limit'; END IF;
 -- Never claim beyond a free-tier safety budget, including retries.
 PERFORM pg_advisory_xact_lock(30,40);
 INSERT INTO public.business_automation_email_daily_budget(day,claimed_count) VALUES(v_day,0) ON CONFLICT DO NOTHING;
 SELECT 40-claimed_count INTO v_remaining FROM public.business_automation_email_daily_budget WHERE day=v_day FOR UPDATE;
 -- Keep stale reminders from sending days after an extended outage.
 UPDATE public.business_automation_email_jobs SET status='skipped',last_error='expired_before_delivery',updated_at=now()
  WHERE status IN ('pending','retry') AND created_at<now()-interval '48 hours';
 UPDATE public.business_automation_email_jobs SET status='failed',last_error='max_retry_attempts',lease_until=null,claim_token=null,updated_at=now()
  WHERE status='processing' AND lease_until<now() AND attempts>=3;
 IF v_remaining<=0 THEN RETURN; END IF;
 RETURN QUERY
 WITH candidates AS (
  SELECT j.id FROM public.business_automation_email_jobs j
  WHERE ((j.status IN ('pending','retry') AND j.available_at<=now())
    OR (j.status='processing' AND j.lease_until<now())) AND j.attempts<3
  ORDER BY j.available_at,j.created_at LIMIT LEAST(p_limit,v_remaining) FOR UPDATE SKIP LOCKED
 ),claimed AS (
 UPDATE public.business_automation_email_jobs j SET status='processing',attempts=j.attempts+1,
  claim_token=gen_random_uuid(),lease_until=now()+interval '3 minutes',updated_at=now()
 FROM candidates c WHERE j.id=c.id
 RETURNING j.id,j.run_id,j.recipient_id,j.subject,j.body,j.claim_token
 ) SELECT c.id,c.run_id,c.recipient_id,c.subject,c.body,c.claim_token FROM claimed c;
 GET DIAGNOSTICS v_claimed = ROW_COUNT;
 UPDATE public.business_automation_email_daily_budget SET claimed_count=claimed_count+v_claimed WHERE day=v_day;
END $$;
REVOKE ALL ON FUNCTION public.automation_claim_email_jobs(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.automation_claim_email_jobs(integer) TO service_role;

CREATE FUNCTION public.automation_finish_email_job(p_id uuid,p_token uuid,p_outcome text,p_provider_id text DEFAULT NULL,p_error text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_attempts integer;
BEGIN
 IF p_outcome NOT IN ('accepted','retry','skipped') THEN RAISE EXCEPTION 'Invalid outcome'; END IF;
 SELECT attempts INTO v_attempts FROM public.business_automation_email_jobs
 WHERE id=p_id AND status='processing' AND claim_token=p_token FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.business_automation_email_jobs SET
  status=CASE WHEN p_outcome='retry' AND v_attempts>=3 THEN 'failed' ELSE p_outcome END,
  available_at=CASE WHEN p_outcome='retry' THEN now()+(CASE v_attempts WHEN 1 THEN interval '5 minutes' WHEN 2 THEN interval '20 minutes' ELSE interval '60 minutes' END) ELSE available_at END,
  lease_until=NULL,claim_token=NULL,provider_message_id=CASE WHEN p_outcome='accepted' THEN left(p_provider_id,200) ELSE provider_message_id END,
  last_error=CASE WHEN p_outcome='accepted' THEN NULL ELSE left(coalesce(p_error,'delivery_unavailable'),180) END,
  updated_at=now() WHERE id=p_id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.automation_finish_email_job(uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.automation_finish_email_job(uuid,uuid,text,text,text) TO service_role;

-- Executed only after signature verification in the existing Resend webhook route.
CREATE FUNCTION public.automation_record_resend_event(p_provider_id text,p_event_type text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_event_type NOT IN ('email.delivered','email.bounced','email.complained') THEN RETURN; END IF;
 UPDATE public.business_automation_email_jobs SET
  status=CASE p_event_type WHEN 'email.delivered' THEN 'delivered' WHEN 'email.bounced' THEN 'bounced' ELSE 'complained' END,
  updated_at=now()
 WHERE provider_message_id=p_provider_id AND status IN ('accepted','delivered')
   AND (p_event_type<>'email.delivered' OR status='accepted');
END $$;
REVOKE ALL ON FUNCTION public.automation_record_resend_event(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.automation_record_resend_event(text,text) TO service_role;
COMMIT;
