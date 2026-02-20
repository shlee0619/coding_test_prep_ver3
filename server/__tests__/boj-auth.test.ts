import { beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { verifyBojCredentials } from "../boj-auth";

vi.mock("axios");

function mockPreflightSuccess() {
  vi.mocked(axios.get).mockResolvedValueOnce({
    status: 200,
    data: '<html><form><input name="csrf_key" value="test-csrf-token" /></form></html>',
    headers: {
      "set-cookie": ["OnlineJudge=abc123; Path=/; HttpOnly"],
    },
  } as any);
}

function mockPreflightWithoutCsrf() {
  vi.mocked(axios.get).mockResolvedValueOnce({
    status: 200,
    data: "<html><form></form></html>",
    headers: {
      "set-cookie": ["OnlineJudge=abc123; Path=/; HttpOnly"],
    },
  } as any);
}

describe("verifyBojCredentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns INVALID_CREDENTIALS when BOJ redirects to login error page", async () => {
    mockPreflightSuccess();
    vi.mocked(axios.post).mockResolvedValueOnce({
      status: 302,
      headers: { location: "/login?error=1&next=%2F&retry=1" },
    } as any);

    const result = await verifyBojCredentials("tourist", "wrong-password");

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
  });

  it("returns CHALLENGE_REQUIRED when BOJ redirects with error=1 and csrf is missing", async () => {
    mockPreflightWithoutCsrf();
    vi.mocked(axios.post).mockResolvedValueOnce({
      status: 302,
      headers: { location: "/login?error=1&next=%2F&retry=1" },
    } as any);

    const result = await verifyBojCredentials("tourist", "correct-password");

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      code: "CHALLENGE_REQUIRED",
    });
  });

  it("returns ok=true when BOJ accepts credentials and redirects", async () => {
    mockPreflightSuccess();
    vi.mocked(axios.post).mockResolvedValueOnce({
      status: 302,
      headers: { location: "/" },
    } as any);

    const result = await verifyBojCredentials("tourist", "correct-password");

    expect(result).toEqual({ ok: true });
  });

  it("returns CHALLENGE_REQUIRED when BOJ does not redirect (possible extra challenge)", async () => {
    mockPreflightSuccess();
    vi.mocked(axios.post).mockResolvedValueOnce({
      status: 200,
      headers: {},
    } as any);

    const result = await verifyBojCredentials("tourist", "any-password");

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      code: "CHALLENGE_REQUIRED",
    });
  });

  it("returns NETWORK_ERROR when request fails", async () => {
    mockPreflightSuccess();
    vi.mocked(axios.post).mockRejectedValueOnce(new Error("network down"));

    const result = await verifyBojCredentials("tourist", "any-password");

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      code: "NETWORK_ERROR",
    });
  });

  it("sends expected form fields including preflight cookies and CSRF token", async () => {
    mockPreflightSuccess();
    vi.mocked(axios.post).mockResolvedValueOnce({
      status: 302,
      headers: { location: "/" },
    } as any);

    await verifyBojCredentials("my_handle", "my_password");

    // Verify pre-flight GET
    expect(axios.get).toHaveBeenCalledTimes(1);
    const [getUrl] = vi.mocked(axios.get).mock.calls[0] as [string];
    expect(getUrl).toBe("https://www.acmicpc.net/login");

    // Verify POST
    expect(axios.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = vi.mocked(axios.post).mock.calls[0] as [string, string, any];
    expect(url).toBe("https://www.acmicpc.net/signin");
    expect(body).toContain("login_user_id=my_handle");
    expect(body).toContain("login_password=my_password");
    expect(body).toContain("next=%2F");
    expect(body).toContain("csrf_key=test-csrf-token");
    expect(config.headers.Cookie).toBe("OnlineJudge=abc123");
  });

  it("returns CHALLENGE_REQUIRED for 429 rate limiting", async () => {
    mockPreflightSuccess();
    vi.mocked(axios.post).mockResolvedValueOnce({
      status: 429,
      headers: {},
    } as any);

    const result = await verifyBojCredentials("tourist", "any-password");

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ code: "CHALLENGE_REQUIRED" });
  });

  it("returns CHALLENGE_REQUIRED for 403 forbidden", async () => {
    mockPreflightSuccess();
    vi.mocked(axios.post).mockResolvedValueOnce({
      status: 403,
      headers: {},
    } as any);

    const result = await verifyBojCredentials("tourist", "any-password");

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ code: "CHALLENGE_REQUIRED" });
  });

  it("returns UNEXPECTED_RESPONSE for unhandled status codes", async () => {
    mockPreflightSuccess();
    vi.mocked(axios.post).mockResolvedValueOnce({
      status: 301,
      headers: { location: "/somewhere" },
    } as any);

    const result = await verifyBojCredentials("tourist", "any-password");

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ code: "UNEXPECTED_RESPONSE" });
  });

  it("still works when pre-flight GET fails (graceful degradation)", async () => {
    vi.mocked(axios.get).mockRejectedValueOnce(new Error("login page down"));
    vi.mocked(axios.post).mockResolvedValueOnce({
      status: 302,
      headers: { location: "/" },
    } as any);

    const result = await verifyBojCredentials("tourist", "correct-password");

    expect(result).toEqual({ ok: true });
  });

  it("returns NETWORK_ERROR when pre-flight fails and BOJ redirects with error=1", async () => {
    vi.mocked(axios.get).mockRejectedValueOnce(new Error("login page down"));
    vi.mocked(axios.post).mockResolvedValueOnce({
      status: 302,
      headers: { location: "/login?error=1&next=%2F&retry=1" },
    } as any);

    const result = await verifyBojCredentials("tourist", "correct-password");

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ code: "NETWORK_ERROR" });
  });

  it("proceeds without CSRF token when login page has no csrf_key input", async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      status: 200,
      data: "<html><form></form></html>",
      headers: { "set-cookie": ["OnlineJudge=xyz; Path=/"] },
    } as any);
    vi.mocked(axios.post).mockResolvedValueOnce({
      status: 302,
      headers: { location: "/" },
    } as any);

    await verifyBojCredentials("tourist", "password");

    const [, body] = vi.mocked(axios.post).mock.calls[0] as [string, string];
    expect(body).not.toContain("csrf_key");
  });
});
