import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import api from "../api/client";

export default function RequireAdmin({ children }) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      try {
        const res = await api.get("/api/users/me/");
        if (!cancelled) {
          setAllowed(Boolean(res.data.is_staff || res.data.is_superuser));
        }
      } catch {
        if (!cancelled) {
          setAllowed(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground shadow-card">
        Loading admin access...
      </div>
    );
  }

  if (!allowed) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return children;
}
