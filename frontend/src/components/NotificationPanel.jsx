import { Bell } from "lucide-react";

const notifications = [
  "3 urgent emails need attention",
  "2 tasks due in next 6 hours",
  "Weekly analytics report is ready",
];

export default function NotificationPanel() {
  return (
    <div className="rounded-xl border border-slate-300/20 bg-white/70 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Bell className="h-4 w-4 text-indigo-500" />
        Notifications
      </div>
      <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
        {notifications.map((n) => (
          <li key={n} className="rounded-md bg-slate-100/70 px-2 py-1 dark:bg-slate-800/70">
            {n}
          </li>
        ))}
      </ul>
    </div>
  );
}
