import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Search, FlaskConical, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { format } from "date-fns";

export const Route = createFileRoute("/lab")({ component: LabPage });

interface PatientLite {
  id: string;
  patient_code: string;
  first_name: string;
  last_name: string;
  gender: string;
  date_of_birth: string;
  facility_id: string | null;
}

interface LabOrderRow {
  id: string;
  patient_id: string;
  status: string;
  fitness_verdict: string | null;
  purpose: string | null;
  created_at: string;
  completed_at: string | null;
  patients?: { patient_code: string; first_name: string; last_name: string; gender: string } | null;
}

const SEROLOGY = ["not_done", "negative", "positive", "reactive", "non_reactive"];
const URINE_LEVELS = ["nil", "trace", "1+", "2+", "3+", "4+"];

function num(v: string) { return v === "" ? null : Number(v); }
function txt(v: string) { return v.trim() === "" ? null : v.trim(); }

function LabPage() {
  const { user, loading: authLoading, isAdmin, isSupervisor, isLabTech, isSuperAdmin, facilityId } = useAuth();
  const canAccess = isAdmin || isSupervisor || isLabTech;

  const [tab, setTab] = useState("orders");
  const [orders, setOrders] = useState<LabOrderRow[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<PatientLite[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientLite | null>(null);
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  async function loadOrders() {
    setLoadingOrders(true);
    const { data } = await supabase
      .from("lab_orders")
      .select("id,patient_id,status,fitness_verdict,purpose,created_at,completed_at,patients(patient_code,first_name,last_name,gender)")
      .order("created_at", { ascending: false })
      .limit(100);
    setOrders((data ?? []) as unknown as LabOrderRow[]);
    setLoadingOrders(false);
  }

  useEffect(() => { if (canAccess) loadOrders(); }, [canAccess]);

  useEffect(() => {
    if (tab !== "new") return;
    const t = setTimeout(async () => {
      setLoadingPatients(true);
      let q = supabase
        .from("patients")
        .select("id,patient_code,first_name,last_name,gender,date_of_birth,facility_id")
        .order("created_at", { ascending: false })
        .limit(30);
      const term = query.trim();
      if (term) {
        const like = `%${term}%`;
        q = q.or(`first_name.ilike.${like},last_name.ilike.${like},patient_code.ilike.${like},primary_phone.ilike.${like}`);
      }
      const { data } = await q;
      setPatients((data ?? []) as PatientLite[]);
      setLoadingPatients(false);
    }, 200);
    return () => clearTimeout(t);
  }, [query, tab]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" />;
  if (!canAccess) return <Navigate to="/dashboard" />;

  function openNewFor(p: PatientLite) {
    setSelectedPatient(p);
    setEditOrderId(null);
    setForm({});
  }

  async function openExisting(orderId: string) {
    const { data, error } = await supabase.from("lab_orders").select("*, patients(id,patient_code,first_name,last_name,gender,date_of_birth,facility_id)").eq("id", orderId).maybeSingle();
    if (error || !data) { toast.error("Could not load order"); return; }
    const p = (data as any).patients as PatientLite;
    setSelectedPatient(p);
    setEditOrderId(orderId);
    const initial: Record<string, string> = {};
    Object.entries(data).forEach(([k, v]) => { if (v !== null && v !== undefined && typeof v !== "object") initial[k] = String(v); });
    setForm(initial);
  }

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function save(markCompleted: boolean) {
    if (!selectedPatient) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      patient_id: selectedPatient.id,
      facility_id: selectedPatient.facility_id ?? facilityId,
      purpose: txt(form.purpose ?? "") ?? "Overseas Employment Medical",

      hemoglobin_g_dl: num(form.hemoglobin_g_dl ?? ""),
      wbc_count: num(form.wbc_count ?? ""),
      rbc_count: num(form.rbc_count ?? ""),
      platelet_count: num(form.platelet_count ?? ""),
      esr_mm_hr: num(form.esr_mm_hr ?? ""),
      blood_group: txt(form.blood_group ?? ""),
      rh_factor: txt(form.rh_factor ?? ""),

      fasting_glucose_mg_dl: num(form.fasting_glucose_mg_dl ?? ""),
      random_glucose_mg_dl: num(form.random_glucose_mg_dl ?? ""),
      urea_mg_dl: num(form.urea_mg_dl ?? ""),
      creatinine_mg_dl: num(form.creatinine_mg_dl ?? ""),
      uric_acid_mg_dl: num(form.uric_acid_mg_dl ?? ""),
      cholesterol_mg_dl: num(form.cholesterol_mg_dl ?? ""),
      triglycerides_mg_dl: num(form.triglycerides_mg_dl ?? ""),
      hdl_mg_dl: num(form.hdl_mg_dl ?? ""),
      ldl_mg_dl: num(form.ldl_mg_dl ?? ""),
      sgpt_alt_u_l: num(form.sgpt_alt_u_l ?? ""),
      sgot_ast_u_l: num(form.sgot_ast_u_l ?? ""),
      bilirubin_mg_dl: num(form.bilirubin_mg_dl ?? ""),
      alkaline_phosphatase_u_l: num(form.alkaline_phosphatase_u_l ?? ""),

      hiv_result: txt(form.hiv_result ?? ""),
      hbsag_result: txt(form.hbsag_result ?? ""),
      hcv_result: txt(form.hcv_result ?? ""),
      vdrl_result: txt(form.vdrl_result ?? ""),
      tpha_result: txt(form.tpha_result ?? ""),
      malaria_result: txt(form.malaria_result ?? ""),
      filaria_result: txt(form.filaria_result ?? ""),
      leprosy_result: txt(form.leprosy_result ?? ""),
      tb_mantoux_result: txt(form.tb_mantoux_result ?? ""),
      hcg_pregnancy_result: txt(form.hcg_pregnancy_result ?? ""),

      urine_colour: txt(form.urine_colour ?? ""),
      urine_appearance: txt(form.urine_appearance ?? ""),
      urine_ph: num(form.urine_ph ?? ""),
      urine_specific_gravity: num(form.urine_specific_gravity ?? ""),
      urine_protein: txt(form.urine_protein ?? ""),
      urine_sugar: txt(form.urine_sugar ?? ""),
      urine_ketones: txt(form.urine_ketones ?? ""),
      urine_blood: txt(form.urine_blood ?? ""),
      urine_bile: txt(form.urine_bile ?? ""),
      urine_microscopy: txt(form.urine_microscopy ?? ""),

      stool_ova_parasites: txt(form.stool_ova_parasites ?? ""),
      stool_occult_blood: txt(form.stool_occult_blood ?? ""),
      stool_notes: txt(form.stool_notes ?? ""),

      chest_xray_finding: txt(form.chest_xray_finding ?? ""),
      ecg_finding: txt(form.ecg_finding ?? ""),

      fitness_verdict: txt(form.fitness_verdict ?? "") ?? "pending_review",
      lab_notes: txt(form.lab_notes ?? ""),
      status: markCompleted ? "completed" : "in_progress",
    };
    if (markCompleted) {
      payload.completed_at = new Date().toISOString();
      payload.completed_by = user!.id;
    }

    let orderId = editOrderId;
    let error;
    if (editOrderId) {
      const r = await supabase.from("lab_orders").update(payload as any).eq("id", editOrderId);
      error = r.error;
    } else {
      (payload as any).created_by = user!.id;
      const r = await supabase.from("lab_orders").insert(payload as any).select("id").single();
      error = r.error;
      orderId = r.data?.id ?? null;
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await supabase.from("audit_logs").insert({
      user_id: user!.id,
      action: editOrderId ? "lab.order.update" : "lab.order.create",
      entity_type: "lab_orders",
      entity_id: orderId,
    });
    toast.success(markCompleted ? "Lab order completed" : "Lab order saved");
    setSelectedPatient(null);
    setEditOrderId(null);
    setForm({});
    setTab("orders");
    loadOrders();
  }

  const isFemale = (selectedPatient?.gender ?? "").toLowerCase().startsWith("f");

  return (
    <AppLayout title="Laboratory">
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <FlaskConical className="h-4 w-4" /> Pre-employment / overseas medical panel
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="orders">All Orders</TabsTrigger>
          <TabsTrigger value="new"><Plus className="mr-1 h-4 w-4" />New Lab Order</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {loadingOrders ? (
                <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : orders.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">No lab orders yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Patient</th>
                        <th className="px-4 py-3">Purpose</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Verdict</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {orders.map((o) => (
                        <tr key={o.id}>
                          <td className="px-4 py-3 text-muted-foreground">{format(new Date(o.created_at), "PP")}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{o.patients?.first_name} {o.patients?.last_name}</div>
                            <div className="font-mono text-xs text-muted-foreground">{o.patients?.patient_code}</div>
                          </td>
                          <td className="px-4 py-3">{o.purpose}</td>
                          <td className="px-4 py-3"><Badge variant="outline">{o.status}</Badge></td>
                          <td className="px-4 py-3">
                            {o.fitness_verdict === "fit" && <Badge className="bg-success text-success-foreground">Fit</Badge>}
                            {o.fitness_verdict === "unfit" && <Badge variant="destructive">Unfit</Badge>}
                            {(o.fitness_verdict === "pending_review" || !o.fitness_verdict) && <Badge variant="secondary">Pending</Badge>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button size="sm" variant="outline" onClick={() => openExisting(o.id)}>Open</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="new" className="mt-4">
          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search patient by name, code, or phone" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              {loadingPatients ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : (
                <div className="divide-y rounded-md border">
                  {patients.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No patients found.</p>}
                  {patients.map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <div className="font-medium">{p.first_name} {p.last_name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{p.patient_code} · {p.gender}</div>
                      </div>
                      <Button size="sm" onClick={() => openNewFor(p)}>New Lab Order</Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedPatient} onOpenChange={(o) => { if (!o) { setSelectedPatient(null); setEditOrderId(null); setForm({}); } }}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editOrderId ? "Lab Order" : "New Lab Order"} — {selectedPatient?.first_name} {selectedPatient?.last_name}
              <div className="mt-1 text-xs font-mono text-muted-foreground">{selectedPatient?.patient_code}</div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div>
              <Label>Purpose</Label>
              <Input value={form.purpose ?? "Overseas Employment Medical"} onChange={(e) => set("purpose", e.target.value)} />
            </div>

            <Section title="Hematology (CBC)">
              <Num label="Hemoglobin (g/dL)" k="hemoglobin_g_dl" form={form} set={set} />
              <Num label="WBC (×10³/µL)" k="wbc_count" form={form} set={set} />
              <Num label="RBC (×10⁶/µL)" k="rbc_count" form={form} set={set} />
              <Num label="Platelets (×10³/µL)" k="platelet_count" form={form} set={set} />
              <Num label="ESR (mm/hr)" k="esr_mm_hr" form={form} set={set} />
              <TextIn label="Blood Group" k="blood_group" form={form} set={set} placeholder="A / B / AB / O" />
              <TextIn label="Rh Factor" k="rh_factor" form={form} set={set} placeholder="Positive / Negative" />
            </Section>

            <Section title="Biochemistry">
              <Num label="Fasting Glucose (mg/dL)" k="fasting_glucose_mg_dl" form={form} set={set} />
              <Num label="Random Glucose (mg/dL)" k="random_glucose_mg_dl" form={form} set={set} />
              <Num label="Urea (mg/dL)" k="urea_mg_dl" form={form} set={set} />
              <Num label="Creatinine (mg/dL)" k="creatinine_mg_dl" form={form} set={set} />
              <Num label="Uric Acid (mg/dL)" k="uric_acid_mg_dl" form={form} set={set} />
              <Num label="Cholesterol (mg/dL)" k="cholesterol_mg_dl" form={form} set={set} />
              <Num label="Triglycerides (mg/dL)" k="triglycerides_mg_dl" form={form} set={set} />
              <Num label="HDL (mg/dL)" k="hdl_mg_dl" form={form} set={set} />
              <Num label="LDL (mg/dL)" k="ldl_mg_dl" form={form} set={set} />
              <Num label="SGPT / ALT (U/L)" k="sgpt_alt_u_l" form={form} set={set} />
              <Num label="SGOT / AST (U/L)" k="sgot_ast_u_l" form={form} set={set} />
              <Num label="Bilirubin (mg/dL)" k="bilirubin_mg_dl" form={form} set={set} />
              <Num label="Alkaline Phosphatase (U/L)" k="alkaline_phosphatase_u_l" form={form} set={set} />
            </Section>

            <Section title="Serology / Infectious Diseases">
              <Sero label="HIV I & II" k="hiv_result" form={form} set={set} />
              <Sero label="HBsAg (Hepatitis B)" k="hbsag_result" form={form} set={set} />
              <Sero label="Anti-HCV (Hepatitis C)" k="hcv_result" form={form} set={set} />
              <Sero label="VDRL (Syphilis)" k="vdrl_result" form={form} set={set} />
              <Sero label="TPHA" k="tpha_result" form={form} set={set} />
              <Sero label="Malaria Parasite" k="malaria_result" form={form} set={set} />
              <Sero label="Filaria" k="filaria_result" form={form} set={set} />
              <Sero label="Leprosy Screen" k="leprosy_result" form={form} set={set} />
              <Sero label="TB Mantoux" k="tb_mantoux_result" form={form} set={set} />
            </Section>

            {(isFemale || form.hcg_pregnancy_result) && (
              <Section title="Pregnancy">
                <Sero label="Beta-HCG (Pregnancy)" k="hcg_pregnancy_result" form={form} set={set} />
              </Section>
            )}

            <Section title="Urine Routine">
              <TextIn label="Colour" k="urine_colour" form={form} set={set} />
              <TextIn label="Appearance" k="urine_appearance" form={form} set={set} placeholder="Clear / Turbid" />
              <Num label="pH" k="urine_ph" form={form} set={set} />
              <Num label="Specific Gravity" k="urine_specific_gravity" form={form} set={set} />
              <UrineLevel label="Protein" k="urine_protein" form={form} set={set} />
              <UrineLevel label="Sugar" k="urine_sugar" form={form} set={set} />
              <UrineLevel label="Ketones" k="urine_ketones" form={form} set={set} />
              <UrineLevel label="Blood" k="urine_blood" form={form} set={set} />
              <UrineLevel label="Bile" k="urine_bile" form={form} set={set} />
              <div className="col-span-full">
                <Label>Microscopy notes</Label>
                <Textarea value={form.urine_microscopy ?? ""} onChange={(e) => set("urine_microscopy", e.target.value)} rows={2} />
              </div>
            </Section>

            <Section title="Stool Examination">
              <Sero label="Ova / Parasites" k="stool_ova_parasites" form={form} set={set} />
              <Sero label="Occult Blood" k="stool_occult_blood" form={form} set={set} />
              <div className="col-span-full">
                <Label>Stool notes</Label>
                <Textarea value={form.stool_notes ?? ""} onChange={(e) => set("stool_notes", e.target.value)} rows={2} />
              </div>
            </Section>

            <Section title="Radiology & ECG">
              <div className="col-span-full">
                <Label>Chest X-Ray finding</Label>
                <Textarea value={form.chest_xray_finding ?? ""} onChange={(e) => set("chest_xray_finding", e.target.value)} rows={2} placeholder="e.g. No active pulmonary lesion; TB screening negative" />
              </div>
              <div className="col-span-full">
                <Label>ECG finding</Label>
                <Textarea value={form.ecg_finding ?? ""} onChange={(e) => set("ecg_finding", e.target.value)} rows={2} placeholder="e.g. Normal sinus rhythm" />
              </div>
            </Section>

            <Section title="Verdict">
              <div>
                <Label>Overall Fitness</Label>
                <Select value={form.fitness_verdict ?? "pending_review"} onValueChange={(v) => set("fitness_verdict", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending_review">Pending Review</SelectItem>
                    <SelectItem value="fit">Fit</SelectItem>
                    <SelectItem value="unfit">Unfit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-full">
                <Label>Lab tech notes</Label>
                <Textarea value={form.lab_notes ?? ""} onChange={(e) => set("lab_notes", e.target.value)} rows={3} />
              </div>
            </Section>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="ghost" onClick={() => { setSelectedPatient(null); setEditOrderId(null); setForm({}); }}>Cancel</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => save(false)} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Draft"}
              </Button>
              <Button onClick={() => save(true)} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save & Mark Completed"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">{children}</div>
    </div>
  );
}

function Num({ label, k, form, set }: { label: string; k: string; form: Record<string, string>; set: (k: string, v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type="number" step="0.01" value={form[k] ?? ""} onChange={(e) => set(k, e.target.value)} />
    </div>
  );
}

function TextIn({ label, k, form, set, placeholder }: { label: string; k: string; form: Record<string, string>; set: (k: string, v: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={form[k] ?? ""} onChange={(e) => set(k, e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function Sero({ label, k, form, set }: { label: string; k: string; form: Record<string, string>; set: (k: string, v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Select value={form[k] ?? "not_done"} onValueChange={(v) => set(k, v)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {SEROLOGY.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function UrineLevel({ label, k, form, set }: { label: string; k: string; form: Record<string, string>; set: (k: string, v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Select value={form[k] ?? "nil"} onValueChange={(v) => set(k, v)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {URINE_LEVELS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}