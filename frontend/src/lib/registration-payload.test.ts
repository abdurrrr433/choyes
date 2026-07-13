import { describe, it, expect } from "vitest";
import { resolveCountryDialingCode, toApiDate } from "@/lib/registration-payload";

describe("registration-payload · toApiDate", () => {
  it("converts <input type=\"date\"> YYYY-MM-DD to SVP DD/MM/YYYY", () => {
    // Matches the exact real values seen in the Postman capture (28/02/1991, 04/03/2032).
    expect(toApiDate("1991-02-28")).toBe("28/02/1991");
    expect(toApiDate("2032-03-04")).toBe("04/03/2032");
  });

  it("returns empty string for empty input", () => {
    expect(toApiDate("")).toBe("");
  });

  it("leaves already-formatted or manually-typed values untouched", () => {
    // Users who type manually might already enter DD/MM/YYYY — don't corrupt it.
    expect(toApiDate("28/02/1991")).toBe("28/02/1991");
    expect(toApiDate("not-a-date")).toBe("not-a-date");
  });

  it("does not zero-pad or reformat malformed ISO strings", () => {
    // Guard: bare YYYY-MM-DD only; anything else passes through unchanged.
    expect(toApiDate("1991-2-28")).toBe("1991-2-28");
    expect(toApiDate("1991-02-28T00:00:00Z")).toBe("1991-02-28T00:00:00Z");
  });
});

describe("registration-payload · resolveCountryDialingCode", () => {
  it("prefers phone_code and always returns a leading +", () => {
    expect(resolveCountryDialingCode({ id: 1, name: "Bangladesh", phone_code: "880" })).toBe("+880");
    expect(resolveCountryDialingCode({ id: 1, name: "Bangladesh", phone_code: "+880" })).toBe("+880");
  });

  it("accepts alternate dialing-code field names in priority order", () => {
    expect(resolveCountryDialingCode({ dialing_code: "91" })).toBe("+91");
    expect(resolveCountryDialingCode({ calling_code: "1" })).toBe("+1");
    expect(resolveCountryDialingCode({ dial_code: "+44" })).toBe("+44");
    expect(resolveCountryDialingCode({ phone_prefix: "966" })).toBe("+966");
    expect(resolveCountryDialingCode({ international_code: "20" })).toBe("+20");
    expect(resolveCountryDialingCode({ phonecode: "62" })).toBe("+62");
  });

  it("phone_code wins when both a dialing field and an ISO code are present", () => {
    // Bangladesh from the Postman capture — the *real* fix. ISO "BD" must NOT override "+880".
    expect(
      resolveCountryDialingCode({ id: 18, name: "Bangladesh", code: "BD", country_code: "BD", phone_code: "880" }),
    ).toBe("+880");
  });

  it("falls back to ISO code fields only when no dialing field is available", () => {
    // Backwards compat: countries API without dialing fields still returns *something* usable.
    expect(resolveCountryDialingCode({ code: "BD" })).toBe("BD");
    expect(resolveCountryDialingCode({ country_code: "SA" })).toBe("SA");
    expect(resolveCountryDialingCode({ code: "BD", country_code: "OTHER" })).toBe("BD");
  });

  it("returns '' for null / undefined / non-object inputs (never throws)", () => {
    expect(resolveCountryDialingCode(null)).toBe("");
    expect(resolveCountryDialingCode(undefined)).toBe("");
    expect(resolveCountryDialingCode("BD")).toBe("");
    expect(resolveCountryDialingCode(42)).toBe("");
    expect(resolveCountryDialingCode({})).toBe("");
  });

  it("skips blank/whitespace dialing fields and continues to the next candidate", () => {
    expect(resolveCountryDialingCode({ phone_code: "", dialing_code: "880" })).toBe("+880");
    expect(resolveCountryDialingCode({ phone_code: null, calling_code: "44" })).toBe("+44");
    expect(resolveCountryDialingCode({ phone_code: "   ", code: "BD" })).toBe("BD");
  });

  it("accepts numeric dialing codes (SVP sometimes returns numbers not strings)", () => {
    expect(resolveCountryDialingCode({ phone_code: 880 })).toBe("+880");
    expect(resolveCountryDialingCode({ dialing_code: 44 })).toBe("+44");
  });
});
