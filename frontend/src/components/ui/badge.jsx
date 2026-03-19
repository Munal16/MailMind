import { cn } from "../../lib/utils";

const variants = {
  high: "bg-urgent/10 text-urgent",
  medium: "bg-warning/10 text-warning",
  low: "bg-success/10 text-success",
  muted: "bg-muted text-muted-foreground",
  accent: "bg-accent text-accent-foreground",
};

export function Badge({ className, variant = "muted", ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
        variants[variant] || variants.muted,
        className
      )}
      {...props}
    />
  );
}
