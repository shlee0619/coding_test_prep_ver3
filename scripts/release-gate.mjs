#!/usr/bin/env node

const args = process.argv.slice(2);

function getArgValue(name) {
  const key = `--${name}`;
  const index = args.indexOf(key);
  if (index === -1) return undefined;
  return args[index + 1];
}

function readValue(name, fallback) {
  const argValue = getArgValue(name);
  if (argValue && argValue.trim().length > 0) return argValue.trim();
  if (fallback && fallback.trim().length > 0) return fallback.trim();
  return "";
}

function normalizeBaseUrl(value) {
  return value.replace(/\/$/, "");
}

async function httpCheck(url, expectedStatuses, label, options = {}) {
  const response = await fetch(url, options);
  const ok = expectedStatuses.includes(response.status);
  const status = ok ? "PASS" : "FAIL";
  console.log(`[${status}] ${label} -> ${response.status}`);
  return { response, ok };
}

function assertHttps(url, name) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`${name} is not a valid URL: ${url}`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`${name} must use https: ${url}`);
  }
}

async function main() {
  const apiBaseRaw = readValue("api", process.env.API_BASE_URL);
  const privacyUrl = readValue("privacy", process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL);
  const termsUrl = readValue("terms", process.env.EXPO_PUBLIC_TERMS_OF_SERVICE_URL);
  const oldToken = readValue("old-token", process.env.OLD_SESSION_TOKEN);

  if (!apiBaseRaw || !privacyUrl || !termsUrl) {
    console.error("Usage:");
    console.error(
      "  node scripts/release-gate.mjs --api <api-base-url> --privacy <privacy-url> --terms <terms-url> [--old-token <token>]",
    );
    console.error("or set API_BASE_URL, EXPO_PUBLIC_PRIVACY_POLICY_URL, EXPO_PUBLIC_TERMS_OF_SERVICE_URL");
    process.exit(1);
  }

  assertHttps(apiBaseRaw, "api");
  assertHttps(privacyUrl, "privacy");
  assertHttps(termsUrl, "terms");

  const apiBase = normalizeBaseUrl(apiBaseRaw);
  let failed = false;

  const privacyResult = await httpCheck(privacyUrl, [200], "privacy url");
  if (!privacyResult.ok) failed = true;

  const termsResult = await httpCheck(termsUrl, [200], "terms url");
  if (!termsResult.ok) failed = true;

  const healthResult = await httpCheck(`${apiBase}/api/health`, [200], "api health");
  if (!healthResult.ok) {
    failed = true;
  } else {
    try {
      const healthJson = await healthResult.response.clone().json();
      const dbReachable = Boolean(healthJson?.dependencies?.database?.reachable);
      const dbConfigured = Boolean(healthJson?.dependencies?.database?.configured);
      if (!dbReachable || !dbConfigured) {
        console.error("[FAIL] api health dependencies.database not healthy.");
        failed = true;
      } else {
        console.log("[PASS] api health dependencies.database reachable/configured.");
      }
    } catch {
      console.error("[FAIL] api health response is not valid JSON.");
      failed = true;
    }
  }

  const providersResult = await httpCheck(
    `${apiBase}/api/auth/providers`,
    [200],
    "auth providers",
  );
  if (!providersResult.ok) failed = true;

  if (oldToken) {
    const meResult = await httpCheck(
      `${apiBase}/api/auth/me`,
      [401],
      "old token invalidation (/api/auth/me)",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${oldToken}`,
          Accept: "application/json",
        },
      },
    );
    if (!meResult.ok) failed = true;
  } else {
    console.log("[SKIP] old token invalidation check (no --old-token / OLD_SESSION_TOKEN).");
  }

  if (failed) {
    console.error("[release-gate] FAILED");
    process.exit(1);
  }

  console.log("[release-gate] PASSED");
}

main().catch((error) => {
  console.error("[release-gate] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
