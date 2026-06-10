
CREATE TABLE public.patient_vitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES public.facilities(id),
  recorded_by uuid NOT NULL,
  visit_date timestamptz NOT NULL DEFAULT now(),
  bp_systolic integer,
  bp_diastolic integer,
  temperature_c numeric(5,2),
  weight_kg numeric(6,2),
  height_cm numeric(6,2),
  pulse_bpm integer,
  spo2_percent integer,
  respiratory_rate integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX patient_vitals_patient_idx ON public.patient_vitals(patient_id, visit_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_vitals TO authenticated;
GRANT ALL ON public.patient_vitals TO service_role;

ALTER TABLE public.patient_vitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vitals viewable by facility staff or super admin"
ON public.patient_vitals FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR recorded_by = auth.uid()
  OR facility_id = public.get_user_facility_id(auth.uid())
);

CREATE POLICY "Clinical staff can insert vitals"
ON public.patient_vitals FOR INSERT TO authenticated
WITH CHECK (
  recorded_by = auth.uid()
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'nurse')
    OR public.has_role(auth.uid(), 'supervisor')
  )
);

CREATE POLICY "Recorder or admin can update vitals"
ON public.patient_vitals FOR UPDATE TO authenticated
USING (recorded_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can delete vitals"
ON public.patient_vitals FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
