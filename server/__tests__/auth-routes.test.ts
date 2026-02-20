import express from "express";
import type { Server } from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../boj-auth", () => ({
  verifyBojCredentials: vi.fn(),
}));

vi.mock("../solvedac", () => ({
  getUserProfile: vi.fn(),
}));

vi.mock("../db", () => ({
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  getLinkedAccount: vi.fn(),
  updateLinkedAccount: vi.fn(),
  createLinkedAccount: vi.fn(),
}));

vi.mock("../_core/cookies", () => ({
  getSessionCookieOptions: vi.fn(() => ({
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
  })),
}));

vi.mock("../_core/sdk", () => ({
  sdk: {
    createSessionToken: vi.fn(),
    extractTokenInfo: vi.fn(),
    authenticateRequest: vi.fn(),
  },
  tokenBlacklist: {
    add: vi.fn(),
  },
}));

import { registerOAuthRoutes } from "../_core/oauth";
import { verifyBojCredentials } from "../boj-auth";
import * as solvedac from "../solvedac";
import * as db from "../db";
import { sdk } from "../_core/sdk";

type MockUser = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
};

function makeSolvedAcProfile(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    handle: "tourist",
    bio: "",
    solvedCount: 1500,
    tier: 31,
    rating: 3500,
    ratingByProblemsSum: 0,
    ratingByClass: 0,
    ratingBySolvedCount: 0,
    ratingByVoteCount: 0,
    class: 0,
    classDecoration: "none",
    rivalCount: 0,
    reverseRivalCount: 0,
    maxStreak: 0,
    rank: 0,
    ...overrides,
  } as any;
}

describe("Auth routes", () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(() => {
    vi.clearAllMocks();
    const app = express();
    app.use(express.json());
    registerOAuthRoutes(app);
    server = app.listen(0);
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("returns boj provider metadata", async () => {
    const response = await fetch(`${baseUrl}/api/auth/providers`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      boj: true,
      dev: true,
    });
  });

  it("starts solved.ac profile challenge", async () => {
    vi.mocked(solvedac.getUserProfile).mockResolvedValueOnce(
      makeSolvedAcProfile({ handle: "tourist" }),
    );

    const response = await fetch(`${baseUrl}/api/auth/solvedac/challenge/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: "tourist" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(typeof body.challengeId).toBe("string");
    expect(typeof body.token).toBe("string");
  });

  it("verifies solved.ac challenge and issues app session", async () => {
    vi.mocked(solvedac.getUserProfile).mockResolvedValueOnce(
      makeSolvedAcProfile({ handle: "tourist", bio: "" }),
    );
    const startResponse = await fetch(`${baseUrl}/api/auth/solvedac/challenge/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: "tourist" }),
    });
    const startBody = await startResponse.json();
    const challengeId = startBody.challengeId as string;
    const token = startBody.token as string;

    const now = new Date();
    vi.mocked(solvedac.getUserProfile).mockResolvedValueOnce(
      makeSolvedAcProfile({ handle: "tourist", bio: `verify: ${token}` }),
    );
    vi.mocked(db.upsertUser).mockResolvedValue(undefined);
    vi.mocked(db.getUserByOpenId).mockResolvedValue({
      id: 1,
      openId: "boj:tourist",
      name: "tourist",
      email: null,
      loginMethod: "boj",
      role: "user",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    } as any);
    vi.mocked(db.getLinkedAccount).mockResolvedValueOnce(undefined);
    vi.mocked(db.createLinkedAccount).mockResolvedValueOnce(1);
    vi.mocked(sdk.createSessionToken).mockResolvedValueOnce("session-token-solvedac");

    const verifyResponse = await fetch(`${baseUrl}/api/auth/solvedac/challenge/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId }),
    });
    const verifyBody = await verifyResponse.json();

    expect(verifyResponse.status).toBe(200);
    expect(verifyBody.success).toBe(true);
    expect(verifyBody.app_session_id).toBe("session-token-solvedac");
  });

  it("rejects missing credentials", async () => {
    const response = await fetch(`${baseUrl}/api/auth/boj/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: "tourist" }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.code).toBe("BOJ_LOGIN_001");
  });

  it("returns 401 when BOJ credentials are invalid", async () => {
    vi.mocked(verifyBojCredentials).mockResolvedValueOnce({
      ok: false,
      code: "INVALID_CREDENTIALS",
      message: "invalid",
    });

    const response = await fetch(`${baseUrl}/api/auth/boj/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: "tourist", password: "wrong" }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns 401 for INVALID_CREDENTIALS even when user already exists", async () => {
    const now = new Date();
    const existingUser: MockUser = {
      id: 1,
      openId: "boj:tourist",
      name: "tourist",
      email: null,
      loginMethod: "boj",
      role: "user",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    };

    vi.mocked(verifyBojCredentials).mockResolvedValueOnce({
      ok: false,
      code: "INVALID_CREDENTIALS",
      message: "invalid",
      detail: "302 -> /login?error=1",
    });
    vi.mocked(db.getUserByOpenId).mockResolvedValue(existingUser as any);
    const response = await fetch(`${baseUrl}/api/auth/boj/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: "tourist", password: "pw" }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.code).toBe("INVALID_CREDENTIALS");
    expect(sdk.createSessionToken).not.toHaveBeenCalled();
  });

  it("allows login even when solved.ac profile is not found", async () => {
    const now = new Date();
    vi.mocked(verifyBojCredentials).mockResolvedValueOnce({ ok: true });
    vi.mocked(solvedac.getUserProfile).mockResolvedValueOnce(null);
    vi.mocked(db.upsertUser).mockResolvedValue(undefined);
    vi.mocked(db.getUserByOpenId).mockResolvedValue({
      id: 1,
      openId: "boj:unknown_user",
      name: "unknown_user",
      email: null,
      loginMethod: "boj",
      role: "user",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    } as any);
    vi.mocked(sdk.createSessionToken).mockResolvedValueOnce("session-token-fallback");

    const response = await fetch(`${baseUrl}/api/auth/boj/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: "unknown_user", password: "pw" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.app_session_id).toBe("session-token-fallback");
    expect(Array.isArray(body.warnings)).toBe(true);
  });

  it.each([
    "CHALLENGE_REQUIRED",
    "NETWORK_ERROR",
    "UNEXPECTED_RESPONSE",
  ] as const)(
    "rejects login and never issues session when BOJ verification fails (%s)",
    async (code) => {
      vi.mocked(verifyBojCredentials).mockResolvedValueOnce({
        ok: false,
        code,
        message: "verification failed",
      });

      const response = await fetch(`${baseUrl}/api/auth/boj/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: "tourist", password: "pw" }),
      });
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.success).toBe(false);
      expect(body.code).toBe(code);
      expect(sdk.createSessionToken).not.toHaveBeenCalled();
      expect(db.upsertUser).not.toHaveBeenCalled();
      expect(solvedac.getUserProfile).not.toHaveBeenCalled();
    },
  );

  it("logs in successfully and returns app session token", async () => {
    const now = new Date();
    const user: MockUser = {
      id: 1,
      openId: "boj:tourist",
      name: "tourist",
      email: null,
      loginMethod: "boj",
      role: "user",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    };

    vi.mocked(verifyBojCredentials).mockResolvedValueOnce({ ok: true });
    vi.mocked(solvedac.getUserProfile).mockResolvedValueOnce({
      handle: "tourist",
      solvedCount: 1500,
      tier: 31,
      rating: 3500,
    } as any);
    vi.mocked(db.upsertUser).mockResolvedValue(undefined);
    vi.mocked(db.getUserByOpenId).mockResolvedValue(user as any);
    vi.mocked(db.getLinkedAccount).mockResolvedValueOnce(undefined);
    vi.mocked(db.createLinkedAccount).mockResolvedValueOnce(1);
    vi.mocked(sdk.createSessionToken).mockResolvedValueOnce("session-token-123");

    const response = await fetch(`${baseUrl}/api/auth/boj/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: "tourist", password: "pw" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.app_session_id).toBe("session-token-123");
    expect(body.user).toMatchObject({
      id: 1,
      openId: "boj:tourist",
      loginMethod: "boj",
    });
    expect(db.createLinkedAccount).toHaveBeenCalledTimes(1);
  });

  it("clears invalid session cookie on /api/auth/me and returns 401", async () => {
    const error = Object.assign(new Error("Invalid session cookie"), {
      statusCode: 403,
    });
    vi.mocked(sdk.authenticateRequest).mockRejectedValueOnce(error);

    const response = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        cookie: "app_session_id=stale-token",
      },
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({ error: "Not authenticated", user: null });
    expect(response.headers.get("set-cookie") || "").toContain("app_session_id=");
  });
});
