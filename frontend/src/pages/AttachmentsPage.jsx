import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowUpRight,
  FileText,
  FolderKanban,
  Grid2X2,
  Image,
  Paperclip,
  RefreshCw,
  Rows3,
  Search,
  Sparkles,
} from "lucide-react";
import AttachmentCard from "../components/AttachmentCard";
import { Button } from "../components/ui/button";
import api from "../api/client";
import "./AttachmentsPage.css";

const typeOptions = [
  { value: "All", label: "All file types" },
  { value: "pdf", label: "PDF" },
  { value: "doc", label: "Documents" },
  { value: "image", label: "Images" },
  { value: "spreadsheet", label: "Spreadsheets" },
  { value: "presentation", label: "Presentations" },
  { value: "text", label: "Text files" },
  { value: "archive", label: "Archives" },
  { value: "audio", label: "Audio" },
  { value: "video", label: "Video" },
  { value: "other", label: "Other" },
];

const dateOptions = [
  { value: "All", label: "Any time" },
  { value: "Today", label: "Today" },
  { value: "Last 7 days", label: "Last 7 days" },
  { value: "Last 30 days", label: "Last 30 days" },
  { value: "Older", label: "Older" },
  { value: "Unknown", label: "Unknown" },
];

const sortOptions = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "largest", label: "Largest files" },
  { value: "smallest", label: "Smallest files" },
  { value: "name", label: "File name A-Z" },
];

function normalizeSize(bytes) {
  if (!bytes && bytes !== 0) return "Unknown";
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
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

function formatDateLabel(dateValue) {
  if (!dateValue) return "Unknown date";
  return new Date(dateValue).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatAttachmentError(err) {
  if (typeof err?.response?.data === "string") return err.response.data;
  if (err?.response?.data?.error) return err.response.data.error;
  if (err?.response?.data?.message) return err.response.data.message;
  return "MailMind could not load attachments right now.";
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="attachments-page__field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function AttachmentsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [view, setView] = useState("grid");
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ total: 0, images: 0, documents: 0, other: 0, total_size: 0 });
  const [typeCounts, setTypeCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState("All");
  const [project, setProject] = useState("All");
  const [date, setDate] = useState("All");
  const [sortBy, setSortBy] = useState("newest");
  const [error, setError] = useState("");

  const loadAttachments = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const res = await api.get("/api/gmail/attachments/?limit=220");
      const records = (res.data.items || []).map((item) => ({
        ...item,
        project: item.project_name || null,
        sizeLabel: normalizeSize(item.size),
        dateLabel: formatDateLabel(item.internal_date),
        dateBucket: dateBucket(item.internal_date),
      }));

      setItems(records);
      setStats(res.data.stats || { total: records.length, images: 0, documents: 0, other: 0, total_size: 0 });
      setTypeCounts(res.data.type_counts || {});
    } catch (err) {
      setItems([]);
      setTypeCounts({});
      setStats({ total: 0, images: 0, documents: 0, other: 0, total_size: 0 });
      setError(formatAttachmentError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    void loadAttachments();
  }, [loadAttachments]);

  const projectOptions = useMemo(
    () => [
      { value: "All", label: "All projects" },
      ...Array.from(new Set(items.map((item) => item.project).filter(Boolean))).map((item) => ({
        value: item,
        label: item,
      })),
    ],
    [items]
  );

  const displayItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = items
      .filter((item) => (type === "All" ? true : item.type === type))
      .filter((item) => (project === "All" ? true : item.project === project))
      .filter((item) => (date === "All" ? true : item.dateBucket === date))
      .filter((item) =>
        !normalizedQuery
          ? true
          : `${item.heading} ${item.name} ${item.sender || ""} ${item.email_subject || ""} ${item.project || ""} ${item.type}`
              .toLowerCase()
              .includes(normalizedQuery)
      );

    return filtered.sort((left, right) => {
      if (sortBy === "largest") return (right.size || 0) - (left.size || 0);
      if (sortBy === "smallest") return (left.size || 0) - (right.size || 0);
      if (sortBy === "name") return String(left.heading || left.name).localeCompare(String(right.heading || right.name));
      if (sortBy === "oldest") return new Date(left.internal_date || 0) - new Date(right.internal_date || 0);
      return new Date(right.internal_date || 0) - new Date(left.internal_date || 0);
    });
  }, [date, items, project, query, sortBy, type]);

  const overview = useMemo(() => {
    const projectCount = new Set(items.map((item) => item.project).filter(Boolean)).size;
    const recentItem = [...items].sort((a, b) => new Date(b.internal_date || 0) - new Date(a.internal_date || 0))[0];
    const dominantTypeEntry =
      Object.entries(typeCounts).sort((left, right) => right[1] - left[1])[0] || [];
    const dominantType = dominantTypeEntry[0] || "other";
    const dominantTypeCount = dominantTypeEntry[1] || 0;

    return {
      projectCount,
      recentDate: recentItem?.dateLabel || "No files yet",
      dominantType,
      dominantTypeCount,
    };
  }, [items, typeCounts]);

  const download = async (item) => {
    const token = localStorage.getItem("access_token");
    const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
    const url = `${baseUrl}/api/gmail/attachment/${item.gmail_id}/${item.attachment_id}/?filename=${encodeURIComponent(item.name)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = item.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  return (
    <div className="attachments-page">
      <section className="attachments-page__hero">
        <div>
          <div className="attachments-page__eyebrow">File workspace</div>
          <h1 className="attachments-page__title">Attachments</h1>
          <p className="attachments-page__description">
            Review synced files in one place, move from the file back to the source email, and keep documents, images, and shared assets easy to find.
          </p>
        </div>

        <div className="attachments-page__hero-actions">
          <div className="attachments-page__view-toggle">
            <button
              type="button"
              className={view === "grid" ? "attachments-page__view-toggle-btn attachments-page__view-toggle-btn--active" : "attachments-page__view-toggle-btn"}
              onClick={() => setView("grid")}
            >
              <Grid2X2 className="h-4 w-4" />
              Grid
            </button>
            <button
              type="button"
              className={view === "table" ? "attachments-page__view-toggle-btn attachments-page__view-toggle-btn--active" : "attachments-page__view-toggle-btn"}
              onClick={() => setView("table")}
            >
              <Rows3 className="h-4 w-4" />
              List
            </button>
          </div>

          <Button variant="outline" onClick={loadAttachments} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </section>

      {error ? <div className="attachments-page__error">{error}</div> : null}

      <section className="attachments-page__stats">
        <article className="attachments-page__stat-card">
          <div className="attachments-page__stat-icon attachments-page__stat-icon--primary">
            <Paperclip className="h-5 w-5" />
          </div>
          <div>
            <div className="attachments-page__stat-label">Total files</div>
            <div className="attachments-page__stat-value">{stats.total}</div>
            <div className="attachments-page__stat-note">All synced attachments from connected Gmail</div>
          </div>
        </article>

        <article className="attachments-page__stat-card">
          <div className="attachments-page__stat-icon attachments-page__stat-icon--urgent">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="attachments-page__stat-label">Documents</div>
            <div className="attachments-page__stat-value">{stats.documents}</div>
            <div className="attachments-page__stat-note">PDFs, docs, sheets, presentations, and text files</div>
          </div>
        </article>

        <article className="attachments-page__stat-card">
          <div className="attachments-page__stat-icon attachments-page__stat-icon--success">
            <Image className="h-5 w-5" />
          </div>
          <div>
            <div className="attachments-page__stat-label">Images</div>
            <div className="attachments-page__stat-value">{stats.images}</div>
            <div className="attachments-page__stat-note">Shared screenshots, photos, diagrams, and visual assets</div>
          </div>
        </article>

        <article className="attachments-page__stat-card">
          <div className="attachments-page__stat-icon attachments-page__stat-icon--warning">
            <FolderKanban className="h-5 w-5" />
          </div>
          <div>
            <div className="attachments-page__stat-label">Projects covered</div>
            <div className="attachments-page__stat-value">{overview.projectCount}</div>
            <div className="attachments-page__stat-note">Detected project threads with at least one file</div>
          </div>
        </article>
      </section>

      <section className="attachments-page__overview">
        <div className="attachments-page__overview-copy">
          <div className="attachments-page__section-title">MailMind attachment flow</div>
          <p className="attachments-page__section-copy">
            Attachments are grouped by file type, project, and recency so customers can move between documents and source emails without losing context.
          </p>
        </div>

        <div className="attachments-page__overview-pills">
          <div className="attachments-page__pill">
            <Sparkles className="h-4 w-4" />
            Dominant type: {String(overview.dominantType || "other").replace(/^\w/, (char) => char.toUpperCase())} ({overview.dominantTypeCount})
          </div>
          <div className="attachments-page__pill">Latest file: {overview.recentDate}</div>
          <div className="attachments-page__pill">Stored size: {normalizeSize(stats.total_size || 0)}</div>
        </div>
      </section>

      <section className="attachments-page__filters">
        <div className="attachments-page__filters-head">
          <div>
            <div className="attachments-page__section-title">Find the right file quickly</div>
            <div className="attachments-page__section-copy">
              Filter by file type, project, date, or sort order. Open the source email whenever you need the full conversation.
            </div>
          </div>

          {initialQuery ? (
            <div className="attachments-page__query-note">
              Showing attachment matches for <strong>"{initialQuery}"</strong>
            </div>
          ) : null}
        </div>

        <div className="attachments-page__filter-grid">
          <label className="attachments-page__search-field">
            <span>Search</span>
            <div className="attachments-page__search-control">
              <Search className="h-4 w-4" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search file name, heading, sender, or source email"
              />
            </div>
          </label>

          <FilterSelect label="File type" value={type} onChange={setType} options={typeOptions} />
          <FilterSelect label="Project" value={project} onChange={setProject} options={projectOptions} />
          <FilterSelect label="Date" value={date} onChange={setDate} options={dateOptions} />
          <FilterSelect label="Sort" value={sortBy} onChange={setSortBy} options={sortOptions} />
        </div>
      </section>

      <section className="attachments-page__workspace">
        <div className="attachments-page__workspace-head">
          <div>
            <div className="attachments-page__section-title">Current files</div>
            <div className="attachments-page__section-copy">
              {displayItems.length} file{displayItems.length === 1 ? "" : "s"} match the current filters.
            </div>
          </div>
        </div>

        {view === "grid" ? (
          <div className="attachments-page__grid">
            {displayItems.map((item) => (
              <AttachmentCard
                key={item.id}
                heading={item.heading}
                name={item.name}
                sender={item.sender}
                type={item.type}
                extension={item.extension}
                size={item.sizeLabel}
                dateLabel={item.dateLabel}
                project={item.project}
                emailSubject={item.email_subject}
                onDownload={() => download(item)}
                onOpen={() => navigate(`/app/inbox?email=${encodeURIComponent(item.gmail_id)}`)}
              />
            ))}
          </div>
        ) : (
          <div className="attachments-page__table">
            <div className="attachments-page__table-head">
              <div>Attachment</div>
              <div>Source</div>
              <div>Project</div>
              <div>Type</div>
              <div>Size</div>
              <div>Date</div>
              <div>Actions</div>
            </div>

            {displayItems.map((item) => (
              <div key={item.id} className="attachments-page__table-row">
                <div className="attachments-page__table-main">
                  <div className="attachments-page__table-title">{item.heading}</div>
                  <div className="attachments-page__table-subtitle">{item.name}</div>
                </div>
                <div className="attachments-page__table-secondary">{item.email_subject || item.sender || "Unknown source"}</div>
                <div className="attachments-page__table-secondary">{item.project || "Unassigned"}</div>
                <div className="attachments-page__table-secondary">{item.type}</div>
                <div className="attachments-page__table-secondary">{item.sizeLabel}</div>
                <div className="attachments-page__table-secondary">{item.dateLabel}</div>
                <div className="attachments-page__table-actions">
                  <button type="button" onClick={() => navigate(`/app/inbox?email=${encodeURIComponent(item.gmail_id)}`)}>
                    Open
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => download(item)}>
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !displayItems.length ? (
          <div className="attachments-page__empty">
            <div className="attachments-page__empty-title">No attachments match the current filters</div>
            <div className="attachments-page__empty-copy">
              Try a broader file type, project, or date range, or refresh after syncing Gmail again.
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
