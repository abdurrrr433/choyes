import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const PERMISSION_KEYS = ["booking.create", "reservation.manage", "payment.create", "wallet.deposit", "users.create"] as const;
type PermissionKey = typeof PERMISSION_KEYS[number];

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JWT_SECRET_RAW = Deno.env.get("JWT_ACCESS_SECRET");
if (!JWT_SECRET_RAW) throw new Error("JWT_ACCESS_SECRET is required");

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

async function getJwtKey() {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(JWT_SECRET_RAW),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

function legacyDefaults(role: string): Record<PermissionKey, boolean> {
  return {
    "booking.create": role === "USER",
    "reservation.manage": role === "USER",
    "payment.create": role === "USER",
    "wallet.deposit": false,
    "users.create": role === "ADMIN" || role === "AGENCY",
  };
}

async function loadPermissions(supabase: ReturnType<typeof getSupabase>, account: any) {
  if (account.role === "ADMIN") {
    return Object.fromEntries(PERMISSION_KEYS.map((key) => [key, true])) as Record<PermissionKey, boolean>;
  }
  const defaults = account.permission_mode === "MANAGED"
    ? Object.fromEntries(PERMISSION_KEYS.map((key) => [key, false])) as Record<PermissionKey, boolean>
    : legacyDefaults(account.role);
  const { data } = await supabase
    .from("account_permissions")
    .select("permission_key,allowed")
    .eq("account_id", account.id);
  for (const row of data || []) {
    if (PERMISSION_KEYS.includes(row.permission_key as PermissionKey)) {
      defaults[row.permission_key as PermissionKey] = Boolean(row.allowed);
    }
  }
  return defaults;
}

async function requireAccount(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw { statusCode: 401, message: "Unauthorized" };
  let payload: { sub?: string };
  try {
    payload = await verify(token, await getJwtKey()) as { sub?: string };
  } catch {
    throw { statusCode: 401, message: "Token expired or invalid" };
  }
  const supabase = getSupabase();
  const { data: account } = await supabase
    .from("accounts")
    .select("id,name,email,role,status,agency_id,permission_mode,self_registered")
    .eq("id", payload.sub || "")
    .single();
  if (!account || account.status !== "ACTIVE") {
    throw { statusCode: 403, message: "Account is not active" };
  }
  return { supabase, account, permissions: await loadPermissions(supabase, account) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/access-wallet/, "");

  try {
    const { supabase, account, permissions } = await requireAccount(req);

    if (path === "/me" && req.method === "GET") {
      const [{ data: wallet }, { data: transactions }, { data: deposits }, { data: billingSettings }] = await Promise.all([
        supabase.from("wallets").select("balance,currency,updated_at").eq("account_id", account.id).single(),
        supabase.from("wallet_transactions").select("*").eq("account_id", account.id).order("created_at", { ascending: false }).limit(100),
        supabase.from("deposit_requests").select("*").eq("account_id", account.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("access_billing_settings").select("booking_credit_cost").eq("singleton", true).single(),
      ]);
      return json({ account, permissions, billingSettings: billingSettings || { booking_credit_cost: 1 }, wallet: wallet || { balance: 0, currency: "CREDIT" }, transactions: transactions || [], deposits: deposits || [] });
    }

    if (path === "/deposits" && req.method === "POST") {
      if (!permissions["wallet.deposit"]) throw { statusCode: 403, message: "Deposit permission is required" };
      const body = await req.json();
      const amount = Number(body.amount);
      const paymentMethod = String(body.paymentMethod || "").trim();
      const paymentReference = String(body.paymentReference || "").trim();
      const note = String(body.note || "").trim();
      if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
        throw { statusCode: 400, message: "Deposit amount must be between 0 and 1,000,000" };
      }
      if (!paymentMethod || paymentMethod.length > 80 || paymentReference.length > 160 || note.length > 500) {
        throw { statusCode: 400, message: "Invalid deposit details" };
      }
      const { count } = await supabase
        .from("deposit_requests")
        .select("id", { count: "exact", head: true })
        .eq("account_id", account.id)
        .eq("status", "PENDING");
      if ((count || 0) >= 5) throw { statusCode: 409, message: "Resolve existing pending deposits before creating another" };

      const { data: deposit, error } = await supabase.from("deposit_requests").insert({
        account_id: account.id,
        amount,
        payment_method: paymentMethod,
        payment_reference: paymentReference || null,
        user_note: note || null,
      }).select().single();
      if (error) throw error;
      await supabase.from("access_audit_log").insert({
        actor_account_id: account.id,
        target_account_id: account.id,
        action: "deposit.requested",
        details: { deposit_id: deposit.id, amount },
      });
      return json({ message: "Deposit request submitted", deposit }, 201);
    }

    return json({ message: "Not found" }, 404);
  } catch (error: any) {
    return json({ message: error?.message || "Internal server error" }, error?.statusCode || 500);
  }
});
