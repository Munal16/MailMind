import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CalendarClock,
  Filter,
  LoaderCircle,
  Mail,
  RefreshCw,
  Sparkles,
  User2,
} from "lucide-react";
import api from "../api/client";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";
import "./TasksExtracted.css";

const columnMeta = {
  Pending: {
    key: "Pending",
    title: "Pending",
    copy: "Action items waiting to be picked up.",
    tone: "warning",
  },
  "In Progress": {
    key: "In Progress",
    title: "In Progress",
    copy: "Tasks that already have movement and still need follow-through.",
    tone: "primary",
  },
  Completed: {
    key: "Completed",
    title: "Completed",
    copy: "Finished work kept for clarity and record keeping.",
    tone: "success",
  },
};

function cleanTextBlock(value, maxLength = 220) {
  const text = String(value || "")
    .replace(/\r|\n|\t/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[*\u2022\-\s]+/, "")
    .trim();

  if (!text) return "";
  if (text.length <= maxLength) return text;

  const trimmed = text.slice(0, maxLength).trim();
  const fallback = trimmed.slice(0, Math.max(trimmed.lastIndexOf(" "), 0)) || trimmed;
  return `${fallback}...`;
}

function confidenceLabel(score) {
  const value = Number(score || 0);
  if (value >= 0.85) return "High confidence";
  if (value >= 0.65) return "Medium confidence";
  return "Low confidence";
}

function normalizeTask(task) {
  const confidence = Number(task.confidence || 0);

  return {
    id: task.id,
    gmailId: task.gmail_id,
    taskText: cleanTextBlock(task.task_text, 240),
    status: task.status || "Pending",
    deadline: cleanTextBlock(task.deadline || "", 90),
    responsibility: cleanTextBlock(task.responsibility || "", 90),
    projectName: cleanTextBlock(task.project_name || "", 48),
    emailSubject: cleanTextBlock(task.email_subject || "(no subject)", 140),
    emailSender: cleanTextBlock(task.email_sender || "Unknown sender", 100),
    confidence,
    confidencePercent: Math.round(confidence * 100),
    confidenceLabel: confidenceLabel(confidence),
    priorityKey: confidence >= 0.85 ? "high" : confidence >= 0.65 ? "medium" : "low",
  };
}

function TaskCard({ task, focused, onOpenInbox }) {
  return (
    <article className={cn("tasks-page__task-card", focused && "tasks-page__task-card--focused")}>
      <div className="tasks-page__task-top">
        <div className="tasks-page__task-tags">
          <span className={`tasks-page__badge tasks-page__badge--${task.priorityKey}`}>{task.confidenceLabel}</span>
          {task.projectName ? <span className="tasks-page__badge tasks-page__badge--project">{task.projectName}</span> : null}
        </div>
        <span className="tasks-page__confidence">{task.confidencePercent}%</span>
      </div>

      <h3 className="tasks-page__task-title">{task.taskText}</h3>

      <div className="tasks-page__task-context">
        <div className="tasks-page__task-source">
          <Mail className="h-4 w-4" />
          <span>{task.emailSubject}</span>
        </div>
        <div className="tasks-page__task-source tasks-page__task-source--muted">
          <span>{task.emailSender}</span>
        </div>
      </div>

      <div className="tasks-page__task-meta">
        <div className="tasks-page__task-meta-item">
          <CalendarClock className="h-4 w-4" />
          <div>
            <div className="tasks-page__meta-label">Deadline</div>
            <div className="tasks-page__meta-value">{task.deadline || "Not detected"}</div>
          </div>
        </div>

        <div className="tasks-page__task-meta-item">
          <User2 className="h-4 w-4" />
          <div>
            <div className="tasks-page__meta-label">Responsibility</div>
            <div className="tasks-page__meta-value">{task.responsibility || "Not assigned"}</div>
          </div>
        </div>
      </div>

      <div className="tasks-page__task-actions">
        <button type="button" className="tasks-page__task-link" onClick={() => onOpenInbox(task.gmailId)}>
          Open in Inbox
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

function EmptyColumn({ title }) {
  return (
    <div className="tasks-page__empty-column">
      <div className="tasks-page__empty-title">No tasks in {title}</div>
      <div className="tasks-page__empty-copy">MailMind will place extracted actions here when they match the current filters.</div>
    </div>
  );
}

export default function TasksExtracted() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [searchText, setSearchText] = useState(searchParams.get("q") || "");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [projectFilter, setProjectFilter] = useState("All");

  const focusedTaskId = searchParams.get("task");

  const loadTasks = useCallback(async (showRefreshState = false) => {
    try {
      setError("");
      if (showRefreshState) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const res = await api.get("/api/ai/tasks/");
      setTasks((res.data.tasks || []).map(normalizeTask));
    } catch (err) {
      setTasks([]);
      setError(typeof err.response?.data === "string" ? err.response.data : JSON.stringify(err.response?.data || err.message));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    setSearchText(searchParams.get("q") || "");
  }, [searchParams]);

  const projectOptions = useMemo(() => {
    const values = Array.from(new Set(tasks.map((task) => task.projectName).filter(Boolean)));
    values.sort((a, b) => a.localeCompare(b));
    return values;
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesSearch =
        !normalizedSearch ||
        `${task.taskText} ${task.emailSubject} ${task.emailSender} ${task.deadline} ${task.responsibility} ${task.projectName}`
          .toLowerCase()
          .includes(normalizedSearch);

      const matchesStatus = statusFilter === "All" || task.status === statusFilter;
      const matchesPriority = priorityFilter === "All" || task.priorityKey === priorityFilter.toLowerCase();
      const matchesOwner =
        ownerFilter === "All" ||
        (ownerFilter === "Assigned" && Boolean(task.responsibility)) ||
        (ownerFilter === "Unassigned" && !task.responsibility);
      const matchesProject = projectFilter === "All" || task.projectName === projectFilter;

      return matchesSearch && matchesStatus && matchesPriority && matchesOwner && matchesProject;
    });
  }, [ownerFilter, priorityFilter, projectFilter, searchText, statusFilter, tasks]);

  const groupedTasks = useMemo(
    () => ({
      Pending: filteredTasks.filter((task) => task.status === "Pending"),
      "In Progress": filteredTasks.filter((task) => task.status === "In Progress"),
      Completed: filteredTasks.filter((task) => task.status === "Completed"),
    }),
    [filteredTasks]
  );

  const stats = useMemo(() => {
    const total = tasks.length;
    const deadlineCount = tasks.filter((task) => Boolean(task.deadline)).length;
    const assignedCount = tasks.filter((task) => Boolean(task.responsibility)).length;
    const projectCount = new Set(tasks.map((task) => task.projectName).filter(Boolean)).size;

    return [
      {
        label: "Total tasks",
        value: total,
        note: "Action items pulled from synced email content.",
      },
      {
        label: "Deadline cues",
        value: deadlineCount,
        note: "Tasks where MailMind detected timing language.",
      },
      {
        label: "Owner cues",
        value: assignedCount,
        note: "Tasks with responsibility or assignment signals.",
      },
      {
        label: "Projects covered",
        value: projectCount,
        note: "Project groups connected to extracted work.",
      },
    ];
  }, [tasks]);

  const hasActiveFilters =
    searchText.trim() || statusFilter !== "All" || priorityFilter !== "All" || ownerFilter !== "All" || projectFilter !== "All";

  const clearFilters = () => {
    setSearchText("");
    setStatusFilter("All");
    setPriorityFilter("All");
    setOwnerFilter("All");
    setProjectFilter("All");
  };

  const openInbox = useCallback(
    (gmailId) => {
      navigate(`/app/inbox?email=${encodeURIComponent(gmailId)}`);
    },
    [navigate]
  );

  return (
    <div className="tasks-page">
      <section className="tasks-page__hero">
        <div>
          <div className="tasks-page__eyebrow">Task workspace</div>
          <h1 className="tasks-page__title">Tasks Extracted</h1>
          <p className="tasks-page__description">
            Review actions pulled from emails, keep an eye on deadlines and ownership, and move from inbox triage to follow-up without losing context.
          </p>
        </div>

        <div className="tasks-page__actions">
          {hasActiveFilters ? (
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => void loadTasks(true)} disabled={refreshing || loading}>
            {refreshing ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </section>

      {error ? <div className="tasks-page__message tasks-page__message--error">{error}</div> : null}

      <section className="tasks-page__stats">
        {stats.map((card) => (
          <article key={card.label} className="tasks-page__stat-card">
            <div className="tasks-page__stat-label">{card.label}</div>
            <div className="tasks-page__stat-value">{card.value}</div>
            <div className="tasks-page__stat-note">{card.note}</div>
          </article>
        ))}
      </section>

      <section className="tasks-page__filters-card">
        <div className="tasks-page__filters-head">
          <div>
            <div className="tasks-page__section-title">Task filters</div>
            <div className="tasks-page__section-copy">Search and focus the task queue by status, confidence, ownership, or project grouping.</div>
          </div>
          <div className="tasks-page__pill">
            <Filter className="h-4 w-4" />
            {filteredTasks.length} visible tasks
          </div>
        </div>

        <div className="tasks-page__filters-grid">
          <label className="tasks-page__search">
            <span className="sr-only">Search tasks</span>
            <Sparkles className="h-4 w-4" />
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search task text, sender, subject, deadline, or project"
            />
          </label>

          <label className="tasks-page__select-field">
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="All">All statuses</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
          </label>

          <label className="tasks-page__select-field">
            <span>Confidence</span>
            <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
              <option value="All">All confidence levels</option>
              <option value="High">High confidence</option>
              <option value="Medium">Medium confidence</option>
              <option value="Low">Low confidence</option>
            </select>
          </label>

          <label className="tasks-page__select-field">
            <span>Ownership</span>
            <select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
              <option value="All">All responsibility states</option>
              <option value="Assigned">Assigned</option>
              <option value="Unassigned">Unassigned</option>
            </select>
          </label>

          <label className="tasks-page__select-field">
            <span>Project</span>
            <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
              <option value="All">All projects</option>
              {projectOptions.map((project) => (
                <option key={project} value={project}>
                  {project}
                </option>
              ))}
            </select>
          </label>
        </div>

        {searchParams.get("q") ? (
          <div className="tasks-page__message tasks-page__message--info">
            Showing task matches for <strong>{searchParams.get("q")}</strong>
            {focusedTaskId ? " and highlighting the selected result." : "."}
          </div>
        ) : null}
      </section>

      {loading ? (
        <div className="tasks-page__loading">Loading extracted tasks...</div>
      ) : (
        <section className="tasks-page__workspace">
          <div className="tasks-page__workspace-head">
            <div>
              <div className="tasks-page__section-title">Task board</div>
              <div className="tasks-page__section-copy">
                Clean sections keep new actions, active work, and completed follow-ups easy to scan without burying the user in inbox noise.
              </div>
            </div>
            <div className="tasks-page__pill">
              <Sparkles className="h-4 w-4" />
              {filteredTasks.length} tasks in view
            </div>
          </div>

          <div className="tasks-page__sections">
            {Object.values(columnMeta).map((column) => (
              <article key={column.key} className="tasks-page__status-section">
                <div className="tasks-page__status-head">
                  <div>
                    <div className="tasks-page__section-title">{column.title}</div>
                    <div className="tasks-page__section-copy">{column.copy}</div>
                  </div>
                  <span className={`tasks-page__column-count tasks-page__column-count--${column.tone}`}>{groupedTasks[column.key].length}</span>
                </div>

                <div className="tasks-page__task-grid">
                  {groupedTasks[column.key].length ? (
                    groupedTasks[column.key].map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        focused={String(task.id) === String(focusedTaskId)}
                        onOpenInbox={openInbox}
                      />
                    ))
                  ) : (
                    <EmptyColumn title={column.title} />
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="tasks-page__footer-note">
        <div className="tasks-page__footer-title">How MailMind builds this page</div>
        <div className="tasks-page__footer-copy">
          Tasks are extracted from synced email content, then enriched with deadline and responsibility cues so the workspace stays readable without forcing users to open every message first.
        </div>
      </section>
    </div>
  );
}
