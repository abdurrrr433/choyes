import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ClipboardCheck, LayoutDashboard, LogOut, SearchCheck, ShieldCheck } from "lucide-react";
import { useAccessAuth } from "@/contexts/AccessAuthContext";
import { accessAdminApi } from "@/lib/access-api";
import "@/styles/access-dashboard-premium.css";
import "@/styles/result-verification.css";

type Value = string | number | boolean | null | undefined;
const display = (value: Value) => value == null || value === "" ? "—" : typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);

function flatten(value: unknown, prefix = "", out: Array<[string, Value]> = []): Array<[string, Value]> {
  if (value == null) return out;
  if (typeof value !== "object") { out.push([prefix || "Result", value as Value]); return out; }
  if (Array.isArray(value)) { value.forEach((item, i) => flatten(item, `${prefix || "Result"} ${i + 1}`, out)); return out; }
  Object.entries(value as Record<string, unknown>).forEach(([key, item]) => flatten(item, prefix ? `${prefix} · ${key.replace(/_/g, " ")}` : key.replace(/_/g, " "), out));
  return out;
}

export default function ResultVerificationPage() {
  const { user, logout } = useAccessAuth();
  const navigate = useNavigate();
  const [passportNumber, setPassportNumber] = useState("");
  const [occupationKey, setOccupationKey] = useState("");
  const [nationalityId, setNationalityId] = useState("BGD");
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const fields = useMemo(() => result ? flatten(result).slice(0, 80) : [], [result]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setResult(null); setLoading(true);
    try {
      const response = await accessAdminApi<{ result: unknown }>("/result-verification", { method: "POST", body: { passportNumber, occupationKey, nationalityId } });
      setResult(response.result);
    } catch (cause: unknown) { setError((cause as { message?: string }).message || "Could not verify this record."); }
    finally { setLoading(false); }
  }

  return <div className="ap-shell"><aside className="ap-sidebar"><div className="ap-brand"><span className="ap-brand__mark">A</span><div><strong>Access</strong><small>ADMIN CONSOLE</small></div></div><nav className="ap-nav"><small>OVERVIEW</small><Link className="ap-nav__link" to="/access/dashboard"><LayoutDashboard />Dashboard</Link><small>VERIFICATION</small><Link className="ap-nav__link ap-nav__link--active" to="/access/result-verification"><SearchCheck />Result Verification</Link></nav><div className="ap-sidebar__foot">Access Control · v2</div></aside><main className="ap-main rv-main"><header className="ap-topbar"><div><small>ADMIN CONSOLE</small><strong>Result Verification</strong></div><div className="ap-account"><span className="ap-role ap-role--admin">ADMIN</span><span className="ap-avatar">{(user?.name || "A").slice(0, 1).toUpperCase()}</span><div><strong>{user?.name}</strong><small>{user?.email}</small></div><button onClick={() => { logout(); navigate("/access/login"); }}><LogOut />Logout</button></div></header><section className="rv-heading"><div className="rv-heading__icon"><ShieldCheck /></div><div><span>AUTHORIZED LOOKUP</span><h1>Verify a labor result</h1><p>Search the official provider using the applicant’s passport, occupation key and nationality. Every lookup is recorded without storing the full passport number.</p></div></section><div className="rv-layout"><section className="rv-card"><header><ClipboardCheck /><div><small>VERIFICATION DETAILS</small><h2>Enter applicant information</h2></div></header><form onSubmit={submit} className="rv-form"><label>Passport number<input value={passportNumber} onChange={(e) => setPassportNumber(e.target.value.toUpperCase())} placeholder="e.g. AB1234567" autoComplete="off" required /></label><label>Occupation key<input value={occupationKey} onChange={(e) => setOccupationKey(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 933301" inputMode="numeric" required /></label><label>Nationality (ISO-3)<input value={nationalityId} onChange={(e) => setNationalityId(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3))} placeholder="BGD" maxLength={3} required /></label><button type="submit" className="rv-submit" disabled={loading}>{loading ? "Checking result…" : <><SearchCheck />Verify result</>}</button></form>{error && <p className="rv-error">{error}</p>}<p className="rv-note">Only use this tool for applicants you are authorized to verify. Results are fetched live and are not cached.</p></section><section className="rv-card rv-result" aria-live="polite"><header><SearchCheck /><div><small>LIVE PROVIDER RESPONSE</small><h2>{result ? "Verification result" : "Awaiting a search"}</h2></div></header>{loading ? <div className="rv-empty">Contacting the verification provider…</div> : !result ? <div className="rv-empty">Submit the applicant details to display the current verification result here.</div> : fields.length ? <dl className="rv-fields">{fields.map(([label, value], i) => <div key={`${label}-${i}`}><dt>{label}</dt><dd>{display(value)}</dd></div>)}</dl> : <div className="rv-empty">The provider returned an empty result.</div>}</section></div><Link className="rv-back" to="/access/dashboard"><ArrowLeft />Back to dashboard</Link></main></div>;
}
