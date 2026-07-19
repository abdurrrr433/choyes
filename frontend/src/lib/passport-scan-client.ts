// Passport auto-fill client.
//
// Passport OCR is exposed by the Railway backend. An explicit URL still wins,
// which is useful for isolated testing and alternate deployments.
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
const DEFAULT_RAILWAY_URL = "https://choyes-production.up.railway.app";

function resolveScanUrl(): string {
  const override = import.meta.env.VITE_PASSPORT_SCAN_URL as string | undefined;
  if (override && override.trim()) return override.replace(/\/$/, "");
  const backend = import.meta.env.VITE_BACKEND_URL as string | undefined;
  if (backend && backend.trim()) return `${backend.replace(/\/$/, "")}/api/passport-scan`;
  return `${DEFAULT_RAILWAY_URL}/api/passport-scan`;
}

export function isSupportedPassportImage(file: File): boolean {
  const mime = (file.type || "").toLowerCase();
  if (ACCEPTED_MIME_TYPES.includes(mime as (typeof ACCEPTED_MIME_TYPES)[number])) return true;
  return !mime && /\.(?:jpe?g|png|webp)$/i.test(file.name);
}

export async function scanPassport(file: File): Promise<PassportScanData> {
  if (!isSupportedPassportImage(file)) {
    throw new Error("Please upload a JPEG, PNG or WEBP passport photo for auto-fill (PDF not supported).");
  }
  const form = new FormData();
  form.append("file", file);

  let res: Response;
  try {
    res = await fetch(resolveScanUrl(), { method: "POST", body: form });
  } catch {
    throw new Error("Passport auto-fill service could not be reached. Please try again or enter the details manually.");
  }
  const text = await res.text();
  let body: (Partial<PassportScanResponse> & { detail?: unknown; message?: unknown }) | null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }

  if (!res.ok) {
    const message = body?.detail || body?.message || `Passport auto-fill service is unavailable (HTTP ${res.status}).`;
    throw new Error(String(message));
  }
  if (!body?.ok || !body?.data) {
    throw new Error("Passport scan returned an unexpected response.");
  }
  return body.data;
}
