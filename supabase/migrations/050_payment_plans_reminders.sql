-- BusinessOS SQL 050 | Recorded customer instalment agreements and platform renewal reminders.
-- Requires 049. Neither table processes or invents a payment. No automatic email is sent by SQL.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.platform_plan_matrix_audit') IS NULL
 OR to_regclass('public.business_subscription_payments') IS NULL
 OR to_regclass('public.orders') IS NULL OR to_regclass('public.payments') IS NULL
 THEN RAISE EXCEPTION 'SQL 049 and existing orders/payments required'; END IF;
 IF to_regclass('public.business_order_installment_plans') IS NOT NULL
 THEN RAISE EXCEPTION 'Migration 050 appears installed'; END IF;
END $$;

CREATE TABLE public.business_order_installment_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
 installment_count integer NOT NULL CHECK(installment_count BETWEEN 2 AND 24),
 first_due_on date NOT NULL,
 frequency_days integer NOT NULL CHECK(frequency_days BETWEEN 7 AND 90),
 note text NOT NULL DEFAULT '' CHECK(length(note)<=600),
 active boolean NOT NULL DEFAULT true,
 recorded_by uuid NOT NULL REFERENCES auth.users(id),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(business_id,order_id)
);
CREATE INDEX business_installments_due ON public.business_order_installment_plans(business_id,first_due_on);
ALTER TABLE public.business_order_installment_plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_order_installment_plans FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.business_order_installment_plans TO authenticated;
CREATE POLICY business_installments_read ON public.business_order_installment_plans FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.business_members m WHERE m.business_id=business_order_installment_plans.business_id AND m.user_id=auth.uid()));

CREATE FUNCTION public.business_save_order_installments(p_business uuid,p_order uuid,p_count integer,p_first date,p_interval integer,p_note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id uuid;v_total numeric;v_paid numeric;v_status text;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.business_members m
 WHERE m.business_id=p_business AND m.user_id=auth.uid() AND m.role IN ('owner','manager','finance','sales'))
 THEN RAISE EXCEPTION 'Not permitted to manage customer payments' USING ERRCODE='42501'; END IF;
 IF p_count NOT BETWEEN 2 AND 24 OR p_interval NOT BETWEEN 7 AND 90
 OR p_first < current_date OR p_first > current_date+366
 OR length(coalesce(p_note,''))>600 THEN RAISE EXCEPTION 'Invalid payment schedule'; END IF;
 SELECT total,status INTO v_total,v_status FROM public.orders WHERE business_id=p_business AND id=p_order FOR UPDATE;
 IF NOT FOUND OR v_status='cancelled' THEN RAISE EXCEPTION 'Order is unavailable'; END IF;
 SELECT coalesce(sum(amount),0) INTO v_paid FROM public.payments WHERE business_id=p_business AND order_id=p_order AND status='completed';
 IF greatest(0,coalesce(v_total,0)-v_paid)<=0 THEN RAISE EXCEPTION 'No outstanding balance'; END IF;
 INSERT INTO public.business_order_installment_plans(business_id,order_id,installment_count,first_due_on,frequency_days,note,recorded_by)
 VALUES(p_business,p_order,p_count,p_first,p_interval,coalesce(p_note,''),auth.uid())
 ON CONFLICT(business_id,order_id) DO UPDATE SET installment_count=excluded.installment_count,first_due_on=excluded.first_due_on,
  frequency_days=excluded.frequency_days,note=excluded.note,active=true,recorded_by=excluded.recorded_by,updated_at=now()
 RETURNING id INTO v_id;
 RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.business_save_order_installments(uuid,uuid,integer,date,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_save_order_installments(uuid,uuid,integer,date,integer,text) TO authenticated;

-- Administrator renewal reminders reference subscription expiry; they are NOT invoices or outstanding debt.
CREATE TABLE public.platform_subscription_reminders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 period_ends timestamptz NOT NULL,
 reminder_day date NOT NULL DEFAULT current_date,
 recipient_email text NOT NULL,
 status text NOT NULL CHECK(status IN ('reserved','sent','failed')) DEFAULT 'reserved',
 provider_reference text,
 sent_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(business_id,period_ends,reminder_day)
);
ALTER TABLE public.platform_subscription_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_subscription_reminders FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.platform_subscription_reminders TO authenticated;
CREATE POLICY admin_subscription_reminders_read ON public.platform_subscription_reminders FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.platform_admins a WHERE a.user_id=auth.uid() AND a.active));

CREATE FUNCTION public.admin_subscription_due_list()
RETURNS TABLE(business_id uuid,business_name text,plan_id text,period_ends timestamptz,owner_user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT b.id,b.name::text,p.plan_id,p.expires_at,m.user_id
 FROM public.business_plan_assignments p JOIN public.businesses b ON b.id=p.business_id
 JOIN public.business_members m ON m.business_id=b.id AND m.role='owner'
 WHERE EXISTS(SELECT 1 FROM public.platform_admins a WHERE a.user_id=auth.uid() AND a.active)
 AND p.plan_id<>'free' AND p.expires_at IS NOT NULL
 AND p.expires_at BETWEEN now()-interval '30 days' AND now()+interval '30 days'
 ORDER BY p.expires_at ASC LIMIT 150;
$$;
REVOKE ALL ON FUNCTION public.admin_subscription_due_list() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_subscription_due_list() TO authenticated;

CREATE FUNCTION public.admin_reserve_subscription_reminder(p_business uuid,p_expiry timestamptz,p_recipient text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.platform_admins a WHERE a.user_id=auth.uid() AND a.active)
 THEN RAISE EXCEPTION 'System Owner required' USING ERRCODE='42501'; END IF;
 IF p_recipient !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' OR length(p_recipient)>254 THEN RAISE EXCEPTION 'Invalid recipient'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.business_plan_assignments p WHERE p.business_id=p_business
 AND p.expires_at=p_expiry AND p.plan_id<>'free' AND p_expiry BETWEEN now()-interval '30 days' AND now()+interval '30 days')
 THEN RAISE EXCEPTION 'Subscription period has changed'; END IF;
 INSERT INTO public.platform_subscription_reminders(business_id,period_ends,recipient_email,sent_by)
 VALUES(p_business,p_expiry,p_recipient,auth.uid()) ON CONFLICT(business_id,period_ends,reminder_day) DO NOTHING
 RETURNING id INTO v_id;
 RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.admin_reserve_subscription_reminder(uuid,timestamptz,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_reserve_subscription_reminder(uuid,timestamptz,text) TO authenticated;
CREATE FUNCTION public.admin_finish_subscription_reminder(p_id uuid,p_success boolean,p_provider text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.platform_admins a WHERE a.user_id=auth.uid() AND a.active)
 THEN RAISE EXCEPTION 'System Owner required' USING ERRCODE='42501'; END IF;
 UPDATE public.platform_subscription_reminders SET status=CASE WHEN p_success THEN 'sent' ELSE 'failed' END,
 provider_reference=left(coalesce(p_provider,''),120) WHERE id=p_id AND sent_by=auth.uid() AND status='reserved';
END;$$;
REVOKE ALL ON FUNCTION public.admin_finish_subscription_reminder(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_finish_subscription_reminder(uuid,boolean,text) TO authenticated;
-- BUSINESS CUSTOMER REMINDERS. Business admin initiates email manually; never auto-charge.
CREATE TABLE public.business_order_reminders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
 recipient_email text NOT NULL,
 reminder_date date NOT NULL DEFAULT current_date,
 status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','sent','failed')),
 provider_reference text,
 sent_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(business_id,order_id,reminder_date)
);
ALTER TABLE public.business_order_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_order_reminders FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.business_order_reminders TO authenticated;
CREATE POLICY order_reminder_business_reader ON public.business_order_reminders FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.business_members m WHERE m.business_id=business_order_reminders.business_id
 AND m.user_id=auth.uid() AND m.role IN ('owner','manager','finance','sales')));
CREATE FUNCTION public.business_reserve_order_reminder(p_business uuid,p_order uuid,p_email text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id uuid;v_total numeric;v_paid numeric;v_status text;v_customer uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.business_members m WHERE m.business_id=p_business
 AND m.user_id=auth.uid() AND m.role IN ('owner','manager','finance','sales'))
 THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE='42501'; END IF;
 SELECT total,status,customer_id INTO v_total,v_status,v_customer FROM public.orders
 WHERE business_id=p_business AND id=p_order FOR UPDATE;
 IF NOT FOUND OR v_status='cancelled' OR v_customer IS NULL THEN RAISE EXCEPTION 'Order unavailable'; END IF;
 SELECT coalesce(sum(amount),0) INTO v_paid FROM public.payments WHERE business_id=p_business AND order_id=p_order AND status='completed';
 IF greatest(0,coalesce(v_total,0)-v_paid)<=0 THEN RAISE EXCEPTION 'No outstanding balance'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.business_customers bc JOIN public.customers c ON c.id=bc.customer_id
 WHERE bc.business_id=p_business AND bc.customer_id=v_customer
 AND c.email IS NOT NULL AND lower(c.email)=lower(p_email)) THEN RAISE EXCEPTION 'Recipient unavailable'; END IF;
 INSERT INTO public.business_order_reminders(business_id,order_id,recipient_email,sent_by)
 VALUES(p_business,p_order,p_email,auth.uid()) ON CONFLICT(business_id,order_id,reminder_date) DO NOTHING
 RETURNING id INTO v_id;
 RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.business_reserve_order_reminder(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_reserve_order_reminder(uuid,uuid,text) TO authenticated;
CREATE FUNCTION public.business_finish_order_reminder(p_id uuid,p_success boolean,p_provider text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 UPDATE public.business_order_reminders SET status=CASE WHEN p_success THEN 'sent' ELSE 'failed' END,
 provider_reference=left(coalesce(p_provider,''),120) WHERE id=p_id AND sent_by=auth.uid() AND status='reserved';
END;$$;
REVOKE ALL ON FUNCTION public.business_finish_order_reminder(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_finish_order_reminder(uuid,boolean,text) TO authenticated;
COMMIT;
