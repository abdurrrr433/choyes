import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ── JWT verify (identical scheme to svp-proxy: same JWT_ACCESS_SECRET,
//    same svp_sessions-backed session lookup) ────────────────────────
async function verifyJwt(token: string): Promise<Record<string, unknown>> {
  const secret = Deno.env.get("JWT_ACCESS_SECRET")!;
  const parts = token.split(".");
  if (parts.length !== 3) throw { statusCode: 401, message: "Invalid token" };

  const keyData = new TextEncoder().encode(secret);
  const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const input = `${parts[0]}.${parts[1]}`;

  const sigB64 = parts[2].replace(/-/g, "+").replace(/_/g, "/");
  const padded = sigB64 + "=".repeat((4 - (sigB64.length % 4)) % 4);
  const sig = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));

  const valid = await crypto.subtle.verify("HMAC", cryptoKey, sig, new TextEncoder().encode(input));
  if (!valid) throw { statusCode: 401, message: "Invalid signature" };

  const claimsB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const claimsPadded = claimsB64 + "=".repeat((4 - (claimsB64.length % 4)) % 4);
  const claims = JSON.parse(atob(claimsPadded));

  if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) {
    throw { statusCode: 401, message: "Token expired" };
  }
  return claims;
}

// Resolves the authenticated request down to the svp_users.id (TEXT PK) that
// public.test_center_owners.user_id references — NOT the upstream SVP token.
async function requireSvpUser(req: Request): Promise<{ svpUserRowId: string }> {
  const hdr = req.headers.get("authorization") || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) throw { statusCode: 401, message: "Missing access token" };

  const claims = await verifyJwt(token);
  const sessionId = claims.sid as string;
  if (!sessionId) throw { statusCode: 401, message: "Missing session" };

  const supabase = getSupabase();
  const { data: session, error } = await supabase
    .from("svp_sessions")
    .select("user_id, revoked_at")
    .eq("id", sessionId)
    .single();

  if (error || !session || session.revoked_at) {
    throw { statusCode: 401, message: "Session revoked" };
  }
  return { svpUserRowId: session.user_id as string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/test-center-owner/, "");

  try {
    const { svpUserRowId } = await requireSvpUser(req);
    const supabase = getSupabase();

    // GET /owner-status — is this user an owner/manager/viewer of ANY test center?
    if (req.method === "GET" && path === "/owner-status") {
      const { data, error } = await supabase
        .from("test_center_owners")
        .select("site_id, role")
        .eq("user_id", svpUserRowId);
      if (error) throw { statusCode: 500, message: error.message };

      return json({
        is_owner: (data || []).length > 0,
        test_centers: data || [],
      });
    }

    // GET /validate-access/:site_id — does this user have access to this specific center?
    const accessMatch = path.match(/^\/validate-access\/([^/]+)$/);
    if (req.method === "GET" && accessMatch) {
      const siteId = Number(accessMatch[1]);
      if (!Number.isFinite(siteId)) {
        return json({ message: "Invalid site_id" }, 400);
      }

      const { data, error } = await supabase
        .from("test_center_owners")
        .select("role")
        .eq("user_id", svpUserRowId)
        .eq("site_id", siteId)
        .maybeSingle();
      if (error) throw { statusCode: 500, message: error.message };

      return json({ access: !!data, role: data?.role ?? null });
    }

    // GET /test-centers/:site_id — center details, gated to owners of that center
    const centerMatch = path.match(/^\/test-centers\/([^/]+)$/);
    if (req.method === "GET" && centerMatch) {
      const siteId = Number(centerMatch[1]);
      if (!Number.isFinite(siteId)) {
        return json({ message: "Invalid site_id" }, 400);
      }

      const { data: owns } = await supabase
        .from("test_center_owners")
        .select("role")
        .eq("user_id", svpUserRowId)
        .eq("site_id", siteId)
        .maybeSingle();
      if (!owns) return json({ message: "Forbidden" }, 403);

      const { data: center, error } = await supabase
        .from("test_centers")
        .select("site_id, name, city, address, country_code")
        .eq("site_id", siteId)
        .single();
      if (error) throw { statusCode: 404, message: "Test center not found" };

      return json({ test_center: center, role: owns.role });
    }

    return json({ error: "Not found" }, 404);
  } catch (err: any) {
    const status = err?.statusCode || 500;
    return json({ message: err?.message || "Server error", details: err?.details }, status);
  }
});
