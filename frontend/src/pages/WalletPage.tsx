import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownCircle, ArrowUpCircle, WalletCards } from "lucide-react";
import { accessWalletApi } from "@/lib/access-api";
import "@/styles/wallet.css";

interface WalletData {
  permissions: Record<string, boolean>;
  billingSettings?: { booking_credit_cost: number | string };
  wallet: { balance: number | string; currency: string };
  transactions: WalletTransaction[];
  deposits: DepositRequest[];
}

interface WalletTransaction {
  id: string;
  direction: "credit" | "debit";
  description?: string | null;
  transaction_type: string;
  created_at: string;
  amount: number | string;
  balance_after: number | string;
}

interface DepositRequest {
  id: string;
  payment_method: string;
  payment_reference?: string | null;
  amount: number | string;
  status: string;
}

function errorMessage(error: unknown, fallback: string) {
  const value = error as { message?: string; data?: { message?: string } };
  return value.data?.message || value.message || fallback;
}

export default function WalletPage() {
  const [data, setData] = useState<WalletData | null>(null);
  const [form, setForm] = useState({ amount: "", paymentMethod: "", paymentReference: "", note: "" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { setData(await accessWalletApi<WalletData>("/me")); }
    catch (error: unknown) { setMessage(errorMessage(error, "Could not load wallet")); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function submitDeposit(event: React.FormEvent) {
    event.preventDefault(); setMessage("");
    try {
      await accessWalletApi("/deposits", { body: { ...form, amount: Number(form.amount) } });
      setForm({ amount: "", paymentMethod: "", paymentReference: "", note: "" });
      setMessage("Deposit request submitted for agency/admin review.");
      await load();
    } catch (error: unknown) { setMessage(errorMessage(error, "Deposit request failed")); }
  }

  return <main className="wl-shell"><div className="wl-container">
    <header className="wl-head"><div><small>CANDIDATE FINANCE</small><h1>Wallet & credit history</h1><p>A successful reservation currently costs {loading ? "…" : Number(data?.billingSettings?.booking_credit_cost || 0).toFixed(2)} credits, configured by the administrator.</p></div><nav><Link to="/dashboard">Dashboard</Link><Link to="/exam/reservations">Bookings</Link></nav></header>
    {message && <div className="wl-message">{message}</div>}
    <section className="wl-grid">
      <article className="wl-balance"><WalletCards /><span>AVAILABLE BALANCE</span><strong>{loading ? "…" : Number(data?.wallet?.balance || 0).toFixed(2)}</strong><small>{data?.wallet?.currency || "CREDIT"}</small></article>
      <article className="wl-card"><h2>Request deposit</h2>{data?.permissions?.["wallet.deposit"] ? <form onSubmit={submitDeposit}>
        <input type="number" min="0.01" step="0.01" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
        <input placeholder="Payment method" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} required />
        <input placeholder="Payment reference" value={form.paymentReference} onChange={(e) => setForm({ ...form, paymentReference: e.target.value })} />
        <textarea placeholder="Note (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        <button>Submit for approval</button>
      </form> : <p className="wl-muted">Deposit permission has not been enabled for this account.</p>}</article>
    </section>
    <section className="wl-card"><h2>Transaction history</h2><div className="wl-list">{data?.transactions?.map((item) => <div key={item.id} className="wl-row">{item.direction === "credit" ? <ArrowDownCircle className="credit" /> : <ArrowUpCircle className="debit" />}<div><strong>{item.description || item.transaction_type}</strong><small>{new Date(item.created_at).toLocaleString()}</small></div><span className={item.direction}>{item.direction === "credit" ? "+" : "−"}{Number(item.amount).toFixed(2)}</span><b>{Number(item.balance_after).toFixed(2)}</b></div>)}{!loading && !data?.transactions?.length && <p className="wl-muted">No wallet transactions yet.</p>}</div></section>
    <section className="wl-card"><h2>Deposit requests</h2><div className="wl-list">{data?.deposits?.map((item) => <div key={item.id} className="wl-row"><div><strong>{item.payment_method}</strong><small>{item.payment_reference || "No reference"}</small></div><span>{Number(item.amount).toFixed(2)}</span><b className={`status-${String(item.status).toLowerCase()}`}>{item.status}</b></div>)}{!loading && !data?.deposits?.length && <p className="wl-muted">No deposit requests.</p>}</div></section>
  </div></main>;
}
