import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckSquare,
  FolderKanban,
  Mail,
  RefreshCcw,
  Sparkles,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import DashboardWidget from "../components/DashboardWidget";
import { Avatar } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import api from "../api/client";
import "./Dashboard.css";

const TASK_STATUS_COLORS = {
  Pending: "hsl(var(--warning))",
  "In Progress": "hsl(var(--primary))",
  Completed: "hsl(var(--success))",
};

function formatDashboardError(err) {
  if (typeof err?.response?.data === "string") {
    return err.response.data;
  }
  if (err?.response?.data?.error) {
    return err.response.data.error;
  }
  if (err?.response?.data?.message) {
    return err.response.data.message;
  }
  return "Could not load the dashboard right now.";
}

function EmptyChartState({ title, description }) {
  return (
    <div className="dashboard-page__empty">
      <div className="dashboard-page__empty-title">{title}</div>
      <div className="dashboard-page__empty-text">{description}</div>
    </div>
  );
}

function chartTooltipStyle() {
  return {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 14,
    boxShadow: "0 18px 32px hsl(var(--foreground) / 0.12)",
  };
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async ({ showFeedback = false } = {}) => {
    try {
      setError("");
      if (showFeedback) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const res = await api.get("/api/ai/summary/");
      setSummary(res.data);
      if (showFeedback) {
        setNotice("Dashboard updated.");
      }
    } catch (err) {
      setSummary(null);
      setError(formatDashboardError(err));
      setNotice("");
    } finally {
      setLoading(false);
      if (showFeedback) {
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runAiAnalysis = async () => {
    try {
      setAnalyzing(true);
      setError("");
      setNotice("");
      await api.post("/api/ai/analyze-latest/", { limit: 50 });
      await load();
      setNotice("AI analysis completed. Dashboard refreshed.");
    } catch (err) {
      setError(formatDashboardError(err));
    } finally {
      setAnalyzing(false);
    }
  };

  const widgets = useMemo(() => {
    const topProject = summary?.top_projects?.[0]?.name;

    return [
      {
        title: "Synced Emails",
        value: summary?.total_emails ?? 0,
        change: `${summary?.total_predictions ?? 0} analyzed by MailMind`,
        icon: Mail,
        color: "primary",
        changeTone: "primary",
      },
      {
        title: "High Urgency",
        value: summary?.urgency_distribution?.High ?? 0,
        change: "Needs quick review",
        icon: AlertTriangle,
        color: "urgent",
        changeTone: "urgent",
      },
      {
        title: "Pending Tasks",
        value: summary?.pending_tasks ?? 0,
        change: `${summary?.tasks_with_deadline ?? 0} with deadline cues`,
        icon: CheckSquare,
        color: "warning",
        changeTone: "warning",
      },
      {
        title: "Project Groups",
        value: summary?.project_count ?? 0,
        change: topProject ? `${topProject} is leading` : "Grouping ready",
        icon: FolderKanban,
        color: "success",
        changeTone: "success",
      },
    ];
  }, [summary]);

  const urgencyTrendData = useMemo(() => summary?.weekly_urgency_trend || [], [summary]);
  const activityData = useMemo(() => summary?.activity_timeline || [], [summary]);
  const contacts = useMemo(() => summary?.most_active_contacts || [], [summary]);
  const projects = useMemo(() => summary?.top_projects || [], [summary]);
  const insights = useMemo(() => summary?.recent_insights || [], [summary]);

  const taskStatusData = useMemo(() => {
    const dist = summary?.task_status_distribution || {};
    return ["Pending", "In Progress", "Completed"].map((name) => ({
      name,
      value: Number(dist[name] || 0),
      color: TASK_STATUS_COLORS[name] || "hsl(var(--secondary))",
    }));
  }, [summary]);

  const taskTotal = useMemo(
    () => taskStatusData.reduce((sum, item) => sum + Number(item.value || 0), 0),
    [taskStatusData]
  );

  const intentData = useMemo(
    () =>
      Object.entries(summary?.intent_distribution || {})
        .sort(([, left], [, right]) => Number(right) - Number(left))
        .slice(0, 6)
        .map(([name, value]) => ({ name, value })),
    [summary]
  );

  const dominantIntent = intentData[0];

  const activityPeak = useMemo(() => {
    if (!activityData.length) {
      return null;
    }
    return activityData.reduce((peak, current) => (current.emails > (peak?.emails ?? -1) ? current : peak), null);
  }, [activityData]);

  const attentionQueue = useMemo(
    () =>
      [
        summary?.urgency_distribution?.High
          ? `${summary.urgency_distribution.High} high-urgency emails should be reviewed first.`
          : null,
        summary?.pending_tasks ? `${summary.pending_tasks} extracted tasks are still pending.` : null,
        summary?.tasks_with_deadline
          ? `${summary.tasks_with_deadline} tasks include deadline hints from email content.`
          : null,
      ].filter(Boolean),
    [summary]
  );

  const maxProjectCount = Math.max(...projects.map((project) => Number(project.count || 0)), 1);
  const maxContactCount = Math.max(...contacts.map((contact) => Number(contact.count || 0)), 1);

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-page__hero">
          <div>
            <div className="dashboard-page__eyebrow">Workspace overview</div>
            <h1 className="dashboard-page__title">Dashboard</h1>
          </div>
        </div>
        <div className="dashboard-page__loading-grid">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="dashboard-page__skeleton dashboard-page__skeleton--widget" />
          ))}
        </div>
        <div className="dashboard-page__loading-grid dashboard-page__loading-grid--charts">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="dashboard-page__skeleton dashboard-page__skeleton--chart" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-page__hero">
        <div>
          <div className="dashboard-page__eyebrow">Workspace overview</div>
          <h1 className="dashboard-page__title">Dashboard</h1>
          <p className="dashboard-page__description">
            Track inbox load, urgency trends, task progress, and project activity in one clear MailMind overview.
          </p>
        </div>

        <div className="dashboard-page__actions">
          <Button variant="outline" onClick={() => load({ showFeedback: true })} disabled={refreshing || analyzing}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
          <Button variant="hero-outline" onClick={runAiAnalysis} disabled={analyzing || refreshing}>
            {analyzing ? "Analyzing..." : "Run AI Analysis"}
          </Button>
        </div>
      </div>

      {error ? <div className="dashboard-page__error">{error}</div> : null}
      {notice ? <div className="dashboard-page__notice">{notice}</div> : null}

      <div className="dashboard-page__widgets">
        {widgets.map((widget) => (
          <DashboardWidget key={widget.title} {...widget} />
        ))}
      </div>

      <div className="dashboard-page__main-grid">
        <section className="dashboard-page__card dashboard-page__card--wide">
          <div className="dashboard-page__card-head">
            <div>
              <div className="dashboard-page__card-title">Urgency trend</div>
              <div className="dashboard-page__card-copy">Compare high, medium, and low urgency across recent weeks.</div>
            </div>
            <div className="dashboard-page__badge">
              <AlertTriangle className="h-4 w-4" />
              Priority load
            </div>
          </div>

          <div className="dashboard-page__chip-row">
            <span className="dashboard-page__chip dashboard-page__chip--urgent">
              High {summary?.urgency_distribution?.High ?? 0}
            </span>
            <span className="dashboard-page__chip dashboard-page__chip--warning">
              Medium {summary?.urgency_distribution?.Medium ?? 0}
            </span>
            <span className="dashboard-page__chip dashboard-page__chip--success">
              Low {summary?.urgency_distribution?.Low ?? 0}
            </span>
          </div>

          <div className="dashboard-page__chart-frame">
            {urgencyTrendData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={urgencyTrendData} barCategoryGap={18}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="4 4" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                  />
                  <YAxis
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                  />
                  <Tooltip contentStyle={chartTooltipStyle()} />
                  <Bar dataKey="low" name="Low" stackId="urgency" fill="hsl(var(--success))" radius={0} />
                  <Bar dataKey="medium" name="Medium" stackId="urgency" fill="hsl(var(--warning))" radius={0} />
                  <Bar dataKey="high" name="High" stackId="urgency" fill="hsl(var(--urgent))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState
                title="No urgency data yet"
                description="Run MailMind analysis to see how urgency is trending across your synced inbox."
              />
            )}
          </div>
        </section>

        <section className="dashboard-page__card">
          <div className="dashboard-page__card-head">
            <div>
              <div className="dashboard-page__card-title">Task status</div>
              <div className="dashboard-page__card-copy">See how extracted tasks are distributed across your workspace.</div>
            </div>
          </div>

          {taskTotal > 0 ? (
            <div className="dashboard-page__task-layout">
              <div className="dashboard-page__donut-shell">
                <div className="dashboard-page__donut-center">
                  <span>{taskTotal}</span>
                  <small>Total tasks</small>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip contentStyle={chartTooltipStyle()} />
                    <Pie
                      data={taskStatusData.filter((item) => item.value > 0)}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={56}
                      outerRadius={84}
                      paddingAngle={3}
                    >
                      {taskStatusData.filter((item) => item.value > 0).map((item) => (
                        <Cell key={item.name} fill={item.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="dashboard-page__legend-list">
                {taskStatusData.map((item) => (
                  <div key={item.name} className="dashboard-page__legend-item">
                    <div className="dashboard-page__legend-label">
                      <span className="dashboard-page__legend-dot" style={{ background: item.color }} />
                      {item.name}
                    </div>
                    <div className="dashboard-page__legend-value">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyChartState
              title="No task data yet"
              description="Tasks will appear here after MailMind extracts action items from synced emails."
            />
          )}
        </section>

        <section className="dashboard-page__card">
          <div className="dashboard-page__card-head">
            <div>
              <div className="dashboard-page__card-title">Inbox activity</div>
              <div className="dashboard-page__card-copy">Follow how much synced activity is appearing through the week.</div>
            </div>
            {activityPeak ? (
              <div className="dashboard-page__mini-stat">
                <span className="dashboard-page__mini-label">Busiest day</span>
                <span className="dashboard-page__mini-value">{activityPeak.name}</span>
              </div>
            ) : null}
          </div>

          <div className="dashboard-page__chart-frame">
            {activityData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityData}>
                  <defs>
                    <linearGradient id="dashboard-activity-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="4 4" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                  />
                  <YAxis
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                  />
                  <Tooltip contentStyle={chartTooltipStyle()} />
                  <Area
                    type="monotone"
                    dataKey="emails"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    fill="url(#dashboard-activity-fill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState
                title="No inbox activity yet"
                description="Once Gmail is synced, MailMind will chart how your email activity flows through the week."
              />
            )}
          </div>
        </section>

        <section className="dashboard-page__card">
          <div className="dashboard-page__card-head">
            <div>
              <div className="dashboard-page__card-title">Intent mix</div>
              <div className="dashboard-page__card-copy">See which email intent types are appearing most often.</div>
            </div>
            {dominantIntent ? (
              <div className="dashboard-page__mini-stat">
                <span className="dashboard-page__mini-label">Top intent</span>
                <span className="dashboard-page__mini-value">{dominantIntent.name}</span>
              </div>
            ) : null}
          </div>

          <div className="dashboard-page__chart-frame">
            {intentData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={intentData} layout="vertical" margin={{ left: 16, right: 8 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="4 4" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={92}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                  />
                  <Tooltip contentStyle={chartTooltipStyle()} />
                  <Bar dataKey="value" fill="hsl(var(--secondary))" radius={[0, 10, 10, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState
                title="No intent data yet"
                description="Run MailMind analysis to see how your inbox is distributed across intent types."
              />
            )}
          </div>
        </section>
      </div>

      <div className="dashboard-page__detail-grid">
        <section className="dashboard-page__card">
          <div className="dashboard-page__card-head">
            <div>
              <div className="dashboard-page__card-title">Project load</div>
              <div className="dashboard-page__card-copy">Compare the project groups currently taking the most inbox volume.</div>
            </div>
            <div className="dashboard-page__badge">
              <BarChart3 className="h-4 w-4" />
              Project view
            </div>
          </div>

          <div className="dashboard-page__list">
            {projects.length ? (
              projects.map((project) => {
                const width = `${Math.max((Number(project.count || 0) / maxProjectCount) * 100, 12)}%`;

                return (
                  <div key={project.name} className="dashboard-page__metric-row">
                    <div className="dashboard-page__metric-head">
                      <span>{project.name}</span>
                      <span>{project.count}</span>
                    </div>
                    <div className="dashboard-page__progress">
                      <div className="dashboard-page__progress-bar" style={{ width }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyChartState
                title="No project groups yet"
                description="Project-based grouping appears here after MailMind processes your synced emails."
              />
            )}
          </div>
        </section>

        <section className="dashboard-page__card">
          <div className="dashboard-page__card-head">
            <div>
              <div className="dashboard-page__card-title">Most active contacts</div>
              <div className="dashboard-page__card-copy">See which contacts are contributing most to your synced workload.</div>
            </div>
            <div className="dashboard-page__badge">
              <Users className="h-4 w-4" />
              Contact activity
            </div>
          </div>

          <div className="dashboard-page__list">
            {contacts.length ? (
              contacts.map((contact, index) => {
                const width = `${Math.max((Number(contact.count || 0) / maxContactCount) * 100, 16)}%`;

                return (
                  <div key={contact.name} className="dashboard-page__contact-row">
                    <div className="dashboard-page__contact-meta">
                      <div className="dashboard-page__contact-rank">{index + 1}</div>
                      <Avatar initials={contact.initials} className="h-9 w-9" />
                      <div>
                        <div className="dashboard-page__contact-name">{contact.name}</div>
                        <div className="dashboard-page__contact-subtle">{contact.count} related emails</div>
                      </div>
                    </div>
                    <div className="dashboard-page__contact-bar">
                      <div className="dashboard-page__contact-fill" style={{ width }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyChartState
                title="No contact activity yet"
                description="Contact rankings will appear after MailMind has enough synced inbox data to compare."
              />
            )}
          </div>
        </section>

        <section className="dashboard-page__card">
          <div className="dashboard-page__card-head">
            <div>
              <div className="dashboard-page__card-title">MailMind insights</div>
              <div className="dashboard-page__card-copy">A quick summary of what needs attention inside the workspace.</div>
            </div>
            <div className="dashboard-page__badge">
              <Sparkles className="h-4 w-4" />
              Live signals
            </div>
          </div>

          <div className="dashboard-page__insights">
            {insights.length ? (
              insights.map((insight) => (
                <div key={insight.title} className="dashboard-page__insight">
                  <div className="dashboard-page__insight-title">{insight.title}</div>
                  <div className="dashboard-page__insight-copy">{insight.description}</div>
                </div>
              ))
            ) : (
              <EmptyChartState
                title="No insights yet"
                description="Run AI analysis after syncing Gmail to fill this panel with MailMind recommendations."
              />
            )}
          </div>

          <div className="dashboard-page__queue">
            {attentionQueue.length ? (
              attentionQueue.map((item) => (
                <div key={item} className="dashboard-page__queue-item">
                  <ArrowRight className="h-4 w-4" />
                  <span>{item}</span>
                </div>
              ))
            ) : (
              <div className="dashboard-page__queue-empty">No urgent follow-up items right now.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
