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
import { KeyRound, ShieldCheck, ShieldAlert, Loader2, Sun, Moon, Monitor, Bell, Globe, Download } from "lucide-react";
import { TwoFactorSetup } from "@/components/TwoFactorSetup";
import { FacilitiesManager } from "@/components/FacilitiesManager";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { applyTheme, type Theme } from "@/lib/theme";

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

        {isAdmin && <FacilitiesManager />}

        <AppearanceCard />
        <NotificationsCard />
        {isAdmin && <DataExportCard />}
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

function AppearanceCard() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem("medireg:theme") as Theme) || "system";
  });
  const [density, setDensity] = useState<string>(() =>
    typeof window === "undefined" ? "comfortable" : localStorage.getItem("medireg:density") || "comfortable",
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("medireg:theme", theme);
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    document.documentElement.dataset.density = density;
    localStorage.setItem("medireg:density", density);
  }, [density]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sun className="h-4 w-4 text-primary" /> Appearance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs">Theme</Label>
          <div className="grid grid-cols-3 gap-2">
            {(["light", "dark", "system"] as Theme[]).map((t) => (
              <Button
                key={t}
                type="button"
                variant={theme === t ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme(t)}
                className="gap-1.5 capitalize"
              >
                {t === "light" ? <Sun className="h-3.5 w-3.5" /> : t === "dark" ? <Moon className="h-3.5 w-3.5" /> : <Monitor className="h-3.5 w-3.5" />}
                {t}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Density</Label>
          <Select value={density} onValueChange={setDensity}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="compact">Compact</SelectItem>
              <SelectItem value="comfortable">Comfortable</SelectItem>
              <SelectItem value="spacious">Spacious</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

function NotificationsCard() {
  const [emailDigest, setEmailDigest] = useState(() =>
    typeof window === "undefined" ? true : localStorage.getItem("medireg:notif:digest") !== "0",
  );
  const [licenseAlerts, setLicenseAlerts] = useState(() =>
    typeof window === "undefined" ? true : localStorage.getItem("medireg:notif:license") !== "0",
  );
  const [language, setLanguage] = useState(() =>
    typeof window === "undefined" ? "en" : localStorage.getItem("medireg:language") || "en",
  );

  useEffect(() => { localStorage.setItem("medireg:notif:digest", emailDigest ? "1" : "0"); }, [emailDigest]);
  useEffect(() => { localStorage.setItem("medireg:notif:license", licenseAlerts ? "1" : "0"); }, [licenseAlerts]);
  useEffect(() => { localStorage.setItem("medireg:language", language); }, [language]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Bell className="h-4 w-4 text-primary" /> Notifications & Locale</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <Toggle label="Weekly email digest" checked={emailDigest} onChange={setEmailDigest} />
        <Toggle label="License expiry alerts" checked={licenseAlerts} onChange={setLicenseAlerts} />
        <div className="space-y-2">
          <Label className="flex items-center gap-1 text-xs"><Globe className="h-3 w-3" /> Language</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="sw">Swahili</SelectItem>
              <SelectItem value="fr">Français</SelectItem>
              <SelectItem value="es">Español</SelectItem>
              <SelectItem value="ar">العربية</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function DataExportCard() {
  const [exporting, setExporting] = useState(false);
  async function exportPatients() {
    setExporting(true);
    try {
      const { data, error } = await supabase
        .from("patients")
        .select("patient_code,first_name,middle_name,last_name,gender,date_of_birth,primary_phone,email,city,country,created_at")
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      const rows = data ?? [];
      const headers = Object.keys(rows[0] ?? { patient_code: "" });
      const csv = [
        headers.join(","),
        ...rows.map((r: any) =>
          headers.map((h) => {
            const v = r[h] ?? "";
            const s = String(v).replace(/"/g, '""');
            return /[",\n]/.test(s) ? `"${s}"` : s;
          }).join(","),
        ),
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `patients-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} patient record${rows.length === 1 ? "" : "s"}`);
    } catch (e: any) {
      toast.error(e.message ?? "Export failed");
    } finally {
      setExporting(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Download className="h-4 w-4 text-primary" /> Data Export</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">Download a CSV snapshot of patient records for offline backup or analysis.</p>
        <Button onClick={exportPatients} disabled={exporting} className="gap-2">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export patients CSV
        </Button>
      </CardContent>
    </Card>
  );
}
