import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { activateLicense, getLicenseStatus, revokeLicense } from "@/lib/licenses.functions";
import { useAuth } from "@/lib/auth-context";
import { KeyRound, ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { TwoFactorSetup } from "@/components/TwoFactorSetup";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const getStatus = useServerFn(getLicenseStatus);
  const activate = useServerFn(activateLicense);
  const revoke = useServerFn(revokeLicense);

  const { data, isLoading } = useQuery({ queryKey: ["license"], queryFn: () => getStatus() });

  const [key, setKey] = useState("");
  const [facility, setFacility] = useState("");
  const [maxUsers, setMaxUsers] = useState(5);

  const activateMut = useMutation({
    mutationFn: () =>
      activate({ data: { license_key: key, facility_name: facility, max_users: maxUsers, duration_days: 365 } }),
    onSuccess: () => {
      toast.success("License activated");
      setKey(""); setFacility("");
      qc.invalidateQueries({ queryKey: ["license"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Activation failed"),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => { toast.success("License revoked"); qc.invalidateQueries({ queryKey: ["license"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const license = data?.license;
  const valid = data?.valid;

  return (
    <AppLayout title="Settings">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /> License</CardTitle>
            {license && (
              <Badge variant={valid ? "default" : "destructive"} className="gap-1">
                {valid ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                {valid ? "Active" : "Expired"}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : license ? (
              <div className="space-y-1 rounded-md border bg-muted/30 p-3 text-sm">
                <Row k="Facility" v={license.facility_name} />
                <Row k="Key" v={license.license_key} mono />
                <Row k="Max users" v={String(license.max_users)} />
                <Row k="Activated" v={format(new Date(license.activated_at), "PP")} />
                <Row k="Expires" v={format(new Date(license.expires_at), "PP")} />
                <Row k="Days left" v={String(data?.daysRemaining ?? 0)} />
                {isAdmin && (
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => revokeMut.mutate(license.id)}>
                    Revoke
                  </Button>
                )}
              </div>
            ) : (
              <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning-foreground">
                No active license. Activate one below to unlock cloud sync.
              </p>
            )}

            {isAdmin && (
              <form
                className="space-y-3 border-t pt-4"
                onSubmit={(e) => { e.preventDefault(); activateMut.mutate(); }}
              >
                <div className="space-y-1.5">
                  <Label className="text-xs">License key</Label>
                  <Input
                    value={key}
                    onChange={(e) => setKey(e.target.value.toUpperCase())}
                    placeholder="MR-XXXX-XXXX-XXXX-XXXX"
                    className="font-mono"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Facility name</Label>
                    <Input value={facility} onChange={(e) => setFacility(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Max users</Label>
                    <Input type="number" min={1} max={500} value={maxUsers} onChange={(e) => setMaxUsers(parseInt(e.target.value) || 5)} />
                  </div>
                </div>
                <Button type="submit" disabled={activateMut.isPending} className="gap-2">
                  {activateMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Activate License
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <TwoFactorSetup />

        <Card>
          <CardHeader><CardTitle>Facility</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Facility profile and branding settings will appear here once a license is active.
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className={mono ? "font-mono" : "font-medium"}>{v}</span>
    </div>
  );
}
