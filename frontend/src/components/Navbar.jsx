import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  CheckSquare,
  Inbox,
  LayoutDashboard,
  LogOut,
  Mail,
  Moon,
  Paperclip,
  Search,
  Settings,
  ShieldAlert,
  Sun,
  UserCircle2,
} from "lucide-react";
import SearchBar from "./SearchBar";
import { SidebarTrigger } from "./ui/sidebar";
import { Avatar } from "./ui/avatar";
import { useTheme } from "../context/ThemeContext";
import { useConfirm } from "../context/ConfirmContext";
import BrandLogo from "./BrandLogo";
import { logout } from "../api/auth";
import { getSessionAppRoute } from "../api/sessionStore";
import api from "../api/client";
import { cn } from "../lib/utils";
import { filterSearchDestinations } from "../lib/searchDestinations";

const levelStyles = {
  urgent: "bg-urgent/10 text-urgent",
  warning: "bg-warning/10 text-warning",
  success: "bg-success/10 text-success",
  info: "bg-primary/10 text-primary",
};

const emptySearchResults = {
  matched_emails: [],
  related_attachments: [],
  related_tasks: [],
};

const searchIconMap = {
  dashboard: LayoutDashboard,
  inbox: Inbox,
  priority: ShieldAlert,
  tasks: CheckSquare,
  attachments: Paperclip,
  analytics: BarChart3,
  settings: Settings,
  admin: ShieldAlert,
};

const notificationIcons = {
  gmail: Mail,
  urgent: ShieldAlert,
  unread: Inbox,
  tasks: CheckSquare,
  attachments: Paperclip,
  digest: LayoutDashboard,
};

function initialsFor(name) {
  return String(name || "MM")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const shellRef = useRef(null);
  const searchInputRef = useRef(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState(emptySearchResults);
  const [profile, setProfile] = useState({
    username: "MailMind User",
    email: "",
    job_title: "",
    profile_photo_url: null,
    is_staff: false,
  });
  const [notifications, setNotifications] = useState([]);

  const applyShellData = useCallback((payload) => {
    setNotifications(payload.items || []);
    if (payload.profile) {
      setProfile(payload.profile);
    }
  }, []);

  const loadShellData = useCallback(async () => {
    try {
      const res = await api.get("/api/users/notifications/");
      applyShellData(res.data);
    } catch {
      // keep last known shell state so navbar does not collapse on transient failures
    }
  }, [applyShellData]);

  useEffect(() => {
    let cancelled = false;

    const syncShellData = async () => {
      try {
        const res = await api.get("/api/users/notifications/");
        if (!cancelled) {
          applyShellData(res.data);
        }
      } catch {
        // keep last known shell state so navbar does not collapse on transient failures
      }
    };

    void syncShellData();
    const intervalId = window.setInterval(() => {
      void syncShellData();
    }, 30000);

    const handleWindowRefresh = () => {
      if (document.visibilityState === "hidden") {
        return;
      }
      void syncShellData();
    };

    window.addEventListener("focus", handleWindowRefresh);
    document.addEventListener("visibilitychange", handleWindowRefresh);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowRefresh);
      document.removeEventListener("visibilitychange", handleWindowRefresh);
    };
  }, [applyShellData]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (shellRef.current && !shellRef.current.contains(event.target)) {
        setNotificationsOpen(false);
        setProfileOpen(false);
        setSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    setSearchOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const query = searchQuery.trim();

    if (!query) {
      setSearchLoading(false);
      setSearchResults(emptySearchResults);
      return undefined;
    }

    let cancelled = false;
    setSearchLoading(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        const res = await api.get(`/api/ai/search/?q=${encodeURIComponent(query)}`);
        if (!cancelled) {
          setSearchResults({
            matched_emails: res.data.matched_emails || [],
            related_attachments: res.data.related_attachments || [],
            related_tasks: res.data.related_tasks || [],
          });
        }
      } catch {
        if (!cancelled) {
          setSearchResults(emptySearchResults);
        }
      } finally {
        if (!cancelled) {
          setSearchLoading(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [searchQuery]);

  const notificationCount = notifications.length;
  const userInitials = useMemo(() => initialsFor(profile.username), [profile.username]);
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredQuickLinks = useMemo(() => {
    return filterSearchDestinations(normalizedQuery, { includeAdmin: Boolean(profile.is_staff) });
  }, [normalizedQuery, profile.is_staff]);

  const hasSearchResults =
    filteredQuickLinks.length > 0 ||
    searchResults.matched_emails.length > 0 ||
    searchResults.related_tasks.length > 0 ||
    searchResults.related_attachments.length > 0;

  const navigateToSearch = useCallback(
    (query = searchQuery) => {
      const trimmed = query.trim();
      navigate(trimmed ? `/app/search?q=${encodeURIComponent(trimmed)}` : "/app/search");
      setSearchOpen(false);
    },
    [navigate, searchQuery]
  );

  const openSearchResult = useCallback(
    (path) => {
      navigate(path);
      setSearchOpen(false);
    },
    [navigate]
  );

  const openNotification = useCallback(
    (item) => {
      if (item?.action_to) {
        navigate(item.action_to);
      }
      setNotificationsOpen(false);
    },
    [navigate]
  );

  const confirm = useConfirm();

  return (
    <header ref={shellRef} className="flex h-14 items-center justify-between gap-3 border-b border-border bg-card px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <BrandLogo size="xs" showWordmark={false} className="sm:hidden" />
        <div className="relative hidden sm:block">
          <SearchBar
            value={searchQuery}
            onChange={(value) => {
              setSearchQuery(value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                navigateToSearch();
              }
              if (event.key === "Escape") {
                setSearchOpen(false);
              }
            }}
            inputRef={searchInputRef}
            className="sm:w-80"
            placeholder="Search emails, tasks, attachments..."
            autoComplete="off"
            aria-label="Global search"
          />

          {searchOpen ? (
            <div className="absolute left-0 top-[calc(100%+0.75rem)] z-30 w-[32rem] overflow-hidden rounded-2xl border border-border bg-card shadow-card">
              <div className="border-b border-border bg-muted/30 px-4 py-3">
                <div className="text-sm font-semibold text-card-foreground">Global Search</div>
                <div className="text-xs text-muted-foreground">
                  Search across emails, extracted tasks, attachments, and app destinations.
                </div>
              </div>

              <div className="max-h-[28rem] overflow-y-auto p-4">
                {!normalizedQuery ? (
                  <div className="space-y-4">
                    <div>
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Quick Access
                      </div>
                      <div className="space-y-2">
                        {filteredQuickLinks.map((item) => {
                          const Icon = searchIconMap[item.iconKey] || Search;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => openSearchResult(item.to)}
                              className="flex w-full items-start gap-3 rounded-xl border border-border bg-background px-3 py-3 text-left transition-all hover:-translate-y-0.5 hover:bg-accent/30"
                            >
                              <span className="rounded-lg bg-primary/10 p-2 text-primary">
                                <Icon className="h-4 w-4" />
                              </span>
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold text-card-foreground">{item.label}</span>
                                <span className="block text-xs text-muted-foreground">{item.description}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="rounded-xl border border-dashed border-border bg-background/60 px-3 py-3 text-xs text-muted-foreground">
                      Type a search query or press Enter to open full contextual search.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div>
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        App Destinations
                      </div>
                      <div className="space-y-2">
                        {filteredQuickLinks.length ? (
                          filteredQuickLinks.slice(0, 4).map((item) => {
                            const Icon = searchIconMap[item.iconKey] || Search;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => openSearchResult(item.to)}
                                className="flex w-full items-start gap-3 rounded-xl border border-border bg-background px-3 py-3 text-left transition-all hover:-translate-y-0.5 hover:bg-accent/30"
                              >
                                <span className="rounded-lg bg-primary/10 p-2 text-primary">
                                  <Icon className="h-4 w-4" />
                                </span>
                                <span className="min-w-0">
                                  <span className="block text-sm font-semibold text-card-foreground">{item.label}</span>
                                  <span className="block text-xs text-muted-foreground">{item.description}</span>
                                </span>
                              </button>
                            );
                          })
                        ) : (
                          <div className="rounded-xl border border-border bg-background px-3 py-3 text-xs text-muted-foreground">
                            No app sections match this query.
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Email Matches
                      </div>
                      <div className="space-y-2">
                        {searchLoading ? (
                          <div className="rounded-xl border border-border bg-background px-3 py-3 text-xs text-muted-foreground">
                            Searching MailMind data...
                          </div>
                        ) : searchResults.matched_emails.length ? (
                          searchResults.matched_emails.slice(0, 4).map((item) => (
                            <button
                              key={item.gmail_id}
                              type="button"
                              onClick={() => openSearchResult(`/app/inbox?email=${encodeURIComponent(item.gmail_id)}`)}
                              className="flex w-full items-start gap-3 rounded-xl border border-border bg-background px-3 py-3 text-left transition-all hover:-translate-y-0.5 hover:bg-accent/30"
                            >
                              <span className="rounded-lg bg-primary/10 p-2 text-primary">
                                <Mail className="h-4 w-4" />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-card-foreground">
                                  {item.subject || "(no subject)"}
                                </span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {item.sender || "Unknown sender"}
                                  {item.project_name ? ` - ${item.project_name}` : ""}
                                </span>
                              </span>
                            </button>
                          ))
                        ) : (
                          <div className="rounded-xl border border-border bg-background px-3 py-3 text-xs text-muted-foreground">
                            No email matches yet.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div>
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Tasks
                        </div>
                        <div className="space-y-2">
                          {searchResults.related_tasks.length ? (
                            searchResults.related_tasks.slice(0, 3).map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() =>
                                  openSearchResult(`/app/tasks?q=${encodeURIComponent(searchQuery.trim())}&task=${item.id}`)
                                }
                                className="flex w-full items-start gap-3 rounded-xl border border-border bg-background px-3 py-3 text-left transition-all hover:-translate-y-0.5 hover:bg-accent/30"
                              >
                                <span className="rounded-lg bg-warning/10 p-2 text-warning">
                                  <CheckSquare className="h-4 w-4" />
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-semibold text-card-foreground">{item.title}</span>
                                  <span className="block truncate text-xs text-muted-foreground">
                                    {item.source || "No source"}
                                    {item.deadline ? ` - ${item.deadline}` : ""}
                                  </span>
                                </span>
                              </button>
                            ))
                          ) : (
                            <div className="rounded-xl border border-border bg-background px-3 py-3 text-xs text-muted-foreground">
                              No task matches yet.
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Attachments
                        </div>
                        <div className="space-y-2">
                          {searchResults.related_attachments.length ? (
                            searchResults.related_attachments.slice(0, 3).map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => openSearchResult(`/app/attachments?q=${encodeURIComponent(searchQuery.trim())}`)}
                                className="flex w-full items-start gap-3 rounded-xl border border-border bg-background px-3 py-3 text-left transition-all hover:-translate-y-0.5 hover:bg-accent/30"
                              >
                                <span className="rounded-lg bg-success/10 p-2 text-success">
                                  <Paperclip className="h-4 w-4" />
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-semibold text-card-foreground">{item.name}</span>
                                  <span className="block truncate text-xs text-muted-foreground">
                                    {item.sender || "Unknown sender"}
                                    {item.project_name ? ` - ${item.project_name}` : ""}
                                  </span>
                                </span>
                              </button>
                            ))
                          ) : (
                            <div className="rounded-xl border border-border bg-background px-3 py-3 text-xs text-muted-foreground">
                              No attachment matches yet.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {!searchLoading && !hasSearchResults ? (
                      <div className="rounded-xl border border-border bg-background px-3 py-3 text-xs text-muted-foreground">
                        No results found. Try a sender name, project, email subject, task phrase, or file name.
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="border-t border-border bg-muted/20 px-4 py-3">
                <button
                  type="button"
                  onClick={() => navigateToSearch()}
                  className="w-full rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-medium text-primary transition-all hover:bg-primary/10"
                >
                  Open full search results
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleTheme}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background transition-all hover:bg-accent/30"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setNotificationsOpen((open) => !open);
              setProfileOpen(false);
              void loadShellData();
            }}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background transition-all hover:bg-accent/30"
            aria-label="Open notifications"
          >
            <Bell className="h-4 w-4" />
            {notificationCount > 0 ? (
              <span className="absolute right-1.5 top-1.5 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-urgent px-1 text-[10px] font-semibold text-white">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            ) : null}
          </button>

          {notificationsOpen ? (
            <div className="absolute right-0 z-30 mt-3 w-80 rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-card-foreground">Notifications</div>
                  <div className="text-xs text-muted-foreground">Live updates from your synced inbox</div>
                </div>
                <button
                  type="button"
                  onClick={() => void loadShellData()}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Refresh
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {notifications.length ? (
                  notifications.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openNotification(item)}
                      className="w-full rounded-xl border border-border bg-muted/40 p-3 text-left transition-all hover:-translate-y-0.5 hover:bg-accent/30"
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn("mt-0.5 rounded-full p-2", levelStyles[item.level] || levelStyles.info)}>
                          {(() => {
                            const NotificationIcon = notificationIcons[item.kind] || Bell;
                            return <NotificationIcon className="h-3.5 w-3.5" />;
                          })()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-card-foreground">{item.title}</div>
                          <div className="mt-1 text-xs leading-5 text-muted-foreground">{item.body}</div>
                          {item.action_label ? (
                            <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                              {item.action_label}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                    No new notifications right now.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setProfileOpen((open) => !open);
              setNotificationsOpen(false);
              void loadShellData();
            }}
            className="rounded-full transition-transform hover:scale-[1.02]"
            aria-label="Open account menu"
          >
            <Avatar src={profile.profile_photo_url} initials={userInitials} alt={`${profile.username} profile photo`} className="h-11 w-11" />
          </button>

          {profileOpen ? (
            <div className="absolute right-0 z-30 mt-3 w-80 rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-center gap-3">
                <Avatar src={profile.profile_photo_url} initials={userInitials} alt={`${profile.username} profile photo`} className="h-14 w-14 text-sm" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-card-foreground">{profile.username}</div>
                  <div className="truncate text-xs text-muted-foreground">{profile.email || "No email on file"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{profile.job_title || "MailMind workspace member"}</div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2"><UserCircle2 className="h-3.5 w-3.5 text-primary" /> Account details</div>
                <div className="mt-2 space-y-1">
                  <div><span className="font-medium text-card-foreground">Username:</span> {profile.username}</div>
                  <div><span className="font-medium text-card-foreground">Email:</span> {profile.email || "Not set"}</div>
                  <div><span className="font-medium text-card-foreground">Role:</span> {profile.job_title || "Not set"}</div>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    navigate("/app/settings");
                  }}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium transition-all hover:bg-accent/30"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Log out of MailMind?",
                      description: "You will be signed out of your current session. Any unsaved work will be lost.",
                      confirmLabel: "Log out",
                      cancelLabel: "Stay logged in",
                      variant: "logout",
                    });
                    if (!ok) return;
                    const nextSession = logout();
                    navigate(nextSession ? getSessionAppRoute(nextSession) : "/", { replace: true });
                  }}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive transition-all hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

