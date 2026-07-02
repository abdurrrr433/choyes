import { api } from "@/lib/api";

class TestCenterApi {
  validateAccess(testCenterId: string | number) {
    return api(`/test_centers/${testCenterId}/validate_access`);
  }

  checkUserIsTestCenterOwner() {
    return api("/users/me/test_centers/owner");
  }

  getTestCenterById(testCenterId: string | number) {
    return api(`/test_centers/${testCenterId}`);
  }
}

export default new TestCenterApi();
