-- 018: Read-only administrator business directory.
-- Apply AFTER migrations 001-017. No existing data is overwritten.
CREATE OR REPLACE FUNCTION public.platform_business_directory()
RETURNS TABLE (business_id uuid,business_name text,category text,created_at timestamptz,
 owner_count bigint,member_count bigint,approved_plan text,pending_upgrades bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.platform_admins pa
   WHERE pa.user_id = auth.uid() AND pa.active = true
 ) THEN
  RAISE EXCEPTION 'Platform administrator access required' USING ERRCODE='42501';
 END IF;
 RETURN QUERY
 SELECT b.id,b.name,b.category,b.created_at,
   (SELECT count(*) FROM public.business_members bm WHERE bm.business_id=b.id AND bm.role='owner'),
   (SELECT count(*) FROM public.business_members bm WHERE bm.business_id=b.id),
   (SELECT a.plan_id FROM public.business_plan_assignments a WHERE a.business_id=b.id),
   (SELECT count(*) FROM public.business_upgrade_requests r WHERE r.business_id=b.id AND r.status='pending')
 FROM public.businesses b ORDER BY b.created_at DESC;
END; $$;
REVOKE ALL ON FUNCTION public.platform_business_directory() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_business_directory() TO authenticated;
