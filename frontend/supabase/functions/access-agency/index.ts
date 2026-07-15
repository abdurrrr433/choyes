import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JWT_SECRET_RAW = Deno.env.get("JWT_ACCESS_SECRET");
if (!JWT_SECRET_RAW) throw new Error("JWT_ACCESS_SECRET is required");
const USER_PERMISSION_KEYS = ["booking.create", "reservation.manage", "payment.create", "wallet.deposit"] as const;
type UserPermissionKey = typeof USER_PERMISSION_KEYS[number];

async function getJwtKey() {
  const encoder = new TextEncoder();
  return await crypto.subtle.importKey(
    "raw", encoder.encode(JWT_SECRET_RAW),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]
  );
}

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function publicAccount(a: any) {
  return {
    id: a.id, name: a.name, email: a.email, role: a.role, status: a.status,
    agency_id: a.agency_id, created_by_id: a.created_by_id,
    permission_mode: a.permission_mode || "LEGACY", self_registered: Boolean(a.self_registered),
    created_at: a.created_at, updated_at: a.updated_at,
  };
}

function effectiveUserPermissions(mode: string, rows: Array<{ permission_key: string; allowed: boolean }>) {
  const permissions: Record<UserPermissionKey, boolean> = mode === "MANAGED"
    ? Object.fromEntries(USER_PERMISSION_KEYS.map((key) => [key, false])) as Record<UserPermissionKey, boolean>
    : {
      "booking.create": true,
      "reservation.manage": true,
      "payment.create": true,
      "wallet.deposit": false,
    };
  for (const row of rows) {
    if (USER_PERMISSION_KEYS.includes(row.permission_key as UserPermissionKey)) {
      permissions[row.permission_key as UserPermissionKey] = Boolean(row.allowed);
    }
  }
  return permissions;
}

async function getAuth(req: Request) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  try {
    const key = await getJwtKey();
    return await verify(token, key) as { sub: string; role: string };
  } catch { return null; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await getAuth(req);
  if (!auth || auth.role !== "AGENCY") {
    return new Response(JSON.stringify({ message: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/access-agency/, "");
  const supabase = getSupabase();

  const { data: actorAccount } = await supabase.from("accounts")
    .select("id,role,status,permission_mode")
    .eq("id", auth.sub)
    .single();
  if (!actorAccount || actorAccount.role !== "AGENCY" || actorAccount.status !== "ACTIVE") {
    return new Response(JSON.stringify({ message: "Agency account is not active" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // POST /users
    if (path === "/users" && req.method === "POST") {
      const { data: userCreatePermission } = await supabase.from("account_permissions")
        .select("allowed").eq("account_id", auth.sub).eq("permission_key", "users.create").single();
      const canCreateUsers = actorAccount.permission_mode !== "MANAGED" || userCreatePermission?.allowed === true;
      if (!canCreateUsers) {
        return new Response(JSON.stringify({ message: "User creation permission is required" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { name, email, password, status } = await req.json();
      if (!name || !email || !password) {
        return new Response(JSON.stringify({ message: "name, email, password required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: existing } = await supabase.from("accounts").select("id").eq("email", email.toLowerCase()).single();
      if (existing) {
        return new Response(JSON.stringify({ message: "Email already in use" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const hash = bcrypt.hashSync(password);
      const { data: account, error } = await supabase.from("accounts").insert({
        name, email: email.toLowerCase(), password: hash,
        role: "USER", status: status || "PENDING",
        agency_id: auth.sub, created_by_id: auth.sub,
        permission_mode: "MANAGED",
      }).select().single();

      if (error) throw error;
      return new Response(JSON.stringify({ message: "User created", user: publicAccount(account) }), {
        status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET/PUT /users/:id/permissions. The ownership filters are mandatory:
    // an agency can never inspect or modify another agency's user.
    const permissionMatch = path.match(/^\/users\/([^/]+)\/permissions$/);
    if (permissionMatch && (req.method === "GET" || req.method === "PUT")) {
      const accountId = permissionMatch[1];
      const { data: target } = await supabase.from("accounts")
        .select("id,name,email,role,status,agency_id,permission_mode")
        .eq("id", accountId)
        .eq("role", "USER")
        .eq("agency_id", auth.sub)
        .single();
      if (!target) {
        return new Response(JSON.stringify({ message: "User not found under this agency" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (req.method === "GET") {
        const { data: rows, error } = await supabase.from("account_permissions")
          .select("permission_key,allowed,note,updated_at")
          .eq("account_id", accountId)
          .in("permission_key", [...USER_PERMISSION_KEYS]);
        if (error) throw error;
        return new Response(JSON.stringify({
          user: publicAccount(target),
          permissions: effectiveUserPermissions(target.permission_mode || "LEGACY", rows || []),
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const body = await req.json();
      const input = body.permissions && typeof body.permissions === "object" ? body.permissions : {};
      const note = String(body.note || "Agency managed permission update").slice(0, 500);
      const rows = USER_PERMISSION_KEYS.map((permissionKey) => ({
        account_id: accountId,
        permission_key: permissionKey,
        allowed: input[permissionKey] === true,
        granted_by: auth.sub,
        note: note || null,
        updated_at: new Date().toISOString(),
      }));
      const { error: permissionError } = await supabase.from("account_permissions")
        .upsert(rows, { onConflict: "account_id,permission_key" });
      if (permissionError) throw permissionError;
      const { error: accountError } = await supabase.from("accounts")
        .update({ permission_mode: "MANAGED" })
        .eq("id", accountId)
        .eq("role", "USER")
        .eq("agency_id", auth.sub);
      if (accountError) throw accountError;
      await supabase.from("access_audit_log").insert({
        actor_account_id: auth.sub,
        target_account_id: accountId,
        action: "agency.permissions.updated",
        details: { permissions: Object.fromEntries(rows.map((row) => [row.permission_key, row.allowed])) },
      });
      return new Response(JSON.stringify({
        message: "User permissions updated",
        permissions: Object.fromEntries(rows.map((row) => [row.permission_key, row.allowed])),
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /users/:id/wallet — child balance, immutable ledger and deposits.
    const walletMatch = path.match(/^\/users\/([^/]+)\/wallet$/);
    if (walletMatch && req.method === "GET") {
      const accountId = walletMatch[1];
      const { data: target } = await supabase.from("accounts")
        .select("id,name,email,role,status,agency_id")
        .eq("id", accountId).eq("role", "USER").eq("agency_id", auth.sub).single();
      if (!target) {
        return new Response(JSON.stringify({ message: "User not found under this agency" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const [walletResult, transactionResult, depositResult] = await Promise.all([
        supabase.from("wallets").select("balance,currency,updated_at").eq("account_id", accountId).single(),
        supabase.from("wallet_transactions").select("*").eq("account_id", accountId).order("created_at", { ascending: false }).limit(100),
        supabase.from("deposit_requests").select("*").eq("account_id", accountId).order("created_at", { ascending: false }).limit(50),
      ]);
      if (transactionResult.error) throw transactionResult.error;
      if (depositResult.error) throw depositResult.error;
      return new Response(JSON.stringify({
        user: publicAccount(target),
        wallet: walletResult.data || { balance: 0, currency: "CREDIT" },
        transactions: transactionResult.data || [],
        deposits: depositResult.data || [],
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /users/:id/wallet-adjustments — manual credit/debit for an owned child only.
    const walletAdjustmentMatch = path.match(/^\/users\/([^/]+)\/wallet-adjustments$/);
    if (walletAdjustmentMatch && req.method === "POST") {
      const accountId = walletAdjustmentMatch[1];
      const { data: target } = await supabase.from("accounts")
        .select("id,role,agency_id")
        .eq("id", accountId).eq("role", "USER").eq("agency_id", auth.sub).single();
      if (!target) {
        return new Response(JSON.stringify({ message: "User not found under this agency" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const body = await req.json();
      const amount = Number(body.amount);
      const direction = body.direction === "debit" ? "debit" : "credit";
      const description = String(body.description || "Agency manual wallet adjustment").trim().slice(0, 500);
      if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
        return new Response(JSON.stringify({ message: "Amount must be between 0.01 and 1,000,000" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const requestId = crypto.randomUUID();
      const { data: transaction, error } = await supabase.rpc("wallet_post_adjustment", {
        p_account_id: accountId,
        p_amount: amount,
        p_direction: direction,
        p_transaction_type: direction === "credit" ? "agency_credit" : "agency_debit",
        p_idempotency_key: `agency:${auth.sub}:${requestId}`,
        p_description: description,
        p_created_by: auth.sub,
        p_reference_type: "agency_adjustment",
        p_reference_id: requestId,
        p_metadata: { actor_role: "AGENCY", agency_id: auth.sub },
      });
      if (error) {
        const message = error.message?.includes("insufficient wallet balance")
          ? "Insufficient user balance for this debit" : error.message;
        return new Response(JSON.stringify({ message: message || "Wallet adjustment failed" }), {
          status: error.message?.includes("insufficient wallet balance") ? 409 : 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabase.from("access_audit_log").insert({
        actor_account_id: auth.sub, target_account_id: accountId,
        action: `agency.wallet.${direction}`,
        details: { amount, transaction_id: transaction?.id, description },
      });
      return new Response(JSON.stringify({ message: "User wallet updated", transaction }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PATCH /users/:id/deposits/:depositId — approve/reject this child's request.
    const childDepositMatch = path.match(/^\/users\/([^/]+)\/deposits\/([^/]+)$/);
    if (childDepositMatch && req.method === "PATCH") {
      const accountId = childDepositMatch[1];
      const depositId = childDepositMatch[2];
      const [{ data: target }, { data: deposit }] = await Promise.all([
        supabase.from("accounts").select("id").eq("id", accountId).eq("role", "USER").eq("agency_id", auth.sub).single(),
        supabase.from("deposit_requests").select("id,account_id,status").eq("id", depositId).eq("account_id", accountId).single(),
      ]);
      if (!target || !deposit) {
        return new Response(JSON.stringify({ message: "Deposit not found under this agency user" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const body = await req.json();
      const action = String(body.action || "").toLowerCase();
      const rpcName = action === "approve" ? "wallet_approve_deposit" : action === "reject" ? "wallet_reject_deposit" : "";
      if (!rpcName) {
        return new Response(JSON.stringify({ message: "Action must be approve or reject" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const note = String(body.note || "").slice(0, 500) || null;
      const { data: result, error } = await supabase.rpc(rpcName, {
        p_deposit_id: depositId, p_admin_id: auth.sub, p_admin_note: note,
      });
      if (error) {
        return new Response(JSON.stringify({ message: error.message || "Deposit processing failed" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabase.from("access_audit_log").insert({
        actor_account_id: auth.sub, target_account_id: accountId,
        action: `agency.deposit.${action}`, details: { deposit_id: depositId, note },
      });
      return new Response(JSON.stringify({ message: `Deposit ${action}d`, result }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PATCH /users/:id/status
    const statusMatch = path.match(/^\/users\/([^/]+)\/status$/);
    if (statusMatch && req.method === "PATCH") {
      const id = statusMatch[1];
      const { status } = await req.json();
      if (!["PENDING", "ACTIVE", "BLOCKED"].includes(status)) {
        return new Response(JSON.stringify({ message: "Invalid status" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: account } = await supabase.from("accounts").select("*").eq("id", id).eq("agency_id", auth.sub).single();
      if (!account) {
        return new Response(JSON.stringify({ message: "User not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabase.from("accounts").update({ status }).eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ message: "Status updated" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PATCH /users/:id/password
    const pwMatch = path.match(/^\/users\/([^/]+)\/password$/);
    if (pwMatch && req.method === "PATCH") {
      const id = pwMatch[1];
      const { password } = await req.json();
      if (!password || password.length < 8) {
        return new Response(JSON.stringify({ message: "Password must be at least 8 characters" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: account } = await supabase.from("accounts").select("id").eq("id", id).eq("agency_id", auth.sub).single();
      if (!account) {
        return new Response(JSON.stringify({ message: "User not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const hash = bcrypt.hashSync(password);
      const { error } = await supabase.from("accounts").update({ password: hash }).eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ message: "Password updated successfully" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /users
    if (path === "/users" && req.method === "GET") {
      const { data: users, error } = await supabase
        .from("accounts").select("*")
        .eq("agency_id", auth.sub).eq("role", "USER")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return new Response(JSON.stringify({ users: (users || []).map(publicAccount) }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ message: "Not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ message: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
