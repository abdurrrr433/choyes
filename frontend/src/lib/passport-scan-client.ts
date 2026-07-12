// Passport auto-fill client.
//
// The passport-scan endpoint lives on the FastAPI backend (port 8001, mounted
// at `/api/passport-scan` via the Kubernetes ingress in the Emergent preview
// environment). It is a separate concern from the Supabase / Railway SVP proxy
// used by the rest of the auth flow — that's why this client does NOT reuse
// `/lib/api.ts`.
//
// For non-preview deployments, set VITE_PASSPORT_SCAN_URL to an absolute URL
// (e.g. "https://your-fastapi.example.com/api/passport-scan").

export interface PassportScanData {
  passport_number: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;             // ISO YYYY-MM-DD (fits <input type="date"> directly)
  passport_expiration_date: string;  // ISO YYYY-MM-DD
  sex: "male" | "female" | "";
  nationality_code: string;          // 3-letter ISO ("BGD")
  country_code: string;              // 2-letter ISO ("BD")
  issuing_country: string;           // e.g. "BANGLADESH"
  confidence: "high" | "medium" | "low";
  raw?: string;
}

export interface PassportScanResponse {
  ok: boolean;
  data: PassportScanData;
}

const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"] as const;

function resolveScanUrl(): string {
  const override = import.meta.env.VITE_PASSPORT_SCAN_URL as string | undefined;
  if (override && override.trim()) return override.replace(/\/$/, "");
  // Relative URL — routed to the FastAPI backend by the Emergent preview ingress.
  return "/api/passport-scan";
}

export function isSupportedPassportImage(file: File): boolean {
  const mime = (file.type || "").toLowerCase();
  return ACCEPTED_MIME_TYPES.includes(mime as (typeof ACCEPTED_MIME_TYPES)[number]);
}

export async function scanPassport(file: File): Promise<PassportScanData> {
  if (!isSupportedPassportImage(file)) {
    throw new Error("Please upload a JPEG, PNG or WEBP passport photo for auto-fill (PDF not supported).");
  }
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(resolveScanUrl(), { method: "POST", body: form });
  const text = await res.text();
  let body: any;
  try { body = text ? JSON.parse(text) : null; } catch { body = { detail: text }; }

  if (!res.ok) {
    const message = body?.detail || body?.message || `Passport scan failed (HTTP ${res.status})`;
    throw new Error(String(message));
  }
  if (!body?.ok || !body?.data) {
    throw new Error("Passport scan returned an unexpected response.");
  }
  return body.data as PassportScanData;
}
