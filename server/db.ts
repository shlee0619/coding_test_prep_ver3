import { eq, and, desc, sql, gte, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  linkedAccounts, InsertLinkedAccount, LinkedAccount,
  syncJobs, InsertSyncJob, SyncJob,
  problemCatalog, InsertProblemCatalog, ProblemCatalog,
  problemContent, InsertProblemContent, ProblemContent,
  userProblemStatus, InsertUserProblemStatus, UserProblemStatus,
  userTagStats, InsertUserTagStats, UserTagStats,
  recommendations, InsertRecommendation, Recommendation,
  goals, InsertGoal, Goal
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export async function isDatabaseReachable(): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ==================== Linked Account Functions ====================

export async function getLinkedAccount(userId: number): Promise<LinkedAccount | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(linkedAccounts)
    .where(eq(linkedAccounts.userId, userId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createLinkedAccount(data: InsertLinkedAccount): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(linkedAccounts).values(data);
  return Number(result[0].insertId);
}

export async function updateLinkedAccount(userId: number, data: Partial<InsertLinkedAccount>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(linkedAccounts).set(data).where(eq(linkedAccounts.userId, userId));
}

export async function deleteLinkedAccount(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(linkedAccounts).where(eq(linkedAccounts.userId, userId));
}

// ==================== Sync Job Functions ====================

export async function createSyncJob(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(syncJobs).values({
    userId,
    status: "QUEUED",
    progress: 0,
  });
  return Number(result[0].insertId);
}

export type CreateSyncJobResult =
  | { success: true; jobId: number }
  | { success: false; reason: "already_running" | "rate_limited"; existingJobId?: number };

/**
 * Atomically check conditions and create sync job.
 * Prevents race condition by using transaction with SELECT FOR UPDATE.
 */
export async function createSyncJobIfAllowed(
  userId: number,
  rateLimitMinutes: number = 10
): Promise<CreateSyncJobResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Use raw SQL for SELECT FOR UPDATE (row-level lock)
  const result = await db.transaction(async (tx) => {
    // Lock and fetch the latest job for this user
    const [latestJob] = await tx
      .select()
      .from(syncJobs)
      .where(eq(syncJobs.userId, userId))
      .orderBy(desc(syncJobs.createdAt))
      .limit(1)
      .for("update");

    // Check if already running
    if (latestJob && latestJob.status === "RUNNING") {
      return { success: false as const, reason: "already_running" as const, existingJobId: latestJob.id };
    }

    // Check rate limit (only for SUCCESS)
    if (latestJob && latestJob.status === "SUCCESS" && latestJob.endedAt) {
      const rateLimitMs = rateLimitMinutes * 60 * 1000;
      const timeSinceLastSync = Date.now() - latestJob.endedAt.getTime();
      if (timeSinceLastSync < rateLimitMs) {
        return { success: false as const, reason: "rate_limited" as const };
      }
    }

    // Create new job
    const insertResult = await tx.insert(syncJobs).values({
      userId,
      status: "QUEUED",
      progress: 0,
    });

    return { success: true as const, jobId: Number(insertResult[0].insertId) };
  });

  return result;
}

export async function getSyncJob(jobId: number): Promise<SyncJob | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(syncJobs).where(eq(syncJobs.id, jobId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getSyncJobForUser(jobId: number, userId: number): Promise<SyncJob | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(syncJobs)
    .where(and(eq(syncJobs.id, jobId), eq(syncJobs.userId, userId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getLatestSyncJob(userId: number): Promise<SyncJob | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(syncJobs)
    .where(eq(syncJobs.userId, userId))
    .orderBy(desc(syncJobs.createdAt))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateSyncJob(jobId: number, data: Partial<InsertSyncJob>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(syncJobs).set(data).where(eq(syncJobs.id, jobId));
}

// ==================== Problem Catalog Functions ====================

export async function upsertProblem(data: InsertProblemCatalog): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(problemCatalog).values(data).onDuplicateKeyUpdate({
    set: {
      title: data.title,
      level: data.level,
      tags: data.tags,
      acceptedUserCount: data.acceptedUserCount,
      averageTries: data.averageTries,
    }
  });
}

export async function upsertProblems(problems: InsertProblemCatalog[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  for (const problem of problems) {
    await upsertProblem(problem);
  }
}

export async function getProblem(problemId: number): Promise<ProblemCatalog | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(problemCatalog)
    .where(eq(problemCatalog.problemId, problemId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getProblems(problemIds: number[]): Promise<ProblemCatalog[]> {
  const db = await getDb();
  if (!db) return [];
  if (problemIds.length === 0) return [];
  
  return db.select().from(problemCatalog)
    .where(inArray(problemCatalog.problemId, problemIds));
}

// ==================== Problem Content (BOJ 스크래핑 캐시) ====================

export async function getProblemContent(problemId: number): Promise<ProblemContent | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(problemContent)
    .where(eq(problemContent.problemId, problemId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertProblemContent(data: InsertProblemContent): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(problemContent).values(data).onDuplicateKeyUpdate({
    set: {
      descriptionHtml: data.descriptionHtml,
      sampleInput: data.sampleInput,
      sampleOutput: data.sampleOutput,
    },
  });
}

// ==================== User Problem Status Functions ====================

export async function getUserProblemStatus(userId: number, problemId: number): Promise<UserProblemStatus | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(userProblemStatus)
    .where(and(
      eq(userProblemStatus.userId, userId),
      eq(userProblemStatus.problemId, problemId)
    ))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserSolvedProblems(userId: number): Promise<UserProblemStatus[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(userProblemStatus)
    .where(and(
      eq(userProblemStatus.userId, userId),
      eq(userProblemStatus.status, "SOLVED")
    ));
}

export async function getUserBookmarkedProblems(userId: number): Promise<UserProblemStatus[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(userProblemStatus)
    .where(and(
      eq(userProblemStatus.userId, userId),
      eq(userProblemStatus.isBookmarked, true)
    ));
}

export async function upsertUserProblemStatus(data: InsertUserProblemStatus): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getUserProblemStatus(data.userId, data.problemId);
  
  if (existing) {
    await db.update(userProblemStatus)
      .set({
        status: data.status,
        isBookmarked: data.isBookmarked,
        solvedAt: data.solvedAt,
        lastSeenAt: data.lastSeenAt,
        note: data.note,
      })
      .where(eq(userProblemStatus.id, existing.id));
  } else {
    await db.insert(userProblemStatus).values(data);
  }
}

export async function updateProblemBookmark(userId: number, problemId: number, isBookmarked: boolean): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getUserProblemStatus(userId, problemId);
  
  if (existing) {
    await db.update(userProblemStatus)
      .set({ isBookmarked })
      .where(eq(userProblemStatus.id, existing.id));
  } else {
    await db.insert(userProblemStatus).values({
      userId,
      problemId,
      status: "UNSOLVED",
      isBookmarked,
    });
  }
}

export async function updateProblemNote(userId: number, problemId: number, note: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getUserProblemStatus(userId, problemId);
  
  if (existing) {
    await db.update(userProblemStatus)
      .set({ note })
      .where(eq(userProblemStatus.id, existing.id));
  } else {
    await db.insert(userProblemStatus).values({
      userId,
      problemId,
      status: "UNSOLVED",
      isBookmarked: false,
      note,
    });
  }
}

// ==================== User Tag Stats Functions ====================

export async function getUserTagStats(userId: number): Promise<UserTagStats[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(userTagStats)
    .where(eq(userTagStats.userId, userId))
    .orderBy(desc(userTagStats.weakScore));
}

export async function saveUserTagStats(stats: InsertUserTagStats[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  if (stats.length === 0) return;
  
  await db.insert(userTagStats).values(stats);
}

// ==================== Recommendations Functions ====================

export async function getLatestRecommendations(userId: number): Promise<Recommendation | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(recommendations)
    .where(eq(recommendations.userId, userId))
    .orderBy(desc(recommendations.generatedAt))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function saveRecommendations(data: InsertRecommendation): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // items가 없거나 빈 배열이면 빈 배열로 초기화
  const items = data.items && Array.isArray(data.items) ? data.items : [];

  // stats가 없으면 기본값 설정
  const stats = data.stats || {
    totalCount: items.length,
    byCategory: { weakness: 0, challenge: 0, review: 0, popular: 0, foundation: 0 },
    avgScore: 0,
    tagCoverage: [],
  };

  const result = await db.insert(recommendations).values({
    ...data,
    items: items,
    stats: stats,
  });
  return Number(result[0].insertId);
}

// ==================== Goals Functions ====================

export async function getUserGoals(userId: number): Promise<Goal[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(goals)
    .where(eq(goals.userId, userId))
    .orderBy(desc(goals.createdAt));
}

export async function getActiveGoals(userId: number): Promise<Goal[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(goals)
    .where(and(
      eq(goals.userId, userId),
      eq(goals.status, "active")
    ))
    .orderBy(desc(goals.createdAt));
}

export async function createGoal(data: InsertGoal): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(goals).values(data);
  return Number(result[0].insertId);
}

export async function updateGoal(goalId: number, data: Partial<InsertGoal>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(goals).set(data).where(eq(goals.id, goalId));
}

export async function updateGoalForUser(
  userId: number,
  goalId: number,
  data: Partial<InsertGoal>,
): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
    .limit(1);

  if (existing.length === 0) {
    return false;
  }

  await db.update(goals).set(data).where(eq(goals.id, goalId));
  return true;
}

export async function deleteGoal(goalId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(goals).where(eq(goals.id, goalId));
}

export async function deleteGoalForUser(userId: number, goalId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
    .limit(1);

  if (existing.length === 0) {
    return false;
  }

  await db.delete(goals).where(eq(goals.id, goalId));
  return true;
}

/**
 * Update goal progress based on solved problems
 * Called during sync to automatically update goal currentValue
 */
export async function updateGoalProgress(userId: number, solvedCount: number, tagStats: Map<string, number>): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const activeGoals = await getActiveGoals(userId);
  const now = new Date();

  for (const goal of activeGoals) {
    let newCurrentValue = goal.currentValue;

    if (goal.type === "problem_count") {
      // 문제 수 목표: 전체 풀이 수 사용
      newCurrentValue = solvedCount;
    } else if (goal.type === "tag_focus" && goal.targetTags) {
      // 태그 집중 목표: 특정 태그들의 풀이 수 합산
      const targetTags = goal.targetTags as string[];
      newCurrentValue = targetTags.reduce((sum, tag) => sum + (tagStats.get(tag) || 0), 0);
    }

    // 목표 달성 여부 확인
    const isCompleted = newCurrentValue >= goal.targetValue;
    const isExpired = new Date(goal.endDate) < now;

    let newStatus = goal.status;
    if (isCompleted && goal.status === "active") {
      newStatus = "completed";
    } else if (isExpired && goal.status === "active" && !isCompleted) {
      newStatus = "failed";
    }

    // 변경사항이 있으면 업데이트
    if (newCurrentValue !== goal.currentValue || newStatus !== goal.status) {
      await updateGoal(goal.id, {
        currentValue: newCurrentValue,
        status: newStatus,
      });
    }
  }
}

// ==================== Dashboard Stats Functions ====================

export async function getDashboardStats(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const solvedResult = await db.select({
    count: sql<number>`COUNT(*)`.as('count'),
  })
    .from(userProblemStatus)
    .where(and(
      eq(userProblemStatus.userId, userId),
      eq(userProblemStatus.status, "SOLVED")
    ));
  
  const totalSolved = solvedResult[0]?.count || 0;
  
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const recentResult = await db.select({
    count: sql<number>`COUNT(*)`.as('count'),
  })
    .from(userProblemStatus)
    .where(and(
      eq(userProblemStatus.userId, userId),
      eq(userProblemStatus.status, "SOLVED"),
      gte(userProblemStatus.solvedAt, sevenDaysAgo)
    ));
  
  const recent7Days = recentResult[0]?.count || 0;
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const monthResult = await db.select({
    count: sql<number>`COUNT(*)`.as('count'),
  })
    .from(userProblemStatus)
    .where(and(
      eq(userProblemStatus.userId, userId),
      eq(userProblemStatus.status, "SOLVED"),
      gte(userProblemStatus.solvedAt, thirtyDaysAgo)
    ));
  
  const recent30Days = monthResult[0]?.count || 0;
  
  return {
    totalSolved,
    recent7Days,
    recent30Days,
  };
}
