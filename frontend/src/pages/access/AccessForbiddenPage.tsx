import { Link, useLocation } from "react-router-dom";
import { ShieldX } from "lucide-react";

export default function AccessForbiddenPage() {
  const location = useLocation();
  const permission = (location.state as { permission?: string } | null)?.permission;
  return <main className="min-h-screen bg-[#070b1b] px-5 py-20 text-[#f5f6ff]">
    <section className="mx-auto max-w-lg rounded-2xl border border-[#28325b] bg-[#111832] p-8 text-center shadow-2xl">
      <ShieldX className="mx-auto mb-5 h-12 w-12 text-amber-300" />
      <h1 className="mb-3 text-2xl font-extrabold">Permission required</h1>
      <p className="mb-6 text-sm leading-6 text-[#9199b8]">Your account is active, but an administrator has not enabled {permission ? <strong className="text-amber-300">{permission}</strong> : "this page"}.</p>
      <div className="flex justify-center gap-3"><Link className="rounded-lg bg-amber-300 px-5 py-3 font-bold text-slate-950" to="/dashboard">Dashboard</Link><Link className="rounded-lg border border-[#39436e] px-5 py-3" to="/wallet">Wallet</Link></div>
    </section>
  </main>;
}
