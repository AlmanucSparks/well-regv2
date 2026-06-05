import { useEffect } from "react";

export type Theme = "light" | "dark" | "system";

export function applyTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  return (localStorage.getItem("medireg:theme") as Theme) || "system";
}

/** Mounted once globally so theme + density preferences apply on every page. */
export function ThemeInit() {
  useEffect(() => {
    const theme = getStoredTheme();
    applyTheme(theme);

    const density = localStorage.getItem("medireg:density") || "comfortable";
    document.documentElement.dataset.density = density;

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (getStoredTheme() === "system") applyTheme("system");
    };
    mql.addEventListener("change", onSystemChange);

    const onStorage = (e: StorageEvent) => {
      if (e.key === "medireg:theme") applyTheme(getStoredTheme());
      if (e.key === "medireg:density") {
        document.documentElement.dataset.density =
          localStorage.getItem("medireg:density") || "comfortable";
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      mql.removeEventListener("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return null;
}