/**
 * 개선된 추천 엔진
 *
 * 약점 분석 지표:
 * - Coverage Rate: 태그별 전체 문제 대비 풀이 비율
 * - Level Gap: 사용자 티어 대비 태그별 평균 난이도 차이
 * - Recency Score: 최근 풀이 빈도
 * - Difficulty Ceiling: 해당 태그에서 푼 최고 난이도 vs 기대치
 * - Consistency: 난이도별 풀이 분포 균형
 *
 * 추천 점수 계산:
 * - 30% 태그 약점
 * - 25% 난이도 적합도
 * - 20% 단계 진행
 * - 15% 문제 품질
 * - 10% 다양성
 */

import * as solvedac from "./solvedac";
import type { TagExpectation } from "./solvedac";
import {
  InsertUserTagStats,
  RecommendationCategory,
  RecommendationItem,
} from "../drizzle/schema";

// ==================== 상수 정의 ====================
// Phase 2: TAG_EXPECTATIONS는 getTagExpectations()로 동적 로딩

/** 약점 점수 가중치 */
const WEAKNESS_WEIGHTS = {
  coverage: 0.25, // 커버리지 비율
  levelGap: 0.25, // 난이도 갭
  recency: 0.2, // 최근성
  ceiling: 0.2, // 난이도 상한
  consistency: 0.1, // 일관성
};

/** 추천 점수 가중치 */
const RECOMMENDATION_WEIGHTS = {
  tagWeakness: 0.3, // 태그 약점
  levelFitness: 0.25, // 난이도 적합도
  stepProgress: 0.2, // 단계 진행
  problemQuality: 0.15, // 문제 품질
  diversity: 0.1, // 다양성
};

/** 카테고리별 추천 수 제한 */
const CATEGORY_LIMITS: Record<RecommendationCategory, number> = {
  weakness: 24,
  challenge: 12,
  review: 12,
  popular: 12,
  foundation: 10,
};

/** 추천 최소 개수 목표 (가능한 한 많이 확보) */
const MIN_RECOMMENDATION_COUNT = 40;

// ==================== 타입 정의 ====================

export interface TagAnalysis {
  tag: string;
  solvedCount: number;
  avgLevel: number;
  maxLevel: number;
  levelDistribution: Record<string, number>;
  totalProblemsInTag: number;
  lastSolvedAt: Date | null;
  recentCounts: {
    days30: number;
    days60: number;
    days90: number;
  };
}

export interface WeaknessScore {
  tag: string;
  totalScore: number;
  details: {
    coverageScore: number;
    levelGapScore: number;
    recencyScore: number;
    ceilingScore: number;
    consistencyScore: number;
  };
  analysis: TagAnalysis;
}

export interface UserProfile {
  tier: number;
  avgLevel: number;
  solvedCount: number;
  tagAnalysis: Map<string, TagAnalysis>;
}

// ==================== 약점 분석 함수 ====================

/**
 * 사용자의 태그별 분석 데이터 생성
 */
export function analyzeUserTags(
  problems: solvedac.SolvedAcProblem[],
  solvedDates: Map<number, Date>
): Map<string, TagAnalysis> {
  const tagMap = new Map<string, TagAnalysis>();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  for (const problem of problems) {
    const solvedAt = solvedDates.get(problem.problemId) || now;

    for (const tagObj of problem.tags) {
      const tag = solvedac.getTagDisplayName(tagObj);

      if (!tagMap.has(tag)) {
        tagMap.set(tag, {
          tag,
          solvedCount: 0,
          avgLevel: 0,
          maxLevel: 0,
          levelDistribution: {},
          totalProblemsInTag: tagObj.problemCount || 0,
          lastSolvedAt: null,
          recentCounts: { days30: 0, days60: 0, days90: 0 },
        });
      }

      const analysis = tagMap.get(tag)!;
      analysis.solvedCount++;

      // 난이도 분포 업데이트
      const levelKey = String(problem.level);
      analysis.levelDistribution[levelKey] =
        (analysis.levelDistribution[levelKey] || 0) + 1;

      // 최고 난이도 업데이트
      if (problem.level > analysis.maxLevel) {
        analysis.maxLevel = problem.level;
      }

      // 최근 풀이 시간 업데이트
      if (!analysis.lastSolvedAt || solvedAt > analysis.lastSolvedAt) {
        analysis.lastSolvedAt = solvedAt;
      }

      // 최근 풀이 수 계산
      if (solvedAt >= thirtyDaysAgo) analysis.recentCounts.days30++;
      if (solvedAt >= sixtyDaysAgo) analysis.recentCounts.days60++;
      if (solvedAt >= ninetyDaysAgo) analysis.recentCounts.days90++;
    }
  }

  // 평균 난이도 계산
  for (const [, analysis] of tagMap) {
    let totalLevel = 0;
    let count = 0;
    for (const [level, cnt] of Object.entries(analysis.levelDistribution)) {
      totalLevel += Number(level) * cnt;
      count += cnt;
    }
    analysis.avgLevel = count > 0 ? totalLevel / count : 0;
  }

  return tagMap;
}

/**
 * 약점 점수 계산 (0-1, 높을수록 약함)
 * Phase 2: tagExpectations 맵 사용 (동적 기대치)
 */
export function calculateWeaknessScores(
  tagAnalysis: Map<string, TagAnalysis>,
  userTier: number,
  tagExpectations?: Map<string, TagExpectation>
): WeaknessScore[] {
  const results: WeaknessScore[] = [];
  const expectedLevel = Math.min(userTier, 30); // 티어 기반 기대 난이도

  for (const [tag, analysis] of tagAnalysis) {
    // 1. Coverage Score (커버리지 비율 - 낮을수록 약함)
    const expectedCount = getExpectedSolveCount(
      tag,
      userTier,
      tagExpectations
    );
    const coverageRatio = Math.min(analysis.solvedCount / expectedCount, 1);
    const coverageScore = 1 - coverageRatio;

    // 2. Level Gap Score (평균 난이도 갭 - 기대보다 낮으면 약함)
    const levelGap = expectedLevel - analysis.avgLevel;
    const levelGapScore = Math.max(0, Math.min(levelGap / 10, 1));

    // 3. Recency Score (최근성 - 오래 안 풀었으면 약함)
    let recencyScore = 0;
    if (analysis.lastSolvedAt) {
      const daysSinceLastSolved = Math.floor(
        (Date.now() - analysis.lastSolvedAt.getTime()) / (24 * 60 * 60 * 1000)
      );
      recencyScore = Math.min(daysSinceLastSolved / 90, 1); // 90일 기준
    } else {
      recencyScore = 1;
    }

    // 4. Ceiling Score (난이도 상한 - 기대보다 낮으면 약함)
    const expectedCeiling = Math.min(expectedLevel + 3, 30);
    const ceilingGap = expectedCeiling - analysis.maxLevel;
    const ceilingScore = Math.max(0, Math.min(ceilingGap / 10, 1));

    // 5. Consistency Score (일관성 - 특정 난이도에만 치우치면 약함)
    const consistencyScore = calculateConsistencyScore(
      analysis.levelDistribution,
      expectedLevel
    );

    // 총합 계산
    const totalScore =
      WEAKNESS_WEIGHTS.coverage * coverageScore +
      WEAKNESS_WEIGHTS.levelGap * levelGapScore +
      WEAKNESS_WEIGHTS.recency * recencyScore +
      WEAKNESS_WEIGHTS.ceiling * ceilingScore +
      WEAKNESS_WEIGHTS.consistency * consistencyScore;

    results.push({
      tag,
      totalScore: Math.max(0, Math.min(1, totalScore)),
      details: {
        coverageScore,
        levelGapScore,
        recencyScore,
        ceilingScore,
        consistencyScore,
      },
      analysis,
    });
  }

  // 점수 높은 순 (약점 순)으로 정렬
  results.sort((a, b) => b.totalScore - a.totalScore);

  return results;
}

/**
 * 태그별 기대 풀이 수 계산 (Phase 2: 동적 기대치)
 */
function getExpectedSolveCount(
  tag: string,
  userTier: number,
  tagExpectations?: Map<string, TagExpectation>
): number {
  const expectation = tagExpectations?.get(tag);
  if (expectation) {
    const tierFactor =
      1 + (userTier / 30) * (expectation.tierMultiplier - 1);
    return Math.round(expectation.baseCount * tierFactor);
  }
  // 기본값: 티어에 비례
  return Math.round(15 + userTier * 1.5);
}

/**
 * 일관성 점수 계산 (난이도별 분포 균형)
 */
function calculateConsistencyScore(
  distribution: Record<string, number>,
  expectedLevel: number
): number {
  const levels = Object.keys(distribution).map(Number);
  if (levels.length <= 1) return 0.5; // 데이터 부족

  // 기대 난이도 주변에 풀이가 집중되어 있는지 확인
  let lowerCount = 0;
  let aroundCount = 0;
  let higherCount = 0;

  for (const [levelStr, count] of Object.entries(distribution)) {
    const level = Number(levelStr);
    if (level < expectedLevel - 3) {
      lowerCount += count;
    } else if (level > expectedLevel + 3) {
      higherCount += count;
    } else {
      aroundCount += count;
    }
  }

  const total = lowerCount + aroundCount + higherCount;
  if (total === 0) return 0.5;

  // 낮은 난이도에만 치우쳐 있으면 약점
  const lowerRatio = lowerCount / total;
  return Math.min(lowerRatio * 1.5, 1);
}

// ==================== 추천 생성 함수 ====================

/**
 * 문제 추천 생성
 * Phase 2/3: tagExpectations, averageTries, sort 옵션 반영
 */
export async function generateRecommendations(
  userId: number,
  userTier: number,
  solvedProblems: solvedac.SolvedAcProblem[],
  weaknessScores: WeaknessScore[],
  tagExpectations?: Map<string, solvedac.TagExpectation>
): Promise<{
  items: RecommendationItem[];
  stats: {
    totalCount: number;
    byCategory: Record<RecommendationCategory, number>;
    avgScore: number;
    tagCoverage: string[];
  };
  criteria: {
    userTier: number;
    userAvgLevel: number;
    levelMin: number;
    levelMax: number;
    weakTags: string[];
    excludeSolved: boolean;
  };
}> {
  const solvedIds = new Set(solvedProblems.map((p) => p.problemId));

  // 사용자 평균 레벨 계산
  const avgLevel =
    solvedProblems.length > 0
      ? Math.round(
          solvedProblems.reduce((sum, p) => sum + p.level, 0) /
            solvedProblems.length
        )
      : Math.floor(userTier * 0.8);

  const allItems: RecommendationItem[] = [];
  const usedProblemIds = new Set<number>();
  const tagUsageCount = new Map<string, number>();

  // 1. 약점 보완 추천 (weakness)
  const weaknessItems = await generateWeaknessRecommendations(
    weaknessScores.slice(0, 10),
    avgLevel,
    solvedIds,
    usedProblemIds,
    tagUsageCount,
    tagExpectations
  );
  allItems.push(...weaknessItems);

  // 2. 도전 추천 (challenge)
  const challengeItems = await generateChallengeRecommendations(
    weaknessScores.slice(0, 5),
    avgLevel,
    solvedIds,
    usedProblemIds,
    tagUsageCount
  );
  allItems.push(...challengeItems);

  // 3. 복습 추천 (review)
  const reviewItems = await generateReviewRecommendations(
    weaknessScores,
    avgLevel,
    solvedIds,
    usedProblemIds,
    tagUsageCount
  );
  allItems.push(...reviewItems);

  // 4. 인기 문제 추천 (popular)
  const popularItems = await generatePopularRecommendations(
    avgLevel,
    solvedIds,
    usedProblemIds
  );
  allItems.push(...popularItems);

  // 5. 기초 다지기 추천 (foundation)
  const foundationItems = await generateFoundationRecommendations(
    weaknessScores,
    userTier,
    solvedIds,
    usedProblemIds,
    tagUsageCount,
    tagExpectations
  );
  allItems.push(...foundationItems);

  // 6. 최소 추천 수 보장용 백필 (카테고리 제약으로 개수가 적을 때)
  if (allItems.length < MIN_RECOMMENDATION_COUNT) {
    const fallbackItems = await generateFallbackRecommendations(
      avgLevel,
      solvedIds,
      usedProblemIds,
      MIN_RECOMMENDATION_COUNT - allItems.length,
      tagUsageCount
    );
    allItems.push(...fallbackItems);
  }

  // 점수순 정렬
  allItems.sort((a, b) => b.score - a.score);

  // 통계 계산
  const byCategory: Record<RecommendationCategory, number> = {
    weakness: 0,
    challenge: 0,
    review: 0,
    popular: 0,
    foundation: 0,
  };
  for (const item of allItems) {
    byCategory[item.category]++;
  }

  const avgScore =
    allItems.length > 0
      ? allItems.reduce((sum, i) => sum + i.score, 0) / allItems.length
      : 0;

  return {
    items: allItems,
    stats: {
      totalCount: allItems.length,
      byCategory,
      avgScore,
      tagCoverage: Array.from(tagUsageCount.keys()),
    },
    criteria: {
      userTier,
      userAvgLevel: avgLevel,
      levelMin: Math.max(1, avgLevel - 5),
      levelMax: Math.min(30, avgLevel + 5),
      weakTags: weaknessScores.slice(0, 10).map((w) => w.tag),
      excludeSolved: true,
    },
  };
}

/**
 * 약점 보완 추천 생성
 */
async function generateWeaknessRecommendations(
  weakTags: WeaknessScore[],
  avgLevel: number,
  solvedIds: Set<number>,
  usedIds: Set<number>,
  tagUsage: Map<string, number>,
  tagExpectations?: Map<string, solvedac.TagExpectation>
): Promise<RecommendationItem[]> {
  const items: RecommendationItem[] = [];
  const maxPerTag = Math.ceil(CATEGORY_LIMITS.weakness / weakTags.length);

  for (const weakness of weakTags) {
    if (items.length >= CATEGORY_LIMITS.weakness) break;

    // 단계별 추천 (현재 수준 → 약간 어려운 수준)
    const steps = generateSteps(
      weakness.analysis.avgLevel || avgLevel - 2,
      avgLevel + 2
    );

    for (const step of steps) {
      if (
        items.length >= CATEGORY_LIMITS.weakness ||
        (tagUsage.get(weakness.tag) || 0) >= maxPerTag
      ) {
        break;
      }

      try {
        const { items: searchResults } = await solvedac.searchProblems({
          tags: [weakness.tag],
          levelMin: step.min,
          levelMax: step.max,
          page: 1,
          sort: "solved",
          direction: "desc",
        });

        for (const problem of searchResults) {
          if (
            solvedIds.has(problem.problemId) ||
            usedIds.has(problem.problemId)
          ) {
            continue;
          }
          if (
            items.length >= CATEGORY_LIMITS.weakness ||
            (tagUsage.get(weakness.tag) || 0) >= maxPerTag
          ) {
            break;
          }

          const score = calculateRecommendationScore(
            problem,
            weakness,
            avgLevel,
            step.level,
            tagUsage,
            tagExpectations
          );

          items.push({
            problemId: problem.problemId,
            score,
            category: "weakness",
            priority: Math.round(score * 10),
            reasons: generateReasons(weakness, problem, avgLevel, "weakness"),
            tags: problem.tags.map((t) => solvedac.getTagDisplayName(t)),
            level: problem.level,
            stepLevel: step.level,
            scoreBreakdown: score > 0 ? calculateScoreBreakdown(problem, weakness, avgLevel, step.level, tagUsage, tagExpectations) : {
              tagWeakness: 0,
              levelFitness: 0,
              stepProgress: 0,
              problemQuality: 0,
              diversity: 0,
            },
          });

          usedIds.add(problem.problemId);
          tagUsage.set(weakness.tag, (tagUsage.get(weakness.tag) || 0) + 1);
        }
      } catch (error) {
        console.error(
          `[RecommendationEngine] Failed to search for tag ${weakness.tag}:`,
          error
        );
      }
    }
  }

  return items;
}

/**
 * 도전 추천 생성 (현재보다 어려운 문제)
 */
async function generateChallengeRecommendations(
  weakTags: WeaknessScore[],
  avgLevel: number,
  solvedIds: Set<number>,
  usedIds: Set<number>,
  tagUsage: Map<string, number>
): Promise<RecommendationItem[]> {
  const items: RecommendationItem[] = [];
  const challengeLevel = Math.min(avgLevel + 3, 30);

  for (const weakness of weakTags) {
    if (items.length >= CATEGORY_LIMITS.challenge) break;

    try {
      const { items: searchResults } = await solvedac.searchProblems({
        tags: [weakness.tag],
        levelMin: challengeLevel,
        levelMax: Math.min(challengeLevel + 3, 30),
        page: 1,
      });

      for (const problem of searchResults.slice(0, 3)) {
        if (
          solvedIds.has(problem.problemId) ||
          usedIds.has(problem.problemId)
        ) {
          continue;
        }
        if (items.length >= CATEGORY_LIMITS.challenge) break;

        const score = calculateRecommendationScore(
          problem,
          weakness,
          avgLevel,
          challengeLevel,
          tagUsage,
          undefined
        );

        items.push({
          problemId: problem.problemId,
          score: score * 0.9, // 도전 문제는 약간 낮은 점수
          category: "challenge",
          priority: Math.round(score * 8),
          reasons: generateReasons(weakness, problem, avgLevel, "challenge"),
          tags: problem.tags.map((t) => solvedac.getTagDisplayName(t)),
          level: problem.level,
          scoreBreakdown: calculateScoreBreakdown(problem, weakness, avgLevel, challengeLevel, tagUsage, undefined),
        });

        usedIds.add(problem.problemId);
        tagUsage.set(weakness.tag, (tagUsage.get(weakness.tag) || 0) + 1);
      }
    } catch (error) {
      console.error(
        `[RecommendationEngine] Challenge search failed for ${weakness.tag}:`,
        error
      );
    }
  }

  return items;
}

/**
 * 복습 추천 생성 (오래 안 푼 태그)
 */
async function generateReviewRecommendations(
  allTags: WeaknessScore[],
  avgLevel: number,
  solvedIds: Set<number>,
  usedIds: Set<number>,
  tagUsage: Map<string, number>
): Promise<RecommendationItem[]> {
  const items: RecommendationItem[] = [];

  // 오래 안 푼 태그 순으로 정렬
  const reviewTags = [...allTags]
    .filter((t) => t.details.recencyScore > 0.5)
    .sort((a, b) => b.details.recencyScore - a.details.recencyScore)
    .slice(0, 5);

  for (const tagScore of reviewTags) {
    if (items.length >= CATEGORY_LIMITS.review) break;

    try {
      const { items: searchResults } = await solvedac.searchProblems({
        tags: [tagScore.tag],
        levelMin: Math.max(1, avgLevel - 2),
        levelMax: avgLevel + 1,
        page: 1,
        sort: "id",
        direction: "desc",
      });

      for (const problem of searchResults.slice(0, 3)) {
        if (
          solvedIds.has(problem.problemId) ||
          usedIds.has(problem.problemId)
        ) {
          continue;
        }
        if (items.length >= CATEGORY_LIMITS.review) break;

        const score =
          0.6 + tagScore.details.recencyScore * 0.3 + Math.random() * 0.1;

        items.push({
          problemId: problem.problemId,
          score,
          category: "review",
          priority: Math.round(score * 7),
          reasons: generateReasons(tagScore, problem, avgLevel, "review"),
          tags: problem.tags.map((t) => solvedac.getTagDisplayName(t)),
          level: problem.level,
          scoreBreakdown: {
            tagWeakness: tagScore.totalScore,
            levelFitness: 1 - Math.abs(problem.level - avgLevel) / 10,
            stepProgress: 0.5,
            problemQuality: Math.min(problem.acceptedUserCount / 10000, 1),
            diversity: 1 - (tagUsage.get(tagScore.tag) || 0) / 5,
          },
        });

        usedIds.add(problem.problemId);
        tagUsage.set(tagScore.tag, (tagUsage.get(tagScore.tag) || 0) + 1);
      }
    } catch (error) {
      console.error(
        `[RecommendationEngine] Review search failed for ${tagScore.tag}:`,
        error
      );
    }
  }

  return items;
}

/**
 * 인기 문제 추천 생성
 */
async function generatePopularRecommendations(
  avgLevel: number,
  solvedIds: Set<number>,
  usedIds: Set<number>
): Promise<RecommendationItem[]> {
  const items: RecommendationItem[] = [];

  // 여러 난이도 범위 시도 (API 실패 대비)
  const levelRanges = [
    { min: Math.max(1, avgLevel - 2), max: Math.min(30, avgLevel + 2) },
    { min: Math.max(1, avgLevel - 5), max: Math.min(30, avgLevel + 5) },
    { min: 1, max: 15 }, // 기본 범위
  ];

  for (const range of levelRanges) {
    if (items.length >= CATEGORY_LIMITS.popular) break;

    try {
      const { items: searchResults } = await solvedac.searchProblems({
        levelMin: range.min,
        levelMax: range.max,
        page: 1,
        sort: "solved",
        direction: "desc",
      });

      if (!searchResults || searchResults.length === 0) continue;

      // acceptedUserCount로 정렬 (인기순)
      const sorted = [...searchResults].sort(
        (a, b) => b.acceptedUserCount - a.acceptedUserCount
      );

      for (const problem of sorted) {
        if (solvedIds.has(problem.problemId) || usedIds.has(problem.problemId)) {
          continue;
        }
        if (items.length >= CATEGORY_LIMITS.popular) break;

        const popularityScore = Math.min(
          problem.acceptedUserCount / 50000,
          1
        );
        const triesScore =
          problem.averageTries > 0
            ? Math.max(0, 1 - problem.averageTries / 5)
            : 1;
        const problemQuality = popularityScore * 0.7 + triesScore * 0.3;
        const score = 0.5 + problemQuality * 0.4 + Math.random() * 0.1;

        items.push({
          problemId: problem.problemId,
          score,
          category: "popular",
          priority: Math.round(score * 6),
          reasons: [
            `${problem.acceptedUserCount.toLocaleString()}명이 해결한 인기 문제`,
            `난이도: ${solvedac.getTierName(problem.level)}`,
          ],
          tags: problem.tags.map((t) => solvedac.getTagDisplayName(t)),
          level: problem.level,
          scoreBreakdown: {
            tagWeakness: 0.3,
            levelFitness: 1 - Math.abs(problem.level - avgLevel) / 10,
            stepProgress: 0.5,
            problemQuality,
            diversity: 0.5,
          },
        });

        usedIds.add(problem.problemId);
      }
    } catch (error) {
      console.error(
        `[RecommendationEngine] Popular search failed for range ${range.min}-${range.max}:`,
        error
      );
      // 다음 범위 시도
      continue;
    }
  }

  return items;
}

/**
 * 기초 다지기 추천 생성
 */
async function generateFoundationRecommendations(
  allTags: WeaknessScore[],
  userTier: number,
  solvedIds: Set<number>,
  usedIds: Set<number>,
  tagUsage: Map<string, number>,
  tagExpectations?: Map<string, solvedac.TagExpectation>
): Promise<RecommendationItem[]> {
  const items: RecommendationItem[] = [];

  // 커버리지가 낮은 기초 태그 찾기 (동적 tagExpectations 사용)
  const foundationTags = allTags
    .filter(
      (t) =>
        t.details.coverageScore > 0.6 &&
        (tagExpectations?.has(t.tag) ?? true)
    )
    .slice(0, 3);

  for (const tagScore of foundationTags) {
    if (items.length >= CATEGORY_LIMITS.foundation) break;

    // 기초 문제 (브론즈~실버)
    const maxLevel = Math.min(userTier, 10);

    try {
      const { items: searchResults } = await solvedac.searchProblems({
        tags: [tagScore.tag],
        levelMin: 1,
        levelMax: maxLevel,
        page: 1,
        sort: "solved",
        direction: "desc",
      });

      for (const problem of searchResults.slice(0, 2)) {
        if (
          solvedIds.has(problem.problemId) ||
          usedIds.has(problem.problemId)
        ) {
          continue;
        }
        if (items.length >= CATEGORY_LIMITS.foundation) break;

        items.push({
          problemId: problem.problemId,
          score: 0.55 + Math.random() * 0.1,
          category: "foundation",
          priority: 5,
          reasons: [
            `${tagScore.tag} 기초 실력 향상`,
            "기본기를 탄탄하게!",
          ],
          tags: problem.tags.map((t) => solvedac.getTagDisplayName(t)),
          level: problem.level,
          scoreBreakdown: {
            tagWeakness: tagScore.totalScore,
            levelFitness: 0.8,
            stepProgress: 1.0,
            problemQuality: Math.min(problem.acceptedUserCount / 10000, 1),
            diversity: 1 - (tagUsage.get(tagScore.tag) || 0) / 5,
          },
        });

        usedIds.add(problem.problemId);
        tagUsage.set(tagScore.tag, (tagUsage.get(tagScore.tag) || 0) + 1);
      }
    } catch (error) {
      console.error(
        `[RecommendationEngine] Foundation search failed for ${tagScore.tag}:`,
        error
      );
    }
  }

  return items;
}

/**
 * 추천 수가 너무 적을 때 fallback 인기 문제로 채움.
 * 가능한 한 BOJ 실문제를 많이 제공하기 위한 안전장치.
 */
async function generateFallbackRecommendations(
  avgLevel: number,
  solvedIds: Set<number>,
  usedIds: Set<number>,
  neededCount: number,
  tagUsage: Map<string, number>
): Promise<RecommendationItem[]> {
  if (neededCount <= 0) return [];

  const items: RecommendationItem[] = [];
  const levelRanges = [
    { min: Math.max(1, avgLevel - 2), max: Math.min(30, avgLevel + 2) },
    { min: Math.max(1, avgLevel - 5), max: Math.min(30, avgLevel + 5) },
    { min: 1, max: 30 },
  ];
  const sortModes: Array<{ sort: solvedac.SearchSort; direction: "asc" | "desc" }> = [
    { sort: "solved", direction: "desc" },
    { sort: "average_try", direction: "asc" },
    { sort: "id", direction: "asc" },
  ];

  for (const range of levelRanges) {
    if (items.length >= neededCount) break;

    for (const mode of sortModes) {
      if (items.length >= neededCount) break;

      for (let page = 1; page <= 6; page++) {
        if (items.length >= neededCount) break;

        try {
          const { items: searchResults } = await solvedac.searchProblems({
            levelMin: range.min,
            levelMax: range.max,
            page,
            sort: mode.sort,
            direction: mode.direction,
          });

          if (!searchResults || searchResults.length === 0) {
            break;
          }

          for (const problem of searchResults) {
            if (items.length >= neededCount) break;
            if (solvedIds.has(problem.problemId) || usedIds.has(problem.problemId)) {
              continue;
            }

            const tags = problem.tags.map((t) => solvedac.getTagDisplayName(t));
            const primaryTag = tags[0];
            if (primaryTag) {
              tagUsage.set(primaryTag, (tagUsage.get(primaryTag) || 0) + 1);
            }

            const levelFitness = Math.max(0, 1 - Math.abs(problem.level - avgLevel) / 12);
            const popularityScore = Math.min(problem.acceptedUserCount / 60000, 1);
            const score = 0.45 + levelFitness * 0.25 + popularityScore * 0.25 + Math.random() * 0.05;

            items.push({
              problemId: problem.problemId,
              score,
              category: "popular",
              priority: Math.max(3, Math.round(score * 10)),
              reasons: [
                "추가 추천 풀 확장을 위한 실전 문제",
                `${problem.acceptedUserCount.toLocaleString()}명이 푼 BOJ 문제`,
              ],
              tags,
              level: problem.level,
              scoreBreakdown: {
                tagWeakness: 0.3,
                levelFitness,
                stepProgress: 0.4,
                problemQuality: popularityScore,
                diversity: primaryTag ? Math.max(0, 1 - (tagUsage.get(primaryTag)! - 1) / 8) : 0.5,
              },
            });

            usedIds.add(problem.problemId);
          }

          // solved.ac 기본 페이지 크기(50)보다 적으면 마지막 페이지로 간주
          if (searchResults.length < 50) {
            break;
          }
        } catch (error) {
          console.error(
            `[RecommendationEngine] Fallback search failed for range ${range.min}-${range.max}, page ${page}:`,
            error
          );
          break;
        }
      }
    }
  }

  return items;
}

// ==================== 유틸리티 함수 ====================

/**
 * 단계별 레벨 범위 생성
 */
function generateSteps(
  fromLevel: number,
  toLevel: number
): { level: number; min: number; max: number }[] {
  const steps: { level: number; min: number; max: number }[] = [];
  const stepSize = 2;

  for (let level = Math.floor(fromLevel); level <= toLevel; level += stepSize) {
    steps.push({
      level,
      min: Math.max(1, level - 1),
      max: Math.min(30, level + 1),
    });
  }

  return steps;
}

/**
 * 추천 점수 계산 (Phase 3: averageTries 반영)
 */
function calculateRecommendationScore(
  problem: solvedac.SolvedAcProblem,
  weakness: WeaknessScore,
  avgLevel: number,
  stepLevel: number,
  tagUsage: Map<string, number>,
  _tagExpectations?: Map<string, solvedac.TagExpectation>
): number {
  const breakdown = calculateScoreBreakdown(
    problem,
    weakness,
    avgLevel,
    stepLevel,
    tagUsage
  );

  return (
    RECOMMENDATION_WEIGHTS.tagWeakness * breakdown.tagWeakness +
    RECOMMENDATION_WEIGHTS.levelFitness * breakdown.levelFitness +
    RECOMMENDATION_WEIGHTS.stepProgress * breakdown.stepProgress +
    RECOMMENDATION_WEIGHTS.problemQuality * breakdown.problemQuality +
    RECOMMENDATION_WEIGHTS.diversity * breakdown.diversity
  );
}

/**
 * 점수 세부 항목 계산 (Phase 3: averageTries 반영)
 * 문제 품질 = acceptedUserCount + averageTries (낮을수록 품질 높음)
 */
function calculateScoreBreakdown(
  problem: solvedac.SolvedAcProblem,
  weakness: WeaknessScore,
  avgLevel: number,
  stepLevel: number,
  tagUsage: Map<string, number>,
  _tagExpectations?: Map<string, solvedac.TagExpectation>
): RecommendationItem["scoreBreakdown"] {
  // 1. 태그 약점 점수
  const tagWeakness = weakness.totalScore;

  // 2. 난이도 적합도 (목표 레벨과의 거리)
  const levelDiff = Math.abs(problem.level - avgLevel);
  const levelFitness = Math.max(0, 1 - levelDiff / 10);

  // 3. 단계 진행 점수 (스텝에 맞는 난이도인지)
  const stepDiff = Math.abs(problem.level - stepLevel);
  const stepProgress = Math.max(0, 1 - stepDiff / 5);

  // 4. 문제 품질 (인기도 + averageTries: 낮을수록 품질 높음)
  const popularityScore = Math.min(problem.acceptedUserCount / 10000, 1);
  const triesScore =
    problem.averageTries > 0
      ? Math.max(0, 1 - problem.averageTries / 5)
      : 1;
  const problemQuality = popularityScore * 0.7 + triesScore * 0.3;

  // 5. 다양성 (같은 태그가 너무 많이 추천되지 않도록)
  const currentTagCount = tagUsage.get(weakness.tag) || 0;
  const diversity = Math.max(0, 1 - currentTagCount / 5);

  return {
    tagWeakness,
    levelFitness,
    stepProgress,
    problemQuality,
    diversity,
  };
}

/**
 * 추천 이유 생성
 */
function generateReasons(
  weakness: WeaknessScore,
  problem: solvedac.SolvedAcProblem,
  avgLevel: number,
  category: RecommendationCategory
): string[] {
  const reasons: string[] = [];
  const tierName = solvedac.getTierName(problem.level);

  switch (category) {
    case "weakness":
      reasons.push(`${weakness.tag} 실력 보완 필요`);
      if (weakness.details.coverageScore > 0.5) {
        reasons.push(`${weakness.tag} 풀이 수 부족`);
      }
      if (weakness.details.recencyScore > 0.5) {
        reasons.push("최근 풀이 기록 없음");
      }
      break;

    case "challenge":
      reasons.push(`${weakness.tag} 실력 도약 기회`);
      reasons.push(`목표: ${tierName} 달성`);
      break;

    case "review":
      reasons.push(`${weakness.tag} 복습 권장`);
      if (weakness.analysis.lastSolvedAt) {
        const days = Math.floor(
          (Date.now() - weakness.analysis.lastSolvedAt.getTime()) /
            (24 * 60 * 60 * 1000)
        );
        reasons.push(`${days}일 동안 안 품`);
      }
      break;

    default:
      break;
  }

  // 난이도 적합성
  const levelDiff = problem.level - avgLevel;
  if (Math.abs(levelDiff) <= 1) {
    reasons.push(`적정 난이도 (${tierName})`);
  } else if (levelDiff > 0) {
    reasons.push(`도전적 난이도 (${tierName})`);
  }

  return reasons;
}

/**
 * InsertUserTagStats 형태로 변환
 */
export function convertToDbFormat(
  userId: number,
  weaknessScores: WeaknessScore[]
): InsertUserTagStats[] {
  const now = new Date();

  return weaknessScores.map((ws) => {
    const daysSinceLastSolved = ws.analysis.lastSolvedAt
      ? Math.floor(
          (now.getTime() - ws.analysis.lastSolvedAt.getTime()) /
            (24 * 60 * 60 * 1000)
        )
      : 999;

    return {
      userId,
      snapshotDate: now,
      tag: ws.tag,
      attemptedCount: ws.analysis.solvedCount,
      solvedCount: ws.analysis.solvedCount,
      recentSolvedCount30d: ws.analysis.recentCounts.days30,
      avgLevelSolved: ws.analysis.avgLevel,
      maxLevelSolved: ws.analysis.maxLevel,
      levelDistribution: ws.analysis.levelDistribution,
      totalProblemsInTag: ws.analysis.totalProblemsInTag,
      coverageRate:
        ws.analysis.totalProblemsInTag > 0
          ? ws.analysis.solvedCount / ws.analysis.totalProblemsInTag
          : 0,
      lastSolvedAt: ws.analysis.lastSolvedAt,
      daysSinceLastSolved,
      recentSolvedCount60d: ws.analysis.recentCounts.days60,
      recentSolvedCount90d: ws.analysis.recentCounts.days90,
      weakScore: ws.totalScore,
      weakScoreDetails: ws.details,
    };
  });
}
