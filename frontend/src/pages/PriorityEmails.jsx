import { useEffect, useState } from "react";
import { AlertTriangle, Clock3 } from "lucide-react";
import { Avatar } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import api from "../api/client";

export default function PriorityEmails() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setError("");
        const res = await api.get("/api/ai/priority-emails/");
        setRows(res.data.emails || []);
      } catch (err) {
        setRows([]);
        setError(typeof err.response?.data === "string" ? err.response.data : JSON.stringify(err.response?.data || err.message));
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-7 w-7 text-urgent" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Priority Emails</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Messages sorted by urgency, intent, and MailMind priority score for immediate triage.
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="grid grid-cols-[1fr_2fr_auto_1fr_1fr] gap-4 border-b border-border px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <div>Sender</div>
          <div>Subject</div>
          <div>Score</div>
          <div>Intent</div>
          <div>Deadline</div>
        </div>

        {rows.length ? (
          rows.map((row) => (
            <div key={row.gmail_id} className="grid grid-cols-[1fr_2fr_auto_1fr_1fr] gap-4 border-b border-border px-6 py-4 text-sm transition-colors hover:bg-accent/30">
              <div className="flex items-center gap-3">
                <Avatar initials={(row.sender || "UN").slice(0, 2).toUpperCase()} className="h-8 w-8" />
                <span className="font-medium text-card-foreground">{row.sender || "Unknown"}</span>
              </div>
              <div>
                <div className="font-medium text-card-foreground">{row.subject || "(no subject)"}</div>
                {row.project_name ? (
                  <div className="mt-1">
                    <Badge variant="accent">{row.project_name}</Badge>
                  </div>
                ) : null}
              </div>
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-urgent/10 text-sm font-semibold text-urgent">
                  {row.priority_score || 0}
                </div>
              </div>
              <div>
                <Badge variant="muted">{row.intent || "Unclassified"}</Badge>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock3 className="h-4 w-4" />
                <span>{row.deadline || "Not detected"}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="px-6 py-8 text-sm text-muted-foreground">
            Run AI analysis after syncing Gmail to populate the priority queue.
          </div>
        )}
      </div>
    </div>
  );
}
