import { useEffect, useState } from "react";
import { Bell, Brain, Mail, Shield, User } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import api from "../api/client";
import { logout } from "../api/auth";
import { useNavigate } from "react-router-dom";

const tabs = [
  { key: "profile", label: "Profile", icon: User },
  { key: "emails", label: "Connected Emails", icon: Mail },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "ai", label: "AI Preferences", icon: Brain },
  { key: "security", label: "Security", icon: Shield },
];

export default function Settings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("profile");
  const [profile, setProfile] = useState({ username: "Munal", email: "Munal12@gmail.com" });
  const [gmail, setGmail] = useState({ connected: false });
  const [notifications, setNotifications] = useState({ urgent: true, deadlines: true, digest: false, attachments: true });
  const [aiPreferences, setAiPreferences] = useState({ sensitivity: "Balanced", extraction: "Enabled" });

  useEffect(() => {
    const load = async () => {
      try {
        const [meRes, gRes] = await Promise.all([api.get("/api/users/me/"), api.get("/api/gmail/status/")]);
        setProfile({
          username: meRes.data.username || "Munal",
          email: meRes.data.email || "Munal@gmail.com",
          title: "Product Manager",
        });
        setGmail({ connected: gRes.data.connected });
      } catch {
        // keep fallback display data
      }
    };
    load();
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">Manage your profile, connected inboxes, alerts, and security controls.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[12rem_1fr]">
        <aside className="hidden space-y-2 md:block">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${activeTab === tab.key ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/30"}`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </aside>

        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          {activeTab === "profile" ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-card-foreground">Profile</h2>
              <Input value={profile.username || ""} onChange={(e) => setProfile((prev) => ({ ...prev, username: e.target.value }))} />
              <Input value={profile.email || ""} onChange={(e) => setProfile((prev) => ({ ...prev, email: e.target.value }))} />
              <Input value={profile.title || "Product Manager"} onChange={(e) => setProfile((prev) => ({ ...prev, title: e.target.value }))} />
              <Button variant="hero">Save</Button>
            </div>
          ) : null}

          {activeTab === "emails" ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-card-foreground">Connected Email Accounts</h2>
              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <div className="text-sm font-medium text-card-foreground">{profile.email || "john@gmail.com"}</div>
                <div className="mt-1 text-sm text-muted-foreground">{gmail.connected ? "Connected � last synced 5 min ago" : "Not connected"}</div>
                <div className="mt-4 flex gap-3">
                  <Button variant="hero-outline" onClick={() => navigate("/connect-email")}>Connect Another Account</Button>
                  <Button variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => setGmail({ connected: false })}>Disconnect</Button>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "notifications" ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-card-foreground">Notification Preferences</h2>
              {[
                ["urgent", "Urgent email alerts"],
                ["deadlines", "Task deadline reminders"],
                ["digest", "Weekly analytics digest"],
                ["attachments", "New attachment notifications"],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3 text-sm">
                  <span className="text-card-foreground">{label}</span>
                  <Switch checked={notifications[key]} onCheckedChange={(value) => setNotifications((prev) => ({ ...prev, [key]: value }))} />
                </div>
              ))}
            </div>
          ) : null}

          {activeTab === "ai" ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-card-foreground">AI Preferences</h2>
              <div>
                <label className="mb-2 block text-sm font-medium">Urgency Sensitivity</label>
                <select value={aiPreferences.sensitivity} onChange={(e) => setAiPreferences((prev) => ({ ...prev, sensitivity: e.target.value }))} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  {[
                    "Balanced",
                    "High",
                    "Low",
                  ].map((option) => <option key={option}>{option}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Auto Task Extraction</label>
                <select value={aiPreferences.extraction} onChange={(e) => setAiPreferences((prev) => ({ ...prev, extraction: e.target.value }))} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  {[
                    "Enabled",
                    "Disabled",
                  ].map((option) => <option key={option}>{option}</option>)}
                </select>
              </div>
              <Button variant="hero">Save</Button>
            </div>
          ) : null}

          {activeTab === "security" ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-card-foreground">Security</h2>
              <Input type="password" placeholder="Current password" />
              <Input type="password" placeholder="New password" />
              <Button variant="hero">Update Password</Button>
              <div className="border-t border-border pt-5">
                <div className="text-sm font-semibold text-destructive">Danger zone</div>
                <Button variant="destructive" className="mt-3" onClick={() => { logout(); navigate("/", { replace: true }); }}>
                  Delete Account
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
