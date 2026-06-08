import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, Save, Trash2 } from "lucide-react";
import { WebcamCapture } from "@/components/biometrics/WebcamCapture";
import { SignaturePad } from "@/components/biometrics/SignaturePad";
import { FingerprintCapture } from "@/components/biometrics/FingerprintCapture";
import { useFacilities } from "@/lib/use-facilities";

export const Route = createFileRoute("/register-patient")({ component: RegisterPatientPage });

const STEPS = ["Personal", "Contact", "Identity", "Next of Kin", "Medical", "Biometrics", "Review"] as const;

type FormState = Record<string, any>;

function newPatientCode() {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 1000000).toString().padStart(6, "0");
  return `MR-${year}-${rand}`;
}

const initial: FormState = {
  title: "Mr",
  facility_id: "",
  first_name: "",
  middle_name: "",
  last_name: "",
  date_of_birth: "",
  gender: "Male",
  marital_status: "Single",
  religion: "Prefer not to say",
  blood_group: "O+",
  occupation: "",
  employer: "",
  primary_phone: "",
  secondary_phone: "",
  email: "",
  address: "",
  city: "",
  region: "",
  country: "",
  postal_code: "",
  nationality: "",
  country_of_birth: "",
  place_of_birth: "",
  id_document_type: "National ID",
  id_number: "",
  id_issue_date: "",
  id_expiry_date: "",
  allergies: "",
  nok_name: "",
  nok_relationship: "Spouse",
  nok_phone: "",
  nok_address: "",
  nok_city: "",
  nok_country: "",
  primary_doctor: "",
  medical_conditions: "",
  current_medications: "",
  smoking_status: "Non-smoker",
  alcohol_use: "None",
  insurance_provider: "",
  photo_url: "",
  signature_url: "",
  fingerprints: {} as Record<string, string>,
};

function RegisterPatientPage() {
  const { user, facilityId: userFacilityId, isAdmin, isSupervisor } = useAuth();
  const navigate = useNavigate();
  const { facilities } = useFacilities();
  const draftKey = user ? `medireg:patient-draft:${user.id}` : "medireg:patient-draft:anon";

  const [step, setStep] = useState(0);
  const [patientCode, setPatientCode] = useState<string>(newPatientCode);
  const [form, setForm] = useState<FormState>(initial);
  const [confirmed, setConfirmed] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ code: string; name: string; id: string } | null>(null);

  // Auto-select facility for non-admin users (or when they have one assigned)
  useEffect(() => {
    if (!draftLoaded) return;
    if (!form.facility_id && userFacilityId) {
      setForm((f) => ({ ...f, facility_id: userFacilityId }));
    }
  }, [draftLoaded, userFacilityId, form.facility_id]);

  // Restore draft on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          form: FormState; step: number; patientCode: string; savedAt: string;
        };
        setForm({ ...initial, ...parsed.form });
        setStep(parsed.step ?? 0);
        if (parsed.patientCode) setPatientCode(parsed.patientCode);
        setSavedAt(parsed.savedAt ? new Date(parsed.savedAt) : null);
        toast.info("Resumed your saved draft");
      }
    } catch { /* ignore */ }
    setDraftLoaded(true);
  }, [draftKey]);

  // Autosave on changes (debounced)
  useEffect(() => {
    if (!draftLoaded || success) return;
    const t = setTimeout(() => {
      try {
        const stamp = new Date();
        // Exclude sensitive PII from the local draft to avoid persisting it unencrypted.
        const {
          id_number, fingerprints, fingerprint_template, photo_url, signature_url,
          medical_conditions, current_medications, allergies, insurance_policy_number,
          ...safeForm
        } = form as any;
        localStorage.setItem(
          draftKey,
          JSON.stringify({ form: safeForm, step, patientCode, savedAt: stamp.toISOString() }),
        );
        setSavedAt(stamp);
      } catch { /* quota etc. */ }
    }, 600);
    return () => clearTimeout(t);
  }, [form, step, patientCode, draftLoaded, draftKey, success]);

  function discardDraft() {
    try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
    setForm(initial);
    setStep(0);
    setPatientCode(newPatientCode());
    setSavedAt(null);
    setConfirmed(false);
    toast.success("Draft cleared");
  }

  const progress = useMemo(() => ((step + 1) / STEPS.length) * 100, [step]);
  const set = (k: string) => (v: any) => setForm((f) => ({ ...f, [k]: v }));

  function validateStep(): string | null {
    if (step === 0) {
      if (!form.first_name || !form.last_name) return "First and last name are required.";
      if (!form.date_of_birth) return "Date of birth is required.";
      const dob = new Date(form.date_of_birth);
      if (dob > new Date()) return "Date of birth cannot be in the future.";
      if (!form.facility_id) return "Please select a facility.";
    }
    if (step === 1) {
      if (!/^[0-9]{10,15}$/.test(form.primary_phone)) return "Primary phone must be 10–15 digits.";
      if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) return "Invalid email format.";
    }
    if (step === 2) {
      if (!form.nationality) return "Nationality is required.";
      if (!form.id_number || form.id_number.length < 5) return "ID number must be at least 5 characters.";
    }
    if (step === 3) {
      if (!form.nok_name || !form.nok_phone) return "Next of kin name and phone are required.";
    }
    return null;
  }

  function next() {
    const err = validateStep();
    if (err) { toast.error(err); return; }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function back() { setStep((s) => Math.max(s - 1, 0)); }

  async function submit() {
    if (!confirmed) { toast.error("Please confirm the information is correct."); return; }
    setSubmitting(true);
    try {
      const { data: dup } = await supabase
        .from("patients").select("id").eq("id_number", form.id_number).maybeSingle();
      if (dup) { toast.error("This ID number is already registered."); return; }

      const { fingerprints, ...rest } = form;
      const fp = (fingerprints ?? {}) as Record<string, string>;
      const enrolledCount = Object.keys(fp).length;
      // Normalize empty date strings to null (Postgres date columns reject "")
      const dateFields = ["date_of_birth", "id_issue_date", "id_expiry_date"] as const;
      const cleaned: Record<string, any> = { ...rest };
      for (const k of Object.keys(cleaned)) {
        if (cleaned[k] === "") cleaned[k] = null;
      }
      for (const d of dateFields) {
        if (!cleaned[d]) cleaned[d] = null;
      }
      const payload: any = {
        ...cleaned,
        patient_code: patientCode,
        registered_by: user!.id,
        fingerprints: enrolledCount > 0 ? fp : null,
        fingerprint_template: fp.index ?? null,
        fingerprint_captured: enrolledCount > 0,
        photo_url: form.photo_url || null,
        signature_url: form.signature_url || null,
      };

      const { data: inserted, error } = await supabase.from("patients").insert(payload).select("id").single();
      if (error) throw error;

      await supabase.from("audit_logs").insert({
        user_id: user!.id,
        action: "patient.create",
        entity_type: "patient",
        entity_id: patientCode,
      });

      setSuccess({ code: patientCode, name: `${form.first_name} ${form.last_name}`, id: inserted.id });
      try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
    } catch (e: any) {
      toast.error(e.message ?? "Failed to register patient");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <AppLayout title="Registration Complete">
        <Card className="mx-auto max-w-2xl">
          <CardContent className="space-y-6 p-10 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/15">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold">{success.name} registered</h2>
              <p className="mt-1 text-sm text-muted-foreground">A patient ID has been generated.</p>
            </div>
            <div className="rounded-lg bg-primary-soft px-6 py-4 font-mono text-2xl text-primary">{success.code}</div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => navigate({ to: "/patients/$id", params: { id: success.id } })}>
                Open Patient Card
              </Button>
              <Button variant="outline" onClick={() => window.location.reload()}>Register Another</Button>
              <Button variant="ghost" onClick={() => navigate({ to: "/patients" })}>View Records</Button>
            </div>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Register Patient">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-medium text-primary">Step {step + 1} of {STEPS.length}: {STEPS[step]}</span>
            <span className="text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Save className="h-3 w-3" />
              {savedAt ? `Draft auto-saved · ${savedAt.toLocaleTimeString()}` : "Draft will auto-save"}
              <button
                type="button"
                onClick={discardDraft}
                className="ml-2 inline-flex items-center gap-1 rounded-sm border border-transparent px-1 py-0.5 hover:border-destructive/30 hover:text-destructive"
                title="Discard draft and start over"
              >
                <Trash2 className="h-3 w-3" /> Discard
              </button>
            </span>
            <span className="font-mono">Draft ID: {patientCode}</span>
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            {step === 0 && <PersonalStep form={form} set={set} facilities={facilities} lockFacility={!isAdmin && !isSupervisor && !!userFacilityId} />}
            {step === 1 && <ContactStep form={form} set={set} />}
            {step === 2 && <IdentityStep form={form} set={set} />}
            {step === 3 && <NokStep form={form} set={set} />}
            {step === 4 && <MedicalStep form={form} set={set} />}
            {step === 5 && <BiometricsStep form={form} set={set} patientCode={patientCode} />}
            {step === 6 && (
              <ReviewStep form={form} confirmed={confirmed} setConfirmed={setConfirmed} />
            )}
          </CardContent>
        </Card>

        <div className="mt-6 flex justify-between">
          <Button variant="outline" onClick={back} disabled={step === 0}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next}>Next <ChevronRight className="ml-1 h-4 w-4" /></Button>
          ) : (
            <Button onClick={submit} disabled={submitting || !confirmed}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Submit Registration
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function Field({ label, children, optional }: { label: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">
        {label} {optional && <span className="text-muted-foreground">(optional)</span>}
      </Label>
      {children}
    </div>
  );
}

function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function PersonalStep({ form, set, facilities, lockFacility }: any) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Facility">
          <Select value={form.facility_id || ""} onValueChange={set("facility_id")} disabled={lockFacility}>
            <SelectTrigger><SelectValue placeholder={facilities?.length ? "Select facility" : "No facilities available — add one in Settings"} /></SelectTrigger>
            <SelectContent>
              {(facilities ?? []).map((f: any) => (
                <SelectItem key={f.id} value={f.id}>{f.name}{f.code ? ` (${f.code})` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Title"><Sel value={form.title} onChange={set("title")} options={["Mr","Mrs","Miss","Dr","Prof","Rev","Other"]} /></Field>
      <Field label="First name"><Input value={form.first_name} onChange={(e) => set("first_name")(e.target.value)} maxLength={50} /></Field>
      <Field label="Middle name" optional><Input value={form.middle_name} onChange={(e) => set("middle_name")(e.target.value)} maxLength={50} /></Field>
      <Field label="Last name"><Input value={form.last_name} onChange={(e) => set("last_name")(e.target.value)} maxLength={50} /></Field>
      <Field label="Date of birth"><Input type="date" value={form.date_of_birth} onChange={(e) => set("date_of_birth")(e.target.value)} /></Field>
      <Field label="Gender"><Sel value={form.gender} onChange={set("gender")} options={["Male","Female","Other"]} /></Field>
      <Field label="Marital status"><Sel value={form.marital_status} onChange={set("marital_status")} options={["Single","Married","Divorced","Widowed","Separated"]} /></Field>
      <Field label="Religion"><Sel value={form.religion} onChange={set("religion")} options={["Christianity","Islam","Hinduism","Buddhism","Traditional","Other","Prefer not to say"]} /></Field>
      <Field label="Blood group"><Sel value={form.blood_group} onChange={set("blood_group")} options={["A+","A-","B+","B-","AB+","AB-","O+","O-"]} /></Field>
      <Field label="Occupation"><Input value={form.occupation} onChange={(e) => set("occupation")(e.target.value)} maxLength={100} /></Field>
      <Field label="Employer / School" optional><Input value={form.employer} onChange={(e) => set("employer")(e.target.value)} /></Field>
    </div>
  );
}

function ContactStep({ form, set }: any) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Primary phone"><Input value={form.primary_phone} onChange={(e) => set("primary_phone")(e.target.value.replace(/\D/g,""))} maxLength={15} /></Field>
      <Field label="Secondary phone" optional><Input value={form.secondary_phone} onChange={(e) => set("secondary_phone")(e.target.value.replace(/\D/g,""))} maxLength={15} /></Field>
      <Field label="Email" optional><Input type="email" value={form.email} onChange={(e) => set("email")(e.target.value)} /></Field>
      <Field label="Postal code" optional><Input value={form.postal_code} onChange={(e) => set("postal_code")(e.target.value)} /></Field>
      <div className="sm:col-span-2"><Field label="Address"><Input value={form.address} onChange={(e) => set("address")(e.target.value)} maxLength={200} /></Field></div>
      <Field label="City / Town"><Input value={form.city} onChange={(e) => set("city")(e.target.value)} /></Field>
      <Field label="Region / State"><Input value={form.region} onChange={(e) => set("region")(e.target.value)} /></Field>
      <Field label="Country"><Input value={form.country} onChange={(e) => set("country")(e.target.value)} /></Field>
    </div>
  );
}

function IdentityStep({ form, set }: any) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Nationality"><Input value={form.nationality} onChange={(e) => set("nationality")(e.target.value)} /></Field>
      <Field label="Country of birth"><Input value={form.country_of_birth} onChange={(e) => set("country_of_birth")(e.target.value)} /></Field>
      <Field label="Place of birth"><Input value={form.place_of_birth} onChange={(e) => set("place_of_birth")(e.target.value)} /></Field>
      <Field label="ID document type"><Sel value={form.id_document_type} onChange={set("id_document_type")} options={["National ID","Passport","Driver's License","Birth Certificate","Alien ID","Other"]} /></Field>
      <Field label="ID number"><Input value={form.id_number} onChange={(e) => set("id_number")(e.target.value.replace(/\s/g,""))} maxLength={30} /></Field>
      <Field label="ID issue date"><Input type="date" value={form.id_issue_date} onChange={(e) => set("id_issue_date")(e.target.value)} /></Field>
      <Field label="ID expiry date" optional><Input type="date" value={form.id_expiry_date} onChange={(e) => set("id_expiry_date")(e.target.value)} /></Field>
      <div className="sm:col-span-2"><Field label="Known allergies" optional><Textarea value={form.allergies} onChange={(e) => set("allergies")(e.target.value)} maxLength={500} /></Field></div>
    </div>
  );
}

function NokStep({ form, set }: any) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Next of kin name"><Input value={form.nok_name} onChange={(e) => set("nok_name")(e.target.value)} /></Field>
      <Field label="Relationship"><Sel value={form.nok_relationship} onChange={set("nok_relationship")} options={["Spouse","Parent","Child","Sibling","Guardian","Friend","Other"]} /></Field>
      <Field label="Phone"><Input value={form.nok_phone} onChange={(e) => set("nok_phone")(e.target.value.replace(/\D/g,""))} maxLength={15} /></Field>
      <Field label="City"><Input value={form.nok_city} onChange={(e) => set("nok_city")(e.target.value)} /></Field>
      <div className="sm:col-span-2"><Field label="Address"><Input value={form.nok_address} onChange={(e) => set("nok_address")(e.target.value)} /></Field></div>
      <Field label="Country"><Input value={form.nok_country} onChange={(e) => set("nok_country")(e.target.value)} /></Field>
    </div>
  );
}

function MedicalStep({ form, set }: any) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Primary doctor" optional><Input value={form.primary_doctor} onChange={(e) => set("primary_doctor")(e.target.value)} /></Field>
      <Field label="Insurance provider" optional><Input value={form.insurance_provider} onChange={(e) => set("insurance_provider")(e.target.value)} /></Field>
      <Field label="Smoking status" optional><Sel value={form.smoking_status} onChange={set("smoking_status")} options={["Non-smoker","Former smoker","Current smoker"]} /></Field>
      <Field label="Alcohol use" optional><Sel value={form.alcohol_use} onChange={set("alcohol_use")} options={["None","Occasional","Regular"]} /></Field>
      <div className="sm:col-span-2"><Field label="Existing conditions" optional><Textarea value={form.medical_conditions} onChange={(e) => set("medical_conditions")(e.target.value)} /></Field></div>
      <div className="sm:col-span-2"><Field label="Current medications" optional><Textarea value={form.current_medications} onChange={(e) => set("current_medications")(e.target.value)} /></Field></div>
    </div>
  );
}

function BiometricsStep({ form, set, patientCode }: any) {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-primary">Patient Photo</h3>
        <p className="mb-3 text-xs text-muted-foreground">Use the device camera to capture a clear ID photo.</p>
        <WebcamCapture patientCode={patientCode} initialUrl={form.photo_url || null} onCaptured={(url) => set("photo_url")(url)} />
      </div>
      <div className="border-t pt-6">
        <h3 className="mb-2 text-sm font-semibold text-primary">Right Hand Fingerprints</h3>
        <p className="mb-3 text-xs text-muted-foreground">Capture all five fingers of the patient's right hand. Software enrollment — swap for hardware SDK when a scanner is connected.</p>
        <FingerprintCapture initial={form.fingerprints || null} onChange={(t) => set("fingerprints")(t)} />
      </div>
      <div className="border-t pt-6">
        <h3 className="mb-2 text-sm font-semibold text-primary">Signature</h3>
        <p className="mb-3 text-xs text-muted-foreground">Patient must sign to consent to data processing.</p>
        <SignaturePad patientCode={patientCode} initialUrl={form.signature_url || null} onSaved={(url) => set("signature_url")(url)} />
      </div>
    </div>
  );
}

function ReviewStep({ form, confirmed, setConfirmed }: any) {
  const sections: [string, string[]][] = [
    ["Personal", ["title","first_name","middle_name","last_name","date_of_birth","gender","marital_status","blood_group","occupation"]],
    ["Contact", ["primary_phone","email","address","city","country"]],
    ["Identity", ["nationality","id_document_type","id_number"]],
    ["Next of Kin", ["nok_name","nok_relationship","nok_phone"]],
  ];
  return (
    <div className="space-y-6">
      {sections.map(([name, keys]) => (
        <div key={name}>
          <h3 className="mb-2 text-sm font-semibold text-primary">{name}</h3>
          <div className="grid gap-x-6 gap-y-2 rounded-md border bg-muted/30 p-4 text-sm sm:grid-cols-2">
            {keys.map((k) => (
              <div key={k} className="flex justify-between gap-4">
                <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                <span className="font-medium">{form[k] || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-primary">Biometrics</h3>
        <div className="grid gap-2 rounded-md border bg-muted/30 p-4 text-sm sm:grid-cols-3">
          <Badge label="Photo" ok={!!form.photo_url} />
          <Badge label="Fingerprint" ok={!!form.fingerprint_template} />
          <Badge label="Signature" ok={!!form.signature_url} />
        </div>
      </div>
      <label className="flex items-start gap-3 rounded-md border bg-primary-soft/50 p-4">
        <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(Boolean(v))} className="mt-0.5" />
        <span className="text-sm">I confirm all information entered is correct and complete.</span>
      </label>
    </div>
  );
}

function Badge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className={`flex items-center justify-between rounded-md border px-3 py-2 ${ok ? "border-success/30 bg-success/10 text-success-foreground" : "border-muted bg-muted/40 text-muted-foreground"}`}>
      <span className="text-xs">{label}</span>
      <span className="text-xs font-semibold">{ok ? "✓ Captured" : "Skipped"}</span>
    </div>
  );
}
