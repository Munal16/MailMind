import { Clock3, Mail, User } from "lucide-react";
import { cn } from "../lib/utils";

const priorityDot = {
  high: "bg-urgent",
  medium: "bg-warning",
  low: "bg-success",
};

export default function TaskCard({ title, source, deadline, priority, owner, project }) {
  const key = String(priority || "low").toLowerCase();

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover">
      <div className="flex items-start gap-3">
        <span className={cn("mt-1 h-2 w-2 rounded-full", priorityDot[key] || priorityDot.low)} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-card-foreground">{title}</div>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
            <span>{source}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            <span>{deadline}</span>
          </div>
          {owner ? (
            <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              <span>{owner}</span>
            </div>
          ) : null}
          {project ? (
            <div className="mt-2 inline-flex rounded-full bg-accent px-2 py-1 text-[11px] font-medium text-accent-foreground">
              {project}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
