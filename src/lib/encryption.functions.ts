import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// AES-256-GCM encryption for sensitive PII fields at rest.
// Ciphertext format (base64): [12-byte IV | 16-byte auth tag | ciphertext]
// Key is read from PII_ENCRYPTION_KEY (any length — hashed to 32 bytes).

async function getKey(): Promise<ArrayBuffer> {
  const raw = process.env.PII_ENCRYPTION_KEY;
  if (!raw) throw new Error("PII_ENCRYPTION_KEY is not configured");
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
}

async function importKey(usage: KeyUsage[]) {
  const k = await getKey();
  return crypto.subtle.importKey("raw", k, { name: "AES-GCM" }, false, usage);
}

function b64encode(buf: Uint8Array): string {
  let s = "";
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s);
}
function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const ENC_PREFIX = "enc::v1::";

export const encryptPII = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ plaintext: z.string().max(4096) }).parse(input),
  )
  .handler(async ({ data }) => {
    if (!data.plaintext) return { ciphertext: "" };
    const key = await importKey(["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const pt = new TextEncoder().encode(data.plaintext);
    const ctBuf = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      pt as BufferSource,
    );
    const ct = new Uint8Array(ctBuf);
    const out = new Uint8Array(iv.length + ct.length);
    out.set(iv, 0);
    out.set(ct, iv.length);
    return { ciphertext: ENC_PREFIX + b64encode(out) };
  });

export const decryptPII = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ ciphertext: z.string().max(8192) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!data.ciphertext) return { plaintext: "" };
    if (!data.ciphertext.startsWith(ENC_PREFIX)) {
      // Legacy plaintext value — return as-is for backwards compatibility.
      return { plaintext: data.ciphertext };
    }

    // Audit each decryption — sensitive operation.
    await context.supabase.from("audit_logs").insert({
      user_id: context.userId,
      action: "decrypt_pii",
      entity_type: "patient_pii",
    });

    const key = await importKey(["decrypt"]);
    const raw = b64decode(data.ciphertext.slice(ENC_PREFIX.length));
    const iv = raw.slice(0, 12);
    const ct = raw.slice(12);
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      ct as BufferSource,
    );
    return { plaintext: new TextDecoder().decode(pt) };
  });
