-- Phase 15: enforce same-business automation template references, independent of RLS or client paths.
-- Apply AFTER 014. If existing records violate the constraint, fix them before applying.
BEGIN;
ALTER TABLE public.communication_templates
  ADD CONSTRAINT communication_templates_id_business_unique UNIQUE (id, business_id);
ALTER TABLE public.engagement_automations
  ADD CONSTRAINT engagement_automations_template_tenant_fk
  FOREIGN KEY (template_id, business_id)
  REFERENCES public.communication_templates (id, business_id)
  ON UPDATE RESTRICT ON DELETE RESTRICT;
COMMIT;
