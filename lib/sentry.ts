/**
 * Sentry error monitoring.
 * Only initializes when EXPO_PUBLIC_SENTRY_DSN is set (production).
 */
import * as Sentry from "@sentry/react-native";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry() {
  if (!dsn || dsn.trim() === "") {
    return;
  }
  Sentry.init({
    dsn,
    debug: false,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0.2,
  });
}

export { Sentry };

initSentry();
