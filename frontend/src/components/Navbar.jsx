import { Bell, MoonStar, Sun, UserCircle2 } from "lucide-react";
import SearchBar from "./SearchBar";
import { useTheme } from "../context/ThemeContext";

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300/20 px-4 py-3 dark:border-slate-700">
      <div className="w-full max-w-lg">
        <SearchBar placeholder="Global search emails, tasks, attachments..." />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button className="rounded-xl border border-slate-300/20 p-2 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
          <Bell className="h-4 w-4" />
        </button>
        <button
          onClick={toggleTheme}
          className="rounded-xl border border-slate-300/20 p-2 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
        </button>
        <div className="rounded-xl border border-slate-300/20 bg-white px-3 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <UserCircle2 className="h-4 w-4" />
            Sarah Malik
          </div>
        </div>
      </div>
    </header>
  );
}
