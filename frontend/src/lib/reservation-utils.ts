// Reservation-level eligibility helpers shared by ReservationsPage (and tests).
//
// WHY: The new SVP API shape often omits an explicit cancel flag and only
// sends `can_be_rescheduled: true`. The old logic
// (`Boolean(item?.can_be_canceled)`) therefore greyed out the Cancel button
// for perfectly cancellable reservations.
//
// Eligibility rules (in priority order):
//   1. Finalized reservations can NEVER be cancelled — reservation status of
//      canceled/cancelled/expired/attended/completed/no-show/absent/refunded/
//      void, or a canceled_at/cancelled_at timestamp.
//   2. If SVP sends an explicit cancel flag (any spelling/alias), trust it:
//      true enables, false disables (false also overrides the reschedule
//      fallback below).
//   3. New-shape fallback: no explicit cancel flag at all → a reservation
//      that SVP still marks actionable (`can_be_rescheduled: true`) is
//      treated as cancellable.

const CANCEL_FLAG_KEYS = [
  // US / UK spellings
  "can_be_canceled",
  "can_be_cancelled",
  "canBeCanceled",
  "canBeCancelled",
  // common aliases
  "cancellable",
  "cancelable",
  "is_cancellable",
  "is_cancelable",
  "isCancellable",
  "isCancelable",
  "can_cancel",
  "canCancel",
];

const RESCHEDULE_FLAG_KEYS = [
  "can_be_rescheduled",
  "canBeRescheduled",
  "reschedulable",
  "is_reschedulable",
  "can_reschedule",
  "canReschedule",
];

const FINALIZED_STATUS_RE =
  /cancel|expired|attended|completed|no[_\s-]?show|absent|refunded|void/i;

function coerceFlag(value: any): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true" || value === "yes") return true;
  if (value === 0 || value === "0" || value === "false" || value === "no") return false;
  return null;
}

/** Reads the first explicit cancel flag SVP sent, or null when absent. */
export function readCancelFlag(item: any): boolean | null {
  if (!item || typeof item !== "object") return null;
  for (const key of CANCEL_FLAG_KEYS) {
    const flag = coerceFlag(item[key]);
    if (flag !== null) return flag;
  }
  return null;
}

/** Reads the first explicit reschedule flag SVP sent, or null when absent. */
export function readRescheduleFlag(item: any): boolean | null {
  if (!item || typeof item !== "object") return null;
  for (const key of RESCHEDULE_FLAG_KEYS) {
    const flag = coerceFlag(item[key]);
    if (flag !== null) return flag;
  }
  return null;
}

/**
 * A reservation is finalized (immutable) when SVP already cancelled/expired/
 * completed it, or stamped a cancellation timestamp. NOTE: payment_status is
 * intentionally ignored here — a failed *payment* must not block cancelling
 * the reservation itself.
 */
export function isReservationFinalized(item: any): boolean {
  if (!item || typeof item !== "object") return false;
  if (item.canceled_at || item.cancelled_at) return true;
  const status = String(
    item.reservation_status ?? item.status ?? item.cbt_exam_status ?? ""
  );
  return FINALIZED_STATUS_RE.test(status);
}

/** Single source of truth for the Cancel Reservation button. */
export function canCancelReservation(item: any): boolean {
  if (!item || typeof item !== "object") return false;
  if (isReservationFinalized(item)) return false;
  const explicit = readCancelFlag(item);
  if (explicit !== null) return explicit;
  // New SVP shape: no cancel flag at all → fall back to the reschedule flag,
  // which SVP only sets true while the reservation is still actionable.
  return readRescheduleFlag(item) === true;
}
