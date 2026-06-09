import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileDown, FileText, CalendarRange, Users, Activity, Fingerprint } from "lucide-react";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useFacilities } from "@/lib/use-facilities";

export const Route = createFileRoute("/reports")({ component: ReportsPage });

type ReportKey = "daily" | "monthly" | "demographic" | "incomplete";

interface ReportResult {
  title: string;
  columns: string[];
  rows: (string | number)[][];
  summary?: string;
}

function ReportsPage() {
  const { isAdmin, isSupervisor } = useAuth();
  const { facilities } = useFacilities();
  const canFilterFacility = isAdmin || isSupervisor;

  const today = new Date();
  const [from, setFrom] = useState(format(subDays(today, 30), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(today, "yyyy-MM-dd"));
  const [facility, setFacility] = useState<string>("all");
  const [year, setYear] = useState<string>(String(today.getFullYear()));

  const [busy, setBusy] = useState<ReportKey | null>(null);
  const [result, setResult] = useState<{ key: ReportKey; data: ReportResult } | null>(null);

  function applyFacility(q: any) {
    return facility !== "all" ? q.eq("facility_id", facility) : q;
  }

  async function runDaily() {
    setBusy("daily");
    try {
      const start = startOfDay(new Date());
      const end = endOfDay(new Date());
      let q = supabase
        .from("patients")
        .select("gender,facility_id")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());
      q = applyFacility(q);
      const { data, error } = await q;
      if (error) throw error;
      const buckets = new Map<string, { facility: string; Male: number; Female: number; Other: number; total: number }>();
      (data ?? []).forEach((p: any) => {
        const fid = p.facility_id ?? "—";
        const name = facilities.find((f) => f.id === fid)?.name ?? "Unassigned";
        const b = buckets.get(fid) ?? { facility: name, Male: 0, Female: 0, Other: 0, total: 0 };
        const g = (p.gender as "Male" | "Female" | "Other") ?? "Other";
        b[g === "Male" || g === "Female" ? g : "Other"]++;
        b.total++;
        buckets.set(fid, b);
      });
      const rows = Array.from(buckets.values()).map((b) => [b.facility, b.Male, b.Female, b.Other, b.total]);
      setResult({
        key: "daily",
        data: {
          title: `Daily Registration Summary — ${format(new Date(), "PP")}`,
          columns: ["Facility", "Male", "Female", "Other", "Total"],
          rows,
          summary: `${data?.length ?? 0} patients registered today.`,
        },
      });
    } catch (e: any) { toast.error(e?.message ?? "Report failed"); }
    finally { setBusy(null); }
  }

  async function runMonthly() {
    setBusy("monthly");
    try {
      const y = parseInt(year, 10);
      let q = supabase
        .from("patients")
        .select("created_at")
        .gte("created_at", new Date(y, 0, 1).toISOString())
        .lt("created_at", new Date(y + 1, 0, 1).toISOString());
      q = applyFacility(q);
      const { data, error } = await q;
      if (error) throw error;
      const monthly = new Array(12).fill(0);
      (data ?? []).forEach((p: any) => { monthly[new Date(p.created_at).getMonth()]++; });
      const rows = monthly.map((count, i) => [format(new Date(y, i, 1), "MMMM yyyy"), count]);
      setResult({
        key: "monthly",
        data: {
          title: `Monthly Census — ${y}`,
          columns: ["Month", "Registrations"],
          rows,
          summary: `${data?.length ?? 0} total registrations in ${y}.`,
        },
      });
    } catch (e: any) { toast.error(e?.message ?? "Report failed"); }
    finally { setBusy(null); }
  }

  async function runDemographic() {
    setBusy("demographic");
    try {
      let q = supabase
        .from("patients")
        .select("gender,nationality,blood_group,date_of_birth")
        .gte("created_at", new Date(from).toISOString())
        .lte("created_at", endOfDay(new Date(to)).toISOString());
      q = applyFacility(q);
      const { data, error } = await q;
      if (error) throw error;
      const tally = (key: string) => {
        const m = new Map<string, number>();
        (data ?? []).forEach((p: any) => {
          const v = (p[key] ?? "Unknown") as string;
          m.set(v, (m.get(v) ?? 0) + 1);
        });
        return m;
      };
      const ageBucket = (dob: string) => {
        const age = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
        if (age <= 12) return "0–12";
        if (age <= 17) return "13–17";
        if (age <= 35) return "18–35";
        if (age <= 60) return "36–60";
        return "60+";
      };
      const ages = new Map<string, number>();
      (data ?? []).forEach((p: any) => {
        if (!p.date_of_birth) return;
        const k = ageBucket(p.date_of_birth);
        ages.set(k, (ages.get(k) ?? 0) + 1);
      });
      const toRows = (cat: string, m: Map<string, number>) =>
        Array.from(m.entries()).map(([k, v]) => [cat, k, v]);
      const rows = [
        ...toRows("Gender", tally("gender")),
        ...toRows("Nationality", tally("nationality")),
        ...toRows("Blood Group", tally("blood_group")),
        ...toRows("Age Group", ages),
      ];
      setResult({
        key: "demographic",
        data: {
          title: `Demographic Breakdown — ${from} to ${to}`,
          columns: ["Category", "Value", "Count"],
          rows,
          summary: `${data?.length ?? 0} patients in range.`,
        },
      });
    } catch (e: any) { toast.error(e?.message ?? "Report failed"); }
    finally { setBusy(null); }
  }

  async function runIncomplete() {
    setBusy("incomplete");
    try {
      let q = supabase
        .from("patients")
        .select("patient_code,first_name,last_name,photo_url,signature_url,fingerprints,facility_id,created_at")
        .order("created_at", { ascending: false });
      q = applyFacility(q);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? [])
        .filter((p: any) => !p.photo_url || !p.signature_url || !p.fingerprints || Object.keys(p.fingerprints ?? {}).length === 0)
        .map((p: any) => {
          const missing: string[] = [];
          if (!p.photo_url) missing.push("Photo");
          if (!p.signature_url) missing.push("Signature");
          if (!p.fingerprints || Object.keys(p.fingerprints ?? {}).length === 0) missing.push("Fingerprints");
          const fac = facilities.find((f) => f.id === p.facility_id)?.name ?? "—";
          return [p.patient_code, `${p.first_name} ${p.last_name}`, fac, missing.join(", "), format(new Date(p.created_at), "PP")];
        });
      setResult({
        key: "incomplete",
        data: {
          title: "Patients with Incomplete Biometrics",
          columns: ["Patient ID", "Name", "Facility", "Missing", "Registered"],
          rows,
          summary: `${rows.length} patients with missing biometric data.`,
        },
      });
    } catch (e: any) { toast.error(e?.message ?? "Report failed"); }
    finally { setBusy(null); }
  }

  function exportCsv() {
    if (!result) return;
    const { title, columns, rows } = result.data;
    const escape = (v: any) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [columns, ...rows].map((r) => r.map(escape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${title.replace(/[^\w-]+/g, "_")}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  async function exportPdf() {
    if (!result) return;
    const { default: jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const { title, columns, rows, summary } = result.data;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    doc.setFontSize(14); doc.text(title, 40, 40);
    doc.setFontSize(9); doc.setTextColor(120);
    doc.text(`Generated ${format(new Date(), "PPpp")}${summary ? " · " + summary : ""}`, 40, 56);
    autoTable(doc, {
      startY: 70,
      head: [columns],
      body: rows.map((r) => r.map((c) => String(c))),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [15, 23, 42] },
    });
    doc.save(`${title.replace(/[^\w-]+/g, "_")}.pdf`);
  }

  const reports: { key: ReportKey; title: string; desc: string; icon: any; run: () => Promise<void> }[] = [
    { key: "daily", title: "Daily Registration Summary", desc: "Today's registrations by facility and gender.", icon: CalendarRange, run: runDaily },
    { key: "monthly", title: "Monthly Census", desc: "Total registrations per month for the selected year.", icon: Activity, run: runMonthly },
    { key: "demographic", title: "Demographic Breakdown", desc: "Nationality, gender, age group, blood group.", icon: Users, run: runDemographic },
    { key: "incomplete", title: "Incomplete Biometrics", desc: "Patients missing photo, fingerprint, or signature.", icon: Fingerprint, run: runIncomplete },
  ];

  const years = useMemo(() => {
    const y = today.getFullYear();
    return [y, y - 1, y - 2, y - 3, y - 4].map(String);
  }, [today]);

  return (
    <AppLayout title="Reports">
      <Card className="mb-4">
        <CardContent className="grid gap-4 p-4 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Year (Monthly Census)</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {canFilterFacility && (
            <div className="space-y-1.5">
              <Label className="text-xs">Facility</Label>
              <Select value={facility} onValueChange={setFacility}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All facilities</SelectItem>
                  {facilities.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((r) => (
          <Card key={r.key}>
            <CardHeader className="flex flex-row items-start gap-3 space-y-0">
              <div className="rounded-md bg-primary/10 p-2 text-primary"><r.icon className="h-5 w-5" /></div>
              <div className="flex-1">
                <CardTitle className="text-base">{r.title}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">{r.desc}</p>
              </div>
            </CardHeader>
            <CardContent>
              <Button onClick={r.run} disabled={busy === r.key} className="gap-2">
                {busy === r.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Generate
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {result && (
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">{result.data.title}</CardTitle>
              {result.data.summary && <p className="mt-1 text-xs text-muted-foreground">{result.data.summary}</p>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportCsv} className="gap-2"><FileDown className="h-4 w-4" /> CSV</Button>
              <Button onClick={exportPdf} className="gap-2"><FileDown className="h-4 w-4" /> PDF</Button>
            </div>
          </CardHeader>
          <CardContent>
            {result.data.rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No data for the selected filters.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>{result.data.columns.map((c) => <th key={c} className="px-3 py-2">{c}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y">
                    {result.data.rows.map((row, i) => (
                      <tr key={i}>{row.map((c, j) => <td key={j} className="px-3 py-2">{String(c)}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </AppLayout>
  );
}