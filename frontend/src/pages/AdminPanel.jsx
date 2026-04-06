import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserCog,
  Users,
} from "lucide-react";
import { Button } from "../components/ui/button";
import api from "../api/client";
import { useConfirm } from "../context/ConfirmContext";
import "./AdminPanel.css";

const activityColors = {
  signups: "admin-page__chart-fill--signups",
  connections: "admin-page__chart-fill--connections",
  syncs: "admin-page__chart-fill--syncs",
  analyses: "admin-page__chart-fill--analyses",
};

const summaryIcons = {
  Users,
  "Connected Gmail": Mail,
  "Synced emails": Activity,
  "Tasks extracted": ShieldCheck,
};

function formatDate(value) {
  if (!value) return "No activity yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

function statusClass(status) {
  const normalized = String(status || "").toLowerCase();
  if (["healthy", "active", "ready"].includes(normalized)) {
    return "admin-page__status-pill admin-page__status-pill--ok";
  }
  return "admin-page__status-pill admin-page__status-pill--warn";
}

function formatAdminError(err) {
  if (typeof err?.response?.data === "string") return err.response.data;
  if (err?.response?.data?.detail) return err.response.data.detail;
  if (err?.response?.data?.error) return err.response.data.error;
  return "MailMind could not load the admin panel right now.";
}

export default function AdminPanel() {
  const confirm = useConfirm();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [searchText, setSearchText] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");

  const loadOverview = useCallback(async (showRefreshState = false) => {
    try {
      if (showRefreshState) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");
      const res = await api.get("/api/admin/overview/");
      setData(res.data);
    } catch (err) {
      setError(formatAdminError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const summaryCards = useMemo(() => {
    if (!data?.summary) return [];
    return [
      {
        label: "Users",
        value: data.summary.total_users,
        note: `${data.summary.admin_users} accounts currently have admin access`,
      },
      {
        label: "Connected Gmail",
        value: data.summary.gmail_connected_users,
        note: "Accounts ready for real inbox sync",
      },
      {
        label: "Synced emails",
        value: data.summary.total_emails,
        note: `${data.summary.total_predictions} already analyzed by MailMind`,
      },
      {
        label: "Tasks extracted",
        value: data.summary.total_tasks,
        note: `${data.summary.deadline_tasks} include deadline cues`,
      },
    ];
  }, [data]);

  const dailyActivityMax = useMemo(() => {
    const rows = data?.daily_activity || [];
    return Math.max(1, ...rows.flatMap((row) => [row.signups, row.connections, row.syncs, row.analyses]));
  }, [data]);

  const filteredUsers = useMemo(() => {
    const rows = data?.user_directory || [];
    const normalizedSearch = searchText.trim().toLowerCase();

    return rows.filter((user) => {
      const matchesSearch =
        !normalizedSearch ||
        `${user.username} ${user.email || ""}`.toLowerCase().includes(normalizedSearch);

      const matchesRole =
        roleFilter === "All" ||
        (roleFilter === "Admin" && user.is_staff) ||
        (roleFilter === "Standard" && !user.is_staff);

      return matchesSearch && matchesRole;
    });
  }, [data, roleFilter, searchText]);

  const handleAdminAccess = useCallback(
    async (user, nextValue) => {
      const action = nextValue ? "Grant admin access" : "Remove admin access";
      const desc = nextValue
        ? `${user.username} will gain full admin privileges inside MailMind.`
        : `${user.username} will lose admin access and return to a standard account.`;
      const ok = await confirm({
        title: `${action}?`,
        description: desc,
        confirmLabel: action,
        cancelLabel: "Cancel",
        variant: nextValue ? "default" : "warning",
      });
      if (!ok) return;

      try {
        setUpdatingUserId(user.id);
        setError("");
        setNotice("");
        const res = await api.post(`/api/admin/users/${user.id}/access/`, { is_staff: nextValue });
        setNotice(res.data.message || "Admin access updated successfully.");
        await loadOverview(true);
      } catch (err) {
        setError(formatAdminError(err));
      } finally {
        setUpdatingUserId(null);
      }
    },
    [loadOverview]
  );

  const adminUrl = `${import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"}/admin/`;

  return (
    <div className="admin-page">
      <section className="admin-page__hero">
        <div>
          <div className="admin-page__eyebrow">Admin side</div>
          <h1 className="admin-page__title">Admin Panel</h1>
          <p className="admin-page__description">
            Monitor MailMind health, manage admin access, review live activity, and keep the workspace stable during real deployment.
          </p>
        </div>

        <div className="admin-page__hero-actions">
          <Button variant="outline" onClick={() => void loadOverview(true)} disabled={refreshing || loading}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh diagnostics"}
          </Button>
          <Button variant="hero-outline" onClick={() => window.open(adminUrl, "_blank", "noopener,noreferrer")}>
            Open Django Admin
          </Button>
        </div>
      </section>

      {error ? <div className="admin-page__message admin-page__message--error">{error}</div> : null}
      {notice ? <div className="admin-page__message">{notice}</div> : null}
      {loading && !data ? <div className="admin-page__message">Loading admin diagnostics...</div> : null}

      {!loading && data ? (
        <>
          <section className="admin-page__stats">
            {summaryCards.map((card) => {
              const Icon = summaryIcons[card.label] || Sparkles;
              return (
                <article key={card.label} className="admin-page__stat-card">
                  <div className="admin-page__stat-icon">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="admin-page__stat-label">{card.label}</div>
                    <div className="admin-page__stat-value">{card.value}</div>
                    <div className="admin-page__stat-note">{card.note}</div>
                  </div>
                </article>
              );
            })}
          </section>

          <div className="admin-page__two-column admin-page__two-column--balanced">
            <section className="admin-page__section admin-page__section--spotlight">
              <div className="admin-page__section-headline">
                <div>
                  <div className="admin-page__section-title">Admin access control</div>
                  <div className="admin-page__section-copy">
                    Promote already-registered MailMind accounts into admin users directly from this panel. Superuser accounts stay protected.
                  </div>
                </div>
                <div className="admin-page__pill">
                  <UserCog className="h-4 w-4" />
                  {data.summary.admin_users} admin accounts
                </div>
              </div>

              <div className="admin-page__user-toolbar">
                <label className="admin-page__search">
                  <Search className="h-4 w-4" />
                  <input
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="Search by username or email"
                  />
                </label>

                <label className="admin-page__select-field">
                  <span>Role</span>
                  <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                    <option value="All">All users</option>
                    <option value="Admin">Admins only</option>
                    <option value="Standard">Standard users</option>
                  </select>
                </label>
              </div>

              <div className="admin-page__directory-summary">
                Showing {filteredUsers.length} {filteredUsers.length === 1 ? "account" : "accounts"} in this view.
              </div>

              <div className="admin-page__user-directory">
                {filteredUsers.length ? (
                  filteredUsers.map((user) => (
                    <article key={user.id} className="admin-page__directory-card">
                      <div className="admin-page__directory-head">
                        <div>
                          <div className="admin-page__directory-name">{user.username}</div>
                          <div className="admin-page__directory-email">{user.email || "No email on file"}</div>
                        </div>
                        <div className="admin-page__directory-badges">
                          <span className={user.is_superuser ? "admin-page__status-pill admin-page__status-pill--owner" : user.is_staff ? "admin-page__status-pill admin-page__status-pill--ok" : "admin-page__status-pill admin-page__status-pill--neutral"}>
                            {user.is_superuser ? "System owner" : user.is_staff ? "Admin access" : "Standard user"}
                          </span>
                          <span className={user.gmail_connected ? "admin-page__status-pill admin-page__status-pill--ok" : "admin-page__status-pill admin-page__status-pill--warn"}>
                            {user.gmail_connected ? "Gmail connected" : "Needs Gmail"}
                          </span>
                        </div>
                      </div>

                      <div className="admin-page__directory-meta">
                        <div className="admin-page__directory-metric">
                          <span>Joined</span>
                          <strong>{formatDate(user.joined_at)}</strong>
                        </div>
                        <div className="admin-page__directory-metric">
                          <span>Last login</span>
                          <strong>{formatDate(user.last_login)}</strong>
                        </div>
                        <div className="admin-page__directory-metric">
                          <span>Emails</span>
                          <strong>{user.mail_count}</strong>
                        </div>
                        <div className="admin-page__directory-metric">
                          <span>Tasks</span>
                          <strong>{user.task_count}</strong>
                        </div>
                      </div>

                      <div className="admin-page__directory-actions">
                        {user.can_manage_admin_access ? (
                          user.is_staff ? (
                            <Button
                              variant="outline"
                              onClick={() => void handleAdminAccess(user, false)}
                              disabled={updatingUserId === user.id}
                            >
                              {updatingUserId === user.id ? "Updating..." : "Remove admin access"}
                            </Button>
                          ) : (
                            <Button
                              variant="hero-outline"
                              onClick={() => void handleAdminAccess(user, true)}
                              disabled={updatingUserId === user.id}
                            >
                              {updatingUserId === user.id ? "Updating..." : "Grant admin access"}
                            </Button>
                          )
                        ) : (
                          <div className="admin-page__directory-note">
                            {user.is_current_user ? "Current session" : user.is_superuser ? "Managed from backend only" : "Access locked"}
                          </div>
                        )}
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="admin-page__empty">No accounts match the current search and role filters.</div>
                )}
              </div>
            </section>

            <section className="admin-page__section">
              <div className="admin-page__section-title">System health</div>

              <div className="admin-page__health-grid">
                {data.services.map((item) => (
                  <article key={item.id} className="admin-page__health-card">
                    <div className="admin-page__health-head">
                      <div className="admin-page__health-label">{item.label}</div>
                      <span className={statusClass(item.status)}>{item.status}</span>
                    </div>
                    <div className="admin-page__health-details">{item.details}</div>
                  </article>
                ))}
              </div>

              <div className="admin-page__kpi-band">
                <div className="admin-page__kpi-pill">
                  <div className="admin-page__kpi-pill-label">Connection rate</div>
                  <div className="admin-page__kpi-pill-value">{data.deployment_health.gmail_connection_rate}%</div>
                </div>
                <div className="admin-page__kpi-pill">
                  <div className="admin-page__kpi-pill-label">AI coverage</div>
                  <div className="admin-page__kpi-pill-value">{data.deployment_health.analysis_coverage}%</div>
                </div>
                <div className="admin-page__kpi-pill">
                  <div className="admin-page__kpi-pill-label">Task coverage</div>
                  <div className="admin-page__kpi-pill-value">{data.deployment_health.task_coverage}%</div>
                </div>
              </div>
            </section>
          </div>

          <div className="admin-page__two-column">
            <section className="admin-page__section">
              <div className="admin-page__section-title">Priority alerts</div>
              <div className="admin-page__section-copy">
                Admin-friendly warnings that help keep sync, analysis, and user onboarding stable.
              </div>

              {data.alerts.length ? (
                <div className="admin-page__alerts">
                  {data.alerts.map((alert) => (
                    <article key={alert.title} className="admin-page__alert-card">
                      <div className="admin-page__alert-head">
                        <div className="admin-page__alert-title">{alert.title}</div>
                        <span className="admin-page__tag admin-page__status-pill--warn">{alert.value}</span>
                      </div>
                      <div className="admin-page__alert-copy">{alert.details}</div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="admin-page__empty">No active admin alerts right now.</div>
              )}
            </section>

            <section className="admin-page__section">
              <div className="admin-page__section-title">AI model readiness</div>
              <div className="admin-page__section-copy">
                MailMind depends on these model assets being present so urgency, task extraction, and intent analysis stay available.
              </div>

              <div className="admin-page__model-grid">
                {data.models.map((item) => (
                  <article key={item.id} className="admin-page__model-card">
                    <div className="admin-page__health-head">
                      <div className="admin-page__model-label">{item.label}</div>
                      <span className={statusClass(item.status)}>{item.status}</span>
                    </div>
                    <div className="admin-page__model-copy">{item.details}</div>
                    <div className="admin-page__model-path">{item.path}</div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <div className="admin-page__two-column">
            <section className="admin-page__section">
              <div className="admin-page__section-title">Daily operations volume</div>
              <div className="admin-page__section-copy">
                A compact seven-day view of signups, Gmail connections, sync events, and AI analyses.
              </div>

              <div className="admin-page__chart-grid">
                {data.daily_activity.map((row) => (
                  <div key={row.date} className="admin-page__chart-row">
                    <div className="admin-page__chart-label">{row.label}</div>
                    <div className="admin-page__chart-bars">
                      {[
                        { key: "signups", label: "Signups", value: row.signups },
                        { key: "connections", label: "Connections", value: row.connections },
                        { key: "syncs", label: "Syncs", value: row.syncs },
                        { key: "analyses", label: "Analyses", value: row.analyses },
                      ].map((bar) => (
                        <div key={bar.key} className="admin-page__chart-bar">
                          <div className="admin-page__chart-bar-name">{bar.label}</div>
                          <div className="admin-page__chart-track">
                            <div className={`admin-page__chart-fill ${activityColors[bar.key]}`} style={{ width: `${(bar.value / dailyActivityMax) * 100}%` }} />
                          </div>
                          <div className="admin-page__chart-bar-value">{bar.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="admin-page__section">
              <div className="admin-page__section-title">Recent system activity</div>
              <div className="admin-page__section-copy">
                A lightweight operations feed built from real MailMind events: signups, Gmail connections, syncs, and AI analysis updates.
              </div>

              <div className="admin-page__activity-list">
                {data.recent_activity.map((item) => (
                  <article key={`${item.kind}-${item.timestamp}-${item.title}`} className="admin-page__activity-card">
                    <div className="admin-page__health-head">
                      <div className="admin-page__alert-title">{item.title}</div>
                      <span className="admin-page__tag admin-page__status-pill--ok">{item.kind}</span>
                    </div>
                    <div className="admin-page__activity-copy">{item.description}</div>
                    <div className="admin-page__activity-copy">{formatDate(item.timestamp)}</div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
