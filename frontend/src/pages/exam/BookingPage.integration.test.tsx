// Integration test: verifies the DB name→site_id lookup correctly
// stamps site_id onto sessions that arrive from SVP without one.

import { describe, it, expect, vi } from "vitest";
import { resolveSessionCenter } from "@/lib/booking-utils";

vi.mock("@/integrations/supabase/client", () => {
  const rows = [
    { site_id: 107, name: "Technical Training Centre (TTC), Bogura", city: "Bogura" },
    { site_id: 55,  name: "Rajshahi TTC", city: "Rajshahi" },
  ];
  const makeChain = (fr: typeof rows) => {
    const c: any = {
      select(_cols?: string) { return c; },
      eq(col: string, val: any) {
        return makeChain(rows.filter((r: any) => String(r[col as keyof typeof r]) === String(val)));
      },
      order() { return c; },
      in(col: string, vals: any[]) {
        return Promise.resolve({
          data: fr.filter((r: any) => vals.map(String).includes(String(r[col as keyof typeof r]))),
          error: null,
        });
      },
      then(resolve: any) {
        return Promise.resolve({ data: fr, error: null }).then(resolve);
      },
    };
    return c;
  };
  return { supabase: { from: () => makeChain(rows) } };
});

import { supabase } from "@/integrations/supabase/client";

// Build centerNameToSiteId map the same way BookingPage.tsx does
async function buildNameMap(names: string[]): Promise<Map<string, string>> {
  const { data: dbRows } = await (supabase as any)
    .from("test_centers")
    .select("site_id, name")
    .in("name", names);
  return new Map<string, string>(
    (dbRows || []).map((r: any) => [String(r.name).trim().toLowerCase(), String(r.site_id)])
  );
}

// resolveSessionCenter(item, testCenterMap, centerNameToSiteId, sessionIdToSiteId?, sectionRules?)
// testCenterMap uses "session:{id}" / "site:{siteId}" prefixed keys
// centerNameToSiteId uses lowercase name keys
const emptyTestCenterMap = new Map<string, string>();
const emptySessionMap = new Map<string, string>();

describe("BookingPage integration: DB name→site_id stamping via resolveSessionCenter", () => {
  it("stamps site_id=107 onto a Bogura session that arrives with null site_id", async () => {
    const session = {
      id: 9001,
      site_id: null,
      site_city: "Bogura",
      test_center: {
        name: "Technical Training Centre (TTC), Bogura",
        city: "Bogura",
        site_id: null,
        test_center_id: null,
      },
    };

    const nameMap = await buildNameMap(["Technical Training Centre (TTC), Bogura"]);
    const resolved = resolveSessionCenter(session, emptyTestCenterMap, nameMap, emptySessionMap);

    expect(resolved.site_id).toBe("107");
    expect(resolved.test_center?.site_id).toBe("107");
    expect(resolved.test_center?.name).toBe("Technical Training Centre (TTC), Bogura");
  });

  it("stamps site_id=55 for Rajshahi session via name match", async () => {
    const session = {
      id: 9003,
      site_id: null,
      site_city: "Rajshahi",
      test_center: { name: "Rajshahi TTC", city: "Rajshahi", site_id: null },
    };

    const nameMap = await buildNameMap(["Rajshahi TTC"]);
    const resolved = resolveSessionCenter(session, emptyTestCenterMap, nameMap, emptySessionMap);

    expect(resolved.site_id).toBe("55");
  });

  it("returns session unchanged when no DB row matches the center name", async () => {
    const session = {
      id: 9002,
      site_id: null,
      site_city: "Khulna",
      test_center: { name: "Unknown Center Khulna", city: "Khulna", site_id: null },
    };

    const nameMap = await buildNameMap(["Unknown Center Khulna"]);
    const resolved = resolveSessionCenter(session, emptyTestCenterMap, nameMap, emptySessionMap);

    expect(resolved.site_id == null || resolved.site_id === "").toBe(true);
  });

  it("does not overwrite a session that already has SVP-provided site_id + name", async () => {
    const session = {
      id: 9004,
      site_id: "200",
      site_city: "Dhaka",
      test_center: {
        name: "Bangladesh Korea TTC Dhaka",
        city: "Dhaka",
        site_id: "200",
        test_center_id: "200",
      },
    };

    // Even with a conflicting DB entry, SVP-authoritative data wins
    const conflictingNameMap = new Map([["bangladesh korea ttc dhaka", "999"]]);
    const resolved = resolveSessionCenter(session, emptyTestCenterMap, conflictingNameMap, emptySessionMap);

    expect(resolved.site_id).toBe("200");
  });
});
