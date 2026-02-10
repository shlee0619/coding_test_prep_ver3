import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean, float } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Session user identifier (e.g., `boj:{handle}`). Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * BOJ 계정 연동 정보
 */
export const linkedAccounts = mysqlTable("linked_accounts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  provider: varchar("provider", { length: 32 }).notNull().default("BOJ"),
  handle: varchar("handle", { length: 64 }).notNull(),
  verified: boolean("verified").default(false).notNull(),
  solvedCount: int("solvedCount").default(0),
  tier: int("tier").default(0),
  rating: int("rating").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LinkedAccount = typeof linkedAccounts.$inferSelect;
export type InsertLinkedAccount = typeof linkedAccounts.$inferInsert;

/**
 * 동기화 작업 상태 추적
 */
export const syncJobs = mysqlTable("sync_jobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  status: mysqlEnum("status", ["QUEUED", "RUNNING", "SUCCESS", "FAILED"]).default("QUEUED").notNull(),
  progress: int("progress").default(0).notNull(),
  message: text("message"),
  startedAt: timestamp("startedAt"),
  endedAt: timestamp("endedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SyncJob = typeof syncJobs.$inferSelect;
export type InsertSyncJob = typeof syncJobs.$inferInsert;

/**
 * 문제 카탈로그 (solved.ac 메타데이터 캐시)
 */
export const problemCatalog = mysqlTable("problem_catalog", {
  problemId: int("problemId").primaryKey(),
  title: varchar("title", { length: 512 }).notNull(),
  level: int("level").default(0).notNull(),
  tags: json("tags").$type<string[]>(),
  acceptedUserCount: int("acceptedUserCount").default(0),
  averageTries: float("averageTries").default(0),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProblemCatalog = typeof problemCatalog.$inferSelect;
export type InsertProblemCatalog = typeof problemCatalog.$inferInsert;

/**
 * 문제 본문 캐시 (BOJ 스크래핑, 2-2)
 * 지문·예제 입출력을 저장하여 앱 내 표시 시 사용
 */
export const problemContent = mysqlTable("problem_content", {
  problemId: int("problemId").primaryKey(),
  descriptionHtml: text("descriptionHtml"),
  sampleInput: text("sampleInput"),
  sampleOutput: text("sampleOutput"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProblemContent = typeof problemContent.$inferSelect;
export type InsertProblemContent = typeof problemContent.$inferInsert;

/**
 * 사용자별 문제 상태
 */
export const userProblemStatus = mysqlTable("user_problem_status", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  problemId: int("problemId").notNull(),
  status: mysqlEnum("status", ["UNSOLVED", "SOLVED", "ATTEMPTED"]).default("UNSOLVED").notNull(),
  isBookmarked: boolean("isBookmarked").default(false).notNull(),
  solvedAt: timestamp("solvedAt"),
  lastSeenAt: timestamp("lastSeenAt"),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserProblemStatus = typeof userProblemStatus.$inferSelect;
export type InsertUserProblemStatus = typeof userProblemStatus.$inferInsert;

/**
 * 사용자별 태그 통계 스냅샷 (개선된 약점 분석용)
 */
export const userTagStats = mysqlTable("user_tag_stats", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  snapshotDate: timestamp("snapshotDate").defaultNow().notNull(),
  tag: varchar("tag", { length: 64 }).notNull(),

  // 기본 통계
  attemptedCount: int("attemptedCount").default(0).notNull(),
  solvedCount: int("solvedCount").default(0).notNull(),
  recentSolvedCount30d: int("recentSolvedCount30d").default(0).notNull(),

  // 난이도 분석 (개선)
  avgLevelSolved: float("avgLevelSolved").default(0),           // 푼 문제 평균 난이도
  maxLevelSolved: int("maxLevelSolved").default(0),             // 푼 문제 최고 난이도
  levelDistribution: json("levelDistribution").$type<Record<string, number>>(), // 난이도별 풀이 수

  // 커버리지 분석 (개선)
  totalProblemsInTag: int("totalProblemsInTag").default(0),     // 태그 전체 문제 수
  coverageRate: float("coverageRate").default(0),               // 풀이 비율 (0-1)

  // 시간 분석 (개선)
  lastSolvedAt: timestamp("lastSolvedAt"),                      // 마지막 풀이 시간
  daysSinceLastSolved: int("daysSinceLastSolved").default(0),   // 마지막 풀이 후 경과일
  recentSolvedCount60d: int("recentSolvedCount60d").default(0), // 60일 풀이 수
  recentSolvedCount90d: int("recentSolvedCount90d").default(0), // 90일 풀이 수

  // 종합 약점 점수 (개선)
  weakScore: float("weakScore").default(0).notNull(),
  weakScoreDetails: json("weakScoreDetails").$type<{
    coverageScore: number;      // 커버리지 기반 점수
    levelGapScore: number;      // 난이도 갭 점수
    recencyScore: number;       // 최근성 점수
    ceilingScore: number;       // 난이도 상한 점수
    consistencyScore: number;   // 일관성 점수
  }>(),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserTagStats = typeof userTagStats.$inferSelect;
export type InsertUserTagStats = typeof userTagStats.$inferInsert;

/**
 * 추천 카테고리 타입
 */
export type RecommendationCategory =
  | "weakness"     // 약점 보완
  | "challenge"    // 도전 (난이도 상승)
  | "review"       // 복습 (오래된 태그)
  | "popular"      // 인기 문제
  | "foundation";  // 기초 다지기

/**
 * 추천 문제 아이템 타입
 */
export type RecommendationItem = {
  problemId: number;
  score: number;
  category: RecommendationCategory;
  priority: number;                    // 1-10 (높을수록 우선)
  reasons: string[];
  tags: string[];
  level: number;
  stepLevel?: number;                  // 단계적 학습용 스텝
  scoreBreakdown: {
    tagWeakness: number;               // 태그 약점 점수
    levelFitness: number;              // 난이도 적합도
    stepProgress: number;              // 단계 진행 점수
    problemQuality: number;            // 문제 품질
    diversity: number;                 // 다양성 보너스
  };
};

/**
 * 추천 결과 캐시 (개선)
 */
export const recommendations = mysqlTable("recommendations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),

  // 생성 조건
  criteria: json("criteria").$type<{
    userTier: number;
    userAvgLevel: number;
    levelMin: number;
    levelMax: number;
    weakTags: string[];
    excludeSolved: boolean;
  }>(),

  // 추천 결과 (카테고리별)
  items: json("items").$type<RecommendationItem[]>(),

  // 통계
  stats: json("stats").$type<{
    totalCount: number;
    byCategory: Record<RecommendationCategory, number>;
    avgScore: number;
    tagCoverage: string[];
  }>(),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Recommendation = typeof recommendations.$inferSelect;
export type InsertRecommendation = typeof recommendations.$inferInsert;

/**
 * 학습 목표
 */
export const goals = mysqlTable("goals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["problem_count", "tag_focus"]).default("problem_count").notNull(),
  targetValue: int("targetValue").notNull(),
  currentValue: int("currentValue").default(0).notNull(),
  targetTags: json("targetTags").$type<string[]>(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  status: mysqlEnum("status", ["active", "completed", "failed"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Goal = typeof goals.$inferSelect;
export type InsertGoal = typeof goals.$inferInsert;
