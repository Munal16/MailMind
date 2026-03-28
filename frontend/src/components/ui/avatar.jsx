import { cn } from "../../lib/utils";

export function Avatar({ initials = "MM", src, alt = "Profile photo", className }) {
  if (src) {
    return <img src={src} alt={alt} className={cn("h-8 w-8 rounded-full border border-border object-cover", className)} />;
  }

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
