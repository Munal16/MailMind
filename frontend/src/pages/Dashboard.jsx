import AnalyticsChart from "../components/AnalyticsChart";
import DashboardWidget from "../components/DashboardWidget";
import NotificationPanel from "../components/NotificationPanel";
import { chartData, contacts, insights, widgets } from "../data/mockData";
import { useEffect, useMemo, useState } from "react";
import api from "../api/client";

export default function Dashboard() {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get("/api/analytics/summary/");
        setSummary(res.data);
      } catch {
        setSummary(null);
      }
    };
    load();
  }, []);

  const kpiWidgets = useMemo(() => {
    if (!summary?.kpis) return widgets;
    return [
      { title: "Total Emails", value: summary.kpis.total_emails, trend: "Live from backend" },
      { title: "Urgent Emails", value: summary.kpis.high_urgency, trend: "AI high urgency" },
      { title: "Pending Tasks", value: summary.kpis.total_predicted, trend: "Predicted emails" },
      { title: "Avg Priority", value: summary.kpis.avg_priority, trend: `Top intent: ${summary.kpis.top_intent || "N/A"}` },
    ];
  }, [summary]);

  const urgencyData = summary?.charts?.urgency
    ? {
        labels: summary.charts.urgency.labels,
        datasets: [{ data: summary.charts.urgency.values, backgroundColor: ["#ef4444", "#f59e0b", "#22c55e"] }],
      }
    : {
        labels: chartData.urgency.labels,
        datasets: [{ data: chartData.urgency.values, backgroundColor: ["#ef4444", "#f59e0b", "#22c55e"] }],
      };

  const intentData = summary?.charts?.intent
    ? {
        labels: summary.charts.intent.labels,
        datasets: [{ label: "Emails", data: summary.charts.intent.values, backgroundColor: "#6366f1" }],
      }
    : {
        labels: chartData.intent.labels,
        datasets: [{ label: "Emails", data: chartData.intent.values, backgroundColor: "#6366f1" }],
      };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-slate-500">Overview of email productivity and AI insights</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpiWidgets.map((w) => (
          <DashboardWidget key={w.title} {...w} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <AnalyticsChart
          type="pie"
          title="Email Urgency Distribution"
          data={urgencyData}
        />
        <AnalyticsChart
          type="bar"
          title="Intent Classification"
          data={intentData}
        />
        <AnalyticsChart
          type="line"
          title="Email Activity Timeline"
          data={{
            labels: chartData.timeline.labels,
            datasets: [{ label: "Volume", data: chartData.timeline.values, borderColor: "#8b5cf6", backgroundColor: "rgba(139,92,246,0.15)", fill: true }],
          }}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-300/20 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <h3 className="text-sm font-semibold">Most Active Contacts</h3>
          <div className="mt-3 space-y-2 text-sm">
            {contacts.map((c) => (
              <div key={c.name} className="flex items-center justify-between rounded-lg bg-slate-100/70 px-3 py-2 dark:bg-slate-800/70">
                <span>{c.name}</span>
                <span className="font-semibold">{c.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-300/20 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <h3 className="text-sm font-semibold">Recent AI Insights</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            {insights.map((i) => (
              <li key={i} className="rounded-lg bg-slate-100/70 px-3 py-2 dark:bg-slate-800/70">{i}</li>
            ))}
          </ul>
        </div>

        <NotificationPanel />
      </div>
    </div>
  );
}
