import { cn } from "../../lib/utils";

export function Avatar({ initials = "MM", className }) {
  return (
    <div
      className={cn(
        "gradient-primary flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white",
        className
      )}
    >
      {initials}
    </div>
  );
}
