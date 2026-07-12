import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { apiAuth, clearSession, getSession } from "@/lib/api";
import {
  fetchPaymentHistory,
  summarizePayments,
  type PaymentRecord,
} from "@/lib/payments";
import "@/styles/dashboard-premium.css";

function decodeJwtPayload(token: string) {
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized));
  } catch {
    return null;
  }
}

function formatTimestamp(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const BADGE_LABEL: Record<PaymentRecord["status"], string> = {
  success: "Successful",
  failed: "Failed",
  pending: "Pending",
  unknown: "Unknown",
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [paymentsSource, setPaymentsSource] = useState<string>("");
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [paymentsError, setPaymentsError] = useState("");

  useEffect(() => {
    const { accessToken } = getSession();
    if (!accessToken) { navigate("/auth/login"); return; }
    const payload = decodeJwtPayload(accessToken);
    setMe(payload ? { login: payload.login || "User" } : { login: "User" });
    setLoading(false);
    void loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  async function loadPayments() {
    setPaymentsLoading(true);
    setPaymentsError("");
    try {
      const { records, source } = await fetchPaymentHistory();
      setPayments(records);
      setPaymentsSource(source);
    } catch (err: any) {
      setPayments([]);
      setPaymentsError(err?.message || "Failed to load payment history");
    } finally {
      setPaymentsLoading(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    setError("");
    try {
      const { sessionId } = getSession();
      await apiAuth("/logout", { sessionId });
    } catch (err: any) {
      setError(err?.message || "Logout failed");
    } finally {
      clearSession();
      setLoggingOut(false);
      navigate("/auth/login");
    }
  }

  const summary = summarizePayments(payments);

  return (
    <div className="dp-shell">
      <aside className="dp-sidebar">
        <div className="dp-brand">
          <div className="dp-brand-mark" />
          <div>
            <strong>Professional</strong>
            <span>Accreditation</span>
          </div>
        </div>
        <nav className="dp-nav">
          <Link className="dp-nav-item dp-nav-item--active" to="/dashboard">Account Dashboard</Link>
          <Link className="dp-nav-item" to="/exam/reservations">My bookings</Link>
          <Link className="dp-nav-item" to="/exam/booking">New booking</Link>
        </nav>
      </aside>

      <main className="dp-main">
        <header className="dp-topbar">
          <div className="dp-user">
            <div className="dp-avatar" />
            <div>
              <strong>{loading ? "Loading..." : me?.name || me?.login || "User"}</strong>
              <span>{me?.role || "Labor"}</span>
            </div>
          </div>
          <button className="dp-logout" type="button" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? "Logging out..." : "Logout"}
          </button>
        </header>

        <section className="dp-hero">
          <h1>Advance your career through professional accreditation</h1>
          <p>Manage bookings, review reservations and track every payment attempt from one premium dashboard.</p>
          <Link className="dp-hero-cta" to="/exam/booking">Start Verification</Link>
        </section>

        {error ? <div className="dp-error">{error}</div> : null}

        <section className="dp-stats">
          <div className="dp-stat dp-stat--gold"><span>Total payments</span><strong>{paymentsLoading ? "…" : summary.total}</strong></div>
          <div className="dp-stat dp-stat--green"><span>Successful</span><strong>{paymentsLoading ? "…" : summary.success}</strong></div>
          <div className="dp-stat dp-stat--red"><span>Failed</span><strong>{paymentsLoading ? "…" : summary.failed}</strong></div>
          <div className="dp-stat dp-stat--amber"><span>Pending</span><strong>{paymentsLoading ? "…" : summary.pending}</strong></div>
        </section>

        <section className="dp-panel">
          <div className="dp-panel-head">
            <div>
              <h2>Payment History</h2>
              <span className="dp-sub">
                Every payment attempt — successful, failed and pending.
                {paymentsSource === "reservation-embedded" ? " (derived from your reservations)" : ""}
              </span>
            </div>
            <button className="dp-btn" type="button" onClick={loadPayments} disabled={paymentsLoading}>
              {paymentsLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {paymentsError ? <div className="dp-error">{paymentsError}</div> : null}
          {paymentsLoading ? <div className="dp-empty">Loading payment history…</div> : null}
          {!paymentsLoading && !payments.length && !paymentsError ? (
            <div className="dp-empty">No payment attempts found yet. They will appear here after your first booking payment.</div>
          ) : null}

          {!paymentsLoading && payments.length ? (
            <div className="dp-table-wrap">
              <table className="dp-table">
                <thead>
                  <tr>
                    <th>Payment ID</th>
                    <th>Reservation</th>
                    <th>Occupation</th>
                    <th>Date &amp; time</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, idx) => (
                    <tr key={`${p.paymentId}-${p.reservationId}-${idx}`}>
                      <td>{p.paymentId}</td>
                      <td>#{p.reservationId}</td>
                      <td>{p.occupation}</td>
                      <td>{formatTimestamp(p.createdAt)}</td>
                      <td>{p.amount === "-" ? "-" : `${p.amount} ${p.currency}`}</td>
                      <td>{p.method}</td>
                      <td><span className={`dp-badge dp-badge--${p.status}`}>{BADGE_LABEL[p.status]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <p className="dp-note">Need to complete a failed or pending payment? Open the Booking page — a retry banner appears there automatically.</p>
        </section>

        <section className="dp-panel">
          <div className="dp-panel-head">
            <div>
              <h2>Manage your exam bookings</h2>
              <span className="dp-sub">Book, review, reschedule or cancel from the bookings area.</span>
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <Link className="dp-btn" to="/exam/booking">New booking</Link>
              <Link className="dp-btn" to="/exam/reservations">View bookings</Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
