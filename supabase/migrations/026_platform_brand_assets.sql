-- 026: Public brand assets controlled by active Platform Administrators.
-- Apply AFTER 025. No deletion or change to previous branding records.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.platform_branding') IS NULL OR to_regclass('public.platform_admins') IS NULL THEN
   RAISE EXCEPTION 'Base platform branding/admin schema missing';
 END IF;
END $$;

-- These are public website assets, NOT private customer uploads.
-- Disallow SVG because a publicly served SVG may contain active content.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('platform-brand-assets','platform-brand-assets',true,1572864,ARRAY['image/png','image/jpeg','image/webp','image/x-icon'])
ON CONFLICT(id) DO NOTHING;

DROP POLICY IF EXISTS businessos_brand_assets_public_read ON storage.objects;
CREATE POLICY businessos_brand_assets_public_read ON storage.objects
 FOR SELECT TO public USING (bucket_id='platform-brand-assets');
DROP POLICY IF EXISTS businessos_brand_assets_admin_insert ON storage.objects;
CREATE POLICY businessos_brand_assets_admin_insert ON storage.objects
 FOR INSERT TO authenticated WITH CHECK (
 bucket_id='platform-brand-assets'
 AND (storage.foldername(name))[1] IN ('logo','favicon')
 AND EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active=true)
);
DROP POLICY IF EXISTS businessos_brand_assets_admin_delete ON storage.objects;
CREATE POLICY businessos_brand_assets_admin_delete ON storage.objects
 FOR DELETE TO authenticated USING (
 bucket_id='platform-brand-assets'
 AND EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active=true)
);
-- Files have immutable UUID paths; updates not permitted. Prior assets are not removed automatically.
COMMIT;
