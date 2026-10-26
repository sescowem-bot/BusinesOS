-- Phase 2A/2B installed database release: READ-ONLY inspection.
SELECT t.tgname, t.tgrelid::regclass::text AS table_name
 FROM pg_trigger t
 WHERE NOT t.tgisinternal AND t.tgname IN ('gl_pos_sale_capture','gl_pos_refund_capture')
 ORDER BY t.tgname;
SELECT pg_get_constraintdef(oid) AS permitted_source_types
 FROM pg_constraint WHERE conrelid='public.gl_source_events'::regclass
 AND conname='gl_source_events_source_type_check';
SELECT proname,(prosrc LIKE '%pos_sale%') AS pos_aware,
 (prosrc LIKE '%refund%') AS refund_aware
 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN
 ('gl_capture_source_event','gl_configure_integration','gl_discover_existing_sources',
  'gl_post_source_event','gl_process_accounting_queue')
 ORDER BY proname;
SELECT (SELECT count(*) FROM public.business_pos_sales) AS pos_sales,
 (SELECT count(*) FROM public.business_pos_refunds) AS refunds,
 (SELECT count(*) FROM public.business_invoices) AS invoices,
 (SELECT count(*) FROM public.gl_journals) AS journals,
 (SELECT count(*) FROM public.gl_integration_settings) AS integrations;
SELECT source_type,status,count(*) AS count FROM public.gl_source_events
 GROUP BY source_type,status ORDER BY source_type,status;
SELECT has_function_privilege('authenticated','public.business_pos_accounting_health(uuid)','EXECUTE') AS authenticated_allowed,
 has_function_privilege('anon','public.business_pos_accounting_health(uuid)','EXECUTE') AS anonymous_allowed_should_be_false;
