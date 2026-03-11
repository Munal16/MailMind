const urgencyColor = {
  High: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
  Medium: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
  Low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
};

export default function EmailCard({ email, compact = false }) {
  return (
    <div className="rounded-xl border border-slate-300/20 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold">{email.sender}</div>
        <div className="text-xs text-slate-500">{email.timestamp}</div>
      </div>
      <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{email.subject}</div>
      {!compact && <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{email.preview}</div>}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2 py-1 font-semibold ${urgencyColor[email.urgency] || ""}`}>
          {email.urgency}
        </span>
        <span className="rounded-full bg-indigo-100 px-2 py-1 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
          {email.intent}
        </span>
        {email.task && (
          <span className="rounded-full bg-violet-100 px-2 py-1 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
            Task Extracted
          </span>
        )}
      </div>
    </div>
  );
}
