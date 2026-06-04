GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;
GRANT USAGE ON TYPE public.app_role TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.generate_patient_code() TO authenticated, service_role;