import { useEffect, useMemo, useState } from "react";
import TaskCard from "../components/TaskCard";
import api from "../api/client";

function toTask(email, idx) {
  return {
    id: `${email.gmail_id}-${idx}`,
    title: email.subject || "Follow up email",
    source: email.sender || "Unknown",
    deadline: email.prediction?.urgency === "High" ? "Today" : "This week",
    priority: email.prediction?.urgency || "Low",
  };
}

function Column({ title, items }) {
  return (
    <div className="rounded-2xl border border-slate-300/20 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
      <div className="mb-3 text-sm font-semibold">{title}</div>
      <div className="space-y-3">
        {items.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}

export default function TasksExtracted() {
  const [emails, setEmails] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setError("");
        const res = await api.get("/api/gmail/inbox/?limit=120");
        setEmails((res.data.emails || []).filter((e) => e.prediction));
      } catch (err) {
        setError(JSON.stringify(err.response?.data || err.message));
      }
    };
    load();
  }, []);

  const tasks = useMemo(() => emails.map(toTask), [emails]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Tasks Extracted</h1>
      {!!error && <div className="rounded-lg border border-red-300/40 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">{error}</div>}
      <div className="grid gap-4 lg:grid-cols-3">
        <Column title="Pending" items={tasks.filter((_, i) => i % 3 === 0)} />
        <Column title="In Progress" items={tasks.filter((_, i) => i % 3 === 1)} />
        <Column title="Completed" items={tasks.filter((_, i) => i % 3 === 2)} />
      </div>
    </div>
  );
}
