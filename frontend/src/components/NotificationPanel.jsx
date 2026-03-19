import { Bell, TriangleAlert } from "lucide-react";

export default function NotificationPanel({ title = "Notifications", items = [] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
        <Bell className="h-4 w-4 text-primary" />
        {title}
      </div>
      <div className="mt-4 space-y-3">
        {items.length ? (
          items.map((item) => (
            <div key={item} className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
              <div className="mt-0.5 rounded-full bg-urgent/10 p-1.5 text-urgent">
                <TriangleAlert className="h-3.5 w-3.5" />
              </div>
              <div className="text-sm text-muted-foreground">{item}</div>
            </div>
          ))
        ) : (
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            No active notifications right now.
          </div>
        )}
      </div>
    </div>
  );
}
