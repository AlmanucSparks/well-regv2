import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptInvite, getInviteByToken } from "@/lib/invites.functions";

export const Route = createFileRoute("/login")({ component: LoginPage });

const passwordSchema = z
  .string()
  .min(10, "Min 10 characters")
  .regex(/[A-Z]/, "Must include uppercase")
  .regex(/[a-z]/, "Must include lowercase")
  .regex(/[0-9]/, "Must include a number")
  .regex(/[^A-Za-z0-9]/, "Must include a special character");

function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const acceptFn = useServerFn(acceptInvite);
  const getInviteFn = useServerFn(getInviteByToken);

  const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const inviteToken = urlParams?.get("invite") ?? null;
  const inviteEmail = urlParams?.get("email") ?? null;

  const [mode, setMode] = useState<"signin" | "signup">(inviteToken ? "signup" : "signin");
  const [email, setEmail] = useState(inviteEmail ?? "");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<{ email: string; role: string; valid: boolean } | null>(null);

  useEffect(() => {
    if (!inviteToken) return;
    getInviteFn({ data: { token: inviteToken } })
      .then((r) => {
        if (r.invite) {
          setInviteInfo(r.invite as any);
          if (!email) setEmail(r.invite.email);
        }
      })
      .catch(() => {});
  }, [inviteToken]);

  if (!loading && user && !inviteToken) return <Navigate to="/dashboard" />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const pw = passwordSchema.safeParse(password);
        if (!pw.success) {
          toast.error(pw.error.issues[0].message);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Account created. You're signed in.");
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
        navigate({ to: "/dashboard" });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-foreground/10">
            <ShieldCheck className="h-6 w-6 text-success" />
          </div>
          <span className="text-xl font-semibold tracking-tight">MediReg</span>
        </div>
        <div>
          <h1 className="text-4xl font-semibold leading-tight">Smart Patient Registration,<br/>Simplified.</h1>
          <p className="mt-4 max-w-md text-sm text-sidebar-foreground/70">
            Enterprise-grade patient onboarding with biometric capture, encrypted records, and audit trails.
          </p>
        </div>
        <div className="text-xs text-sidebar-foreground/50">© {new Date().getFullYear()} MediReg • All rights reserved</div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              <span className="text-xl font-semibold">MediReg</span>
            </div>
          </div>
          <h2 className="text-2xl font-semibold">{mode === "signin" ? "Sign in to MediReg" : "Create your account"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin" ? "Enter your credentials to continue." : "The first account becomes the facility Admin."}
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input id="password" type={show ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {mode === "signup" && (
                <p className="text-xs text-muted-foreground">10+ chars, with uppercase, lowercase, number, and special character.</p>
              )}
            </div>

            <Button type="submit" disabled={busy} className="w-full">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
            <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="font-medium text-primary hover:underline">
              {mode === "signin" ? "Create one" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
