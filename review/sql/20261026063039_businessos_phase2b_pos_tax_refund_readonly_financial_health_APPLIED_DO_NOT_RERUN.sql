-- APPLIED IN PRODUCTION: 20261026063039 businessos_phase2b_pos_tax_refund_readonly_financial_health
-- Archive only. DO NOT REAPPLY to BusinessOS production.

-- Phase 2B: read-only POS/VAT/refund accounting integrity dashboard.
-- No source rows, balances, subscriptions or journals are modified.
CREATE OR REPLACE FUNCTION public.business_pos_accounting_health(p_business uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=public,pg_temp AS $function$
DECLARE v_output jsonb;
BEGIN
 IF auth.uid() IS NULL OR p_business IS NULL OR
  NOT public.business_membership_is_active(p_business,auth.uid()) OR
  NOT EXISTS(SELECT 1 FROM public.business_members m
    WHERE m.business_id=p_business AND m.user_id=auth.uid()
      AND m.role IN ('owner','manager','finance')) OR
  NOT public.business_has_feature(p_business,'accounting') OR
  NOT public.business_can_perform_action(p_business,'accounting','view')
 THEN RAISE EXCEPTION 'Accounting inspection requires authorised business finance access' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object(
   'pos_sales', (SELECT count(*) FROM public.business_pos_sales s WHERE s.business_id=p_business),
   'confirmed_refunds', (SELECT count(*) FROM public.business_pos_refunds f WHERE f.business_id=p_business),
   'missing_pos_events', (
    SELECT count(*) FROM public.business_pos_sales s WHERE s.business_id=p_business
      AND NOT EXISTS(SELECT 1 FROM public.gl_source_events e WHERE e.business_id=s.business_id
        AND e.source_type='pos_sale' AND e.source_id=s.id)),
   'missing_refund_events', (
    SELECT count(*) FROM public.business_pos_refunds f WHERE f.business_id=p_business
      AND NOT EXISTS(SELECT 1 FROM public.gl_source_events e WHERE e.business_id=f.business_id
        AND e.source_type='refund' AND e.source_id=f.id)),
   'duplicate_invoice_events', (
    SELECT count(*) FROM public.gl_source_events e JOIN public.business_invoices i
      ON i.id=e.source_id AND i.business_id=e.business_id
    WHERE e.business_id=p_business AND e.source_type='invoice'
      AND EXISTS(SELECT 1 FROM public.business_pos_sales s
        WHERE s.business_id=i.business_id AND s.order_id=i.order_id)),
   'pos_vat_mismatches', (
    SELECT count(*) FROM public.business_pos_sales s JOIN public.orders o
      ON o.id=s.order_id AND o.business_id=s.business_id
    WHERE s.business_id=p_business AND
     (o.total<>o.subtotal-o.discount+o.tax+o.delivery_fee
      OR ((o.tax<>0 OR EXISTS(SELECT 1 FROM public.business_pos_tax_lines t
          WHERE t.business_id=s.business_id AND t.order_id=s.order_id))
          AND (SELECT COALESCE(sum(t.vat_amount),0) FROM public.business_pos_tax_lines t
            WHERE t.business_id=s.business_id AND t.order_id=s.order_id)<>o.tax)
      OR (EXISTS(SELECT 1 FROM public.business_pos_tax_lines t
          WHERE t.business_id=s.business_id AND t.order_id=s.order_id)
          AND ((SELECT COALESCE(sum(t.taxable_base),0) FROM public.business_pos_tax_lines t
            WHERE t.business_id=s.business_id AND t.order_id=s.order_id)<>o.subtotal-o.discount
            OR (SELECT count(*) FROM public.business_pos_tax_lines t
               WHERE t.business_id=s.business_id AND t.order_id=s.order_id)
              <>(SELECT count(*) FROM public.order_items oi WHERE oi.order_id=o.id))))),
   'refund_mismatches', (
    SELECT count(*) FROM public.business_pos_refunds f
      JOIN public.business_pos_returns r ON r.id=f.return_id AND r.business_id=f.business_id
    WHERE f.business_id=p_business AND
     (f.amount<>r.gross_credit OR r.net_credit+r.vat_credit<>r.gross_credit
      OR r.status<>'completed'
      OR NOT EXISTS(SELECT 1 FROM public.business_pos_credit_notes c
       WHERE c.business_id=f.business_id AND c.return_id=f.return_id))),
   'unbalanced_pos_journals', (
    SELECT count(*) FROM public.gl_journals j WHERE j.business_id=p_business
     AND j.status='posted' AND j.source_type IN ('pos_sale','refund')
     AND (NOT EXISTS(SELECT 1 FROM public.gl_lines l WHERE l.journal_id=j.id)
       OR (SELECT COALESCE(sum(l.debit-l.credit),0) FROM public.gl_lines l
         WHERE l.journal_id=j.id)<>0)),
   'unposted_pos_events', (
    SELECT count(*) FROM public.gl_source_events e WHERE e.business_id=p_business
      AND e.source_type IN ('pos_sale','refund') AND e.status<>'posted')
 ) INTO v_output;
 RETURN v_output;
END $function$;
REVOKE ALL ON FUNCTION public.business_pos_accounting_health(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_pos_accounting_health(uuid) TO authenticated;
