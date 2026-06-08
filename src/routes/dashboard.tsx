import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserPlus, CalendarCheck, UserCog } from "lucide-react";
import { format, subDays, startOfDay, startOfWeek, startOfMonth, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, differenceInYears } from "date-fns";
import { useAuth } from "@/lib/auth-context";
import { useFacilities } from "@/lib/use-facilities";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";

export const Route = createFileRoute("/dashboard")({ component: DashboardPage });

type Granularity = "day" | "week" | "month";
type RangeKey = "7d" | "30d" | "90d" | "year";

const RANGE_LABELS: Record<RangeKey, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "year": "This year",
};

const COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#6366f1", "#06b6d4", "#ec4899", "#84cc16"];

interface PatientRow {
  id: string;
  patient_code: string;
  first_name: string;
  last_name: string;
  created_at: string;
  date_of_birth: string;
  gender: string | null;
  blood_group: string | null;
  facility_id: string | null;
}

function rangeStart(r: RangeKey): Date {
  if (r === "7d") return subDays(new Date(), 7);
  if (r === "30d") return subDays(new Date(), 30);
  if (r === "90d") return subDays(new Date(), 90);
  const d = new Date(); d.setMonth(0); d.setDate(1); d.setHours(0,0,0,0); return d;
}

function DashboardPage() {
  const { isAdmin, isSupervisor } = useAuth();
  const { facilities } = useFacilities();
  const canFilterFacility = isAdmin || isSupervisor;

  const [range, setRange] = useState<RangeKey>("30d");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [facility, setFacility] = useState<string>("all");

  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [staffCount, setStaffCount] = useState(0);
  const [totalAll, setTotalAll] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const from = rangeStart(range).toISOString();
      const sod = startOfDay(new Date()).toISOString();

      let q = supabase
        .from("patients")
        .select("id,patient_code,first_name,last_name,created_at,date_of_birth,gender,blood_group,facility_id")
        .gte("created_at", from)
        .order("created_at", { ascending: true })
        .limit(5000);
      if (canFilterFacility && facility !== "all") q = q.eq("facility_id", facility);

      let totalQ = supabase.from("patients").select("*", { count: "exact", head: true });
      let todayQ = supabase.from("patients").select("*", { count: "exact", head: true }).gte("created_at", sod);
      if (canFilterFacility && facility !== "all") {
        totalQ = totalQ.eq("facility_id", facility);
        todayQ = todayQ.eq("facility_id", facility);
      }

      const [{ data }, { count: total }, { count: today }, { count: staff }] = await Promise.all([
        q, totalQ, todayQ, supabase.from("profiles").select("*", { count: "exact", head: true }),
      ]);
      if (cancel) return;
      setPatients((data ?? []) as PatientRow[]);
      setTotalAll(total ?? 0);
      setTodayCount(today ?? 0);
      setStaffCount(staff ?? 0);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [range, facility, canFilterFacility]);

  const facilityNameMap = useMemo(() => {
    const m = new Map<string, string>();
    facilities.forEach((f) => m.set(f.id, f.name));
    return m;
  }, [facilities]);

  // ---- Series: Registrations over time
  const timeSeries = useMemo(() => {
    const from = rangeStart(range);
    const to = new Date();
    const buckets: { date: Date; key: string; label: string }[] = [];
    if (granularity === "day") {
      eachDayOfInterval({ start: from, end: to }).forEach((d) => buckets.push({ date: d, key: format(d,"yyyy-MM-dd"), label: format(d, "MMM d") }));
    } else if (granularity === "week") {
      eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 }).forEach((d) => buckets.push({ date: d, key: format(d,"yyyy-'W'II"), label: format(d, "MMM d") }));
    } else {
      eachMonthOfInterval({ start: from, end: to }).forEach((d) => buckets.push({ date: d, key: format(d,"yyyy-MM"), label: format(d, "MMM yyyy") }));
    }
    const counts = new Map<string, number>();
    patients.forEach((p) => {
      const d = new Date(p.created_at);
      let key = "";
      if (granularity === "day") key = format(d, "yyyy-MM-dd");
      else if (granularity === "week") key = format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-'W'II");
      else key = format(startOfMonth(d), "yyyy-MM");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return buckets.map((b) => ({ label: b.label, count: counts.get(b.key) ?? 0 }));
  }, [patients, range, granularity]);

  // ---- By facility
  const byFacility = useMemo(() => {
    const m = new Map<string, number>();
    patients.forEach((p) => {
      const name = p.facility_id ? (facilityNameMap.get(p.facility_id) ?? "Unknown") : "Unassigned";
      m.set(name, (m.get(name) ?? 0) + 1);
    });
    return Array.from(m.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [patients, facilityNameMap]);

  // ---- Gender
  const byGender = useMemo(() => {
    const m: Record<string, number> = { Male: 0, Female: 0, Other: 0 };
    patients.forEach((p) => {
      const g = (p.gender ?? "Other");
      m[g] = (m[g] ?? 0) + 1;
    });
    return Object.entries(m).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [patients]);

  // ---- Age buckets
  const byAge = useMemo(() => {
    const buckets = [
      { name: "0–12", min: 0, max: 12 },
      { name: "13–17", min: 13, max: 17 },
      { name: "18–35", min: 18, max: 35 },
      { name: "36–60", min: 36, max: 60 },
      { name: "60+", min: 61, max: 200 },
    ].map((b) => ({ ...b, count: 0 }));
    patients.forEach((p) => {
      if (!p.date_of_birth) return;
      const age = differenceInYears(new Date(), new Date(p.date_of_birth));
      const b = buckets.find((x) => age >= x.min && age <= x.max);
      if (b) b.count++;
    });
    return buckets.map(({ name, count }) => ({ name, count }));
  }, [patients]);

  // ---- Blood group
  const byBlood = useMemo(() => {
    const order = ["O+","O-","A+","A-","B+","B-","AB+","AB-"];
    const m = new Map<string, number>();
    patients.forEach((p) => { if (p.blood_group) m.set(p.blood_group, (m.get(p.blood_group) ?? 0) + 1); });
    return order.map((bg) => ({ name: bg, count: m.get(bg) ?? 0 }));
  }, [patients]);

  // ---- Peak hours
  const byHour = useMemo(() => {
    const arr = Array.from({ length: 24 }, (_, h) => ({ name: `${h.toString().padStart(2,"0")}:00`, count: 0 }));
    patients.forEach((p) => { const h = new Date(p.created_at).getHours(); arr[h].count++; });
    return arr;
  }, [patients]);

  return (
    <AppLayout title="Dashboard">
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => <SelectItem key={k} value={k}>{RANGE_LABELS[k]}</SelectItem>)}
          </SelectContent>
        </Select>
        {canFilterFacility && (
          <Select value={facility} onValueChange={setFacility}>
            <SelectTrigger className="w-56"><SelectValue placeholder="All facilities" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All facilities</SelectItem>
              {facilities.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="ml-auto">
          <Link to="/register-patient">
            <Button className="gap-2"><UserPlus className="h-4 w-4" /> Register New Patient</Button>
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users className="h-5 w-5" />} label="Total Patients" value={totalAll} />
        <StatCard icon={<CalendarCheck className="h-5 w-5" />} label="Registered Today" value={todayCount} accent="success" />
        <StatCard icon={<UserPlus className="h-5 w-5" />} label={`In ${RANGE_LABELS[range]}`} value={patients.length} />
        <StatCard icon={<UserCog className="h-5 w-5" />} label="Active Staff" value={staffCount} />
      </div>

      {/* Time series */}
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Registrations Over Time</CardTitle>
          <div className="flex gap-1 rounded-md border p-0.5">
            {(["day","week","month"] as Granularity[]).map((g) => (
              <button key={g}
                className={`rounded px-3 py-1 text-xs font-medium capitalize transition ${granularity === g ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                onClick={() => setGranularity(g)}>
                {g === "day" ? "Daily" : g === "week" ? "Weekly" : "Monthly"}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeSeries} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Two-col grid */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Registrations by Facility</CardTitle></CardHeader>
          <CardContent className="h-72">
            {byFacility.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byFacility} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Gender Distribution</CardTitle></CardHeader>
          <CardContent className="h-72">
            {byGender.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byGender} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {byGender.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Age Groups</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byAge} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Blood Group Frequency</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byBlood} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Peak Registration Hours</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byHour} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={1} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {loading && <p className="mt-4 text-center text-xs text-muted-foreground">Loading analytics…</p>}
    </AppLayout>
  );
}

function Empty() {
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No data for this range</div>;
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent?: "success" }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${accent === "success" ? "bg-success/15 text-success" : "bg-primary-soft text-primary"}`}>
          {icon}
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
