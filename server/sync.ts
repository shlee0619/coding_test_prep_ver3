import * as db from "./db";
import * as solvedac from "./solvedac";
import * as recommendationEngine from "./recommendation-engine";
import { scrapeSolveDates } from "./boj-scraper";

/**
 * Run full sync for a user
 * This fetches all data from solved.ac and updates the database
 */
export async function runSync(userId: number, jobId: number): Promise<void> {
  try {
    // Update job status to RUNNING
    await db.updateSyncJob(jobId, {
      status: "RUNNING",
      startedAt: new Date(),
      message: "동기화 시작...",
    });

    // Get linked account
    const linkedAccount = await db.getLinkedAccount(userId);
    if (!linkedAccount) {
      throw new Error("BOJ 계정이 연결되어 있지 않습니다.");
    }

    const handle = linkedAccount.handle;

    // Step 1: Fetch user profile (10%)
    await db.updateSyncJob(jobId, { progress: 5, message: "프로필 정보 가져오는 중..." });
    
    const profile = await solvedac.getUserProfile(handle);
    if (!profile) {
      throw new Error(`solved.ac에서 "${handle}" 사용자를 찾을 수 없습니다.`);
    }

    // Update linked account with profile data
    await db.updateLinkedAccount(userId, {
      verified: true,
      solvedCount: profile.solvedCount,
      tier: profile.tier,
      rating: profile.rating,
    });

    await db.updateSyncJob(jobId, { progress: 10, message: "프로필 정보 업데이트 완료" });

    // Step 2: Fetch solved problems list (30%)
    await db.updateSyncJob(jobId, { progress: 15, message: "풀이 목록 가져오는 중..." });
    
    const solvedProblemIds = await solvedac.getUserSolvedProblems(handle);
    
    await db.updateSyncJob(jobId, { progress: 30, message: `${solvedProblemIds.length}개 문제 발견` });

    // Step 3: Fetch problem details (60%)
    await db.updateSyncJob(jobId, { progress: 35, message: "문제 정보 가져오는 중..." });
    
    const problems = await solvedac.getProblemsById(solvedProblemIds);
    
    await db.updateSyncJob(jobId, { progress: 60, message: "문제 정보 저장 중..." });

    // Step 4: Save problems to catalog (batch insert for performance)
    const problemsToInsert = problems.map(problem => {
      const tags = problem.tags.map(t => solvedac.getTagDisplayName(t));
      return {
        problemId: problem.problemId,
        title: problem.titleKo || problem.titles[0]?.title || `Problem ${problem.problemId}`,
        level: problem.level,
        tags,
        acceptedUserCount: problem.acceptedUserCount,
        averageTries: problem.averageTries,
      };
    });
    
    await db.upsertProblems(problemsToInsert);

    await db.updateSyncJob(jobId, { progress: 65, message: "풀이 날짜 가져오는 중..." });

    // Phase 1: BOJ 스크래핑으로 풀이 날짜 획득, 실패 시 문제 ID 순서 proxy 사용
    let solvedDates = new Map<number, Date>();
    const scrapedDates = await scrapeSolveDates(handle);
    if (scrapedDates && scrapedDates.size > 0) {
      solvedDates = scrapedDates;
    } else {
      // Quick Win: Recency 대체 - 문제 ID 순서를 proxy로 사용
      const now = new Date();
      const oneDayMs = 24 * 60 * 60 * 1000;
      const sortedIds = [...solvedProblemIds].sort((a, b) => a - b);
      sortedIds.forEach((id, i) => {
        const daysAgo = Math.max(0, sortedIds.length - 1 - i);
        solvedDates.set(id, new Date(now.getTime() - daysAgo * oneDayMs));
      });
    }

    await db.updateSyncJob(jobId, { progress: 70, message: "사용자 풀이 상태 업데이트 중..." });

    // Step 5: Update user problem status (batch insert for performance)
    const statusUpdates = solvedProblemIds.map((problemId) => ({
      userId,
      problemId,
      status: "SOLVED" as const,
      solvedAt: solvedDates.get(problemId) ?? new Date(),
    }));
    
    // Process in batches of 100 to avoid overwhelming the database
    const batchSize = 100;
    for (let i = 0; i < statusUpdates.length; i += batchSize) {
      const batch = statusUpdates.slice(i, i + batchSize);
      await Promise.all(batch.map(status => db.upsertUserProblemStatus(status)));
    }

    await db.updateSyncJob(jobId, { progress: 75, message: "태그 분석 중..." });

    // Step 6: 개선된 태그 분석 및 약점 점수 계산
    // Phase 2: 동적 tagExpectations 로딩
    let tagExpectations: Map<string, solvedac.TagExpectation> | undefined;
    try {
      tagExpectations = await solvedac.getTagExpectations();
    } catch (e) {
      console.warn("[Sync] getTagExpectations failed, using fallback:", e);
    }

    const tagAnalysis = recommendationEngine.analyzeUserTags(
      problems,
      solvedDates
    );
    const weaknessScores = recommendationEngine.calculateWeaknessScores(
      tagAnalysis,
      profile.tier,
      tagExpectations
    );

    // DB 형식으로 변환하여 저장
    const tagStats = recommendationEngine.convertToDbFormat(userId, weaknessScores);
    await db.saveUserTagStats(tagStats);

    await db.updateSyncJob(jobId, { progress: 85, message: "맞춤 추천 생성 중..." });

    // Step 7: 개선된 추천 생성
    let recommendationResult;
    try {
      recommendationResult = await recommendationEngine.generateRecommendations(
        userId,
        profile.tier,
        problems,
        weaknessScores,
        tagExpectations
      );
    } catch (recError: any) {
      console.error("[Sync] Recommendation generation error:", recError);
      // 추천 생성 실패 시 빈 결과로 대체
      recommendationResult = {
        items: [],
        stats: {
          totalCount: 0,
          byCategory: { weakness: 0, challenge: 0, review: 0, popular: 0, foundation: 0 },
          avgScore: 0,
          tagCoverage: [],
        },
        criteria: {
          userTier: profile.tier,
          userAvgLevel: Math.round(problems.reduce((sum, p) => sum + p.level, 0) / Math.max(problems.length, 1)),
          levelMin: 1,
          levelMax: 30,
          weakTags: weaknessScores.slice(0, 5).map(w => w.tag),
          excludeSolved: true,
        },
      };
    }

    // 추천 결과의 문제들을 카탈로그에 반영 (추천 목록 조회 시 problem null 방지)
    const recIds = [...new Set((recommendationResult.items || []).map((i: { problemId: number }) => i.problemId))];
    if (recIds.length > 0) {
      await db.updateSyncJob(jobId, { progress: 87, message: "추천 문제 정보 저장 중..." });
      const recProblems = await solvedac.getProblemsById(recIds);
      const toUpsert = recProblems.map((p) => ({
        problemId: p.problemId,
        title: p.titleKo || p.titles[0]?.title || `Problem ${p.problemId}`,
        level: p.level,
        tags: p.tags.map((t) => solvedac.getTagDisplayName(t)),
        acceptedUserCount: p.acceptedUserCount,
        averageTries: p.averageTries,
      }));
      await db.upsertProblems(toUpsert);
    }

    // 추천 결과 저장 (items가 빈 배열이어도 저장)
    await db.saveRecommendations({
      userId,
      generatedAt: new Date(),
      criteria: recommendationResult.criteria,
      items: recommendationResult.items || [],
      stats: recommendationResult.stats,
    });

    await db.updateSyncJob(jobId, { progress: 90, message: "학습 목표 업데이트 중..." });

    // Step 8: 목표 진행도 자동 업데이트
    const tagSolvedCounts = new Map<string, number>();
    for (const ws of weaknessScores) {
      tagSolvedCounts.set(ws.tag, ws.analysis.solvedCount);
    }
    await db.updateGoalProgress(userId, solvedProblemIds.length, tagSolvedCounts);

    // Complete
    const categoryStats = Object.entries(recommendationResult.stats.byCategory)
      .filter(([, count]) => count > 0)
      .map(([cat, count]) => `${cat}: ${count}`)
      .join(', ');

    await db.updateSyncJob(jobId, {
      status: "SUCCESS",
      progress: 100,
      message: `동기화 완료: ${solvedProblemIds.length}개 문제 분석, ${recommendationResult.items.length}개 추천 (${categoryStats})`,
      endedAt: new Date(),
    });

  } catch (error: any) {
    console.error("[Sync] Error:", error);
    
    await db.updateSyncJob(jobId, {
      status: "FAILED",
      message: error.message || "동기화 중 오류가 발생했습니다.",
      endedAt: new Date(),
    });
    
    throw error;
  }
}
