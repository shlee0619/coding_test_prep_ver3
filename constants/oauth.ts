import { Platform } from "react-native";

function isProductionRuntime(): boolean {
  if (typeof __DEV__ === "boolean") {
    return !__DEV__;
  }
  return process.env.NODE_ENV === "production";
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/$/, "");
}

export const API_BASE_URL = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? "");

/**
 * API 서버 Base URL 결정
 * - EXPO_PUBLIC_API_BASE_URL 우선
 * - 웹 localhost는 3000 포트 기본값 사용
 * - 웹 터널 환경은 호스트의 포트 prefix 8081 -> 3000 변환
 */
export function getApiBaseUrl(): string {
  if (API_BASE_URL) {
    return API_BASE_URL;
  }

  if (Platform.OS === "web" && typeof window !== "undefined" && window.location) {
    const { hostname, protocol } = window.location;

    if (hostname.endsWith(".vercel.app") && !isProductionRuntime()) {
      return "";
    }

    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `http://${hostname}:3000`;
    }

    const apiHostname = hostname.replace(/^8081-/, "3000-");
    if (apiHostname !== hostname) {
      return `${protocol}//${apiHostname}`;
    }
  }

  if (isProductionRuntime() || Platform.OS !== "web") {
    throw new Error(
      "[Config] EXPO_PUBLIC_API_BASE_URL is required for production/native runtime.",
    );
  }

  return "";
}

export const SESSION_TOKEN_KEY = "boj-helper-session-token";
export const USER_INFO_KEY = "boj-helper-user-info";
