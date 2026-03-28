import { CheckSquare, Paperclip } from "lucide-react";
import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";

function urgencyVariant(urgency) {
  const key = String(urgency || "").toLowerCase();
  if (key === "high") return "high";
  if (key === "medium") return "medium";
  return "low";
}

function parseSenderIdentity(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return { name: "Unknown sender", email: "" };
  }

  const match = raw.match(/^(.*?)(?:\s*<([^>]+)>)?$/);
  const name = (match?.[1] || "").replace(/^["']|["']$/g, "").trim();
  const email = (match?.[2] || "").trim();

  if (name && email && name.toLowerCase() !== email.toLowerCase()) {
    return { name, email };
  }

  if (email) {
    return { name: email, email: "" };
  }

  return { name: raw, email: "" };
}

export default function EmailCard({
  sender,
  subject,
  preview,
  time,
  urgency,
  intent,
  project,
  hasTask,
  hasAttachment,
  isRead,
  priorityScore,
  selected,
  onClick,
}) {
  const senderIdentity = parseSenderIdentity(sender);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative mx-3 mt-3 flex w-[calc(100%-1.5rem)] items-start gap-3 rounded-2xl border border-transparent bg-background px-4 py-4 text-left transition-all hover:-translate-y-0.5 hover:border-border hover:bg-accent/30",
        selected &&
          "border-primary/20 bg-accent/45 shadow-sm before:absolute before:bottom-3 before:left-0 before:top-3 before:w-0.5 before:rounded-full before:bg-primary"
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="gradient-primary mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white">
          {senderIdentity.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", isRead ? "bg-border" : "bg-primary")} />
            <span className="text-sm font-semibold text-foreground">{senderIdentity.name}</span>
            <Badge variant={urgencyVariant(urgency)}>{urgency}</Badge>
            {intent ? <Badge variant="muted">{intent}</Badge> : null}
            {project ? <Badge variant="accent">{project}</Badge> : null}
          </div>
          {senderIdentity.email ? <div className="mt-1 text-xs text-muted-foreground">{senderIdentity.email}</div> : null}
          <div className="mt-1 text-sm font-medium text-card-foreground">{subject}</div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{preview}</div>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="text-xs text-muted-foreground">{time}</span>
        {priorityScore ? <span className="text-[11px] font-semibold text-primary">Priority {priorityScore}</span> : null}
        <div className="flex items-center gap-1 text-muted-foreground">
          {hasTask ? <CheckSquare className="h-4 w-4" /> : null}
          {hasAttachment ? <Paperclip className="h-4 w-4" /> : null}
        </div>
      </div>
    </button>
  );
}
