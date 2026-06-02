import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { UserPlus, Search } from "lucide-react";

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
