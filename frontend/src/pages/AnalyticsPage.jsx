import { useEffect, useMemo, useState } from "react";
import AnalyticsChart from "../components/AnalyticsChart";
import DashboardWidget from "../components/DashboardWidget";
import api from "../api/client";
import { chartData } from "../data/mockData";

export default function AnalyticsPage() {
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

  const stats = useMemo(() => {
    if (!summary?.kpis) {
      return [
        { title: "Avg Response Time", value: "2h 14m", trend: "-18m improvement" },
        { title: "Total Urgent Emails", value: "118", trend: "+7 today" },
        { title: "Pending Tasks", value: "43", trend: "15 high priority" },
        { title: "Projects Detected", value: "27", trend: "+3 new projects" },
      ];
    }
    return [
      { title: "Avg Priority", value: summary.kpis.avg_priority, trend: "Model score" },
      { title: "Total Urgent Emails", value: summary.kpis.high_urgency, trend: "High urgency count" },
      { title: "Predicted Emails", value: summary.kpis.total_predicted, trend: "AI predicted" },
      { title: "Total Emails", value: summary.kpis.total_emails, trend: "Synced from Gmail" },
    ];
  }, [summary]);

  const urgency = summary?.charts?.urgency
    ? { labels: summary.charts.urgency.labels, datasets: [{ data: summary.charts.urgency.values, backgroundColor: ["#ef4444", "#f59e0b", "#22c55e"] }] }
    : { labels: chartData.urgency.labels, datasets: [{ data: chartData.urgency.values, backgroundColor: ["#ef4444", "#f59e0b", "#22c55e"] }] };

  const intent = summary?.charts?.intent
    ? { labels: summary.charts.intent.labels, datasets: [{ label: "Trend", data: summary.charts.intent.values, backgroundColor: "#8b5cf6" }] }
    : { labels: chartData.intent.labels, datasets: [{ label: "Trend", data: chartData.intent.values, backgroundColor: "#8b5cf6" }] };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => <DashboardWidget key={s.title} {...s} />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <AnalyticsChart type="pie" title="Email Urgency Distribution" data={urgency} />
        <AnalyticsChart type="bar" title="Intent Trends" data={intent} />
        <AnalyticsChart
          type="line"
          title="Email Volume Timeline"
          data={{ labels: chartData.timeline.labels, datasets: [{ label: "Volume", data: chartData.timeline.values, borderColor: "#0ea5e9", backgroundColor: "rgba(14,165,233,0.2)", fill: true }] }}
        />
        <AnalyticsChart
          type="bar"
          title="Most Active Contacts"
          data={{ labels: ["Nina", "Alex", "Support", "Board"], datasets: [{ label: "Emails", data: [42, 37, 30, 24], backgroundColor: "#6366f1" }] }}
        />
      </div>
    </div>
  );
}
