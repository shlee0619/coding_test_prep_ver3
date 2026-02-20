# 회고 및 출시 판단 보고서 (2026-02-18)

- 작성 시각: 2026-02-18 14:26:24 KST
- 업데이트: 2026-02-18 14:41:21 KST
- 기준 저장소: `/Users/shlee/Desktop/coding_test_prep_ver3`
- 목적: 백엔드/프론트/기타 스펙 회고 + 안드로이드 출시 가능 여부 판단 + 저비용 백엔드 연결안 제시

## 0) 현재 상태 스냅샷

### 실행 결과(현재 재검증)

- `pnpm check`: 통과
- `pnpm lint`: 통과(에러 0, 경고 10)
- `pnpm build`: 통과
- `pnpm test`: 통과(8 files, 48 tests)
- `pnpm release:env -- --target api`: 통과(로컬 `.env` 기준)
- `pnpm release:env -- --target preview,production`: 통과(로컬 `.env` 기준)
- `npx eas-cli whoami`: `Not logged in`
- `nslookup app.solvemate.dev`: `NXDOMAIN`
- `nslookup api.solvemate.dev`: `NXDOMAIN`
- `curl -I https://app.solvemate.dev/privacy`: host resolve 실패
- `curl -I https://api.solvemate.dev/api/health`: host resolve 실패

### 작업 트리 상태

- 인증/로그인 관련 변경 파일이 다수 수정된 상태 (`app/login.tsx`, `server/_core/oauth.ts` 등)
- 미추적 문서: `docs/external-questions-2026-02-18.md`

---

## 1) 백엔드 회고 보고서

## 잘 된 점

1. 운영 전제 배포 가드가 문서/스크립트로 정리되어 있음 (`DEPLOY.md`, `release:env`, `release:gate`)
2. `/api/auth/me`에서 깨진 세션 쿠키를 감지하면 즉시 정리하는 복구 로직이 있음 (`server/_core/oauth.ts:478`)
3. 타입/빌드 기준선(`check`, `build`)은 안정적으로 통과 중

## 핵심 이슈(심각도 순)

1. `P1 운영`: 실도메인 DNS 미연결
- 근거: `app.solvemate.dev`, `api.solvemate.dev` 모두 `NXDOMAIN`
- 영향: 정책 URL/헬스체크/게이트 검증 불가
- 판단: 출시 차단(Blocker)

2. `P1 운영`: 배포 플랫폼 실환경 반영 확인 대기
- 근거: 로컬 `.env` 기준 `release:env`는 통과했으나, Railway/Vercel/EAS 콘솔의 동일 키 반영 여부는 미확인
- 영향: 배포 시 값 불일치로 런타임 실패 가능
- 판단: 출시 차단(Blocker)

3. `해결`: 인증 우회 제거
- 근거: `server/_core/oauth.ts:232`에서 `verifyResult.ok === false`면 즉시 실패 응답 후 `return`, 세션 발급 경로 진입 금지
- 검증: `server/__tests__/auth-routes.test.ts`에 `CHALLENGE_REQUIRED/NETWORK_ERROR/UNEXPECTED_RESPONSE` 실패 시 세션 미발급 테스트 추가

4. `해결`: 로그아웃 테스트 불일치 수정
- 근거: `tests/auth.logout.test.ts`의 `maxAge: -1` 고정 기대 제거, 현재 `clearCookie` 동작과 일치하도록 보정
- 검증: `pnpm test` 전체 통과(48/48)

## 결론(백엔드)

- 인증/테스트 게이트는 회복됐고, 현재 백엔드 출시 차단 요소는 `도메인 DNS`와 `실배포 환경변수 반영 확인`으로 축소됨

---

## 2) 프론트엔드 회고 보고서

## 잘 된 점

1. 웹에서 Bearer 토큰을 우선 사용해 stale cookie 계정 혼선을 줄이는 방향으로 개선됨 (`lib/_core/api.ts:32`)
2. 로그인 성공 후 웹에서 `/api/auth/session` 호출로 백엔드 쿠키 동기화 수행 (`app/login.tsx:76`)
3. 로그인 오류 메시지에 코드/상세를 노출해 진단성이 좋아짐

## 남은 이슈

1. 인증 실패는 이제 세션 미발급으로 일관 처리되지만, 외부 BOJ 인증 자체의 불안정성(`CHALLENGE_REQUIRED`)은 UX 메시지 보완이 필요
2. lint 경고 10건(주로 hook dependency, unused 변수) 유지
3. 정책 URL 실도메인 미연결로 설정 링크 검증 미완료

## 결론(프론트)

- UX/흐름은 개선됐고, 남은 리스크는 외부 인증 변동성과 인프라 연결 상태임

---

## 3) 기타 스펙/출시 스펙 회고

## 현재 충족

1. `app.config.ts`에서 preview/production 빌드 시 필수 env 강제
2. `eas.json`에서 Android `preview`는 APK, `production`은 AAB 설정
3. 정책 문서 라우트(`/privacy`, `/terms`)는 코드상 존재

## 미충족(출시 차단)

1. EAS 로그인/프로젝트 연동 미완료 (`npx eas-cli whoami` = `Not logged in`)
2. 운영 도메인 DNS 미등록(NXDOMAIN)
3. API/앱 운영 env의 배포 플랫폼 실제 반영 확인 미완료(로컬 `.env` 게이트는 통과)
4. `release:gate` 실행 가능한 외부 조건 미충족

---

## 4) 안드로이드 출시 가능 여부 (Go/No-Go)

## 판정: `No-Go` (2026-02-18 14:41 KST 기준)

### No-Go 근거

1. 인프라 게이트 미충족: 도메인 DNS 미해결
2. 배포 실환경 검증 미충족: Railway/Vercel/EAS 실제 env 반영 확인 미완료
3. 최종 게이트 미실행: `smoke:api`, `release:gate` 미통과
4. 빌드 게이트 미충족: EAS 로그인/연동 미완료

### Go 전환 최소 조건

1. `[완료]` `server/_core/oauth.ts`에서 "검증 실패 시 로그인 허용" 분기 제거
2. `[완료]` `pnpm test` 전체 통과
3. `app.solvemate.dev`, `api.solvemate.dev` DNS 연결 + HTTPS 200 확인
4. `[완료/로컬]` `pnpm release:env -- --target api` 통과
5. `[완료/로컬]` `pnpm release:env -- --target preview,production` 통과
6. `pnpm smoke:api https://<api-domain>` 통과
7. `pnpm release:gate -- --api ... --privacy ... --terms ...` 통과
8. `npx eas-cli whoami` 로그인 확인 + Android preview 빌드 성공

---

## 5) 백엔드 서버 연결 권고(비용 최소화)

## 권고안 요약

- "완전 무료" 조합은 가용성/슬립/제한 때문에 출시 안정성이 낮음
- 현실적인 최소비용 권고는 **월 약 $5~$10 구간**에서 always-on API를 확보하는 방식

## 옵션 비교

1. 추천(출시 우선): Railway + (동일 프로젝트 내 API/DB 구성)
- 예상비용: 시작 약 `$5+/월` (사용량 기반)
- 장점: 설정 단순, 배포 속도 빠름, 도메인 연결 쉬움
- 단점: 사용량 증가 시 비용 상승

2. 최저비용(품질 타협): Render Free 웹서비스 + 외부 저가 DB
- 예상비용: API 무료 + DB 별도(예: Aiven Developer `$5/월`)
- 장점: 초기 현금 지출 최소
- 단점: Render Free는 비활성 시 슬립(지연 발생), 출시 품질 저하 가능

3. 서버리스 절감형(비추천 for 현재 구조): Cloud Run 무료 티어 중심
- 예상비용: 저트래픽은 무료 구간 가능
- 단점: 현재 앱은 장시간 동기화 성격이 있어 서버리스 제약과 충돌 가능

## 최종 제안

1. 지금 목적이 "안드로이드 출시"이면 무료 고집보다 **Railway 월 5달러대 시작**이 가장 현실적
2. 도메인/DNS는 Cloudflare Free로 관리하고, `app`/`api` CNAME 먼저 연결
3. DB는 현재 MySQL 스택 유지를 우선(스키마/코드 이관 비용 절감)

---

## 6) 지금 바로 할 일 (우선순위 90분)

1. 인프라 연결: DNS `app`, `api` 등록 후 `nslookup`/`curl -I` 확인
2. 배포 환경 반영: Railway/Vercel/EAS에 로컬 `.env`와 동일 키 등록
3. EAS 로그인 후 Android preview 빌드 1회 수행
4. `pnpm smoke:api https://<api-domain>` 실행
5. `pnpm release:gate -- --api ... --privacy ... --terms ...` 실행

---

## 참고 소스(가격/정책)

- Railway Pricing: <https://railway.com/pricing>
- Render Pricing: <https://render.com/pricing>
- Aiven MySQL Pricing: <https://aiven.io/pricing?product=mysql>
- Google Cloud Run Pricing: <https://cloud.google.com/run/pricing>
- EAS Billing & Plans: <https://docs.expo.dev/billing/introduction/>
- Google Play Console 등록 수수료(1회): <https://support.google.com/googleplay/android-developer/answer/6112435>
