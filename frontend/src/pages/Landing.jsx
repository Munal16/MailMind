import { Link } from "react-router-dom";
import { BrainCircuit, CalendarCheck2, ChartNoAxesCombined, Files, ListChecks, SearchCheck, Sparkles } from "lucide-react";

const features = [
  "AI Urgency Detection",
  "Intent Classification",
  "Smart Email Sorting",
  "Task Extraction",
  "Attachment Hub",
  "Contextual Search",
  "Productivity Analytics",
];

export default function Landing() {
  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-16">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg font-bold">
            <BrainCircuit className="h-5 w-5 text-indigo-500" />
            MailMind
          </div>
          <div className="flex gap-2">
            <Link to="/login" className="rounded-xl border border-slate-300/30 px-4 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">Login</Link>
            <Link to="/register" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500">Register</Link>
          </div>
        </header>

        <section className="grid gap-8 rounded-3xl border border-slate-300/20 bg-white/70 p-8 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/70 lg:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
              <Sparkles className="h-3.5 w-3.5" />
              AI Powered Email Intelligence
            </div>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight">Organize, prioritize, and analyze your inbox with AI.</h1>
            <p className="mt-4 text-slate-600 dark:text-slate-300">
              MailMind turns chaotic inboxes into actionable workflows with urgency scoring, intent detection, task extraction, and attachment intelligence.
            </p>
            <div className="mt-6 flex gap-3">
              <Link to="/register" className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">Get Started</Link>
              <Link to="/connect-email" className="rounded-xl border border-slate-300/30 px-5 py-2.5 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">Connect Gmail</Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[CalendarCheck2, ListChecks, Files, SearchCheck, ChartNoAxesCombined, BrainCircuit].map((Icon, idx) => (
              <div key={idx} className="rounded-2xl border border-slate-300/20 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                <Icon className="h-5 w-5 text-indigo-500" />
                <div className="mt-2 text-xs text-slate-500">Live preview module</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold">Features</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f} className="rounded-xl border border-slate-300/20 bg-white/70 p-4 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
                {f}
              </div>
            ))}
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-300/20 pt-6 text-sm text-slate-500 dark:border-slate-700">
          <div>© 2026 MailMind</div>
          <div className="flex gap-4">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Contact</a>
          </div>
        </footer>
      </div>
    </div>
  );
}
