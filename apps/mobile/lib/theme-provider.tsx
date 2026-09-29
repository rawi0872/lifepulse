import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as NavigationBar from "expo-navigation-bar";
import {
  THEME_STORAGE_KEY,
  isValidThemeMode,
  resolveThemeMode,
  shadowFor,
  themeFor,
  themeForDayCycle,
  resolveDayCyclePhase,
} from "./theme";
import type { ResolvedMode, ThemeColors, ThemeMode, ThemeShadow, DayCyclePhase } from "./theme";

export interface LifePulseTheme {
  /** User choice: system / light / dark / day_cycle */
  mode: ThemeMode;
  /** Concrete resolved mode after applying the OS scheme or day cycle */
  resolvedMode: ResolvedMode;
  colors: ThemeColors;
  shadow: ThemeShadow;
  isDark: boolean;
  /** Current day cycle phase (only relevant when mode === "day_cycle") */
  dayCyclePhase: DayCyclePhase | null;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<LifePulseTheme | null>(null);

function systemScheme(): ResolvedMode {
  try {
    return Appearance.getColorScheme() === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function applyNavigationBarColors(colors: ThemeColors) {
  // Edge-to-edge: paint the Android gesture/nav strip with the current
  // theme surface so it blends; icon style follows the palette's contrast.
  NavigationBar.setBackgroundColorAsync(colors.bg).catch(() => undefined);
  NavigationBar.setButtonStyleAsync(colors.statusBar).catch(() => undefined);
}

/* eslint-disable react-hooks/set-state-in-effect -- mode change response is intentional */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [system, setSystem] = useState<ResolvedMode>(() => systemScheme());
  const [dayCyclePhase, setDayCyclePhase] = useState<DayCyclePhase | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (mounted && isValidThemeMode(raw)) setModeState(raw);
      } catch {
        // persistence is best-effort; theme still works in-memory
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystem(colorScheme === "light" ? "light" : "dark");
    });
    return () => sub.remove();
  }, []);

  // Day Cycle: recompute phase on mode change so the switch is immediate
  useEffect(() => {
    if (mode === "day_cycle") {
      setDayCyclePhase(resolveDayCyclePhase(new Date()));
    } else {
      setDayCyclePhase(null);
    }
  }, [mode]);

  // Day Cycle: advance the phase when local time crosses a boundary.
  // Re-arms via the dayCyclePhase dep: each firing updates the phase,
  // which reschedules the timer for the following boundary.
  useEffect(() => {
    if (mode !== "day_cycle") return;
    const now = new Date();
    const delay = Math.max(1000, getNextDayCycleBoundary(now) - now.getTime());
    const timeout = setTimeout(() => {
      setDayCyclePhase(resolveDayCyclePhase(new Date()));
    }, delay);
    return () => clearTimeout(timeout);
  }, [mode, dayCyclePhase]);

  // Day Cycle: re-resolve when the app returns from background
  useEffect(() => {
    if (mode !== "day_cycle") return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setDayCyclePhase(resolveDayCyclePhase(new Date()));
    });
    return () => sub.remove();
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const value = useMemo<LifePulseTheme>(() => {
    const resolvedMode = resolveThemeMode(mode, system);
    let colors: ThemeColors;
    let phase: DayCyclePhase | null = null;

    if (mode === "day_cycle") {
      phase = dayCyclePhase ?? resolveDayCyclePhase(new Date());
      colors = themeForDayCycle(phase);
    } else {
      colors = themeFor(resolvedMode);
    }

    return {
      mode,
      resolvedMode,
      colors,
      shadow: shadowFor(resolvedMode),
      isDark: resolvedMode === "dark",
      dayCyclePhase: phase,
      setMode,
    };
  }, [mode, system, dayCyclePhase, setMode]);

  // Paint the Android system gesture/nav strip from the resolved palette.
  // Effect-only: never mutate native state during render.
  useEffect(() => {
    applyNavigationBarColors(value.colors);
  }, [value.colors]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function getNextDayCycleBoundary(date: Date): number {
  const hour = date.getHours();
  const nextBoundaryHour = (() => {
    if (hour < 5) return 5;
    if (hour < 12) return 12;
    if (hour < 17) return 17;
    if (hour < 21) return 21;
    return 29; // next day 5am (24 + 5)
  })();
  const boundary = new Date(date);
  boundary.setHours(nextBoundaryHour, 0, 0, 0);
  if (boundary <= date) boundary.setDate(boundary.getDate() + 1);
  return boundary.getTime();
}

/**
 * Preferred API for all Life Pulse screens/components.
 * Returns mode + resolvedMode + colors + shadow; re-renders on switch.
 */
export function useLifePulseTheme(): LifePulseTheme {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback keeps unit tests / unmounted trees working in dark default.
    return {
      mode: "system",
      resolvedMode: "dark",
      colors: themeFor("dark"),
      shadow: shadowFor("dark"),
      isDark: true,
      dayCyclePhase: null,
      setMode: () => undefined,
    };
  }
  return ctx;
}
