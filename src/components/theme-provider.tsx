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

function dayCycleResolved(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  const hour = new Date().getHours();
  // night: 21-5, morning: 5-12, afternoon: 12-17, evening: 17-21
  return (hour >= 21 || hour < 5) ? "dark" : "light";
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
  const [dayCycle, setDayCycle] = useState<ResolvedTheme>(() => dayCycleResolved());

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = (event: MediaQueryListEvent) => {
      setSystem(event.matches ? "light" : "dark");
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (mode !== "day_cycle") return;
    const update = () => setDayCycle(dayCycleResolved());
    update();
    const interval = window.setInterval(update, 60_000);
    return () => window.clearInterval(interval);
  }, [mode]);

  useEffect(() => {
    // Re-resolve day cycle on visibility change (tab wake)
    if (mode !== "day_cycle") return;
    const onVisible = () => {
      if (document.visibilityState === "visible") setDayCycle(dayCycleResolved());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [mode]);

  const resolved: ResolvedTheme =
    mode === "system" ? system :
    mode === "day_cycle" ? dayCycle :
    mode;

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
