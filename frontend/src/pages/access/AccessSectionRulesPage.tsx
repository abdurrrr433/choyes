import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAccessAuth } from "@/contexts/AccessAuthContext";
import { accessAdminApi } from "@/lib/access-api";
import "@/styles/access-dashboard-premium.css";

type Rule = {
  id: string;
  city: string | null;
  category_id: string | null;
  section: string | null;
  site_id: number;
  priority: number;
  notes: string | null;
  center_name: string | null;
  center_city: string | null;
};

type TestCenter = { site_id: number; name: string; city: string | null };

export default function AccessSectionRulesPage() {
  const { user, logout } = useAccessAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [rules, setRules] = useState<Rule[]>([]);
  const [centers, setCenters] = useState<TestCenter[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [city, setCity] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [section, setSection] = useState("");
  const [siteId, setSiteId] = useState("");
  const [priority, setPriority] = useState("0");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    fetchAll();
  }, [user]);

  async function fetchAll() {
    setListLoading(true);
    try {
      const [r, c] = await Promise.all([
        accessAdminApi<{ rules: Rule[] }>("/section-rules"),
        accessAdminApi<{ test_centers: TestCenter[] }>("/test-centers"),
      ]);
      setRules(r.rules || []);
      setCenters(c.test_centers || []);
    } catch (err: any) {
      setMsg(err?.message || "Failed to load rules");
    } finally {
      setListLoading(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setCity(""); setCategoryId(""); setSection("");
    setSiteId(""); setPriority("0"); setNotes("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg("");
    try {
      await accessAdminApi("/section-rules", {
        method: "POST",
        body: {
          id: editingId || undefined,
          city: city || undefined,
          categoryId: categoryId || undefined,
          section: section || undefined,
          siteId: Number(siteId),
          priority: Number(priority) || 0,
          notes: notes || undefined,
        },
      });
      setMsg(editingId ? "Rule updated" : "Rule created");
      resetForm();
      fetchAll();
    } catch (err: any) {
      setMsg(err?.data?.message || err?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  function edit(r: Rule) {
    setEditingId(r.id);
    setCity(r.city || ""); setCategoryId(r.category_id || ""); setSection(r.section || "");
    setSiteId(String(r.site_id)); setPriority(String(r.priority)); setNotes(r.notes || "");
    setMsg(`Editing rule ${r.id.slice(0, 8)}…`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(id: string) {
    if (!confirm("Delete this rule?")) return;
    try {
      await accessAdminApi(`/section-rules/${id}`, { method: "DELETE" });
      setMsg("Rule deleted");
      fetchAll();
    } catch (err: any) {
      setMsg(err?.data?.message || err?.message || "Failed to delete");
    }
  }

  function handleLogout() { logout(); navigate("/access/login"); }

  const thStyle: React.CSSProperties = { padding: "12px 16px", fontSize: "12px", textTransform: "uppercase", color: "#6d7680", fontWeight: 700 };
  const tdStyle: React.CSSProperties = { padding: "12px 16px", fontSize: "14px" };
  const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 14px", borderRadius: 8, border: "1px solid #ccc", boxSizing: "border-box" };
  const labelStyle: React.CSSProperties = { display: "block", marginBottom: 6, fontWeight: 700, fontSize: 14, color: "#4c5560" };

  if (user?.role !== "ADMIN") {
    return <div style={{ padding: 40 }}>Admin access required.</div>;
  }

  return (
    <div className="dashboard-shell ap-console">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" />
          <div><strong>Access</strong><span>Control Panel</span></div>
        </div>
        <nav className="sidebar-nav">
          <Link className={`nav-item ${location.pathname === "/access/dashboard" ? "nav-item--active" : ""}`} to="/access/dashboard">Dashboard</Link>
          <Link className={`nav-item ${location.pathname === "/access/accounts" ? "nav-item--active" : ""}`} to="/access/accounts">All Accounts</Link>
          <Link className={`nav-item ${location.pathname === "/access/users" ? "nav-item--active" : ""}`} to="/access/users">Create Users</Link>
          <Link className={`nav-item ${location.pathname === "/access/agencies" ? "nav-item--active" : ""}`} to="/access/agencies">Create Agency</Link>
          <Link className={`nav-item ${location.pathname === "/access/test-centers" ? "nav-item--active" : ""}`} to="/access/test-centers">Test Centers</Link>
          <Link className={`nav-item ${location.pathname === "/access/session-centers" ? "nav-item--active" : ""}`} to="/access/session-centers">Session Centers</Link>
          <Link className={`nav-item ${location.pathname === "/access/section-rules" ? "nav-item--active" : ""}`} to="/access/section-rules">Section Rules</Link>
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar__user">
            <div className="avatar" />
            <div><strong>{user?.name}</strong><span>{user?.role}</span></div>
            <button className="logout-btn" type="button" onClick={handleLogout}>Logout</button>
          </div>
        </header>

        <section style={{ padding: "24px 40px" }}>
          <h1 style={{ margin: "0 0 8px" }}>Section Center Rules</h1>
          <p style={{ margin: "0 0 20px", color: "#6d7680", fontSize: 14, maxWidth: 760 }}>
            Define deterministic rules that map exam sessions to a test center even when the booking API returns random session IDs each day.
            A rule matches a session when <strong>all set fields</strong> match (city / category / section). Empty fields are wildcards.
            More-specific rules and higher priority win.
          </p>

          <div className="booking-card" style={{ marginBottom: 24 }}>
            <form onSubmit={save} style={{ display: "grid", gap: 14, maxWidth: 760 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                <div>
                  <label style={labelStyle}>City (optional)</label>
                  <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Dhaka" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Category ID (optional)</label>
                  <input value={categoryId} onChange={(e) => setCategoryId(e.target.value)} placeholder="e.g. 12" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Section (optional)</label>
                  <input value={section} onChange={(e) => setSection(e.target.value)} placeholder="e.g. A-1" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
                <div>
                  <label style={labelStyle}>Target Test Center</label>
                  <select value={siteId} onChange={(e) => setSiteId(e.target.value)} required style={inputStyle}>
                    <option value="">Select a test center…</option>
                    {centers.map((c) => (
                      <option key={c.site_id} value={c.site_id}>#{c.site_id} — {c.name}{c.city ? ` (${c.city})` : ""}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Priority</label>
                  <input value={priority} onChange={(e) => setPriority(e.target.value)} type="number" placeholder="0" style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Notes (optional)</label>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Why this rule exists…" style={inputStyle} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="submit" className="auth-submit" disabled={loading} style={{ maxWidth: 220 }}>
                  {loading ? "Saving..." : editingId ? "Update rule" : "Add rule"}
                </button>
                {editingId && (
                  <button type="button" onClick={resetForm}
                    style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}>
                    Cancel
                  </button>
                )}
              </div>
              {msg && <p style={{ color: msg.toLowerCase().includes("fail") || msg.toLowerCase().includes("error") ? "#c62828" : "#2e7d32", fontSize: 14, margin: 0 }}>{msg}</p>}
            </form>
          </div>

          <h2 style={{ margin: "0 0 12px" }}>All rules ({rules.length})</h2>
          {listLoading ? <p>Loading...</p> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 12, overflow: "hidden" }}>
                <thead>
                  <tr style={{ background: "#f5f7fa", textAlign: "left" }}>
                    <th style={thStyle}>Priority</th>
                    <th style={thStyle}>City</th>
                    <th style={thStyle}>Category</th>
                    <th style={thStyle}>Section</th>
                    <th style={thStyle}>→ Test Center</th>
                    <th style={thStyle}>Notes</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r.id} style={{ borderTop: "1px solid #e8ecf0" }}>
                      <td style={tdStyle}><strong>{r.priority}</strong></td>
                      <td style={tdStyle}>{r.city || "*"}</td>
                      <td style={tdStyle}>{r.category_id || "*"}</td>
                      <td style={tdStyle}>{r.section || "*"}</td>
                      <td style={tdStyle}>#{r.site_id} — {r.center_name || "(unknown)"}</td>
                      <td style={tdStyle}>{r.notes || "—"}</td>
                      <td style={tdStyle}>
                        <button onClick={() => edit(r)}
                          style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #1565c0", background: "#e3f2fd", color: "#1565c0", cursor: "pointer", fontSize: 12, fontWeight: 600, marginRight: 6 }}>
                          Edit
                        </button>
                        <button onClick={() => remove(r.id)}
                          style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #c62828", background: "#ffebee", color: "#c62828", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rules.length === 0 && <p style={{ color: "#999", marginTop: 12 }}>No rules yet. Add one above.</p>}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
