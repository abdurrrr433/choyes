// Registration payload helpers for the SVP labor onboarding flow.
// Extracted from RegisterPage.tsx so they can be unit-tested in isolation.
//
// Bug references (Postman capture of a real SVP registration submission):
//   1. SVP wants dates in "DD/MM/YYYY" — HTML <input type="date"> emits "YYYY-MM-DD".
//   2. SVP `country_code` field is a dialing code (e.g. "+880"), NOT an ISO 2-letter code.
//   3. SVP `contact_to_confirm` is an enum ("email" / "phone"), NOT the user's actual address.
//      (Kept as a literal in RegisterPage.tsx; documented here for completeness.)

export function toApiDate(value: string): string {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

const DIALING_KEYS = [
  "phone_code",
  "dialing_code",
  "calling_code",
  "dial_code",
  "phone_prefix",
  "international_code",
  "phonecode",
];

export function resolveCountryDialingCode(country: any): string {
  if (!country || typeof country !== "object") return "";
  for (const key of DIALING_KEYS) {
    const raw = country[key];
    if (raw === null || raw === undefined || raw === "") continue;
    const str = String(raw).trim();
    if (!str) continue;
    return str.startsWith("+") ? str : `+${str}`;
  }
  const legacy = country.code || country.country_code || "";
  return legacy ? String(legacy) : "";
}
