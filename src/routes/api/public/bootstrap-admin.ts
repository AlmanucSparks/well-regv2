import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_EMAILS = new Set(["almanucsparks@gmail.com"]);

export const Route = createFileRoute("/api/public/bootstrap-admin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { email?: string; password?: string; full_name?: string };
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const email = (body.email ?? "").toLowerCase().trim();
        const password = body.password ?? "";
        const full_name = body.full_name ?? "Almanuc Sparks";

        if (!ALLOWED_EMAILS.has(email)) {
          return new Response("Email not on allowlist", { status: 403 });
        }
        if (password.length < 8) {
          return new Response("Password too short", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let existingId: string | null = null;
        for (let page = 1; page <= 5 && !existingId; page++) {
          const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
          if (error) return new Response(error.message, { status: 500 });
          const hit = list.users.find((u) => (u.email ?? "").toLowerCase() === email);
          if (hit) existingId = hit.id;
          if (list.users.length < 200) break;
        }

        let userId: string;
        let created = false;
        if (existingId) {
          const { error } = await supabaseAdmin.auth.admin.updateUserById(existingId, {
            password,
            email_confirm: true,
            user_metadata: { full_name },
          });
          if (error) return new Response(error.message, { status: 500 });
          userId = existingId;
        } else {
          const { data: createdUser, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name },
          });
          if (error) return new Response(error.message, { status: 500 });
          userId = createdUser.user.id;
          created = true;
        }

        await supabaseAdmin
          .from("profiles")
          .upsert(
            { id: userId, email, full_name, status: "active" },
            { onConflict: "id" },
          );

        const { data: existingRole } = await supabaseAdmin
          .from("user_roles")
          .select("id")
          .eq("user_id", userId)
          .eq("role", "admin")
          .maybeSingle();
        if (!existingRole) {
          await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "admin" });
        }

        return new Response(JSON.stringify({ ok: true, userId, created }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});