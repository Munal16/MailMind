import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";

export default function ConnectEmail() {
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState("");

  const connectGmail = async () => {
    try {
      setStatus("Requesting Gmail OAuth URL...");
      const res = await api.get("/api/gmail/auth-url/");
      window.location.href = res.data.authorization_url;
    } catch (err) {
      if (err.response?.status === 401) {
        setStatus("Login required. Redirecting...");
        setTimeout(() => navigate("/login"), 600);
        return;
      }
      setStatus(JSON.stringify(err.response?.data || err.message));
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.post("/api/gmail/sync/", { max_results: 20 });
      setStatus(`Synced. Saved ${res.data.saved}, skipped ${res.data.skipped}`);
    } catch (err) {
      setStatus(JSON.stringify(err.response?.data || err.message));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-10">
      <h1 className="text-3xl font-bold">Connect Email Account</h1>
      <p className="text-slate-600 dark:text-slate-300">Set up your mailbox in two quick steps.</p>

      <div className="rounded-2xl border border-slate-300/20 bg-white/80 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <div className="text-sm font-semibold">Step 1: Connect Gmail via OAuth</div>
        <button onClick={connectGmail} className="mt-3 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
          Connect Gmail
        </button>
      </div>

      <div className="rounded-2xl border border-slate-300/20 bg-white/80 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <div className="text-sm font-semibold">Step 2: Sync Emails</div>
        <button
          onClick={handleSync}
          className="mt-3 rounded-xl border border-slate-300/20 px-4 py-2 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Sync Emails
        </button>
        {syncing && (
          <div className="mt-3 inline-flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Fetching emails...
          </div>
        )}
      </div>

      {status && (
        <div className="rounded-2xl border border-slate-300/20 bg-white/80 p-4 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200">
          {status}
        </div>
      )}
    </div>
  );
}
