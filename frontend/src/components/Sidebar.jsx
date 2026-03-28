import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BarChart3,
  CheckSquare,
  Inbox,
  LayoutDashboard,
  LogOut,
  PenSquare,
  Paperclip,
  Search,
  Settings,
  ShieldAlert,
} from "lucide-react";
import { Sidebar as ShellSidebar, useSidebar } from "./ui/sidebar";
import { cn } from "../lib/utils";
import { logout } from "../api/auth";
import BrandLogo from "./BrandLogo";
import api from "../api/client";

const baseItems = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/inbox", label: "Inbox", icon: Inbox },
  { to: "/app/priority", label: "Priority Emails", icon: AlertTriangle },
  { to: "/app/tasks", label: "Tasks Extracted", icon: CheckSquare },
  { to: "/app/attachments", label: "Attachments", icon: Paperclip },
  { to: "/app/search", label: "Contextual Search", icon: Search },
  { to: "/app/analytics", label: "Analytics", icon: BarChart3 },
];

function NavItem({ to, label, icon, destructive = false, onClick }) {
  const { collapsed } = useSidebar();

  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all hover:bg-accent/30",
          isActive && !destructive && "bg-accent text-accent-foreground font-medium",
          destructive && "text-destructive hover:bg-destructive/10",
          collapsed && "justify-center px-0"
        )
      }
    >
      {(() => { const IconComponent = icon; return <IconComponent className="h-4.5 w-4.5 shrink-0" />; })()}
      {!collapsed ? <span>{label}</span> : null}
    </NavLink>
  );
}

export default function Sidebar({ onCompose }) {
  const { collapsed } = useSidebar();
  const navigate = useNavigate();
  const [isStaff, setIsStaff] = useState(false);

  const confirmLogout = () => window.confirm("Log out of MailMind now?");

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      try {
        const res = await api.get("/api/users/me/");
        if (!cancelled) {
          setIsStaff(Boolean(res.data.is_staff || res.data.is_superuser));
        }
      } catch {
        if (!cancelled) {
          setIsStaff(false);
        }
      }
    };

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  const items = isStaff
    ? [...baseItems, { to: "/app/admin", label: "Admin Panel", icon: ShieldAlert }]
    : baseItems;

  return (
    <ShellSidebar className="border border-sidebar-border bg-sidebar/95 p-4 shadow-card">
      <div className={cn("px-2 pb-6", collapsed && "flex justify-center px-0")}>
        <BrandLogo size={collapsed ? "xs" : "sm"} showWordmark={!collapsed} />
      </div>

      <div className="pb-4">
        <button
          type="button"
          onClick={() => onCompose?.()}
          className={cn(
            "gradient-primary flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold text-white shadow-glow transition-all duration-200 hover:-translate-y-0.5 hover:opacity-95",
            collapsed && "justify-center px-0"
          )}
          aria-label="Compose email"
        >
          <PenSquare className="h-4.5 w-4.5 shrink-0" />
          {!collapsed ? <span>Compose</span> : null}
        </button>
      </div>

      <nav className="space-y-1.5">
        {items.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      <div className="mt-auto space-y-1.5 pt-6">
        <NavItem to="/app/settings" label="Settings" icon={Settings} />
        <NavItem
          to="/"
          label="Logout"
          icon={LogOut}
          destructive
          onClick={(event) => {
            event.preventDefault();
            if (!confirmLogout()) {
              return;
            }
            logout();
            navigate("/", { replace: true });
          }}
        />
      </div>
    </ShellSidebar>
  );
}

