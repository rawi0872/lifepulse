"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { APPEARANCE_STORAGE_KEY, isThemePreference, type ThemePreference } from "@lifepulse/domain";

export type ResolvedTheme = "light" | "dark";

interface LifePulseWebTheme {
  mode: ThemePreference;
  resolved: ResolvedTheme;
  setMode: (mode: ThemePreference) => void;
}

const ThemeContext = createContext<LifePulseWebTheme>({
  mode: "system",
  resolved: "dark",
  setMode: () => undefined,
});

function systemResolved(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyAttribute(resolved: ResolvedTheme) {
  document.documentElement.dataset.theme = resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemePreference>(() => {
    try {
      const raw = typeof window === "undefined" ? null : window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
      return isThemePreference(raw) ? raw : "system";
    } catch {
      return "system";
    }
  });
  const [system, setSystem] = useState<ResolvedTheme>(() => systemResolved());

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = (event: MediaQueryListEvent) => {
      setSystem(event.matches ? "light" : "dark");
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const resolved: ResolvedTheme = mode === "system" ? system : mode;

  useEffect(() => {
    applyAttribute(resolved);
  }, [resolved]);

  const setMode = useCallback((next: ThemePreference) => {
    setModeState(next);
    try {
      window.localStorage.setItem(APPEARANCE_STORAGE_KEY, next);
    } catch {
      // ignore persistence failures
    }
  }, []);

  const value = useMemo(() => ({ mode, resolved, setMode }), [mode, resolved, setMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useLifePulseWebTheme(): LifePulseWebTheme {
  return useContext(ThemeContext);
}

/**
 * Inline script injected before paint so the saved/OS theme applies
 * without a dark→light flash. Keep in sync with the provider above.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(APPEARANCE_STORAGE_KEY)};var m=localStorage.getItem(k);var l=window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches;var r=m==="light"?"light":m==="dark"?"dark":(l?"light":"dark");document.documentElement.dataset.theme=r;}catch(e){}})();`;
