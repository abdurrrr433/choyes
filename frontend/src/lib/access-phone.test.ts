import { describe, expect, it } from "vitest";
import { normalizeFullPhone } from "../../supabase/functions/_shared/phone";

describe("Access account full phone validation", () => {
  it("normalizes supported international formatting", () => {
    expect(normalizeFullPhone("+880 1712-345678")).toBe("+8801712345678");
    expect(normalizeFullPhone("00880 (1712) 345678")).toBe("+8801712345678");
  });

  it("rejects local, short, and malformed phone numbers", () => {
    expect(normalizeFullPhone("01712345678")).toBeNull();
    expect(normalizeFullPhone("+123")).toBeNull();
    expect(normalizeFullPhone("+88017ABC5678")).toBeNull();
    expect(normalizeFullPhone("")).toBeNull();
  });
});
