import { Download, FileImage, FileText, FileType2 } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

const typeStyle = {
  pdf: { icon: FileText, className: "bg-urgent/10 text-urgent" },
  image: { icon: FileImage, className: "bg-success/10 text-success" },
  doc: { icon: FileType2, className: "bg-primary/10 text-primary" },
  other: { icon: FileText, className: "bg-muted text-muted-foreground" },
};

export default function AttachmentCard({ name, sender, type, size, date, onDownload }) {
  const key = String(type || "other").toLowerCase();
  const config = typeStyle[key] || typeStyle.other;
  const Icon = config.icon;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", config.className)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-card-foreground">{name}</div>
            <div className="mt-1 text-xs text-muted-foreground">{sender}</div>
            <div className="mt-2 text-xs text-muted-foreground">{size} • {date}</div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onDownload}>
          <Download className="mr-1.5 h-4 w-4" />
          Download
        </Button>
      </div>
    </div>
  );
}
