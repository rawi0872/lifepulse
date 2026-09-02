/* eslint-disable @typescript-eslint/no-require-imports */
const { getDefaultConfig } = require("expo/metro-config");

const path = require("path");

const projectRoot = __dirname;
// Life Pulse monorepo root — needed so Metro can resolve/watch packages/domain
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in the monorepo (shared domain package)
config.watchFolders = [workspaceRoot];

// 2. Let Metro resolve modules from both the mobile app and the repo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// 3. Map the canonical shared package name to its source directory
config.resolver.extraNodeModules = {
  "@lifepulse/domain": path.resolve(workspaceRoot, "packages/domain"),
};

module.exports = config;
