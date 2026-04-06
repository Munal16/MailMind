import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  BarChart3,
  CheckSquare,
  Inbox,
  LayoutDashboard,
  Mail,
  Paperclip,
  Search,
  Settings,
  ShieldAlert,
} from "lucide-react";
import SearchBar from "../components/SearchBar";
import { Button } from "../components/ui/button";
import api from "../api/client";
import { filterSearchDestinations } from "../lib/searchDestinations";

const destinationIcons = {
  dashboard: LayoutDashboard,
  inbox: Inbox,
  priority: ShieldAlert,
  tasks: CheckSquare,
  attachments: Paperclip,
  analytics: BarChart3,
  settings: Settings,
  admin: ShieldAlert,
};

function normalizeSize(bytes) {
  if (!bytes && bytes !== 0) return "Unknown";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function detectedContextText(context) {
  if (!context) return "general MailMind search";

  const parts = [
    context.mailbox ? `mailbox=${context.mailbox}` : null,
    context.sender_terms?.length ? `sender=${context.sender_terms.join(", ")}` : null,
    context.intent ? `intent=${context.intent}` : null,
    context.urgency ? `urgency=${context.urgency}` : null,
    context.attachment_type ? `attachment=${context.attachment_type}` : null,
    context.without_attachments ? "without attachments" : null,
    context.wants_tasks ? "task-focused" : null,
    context.wants_attachments ? "with attachments" : null,
  ].filter(Boolean);

  return parts.join(" - ") || "general MailMind search";
}

export default function ContextualSearch() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(urlQuery);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isStaff, setIsStaff] = useState(false);

  const destinations = useMemo(
    () => filterSearchDestinations(urlQuery, { includeAdmin: isStaff }),
    [isStaff, urlQuery]
  );

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      try {
        const res = await api.get("/api/users/me/");
        if (!cancelled) {
          setIsStaff(Boolean(res.data.is_staff));
        }
      } catch {
        if (!cancelled) {
          setIsStaff(false);
        }
      }
    };

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchResults = useCallback(async (searchQuery) => {
    if (!searchQuery.trim()) {
      setResults(null);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const res = await api.get(`/api/ai/search/?q=${encodeURIComponent(searchQuery)}`);
      setResults(res.data);
    } catch (err) {
      setResults(null);
      setError(typeof err.response?.data === "string" ? err.response.data : JSON.stringify(err.response?.data || err.message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setQuery(urlQuery);
    void fetchResults(urlQuery);
  }, [fetchResults, urlQuery]);

  const runSearch = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchParams({});
      setResults(null);
      return;
    }
    setSearchParams({ q: trimmed });
  }, [query, setSearchParams]);

  const openDestination = useCallback(
    (to) => {
      navigate(to);
    },
    [navigate]
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Search</div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">Contextual Search</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Search the whole MailMind workspace from one place. Try natural queries like{" "}
              <span className="font-medium text-card-foreground">emails from bandit</span>,{" "}
              <span className="font-medium text-card-foreground">unread emails with images attached</span>, or{" "}
              <span className="font-medium text-card-foreground">verification emails this week</span>.
            </p>
          </div>

          <div className="w-full max-w-xl">
            <div className="flex flex-col gap-3 sm:flex-row">
              <SearchBar
                value={query}
                onChange={setQuery}
                placeholder="Search across emails, tasks, attachments, and pages"
                className="w-full"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    runSearch();
                  }
                }}
              />
              <Button variant="hero-outline" onClick={runSearch} disabled={loading}>
                <Search className="mr-1.5 h-4 w-4" />
                {loading ? "Searching..." : "Search"}
              </Button>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Detected context: <span className="font-medium text-card-foreground">{detectedContextText(results?.detected_context)}</span>
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-card-foreground">
          <Search className="h-4 w-4 text-primary" />
          Workspace destinations
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {destinations.length ? (
            destinations.map((item) => {
              const Icon = destinationIcons[item.iconKey] || Search;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openDestination(item.to)}
                  className="flex items-start gap-3 rounded-xl border border-border bg-background px-4 py-4 text-left transition-all hover:-translate-y-0.5 hover:bg-accent/30"
                >
                  <span className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-card-foreground">{item.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.description}</span>
                  </span>
                </button>
              );
            })
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-background px-4 py-4 text-sm text-muted-foreground sm:col-span-2 xl:col-span-4">
              No app sections match this search yet.
            </div>
          )}
        </div>
      </section>

      {!urlQuery && !loading ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground shadow-card">
          Start with a sender name, attachment type, urgency phrase, or mailbox keyword to search the workspace.
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Mail className="h-4 w-4" />
            Matching Emails
          </div>
          <div className="mt-4 divide-y divide-border">
            {results?.matched_emails?.length ? (
              results.matched_emails.map((item) => (
                <button
                  key={item.gmail_id}
                  type="button"
                  onClick={() => openDestination(`/app/inbox?email=${encodeURIComponent(item.gmail_id)}`)}
                  className="w-full py-4 text-left first:pt-0 last:pb-0"
                >
                  <div className="text-sm font-semibold text-card-foreground">{item.subject || "(no subject)"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.sender || "Unknown sender"}
                    {item.internal_date ? ` — ${new Date(item.internal_date).toLocaleDateString()}` : ""}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.project_name ? `${item.project_name} — ` : ""}
                    {(item.match_reasons || []).join(", ") || "Matched by email content"}
                  </div>
                </button>
              ))
            ) : urlQuery && !loading ? (
              <div className="py-2">
                <div className="text-sm text-muted-foreground">No emails matched your search.</div>
                {results?.suggestions?.length ? (
                  <div className="mt-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Did you mean…?
                    </div>
                    <div className="divide-y divide-border">
                      {results.suggestions.map((item) => (
                        <button
                          key={item.gmail_id}
                          type="button"
                          onClick={() => openDestination(`/app/inbox?email=${encodeURIComponent(item.gmail_id)}`)}
                          className="w-full py-3 text-left first:pt-0 last:pb-0 opacity-80 hover:opacity-100"
                        >
                          <div className="text-sm font-medium text-card-foreground">{item.subject || "(no subject)"}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {item.sender || "Unknown sender"}
                            {item.snippet ? ` — ${item.snippet.slice(0, 80)}…` : ""}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="py-3 text-sm text-muted-foreground">Enter a query above to search your emails.</div>
            )}
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-2 text-sm font-semibold text-secondary">
              <Paperclip className="h-4 w-4" />
              Related Attachments
            </div>
            <div className="mt-4 divide-y divide-border">
              {results?.related_attachments?.length ? (
                results.related_attachments.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openDestination(`/app/attachments?q=${encodeURIComponent(urlQuery)}`)}
                    className="w-full py-4 text-left first:pt-0 last:pb-0"
                  >
                    <div className="text-sm font-semibold text-card-foreground">{item.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {item.type ? `${item.type} - ` : ""}
                      {item.sender || "Unknown sender"} - {normalizeSize(item.size)}
                    </div>
                  </button>
                ))
              ) : (
                <div className="py-3 text-sm text-muted-foreground">No related attachments found.</div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-2 text-sm font-semibold text-success">
              <CheckSquare className="h-4 w-4" />
              Related Tasks
            </div>
            <div className="mt-4 divide-y divide-border">
              {results?.related_tasks?.length ? (
                results.related_tasks.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openDestination(`/app/tasks?q=${encodeURIComponent(urlQuery)}&task=${item.id}`)}
                    className="w-full py-4 text-left first:pt-0 last:pb-0"
                  >
                    <div className="text-sm font-semibold text-card-foreground">{item.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {item.source || "Unknown source"}
                      {item.deadline ? ` - ${item.deadline}` : ""}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {item.responsibility ? `Owner cue: ${item.responsibility}` : "Responsibility not detected"}
                    </div>
                  </button>
                ))
              ) : (
                <div className="py-3 text-sm text-muted-foreground">No related tasks found.</div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
