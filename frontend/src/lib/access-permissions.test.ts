import { describe, expect, it } from "vitest";
import { resolveAccessPermission } from "./access-permissions";

describe("resolveAccessPermission", () => {
  it("keeps legacy candidate booking, reservation, and payment behavior", () => {
    const user = { role: "USER" };
    expect(resolveAccessPermission(user, "booking.create")).toBe(true);
    expect(resolveAccessPermission(user, "reservation.manage")).toBe(true);
    expect(resolveAccessPermission(user, "payment.create")).toBe(true);
    expect(resolveAccessPermission(user, "wallet.deposit")).toBe(false);
  });

  it("denies missing permissions for managed accounts", () => {
    const user = { role: "USER", permission_mode: "MANAGED" as const, permissions: {} };
    expect(resolveAccessPermission(user, "booking.create")).toBe(false);
    expect(resolveAccessPermission(user, "reservation.manage")).toBe(false);
  });

  it("honors explicit grants and denials", () => {
    const user = { role: "USER", permissions: { "booking.create": false, "reservation.manage": true, "wallet.deposit": true } };
    expect(resolveAccessPermission(user, "booking.create")).toBe(false);
    expect(resolveAccessPermission(user, "reservation.manage")).toBe(true);
    expect(resolveAccessPermission(user, "wallet.deposit")).toBe(true);
  });

  it("always allows administrators", () => {
    expect(resolveAccessPermission({ role: "ADMIN", permission_mode: "MANAGED", permissions: {} }, "anything")).toBe(true);
  });
});
