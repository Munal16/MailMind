const priorityColor = {
  High: "text-red-600 dark:text-red-300",
  Medium: "text-orange-600 dark:text-orange-300",
  Low: "text-emerald-600 dark:text-emerald-300",
};

export default function TaskCard({ task }) {
  return (
    <div className="rounded-xl border border-slate-300/20 bg-white/80 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
      <div className="text-sm font-semibold">{task.title}</div>
      <div className="mt-1 text-xs text-slate-500">From: {task.source}</div>
      <div className="mt-2 text-xs text-slate-500">Deadline: {task.deadline}</div>
      <div className={`mt-2 text-xs font-semibold ${priorityColor[task.priority] || ""}`}>{task.priority}</div>
    </div>
  );
}
