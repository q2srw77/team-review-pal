import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  themeReady: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const APP_DEFAULT_KEY = "app-default-theme";
const LAST_USER_KEY = "theme-last-user-id";
const userKey = (uid: string) => `theme-preference:${uid}`;
const ANON_KEY = "theme-preference:anon";

function readLS(key: string): Theme | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(key);
  return v === "light" || v === "dark" ? v : null;
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.setAttribute("data-theme", theme);
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const lastUid = localStorage.getItem(LAST_USER_KEY);
  const userPref = lastUid ? readLS(userKey(lastUid)) : null;
  if (userPref) return userPref;
  const anon = readLS(ANON_KEY);
  if (anon) return anon;
  const def = readLS(APP_DEFAULT_KEY);
  if (def) return def;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const [themeReady, setThemeReady] = useState(false);
  const lastUserIdRef = useRef<string | null>(null);

  // Apply theme to DOM whenever it changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Mark anonymous as ready immediately once auth has resolved with no user
  useEffect(() => {
    if (!authLoading && !user) setThemeReady(true);
  }, [authLoading, user]);

  // Fetch app default theme and cache it for the pre-paint script
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
        const def: Theme | null = val === "dark" ? "dark" : val === "light" ? "light" : null;
        if (!def) return;
        localStorage.setItem(APP_DEFAULT_KEY, def);
        // Only apply for anonymous users with no cached preference
        if (!user && !readLS(ANON_KEY) && !lastUserIdRef.current) {
          setThemeState(def);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // When user logs in: synchronously apply cached pref, then reconcile from DB
  useEffect(() => {
    if (!user) return;
    lastUserIdRef.current = user.id;
    localStorage.setItem(LAST_USER_KEY, user.id);

    const cached = readLS(userKey(user.id));
    if (cached) {
      setThemeState(cached);
      setThemeReady(true);
    }

    supabase
      .from("user_settings")
      .select("theme_preference")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const pref = (data as { theme_preference?: Theme } | null)?.theme_preference;
        if (pref === "light" || pref === "dark") {
          setThemeState(pref);
          localStorage.setItem(userKey(user.id), pref);
        }
        setThemeReady(true);
      });
  }, [user]);

  // On sign-out, clear last-user pointer so anon default applies next
  const prevUserRef = useRef(user);
  useEffect(() => {
    if (prevUserRef.current && !user) {
      localStorage.removeItem(LAST_USER_KEY);
      lastUserIdRef.current = null;
    }
    prevUserRef.current = user;
  }, [user]);

  const toggleTheme = () => {
    setThemeState((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      if (user) {
        localStorage.setItem(userKey(user.id), next);
        localStorage.setItem(LAST_USER_KEY, user.id);
        supabase
          .from("user_settings")
          .upsert({ user_id: user.id, theme_preference: next }, { onConflict: "user_id" })
          .then(() => {});
      } else {
        localStorage.setItem(ANON_KEY, next);
      }
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, themeReady }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
