import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import AppFooter from "../components/AppFooter";
import ComposeMailDrawer from "../components/ComposeMailDrawer";
import { SidebarProvider } from "../components/ui/sidebar";

export default function DashboardLayout() {
  const location = useLocation();
  const mainRef = useRef(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeInitialData, setComposeInitialData] = useState({ mode: "new" });

  useEffect(() => {
    if (!mainRef.current) return;
    mainRef.current.scrollTo({ top: 0, left: 0, behavior: "auto" });
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, location.search]);

  const openCompose = useCallback((initialData = {}) => {
    setComposeInitialData({ mode: "new", ...initialData });
    setComposeOpen(true);
  }, []);

  const closeCompose = useCallback(() => {
    setComposeOpen(false);
  }, []);

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-background text-foreground">
        <div className="flex min-h-screen gap-4 p-4">
          <Sidebar onCompose={openCompose} />
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            <Navbar />
            <main ref={mainRef} className="flex-1 overflow-y-auto">
              <div className="flex min-h-full flex-col p-6">
                <div className="flex-1">
                  <Outlet context={{ openCompose }} />
                </div>
                <AppFooter />
              </div>
            </main>
          </div>
        </div>
        <ComposeMailDrawer open={composeOpen} onClose={closeCompose} initialData={composeInitialData} />
      </div>
    </SidebarProvider>
  );
}
