import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserPlus, CalendarCheck, UserCog } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/dashboard")({ component: DashboardPage });

interface Stats {
  total: number;
  today: number;
  staff: number;
}
interface Recent {
  id: string;
  patient_code: string;
  first_name: string;
  last_name: string;
  created_at: string;
}

function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ total: 0, today: 0, staff: 0 });
  const [recent, setRecent] = useState<Recent[]>([]);

  useEffect(() => {
    (async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const [{ count: total }, { count: today }, { count: staff }, { data: rec }] =
        await Promise.all([
          supabase.from("patients").select("*", { count: "exact", head: true }),
          supabase
            .from("patients")
            .select("*", { count: "exact", head: true })
            .gte("created_at", startOfDay.toISOString()),
          supabase.from("profiles").select("*", { count: "exact", head: true }),
          supabase
            .from("patients")
            .select("id,patient_code,first_name,last_name,created_at")
            .order("created_at", { ascending: false })
            .limit(8),
        ]);
      setStats({ total: total ?? 0, today: today ?? 0, staff: staff ?? 0 });
      setRecent((rec ?? []) as Recent[]);
    })();
  }, []);

  return (
    <AppLayout title="Dashboard">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users className="h-5 w-5" />} label="Total Patients" value={stats.total} />
        <StatCard icon={<CalendarCheck className="h-5 w-5" />} label="Registered Today" value={stats.today} accent="success" />
        <StatCard icon={<UserPlus className="h-5 w-5" />} label="Pending Reviews" value={0} />
        <StatCard icon={<UserCog className="h-5 w-5" />} label="Active Staff" value={stats.staff} />
      </div>

      <div className="mt-6 flex justify-end">
        <Link to="/register-patient">
          <Button className="gap-2"><UserPlus className="h-4 w-4" /> Register New Patient</Button>
        </Link>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Recent Registrations</CardTitle></CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No patients registered yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4">Patient ID</th>
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recent.map((p) => (
                    <tr key={p.id}>
                      <td className="py-3 pr-4 font-mono text-xs">{p.patient_code}</td>
                      <td className="py-3 pr-4">{p.first_name} {p.last_name}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{format(new Date(p.created_at), "PP p")}</td>
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
