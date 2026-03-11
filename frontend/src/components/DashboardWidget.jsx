export default function DashboardWidget({ title, value, trend }) {
  return (
    <div className="rounded-2xl border border-slate-300/20 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/70">
      <div className="text-xs uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-50">{value}</div>
      <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">{trend}</div>
    </div>
  );
}
