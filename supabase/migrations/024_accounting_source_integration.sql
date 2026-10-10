-- Phase 025 / migration 024. Install after migration 023, preferably on staging first.
-- Opt-in source posting. Existing business events are NOT automatically backfilled.
-- This is a commercial accrual model (revenue at invoice issue), not statutory accounting advice.
BEGIN;

CREATE TABLE public.gl_integration_settings (
 business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
 enabled boolean NOT NULL DEFAULT false,
 cash_account_id uuid NOT NULL,
 receivable_account_id uuid NOT NULL,
 advance_account_id uuid NOT NULL,
 income_account_id uuid NOT NULL,
 delivery_account_id uuid NOT NULL,
 tax_account_id uuid NOT NULL,
 expense_account_id uuid NOT NULL,
 updated_by uuid NOT NULL REFERENCES auth.users(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(business_id,cash_account_id) REFERENCES public.gl_accounts(business_id,id),
 FOREIGN KEY(business_id,receivable_account_id) REFERENCES public.gl_accounts(business_id,id),
 FOREIGN KEY(business_id,advance_account_id) REFERENCES public.gl_accounts(business_id,id),
 FOREIGN KEY(business_id,income_account_id) REFERENCES public.gl_accounts(business_id,id),
 FOREIGN KEY(business_id,delivery_account_id) REFERENCES public.gl_accounts(business_id,id),
 FOREIGN KEY(business_id,tax_account_id) REFERENCES public.gl_accounts(business_id,id),
 FOREIGN KEY(business_id,expense_account_id) REFERENCES public.gl_accounts(business_id,id)
);

CREATE TABLE public.gl_source_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 source_type text NOT NULL CHECK(source_type IN ('invoice','payment','expense')),
 source_id uuid NOT NULL,
 occurred_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','posted','error')),
 journal_id uuid,
 attempts integer NOT NULL DEFAULT 0,
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 posted_at timestamptz,
 UNIQUE(business_id,source_type,source_id),
 FOREIGN KEY(business_id,journal_id) REFERENCES public.gl_journals(business_id,id)
);
CREATE INDEX gl_source_events_pending ON public.gl_source_events(business_id,status,occurred_at);
ALTER TABLE public.gl_source_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gl_integration_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gl_source_events,public.gl_integration_settings FROM public,anon,authenticated;
GRANT SELECT ON public.gl_source_events,public.gl_integration_settings TO authenticated;
CREATE POLICY gl_events_finance_read ON public.gl_source_events FOR SELECT TO authenticated USING(public.gl_can_manage(business_id));
CREATE POLICY gl_integrations_finance_read ON public.gl_integration_settings FOR SELECT TO authenticated USING(public.gl_can_manage(business_id));

-- Check mappings before activation. Once business source journals exist, mappings are
-- deliberately immutable: changing them requires a separately reviewed migration.
CREATE FUNCTION public.gl_configure_integration(
 p_business uuid,p_enabled boolean,p_cash uuid,p_receivable uuid,p_advance uuid,
 p_income uuid,p_delivery uuid,p_tax uuid,p_expense uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_old public.gl_integration_settings%ROWTYPE;
BEGIN
 IF NOT public.gl_can_manage(p_business) OR NOT public.business_has_feature(p_business,'accounting')
 THEN RAISE EXCEPTION 'Accounting permission or subscription required' USING ERRCODE='42501'; END IF;
 IF p_enabled IS NULL THEN RAISE EXCEPTION 'An enabled setting is required'; END IF;
 IF EXISTS(SELECT 1 FROM public.gl_journals WHERE business_id=p_business AND source_type IN ('invoice','payment','expense')) THEN
  SELECT * INTO v_old FROM public.gl_integration_settings WHERE business_id=p_business FOR UPDATE;
  IF NOT FOUND OR ROW(v_old.cash_account_id,v_old.receivable_account_id,v_old.advance_account_id,v_old.income_account_id,v_old.delivery_account_id,v_old.tax_account_id,v_old.expense_account_id)
    IS DISTINCT FROM ROW(p_cash,p_receivable,p_advance,p_income,p_delivery,p_tax,p_expense)
  THEN RAISE EXCEPTION 'Account mappings cannot change after source journals exist. Contact an accountant for controlled adjustments.'; END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.gl_accounts WHERE business_id=p_business AND id=p_cash AND class='asset' AND active)
 OR NOT EXISTS(SELECT 1 FROM public.gl_accounts WHERE business_id=p_business AND id=p_receivable AND class='asset' AND active)
 OR NOT EXISTS(SELECT 1 FROM public.gl_accounts WHERE business_id=p_business AND id=p_advance AND class='liability' AND active)
 OR NOT EXISTS(SELECT 1 FROM public.gl_accounts WHERE business_id=p_business AND id=p_income AND class='income' AND active)
 OR NOT EXISTS(SELECT 1 FROM public.gl_accounts WHERE business_id=p_business AND id=p_delivery AND class='income' AND active)
 OR NOT EXISTS(SELECT 1 FROM public.gl_accounts WHERE business_id=p_business AND id=p_tax AND class='liability' AND active)
 OR NOT EXISTS(SELECT 1 FROM public.gl_accounts WHERE business_id=p_business AND id=p_expense AND class='expense' AND active)
 THEN RAISE EXCEPTION 'Every mapping must point to an active account of the correct class in this business'; END IF;
 IF p_cash=p_receivable OR p_cash=p_advance OR p_receivable=p_advance THEN
  RAISE EXCEPTION 'Cash, receivables and customer advances must use different accounts'; END IF;
 INSERT INTO public.gl_integration_settings (business_id,enabled,cash_account_id,receivable_account_id,advance_account_id,income_account_id,delivery_account_id,tax_account_id,expense_account_id,updated_by)
 VALUES(p_business,p_enabled,p_cash,p_receivable,p_advance,p_income,p_delivery,p_tax,p_expense,auth.uid())
 ON CONFLICT(business_id) DO UPDATE SET enabled=EXCLUDED.enabled,cash_account_id=EXCLUDED.cash_account_id,
 receivable_account_id=EXCLUDED.receivable_account_id,advance_account_id=EXCLUDED.advance_account_id,
 income_account_id=EXCLUDED.income_account_id,delivery_account_id=EXCLUDED.delivery_account_id,
 tax_account_id=EXCLUDED.tax_account_id,expense_account_id=EXCLUDED.expense_account_id,
 updated_by=EXCLUDED.updated_by,updated_at=now();
END;
$$;

-- Internal, SECURITY DEFINER posting routine. Not callable by API roles.
-- Event row is locked to serialize concurrent workers. Every journal is balanced
-- within the same database transaction and backed by the existing unique source index.
CREATE FUNCTION public.gl_post_source_event(p_event uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_event public.gl_source_events%ROWTYPE; v_settings public.gl_integration_settings%ROWTYPE;
 v_period uuid; v_journal uuid; v_date date; v_actor uuid; v_amount numeric(18,2); v_advance numeric(18,2):=0;
 v_total numeric(18,2);v_sales numeric(18,2);v_delivery numeric(18,2);v_tax numeric(18,2);
 v_order uuid;v_source_date timestamptz;v_line integer:=0;v_income numeric(18,2):=0;
BEGIN
 SELECT * INTO v_event FROM public.gl_source_events WHERE id=p_event FOR UPDATE;
 IF NOT FOUND OR v_event.status='posted' THEN RETURN; END IF;
 SELECT * INTO v_settings FROM public.gl_integration_settings WHERE business_id=v_event.business_id AND enabled=true;
 IF NOT FOUND THEN RETURN; END IF;
 -- Downgrading a plan must stop new automatic premium ledger postings.
 IF NOT EXISTS (SELECT 1 FROM public.business_plan_assignments b
   JOIN public.platform_plan_features f ON f.plan_id=b.plan_id AND f.feature_key='accounting' AND f.enabled
   WHERE b.business_id=v_event.business_id) THEN RETURN; END IF;
 v_date:=(v_event.occurred_at AT TIME ZONE 'UTC')::date;
 SELECT id INTO v_period FROM public.gl_periods WHERE business_id=v_event.business_id AND status='open'
 AND v_date BETWEEN starts_on AND ends_on FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'No open accounting period for %',v_date; END IF;
 v_actor:=auth.uid();
 IF v_actor IS NULL THEN SELECT user_id INTO v_actor FROM public.business_members
   WHERE business_id=v_event.business_id AND role='owner' ORDER BY created_at LIMIT 1; END IF;
 IF v_actor IS NULL THEN RAISE EXCEPTION 'No permitted posting actor'; END IF;

 IF v_event.source_type='invoice' THEN
   SELECT order_id,round((snapshot->>'total')::numeric,2),
    round(((snapshot->>'subtotal')::numeric-(snapshot->>'discount')::numeric),2),
    round((snapshot->>'delivery_fee')::numeric,2),round((snapshot->>'tax_recorded')::numeric,2)
    INTO v_order,v_total,v_sales,v_delivery,v_tax
    FROM public.business_invoices WHERE id=v_event.source_id AND business_id=v_event.business_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'Invoice source not found'; END IF;
   IF v_sales<0 OR v_tax<0 OR v_delivery<0 OR v_total<=0 OR v_total<>v_sales+v_tax+v_delivery THEN
     RAISE EXCEPTION 'Invoice snapshot totals are invalid'; END IF;
   -- Advance receipts that were journalized before the invoice was issued must
   -- be offset against the new receivable, and never treated as new revenue.
   SELECT coalesce(sum(l.credit),0) INTO v_advance FROM public.gl_journals j
    JOIN public.payments p ON p.id=j.source_id AND p.business_id=j.business_id AND p.order_id=v_order
    JOIN public.gl_lines l ON l.journal_id=j.id AND l.business_id=j.business_id
    WHERE j.business_id=v_event.business_id AND j.source_type='payment' AND j.status='posted'
      AND l.account_id=v_settings.advance_account_id;
   IF v_advance>v_total THEN RAISE EXCEPTION 'Customer advance exceeds invoice total; manual review required'; END IF;
   v_income:=v_total;
 ELSIF v_event.source_type='payment' THEN
   SELECT p.order_id,p.amount INTO v_order,v_amount FROM public.payments p
   WHERE p.id=v_event.source_id AND p.business_id=v_event.business_id AND p.status='completed';
   IF NOT FOUND THEN RAISE EXCEPTION 'Completed payment source not found'; END IF;
   IF v_amount<=0 THEN RAISE EXCEPTION 'Payment must be positive'; END IF;
 ELSIF v_event.source_type='expense' THEN
   SELECT amount INTO v_amount FROM public.expenses WHERE id=v_event.source_id AND business_id=v_event.business_id;
   IF NOT FOUND OR v_amount<=0 THEN RAISE EXCEPTION 'Paid expense source not found'; END IF;
 ELSE RAISE EXCEPTION 'Unsupported source type'; END IF;

 -- An old retry may already have a source journal; treat this as successfully posted.
 SELECT id INTO v_journal FROM public.gl_journals WHERE business_id=v_event.business_id
  AND source_type=v_event.source_type AND source_id=v_event.source_id AND reversal_of IS NULL;
 IF v_journal IS NULL THEN
  INSERT INTO public.gl_journals(business_id,period_id,journal_date,reference,description,
    source_type,source_id,posted_by)
  VALUES(v_event.business_id,v_period,v_date,substring(v_event.source_id::text,1,36),
    case v_event.source_type WHEN 'invoice' THEN 'Commercial invoice issued'
      WHEN 'payment' THEN 'Customer payment received' ELSE 'Paid business expense' END,
    v_event.source_type,v_event.source_id,v_actor) RETURNING id INTO v_journal;

  IF v_event.source_type='invoice' THEN
   INSERT INTO public.gl_lines(business_id,journal_id,account_id,line_no,debit,credit)
      VALUES(v_event.business_id,v_journal,v_settings.receivable_account_id,1,v_total,0);
   v_line:=1;
   IF v_sales>0 THEN v_line:=v_line+1;
     INSERT INTO public.gl_lines(business_id,journal_id,account_id,line_no,debit,credit)
     VALUES(v_event.business_id,v_journal,v_settings.income_account_id,v_line,0,v_sales); END IF;
   IF v_delivery>0 THEN v_line:=v_line+1;
     INSERT INTO public.gl_lines(business_id,journal_id,account_id,line_no,debit,credit)
     VALUES(v_event.business_id,v_journal,v_settings.delivery_account_id,v_line,0,v_delivery); END IF;
   IF v_tax>0 THEN v_line:=v_line+1;
     INSERT INTO public.gl_lines(business_id,journal_id,account_id,line_no,debit,credit)
     VALUES(v_event.business_id,v_journal,v_settings.tax_account_id,v_line,0,v_tax); END IF;
   IF v_advance>0 THEN
     v_line:=v_line+1;
     INSERT INTO public.gl_lines(business_id,journal_id,account_id,line_no,debit,credit)
     VALUES(v_event.business_id,v_journal,v_settings.advance_account_id,v_line,v_advance,0);
     v_line:=v_line+1;
     INSERT INTO public.gl_lines(business_id,journal_id,account_id,line_no,debit,credit)
     VALUES(v_event.business_id,v_journal,v_settings.receivable_account_id,v_line,0,v_advance);
   END IF;
  ELSIF v_event.source_type='payment' THEN
   INSERT INTO public.gl_lines(business_id,journal_id,account_id,line_no,debit,credit)
      VALUES(v_event.business_id,v_journal,v_settings.cash_account_id,1,v_amount,0);
   -- If invoice already *journalized*, apply payment to A/R; otherwise
   -- recognize customer advances. This supports payment-before-invoice.
   INSERT INTO public.gl_lines(business_id,journal_id,account_id,line_no,debit,credit)
    VALUES(v_event.business_id,v_journal,
      CASE WHEN EXISTS(SELECT 1 FROM public.gl_journals j JOIN public.business_invoices i
             ON i.id=j.source_id AND j.business_id=i.business_id
             WHERE i.business_id=v_event.business_id AND i.order_id=v_order
               AND j.source_type='invoice' AND j.status='posted')
           THEN v_settings.receivable_account_id ELSE v_settings.advance_account_id END,2,0,v_amount);
  ELSE
   INSERT INTO public.gl_lines(business_id,journal_id,account_id,line_no,debit,credit) VALUES
     (v_event.business_id,v_journal,v_settings.expense_account_id,1,v_amount,0),
     (v_event.business_id,v_journal,v_settings.cash_account_id,2,0,v_amount);
  END IF;
 END IF;
 UPDATE public.gl_source_events SET status='posted',journal_id=v_journal,
   posted_at=now(),last_error=NULL,attempts=attempts+1 WHERE id=p_event;
END;
$$;

-- Capture events without interrupting invoices, receipts or expenses if a
-- posting period is missing. A failed attempt remains visible for repair.
CREATE FUNCTION public.gl_capture_source_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_event uuid;v_type text;v_at timestamptz;
BEGIN
 v_type:=case TG_TABLE_NAME WHEN 'business_invoices' THEN 'invoice'
  WHEN 'payments' THEN 'payment' ELSE 'expense' END;
 IF v_type='payment' AND (to_jsonb(NEW)->>'status')<>'completed' THEN RETURN NEW; END IF;
 v_at:=coalesce((to_jsonb(NEW)->>'issued_at')::timestamptz,
                 (to_jsonb(NEW)->>'paid_at')::timestamptz);
 INSERT INTO public.gl_source_events(business_id,source_type,source_id,occurred_at)
 VALUES(NEW.business_id,v_type,NEW.id,v_at)
 ON CONFLICT(business_id,source_type,source_id) DO NOTHING RETURNING id INTO v_event;
 IF v_event IS NOT NULL AND EXISTS(SELECT 1 FROM public.gl_integration_settings
   WHERE business_id=NEW.business_id AND enabled) THEN
  BEGIN
   PERFORM public.gl_post_source_event(v_event);
  EXCEPTION WHEN OTHERS THEN
   UPDATE public.gl_source_events SET status='error',attempts=attempts+1,
     last_error=left(SQLERRM,450) WHERE id=v_event;
  END;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER gl_invoice_capture AFTER INSERT ON public.business_invoices FOR EACH ROW EXECUTE FUNCTION public.gl_capture_source_event();
CREATE TRIGGER gl_payment_capture AFTER INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.gl_capture_source_event();
CREATE TRIGGER gl_payment_status_capture AFTER UPDATE OF status ON public.payments
 FOR EACH ROW WHEN (NEW.status='completed' AND OLD.status IS DISTINCT FROM NEW.status)
 EXECUTE FUNCTION public.gl_capture_source_event();
CREATE TRIGGER gl_expense_capture AFTER INSERT ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.gl_capture_source_event();

-- Historical backfill is deliberately explicit to avoid unexpectedly booking
-- years of transactions or duplicating a manually maintained general ledger.
CREATE FUNCTION public.gl_discover_existing_sources(p_business uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_i integer;v_p integer;v_e integer;
BEGIN
 IF NOT public.gl_can_manage(p_business) OR NOT public.business_has_feature(p_business,'accounting') THEN
   RAISE EXCEPTION 'Finance permission required' USING ERRCODE='42501'; END IF;
 INSERT INTO public.gl_source_events(business_id,source_type,source_id,occurred_at)
 SELECT business_id,'invoice',id,issued_at FROM public.business_invoices WHERE business_id=p_business
 ON CONFLICT(business_id,source_type,source_id) DO NOTHING;
 GET DIAGNOSTICS v_i=ROW_COUNT;
 INSERT INTO public.gl_source_events(business_id,source_type,source_id,occurred_at)
 SELECT business_id,'payment',id,paid_at FROM public.payments WHERE business_id=p_business AND status='completed'
 ON CONFLICT(business_id,source_type,source_id) DO NOTHING;
 GET DIAGNOSTICS v_p=ROW_COUNT;
 INSERT INTO public.gl_source_events(business_id,source_type,source_id,occurred_at)
 SELECT business_id,'expense',id,paid_at FROM public.expenses WHERE business_id=p_business
 ON CONFLICT(business_id,source_type,source_id) DO NOTHING;
 GET DIAGNOSTICS v_e=ROW_COUNT;
 RETURN jsonb_build_object('invoices',v_i,'payments',v_p,'expenses',v_e);
END;
$$;

CREATE FUNCTION public.gl_process_accounting_queue(p_business uuid,p_limit integer DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id uuid;v_done integer:=0;v_failed integer:=0;
BEGIN
 IF NOT public.gl_can_manage(p_business) OR NOT public.business_has_feature(p_business,'accounting') THEN
   RAISE EXCEPTION 'Finance permission required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.gl_integration_settings WHERE business_id=p_business AND enabled) THEN
   RAISE EXCEPTION 'Configure and enable accounting integration first'; END IF;
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Limit must be between 1 and 50'; END IF;
 FOR v_id IN SELECT id FROM public.gl_source_events WHERE business_id=p_business AND status IN ('pending','error')
 ORDER BY occurred_at,case source_type WHEN 'payment' THEN 0 WHEN 'invoice' THEN 1 ELSE 2 END,id
 LIMIT p_limit FOR UPDATE SKIP LOCKED LOOP
  BEGIN
   PERFORM public.gl_post_source_event(v_id);
   v_done:=v_done+1;
  EXCEPTION WHEN OTHERS THEN
   UPDATE public.gl_source_events SET status='error',attempts=attempts+1,
     last_error=left(SQLERRM,450) WHERE id=v_id;
   v_failed:=v_failed+1;
  END;
 END LOOP;
 RETURN jsonb_build_object('posted',v_done,'failed',v_failed);
END;
$$;

-- Paid expense creation is a controlled accounting action; no unrestricted
-- direct INSERT/UPDATE/DELETE on source expenses is introduced.
CREATE FUNCTION public.gl_record_paid_expense(p_business uuid,p_description text,p_amount numeric,p_paid_at timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT public.gl_can_manage(p_business) OR NOT public.business_has_feature(p_business,'expenses') THEN
  RAISE EXCEPTION 'Finance permission required' USING ERRCODE='42501'; END IF;
 IF length(trim(coalesce(p_description,''))) NOT BETWEEN 3 AND 300 OR p_amount IS NULL
   OR p_amount<=0 OR p_amount>999999999 OR round(p_amount,2)<>p_amount OR p_paid_at IS NULL
   OR p_paid_at>now()+interval '1 day' THEN RAISE EXCEPTION 'Invalid expense details'; END IF;
 INSERT INTO public.expenses(business_id,description,amount,paid_at)
 VALUES(p_business,trim(p_description),p_amount,p_paid_at) RETURNING id INTO v_id;
 RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.gl_post_source_event(uuid),public.gl_capture_source_event() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gl_configure_integration(uuid,boolean,uuid,uuid,uuid,uuid,uuid,uuid,uuid),
 public.gl_discover_existing_sources(uuid),public.gl_process_accounting_queue(uuid,integer),
 public.gl_record_paid_expense(uuid,text,numeric,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gl_configure_integration(uuid,boolean,uuid,uuid,uuid,uuid,uuid,uuid,uuid),
 public.gl_discover_existing_sources(uuid),public.gl_process_accounting_queue(uuid,integer),
 public.gl_record_paid_expense(uuid,text,numeric,timestamptz) TO authenticated;
COMMIT;
