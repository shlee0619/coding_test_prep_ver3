/**
 * 1-3: 태그/난이도별 카탈로그 선채우기
 * solved.ac search/problem으로 특정 레벨 구간·태그 문제를 페이지네이션해
 * problem_catalog에 upsert합니다. Rate limit(~100/분) 준수를 위해 요청 간 딜레이를 둡니다.
 *
 * 사용: DATABASE_URL 설정 후 `pnpm run fill-catalog` 또는 `npx tsx scripts/fill-problem-catalog.ts`
 */

import "dotenv/config";
import * as db from "../server/db";
import * as solvedac from "../server/solvedac";

const DELAY_MS = 700;
const MAX_PAGES = 20;
const PAGE_SIZE = 50;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const database = await db.getDb();
  if (!database) {
    console.error("DATABASE_URL이 설정되지 않았거나 DB에 연결할 수 없습니다.");
    process.exit(1);
  }

  const levelMin = 1;
  const levelMax = 20;
  let totalUpserted = 0;
  let page = 1;

  console.log(`[fill-catalog] tier ${levelMin}..${levelMax}, 최대 ${MAX_PAGES}페이지 수집 시작`);

  while (page <= MAX_PAGES) {
    const { items, count } = await solvedac.searchProblems({
      levelMin,
      levelMax,
      page,
      sort: "solved",
      direction: "desc",
    });

    if (items.length === 0) {
      console.log(`[fill-catalog] 페이지 ${page}: 항목 없음, 종료`);
      break;
    }

    const toUpsert = items.map((p) => ({
      problemId: p.problemId,
      title: p.titleKo || p.titles[0]?.title || `Problem ${p.problemId}`,
      level: p.level,
      tags: p.tags.map((t) => solvedac.getTagDisplayName(t)),
      acceptedUserCount: p.acceptedUserCount,
      averageTries: p.averageTries,
    }));

    await db.upsertProblems(toUpsert);
    totalUpserted += toUpsert.length;
    console.log(`[fill-catalog] 페이지 ${page}: ${items.length}건 upsert (누적 ${totalUpserted} / ${count})`);

    if (items.length < PAGE_SIZE || totalUpserted >= count) {
      break;
    }

    page++;
    await delay(DELAY_MS);
  }

  console.log(`[fill-catalog] 완료: 총 ${totalUpserted}건 카탈로그 반영`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
