import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function TwoFactorSetup() {
  const [factors, setFactors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors(data?.totp ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function startEnroll() {
    setEnrolling(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `MediReg ${Date.now()}`,
    });
    if (error) {
      toast.error(error.message);
      setEnrolling(false);
      return;
    }
    setFactorId(data.id);
    setQr(data.totp.qr_code);
    setSecret(data.totp.secret);
  }

  async function verifyEnroll() {
    if (!factorId) return;
    setBusy(true);
    const { data: chal, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
    if (cErr) {
      toast.error(cErr.message);
      setBusy(false);
      return;
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: chal.id,
      code,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Two-factor authentication enabled");
    setEnrolling(false);
    setQr(null);
    setSecret(null);
    setFactorId(null);
    setCode("");
    load();
  }

  async function unenroll(id: string) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Two-factor removed");
    load();
  }

  const verified = factors.filter((f) => f.status === "verified");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" /> Two-Factor Authentication
        </CardTitle>
        {verified.length > 0 ? (
          <Badge className="gap-1"><ShieldCheck className="h-3 w-3" /> Enabled</Badge>
        ) : (
          <Badge variant="secondary" className="gap-1"><ShieldOff className="h-3 w-3" /> Off</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : verified.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Your account is protected with a TOTP authenticator app.
            </p>
            {verified.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div>
                  <div className="font-medium">{f.friendly_name || "Authenticator"}</div>
                  <div className="text-xs text-muted-foreground">Added {new Date(f.created_at).toLocaleDateString()}</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => unenroll(f.id)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        ) : !enrolling ? (
          <>
            <p className="text-sm text-muted-foreground">
              Add a second layer of security using an authenticator app such as Google Authenticator, 1Password, or Authy.
            </p>
            <Button onClick={startEnroll}>Enable 2FA</Button>
          </>
        ) : qr ? (
          <div className="space-y-3">
            <p className="text-sm">1. Scan this QR with your authenticator app:</p>
            <div className="flex justify-center rounded-md border bg-white p-4">
              <img src={qr} alt="2FA QR code" className="h-44 w-44" />
            </div>
            {secret && (
              <p className="text-center font-mono text-xs text-muted-foreground">
                Or enter manually: <span className="font-semibold">{secret}</span>
              </p>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">2. Enter the 6-digit code</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                inputMode="numeric"
                className="font-mono tracking-widest"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={verifyEnroll} disabled={busy || code.length !== 6}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify &amp; enable
              </Button>
              <Button variant="ghost" onClick={() => { setEnrolling(false); setQr(null); }}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        )}
      </CardContent>
    </Card>
  );
}
