import { describe, it, expect } from "vitest";
import {
  buildCenterOptions,
  getCenterKey,
  getSessionCenterName,
  getSessionId,
  getSessionSiteCity,
} from "./booking-utils";

/**
 * Integration test mirroring the real SVP /exam_sessions payload shape where
 * every session has site_id=null and no test_center_id — only city is reliable.
 * The booking UI must:
 *   1. Group all same-city sessions under ONE test-center option in the dropdown.
 *   2. Resolve that option's label to the canonical name from public.test_centers
 *      (looked up by city when no site_id is available).
 *   3. Still expose every distinct exam_session_id when the city is selected.
 */

const SVP_PAYLOAD = {
  exam_sessions: [
    { id: 1474283, test_center: { city: "Rajshahi", site_id: null }, start_date_in_browser_time_zone: "2026-05-21", status: "scheduled" },
    { id: 1439016, test_center: { city: "Rajshahi", site_id: null }, start_date_in_browser_time_zone: "2026-05-21", status: "scheduled" },
    { id: 1456242, test_center: { city: "Rajshahi", site_id: null }, start_date_in_browser_time_zone: "2026-05-21", status: "scheduled" },
    { id: 1438988, test_center: { city: "Rajshahi", site_id: null }, start_date_in_browser_time_zone: "2026-05-21", status: "scheduled" },
    { id: 1456241, test_center: { city: "Rajshahi", site_id: null }, start_date_in_browser_time_zone: "2026-05-21", status: "scheduled" },
    { id: 1474282, test_center: { city: "Rajshahi", site_id: null }, start_date_in_browser_time_zone: "2026-05-21", status: "scheduled" },
    // Mixed-city to prove city-selection filtering works
    { id: 2000001, test_center: { city: "Dhaka", site_id: null }, start_date_in_browser_time_zone: "2026-05-21", status: "scheduled" },
    { id: 2000002, test_center: { city: "Dhaka", site_id: null }, start_date_in_browser_time_zone: "2026-05-21", status: "scheduled" },
  ],
};

// Simulates BookingPage's city-fallback DB lookup for public.test_centers
function buildCityNameMap(sessions: any[], dbRows: { city: string; name: string }[]) {
  const byCity = new Map<string, string>();
  dbRows.forEach((r) => {
    const c = String(r.city || "").trim().toLowerCase();
    if (c && !byCity.has(c)) byCity.set(c, r.name);
  });
  const map = new Map<string, string>();
  sessions.forEach((s) => {
    const key = getCenterKey(s);
    if (!key.startsWith("city:")) return;
    const c = String(getSessionSiteCity(s)).trim().toLowerCase();
    const name = byCity.get(c);
    if (name && !map.has(key)) map.set(key, name);
  });
  return map;
}

describe("BookingPage integration: SVP sessions with site_id=null grouped by city", () => {
  const sessions = SVP_PAYLOAD.exam_sessions;
  const dbRows = [
    { city: "Rajshahi", name: "Rajshahi Technical Training Centre" },
    { city: "Dhaka", name: "Dhaka Skills Center" },
  ];

  it("all six Rajshahi sessions share the same center key", () => {
    const rajshahi = sessions.filter((s) => s.test_center.city === "Rajshahi");
    const keys = new Set(rajshahi.map(getCenterKey));
    expect(keys.size).toBe(1);
    expect([...keys][0]).toBe("city:rajshahi");
  });

  it("buildCenterOptions emits ONE option per city (not per random session id)", () => {
    const opts = buildCenterOptions(sessions);
    expect(opts).toHaveLength(2);
    expect(opts.map((o) => o.siteId).sort()).toEqual(["city:dhaka", "city:rajshahi"]);
  });

  it("city-based DB lookup resolves the canonical test center name for all Rajshahi sessions", () => {
    const map = buildCityNameMap(sessions, dbRows);
    const rajshahi = sessions.filter((s) => s.test_center.city === "Rajshahi");
    rajshahi.forEach((s) => {
      const name = map.get(getCenterKey(s)) || getSessionCenterName(s);
      expect(name).toBe("Rajshahi Technical Training Centre");
    });
  });

  it("Dhaka sessions resolve to the Dhaka center name", () => {
    const map = buildCityNameMap(sessions, dbRows);
    const dhaka = sessions.filter((s) => s.test_center.city === "Dhaka");
    dhaka.forEach((s) => {
      const name = map.get(getCenterKey(s)) || getSessionCenterName(s);
      expect(name).toBe("Dhaka Skills Center");
    });
  });

  it("selecting a city exposes ALL of that city's exam_session_ids", () => {
    const selectedCity = "Rajshahi";
    const filtered = sessions.filter(
      (s) => String(getSessionSiteCity(s)).toLowerCase() === selectedCity.toLowerCase()
    );
    const ids = filtered.map(getSessionId);
    expect(ids).toEqual(["1474283", "1439016", "1456242", "1438988", "1456241", "1474282"]);
    // And no Dhaka ids leaked in
    expect(ids).not.toContain("2000001");
  });

  it("when DB has no row for a city, falls back to synthesized city-based name (no random id)", () => {
    const map = buildCityNameMap(sessions, []); // empty DB
    const s = sessions[0];
    const label = map.get(getCenterKey(s)) || getSessionCenterName(s);
    // getSessionCenterName synthesizes "<city>" when no site_id present
    expect(label).toContain("Rajshahi");
    // Critically: must NOT contain the random session id
    expect(label).not.toContain("1474283");
  });
});
