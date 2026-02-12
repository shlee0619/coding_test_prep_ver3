#!/usr/bin/env node

const baseUrl = (process.argv[2] || process.env.API_BASE_URL || "").replace(/\/$/, "");

if (!baseUrl) {
  console.error("Usage: node scripts/smoke-api.mjs <api-base-url>");
  process.exit(1);
}

async function check(path, expectedStatus = 200) {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  const body = await response.text();
  const ok = response.status === expectedStatus;
  const statusLabel = ok ? "PASS" : "FAIL";
  console.log(`[${statusLabel}] ${path} -> ${response.status}`);

  if (!ok) {
    console.error(body.slice(0, 500));
    process.exitCode = 1;
  }

  return { response, body };
}

async function main() {
  await check("/api/health", 200);
  await check("/api/auth/providers", 200);

  if (process.exitCode) {
    process.exit(process.exitCode);
  }
}

main().catch((error) => {
  console.error("[smoke-api] failed:", error);
  process.exit(1);
});
