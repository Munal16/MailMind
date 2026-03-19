import { useEffect, useMemo, useState } from "react";
import TaskCard from "../components/TaskCard";
import api from "../api/client";

const columnMeta = {
  pending: { title: "Pending", dot: "bg-warning", status: "Pending" },
  progress: { title: "In Progress", dot: "bg-primary", status: "In Progress" },
  completed: { title: "Completed", dot: "bg-success", status: "Completed" },
};

function Column({ title, dot, items }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        <span className="font-semibold text-card-foreground">{title}</span>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{items.length}</span>
      </div>
      <div className="mt-4 space-y-3">
        {items.length ? (
          items.map((task) => <TaskCard key={task.id} {...task} />)
        ) : (
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            No tasks in this stage.
          </div>
        )}
      </div>
    </div>
  );
}

function mapTask(task) {
  return {
    id: task.id,
    title: task.task_text,
    source: task.email_sender || task.email_subject || "Unknown",
    deadline: task.deadline || "Deadline not detected",
    priority: task.confidence >= 0.85 ? "High" : task.confidence >= 0.65 ? "Medium" : "Low",
    status: task.status,
    owner: task.responsibility || "Unassigned",
    project: task.project_name || null,
  };
}

export default function TasksExtracted() {
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setError("");
        const res = await api.get("/api/ai/tasks/");
        setTasks((res.data.tasks || []).map(mapTask));
      } catch (err) {
        setTasks([]);
        setError(typeof err.response?.data === "string" ? err.response.data : JSON.stringify(err.response?.data || err.message));
      }
    };
    load();
  }, []);

  const grouped = useMemo(
    () => ({
      pending: tasks.filter((task) => task.status === "Pending"),
      progress: tasks.filter((task) => task.status === "In Progress"),
      completed: tasks.filter((task) => task.status === "Completed"),
    }),
    [tasks]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Tasks Extracted</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          AI-generated work items extracted from email content, including deadline and responsibility hints.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {Object.entries(columnMeta).map(([key, meta]) => (
          <Column key={key} title={meta.title} dot={meta.dot} items={grouped[key]} />
        ))}
      </div>
    </div>
  );
}
