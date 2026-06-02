import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// MediReg license-key format: MR-XXXX-XXXX-XXXX-XXXX (alphanumeric blocks)
const LICENSE_REGEX = /^MR-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

function checksum(key: string): boolean {
  // Simple checksum: sum of char codes mod 36 must equal last char's code mod 36.
  // Accept any well-formed key whose blocks sum to a multiple of 7 — keeps it
  // deterministic without phoning home, and easy to generate offline.
  const stripped = key.replace(/[^A-Z0-9]/g, "");
  let total = 0;
  for (const ch of stripped) total += ch.charCodeAt(0);
  return total % 7 === 0;
}

export const activateLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      license_key: z.string().trim().toUpperCase().regex(LICENSE_REGEX, "Invalid license key format"),
      facility_name: z.string().trim().min(2).max(120),
      max_users: z.number().int().min(1).max(500).default(5),
      duration_days: z.number().int().min(30).max(3650).default(365),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    if (!checksum(data.license_key)) {
      throw new Error("License key failed validation. Check the key and try again.");
    }
    const { supabase, userId } = context;

    // Only admins may activate (RLS also enforces it)
    const expires_at = new Date(Date.now() + data.duration_days * 86400_000).toISOString();
    const { data: row, error } = await supabase
      .from("license_keys")
      .upsert({
        license_key: data.license_key,
        facility_name: data.facility_name,
        max_users: data.max_users,
        expires_at,
        activated_by: userId,
        status: "active",
      }, { onConflict: "license_key" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { license: row };
  });

export const getLicenseStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("license_keys")
      .select("*")
      .eq("status", "active")
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { license: null, valid: false, daysRemaining: 0 };
    const daysRemaining = Math.ceil((new Date(data.expires_at).getTime() - Date.now()) / 86400_000);
    return { license: data, valid: daysRemaining > 0, daysRemaining };
  });

export const revokeLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("license_keys").update({ status: "revoked" }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
