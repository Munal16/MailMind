import { Search } from "lucide-react";
import { cn } from "../lib/utils";

export default function SearchBar({
  value = "",
  onChange,
  placeholder = "Search emails, tasks, attachments...",
  className,
  inputClassName,
  onKeyDown,
  onFocus,
  onBlur,
  inputRef,
  ...props
}) {
  return (
    <div className={cn("relative flex w-full items-center", className)}>
      <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        className={cn(
          "h-10 w-full rounded-lg border border-input bg-muted/50 pl-10 pr-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:ring-2 focus:ring-ring",
          inputClassName
        )}
        {...props}
      />
    </div>
  );
}
