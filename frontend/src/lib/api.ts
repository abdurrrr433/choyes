const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

// Two possible backends:
//  - Supabase edge functions (primary; used whenever VITE_SUPABASE_URL is set)
//  - The Railway Express backend (frontend/backend/src) as a fallback otherwise.
// Their route shapes differ:
//   Supabase : /functions/v1/svp-proxy  /functions/v1/svp-auth
//   Railway  : /api/svp                 /api/auth
// Both the base URL and path prefixes are resolved together, so switching
// backends never silently hits wrong routes.
//
// Set VITE_BACKEND_URL in your .env (or Vercel env vars) to point at the
// Railway backend. The hardcoded string below is the documented default only —
// change the env var, never the source.
const RAILWAY_URL =
  import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, "") ||
  "https://choyes-production.up.railway.app";
type FunctionKind = "proxy" | "testCenter";

function resolveBackend() {
  if (SUPABASE_URL) {
    return {
      base: `${SUPABASE_URL}/functions/v1`,
      authPrefix: "/svp-auth",
      proxyPrefix: (kind: FunctionKind) => (kind === "proxy" ? "/svp-proxy" : "/test-center-owner"),
    };
  }
  return {
    base: RAILWAY_URL,
    authPrefix: "/api/auth",
    // test-center-owner is a Supabase-only feature (see
    // supabase/functions/test-center-owner) — no Railway equivalent exists yet.
    proxyPrefix: (kind: FunctionKind) => (kind === "proxy" ? "/api/svp" : null),
  };
}

const { base: BASE, authPrefix: AUTH_PREFIX, proxyPrefix: PROXY_PREFIX } = resolveBackend();

function getSession() {
  const accessToken = localStorage.getItem("accessToken");
  const refreshToken = localStorage.getItem("refreshToken");
  const sessionId = localStorage.getItem("sessionId");
  return { accessToken, refreshToken, sessionId };
}

function saveSession(data: { accessToken?: string; refreshToken?: string; sessionId?: string }) {
  if (data.accessToken) localStorage.setItem("accessToken", data.accessToken);
  if (data.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);
  if (data.sessionId) localStorage.setItem("sessionId", data.sessionId);
}

function clearSession() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("sessionId");
}

async function doFetch(url: string, opts: RequestInit) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { res, data };
}

export async function apiAuth<T = any>(
  action: string,
  body: any
): Promise<T> {
  const { res, data } = await doFetch(`${BASE}${AUTH_PREFIX}${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw Object.assign(new Error(data?.message || "Request failed"), { status: res.status, data });

  // Save session tokens if returned
  if (data?.accessToken) saveSession(data);

  return data as T;
}

async function callFunction<T = any>(
  kind: FunctionKind,
  path: string,
  { method = "GET", body, token }: { method?: string; body?: any; token?: string } = {}
): Promise<T> {
  const prefix = PROXY_PREFIX(kind);
  if (!prefix) {
    throw new Error(
      `The "${kind}" API isn't available on the active backend (no Supabase URL configured, ` +
      `and the Railway fallback doesn't implement it yet).`
    );
  }

  const session = getSession();
  let access = token || session.accessToken;

  const makeOpts = (accessToken: string | null): RequestInit => ({
    method,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const shouldRefresh = (status: number, payload: any) => {
    const message = String(payload?.message || payload?.error || "").toLowerCase();
    return status === 401 || (status === 500 && message.includes("token expired"));
  };

  let { res, data } = await doFetch(`${BASE}${prefix}${path}`, makeOpts(access));

  if (shouldRefresh(res.status, data) && session.refreshToken && session.sessionId) {
    try {
      const refreshRes = await doFetch(`${BASE}${AUTH_PREFIX}/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.sessionId, refreshToken: session.refreshToken }),
      });

      if (refreshRes.res.ok && refreshRes.data?.accessToken) {
        access = refreshRes.data.accessToken;
        localStorage.setItem("accessToken", access);
        ({ res, data } = await doFetch(`${BASE}${prefix}${path}`, makeOpts(access)));
      } else if (refreshRes.res.status === 401) {
        clearSession();
      }
    } catch {
      // refresh failed, proceed with original error
    }
  }

  if (!res.ok) {
    const message = data?.message || data?.error || "Request failed";
    throw Object.assign(new Error(message), { status: res.status, data });
  }

  return data as T;
}

export async function api<T = any>(
  path: string,
  opts: { method?: string; body?: any; token?: string } = {}
): Promise<T> {
  return callFunction<T>("proxy", path, opts);
}

// Real calls to the test-center-owner edge function (validate_access, owner-status,
// test center detail) — backed by the public.test_center_owners table, using the
// same SVP session/JWT auth as the rest of the app. See supabase/functions/test-center-owner.
export async function apiTestCenter<T = any>(
  path: string,
  opts: { method?: string; body?: any; token?: string } = {}
): Promise<T> {
  return callFunction<T>("testCenter", path, opts);
}

export { saveSession, clearSession, getSession };

export function getBackendUrl() {
  return BASE;
}

// The correct path prefix to append to getBackendUrl() for direct/raw fetches
// (e.g. streaming a ticket PDF) that bypass api()/callFunction(). Using a
// hardcoded "/svp-proxy" here previously broke the Railway fallback the same
// way api() did.
export function getProxyPrefix(): string {
  const prefix = PROXY_PREFIX("proxy");
  if (!prefix) throw new Error("No proxy backend is configured.");
  return prefix;
}
