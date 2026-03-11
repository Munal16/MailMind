import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";

export default function ConnectGmail() {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const connect = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setMsg("You are not logged in. Redirecting to login...");
      setTimeout(() => navigate("/login"), 700);
      return;
    }

    setBusy(true);
    try {
      setMsg("Requesting Google authorization URL...");
      const res = await api.get("/api/gmail/auth-url/");
      window.location.href = res.data.authorization_url;
    } catch (err) {
      const status = err.response?.status;
      const details = err.response?.data;

      if (status === 401) {
        setMsg("Session expired. Redirecting to login...");
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        setTimeout(() => navigate("/login"), 700);
        return;
      }

      if (!err.response) {
        setMsg("Network error: backend not reachable on 127.0.0.1:8000");
        return;
      }

      setMsg(JSON.stringify(details || err.message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[1.25fr_1fr]">
      <section className="rounded-3xl border border-slate-500/25 bg-[#121d31]/90 p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Google Workspace</div>
        <h2 className="mt-2 text-3xl font-bold text-white">Connect Gmail</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          Connect your Gmail inbox once. MailMind will securely sync emails and run priority analysis for your dashboard.
        </p>
        <div className="mt-5 rounded-2xl border border-slate-500/25 bg-[#17243d] p-4 text-sm text-slate-200">
          Tip: keep your JWT session active, then click Connect with Google and approve access.
        </div>
      </section>

      <section className="rounded-3xl border border-slate-500/25 bg-[#0f1729]/90 p-6">
        <div className="text-sm font-semibold text-white">OAuth Action</div>
        <button
          onClick={connect}
          disabled={busy}
          className="mt-4 w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {busy ? "Connecting..." : "Connect with Google"}
        </button>

        <div className="mt-4 rounded-xl border border-slate-500/25 bg-[#141f35] px-3 py-3 text-xs text-slate-300">
          Status: {msg || "Waiting for action"}
        </div>
      </section>
    </div>
  );
}
