
-- Helper function: get user's facility id
CREATE OR REPLACE FUNCTION public.get_user_facility_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT facility_id FROM public.profiles WHERE id = _user_id
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_facility_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_facility_id(uuid) TO authenticated, service_role;

-- Lock down handle_new_user (trigger only)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- has_role: keep available to authenticated (used in RLS), block anon
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

-- generate_patient_code: restrict
REVOKE EXECUTE ON FUNCTION public.generate_patient_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_patient_code() TO authenticated, service_role;

-- ============ PATIENTS ============
DROP POLICY IF EXISTS patients_select_authenticated ON public.patients;
CREATE POLICY patients_select_scoped ON public.patients FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (facility_id IS NOT NULL AND facility_id = public.get_user_facility_id(auth.uid()))
  OR registered_by = auth.uid()
);

DROP POLICY IF EXISTS patients_update_admin ON public.patients;
CREATE POLICY patients_update_scoped ON public.patients FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'registrar'::app_role) AND (registered_by = auth.uid() OR facility_id = public.get_user_facility_id(auth.uid())))
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'registrar'::app_role) AND (registered_by = auth.uid() OR facility_id = public.get_user_facility_id(auth.uid())))
);

-- ============ PROFILES ============
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
CREATE POLICY profiles_select_scoped ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (facility_id IS NOT NULL AND facility_id = public.get_user_facility_id(auth.uid()))
);

-- ============ FACILITIES ============
DROP POLICY IF EXISTS facilities_select_auth ON public.facilities;
CREATE POLICY facilities_select_scoped ON public.facilities FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR id = public.get_user_facility_id(auth.uid())
);

-- ============ LICENSE KEYS ============
DROP POLICY IF EXISTS license_select_authenticated ON public.license_keys;
CREATE POLICY license_select_admin ON public.license_keys FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============ STORAGE: patient-media ============
DROP POLICY IF EXISTS patient_media_insert ON storage.objects;
DROP POLICY IF EXISTS patient_media_insert_authenticated ON storage.objects;
DROP POLICY IF EXISTS patient_media_read_authenticated ON storage.objects;
DROP POLICY IF EXISTS patient_media_select ON storage.objects;
DROP POLICY IF EXISTS patient_media_update ON storage.objects;
DROP POLICY IF EXISTS patient_media_update_authenticated ON storage.objects;

CREATE POLICY patient_media_select ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'patient-media'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'registrar'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
  )
);

CREATE POLICY patient_media_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'patient-media'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'registrar'::app_role)
  )
);

CREATE POLICY patient_media_update ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'patient-media'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'registrar'::app_role) AND owner = auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'patient-media'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'registrar'::app_role) AND owner = auth.uid())
  )
);
