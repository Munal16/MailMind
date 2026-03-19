import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckSquare, FolderOpen, Mail } from "lucide-react";
import DashboardWidget from "../components/DashboardWidget";
import AnalyticsChart from "../components/AnalyticsChart";
import { Avatar } from "../components/ui/avatar";
import api from "../api/client";

export default function AnalyticsPage() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
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
    load();
  }, []);

  const stats = useMemo(
    () => [
      {
        title: "Total Emails",
        value: summary?.total_emails ?? 0,
        change: "Across synced inbox data",
        icon: Mail,
        color: "primary",
      },
      {
        title: "Total Urgent",
        value: summary?.urgency_distribution?.High ?? 0,
        change: "High-priority communication",
        icon: AlertTriangle,
        color: "urgent",
      },
      {
        title: "Pending Tasks",
        value: summary?.pending_tasks ?? 0,
        change: `${summary?.tasks_with_deadline ?? 0} with deadline cues`,
        icon: CheckSquare,
        color: "warning",
      },
      {
        title: "Projects Detected",
        value: summary?.project_count ?? 0,
        change: "Grouped from subject and body context",
        icon: FolderOpen,
        color: "success",
      },
    ],
    [summary]
  );

  const weeklyTrend = summary?.weekly_urgency_trend || [];
  const intentData = useMemo(
    () => Object.entries(summary?.intent_distribution || {}).map(([name, value]) => ({ name, value })),
    [summary]
  );
  const taskStatusData = useMemo(
    () =>
      Object.entries(summary?.task_status_distribution || {}).map(([name, value], index) => ({
        name,
        value,
        color: ["hsl(var(--warning))", "hsl(var(--primary))", "hsl(var(--success))"][index % 3],
      })),
    [summary]
  );
  const activityData = summary?.activity_timeline || [];
  const contacts = summary?.most_active_contacts || [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Analytics</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Review urgency distribution, intent patterns, project grouping, and extracted task workload.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <DashboardWidget key={item.title} {...item} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <AnalyticsChart
          title="Urgency Trends"
          type="bar"
          data={weeklyTrend}
          xKey="name"
          series={[
            { key: "high", color: "hsl(var(--urgent))", stackId: "a" },
            { key: "medium", color: "hsl(var(--warning))", stackId: "a" },
            { key: "low", color: "hsl(var(--success))", stackId: "a" },
          ]}
        />
        <AnalyticsChart
          title="Intent Distribution"
          type="bar"
          data={intentData}
          xKey="name"
          series={[{ key: "value", color: "hsl(var(--primary))" }]}
        />
        <AnalyticsChart
          title="Task Status"
          type="pie"
          data={taskStatusData}
        />
        <AnalyticsChart
          title="Email Volume Timeline"
          type="line"
          data={activityData}
          xKey="name"
          series={[{ key: "emails", color: "hsl(var(--secondary))" }]}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="text-sm font-semibold text-card-foreground">Most Active Contacts</div>
        <div className="mt-4 space-y-3">
          {contacts.length ? (
            contacts.map((contact, index) => (
              <div key={contact.name} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-3">
                <div className="flex items-center gap-3">
                  <div className="text-sm font-semibold text-muted-foreground">{index + 1}</div>
                  <Avatar initials={contact.initials} className="h-8 w-8" />
                  <div>
                    <div className="text-sm font-medium text-card-foreground">{contact.name}</div>
                    <div className="text-xs text-muted-foreground">{contact.count} emails</div>
                  </div>
                </div>
                <div className="text-sm font-semibold text-success">Active</div>
              </div>
            ))
          ) : (
            <div className="rounded-lg bg-muted/50 px-3 py-3 text-sm text-muted-foreground">
              Analyze more mail to generate contact analytics.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
