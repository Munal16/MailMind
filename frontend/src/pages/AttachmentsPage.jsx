import { useEffect, useMemo, useState } from "react";
import AttachmentCard from "../components/AttachmentCard";
import { Button } from "../components/ui/button";
import api from "../api/client";

function normalizeSize(bytes) {
  if (!bytes && bytes !== 0) return "Unknown";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function dateBucket(dateValue) {
  if (!dateValue) return "Unknown";
  const date = new Date(dateValue);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return "Today";
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDays <= 7) return "Last 7 days";
  if (diffDays <= 30) return "Last 30 days";
  return "Older";
}

export default function AttachmentsPage() {
  const [view, setView] = useState("grid");
  const [items, setItems] = useState([]);
  const [type, setType] = useState("All");
  const [project, setProject] = useState("All");
  const [date, setDate] = useState("All");
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setError("");
        const inboxRes = await api.get("/api/gmail/inbox/?limit=80");
        const emails = inboxRes.data.emails || [];
        const details = await Promise.all(
          emails.slice(0, 30).map(async (email) => {
            try {
              const res = await api.get(`/api/gmail/message/${email.gmail_id}/`);
              return { detail: res.data, email };
            } catch {
              return null;
            }
          })
        );

        const flat = [];
        details.filter(Boolean).forEach(({ detail, email }) => {
          (detail.attachments || []).forEach((attachment) => {
            flat.push({
              id: `${detail.gmail_id}-${attachment.attachment_id}`,
              emailId: detail.gmail_id,
              attachmentId: attachment.attachment_id,
              name: attachment.filename,
              sender: detail.from || email.sender || "Unknown",
              type:
                attachment.mime_type?.includes("pdf")
                  ? "pdf"
                  : attachment.mime_type?.includes("image")
                    ? "image"
                    : attachment.mime_type?.includes("word") || attachment.mime_type?.includes("doc")
                      ? "doc"
                      : "other",
              project: email.project_name || detail.project_name || null,
              size: normalizeSize(attachment.size),
              rawSize: attachment.size,
              date: detail.date || email.internal_date || "Recently",
              dateBucket: dateBucket(email.internal_date || detail.date),
            });
          });
        });

        setItems(flat);
      } catch (err) {
        setItems([]);
        setError(typeof err.response?.data === "string" ? err.response.data : JSON.stringify(err.response?.data || err.message));
      }
    };
    load();
  }, []);

  const projectOptions = useMemo(
    () => ["All", ...Array.from(new Set(items.map((item) => item.project).filter(Boolean)))],
    [items]
  );

  const displayItems = useMemo(
    () =>
      items.filter((item) => (type === "All" ? true : item.type === type.toLowerCase()))
        .filter((item) => (project === "All" ? true : item.project === project))
        .filter((item) => (date === "All" ? true : item.dateBucket === date)),
    [date, items, project, type]
  );

  const download = async (item) => {
    const token = localStorage.getItem("access_token");
    const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
    const url = `${baseUrl}/api/gmail/attachment/${item.emailId}/${item.attachmentId}/?filename=${encodeURIComponent(item.name)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const aTag = document.createElement("a");
    aTag.href = URL.createObjectURL(blob);
    aTag.download = item.name;
    document.body.appendChild(aTag);
    aTag.click();
    aTag.remove();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Attachments</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Review files by type, project group, and date to support the attachment organizer described in MailMind.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-1">
            <Button variant={view === "grid" ? "default" : "ghost"} size="sm" onClick={() => setView("grid")}>
              Grid
            </Button>
            <Button variant={view === "table" ? "default" : "ghost"} size="sm" onClick={() => setView("table")}>
              List
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <select value={type} onChange={(e) => setType(e.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          {["All", "pdf", "doc", "image", "other"].map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
        <select value={project} onChange={(e) => setProject(e.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          {projectOptions.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
        <select value={date} onChange={(e) => setDate(e.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          {["All", "Today", "Last 7 days", "Last 30 days", "Older", "Unknown"].map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      {view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {displayItems.map((item) => (
            <AttachmentCard key={item.id} {...item} onDownload={() => download(item)} />
          ))}
          {!displayItems.length ? (
            <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-card">
              No attachments match the current filters.
            </div>
          ) : null}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <div className="grid grid-cols-[2fr_1fr_1fr_auto_auto] gap-4 border-b border-border px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <div>Name</div>
            <div>Sender</div>
            <div>Project</div>
            <div>Type</div>
            <div>Date</div>
          </div>
          {displayItems.length ? (
            displayItems.map((item) => (
              <div key={item.id} className="grid grid-cols-[2fr_1fr_1fr_auto_auto] gap-4 border-b border-border px-6 py-4 text-sm transition hover:bg-accent/30">
                <div className="font-medium text-card-foreground">{item.name}</div>
                <div className="text-muted-foreground">{item.sender}</div>
                <div className="text-muted-foreground">{item.project || "Unassigned"}</div>
                <div className="text-muted-foreground">{item.type}</div>
                <div className="text-muted-foreground">{item.dateBucket}</div>
              </div>
            ))
          ) : (
            <div className="px-6 py-8 text-sm text-muted-foreground">No attachments match the current filters.</div>
          )}
        </div>
      )}
    </div>
  );
}
