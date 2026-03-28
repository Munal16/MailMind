export const searchDestinations = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Overview, workload, and live workspace metrics",
    to: "/app/dashboard",
    keywords: ["home", "overview", "summary", "dashboard", "metrics", "insights"],
    iconKey: "dashboard",
  },
  {
    id: "inbox",
    label: "Inbox",
    description: "Read synced emails and review AI triage labels",
    to: "/app/inbox",
    keywords: ["mail", "message", "inbox", "emails", "read", "unread"],
    iconKey: "inbox",
  },
  {
    id: "priority",
    label: "Priority Emails",
    description: "High-urgency queue and priority reasons",
    to: "/app/priority",
    keywords: ["priority", "urgent", "high urgency", "follow up", "attention"],
    iconKey: "priority",
  },
  {
    id: "tasks",
    label: "Tasks Extracted",
    description: "Extracted actions, deadlines, and responsibility cues",
    to: "/app/tasks",
    keywords: ["task", "todo", "deadline", "follow up", "action", "responsibility"],
    iconKey: "tasks",
  },
  {
    id: "attachments",
    label: "Attachments",
    description: "Files, images, PDFs, and shared documents",
    to: "/app/attachments",
    keywords: ["file", "attachment", "document", "pdf", "image", "png", "jpg"],
    iconKey: "attachments",
  },
  {
    id: "analytics",
    label: "Analytics",
    description: "Intent, urgency, trends, and workspace activity",
    to: "/app/analytics",
    keywords: ["analytics", "stats", "chart", "insights", "trend"],
    iconKey: "analytics",
  },
  {
    id: "settings",
    label: "Settings",
    description: "Profile, notifications, Gmail connection, and security",
    to: "/app/settings",
    keywords: ["settings", "profile", "preferences", "account", "security"],
    iconKey: "settings",
  },
  {
    id: "admin",
    label: "Admin Panel",
    description: "System health, users, model readiness, and activity",
    to: "/app/admin",
    keywords: ["admin", "system", "health", "users", "monitoring", "logs", "diagnostics"],
    iconKey: "admin",
    adminOnly: true,
  },
];

export function filterSearchDestinations(query, options = {}) {
  const includeAdmin = Boolean(options.includeAdmin);
  const normalized = String(query || "").trim().toLowerCase();

  const available = searchDestinations.filter((item) => includeAdmin || !item.adminOnly);

  if (!normalized) {
    return available.slice(0, includeAdmin ? 5 : 4);
  }

  return available.filter((item) => {
    const haystack = `${item.label} ${item.description} ${item.keywords.join(" ")}`.toLowerCase();
    return haystack.includes(normalized);
  });
}
