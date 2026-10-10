-- Phase 030F / SQL 032: print identity and opt-in, APPROVED-only VAT order creation.
-- Apply after migration 031. DOES NOT backfill invoices, create tax rules or approve classifications.
BEGIN;

CREATE TABLE public.business_invoice_profiles (
 business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
 logo_url text NOT NULL DEFAULT '' CHECK(length(logo_url)<=1500 AND (logo_url='' OR logo_url ~ '^https://')),
 display_name text NOT NULL DEFAULT '' CHECK(length(display_name)<=160),
 registration_number text NOT NULL DEFAULT '' CHECK(length(registration_number)<=80),
 tax_identification_number text NOT NULL DEFAULT '' CHECK(length(tax_identification_number)<=80),
 bank_name text NOT NULL DEFAULT '' CHECK(length(bank_name)<=120),
 account_name text NOT NULL DEFAULT '' CHECK(length(account_name)<=160),
 account_number text NOT NULL DEFAULT '' CHECK(length(account_number)<=40),
 footer_note text NOT NULL DEFAULT '' CHECK(length(footer_note)<=360),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.business_invoice_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_invoice_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.business_invoice_profiles TO authenticated;
CREATE POLICY invoice_profiles_read ON public.business_invoice_profiles FOR SELECT TO authenticated
 USING(public.is_business_member(business_id));
CREATE POLICY invoice_profiles_owner_insert ON public.business_invoice_profiles FOR INSERT TO authenticated
 WITH CHECK(public.is_business_owner(business_id));
CREATE POLICY invoice_profiles_owner_update ON public.business_invoice_profiles FOR UPDATE TO authenticated
 USING(public.is_business_owner(business_id)) WITH CHECK(public.is_business_owner(business_id));

CREATE TABLE public.business_order_tax_reviews (
 order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE RESTRICT,
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 supply_id uuid NOT NULL REFERENCES public.business_supply_categories(id),
 rule_version_id uuid NOT NULL REFERENCES public.tax_rule_versions(id),
 treatment text NOT NULL CHECK(treatment IN ('standard','zero_rated','exempt','outside_scope')),
 rate_basis_points integer NOT NULL CHECK(rate_basis_points BETWEEN 0 AND 10000),
 taxable_base numeric(14,2) NOT NULL CHECK(taxable_base>=0),
 vat_amount numeric(14,2) NOT NULL CHECK(vat_amount>=0),
 assessed_on date NOT NULL,
 calculated_at timestamptz NOT NULL DEFAULT now(),
 calculated_by uuid NOT NULL REFERENCES auth.users(id),
 CHECK((treatment='standard' AND rate_basis_points=750) OR (treatment<>'standard' AND rate_basis_points=0))
);
CREATE INDEX business_order_tax_reviews_business_idx ON public.business_order_tax_reviews(business_id,assessed_on);
ALTER TABLE public.business_order_tax_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_order_tax_reviews FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.business_order_tax_reviews TO authenticated;
CREATE POLICY tax_reviews_business_read ON public.business_order_tax_reviews FOR SELECT TO authenticated
 USING(public.is_business_member(business_id));

-- The source, version and actual classifications are reviewed upstream by the existing
-- trusted tax-law workflow (migrations 005/009). No automatic inference from item names.
CREATE FUNCTION public.crm_create_tax_reviewed_order(
 p_business uuid,p_customer uuid,p_supply uuid,p_quantity numeric,p_unit_price numeric,
 p_discount numeric DEFAULT 0,p_due_date date DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 v_role text; v_supply public.business_supply_categories%ROWTYPE;
 v_rule_id_text text; v_treatment text; v_rate integer; v_count int; v_currency text; v_order uuid; v_number text;
 v_subtotal numeric(14,2); v_base numeric(14,2); v_vat numeric(14,2);
 v_date date := (now() AT TIME ZONE 'Africa/Lagos')::date;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT role::text INTO v_role FROM public.business_members
   WHERE business_id=p_business AND user_id=auth.uid();
 IF v_role IS NULL OR v_role NOT IN ('owner','manager','finance','sales') THEN
  RAISE EXCEPTION 'Insufficient sales permissions' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.business_tax_profiles
   WHERE business_id=p_business AND classification_status='reviewed' AND vat_registration_status='registered') THEN
  RAISE EXCEPTION 'Business VAT profile requires verification' USING ERRCODE='P0001'; END IF;
 SELECT currency INTO v_currency FROM public.businesses WHERE id=p_business;
 IF v_currency IS DISTINCT FROM 'NGN' THEN
  RAISE EXCEPTION 'Reviewed VAT checkout currently supports NGN only' USING ERRCODE='P0001'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.business_customers
   WHERE business_id=p_business AND customer_id=p_customer) THEN
  RAISE EXCEPTION 'Select a customer of this business' USING ERRCODE='P0001'; END IF;
 IF p_quantity IS NULL OR p_quantity<=0 OR p_quantity>999999 OR p_unit_price IS NULL
  OR p_unit_price<0 OR p_unit_price>999999999 OR p_discount IS NULL OR p_discount<0 THEN
  RAISE EXCEPTION 'Invalid order amounts' USING ERRCODE='P0001'; END IF;
 SELECT * INTO v_supply FROM public.business_supply_categories
   WHERE id=p_supply AND business_id=p_business;
 IF NOT FOUND THEN RAISE EXCEPTION 'Supply category not found' USING ERRCODE='P0001'; END IF;
 -- Fail closed on missing/overlapping rules, changed tax law or unsupported rate.
 SELECT count(*), min(r.id::text),min(r.treatment),min(r.rate_basis_points)
 INTO v_count,v_rule_id_text,v_treatment,v_rate
 FROM public.business_tax_assignments a JOIN public.tax_rule_versions r ON r.id=a.rule_version_id
 WHERE a.business_id=p_business AND a.supply_id=p_supply AND a.status='approved'
   AND r.status='approved' AND r.tax_kind='vat'
   AND r.effective_from<=v_date AND (r.effective_to IS NULL OR r.effective_to>=v_date);
 IF v_count<>1 THEN RAISE EXCEPTION 'Tax classification missing or ambiguous. Review in Tax Centre.' USING ERRCODE='P0001'; END IF;
 IF NOT ((v_treatment='standard' AND v_rate=750)
  OR (v_treatment IN ('zero_rated','exempt','outside_scope') AND v_rate=0)) THEN
  RAISE EXCEPTION 'Tax rate requires professional review' USING ERRCODE='P0001'; END IF;
 v_subtotal:=round(p_quantity*p_unit_price,2);
 IF v_subtotal<=0 OR p_discount>v_subtotal OR v_subtotal>999999999 THEN
  RAISE EXCEPTION 'Invalid taxable amount' USING ERRCODE='P0001'; END IF;
 v_base:=v_subtotal-p_discount;
 v_vat:=round(v_base*v_rate/10000,2);
 v_number:='ORD-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
 INSERT INTO public.orders(business_id,customer_id,order_number,status,subtotal,discount,delivery_fee,tax,due_date)
 VALUES(p_business,p_customer,v_number,'new',v_subtotal,p_discount,0,v_vat,p_due_date)
 RETURNING id INTO v_order;
 INSERT INTO public.order_items(order_id,name_snapshot,quantity,unit_price,unit_cost)
 VALUES(v_order,v_supply.name,p_quantity,p_unit_price,0);
 INSERT INTO public.business_order_tax_reviews(order_id,business_id,supply_id,rule_version_id,treatment,
  rate_basis_points,taxable_base,vat_amount,assessed_on,calculated_by)
 VALUES(v_order,p_business,p_supply,v_rule_id_text::uuid,v_treatment,
  v_rate,v_base,v_vat,v_date,auth.uid());
 RETURN v_order;
END $$;
REVOKE ALL ON FUNCTION public.crm_create_tax_reviewed_order(uuid,uuid,uuid,numeric,numeric,numeric,date)
 FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_create_tax_reviewed_order(uuid,uuid,uuid,numeric,numeric,numeric,date)
 TO authenticated;

-- Protect legacy manual order creation from silently creating zero-VAT sales for a
-- business already approved for VAT calculation. This does not yet cover POS.
CREATE OR REPLACE FUNCTION public.crm_create_order(p_business uuid,p_customer uuid,p_description text,
 p_quantity numeric,p_unit_price numeric,p_discount numeric DEFAULT 0,p_delivery numeric DEFAULT 0,p_due_date date DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_order uuid; v_number text; v_subtotal numeric(14,2);
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.business_members
   WHERE business_id=p_business AND user_id=auth.uid()) THEN
  RAISE EXCEPTION 'Not authorised' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.business_tax_profiles
   WHERE business_id=p_business AND vat_registration_status='registered' AND classification_status='reviewed') THEN
  RAISE EXCEPTION 'Use a reviewed VAT order; legacy untaxed orders are disabled for this business.' USING ERRCODE='P0001'; END IF;
 IF p_customer IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.business_customers
   WHERE business_id=p_business AND customer_id=p_customer) THEN
  RAISE EXCEPTION 'Customer does not belong to business' USING ERRCODE='P0001'; END IF;
 IF length(trim(coalesce(p_description,''))) NOT BETWEEN 2 AND 200 OR p_quantity IS NULL
  OR p_quantity<=0 OR p_quantity>999999 OR p_unit_price IS NULL OR p_unit_price<0
  OR p_unit_price>999999999 OR coalesce(p_discount,-1)<0 OR coalesce(p_delivery,-1)<0 THEN
  RAISE EXCEPTION 'Invalid order fields' USING ERRCODE='P0001'; END IF;
 v_subtotal:=round(p_quantity*p_unit_price,2);
 IF p_discount>v_subtotal THEN RAISE EXCEPTION 'Discount exceeds subtotal' USING ERRCODE='P0001'; END IF;
 v_number:='ORD-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
 INSERT INTO public.orders(business_id,customer_id,order_number,status,subtotal,discount,delivery_fee,tax,due_date)
 VALUES(p_business,p_customer,v_number,'new',v_subtotal,p_discount,p_delivery,0,p_due_date)
 RETURNING id INTO v_order;
 INSERT INTO public.order_items(order_id,name_snapshot,quantity,unit_price,unit_cost)
 VALUES(v_order,trim(p_description),p_quantity,p_unit_price,0);
 RETURN v_order;
END $$;

-- Copy seller's branding and tax evidence to the invoice when it is FIRST issued;
-- historical invoices are deliberately untouched. A generated PDF is not an NRS e-invoice.
CREATE FUNCTION public.attach_reviewed_tax_invoice_snapshot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_tax record;v_profile record;
BEGIN
 SELECT treatment,rate_basis_points,taxable_base,vat_amount,assessed_on,rule_version_id
 INTO v_tax FROM public.business_order_tax_reviews
 WHERE business_id=NEW.business_id AND order_id=NEW.order_id;
 IF FOUND THEN
  IF round(coalesce((NEW.snapshot->>'tax_recorded')::numeric,0),2)<>v_tax.vat_amount THEN
   RAISE EXCEPTION 'Invoice tax no longer matches approved order assessment'; END IF;
  NEW.snapshot:=NEW.snapshot||jsonb_build_object('tax_context',jsonb_build_object(
   'treatment',v_tax.treatment,'rate_basis_points',v_tax.rate_basis_points,
   'taxable_base',v_tax.taxable_base,'vat_amount',v_tax.vat_amount,
   'tax_date',v_tax.assessed_on,'rule_version_id',v_tax.rule_version_id));
 END IF;
 SELECT logo_url,display_name,registration_number,tax_identification_number,bank_name,
  account_name,account_number,footer_note INTO v_profile
 FROM public.business_invoice_profiles WHERE business_id=NEW.business_id;
 IF FOUND THEN NEW.snapshot:=NEW.snapshot||jsonb_build_object('invoice_identity',jsonb_build_object(
 'logo_url',v_profile.logo_url,'display_name',v_profile.display_name,
 'registration_number',v_profile.registration_number,'tax_identification_number',v_profile.tax_identification_number,
 'bank_name',v_profile.bank_name,'account_name',v_profile.account_name,'account_number',v_profile.account_number,
 'footer_note',v_profile.footer_note)); END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.attach_reviewed_tax_invoice_snapshot() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER invoice_tax_identity_at_issue BEFORE INSERT ON public.business_invoices
 FOR EACH ROW EXECUTE FUNCTION public.attach_reviewed_tax_invoice_snapshot();
COMMIT;
