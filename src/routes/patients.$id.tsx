import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { PatientCard } from "@/components/PatientCard";
import { ArrowLeft, Printer, Loader2 } from "lucide-react";

export const Route = createFileRoute("/patients/$id")({ component: PatientDetailPage });

function PatientDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("patients").select("*").eq("id", id).maybeSingle();
      setPatient(data);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <AppLayout title="Patient"><div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></AppLayout>;
  if (!patient) return <AppLayout title="Not found"><p className="text-muted-foreground">Patient not found.</p></AppLayout>;

  return (
    <AppLayout title={`${patient.first_name} ${patient.last_name}`}>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Button variant="ghost" onClick={() => navigate({ to: "/patients" })} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to records
        </Button>
        <Button onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" /> Print Card
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        <Card className="print:hidden">
          <CardContent className="space-y-4 p-6 text-sm">
            <Section title="Identity">
              <Row k="Patient ID" v={patient.patient_code} />
              <Row k="Full name" v={`${patient.first_name} ${patient.middle_name ?? ""} ${patient.last_name}`} />
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
              <Row k="Fingerprint" v={patient.fingerprint_captured ? "Enrolled" : "Not captured"} />
              <Row k="Signature" v={patient.signature_url ? "On file" : "—"} />
              <Row k="Photo" v={patient.photo_url ? "On file" : "—"} />
            </Section>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <PatientCard patient={patient} />
          {patient.signature_url && (
            <div className="rounded-lg border bg-white p-3 print:hidden">
              <p className="mb-1 text-xs text-muted-foreground">Signature on file</p>
              <img src={patient.signature_url} alt="signature" className="h-20 object-contain" />
            </div>
          )}
        </div>
      </div>
    </AppLayout>
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
