-- Add fingerprint template storage on patients
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS fingerprint_template text;

-- License keys table
CREATE TABLE public.license_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key text NOT NULL UNIQUE,
  facility_name text NOT NULL,
  max_users integer NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'active',
  activated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  activated_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.license_keys TO authenticated;
GRANT ALL ON public.license_keys TO service_role;

ALTER TABLE public.license_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "license_select_authenticated" ON public.license_keys
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "license_insert_admin" ON public.license_keys
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "license_update_admin" ON public.license_keys
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "license_delete_admin" ON public.license_keys
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_license_updated_at
  BEFORE UPDATE ON public.license_keys
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();