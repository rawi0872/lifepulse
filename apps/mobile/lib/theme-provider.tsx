import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  THEME_STORAGE_KEY,
  isValidThemeMode,
  resolveThemeMode,
  shadowFor,
  themeFor,
} from "./theme";
import type { ResolvedMode, ThemeColors, ThemeMode, ThemeShadow } from "./theme";

export interface LifePulseTheme {
  /** User choice: system / light / dark */
  mode: ThemeMode;
  /** Concrete resolved mode after applying the OS scheme */
  resolvedMode: ResolvedMode;
  colors: ThemeColors;
  shadow: ThemeShadow;
  isDark: boolean;
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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [system, setSystem] = useState<ResolvedMode>(() => systemScheme());

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

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const value = useMemo<LifePulseTheme>(() => {
    const resolvedMode = resolveThemeMode(mode, system);
    return {
      mode,
      resolvedMode,
      colors: themeFor(resolvedMode),
      shadow: shadowFor(resolvedMode),
      isDark: resolvedMode === "dark",
      setMode,
    };
  }, [mode, system, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
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
      setMode: () => undefined,
    };
  }
  return ctx;
}
