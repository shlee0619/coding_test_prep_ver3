import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", () => ({
  getLatestRecommendations: vi.fn(),
  getProblems: vi.fn(),
  getLinkedAccount: vi.fn(),
  getUserSolvedProblems: vi.fn(),
  getUserTagStats: vi.fn(),
  upsertProblems: vi.fn(),
}));

vi.mock("../solvedac", () => ({
  searchProblems: vi.fn(),
  getProblemsById: vi.fn(),
  getTagDisplayName: vi.fn((tag: any) => tag?.displayNames?.[0]?.name ?? tag?.key ?? "tag"),
}));

import * as db from "../db";
import * as solvedac from "../solvedac";
import { appRouter } from "../routers";

function createCaller() {
  const ctx: TrpcContext = {
    user: {
      id: 1,
      openId: "boj:test",
      name: "test",
      email: null,
      loginMethod: "boj",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as any,
    res: {} as any,
  };
  return appRouter.createCaller(ctx);
}

function makeStoredRecommendation(problemId: number) {
  return {
    problemId,
    score: 0.7,
    category: "popular" as const,
    priority: 7,
    reasons: ["stored"],
    tags: ["구현"],
    level: 7,
    scoreBreakdown: {
      tagWeakness: 0.3,
      levelFitness: 0.7,
      stepProgress: 0.5,
      problemQuality: 0.8,
      diversity: 0.5,
    },
  };
}

function makeSearchProblem(problemId: number) {
  return {
    problemId,
    titleKo: `문제 ${problemId}`,
    titles: [{ language: "ko", title: `문제 ${problemId}` }],
    isSolvable: true,
    isPartial: false,
    acceptedUserCount: 10000 + problemId,
    level: 8,
    votedUserCount: 0,
    sprout: false,
    givesNoRating: false,
    isLevelLocked: false,
    averageTries: 1.5,
    official: true,
    tags: [
      {
        key: "implementation",
        isMeta: false,
        bojTagId: 1,
        problemCount: 1000,
        displayNames: [{ language: "ko", name: "구현", short: "구현" }],
      },
    ],
  };
}

describe("recommendations.list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getUserTagStats).mockResolvedValue([
      {
        id: 1,
        userId: 1,
        snapshotDate: new Date(),
        tag: "구현",
        attemptedCount: 10,
        solvedCount: 7,
        recentSolvedCount30d: 3,
        avgLevelSolved: 7,
        maxLevelSolved: 12,
        levelDistribution: {},
        totalProblemsInTag: 1000,
        coverageRate: 0.1,
        lastSolvedAt: new Date(),
        daysSinceLastSolved: 10,
        recentSolvedCount60d: 5,
        recentSolvedCount90d: 7,
        weakScore: 0.8,
        weakScoreDetails: {
          coverageScore: 0.8,
          levelGapScore: 0.6,
          recencyScore: 0.4,
          ceilingScore: 0.5,
          consistencyScore: 0.3,
        },
        createdAt: new Date(),
      },
    ] as any);
  });

  it("returns many items in realtime mode (not fixed to 40)", async () => {
    vi.mocked(db.getLatestRecommendations).mockResolvedValueOnce({
      id: 1,
      userId: 1,
      generatedAt: new Date(),
      criteria: null,
      stats: {
        totalCount: 5,
        byCategory: {
          weakness: 0,
          challenge: 0,
          review: 0,
          popular: 5,
          foundation: 0,
        },
        avgScore: 0.6,
        tagCoverage: ["구현"],
      },
      items: [1, 2, 3, 4, 5].map((id) => makeStoredRecommendation(id)),
      createdAt: new Date(),
    } as any);

    vi.mocked(db.getLinkedAccount).mockResolvedValue({
      id: 1,
      userId: 1,
      provider: "BOJ",
      handle: "test",
      verified: true,
      solvedCount: 0,
      tier: 10,
      rating: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    vi.mocked(db.getUserSolvedProblems).mockResolvedValue([]);
    vi.mocked(solvedac.searchProblems).mockImplementation(async (params: any) => {
      const page = params.page ?? 1;
      const start = (page - 1) * 50 + 1000;
      return {
        items: Array.from({ length: 50 }, (_, idx) => makeSearchProblem(start + idx)),
        count: 300,
      } as any;
    });
    vi.mocked(solvedac.getProblemsById).mockImplementation(async (ids: number[]) => {
      return ids.map((id) => makeSearchProblem(id)) as any;
    });
    vi.mocked(db.getProblems).mockResolvedValue([]);
    vi.mocked(db.upsertProblems).mockResolvedValue(undefined);

    const caller = createCaller();
    const result = await caller.recommendations.list({
      realtime: true,
      limit: 120,
    });

    expect(result.items.length).toBeGreaterThanOrEqual(100);
    expect(result.items.length).toBeLessThanOrEqual(120);
    expect(result.stats?.totalCount).toBe(result.items.length);
  });

  it("applies excludeSolved filter in realtime mode", async () => {
    vi.mocked(db.getLatestRecommendations).mockResolvedValue(null as any);
    vi.mocked(db.getLinkedAccount).mockResolvedValue({
      id: 1,
      userId: 1,
      provider: "BOJ",
      handle: "test",
      verified: true,
      solvedCount: 0,
      tier: 10,
      rating: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    vi.mocked(db.getUserSolvedProblems).mockResolvedValue([
      {
        id: 1,
        userId: 1,
        problemId: 1000,
        status: "SOLVED",
      },
    ] as any);

    vi.mocked(solvedac.searchProblems).mockResolvedValue({
      items: [makeSearchProblem(1000), makeSearchProblem(1001)],
      count: 2,
    } as any);
    vi.mocked(solvedac.getProblemsById).mockImplementation(async (ids: number[]) => {
      return ids.map((id) => makeSearchProblem(id)) as any;
    });
    vi.mocked(db.getProblems).mockResolvedValue([]);
    vi.mocked(db.upsertProblems).mockResolvedValue(undefined);

    const caller = createCaller();

    const excluded = await caller.recommendations.list({
      realtime: true,
      limit: 10,
      excludeSolved: true,
    });

    const included = await caller.recommendations.list({
      realtime: true,
      limit: 10,
      excludeSolved: false,
    });

    const excludedIds = excluded.items.map((item) => item.problemId);
    const includedIds = included.items.map((item) => item.problemId);

    expect(excludedIds).not.toContain(1000);
    expect(includedIds).toContain(1000);
  });
});
