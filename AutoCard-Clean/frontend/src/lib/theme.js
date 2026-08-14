const THEME_KEY = "techware-theme";
const THEME_EVENT = "techware-theme-change";

export const getPreferredTheme = () => {
  if (typeof window === "undefined") return "light";

  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export const applyTheme = (theme, options = {}) => {
  if (typeof document === "undefined") return;

  const { persist = true } = options;
  const root = document.documentElement;
  const nextTheme = theme === "dark" ? "dark" : "light";
  root.classList.toggle("dark", nextTheme === "dark");
  root.style.colorScheme = nextTheme;

  if (persist && typeof window !== "undefined") {
    localStorage.setItem(THEME_KEY, nextTheme);
    window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: nextTheme }));
  }
};

export const toggleTheme = () => {
  const currentTheme = getPreferredTheme();
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  return nextTheme;
};

export const onThemeChange = (callback) => {
  if (typeof window === "undefined") return () => {};

  const listener = (event) => callback(event.detail);
  window.addEventListener(THEME_EVENT, listener);
  return () => window.removeEventListener(THEME_EVENT, listener);
};
