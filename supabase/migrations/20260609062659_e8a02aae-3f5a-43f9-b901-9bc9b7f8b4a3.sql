
CREATE TABLE public.patient_visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL,
  visit_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT NOT NULL,
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX patient_visits_patient_idx ON public.patient_visits(patient_id, visit_date DESC);
CREATE INDEX patient_visits_facility_idx ON public.patient_visits(facility_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_visits TO authenticated;
GRANT ALL ON public.patient_visits TO service_role;

ALTER TABLE public.patient_visits ENABLE ROW LEVEL SECURITY;

-- Select: super_admin sees all, otherwise visit must belong to a patient in user's facility OR recorded by them
CREATE POLICY visits_select_scoped ON public.patient_visits
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR recorded_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = patient_visits.patient_id
    AND (
      p.facility_id = public.get_user_facility_id(auth.uid())
      OR p.registered_by = auth.uid()
    )
  )
);

-- Insert: admins, super_admins, supervisors, registrars
CREATE POLICY visits_insert_staff ON public.patient_visits
FOR INSERT TO authenticated
WITH CHECK (
  recorded_by = auth.uid()
  AND (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
    OR public.has_role(auth.uid(), 'registrar'::app_role)
  )
);

-- Update/Delete: admin/super_admin only
CREATE POLICY visits_update_admin ON public.patient_visits
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY visits_delete_admin ON public.patient_visits
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));
