import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import DOMPurify from "dompurify";
import {
  Archive,
  FileText,
  Filter,
  Forward,
  Inbox as InboxIcon,
  MailOpen,
  Paperclip,
  RefreshCcw,
  Reply,
  ReplyAll,
  Search,
  Send,
  Sparkles,
  Star,
  Trash2,
  Undo2,
} from "lucide-react";
import EmailCard from "../components/EmailCard";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Avatar } from "../components/ui/avatar";
import api from "../api/client";
import { cn } from "../lib/utils";
import "./Inbox.css";

const mailboxOptions = [
  { key: "all", label: "All Emails", icon: InboxIcon, copy: "Every synced message in MailMind" },
  { key: "unread", label: "Unread", icon: MailOpen, copy: "Messages that still need a first read" },
  { key: "starred", label: "Starred", icon: Star, copy: "Important threads marked for follow-up" },
  { key: "sent", label: "Sent", icon: Send, copy: "Messages already sent from Gmail" },
  { key: "drafts", label: "Drafts", icon: FileText, copy: "Draft emails waiting to be finished" },
  { key: "archive", label: "Archive", icon: Archive, copy: "Messages stored outside the inbox" },
  { key: "trash", label: "Trash", icon: Trash2, copy: "Emails waiting for permanent deletion" },
];

const urgencyOptions = [
  { value: "All", label: "All urgencies" },
  { value: "High", label: "High" },
  { value: "Medium", label: "Medium" },
  { value: "Low", label: "Low" },
];

const dateOptions = [
  { value: "All time", label: "Any date" },
  { value: "Today", label: "Today" },
  { value: "This week", label: "This week" },
  { value: "This month", label: "This month" },
];

const inboxExperienceCards = [
  {
    icon: MailOpen,
    title: "Read status stays current",
    description: "Opening a message moves it out of the unread lane so the mailbox counts reflect what the user has actually reviewed.",
  },
  {
    icon: Sparkles,
    title: "Summaries stay attached to the original email",
    description: "MailMind keeps the real message visible first, then adds a short AI recap so the user can scan without losing the source context.",
  },
  {
    icon: Paperclip,
    title: "Files stay tied to the selected email",
    description: "Attachment details remain connected to the active message so users can review files without losing the surrounding context.",
  },
];

function parseIdentity(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return { name: "Unknown sender", email: "" };
  }

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

function getProjectTag(project, subject) {
  const normalizedProject = String(project || "").trim();
  const normalizedSubject = String(subject || "").trim();

  if (!normalizedProject) return null;
  if (!normalizedSubject) return normalizedProject;

  const projectLower = normalizedProject.toLowerCase();
  const subjectLower = normalizedSubject.toLowerCase();

  if (projectLower === subjectLower || projectLower.includes(subjectLower) || subjectLower.includes(projectLower)) {
    return null;
  }

  return normalizedProject.length > 30 ? `${normalizedProject.slice(0, 27)}...` : normalizedProject;
}

function parseAddressList(value) {
  return String(value || "")
    .replace(/;/g, ",")
    .split(",")
    .map((item) => parseIdentity(item))
    .map((item) => item.email || item.name)
    .filter(Boolean);
}

function quoteEmailBody(value) {
  const body = String(value || "").trim();
  if (!body) return "";
  return body
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

function buildReplyBody(detail, selected) {
  const source = detail?.body_text || selected?.preview || "";
  const sender = detail?.from || selected?.sender || "the sender";
  const date = detail?.date || selected?.time || "recently";
  const quoted = quoteEmailBody(source);

  return quoted
    ? `\n\nOn ${date}, ${sender} wrote:\n${quoted}`
    : `\n\nOn ${date}, ${sender} wrote:`;
}

function buildForwardBody(detail, selected) {
  const body = String(detail?.body_text || selected?.preview || "").trim();
  const lines = [
    "",
    "",
    "---------- Forwarded message ---------",
    `From: ${detail?.from || selected?.sender || "Unknown sender"}`,
    `Date: ${detail?.date || selected?.time || "Unknown date"}`,
    `Subject: ${detail?.subject || selected?.subject || "(no subject)"}`,
    `To: ${detail?.to || "Unknown recipient"}`,
  ];

  if (detail?.cc) {
    lines.push(`Cc: ${detail.cc}`);
  }

  lines.push("");
  if (body) {
    lines.push(body);
  }

  return lines.join("\n");
}

function formatInboxError(err) {
  if (typeof err?.response?.data === "string") {
    return err.response.data;
  }
  if (err?.response?.data?.message) {
    return err.response.data.message;
  }
  if (err?.response?.data?.error) {
    return err.response.data.error;
  }
  return "MailMind could not load the inbox right now.";
}

function formatEmailTime(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

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

  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  return date.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}

function mapEmail(item) {
  return {
    id: item.gmail_id,
    thread_id: item.thread_id,
    sender: item.sender || "Unknown sender",
    subject: item.subject || "(no subject)",
    preview: item.snippet || "",
    time: formatEmailTime(item.internal_date),
    urgency: item.prediction?.urgency || "Low",
    intent: item.prediction?.intent || "Unclassified",
    project: item.project_name || null,
    hasTask: (item.tasks || []).length > 0,
    taskCount: (item.tasks || []).length,
    tasks: item.tasks || [],
    priorityScore: item.prediction?.priority_score || 0,
    labels: item.labels || [],
    isRead: Boolean(item.is_read),
    isStarred: Boolean(item.is_starred),
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

function matchesMailbox(email, mailbox) {
  switch (mailbox) {
    case "unread":
      return !email.isRead && !email.labels.includes("TRASH");
    case "starred":
      return email.isStarred && !email.labels.includes("TRASH");
    case "sent":
      return email.labels.includes("SENT") && !email.labels.includes("TRASH");
    case "drafts":
      return email.labels.includes("DRAFT") && !email.labels.includes("TRASH");
    case "archive":
      return (
        !email.labels.includes("INBOX") &&
        !email.labels.includes("SENT") &&
        !email.labels.includes("DRAFT") &&
        !email.labels.includes("TRASH")
      );
    case "trash":
      return email.labels.includes("TRASH");
    case "all":
    default:
      return !email.labels.includes("TRASH");
  }
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="inbox-page__filter-field">
      <span className="inbox-page__filter-label">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="inbox-page__filter-select"
        aria-label={label}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function Inbox() {
  const navigate = useNavigate();
  const { openCompose } = useOutletContext();
  const [searchParams] = useSearchParams();
  const [emailsRaw, setEmailsRaw] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [mailbox, setMailbox] = useState("all");
  const [urgency, setUrgency] = useState("All");
  const [intent, setIntent] = useState("All");
  const [project, setProject] = useState("All");
  const [dateFilter, setDateFilter] = useState("All time");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [changingTrash, setChangingTrash] = useState(false);
  const [emptyingTrash, setEmptyingTrash] = useState(false);
  const focusedEmailId = searchParams.get("email");
  const focusedMailbox = searchParams.get("mailbox");

  const markEmailAsReadLocal = useCallback((gmailId) => {
    setEmailsRaw((current) =>
      current.map((item) => {
        if (item.gmail_id !== gmailId || item.is_read) {
          return item;
        }

        return {
          ...item,
          is_read: true,
          labels: Array.isArray(item.labels) ? item.labels.filter((label) => label !== "UNREAD") : item.labels,
        };
      })
    );
  }, []);

  const updateLocalEmailLabels = useCallback((gmailId, labels) => {
    setEmailsRaw((current) =>
      current.map((item) =>
        item.gmail_id === gmailId
          ? {
              ...item,
              labels,
              is_read: !labels.includes("UNREAD"),
              is_starred: labels.includes("STARRED"),
            }
          : item
      )
    );
  }, []);

  const removeLocalEmails = useCallback((gmailIds) => {
    const ids = new Set(gmailIds);
    setEmailsRaw((current) => current.filter((item) => !ids.has(item.gmail_id)));
  }, []);

  const loadInbox = useCallback(
    async ({ showFeedback = false } = {}) => {
      try {
        setError("");
        if (showFeedback) {
          setNotice("");
        }
        setLoading(true);
        const res = await api.get("/api/gmail/inbox/?limit=400");
        const list = res.data.emails || [];
        setEmailsRaw(list);
        setSelectedId((current) => {
          if (current && list.some((email) => email.gmail_id === current)) {
            return current;
          }
          return list[0]?.gmail_id || null;
        });
        setStatus(list.length ? "" : "No emails are synced yet. Connect Gmail and run a sync to populate the inbox.");
        if (showFeedback) {
          setNotice("Inbox refreshed.");
        }
      } catch (err) {
        setEmailsRaw([]);
        setSelectedId(null);
        setError(formatInboxError(err));
        setStatus("");
        setNotice("");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const handleOutgoingUpdated = (event) => {
      const mailboxKey = event.detail?.mailbox;
      if (mailboxKey && mailboxOptions.some((option) => option.key === mailboxKey)) {
        setMailbox(mailboxKey);
      }
      setNotice(event.detail?.message || "");
      void loadInbox();
    };

    window.addEventListener("mailmind:outgoing-updated", handleOutgoingUpdated);
    return () => window.removeEventListener("mailmind:outgoing-updated", handleOutgoingUpdated);
  }, [loadInbox]);

  const syncMailbox = async () => {
    try {
      setSyncing(true);
      setError("");
      setNotice("");
      setStatus("Syncing Gmail mailboxes...");

      const syncRes = await api.post("/api/gmail/sync/", { max_results: 120 });
      const syncedCount = Number(syncRes.data.saved || 0) + Number(syncRes.data.updated || 0);

      setStatus(`Synced ${syncedCount} emails. Refreshing MailMind analysis...`);

      try {
        await api.post("/api/ai/analyze-latest/", { limit: 80 });
      } catch {
        // Keep sync successful even if AI refresh needs to be rerun separately.
      }

      await loadInbox();
      setStatus("");
      setNotice(
        `Mailbox sync complete. Processed ${syncRes.data.processed || syncedCount} messages across Gmail folders.`
      );
    } catch (err) {
      const message = formatInboxError(err);
      setError(message);
      setStatus("");
      if (err.response?.data?.requires_reconnect) {
        navigate(
          `/connect-email?gmail=error&message=${encodeURIComponent(
            message || "Gmail needs to be reconnected before MailMind can sync."
          )}`
        );
      }
    } finally {
      setSyncing(false);
    }
  };

  const runAiAnalysis = async () => {
    try {
      setAnalyzing(true);
      setError("");
      setNotice("");
      setStatus("Running MailMind analysis on the latest synced emails...");
      await api.post("/api/ai/analyze-latest/", { limit: 50 });
      await loadInbox();
      setStatus("");
      setNotice("AI analysis updated successfully.");
    } catch (err) {
      setError(formatInboxError(err));
      setStatus("");
    } finally {
      setAnalyzing(false);
    }
  };

  const moveSelectedToTrash = async () => {
    if (!selected?.id) return;

    try {
      setChangingTrash(true);
      setError("");
      setNotice("");
      const res = await api.post(`/api/gmail/message/${selected.id}/trash/`);
      const labels = res.data.labels || ["TRASH"];
      updateLocalEmailLabels(selected.id, labels);
      setSelectedId(null);
      setDetail(null);
      setNotice("Email moved to Trash.");
    } catch (err) {
      const message = formatInboxError(err);
      setError(message);
      if (err.response?.data?.requires_reconnect) {
        navigate(`/connect-email?gmail=error&message=${encodeURIComponent(message)}`);
      }
    } finally {
      setChangingTrash(false);
    }
  };

  const restoreSelectedEmail = async () => {
    if (!selected?.id) return;

    try {
      setChangingTrash(true);
      setError("");
      setNotice("");
      const res = await api.post(`/api/gmail/message/${selected.id}/restore/`);
      const labels = res.data.labels || [];
      updateLocalEmailLabels(selected.id, labels);
      setSelectedId(null);
      setDetail(null);
      setNotice("Email restored from Trash.");
    } catch (err) {
      const message = formatInboxError(err);
      setError(message);
      if (err.response?.data?.requires_reconnect) {
        navigate(`/connect-email?gmail=error&message=${encodeURIComponent(message)}`);
      }
    } finally {
      setChangingTrash(false);
    }
  };

  const emptyTrash = async () => {
    if (!window.confirm("Permanently delete every email currently in Trash? This cannot be undone.")) {
      return;
    }

    try {
      setEmptyingTrash(true);
      setError("");
      setNotice("");
      const res = await api.post("/api/gmail/trash/empty/");
      const localTrashIds = emails
        .filter((email) => email.labels.includes("TRASH"))
        .map((email) => email.id);

      removeLocalEmails(localTrashIds);
      setSelectedId(null);
      setDetail(null);
      setNotice(
        res.data.deleted
          ? `Trash emptied. Permanently deleted ${res.data.deleted} email${res.data.deleted === 1 ? "" : "s"}.`
          : "Trash was already empty."
      );
    } catch (err) {
      const message = formatInboxError(err);
      setError(message);
      if (err.response?.data?.requires_reconnect) {
        navigate(`/connect-email?gmail=error&message=${encodeURIComponent(message)}`);
      }
    } finally {
      setEmptyingTrash(false);
    }
  };

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }

    const loadDetail = async () => {
      try {
        const res = await api.get(`/api/gmail/message/${selectedId}/`);
        setDetail(res.data);
        markEmailAsReadLocal(selectedId);
      } catch {
        setDetail(null);
      }
    };

    void loadDetail();
  }, [markEmailAsReadLocal, selectedId]);

  const emails = useMemo(() => emailsRaw.map(mapEmail), [emailsRaw]);

  const intentOptions = useMemo(
    () => [
      { value: "All", label: "All intents" },
      ...Array.from(new Set(emails.map((email) => email.intent).filter(Boolean))).map((item) => ({
        value: item,
        label: item,
      })),
    ],
    [emails]
  );

  const projectOptions = useMemo(
    () => [
      { value: "All", label: "All projects" },
      ...Array.from(new Set(emails.map((email) => email.project).filter(Boolean))).map((item) => ({
        value: item,
        label: item,
      })),
    ],
    [emails]
  );

  const mailboxStats = useMemo(
    () =>
      mailboxOptions.map((option) => ({
        ...option,
        count: emails.filter((email) => matchesMailbox(email, option.key)).length,
      })),
    [emails]
  );

  const filteredEmails = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return emails
      .filter((email) => matchesMailbox(email, mailbox))
      .filter((email) => (urgency === "All" ? true : email.urgency === urgency))
      .filter((email) => (intent === "All" ? true : email.intent === intent))
      .filter((email) => (project === "All" ? true : email.project === project))
      .filter((email) => withinDateFilter(email.internalDate, dateFilter))
      .filter((email) => {
        if (!normalizedQuery) return true;
        const haystack = `${email.sender} ${email.subject} ${email.preview} ${email.intent} ${email.project || ""}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .sort(
        (a, b) =>
          b.priorityScore - a.priorityScore ||
          (b.internalDate?.getTime() || 0) - (a.internalDate?.getTime() || 0)
      );
  }, [dateFilter, emails, intent, mailbox, project, query, urgency]);

  useEffect(() => {
    if (filteredEmails.length === 0) {
      setSelectedId(null);
      setDetail(null);
      return;
    }

    if (!selectedId || !filteredEmails.some((email) => email.id === selectedId)) {
      setSelectedId(filteredEmails[0]?.id || null);
      setDetail(null);
      return;
    }
  }, [filteredEmails, selectedId]);

  useEffect(() => {
    if (!focusedEmailId) return;
    const match = emails.find((email) => email.id === focusedEmailId);
    if (match && match.id !== selectedId) {
      setSelectedId(match.id);
    }
  }, [emails, focusedEmailId, selectedId]);

  useEffect(() => {
    if (!focusedMailbox) return;
    if (!mailboxOptions.some((option) => option.key === focusedMailbox)) return;
    if (focusedMailbox !== mailbox) {
      setMailbox(focusedMailbox);
    }
  }, [focusedMailbox, mailbox]);

  const selected = useMemo(() => filteredEmails.find((email) => email.id === selectedId) || null, [filteredEmails, selectedId]);
  const selectedIdentity = useMemo(() => parseIdentity(detail?.from || selected?.sender), [detail, selected]);
  const selectedRecipient = useMemo(() => parseIdentity(detail?.to), [detail]);
  const selectedCcRecipients = useMemo(() => parseAddressList(detail?.cc), [detail?.cc]);
  const selectedProjectTag = useMemo(
    () => getProjectTag(selected?.project, selected?.subject),
    [selected?.project, selected?.subject]
  );
  const selectedIsTrashed = Boolean(selected?.labels.includes("TRASH"));

  const activeMailbox = mailboxStats.find((item) => item.key === mailbox) || mailboxStats[0];
  const detailAttachments = detail?.attachments || [];
  const currentBody = detail?.body_text || selected?.preview || "";

  const openReplyComposer = (mode) => {
    if (!selected) return;

    const senderAddress = selectedIdentity.email || selectedIdentity.name;
    const subjectPrefix = mode === "forward" ? "Fwd: " : "Re: ";
    const normalizedSubject = selected.subject?.toLowerCase().startsWith(subjectPrefix.toLowerCase())
      ? selected.subject
      : `${subjectPrefix}${selected.subject}`;

    if (mode === "reply") {
      openCompose?.({
        mode: "reply",
        to: senderAddress ? [senderAddress] : [],
        subject: normalizedSubject,
        body: buildReplyBody(detail, selected),
        threadId: selected.thread_id || detail?.thread_id || "",
        replyToGmailId: selected.id,
      });
      return;
    }

    if (mode === "replyAll") {
      openCompose?.({
        mode: "replyAll",
        to: senderAddress ? [senderAddress] : [],
        cc: selectedCcRecipients,
        subject: normalizedSubject,
        body: buildReplyBody(detail, selected),
        threadId: selected.thread_id || detail?.thread_id || "",
        replyToGmailId: selected.id,
      });
      return;
    }

    openCompose?.({
      mode: "forward",
      subject: normalizedSubject,
      body: buildForwardBody(detail, selected),
    });
  };

  const overviewStats = useMemo(
    () => [
      {
        label: "Total emails",
        value: emails.length,
        note: "Synced across connected Gmail folders",
      },
      {
        label: "Unread",
        value: emails.filter((email) => !email.isRead).length,
        note: "Messages still waiting on review",
      },
      {
        label: "Tasks detected",
        value: emails.filter((email) => email.hasTask).length,
        note: "Threads with extracted action items",
      },
      {
        label: "Attachments",
        value: emails.filter((email) => email.hasAttachment).length,
        note: "Emails carrying files or shared documents",
      },
    ],
    [emails]
  );

  const selectedMeta = useMemo(
    () => [
      {
        label: "From",
        value: selectedIdentity.email ? `${selectedIdentity.name} (${selectedIdentity.email})` : selectedIdentity.name,
      },
      {
        label: "To",
        value: selectedRecipient.email
          ? `${selectedRecipient.name} (${selectedRecipient.email})`
          : selectedRecipient.name || "Not available",
      },
      { label: "Date", value: detail?.date || selected?.time || "Not available" },
    ],
    [detail, selected, selectedIdentity, selectedRecipient]
  );

  const resetPreviewContext = useCallback(() => {
    setSelectedId(null);
    setDetail(null);
  }, []);

  const handleSelectEmail = useCallback(
    (email) => {
      setSelectedId(email.id);
      if (!email.isRead) {
        markEmailAsReadLocal(email.id);
      }
    },
    [markEmailAsReadLocal]
  );

  const downloadAttachment = async (attachment) => {
    if (!selectedId) return;
    const token = localStorage.getItem("access_token");
    const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
    const url = `${baseUrl}/api/gmail/attachment/${selectedId}/${attachment.attachment_id}/?filename=${encodeURIComponent(attachment.filename)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = attachment.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="inbox-page">
      <div className="inbox-page__hero">
        <div>
          <div className="inbox-page__eyebrow">Mail workspace</div>
          <h1 className="inbox-page__title">Inbox</h1>
          <p className="inbox-page__description">
            Review synced Gmail messages, filter by mailbox or intent, and move from triage to action without leaving
            one workspace.
          </p>
        </div>

        <div className="inbox-page__actions">
          <Button
            variant="outline"
            onClick={() => loadInbox({ showFeedback: true })}
            disabled={loading || syncing || analyzing || changingTrash || emptyingTrash}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
          <Button variant="outline" onClick={syncMailbox} disabled={syncing || loading || analyzing || changingTrash || emptyingTrash}>
            {syncing ? "Syncing..." : "Sync Gmail"}
          </Button>
          {mailbox === "trash" ? (
            <Button variant="destructive" onClick={emptyTrash} disabled={emptyingTrash || changingTrash || loading || syncing || analyzing}>
              <Trash2 className="mr-2 h-4 w-4" />
              {emptyingTrash ? "Emptying..." : "Empty Trash"}
            </Button>
          ) : null}
          <Button variant="hero-outline" onClick={runAiAnalysis} disabled={analyzing || syncing || loading || changingTrash || emptyingTrash}>
            {analyzing ? "Analyzing..." : "Run AI Analysis"}
          </Button>
        </div>
      </div>

      {error ? <div className="inbox-page__error">{error}</div> : null}
      {notice ? <div className="inbox-page__notice">{notice}</div> : null}
      {!error && status ? <div className="inbox-page__status">{status}</div> : null}

      <div className="inbox-page__stats">
        {overviewStats.map((item) => (
          <div key={item.label} className="inbox-page__stat-card">
            <div className="inbox-page__stat-label">{item.label}</div>
            <div className="inbox-page__stat-value">{item.value}</div>
            <div className="inbox-page__stat-note">{item.note}</div>
          </div>
        ))}
      </div>

      <div className="inbox-page__workspace">
        <aside className="inbox-page__sidebar">
          <div className="inbox-page__panel-head">
            <div>
              <div className="inbox-page__panel-title">Mailboxes</div>
              <div className="inbox-page__panel-copy">Switch between mailbox categories without leaving the inbox.</div>
            </div>
          </div>

          <div className="inbox-page__mailbox-list">
            {mailboxStats.map((item) => {
              const Icon = item.icon;
              const active = mailbox === item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setMailbox(item.key);
                    resetPreviewContext();
                  }}
                  className={cn("inbox-page__mailbox-button", active && "inbox-page__mailbox-button--active")}
                >
                  <span className="inbox-page__mailbox-icon">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="inbox-page__mailbox-meta">
                    <span className="inbox-page__mailbox-label">{item.label}</span>
                    <span className="inbox-page__mailbox-copy">{item.copy}</span>
                  </span>
                  <span className="inbox-page__mailbox-count">{item.count}</span>
                </button>
              );
            })}
          </div>

          <div className="inbox-page__sidebar-summary">
            Showing <strong>{filteredEmails.length}</strong> email{filteredEmails.length === 1 ? "" : "s"} in{" "}
            <strong>{activeMailbox?.label || "All Emails"}</strong>.
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setMailbox("all");
              setUrgency("All");
              setIntent("All");
              setProject("All");
              setDateFilter("All time");
              setQuery("");
              resetPreviewContext();
            }}
          >
            Clear Filters
          </Button>
        </aside>

        <section className="inbox-page__list-panel">
          <div className="inbox-page__panel-head">
            <div>
              <div className="inbox-page__panel-title">Smart inbox</div>
              <div className="inbox-page__panel-copy">
                Filter by urgency, intent, project, and date to focus the list before opening a thread.
              </div>
            </div>
            <div className="inbox-page__panel-badge">
              <Filter className="h-4 w-4" />
              MailMind filters
            </div>
          </div>

          <div className="inbox-page__toolbar">
            <label className="inbox-page__search">
              <Search className="h-4 w-4" />
              <input
                type="text"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  resetPreviewContext();
                }}
                placeholder="Search sender, subject, project, or intent"
                aria-label="Search inside inbox"
              />
            </label>

            <div className="inbox-page__filters">
              <FilterSelect
                label="Urgency"
                value={urgency}
                onChange={(value) => {
                  setUrgency(value);
                  resetPreviewContext();
                }}
                options={urgencyOptions}
              />
              <FilterSelect
                label="Intent"
                value={intent}
                onChange={(value) => {
                  setIntent(value);
                  resetPreviewContext();
                }}
                options={intentOptions}
              />
              <FilterSelect
                label="Project"
                value={project}
                onChange={(value) => {
                  setProject(value);
                  resetPreviewContext();
                }}
                options={projectOptions}
              />
              <FilterSelect
                label="Date"
                value={dateFilter}
                onChange={(value) => {
                  setDateFilter(value);
                  resetPreviewContext();
                }}
                options={dateOptions}
              />
            </div>
          </div>

          <div className="inbox-page__list-head">
            <div>
              <div className="inbox-page__list-title">{activeMailbox?.label || "All Emails"}</div>
              <div className="inbox-page__list-copy">
                {query.trim()
                  ? `Filtered by "${query.trim()}" with ${filteredEmails.length} matching result${filteredEmails.length === 1 ? "" : "s"}.`
                  : mailbox === "trash"
                    ? `${filteredEmails.length} email${filteredEmails.length === 1 ? "" : "s"} are currently in Trash.`
                    : `${filteredEmails.length} message${filteredEmails.length === 1 ? "" : "s"} match the current filters.`}
              </div>
            </div>
            <div className="inbox-page__list-pill">
              <Sparkles className="h-4 w-4" />
              {mailbox === "trash" ? "Restore or empty permanently" : "Sorted by priority"}
            </div>
          </div>

          <div className="inbox-page__email-list">
            {loading && filteredEmails.length === 0 ? (
              <div className="inbox-page__empty">
                <div className="inbox-page__empty-title">Loading inbox</div>
                <div className="inbox-page__empty-copy">MailMind is pulling the latest synced messages into this view.</div>
              </div>
            ) : null}

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
                isRead={email.isRead}
                priorityScore={email.priorityScore}
                onClick={() => handleSelectEmail(email)}
              />
            ))}

            {!loading && filteredEmails.length === 0 ? (
              <div className="inbox-page__empty">
                <div className="inbox-page__empty-title">
                  {mailbox === "trash" ? "Trash is empty" : "No messages match these filters"}
                </div>
                <div className="inbox-page__empty-copy">
                  {mailbox === "trash"
                    ? "Deleted emails will appear here until the user restores them or empties Trash permanently."
                    : "Try a broader mailbox, clear the filters, or sync Gmail again to refresh sent, draft, starred, archived, and trashed mail."}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="inbox-page__preview-panel">
          {selected ? (
            <div className="inbox-page__preview-card">
              <div className="inbox-page__preview-top">
                <div>
                  <div className="inbox-page__preview-kicker">Mail preview</div>
                  <h2 className="inbox-page__preview-title">{selected.subject}</h2>
                </div>
                <div className="inbox-page__preview-actions">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openReplyComposer("reply")}
                  >
                    <Reply className="mr-1.5 h-4 w-4" />
                    Reply
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openReplyComposer("replyAll")}>
                    <ReplyAll className="mr-1.5 h-4 w-4" />
                    Reply all
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openReplyComposer("forward")}>
                    <Forward className="mr-1.5 h-4 w-4" />
                    Forward
                  </Button>

                  {selectedIsTrashed ? (
                    <Button variant="outline" size="sm" onClick={restoreSelectedEmail} disabled={changingTrash || emptyingTrash}>
                      <Undo2 className="mr-1.5 h-4 w-4" />
                      {changingTrash ? "Restoring..." : "Restore"}
                    </Button>
                  ) : (
                    <Button variant="destructive" size="sm" onClick={moveSelectedToTrash} disabled={changingTrash || emptyingTrash}>
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      {changingTrash ? "Moving..." : "Delete"}
                    </Button>
                  )}
                </div>
              </div>

              <div className="inbox-page__preview-meta">
                <div className="inbox-page__sender">
                  <Avatar initials={selectedIdentity.name.slice(0, 2).toUpperCase()} className="h-10 w-10" />
                  <div>
                    <div className="inbox-page__sender-name">{selectedIdentity.name}</div>
                    <div className="inbox-page__sender-copy">{selectedIdentity.email || selected.time || "Recent email"}</div>
                  </div>
                </div>

                <div className="inbox-page__badge-row">
                  <Badge variant={selected.urgency === "High" ? "high" : selected.urgency === "Medium" ? "medium" : "low"}>
                    {selected.urgency} urgency
                  </Badge>
                  <Badge variant="muted">{selected.intent}</Badge>
                  {selectedProjectTag ? <Badge variant="accent">{selectedProjectTag}</Badge> : null}
                  {selectedIsTrashed ? <Badge variant="muted">Trash</Badge> : null}
                  {selected.hasTask ? (
                    <Badge variant="accent">
                      {selected.taskCount} task{selected.taskCount > 1 ? "s" : ""} detected
                    </Badge>
                  ) : null}
                  {selected.hasAttachment ? <Badge variant="accent">Attachment</Badge> : null}
                  {selected.priorityScore ? <Badge variant="accent">Priority {selected.priorityScore}</Badge> : null}
                </div>
              </div>

              <div className="inbox-page__detail-grid">
                {selectedMeta.map((item) => (
                  <div key={item.label} className="inbox-page__detail-box">
                    <div className="inbox-page__detail-label">{item.label}</div>
                    <div className="inbox-page__detail-value">{item.value}</div>
                  </div>
                ))}
              </div>

              <div className="inbox-page__content-section">
                <div className="inbox-page__section-title">Email</div>
                <div className="inbox-page__message-body">
                  {detail?.body_text ? (
                    <div className="whitespace-pre-wrap">{detail.body_text}</div>
                  ) : detail?.body_html ? (
                    <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(detail.body_html) }} />
                  ) : (
                    currentBody || "No body content available."
                  )}
                </div>
              </div>

              <div className="inbox-page__summary-card">
                <div className="inbox-page__section-title">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Mail summary
                </div>
                <div className="inbox-page__summary-copy">
                  {detail?.summary || "MailMind could not generate a summary for this email yet."}
                </div>
              </div>

              <div className="inbox-page__detail-grid inbox-page__detail-grid--secondary">
                <div className="inbox-page__detail-box">
                  <div className="inbox-page__detail-label">Mailbox status</div>
                  <div className="inbox-page__detail-value">{selected.isRead ? "Read" : "Unread"}</div>
                </div>
                <div className="inbox-page__detail-box">
                  <div className="inbox-page__detail-label">Attachments</div>
                  <div className="inbox-page__detail-value">
                    {detailAttachments.length ? `${detailAttachments.length} file${detailAttachments.length === 1 ? "" : "s"}` : "No attachments"}
                  </div>
                </div>
              </div>

              {detailAttachments.length ? (
                <div className="inbox-page__content-section">
                  <div className="inbox-page__section-title">
                    <Paperclip className="h-4 w-4 text-primary" />
                    Attachments
                  </div>
                  <div className="inbox-page__stack">
                    {detailAttachments.map((item) => (
                      <div key={item.attachment_id} className="inbox-page__attachment-row">
                        <div>
                          <div className="inbox-page__subcard-title">{item.filename}</div>
                          <div className="inbox-page__subcard-copy">
                            {item.mime_type} - {normalizeSize(item.size)}
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => downloadAttachment(item)}>
                          Download
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="inbox-page__tip">
                <Sparkles className="h-4 w-4" />
                MailMind keeps the email, a short summary, and related attachments together so inbox review feels faster and clearer.
              </div>
            </div>
          ) : (
            <div className="inbox-page__preview-empty">
              <div className="inbox-page__empty-title">Select a thread to preview</div>
              <div className="inbox-page__empty-copy">
                Choose an email from the list to open its body, summary, and attachments here.
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="inbox-page__extended">
        <div className="inbox-page__extended-shell">
          <div className="inbox-page__extended-grid">
            {inboxExperienceCards.map((item) => {
              const Icon = item.icon;

              return (
                <article key={item.title} className="inbox-page__extended-card">
                  <div className="inbox-page__extended-icon">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="inbox-page__extended-card-title">{item.title}</h3>
                  <p className="inbox-page__extended-card-copy">{item.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
