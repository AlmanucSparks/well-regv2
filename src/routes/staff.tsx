import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { format } from "date-fns";

export const Route = createFileRoute("/staff")({ component: StaffPage });

interface Profile {
  id: string;
  full_name: string;
  email: string;
  status: string;
  last_login: string | null;
  created_at: string;
}

function StaffPage() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<Profile[]>([]);
  useEffect(() => {
    supabase.from("profiles").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      setRows((data ?? []) as Profile[]);
    });
  }, []);

  if (!isAdmin) {
    return <AppLayout title="Staff Management"><p className="text-sm text-muted-foreground">Admin access required.</p></AppLayout>;
  }

  return (
    <AppLayout title="Staff Management">
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Created</th></tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">{p.full_name || "—"}</td>
                  <td className="px-4 py-3">{p.email}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">{p.status}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{format(new Date(p.created_at), "PP")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
