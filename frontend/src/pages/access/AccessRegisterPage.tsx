import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { accessAuthApi } from "@/lib/access-api";
import "@/styles/auth-premium.css";

function errorMessage(error: unknown, fallback: string) {
  const value = error as { message?: string; data?: { message?: string } };
  return value.data?.message || value.message || fallback;
}

export default function AccessRegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirm: "" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (form.password !== form.confirm) { setMessage("Passwords do not match"); return; }
    setLoading(true); setMessage("");
    try {
      const response = await accessAuthApi<{ message: string }>("/register", { name: form.name, email: form.email, phone: form.phone, password: form.password });
      setMessage(response.message);
      setTimeout(() => navigate("/access/login"), 1400);
    } catch (error: unknown) { setMessage(errorMessage(error, "Registration failed")); }
    finally { setLoading(false); }
  }

  return <main className="ap-shell">
    <aside className="ap-brand-panel">
      <div className="ap-brand-head"><div className="ap-brand-mark">A</div><div className="ap-brand-title"><strong>Access Control</strong><span>Candidate registration</span></div></div>
      <div className="ap-brand-copy"><span className="ap-brand-eyebrow">Candidate accounts only</span><h2>Create your secure <em>candidate access</em></h2><p>Self-registration always creates a USER account. Booking, payment and deposit access remain controlled by the administrator.</p></div>
      <div className="ap-brand-foot"><span>Role: USER</span><span>Admin-managed permissions</span></div>
    </aside>
    <section className="ap-form-panel"><div className="ap-form-card">
      <div className="ap-form-header"><h1>Create candidate account</h1><p>Register for Access Portal. Elevated roles cannot be requested here.</p></div>
      <form className="ap-form" onSubmit={submit}>
        <div className="ap-field"><label htmlFor="register-name">Full name</label><input id="register-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
        <div className="ap-field"><label htmlFor="register-email">Email</label><input id="register-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
        <div className="ap-field"><label htmlFor="register-phone">Full phone number</label><input id="register-phone" type="tel" placeholder="+8801712345678" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required pattern="\+[1-9][0-9 ()-]{7,20}" title="Use full international format, for example +8801712345678" /></div>
        <div className="ap-field"><label htmlFor="register-password">Password</label><input id="register-password" type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
        <div className="ap-field"><label htmlFor="register-confirm">Confirm password</label><input id="register-confirm" type="password" minLength={8} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required /></div>
        <button className="ap-submit" disabled={loading}>{loading ? "Creating…" : "Create USER account"}</button>
        {message && <div className="ap-message">{message}</div>}
        <p className="ap-hint">Already registered? <Link to="/access/login">Sign in</Link></p>
      </form>
    </div></section>
  </main>;
}
