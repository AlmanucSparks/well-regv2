
-- Payment method + status enums
DO $$ BEGIN
  CREATE TYPE public.invoice_payment_method AS ENUM ('cash','mpesa','insurance','bank');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM ('draft','paid','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Invoice number generator
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE new_code TEXT;
BEGIN
  new_code := 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(floor(random()*1000000)::text, 6, '0');
  RETURN new_code;
END $$;

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE DEFAULT public.generate_invoice_number(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  facility_id uuid REFERENCES public.facilities(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  tax_percent numeric(5,2) NOT NULL DEFAULT 0,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  grand_total numeric(12,2) NOT NULL DEFAULT 0,
  payment_method public.invoice_payment_method,
  mpesa_reference text,
  insurance_scheme text,
  insurance_auth_code text,
  bank_reference text,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- View: super_admin sees all, others limited to their facility
CREATE POLICY "invoices_select"
ON public.invoices FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR facility_id = public.get_user_facility_id(auth.uid())
);

-- Insert: registrar/supervisor/admin/super_admin in their own facility (or any for super_admin)
CREATE POLICY "invoices_insert"
ON public.invoices FOR INSERT TO authenticated
WITH CHECK (
  (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'supervisor')
    OR public.has_role(auth.uid(), 'registrar')
  )
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR facility_id = public.get_user_facility_id(auth.uid())
  )
);

-- Update: same roles, same facility scoping
CREATE POLICY "invoices_update"
ON public.invoices FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    (public.has_role(auth.uid(), 'admin')
     OR public.has_role(auth.uid(), 'supervisor')
     OR public.has_role(auth.uid(), 'registrar'))
    AND facility_id = public.get_user_facility_id(auth.uid())
  )
);

-- Delete: admin/super_admin only
CREATE POLICY "invoices_delete"
ON public.invoices FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER invoices_set_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX invoices_patient_idx ON public.invoices(patient_id);
CREATE INDEX invoices_facility_idx ON public.invoices(facility_id);
CREATE INDEX invoices_created_at_idx ON public.invoices(created_at DESC);
