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

interface AgencyWalletTransaction {
  id: string;
  direction: "credit" | "debit";
  transaction_type: string;
  amount: number | string;
  balance_after: number | string;
  description?: string | null;
  created_at: string;
}

interface AgencyDepositRequest {
  id: string;
  amount: number | string;
  status: string;
  payment_method: string;
  payment_reference?: string | null;
  receiver_account?: string | null;
  billing_owner_id?: string | null;
  created_at: string;
}

interface AgencyWalletData {
  wallet: { balance: number | string; currency: string };
  transactions: AgencyWalletTransaction[];
  deposits: AgencyDepositRequest[];
}
interface AgencyBillingSettings {
  booking_credit_cost: number | string;
  bkash_enabled: boolean;
  bkash_number?: string | null;
  bkash_instructions?: string | null;
  nagad_enabled: boolean;
  nagad_number?: string | null;
  nagad_instructions?: string | null;
}

export default function AccessUsersPage() {
  const { user, logout } = useAccessAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = user?.role === "ADMIN";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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

  // Agency-owned user wallet modal
  const [walletModalId, setWalletModalId] = useState<string | null>(null);
  const [walletModalName, setWalletModalName] = useState("");
  const [walletData, setWalletData] = useState<AgencyWalletData | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletSaving, setWalletSaving] = useState(false);
  const [walletMsg, setWalletMsg] = useState("");
  const [walletAdjustment, setWalletAdjustment] = useState({ amount: "", direction: "credit", description: "" });
  const [billingSource, setBillingSource] = useState("ADMIN_DEFAULT");
  const [billingSaving, setBillingSaving] = useState(false);
  const [billing, setBilling] = useState({ bookingCreditCost: "1.00", bkashEnabled: false, bkashNumber: "", bkashInstructions: "", nagadEnabled: false, nagadNumber: "", nagadInstructions: "" });

  useEffect(() => {
    if (user?.role === "AGENCY") { fetchUsers(); void loadAgencyBilling(); }
  }, [user]);

  async function loadAgencyBilling() {
    try {
      const response = await accessAgencyApi<{ settings: AgencyBillingSettings; source: string }>("/billing-settings");
      const item = response.settings;
      setBillingSource(response.source || "ADMIN_DEFAULT");
      setBilling({
        bookingCreditCost: Number(item?.booking_credit_cost || 0).toFixed(2),
        bkashEnabled: item?.bkash_enabled === true,
        bkashNumber: item?.bkash_number || "",
        bkashInstructions: item?.bkash_instructions || "",
        nagadEnabled: item?.nagad_enabled === true,
        nagadNumber: item?.nagad_number || "",
        nagadInstructions: item?.nagad_instructions || "",
      });
    } catch (err: any) { setMsg(err?.data?.message || err?.message || "Failed to load billing settings"); }
  }

  async function saveAgencyBilling(event: React.FormEvent) {
    event.preventDefault(); setBillingSaving(true); setMsg("");
    try {
      await accessAgencyApi("/billing-settings", { method: "PUT", body: { ...billing, bookingCreditCost: Number(billing.bookingCreditCost) } });
      setBillingSource("AGENCY");
      setMsg("Agency billing and payment receivers saved successfully!");
      await loadAgencyBilling();
    } catch (err: any) { setMsg(err?.data?.message || err?.message || "Failed to save billing settings"); }
    finally { setBillingSaving(false); }
  }

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
        await accessAdminApi("/users", { body: { name, email, phone, password, status, agencyId: agencyId || undefined } });
      } else {
        await accessAgencyApi("/users", { body: { name, email, phone, password, status } });
      }
      setMsg("User created successfully!");
      setName(""); setEmail(""); setPhone(""); setPassword(""); setAgencyId("");
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

  async function loadUserWallet(accountId: string) {
    setWalletLoading(true);
    try {
      setWalletData(await accessAgencyApi<AgencyWalletData>(`/users/${accountId}/wallet`));
    } catch (err: any) {
      setWalletMsg(err?.data?.message || err?.message || "Failed to load wallet");
    } finally {
      setWalletLoading(false);
    }
  }

  async function openUserWallet(u: any) {
    setWalletModalId(u.id);
    setWalletModalName(u.name);
    setWalletData(null);
    setWalletMsg("");
    setWalletAdjustment({ amount: "", direction: "credit", description: "" });
    await loadUserWallet(u.id);
  }

  async function submitWalletAdjustment(e: React.FormEvent) {
    e.preventDefault();
    if (!walletModalId) return;
    setWalletSaving(true);
    setWalletMsg("");
    try {
      await accessAgencyApi(`/users/${walletModalId}/wallet-adjustments`, {
        body: { ...walletAdjustment, amount: Number(walletAdjustment.amount) },
      });
      setWalletAdjustment({ amount: "", direction: "credit", description: "" });
      setWalletMsg(`Balance ${walletAdjustment.direction === "credit" ? "credited" : "debited"} successfully!`);
      await loadUserWallet(walletModalId);
    } catch (err: any) {
      setWalletMsg(err?.data?.message || err?.message || "Wallet adjustment failed");
    } finally {
      setWalletSaving(false);
    }
  }

  async function processUserDeposit(depositId: string, action: "approve" | "reject") {
    if (!walletModalId) return;
    const note = window.prompt(`${action === "approve" ? "Approval" : "Rejection"} note (optional)`) || "";
    setWalletSaving(true);
    setWalletMsg("");
    try {
      await accessAgencyApi(`/users/${walletModalId}/deposits/${depositId}`, {
        method: "PATCH", body: { action, note },
      });
      setWalletMsg(`Deposit ${action}d successfully!`);
      await loadUserWallet(walletModalId);
    } catch (err: any) {
      setWalletMsg(err?.data?.message || err?.message || "Deposit processing failed");
    } finally {
      setWalletSaving(false);
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

          {!isAdmin && <div className="booking-card" style={{ marginBottom: "24px" }}>
            <small style={{ color: "#f0c869", letterSpacing: ".14em" }}>AGENCY BILLING · {billingSource}</small>
            <h2 style={{ margin: "8px 0" }}>Your users' booking cost & payment receivers</h2>
            <p style={{ color: "#9199b8" }}>Only users belonging to your Agency use this profile. You cannot change Admin defaults or another Agency's billing.</p>
            <form onSubmit={saveAgencyBilling} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: "12px", marginTop: "18px" }}>
              <label>Credits per successful booking<input type="number" min="0" max="1000000" step="0.01" required value={billing.bookingCreditCost} onChange={(event) => setBilling({ ...billing, bookingCreditCost: event.target.value })} /></label>
              <label style={{ display: "flex", alignItems: "center", gap: "9px" }}><input style={{ width: "18px", minHeight: "18px" }} type="checkbox" checked={billing.bkashEnabled} onChange={(event) => setBilling({ ...billing, bkashEnabled: event.target.checked })} /> Enable bKash</label>
              <label>bKash receiver number<input required={billing.bkashEnabled} value={billing.bkashNumber} onChange={(event) => setBilling({ ...billing, bkashNumber: event.target.value })} /></label>
              <label>bKash instructions<input maxLength={500} placeholder="Send Money and enter transaction ID" value={billing.bkashInstructions} onChange={(event) => setBilling({ ...billing, bkashInstructions: event.target.value })} /></label>
              <label style={{ display: "flex", alignItems: "center", gap: "9px" }}><input style={{ width: "18px", minHeight: "18px" }} type="checkbox" checked={billing.nagadEnabled} onChange={(event) => setBilling({ ...billing, nagadEnabled: event.target.checked })} /> Enable Nagad</label>
              <label>Nagad receiver number<input required={billing.nagadEnabled} value={billing.nagadNumber} onChange={(event) => setBilling({ ...billing, nagadNumber: event.target.value })} /></label>
              <label>Nagad instructions<input maxLength={500} placeholder="Send Money and enter transaction ID" value={billing.nagadInstructions} onChange={(event) => setBilling({ ...billing, nagadInstructions: event.target.value })} /></label>
              <button type="submit" className="auth-submit" disabled={billingSaving}>{billingSaving ? "Saving..." : "Save Agency Billing"}</button>
            </form>
          </div>}

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
                <label style={{ display: "block", marginBottom: "6px", fontWeight: 700, fontSize: "14px", color: "#4c5560" }}>Full Phone Number</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+8801712345678" required pattern="\+[1-9][0-9 ()-]{7,20}" title="Use full international format, for example +8801712345678"
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
                        <th style={thStyle}>Phone</th>
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
                          <td style={tdStyle}>{u.phone || "-"}</td>
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
                                onClick={() => void openUserWallet(u)}
                                style={{
                                  padding: "4px 10px", borderRadius: "6px", border: "1px solid #2e7d32",
                                  background: "#e8f5e9", color: "#256b29", cursor: "pointer", fontSize: "12px", fontWeight: 700,
                                }}
                              >
                                Wallet
                              </button>
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

      {walletModalId && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.58)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px",
        }} onClick={() => !walletSaving && setWalletModalId(null)}>
          <div style={{
            background: "#fff", borderRadius: "16px", padding: "26px", width: "min(820px,100%)",
            maxHeight: "92vh", overflowY: "auto", boxShadow: "0 8px 36px rgba(0,0,0,.24)",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", marginBottom: "18px" }}>
              <div><h3 style={{ margin: "0 0 4px" }}>User Wallet</h3><p style={{ color: "#666", fontSize: "14px", margin: 0 }}><strong>{walletModalName}</strong></p></div>
              <button type="button" aria-label="Close wallet" onClick={() => setWalletModalId(null)} disabled={walletSaving}
                style={{ border: 0, background: "#f1f3f5", borderRadius: "8px", width: "34px", height: "34px", cursor: "pointer", fontSize: "18px" }}>×</button>
            </div>

            {walletLoading && !walletData ? <p>Loading wallet...</p> : <>
              <div style={{
                padding: "20px", borderRadius: "14px", color: "#fff", marginBottom: "18px",
                background: "linear-gradient(135deg,#173b2b,#2e7d32)", display: "flex", justifyContent: "space-between", alignItems: "end",
              }}><div><small style={{ opacity: .75, letterSpacing: ".1em" }}>AVAILABLE BALANCE</small><strong style={{ display: "block", fontSize: "34px", marginTop: "5px" }}>{Number(walletData?.wallet?.balance || 0).toFixed(2)}</strong></div><b>{walletData?.wallet?.currency || "CREDIT"}</b></div>

              <form onSubmit={submitWalletAdjustment} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "10px", alignItems: "end", marginBottom: "20px" }}>
                <label style={{ fontSize: "12px", fontWeight: 700 }}>Amount<input type="number" min="0.01" max="1000000" step="0.01" required value={walletAdjustment.amount}
                  onChange={(e) => setWalletAdjustment({ ...walletAdjustment, amount: e.target.value })}
                  style={{ display: "block", width: "100%", boxSizing: "border-box", padding: "9px", marginTop: "5px", border: "1px solid #ccd1d6", borderRadius: "8px" }} /></label>
                <label style={{ fontSize: "12px", fontWeight: 700 }}>Action<select value={walletAdjustment.direction}
                  onChange={(e) => setWalletAdjustment({ ...walletAdjustment, direction: e.target.value })}
                  style={{ display: "block", width: "100%", padding: "9px", marginTop: "5px", border: "1px solid #ccd1d6", borderRadius: "8px" }}><option value="credit">Credit balance</option><option value="debit">Debit balance</option></select></label>
                <label style={{ fontSize: "12px", fontWeight: 700 }}>Reason<input value={walletAdjustment.description} placeholder="Manual adjustment reason"
                  onChange={(e) => setWalletAdjustment({ ...walletAdjustment, description: e.target.value })}
                  style={{ display: "block", width: "100%", boxSizing: "border-box", padding: "9px", marginTop: "5px", border: "1px solid #ccd1d6", borderRadius: "8px" }} /></label>
                <button disabled={walletSaving} style={{ padding: "10px 16px", borderRadius: "8px", border: 0, background: "#2e7d32", color: "#fff", fontWeight: 700, cursor: "pointer" }}>{walletSaving ? "Saving..." : "Update Balance"}</button>
              </form>

              {walletMsg && <p style={{ color: /success/i.test(walletMsg) ? "#2e7d32" : "#c62828", fontSize: "14px" }}>{walletMsg}</p>}

              <h4 style={{ margin: "20px 0 10px" }}>Deposit requests</h4>
              <div style={{ display: "grid", gap: "8px" }}>
                {walletData?.deposits?.map((item) => <div key={item.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "11px", border: "1px solid #e3e6e9", borderRadius: "9px" }}>
                  <div><strong>{Number(item.amount).toFixed(2)} CREDIT</strong><small style={{ display: "block", color: "#737b84" }}>{item.payment_method} to {item.receiver_account || "configured receiver"} · Txn {item.payment_reference || "No reference"} · {new Date(item.created_at).toLocaleString()}</small></div>
                  <div style={{ display: "flex", gap: "7px", alignItems: "center" }}><b style={{ fontSize: "12px" }}>{item.status}</b>{item.status === "PENDING" && item.billing_owner_id === user?.id && <><button type="button" disabled={walletSaving} onClick={() => void processUserDeposit(item.id, "approve")} style={{ border: 0, background: "#e8f5e9", color: "#2e7d32", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", fontWeight: 700 }}>Approve</button><button type="button" disabled={walletSaving} onClick={() => void processUserDeposit(item.id, "reject")} style={{ border: 0, background: "#ffebee", color: "#c62828", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", fontWeight: 700 }}>Reject</button></>}</div>
                </div>)}
                {!walletData?.deposits?.length && <p style={{ color: "#888" }}>No deposit requests.</p>}
              </div>

              <h4 style={{ margin: "22px 0 10px" }}>Credit & debit history</h4>
              <div style={{ display: "grid", gap: "8px" }}>
                {walletData?.transactions?.map((item) => <div key={item.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "14px", alignItems: "center", padding: "11px", borderBottom: "1px solid #e7e9ec" }}>
                  <div><strong>{item.description || item.transaction_type}</strong><small style={{ display: "block", color: "#737b84" }}>{new Date(item.created_at).toLocaleString()}</small></div>
                  <b style={{ color: item.direction === "credit" ? "#2e7d32" : "#c62828" }}>{item.direction === "credit" ? "+" : "−"}{Number(item.amount).toFixed(2)}</b><span style={{ color: "#59616a", fontSize: "12px" }}>Balance {Number(item.balance_after).toFixed(2)}</span>
                </div>)}
                {!walletData?.transactions?.length && <p style={{ color: "#888" }}>No wallet transactions.</p>}
              </div>
            </>}
          </div>
        </div>
      )}
    </div>
  );
}
