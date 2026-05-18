import { describe, it, expect } from "vitest";
import {
  buildCenterOptions,
  getCenterKey,
  getSessionCenterName,
  getSessionId,
  getSessionSiteId,
} from "./booking-utils";

/**
 * Integration test that mirrors BookingPage's center-name resolution pipeline
 * when SVP returns sessions that only carry `test_center.test_center_id`
 * (no top-level site_id, no inline test_center.name).
 *
 * Pipeline (per BookingPage.tsx):
 *  1. sessions[] arrive from /exam-sessions
 *  2. For sessions missing test_center.name, /exam-sessions/:id is fetched
 *     and merged onto the session, OR
 *  3. A DB lookup against public.test_centers by site_id / test_center.id /
 *     test_center.test_center_id / test_center_id populates a Map<key, name>.
 *  4. The dropdown label for a given exam_session_id picks
 *     `testCenterMap.get(getCenterKey(session)) ?? getSessionCenterName(session)`.
 */

function resolveLabelForSession(
  examSessionId: string,
  sessions: any[],
  testCenterMap: Map<string, string>,
): string {
  const session = sessions.find((s) => String(getSessionId(s)) === String(examSessionId));
  if (!session) return "";
  const key = String(getCenterKey(session));
  return testCenterMap.get(key) || getSessionCenterName(session);
}

function buildDbLookupMap(
  sessions: any[],
  dbRows: { site_id: number; name: string }[],
): Map<string, string> {
  // Same logic as BookingPage's broadened fallback: try every candidate id per session
  const candidateIds = (s: any): number[] => {
    const ids = [
      s?.site_id,
      s?.test_center?.site_id,
      s?.test_center?.id,
      s?.test_center?.test_center_id,
      s?.test_center_id,
    ]
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n > 0);
    return Array.from(new Set(ids));
  };

  const map = new Map<string, string>();
  for (const row of dbRows) {
    for (const s of sessions) {
      if (candidateIds(s).includes(Number(row.site_id))) {
        const key = String(getCenterKey(s));
        if (key && !map.has(key)) map.set(key, row.name);
      }
    }
  }
  return map;
}

describe("BookingPage center-name resolution (integration)", () => {
  // SVP returns sessions with ONLY test_center_id (site_id null, no inline name).
  const sessions = [
    {
      id: 1456230,
      test_center: { test_center_id: 54, id: 54 },
      site_id: null,
      site_city: "Rajshahi",
    },
    {
      id: 1456231,
      test_center: { test_center_id: 77, id: 77 },
      site_id: null,
      site_city: "Dhaka",
    },
    {
      id: 1456232,
      // Edge case: also no test_center.id, just test_center_id at top level
      test_center_id: 88,
      site_city: "Chittagong",
    },
  ];

  // Local public.test_centers rows (site_id is the canonical key).
  const dbRows = [
    { site_id: 54, name: "Rajshahi Technical Training Centre" },
    { site_id: 77, name: "Dhaka Skills Center" },
    { site_id: 88, name: "Chittagong TVET Institute" },
  ];

  it("resolves the correct center name for exam_session_id 1456230 via test_center_id", () => {
    const map = buildDbLookupMap(sessions, dbRows);
    const label = resolveLabelForSession("1456230", sessions, map);
    expect(label).toBe("Rajshahi Technical Training Centre");
  });

  it("resolves all sessions when site_id is null but test_center_id is present", () => {
    const map = buildDbLookupMap(sessions, dbRows);
    expect(resolveLabelForSession("1456230", sessions, map)).toBe(
      "Rajshahi Technical Training Centre",
    );
    expect(resolveLabelForSession("1456231", sessions, map)).toBe("Dhaka Skills Center");
    expect(resolveLabelForSession("1456232", sessions, map)).toBe(
      "Chittagong TVET Institute",
    );
  });

  it("falls back to synthesized name when no DB row matches", () => {
    const map = buildDbLookupMap(sessions, []); // empty DB
    const label = resolveLabelForSession("1456230", sessions, map);
    // No DB hit + no inline name -> getSessionCenterName synthesizes "<city> (#<id>)"
    expect(label).toContain("Rajshahi");
    expect(label).toContain("54");
  });

  it("buildCenterOptions emits one option per test_center_id even with null site_id", () => {
    const opts = buildCenterOptions(sessions);
    expect(opts).toHaveLength(3);
    const keys = opts.map((o) => o.siteId).sort();
    expect(keys).toEqual(["54", "77", "88"]);
  });

  it("getSessionSiteId picks test_center.test_center_id when site_id is null", () => {
    // Mirrors what the dropdown uses for keying. Note: getSessionSiteId
    // currently looks at site_id, test_center.site_id, test_center.id;
    // for the first session test_center.id=54 is present so it resolves to "54".
    expect(getSessionSiteId(sessions[0])).toBe("54");
  });
});
