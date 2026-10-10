-- 025: Phase 026 email delivery monitoring. Apply AFTER migration 024.
-- Additive, no email hooks are activated by this migration.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.platform_email_templates') IS NULL OR to_regclass('public.platform_admins') IS NULL
 THEN RAISE EXCEPTION 'Migrations 020 and earlier are required'; END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.platform_email_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 template_key text NOT NULL,
 recipient_email text NOT NULL,
 subject text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','delivered','bounced','complained','failed')),
 provider_message_id text UNIQUE,
 error_code text,
 requested_by uuid NOT NULL REFERENCES auth.users(id),
 source text NOT NULL DEFAULT 'admin_test' CHECK (source IN ('admin_test')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 delivered_at timestamptz
);
CREATE INDEX IF NOT EXISTS platform_email_deliveries_admin_idx ON public.platform_email_deliveries(created_at DESC);
ALTER TABLE public.platform_email_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_email_deliveries FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.platform_email_deliveries TO authenticated;
DROP POLICY IF EXISTS platform_admin_email_delivery_read ON public.platform_email_deliveries;
CREATE POLICY platform_admin_email_delivery_read ON public.platform_email_deliveries FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active));

-- Admin can only queue test emails TO THEIR OWN authenticated email address.
-- An atomic, database-side hourly limit prevents unintended bulk sending.
CREATE OR REPLACE FUNCTION public.admin_begin_email_test(p_template_key text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_user_email text;v_subject text;v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active)
 THEN RAISE EXCEPTION 'Platform administrator access required' USING ERRCODE='42501'; END IF;
 SELECT email INTO v_user_email FROM auth.users WHERE id=auth.uid();
 IF v_user_email IS NULL OR length(v_user_email)>320 THEN RAISE EXCEPTION 'An account email is required'; END IF;
 SELECT subject INTO v_subject FROM public.platform_email_templates WHERE template_key=p_template_key;
 IF v_subject IS NULL THEN RAISE EXCEPTION 'Email template not found'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text),2526);
 IF (SELECT count(*) FROM public.platform_email_deliveries WHERE requested_by=auth.uid()
     AND created_at > now()-interval '1 hour') >= 5
 THEN RAISE EXCEPTION 'Email test limit reached. Try again later.' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.platform_email_deliveries(template_key,recipient_email,subject,requested_by)
 VALUES(p_template_key,v_user_email,v_subject,auth.uid()) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_begin_email_test(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_begin_email_test(text) TO authenticated;

-- Do not allow clients to choose a recipient or overwrite unrelated logs.
CREATE OR REPLACE FUNCTION public.admin_finish_email_test(p_id uuid,p_success boolean,p_provider_message_id text DEFAULT NULL,p_error_code text DEFAULT NULL)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active)
 THEN RAISE EXCEPTION 'Platform administrator access required' USING ERRCODE='42501'; END IF;
 UPDATE public.platform_email_deliveries SET status=CASE WHEN p_success THEN 'accepted' ELSE 'failed' END,
  provider_message_id=CASE WHEN p_success THEN nullif(p_provider_message_id,'') ELSE NULL END,
  error_code=CASE WHEN p_success THEN NULL ELSE left(coalesce(p_error_code,'delivery_failed'),100) END,
  updated_at=now() WHERE id=p_id AND requested_by=auth.uid() AND status='pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'Email test is not pending or not yours'; END IF;
 IF p_success AND p_provider_message_id IS NOT NULL THEN
  UPDATE public.platform_email_deliveries d SET
   status=CASE e.event_type WHEN 'email.delivered' THEN 'delivered' WHEN 'email.bounced' THEN 'bounced' WHEN 'email.complained' THEN 'complained' ELSE d.status END,
   delivered_at=CASE WHEN e.event_type='email.delivered' THEN e.received_at ELSE d.delivered_at END,
   updated_at=now()
  FROM (SELECT event_type,received_at FROM public.platform_email_webhook_events
    WHERE provider_message_id=p_provider_message_id AND event_type IN ('email.delivered','email.bounced','email.complained')
    ORDER BY received_at DESC LIMIT 1) e
  WHERE d.id=p_id;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.admin_finish_email_test(uuid,boolean,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_finish_email_test(uuid,boolean,text,text) TO authenticated;

-- Deduplicate signed webhook deliveries. Service role writes after cryptographic verification.
CREATE TABLE IF NOT EXISTS public.platform_email_webhook_events (
 event_id text PRIMARY KEY,
 event_type text NOT NULL,
 provider_message_id text,
 received_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_email_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_email_webhook_events FROM PUBLIC,anon,authenticated;
-- Starter auth templates: editor can change copy; not activated until Auth Hook deployment.
INSERT INTO public.platform_email_templates(template_key,subject,heading,body_text,button_label)
VALUES
 ('magic_link','Your sign-in link','Sign in securely','Use the secure sign-in link to access your account.','Sign in'),
 ('email_change','Confirm email change','Confirm your email address','Confirm the requested email change. If this was not you, ignore this email.','Confirm email'),
 ('security_code','Your security verification code','Verification required','Use the verification code in this email to continue.','')
ON CONFLICT(template_key) DO NOTHING;
-- Real business events: notify the owner when an order is created or payment completes.
-- These are in-app only. Preferences apply; no outbound emails are sent by these triggers.
CREATE OR REPLACE FUNCTION public.notify_business_transaction_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_member record;v_event text;v_title text;v_body text;v_url text;
BEGIN
 IF TG_TABLE_NAME='orders' AND TG_OP='INSERT' THEN
  v_event='new-order:'||NEW.id::text;
  v_title='New order recorded';v_body='An order was recorded for your business: '||left(NEW.order_number,80);
  v_url='/orders';
 ELSIF TG_TABLE_NAME='payments' AND NEW.status='completed'
       AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
  v_event='completed-payment:'||NEW.id::text;
  v_title='Payment recorded';v_body='A completed customer payment has been recorded. Review your payment register.';
  v_url='/payments';
 ELSE RETURN NEW; END IF;
 FOR v_member IN SELECT bm.user_id FROM public.business_members bm
  LEFT JOIN public.notification_preferences np ON np.user_id=bm.user_id
  WHERE bm.business_id=NEW.business_id AND bm.role='owner' AND coalesce(np.in_app_business,true)
 LOOP
  INSERT INTO public.user_notifications(recipient_id,business_id,category,title,body,action_url,priority,idempotency_key)
  VALUES(v_member.user_id,NEW.business_id,
    CASE WHEN TG_TABLE_NAME='orders' THEN 'order' ELSE 'payment' END,
    v_title,v_body,v_url,'normal',v_event) ON CONFLICT DO NOTHING;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_business_transaction_event() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_notification_order_added ON public.orders;
CREATE TRIGGER trg_notification_order_added AFTER INSERT ON public.orders
 FOR EACH ROW EXECUTE FUNCTION public.notify_business_transaction_event();
DROP TRIGGER IF EXISTS trg_notification_payment_completed ON public.payments;
CREATE TRIGGER trg_notification_payment_completed AFTER INSERT OR UPDATE OF status ON public.payments
 FOR EACH ROW EXECUTE FUNCTION public.notify_business_transaction_event();

-- One atomic server-only webhook acknowledgement and delivery transition.
-- The callback itself verifies the Standard Webhooks signature first.
CREATE OR REPLACE FUNCTION public.record_resend_delivery_event(
 p_event_id text,p_event_type text,p_provider_message_id text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_new text;
BEGIN
 -- EXECUTE is granted only to service_role; SECURITY DEFINER runs as the function owner.
 IF length(coalesce(p_event_id,'')) NOT BETWEEN 3 AND 150 OR
    length(coalesce(p_provider_message_id,'')) NOT BETWEEN 3 AND 200 OR
    p_event_type NOT IN ('email.delivered','email.bounced','email.complained') THEN
  RAISE EXCEPTION 'Invalid signed event details';
 END IF;
 INSERT INTO public.platform_email_webhook_events(event_id,event_type,provider_message_id)
 VALUES(p_event_id,p_event_type,p_provider_message_id)
 ON CONFLICT(event_id) DO NOTHING;
 IF NOT FOUND THEN RETURN false; END IF;
 v_new:=CASE p_event_type WHEN 'email.delivered' THEN 'delivered'
         WHEN 'email.bounced' THEN 'bounced' ELSE 'complained' END;
 UPDATE public.platform_email_deliveries SET status=v_new,updated_at=now(),
  delivered_at=CASE WHEN v_new='delivered' THEN now() ELSE delivered_at END
 WHERE provider_message_id=p_provider_message_id
 -- A provider event may arrive BEFORE admin_finish_email_test: keep 'pending'
 -- until the sender completes its own log, which reconciles recorded early events.
 AND status IN ('accepted','delivered')
 AND (status<>'delivered' OR v_new IN ('bounced','complained'));
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.record_resend_delivery_event(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_resend_delivery_event(text,text,text) TO service_role;

COMMIT;
