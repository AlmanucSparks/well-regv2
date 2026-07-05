
DO $$ BEGIN
  CREATE TYPE public.lab_order_status AS ENUM ('pending','in_progress','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.lab_fitness AS ENUM ('fit','unfit','pending_review');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.lab_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES public.facilities(id),
  status public.lab_order_status NOT NULL DEFAULT 'pending',
  purpose text DEFAULT 'Overseas Employment Medical',

  hemoglobin_g_dl numeric,
  wbc_count numeric,
  rbc_count numeric,
  platelet_count numeric,
  esr_mm_hr numeric,
  blood_group text,
  rh_factor text,

  fasting_glucose_mg_dl numeric,
  random_glucose_mg_dl numeric,
  urea_mg_dl numeric,
  creatinine_mg_dl numeric,
  uric_acid_mg_dl numeric,
  cholesterol_mg_dl numeric,
  triglycerides_mg_dl numeric,
  hdl_mg_dl numeric,
  ldl_mg_dl numeric,
  sgpt_alt_u_l numeric,
  sgot_ast_u_l numeric,
  bilirubin_mg_dl numeric,
  alkaline_phosphatase_u_l numeric,

  hiv_result text,
  hbsag_result text,
  hcv_result text,
  vdrl_result text,
  tpha_result text,
  malaria_result text,
  filaria_result text,
  leprosy_result text,
  tb_mantoux_result text,

  hcg_pregnancy_result text,

  urine_colour text,
  urine_appearance text,
  urine_ph numeric,
  urine_specific_gravity numeric,
  urine_protein text,
  urine_sugar text,
  urine_ketones text,
  urine_blood text,
  urine_bile text,
  urine_microscopy text,

  stool_ova_parasites text,
  stool_occult_blood text,
  stool_notes text,

  chest_xray_finding text,
  ecg_finding text,

  fitness_verdict public.lab_fitness DEFAULT 'pending_review',
  lab_notes text,

  created_by uuid REFERENCES auth.users(id),
  completed_by uuid REFERENCES auth.users(id),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lab_orders_patient_idx ON public.lab_orders(patient_id);
CREATE INDEX IF NOT EXISTS lab_orders_facility_idx ON public.lab_orders(facility_id);
CREATE INDEX IF NOT EXISTS lab_orders_status_idx ON public.lab_orders(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_orders TO authenticated;
GRANT ALL ON public.lab_orders TO service_role;

ALTER TABLE public.lab_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lab_orders_select" ON public.lab_orders
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    (public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'supervisor')
      OR public.has_role(auth.uid(), 'lab_tech'))
    AND facility_id = public.get_user_facility_id(auth.uid())
  )
);

CREATE POLICY "lab_orders_insert" ON public.lab_orders
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    (public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'supervisor')
      OR public.has_role(auth.uid(), 'lab_tech'))
    AND facility_id = public.get_user_facility_id(auth.uid())
  )
);

CREATE POLICY "lab_orders_update" ON public.lab_orders
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    (public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'supervisor')
      OR public.has_role(auth.uid(), 'lab_tech'))
    AND facility_id = public.get_user_facility_id(auth.uid())
  )
);

CREATE POLICY "lab_orders_delete" ON public.lab_orders
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER lab_orders_set_updated_at
BEFORE UPDATE ON public.lab_orders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
