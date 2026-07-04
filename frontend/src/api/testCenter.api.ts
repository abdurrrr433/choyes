import { apiTestCenter } from "@/lib/api";

// Real calls against supabase/functions/test-center-owner, backed by the
// public.test_center_owners table (see migration 20260705120000_test_center_owners.sql).
// Response shape is normalized to { data: ... } to match the pre-existing
// `resp?.data ?? resp` handling in useTestCenterAccess.ts.
class TestCenterApi {
  validateAccess(testCenterId: string | number) {
    return apiTestCenter(`/validate-access/${testCenterId}`).then((data) => ({ data }));
  }

  checkUserIsTestCenterOwner() {
    return apiTestCenter("/owner-status").then((data) => ({ data }));
  }

  getTestCenterById(testCenterId: string | number) {
    return apiTestCenter(`/test-centers/${testCenterId}`).then((data) => ({ data }));
  }
}

export default new TestCenterApi();
