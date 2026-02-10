/**
 * BOJ 제출 이력 스크래핑
 * Phase 1: 풀이 날짜 획득으로 Recency 정확도 향상
 *
 * BOJ status 페이지 (https://www.acmicpc.net/status?user_id={handle})
 * 에서 맞은 제출(AC)의 문제 ID와 제출 시각을 추출합니다.
 */

import axios from "axios";
import * as cheerio from "cheerio";

const BOJ_BASE = "https://www.acmicpc.net";
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface SolveRecord {
  problemId: number;
  solvedAt: Date;
}

/**
 * BOJ 문제 본문 스크래핑 결과 (2-2)
 */
export interface ProblemContentResult {
  problemId: number;
  descriptionHtml: string | null;
  sampleInput: string | null;
  sampleOutput: string | null;
}

/**
 * BOJ status 페이지에서 사용자의 AC 제출 이력을 스크래핑하여
 * 문제별 최초 풀이 날짜를 반환합니다.
 *
 * @param handle BOJ 사용자 ID
 * @param maxPages 최대 스크래핑할 페이지 수 (기본 20, 페이지당 20건)
 * @returns problemId -> solvedAt 맵 (실패 시 null)
 */
export async function scrapeSolveDates(
  handle: string,
  maxPages: number = 20
): Promise<Map<number, Date> | null> {
  const problemFirstSolve = new Map<number, Date>();

  try {
    for (let page = 1; page <= maxPages; page++) {
      const url = `${BOJ_BASE}/status?user_id=${encodeURIComponent(handle)}&result_id=4&page=${page}`;
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; BOJ-Scraper/1.0; +https://github.com)",
        },
        validateStatus: (s) => s === 200,
      });

      const $ = cheerio.load(response.data);
      const rows = $("table#status-table tbody tr");

      if (rows.length === 0 && page > 1) break;

      rows.each((_, el) => {
        const $row = $(el);
        const problemLink = $row.find("td:nth-child(3) a").attr("href");
        const timeStr =
          $row.find("td:nth-child(9) a").attr("title") ??
          $row.find("td:nth-child(9)").text().trim();

        if (!problemLink || !timeStr) return;

        const match = problemLink.match(/\/problem\/(\d+)/);
        if (!match) return;

        const problemId = parseInt(match[1], 10);
        const solvedAt = parseKoreanDateTime(timeStr);
        if (!solvedAt) return;

        const existing = problemFirstSolve.get(problemId);
        if (!existing || solvedAt < existing) {
          problemFirstSolve.set(problemId, solvedAt);
        }
      });

      if (rows.length < 20) break;

      await delay(800);
    }

    return problemFirstSolve.size > 0 ? problemFirstSolve : null;
  } catch (err) {
    console.warn("[BOJ Scraper] Failed to scrape solve dates:", err);
    return null;
  }
}

/**
 * 한국어 날짜/시간 문자열 파싱
 * 예: "2024-01-15 14:30:00", "1분 전", "1시간 전", "1일 전" 등
 */
function parseKoreanDateTime(str: string): Date | null {
  str = str.trim();
  if (!str) return null;

  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (isoMatch) {
    const [, y, m, d, h, min, s] = isoMatch;
    return new Date(
      parseInt(y!, 10),
      parseInt(m!, 10) - 1,
      parseInt(d!, 10),
      parseInt(h!, 10),
      parseInt(min!, 10),
      parseInt(s!, 10)
    );
  }

  const now = new Date();
  const minMatch = str.match(/(\d+)\s*분\s*전/);
  if (minMatch) {
    const mins = parseInt(minMatch[1], 10);
    return new Date(now.getTime() - mins * 60 * 1000);
  }

  const hourMatch = str.match(/(\d+)\s*시간\s*전/);
  if (hourMatch) {
    const hours = parseInt(hourMatch[1], 10);
    return new Date(now.getTime() - hours * 60 * 60 * 1000);
  }

  const dayMatch = str.match(/(\d+)\s*일\s*전/);
  if (dayMatch) {
    const days = parseInt(dayMatch[1], 10);
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }

  return null;
}

/**
 * BOJ 문제 페이지에서 지문·예제 입출력을 스크래핑합니다 (2-2).
 * https://www.acmicpc.net/problem/{problemId}
 *
 * @param problemId BOJ 문제 번호
 * @returns 지문 HTML, 예제 입력/출력 (실패 시 null 필드)
 */
export async function scrapeProblemContent(
  problemId: number
): Promise<ProblemContentResult | null> {
  try {
    const url = `${BOJ_BASE}/problem/${problemId}`;
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; BOJ-Scraper/1.0; +https://github.com)",
      },
      validateStatus: (s) => s === 200,
    });

    const $ = cheerio.load(response.data);

    const descriptionEl = $("#problem_description");
    const descriptionHtml =
      descriptionEl.length > 0 ? descriptionEl.html()?.trim() ?? null : null;

    const sampleInputParts: string[] = [];
    $('[id^="sample-input"]').each((_, el) => {
      const text = $(el).find("pre").text().trim() || $(el).text().trim();
      if (text) sampleInputParts.push(text);
    });
    if (sampleInputParts.length === 0) {
      $(".sample-input pre").each((_, el) => {
        const text = $(el).text().trim();
        if (text) sampleInputParts.push(text);
      });
    }
    const sampleInput =
      sampleInputParts.length > 0 ? sampleInputParts.join("\n---\n") : null;

    const sampleOutputParts: string[] = [];
    $('[id^="sample-output"]').each((_, el) => {
      const text = $(el).find("pre").text().trim() || $(el).text().trim();
      if (text) sampleOutputParts.push(text);
    });
    if (sampleOutputParts.length === 0) {
      $(".sample-output pre").each((_, el) => {
        const text = $(el).text().trim();
        if (text) sampleOutputParts.push(text);
      });
    }
    const sampleOutput =
      sampleOutputParts.length > 0 ? sampleOutputParts.join("\n---\n") : null;

    return {
      problemId,
      descriptionHtml,
      sampleInput,
      sampleOutput,
    };
  } catch (err) {
    console.warn("[BOJ Scraper] Failed to scrape problem content:", problemId, err);
    return null;
  }
}
