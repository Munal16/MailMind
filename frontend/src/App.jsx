import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ConfirmProvider } from "./context/ConfirmContext";
import DashboardLayout from "./layouts/DashboardLayout";
import RequireAuth from "./components/RequireAuth";
import RequireAdmin from "./components/RequireAdmin";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ConnectEmail from "./pages/ConnectEmail";
import GoogleAuthCallback from "./pages/GoogleAuthCallback";
import Dashboard from "./pages/Dashboard";
import Inbox from "./pages/Inbox";
import PriorityEmails from "./pages/PriorityEmails";
import TasksExtracted from "./pages/TasksExtracted";
import AttachmentsPage from "./pages/AttachmentsPage";
import ContextualSearch from "./pages/ContextualSearch";
import AnalyticsPage from "./pages/AnalyticsPage";
import Settings from "./pages/Settings";
import AdminPanel from "./pages/AdminPanel";

export default function App() {
  return (
    <ConfirmProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/connect-email"
          element={
            <RequireAuth>
              <ConnectEmail />
            </RequireAuth>
          }
        />
        <Route path="/auth/google/callback" element={<GoogleAuthCallback />} />

        <Route
          path="/app"
          element={
            <RequireAuth>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route path="" element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="priority" element={<PriorityEmails />} />
          <Route path="tasks" element={<TasksExtracted />} />
          <Route path="attachments" element={<AttachmentsPage />} />
          <Route path="search" element={<ContextualSearch />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="settings" element={<Settings />} />
          <Route
            path="admin"
            element={
              <RequireAdmin>
                <AdminPanel />
              </RequireAdmin>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </ConfirmProvider>
  );
}
