// Life Pulse dual premium theme tests (Prompt 1/2).
// Deterministic: token resolution/persistence pure logic + source-structure
// assertions that every screen is theme-aware with no dark-only literals.
// Run: `node --loader ./scripts/ts-extension-loader.mjs --test scripts/test-theme-v1.mjs`
// from apps/mobile.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  THEME_STORAGE_KEY,
  THEME_COLOR_KEYS,
  darkColors,
  lightColors,
  morningColors,
  afternoonColors,
  eveningColors,
  nightColors,
  isValidThemeMode,
  resolveThemeMode,
  resolveDayCyclePhase,
  themeFor,
  themeForDayCycle,
  statusBarFor,
  shadowFor,
} from "../lib/theme.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, "..");
const read = (rel) => readFileSync(path.join(appDir, rel), "utf8");

const THEMED_SCREENS = [
  "app/(tabs)/today.tsx",
  "app/(tabs)/nextron.tsx",
  "app/(tabs)/tasks.tsx",
  "app/(tabs)/habits.tsx",
  "app/(tabs)/more.tsx",
  "app/(tabs)/settings.tsx",
  "app/(tabs)/account.tsx",
  "app/realms.tsx",
  "app/body.tsx",
  "app/wealth.tsx",
  "app/health.tsx",
  "app/login.tsx",
  "app/signup.tsx",
  "app/forgot-password.tsx",
  "app/index.tsx",
  "app/loading.tsx",
  "app/_layout.tsx",
  "app/(tabs)/_layout.tsx",
  "src/components/ui.tsx",
  "src/components/ItemActionSheet.tsx",
  "src/components/ConfirmDeleteDialog.tsx",
  "src/components/TodayHeroArt.tsx",
];

describe("theme mode resolution (system/light/dark)", () => {
  it("explicit light/dark win over the OS scheme", () => {
    assert.equal(resolveThemeMode("light", "dark"), "light");
    assert.equal(resolveThemeMode("light", "light"), "light");
    assert.equal(resolveThemeMode("dark", "light"), "dark");
    assert.equal(resolveThemeMode("dark", "dark"), "dark");
  });

  it("system follows the device scheme, defaulting to dark", () => {
    assert.equal(resolveThemeMode("system", "light"), "light");
    assert.equal(resolveThemeMode("system", "dark"), "dark");
    assert.equal(resolveThemeMode("system", null), "dark");
    assert.equal(resolveThemeMode("system", undefined), "dark");
  });

  it("only system/light/dark/day_cycle persist as valid preferences", () => {
    assert.ok(isValidThemeMode("system"));
    assert.ok(isValidThemeMode("light"));
    assert.ok(isValidThemeMode("dark"));
    assert.ok(isValidThemeMode("day_cycle"));
    assert.ok(!isValidThemeMode("auto"));
    assert.ok(!isValidThemeMode(""));
    assert.ok(!isValidThemeMode(null));
    assert.ok(!isValidThemeMode(undefined));
  });

  it("storage key is stable so the choice survives restarts", () => {
    assert.equal(THEME_STORAGE_KEY, "lifepulse:appearance");
    const provider = read("lib/theme-provider.tsx");
    assert.ok(provider.includes("THEME_STORAGE_KEY"), "provider never references the storage key");
    assert.ok(read("lib/theme.ts").includes('"lifepulse:appearance"'), "storage key literal missing from tokens");
  });
});

describe("dark/light token sets", () => {
  it("both palettes expose every required color key (no missing keys)", () => {
    for (const key of THEME_COLOR_KEYS) {
      assert.ok(key in darkColors, `dark missing ${key}`);
      assert.ok(key in lightColors, `light missing ${key}`);
      assert.equal(typeof darkColors[key], "string", `dark ${key} not a string`);
      assert.equal(typeof lightColors[key], "string", `light ${key} not a string`);
    }
  });

  it("dark is Signature Pulse (near-black navy, electric blue)", () => {
    assert.equal(darkColors.bg, "#030A13");
    assert.equal(darkColors.accent, "#69B7FF");
    assert.equal(darkColors.statusBar, "light");
  });

  it("light is Warm Human Premium (warm ivory, deep navy text, calm blue)", () => {
    assert.equal(lightColors.bg, "#FBF8F2");
    assert.equal(lightColors.textPrimary, "#0B1930");
    assert.equal(lightColors.accent, "#4F83B8");
    assert.equal(lightColors.statusBar, "dark");
  });

  it("light text is deep navy, never pure black", () => {
    assert.ok(!Object.values(lightColors).includes("#000000"));
    assert.ok(!Object.values(lightColors).includes("#000"));
  });

  it("dark base is navy, never flat pure black", () => {
    assert.notEqual(darkColors.bg, "#000000");
    assert.notEqual(darkColors.bg, "#000");
  });

  it("themeFor switches immediately between distinct sets", () => {
    assert.notEqual(themeFor("dark").bg, themeFor("light").bg);
    assert.equal(themeFor("dark").bg, darkColors.bg);
    assert.equal(themeFor("light").bg, lightColors.bg);
  });

  it("status bar follows the resolved mode", () => {
    assert.equal(statusBarFor("dark"), "light");
    assert.equal(statusBarFor("light"), "dark");
  });

  it("shadows are theme-aware (warm/shallow light, dark depth)", () => {
    assert.notEqual(shadowFor("dark").card.shadowColor, shadowFor("light").card.shadowColor);
    assert.ok(shadowFor("light").card.shadowOpacity < shadowFor("dark").card.shadowOpacity);
  });
});

describe("theme provider wiring", () => {
  const provider = read("lib/theme-provider.tsx");

  it("exports ThemeProvider and useLifePulseTheme", () => {
    assert.ok(provider.includes("export function ThemeProvider"));
    assert.ok(provider.includes("export function useLifePulseTheme"));
  });

  it("persists the choice and restores it on launch", () => {
    assert.ok(provider.includes("AsyncStorage"), "no AsyncStorage persistence");
    assert.ok(provider.includes("getItem"), "never restores the saved mode");
    assert.ok(provider.includes("setItem"), "never saves the mode");
  });

  it("system mode subscribes to OS appearance changes", () => {
    assert.ok(provider.includes("Appearance"), "no native Appearance usage");
    assert.ok(provider.includes("addChangeListener"), "never follows live OS changes");
  });

  it("root layout mounts the provider with a dynamic status bar", () => {
    const layout = read("app/_layout.tsx");
    assert.ok(layout.includes("ThemeProvider"), "provider not mounted");
    assert.ok(!layout.includes('style="light"'), "status bar still hardcoded to light");
    assert.ok(layout.includes("colors.statusBar"), "status bar not driven by theme tokens");
  });
});

describe("screens consume the theme hook", () => {
  for (const file of THEMED_SCREENS) {
    it(`${file} renders from useLifePulseTheme()`, () => {
      const src = read(file);
      assert.ok(src.includes("useLifePulseTheme"), `${file} never calls useLifePulseTheme()`);
    });
  }

  it("no screen imports the legacy static colors object", () => {
    const offenders = [];
    for (const file of [...THEMED_SCREENS, "app/(tabs)/today.tsx"]) {
      const src = read(file);
      if (/import\s*\{[^}]*\bcolors\b[^}]*\}\s*from\s*["'][^"']*lib\/theme["']/.test(src)) offenders.push(file);
    }
    assert.deepEqual(offenders, [], `static colors import remains: ${offenders.join(", ")}`);
  });
});

describe("theme-aware sheets, dialogs, modals", () => {
  it("action sheet is theme-aware with destructive delete", () => {
    const src = read("src/components/ItemActionSheet.tsx");
    assert.ok(src.includes("useLifePulseTheme"), "sheet ignores the theme");
    assert.ok(src.includes("colors.surface"), "sheet surface not tokenized");
    assert.ok(src.includes("colors.danger"), "sheet delete not destructive red");
  });

  it("delete confirmation is theme-aware", () => {
    const src = read("src/components/ConfirmDeleteDialog.tsx");
    assert.ok(src.includes("useLifePulseTheme"), "dialog ignores the theme");
    assert.ok(src.includes("colors.backdrop"), "dialog backdrop not tokenized");
    assert.ok(src.includes("colors.onDanger"), "dialog confirm label not on-danger token");
  });

  it("wealth modals render from theme tokens, not literals", () => {
    const src = read("app/wealth.tsx");
    assert.ok(src.includes("useLifePulseTheme"), "wealth ignores the theme");
    assert.ok(src.includes("colors.backdrop"), "wealth modal backdrop not tokenized");
  });
});

describe("day cycle appearance", () => {
  const atHour = (h) => {
    const d = new Date(2026, 8, 29);
    d.setHours(h, 30, 0, 0);
    return d;
  };

  it("phase boundaries match the contract", () => {
    assert.equal(resolveDayCyclePhase(atHour(4)), "night");
    assert.equal(resolveDayCyclePhase(atHour(5)), "morning");
    assert.equal(resolveDayCyclePhase(atHour(11)), "morning");
    assert.equal(resolveDayCyclePhase(atHour(12)), "afternoon");
    assert.equal(resolveDayCyclePhase(atHour(16)), "afternoon");
    assert.equal(resolveDayCyclePhase(atHour(17)), "evening");
    assert.equal(resolveDayCyclePhase(atHour(20)), "evening");
    assert.equal(resolveDayCyclePhase(atHour(21)), "night");
    assert.equal(resolveDayCyclePhase(atHour(0)), "night");
  });

  it("day_cycle resolves by time, never by device scheme", () => {
    const afternoon = new Date(2026, 8, 29, 13, 0, 0, 0);
    const night = new Date(2026, 8, 29, 23, 0, 0, 0);
    // Phone dark at 13:00 → day_cycle still resolves light (afternoon)
    assert.equal(resolveThemeMode("day_cycle", "dark", afternoon), "light");
    assert.equal(resolveThemeMode("day_cycle", "light", afternoon), "light");
    assert.equal(resolveThemeMode("day_cycle", "dark", night), "dark");
    // System follows the device scheme in the same situation
    assert.equal(resolveThemeMode("system", "dark", afternoon), "dark");
    assert.equal(resolveThemeMode("system", "light", afternoon), "light");
  });

  it("every phase palette exposes every required color key", () => {
    for (const [name, palette] of [["morning", morningColors], ["afternoon", afternoonColors], ["evening", eveningColors], ["night", nightColors]]) {
      for (const key of THEME_COLOR_KEYS) {
        assert.ok(key in palette, `${name} missing ${key}`);
      }
    }
  });

  it("night reuses Signature Pulse; day phases stay light with dark status foreground", () => {
    assert.equal(nightColors.bg, darkColors.bg);
    for (const palette of [morningColors, afternoonColors, eveningColors]) {
      assert.equal(palette.statusBar, "dark");
      assert.ok(!Object.values(palette).includes("#000000"));
      assert.ok(!Object.values(palette).includes("#000"));
    }
  });

  it("themeForDayCycle maps each phase to its palette", () => {
    assert.equal(themeForDayCycle("morning"), morningColors);
    assert.equal(themeForDayCycle("afternoon"), afternoonColors);
    assert.equal(themeForDayCycle("evening"), eveningColors);
    assert.equal(themeForDayCycle("night"), nightColors);
  });

  it("provider paints the Android nav strip and never touches device settings", () => {
    const provider = read("lib/theme-provider.tsx");
    assert.ok(provider.includes("expo-navigation-bar"), "provider never imports the nav-bar API");
    assert.ok(provider.includes("setBackgroundColorAsync"), "provider never sets the nav background");
    assert.ok(provider.includes("setButtonStyleAsync"), "provider never sets the nav icon style");
    assert.ok(!provider.includes("cmd uimode"), "provider must not shell out to device settings");
    assert.ok(!provider.includes("Settings.Global"), "provider must not write global settings");
  });

  it("provider re-resolves on foreground resume and phase boundaries", () => {
    const provider = read("lib/theme-provider.tsx");
    assert.ok(provider.includes("AppState"), "provider never listens for foreground resume");
    assert.ok(provider.includes("getNextDayCycleBoundary") || provider.includes("setTimeout"), "provider never schedules boundary refresh");
  });
});

describe("appearance selector", () => {
  const settings = read("app/(tabs)/settings.tsx");

  it("offers System / Light / Dark / Day Cycle and applies immediately", () => {
    assert.ok(settings.includes('"system"'), "system option missing");
    assert.ok(settings.includes('"light"'), "light option missing");
    assert.ok(settings.includes('"dark"'), "dark option missing");
    assert.ok(settings.includes('"day_cycle"'), "day_cycle option missing");
    assert.ok(settings.includes("setMode"), "selector never applies the choice");
  });

  it("shows the resolved day-cycle phase when Day Cycle is active", () => {
    assert.ok(settings.includes("dayCyclePhase"), "settings never reads the resolved phase");
    assert.ok(settings.includes("Day Cycle ·"), "settings never labels the active phase");
  });

  it("no new permanent navigation item was added", () => {
    const tabs = read("app/(tabs)/_layout.tsx");
    for (const name of ["today", "nextron", "tasks", "habits", "more"]) {
      assert.ok(tabs.includes(name), `tab ${name} missing`);
    }
    assert.ok(!tabs.includes("appearance"), "appearance leaked into the tab bar");
  });
});

describe("today hero atmosphere", () => {
  it("bundled illustration exists and is theme-aware", () => {
    const art = read("src/components/TodayHeroArt.tsx");
    assert.ok(art.includes("resolvedMode") || art.includes("useLifePulseTheme"), "hero art ignores the theme");
    assert.ok(read("app/(tabs)/today.tsx").includes("TodayHeroArt"), "today never renders the hero art");
  });

  it("no text is baked into the illustration", () => {
    const art = read("src/components/TodayHeroArt.tsx");
    assert.ok(!art.includes("<Text"), "hero art bakes in text");
  });

  it("renders a distinct variant per day-cycle phase", () => {
    const art = read("src/components/TodayHeroArt.tsx");
    for (const phase of ["morning", "afternoon", "evening", "night"]) {
      assert.ok(art.includes(`"${phase}"`) || art.includes(`'${phase}'`), `hero art has no ${phase} variant`);
    }
    assert.ok(art.includes("dayCyclePhase"), "hero art never reads the resolved phase");
  });
});

describe("no dark-only literals outside the token file", () => {
  const SKIP_DIRS = new Set(["node_modules", ".expo", "android"]);
  const allowFile = (rel) =>
    rel === "lib/theme.ts" ||
    rel === "src/icons/NextronIcon.tsx" || // justified brand-asset gradient
    rel === "src/components/TodayHeroArt.tsx"; // justified theme-specific decorative illustration fills

  function collect(dir, out) {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (SKIP_DIRS.has(entry)) continue;
      const st = statSync(full);
      if (st.isDirectory()) collect(full, out);
      else if (/\.tsx?$/.test(entry)) out.push(full);
    }
    return out;
  }

  it("no hardcoded hex outside tokens/brand-assets/DB seeds", () => {
    const files = collect(appDir, []);
    const offenders = [];
    for (const full of files) {
      const rel = path.relative(appDir, full).replace(/\\/g, "/");
      if (allowFile(rel)) continue;
      let src = readFileSync(full, "utf8");
      // DB seed colors are data, never rendered UI.
      src = src.replace(/\.insert\(\{[^}]*\}\)/g, "");
      const m = src.match(/#[0-9a-fA-F]{3,8}\b/);
      if (m) offenders.push(`${rel}: ${m[0]}`);
    }
    assert.deepEqual(offenders, [], `hardcoded hex found: ${offenders.join(", ")}`);
  });

  it("no hardcoded rgba() fills outside the token file", () => {
    const files = collect(appDir, []);
    const offenders = [];
    for (const full of files) {
      const rel = path.relative(appDir, full).replace(/\\/g, "/");
      if (allowFile(rel)) continue;
      const src = readFileSync(full, "utf8");
      if (/rgba?\(/.test(src)) offenders.push(rel);
    }
    assert.deepEqual(offenders, [], `hardcoded rgba() found: ${offenders.join(", ")}`);
  });
});
