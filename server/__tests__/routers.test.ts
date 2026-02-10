import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database functions
vi.mock("../db", () => ({
  getLinkedAccount: vi.fn(),
  createLinkedAccount: vi.fn(),
  updateLinkedAccount: vi.fn(),
  deleteLinkedAccount: vi.fn(),
  getUserTagStats: vi.fn(),
  getLatestRecommendations: vi.fn(),
  getUserGoals: vi.fn(),
  createGoal: vi.fn(),
  updateGoal: vi.fn(),
  deleteGoal: vi.fn(),
  updateProblemBookmark: vi.fn(),
  getUserSolvedProblems: vi.fn(),
}));

// Mock solved.ac service
vi.mock("../solvedac", () => ({
  getUserProfile: vi.fn(),
  getUserSolvedProblems: vi.fn(),
  getProblemsById: vi.fn(),
}));

import * as db from "../db";
import * as solvedac from "../solvedac";

describe("API Routers Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Link Router Logic", () => {
    it("should get linked account for user", async () => {
      const mockAccount = {
        id: 1,
        userId: 1,
        handle: "tourist",
        tier: 31,
        rating: 3500,
        solvedCount: 1500,
      };

      vi.mocked(db.getLinkedAccount).mockResolvedValueOnce(mockAccount as any);

      const result = await db.getLinkedAccount(1);

      expect(db.getLinkedAccount).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockAccount);
    });

    it("should connect BOJ account", async () => {
      const mockProfile = {
        handle: "tourist",
        tier: 31,
        rating: 3500,
        solvedCount: 1500,
      };

      vi.mocked(solvedac.getUserProfile).mockResolvedValueOnce(mockProfile as any);
      vi.mocked(db.createLinkedAccount).mockResolvedValueOnce(1);

      const profile = await solvedac.getUserProfile("tourist");
      expect(profile).toEqual(mockProfile);

      const accountId = await db.createLinkedAccount({
        userId: 1,
        handle: "tourist",
        tier: 31,
        rating: 3500,
        solvedCount: 1500,
      });
      expect(accountId).toBe(1);
    });
  });

  describe("Analytics Router Logic", () => {
    it("should get tag statistics", async () => {
      const mockStats = [
        { tag: "dp", solvedCount: 50, attemptedCount: 60, weakScore: 0.3 },
        { tag: "graph", solvedCount: 30, attemptedCount: 50, weakScore: 0.6 },
      ];

      vi.mocked(db.getUserTagStats).mockResolvedValueOnce(mockStats as any);

      const result = await db.getUserTagStats(1);

      expect(db.getUserTagStats).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockStats);
    });
  });

  describe("Recommendations Router Logic", () => {
    it("should get recommendations for user", async () => {
      const mockRecommendations = {
        id: 1,
        userId: 1,
        recommendations: [
          { problemId: 1000, reasons: ["약점 태그: dp"] },
          { problemId: 1001, reasons: ["약점 태그: graph"] },
        ],
      };

      vi.mocked(db.getLatestRecommendations).mockResolvedValueOnce(mockRecommendations as any);

      const result = await db.getLatestRecommendations(1);

      expect(db.getLatestRecommendations).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockRecommendations);
    });
  });

  describe("Goals Router Logic", () => {
    it("should create a new goal", async () => {
      const newGoal = {
        userId: 1,
        title: "이번 주 10문제 풀기",
        type: "problem_count" as const,
        targetValue: 10,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      vi.mocked(db.createGoal).mockResolvedValueOnce(1);

      const goalId = await db.createGoal(newGoal);

      expect(db.createGoal).toHaveBeenCalledWith(newGoal);
      expect(goalId).toBe(1);
    });

    it("should update goal status", async () => {
      vi.mocked(db.updateGoal).mockResolvedValueOnce(undefined);

      await db.updateGoal(1, { status: "completed" });

      expect(db.updateGoal).toHaveBeenCalledWith(1, { status: "completed" });
    });

    it("should delete a goal", async () => {
      vi.mocked(db.deleteGoal).mockResolvedValueOnce(undefined);

      await db.deleteGoal(1);

      expect(db.deleteGoal).toHaveBeenCalledWith(1);
    });
  });

  describe("Problems Router Logic", () => {
    it("should toggle bookmark", async () => {
      vi.mocked(db.updateProblemBookmark).mockResolvedValueOnce(undefined);

      await db.updateProblemBookmark(1, 1000, true);

      expect(db.updateProblemBookmark).toHaveBeenCalledWith(1, 1000, true);
    });

    it("should get user solved problems", async () => {
      const mockProblems = [
        { problemId: 1000, status: "solved" },
        { problemId: 1001, status: "solved" },
      ];

      vi.mocked(db.getUserSolvedProblems).mockResolvedValueOnce(mockProblems as any);

      const result = await db.getUserSolvedProblems(1);

      expect(db.getUserSolvedProblems).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockProblems);
    });
  });
});
