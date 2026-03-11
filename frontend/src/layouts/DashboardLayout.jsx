import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";

export default function DashboardLayout() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-4 p-4 lg:p-6">
        <Sidebar />

        <main className="min-w-0 flex-1 rounded-2xl border border-slate-300/20 bg-white/65 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/65">
          <Navbar />
          <div className="p-4 lg:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
