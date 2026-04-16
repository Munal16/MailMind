import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  ChevronRight,
  Eye,
  EyeOff,
  Mail,
  PencilLine,
  PlusCircle,
  RefreshCw,
  Shield,
  Trash2,
  Upload,
  User,
  Users,
  X,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import { Avatar } from "../components/ui/avatar";
import api from "../api/client";
import { useConfirm } from "../context/ConfirmContext";
import { finalizeSession, getCurrentSession, getSignedInSessions, switchMailMindSession } from "../api/auth";
import { getSessionAppRoute, removeSession } from "../api/sessionStore";
import "./Settings.css";

const tabs = [
  ["accounts", "Accounts", Users],
  ["profile", "Profile", User],
  ["emails", "Connected Email", Mail],
  ["notifications", "Notifications", Bell],
  ["security", "Security", Shield],
];

const notificationOptions = [
  ["urgent", "Urgent email alerts", "Surface high-priority emails quickly."],
  ["deadlines", "Deadline reminders", "Highlight tasks with time-sensitive cues."],
  ["digest", "Workspace digest", "Get a quick summary of unread mail and pending tasks."],
  ["attachments", "Attachment updates", "Show when new files arrive in synced email."],
];

const emptyPrefs = { urgent: true, deadlines: true, digest: false, attachments: true };

const initialsFor = (name) =>
  String(name || "MM")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const roleLabel = (session) => (session?.is_superuser ? "Superuser" : session?.is_staff ? "Admin" : "Standard user");

const formatError = (err, fallback) =>
  err?.response?.data?.message ||
  err?.response?.data?.error ||
  (typeof err?.response?.data === "string" ? err.response.data : fallback);

const formatTimestamp = (value) => {
  if (!value) return "No recent activity";
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

function PasswordField({ label, value, onChange, placeholder, visible, onToggle }) {
  return (
    <label className="settings-page__field">
      <span>{label}</span>
      <div className="settings-page__password-wrap">
        <Input
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="settings-page__password-input"
        />
        <button
          type="button"
          className="settings-page__password-toggle"
          onClick={onToggle}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );
}

export default function Settings() {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("accounts");
  const [profile, setProfile] = useState({
    username: "",
    email: "",
    job_title: "",
    profile_photo_url: null,
    connected_gmail_accounts: 0,
  });
  const [gmail, setGmail] = useState({
    connected: false,
    email_address: "",
    message: "",
    accounts: [],
    active_account_id: null,
    connected_accounts: 0,
  });
  const [sessions, setSessions] = useState([]);
  const [notifications, setNotifications] = useState(emptyPrefs);
  const [feed, setFeed] = useState([]);
  const [profileFile, setProfileFile] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [disconnectTarget, setDisconnectTarget] = useState(null);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [switchingSessionId, setSwitchingSessionId] = useState(null);
  const [removingSessionId, setRemovingSessionId] = useState(null);
  const [activatingGmailId, setActivatingGmailId] = useState(null);
  const [disconnectingGmailId, setDisconnectingGmailId] = useState(null);
  const [passwordVisibility, setPasswordVisibility] = useState({
    current: false,
    next: false,
    confirm: false,
    delete: false,
  });
  const [security, setSecurity] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    deletePassword: "",
    deleteConfirmation: "",
  });

  const syncLocalSessions = useCallback(() => {
    setSessions(getSignedInSessions());
  }, []);

  const activeSession = useMemo(() => {
    const current = getCurrentSession();
    if (!current) return null;
    return sessions.find((session) => String(session.id) === String(current.id)) || current;
  }, [sessions]);

  const activeSessionId = String(activeSession?.id || "");
  const previewUrl = useMemo(() => {
    if (profileFile) return URL.createObjectURL(profileFile);
    if (removePhoto) return null;
    return profile.profile_photo_url;
  }, [profile.profile_photo_url, profileFile, removePhoto]);

  useEffect(() => {
    return () => {
      if (profileFile && previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, profileFile]);

  const loadSettings = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      syncLocalSessions();
      const [meRes, gmailRes, notifRes] = await Promise.all([
        api.get("/api/users/me/"),
        api.get("/api/gmail/status/"),
        api.get("/api/users/notifications/"),
      ]);

      setProfile({
        username: meRes.data.username || "",
        email: meRes.data.email || "",
        job_title: meRes.data.job_title || "",
        profile_photo_url: meRes.data.profile_photo_url || null,
        connected_gmail_accounts: Number(meRes.data.connected_gmail_accounts || 0),
      });
      setNotifications(meRes.data.notification_preferences || emptyPrefs);
      setGmail({
        connected: Boolean(gmailRes.data.connected),
        email_address: gmailRes.data.email_address || "",
        message: gmailRes.data.message || "",
        accounts: gmailRes.data.accounts || [],
        active_account_id: gmailRes.data.active_account_id || null,
        connected_accounts: Number(gmailRes.data.connected_accounts || 0),
      });
      setFeed(notifRes.data.items || []);
      if (!silent) {
        setMessage({ type: "", text: "" });
      }
    } catch {
      setMessage({ type: "error", text: "MailMind could not load your settings right now." });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [syncLocalSessions]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const summaryCards = useMemo(
    () => [
      {
        label: "MailMind accounts",
        value: sessions.length,
        note: sessions.length > 1 ? "Multiple MailMind accounts are signed in on this device." : "One MailMind account is signed in on this device.",
      },
      {
        label: "Connected Gmail",
        value: gmail.connected_accounts,
        note: gmail.email_address || gmail.message || "Add more Gmail inboxes and switch the active sending account here.",
      },
      {
        label: "Current workspace",
        value: profile.username || "MailMind user",
        note: activeSession?.email || profile.email || "Current MailMind account",
      },
      {
        label: "Notification feed",
        value: feed.length,
        note: feed.length ? "Live alerts are available below." : "No new alerts right now.",
      },
    ],
    [activeSession?.email, feed.length, gmail.connected_accounts, gmail.email_address, gmail.message, profile.email, profile.username, sessions.length]
  );

  const connectedGmailAccounts = useMemo(
    () => (gmail.accounts || []).filter((account) => account.connected),
    [gmail.accounts]
  );

  const saveProfile = async () => {
    try {
      setSavingProfile(true);
      setMessage({ type: "", text: "" });

      const formData = new FormData();
      formData.append("username", profile.username.trim());
      formData.append("email", profile.email.trim());
      formData.append("job_title", profile.job_title.trim());
      formData.append("remove_photo", String(removePhoto));
      if (profileFile) {
        formData.append("profile_photo", profileFile);
      }

      const res = await api.patch("/api/users/me/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setProfile((current) => ({
        ...current,
        username: res.data.username || "",
        email: res.data.email || "",
        job_title: res.data.job_title || "",
        profile_photo_url: res.data.profile_photo_url || null,
        connected_gmail_accounts: Number(res.data.connected_gmail_accounts || current.connected_gmail_accounts || 0),
      }));
      setNotifications(res.data.notification_preferences || notifications);
      setProfileFile(null);
      setRemovePhoto(false);
      setEditingProfile(false);

      const currentSession = getCurrentSession();
      if (currentSession?.access && currentSession?.refresh) {
        finalizeSession(res.data, currentSession.access, currentSession.refresh);
        syncLocalSessions();
      }

      setMessage({ type: "success", text: "Profile updated successfully." });
    } catch (err) {
      setMessage({ type: "error", text: formatError(err, "Could not update your profile.") });
    } finally {
      setSavingProfile(false);
    }
  };

  const saveNotifications = async () => {
    try {
      setSavingNotifications(true);
      setMessage({ type: "", text: "" });

      const res = await api.patch("/api/users/me/", {
        notification_preferences: notifications,
      });

      setNotifications(res.data.notification_preferences || notifications);
      const notifRes = await api.get("/api/users/notifications/");
      setFeed(notifRes.data.items || []);
      setMessage({ type: "success", text: "Notification preferences saved." });
    } catch (err) {
      setMessage({ type: "error", text: formatError(err, "Could not update notification preferences.") });
    } finally {
      setSavingNotifications(false);
    }
  };

  const updatePassword = async () => {
    if (!security.currentPassword.trim()) {
      return setMessage({ type: "error", text: "Enter your current password." });
    }
    if (!security.newPassword.trim()) {
      return setMessage({ type: "error", text: "Enter a new password." });
    }
    if (security.newPassword !== security.confirmPassword) {
      return setMessage({ type: "error", text: "Your new passwords do not match." });
    }

    try {
      setSavingPassword(true);
      setMessage({ type: "", text: "" });
      await api.post("/api/users/change-password/", {
        current_password: security.currentPassword,
        new_password: security.newPassword,
      });
      setSecurity((prev) => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      }));
      setMessage({ type: "success", text: "Password updated successfully." });
    } catch (err) {
      const data = err?.response?.data;
      const fieldError =
        (Array.isArray(data?.current_password) ? data.current_password[0] : null) ||
        (Array.isArray(data?.new_password) ? data.new_password[0] : null) ||
        formatError(err, "Could not update your password.");
      setMessage({ type: "error", text: fieldError });
    } finally {
      setSavingPassword(false);
    }
  };

  const deleteAccount = async () => {
    const ok = await confirm({
      title: "Permanently delete your account?",
      description:
        "This cannot be undone. All your MailMind data, connected Gmail inboxes, and settings will be removed immediately.",
      confirmLabel: "Yes, delete my account",
      cancelLabel: "Cancel",
      variant: "danger",
    });
    if (!ok) return;

    try {
      setDeletingAccount(true);
      setMessage({ type: "", text: "" });
      await api.post("/api/users/delete-account/", {
        current_password: security.deletePassword,
        confirmation: security.deleteConfirmation,
      });
      window.location.href = "/";
    } catch (err) {
      const data = err?.response?.data;
      const fieldError =
        (Array.isArray(data?.current_password) ? data.current_password[0] : null) ||
        (Array.isArray(data?.confirmation) ? data.confirmation[0] : null) ||
        formatError(err, "Could not delete your account.");
      setMessage({ type: "error", text: fieldError });
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleSwitchSession = (session) => {
    const id = String(session.id);
    if (id === activeSessionId) return;

    try {
      setSwitchingSessionId(id);
      const nextSession = switchMailMindSession(id);
      if (!nextSession) {
        throw new Error("MailMind could not switch to that account.");
      }
      window.location.href = getSessionAppRoute(nextSession);
    } catch (err) {
      setSwitchingSessionId(null);
      setMessage({ type: "error", text: err.message || "MailMind could not switch accounts right now." });
    }
  };

  const handleRemoveSession = async (session) => {
    const id = String(session.id);
    if (id === activeSessionId) return;
    const label = session.username || session.email || "this account";
    const ok = await confirm({
      title: "Remove account?",
      description: `${label} will be removed from this device. You can sign in again at any time.`,
      confirmLabel: "Remove",
      cancelLabel: "Keep",
      variant: "warning",
    });
    if (!ok) return;

    setRemovingSessionId(id);
    removeSession(id);
    syncLocalSessions();
    setRemovingSessionId(null);
    setMessage({ type: "success", text: `${session.username || "Account"} removed from this device.` });
  };

  const activateGmailAccount = async (account) => {
    try {
      setActivatingGmailId(account.id);
      setMessage({ type: "", text: "" });
      const res = await api.post(`/api/gmail/accounts/${account.id}/activate/`);
      setMessage({ type: "success", text: res.data.message || "Active Gmail inbox updated." });
      await loadSettings({ silent: true });
    } catch (err) {
      setMessage({ type: "error", text: formatError(err, "MailMind could not switch Gmail accounts.") });
    } finally {
      setActivatingGmailId(null);
    }
  };

  const disconnectGmailAccount = async () => {
    if (!disconnectTarget) return;

    try {
      setDisconnectingGmailId(disconnectTarget.id);
      setMessage({ type: "", text: "" });
      const res = await api.post(`/api/gmail/accounts/${disconnectTarget.id}/disconnect/`);
      setDisconnectTarget(null);
      setMessage({ type: "success", text: res.data.message || "Gmail disconnected successfully." });
      await loadSettings({ silent: true });
    } catch (err) {
      setMessage({ type: "error", text: formatError(err, "Could not disconnect Gmail.") });
    } finally {
      setDisconnectingGmailId(null);
    }
  };

  const renderAccountsTab = () => (
    <section className="settings-page__section">
      <div className="settings-page__section-head">
        <div>
          <h2 className="settings-page__section-title">MailMind accounts on this device</h2>
          <p className="settings-page__section-copy">
            Stay signed in to more than one MailMind account, switch between them instantly, and add another account without logging out.
          </p>
        </div>
        <div className="settings-page__section-actions">
          <Button variant="outline" onClick={() => void loadSettings({ silent: true })} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="hero" onClick={() => navigate("/login?mode=add-account")}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add another account
          </Button>
        </div>
      </div>

      <div className="settings-page__accounts-grid">
        {sessions.map((session) => {
          const isActive = String(session.id) === activeSessionId;
          const isSwitching = String(switchingSessionId) === String(session.id);
          const isRemoving = String(removingSessionId) === String(session.id);

          return (
            <article
              key={session.id}
              className={`settings-page__session-card ${isActive ? "settings-page__session-card--active" : ""}`}
            >
              <div className="settings-page__session-head">
                <div className="settings-page__session-profile">
                  <Avatar
                    initials={initialsFor(session.username || session.email)}
                    src={session.profile_photo_url}
                    alt={session.username || session.email}
                    className="settings-page__session-avatar"
                  />
                  <div>
                    <div className="settings-page__session-name">{session.username || "MailMind user"}</div>
                    <div className="settings-page__session-email">{session.email || "No email saved"}</div>
                  </div>
                </div>
                <div className="settings-page__session-badges">
                  <span className={`settings-page__pill ${isActive ? "settings-page__pill--primary" : "settings-page__pill--muted"}`}>
                    {isActive ? "Current session" : "Signed in"}
                  </span>
                  <span className="settings-page__pill settings-page__pill--muted">{roleLabel(session)}</span>
                </div>
              </div>

              <div className="settings-page__session-meta">
                <div className="settings-page__session-meta-item">
                  <span>Last used</span>
                  <strong>{formatTimestamp(session.lastUsedAt)}</strong>
                </div>
                <div className="settings-page__session-meta-item">
                  <span>Job title</span>
                  <strong>{session.job_title || "Not set yet"}</strong>
                </div>
              </div>

              <div className="settings-page__section-actions settings-page__section-actions--end">
                {isActive ? (
                  <div className="settings-page__current-note">This is the account currently powering MailMind in this tab.</div>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => handleRemoveSession(session)} disabled={isRemoving || isSwitching}>
                      {isRemoving ? "Removing..." : "Remove from device"}
                    </Button>
                    <Button variant="hero" onClick={() => handleSwitchSession(session)} disabled={isRemoving || isSwitching}>
                      {isSwitching ? "Switching..." : "Switch account"}
                    </Button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );

  const renderProfileTab = () => (
    <section className="settings-page__section">
      <div className="settings-page__section-head">
        <div>
          <h2 className="settings-page__section-title">Profile details</h2>
          <p className="settings-page__section-copy">Keep your MailMind identity clean and easy to manage.</p>
        </div>
        {!editingProfile ? (
          <Button variant="hero" onClick={() => setEditingProfile(true)}>
            <PencilLine className="mr-2 h-4 w-4" />
            Edit profile
          </Button>
        ) : (
          <div className="settings-page__section-actions">
            <Button
              variant="outline"
              onClick={() => {
                setEditingProfile(false);
                setProfileFile(null);
                setRemovePhoto(false);
              }}
            >
              Cancel
            </Button>
            <Button variant="hero" onClick={saveProfile} disabled={savingProfile}>
              {savingProfile ? "Saving..." : "Save profile"}
            </Button>
          </div>
        )}
      </div>

      <div className="settings-page__profile-card">
        <div className="settings-page__profile-overview">
          <Avatar
            initials={initialsFor(profile.username || profile.email)}
            src={previewUrl}
            alt={profile.username || "MailMind user"}
            className="settings-page__avatar"
          />
          <div>
            <div className="settings-page__profile-name">{profile.username || "MailMind user"}</div>
            <div className="settings-page__profile-meta">{profile.email || "No email address saved"}</div>
            <div className="settings-page__profile-meta settings-page__profile-meta--connected">
              {connectedGmailAccounts.length
                ? `${connectedGmailAccounts.length} Gmail account${connectedGmailAccounts.length > 1 ? "s" : ""} connected`
                : "No Gmail accounts connected yet"}
            </div>
          </div>
        </div>

        {editingProfile ? (
          <div className="settings-page__profile-actions">
            <label className="settings-page__upload-btn">
              <Upload className="h-4 w-4" />
              Upload photo
              <input type="file" accept="image/*" hidden onChange={(event) => setProfileFile(event.target.files?.[0] || null)} />
            </label>
            <Button
              variant="outline"
              onClick={() => {
                setRemovePhoto(true);
                setProfileFile(null);
              }}
            >
              Remove photo
            </Button>
          </div>
        ) : null}
      </div>

      {editingProfile ? (
        <div className="settings-page__form-grid">
          <label className="settings-page__field">
            <span>Username</span>
            <Input value={profile.username} onChange={(event) => setProfile((current) => ({ ...current, username: event.target.value }))} placeholder="Your username" />
          </label>
          <label className="settings-page__field">
            <span>Email</span>
            <Input value={profile.email} onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))} placeholder="email@gmail.com" />
          </label>
          <label className="settings-page__field settings-page__field--full">
            <span>Job title</span>
            <Input value={profile.job_title} onChange={(event) => setProfile((current) => ({ ...current, job_title: event.target.value }))} placeholder="Your role or title" />
          </label>
        </div>
      ) : (
        <div className="settings-page__account-grid">
          <div className="settings-page__account-item">
            <div className="settings-page__account-label">Username</div>
            <div className="settings-page__account-value">{profile.username || "Not set"}</div>
          </div>
          <div className="settings-page__account-item">
            <div className="settings-page__account-label">Email</div>
            <div className="settings-page__account-value">{profile.email || "Not set"}</div>
          </div>
          <div className="settings-page__account-item">
            <div className="settings-page__account-label">Job title</div>
            <div className="settings-page__account-value">{profile.job_title || "Not added yet"}</div>
          </div>
          <div className="settings-page__account-item">
            <div className="settings-page__account-label">Connected Gmail</div>
            <div className="settings-page__account-value">
              {connectedGmailAccounts.length
                ? connectedGmailAccounts.map((account) => account.email_address).filter(Boolean).join(", ")
                : "No Gmail accounts connected yet"}
            </div>
          </div>
        </div>
      )}
    </section>
  );

  const renderEmailsTab = () => (
    <section className="settings-page__section">
      <div className="settings-page__section-head">
        <div>
          <h2 className="settings-page__section-title">Connected Gmail accounts</h2>
          <p className="settings-page__section-copy">
            Connect more than one Gmail inbox to the same MailMind account, choose which one MailMind should use by default, and disconnect any account cleanly.
          </p>
        </div>
        <div className="settings-page__section-actions">
          <Button variant="outline" onClick={() => void loadSettings({ silent: true })} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="hero" onClick={() => navigate("/connect-email")}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add another Gmail
          </Button>
        </div>
      </div>

      {gmail.accounts.length ? (
        <div className="settings-page__gmail-list">
          {gmail.accounts.map((account) => {
            const isActive = account.id === gmail.active_account_id;
            const isConnected = Boolean(account.connected);

            return (
              <article
                key={account.id}
                className={`settings-page__gmail-card ${isActive ? "settings-page__gmail-card--active" : ""}`}
              >
                <div className="settings-page__gmail-card-head">
                  <div>
                    <div className="settings-page__gmail-name">{account.display_name || account.email_address || "Connected Gmail"}</div>
                    <div className="settings-page__gmail-email">{account.email_address || "Email address not available yet"}</div>
                  </div>
                  <div className="settings-page__gmail-badges">
                    {isActive ? <span className="settings-page__pill settings-page__pill--primary">Active for MailMind</span> : null}
                    <span className={`settings-page__pill ${isConnected ? "settings-page__pill--success" : "settings-page__pill--warning"}`}>
                      {isConnected ? "Connected" : "Reconnect needed"}
                    </span>
                  </div>
                </div>

                <div className="settings-page__session-meta">
                  <div className="settings-page__session-meta-item">
                    <span>Connected</span>
                    <strong>{formatTimestamp(account.created_at)}</strong>
                  </div>
                  <div className="settings-page__session-meta-item">
                    <span>Last updated</span>
                    <strong>{formatTimestamp(account.updated_at)}</strong>
                  </div>
                </div>

                <div className="settings-page__section-actions settings-page__section-actions--end">
                  {!isActive && isConnected ? (
                    <Button
                      variant="outline"
                      onClick={() => activateGmailAccount(account)}
                      disabled={activatingGmailId === account.id}
                    >
                      {activatingGmailId === account.id ? "Switching..." : "Use for MailMind"}
                    </Button>
                  ) : null}
                  <Button
                    variant="destructive"
                    onClick={() => setDisconnectTarget(account)}
                    disabled={disconnectingGmailId === account.id}
                  >
                    Disconnect
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="settings-page__empty-note">
          No Gmail accounts are connected yet. Add your first Gmail inbox here to sync, search, send, and manage email from MailMind.
        </div>
      )}
    </section>
  );

  const renderNotificationsTab = () => (
    <section className="settings-page__section">
      <div className="settings-page__section-head">
        <div>
          <h2 className="settings-page__section-title">Notifications</h2>
          <p className="settings-page__section-copy">Choose which live updates MailMind should surface while you work.</p>
        </div>
        <Button variant="hero" onClick={saveNotifications} disabled={savingNotifications}>
          {savingNotifications ? "Saving..." : "Save preferences"}
        </Button>
      </div>

      <div className="settings-page__notification-grid">
        {notificationOptions.map(([key, title, description]) => (
          <div key={key} className="settings-page__notification-card">
            <div>
              <div className="settings-page__notification-title">{title}</div>
              <div className="settings-page__notification-copy">{description}</div>
            </div>
            <Switch checked={Boolean(notifications[key])} onCheckedChange={(checked) => setNotifications((current) => ({ ...current, [key]: checked }))} />
          </div>
        ))}
      </div>

      <div className="settings-page__feed">
        <div className="settings-page__section-head">
          <div>
            <h3 className="settings-page__section-title">Live notification feed</h3>
            <p className="settings-page__section-copy">These alerts are generated from your current inbox, tasks, and Gmail connection state.</p>
          </div>
        </div>
        {feed.length ? (
          <div className="settings-page__feed-list">
            {feed.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`settings-page__feed-item ${item.action_to ? "settings-page__feed-item--action" : ""}`}
                onClick={() => item.action_to && navigate(item.action_to)}
              >
                <div className="settings-page__feed-item-title">{item.title}</div>
                <div className="settings-page__feed-item-copy">{item.body}</div>
                {item.action_label ? <div className="settings-page__feed-item-cta">{item.action_label}</div> : null}
              </button>
            ))}
          </div>
        ) : (
          <div className="settings-page__empty-note">No live notifications right now. MailMind will show new alerts here as your workspace changes.</div>
        )}
      </div>
    </section>
  );

  const renderSecurityTab = () => (
    <section className="settings-page__section">
      <div className="settings-page__security-grid">
        <div className="settings-page__security-card">
          <div>
            <div className="settings-page__security-title">Change password</div>
            <div className="settings-page__security-copy">Update your MailMind password without affecting your connected Gmail accounts.</div>
          </div>

          <PasswordField
            label="Current password"
            value={security.currentPassword}
            onChange={(event) => setSecurity((current) => ({ ...current, currentPassword: event.target.value }))}
            placeholder="Enter your current password"
            visible={passwordVisibility.current}
            onToggle={() => setPasswordVisibility((current) => ({ ...current, current: !current.current }))}
          />
          <PasswordField
            label="New password"
            value={security.newPassword}
            onChange={(event) => setSecurity((current) => ({ ...current, newPassword: event.target.value }))}
            placeholder="Create a new password"
            visible={passwordVisibility.next}
            onToggle={() => setPasswordVisibility((current) => ({ ...current, next: !current.next }))}
          />
          <PasswordField
            label="Confirm new password"
            value={security.confirmPassword}
            onChange={(event) => setSecurity((current) => ({ ...current, confirmPassword: event.target.value }))}
            placeholder="Confirm your new password"
            visible={passwordVisibility.confirm}
            onToggle={() => setPasswordVisibility((current) => ({ ...current, confirm: !current.confirm }))}
          />

          <div className="settings-page__section-actions settings-page__section-actions--end">
            <Button variant="hero" onClick={updatePassword} disabled={savingPassword}>
              {savingPassword ? "Updating..." : "Update password"}
            </Button>
          </div>
        </div>

        <div className="settings-page__security-card settings-page__security-card--danger">
          <div>
            <div className="settings-page__security-title">Delete account</div>
            <div className="settings-page__security-copy">
              Permanently delete this MailMind account. Connected Gmail inboxes and this account session will be removed from this profile.
            </div>
          </div>

          <PasswordField
            label="Password"
            value={security.deletePassword}
            onChange={(event) => setSecurity((current) => ({ ...current, deletePassword: event.target.value }))}
            placeholder="Enter your password"
            visible={passwordVisibility.delete}
            onToggle={() => setPasswordVisibility((current) => ({ ...current, delete: !current.delete }))}
          />

          <label className="settings-page__field">
            <span>Type DELETE to confirm</span>
            <Input
              value={security.deleteConfirmation}
              onChange={(event) => setSecurity((current) => ({ ...current, deleteConfirmation: event.target.value }))}
              placeholder="DELETE"
            />
          </label>

          <div className="settings-page__section-actions settings-page__section-actions--end">
            <Button variant="destructive" onClick={deleteAccount} disabled={deletingAccount}>
              {deletingAccount ? "Deleting..." : "Delete account"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );

  const renderTabPanel = () => {
    if (loading) {
      return <div className="settings-page__loading">Loading your MailMind settings...</div>;
    }

    if (activeTab === "accounts") return renderAccountsTab();
    if (activeTab === "profile") return renderProfileTab();
    if (activeTab === "emails") return renderEmailsTab();
    if (activeTab === "notifications") return renderNotificationsTab();
    return renderSecurityTab();
  };

  return (
    <div className="settings-page">
      <section className="settings-page__hero">
        <div>
          <div className="settings-page__eyebrow">Settings</div>
          <h1 className="settings-page__title">Manage MailMind, accounts, and inbox connections</h1>
          <p className="settings-page__description">
            Keep multiple MailMind accounts signed in on one device, connect more than one Gmail inbox to the same workspace, and switch cleanly between them.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadSettings({ silent: true })} disabled={refreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh settings
        </Button>
      </section>

      {message.text ? (
        <div className={`settings-page__message settings-page__message--${message.type === "error" ? "error" : "success"}`}>
          {message.text}
        </div>
      ) : null}

      <section className="settings-page__summary">
        {summaryCards.map((card) => (
          <article key={card.label} className="settings-page__summary-card">
            <div className="settings-page__summary-label">{card.label}</div>
            <div className="settings-page__summary-value">{card.value}</div>
            <div className="settings-page__summary-note">{card.note}</div>
          </article>
        ))}
      </section>

      <section className="settings-page__layout">
        <nav className="settings-page__nav" aria-label="Settings sections">
          {tabs.map(([key, label, icon]) => {
            const active = activeTab === key;
            const TabIcon = icon;
            return (
              <button
                key={key}
                type="button"
                className={`settings-page__nav-btn ${active ? "settings-page__nav-btn--active" : ""}`}
                onClick={() => setActiveTab(key)}
              >
                <TabIcon className="h-4 w-4" />
                <span>{label}</span>
                <ChevronRight className="settings-page__nav-chevron h-4 w-4" />
              </button>
            );
          })}
        </nav>

        <div className="settings-page__panel">{renderTabPanel()}</div>
      </section>

      {disconnectTarget ? (
        <div className="settings-page__modal-backdrop" role="presentation">
          <div className="settings-page__modal" role="dialog" aria-modal="true" aria-labelledby="disconnect-gmail-title">
            <div className="settings-page__modal-title" id="disconnect-gmail-title">
              Disconnect Gmail account?
            </div>
            <div className="settings-page__modal-copy">
              MailMind will stop syncing and sending from <strong>{disconnectTarget.email_address || "this Gmail account"}</strong>.
            </div>
            <div className="settings-page__modal-actions">
              <Button variant="outline" onClick={() => setDisconnectTarget(null)}>
                <X className="mr-2 h-4 w-4" />
                No
              </Button>
              <Button variant="destructive" onClick={disconnectGmailAccount} disabled={disconnectingGmailId === disconnectTarget.id}>
                {disconnectingGmailId === disconnectTarget.id ? "Disconnecting..." : "Yes, disconnect"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
