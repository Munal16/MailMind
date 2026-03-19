import { CheckSquare, Paperclip } from "lucide-react";
import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";

function urgencyVariant(urgency) {
  const key = String(urgency || "").toLowerCase();
  if (key === "high") return "high";
  if (key === "medium") return "medium";
  return "low";
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
  selected,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex w-full items-start gap-3 border-b border-border px-4 py-4 text-left transition-all hover:bg-accent/30",
        selected && "bg-accent/50 before:absolute before:bottom-0 before:left-0 before:top-0 before:w-0.5 before:bg-primary"
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="gradient-primary mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white">
          {(sender || "?").slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{sender}</span>
            <Badge variant={urgencyVariant(urgency)}>{urgency}</Badge>
            {intent ? <Badge variant="muted">{intent}</Badge> : null}
            {project ? <Badge variant="accent">{project}</Badge> : null}
          </div>
          <div className="mt-1 text-sm font-medium text-card-foreground">{subject}</div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{preview}</div>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="text-xs text-muted-foreground">{time}</span>
        <div className="flex items-center gap-1 text-muted-foreground">
          {hasTask ? <CheckSquare className="h-4 w-4" /> : null}
          {hasAttachment ? <Paperclip className="h-4 w-4" /> : null}
        </div>
      </div>
    </button>
  );
}
