# SolveMate 명세서 (Repository Specification)

## 1. 문서 목적
이 문서는 `/Users/shlee/Desktop/coding_test_prep_ver3` 저장소의 현재 구현 기준 기능/구조/인터페이스를 정의한다.
- 기준 시점: 로컬 클론된 `coding_test_prep_ver3`
- 범위: 모바일/웹 앱, 서버 API, DB 스키마, 동기화/추천 로직, 실행/배포

## 2. 프로젝트 개요
- 서비스명: `SolveMate`
- 목적: BOJ(백준) 학습 데이터를 수집/분석하고, 약점 기반 문제 추천과 목표 관리를 제공
- 동작 형태:
  - 프론트엔드: Expo + React Native + Expo Router (iOS/Android/Web)
  - 백엔드: Express + tRPC + REST Auth endpoint
  - 데이터: MySQL + Drizzle ORM

## 3. 기술 스택
- App: `React 19`, `React Native 0.81`, `Expo 54`, `Expo Router 6`
- State/Data: `@tanstack/react-query`, `tRPC v11`, `superjson`
- Server: `Express`, `@trpc/server`
- DB: `MySQL`, `drizzle-orm`, `drizzle-kit`
- Styling: `NativeWind`, `TailwindCSS`
- External: `solved.ac API`, `BOJ 웹 스크래핑`

## 4. 디렉터리 구조 및 책임
- `app/`: 라우트 기반 UI 화면
  - `(tabs)/index.tsx`: 대시보드
  - `(tabs)/analytics.tsx`: 분석 화면(현재 mock 데이터 중심)
  - `(tabs)/recommendations.tsx`: 추천 목록/필터
  - `(tabs)/goals.tsx`: 목표 관리
  - `(tabs)/settings.tsx`: 계정/연동/테마 설정
  - `login.tsx`, `connect.tsx`, `problem/[id].tsx`
- `server/`: API/도메인 로직
  - `routers.ts`: tRPC 라우터
  - `sync.ts`: 동기화 오케스트레이션
  - `recommendation-engine.ts`: 추천 알고리즘
  - `solvedac.ts`: solved.ac API 래퍼
  - `boj-scraper.ts`: BOJ 스크래핑
  - `boj-auth.ts`: BOJ ID/PW 검증
  - `db.ts`: DB 접근 함수
- `server/_core/`: 인증/컨텍스트/인프라 공통
- `drizzle/`: DB 스키마/마이그레이션
- `lib/`, `hooks/`, `components/`: 클라이언트 공통 모듈
- `scripts/`: 운영/개발용 스크립트

## 5. 기능 명세

### 5.1 인증/세션
- 인증 방식
  - Web: HTTP-only cookie 기반
  - Native: Bearer token + SecureStore 기반
- 제공 REST endpoint
  - `POST /api/auth/boj/login` (BOJ ID/PW 로그인)
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
  - `POST /api/auth/session`
  - `GET /api/auth/providers`
  - `POST /api/auth/dev/login` (개발 환경 전용)

### 5.2 BOJ 계정 연동
- tRPC `link`
  - `get`: 연동 정보 조회
  - `connect`: BOJ ID/PW 검증 + solved.ac 핸들 검증 후 연결/갱신
  - `disconnect`: 연동 해제

### 5.3 동기화
- tRPC `sync`
  - `start`: 동기화 잡 생성 및 백그라운드 실행
  - `status`: 특정/최신 잡 상태 조회
  - `latest`: 최신 잡 조회
- 처리 단계 (`runSync`)
  1. 프로필 조회
  2. solved 문제 목록 조회
  3. 문제 메타데이터 저장
  4. BOJ 제출 이력 스크래핑(실패 시 문제 ID 기반 대체 날짜)
  5. 사용자 문제 상태 업데이트
  6. 태그 분석/약점 점수 계산
  7. 추천 생성/저장
  8. 목표 진행도 자동 반영

### 5.4 추천
- 카테고리: `weakness`, `challenge`, `review`, `popular`, `foundation`
- 점수 가중치(코드 기준):
  - tagWeakness 0.30
  - levelFitness 0.25
  - stepProgress 0.20
  - problemQuality 0.15
  - diversity 0.10
- tRPC `recommendations`
  - `list`, `byCategory`, `daily`, `stats`, `regenerate`

### 5.5 문제 상세/학습 상태
- tRPC `problems`
  - `get`: 문제 + 사용자 상태 조회
  - `getContent`: BOJ 지문/예제 캐시 조회(없으면 스크래핑)
  - `updateStatus`: 해결 상태 변경
  - `toggleBookmark`: 북마크 토글
  - `updateNote`: 메모 저장
  - `bookmarked`: 북마크 목록 조회

### 5.6 목표 관리
- tRPC `goals`
  - `list`, `active`, `create`, `update`, `delete`
- 동기화 완료 시 목표 진행도 자동 업데이트

### 5.7 대시보드/분석
- tRPC `dashboard.summary`: 계정 요약, KPI, 약점 태그 Top5, 동기화 상태
- tRPC `analytics.tags`, `analytics.availableTags`
- 화면 `app/(tabs)/analytics.tsx`는 현재 서버 데이터 연동보다 UI/Mock 중심

## 6. tRPC 라우터 명세 (요약)
- `system.health`, `system.notifyOwner(admin)`
- `auth.me`, `auth.logout`
- `link.get/connect/disconnect`
- `sync.start/status/latest`
- `dashboard.summary`
- `analytics.tags/availableTags`
- `recommendations.list/byCategory/daily/stats/regenerate`
- `problems.get/updateStatus/toggleBookmark/updateNote/bookmarked/getContent`
- `goals.list/active/create/update/delete`

## 7. 데이터베이스 스키마
주요 테이블:
- `users`: 사용자 기본 정보/권한
- `linked_accounts`: BOJ 연동 계정
- `sync_jobs`: 동기화 작업 상태/진행률
- `problem_catalog`: 문제 메타데이터 캐시
- `problem_content`: 문제 본문/예제 캐시
- `user_problem_status`: 사용자별 풀이 상태/북마크/메모
- `user_tag_stats`: 태그별 분석 스냅샷/약점 점수
- `recommendations`: 추천 결과/통계/생성 조건
- `goals`: 학습 목표

성능 인덱스 마이그레이션 포함:
- `idx_user_status`
- `idx_user_weak`
- `idx_user_generated`
- `idx_user_status_date`

## 8. 환경 변수 명세
필수:
- `DATABASE_URL`
- `JWT_SECRET`

권장/옵션:
- `OWNER_OPEN_ID`
- `ALLOWED_ORIGINS`, `ALLOWED_REDIRECT_URIS`
- `REDIS_URL`
- `EXPO_PUBLIC_SENTRY_DSN`
- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_IOS_BUNDLE_ID`, `EXPO_PUBLIC_ANDROID_PACKAGE`, `EXPO_PUBLIC_DEEP_LINK_SCHEME`

## 9. 실행/빌드/배포 명세
주요 스크립트:
- `pnpm dev`: 서버 + Expo web 동시 실행
- `pnpm dev:server`: API 서버 watch 모드
- `pnpm dev:metro`: Expo web(8081)
- `pnpm db:push`: Drizzle generate + migrate
- `pnpm test`, `pnpm lint`, `pnpm check`
- `pnpm fill-catalog`: 문제 카탈로그 선반영

배포:
- Vercel: `api/index.ts`를 serverless 함수로 사용
- EAS: `eas.json`의 development/preview/production 프로필 사용

## 10. 보안/운영 요구사항
- 세션 쿠키: `httpOnly`, `sameSite`, `secure` 옵션 사용
- 로그아웃 시 토큰 블랙리스트 등록
- CORS는 허용 origin 화이트리스트 기반
- BOJ 비밀번호는 검증 요청에만 사용하며 DB에 저장하지 않음
- 프로덕션 내부 에러 메시지 마스킹 적용

## 11. 현재 구현 기준 주의사항 (Known Gaps)
1. `app/(tabs)/analytics.tsx`는 실제 분석 API 연동보다 mock 데이터 UI 성격이 강함.
2. `scripts/create-db.js`에 로컬 비밀번호 하드코딩이 포함되어 있어 운영 환경 사용에 부적합.

## 12. 향후 유지보수 기준
- 도메인 로직 변경은 `server/routers.ts` + `server/db.ts` + `drizzle/schema.ts`를 함께 갱신
- 신규 추천 로직은 `server/recommendation-engine.ts`에서 가중치/카테고리 영향도와 함께 테스트 추가
- 인증 플로우 변경 시 `server/_core/oauth.ts`, `lib/_core/api.ts`, `app/login.tsx` 동시 검증
