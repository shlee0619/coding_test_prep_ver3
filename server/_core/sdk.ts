import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import { ForbiddenError } from "../../shared/_core/errors.js";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import crypto from "crypto";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import { hasRedis, redisTokenBlacklistAdd, redisTokenBlacklistHas } from "./redis.js";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

interface BlacklistedToken {
  jti: string;
  expiresAt: number;
}

class TokenBlacklist {
  private blacklist: Map<string, BlacklistedToken> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    if (!hasRedis()) {
      this.cleanupInterval = setInterval(
        () => this.cleanup(),
        60 * 60 * 1000,
      ) as unknown as NodeJS.Timeout;
    }
  }

  async add(jti: string, expiresAt: number): Promise<void> {
    if (hasRedis()) {
      await redisTokenBlacklistAdd(jti, expiresAt);
    } else {
      this.blacklist.set(jti, { jti, expiresAt });
    }
    if (!ENV.isProduction) {
      console.log("[TokenBlacklist] Token added to blacklist");
    }
  }

  async isBlacklisted(jti: string): Promise<boolean> {
    if (hasRedis()) {
      return redisTokenBlacklistHas(jti);
    }
    return this.blacklist.has(jti);
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [jti, token] of this.blacklist.entries()) {
      if (token.expiresAt < now) {
        this.blacklist.delete(jti);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      if (!ENV.isProduction) {
        console.log(`[TokenBlacklist] Cleaned up ${cleaned} expired tokens`);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

export const tokenBlacklist = new TokenBlacklist();

export type SessionPayload = {
  openId: string;
  name: string;
  jti?: string;
};

class SDKServer {
  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }

    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    return new TextEncoder().encode(ENV.cookieSecret);
  }

  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {},
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        name: options.name || "",
      },
      options,
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {},
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();
    const jti = crypto.randomUUID();

    return new SignJWT({
      openId: payload.openId,
      name: payload.name,
      jti,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .setJti(jti)
      .sign(secretKey);
  }

  async verifySession(
    cookieValue: string | undefined | null,
  ): Promise<{ openId: string; name: string; jti?: string } | null> {
    if (!cookieValue) {
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { openId, name, jti } = payload as Record<string, unknown>;

      if (!isNonEmptyString(openId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }

      if (typeof jti === "string" && (await tokenBlacklist.isBlacklisted(jti))) {
        console.warn("[Auth] Token is blacklisted (logged out)");
        return null;
      }

      return {
        openId,
        name,
        jti: typeof jti === "string" ? jti : undefined,
      };
    } catch (error) {
      if (!ENV.isProduction) {
        console.warn("[Auth] Session verification failed", String(error));
      }
      return null;
    }
  }

  async extractTokenInfo(
    cookieValue: string | undefined | null,
  ): Promise<{ jti: string; exp: number } | null> {
    if (!cookieValue) return null;

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { jti, exp } = payload as Record<string, unknown>;

      if (typeof jti === "string" && typeof exp === "number") {
        return { jti, exp: exp * 1000 };
      }
      return null;
    } catch {
      return null;
    }
  }

  async authenticateRequest(req: Request): Promise<User> {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    let token: string | undefined;
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice("Bearer ".length).trim();
    }

    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = token || cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);

    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }

    const signedInAt = new Date();
    let user = await db.getUserByOpenId(session.openId);

    // 신규 세션 사용자면 최소 정보로 사용자 레코드 생성
    if (!user) {
      await db.upsertUser({
        openId: session.openId,
        name: session.name,
        email: null,
        loginMethod: "boj",
        lastSignedIn: signedInAt,
      });
      user = await db.getUserByOpenId(session.openId);
    }

    if (!user) {
      throw ForbiddenError("User not found");
    }

    await db.upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt,
    });

    return user;
  }
}

export const sdk = new SDKServer();
