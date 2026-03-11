import { Link } from "react-router-dom";

export default function GmailConnected() {
  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-slate-500/25 bg-[#121d31]/90 p-8 text-center">
      <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Connection Complete</div>
      <h2 className="mt-2 text-3xl font-bold text-white">Gmail Connected</h2>
      <p className="mt-3 text-sm text-slate-300">
        Your account is linked. You can sync, predict, and triage from Inbox.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link to="/inbox" className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-cyan-300">
          Go to Inbox
        </Link>
        <Link to="/dashboard" className="rounded-xl border border-slate-500/35 bg-[#223250] px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-[#2c3f62]">
          View Dashboard
        </Link>
      </div>
    </div>
  );
}
