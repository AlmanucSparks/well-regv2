import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { createInvite, listInvites, revokeInvite } from "@/lib/invites.functions";
import { format } from "date-fns";
import { toast } from "sonner";
import { Copy, Loader2, Mail, X } from "lucide-react";

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
  const qc = useQueryClient();
  const [rows, setRows] = useState<Profile[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"registrar" | "supervisor" | "admin">("registrar");

  const listFn = useServerFn(listInvites);
  const createFn = useServerFn(createInvite);
  const revokeFn = useServerFn(revokeInvite);

  const invitesQ = useQuery({
    queryKey: ["staff-invites"],
    queryFn: () => listFn(),
    enabled: isAdmin,
  });

  useEffect(() => {
    supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => setRows((data ?? []) as Profile[]));
  }, []);

  const createMut = useMutation({
    mutationFn: () => createFn({ data: { email, role } }),
    onSuccess: (res) => {
      const url = `${window.location.origin}/login?invite=${res.token}&email=${encodeURIComponent(email)}`;
      navigator.clipboard?.writeText(url).catch(() => {});
      toast.success("Invite created — link copied to clipboard");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["staff-invites"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to create invite"),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Invite revoked");
      qc.invalidateQueries({ queryKey: ["staff-invites"] });
    },
  });

  if (!isAdmin) {
    return (
      <AppLayout title="Staff Management">
        <p className="text-sm text-muted-foreground">Admin access required.</p>
      </AppLayout>
    );
  }

  function copyInviteLink(token: string, email: string) {
    const url = `${window.location.origin}/login?invite=${token}&email=${encodeURIComponent(email)}`;
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied");
  }

  return (
    <AppLayout title="Staff Management">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> Invite Staff</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }}
            >
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="name@hospital.org" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="registrar">Registrar</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={createMut.isPending} className="w-full gap-2">
                {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create invite link
              </Button>
              <p className="text-xs text-muted-foreground">
                A shareable link will be copied to your clipboard. Send it via your preferred secure channel.
              </p>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Pending Invites</CardTitle></CardHeader>
          <CardContent className="p-0">
            {invitesQ.isLoading ? (
              <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (invitesQ.data?.invites ?? []).length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No invites yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Expires</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invitesQ.data!.invites.map((i: any) => (
                    <tr key={i.id}>
                      <td className="px-4 py-3">{i.email}</td>
                      <td className="px-4 py-3 capitalize">{i.role}</td>
                      <td className="px-4 py-3">
                        <Badge variant={i.status === "pending" ? "default" : "secondary"} className="capitalize">{i.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{format(new Date(i.expires_at), "PP")}</td>
                      <td className="px-4 py-3 text-right">
                        {i.status === "pending" && (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => copyInviteLink(i.token, i.email)}>
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => revokeMut.mutate(i.id)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>Active Staff</CardTitle></CardHeader>
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
      </div>
    </AppLayout>
  );
}
