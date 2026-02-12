import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import * as solvedac from "./solvedac";
import { verifyBojCredentials } from "./boj-auth";
import { scrapeProblemContent } from "./boj-scraper";
import { runSync } from "./sync";
import type { RecommendationCategory, RecommendationItem } from "../drizzle/schema";

const MIN_RECOMMENDATIONS_ON_READ = 40;
const DEFAULT_RECOMMENDATION_LIMIT = 120;
const MAX_RECOMMENDATION_LIMIT = 300;

function clampRecommendationLimit(limit?: number): number {
  if (!limit || Number.isNaN(limit)) return DEFAULT_RECOMMENDATION_LIMIT;
  return Math.max(1, Math.min(MAX_RECOMMENDATION_LIMIT, Math.floor(limit)));
}

function buildRecommendationStats(items: RecommendationItem[]) {
  const byCategory: Record<RecommendationCategory, number> = {
    weakness: 0,
    challenge: 0,
    review: 0,
    popular: 0,
    foundation: 0,
  };

  for (const item of items) {
    byCategory[item.category]++;
  }

  const avgScore =
    items.length > 0 ? items.reduce((acc, cur) => acc + cur.score, 0) / items.length : 0;

  return {
    totalCount: items.length,
    byCategory,
    avgScore,
    tagCoverage: Array.from(
      new Set(items.flatMap((item) => (Array.isArray(item.tags) ? item.tags : []))),
    ),
  };
}

async function buildFallbackRecommendations(
  userId: number,
  existingItems: RecommendationItem[],
  neededCount: number,
): Promise<RecommendationItem[]> {
  if (neededCount <= 0) return [];

  const linkedAccount = await db.getLinkedAccount(userId);
  if (!linkedAccount) return [];

  const solvedStatuses = await db.getUserSolvedProblems(userId);
  const solvedIds = new Set<number>(solvedStatuses.map((s) => s.problemId));
  const usedIds = new Set<number>(existingItems.map((i) => i.problemId));

  const avgLevel = linkedAccount.tier
    ? Math.max(1, Math.min(30, Math.round(linkedAccount.tier * 0.8)))
    : 8;
  const items: RecommendationItem[] = [];
  const levelRanges = [
    { min: Math.max(1, avgLevel - 2), max: Math.min(30, avgLevel + 2) },
    { min: Math.max(1, avgLevel - 5), max: Math.min(30, avgLevel + 5) },
    { min: 1, max: 30 },
  ];

  for (const range of levelRanges) {
    if (items.length >= neededCount) break;

    for (let page = 1; page <= 4; page++) {
      if (items.length >= neededCount) break;

      try {
        const { items: searchResults } = await solvedac.searchProblems({
          levelMin: range.min,
          levelMax: range.max,
          page,
          sort: "solved",
          direction: "desc",
        });

        if (!searchResults || searchResults.length === 0) {
          break;
        }

        for (const problem of searchResults) {
          if (items.length >= neededCount) break;
          if (solvedIds.has(problem.problemId) || usedIds.has(problem.problemId)) {
            continue;
          }

          const levelFitness = Math.max(0, 1 - Math.abs(problem.level - avgLevel) / 12);
          const qualityScore = Math.min(problem.acceptedUserCount / 60000, 1);
          const score = 0.45 + levelFitness * 0.3 + qualityScore * 0.2;
          const tags = problem.tags.map((t) => solvedac.getTagDisplayName(t));

          items.push({
            problemId: problem.problemId,
            score,
            category: "popular",
            priority: Math.max(3, Math.round(score * 10)),
            reasons: [
              "추천 풀 확장을 위한 BOJ 실전 문제",
              `${problem.acceptedUserCount.toLocaleString()}명이 푼 인기 문제`,
            ],
            tags,
            level: problem.level,
            scoreBreakdown: {
              tagWeakness: 0.2,
              levelFitness,
              stepProgress: 0.4,
              problemQuality: qualityScore,
              diversity: 0.5,
            },
          });

          usedIds.add(problem.problemId);
        }

        if (searchResults.length < 50) break;
      } catch (error) {
        console.error("[Recommendations] fallback search failed:", error);
        break;
      }
    }
  }

  return items;
}

type RealtimeRecommendationOptions = {
  limit: number;
  category?: RecommendationCategory;
  levelMin?: number;
  levelMax?: number;
  tags?: string[];
  excludeSolved?: boolean;
};

async function buildRealtimeRecommendations(
  userId: number,
  options: RealtimeRecommendationOptions,
): Promise<RecommendationItem[]> {
  const linkedAccount = await db.getLinkedAccount(userId);
  if (!linkedAccount) return [];

  const [solvedStatuses, userTagStats] = await Promise.all([
    db.getUserSolvedProblems(userId),
    db.getUserTagStats(userId),
  ]);

  const shouldExcludeSolved = options.excludeSolved ?? true;
  const solvedIds = new Set<number>(solvedStatuses.map((s) => s.problemId));
  const usedIds = new Set<number>();
  const tagUsage = new Map<string, number>();
  const weakScoreByTag = new Map(userTagStats.map((s) => [s.tag, s.weakScore || 0]));

  const avgLevel = linkedAccount.tier
    ? Math.max(1, Math.min(30, Math.round(linkedAccount.tier * 0.8)))
    : 8;
  const targetMin = options.levelMin ?? Math.max(1, avgLevel - 6);
  const targetMax = options.levelMax ?? Math.min(30, avgLevel + 6);

  const requestedTags = options.tags?.filter(Boolean) ?? [];
  const weakTags =
    requestedTags.length > 0
      ? requestedTags
      : userTagStats
          .sort((a, b) => (b.weakScore || 0) - (a.weakScore || 0))
          .slice(0, 12)
          .map((s) => s.tag);

  const tagPool =
    weakTags.length > 0
      ? weakTags
      : ["구현", "자료 구조", "그래프", "그리디", "다이나믹 프로그래밍"];

  const items: RecommendationItem[] = [];
  const sortStrategies: Array<{ sort: solvedac.SearchSort; direction: "asc" | "desc" }> = [
    { sort: "solved", direction: "desc" },
    { sort: "average_try", direction: "asc" },
    { sort: "id", direction: "asc" },
  ];

  const pushCandidate = (problem: solvedac.SolvedAcProblem, primaryTag: string, categoryHint?: RecommendationCategory) => {
    if (items.length >= options.limit) return;
    if (usedIds.has(problem.problemId)) return;
    if (shouldExcludeSolved && solvedIds.has(problem.problemId)) return;

    const tags = problem.tags.map((t) => solvedac.getTagDisplayName(t));
    const weakScore = weakScoreByTag.get(primaryTag) ?? 0.3;
    const levelFitness = Math.max(0, 1 - Math.abs(problem.level - avgLevel) / 12);
    const problemQuality =
      Math.min(problem.acceptedUserCount / 60000, 1) * 0.7 +
      (problem.averageTries > 0 ? Math.max(0, 1 - problem.averageTries / 6) : 0.6) * 0.3;
    const diversity = Math.max(0, 1 - (tagUsage.get(primaryTag) || 0) / 8);
    const score = 0.35 + weakScore * 0.3 + levelFitness * 0.2 + problemQuality * 0.1 + diversity * 0.05;

    const inferredCategory: RecommendationCategory =
      categoryHint ||
      (problem.level >= avgLevel + 2
        ? "challenge"
        : weakScore >= 0.55
          ? "weakness"
          : problem.level <= Math.min(10, avgLevel - 2)
            ? "foundation"
            : "popular");

    items.push({
      problemId: problem.problemId,
      score,
      category: inferredCategory,
      priority: Math.max(3, Math.round(score * 10)),
      reasons: [
        `${primaryTag} 연관 실시간 추천`,
        `${problem.acceptedUserCount.toLocaleString()}명이 푼 BOJ 문제`,
      ],
      tags,
      level: problem.level,
      scoreBreakdown: {
        tagWeakness: weakScore,
        levelFitness,
        stepProgress: 0.5,
        problemQuality,
        diversity,
      },
    });

    usedIds.add(problem.problemId);
    tagUsage.set(primaryTag, (tagUsage.get(primaryTag) || 0) + 1);
  };

  // 1) 태그 기반 실시간 수집
  for (const tag of tagPool) {
    if (items.length >= options.limit) break;

    for (const strategy of sortStrategies) {
      if (items.length >= options.limit) break;

      for (let page = 1; page <= 4; page++) {
        if (items.length >= options.limit) break;

        try {
          const { items: searchResults } = await solvedac.searchProblems({
            tags: [tag],
            levelMin: targetMin,
            levelMax: targetMax,
            page,
            sort: strategy.sort,
            direction: strategy.direction,
          });
          if (!searchResults || searchResults.length === 0) break;

          for (const problem of searchResults) {
            pushCandidate(problem, tag, options.category);
            if (items.length >= options.limit) break;
          }

          if (searchResults.length < 50) break;
        } catch (error) {
          console.error(`[Recommendations] realtime tag search failed (${tag}):`, error);
          break;
        }
      }
    }
  }

  // 2) 부족하면 태그 없는 범용 실시간 수집
  if (items.length < options.limit) {
    const generalRanges = [
      { min: targetMin, max: targetMax },
      { min: Math.max(1, avgLevel - 10), max: Math.min(30, avgLevel + 10) },
      { min: 1, max: 30 },
    ];

    for (const range of generalRanges) {
      if (items.length >= options.limit) break;

      for (const strategy of sortStrategies) {
        if (items.length >= options.limit) break;

        for (let page = 1; page <= 4; page++) {
          if (items.length >= options.limit) break;
          try {
            const { items: searchResults } = await solvedac.searchProblems({
              levelMin: range.min,
              levelMax: range.max,
              page,
              sort: strategy.sort,
              direction: strategy.direction,
            });
            if (!searchResults || searchResults.length === 0) break;

            for (const problem of searchResults) {
              const tag = problem.tags[0] ? solvedac.getTagDisplayName(problem.tags[0]) : "기타";
              pushCandidate(problem, tag, options.category);
              if (items.length >= options.limit) break;
            }

            if (searchResults.length < 50) break;
          } catch (error) {
            console.error("[Recommendations] realtime general search failed:", error);
            break;
          }
        }
      }
    }
  }

  // 카테고리 필터 보정
  let filtered = items;
  if (options.category) {
    filtered = items.filter((i) => i.category === options.category);
  }

  filtered.sort((a, b) => b.score - a.score);
  return filtered.slice(0, options.limit);
}

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // BOJ 계정 연동
  link: router({
    // 연동 상태 조회
    get: protectedProcedure.query(async ({ ctx }) => {
      return db.getLinkedAccount(ctx.user.id);
    }),

    // BOJ 핸들 연결
    connect: protectedProcedure
      .input(
        z.object({
          handle: z.string().min(1).max(64),
          password: z.string().min(1).max(128),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const handle = input.handle.trim();

        const verifyResult = await verifyBojCredentials(handle, input.password);
        if (!verifyResult.ok) {
          throw new Error(verifyResult.message);
        }

        // Check if handle exists on solved.ac
        const profile = await solvedac.getUserProfile(handle);
        if (!profile) {
          throw new Error(`solved.ac에서 "${handle}" 사용자를 찾을 수 없습니다.`);
        }

        // Check if already linked
        const existing = await db.getLinkedAccount(ctx.user.id);
        if (existing) {
          // Update existing
          await db.updateLinkedAccount(ctx.user.id, {
            handle,
            verified: true,
            solvedCount: profile.solvedCount,
            tier: profile.tier,
            rating: profile.rating,
          });
        } else {
          // Create new
          await db.createLinkedAccount({
            userId: ctx.user.id,
            handle,
            verified: true,
            solvedCount: profile.solvedCount,
            tier: profile.tier,
            rating: profile.rating,
          });
        }

        return { success: true, profile };
      }),

    // 연동 해제
    disconnect: protectedProcedure.mutation(async ({ ctx }) => {
      await db.deleteLinkedAccount(ctx.user.id);
      return { success: true };
    }),
  }),

  // 동기화
  sync: router({
    // 동기화 트리거
    start: protectedProcedure.mutation(async ({ ctx }) => {
      const linkedAccount = await db.getLinkedAccount(ctx.user.id);
      if (!linkedAccount) {
        throw new Error("BOJ 계정이 연결되어 있지 않습니다.");
      }

      // Atomic check + create (prevents race condition)
      const result = await db.createSyncJobIfAllowed(ctx.user.id, 10);

      if (!result.success) {
        if (result.reason === "already_running") {
          throw new Error("이미 동기화가 진행 중입니다.");
        }
        if (result.reason === "rate_limited") {
          throw new Error("동기화는 10분에 한 번만 가능합니다.");
        }
        throw new Error("동기화를 시작할 수 없습니다.");
      }

      const jobId = result.jobId;

      // Run sync in background (non-blocking)
      // This allows the API to return immediately while sync continues
      // Client should poll sync.status to check progress
      runSync(ctx.user.id, jobId).catch(err => {
        console.error("[Sync] Background sync failed:", err);
      });

      return { jobId, message: "동기화가 시작되었습니다. 잠시 후 상태를 확인해주세요." };
    }),

    // 동기화 상태 조회 (최신 또는 특정 jobId)
    status: protectedProcedure
      .input(z.object({ jobId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        if (input?.jobId) {
          return db.getSyncJob(input.jobId);
        }
        // 최신 동기화 상태 반환
        return db.getLatestSyncJob(ctx.user.id);
      }),

    // 최근 동기화 결과
    latest: protectedProcedure.query(async ({ ctx }) => {
      return db.getLatestSyncJob(ctx.user.id);
    }),
  }),

  // 대시보드
  dashboard: router({
    summary: protectedProcedure.query(async ({ ctx }) => {
      const [linkedAccount, stats, tagStats, latestSync] = await Promise.all([
        db.getLinkedAccount(ctx.user.id),
        db.getDashboardStats(ctx.user.id),
        db.getUserTagStats(ctx.user.id),
        db.getLatestSyncJob(ctx.user.id),
      ]);

      // Get top 5 weak tags
      const weakTags = tagStats
        .sort((a, b) => (b.weakScore || 0) - (a.weakScore || 0))
        .slice(0, 5);

      return {
        linkedAccount,
        stats,
        weakTags,
        lastSyncAt: latestSync?.endedAt || null,
        syncStatus: latestSync?.status || null,
      };
    }),
  }),

  // 분석
  analytics: router({
    tags: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserTagStats(ctx.user.id);
    }),

    // 사용 가능한 모든 태그 목록 (추천에 사용된 태그들)
    availableTags: protectedProcedure.query(async ({ ctx }) => {
      const rec = await db.getLatestRecommendations(ctx.user.id);
      if (!rec || !rec.items) return [];

      // 추천 아이템들에서 모든 태그 수집
      const tagSet = new Set<string>();
      for (const item of rec.items as RecommendationItem[]) {
        if (item.tags && Array.isArray(item.tags)) {
          for (const tag of item.tags) {
            tagSet.add(tag);
          }
        }
      }

      // 태그 통계와 결합하여 반환
      const tagStats = await db.getUserTagStats(ctx.user.id);
      const tagStatsMap = new Map(tagStats.map(t => [t.tag, t]));

      const tags = Array.from(tagSet).map(tag => ({
        name: tag,
        weakScore: tagStatsMap.get(tag)?.weakScore || 0,
        solvedCount: tagStatsMap.get(tag)?.solvedCount || 0,
      }));

      // weakScore 높은 순 (약점 순)으로 정렬
      tags.sort((a, b) => b.weakScore - a.weakScore);

      return tags;
    }),
  }),

  // 추천 (개선된 버전)
  recommendations: router({
    // 전체 추천 목록 (필터링 지원)
    list: protectedProcedure
      .input(z.object({
        category: z.enum(["weakness", "challenge", "review", "popular", "foundation"]).optional(),
        levelMin: z.number().optional(),
        levelMax: z.number().optional(),
        tags: z.array(z.string()).optional(),
        excludeSolved: z.boolean().optional(),
        realtime: z.boolean().optional(),
        limit: z.number().min(1).max(MAX_RECOMMENDATION_LIMIT).optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const realtime = input?.realtime ?? true;
        const excludeSolved = input?.excludeSolved ?? true;
        const limit = clampRecommendationLimit(input?.limit);
        const rec = await db.getLatestRecommendations(ctx.user.id);
        let items: RecommendationItem[] = [];

        if (realtime) {
          items = await buildRealtimeRecommendations(ctx.user.id, {
            limit,
            category: input?.category,
            levelMin: input?.levelMin,
            levelMax: input?.levelMax,
            tags: input?.tags,
            excludeSolved,
          });
        } else {
          items = (rec?.items as RecommendationItem[] | undefined) ?? [];

          // 기존 저장 추천이 너무 적으면 fallback으로 보강
          if (items.length < Math.max(MIN_RECOMMENDATIONS_ON_READ, limit)) {
            const fallback = await buildFallbackRecommendations(
              ctx.user.id,
              items,
              Math.max(MIN_RECOMMENDATIONS_ON_READ, limit) - items.length,
            );
            if (fallback.length > 0) {
              items = [...items, ...fallback];
            }
          }

          // 카테고리 필터
          if (input?.category) {
            items = items.filter((i) => i.category === input.category);
          }

          // 난이도 필터
          const levelMin = input?.levelMin;
          const levelMax = input?.levelMax;
          if (levelMin !== undefined) {
            items = items.filter((i) => i.level >= levelMin);
          }
          if (levelMax !== undefined) {
            items = items.filter((i) => i.level <= levelMax);
          }

          // 태그 필터
          if (input?.tags && input.tags.length > 0) {
            items = items.filter((i) => i.tags?.some((t) => input.tags!.includes(t)));
          }

          if (excludeSolved && items.length > 0) {
            const solvedStatuses = await db.getUserSolvedProblems(ctx.user.id);
            const solvedIds = new Set<number>(solvedStatuses.map((status) => status.problemId));
            items = items.filter((item) => !solvedIds.has(item.problemId));
          }

          items = items.slice(0, limit);
        }

        if (items.length === 0) {
          return { items: [], stats: rec?.stats ?? null, criteria: rec?.criteria ?? null };
        }

        // 문제 상세 정보 조회
        const problemIds = items.map((i) => i.problemId);
        const storedProblems = await db.getProblems(problemIds);
        const problemMap = new Map<number, any>(storedProblems.map((p) => [p.problemId, p]));

        // 실시간 추천 문제가 catalog에 없으면 즉시 보강
        const missingIds = problemIds.filter((id) => !problemMap.has(id));
        if (missingIds.length > 0) {
          try {
            const fetched = await solvedac.getProblemsById(missingIds);
            if (fetched.length > 0) {
              await db.upsertProblems(
                fetched.map((p) => ({
                  problemId: p.problemId,
                  title: p.titleKo || p.titles[0]?.title || `Problem ${p.problemId}`,
                  level: p.level,
                  tags: p.tags.map((t) => solvedac.getTagDisplayName(t)),
                  acceptedUserCount: p.acceptedUserCount,
                  averageTries: p.averageTries,
                })),
              );

              for (const p of fetched) {
                problemMap.set(p.problemId, {
                  problemId: p.problemId,
                  title: p.titleKo || p.titles[0]?.title || `Problem ${p.problemId}`,
                  level: p.level,
                  tags: p.tags.map((t) => solvedac.getTagDisplayName(t)),
                  acceptedUserCount: p.acceptedUserCount,
                  averageTries: p.averageTries,
                });
              }
            }
          } catch (error) {
            console.error("[Recommendations] failed to enrich missing problem details:", error);
          }
        }

        return {
          items: items.map((item) => ({
            ...item,
            problem: problemMap.get(item.problemId) || null,
          })),
          stats: buildRecommendationStats(items),
          criteria: rec?.criteria ?? null,
          generatedAt: realtime ? new Date() : rec?.generatedAt ?? new Date(),
        };
      }),

    // 카테고리별 추천 조회
    byCategory: protectedProcedure
      .input(z.object({
        category: z.enum(["weakness", "challenge", "review", "popular", "foundation"]),
        limit: z.number().min(1).max(50).optional(),
      }))
      .query(async ({ ctx, input }) => {
        const rec = await db.getLatestRecommendations(ctx.user.id);
        if (!rec || !rec.items) return [];

        let items = (rec.items as RecommendationItem[]).filter(
          (i) => i.category === input.category
        );

        if (input.limit) {
          items = items.slice(0, input.limit);
        }

        const problemIds = items.map((i) => i.problemId);
        const problems = await db.getProblems(problemIds);
        const problemMap = new Map(problems.map(p => [p.problemId, p]));

        return items.map((item) => ({
          ...item,
          problem: problemMap.get(item.problemId) || null,
        }));
      }),

    // 오늘의 추천 (카테고리별 상위 문제)
    daily: protectedProcedure.query(async ({ ctx }) => {
      const rec = await db.getLatestRecommendations(ctx.user.id);
      if (!rec || !rec.items) return { items: [], date: new Date() };

      const items = rec.items as RecommendationItem[];
      const daily: RecommendationItem[] = [];

      // 각 카테고리에서 상위 2개씩 선택
      const categories = ["weakness", "challenge", "review", "popular", "foundation"] as const;
      for (const cat of categories) {
        const catItems = items
          .filter((i) => i.category === cat)
          .slice(0, 2);
        daily.push(...catItems);
      }

      // 점수순 정렬 후 상위 10개
      daily.sort((a, b) => b.score - a.score);
      const topDaily = daily.slice(0, 10);

      const problemIds = topDaily.map((i) => i.problemId);
      const problems = await db.getProblems(problemIds);
      const problemMap = new Map(problems.map(p => [p.problemId, p]));

      return {
        items: topDaily.map((item) => ({
          ...item,
          problem: problemMap.get(item.problemId) || null,
        })),
        date: rec.generatedAt,
      };
    }),

    // 추천 통계
    stats: protectedProcedure.query(async ({ ctx }) => {
      const rec = await db.getLatestRecommendations(ctx.user.id);
      if (!rec) return null;

      return {
        generatedAt: rec.generatedAt,
        stats: rec.stats,
        criteria: rec.criteria,
      };
    }),

    // 추천 재생성 트리거 (sync.start와 연동)
    regenerate: protectedProcedure.mutation(async ({ ctx }) => {
      const linkedAccount = await db.getLinkedAccount(ctx.user.id);
      if (!linkedAccount) {
        throw new Error("BOJ 계정이 연결되어 있지 않습니다.");
      }

      // 동기화 시작 (추천도 함께 재생성됨)
      const latestJob = await db.getLatestSyncJob(ctx.user.id);
      if (latestJob && latestJob.status === "RUNNING") {
        throw new Error("이미 동기화가 진행 중입니다.");
      }

      // 동기화 재시작을 위한 안내
      return {
        message: "추천을 재생성하려면 동기화를 실행해주세요.",
        syncRequired: true,
      };
    }),
  }),

  // 문제
  problems: router({
    get: protectedProcedure
      .input(z.object({ problemId: z.number() }))
      .query(async ({ ctx, input }) => {
        let problem = await db.getProblem(input.problemId);

        if (!problem) {
          const fromApi = await solvedac.getProblemsById([input.problemId]);
          if (fromApi.length > 0) {
            const p = fromApi[0];
            await db.upsertProblem({
              problemId: p.problemId,
              title: p.titleKo || p.titles[0]?.title || `Problem ${p.problemId}`,
              level: p.level,
              tags: p.tags.map((t) => solvedac.getTagDisplayName(t)),
              acceptedUserCount: p.acceptedUserCount,
              averageTries: p.averageTries,
            });
            problem = await db.getProblem(input.problemId);
          }
        }

        if (!problem) {
          throw new Error("문제를 찾을 수 없습니다.");
        }

        const status = await db.getUserProblemStatus(ctx.user.id, input.problemId);

        return {
          ...problem,
          userStatus: status ? {
            status: status.status,
            isBookmarked: status.isBookmarked,
            note: status.note,
            solvedAt: status.solvedAt,
          } : null,
        };
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        problemId: z.number(),
        status: z.enum(["UNSOLVED", "SOLVED", "ATTEMPTED"]),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.upsertUserProblemStatus({
          userId: ctx.user.id,
          problemId: input.problemId,
          status: input.status,
          solvedAt: input.status === "SOLVED" ? new Date() : undefined,
        });
        return { success: true };
      }),

    toggleBookmark: protectedProcedure
      .input(z.object({ problemId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await db.getUserProblemStatus(ctx.user.id, input.problemId);
        const newValue = !existing?.isBookmarked;
        await db.updateProblemBookmark(ctx.user.id, input.problemId, newValue);
        return { isBookmarked: newValue };
      }),

    updateNote: protectedProcedure
      .input(z.object({
        problemId: z.number(),
        note: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateProblemNote(ctx.user.id, input.problemId, input.note);
        return { success: true };
      }),

    bookmarked: protectedProcedure.query(async ({ ctx }) => {
      const bookmarked = await db.getUserBookmarkedProblems(ctx.user.id);
      const problemIds = bookmarked.map(b => b.problemId);
      const problems = await db.getProblems(problemIds);
      return problems;
    }),

    /** 문제 본문(지문·예제) 조회. 캐시 없으면 BOJ 스크래핑 후 저장 (2-2) */
    getContent: protectedProcedure
      .input(z.object({ problemId: z.number() }))
      .query(async ({ input }) => {
        let content = await db.getProblemContent(input.problemId);
        if (!content) {
          const scraped = await scrapeProblemContent(input.problemId);
          if (scraped) {
            await db.upsertProblemContent({
              problemId: scraped.problemId,
              descriptionHtml: scraped.descriptionHtml,
              sampleInput: scraped.sampleInput,
              sampleOutput: scraped.sampleOutput,
            });
            content = await db.getProblemContent(input.problemId) ?? undefined;
          }
        }
        return content
          ? {
              descriptionHtml: content.descriptionHtml,
              sampleInput: content.sampleInput,
              sampleOutput: content.sampleOutput,
            }
          : null;
      }),
  }),

  // 목표
  goals: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserGoals(ctx.user.id);
    }),

    active: protectedProcedure.query(async ({ ctx }) => {
      return db.getActiveGoals(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        title: z.string().min(1).max(255),
        type: z.enum(["problem_count", "tag_focus"]),
        targetValue: z.number().min(1),
        targetTags: z.array(z.string()).optional(),
        startDate: z.string(),
        endDate: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const goalId = await db.createGoal({
          userId: ctx.user.id,
          title: input.title,
          type: input.type,
          targetValue: input.targetValue,
          targetTags: input.targetTags,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          status: "active",
        });
        return { goalId };
      }),

    update: protectedProcedure
      .input(z.object({
        goalId: z.number(),
        title: z.string().min(1).max(255).optional(),
        currentValue: z.number().optional(),
        status: z.enum(["active", "completed", "failed"]).optional(),
      }))
      .mutation(async ({ input }) => {
        await db.updateGoal(input.goalId, {
          title: input.title,
          currentValue: input.currentValue,
          status: input.status,
        });
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ goalId: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteGoal(input.goalId);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
