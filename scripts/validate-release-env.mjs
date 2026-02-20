#!/usr/bin/env node

import "dotenv/config";

const args = process.argv.slice(2);

function getArgValue(name) {
  const key = `--${name}`;
  const index = args.indexOf(key);
  if (index === -1) return undefined;
  return args[index + 1];
}

function parseTargets(value) {
  if (!value || value === "all") {
    return new Set(["api", "preview", "production"]);
  }
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const targets = new Set(items);
  const allowed = new Set(["api", "preview", "production"]);
  for (const target of targets) {
    if (!allowed.has(target)) {
      console.error(
        `[release-env] Unknown target "${target}". Use api,preview,production or all.`,
      );
      process.exit(1);
    }
  }
  return targets;
}

function readEnv(name) {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

function assertRequired(name, errors) {
  const value = readEnv(name);
  if (!value) {
    errors.push(`Missing required env: ${name}`);
  }
  return value;
}

function assertHttpsUrl(name, value, errors) {
  if (!value) return;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      errors.push(`${name} must use https: ${value}`);
    }
  } catch {
    errors.push(`${name} is not a valid URL: ${value}`);
  }
}

function assertNotPlaceholder(name, value, errors) {
  if (!value) return;
  const lowered = value.toLowerCase();
  if (
    lowered.includes("example.com") ||
    lowered.includes("<app-domain>") ||
    lowered.includes("solvemate.app")
  ) {
    errors.push(`${name} appears to be a placeholder URL: ${value}`);
  }
}

function validateApi(errors) {
  const nodeEnv = assertRequired("NODE_ENV", errors);
  if (nodeEnv && nodeEnv !== "production") {
    errors.push(`NODE_ENV must be production (current: ${nodeEnv})`);
  }

  assertRequired("DATABASE_URL", errors);
  const jwtSecret = assertRequired("JWT_SECRET", errors);
  const allowedOrigins = assertRequired("ALLOWED_ORIGINS", errors);
  if (jwtSecret && jwtSecret.length < 32) {
    errors.push("JWT_SECRET must be at least 32 characters.");
  }

  if (allowedOrigins) {
    const blocked = ["localhost", "127.0.0.1", "0.0.0.0"];
    const origins = allowedOrigins
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    for (const origin of origins) {
      if (blocked.some((token) => origin.includes(token))) {
        errors.push(`ALLOWED_ORIGINS contains local origin in production: ${origin}`);
      }
    }
  }
}

function validateReleaseBuild(errors) {
  const apiBase = assertRequired("EXPO_PUBLIC_API_BASE_URL", errors);
  const projectId = assertRequired("EAS_PROJECT_ID", errors);
  const privacy = assertRequired("EXPO_PUBLIC_PRIVACY_POLICY_URL", errors);
  const terms = assertRequired("EXPO_PUBLIC_TERMS_OF_SERVICE_URL", errors);

  assertHttpsUrl("EXPO_PUBLIC_API_BASE_URL", apiBase, errors);
  assertHttpsUrl("EXPO_PUBLIC_PRIVACY_POLICY_URL", privacy, errors);
  assertHttpsUrl("EXPO_PUBLIC_TERMS_OF_SERVICE_URL", terms, errors);
  assertNotPlaceholder("EXPO_PUBLIC_PRIVACY_POLICY_URL", privacy, errors);
  assertNotPlaceholder("EXPO_PUBLIC_TERMS_OF_SERVICE_URL", terms, errors);

  if (projectId && !/^[0-9a-fA-F-]{36}$/.test(projectId)) {
    errors.push(`EAS_PROJECT_ID should be a UUID format (current: ${projectId}).`);
  }
}

function main() {
  const targets = parseTargets(getArgValue("target"));
  const errors = [];

  if (targets.has("api")) {
    validateApi(errors);
  }
  if (targets.has("preview") || targets.has("production")) {
    validateReleaseBuild(errors);
  }

  if (errors.length > 0) {
    console.error("[release-env] FAILED");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(
    `[release-env] OK (${Array.from(targets)
      .sort()
      .join(", ")})`,
  );
}

main();
