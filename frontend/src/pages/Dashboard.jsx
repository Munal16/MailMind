import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckSquare,
  Mail,
  Paperclip,
  Sparkles,
  Users,
} from "lucide-react";
import DashboardWidget from "../components/DashboardWidget";
import AnalyticsChart from "../components/AnalyticsChart";
import NotificationPanel from "../components/NotificationPanel";
import { Avatar } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import api from "../api/client";

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setError("");
      const res = await api.get("/api/ai/summary/");
      setSummary(res.data);
    } catch (err) {
      setSummary(null);
      setError(typeof err.response?.data === "string" ? err.response.data : JSON.stringify(err.response?.data || err.message));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const runAiAnalysis = async () => {
    try {
      setAnalyzing(true);
      setError("");
      await api.post("/api/ai/analyze-latest/", { limit: 50 });
      await load();
    } catch (err) {
      setError(typeof err.response?.data === "string" ? err.response.data : JSON.stringify(err.response?.data || err.message));
    } finally {
      setAnalyzing(false);
    }
  };

  const widgets = useMemo(
    () => [
      {
        title: "Total Emails",
        value: summary?.total_emails ?? 0,
        change: "Synced inbox records",
        icon: Mail,
        color: "primary",
      },
      {
        title: "Urgent Emails",
        value: summary?.urgency_distribution?.High ?? 0,
        change: "High-priority queue",
        icon: AlertTriangle,
        color: "urgent",
      },
      {
        title: "Pending Tasks",
        value: summary?.pending_tasks ?? 0,
        change: "Extracted from email text",
        icon: CheckSquare,
        color: "warning",
      },
      {
        title: "Attachments Received",
        value: summary?.attachments_received ?? 0,
        change: "Available in attachment organizer",
        icon: Paperclip,
        color: "success",
      },
    ],
    [summary]
  );

  const urgencyData = useMemo(() => {
    const distribution = summary?.urgency_distribution || {};
    return [
      { name: "High", value: distribution.High ?? 0, color: "hsl(var(--urgent))" },
      { name: "Medium", value: distribution.Medium ?? 0, color: "hsl(var(--warning))" },
      { name: "Low", value: distribution.Low ?? 0, color: "hsl(var(--success))" },
    ];
  }, [summary]);

  const intentData = useMemo(
    () => Object.entries(summary?.intent_distribution || {}).map(([name, value]) => ({ name, value })),
    [summary]
  );

  const activityData = summary?.activity_timeline || [];
  const contacts = summary?.most_active_contacts || [];
  const insights = summary?.recent_insights || [];
  const projects = summary?.top_projects || [];

  const notifications = useMemo(
    () => [
      summary?.urgency_distribution?.High ? `${summary.urgency_distribution.High} urgent emails need attention.` : null,
      summary?.tasks_with_deadline ? `${summary.tasks_with_deadline} extracted tasks include deadline cues.` : null,
      summary?.project_count ? `${summary.project_count} active project groups are currently being tracked.` : null,
    ].filter(Boolean),
    [summary]
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Monitor urgency, intents, project groups, extracted tasks, and inbox activity in one place.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load}>
            Refresh
          </Button>
          <Button variant="hero-outline" onClick={runAiAnalysis} disabled={analyzing}>
            {analyzing ? "Analyzing..." : "Run AI Analysis"}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {widgets.map((widget) => (
          <DashboardWidget key={widget.title} {...widget} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <AnalyticsChart title="Urgency Distribution" type="pie" data={urgencyData} />
        <AnalyticsChart
          title="Intent Classification"
          type="bar"
          data={intentData}
          xKey="name"
          series={[{ key: "value", color: "hsl(var(--primary))" }]}
        />
        <AnalyticsChart
          title="Email Activity"
          type="line"
          data={activityData}
          xKey="name"
          series={[{ key: "emails", color: "hsl(var(--secondary))" }]}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
            <Users className="h-4 w-4 text-primary" />
            Most Active Contacts
          </div>
          <div className="mt-4 space-y-3">
            {contacts.length ? (
              contacts.map((contact) => (
                <div key={contact.name} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar initials={contact.initials} className="h-8 w-8" />
                    <div>
                      <div className="text-sm font-medium text-card-foreground">{contact.name}</div>
                      <div className="text-xs text-muted-foreground">Frequent collaboration</div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-card-foreground">{contact.count}</div>
                </div>
              ))
            ) : (
              <div className="rounded-lg bg-muted/50 px-3 py-3 text-sm text-muted-foreground">
                Sync and analyze emails to see contact activity.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
            <Sparkles className="h-4 w-4 text-secondary" />
            Recent AI Insights
          </div>
          <div className="mt-4 space-y-3">
            {insights.length ? (
              insights.map((insight) => (
                <div key={insight.title} className="rounded-lg bg-muted/50 p-3">
                  <div className="text-sm font-medium text-card-foreground">{insight.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{insight.description}</div>
                </div>
              ))
            ) : (
              <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                AI insights will appear after inbox analysis.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
              <BarChart3 className="h-4 w-4 text-success" />
              Top Projects
            </div>
            <div className="mt-4 space-y-3">
              {projects.length ? (
                projects.map((project) => (
                  <div key={project.name} className="rounded-lg bg-muted/50 px-3 py-3 text-sm">
                    <div className="font-medium text-card-foreground">{project.name}</div>
                    <div className="mt-1 text-muted-foreground">{project.count} related emails</div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg bg-muted/50 px-3 py-3 text-sm text-muted-foreground">
                  Project groups appear after MailMind classifies the inbox.
                </div>
              )}
            </div>
          </div>
          <NotificationPanel title="Attention Queue" items={notifications} />
        </div>
      </div>
    </div>
  );
}
