import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const INACTIVITY_MS = 15 * 60 * 1000; // 15 minutes

type Role = "admin" | "registrar" | "supervisor";

interface AuthState {
  user: User | null;
  session: Session | null;
  roles: Role[];
  facilityId: string | null;
  loading: boolean;
  isAdmin: boolean;
  isRegistrar: boolean;
  isSupervisor: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;
    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        toast.warning("Signed out after 15 minutes of inactivity");
        await supabase.auth.signOut();
        window.location.href = "/login";
      }, INACTIVITY_MS);
    };
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [user]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // defer to avoid deadlock
        setTimeout(() => { loadRoles(s.user.id); loadFacility(s.user.id); }, 0);
      } else {
        setRoles([]);
        setFacilityId(null);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) { loadRoles(data.session.user.id); loadFacility(data.session.user.id); }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadRoles(uid: string) {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    setRoles((data ?? []).map((r) => r.role as Role));
  }

  async function loadFacility(uid: string) {
    const { data } = await supabase.from("profiles").select("facility_id").eq("id", uid).maybeSingle();
    setFacilityId((data?.facility_id as string | null) ?? null);
  }

  async function signOut() {
    try {
      // Clear any locally persisted patient registration drafts on sign-out
      Object.keys(localStorage)
        .filter((k) => k.startsWith("medireg:patient-draft:"))
        .forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        roles,
        facilityId,
        loading,
        isAdmin: roles.includes("admin"),
        isRegistrar: roles.includes("registrar"),
        isSupervisor: roles.includes("supervisor"),
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
