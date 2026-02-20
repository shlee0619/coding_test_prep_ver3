# SolveMate 백엔드 보완 보고서

- 작성일: 2026-02-16
- 대상: `/Users/shlee/Desktop/coding_test_prep_ver3` 백엔드 (`/server`, `/drizzle`)
- 목적: 공개 출시 전 백엔드 안정성/보안/운영성 보완 항목 정의

---

## 1) 현재 상태 요약

이번 사이클에서 아래 핵심 보완은 이미 반영됨:

1. 인증 우회 차단 (`INVALID_CREDENTIALS` 예외 허용 제거)
2. IDOR 보완 (`sync.status`, `goals.update/delete` 사용자 소유권 검증)
3. 정책 URL 빌드 가드 추가
4. 관련 회귀 테스트 추가

현재 잔여 과제는 코드 품질보다 **운영 안정성/보안 강화** 성격이 큼.

---

## 2) 우선순위별 백엔드 보완 항목

## P0 (출시 전 필수)

### P0-1. 인증/세션 만료 정책 단축

- 현황:
  - 세션 만료가 `ONE_YEAR_MS`(1년) 기반 (`/shared/const.ts`)
  - JWT 만료 시간이 과도하게 길어 탈취 시 피해 범위가 큼
- 보완:
  - Access Token 15~60분으로 축소
  - 장기 로그인은 Refresh Token(회전/폐기) 패턴으로 분리
  - 로그아웃 시 Access/Refresh 모두 폐기
- 수정 지점:
  - `/shared/const.ts`
  - `/server/_core/sdk.ts`
  - `/server/_core/oauth.ts`

### P0-2. 인증 관련 Rate Limit 도입

- 현황:
  - 로그인/세션 엔드포인트에 전역/엔드포인트 단위 Rate Limit 부재
  - 브루트포스/크리덴셜 스터핑 방어가 약함
- 보완:
  - `/api/auth/boj/login`, `/api/auth/session`, `/api/auth/dev/login`에 제한 적용
  - 키 전략: `IP + handle` (로그인), `IP` (기타)
  - 초과 시 `429` + `Retry-After` 반환
- 수정 지점:
  - `/server/_core/index.ts` (미들웨어 장착)
  - Redis 저장소 기반 limiter (권장)

### P0-3. Redis 운영 필수화

- 현황:
  - `REDIS_URL` 미설정 시 인메모리 fallback 허용 (`/server/_core/redis.ts`)
  - 멀티 인스턴스/재시작 시 블랙리스트 정합성 저하 가능
- 보완:
  - `production`에서 `REDIS_URL` 필수화 (미설정 시 서버 기동 실패)
  - 인메모리 fallback은 `development`에서만 허용
- 수정 지점:
  - `/server/_core/env.ts`
  - `/server/_core/redis.ts`

### P0-4. DB 무결성 제약 추가

- 현황:
  - `user_problem_status(userId, problemId)` 복합 유니크 없음
  - `linked_accounts(userId, provider)` 복합 유니크 없음
  - 주요 관계 컬럼(`userId`) FK 제약 없음
- 보완:
  - 복합 유니크/외래키 제약 추가 후 앱 로직을 `upsert` 중심으로 단순화
- 수정 지점:
  - `/drizzle/schema.ts`
  - 신규 마이그레이션 SQL (`/drizzle/*.sql`)
  - `/server/db.ts` (SELECT 후 UPDATE 패턴 제거)

---

## P1 (출시 직전 ~ 출시 1주 내)

### P1-1. 외부 의존성 장애 격리 (solved.ac/BOJ)

- 보완:
  - 외부 호출 timeout/retry/backoff 표준화
  - 동기화/추천 경로에 circuit breaker 또는 fail-fast 정책 적용
  - 외부 장애 시 사용자 메시지 코드 체계 통일
- 수정 지점:
  - `/server/solvedac.ts`
  - `/server/boj-auth.ts`
  - `/server/sync.ts`
  - `/server/routers.ts`

### P1-2. API 에러 계약 표준화

- 보완:
  - 에러 포맷 통일: `code`, `message`, `retryable`, `traceId`
  - 내부 에러 마스킹은 유지하되, 운영 추적용 `traceId` 반환
- 수정 지점:
  - `/server/_core/trpc.ts`
  - `/server/_core/index.ts`
  - `/server/_core/oauth.ts`

### P1-3. 감사 로그(Audit) 추가

- 보완:
  - 로그인 성공/실패, 로그아웃, 계정연동 변경, 목표 수정/삭제에 감사 로그 기록
  - 최소 항목: `actor`, `action`, `target`, `result`, `timestamp`, `requestId`
- 수정 지점:
  - `/server/_core/index.ts` (requestId)
  - `/server/_core/oauth.ts`
  - `/server/routers.ts`

---

## P2 (출시 후 안정화)

### P2-1. 관측성(Observability) 강화

- 보완:
  - 구조화 로그(JSON) 전환
  - 에러율/지연/외부호출 실패율 지표 수집
  - `/api/health`에 readiness/liveness 기준 분리
- 수정 지점:
  - `/server/_core/index.ts`
  - `/server/_core/env.ts`

### P2-2. 백엔드 테스트 스코프 확장

- 보완:
  - 권한 테스트: 모든 mutate 엔드포인트 소유권 검증 케이스 추가
  - 동시성 테스트: `sync.start` 경합 요청 시 단일 job 생성 보장
  - 장애 테스트: solved.ac/BOJ 타임아웃 시 응답 코드/재시도 동작 검증
- 수정 지점:
  - `/server/__tests__/*.test.ts`

---

## 3) 구현 순서 (권장)

1. P0-3 Redis 필수화
2. P0-2 Auth Rate Limit
3. P0-1 세션 만료 정책 개편
4. P0-4 DB 제약 + upsert 리팩토링
5. P1 에러 계약/감사 로그/외부장애 격리

---

## 4) 완료 기준 (Definition of Done)

아래를 모두 충족하면 백엔드 보완 완료로 판단:

1. `pnpm check`, `pnpm test`, `pnpm build` 통과
2. 인증 브루트포스 시 `429` 확인
3. Redis 중단/재기동 시 세션 폐기 정책 일관성 유지
4. 소유권 위반 요청에 대해 `NOT_FOUND` 또는 `FORBIDDEN` 일관 반환
5. 신규 DB 제약 적용 후 데이터 무결성 위반 0건
6. 운영 문서(`DEPLOY.md`, 체크리스트) 동기화 완료

---

## 5) 운영 체크리스트 (백엔드)

1. `JWT_SECRET` 교체 및 재배포
2. `REDIS_URL` 설정 확인
3. `ALLOWED_ORIGINS` 운영 도메인만 포함 확인
4. `/api/health` 200 및 dependency 상태 확인
5. 로그인/동기화/추천 주요 플로우 모니터링 확인
