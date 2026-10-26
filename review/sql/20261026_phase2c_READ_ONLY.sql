-- BusinessOS Phase 2C — READ-ONLY operational inspection.
SELECT version,name FROM supabase_migrations.schema_migrations
 WHERE name LIKE 'businessos_phase2c_%' ORDER BY version;
SELECT t.tgname,pg_get_triggerdef(t.oid) AS trigger_definition
 FROM pg_trigger t WHERE NOT t.tgisinternal
 AND t.tgname='gl_pos_inventory_cost_after_post';
SELECT proname,
 has_function_privilege('authenticated',oid,'EXECUTE') AS authenticated_execute,
 has_function_privilege('anon',oid,'EXECUTE') AS anonymous_execute,
 prosrc LIKE '%inventory_account_id%' AS has_cost_mapping_logic
 FROM pg_proc WHERE pronamespace='public'::regnamespace
 AND proname IN ('gl_post_journal','gl_configure_inventory_cost_accounts',
 'gl_append_pos_inventory_cost','gl_configure_integration') ORDER BY proname;
SELECT (SELECT count(*) FROM public.gl_inventory_cost_settings) AS cost_mappings,
 (SELECT count(*) FROM public.gl_integration_settings) AS active_integrations,
 (SELECT count(*) FROM public.gl_journals) AS posted_journals,
 (SELECT count(*) FROM public.business_pos_sales) AS sales,
 (SELECT count(*) FROM public.business_pos_refunds) AS refunds;
SELECT count(*) AS unread_posted_pos_cost_sources FROM public.gl_journals j
 WHERE j.source_type='pos_sale' AND j.status='posted'
 AND EXISTS(SELECT 1 FROM public.business_pos_sales s JOIN public.order_items oi
   ON oi.order_id=s.order_id WHERE s.id=j.source_id AND s.business_id=j.business_id
   AND oi.unit_cost>0 AND EXISTS(SELECT 1 FROM public.inventory_movements im
    WHERE im.reference_id=s.order_id AND im.business_id=s.business_id
    AND im.product_id=oi.product_id AND im.movement_type='sale' AND im.quantity<0))
 AND NOT EXISTS(SELECT 1 FROM public.gl_lines l WHERE l.journal_id=j.id
  AND l.business_id=j.business_id AND l.memo='POS tracked-stock cost');
