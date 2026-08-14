import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { applyTheme, getPreferredTheme, onThemeChange, toggleTheme } from "../lib/theme.js";

const ThemeToggle = ({ className = "" }) => {
  const [theme, setTheme] = useState(() => getPreferredTheme());
  const isDark = theme === "dark";

  useEffect(() => {
    applyTheme(theme);
    return onThemeChange(setTheme);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = () => {
    setTheme(toggleTheme());
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground ${className}`}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
    </button>
  );
};

export default ThemeToggle;
