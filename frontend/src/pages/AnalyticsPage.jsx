import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckSquare,
  FolderKanban,
  Mail,
  Paperclip,
  RefreshCw,
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
import { Avatar } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import api from "../api/client";
import "./AnalyticsPage.css";

const TASK_STATUS_COLORS = {
  Pending: "hsl(var(--warning))",
  "In Progress": "hsl(var(--primary))",
  Completed: "hsl(var(--success))",
};

const URGENCY_COLORS = {
  High: "hsl(var(--urgent))",
  Medium: "hsl(var(--warning))",
  Low: "hsl(var(--success))",
};

const FOCUS_OPTIONS = [
  { id: "all", label: "All insights" },
  { id: "overview", label: "Overview" },
  { id: "urgency", label: "Urgency" },
  { id: "tasks", label: "Tasks" },
  { id: "projects", label: "Projects" },
  { id: "contacts", label: "Contacts" },
];

function tooltipStyle() {
  return {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 14,
    boxShadow: "0 18px 32px hsl(var(--foreground) / 0.12)",
  };
}

function formatAnalyticsError(err) {
  if (typeof err?.response?.data === "string") return err.response.data;
  if (err?.response?.data?.error) return err.response.data.error;
  if (err?.response?.data?.message) return err.response.data.message;
  return "MailMind could not load analytics right now.";
}

function EmptyAnalyticsState({ title, description }) {
  return (
    <div className="analytics-page__empty">
      <div className="analytics-page__empty-title">{title}</div>
      <div className="analytics-page__empty-copy">{description}</div>
    </div>
  );
}

function SectionHeading({ title, copy, icon: Icon }) {
  return (
    <div className="analytics-page__section-heading">
      <div className="analytics-page__section-icon">{Icon ? <Icon className="h-4 w-4" /> : null}</div>
      <div>
        <div className="analytics-page__section-title">{title}</div>
        <div className="analytics-page__section-copy">{copy}</div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeFocus, setActiveFocus] = useState("all");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadSummary = useCallback(async (showRefreshState = false) => {
    try {
      if (showRefreshState) setRefreshing(true);
      setError("");
      const res = await api.get("/api/ai/summary/");
      setSummary(res.data);
      if (showRefreshState) setNotice("Analytics refreshed.");
    } catch (err) {
      setSummary(null);
      setNotice("");
      setError(formatAnalyticsError(err));
    } finally {
      if (showRefreshState) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const runAnalysis = async () => {
    try {
      setAnalyzing(true);
      setNotice("");
      setError("");
      await api.post("/api/ai/analyze-latest/", { limit: 50 });
      await loadSummary();
      setNotice("MailMind analysis completed and analytics updated.");
    } catch (err) {
      setError(formatAnalyticsError(err));
    } finally {
      setAnalyzing(false);
    }
  };

  const totalEmails = summary?.total_emails ?? 0;
  const totalPredictions = summary?.total_predictions ?? 0;
  const totalTasks = summary?.total_tasks ?? 0;
  const pendingTasks = summary?.pending_tasks ?? 0;
  const attachmentsReceived = summary?.attachments_received ?? 0;
  const tasksWithDeadline = summary?.tasks_with_deadline ?? 0;
  const highUrgencyCount = summary?.urgency_distribution?.High ?? 0;
  const highUrgencyRate = totalEmails ? Math.round((highUrgencyCount / totalEmails) * 100) : 0;
  const attachmentReach = totalEmails ? Math.round((attachmentsReceived / totalEmails) * 100) : 0;
  const taskCoverage = totalEmails ? Math.round((totalTasks / totalEmails) * 100) : 0;

  const urgencyData = useMemo(
    () =>
      Object.entries(summary?.urgency_distribution || {}).map(([name, value]) => ({
        name,
        value,
        color: URGENCY_COLORS[name] || "hsl(var(--secondary))",
      })),
    [summary]
  );

  const intentData = useMemo(
    () =>
      Object.entries(summary?.intent_distribution || {})
        .sort(([, left], [, right]) => Number(right) - Number(left))
        .slice(0, 6)
        .map(([name, value]) => ({ name, value })),
    [summary]
  );

  const taskStatusData = useMemo(
    () =>
      Object.entries(summary?.task_status_distribution || {}).map(([name, value]) => ({
        name,
        value,
        color: TASK_STATUS_COLORS[name] || "hsl(var(--secondary))",
      })),
    [summary]
  );

  const activityData = useMemo(() => summary?.activity_timeline || [], [summary]);
  const weeklyUrgency = summary?.weekly_urgency_trend || [];
  const contacts = summary?.most_active_contacts || [];
  const projects = summary?.top_projects || [];
  const insights = summary?.recent_insights || [];

  const taskTotal = useMemo(
    () => taskStatusData.reduce((sum, item) => sum + Number(item.value || 0), 0),
    [taskStatusData]
  );

  const dominantIntent = intentData[0];
  const topProject = projects[0];
  const topContact = contacts[0];
  const busiestDay = useMemo(() => {
    if (!activityData.length) return null;
    return activityData.reduce((peak, current) => (current.emails > (peak?.emails ?? -1) ? current : peak), null);
  }, [activityData]);

  const highlightCards = [
    {
      title: "Dominant intent",
      value: dominantIntent?.name || "No data",
      note: dominantIntent ? `${dominantIntent.value} emails currently fall into this class.` : "Run analysis to unlock intent breakdowns.",
      icon: Sparkles,
    },
    {
      title: "Busiest day",
      value: busiestDay?.name || "No data",
      note: busiestDay ? `${busiestDay.emails} emails were recorded on this day.` : "Sync inbox activity to see weekly movement.",
      icon: Activity,
    },
    {
      title: "Top project",
      value: topProject?.name || "No grouping yet",
      note: topProject ? `${topProject.count} emails are grouped into this project.` : "Project grouping appears after analysis.",
      icon: FolderKanban,
    },
    {
      title: "Top contact",
      value: topContact?.name || "No contact signal",
      note: topContact ? `${topContact.count} emails are linked to this sender.` : "Contact activity appears after syncing mail.",
      icon: Users,
    },
  ];

  const actionItems = [
    summary?.urgency_distribution?.High
      ? {
          title: "Review the high-urgency queue",
          description: `${summary.urgency_distribution.High} emails are waiting in the priority queue.`,
          to: "/app/priority",
        }
      : null,
    pendingTasks
      ? {
          title: "Triage pending extracted tasks",
          description: `${pendingTasks} extracted tasks still need handling.`,
          to: "/app/tasks",
        }
      : null,
    attachmentsReceived
      ? {
          title: "Review recent attachments",
          description: `${attachmentsReceived} emails include files or shared documents.`,
          to: "/app/attachments",
        }
      : null,
    totalEmails
      ? {
          title: "Return to the inbox workspace",
          description: `Browse ${totalEmails} synced emails with MailMind filters and summaries.`,
          to: "/app/inbox",
        }
      : null,
  ].filter(Boolean);

  const coverageRows = [
    {
      label: "Task detection rate",
      value: taskCoverage,
      note: `${totalTasks} tasks extracted across ${totalEmails} synced emails.`,
    },
    {
      label: "High urgency rate",
      value: highUrgencyRate,
      note: `${highUrgencyCount} emails flagged high priority by MailMind.`,
    },
    {
      label: "Attachment reach",
      value: attachmentReach,
      note: `${attachmentsReceived} emails include files or shared documents.`,
    },
  ];

  const shouldShow = (section) => activeFocus === "all" || activeFocus === section;

  const maxProjectCount = Math.max(...projects.map((project) => Number(project.count || 0)), 1);
  const maxContactCount = Math.max(...contacts.map((contact) => Number(contact.count || 0)), 1);

  return (
    <div className="analytics-page">
      <section className="analytics-page__hero">
        <div>
          <div className="analytics-page__eyebrow">Deep insights</div>
          <h1 className="analytics-page__title">Analytics</h1>
          <p className="analytics-page__description">
            Explore the patterns behind inbox load, urgency, intent, tasks, and project grouping so MailMind feels understandable, actionable, and trustworthy.
          </p>
        </div>

        <div className="analytics-page__actions">
          <Button variant="outline" onClick={() => void loadSummary(true)} disabled={refreshing || analyzing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh analytics"}
          </Button>
          <Button variant="hero-outline" onClick={runAnalysis} disabled={analyzing || refreshing}>
            {analyzing ? "Analyzing..." : "Run AI Analysis"}
          </Button>
        </div>
      </section>

      {error ? <div className="analytics-page__message analytics-page__message--error">{error}</div> : null}
      {notice ? <div className="analytics-page__message">{notice}</div> : null}

      <section className="analytics-page__focus-bar">
        <div className="analytics-page__focus-copy">
          Use focus filters to move between workload, urgency, tasks, projects, and contact behavior.
        </div>
        <div className="analytics-page__focus-actions">
          {FOCUS_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`analytics-page__focus-chip ${activeFocus === option.id ? "analytics-page__focus-chip--active" : ""}`}
              onClick={() => setActiveFocus(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="analytics-page__stat-grid">
        {[
          {
            title: "High urgency rate",
            value: `${highUrgencyRate}%`,
            note: `${highUrgencyCount} of ${totalEmails} emails flagged as high priority.`,
            icon: Activity,
          },
          {
            title: "High urgency load",
            value: summary?.urgency_distribution?.High ?? 0,
            note: "Messages that likely need the fastest attention.",
            icon: AlertTriangle,
          },
          {
            title: "Pending tasks",
            value: pendingTasks,
            note: `${tasksWithDeadline} tasks include deadline cues.`,
            icon: CheckSquare,
          },
          {
            title: "Attachment reach",
            value: `${attachmentReach}%`,
            note: `${attachmentsReceived} emails include files or shared documents.`,
            icon: Paperclip,
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.title} className="analytics-page__stat-card">
              <div className="analytics-page__stat-icon">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="analytics-page__stat-title">{card.title}</div>
                <div className="analytics-page__stat-value">{card.value}</div>
                <div className="analytics-page__stat-note">{card.note}</div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="analytics-page__highlight-strip">
        {highlightCards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.title} className="analytics-page__highlight-card">
              <div className="analytics-page__highlight-icon">
                <Icon className="h-4 w-4" />
              </div>
              <div className="analytics-page__highlight-title">{card.title}</div>
              <div className="analytics-page__highlight-value">{card.value}</div>
              <div className="analytics-page__highlight-note">{card.note}</div>
            </article>
          );
        })}
      </section>

      <section className="analytics-page__coverage-band">
        {coverageRows.map((row) => (
          <article key={row.label} className="analytics-page__coverage-row">
            <div className="analytics-page__coverage-head">
              <span>{row.label}</span>
              <strong>{row.value}%</strong>
            </div>
            <div className="analytics-page__progress">
              <div className="analytics-page__progress-bar" style={{ width: `${Math.max(row.value, row.value ? 12 : 0)}%` }} />
            </div>
            <div className="analytics-page__coverage-note">{row.note}</div>
          </article>
        ))}
      </section>

      {shouldShow("overview") ? (
        <div className="analytics-page__grid analytics-page__grid--hero">
          <section className="analytics-page__card analytics-page__card--wide">
            <SectionHeading
              title="Inbox activity pulse"
              copy="Watch how synced email volume moves through the week so teams can spot heavier days quickly."
              icon={Activity}
            />

            <div className="analytics-page__chart-frame analytics-page__chart-frame--tall">
              {activityData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activityData}>
                    <defs>
                      <linearGradient id="analytics-activity-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.26} />
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
                    <Tooltip contentStyle={tooltipStyle()} />
                    <Area
                      type="monotone"
                      dataKey="emails"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      fill="url(#analytics-activity-fill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyAnalyticsState
                  title="No activity data yet"
                  description="Sync Gmail and run analysis to populate the weekly email activity view."
                />
              )}
            </div>
          </section>

          <section className="analytics-page__card">
            <SectionHeading
              title="Action center"
              copy="Quick links that help the user act on what the analytics page is seeing right now."
              icon={ArrowRight}
            />

            <div className="analytics-page__action-list">
              {actionItems.length ? (
                actionItems.map((item) => (
                  <Link key={item.title} to={item.to} className="analytics-page__action-card">
                    <div>
                      <div className="analytics-page__action-title">{item.title}</div>
                      <div className="analytics-page__action-copy">{item.description}</div>
                    </div>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ))
              ) : (
                <EmptyAnalyticsState
                  title="No action items yet"
                  description="Once MailMind has enough synced and analyzed inbox data, the most useful next steps will appear here."
                />
              )}
            </div>
          </section>
        </div>
      ) : null}

      {shouldShow("urgency") ? (
        <div className="analytics-page__grid">
          <section className="analytics-page__card">
            <SectionHeading
              title="Urgency distribution"
              copy="Compare the current spread of high, medium, and low urgency communication."
              icon={AlertTriangle}
            />

            {urgencyData.length ? (
              <div className="analytics-page__donut-layout">
                <div className="analytics-page__donut-shell">
                  <div className="analytics-page__donut-center">
                    <span>{totalPredictions}</span>
                    <small>analyzed</small>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip contentStyle={tooltipStyle()} />
                      <Pie data={urgencyData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={3}>
                        {urgencyData.map((item) => (
                          <Cell key={item.name} fill={item.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="analytics-page__legend-list">
                  {urgencyData.map((item) => (
                    <div key={item.name} className="analytics-page__legend-item">
                      <div className="analytics-page__legend-label">
                        <span className="analytics-page__legend-dot" style={{ background: item.color }} />
                        {item.name}
                      </div>
                      <div className="analytics-page__legend-value">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyAnalyticsState
                title="No urgency mix yet"
                description="Urgency analytics will appear after MailMind analyzes synced inbox content."
              />
            )}
          </section>

          <section className="analytics-page__card">
            <SectionHeading
              title="Urgency trend"
              copy="Compare recent high, medium, and low urgency volume to understand how inbox pressure is changing over time."
              icon={CalendarClock}
            />

            <div className="analytics-page__chart-frame">
              {weeklyUrgency.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyUrgency} barCategoryGap={18}>
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
                    <Tooltip contentStyle={tooltipStyle()} />
                    <Bar dataKey="low" stackId="urgency" fill="hsl(var(--success))" radius={0} />
                    <Bar dataKey="medium" stackId="urgency" fill="hsl(var(--warning))" radius={0} />
                    <Bar dataKey="high" stackId="urgency" fill="hsl(var(--urgent))" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyAnalyticsState
                  title="No trend yet"
                  description="Run MailMind analysis over synced mail to populate weekly urgency comparison."
                />
              )}
            </div>
          </section>
        </div>
      ) : null}

      {(shouldShow("overview") || shouldShow("tasks")) ? (
        <div className="analytics-page__grid">
          <section className="analytics-page__card">
            <SectionHeading
              title="Task progress"
              copy="Keep an eye on how extracted actions move from pending into completion across the workspace."
              icon={CheckSquare}
            />

            {taskTotal > 0 ? (
              <div className="analytics-page__donut-layout">
                <div className="analytics-page__donut-shell">
                  <div className="analytics-page__donut-center">
                    <span>{taskTotal}</span>
                    <small>tasks</small>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip contentStyle={tooltipStyle()} />
                      <Pie
                        data={taskStatusData.filter((item) => item.value > 0)}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={58}
                        outerRadius={86}
                        paddingAngle={3}
                      >
                        {taskStatusData.filter((item) => item.value > 0).map((item) => (
                          <Cell key={item.name} fill={item.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="analytics-page__legend-list">
                  {taskStatusData.map((item) => (
                    <div key={item.name} className="analytics-page__legend-item">
                      <div className="analytics-page__legend-label">
                        <span className="analytics-page__legend-dot" style={{ background: item.color }} />
                        {item.name}
                      </div>
                      <div className="analytics-page__legend-value">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyAnalyticsState
                title="No task analytics yet"
                description="Task status analytics appear once MailMind extracts actionable items from email content."
              />
            )}
          </section>

          <section className="analytics-page__card">
            <SectionHeading
              title="Task readiness"
              copy="These signals help users understand whether the extracted workload is actionable yet."
              icon={CheckSquare}
            />

            <div className="analytics-page__insights">
              <div className="analytics-page__insight">
                <div className="analytics-page__insight-title">Pending actions</div>
                <div className="analytics-page__insight-copy">
                  {pendingTasks
                    ? `${pendingTasks} tasks are still pending and should be reviewed first.`
                    : "No pending extracted tasks are waiting right now."}
                </div>
              </div>
              <div className="analytics-page__insight">
                <div className="analytics-page__insight-title">Deadline cues</div>
                <div className="analytics-page__insight-copy">
                  {tasksWithDeadline
                    ? `${tasksWithDeadline} extracted tasks include timing hints that can help users prioritize work.`
                    : "No deadline cues are being surfaced from the current inbox yet."}
                </div>
              </div>
              <div className="analytics-page__insight">
                <div className="analytics-page__insight-title">Task extraction coverage</div>
                <div className="analytics-page__insight-copy">
                  {totalPredictions
                    ? `${taskCoverage}% of analyzed emails produced extracted tasks.`
                    : "Run AI analysis to compare task extraction against analyzed mail."}
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {(shouldShow("overview") || shouldShow("projects")) ? (
        <div className="analytics-page__grid">
          <section className="analytics-page__card">
            <SectionHeading
              title="Project concentration"
              copy="See which project groups are producing the most inbox activity so users can focus review quickly."
              icon={FolderKanban}
            />

            <div className="analytics-page__list">
              {projects.length ? (
                projects.map((project) => {
                  const width = `${Math.max((Number(project.count || 0) / maxProjectCount) * 100, 14)}%`;
                  return (
                    <div key={project.name} className="analytics-page__metric-row">
                      <div className="analytics-page__metric-head">
                        <span>{project.name}</span>
                        <span>{project.count}</span>
                      </div>
                      <div className="analytics-page__progress">
                        <div className="analytics-page__progress-bar" style={{ width }} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyAnalyticsState
                  title="No project grouping yet"
                  description="Project concentration appears once MailMind clusters synced emails into project groups."
                />
              )}
            </div>
          </section>

          <section className="analytics-page__card">
            <SectionHeading
              title="Intent comparison"
              copy="Review which intent classes dominate the inbox so users understand why mail is grouped the way it is."
              icon={Sparkles}
            />

            <div className="analytics-page__chart-frame">
              {intentData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={intentData} layout="vertical" margin={{ top: 4, right: 10, bottom: 4, left: 12 }}>
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
                    <Tooltip contentStyle={tooltipStyle()} />
                    <Bar dataKey="value" fill="hsl(var(--secondary))" radius={[0, 10, 10, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyAnalyticsState
                  title="No intent data yet"
                  description="MailMind will show current intent distribution after inbox analysis is completed."
                />
              )}
            </div>
          </section>
        </div>
      ) : null}

      {(shouldShow("overview") || shouldShow("contacts")) ? (
        <div className="analytics-page__grid">
          <section className="analytics-page__card">
            <SectionHeading
              title="Most active contacts"
              copy="Identify the senders generating the most traffic across the workspace."
              icon={Users}
            />

            <div className="analytics-page__contact-list">
              {contacts.length ? (
                contacts.map((contact, index) => {
                  const width = `${Math.max((Number(contact.count || 0) / maxContactCount) * 100, 18)}%`;
                  return (
                    <div key={contact.name} className="analytics-page__contact-row">
                      <div className="analytics-page__contact-main">
                        <div className="analytics-page__contact-rank">{index + 1}</div>
                        <Avatar initials={contact.initials} className="h-10 w-10" />
                        <div>
                          <div className="analytics-page__contact-name">{contact.name}</div>
                          <div className="analytics-page__contact-subtle">{contact.count} related emails</div>
                        </div>
                      </div>
                      <div className="analytics-page__contact-visual">
                        <div className="analytics-page__progress">
                          <div className="analytics-page__contact-fill" style={{ width }} />
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyAnalyticsState
                  title="No contact activity yet"
                  description="Contact analytics appear after MailMind has enough synced inbox data to compare senders."
                />
              )}
            </div>
          </section>

          <section className="analytics-page__card">
            <SectionHeading
              title="MailMind observations"
              copy="Keep the main signals in one place so users understand what the system is noticing right now."
              icon={Sparkles}
            />

            <div className="analytics-page__insights">
              {insights.length ? (
                insights.map((insight) => (
                  <div key={insight.title} className="analytics-page__insight">
                    <div className="analytics-page__insight-title">{insight.title}</div>
                    <div className="analytics-page__insight-copy">{insight.description}</div>
                  </div>
                ))
              ) : (
                <EmptyAnalyticsState
                  title="No insights yet"
                  description="MailMind observations will appear here after you sync and analyze your inbox."
                />
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
