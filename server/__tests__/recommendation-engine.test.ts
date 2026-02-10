import { afterEach, describe, expect, it, vi } from "vitest";
import * as solvedac from "../solvedac";
import { generateRecommendations, type WeaknessScore } from "../recommendation-engine";

function makeProblem(problemId: number, level: number) {
  return {
    problemId,
    titleKo: `문제 ${problemId}`,
    titles: [{ language: "ko", title: `문제 ${problemId}` }],
    isSolvable: true,
    isPartial: false,
    acceptedUserCount: 1000 + problemId,
    level,
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
  } as solvedac.SolvedAcProblem;
}

describe("generateRecommendations", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("backfills recommendations to a practical minimum count when primary categories are sparse", async () => {
    vi.spyOn(solvedac, "searchProblems").mockImplementation(async (params) => {
      const page = params.page ?? 1;
      const level = params.levelMin ?? 5;
      const start = (page - 1) * 50 + 1;
      const items = Array.from({ length: 50 }, (_, idx) => makeProblem(start + idx, level));
      return {
        items,
        count: 300,
      };
    });

    const solvedProblems: solvedac.SolvedAcProblem[] = [];
    const weaknessScores: WeaknessScore[] = [];

    const result = await generateRecommendations(
      1,
      10,
      solvedProblems,
      weaknessScores,
      undefined
    );

    expect(result.items.length).toBeGreaterThanOrEqual(40);
    const uniqueIds = new Set(result.items.map((i) => i.problemId));
    expect(uniqueIds.size).toBe(result.items.length);
  });
});
