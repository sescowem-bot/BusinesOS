-- APPLIED IN PRODUCTION: 20261026063321 businessos_phase2b_invoice_specific_capture_safe_branch
-- Archive only. DO NOT REAPPLY to BusinessOS production.

CREATE OR REPLACE FUNCTION public.gl_capture_source_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_event uuid;v_type text;v_at timestamptz;
BEGIN
 v_type:=case TG_TABLE_NAME WHEN 'business_invoices' THEN 'invoice'
  WHEN 'business_pos_sales' THEN 'pos_sale'
  WHEN 'business_pos_refunds' THEN 'refund'
  WHEN 'payments' THEN 'payment' ELSE 'expense' END;
 IF v_type='payment' AND (to_jsonb(NEW)->>'status')<>'completed' THEN RETURN NEW; END IF;
 IF v_type='invoice' THEN
   IF EXISTS(SELECT 1 FROM public.business_pos_sales s WHERE s.business_id=NEW.business_id AND s.order_id=NEW.order_id)
   THEN RETURN NEW; END IF;
 END IF;
 v_at:=coalesce((to_jsonb(NEW)->>'issued_at')::timestamptz,
                 (to_jsonb(NEW)->>'confirmed_at')::timestamptz,
                 (to_jsonb(NEW)->>'paid_at')::timestamptz,
                 (to_jsonb(NEW)->>'created_at')::timestamptz,now());
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
$function$;
