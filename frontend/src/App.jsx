import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import DashboardLayout from "./layouts/DashboardLayout";
import RequireAuth from "./components/RequireAuth";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ConnectEmail from "./pages/ConnectEmail";
import Dashboard from "./pages/Dashboard";
import Inbox from "./pages/Inbox";
import PriorityEmails from "./pages/PriorityEmails";
import TasksExtracted from "./pages/TasksExtracted";
import AttachmentsPage from "./pages/AttachmentsPage";
import ContextualSearch from "./pages/ContextualSearch";
import AnalyticsPage from "./pages/AnalyticsPage";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/connect-email" element={<ConnectEmail />} />

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
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
