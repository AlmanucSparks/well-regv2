import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { PatientCard } from "@/components/PatientCard";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Printer, Loader2, Fingerprint, FileDown } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { downloadPatientPdf, printPatientDocument } from "@/lib/patient-document";

export const Route = createFileRoute("/patients/$id")({ component: PatientDetailPage });

const FINGERS = ["thumb", "index", "middle", "ring", "little"] as const;
const FINGER_LABEL: Record<string, string> = {
  thumb: "Thumb",
  index: "Index",
  middle: "Middle",
  ring: "Ring",
  little: "Little",
};

function PatientDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"card" | "full">("full");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("patients").select("*").eq("id", id).maybeSingle();
      setPatient(data);
      setLoading(false);
    })();
  }, [id]);

  if (loading)
    return (
      <AppLayout title="Patient">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  if (!patient)
    return (
      <AppLayout title="Not found">
        <p className="text-muted-foreground">Patient not found.</p>
      </AppLayout>
    );

  const fullName = [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(" ");
  const fps = (patient.fingerprints ?? {}) as Record<string, string>;

  function printCard() {
    setMode("card");
    setTimeout(() => window.print(), 50);
  }
  function printFull() {
    try {
      printPatientDocument(patient);
    } catch (e: any) {
      toast.error(e?.message ?? "Print failed");
    }
  }
  async function downloadPdf() {
    setDownloading(true);
    try {
      await downloadPatientPdf(patient);
      toast.success("PDF downloaded");
    } catch (e: any) {
      toast.error(e?.message ?? "PDF generation failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <AppLayout title={fullName}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 no-print">
        <Button variant="ghost" onClick={() => navigate({ to: "/patients" })} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to records
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={printCard} className="gap-2">
            <Printer className="h-4 w-4" /> Print ID Card
          </Button>
          <Button variant="outline" onClick={printFull} className="gap-2">
            <Printer className="h-4 w-4" /> Print Full Document
          </Button>
          <Button onClick={downloadPdf} disabled={downloading} className="gap-2">
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Download PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_auto] no-print">
        <Card>
          <CardContent className="space-y-4 p-6 text-sm">
            <Section title="Identity">
              <Row k="Patient ID" v={patient.patient_code} />
              <Row k="Full name" v={fullName} />
              <Row k="DOB" v={patient.date_of_birth} />
              <Row k="Gender" v={patient.gender} />
              <Row k="Blood group" v={patient.blood_group ?? "—"} />
              <Row k="Nationality" v={patient.nationality ?? "—"} />
              <Row k="ID number" v={patient.id_number ?? "—"} />
            </Section>
            <Section title="Contact">
              <Row k="Phone" v={patient.primary_phone} />
              <Row k="Email" v={patient.email ?? "—"} />
              <Row k="Address" v={`${patient.address ?? ""}, ${patient.city ?? ""} ${patient.country ?? ""}`} />
            </Section>
            <Section title="Next of Kin">
              <Row k="Name" v={patient.nok_name ?? "—"} />
              <Row k="Relationship" v={patient.nok_relationship ?? "—"} />
              <Row k="Phone" v={patient.nok_phone ?? "—"} />
            </Section>
            <Section title="Medical">
              <Row k="Allergies" v={patient.allergies ?? "None"} />
              <Row k="Conditions" v={patient.medical_conditions ?? "None"} />
              <Row k="Medications" v={patient.current_medications ?? "None"} />
            </Section>
            <Section title="Biometrics">
              <Row k="Fingers enrolled" v={`${Object.keys(fps).length} / 5`} />
              <Row k="Signature" v={patient.signature_url ? "On file" : "—"} />
              <Row k="Photo" v={patient.photo_url ? "On file" : "—"} />
            </Section>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <PatientCard patient={patient} />
          {patient.signature_url && (
            <div className="rounded-lg border bg-white p-3">
              <p className="mb-1 text-xs text-muted-foreground">Signature on file</p>
              <img src={patient.signature_url} alt="signature" className="h-20 object-contain" />
            </div>
          )}
        </div>
      </div>

      {/* PRINT SURFACE for ID Card (browser print). Full document uses pop-up. */}
      {mode === "card" && (
        <div className="print-area hidden print:block">
          <div className="patient-card mx-auto">
            <PatientCard patient={patient} />
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function FullDocument({ patient, fingerprints, fullName }: { patient: any; fingerprints: Record<string, string>; fullName: string }) {
  const qrPayload = JSON.stringify({ id: patient.patient_code, n: fullName, dob: patient.date_of_birth });
  return (
    <div className="text-[11px] text-slate-900">
      <header className="mb-4 flex items-center justify-between border-b-2 border-slate-900 pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">MediReg Patient Record</h1>
          <p className="text-[10px] uppercase tracking-wider text-slate-600">
            Confidential medical document · Generated {format(new Date(), "PPpp")}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm font-bold">{patient.patient_code}</p>
          <p className="text-[10px] text-slate-600">Issued {format(new Date(patient.created_at), "PP")}</p>
        </div>
      </header>

      <section className="mb-4 grid grid-cols-[110px_1fr_120px] gap-4">
        <div className="h-32 w-28 overflow-hidden rounded border border-slate-400 bg-slate-100">
          {patient.photo_url ? (
            <img src={patient.photo_url} alt={fullName} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[9px] text-slate-500">No Photo</div>
          )}
        </div>
        <div>
          <h2 className="text-base font-bold">{fullName}</h2>
          <p className="text-[10px] text-slate-600">{patient.title} · {patient.gender} · {patient.blood_group ?? "—"} · DOB {patient.date_of_birth}</p>
          <table className="mt-2 w-full">
            <tbody>
              <PRow k="Nationality" v={patient.nationality} />
              <PRow k="ID Document" v={`${patient.id_document_type ?? "—"} · ${patient.id_number ?? "—"}`} />
              <PRow k="Marital Status" v={patient.marital_status} />
              <PRow k="Occupation" v={patient.occupation} />
            </tbody>
          </table>
        </div>
        <div className="flex flex-col items-center justify-start">
          <QRCodeSVG value={qrPayload} size={110} level="M" />
          <p className="mt-1 text-center text-[9px] text-slate-600">Scan for ID</p>
        </div>
      </section>

      <PrintSection title="Contact Information">
        <PRow k="Primary phone" v={patient.primary_phone} />
        <PRow k="Secondary phone" v={patient.secondary_phone} />
        <PRow k="Email" v={patient.email} />
        <PRow k="Address" v={[patient.address, patient.city, patient.region, patient.country, patient.postal_code].filter(Boolean).join(", ")} />
        <PRow k="Place of birth" v={patient.place_of_birth} />
      </PrintSection>

      <PrintSection title="Next of Kin">
        <PRow k="Name" v={patient.nok_name} />
        <PRow k="Relationship" v={patient.nok_relationship} />
        <PRow k="Phone" v={patient.nok_phone} />
        <PRow k="Email" v={patient.nok_email} />
        <PRow k="Address" v={[patient.nok_address, patient.nok_city, patient.nok_country].filter(Boolean).join(", ")} />
      </PrintSection>

      <PrintSection title="Medical History">
        <PRow k="Allergies" v={patient.allergies ?? "None reported"} />
        <PRow k="Existing conditions" v={patient.medical_conditions ?? "None reported"} />
        <PRow k="Current medications" v={patient.current_medications ?? "None reported"} />
        <PRow k="Past surgeries" v={patient.past_surgeries ?? "None reported"} />
        <PRow k="Primary doctor" v={patient.primary_doctor} />
        <PRow k="Insurance" v={[patient.insurance_provider, patient.insurance_policy_number].filter(Boolean).join(" · ")} />
        <PRow k="Smoking" v={patient.smoking_status} />
        <PRow k="Alcohol" v={patient.alcohol_use} />
      </PrintSection>

      <section className="mb-3 rounded border border-slate-400 p-3">
        <h3 className="mb-2 border-b border-slate-300 pb-1 text-[11px] font-bold uppercase tracking-wider">
          Biometric Enrollment — Right Hand
        </h3>
        <div className="grid grid-cols-5 gap-2">
          {FINGERS.map((f) => {
            const t = fingerprints[f];
            return (
              <div key={f} className={`rounded border ${t ? "border-slate-500" : "border-dashed border-slate-300"} p-2 text-center`}>
                <Fingerprint className={`mx-auto h-8 w-8 ${t ? "text-slate-900" : "text-slate-300"}`} />
                <p className="mt-1 text-[10px] font-semibold">{FINGER_LABEL[f]}</p>
                {t ? (
                  <p className="mt-1 break-all font-mono text-[7px] leading-tight text-slate-600">{t.slice(0, 24)}…</p>
                ) : (
                  <p className="mt-1 text-[9px] italic text-slate-400">Not captured</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {patient.signature_url && (
        <section className="mb-3">
          <h3 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-700">Patient Signature</h3>
          <img src={patient.signature_url} alt="signature" className="h-20 rounded border border-slate-400 bg-white object-contain" />
        </section>
      )}

      <footer className="mt-4 border-t border-slate-300 pt-2 text-center text-[8px] text-slate-500">
        This document contains confidential patient data. Handle in accordance with applicable privacy regulations.
        · MediReg · Patient ID {patient.patient_code}
      </footer>
    </div>
  );
}

function PrintSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-3 rounded border border-slate-400 p-3">
      <h3 className="mb-2 border-b border-slate-300 pb-1 text-[11px] font-bold uppercase tracking-wider">{title}</h3>
      <table className="w-full">
        <tbody>{children}</tbody>
      </table>
    </section>
  );
}

function PRow({ k, v }: { k: string; v?: string | null }) {
  return (
    <tr className="align-top">
      <td className="w-[40%] py-0.5 pr-2 text-[10px] text-slate-600">{k}</td>
      <td className="py-0.5 font-medium">{v && String(v).trim() !== "" ? v : "—"}</td>
    </tr>
  );
}

function Section({ title, children }: any) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">{title}</h3>
      <div className="grid gap-1.5 rounded-md border bg-muted/30 p-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
