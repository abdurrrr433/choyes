import { useState, useEffect } from "react";
import { useAccessAuth } from "@/contexts/AccessAuthContext";
import { accessAdminApi, accessAgencyApi } from "@/lib/access-api";
import "@/styles/access-dashboard-premium.css";
import { useNavigate, Link, useLocation } from "react-router-dom";

const AGENCY_USER_PERMISSIONS = [
  ["booking.create", "Create bookings", "Create new exam reservations."],
  ["reservation.manage", "Manage reservations", "Open My bookings, download tickets, cancel and reschedule."],
  ["payment.create", "Create payments", "Start or retry reservation payments."],
  ["wallet.deposit", "Request deposits", "Submit wallet deposit requests for admin approval."],
] as const;

export default function AccessUsersPage() {
  const { user, logout } = useAccessAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = user?.role === "ADMIN";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("PENDING");
  const [agencyId, setAgencyId] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Agency users list (for AGENCY role)
  const [users, setUsers] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(false);

  // Password change modal
  const [pwModalId, setPwModalId] = useState<string | null>(null);
  const [pwModalName, setPwModalName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState("");

  // Agency-owned user permission modal
  const [permissionModalId, setPermissionModalId] = useState<string | null>(null);
  const [permissionModalName, setPermissionModalName] = useState("");
  const [permissionMode, setPermissionMode] = useState("LEGACY");
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [permissionLoading, setPermissionLoading] = useState(false);
  const [permissionSaving, setPermissionSaving] = useState(false);
  const [permissionMsg, setPermissionMsg] = useState("");

  useEffect(() => {
    if (user?.role === "AGENCY") fetchUsers();
  }, [user]);

  async function fetchUsers() {
    setListLoading(true);
    try {
      const res = await accessAgencyApi("/users");
      setUsers(res.users || []);
    } catch { }
    finally { setListLoading(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      if (isAdmin) {
        await accessAdminApi("/users", { body: { name, email, password, status, agencyId: agencyId || undefined } });
      } else {
        await accessAgencyApi("/users", { body: { name, email, password, status } });
      }
      setMsg("User created successfully!");
      setName(""); setEmail(""); setPassword(""); setAgencyId("");
      if (!isAdmin) fetchUsers();
    } catch (err: any) {
      setMsg(err?.data?.message || err?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function toggleUserStatus(u: any) {
    const newStatus = u.status === "ACTIVE" ? "BLOCKED" : "ACTIVE";
    try {
      await accessAgencyApi(`/users/${u.id}/status`, { method: "PATCH", body: { status: newStatus } });
      setMsg(`${u.name} is now ${newStatus}`);
      fetchUsers();
    } catch (err: any) {
      setMsg(err?.message || "Failed to update status");
    }
  }

  async function changeUserPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!pwModalId) return;
    setPwLoading(true);
    setPwMsg("");
    try {
      await accessAgencyApi(`/users/${pwModalId}/password`, { method: "PATCH", body: { password: newPassword } });
      setPwMsg("Password updated successfully!");
      setNewPassword("");
      setTimeout(() => { setPwModalId(null); setPwMsg(""); }, 1500);
    } catch (err: any) {
      setPwMsg(err?.message || "Failed to update password");
    } finally {
      setPwLoading(false);
    }
  }

  async function openUserPermissions(u: any) {
    setPermissionModalId(u.id);
    setPermissionModalName(u.name);
    setPermissionMode(u.permission_mode || "LEGACY");
    setPermissions({});
    setPermissionMsg("");
    setPermissionLoading(true);
    try {
      const res = await accessAgencyApi(`/users/${u.id}/permissions`);
      setPermissionMode(res.user?.permission_mode || "LEGACY");
      setPermissions(res.permissions || {});
    } catch (err: any) {
      setPermissionMsg(err?.data?.message || err?.message || "Failed to load permissions");
    } finally {
      setPermissionLoading(false);
    }
  }

  async function saveUserPermissions(e: React.FormEvent) {
    e.preventDefault();
    if (!permissionModalId) return;
    setPermissionSaving(true);
    setPermissionMsg("");
    try {
      await accessAgencyApi(`/users/${permissionModalId}/permissions`, {
        method: "PUT",
        body: { permissions },
      });
      setPermissionMode("MANAGED");
      setPermissionMsg("Permissions saved successfully!");
      await fetchUsers();
    } catch (err: any) {
      setPermissionMsg(err?.data?.message || err?.message || "Failed to save permissions");
    } finally {
      setPermissionSaving(false);
    }
  }

  function handleLogout() { logout(); navigate("/access/login"); }

  const thStyle: React.CSSProperties = { padding: "12px 16px", fontSize: "12px", textTransform: "uppercase", color: "#6d7680", fontWeight: 700 };
  const tdStyle: React.CSSProperties = { padding: "12px 16px" };

  return (
    <div className="dashboard-shell ap-console">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" />
          <div><strong>Access</strong><span>Control Panel</span></div>
        </div>
        <nav className="sidebar-nav">
          <Link className={`nav-item ${location.pathname === "/access/dashboard" ? "nav-item--active" : ""}`} to="/access/dashboard">Dashboard</Link>
          {isAdmin && <Link className={`nav-item ${location.pathname === "/access/accounts" ? "nav-item--active" : ""}`} to="/access/accounts">All Accounts</Link>}
          <Link className={`nav-item ${location.pathname === "/access/users" ? "nav-item--active" : ""}`} to="/access/users">{isAdmin ? "Create Users" : "My Users"}</Link>
          {isAdmin && <Link className={`nav-item ${location.pathname === "/access/agencies" ? "nav-item--active" : ""}`} to="/access/agencies">Create Agency</Link>}
          {isAdmin && <Link className={`nav-item ${location.pathname === "/access/test-centers" ? "nav-item--active" : ""}`} to="/access/test-centers">Test Centers</Link>}
          {isAdmin && <Link className={`nav-item ${location.pathname === "/access/session-centers" ? "nav-item--active" : ""}`} to="/access/session-centers">Session Centers</Link>}
          {isAdmin && <Link className={`nav-item ${location.pathname === "/access/section-rules" ? "nav-item--active" : ""}`} to="/access/section-rules">Section Rules</Link>}
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
          <h1 style={{ margin: "0 0 20px" }}>{isAdmin ? "Create User" : "Manage Your Users"}</h1>

          <div className="booking-card" style={{ marginBottom: "24px" }}>
            <form onSubmit={submit} style={{ display: "grid", gap: "14px", maxWidth: "500px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: 700, fontSize: "14px", color: "#4c5560" }}>Full Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required
                  style={{ width: "100%", padding: "8px 14px", borderRadius: "8px", border: "1px solid #ccc", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: 700, fontSize: "14px", color: "#4c5560" }}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required
                  style={{ width: "100%", padding: "8px 14px", borderRadius: "8px", border: "1px solid #ccc", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: 700, fontSize: "14px", color: "#4c5560" }}>Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" required minLength={8}
                  style={{ width: "100%", padding: "8px 14px", borderRadius: "8px", border: "1px solid #ccc", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: 700, fontSize: "14px", color: "#4c5560" }}>Initial Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)}
                  style={{ width: "100%", padding: "8px 14px", borderRadius: "8px", border: "1px solid #ccc", boxSizing: "border-box" }}>
                  <option value="PENDING">Pending</option>
                  <option value="ACTIVE">Active</option>
                </select>
              </div>
              {isAdmin && (
                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontWeight: 700, fontSize: "14px", color: "#4c5560" }}>Agency ID (optional)</label>
                  <input value={agencyId} onChange={(e) => setAgencyId(e.target.value)} placeholder="Agency ID (leave empty for no agency)"
                    style={{ width: "100%", padding: "8px 14px", borderRadius: "8px", border: "1px solid #ccc", boxSizing: "border-box" }} />
                </div>
              )}
              <button type="submit" className="auth-submit" disabled={loading} style={{ maxWidth: "200px" }}>
                {loading ? "Creating..." : "Create User"}
              </button>
              {msg && <p style={{ color: msg.includes("success") || msg.includes("ACTIVE") || msg.includes("BLOCKED") ? "#2e7d32" : "#c62828", fontSize: "14px" }}>{msg}</p>}
            </form>
          </div>

          {!isAdmin && (
            <>
              <h2 style={{ margin: "0 0 16px" }}>Your Users</h2>
              {listLoading ? <p>Loading...</p> : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: "12px", overflow: "hidden" }}>
                    <thead>
                      <tr style={{ background: "#f5f7fa", textAlign: "left" }}>
                        <th style={thStyle}>Name</th>
                        <th style={thStyle}>Email</th>
                        <th style={thStyle}>Status</th>
                        <th style={thStyle}>Active</th>
                        <th style={thStyle}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} style={{ borderTop: "1px solid #e8ecf0" }}>
                          <td style={tdStyle}>{u.name}</td>
                          <td style={tdStyle}>{u.email}</td>
                          <td style={tdStyle}>
                            <span style={{
                              padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: 700,
                              background: u.status === "ACTIVE" ? "#e8f5e9" : u.status === "BLOCKED" ? "#ffebee" : "#fff3e0",
                              color: u.status === "ACTIVE" ? "#2e7d32" : u.status === "BLOCKED" ? "#c62828" : "#e65100",
                            }}>
                              {u.status}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <button
                              onClick={() => toggleUserStatus(u)}
                              style={{
                                width: "44px", height: "24px", borderRadius: "12px", border: "none", cursor: "pointer",
                                background: u.status === "ACTIVE" ? "#4caf50" : "#ccc",
                                position: "relative", transition: "background 0.2s",
                              }}
                            >
                              <span style={{
                                display: "block", width: "18px", height: "18px", borderRadius: "50%", background: "#fff",
                                position: "absolute", top: "3px",
                                left: u.status === "ACTIVE" ? "23px" : "3px",
                                transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)",
                              }} />
                            </button>
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                              <button
                                onClick={() => void openUserPermissions(u)}
                                style={{
                                  padding: "4px 10px", borderRadius: "6px", border: "1px solid #8a6a13",
                                  background: "#fff8df", color: "#73570d", cursor: "pointer", fontSize: "12px", fontWeight: 700,
                                }}
                              >
                                Permissions
                              </button>
                              <button
                                onClick={() => { setPwModalId(u.id); setPwModalName(u.name); setNewPassword(""); setPwMsg(""); }}
                                style={{
                                  padding: "4px 10px", borderRadius: "6px", border: "1px solid #1976d2",
                                  background: "#e3f2fd", color: "#1565c0", cursor: "pointer", fontSize: "12px", fontWeight: 600,
                                }}
                              >
                                Change Password
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {users.length === 0 && !listLoading && <p style={{ color: "#999" }}>No users yet</p>}
            </>
          )}
        </section>
      </main>

      {/* Password Change Modal */}
      {pwModalId && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000,
        }} onClick={() => setPwModalId(null)}>
          <div style={{
            background: "#fff", borderRadius: "16px", padding: "28px", width: "min(420px,90vw)",
            boxShadow: "0 8px 32px rgba(0,0,0,.15)",
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 4px" }}>Change Password</h3>
            <p style={{ color: "#666", fontSize: "14px", margin: "0 0 20px" }}>for <strong>{pwModalName}</strong></p>
            <form onSubmit={changeUserPassword}>
              <label style={{ display: "block", marginBottom: "6px", fontWeight: 700, fontSize: "14px", color: "#4c5560" }}>New Password</label>
              <input
                type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 characters" required minLength={8}
                style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #ccc", boxSizing: "border-box", marginBottom: "16px" }}
              />
              {pwMsg && <p style={{ color: pwMsg.includes("success") ? "#2e7d32" : "#c62828", fontSize: "14px", margin: "0 0 12px" }}>{pwMsg}</p>}
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setPwModalId(null)}
                  style={{ padding: "8px 18px", borderRadius: "8px", border: "1px solid #ccc", background: "#f5f5f5", cursor: "pointer", fontWeight: 600 }}>
                  Cancel
                </button>
                <button type="submit" disabled={pwLoading}
                  style={{ padding: "8px 18px", borderRadius: "8px", border: "none", background: "#1976d2", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
                  {pwLoading ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {permissionModalId && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px",
        }} onClick={() => !permissionSaving && setPermissionModalId(null)}>
          <div style={{
            background: "#fff", borderRadius: "16px", padding: "28px", width: "min(520px,100%)",
            maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,.2)",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <h3 style={{ margin: "0 0 4px" }}>User Permissions</h3>
                <p style={{ color: "#666", fontSize: "14px", margin: 0 }}>
                  <strong>{permissionModalName}</strong> · {permissionMode}
                </p>
              </div>
              <button type="button" aria-label="Close permissions" onClick={() => setPermissionModalId(null)} disabled={permissionSaving}
                style={{ border: 0, background: "#f1f3f5", borderRadius: "8px", width: "34px", height: "34px", cursor: "pointer", fontSize: "18px" }}>×</button>
            </div>

            {permissionLoading ? <p>Loading permissions...</p> : (
              <form onSubmit={saveUserPermissions}>
                <div style={{ display: "grid", gap: "10px" }}>
                  {AGENCY_USER_PERMISSIONS.map(([key, label, note]) => (
                    <label key={key} style={{
                      display: "flex", gap: "12px", alignItems: "flex-start", padding: "13px",
                      border: `1px solid ${permissions[key] ? "#d6b14c" : "#e2e5e9"}`,
                      borderRadius: "10px", background: permissions[key] ? "#fffaf0" : "#fff", cursor: "pointer",
                    }}>
                      <input type="checkbox" checked={permissions[key] === true}
                        onChange={(e) => setPermissions((current) => ({ ...current, [key]: e.target.checked }))}
                        style={{ marginTop: "3px", width: "17px", height: "17px" }} />
                      <span><strong style={{ display: "block", fontSize: "14px" }}>{label}</strong><small style={{ color: "#68717b" }}>{note}</small></span>
                    </label>
                  ))}
                </div>
                {permissionMsg && <p style={{
                  color: permissionMsg.includes("success") ? "#2e7d32" : "#c62828", fontSize: "14px", margin: "14px 0 0",
                }}>{permissionMsg}</p>}
                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "20px" }}>
                  <button type="button" onClick={() => setPermissionModalId(null)} disabled={permissionSaving}
                    style={{ padding: "9px 18px", borderRadius: "8px", border: "1px solid #ccc", background: "#f5f5f5", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
                  <button type="submit" disabled={permissionSaving}
                    style={{ padding: "9px 18px", borderRadius: "8px", border: 0, background: "#8a6a13", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
                    {permissionSaving ? "Saving..." : "Save Permissions"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
