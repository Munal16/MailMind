import { useEffect, useState } from "react";
import api from "../api/client";

export default function PriorityEmails() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setError("");
      const res = await api.get("/api/gmail/smart/priority/");
      setItems(res.data.emails || []);
    } catch (err) {
      setError(JSON.stringify(err.response?.data || err.message));
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Priority Emails</h1>
        <button onClick={load} className="rounded-lg border border-slate-300/20 px-3 py-1 text-xs dark:border-slate-700">Refresh</button>
      </div>

      {!!error && <div className="rounded-lg border border-red-300/40 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-slate-300/20 bg-white/80 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100/80 text-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
            <tr>
              <th className="px-4 py-3">Sender</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Urgency</th>
              <th className="px-4 py-3">Intent</th>
              <th className="px-4 py-3">Deadline</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.gmail_id} className="border-t border-slate-300/20 dark:border-slate-700">
                <td className="px-4 py-3">{e.sender || "Unknown"}</td>
                <td className="px-4 py-3">{e.subject || "(no subject)"}</td>
                <td className="px-4 py-3 text-red-500">{e.prediction?.urgency || "High"}</td>
                <td className="px-4 py-3">{e.prediction?.intent || "General"}</td>
                <td className="px-4 py-3">{e.prediction?.urgency === "High" ? "Soon" : "—"}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={5}>
                  No high-priority emails found. Predict and sync first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
