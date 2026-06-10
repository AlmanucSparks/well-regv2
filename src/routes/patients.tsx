import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { UserPlus, Search, Eye, Printer, FileDown, Loader2, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { downloadPatientPdf, printPatientDocument } from "@/lib/patient-document";
import { useAuth } from "@/lib/auth-context";
import { useFacilities } from "@/lib/use-facilities";

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
  photo_url?: string | null;
  signature_url?: string | null;
  fingerprint_captured?: boolean | null;
}

function PatientsPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Patient[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { isAdmin, isSupervisor } = useAuth();
  const { facilities } = useFacilities();
  const [facilityFilter, setFacilityFilter] = useState<string>("all");
  const [tab, setTab] = useState<"all" | "incomplete">("all");
  const canFilter = isAdmin || isSupervisor;

  async function fetchFull(id: string) {
    const { data, error } = await supabase.from("patients").select("*").eq("id", id).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? "Patient not found");
    return data as any;
  }

  async function downloadPdf(id: string) {
    try {
      setBusyId(id);
      const p = await fetchFull(id);
      await downloadPatientPdf(p);
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
      printPatientDocument(p);
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
        .select("id,patient_code,first_name,last_name,date_of_birth,gender,primary_phone,nationality,created_at,facility_id,photo_url,signature_url,fingerprint_captured")
        .order("created_at", { ascending: false })
        .limit(50);
      if (q.trim()) {
        const s = `%${q.trim()}%`;
        query = query.or(`first_name.ilike.${s},last_name.ilike.${s},patient_code.ilike.${s},primary_phone.ilike.${s}`);
      }
      if (canFilter && facilityFilter !== "all") {
        query = query.eq("facility_id", facilityFilter);
      }
      if (tab === "incomplete") {
        query = query.or("photo_url.is.null,signature_url.is.null,fingerprint_captured.is.false");
      }
      const { data } = await query;
      setRows((data ?? []) as Patient[]);
    }, 200);
    return () => clearTimeout(t);
  }, [q, facilityFilter, canFilter, tab]);

  return (
    <AppLayout title="Patient Records">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, ID, phone…" className="pl-9" />
          </div>
          {canFilter && (
            <Select value={facilityFilter} onValueChange={setFacilityFilter}>
              <SelectTrigger className="w-56"><SelectValue placeholder="All facilities" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All facilities</SelectItem>
                {facilities.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        <Link to="/register-patient">
          <Button className="gap-2"><UserPlus className="h-4 w-4" /> Register New</Button>
        </Link>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "incomplete")} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">All Patients</TabsTrigger>
          <TabsTrigger value="incomplete" className="gap-2">
            <ClipboardCheck className="h-3.5 w-3.5" /> Incomplete
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {tab === "incomplete" ? "All patient records are complete." : "No patients found."}
            </p>
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
                    {tab === "incomplete" ? <th className="px-4 py-3">Missing</th> : <th className="px-4 py-3">Nationality</th>}
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
                      {tab === "incomplete" ? (
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {!p.photo_url && <Badge variant="destructive" className="text-[10px]">No Photo</Badge>}
                            {!p.fingerprint_captured && <Badge variant="destructive" className="text-[10px]">No Fingerprint</Badge>}
                            {!p.signature_url && <Badge variant="destructive" className="text-[10px]">No Signature</Badge>}
                          </div>
                        </td>
                      ) : (
                        <td className="px-4 py-3">{p.nationality ?? "—"}</td>
                      )}
                      <td className="px-4 py-3 text-muted-foreground">{format(new Date(p.created_at), "PP")}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {tab === "incomplete" && (
                            <Link to="/register-patient" search={{ complete: p.id } as any}>
                              <Button size="sm" variant="outline" className="gap-1" title="Complete biometrics">
                                <ClipboardCheck className="h-3.5 w-3.5" /> Complete
                              </Button>
                            </Link>
                          )}
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
