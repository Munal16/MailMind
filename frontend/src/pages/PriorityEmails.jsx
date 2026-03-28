import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  Inbox as InboxIcon,
  RefreshCcw,
  Search,
  Sparkles,
} from "lucide-react";
import { Avatar } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import api from "../api/client";
import "./PriorityEmails.css";

const urgencyTabs = [
  { value: "All", label: "All priority" },
  { value: "High", label: "High urgency" },
  { value: "Medium", label: "Follow up soon" },
  { value: "Low", label: "Monitor" },
];

const urgencySectionMeta = {
  High: {
    title: "High urgency",
    copy: "Open these first. MailMind found the strongest urgency and action cues here.",
  },
  Medium: {
    title: "Follow up soon",
    copy: "These messages still need attention, but they are slightly less time-sensitive.",
  },
  Low: {
    title: "Monitor",
    copy: "Keep these visible, but they can usually wait until the urgent queue is clear.",
  },
};

function formatPriorityError(err) {
  if (typeof err?.response?.data === "string") return err.response.data;
  if (err?.response?.data?.error) return err.response.data.error;
  if (err?.response?.data?.message) return err.response.data.message;
  return "MailMind could not load the priority queue right now.";
}

function parseIdentity(value) {
  const raw = String(value || "").trim();
  if (!raw) return { name: "Unknown sender", email: "" };

  const match = raw.match(/^(.*?)(?:\s*<([^>]+)>)?$/);
  const name = (match?.[1] || "").replace(/^["']|["']$/g, "").trim();
  const email = (match?.[2] || "").trim();

  if (name && email && name.toLowerCase() !== email.toLowerCase()) {
    return { name, email };
  }
  if (email) {
    return { name: email, email: "" };
  }
  return { name: raw, email: "" };
}

function formatRelativeDate(value) {
  if (!value) return "Recently analyzed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently analyzed";

  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (sameDay) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function urgencyTone(urgency) {
  if (urgency === "High") return "high";
  if (urgency === "Medium") return "medium";
  return "low";
}

export default function PriorityEmails() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [query, setQuery] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("All");
  const [intentFilter, setIntentFilter] = useState("All");

  const loadPriorityQueue = useCallback(async ({ showFeedback = false } = {}) => {
    try {
      setError("");
      if (showFeedback) setNotice("");
      setLoading(true);
      const res = await api.get("/api/ai/priority-emails/");
      setRows(res.data.emails || []);
      if (showFeedback) {
        setNotice("Priority queue refreshed.");
      }
    } catch (err) {
      setRows([]);
      setError(formatPriorityError(err));
      setNotice("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPriorityQueue();
  }, [loadPriorityQueue]);

  const refreshQueue = async () => {
    try {
      setRefreshing(true);
      await loadPriorityQueue({ showFeedback: true });
    } finally {
      setRefreshing(false);
    }
  };

  const runAiAnalysis = async () => {
    try {
      setAnalyzing(true);
      setError("");
      setNotice("");
      await api.post("/api/ai/analyze-latest/", { limit: 80 });
      await loadPriorityQueue();
      setNotice("Priority queue updated from the latest AI analysis.");
    } catch (err) {
      setError(formatPriorityError(err));
    } finally {
      setAnalyzing(false);
    }
  };

  const intentOptions = useMemo(
    () => [
      { value: "All", label: "All intents" },
      ...Array.from(new Set(rows.map((row) => row.intent).filter(Boolean))).map((item) => ({
        value: item,
        label: item,
      })),
    ],
    [rows]
  );

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rows.filter((row) => {
      const urgencyMatch = urgencyFilter === "All" ? true : row.urgency === urgencyFilter;
      const intentMatch = intentFilter === "All" ? true : row.intent === intentFilter;
      const textMatch = normalizedQuery
        ? `${row.sender || ""} ${row.subject || ""} ${row.reason || ""} ${row.project_name || ""} ${row.intent || ""}`
            .toLowerCase()
            .includes(normalizedQuery)
        : true;
      return urgencyMatch && intentMatch && textMatch;
    });
  }, [intentFilter, query, rows, urgencyFilter]);

  const groupedRows = useMemo(
    () => ({
      High: filteredRows.filter((row) => row.urgency === "High"),
      Medium: filteredRows.filter((row) => row.urgency === "Medium"),
      Low: filteredRows.filter((row) => row.urgency === "Low"),
    }),
    [filteredRows]
  );

  const stats = useMemo(() => {
    const highCount = rows.filter((row) => row.urgency === "High").length;
    const taskBackedCount = rows.filter((row) => row.task_count > 0).length;
    const withDeadlines = rows.filter((row) => row.deadline).length;
    const averageScore = rows.length
      ? Math.round(rows.reduce((total, row) => total + (row.priority_score || 0), 0) / rows.length)
      : 0;

    return [
      {
        label: "High urgency",
        value: highCount,
        note: "Top messages to review first",
      },
      {
        label: "Task-backed reasons",
        value: taskBackedCount,
        note: "Priority supported by extracted actions",
      },
      {
        label: "Deadline hints",
        value: withDeadlines,
        note: "Emails with explicit timing cues",
      },
      {
        label: "Average score",
        value: averageScore,
        note: "Across the current analyzed queue",
      },
    ];
  }, [rows]);

  const queueSections = useMemo(
    () =>
      ["High", "Medium", "Low"]
        .filter((urgency) => urgencyFilter === "All" || urgency === urgencyFilter)
        .map((urgency) => ({
          urgency,
          ...urgencySectionMeta[urgency],
          items: groupedRows[urgency] || [],
        })),
    [groupedRows, urgencyFilter]
  );

  return (
    <div className="priority-page">
      <div className="priority-page__hero">
        <div>
          <div className="priority-page__eyebrow">Urgent queue</div>
          <h1 className="priority-page__title">Priority Emails</h1>
          <p className="priority-page__description">
            Keep urgent mail clear, explain why it matters, and move through the queue with confidence instead of guesswork.
          </p>
        </div>

        <div className="priority-page__actions">
          <Button variant="outline" onClick={refreshQueue} disabled={loading || refreshing || analyzing}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
          <Button variant="hero-outline" onClick={runAiAnalysis} disabled={loading || refreshing || analyzing}>
            <Sparkles className="mr-2 h-4 w-4" />
            {analyzing ? "Analyzing..." : "Run AI Analysis"}
          </Button>
        </div>
      </div>

      {error ? <div className="priority-page__error">{error}</div> : null}
      {notice ? <div className="priority-page__notice">{notice}</div> : null}

      <div className="priority-page__stats">
        {stats.map((item) => (
          <article key={item.label} className="priority-page__stat-card">
            <div className="priority-page__stat-label">{item.label}</div>
            <div className="priority-page__stat-value">{item.value}</div>
            <div className="priority-page__stat-note">{item.note}</div>
          </article>
        ))}
      </div>

      <section className="priority-page__filters-card">
        <div className="priority-page__filters-top">
          <div>
            <div className="priority-page__section-title">MailMind queue filters</div>
            <div className="priority-page__section-copy">
              Narrow the queue by urgency and intent, then open the highest-value messages in Inbox.
            </div>
          </div>
          <div className="priority-page__pill">
            <AlertTriangle className="h-4 w-4" />
            Ranked by urgency, intent, and extracted task cues
          </div>
        </div>

        <div className="priority-page__controls">
          <label className="priority-page__search">
            <Search className="h-4 w-4" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search sender, subject, project, or reason"
            />
          </label>

          <label className="priority-page__select-field">
            <span>Intent</span>
            <select value={intentFilter} onChange={(event) => setIntentFilter(event.target.value)}>
              {intentOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="priority-page__tabs">
          {urgencyTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={`priority-page__tab${urgencyFilter === tab.value ? " priority-page__tab--active" : ""}`}
              onClick={() => setUrgencyFilter(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <div className="priority-page__sections">
        {queueSections.map((section) => (
          <section key={section.urgency} className="priority-page__queue-section">
            <div className="priority-page__queue-head">
              <div>
                <div className="priority-page__section-title">{section.title}</div>
                <div className="priority-page__section-copy">{section.copy}</div>
              </div>
              <div className={`priority-page__queue-count priority-page__queue-count--${section.urgency.toLowerCase()}`}>
                {section.items.length}
              </div>
            </div>

            <div className="priority-page__queue-grid">
              {section.items.length ? (
                section.items.map((row) => {
                  const sender = parseIdentity(row.sender);
                  return (
                    <article key={row.gmail_id} className="priority-page__email-card">
                      <div className="priority-page__email-top">
                        <div className="priority-page__sender">
                          <Avatar initials={sender.name.slice(0, 2).toUpperCase()} className="h-10 w-10" />
                          <div>
                            <div className="priority-page__sender-name">{sender.name}</div>
                            <div className="priority-page__sender-email">{sender.email || "Connected Gmail sender"}</div>
                          </div>
                        </div>

                        <div className="priority-page__score-block">
                          <div className={`priority-page__score priority-page__score--${urgencyTone(row.urgency)}`}>
                            {row.priority_score || 0}
                          </div>
                          <div className="priority-page__time">{formatRelativeDate(row.internal_date)}</div>
                        </div>
                      </div>

                      <div className="priority-page__email-subject">{row.subject || "(no subject)"}</div>

                      <div className="priority-page__badge-row">
                        <Badge variant={urgencyTone(row.urgency)}>{row.urgency || "Low"} urgency</Badge>
                        <Badge variant="muted">{row.intent || "Unclassified"}</Badge>
                        {row.project_name ? <Badge variant="accent">{row.project_name}</Badge> : null}
                        {row.task_count ? <Badge variant="accent">{row.task_count} task{row.task_count === 1 ? "" : "s"}</Badge> : null}
                      </div>

                      <div className="priority-page__reason-card">
                        <div className="priority-page__reason-label">Why MailMind flagged it</div>
                        <div className="priority-page__reason-copy">{row.reason || "Priority comes from the current urgency and intent signals."}</div>
                      </div>

                      <div className="priority-page__support-grid">
                        {row.task_preview ? (
                          <div className="priority-page__support-card">
                            <div className="priority-page__support-label">Action cue</div>
                            <div className="priority-page__support-copy">{row.task_preview}</div>
                          </div>
                        ) : (
                          <div className="priority-page__support-card priority-page__support-card--muted">
                            <div className="priority-page__support-label">Action cue</div>
                            <div className="priority-page__support-copy">No clear action line was extracted from this message.</div>
                          </div>
                        )}

                        <div className="priority-page__support-card">
                          <div className="priority-page__support-label">Timing</div>
                          <div className="priority-page__support-copy">
                            {row.deadline || row.task_support || "No deadline detected"}
                          </div>
                        </div>
                      </div>

                      <div className="priority-page__email-footer">
                        <div className="priority-page__deadline">
                          <CalendarClock className="h-4 w-4" />
                          <span>{row.deadline || "No deadline detected"}</span>
                        </div>

                        <Button variant="outline" size="sm" onClick={() => navigate(`/app/inbox?email=${row.gmail_id}`)}>
                          <InboxIcon className="mr-1.5 h-4 w-4" />
                          Open in Inbox
                          <ArrowUpRight className="ml-1.5 h-4 w-4" />
                        </Button>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="priority-page__empty">
                  <div className="priority-page__empty-title">Nothing in this queue right now</div>
                  <div className="priority-page__empty-copy">
                    Adjust the filters, refresh the queue, or run AI analysis again after syncing Gmail.
                  </div>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
