/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from "react";
import { PanelLeft } from "lucide-react";
import { cn } from "../../lib/utils";

const SidebarContext = createContext(null);

export function SidebarProvider({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  return <SidebarContext.Provider value={{ collapsed, setCollapsed }}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}

export function Sidebar({ className, children }) {
  const { collapsed } = useSidebar();
  return (
    <aside
      className={cn(
        "glass-panel hidden h-[calc(100vh-2rem)] rounded-2xl bg-sidebar text-sidebar-foreground lg:block",
        collapsed ? "w-20" : "w-72",
        className
      )}
    >
      {children}
    </aside>
  );
}

export function SidebarTrigger({ className }) {
  const { collapsed, setCollapsed } = useSidebar();
  return (
    <button
      type="button"
      onClick={() => setCollapsed(!collapsed)}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card hover:bg-accent/30",
        className
      )}
    >
      <PanelLeft className="h-4 w-4" />
    </button>
  );
}
