import { describe, it, expect } from "vitest";
import {
  classifyPaymentStatus,
  extractPaymentsFromReservations,
  normalizePayment,
  summarizePayments,
} from "@/lib/payments";

describe("classifyPaymentStatus", () => {
  it("maps success-like statuses", () => {
    expect(classifyPaymentStatus("paid")).toBe("success");
    expect(classifyPaymentStatus("Successful")).toBe("success");
    expect(classifyPaymentStatus("captured")).toBe("success");
  });
  it("maps failure-like statuses", () => {
    expect(classifyPaymentStatus("failed")).toBe("failed");
    expect(classifyPaymentStatus("Declined")).toBe("failed");
    expect(classifyPaymentStatus("voided")).toBe("failed");
  });
  it("maps pending-like statuses and unknown", () => {
    expect(classifyPaymentStatus("pending")).toBe("pending");
    expect(classifyPaymentStatus("initiated")).toBe("pending");
    expect(classifyPaymentStatus("")).toBe("unknown");
    expect(classifyPaymentStatus("weird_status")).toBe("unknown");
  });
});

describe("normalizePayment", () => {
  it("reads SVP payment list fields", () => {
    const rec = normalizePayment({
      id: 901, status: "paid", amount: "250.0", currency: "SAR",
      payment_method: "card", payable_id: 555, created_at: "2026-02-01T09:00:00Z",
      occupation: { english_name: "Welder" },
    });
    expect(rec.paymentId).toBe("901");
    expect(rec.reservationId).toBe("555");
    expect(rec.occupation).toBe("Welder");
    expect(rec.status).toBe("success");
    expect(rec.amount).toBe("250.0");
    expect(rec.method).toBe("card");
  });
});

describe("extractPaymentsFromReservations (fallback path)", () => {
  const reservations = [
    {
      id: 1, occupation: { english_name: "Welder" },
      payments: [
        { id: 11, status: "failed", amount: 250, currency: "SAR", payment_method: "card", created_at: "2026-02-02T10:00:00Z" },
        { id: 12, status: "paid", amount: 250, currency: "SAR", payment_method: "card", created_at: "2026-02-02T11:00:00Z" },
      ],
    },
    { id: 2, occupation: { name: "Electrician" }, latest_payment: { id: 21, status: "pending", amount: 300 } },
    { id: 3, payment_status: "unpaid" }, // no embedded objects -> synthesized
    { id: 4 }, // nothing at all -> skipped
  ];

  it("extracts every embedded attempt with reservation context", () => {
    const records = extractPaymentsFromReservations(reservations);
    expect(records).toHaveLength(4);
    const r1 = records.filter((r) => r.reservationId === "1");
    expect(r1.map((r) => r.status).sort()).toEqual(["failed", "success"]);
    expect(r1[0].occupation).toBe("Welder");
    expect(records.find((r) => r.reservationId === "2")?.status).toBe("pending");
    expect(records.find((r) => r.reservationId === "3")?.status).toBe("pending");
    expect(records.every((r) => r.source === "reservation-embedded")).toBe(true);
  });

  it("summarizePayments counts by status", () => {
    const summary = summarizePayments(extractPaymentsFromReservations(reservations));
    expect(summary).toEqual({ total: 4, success: 1, failed: 1, pending: 2 });
  });
});
