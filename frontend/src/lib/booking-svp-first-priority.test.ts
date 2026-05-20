// Regression tests for the SVP-first priority in resolveSessionCenter.
//
// User-reported bug: "exam_session অনুযায়ী সঠিক test_center name show করে না...
//   প্রতিটা টেস্ট সেন্টার জন্য আলাদা id আছে... যেকোনো সেশন আলাদা আলাদা হক
//   কিন্তু যেটা available আছে অই অই সেশন test center name show করবে"
//
// Translation: For each exam_session the correct test_center name must show.
// Each test center has a different id. Sessions are distinct — each must show
// its own real test_center name.
//
// Pre-fix behaviour: admin overrides (`exam_session_centers`) and section rules
// took priority OVER the SVP-provided `test_center.test_center_name`. So when
// one city had multiple test centers, an admin/rule override could collapse
// every session in that city to a single (wrong) center name.
//
// Post-fix behaviour: when SVP itself provides BOTH `test_center.test_center_name`
// AND `test_center.test_center_id`, that explicit answer wins. Admin overrides
// + section rules only kick in for legacy SVP responses (site_id=null, no name).

import { describe, it, expect } from "vitest";
import { resolveSessionCenter, SectionCenterRule } from "./booking-utils";

const SESSION_70 = {
  id: 1396416,
  test_center: {
    test_center_id: 70,
    site_id: null,
    test_center_city: "Mymensingh",
    test_center_name: "Mymensingh Technical Training Centre",
  },
};

const SESSION_71_SAME_CITY = {
  id: 1396500,
  test_center: {
    test_center_id: 71,
    site_id: null,
    test_center_city: "Mymensingh",
    test_center_name: "Mymensingh Vocational Institute",
  },
};

// Legacy SVP shape — no id, no name. Admin override should still apply here.
const LEGACY_SESSION = {
  id: 1399999,
  site_id: null,
  test_center: { city: "Rajshahi" },
};

describe("SVP-first priority — explicit test_center_name + test_center_id always wins", () => {
  it("admin override (sessionIdToSiteId) does NOT mask the real SVP test_center_name", () => {
    // Admin previously mapped session 1396416 -> site_id 999 (a different center).
    const adminMap = new Map<string, string>([["1396416", "999"]]);
    const testCenterMap = new Map<string, string>([
      ["site:999", "Old Mapped Center (Should NOT Show)"],
    ]);
    const out = resolveSessionCenter(SESSION_70, testCenterMap, new Map(), adminMap, undefined);
    expect(out.test_center.name).toBe("Mymensingh Technical Training Centre");
    expect(String(out.test_center.site_id)).toBe("70");
  });

  it("section_center_rules do NOT mask the real SVP test_center_name", () => {
    const rules: SectionCenterRule[] = [
      { id: "r1", city: "Mymensingh", category_id: null, section: null, site_id: 555, priority: 100 },
    ];
    const testCenterMap = new Map<string, string>([
      ["site:555", "Rule-Mapped Center (Should NOT Show)"],
    ]);
    const out = resolveSessionCenter(SESSION_70, testCenterMap, new Map(), undefined, rules);
    expect(out.test_center.name).toBe("Mymensingh Technical Training Centre");
    expect(String(out.test_center.site_id)).toBe("70");
  });

  it("two sessions in the SAME city with DIFFERENT test_center_ids each keep their own name", () => {
    // A section rule that would collapse both to a single name if priority was wrong.
    const rules: SectionCenterRule[] = [
      { id: "r1", city: "Mymensingh", category_id: null, section: null, site_id: 555, priority: 100 },
    ];
    const testCenterMap = new Map<string, string>([
      ["site:555", "Collapsed Wrong Name"],
    ]);
    const r1 = resolveSessionCenter(SESSION_70, testCenterMap, new Map(), undefined, rules);
    const r2 = resolveSessionCenter(SESSION_71_SAME_CITY, testCenterMap, new Map(), undefined, rules);
    expect(r1.test_center.name).toBe("Mymensingh Technical Training Centre");
    expect(String(r1.test_center.site_id)).toBe("70");
    expect(r2.test_center.name).toBe("Mymensingh Vocational Institute");
    expect(String(r2.test_center.site_id)).toBe("71");
    // They MUST resolve to different keys so the booking page treats them as
    // separate options in the Test Center dropdown.
    expect(r1.test_center.site_id).not.toEqual(r2.test_center.site_id);
  });

  it("legacy SVP shape (no name, no id) STILL respects admin override (backwards compatible)", () => {
    const adminMap = new Map<string, string>([["1399999", "107"]]);
    const testCenterMap = new Map<string, string>([
      ["site:107", "Bogura Technical Training Centre"],
    ]);
    const out = resolveSessionCenter(LEGACY_SESSION, testCenterMap, new Map(), adminMap, undefined);
    expect(out.test_center.name).toBe("Bogura Technical Training Centre");
    expect(String(out.test_center.site_id)).toBe("107");
  });

  it("legacy SVP shape (no name, no id) STILL respects section rules (backwards compatible)", () => {
    const rules: SectionCenterRule[] = [
      { id: "r1", city: "Rajshahi", category_id: null, section: null, site_id: 54, priority: 50 },
    ];
    const testCenterMap = new Map<string, string>([
      ["site:54", "Rajshahi Technical Training Centre"],
    ]);
    const out = resolveSessionCenter(LEGACY_SESSION, testCenterMap, new Map(), undefined, rules);
    expect(out.test_center.name).toBe("Rajshahi Technical Training Centre");
    expect(String(out.test_center.site_id)).toBe("54");
  });

  it("SVP gives ONLY name (no test_center_id) — admin override still allowed (not authoritative yet)", () => {
    const adminMap = new Map<string, string>([["7777", "999"]]);
    const testCenterMap = new Map<string, string>([["site:999", "Admin-Picked Center"]]);
    const session = { id: 7777, test_center: { test_center_name: "Half-info Center" } };
    const out = resolveSessionCenter(session, testCenterMap, new Map(), adminMap, undefined);
    // SVP authoritative requires BOTH name AND id — here id is missing, so admin wins.
    expect(out.test_center.name).toBe("Admin-Picked Center");
    expect(String(out.test_center.site_id)).toBe("999");
  });
});
