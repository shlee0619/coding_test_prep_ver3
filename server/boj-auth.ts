import axios from "axios";
import * as cheerio from "cheerio";

const BOJ_SIGNIN_URL = "https://www.acmicpc.net/signin";
const BOJ_LOGIN_PAGE_URL = "https://www.acmicpc.net/login";
const BOJ_LOGIN_REFERER = "https://www.acmicpc.net/login?next=%2F";

interface LoginPageContext {
  cookies: string;
  csrfToken: string | null;
  cookieCount: number;
}

async function fetchLoginPageContext(): Promise<LoginPageContext> {
  const response = await axios.get(BOJ_LOGIN_PAGE_URL, {
    timeout: 10000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    validateStatus: (status) => status === 200,
  });

  const setCookieHeaders: string[] = response.headers["set-cookie"] ?? [];
  const cookiePairs = setCookieHeaders
    .map((header: string) => header.split(";")[0])
    .filter(Boolean);
  const cookies = cookiePairs.join("; ");

  let csrfToken: string | null = null;
  if (typeof response.data === "string") {
    const $ = cheerio.load(response.data);
    csrfToken =
      $('input[name="csrf_key"]').val()?.toString() ??
      $('input[name="_token"]').val()?.toString() ??
      $('meta[name="csrf-token"]').attr("content") ??
      null;
  }

  return { cookies, csrfToken, cookieCount: cookiePairs.length };
}

export type BojCredentialCheckResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | "INVALID_CREDENTIALS"
        | "CHALLENGE_REQUIRED"
        | "UNEXPECTED_RESPONSE"
        | "NETWORK_ERROR";
      message: string;
      /** 구체적인 원인(디버깅용). 서버에서 클라이언트로 전달해 UI에 표시할 수 있음 */
      detail?: string;
    };

/**
 * BOJ 로그인 엔드포인트에 서버 측 요청을 보내 자격증명을 검증합니다.
 * 비밀번호는 검증 요청에만 사용하며 저장하지 않습니다.
 */
export async function verifyBojCredentials(
  handle: string,
  password: string,
): Promise<BojCredentialCheckResult> {
  try {
    // Pre-flight: 로그인 페이지에서 세션 쿠키와 CSRF 토큰을 수집
    let context: LoginPageContext = { cookies: "", csrfToken: null, cookieCount: 0 };
    let preflightFailed = false;
    try {
      context = await fetchLoginPageContext();
    } catch (preflightError) {
      preflightFailed = true;
      console.warn(
        "[BOJ Auth] Pre-flight GET failed, proceeding without session cookies:",
        preflightError,
      );
    }

    const form = new URLSearchParams();
    form.set("login_user_id", handle);
    form.set("login_password", password);
    form.set("next", "/");
    form.set("stack", "0");
    if (context.csrfToken) {
      form.set("csrf_key", context.csrfToken);
    }

    const response = await axios.post(BOJ_SIGNIN_URL, form.toString(), {
      timeout: 15000,
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 500,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Referer: BOJ_LOGIN_REFERER,
        Origin: "https://www.acmicpc.net",
        ...(context.cookies ? { Cookie: context.cookies } : {}),
      },
    });

    const location =
      typeof response.headers.location === "string"
        ? response.headers.location
        : "";

    // 인증 실패 시 /login?error=1 로 리다이렉트
    if (response.status === 302 && location.includes("error=1")) {
      // Pre-flight가 실패한 상태에서는 세션/CSRF 누락으로 동일 응답이 발생할 수 있어
      // 자격증명 오입력으로 단정하지 않고 일시적 통신/인증 환경 오류로 분류한다.
      if (preflightFailed) {
        return {
          ok: false,
          code: "NETWORK_ERROR",
          message: "백준 인증 환경이 일시적으로 불안정합니다. 잠시 후 다시 시도해주세요.",
          detail: `Pre-flight failed; BOJ 응답: 302 → ${location}`,
        };
      }
      // Pre-flight는 성공했지만 CSRF를 수집하지 못한 경우도 신뢰도 낮은 검증 결과다.
      // 이 경우 INVALID_CREDENTIALS로 단정하지 않고 추가 검증 필요 상태로 분류한다.
      if (!context.csrfToken) {
        return {
          ok: false,
          code: "CHALLENGE_REQUIRED",
          message: "백준 로그인 검증 정보가 불완전하여 자동 인증에 실패했습니다. 잠시 후 다시 시도해주세요.",
          detail: `BOJ 응답: 302 → ${location} (preflight cookies=${context.cookieCount}, csrf=no)`,
        };
      }
      return {
        ok: false,
        code: "INVALID_CREDENTIALS",
        message: "백준 아이디 또는 비밀번호가 올바르지 않습니다.",
        detail: `BOJ 응답: 302 → ${location} (preflight cookies=${context.cookieCount}, csrf=${context.csrfToken ? "yes" : "no"})`,
      };
    }

    // 인증 성공 시 일반적으로 홈(/) 혹은 next 로 이동
    if (response.status === 302) {
      return { ok: true };
    }

    // 429: 요청 횟수 제한
    if (response.status === 429) {
      return {
        ok: false,
        code: "CHALLENGE_REQUIRED",
        message:
          "백준 로그인 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
      };
    }

    // 403: 봇 차단 / IP 차단
    if (response.status === 403) {
      return {
        ok: false,
        code: "CHALLENGE_REQUIRED",
        message:
          "백준 서버가 요청을 차단했습니다. 잠시 후 다시 시도해주세요.",
      };
    }

    // 200 응답이면 봇 차단/추가 검증 화면일 가능성이 높음
    if (response.status === 200) {
      return {
        ok: false,
        code: "CHALLENGE_REQUIRED",
        message: "추가 로그인 검증이 필요하여 자동 인증에 실패했습니다.",
      };
    }

    // 그 외 예상치 못한 응답
    return {
      ok: false,
      code: "UNEXPECTED_RESPONSE",
      message: `백준 서버로부터 예상치 못한 응답을 받았습니다 (HTTP ${response.status}).`,
      detail: `Location: ${location || "(없음)"}`,
    };
  } catch (err: unknown) {
    let detail: string | undefined;
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const code = err.code; // e.g. ECONNABORTED, ENOTFOUND
      const msg = err.message || "";
      detail = [status != null && `HTTP ${status}`, code, msg].filter(Boolean).join(" — ");
      console.warn("[BOJ Auth] NETWORK_ERROR detail:", detail);
    } else if (err instanceof Error) {
      detail = err.message;
    } else {
      detail = String(err);
    }
    return {
      ok: false,
      code: "NETWORK_ERROR",
      message: "백준 서버와 통신 중 오류가 발생했습니다.",
      detail,
    };
  }
}
