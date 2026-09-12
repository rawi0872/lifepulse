// Life Pulse premium visual-system tests (Prompt 2).
// Deterministic source-structure assertions: tokens exist, screens share the
// kit, no parallel palettes, radii/buttons/rows unified. No snapshots.
// Run: `node --loader ./scripts/ts-extension-loader.mjs --test scripts/test-visual-v1.mjs`
// from apps/mobile.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, "..");
const read = (rel) => readFileSync(path.join(appDir, rel), "utf8");

const MIGRATED_SCREENS = [
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
  "src/components/ui.tsx",
  "src/components/ItemActionSheet.tsx",
  "src/components/ConfirmDeleteDialog.tsx",
];

describe("design tokens — small intentional system", () => {
  const theme = read("lib/theme.ts");

  it("surface/text/border hierarchies stay at three levels", () => {
    for (const token of ["bg:", "surface:", "surfaceElevated:", "textPrimary:", "textSecondary:", "textMuted:"]) {
      assert.ok(theme.includes(token), `missing token ${token}`);
    }
    assert.ok(theme.includes("border:"), "missing border/subtle");
    assert.ok(theme.includes("borderStrong:"), "missing border/strong");
  });

  it("realm identity, destructive border, backdrop, and muted fill are tokens", () => {
    for (const token of [
      "realmBody:", "realmBodySoft:", "realmBodyBorder:",
      "realmWealth:", "realmWealthSoft:", "realmWealthBorder:",
      "dangerBorder:", "backdrop:", "mutedSoft:",
    ]) {
      assert.ok(theme.includes(token), `missing token ${token}`);
    }
  });

  it("no token explosion: radii stay at five levels", () => {
    const radiiBlock = theme.slice(theme.indexOf("export const radii"), theme.indexOf("export const type"));
    const levels = (radiiBlock.match(/^\s+\w+:/gm) ?? []).length;
    assert.ok(levels <= 5, `expected at most 5 radii levels, found ${levels}`);
  });
});

describe("no parallel palettes in migrated screens", () => {
  for (const file of MIGRATED_SCREENS) {
    it(`${file} has no hardcoded hex colors`, () => {
      const src = read(file);
      // DB seed strings (never rendered — no realm.color reads in mobile) are allowlisted.
      const stripped = src.replace('"#6366f1"', "");
      assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(stripped), `${file} contains a hardcoded hex color`);
    });

    it(`${file} has no hardcoded rgba fills`, () => {
      const src = read(file);
      assert.ok(!/rgba?\(/.test(src), `${file} contains a hardcoded rgba() fill`);
    });
  }
});

describe("shared kit adoption", () => {
  it("tasks/habits share header, sections, states, and fields", () => {
    for (const file of ["app/(tabs)/tasks.tsx", "app/(tabs)/habits.tsx"]) {
      const src = read(file);
      assert.ok(src.includes('from "../../src/components/ui"'), `${file} does not import the shared kit`);
      for (const name of ["ScreenHeader", "SectionLabel", "EmptyState", "ErrorBanner", "FieldLabel", "FieldInput"]) {
        assert.ok(src.includes(name), `${file} does not use shared ${name}`);
      }
      assert.ok(!src.includes("function EmptyState"), `${file} still defines a local EmptyState`);
    }
  });

  it("more/settings/account share rows, labels, and back navigation", () => {
    for (const file of ["app/(tabs)/more.tsx", "app/(tabs)/settings.tsx", "app/(tabs)/account.tsx"]) {
      const src = read(file);
      assert.ok(src.includes("SectionLabel"), `${file} does not use SectionLabel`);
      assert.ok(src.includes("MenuRow"), `${file} does not use MenuRow`);
    }
    assert.ok(read("app/(tabs)/settings.tsx").includes("BackLink"), "settings does not use BackLink");
    assert.ok(read("app/(tabs)/account.tsx").includes("BackLink"), "account does not use BackLink");
  });

  it("account footer uses the real app version, not a hardcoded string", () => {
    const src = read("app/(tabs)/account.tsx");
    assert.ok(src.includes("expoConfig?.version"), "account footer is not version-driven");
    assert.ok(!src.includes("v0.1.7 · Alpha"), "account footer still hardcodes a version");
  });
});

describe("unified radii, buttons, and rows", () => {
  it("no one-off borderRadius numbers in app screens", () => {
    const files = [...MIGRATED_SCREENS, "app/(tabs)/nextron.tsx", "app/(tabs)/today.tsx", "app/(tabs)/_layout.tsx"];
    for (const file of files) {
      const src = read(file);
      const hits = [...src.matchAll(/borderRadius:\s*(\d+)/g)].map((m) => m[1]);
      // Owned pills (dots, circles, eyes) use radii.pill; numeric leftovers are banned.
      assert.deepEqual(hits, [], `${file} uses numeric borderRadius: ${hits.join(", ")}`);
    }
  });

  it("primary actions are 52pt, secondary 48pt", () => {
    const kit = read("src/components/ui.tsx");
    assert.ok(kit.includes("minHeight: 52"), "kit primary is not 52pt");
    assert.ok(kit.includes("minHeight: 48"), "kit secondary is not 48pt");
    assert.ok(read("app/wealth.tsx").includes("minHeight:52"), "wealth primary is not 52pt");
    assert.ok(read("app/health.tsx").includes("minHeight: 52"), "health sync is not 52pt");
    for (const file of ["app/login.tsx", "app/signup.tsx", "app/forgot-password.tsx"]) {
      assert.ok(read(file).includes("minHeight: 52"), `${file} primary button is not 52pt`);
    }
  });

  it("task/habit rows are dense but tappable", () => {
    for (const file of ["app/(tabs)/tasks.tsx", "app/(tabs)/habits.tsx"]) {
      const src = read(file);
      assert.ok(src.includes("minHeight: 48"), `${file} row is not 48pt`);
      assert.ok(src.includes("width: 40, height: 40"), `${file} completion target is not 40x40`);
      assert.ok(src.includes("borderRadius: radii.pill"), `${file} does not tokenize round radii`);
    }
  });

  it("completion circles are restrained (muted idle, success done)", () => {
    for (const file of ["app/(tabs)/tasks.tsx", "app/(tabs)/habits.tsx"]) {
      const src = read(file);
      assert.ok(src.includes("borderColor: colors.textMuted"), `${file} idle circle is not muted`);
      assert.ok(src.includes("backgroundColor: colors.successSoft"), `${file} done state is not successSoft`);
    }
  });
});

describe("realm identity without flattening", () => {
  it("realms screen uses realm tokens, SVG chevrons", () => {
    const src = read("app/realms.tsx");
    assert.ok(src.includes("colors.realmBody"), "body realm token missing");
    assert.ok(src.includes("colors.realmWealth"), "wealth realm token missing");
    assert.ok(src.includes("<ChevronRight"), "realms still uses a text chevron");
    assert.ok(!src.includes("14,165,233") && !src.includes("239,68,68"), "realms still hardcodes realm colors");
  });

  it("body and wealth headers carry their realm mark", () => {
    assert.ok(read("app/body.tsx").includes("colors.realmBody"), "body header lost its realm mark");
    assert.ok(read("app/wealth.tsx").includes("colors.realmWealth"), "wealth header lost its realm mark");
  });
});

describe("sheets, dialogs, and toggles stay honest", () => {
  it("overlays share one backdrop token", () => {
    assert.ok(read("src/components/ItemActionSheet.tsx").includes("colors.backdrop"), "sheet backdrop not tokenized");
    assert.ok(read("src/components/ConfirmDeleteDialog.tsx").includes("colors.backdrop"), "dialog backdrop not tokenized");
    assert.ok(read("app/wealth.tsx").includes("colors.backdrop"), "wealth modal backdrop not tokenized");
  });

  it("no white-text literal on destructive surfaces", () => {
    assert.ok(!read("src/components/ConfirmDeleteDialog.tsx").includes("#fff"), "dialog still hardcodes #fff");
  });

  it("health toggles communicate state by label and border, not color alone", () => {
    const src = read("app/health.tsx");
    assert.ok(src.includes("toggleOn: { backgroundColor: colors.successSoft"), "toggle still uses solid fills");
    assert.ok(src.includes('>{consentOn ? "On" : "Off"}<'), "toggle lost its text state");
  });
});
