import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const IAIN_ID = "28696bc6-2df2-4855-b259-3f156ad55748";
const ACCOUNTS = [
  { username: "ian.midwinter", displayName: "Ian Midwinter" },
  { username: "craig.mitchell", displayName: "Craig Mitchell" },
  { username: "liam.burns", displayName: "Liam Burns" },
  { username: "jake.morris", displayName: "Jake Morris" },
];
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function password() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(bytes, (value) => chars[value % chars.length]).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";

  const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await callerClient.auth.getUser();
  if (!user || user.id !== IAIN_ID) {
    return new Response(JSON.stringify({ error: "Only Iain McCalman can generate administrator accounts." }), {
      status: 403, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(url, serviceKey);
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) return new Response(JSON.stringify({ error: listError.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });

  const credentials = [];
  for (const account of ACCOUNTS) {
    const email = account.username + "@admin.ecfa.local";
    const temporaryPassword = password();
    const existing = listed.users.find((item) => item.email?.toLowerCase() === email);

    let userId;
    if (existing) {
      const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
        password: temporaryPassword,
        email_confirm: true,
        app_metadata: { ...existing.app_metadata, role: "admin" },
      });
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
      userId = data.user.id;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
        app_metadata: { role: "admin" },
      });
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
      userId = data.user.id;
    }

    const { error: profileError } = await admin.from("admin_profiles").upsert({
      id: userId,
      display_name: account.displayName,
      username: account.username,
      must_change_password: true,
    });
    if (profileError) return new Response(JSON.stringify({ error: profileError.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });

    credentials.push({ username: account.username, displayName: account.displayName, temporaryPassword });
  }

  return new Response(JSON.stringify({ credentials }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
