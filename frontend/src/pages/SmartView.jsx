import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/client";

const TITLES = {
  priority: "High Priority",
  meetings: "Meetings",
  payments: "Payments",
  support: "Support",
  deliveries: "Deliveries",
};

export default function SmartView() {
  const { viewType } = useParams();
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const title = useMemo(() => TITLES[viewType] || "Smart View", [viewType]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/api/gmail/smart/${viewType}/`);
      setEmails(res.data.emails || []);
    } catch (err) {
      setError(JSON.stringify(err.response?.data || err.message));
      setEmails([]);
    } finally {
      setLoading(false);
    }
  }, [viewType]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Smart Triage</div>
          <div className="text-2xl font-bold text-white">{title}</div>
          <div className="text-sm text-slate-300">Auto-grouped by AI urgency and intent predictions</div>
        </div>

        <button
          onClick={load}
          className="rounded-xl border border-slate-500/35 bg-[#223250] px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-[#2c3f62]"
        >
          Refresh
        </button>
      </div>

      {loading && (
        <div className="rounded-xl border border-slate-500/25 bg-[#121d31]/90 p-4 text-sm text-slate-300">
          Loading emails...
        </div>
      )}

      {!!error && (
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">
          {error}
        </div>
      )}

      {!loading && emails.length === 0 && !error && (
        <div className="rounded-xl border border-slate-500/25 bg-[#121d31]/90 p-4 text-sm text-slate-300">
          No emails found for this category yet. Sync and predict first.
        </div>
      )}

      <div className="space-y-3">
        {emails.map((e) => (
          <div key={e.gmail_id} className="rounded-xl border border-slate-500/25 bg-[#121d31]/90 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">{e.subject || "(no subject)"}</div>
                <div className="truncate text-xs text-slate-300">{e.sender}</div>
              </div>
              {e.prediction && (
                <div className="flex gap-2">
                  <span className="rounded-full border border-slate-500/35 bg-[#1b2a45] px-2 py-1 text-[10px] text-slate-100">
                    {e.prediction.intent}
                  </span>
                  <span className="rounded-full border border-slate-500/35 bg-[#1b2a45] px-2 py-1 text-[10px] text-slate-100">
                    {e.prediction.urgency}
                  </span>
                  <span className="rounded-full bg-cyan-400 px-2 py-1 text-[10px] font-bold text-slate-900">
                    {e.prediction.priority_score}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-2 text-sm text-slate-200">{e.snippet}</div>
            <div className="mt-2 text-xs text-slate-400">{e.internal_date || ""}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
