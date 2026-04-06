import { Navigate, useLocation } from "react-router-dom";
import { hasStoredSession } from "../api/sessionStore";

export default function RequireAuth({ children }) {
  const location = useLocation();
  const token = hasStoredSession();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
