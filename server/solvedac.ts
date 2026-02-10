import axios from "axios";

const SOLVED_AC_API = "https://solved.ac/api/v3";

// Rate limiting: solved.ac allows ~100 requests per minute
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface SolvedAcUser {
  handle: string;
  bio: string;
  solvedCount: number;
  tier: number;
  rating: number;
  ratingByProblemsSum: number;
  ratingByClass: number;
  ratingBySolvedCount: number;
  ratingByVoteCount: number;
  class: number;
  classDecoration: string;
  rivalCount: number;
  reverseRivalCount: number;
  maxStreak: number;
  rank: number;
}

export interface SolvedAcProblem {
  problemId: number;
  titleKo: string;
  titles: { language: string; title: string }[];
  isSolvable: boolean;
  isPartial: boolean;
  acceptedUserCount: number;
  level: number;
  votedUserCount: number;
  sprout: boolean;
  givesNoRating: boolean;
  isLevelLocked: boolean;
  averageTries: number;
  official: boolean;
  tags: {
    key: string;
    isMeta: boolean;
    bojTagId: number;
    problemCount: number;
    displayNames: { language: string; name: string; short: string }[];
  }[];
}

export interface SolvedAcProblemTag {
  key: string;
  displayNames: { language: string; name: string; short: string }[];
  /** 태그별 문제 수 (tag.list API 응답에 포함될 수 있음) */
  problemCount?: number;
}

/**
 * 태그별 기대 풀이 수 계산용 (동적 TAG_EXPECTATIONS)
 */
export interface TagExpectation {
  tag: string;
  problemCount: number;
  baseCount: number;
  tierMultiplier: number;
}

/**
 * Get user profile from solved.ac
 */
export async function getUserProfile(handle: string): Promise<SolvedAcUser | null> {
  try {
    const response = await axios.get(`${SOLVED_AC_API}/user/show`, {
      params: { handle },
      timeout: 10000,
    });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    console.error("[solved.ac] Failed to get user profile:", error.message);
    throw error;
  }
}

/**
 * Get problems solved by a user
 * Returns problem IDs in pages
 */
export async function getUserSolvedProblems(handle: string): Promise<number[]> {
  const problemIds: number[] = [];
  let page = 1;
  const pageSize = 50;
  
  try {
    while (true) {
      const response = await axios.get(`${SOLVED_AC_API}/search/problem`, {
        params: {
          query: `solved_by:${handle}`,
          page,
          sort: "id",
          direction: "asc",
        },
        timeout: 15000,
      });
      
      const { items, count } = response.data;
      
      for (const problem of items) {
        problemIds.push(problem.problemId);
      }
      
      if (problemIds.length >= count || items.length === 0) {
        break;
      }
      
      page++;
      await delay(600); // Rate limiting
    }
    
    return problemIds;
  } catch (error: any) {
    console.error("[solved.ac] Failed to get solved problems:", error.message);
    throw error;
  }
}

/**
 * Get problem details by IDs (batch)
 */
export async function getProblemsById(problemIds: number[]): Promise<SolvedAcProblem[]> {
  if (problemIds.length === 0) return [];
  
  const problems: SolvedAcProblem[] = [];
  const batchSize = 100;
  
  try {
    for (let i = 0; i < problemIds.length; i += batchSize) {
      const batch = problemIds.slice(i, i + batchSize);
      const idsParam = batch.join(",");
      
      const response = await axios.get(`${SOLVED_AC_API}/problem/lookup`, {
        params: { problemIds: idsParam },
        timeout: 15000,
      });
      
      problems.push(...response.data);
      
      if (i + batchSize < problemIds.length) {
        await delay(600); // Rate limiting
      }
    }
    
    return problems;
  } catch (error: any) {
    console.error("[solved.ac] Failed to get problems:", error.message);
    throw error;
  }
}

/** solved.ac search sort 옵션 (Quick Win: sort 파라미터 확장) */
export type SearchSort =
  | "id"        // 문제 번호
  | "level"     // 난이도
  | "solved"    // 맞은 사람 수
  | "average_try"  // 평균 시도 횟수
  | "random";  // 랜덤

/**
 * Search problems with various filters
 * Quick Win: sort, direction 파라미터 지원
 */
export async function searchProblems(params: {
  query?: string;
  levelMin?: number;
  levelMax?: number;
  tags?: string[];
  page?: number;
  sort?: SearchSort;
  direction?: "asc" | "desc";
}): Promise<{ items: SolvedAcProblem[]; count: number }> {
  try {
    let query = params.query || "";

    if (params.levelMin !== undefined) {
      query += ` tier:${params.levelMin}..`;
    }
    if (params.levelMax !== undefined) {
      query += `${params.levelMin ? "" : " tier:.."}${params.levelMax}`;
    }
    if (params.tags && params.tags.length > 0) {
      query += ` ${params.tags.map((t) => `tag:${t}`).join(" ")}`;
    }

    const response = await axios.get(`${SOLVED_AC_API}/search/problem`, {
      params: {
        query: query.trim(),
        page: params.page || 1,
        sort: params.sort ?? "solved",
        direction: params.direction ?? "desc",
      },
      timeout: 15000,
    });

    return response.data;
  } catch (error: any) {
    console.error("[solved.ac] Failed to search problems:", error.message);
    throw error;
  }
}

/**
 * Get all available tags (동적 TAG_EXPECTATIONS용)
 * problemCount 기반 기대치 산출
 */
export async function getAllTags(): Promise<SolvedAcProblemTag[]> {
  const all: SolvedAcProblemTag[] = [];
  let page = 1;

  try {
    while (true) {
      const response = await axios.get(`${SOLVED_AC_API}/tag/list`, {
        params: { page },
        timeout: 10000,
      });

      const items = response.data?.items ?? [];
      if (items.length === 0) break;

      all.push(...items);
      if (items.length < 50) break;

      page++;
      await delay(400);
    }

    return all;
  } catch (error: any) {
    console.error("[solved.ac] Failed to get tags:", error.message);
    throw error;
  }
}

/**
 * 태그별 기대 풀이 수 계산용 맵 생성 (Phase 2: 동적 TAG_EXPECTATIONS)
 * problemCount 기반 baseCount, tierMultiplier 산출
 */
export async function getTagExpectations(): Promise<Map<string, TagExpectation>> {
  const tags = await getAllTags();
  const map = new Map<string, TagExpectation>();

  const totalProblems = tags.reduce(
    (sum, t) => sum + ((t as { problemCount?: number }).problemCount ?? 0),
    0
  );
  const avgCount = totalProblems > 0 ? totalProblems / tags.length : 100;

  for (const tag of tags) {
    const problemCount =
      (tag as { problemCount?: number }).problemCount ?? avgCount;
    const korean =
      tag.displayNames?.find((d) => d.language === "ko")?.name ?? tag.key;

    const baseCount = Math.min(
      50,
      Math.max(10, Math.round(problemCount * 0.02))
    );
    const tierMultiplier =
      problemCount > 500 ? 1.5 : problemCount > 200 ? 1.3 : 1.2;

    map.set(korean, {
      tag: korean,
      problemCount,
      baseCount,
      tierMultiplier,
    });
  }

  return map;
}

/**
 * Convert solved.ac tier number to tier name
 */
export function getTierName(tier: number): string {
  if (tier === 0) return "Unrated";
  
  const tiers = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Ruby"];
  const levels = ["V", "IV", "III", "II", "I"];
  
  const tierIndex = Math.floor((tier - 1) / 5);
  const levelIndex = (tier - 1) % 5;
  
  if (tierIndex >= tiers.length) return "Master";
  
  return `${tiers[tierIndex]} ${levels[levelIndex]}`;
}

/**
 * Get tier color for UI
 */
export function getTierColor(tier: number): string {
  if (tier === 0) return "#2D2D2D";
  if (tier <= 5) return "#AD5600"; // Bronze
  if (tier <= 10) return "#435F7A"; // Silver
  if (tier <= 15) return "#EC9A00"; // Gold
  if (tier <= 20) return "#27E2A4"; // Platinum
  if (tier <= 25) return "#00B4FC"; // Diamond
  return "#FF0062"; // Ruby
}

/**
 * Extract Korean tag name from tag object
 */
export function getTagDisplayName(tag: SolvedAcProblem["tags"][0]): string {
  const korean = tag.displayNames.find(d => d.language === "ko");
  return korean?.name || tag.key;
}
