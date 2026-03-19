import { useCallback, useEffect, useMemo, useState } from "react";
import DOMPurify from "dompurify";
import { Filter, ListChecks, Paperclip, Reply, Sparkles } from "lucide-react";
import EmailCard from "../components/EmailCard";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Avatar } from "../components/ui/avatar";
import api from "../api/client";

const dateFilters = ["All time", "Today", "This week", "This month"];

function mapEmail(item) {
  return {
    id: item.gmail_id,
    sender: item.sender || "Unknown Sender",
    subject: item.subject || "(no subject)",
    preview: item.snippet || "",
    time: item.internal_date ? new Date(item.internal_date).toLocaleString() : "",
    urgency: item.prediction?.urgency || "Low",
    intent: item.prediction?.intent || "Unclassified",
    project: item.project_name || null,
    hasTask: (item.tasks || []).length > 0,
    taskCount: (item.tasks || []).length,
    tasks: item.tasks || [],
    priorityScore: item.prediction?.priority_score || 0,
    hasAttachment: (item.labels || []).includes("HAS_ATTACHMENT") || /attach/i.test(item.snippet || ""),
    internalDate: item.internal_date ? new Date(item.internal_date) : null,
  };
}

function withinDateFilter(date, filter) {
  if (!date || filter === "All time") return true;

  const now = new Date();
  if (filter === "Today") {
    return date.toDateString() === now.toDateString();
  }
  if (filter === "This week") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return date >= start;
  }
  if (filter === "This month") {
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }
  return true;
}

function normalizeSize(bytes) {
  if (!bytes && bytes !== 0) return "Unknown";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export default function Inbox() {
  const [emailsRaw, setEmailsRaw] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [urgency, setUrgency] = useState("All");
  const [intent, setIntent] = useState("All");
  const [project, setProject] = useState("All");
  const [dateFilter, setDateFilter] = useState("All time");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const loadInbox = useCallback(async () => {
    try {
      setError("");
      setLoading(true);
      const res = await api.get("/api/gmail/inbox/?limit=200");
      const list = res.data.emails || [];
      setEmailsRaw(list);
      if (!selectedId && list.length > 0) {
        setSelectedId(list[0].gmail_id);
      }
    } catch (err) {
      setError(typeof err.response?.data === "string" ? err.response.data : JSON.stringify(err.response?.data || err.message));
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  const runAiAnalysis = async () => {
    try {
      setAnalyzing(true);
      setError("");
      await api.post("/api/ai/analyze-latest/", { limit: 50 });
      await loadInbox();
    } catch (err) {
      setError(typeof err.response?.data === "string" ? err.response.data : JSON.stringify(err.response?.data || err.message));
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  useEffect(() => {
    if (!selectedId) return;
    const loadDetail = async () => {
      try {
        const res = await api.get(`/api/gmail/message/${selectedId}/`);
        setDetail(res.data);
      } catch {
        setDetail(null);
      }
    };
    loadDetail();
  }, [selectedId]);

  const emails = useMemo(() => emailsRaw.map(mapEmail), [emailsRaw]);

  const intentOptions = useMemo(
    () => ["All", ...Array.from(new Set(emails.map((email) => email.intent).filter(Boolean)))],
    [emails]
  );
  const projectOptions = useMemo(
    () => ["All", ...Array.from(new Set(emails.map((email) => email.project).filter(Boolean)))],
    [emails]
  );

  const folderStats = useMemo(
    () => [
      { label: "All Emails", count: emails.length },
      { label: "Unread", count: emailsRaw.filter((email) => !email.is_read).length },
      { label: "Starred", count: emailsRaw.filter((email) => email.is_starred).length },
      { label: "With Tasks", count: emails.filter((email) => email.hasTask).length },
      { label: "Attachments", count: emails.filter((email) => email.hasAttachment).length },
      { label: "Projects", count: projectOptions.filter((item) => item !== "All").length },
    ],
    [emails, emailsRaw, projectOptions]
  );

  const filteredEmails = useMemo(
    () =>
      emails
        .filter((email) => (urgency === "All" ? true : email.urgency === urgency))
        .filter((email) => (intent === "All" ? true : email.intent === intent))
        .filter((email) => (project === "All" ? true : email.project === project))
        .filter((email) => withinDateFilter(email.internalDate, dateFilter))
        .sort((a, b) => b.priorityScore - a.priorityScore || (b.internalDate?.getTime() || 0) - (a.internalDate?.getTime() || 0)),
    [dateFilter, emails, intent, project, urgency]
  );

  const selected = useMemo(
    () => filteredEmails.find((email) => email.id === selectedId) || emails.find((email) => email.id === selectedId) || null,
    [filteredEmails, emails, selectedId]
  );

  const downloadAttachment = async (attachment) => {
    if (!selectedId) return;
    const token = localStorage.getItem("access_token");
    const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
    const url = `${baseUrl}/api/gmail/attachment/${selectedId}/${attachment.attachment_id}/?filename=${encodeURIComponent(attachment.filename)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const aTag = document.createElement("a");
    aTag.href = URL.createObjectURL(blob);
    aTag.download = attachment.filename;
    document.body.appendChild(aTag);
    aTag.click();
    aTag.remove();
  };

  return (
    <div className="-m-6 flex h-[calc(100vh-8rem)] overflow-hidden">
      <aside className="hidden w-52 border-r border-border bg-card p-4 lg:block">
        <div className="text-sm font-semibold text-card-foreground">Inbox Overview</div>
        <div className="mt-4 space-y-2">
          {folderStats.map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent/30 hover:text-accent-foreground">
              <span>{item.label}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{item.count}</span>
            </div>
          ))}
        </div>
      </aside>

      <section className="flex w-full min-w-0 border-r border-border bg-card md:w-[28rem] md:min-w-[28rem]">
        <div className="flex w-full flex-col">
          <div className="border-b border-border px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
                <Filter className="h-4 w-4 text-primary" />
                Smart Inbox
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={loadInbox}>Refresh</Button>
                <Button variant="hero-outline" size="sm" onClick={runAiAnalysis} disabled={analyzing}>
                  {analyzing ? "Analyzing..." : "Run AI Analysis"}
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <select value={urgency} onChange={(e) => setUrgency(e.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {["All", "High", "Medium", "Low"].map((item) => <option key={item}>{item}</option>)}
              </select>
              <select value={intent} onChange={(e) => setIntent(e.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {intentOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
              <select value={project} onChange={(e) => setProject(e.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {projectOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
              <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {dateFilters.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
          </div>

          {error ? <div className="mx-4 mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div> : null}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading && filteredEmails.length === 0 ? <div className="px-4 py-6 text-sm text-muted-foreground">Loading inbox...</div> : null}
            {filteredEmails.map((email) => (
              <EmailCard
                key={email.id}
                sender={email.sender}
                subject={email.subject}
                preview={email.preview}
                time={email.time}
                urgency={email.urgency}
                intent={email.intent}
                project={email.project}
                hasTask={email.hasTask}
                hasAttachment={email.hasAttachment}
                selected={selected?.id === email.id}
                onClick={() => setSelectedId(email.id)}
              />
            ))}
            {!loading && filteredEmails.length === 0 ? <div className="px-4 py-6 text-sm text-muted-foreground">No emails match the current filters.</div> : null}
          </div>
        </div>
      </section>

      <section className="hidden min-w-0 flex-1 bg-background md:block">
        {selected ? (
          <div className="h-full overflow-y-auto p-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-card-foreground">{selected.subject}</h1>
                  <div className="mt-4 flex items-center gap-3">
                    <Avatar initials={(selected.sender || "UN").slice(0, 2).toUpperCase()} className="h-9 w-9" />
                    <div>
                      <div className="text-sm font-medium text-card-foreground">{selected.sender}</div>
                      <div className="text-xs text-muted-foreground">{selected.time}</div>
                    </div>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  <Reply className="mr-1.5 h-4 w-4" />
                  Reply
                </Button>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Badge variant={selected.urgency === "High" ? "high" : selected.urgency === "Medium" ? "medium" : "low"}>{selected.urgency} urgency</Badge>
                <Badge variant="muted">{selected.intent}</Badge>
                {selected.project ? <Badge variant="accent">{selected.project}</Badge> : null}
                {selected.hasTask ? <Badge variant="accent">{selected.taskCount} task{selected.taskCount > 1 ? "s" : ""} detected</Badge> : null}
                {selected.hasAttachment ? <Badge variant="accent">Attachment</Badge> : null}
                {selected.priorityScore ? <Badge variant="accent">Priority {selected.priorityScore}</Badge> : null}
              </div>

              <div className="mt-6 rounded-xl border border-border bg-background p-5 text-sm leading-7 text-muted-foreground">
                {detail?.body_text ? (
                  <div className="whitespace-pre-wrap">{detail.body_text}</div>
                ) : detail?.body_html ? (
                  <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(detail.body_html) }} />
                ) : (
                  selected.preview || "No body content available."
                )}
              </div>

              {selected.tasks.length ? (
                <div className="mt-6">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-card-foreground">
                    <ListChecks className="h-4 w-4 text-primary" />
                    Extracted Tasks
                  </div>
                  <div className="space-y-3">
                    {selected.tasks.map((task) => (
                      <div key={task.id} className="rounded-xl border border-border bg-muted/40 px-4 py-3">
                        <div className="text-sm font-medium text-card-foreground">{task.task_text}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Status: {task.status} • Confidence: {task.confidence ? Number(task.confidence).toFixed(2) : "N/A"}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Deadline: {task.deadline || "Not detected"} • Responsibility: {task.responsibility || "Not detected"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {detail?.attachments?.length ? (
                <div className="mt-6">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-card-foreground">
                    <Paperclip className="h-4 w-4 text-primary" />
                    Attachments
                  </div>
                  <div className="space-y-3">
                    {detail.attachments.map((item) => (
                      <div key={item.attachment_id} className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
                        <div>
                          <div className="text-sm font-medium text-card-foreground">{item.filename}</div>
                          <div className="text-xs text-muted-foreground">{item.mime_type} • {normalizeSize(item.size)}</div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => downloadAttachment(item)}>Download</Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-6 flex items-center gap-2 rounded-xl bg-accent/40 px-4 py-3 text-sm text-accent-foreground">
                <Sparkles className="h-4 w-4" />
                MailMind groups this email by urgency, intent, project context, tasks, and attachment activity for faster triage.
              </div>
            </div>
          </div>
        ) : (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">Select an email to preview.</div>
        )}
      </section>
    </div>
  );
}
