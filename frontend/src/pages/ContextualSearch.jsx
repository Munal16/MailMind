import { useCallback, useEffect, useState } from "react";
import { CheckSquare, Mail, Paperclip, Search } from "lucide-react";
import SearchBar from "../components/SearchBar";
import { Button } from "../components/ui/button";
import api from "../api/client";

function normalizeSize(bytes) {
  if (!bytes && bytes !== 0) return "Unknown";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export default function ContextualSearch() {
  const [query, setQuery] = useState("Find emails about project meeting last week");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const runSearch = useCallback(async () => {
    if (!query.trim()) {
      setResults(null);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const res = await api.get(`/api/ai/search/?q=${encodeURIComponent(query)}`);
      setResults(res.data);
    } catch (err) {
      setResults(null);
      setError(typeof err.response?.data === "string" ? err.response.data : JSON.stringify(err.response?.data || err.message));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    runSearch();
  }, [runSearch]);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Contextual Search</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Search email content, tasks, attachments, intent labels, and project groups using contextual cues.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row">
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder="Find emails about project meeting last week..."
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
        {results?.detected_context ? (
          <div className="mt-3 text-xs text-muted-foreground">
            Detected context:
            {" "}
            {[
              results.detected_context.intent ? `intent=${results.detected_context.intent}` : null,
              results.detected_context.urgency ? `urgency=${results.detected_context.urgency}` : null,
              results.detected_context.wants_tasks ? "tasks" : null,
              results.detected_context.wants_attachments ? "attachments" : null,
            ]
              .filter(Boolean)
              .join(" • ") || "general email search"}
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      <div className="space-y-6">
        <section className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Mail className="h-4 w-4" />
            Matching Emails
          </div>
          <div className="mt-4 divide-y divide-border">
            {results?.matched_emails?.length ? (
              results.matched_emails.map((item) => (
                <div key={item.gmail_id} className="py-3 first:pt-0 last:pb-0">
                  <div className="text-sm font-medium text-card-foreground">{item.subject || "(no subject)"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.sender || "Unknown"} • {item.internal_date ? new Date(item.internal_date).toLocaleString() : "Recently"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.project_name ? `${item.project_name} • ` : ""}
                    {item.match_reasons?.join(", ") || "Matched by content"}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-3 text-sm text-muted-foreground">No matching emails found.</div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-2 text-sm font-semibold text-secondary">
            <Paperclip className="h-4 w-4" />
            Related Attachments
          </div>
          <div className="mt-4 divide-y divide-border">
            {results?.related_attachments?.length ? (
              results.related_attachments.map((item) => (
                <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="text-sm font-medium text-card-foreground">{item.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.sender || "Unknown"} • {normalizeSize(item.size)}
                  </div>
                  {item.project_name ? (
                    <div className="mt-1 text-xs text-muted-foreground">{item.project_name}</div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="py-3 text-sm text-muted-foreground">No related attachments found.</div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-2 text-sm font-semibold text-success">
            <CheckSquare className="h-4 w-4" />
            Related Tasks
          </div>
          <div className="mt-4 divide-y divide-border">
            {results?.related_tasks?.length ? (
              results.related_tasks.map((item) => (
                <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="text-sm font-medium text-card-foreground">{item.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Source: {item.source || "Unknown"}{item.deadline ? ` • Deadline: ${item.deadline}` : ""}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.responsibility ? `Responsibility: ${item.responsibility}` : "Responsibility not detected"}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-3 text-sm text-muted-foreground">No related tasks found.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
