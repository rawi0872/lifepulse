"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { APPEARANCE_STORAGE_KEY, isThemePreference, type ThemePreference } from "@lifepulse/domain";

export type ResolvedTheme = "light" | "dark";
export type DayCyclePhase = "morning" | "afternoon" | "evening" | "night";

interface LifePulseWebTheme {
  mode: ThemePreference;
  resolved: ResolvedTheme;
  dayCyclePhase: DayCyclePhase | null;
  setMode: (mode: ThemePreference) => void;
}

const ThemeContext = createContext<LifePulseWebTheme>({
  mode: "system",
  resolved: "dark",
  dayCyclePhase: null,
  setMode: () => undefined,
});

function systemResolved(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function dayCyclePhase(): DayCyclePhase {
  if (typeof window === "undefined") return "morning";
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

function dayCycleResolved(phase: DayCyclePhase): ResolvedTheme {
  return phase === "night" ? "dark" : "light";
}

function applyAttributes(resolved: ResolvedTheme, phase: DayCyclePhase | null) {
  document.documentElement.dataset.theme = resolved;
  if (phase) {
    document.documentElement.dataset.dayPhase = phase;
  } else {
    delete document.documentElement.dataset.dayPhase;
  }
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
  const [dayCyclePhaseState, setDayCyclePhaseState] = useState<DayCyclePhase>(() => dayCyclePhase());

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = (event: MediaQueryListEvent) => {
      setSystem(event.matches ? "light" : "dark");
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (mode !== "day_cycle") {
      setDayCyclePhaseState(dayCyclePhase());
      return;
    }
    const update = () => setDayCyclePhaseState(dayCyclePhase());
    update();
    const interval = window.setInterval(update, 60_000);
    return () => window.clearInterval(interval);
  }, [mode]);

  useEffect(() => {
    // Re-resolve day cycle on visibility change (tab wake)
    if (mode !== "day_cycle") return;
    const onVisible = () => {
      if (document.visibilityState === "visible") setDayCyclePhaseState(dayCyclePhase());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [mode]);

  const dayCycleResolvedTheme = dayCycleResolved(dayCyclePhaseState);
  const resolved: ResolvedTheme =
    mode === "system" ? system :
    mode === "day_cycle" ? dayCycleResolvedTheme :
    mode;

  const activePhase: DayCyclePhase | null = mode === "day_cycle" ? dayCyclePhaseState : null;

  useEffect(() => {
    applyAttributes(resolved, activePhase);
  }, [resolved, activePhase]);

  const setMode = useCallback((next: ThemePreference) => {
    setModeState(next);
    try {
      window.localStorage.setItem(APPEARANCE_STORAGE_KEY, next);
    } catch {
      // ignore persistence failures
    }
  }, []);

  const value = useMemo(() => ({ mode, resolved, dayCyclePhase: activePhase, setMode }), [mode, resolved, activePhase, setMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useLifePulseWebTheme(): LifePulseWebTheme {
  return useContext(ThemeContext);
}

/**
 * Inline script injected before paint so the saved/OS theme applies
 * without a dark→light flash. Keep in sync with the provider above.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(APPEARANCE_STORAGE_KEY)};var m=localStorage.getItem(k);var l=window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches;var r=m==="light"?"light":m==="dark"?"dark":m==="day_cycle"?"light":(l?"light":"dark");document.documentElement.dataset.theme=r;}catch(e){}})();`;
