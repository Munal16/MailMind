import { Link } from "react-router-dom";
import { BarChart3, CheckSquare, Mail, Paperclip, Search, Target, Zap } from "lucide-react";
import { Button } from "../components/ui/button";
import BrandLogo from "../components/BrandLogo";

const features = [
  { icon: Zap, title: "AI Urgency Detection", description: "Detect high-pressure threads before deadlines slip." },
  { icon: Target, title: "Intent Classification", description: "Understand whether an email is a request, update, meeting, or action item." },
  { icon: Mail, title: "Smart Email Sorting", description: "Automatically group emails into focused working lanes." },
  { icon: CheckSquare, title: "Task Extraction", description: "Turn buried asks into clear, trackable actions." },
  { icon: Paperclip, title: "Attachment Hub", description: "Keep files organized by project, sender, and context." },
  { icon: Search, title: "Contextual Search", description: "Ask for emails in natural language and get faster answers." },
  { icon: BarChart3, title: "Productivity Analytics", description: "Measure urgency load, response trends, and project traffic." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 lg:px-6">
          <Link to="/" className="transition-transform duration-200 hover:scale-[1.01]">
            <BrandLogo size="sm" />
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login"><Button variant="ghost">Login</Button></Link>
            <Link to="/register"><Button variant="hero">Get Started</Button></Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 py-20 lg:px-6 lg:py-28">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-5 flex justify-center">
              <BrandLogo size="md" className="justify-center" />
            </div>
            <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground">
              <Zap className="h-4 w-4" />
              Powered by AI
            </div>
            <h1 className="mt-6 text-5xl font-extrabold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              AI Powered Email
              <br />
              <span className="text-gradient">Intelligence</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">Organize, prioritize, and analyze your inbox with AI.</p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/register"><Button variant="hero" size="lg">Get Started</Button></Link>
              <Link to="/connect-email"><Button variant="hero-outline" size="lg">Connect Gmail</Button></Link>
            </div>
          </div>

          <div className="mt-16 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="gradient-hero rounded-3xl p-[1px] shadow-glow">
              <div className="glass-panel rounded-[calc(var(--radius)*2)] p-8">
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Operational clarity</div>
                    <h2 className="mt-3 text-3xl font-bold">One workspace for urgency, intent, tasks, and attachments.</h2>
                    <p className="mt-4 text-sm leading-7 text-muted-foreground">MailMind gives teams a triage-first email experience with structured insights and clean execution paths.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      "Urgent lane auto-detection",
                      "Task extraction",
                      "Attachment intelligence",
                      "Project-level grouping",
                    ].map((item) => (
                      <div key={item} className="rounded-2xl border border-border bg-card/70 p-4 text-sm text-card-foreground shadow-card">{item}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {[
                { title: "Inbox triage", text: "Surface the most important work instantly." },
                { title: "Attachment visibility", text: "Files remain accessible without digging through threads." },
                { title: "Executive analytics", text: "Track urgency, response pressure, and team throughput." },
              ].map((card) => (
                <div key={card.title} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                  <div className="text-sm font-semibold text-card-foreground">{card.title}</div>
                  <p className="mt-2 text-sm text-muted-foreground">{card.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 lg:px-6 lg:pb-28">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="rounded-xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="mt-4 text-lg font-semibold">{feature.title}</div>
                  <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-6">
          <div className="flex items-center gap-3">
            <BrandLogo size="xs" />
            <div>
              <div>AI-powered email intelligence for modern teams.</div>
            </div>
          </div>
          <div className="flex gap-6">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
