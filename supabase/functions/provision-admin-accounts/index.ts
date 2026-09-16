import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const BOOTSTRAP_IAIN_ID = "28696bc6-2df2-4855-b259-3f156ad55748";
const ACCOUNTS = [
  { username: "iain.mccalman", displayName: "Iain McCalman", role: "owner" },
  { username: "ian.midwinter", displayName: "Ian Midwinter", role: "admin" },
  { username: "craig.mitchell", displayName: "Craig Mitchell", role: "admin" },
  { username: "liam.burns", displayName: "Liam Burns", role: "admin" },
  { username: "jake.morris", displayName: "Jake Morris", role: "admin" },
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
  const isOwner = user?.id === BOOTSTRAP_IAIN_ID || user?.app_metadata?.role === "owner";
  if (!user || !isOwner) {
    return new Response(JSON.stringify({ error: "Only Iain McCalman can manage administrator accounts." }), {
      status: 403, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let requestedUsername = "";
  try {
    const body = await req.json();
    requestedUsername = String(body?.username || "").trim().toLowerCase();
  } catch {
    requestedUsername = "";
  }
  const selected = requestedUsername
    ? ACCOUNTS.filter((account) => account.username === requestedUsername)
    : ACCOUNTS;
  if (selected.length === 0) {
    return new Response(JSON.stringify({ error: "Administrator account not found." }), {
      status: 404, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(url, serviceKey);
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) return new Response(JSON.stringify({ error: listError.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });

  const credentials = [];
  for (const account of selected) {
    const email = account.username + "@admin.ecfa.local";
    const temporaryPassword = password();
    const existing = listed.users.find((item) => item.email?.toLowerCase() === email);

    let userId;
    if (existing) {
      const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
        password: temporaryPassword,
        email_confirm: true,
        app_metadata: { ...existing.app_metadata, role: account.role },
      });
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
      userId = data.user.id;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
        app_metadata: { role: account.role },
      });
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
      userId = data.user.id;
    }

    if (account.role === "owner") {
      const { error: releaseError } = await admin
        .from("admin_profiles")
        .update({ username: null })
        .eq("id", BOOTSTRAP_IAIN_ID);
      if (releaseError) return new Response(JSON.stringify({ error: releaseError.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
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
