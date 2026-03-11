import { useEffect, useMemo, useState } from "react";
import api from "../api/client";

export default function ContextualSearch() {
  const [query, setQuery] = useState("project meeting last week");
  const [emails, setEmails] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get("/api/gmail/inbox/?limit=200");
        setEmails(res.data.emails || []);
      } catch {
        setEmails([]);
      }
    };
    load();
  }, []);

  const normalized = query.toLowerCase();
  const resultEmails = useMemo(
    () =>
      emails.filter((e) =>
        `${e.subject || ""} ${e.sender || ""} ${e.snippet || ""}`.toLowerCase().includes(normalized)
      ),
    [emails, normalized]
  );

  const resultAttachments = useMemo(
    () =>
      resultEmails.filter((e) => (e.labels || []).includes("HAS_ATTACHMENT") || (e.snippet || "").toLowerCase().includes("attach")),
    [resultEmails]
  );

  const resultTasks = useMemo(
    () => resultEmails.filter((e) => e.prediction?.urgency === "High" || e.prediction?.intent === "Meeting"),
    [resultEmails]
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Contextual Search</h1>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-xl border border-slate-300/20 bg-white px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-950"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-300/20 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/80">
          <h2 className="text-sm font-semibold">Matching Emails</h2>
          <div className="mt-2 space-y-2 text-sm">
            {resultEmails.map((e) => <div key={e.gmail_id} className="rounded-lg bg-slate-100/70 px-3 py-2 dark:bg-slate-800/70">{e.subject || "(no subject)"}</div>)}
          </div>
        </section>
        <section className="rounded-2xl border border-slate-300/20 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/80">
          <h2 className="text-sm font-semibold">Matching Attachments</h2>
          <div className="mt-2 space-y-2 text-sm">
            {resultAttachments.map((e) => <div key={e.gmail_id} className="rounded-lg bg-slate-100/70 px-3 py-2 dark:bg-slate-800/70">{e.subject || "(no subject)"}</div>)}
          </div>
        </section>
        <section className="rounded-2xl border border-slate-300/20 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/80">
          <h2 className="text-sm font-semibold">Matching Tasks</h2>
          <div className="mt-2 space-y-2 text-sm">
            {resultTasks.map((e) => <div key={e.gmail_id} className="rounded-lg bg-slate-100/70 px-3 py-2 dark:bg-slate-800/70">{e.subject || "(no subject)"}</div>)}
          </div>
        </section>
      </div>
    </div>
  );
}
