import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import type { Express, Request, Response } from "express";
import crypto from "node:crypto";
import {
  createLinkedAccount,
  getLinkedAccount,
  getUserByOpenId,
  upsertUser,
  updateLinkedAccount,
} from "../db";
import * as solvedac from "../solvedac";
import { verifyBojCredentials } from "../boj-auth";
import { getSessionCookieOptions } from "./cookies";
import { sdk, tokenBlacklist } from "./sdk";
import { ENV } from "./env";

type SyncUserInput = {
  openId?: string | null;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
};

type SolvedAcChallenge = {
  id: string;
  handle: string;
  token: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
};

const SOLVED_AC_CHALLENGE_TTL_MS = 10 * 60 * 1000;
const SOLVED_AC_CHALLENGE_PREFIX = "SOLVEMATE";
const solvedAcChallenges = new Map<string, SolvedAcChallenge>();

function isInvalidSessionCookieError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { statusCode?: unknown; message?: unknown };
  return candidate.statusCode === 403 && candidate.message === "Invalid session cookie";
}

function normalizeHandle(handle: string): string {
  return handle.trim();
}

function cleanupExpiredSolvedAcChallenges(now = Date.now()): void {
  for (const [id, challenge] of solvedAcChallenges.entries()) {
    if (challenge.expiresAt <= now) {
      solvedAcChallenges.delete(id);
    }
  }
}

function createSolvedAcChallenge(handle: string): SolvedAcChallenge {
  cleanupExpiredSolvedAcChallenges();
  const id = crypto.randomUUID();
  const token = `${SOLVED_AC_CHALLENGE_PREFIX}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const createdAt = Date.now();
  const challenge: SolvedAcChallenge = {
    id,
    handle: handle.toLowerCase(),
    token,
    createdAt,
    expiresAt: createdAt + SOLVED_AC_CHALLENGE_TTL_MS,
    attempts: 0,
  };
  solvedAcChallenges.set(id, challenge);
  return challenge;
}

async function syncUser(userInfo: SyncUserInput) {
  if (!userInfo.openId) {
    throw new Error("openId missing from user info");
  }

  const lastSignedIn = new Date();
  await upsertUser({
    openId: userInfo.openId,
    name: userInfo.name || null,
    email: userInfo.email ?? null,
    loginMethod: userInfo.loginMethod ?? "boj",
    lastSignedIn,
  });

  const saved = await getUserByOpenId(userInfo.openId);
  return (
    saved ?? {
      id: null,
      openId: userInfo.openId,
      name: userInfo.name ?? null,
      email: userInfo.email ?? null,
      loginMethod: userInfo.loginMethod ?? "boj",
      lastSignedIn,
    }
  );
}

function buildUserResponse(
  user:
    | Awaited<ReturnType<typeof getUserByOpenId>>
    | {
        id?: number | null;
        openId: string;
        name?: string | null;
        email?: string | null;
        loginMethod?: string | null;
        lastSignedIn?: Date | null;
      }
    | null
    | undefined,
) {
  return {
    id: user?.id ?? null,
    openId: user?.openId ?? null,
    name: user?.name ?? null,
    email: user?.email ?? null,
    loginMethod: user?.loginMethod ?? null,
    lastSignedIn: (user?.lastSignedIn ?? new Date()).toISOString(),
  };
}

async function syncLinkedAccount(userId: number, profile: solvedac.SolvedAcUser): Promise<void> {
  const existing = await getLinkedAccount(userId);

  if (existing) {
    await updateLinkedAccount(userId, {
      handle: profile.handle,
      verified: true,
      solvedCount: profile.solvedCount,
      tier: profile.tier,
      rating: profile.rating,
    });
    return;
  }

  await createLinkedAccount({
    userId,
    provider: "BOJ",
    handle: profile.handle,
    verified: true,
    solvedCount: profile.solvedCount,
    tier: profile.tier,
    rating: profile.rating,
  });
}

async function finalizeBojSession(
  req: Request,
  res: Response,
  params: {
    handle: string;
    profile: solvedac.SolvedAcUser | null;
    warnings?: string[];
  },
): Promise<void> {
  const normalizedHandle = normalizeHandle(params.handle);
  const openId = `boj:${normalizedHandle.toLowerCase()}`;
  const user = await syncUser({
    openId,
    name: params.profile?.handle ?? normalizedHandle,
    email: null,
    loginMethod: "boj",
  });

  if (typeof user?.id !== "number") {
    res.status(500).json({
      success: false,
      error: "사용자 정보를 저장하지 못했습니다. 데이터베이스 연결을 확인해주세요.",
      code: "DB_UNAVAILABLE",
    });
    return;
  }

  if (params.profile) {
    await syncLinkedAccount(user.id, params.profile);
  }

  const sessionToken = await sdk.createSessionToken(openId, {
    name: params.profile?.handle ?? normalizedHandle,
    expiresInMs: ONE_YEAR_MS,
  });

  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

  const warnings: string[] = [];
  if (!params.profile) {
    warnings.push(
      "solved.ac 프로필을 찾지 못해 계정 연동 정보 동기화가 건너뛰어졌습니다.",
    );
  }
  if (params.warnings?.length) {
    warnings.push(...params.warnings);
  }

  res.json({
    success: true,
    app_session_id: sessionToken,
    user: buildUserResponse(user),
    warnings: warnings.length > 0 ? warnings : undefined,
  });
}

export function registerOAuthRoutes(app: Express) {
  // BOJ credentials login
  app.post("/api/auth/boj/login", async (req: Request, res: Response) => {
    const { handle, password } = req.body as { handle?: string; password?: string };

    if (!handle || !password) {
      res.status(400).json({
        success: false,
        error: "아이디와 비밀번호를 입력해주세요.",
        code: "BOJ_LOGIN_001",
      });
      return;
    }

    const normalizedHandle = normalizeHandle(handle);

    if (!normalizedHandle) {
      res.status(400).json({
        success: false,
        error: "유효한 백준 아이디를 입력해주세요.",
        code: "BOJ_LOGIN_002",
      });
      return;
    }

    try {
      const verifyResult = await verifyBojCredentials(normalizedHandle, password);
      if (!verifyResult.ok) {
        const body: { success: false; error: string; code: string; detail?: string } = {
          success: false,
          error: verifyResult.message,
          code: verifyResult.code,
        };

        // 자격증명 오입력은 401, 그 외 검증 실패는 접근 금지(세션 발급 금지)로 처리.
        const statusCode = verifyResult.code === "INVALID_CREDENTIALS" ? 401 : 403;

        if (verifyResult.code === "INVALID_CREDENTIALS") {
          if (verifyResult.detail) {
            body.detail = verifyResult.detail;
          }
        } else if (!ENV.isProduction && verifyResult.detail) {
          body.detail = verifyResult.detail;
        }

        res.status(statusCode).json(body);
        return;
      }

      // solved.ac 프로필은 로그인 필수 조건이 아님.
      // 조회 실패 시에도 세션은 발급하고, 연동 데이터 동기화만 생략한다.
      let profile: solvedac.SolvedAcUser | null = null;
      try {
        profile = await solvedac.getUserProfile(normalizedHandle);
      } catch (error) {
        console.warn("[Auth] solved.ac profile fetch failed:", error);
      }

      await finalizeBojSession(req, res, {
        handle: normalizedHandle,
        profile,
      });
    } catch (error) {
      console.error("[Auth] BOJ login failed:", error);
      const payload: { success: false; error: string; code: string; detail?: string } = {
        success: false,
        error: "로그인 처리 중 오류가 발생했습니다.",
        code: "BOJ_LOGIN_999",
      };
      if (!ENV.isProduction && error instanceof Error) {
        payload.detail = error.message;
      }
      res.status(500).json(payload);
    }
  });

  // solved.ac profile challenge (passwordless)
  app.post("/api/auth/solvedac/challenge/start", async (req: Request, res: Response) => {
    const { handle } = req.body as { handle?: string };
    if (!handle) {
      res.status(400).json({
        success: false,
        error: "백준 아이디를 입력해주세요.",
        code: "SOLVEDAC_CHALLENGE_001",
      });
      return;
    }

    const normalizedHandle = normalizeHandle(handle);
    if (!normalizedHandle) {
      res.status(400).json({
        success: false,
        error: "유효한 백준 아이디를 입력해주세요.",
        code: "SOLVEDAC_CHALLENGE_002",
      });
      return;
    }

    try {
      const profile = await solvedac.getUserProfile(normalizedHandle);
      if (!profile) {
        res.status(404).json({
          success: false,
          error: `solved.ac에서 "${normalizedHandle}" 사용자를 찾을 수 없습니다.`,
          code: "SOLVEDAC_HANDLE_NOT_FOUND",
        });
        return;
      }

      const challenge = createSolvedAcChallenge(normalizedHandle);
      res.json({
        success: true,
        challengeId: challenge.id,
        token: challenge.token,
        handle: profile.handle,
        expiresAt: new Date(challenge.expiresAt).toISOString(),
        instructions:
          "solved.ac 소개글(bio)에 인증 코드를 추가한 뒤 인증 확인 버튼을 눌러주세요.",
      });
    } catch (error) {
      console.error("[Auth] solved.ac challenge start failed:", error);
      res.status(500).json({
        success: false,
        error: "인증 코드를 발급하지 못했습니다.",
        code: "SOLVEDAC_CHALLENGE_999",
      });
    }
  });

  app.post("/api/auth/solvedac/challenge/verify", async (req: Request, res: Response) => {
    const { challengeId } = req.body as { challengeId?: string };
    if (!challengeId) {
      res.status(400).json({
        success: false,
        error: "인증 코드 ID가 필요합니다.",
        code: "SOLVEDAC_VERIFY_001",
      });
      return;
    }

    cleanupExpiredSolvedAcChallenges();
    const challenge = solvedAcChallenges.get(challengeId);
    if (!challenge) {
      res.status(404).json({
        success: false,
        error: "인증 코드가 없거나 만료되었습니다. 다시 발급해주세요.",
        code: "SOLVEDAC_VERIFY_NOT_FOUND",
      });
      return;
    }

    try {
      const profile = await solvedac.getUserProfile(challenge.handle);
      if (!profile) {
        solvedAcChallenges.delete(challengeId);
        res.status(404).json({
          success: false,
          error: `solved.ac에서 "${challenge.handle}" 사용자를 찾을 수 없습니다.`,
          code: "SOLVEDAC_HANDLE_NOT_FOUND",
        });
        return;
      }

      const bio = profile.bio ?? "";
      if (!bio.includes(challenge.token)) {
        challenge.attempts += 1;
        res.status(409).json({
          success: false,
          error:
            "solved.ac 소개글에서 인증 코드를 찾지 못했습니다. 코드를 추가한 뒤 다시 시도해주세요.",
          code: "SOLVEDAC_VERIFY_MISMATCH",
          detail: !ENV.isProduction
            ? `token=${challenge.token}, bioLength=${bio.length}, attempts=${challenge.attempts}`
            : undefined,
          expiresAt: new Date(challenge.expiresAt).toISOString(),
        });
        return;
      }

      solvedAcChallenges.delete(challengeId);
      await finalizeBojSession(req, res, {
        handle: challenge.handle,
        profile,
        warnings: ["solved.ac 소개글 인증을 통해 로그인되었습니다."],
      });
    } catch (error) {
      console.error("[Auth] solved.ac challenge verify failed:", error);
      res.status(500).json({
        success: false,
        error: "인증 확인 중 오류가 발생했습니다.",
        code: "SOLVEDAC_VERIFY_999",
      });
    }
  });

  // Login providers metadata
  app.get("/api/auth/providers", (_req: Request, res: Response) => {
    res.json({
      boj: true,
      solvedacChallenge: true,
      dev: !ENV.isProduction,
    });
  });

  // Backward-compatible alias
  app.get("/api/oauth/providers", (_req: Request, res: Response) => {
    res.json({
      boj: true,
      solvedacChallenge: true,
      dev: !ENV.isProduction,
    });
  });

  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    try {
      const cookies = req.headers.cookie;
      let sessionToken: string | undefined;

      if (cookies) {
        const cookieMap = cookies.split(";").reduce(
          (acc, cookie) => {
            const [key, value] = cookie.trim().split("=");
            if (key && value) acc[key] = value;
            return acc;
          },
          {} as Record<string, string>,
        );
        sessionToken = cookieMap[COOKIE_NAME];
      }

      const authHeader = req.headers.authorization;
      if (!sessionToken && typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice("Bearer ".length).trim();
      }

      if (sessionToken) {
        const tokenInfo = await sdk.extractTokenInfo(sessionToken);
        if (tokenInfo) {
          await tokenBlacklist.add(tokenInfo.jti, tokenInfo.exp);
        }
      }

      const cookieOptions = getSessionCookieOptions(req);
      res.clearCookie(COOKIE_NAME, cookieOptions);
      res.json({ success: true });
    } catch (error) {
      console.error("[Auth] Logout error:", error);
      const cookieOptions = getSessionCookieOptions(req);
      res.clearCookie(COOKIE_NAME, cookieOptions);
      res.json({ success: true });
    }
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      res.json({ user: buildUserResponse(user) });
    } catch (error) {
      if (isInvalidSessionCookieError(error)) {
        // 만료/깨진 쿠키가 반복 전송되는 경우를 자동 복구.
        const cookieOptions = getSessionCookieOptions(req);
        res.clearCookie(COOKIE_NAME, cookieOptions);
        if (!ENV.isProduction) {
          console.warn("[Auth] /api/auth/me cleared invalid session cookie");
        }
        res.status(401).json({ error: "Not authenticated", user: null });
        return;
      }
      console.error("[Auth] /api/auth/me failed:", error);
      res.status(401).json({ error: "Not authenticated", user: null });
    }
  });

  app.post("/api/auth/session", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);

      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
        res.status(400).json({ error: "Bearer token required" });
        return;
      }
      const token = authHeader.slice("Bearer ".length).trim();

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({ success: true, user: buildUserResponse(user) });
    } catch (error) {
      console.error("[Auth] /api/auth/session failed:", error);
      res.status(401).json({ error: "Invalid token" });
    }
  });

  const handleDevLogin = async (req: Request, res: Response) => {
    if (ENV.isProduction) {
      res.status(403).json({ error: "Dev login not allowed in production" });
      return;
    }

    try {
      const devUser = {
        openId: "dev:user",
        name: "Developer",
        email: "dev@local.host",
        loginMethod: "dev",
      };

      const user = await syncUser(devUser);
      const sessionToken = await sdk.createSessionToken(devUser.openId, {
        name: devUser.name,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({
        app_session_id: sessionToken,
        user: buildUserResponse(user),
      });
    } catch (error) {
      console.error("[Dev Login] Failed:", error);
      res.status(500).json({ error: "Dev login failed" });
    }
  };

  // Dev login (non-production)
  app.post("/api/auth/dev/login", handleDevLogin);

  // Backward-compatible alias
  app.post("/api/oauth/dev/login", handleDevLogin);
}
