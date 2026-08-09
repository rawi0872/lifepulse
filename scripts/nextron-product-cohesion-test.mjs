#!/usr/bin/env node

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const root = process.cwd();
const paths = {
  nav: "src/components/DashboardNav.tsx",
  nextConfig: "next.config.ts",
  nextronPage: "src/app/nextron/page.tsx",
  coachPage: "src/app/coach/page.tsx",
  today: "src/app/today/page.tsx",
  tasks: "src/app/tasks/page.tsx",
  projects: "src/app/projects/page.tsx",
  knowledge: "src/app/knowledge/page.tsx",
  weeklyReview: "src/app/weekly-review/page.tsx",
  coachLib: "src/lib/nextron/coach.ts",
  modules: "src/lib/modules.ts",
  packageJson: "package.json",
};

function read(relativePath) {
  const path = resolve(root, relativePath);
  if (!existsSync(path)) throw new Error(`Missing file: ${relativePath}`);
  return readFileSync(path, "utf8");
}

function pass(label) { console.log(`PASS ${label}`); }
function assert(condition, label) { if (!condition) throw new Error(label); pass(label); }

const nav = read(paths.nav);
const nextConfig = read(paths.nextConfig);
const nextronPage = read(paths.nextronPage);
const coachPage = read(paths.coachPage);
const today = read(paths.today);
const tasks = read(paths.tasks);
const projects = read(paths.projects);
const knowledge = read(paths.knowledge);
const weeklyReview = read(paths.weeklyReview);
const coachLib = read(paths.coachLib);
const modules = read(paths.modules);
const pkg = JSON.parse(read(paths.packageJson));

assert(pkg.scripts["test:nextron-product-cohesion"] === "node scripts/nextron-product-cohesion-test.mjs", "Product cohesion test script is registered");
assert(nextronPage.includes('import CoachPage from "@/app/coach/page"') && nextConfig.includes('source: "/coach"') && nextConfig.includes('destination: "/nextron"'), "Canonical /nextron route exists and /coach compatibility redirects");
assert(nav.includes('label: "Intelligence"') && nav.includes('href: "/nextron"') && !nav.includes('href: "/coach", icon: icons.coach'), "Primary navigation exposes NEXTRON at /nextron");
assert(!nav.includes('badge: "Beta"') && !nav.includes('Review after logging') && !nav.includes('Organize bigger work'), "Navigation removes stale NEXTRON beta and legacy group labels");
assert(modules.includes('href: "/nextron"') && modules.includes('personal intelligence') && !modules.includes('AI Coach foundation'), "Module registry describes NEXTRON as Life Pulse intelligence");
assert(today.includes('/nextron?subject=today') && tasks.includes('/nextron?subject=tasks') && knowledge.includes('/nextron?subject=knowledge') && weeklyReview.includes('/nextron?subject=weekly-review'), "High-value module bridges point to safe NEXTRON subjects");
assert(projects.includes('sessionStorage.setItem("lifepulse:nextron-bridge"') && projects.includes('/nextron?subject=project') && !projects.includes('/nextron?subject=project&id=') && !projects.includes('/nextron?subject=project&projectId='), "Project bridge uses route state and does not put raw IDs in URLs");
assert(coachPage.includes('getNextronBridgePrompt') && coachPage.includes('sessionStorage.getItem("lifepulse:nextron-bridge"') && !coachPage.includes('approve=') && !coachPage.includes('allow_task_actions='), "NEXTRON bridge creates draft conversation context without approval or permission URL controls");
assert(coachPage.includes('Write permission and exact proposal approval are separate') && coachPage.includes('Goals, Habits, Projects, and Tasks') && coachPage.includes('Review in NEXTRON'), "Cross-domain action permission and post-execution navigation are explicit");
assert(!coachPage.includes('does not mutate Life Pulse data') && !coachPage.includes('Provider: {meta.provider}') && !coachLib.includes('private-beta coach'), "Stale action-disabled and provider/provenance copy removed from NEXTRON UI");

console.log("NEXTRON product cohesion contract checks passed.");
