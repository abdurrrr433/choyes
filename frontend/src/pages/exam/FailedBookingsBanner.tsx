import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { extractPaymentsFromReservations, type PaymentRecord } from "@/lib/payments";

// Banner shown on the Booking page listing reservations whose payment attempt
// failed or is still pending, with a "Retry Payment" button that re-uses the
// Booking page's existing openPaymentPage() flow (passed in via props).

function pickArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  const candidates = [
    payload?.data, payload?.items, payload?.result, payload?.payload,
    payload?.exam_reservations, payload?.reservations,
    payload?.data?.exam_reservations, payload?.data?.reservations,
  ];
  for (const item of candidates) { if (Array.isArray(item)) return item; }
  return [];
}

interface Props {
  onRetryPayment: (reservationId: string) => Promise<void> | void;
}

export default function FailedBookingsBanner({ onRetryPayment }: Props) {
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [retryingId, setRetryingId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const reservations = pickArray(await api("/exam-reservations?locale=en"));
        if (!active) return;
        const attention = extractPaymentsFromReservations(reservations).filter(
          (r) => r.status === "failed" || r.status === "pending"
        );
        // One row per reservation (latest attempt wins — list is sorted desc).
        const byReservation = new Map<string, PaymentRecord>();
        attention.forEach((r) => {
          if (!byReservation.has(r.reservationId)) byReservation.set(r.reservationId, r);
        });
        setRecords(Array.from(byReservation.values()));
      } catch {
        // Silently skip — the banner is a helper, never block the booking flow.
        if (active) setRecords([]);
      }
    })();
    return () => { active = false; };
  }, []);

  async function retry(record: PaymentRecord) {
    setRetryingId(record.reservationId);
    setError("");
    try {
      await onRetryPayment(record.reservationId);
    } catch (err: any) {
      setError(err?.message || "Failed to reopen the payment page");
    } finally {
      setRetryingId("");
    }
  }

  if (!records.length) return null;

  return (
    <div
      style={{
        margin: "0 0 18px",
        padding: "16px 18px",
        borderRadius: "12px",
        background: "#fff7ed",
        border: "1px solid #fdba74",
        color: "#7c2d12",
      }}
    >
      <strong style={{ display: "block", marginBottom: "6px" }}>
        {records.length} booking{records.length > 1 ? "s" : ""} with unfinished payment
      </strong>
      <span style={{ fontSize: "13px", display: "block", marginBottom: "10px" }}>
        These reservations exist but their payment failed or is still pending. Retry the payment to confirm them.
      </span>
      {error ? (
        <div style={{ marginBottom: "10px", color: "#b91c1c", fontSize: "13px", fontWeight: 600 }}>{error}</div>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {records.map((r) => (
          <div
            key={r.reservationId}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: "12px", flexWrap: "wrap", background: "#ffffff",
              border: "1px solid #fed7aa", borderRadius: "10px", padding: "10px 14px",
            }}
          >
            <div style={{ fontSize: "13px", lineHeight: 1.5 }}>
              <strong>Reservation #{r.reservationId}</strong>
              {r.paymentId && r.paymentId !== "-" ? <> · Payment ID: {r.paymentId}</> : null}
              {r.occupation && r.occupation !== "-" ? <> · {r.occupation}</> : null}
              {r.amount !== "-" ? <> · {r.amount} {r.currency}</> : null}
              <> · <span style={{ fontWeight: 700, color: r.status === "failed" ? "#b91c1c" : "#92400e" }}>
                {r.status === "failed" ? "Payment failed" : "Payment pending"}
              </span></>
            </div>
            <button
              type="button"
              onClick={() => retry(r)}
              disabled={retryingId === r.reservationId}
              style={{
                padding: "8px 18px", borderRadius: "8px", cursor: "pointer",
                background: "#ea580c", color: "#fff", border: "1px solid #ea580c",
                fontWeight: 700, fontSize: "13px",
              }}
            >
              {retryingId === r.reservationId ? "Opening payment..." : "Retry Payment"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
