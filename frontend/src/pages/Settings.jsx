import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  Mail,
  PencilLine,
  Shield,
  Upload,
  User,
  X,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import { Avatar } from "../components/ui/avatar";
import api from "../api/client";
import { logout } from "../api/auth";
import "./Settings.css";

const tabs = [
  { key: "profile", label: "Profile", icon: User },
  { key: "emails", label: "Connected Email", icon: Mail },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "security", label: "Security", icon: Shield },
];

const notificationOptions = [
  {
    key: "urgent",
    title: "Urgent email alerts",
    copy: "Surface high-priority emails that need attention quickly.",
  },
  {
    key: "deadlines",
    title: "Deadline reminders",
    copy: "Highlight extracted tasks that include time-sensitive cues.",
  },
  {
    key: "digest",
    title: "Workspace digest",
    copy: "Get a summary of unread mail, urgent items, and pending tasks.",
  },
  {
    key: "attachments",
    title: "Attachment updates",
    copy: "Let MailMind notify you when new files arrive in synced email.",
  },
];

function initialsFor(name) {
  return String(name || "MM")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatError(err, fallback) {
  if (typeof err?.response?.data === "string") return err.response.data;

  const payload = err?.response?.data;
  if (payload?.message) return payload.message;
  if (payload?.error) return payload.error;

  if (payload && typeof payload === "object") {
    const firstEntry = Object.values(payload)[0];
    if (Array.isArray(firstEntry) && firstEntry[0]) return firstEntry[0];
  }

  return fallback;
}

export default function Settings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("profile");
  const [profile, setProfile] = useState({
    username: "",
    email: "",
    job_title: "",
    profile_photo_url: null,
  });
  const [gmail, setGmail] = useState({ connected: false, email_address: "", message: "" });
  const [notifications, setNotifications] = useState({
    urgent: true,
    deadlines: true,
    digest: false,
    attachments: true,
  });
  const [feed, setFeed] = useState([]);
  const [profileFile, setProfileFile] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
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
  const [message, setMessage] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [disconnectingGmail, setDisconnectingGmail] = useState(false);

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

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
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
      });
      setNotifications(
        meRes.data.notification_preferences || {
          urgent: true,
          deadlines: true,
          digest: false,
          attachments: true,
        }
      );
      setGmail({
        connected: Boolean(gmailRes.data.connected),
        email_address: gmailRes.data.email_address || "",
        message: gmailRes.data.message || "",
      });
      setFeed(notifRes.data.items || []);
      setMessage({ type: "", text: "" });
    } catch {
      setMessage({ type: "error", text: "MailMind could not load your settings right now." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const summaryCards = useMemo(
    () => [
      {
        label: "Profile",
        value: profile.username || "MailMind user",
        note: profile.job_title || "Add your role to personalize the workspace",
      },
      {
        label: "Connected Gmail",
        value: gmail.connected ? "Connected" : "Not connected",
        note: gmail.email_address || gmail.message || "Connect Gmail to sync live inbox activity",
      },
      {
        label: "Alerts enabled",
        value: Object.values(notifications).filter(Boolean).length,
        note: "Notification channels currently active",
      },
      {
        label: "Notification feed",
        value: feed.length,
        note: feed.length ? "Live account updates available below" : "No new alerts right now",
      },
    ],
    [feed.length, gmail.connected, gmail.email_address, gmail.message, notifications, profile.job_title, profile.username]
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
      if (profileFile) formData.append("profile_photo", profileFile);

      const res = await api.patch("/api/users/me/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setProfile({
        username: res.data.username || "",
        email: res.data.email || "",
        job_title: res.data.job_title || "",
        profile_photo_url: res.data.profile_photo_url || null,
      });
      setNotifications(res.data.notification_preferences || notifications);
      setProfileFile(null);
      setRemovePhoto(false);
      setEditingProfile(false);
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
      const res = await api.patch("/api/users/me/", { notification_preferences: notifications });
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
      setMessage({ type: "error", text: "Enter your current password." });
      return;
    }
    if (!security.newPassword.trim()) {
      setMessage({ type: "error", text: "Enter a new password." });
      return;
    }
    if (security.newPassword !== security.confirmPassword) {
      setMessage({ type: "error", text: "Your new passwords do not match." });
      return;
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
      setMessage({ type: "error", text: formatError(err, "Could not update your password.") });
    } finally {
      setSavingPassword(false);
    }
  };

  const deleteAccount = async () => {
    try {
      setDeletingAccount(true);
      setMessage({ type: "", text: "" });
      await api.post("/api/users/delete-account/", {
        current_password: security.deletePassword,
        confirmation: security.deleteConfirmation,
      });
      logout();
      navigate("/", { replace: true });
    } catch (err) {
      setMessage({ type: "error", text: formatError(err, "Could not delete your account.") });
    } finally {
      setDeletingAccount(false);
    }
  };

  const disconnectGmail = async () => {
    try {
      setDisconnectingGmail(true);
      setMessage({ type: "", text: "" });
      await api.post("/api/gmail/disconnect/");
      setGmail({ connected: false, email_address: "", message: "Gmail connection removed." });
      setShowDisconnectConfirm(false);
      setMessage({ type: "success", text: "Gmail disconnected successfully." });
    } catch (err) {
      setMessage({ type: "error", text: formatError(err, "Could not disconnect Gmail.") });
    } finally {
      setDisconnectingGmail(false);
    }
  };

  const openNotificationDestination = useCallback(
    (item) => {
      if (!item?.action_to) return;
      navigate(item.action_to);
    },
    [navigate]
  );

  const PasswordField = ({ label, value, onChange, placeholder, visibilityKey }) => (
    <label className="settings-page__field">
      <span>{label}</span>
      <div className="settings-page__password-wrap">
        <Input
          type={passwordVisibility[visibilityKey] ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="settings-page__password-input"
        />
        <button
          type="button"
          className="settings-page__password-toggle"
          onClick={() =>
            setPasswordVisibility((prev) => ({
              ...prev,
              [visibilityKey]: !prev[visibilityKey],
            }))
          }
          aria-label={passwordVisibility[visibilityKey] ? "Hide password" : "Show password"}
        >
          {passwordVisibility[visibilityKey] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );

  return (
    <div className="settings-page">
      <section className="settings-page__hero">
        <div>
          <div className="settings-page__eyebrow">Account workspace</div>
          <h1 className="settings-page__title">Settings</h1>
          <p className="settings-page__description">
            Keep your account, Gmail connection, notifications, and security controls organized in one clean place.
          </p>
        </div>
      </section>

      {message.text ? (
        <div className={`settings-page__message ${message.type === "error" ? "settings-page__message--error" : "settings-page__message--success"}`}>
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

      <div className="settings-page__layout">
        <aside className="settings-page__nav">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`settings-page__nav-btn ${activeTab === tab.key ? "settings-page__nav-btn--active" : ""}`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                <ChevronRight className="h-4 w-4 settings-page__nav-chevron" />
              </button>
            );
          })}
        </aside>

        <section className="settings-page__panel">
          {loading ? (
            <div className="settings-page__loading">Loading your settings...</div>
          ) : null}

          {!loading && activeTab === "profile" ? (
            <div className="settings-page__section">
              <div className="settings-page__section-head">
                <div>
                  <div className="settings-page__section-title">Profile</div>
                  <div className="settings-page__section-copy">Review account details first, then edit only when you need to change something.</div>
                </div>
                {!editingProfile ? (
                  <Button variant="hero-outline" onClick={() => setEditingProfile(true)}>
                    <PencilLine className="mr-1.5 h-4 w-4" />
                    Edit Profile
                  </Button>
                ) : null}
              </div>

              <div className="settings-page__profile-card">
                <div className="settings-page__profile-overview">
                  <Avatar
                    src={previewUrl}
                    initials={initialsFor(profile.username)}
                    alt={`${profile.username} profile photo`}
                    className="settings-page__avatar"
                  />
                  <div>
                    <div className="settings-page__profile-name">{profile.username || "MailMind User"}</div>
                    <div className="settings-page__profile-meta">{profile.email || "No email on file"}</div>
                    <div className="settings-page__profile-meta">{profile.job_title || "Add your role or title"}</div>
                    <div className="settings-page__profile-meta settings-page__profile-meta--connected">
                      Connected Gmail: {gmail.email_address || "Not connected"}
                    </div>
                  </div>
                </div>

                {editingProfile ? (
                  <div className="settings-page__profile-actions">
                    <label className="settings-page__upload-btn">
                      <Upload className="h-4 w-4" />
                      Choose photo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0] || null;
                          setProfileFile(file);
                          if (file) setRemovePhoto(false);
                        }}
                      />
                    </label>

                    {(profile.profile_photo_url || profileFile) ? (
                      <Button
                        variant="outline"
                        type="button"
                        onClick={() => {
                          setProfileFile(null);
                          setRemovePhoto(true);
                        }}
                      >
                        <X className="mr-1.5 h-4 w-4" />
                        Remove photo
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {!editingProfile ? (
                <div className="settings-page__account-grid">
                  <article className="settings-page__account-item">
                    <div className="settings-page__account-label">Account name</div>
                    <div className="settings-page__account-value">{profile.username || "MailMind User"}</div>
                  </article>
                  <article className="settings-page__account-item">
                    <div className="settings-page__account-label">MailMind email</div>
                    <div className="settings-page__account-value">{profile.email || "No email on file"}</div>
                  </article>
                  <article className="settings-page__account-item">
                    <div className="settings-page__account-label">Connected Gmail</div>
                    <div className="settings-page__account-value">{gmail.email_address || "Not connected"}</div>
                  </article>
                  <article className="settings-page__account-item">
                    <div className="settings-page__account-label">Job title</div>
                    <div className="settings-page__account-value">{profile.job_title || "Not added yet"}</div>
                  </article>
                </div>
              ) : (
                <>
                  <div className="settings-page__form-grid">
                    <label className="settings-page__field">
                      <span>Name</span>
                      <Input
                        value={profile.username}
                        onChange={(event) => setProfile((prev) => ({ ...prev, username: event.target.value }))}
                        placeholder="Your name"
                      />
                    </label>

                    <label className="settings-page__field">
                      <span>Email</span>
                      <Input
                        value={profile.email}
                        onChange={(event) => setProfile((prev) => ({ ...prev, email: event.target.value }))}
                        placeholder="email@gmail.com"
                      />
                    </label>

                    <label className="settings-page__field settings-page__field--full">
                      <span>Job title</span>
                      <Input
                        value={profile.job_title}
                        onChange={(event) => setProfile((prev) => ({ ...prev, job_title: event.target.value }))}
                        placeholder="Product Manager"
                      />
                    </label>
                  </div>

                  <div className="settings-page__section-actions">
                    <Button variant="hero" onClick={saveProfile} disabled={savingProfile}>
                      {savingProfile ? "Saving..." : "Save Profile"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingProfile(false);
                        setProfileFile(null);
                        setRemovePhoto(false);
                        void loadSettings();
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : null}

          {!loading && activeTab === "emails" ? (
            <div className="settings-page__section">
              <div className="settings-page__section-head">
                <div>
                  <div className="settings-page__section-title">Connected Email</div>
                  <div className="settings-page__section-copy">Manage the Gmail account MailMind uses for sync, inbox triage, and attachment review.</div>
                </div>
              </div>

              <div className="settings-page__email-status">
                <div className={`settings-page__status-badge ${gmail.connected ? "settings-page__status-badge--success" : "settings-page__status-badge--warning"}`}>
                  {gmail.connected ? "Connected" : "Needs attention"}
                </div>
                <div className="settings-page__email-title">{gmail.email_address || "No Gmail account linked yet"}</div>
                <div className="settings-page__email-copy">
                  {gmail.connected
                    ? "Your Gmail connection is active and ready for sync."
                    : gmail.message || "Connect Gmail to start syncing live inbox activity into MailMind."}
                </div>
                <div className="settings-page__section-actions">
                  <Button variant="hero-outline" onClick={() => navigate("/connect-email")}>
                    {gmail.connected ? "Manage Gmail Connection" : "Connect Gmail"}
                  </Button>
                  {gmail.connected ? (
                    <Button variant="outline" onClick={() => setShowDisconnectConfirm(true)} disabled={disconnectingGmail}>
                      {disconnectingGmail ? "Disconnecting..." : "Disconnect"}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {!loading && activeTab === "notifications" ? (
            <div className="settings-page__section">
              <div className="settings-page__section-head">
                <div>
                  <div className="settings-page__section-title">Notifications</div>
                  <div className="settings-page__section-copy">Choose which workspace updates MailMind should surface for you.</div>
                </div>
              </div>

              <div className="settings-page__notification-grid">
                {notificationOptions.map((item) => (
                  <article key={item.key} className="settings-page__notification-card">
                    <div>
                      <div className="settings-page__notification-title">{item.title}</div>
                      <div className="settings-page__notification-copy">{item.copy}</div>
                    </div>
                    <Switch
                      checked={Boolean(notifications[item.key])}
                      onCheckedChange={(value) => setNotifications((prev) => ({ ...prev, [item.key]: value }))}
                    />
                  </article>
                ))}
              </div>

              <div className="settings-page__section-actions">
                <Button variant="hero" onClick={saveNotifications} disabled={savingNotifications}>
                  {savingNotifications ? "Saving..." : "Save Notifications"}
                </Button>
              </div>

              <div className="settings-page__feed">
                <div className="settings-page__section-title">Latest notification previews</div>
                <div className="settings-page__feed-list">
                  {feed.length ? (
                    feed.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`settings-page__feed-item ${item.action_to ? "settings-page__feed-item--action" : ""}`}
                        onClick={() => openNotificationDestination(item)}
                        disabled={!item.action_to}
                      >
                        <div className="settings-page__feed-item-title">{item.title}</div>
                        <div className="settings-page__feed-item-copy">{item.body}</div>
                        {item.action_label ? <div className="settings-page__feed-item-cta">{item.action_label}</div> : null}
                      </button>
                    ))
                  ) : (
                    <div className="settings-page__empty-note">MailMind has no notification previews to show right now.</div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {!loading && activeTab === "security" ? (
            <div className="settings-page__section">
              <div className="settings-page__section-head">
                <div>
                  <div className="settings-page__section-title">Security</div>
                  <div className="settings-page__section-copy">Protect your account with a password update flow and controlled account removal.</div>
                </div>
              </div>

              <div className="settings-page__security-grid">
                <article className="settings-page__security-card">
                  <div className="settings-page__security-title">
                    <Shield className="h-4 w-4" />
                    Update password
                  </div>
                  <div className="settings-page__security-copy">Use a strong password that is different from the one you already use today.</div>

                  <div className="settings-page__form-grid">
                    <div className="settings-page__field--full">
                      <PasswordField
                        label="Current password"
                        value={security.currentPassword}
                        onChange={(event) => setSecurity((prev) => ({ ...prev, currentPassword: event.target.value }))}
                        placeholder="Enter your current password"
                        visibilityKey="current"
                      />
                    </div>

                    <PasswordField
                      label="New password"
                      value={security.newPassword}
                      onChange={(event) => setSecurity((prev) => ({ ...prev, newPassword: event.target.value }))}
                      placeholder="Create a new password"
                      visibilityKey="next"
                    />

                    <PasswordField
                      label="Confirm new password"
                      value={security.confirmPassword}
                      onChange={(event) => setSecurity((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                      placeholder="Repeat the new password"
                      visibilityKey="confirm"
                    />
                  </div>

                  <div className="settings-page__section-actions settings-page__section-actions--end">
                    <Button variant="hero" onClick={updatePassword} disabled={savingPassword}>
                      {savingPassword ? "Updating..." : "Update Password"}
                    </Button>
                  </div>
                </article>

                <article className="settings-page__security-card settings-page__security-card--danger">
                  <div className="settings-page__security-title">
                    <CheckCircle2 className="h-4 w-4" />
                    Delete account
                  </div>
                  <div className="settings-page__security-copy">
                    This permanently removes your MailMind account and profile. Type <strong>DELETE</strong> and confirm your password to continue.
                  </div>

                  <div className="settings-page__form-grid">
                    <label className="settings-page__field">
                      <span>Type DELETE</span>
                      <Input
                        value={security.deleteConfirmation}
                        onChange={(event) => setSecurity((prev) => ({ ...prev, deleteConfirmation: event.target.value }))}
                        placeholder="DELETE"
                      />
                    </label>

                    <PasswordField
                      label="Password"
                      value={security.deletePassword}
                      onChange={(event) => setSecurity((prev) => ({ ...prev, deletePassword: event.target.value }))}
                      placeholder="Enter your password"
                      visibilityKey="delete"
                    />
                  </div>

                  <div className="settings-page__section-actions settings-page__section-actions--end">
                    <Button variant="destructive" onClick={deleteAccount} disabled={deletingAccount}>
                      {deletingAccount ? "Deleting..." : "Delete Account"}
                    </Button>
                  </div>
                </article>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      {showDisconnectConfirm ? (
        <div className="settings-page__modal-backdrop" role="presentation">
          <div className="settings-page__modal" role="dialog" aria-modal="true" aria-labelledby="disconnect-email-title">
            <div className="settings-page__modal-title" id="disconnect-email-title">
              Disconnect email account?
            </div>
            <div className="settings-page__modal-copy">
              MailMind will stop syncing this Gmail account until you connect it again.
            </div>
            <div className="settings-page__modal-actions">
              <Button variant="outline" onClick={() => setShowDisconnectConfirm(false)}>
                No
              </Button>
              <Button variant="destructive" onClick={disconnectGmail} disabled={disconnectingGmail}>
                {disconnectingGmail ? "Disconnecting..." : "Yes, disconnect"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
