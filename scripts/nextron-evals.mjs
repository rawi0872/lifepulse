import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const live = process.argv.includes("--live");

if (live && !process.env.GROQ_API_KEY) {
  console.log("Skipping live NEXTRON evals: GROQ_API_KEY is not set.");
  process.exit(0);
}

const config = live ? "evals/nextron/promptfooconfig.live.yaml" : "evals/nextron/promptfooconfig.yaml";
const promptfooBin = path.join(root, "node_modules", "promptfoo", "dist", "src", "entrypoint.js");
const args = [
  promptfooBin,
  "eval",
  "--config",
  config,
  "--no-cache",
  "--no-share",
  "--no-write",
  "--no-progress-bar",
  "--no-table",
  "--max-concurrency",
  "1",
];

const result = spawnSync(process.execPath, args, {
  cwd: root,
  encoding: "utf8",
  env: {
    ...process.env,
    PROMPTFOO_DISABLE_TELEMETRY: "1",
    PROMPTFOO_DISABLE_UPDATE: "1",
  },
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

const combinedOutput = `${result.stdout || ""}\n${result.stderr || ""}`;
const promptfooLoggerCrash = /write after end/.test(combinedOutput);
const completedWithoutFailures = /Eval complete/.test(combinedOutput) && /0 failed/.test(combinedOutput) && /0 errors/.test(combinedOutput);

if ((result.status ?? 1) !== 0 && promptfooLoggerCrash && completedWithoutFailures) {
  console.warn("Promptfoo completed successfully but hit a Node 24 logger shutdown issue; treating eval as passed.");
  process.exit(0);
}

process.exit(result.status ?? 1);
