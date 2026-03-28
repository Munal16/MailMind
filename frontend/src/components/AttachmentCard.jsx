import { Archive, Download, Eye, FileImage, FileText, FileType2, Paperclip } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

const typeStyle = {
  pdf: { icon: FileText, className: "bg-urgent/10 text-urgent", label: "PDF" },
  image: { icon: FileImage, className: "bg-success/10 text-success", label: "Image" },
  doc: { icon: FileType2, className: "bg-primary/10 text-primary", label: "Document" },
  spreadsheet: { icon: FileType2, className: "bg-primary/10 text-primary", label: "Spreadsheet" },
  presentation: { icon: FileType2, className: "bg-secondary/10 text-secondary", label: "Presentation" },
  text: { icon: FileText, className: "bg-muted text-muted-foreground", label: "Text" },
  archive: { icon: Archive, className: "bg-warning/10 text-warning", label: "Archive" },
  audio: { icon: Paperclip, className: "bg-warning/10 text-warning", label: "Audio" },
  video: { icon: Paperclip, className: "bg-warning/10 text-warning", label: "Video" },
  other: { icon: Paperclip, className: "bg-muted text-muted-foreground", label: "File" },
};

export default function AttachmentCard({
  heading,
  name,
  sender,
  type,
  extension,
  size,
  dateLabel,
  project,
  emailSubject,
  onDownload,
  onOpen,
}) {
  const key = String(type || "other").toLowerCase();
  const config = typeStyle[key] || typeStyle.other;
  const Icon = config.icon;

  return (
    <article className="rounded-[1.4rem] border border-border bg-card/95 p-5 shadow-card transition-all hover:-translate-y-1 hover:border-primary/20 hover:shadow-card-hover">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.15rem]", config.className)}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="line-clamp-2 text-[0.95rem] font-semibold leading-6 text-card-foreground">{heading || name}</div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Source email</div>
            <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{emailSubject || sender}</div>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          {onOpen ? (
            <Button variant="ghost" size="icon" onClick={onOpen} aria-label="Open source email">
              <Eye className="h-4 w-4" />
            </Button>
          ) : null}
          <Button variant="outline" size="icon" onClick={onDownload} aria-label={`Download ${name}`}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", config.className)}>
          {config.label}
        </span>
        {extension ? (
          <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">{extension}</span>
        ) : null}
        {project ? (
          <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-medium text-accent-foreground">{project}</span>
        ) : null}
      </div>

      <div className="mt-4 rounded-[1rem] border border-border bg-background/70 px-3 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Attachment details</div>
        <div className="mt-2 line-clamp-2 text-xs font-medium leading-5 text-card-foreground">{name}</div>
        <div className="mt-1 line-clamp-1 text-xs leading-5 text-muted-foreground">{sender || "Unknown sender"}</div>
        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{size}</span>
          <span>{dateLabel}</span>
        </div>
      </div>
    </article>
  );
}
