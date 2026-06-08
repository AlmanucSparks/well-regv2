
-- PATIENTS: only super_admin sees all facilities; admin/registrar limited to own facility / own records
DROP POLICY IF EXISTS patients_select_scoped ON public.patients;
CREATE POLICY patients_select_scoped ON public.patients FOR SELECT
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (facility_id IS NOT NULL AND facility_id = public.get_user_facility_id(auth.uid()))
  OR registered_by = auth.uid()
);

DROP POLICY IF EXISTS patients_update_scoped ON public.patients;
CREATE POLICY patients_update_scoped ON public.patients FOR UPDATE
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (public.has_role(auth.uid(), 'admin') AND facility_id = public.get_user_facility_id(auth.uid()))
  OR (public.has_role(auth.uid(), 'registrar') AND (registered_by = auth.uid() OR facility_id = public.get_user_facility_id(auth.uid())))
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR (public.has_role(auth.uid(), 'admin') AND facility_id = public.get_user_facility_id(auth.uid()))
  OR (public.has_role(auth.uid(), 'registrar') AND (registered_by = auth.uid() OR facility_id = public.get_user_facility_id(auth.uid())))
);

DROP POLICY IF EXISTS patients_delete_admin ON public.patients;
CREATE POLICY patients_delete_admin ON public.patients FOR DELETE
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (public.has_role(auth.uid(), 'admin') AND facility_id = public.get_user_facility_id(auth.uid()))
);

-- PROFILES
DROP POLICY IF EXISTS profiles_select_scoped ON public.profiles;
CREATE POLICY profiles_select_scoped ON public.profiles FOR SELECT
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'super_admin')
  OR (facility_id IS NOT NULL AND facility_id = public.get_user_facility_id(auth.uid()))
);

DROP POLICY IF EXISTS profiles_update_self_or_admin ON public.profiles;
CREATE POLICY profiles_update_self_or_admin ON public.profiles FOR UPDATE
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'super_admin')
  OR (public.has_role(auth.uid(), 'admin') AND facility_id = public.get_user_facility_id(auth.uid()))
);

-- FACILITIES: super_admin can manage; others view own
DROP POLICY IF EXISTS facilities_select_scoped ON public.facilities;
CREATE POLICY facilities_select_scoped ON public.facilities FOR SELECT
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR id = public.get_user_facility_id(auth.uid())
);

DROP POLICY IF EXISTS facilities_insert_admin ON public.facilities;
CREATE POLICY facilities_insert_admin ON public.facilities FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS facilities_update_admin ON public.facilities;
CREATE POLICY facilities_update_admin ON public.facilities FOR UPDATE
USING (public.has_role(auth.uid(), 'super_admin') OR (public.has_role(auth.uid(), 'admin') AND id = public.get_user_facility_id(auth.uid())));

DROP POLICY IF EXISTS facilities_delete_admin ON public.facilities;
CREATE POLICY facilities_delete_admin ON public.facilities FOR DELETE
USING (public.has_role(auth.uid(), 'super_admin'));

-- LICENSE KEYS: super_admin exclusive (also legacy admins of license still allowed for their workflow)
DROP POLICY IF EXISTS license_select_admin ON public.license_keys;
CREATE POLICY license_select_admin ON public.license_keys FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS license_insert_admin ON public.license_keys;
CREATE POLICY license_insert_admin ON public.license_keys FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS license_update_admin ON public.license_keys;
CREATE POLICY license_update_admin ON public.license_keys FOR UPDATE
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS license_delete_admin ON public.license_keys;
CREATE POLICY license_delete_admin ON public.license_keys FOR DELETE
USING (public.has_role(auth.uid(), 'super_admin'));

-- USER ROLES: super_admin sees all
DROP POLICY IF EXISTS user_roles_select_self_or_admin ON public.user_roles;
CREATE POLICY user_roles_select_self_or_admin ON public.user_roles FOR SELECT
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'admin')
);

-- AUDIT LOGS
DROP POLICY IF EXISTS audit_select_admin ON public.audit_logs;
CREATE POLICY audit_select_admin ON public.audit_logs FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

-- STAFF INVITES
DROP POLICY IF EXISTS invites_select_admin ON public.staff_invites;
CREATE POLICY invites_select_admin ON public.staff_invites FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS invites_insert_admin ON public.staff_invites;
CREATE POLICY invites_insert_admin ON public.staff_invites FOR INSERT
WITH CHECK ((public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin')) AND invited_by = auth.uid());

DROP POLICY IF EXISTS invites_update_admin ON public.staff_invites;
CREATE POLICY invites_update_admin ON public.staff_invites FOR UPDATE
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS invites_delete_admin ON public.staff_invites;
CREATE POLICY invites_delete_admin ON public.staff_invites FOR DELETE
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

-- PATIENT INSERT: keep admin/registrar; allow super_admin too
DROP POLICY IF EXISTS patients_insert_admin_or_registrar ON public.patients;
CREATE POLICY patients_insert_admin_or_registrar ON public.patients FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'registrar')
);
