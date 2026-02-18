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

  it("returns 503 when BOJ verification is temporarily unavailable", async () => {
    vi.mocked(verifyBojCredentials).mockResolvedValueOnce({
      ok: false,
      code: "NETWORK_ERROR",
      message: "network unstable",
    });

    const response = await fetch(`${baseUrl}/api/auth/boj/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: "tourist", password: "pw" }),
    });
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.code).toBe("NETWORK_ERROR");
    expect(sdk.createSessionToken).not.toHaveBeenCalled();
  });

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
});
