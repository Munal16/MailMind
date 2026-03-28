import { cn } from "../lib/utils";

const colorClasses = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  urgent: "bg-urgent/10 text-urgent",
};

const changeClasses = {
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  urgent: "text-urgent",
  muted: "text-muted-foreground",
};

export default function DashboardWidget({
  title,
  value,
  change,
  icon: Icon,
  color = "primary",
  changeTone = "success",
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-card-foreground">{value}</p>
          {change ? (
            <p className={cn("mt-2 text-xs font-medium", changeClasses[changeTone] || changeClasses.success)}>{change}</p>
          ) : null}
        </div>
        {Icon ? (
          <div className={cn("rounded-lg p-2.5", colorClasses[color] || colorClasses.primary)}>
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
