import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { SidebarProvider } from "../components/ui/sidebar";

export default function DashboardLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen bg-background text-foreground">
        <div className="flex min-h-screen gap-4 p-4">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            <Navbar />
            <main className="flex-1 overflow-y-auto p-6">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
