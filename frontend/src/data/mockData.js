export const widgets = [
  { title: "Total Emails", value: "2,486", trend: "+12% vs last week" },
  { title: "Urgent Emails", value: "118", trend: "+4 today" },
  { title: "Pending Tasks", value: "43", trend: "7 due today" },
  { title: "Attachments", value: "612", trend: "+23 this week" },
];

export const emails = [
  { id: "e1", sender: "Alex Rivera", subject: "Client escalation on payment delay", preview: "Need immediate clarification before 4 PM.", timestamp: "10:24 AM", urgency: "High", intent: "Payment", project: "FinOps", task: true },
  { id: "e2", sender: "Nina Patel", subject: "Weekly sprint planning meeting", preview: "Agenda includes timeline and blockers.", timestamp: "9:02 AM", urgency: "Medium", intent: "Meeting", project: "Product", task: true },
  { id: "e3", sender: "Ops Bot", subject: "Delivery confirmation for signed contract", preview: "Courier marked package as delivered.", timestamp: "Yesterday", urgency: "Low", intent: "Delivery", project: "Legal", task: false },
  { id: "e4", sender: "Support Desk", subject: "API integration issue report", preview: "Customer seeing timeout in callback endpoint.", timestamp: "Yesterday", urgency: "High", intent: "Support", project: "Platform", task: true },
  { id: "e5", sender: "Board Office", subject: "Q2 strategy memo", preview: "Please review attached presentation and notes.", timestamp: "Mon", urgency: "Medium", intent: "General", project: "Leadership", task: false },
];

export const tasks = {
  pending: [
    { id: "t1", title: "Reply to payment escalation", source: "Alex Rivera", deadline: "Today 4:00 PM", priority: "High" },
    { id: "t2", title: "Send meeting recap", source: "Nina Patel", deadline: "Today 6:00 PM", priority: "Medium" },
  ],
  progress: [
    { id: "t3", title: "Investigate API timeout logs", source: "Support Desk", deadline: "Tomorrow", priority: "High" },
  ],
  completed: [
    { id: "t4", title: "Confirm contract delivery", source: "Ops Bot", deadline: "Done", priority: "Low" },
  ],
};

export const attachments = [
  { id: "a1", name: "invoice_q2.pdf", sender: "Finance Team", type: "PDF", project: "FinOps", date: "2026-03-08" },
  { id: "a2", name: "sprint_plan.xlsx", sender: "Nina Patel", type: "Spreadsheet", project: "Product", date: "2026-03-07" },
  { id: "a3", name: "contract_scan.png", sender: "Legal Ops", type: "Image", project: "Legal", date: "2026-03-05" },
];

export const contacts = [
  { name: "Nina Patel", count: 42 },
  { name: "Alex Rivera", count: 37 },
  { name: "Support Desk", count: 30 },
  { name: "Board Office", count: 24 },
];

export const insights = [
  "Support-related emails increased 18% this week.",
  "Average response time improved by 22 minutes.",
  "Payment emails have the highest urgency concentration.",
];

export const chartData = {
  urgency: {
    labels: ["High", "Medium", "Low"],
    values: [118, 420, 1948],
  },
  intent: {
    labels: ["Meeting", "Payment", "Support", "Delivery", "General"],
    values: [520, 310, 265, 148, 1243],
  },
  timeline: {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    values: [210, 340, 298, 410, 389, 260, 195],
  },
};
