import { Bell, Moon, Sun } from "lucide-react";
import SearchBar from "./SearchBar";
import { SidebarTrigger } from "./ui/sidebar";
import { Avatar } from "./ui/avatar";
import { useTheme } from "../context/ThemeContext";
import BrandLogo from "./BrandLogo";

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="flex h-14 items-center justify-between gap-3 border-b border-border bg-card px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <BrandLogo size="xs" showWordmark={false} className="sm:hidden" />
        <SearchBar className="hidden sm:flex sm:w-80" placeholder="Search emails, tasks, attachments..." />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleTheme}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background transition-all hover:bg-accent/30"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <button
          type="button"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background transition-all hover:bg-accent/30"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-urgent" />
        </button>

        <Avatar initials="JD" className="h-8 w-8" />
      </div>
    </header>
  );
}
