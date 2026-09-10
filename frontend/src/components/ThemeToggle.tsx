import { useEffect, useState } from "react";
import { Moon, Sun } from "@phosphor-icons/react";

type Theme = "light" | "dark";

const STORAGE_KEY = "lms-theme";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

function initialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Explicit light/dark switch, ref: Bookary topbar sun/moon icons — persists the
 * user's choice in localStorage so it overrides the OS preference on next visit. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => initialTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <div className="flex items-center rounded-full border border-border bg-background p-0.5">
      <button
        type="button"
        aria-label="Giao diện sáng"
        aria-pressed={theme === "light"}
        onClick={() => {
          setTheme("light");
          localStorage.setItem(STORAGE_KEY, "light");
        }}
        className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
          theme === "light" ? "bg-accent text-accent-foreground" : "text-muted-foreground"
        }`}
      >
        <Sun size={15} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Giao diện tối"
        aria-pressed={theme === "dark"}
        onClick={() => {
          setTheme("dark");
          localStorage.setItem(STORAGE_KEY, "dark");
        }}
        className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
          theme === "dark" ? "bg-accent text-accent-foreground" : "text-muted-foreground"
        }`}
      >
        <Moon size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
