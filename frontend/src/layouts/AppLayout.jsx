import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";

const navItems = [
  { to: "/inbox", label: "Inbox" },
  { to: "/smart/priority", label: "High Priority" },
  { to: "/smart/meetings", label: "Meetings" },
  { to: "/smart/payments", label: "Payments" },
  { to: "/smart/support", label: "Support" },
  { to: "/smart/deliveries", label: "Deliveries" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/connect-gmail", label: "Connect Gmail" },
  { to: "/settings", label: "Settings" },
];

const navClass = ({ isActive }) =>
  `group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition ${
    isActive
      ? "bg-[#1f2d46] text-white shadow-sm"
      : "text-slate-300 hover:bg-[#1a253a] hover:text-white"
  }`;

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    navigate("/login");
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px] gap-4 p-4 lg:p-6">
        <aside className="hidden w-[280px] shrink-0 rounded-2xl border border-slate-500/25 bg-[#11192a]/90 p-4 backdrop-blur md:block">
          <div className="mb-6 rounded-2xl border border-slate-500/25 bg-[#1a263d]/60 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">MailMind</div>
            <div className="mt-2 text-xl font-bold text-white">AI Email Triage</div>
            <p className="mt-2 text-xs text-slate-300/80">
              Prioritize inbox with urgency, intent, and smart insights.
            </p>
          </div>

          <nav className="space-y-1.5">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={navClass}>
                <span>{item.label}</span>
                {location.pathname === item.to && (
                  <span className="h-2 w-2 rounded-full bg-cyan-400" />
                )}
              </NavLink>
            ))}
          </nav>

          <div className="mt-6 rounded-xl border border-slate-500/25 bg-[#111a2a]/80 p-3">
            <div className="text-xs text-slate-400">Keyboard</div>
            <div className="mt-2 text-xs text-slate-300">`J/K` navigate, `P` predict, `/` search</div>
          </div>

          <button
            onClick={logout}
            className="mt-4 w-full rounded-xl border border-slate-500/35 bg-[#1c2740] px-3 py-2 text-sm text-slate-100 transition hover:bg-[#253352]"
          >
            Logout
          </button>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col rounded-2xl border border-slate-500/25 bg-[#101826]/90 backdrop-blur">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-500/25 px-4 py-3 lg:px-6">
            <div>
              <div className="text-lg font-semibold text-white">MailMind Workspace</div>
              <div className="text-xs text-slate-400">Professional inbox intelligence</div>
            </div>

            <div className="flex items-center gap-2">
              <NavLink
                to="/login"
                className="rounded-xl border border-slate-500/35 bg-[#16213a] px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-[#223055]"
              >
                Login
              </NavLink>
              <NavLink
                to="/connect-gmail"
                className="rounded-xl bg-cyan-500 px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-cyan-400"
              >
                Connect Gmail
              </NavLink>
            </div>
          </header>

          <div className="min-h-0 flex-1 p-4 lg:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
