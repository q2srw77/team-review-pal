import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "theme-preference";
const USER_OVERRIDE_KEY = "theme-user-override";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [userPrefLoaded, setUserPrefLoaded] = useState(false);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  // Load app-wide default theme (used when user has no override)
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "default_theme")
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const val = (data as { value?: unknown } | null)?.value;
        const def = val === "dark" ? "dark" : val === "light" ? "light" : null;
        if (!def) return;
        // Only apply default if no per-user override and user hasn't loaded their pref
        if (!user && localStorage.getItem(USER_OVERRIDE_KEY) !== "1") {
          setTheme(def);
        }
      });
    return () => { cancelled = true; };
  }, [user]);

  // Load saved user preference when logged in
  useEffect(() => {
    if (!user) {
      setUserPrefLoaded(false);
      return;
    }
    supabase
      .from("user_settings")
      .select("theme_preference")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const pref = (data as { theme_preference?: Theme } | null)?.theme_preference;
        if (pref === "light" || pref === "dark") {
          setTheme(pref);
          localStorage.setItem(USER_OVERRIDE_KEY, "1");
        }
        setUserPrefLoaded(true);
      });
  }, [user]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      localStorage.setItem(USER_OVERRIDE_KEY, "1");
      if (user) {
        supabase
          .from("user_settings")
          .upsert({ user_id: user.id, theme_preference: next }, { onConflict: "user_id" })
          .then(() => {});
      }
      return next;
    });
  };

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
