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
