import { NavLink, useNavigate } from "react-router-dom";
import {
  BarChart3,
  BrainCircuit,
  Inbox,
  LayoutDashboard,
  LogOut,
  Paperclip,
  Search,
  Settings,
  Target,
  CheckSquare,
} from "lucide-react";

const menu = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/inbox", label: "Inbox", icon: Inbox },
  { to: "/app/priority", label: "Priority Emails", icon: Target },
  { to: "/app/tasks", label: "Tasks Extracted", icon: CheckSquare },
  { to: "/app/attachments", label: "Attachments", icon: Paperclip },
  { to: "/app/search", label: "Contextual Search", icon: Search },
  { to: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const navigate = useNavigate();

  return (
    <aside className="hidden w-[280px] shrink-0 rounded-2xl border border-slate-300/20 bg-white/70 p-4 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/70 lg:block">
      <div className="mb-6 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 p-4 text-white">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <BrainCircuit className="h-4 w-4" />
          MailMind
        </div>
        <div className="mt-2 text-xs text-indigo-100">AI Powered Email Intelligence</div>
      </div>

      <nav className="space-y-1">
        {menu.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                isActive
                  ? "bg-indigo-500 text-white shadow"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <button
        type="button"
        onClick={() => {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          navigate("/login");
        }}
        className="mt-6 flex items-center gap-2 rounded-xl border border-slate-300/20 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <LogOut className="h-4 w-4" />
        Logout
      </button>
    </aside>
  );
}
