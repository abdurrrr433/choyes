import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity, Building2, CircleUserRound, Database, FileSliders,
  LayoutDashboard, LogOut, Plus, Server, ShieldCheck, Users,
} from "lucide-react";
import { useAccessAuth } from "@/contexts/AccessAuthContext";
import { accessAdminApi, accessAgencyApi } from "@/lib/access-api";
import "@/styles/access-dashboard-premium.css";

interface Account {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  created_at?: string;
}

function initials(name?: string) {
  return String(name || "User").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function formatDate(value?: string) {
  if (!value) return "Recently";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Recently" : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AccessDashboardPage() {
  const { user, logout } = useAccessAuth();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError("");
      try {
        const response = isAdmin ? await accessAdminApi<{ accounts: Account[] }>("/accounts") : await accessAgencyApi<{ users: Account[] }>("/users");
        if (active) setAccounts(isAdmin ? (response as any).accounts || [] : (response as any).users || []);
      } catch (err: any) {
        if (active) setError(err?.message || "Could not load dashboard data");
      } finally { if (active) setLoading(false); }
    }
    if (user) void load();
    return () => { active = false; };
  }, [isAdmin, user]);

  const stats = useMemo(() => {
    const active = accounts.filter((item) => item.status === "ACTIVE").length;
    const inactive = accounts.length - active;
    if (isAdmin) return [
      ["Total accounts", accounts.length, "All roles combined", "blue"],
      ["Active", active, "Currently active accounts", "green"],
      ["Inactive", inactive, "Awaiting activation / suspended", "red"],
      ["Agencies", accounts.filter((item) => item.role === "AGENCY").length, "Agency partners", "gold"],
    ];
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return [
      ["My users", accounts.length, "Users in your agency", "blue"],
      ["Active", active, "Currently active users", "green"],
      ["Inactive", inactive, "Awaiting activation / suspended", "red"],
      ["Active this week", accounts.filter((item) => item.created_at && new Date(item.created_at).getTime() >= weekAgo).length, "Recently added users", "gold"],
    ];
  }, [accounts, isAdmin]);

  function handleLogout() { logout(); navigate("/access/login"); }

  return (
    <div className="ap-shell">
      <aside className="ap-sidebar">
        <div className="ap-brand"><span className="ap-brand__mark">A</span><div><strong>Access</strong><small>{isAdmin ? "ADMIN CONSOLE" : "AGENCY CONSOLE"}</small></div></div>
        <nav className="ap-nav">
          <small>OVERVIEW</small>
          <Link className="ap-nav__link ap-nav__link--active" to="/access/dashboard"><LayoutDashboard />Dashboard</Link>
          {isAdmin ? <>
            <small>ACCESS CONTROL</small>
            <Link className="ap-nav__link" to="/access/accounts"><Users />All Accounts</Link>
            <Link className="ap-nav__link" to="/access/agencies"><Building2 />Create Agency</Link>
            <Link className="ap-nav__link" to="/access/users"><CircleUserRound />Create Users</Link>
            <small>INFRASTRUCTURE</small>
            <Link className="ap-nav__link" to="/access/session-centers"><Server />Session Centers</Link>
            <Link className="ap-nav__link" to="/access/section-rules"><FileSliders />Section Rules</Link>
          </> : <>
            <small>AGENCY</small>
            <Link className="ap-nav__link" to="/access/users"><Users />My Users</Link>
          </>}
        </nav>
        <div className="ap-sidebar__foot">Access Control · v2</div>
      </aside>

      <main className="ap-main">
        <header className="ap-topbar">
          <div><small>{isAdmin ? "ADMIN CONSOLE" : "AGENCY CONSOLE"}</small><strong>Welcome back, {user?.name || "User"}</strong></div>
          <div className="ap-account"><span className={`ap-role ap-role--${isAdmin ? "admin" : "agency"}`}>{user?.role}</span><span className="ap-avatar">{initials(user?.name)}</span><div><strong>{user?.name}</strong><small>{user?.email}</small></div><button onClick={handleLogout}><LogOut />Logout</button></div>
        </header>

        <section className="ap-hero">
          <span className="ap-hero__ring ap-hero__ring--one"/><span className="ap-hero__ring ap-hero__ring--two"/>
          <div className="ap-eyebrow"><ShieldCheck />{isAdmin ? "SYSTEM ADMINISTRATOR" : "AGENCY WORKSPACE"}</div>
          <h1>{isAdmin ? "Control every account, agency and exam centre from one command centre." : "Manage your team of exam-booking users with confidence."}</h1>
          <p>{isAdmin ? "Provision agencies, create users, configure session centres and adjust section rules — every change stays visible in real time." : "Create users, monitor account health and keep your agency team ready for every booking."}</p>
          <div className="ap-hero__actions">
            {isAdmin ? <><Link className="ap-btn ap-btn--gold" to="/access/agencies"><Plus />New Agency</Link><Link className="ap-btn" to="/access/users"><Plus />New User</Link><Link className="ap-btn" to="/access/accounts">Manage Accounts →</Link></> : <Link className="ap-btn ap-btn--gold" to="/access/users"><Plus />Add User</Link>}
          </div>
        </section>

        {error && <div className="ap-error">{error}</div>}
        <section className="ap-stats">{stats.map(([label, value, note, tone]) => <article className="ap-stat" key={String(label)}><small>{label}</small><strong className={`ap-tone--${tone}`}>{loading ? "…" : value}</strong><span>{note}</span></article>)}</section>

        {isAdmin && <section className="ap-infra">
          <Link className="ap-infra__card" to="/access/session-centers"><Server /><div><small>SESSION CENTERS</small><strong>Manage</strong></div></Link>
          <Link className="ap-infra__card" to="/access/section-rules"><FileSliders /><div><small>SECTION RULES</small><strong>Configure</strong></div></Link>
          <Link className="ap-infra__card" to="/access/test-centers"><Database /><div><small>TEST CENTERS</small><strong>Review</strong></div></Link>
        </section>}

        <section className="ap-grid">
          <article className="ap-panel ap-list"><header><div><small>RECENT ACTIVITY</small><h2>{isAdmin ? "Recently created accounts" : "Your agency users"}</h2></div><Link to={isAdmin ? "/access/accounts" : "/access/users"}>View all</Link></header>
            {loading ? <p className="ap-muted">Loading live accounts…</p> : accounts.slice(0, 6).map((item) => <div className="ap-row" key={item.id}><span className="ap-row__avatar">{initials(item.name)}</span><div><strong>{item.name}</strong><small>{item.email}</small></div><span className="ap-row__role">{item.role}</span><time>{formatDate(item.created_at)}</time><span className={`ap-status ap-status--${item.status === "ACTIVE" ? "active" : "inactive"}`}>● {item.status}</span></div>)}
            {!loading && !accounts.length && <p className="ap-muted">No accounts found.</p>}
          </article>
          <aside className="ap-panel ap-quick"><small>SHORTCUTS</small><h2>Quick Actions</h2>{isAdmin && <Link to="/access/agencies"><Building2 />Create Agency</Link>}<Link to="/access/users"><Users />{isAdmin ? "Create User" : "Manage My Users"}</Link><div className="ap-self"><Activity /><div><small>YOUR ACCOUNT</small><strong>{user?.status}</strong><span>{user?.email}</span></div></div></aside>
        </section>
      </main>
    </div>
  );
}
