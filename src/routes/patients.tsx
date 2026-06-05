import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { UserPlus, Search, Eye, Printer, FileDown, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import { toast } from "sonner";

export const Route = createFileRoute("/patients")({ component: PatientsPage });

interface Patient {
  id: string;
  patient_code: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  primary_phone: string;
  nationality: string | null;
  created_at: string;
}

function PatientsPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Patient[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function fetchFull(id: string) {
    const { data, error } = await supabase.from("patients").select("*").eq("id", id).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? "Patient not found");
    return data as any;
  }

  function renderText(p: any) {
    const fullName = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ");
    const lines = [
      `MEDIREG PATIENT RECORD`,
      `Generated: ${format(new Date(), "PPpp")}`,
      ``,
      `Patient ID: ${p.patient_code}`,
      `Name: ${fullName}`,
      `DOB: ${p.date_of_birth}   Gender: ${p.gender}   Blood: ${p.blood_group ?? "—"}`,
      `Nationality: ${p.nationality ?? "—"}   ID: ${p.id_document_type ?? "—"} ${p.id_number ?? ""}`,
      ``,
      `— Contact —`,
      `Phone: ${p.primary_phone}${p.secondary_phone ? " / " + p.secondary_phone : ""}`,
      `Email: ${p.email ?? "—"}`,
      `Address: ${[p.address, p.city, p.region, p.country, p.postal_code].filter(Boolean).join(", ") || "—"}`,
      ``,
      `— Next of Kin —`,
      `Name: ${p.nok_name ?? "—"}  (${p.nok_relationship ?? "—"})`,
      `Phone: ${p.nok_phone ?? "—"}   Email: ${p.nok_email ?? "—"}`,
      ``,
      `— Medical —`,
      `Allergies: ${p.allergies ?? "None"}`,
      `Conditions: ${p.medical_conditions ?? "None"}`,
      `Medications: ${p.current_medications ?? "None"}`,
      `Past surgeries: ${p.past_surgeries ?? "None"}`,
      `Primary doctor: ${p.primary_doctor ?? "—"}`,
      `Insurance: ${[p.insurance_provider, p.insurance_policy_number].filter(Boolean).join(" · ") || "—"}`,
      `Smoking: ${p.smoking_status ?? "—"}   Alcohol: ${p.alcohol_use ?? "—"}`,
      ``,
      `Registered: ${format(new Date(p.created_at), "PPpp")}`,
    ];
    return lines;
  }

  async function downloadPdf(id: string) {
    try {
      setBusyId(id);
      const p = await fetchFull(id);
      const pdf = new jsPDF("p", "mm", "a4");
      const lines = renderText(p);
      let y = 15;
      pdf.setFontSize(11);
      for (const ln of lines) {
        const wrapped = pdf.splitTextToSize(ln, 180);
        for (const w of wrapped) {
          if (y > 285) { pdf.addPage(); y = 15; }
          pdf.text(w, 15, y);
          y += 6;
        }
      }
      pdf.save(`${p.patient_code}-${p.first_name}-${p.last_name}.pdf`);
      toast.success("PDF downloaded");
    } catch (e: any) {
      toast.error(e?.message ?? "Download failed");
    } finally {
      setBusyId(null);
    }
  }

  async function printRecord(id: string) {
    try {
      setBusyId(id);
      const p = await fetchFull(id);
      const lines = renderText(p);
      const w = window.open("", "_blank", "width=800,height=900");
      if (!w) { toast.error("Pop-up blocked"); return; }
      const fullName = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ");
      w.document.write(`<!doctype html><html><head><title>${fullName} — ${p.patient_code}</title>
        <style>body{font-family:ui-sans-serif,system-ui;padding:32px;color:#111;font-size:12px;line-height:1.5}
        pre{white-space:pre-wrap;font-family:inherit}h1{margin:0 0 8px;font-size:18px}</style></head><body>
        <pre>${lines.join("\n").replace(/[<>&]/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]!))}</pre>
        <script>window.onload=()=>{window.print();}</script></body></html>`);
      w.document.close();
    } catch (e: any) {
      toast.error(e?.message ?? "Print failed");
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    const t = setTimeout(async () => {
      let query = supabase
        .from("patients")
        .select("id,patient_code,first_name,last_name,date_of_birth,gender,primary_phone,nationality,created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (q.trim()) {
        const s = `%${q.trim()}%`;
        query = query.or(`first_name.ilike.${s},last_name.ilike.${s},patient_code.ilike.${s},primary_phone.ilike.${s}`);
      }
      const { data } = await query;
      setRows((data ?? []) as Patient[]);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <AppLayout title="Patient Records">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, ID, phone…" className="pl-9" />
        </div>
        <Link to="/register-patient">
          <Button className="gap-2"><UserPlus className="h-4 w-4" /> Register New</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No patients found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Patient ID</th>
                    <th className="px-4 py-3">Full Name</th>
                    <th className="px-4 py-3">DOB</th>
                    <th className="px-4 py-3">Gender</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Nationality</th>
                    <th className="px-4 py-3">Registered</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((p) => (
                    <tr key={p.id} className="cursor-pointer hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs">
                        <Link to="/patients/$id" params={{ id: p.id }} className="text-primary hover:underline">
                          {p.patient_code}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link to="/patients/$id" params={{ id: p.id }} className="hover:underline">
                          {p.first_name} {p.last_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.date_of_birth}</td>
                      <td className="px-4 py-3">{p.gender}</td>
                      <td className="px-4 py-3">{p.primary_phone}</td>
                      <td className="px-4 py-3">{p.nationality ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{format(new Date(p.created_at), "PP")}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Link to="/patients/$id" params={{ id: p.id }}>
                            <Button size="sm" variant="ghost" title="View full record"><Eye className="h-4 w-4" /></Button>
                          </Link>
                          <Button size="sm" variant="ghost" title="Print" disabled={busyId === p.id} onClick={() => printRecord(p.id)}>
                            {busyId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                          </Button>
                          <Button size="sm" variant="ghost" title="Download PDF" disabled={busyId === p.id} onClick={() => downloadPdf(p.id)}>
                            {busyId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
