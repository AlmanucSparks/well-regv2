
-- Roles enum and table
CREATE TYPE public.app_role AS ENUM ('admin', 'registrar', 'supervisor');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  phone TEXT,
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_code TEXT UNIQUE NOT NULL,
  -- personal
  title TEXT,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender TEXT NOT NULL,
  marital_status TEXT,
  religion TEXT,
  blood_group TEXT,
  occupation TEXT,
  employer TEXT,
  -- contact
  primary_phone TEXT NOT NULL,
  secondary_phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  region TEXT,
  country TEXT,
  postal_code TEXT,
  -- identity
  nationality TEXT,
  country_of_birth TEXT,
  place_of_birth TEXT,
  id_document_type TEXT,
  id_number TEXT UNIQUE,
  id_issue_date DATE,
  id_expiry_date DATE,
  ethnicity TEXT,
  disability_status TEXT,
  allergies TEXT,
  -- next of kin
  nok_name TEXT,
  nok_relationship TEXT,
  nok_phone TEXT,
  nok_secondary_phone TEXT,
  nok_email TEXT,
  nok_address TEXT,
  nok_city TEXT,
  nok_country TEXT,
  nok2 JSONB,
  -- medical
  primary_doctor TEXT,
  referring_institution TEXT,
  medical_conditions TEXT,
  current_medications TEXT,
  past_surgeries TEXT,
  smoking_status TEXT,
  alcohol_use TEXT,
  insurance_provider TEXT,
  insurance_policy_number TEXT,
  -- media
  photo_url TEXT,
  signature_url TEXT,
  fingerprint_captured BOOLEAN NOT NULL DEFAULT false,
  -- meta
  status TEXT NOT NULL DEFAULT 'active',
  registered_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_patients_created_at ON public.patients(created_at DESC);
CREATE INDEX idx_patients_name ON public.patients(last_name, first_name);

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_created_at ON public.audit_logs(created_at DESC);

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

-- Security definer helper
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "profiles_select_authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_self_or_admin" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_insert_self" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- User roles
CREATE POLICY "user_roles_select_self_or_admin" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Patients
CREATE POLICY "patients_select_authenticated" ON public.patients
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "patients_insert_admin_or_registrar" ON public.patients
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'registrar')
  );
CREATE POLICY "patients_update_admin" ON public.patients
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "patients_delete_admin" ON public.patients
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Audit logs
CREATE POLICY "audit_select_admin" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "audit_insert_authenticated" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Auto-create profile + first user becomes admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count <= 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'registrar');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Patient code generator: MR-YYYY-XXXXXX
CREATE OR REPLACE FUNCTION public.generate_patient_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  new_code TEXT;
BEGIN
  new_code := 'MR-' || to_char(now(), 'YYYY') || '-' || lpad(floor(random()*1000000)::text, 6, '0');
  RETURN new_code;
END;
$$;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER patients_updated_at BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage bucket for patient photos (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('patient-media', 'patient-media', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "patient_media_read_authenticated" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'patient-media');
CREATE POLICY "patient_media_insert_authenticated" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'patient-media');
CREATE POLICY "patient_media_update_authenticated" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'patient-media');
