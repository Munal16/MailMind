import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../api/auth";
import api from "../api/client";

export default function Settings() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [gmail, setGmail] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const [meRes, gRes] = await Promise.all([
          api.get("/api/users/me/"),
          api.get("/api/gmail/status/"),
        ]);
        setProfile(meRes.data);
        setGmail(gRes.data);
      } catch {
        setMessage("Failed to load settings from API.");
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-300/20 bg-white/80 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <div className="text-sm font-semibold">Profile</div>
          <p className="mt-2 text-sm text-slate-500">Username: {profile?.username || "-"}</p>
          <p className="text-sm text-slate-500">Email: {profile?.email || "-"}</p>
        </div>

        <div className="rounded-2xl border border-slate-300/20 bg-white/80 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <div className="text-sm font-semibold">Connected Email Accounts</div>
          <p className="mt-2 text-sm text-slate-500">Gmail Connected: {String(gmail?.connected ?? false)}</p>
          <button
            onClick={() => navigate("/connect-email")}
            className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
          >
            Connect / Reconnect Gmail
          </button>
        </div>

        {["Notification Preferences", "AI Model Preferences", "Security"].map((section) => (
          <div key={section} className="rounded-2xl border border-slate-300/20 bg-white/80 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <div className="text-sm font-semibold">{section}</div>
            <p className="mt-2 text-sm text-slate-500">Configure {section.toLowerCase()} for your MailMind workspace.</p>
            <button className="mt-4 rounded-lg border border-slate-300/20 px-4 py-2 text-xs font-semibold dark:border-slate-700">
              Update
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() => {
          logout();
          navigate("/login", { replace: true });
        }}
        className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500"
      >
        Logout
      </button>

      {message && <div className="rounded-lg border border-amber-300/40 bg-amber-50 px-3 py-2 text-xs text-amber-700">{message}</div>}
    </div>
  );
}
