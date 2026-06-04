
-- 1. Facilities table for multi-facility admin
CREATE TABLE public.facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  address text,
  city text,
  country text,
  phone text,
  email text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.facilities TO authenticated;
GRANT ALL ON public.facilities TO service_role;
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY facilities_select_auth ON public.facilities FOR SELECT TO authenticated USING (true);
CREATE POLICY facilities_insert_admin ON public.facilities FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY facilities_update_admin ON public.facilities FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE POLICY facilities_delete_admin ON public.facilities FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE TRIGGER facilities_updated BEFORE UPDATE ON public.facilities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Add facility links + multi-finger column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS facility_id uuid REFERENCES public.facilities(id) ON DELETE SET NULL;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS facility_id uuid REFERENCES public.facilities(id) ON DELETE SET NULL;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS fingerprints jsonb;
ALTER TABLE public.license_keys ADD COLUMN IF NOT EXISTS facility_id uuid REFERENCES public.facilities(id) ON DELETE SET NULL;

-- 3. Seed default facility + license for the admin account
INSERT INTO public.facilities (id, name, code, country, status, created_by)
VALUES ('11111111-1111-1111-1111-111111111111','MediReg Main Clinic','MR-HQ','Global','active','eb47d106-f1f6-482b-a015-863ecb627629')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.license_keys (license_key, facility_name, max_users, status, expires_at, activated_by, facility_id)
VALUES ('MR-YOE0-98YI-4UEW-0UW6','MediReg Main Clinic', 50, 'active', now() + interval '365 days', 'eb47d106-f1f6-482b-a015-863ecb627629','11111111-1111-1111-1111-111111111111')
ON CONFLICT (license_key) DO UPDATE SET status='active', expires_at = excluded.expires_at, facility_id = excluded.facility_id;
