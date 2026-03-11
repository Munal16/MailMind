import { Search } from "lucide-react";

export default function SearchBar({ value, onChange, placeholder = "Search..." }) {
  return (
    <div className="flex w-full items-center gap-2 rounded-xl border border-slate-300/20 bg-white/60 px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
      <Search className="h-4 w-4 text-slate-500" />
      <input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
      />
    </div>
  );
}
