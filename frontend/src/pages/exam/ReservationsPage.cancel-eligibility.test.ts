import { describe, it, expect } from "vitest";
import {
  canCancelReservation,
  isReservationFinalized,
  readCancelFlag,
} from "@/lib/reservation-utils";

// Regression suite for the Cancel Reservation button eligibility.
// Reported bug: new SVP payloads carry ONLY `can_be_rescheduled: true`
// (no explicit cancel flag) and the button was greyed out ("Cancel
// unavailable") for reservations that are actually cancellable.

describe("canCancelReservation — explicit SVP flags", () => {
  it("legacy US spelling can_be_canceled: true enables cancel", () => {
    expect(canCancelReservation({ can_be_canceled: true, reservation_status: "Confirmed" })).toBe(true);
  });

  it("UK spelling can_be_cancelled: true enables cancel", () => {
    expect(canCancelReservation({ can_be_cancelled: true, reservation_status: "Confirmed" })).toBe(true);
  });

  it("alias cancellable: true enables cancel", () => {
    expect(canCancelReservation({ cancellable: true, reservation_status: "Confirmed" })).toBe(true);
  });

  it("alias is_cancellable: true enables cancel", () => {
    expect(canCancelReservation({ is_cancellable: true, reservation_status: "Confirmed" })).toBe(true);
  });

  it("string/number truthy variants ('true', 1) are coerced", () => {
    expect(canCancelReservation({ can_be_canceled: "true" })).toBe(true);
    expect(canCancelReservation({ can_cancel: 1 })).toBe(true);
  });

  it("explicit false is respected and OVERRIDES the reschedule fallback", () => {
    expect(
      canCancelReservation({
        can_be_canceled: false,
        can_be_rescheduled: true,
        reservation_status: "Confirmed",
      })
    ).toBe(false);
  });
});

describe("canCancelReservation — new SVP shape fallback", () => {
  it("EXACT REPORTED BUG: only can_be_rescheduled: true (no cancel flag, status Confirmed) enables cancel", () => {
    expect(
      canCancelReservation({
        id: 555,
        reservation_status: "Confirmed",
        can_be_rescheduled: true,
        exam_session: { test_center: { test_center_id: 70, test_center_name: "Mymensingh TTC" } },
      })
    ).toBe(true);
  });

  it("no cancel flag and can_be_rescheduled: false stays disabled", () => {
    expect(canCancelReservation({ reservation_status: "Confirmed", can_be_rescheduled: false })).toBe(false);
  });

  it("no flags at all stays disabled", () => {
    expect(canCancelReservation({ reservation_status: "Confirmed" })).toBe(false);
  });
});

describe("canCancelReservation — finalized reservations are blocked", () => {
  it("status Canceled blocks cancel even with can_be_rescheduled: true", () => {
    expect(canCancelReservation({ reservation_status: "Canceled", can_be_rescheduled: true })).toBe(false);
    expect(canCancelReservation({ reservation_status: "Cancelled", can_be_rescheduled: true })).toBe(false);
  });

  it("status Expired / Attended / Completed / No-show block cancel", () => {
    expect(canCancelReservation({ reservation_status: "Expired", can_be_canceled: true })).toBe(false);
    expect(canCancelReservation({ status: "Attended", can_be_canceled: true })).toBe(false);
    expect(canCancelReservation({ cbt_exam_status: "completed", can_be_canceled: true })).toBe(false);
    expect(canCancelReservation({ reservation_status: "No Show", can_be_canceled: true })).toBe(false);
  });

  it("canceled_at / cancelled_at timestamp blocks cancel even with explicit true flag", () => {
    expect(canCancelReservation({ canceled_at: "2026-01-10T10:00:00Z", can_be_canceled: true })).toBe(false);
    expect(canCancelReservation({ cancelled_at: "2026-01-10T10:00:00Z", cancellable: true })).toBe(false);
  });

  it("isReservationFinalized ignores payment_status (failed payment must not finalize)", () => {
    expect(isReservationFinalized({ payment_status: "canceled", reservation_status: "Confirmed" })).toBe(false);
    expect(isReservationFinalized({ reservation_status: "Canceled" })).toBe(true);
  });
});

describe("canCancelReservation — defensive handling", () => {
  it("null / undefined / empty item stays disabled", () => {
    expect(canCancelReservation(null)).toBe(false);
    expect(canCancelReservation(undefined)).toBe(false);
    expect(canCancelReservation({})).toBe(false);
  });

  it("readCancelFlag returns null when no flag present, boolean when present", () => {
    expect(readCancelFlag({ reservation_status: "Confirmed" })).toBe(null);
    expect(readCancelFlag({ can_be_cancelled: true })).toBe(true);
    expect(readCancelFlag({ is_cancelable: false })).toBe(false);
  });
});
