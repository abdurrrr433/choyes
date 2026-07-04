// Regression test for the test-center-owner API wiring.
//
// BUG: TestCenterApi previously called `api()` (svp-proxy) with paths like
// `/test_centers/:id/validate_access` and `/users/me/test_centers/owner`.
// svp-proxy's route table has no such routes, so every call 404'd and
// useTestCenterAccess()/useIsTestCenterOwner() always resolved to "denied".
//
// FIX: TestCenterApi now calls apiTestCenter() (the new test-center-owner
// edge function), backed by the real public.test_center_owners table.
//
// This test mocks global.fetch to assert the exact URLs/methods hit, and that
// the {data: ...} response shape still matches what useTestCenterAccess.ts expects.

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

const SUPABASE_URL = "https://test-project.supabase.co";

beforeEach(() => {
  vi.stubEnv("VITE_SUPABASE_URL", SUPABASE_URL);
  localStorage.clear();
  localStorage.setItem("accessToken", "test-access-token");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("TestCenterApi (real test-center-owner wiring)", () => {
  it("validateAccess hits GET /test-center-owner/validate-access/:id with the auth header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ access: true, role: "owner" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { default: TestCenterApi } = await import("./testCenter.api");
    const resp = await TestCenterApi.validateAccess(70);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe(`${SUPABASE_URL}/functions/v1/test-center-owner/validate-access/70`);
    expect(opts.headers.Authorization).toBe("Bearer test-access-token");
    expect(resp.data).toEqual({ access: true, role: "owner" });
  });

  it("checkUserIsTestCenterOwner hits GET /test-center-owner/owner-status", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ is_owner: true, test_centers: [{ site_id: 70, role: "owner" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { default: TestCenterApi } = await import("./testCenter.api");
    const resp = await TestCenterApi.checkUserIsTestCenterOwner();

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(`${SUPABASE_URL}/functions/v1/test-center-owner/owner-status`);
    expect(resp.data.is_owner).toBe(true);
  });

  it("getTestCenterById hits GET /test-center-owner/test-centers/:id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        test_center: { site_id: 70, name: "Mymensingh Technical Training Centre", city: "Mymensingh" },
        role: "owner",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { default: TestCenterApi } = await import("./testCenter.api");
    const resp = await TestCenterApi.getTestCenterById(70);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(`${SUPABASE_URL}/functions/v1/test-center-owner/test-centers/70`);
    expect(resp.data.test_center.name).toBe("Mymensingh Technical Training Centre");
  });

  it("propagates 403 Forbidden as a thrown error (non-owner accessing a center)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ message: "Forbidden" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { default: TestCenterApi } = await import("./testCenter.api");
    await expect(TestCenterApi.getTestCenterById(999)).rejects.toThrow("Forbidden");
  });
});
