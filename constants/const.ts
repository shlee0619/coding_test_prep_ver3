export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = "Please login (10001)";
export const NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

function readPublicEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export const PRIVACY_POLICY_URL =
  readPublicEnv("EXPO_PUBLIC_PRIVACY_POLICY_URL") ?? "https://boj-helper.app/privacy";
export const TERMS_OF_SERVICE_URL =
  readPublicEnv("EXPO_PUBLIC_TERMS_OF_SERVICE_URL") ?? "https://boj-helper.app/terms";
