import { useEffect, useMemo, useState } from "react";
import EmailCard from "../components/EmailCard";
import api from "../api/client";

function toViewModel(e) {
  return {
    id: e.gmail_id,
    sender: e.sender || "Unknown",
    subject: e.subject || "(no subject)",
    preview: e.snippet || "",
    timestamp: e.internal_date ? new Date(e.internal_date).toLocaleString() : "",
    urgency: e.prediction?.urgency || "Low",
    intent: e.prediction?.intent || "General",
    project: "General",
    task: Boolean(e.prediction),
  };
}

export default function Inbox() {
  const [emailsRaw, setEmailsRaw] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [urgency, setUrgency] = useState("All");
  const [intent, setIntent] = useState("All");

  const loadInbox = async () => {
    try {
      setError("");
      const res = await api.get("/api/gmail/inbox/?limit=200");
      const list = res.data.emails || [];
      setEmailsRaw(list);
      if (list.length > 0) {
        setSelected(list[0]);
      }
    } catch (err) {
      setError(JSON.stringify(err.response?.data || err.message));
    }
  };

  const predictBatch = async () => {
    try {
      await api.post("/api/ai/predict-batch/", { limit: 50 });
      await loadInbox();
    } catch (err) {
      setError(JSON.stringify(err.response?.data || err.message));
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadInbox();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!selected?.gmail_id) return;
    const loadDetail = async () => {
      try {
        const res = await api.get(`/api/gmail/message/${selected.gmail_id}/`);
        setDetail(res.data);
      } catch {
        setDetail(null);
      }
    };
    loadDetail();
  }, [selected?.gmail_id]);

  const emails = useMemo(() => {
    return emailsRaw
      .map(toViewModel)
      .filter((e) => (urgency === "All" ? true : e.urgency === urgency))
      .filter((e) => (intent === "All" ? true : e.intent === intent));
  }, [emailsRaw, urgency, intent]);

  return (
    <div className="grid gap-4 xl:grid-cols-[220px_1fr_1fr]">
      <aside className="rounded-2xl border border-slate-300/20 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <div className="text-sm font-semibold">Folders</div>
        <div className="mt-3 space-y-2 text-sm">
          {["Inbox", "Important", "Starred", "Sent", "Archived"].map((f) => (
            <div key={f} className="rounded-lg bg-slate-100/70 px-3 py-2 dark:bg-slate-800/70">{f}</div>
          ))}
        </div>
      </aside>

      <section className="rounded-2xl border border-slate-300/20 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button onClick={loadInbox} className="rounded-lg border border-slate-300/20 px-3 py-1 text-xs dark:border-slate-700">Refresh</button>
          <button onClick={predictBatch} className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white">Predict Latest 50</button>
          <select className="rounded-lg border border-slate-300/20 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950" value={urgency} onChange={(e) => setUrgency(e.target.value)}>
            {["All", "High", "Medium", "Low"].map((x) => <option key={x}>{x}</option>)}
          </select>
          <select className="rounded-lg border border-slate-300/20 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950" value={intent} onChange={(e) => setIntent(e.target.value)}>
            {["All", "Meeting", "Payment", "Support", "Delivery", "General"].map((x) => <option key={x}>{x}</option>)}
          </select>
        </div>

        {!!error && <div className="mb-3 rounded-lg border border-red-300/40 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">{error}</div>}

        <div className="space-y-3">
          {emails.map((email) => (
            <button key={email.id} onClick={() => setSelected(emailsRaw.find((x) => x.gmail_id === email.id) || null)} className="w-full text-left">
              <EmailCard email={email} compact />
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-300/20 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <div className="text-xs uppercase tracking-wide text-slate-500">Email Preview</div>
        {selected ? (
          <div className="mt-3">
            <EmailCard email={toViewModel(selected)} />
            <div className="mt-4 rounded-xl border border-slate-300/20 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
              {detail?.body_text || detail?.body_html || selected.snippet || "No body available."}
            </div>
          </div>
        ) : (
          <div className="mt-4 text-sm text-slate-500">Select an email to preview.</div>
        )}
      </section>
    </div>
  );
}
