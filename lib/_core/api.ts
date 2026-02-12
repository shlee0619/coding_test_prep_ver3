import { Platform } from "react-native";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "./auth";
import { devLog, devWarn } from "./logger";

type AuthenticatedUser = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  lastSignedIn: string;
};

export async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  // Determine the auth method:
  // - Native platform: use stored session token as Bearer auth
  // - Web (including iframe): use cookie-based auth (browser handles automatically)
  //   Cookie is set on backend domain via POST /api/auth/session after receiving token via postMessage
  if (Platform.OS !== "web") {
    const sessionToken = await Auth.getSessionToken();
    devLog("[API] Request", {
      endpoint,
      hasToken: !!sessionToken,
      method: options.method || "GET",
    });
    if (sessionToken) {
      headers["Authorization"] = `Bearer ${sessionToken}`;
    }
  } else {
    devLog("[API] Request", { endpoint, platform: "web", method: options.method || "GET" });
  }

  const baseUrl = getApiBaseUrl();
  // Ensure no double slashes between baseUrl and endpoint
  const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = baseUrl ? `${cleanBaseUrl}${cleanEndpoint}` : endpoint;
  devLog("[API] URL:", url);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });

    devLog("[API] Response status:", response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      devWarn("[API] Error response", {
        status: response.status,
        statusText: response.statusText,
        preview: errorText.slice(0, 200),
      });
      let errorMessage = errorText;
      let errorCode: string | undefined;
      let detail: string | undefined;
      try {
        const errorJson = JSON.parse(errorText) as Record<string, unknown>;
        errorMessage = (errorJson.error as string) || (errorJson.message as string) || errorText;
        errorCode = errorJson.code as string | undefined;
        detail = errorJson.detail as string | undefined;
      } catch {
        // Not JSON, use text as is
      }
      // 프로덕션에서는 5xx/내부 오류 상세를 사용자에게 노출하지 않음
      const isServerError = response.status >= 500;
      const isProduction = typeof __DEV__ === "boolean" ? !__DEV__ : process.env.NODE_ENV === "production";
      if (isProduction && isServerError) {
        errorMessage = "요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.";
        detail = undefined;
      }
      const codePart = errorCode ? ` [${errorCode}]` : "";
      const detailPart = detail ? ` — ${detail}` : "";
      throw new Error(`${errorMessage || response.statusText}${codePart}${detailPart}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
      devLog("[API] JSON response received");
      return data as T;
    }

    const text = await response.text();
    devLog("[API] Text response received");
    return (text ? JSON.parse(text) : {}) as T;
  } catch (error) {
    console.error("[API] Request failed:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Unknown error occurred");
  }
}

export async function bojLogin(
  handle: string,
  password: string,
): Promise<{
  success: boolean;
  app_session_id?: string;
  user?: AuthenticatedUser;
  error?: string;
  code?: string;
  /** 서버가 반환한 구체적 원인(디버깅용). 로그인 실패 시 UI에 표시 */
  detail?: string;
}> {
  return apiCall("/api/auth/boj/login", {
    method: "POST",
    body: JSON.stringify({
      handle,
      password,
    }),
  });
}

// Logout
export async function logout(): Promise<void> {
  await apiCall<void>("/api/auth/logout", {
    method: "POST",
  });
}

// Get current authenticated user (web uses cookie-based auth)
export async function getMe(): Promise<{
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  lastSignedIn: string;
} | null> {
  try {
    const result = await apiCall<{ user: AuthenticatedUser | null }>("/api/auth/me");
    return result.user || null;
  } catch (error) {
    console.error("[API] getMe failed:", error);
    return null;
  }
}

// Establish session cookie on the backend (3000-xxx domain)
// Called after receiving token via postMessage to get a proper Set-Cookie from the backend
export async function establishSession(token: string): Promise<boolean> {
  try {
    devLog("[API] establishSession: setting cookie on backend...");
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}/api/auth/session`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      credentials: "include", // Important: allows Set-Cookie to be stored
    });

    if (!response.ok) {
      devWarn("[API] establishSession failed:", response.status);
      return false;
    }

    devLog("[API] establishSession: cookie set successfully");
    return true;
  } catch (error) {
    console.error("[API] establishSession error:", error);
    return false;
  }
}
