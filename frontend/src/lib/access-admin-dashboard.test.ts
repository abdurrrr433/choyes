import { describe, expect, it } from "vitest";
import {
  buildAgencyDashboard,
  extractSvpCollection,
  isPaidPayment,
  normalizePayment,
  normalizeReservation,
} from "../../supabase/functions/access-admin/dashboard-utils";

const svpUser = { id: "svp-1", login: "user@example.com", email: "user@example.com" };

describe("access admin SVP dashboard analytics", () => {
  it("extracts nested SVP collections", () => {
    expect(extractSvpCollection({ data: { payments: [{ id: 1 }] } }, ["payments"])).toEqual([{ id: 1 }]);
  });

  it("recognizes direct successful and pending payments", () => {
    expect(isPaidPayment({ status: "PAID" })).toBe(true);
    expect(isPaidPayment({ result: { description: "Successfully processed" } })).toBe(true);
    expect(isPaidPayment({ status: "pending" })).toBe(false);
  });

  it("groups agency users with creation date and live SVP totals", () => {
    const accounts = [
      { id: "agency-1", name: "Agency", email: "agency@example.com", role: "AGENCY", status: "ACTIVE", created_at: "2026-07-01" },
      { id: "user-1", name: "Candidate", email: "USER@example.com", role: "USER", status: "ACTIVE", agency_id: "agency-1", created_at: "2026-07-02" },
    ];
    const reservations = [normalizeReservation({ id: 10, status: "confirmed" }, svpUser)];
    const payments = [normalizePayment({ id: 20, status: "paid", amount: "100" }, svpUser)];
    const [agency] = buildAgencyDashboard(accounts, [svpUser], reservations, payments);
    expect(agency).toMatchObject({ userCount: 1, svpAccountCount: 1, completedBookings: 1, paidPayments: 1 });
    expect(agency.users[0]).toMatchObject({ createdAt: "2026-07-02", svpAccountCount: 1 });
  });
});
