export const FULL_PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;

export function normalizeFullPhone(value: unknown): string | null {
  const compact = String(value ?? "").trim().replace(/[\s()-]/g, "");
  const international = compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
  return FULL_PHONE_PATTERN.test(international) ? international : null;
}

export const FULL_PHONE_ERROR = "Full phone number is required in international format, for example +8801712345678";
