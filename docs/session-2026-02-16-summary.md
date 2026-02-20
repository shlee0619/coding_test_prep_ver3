# SolveMate 작업 통합 요약 (2026-02-16)

- 작성일: 2026-02-16
- 범위: 운영 보안/정책 마무리 + 백엔드 보완 + 릴리즈 검증 체계 정리
- 기준: 현재 워크트리(`git status` 기준 변경사항 포함)

---

## 1) 이번 작업 개요

이번 세션에서 아래 항목을 중심으로 보완했습니다.

1. 인증 우회 차단
- `INVALID_CREDENTIALS`인 경우 기존 사용자 예외 허용을 제거하고 실패 처리로 고정
- 일시적 인증 장애(`NETWORK_ERROR`, `CHALLENGE_REQUIRED`, `UNEXPECTED_RESPONSE`)는 `503`로 명확화

2. IDOR(소유권 검증) 보완
- `sync.status(jobId)` 조회를 사용자 스코프로 제한
- `goals.update/delete`를 사용자 소유 목표만 수정/삭제 가능하도록 강화

3. 정책 URL 빌드 가드
- `preview/production` 빌드에서 아래 env 누락 시 실패하도록 강제:
  - `EXPO_PUBLIC_PRIVACY_POLICY_URL`
  - `EXPO_PUBLIC_TERMS_OF_SERVICE_URL`

4. 운영 보안/정책 마감 자동화
- JWT 시크릿 생성, 운영 env 검증, 배포 게이트 검증 스크립트 추가
- 운영 런북/법률 템플릿/세션 무효화 공지 템플릿 추가

---

## 2) 파일 변경 요약

## 2.1 주요 수정 파일

1. `/Users/shlee/Desktop/coding_test_prep_ver3/server/_core/oauth.ts`
- 로그인 검증 실패 정책 정리(인증 우회 차단, 임시 장애 503 처리)

2. `/Users/shlee/Desktop/coding_test_prep_ver3/server/routers.ts`
- `sync.status` 사용자 소유 조회 적용
- `goals.update/delete` 소유권 검증 실패 시 `NOT_FOUND` 처리

3. `/Users/shlee/Desktop/coding_test_prep_ver3/server/db.ts`
- `getSyncJobForUser`, `updateGoalForUser`, `deleteGoalForUser` 추가

4. `/Users/shlee/Desktop/coding_test_prep_ver3/server/__tests__/auth-routes.test.ts`
- 인증 우회 제거 정책에 맞춰 회귀 테스트 수정

5. `/Users/shlee/Desktop/coding_test_prep_ver3/app.config.ts`
- release 빌드 필수 env에 정책 URL 2개 추가

6. `/Users/shlee/Desktop/coding_test_prep_ver3/constants/const.ts`
- 정책 URL을 `EXPO_PUBLIC_*` 기반으로 읽도록 변경(기본값 포함)

7. `/Users/shlee/Desktop/coding_test_prep_ver3/DEPLOY.md`
8. `/Users/shlee/Desktop/coding_test_prep_ver3/docs/internal-release-checklist.md`
9. `/Users/shlee/Desktop/coding_test_prep_ver3/.env.example`
10. `/Users/shlee/Desktop/coding_test_prep_ver3/package.json`
- 운영 마무리 절차/스크립트 기준으로 문서 및 설정 동기화

## 2.2 신규 파일

1. `/Users/shlee/Desktop/coding_test_prep_ver3/server/__tests__/ownership-guards.test.ts`
- 소유권 가드 테스트 신규 추가

2. `/Users/shlee/Desktop/coding_test_prep_ver3/scripts/generate-jwt-secret.mjs`
- JWT 시크릿 생성 도구

3. `/Users/shlee/Desktop/coding_test_prep_ver3/scripts/validate-release-env.mjs`
- 운영/API/EAS 릴리즈 env 정합성 검증 도구

4. `/Users/shlee/Desktop/coding_test_prep_ver3/scripts/release-gate.mjs`
- 정책 URL/API health/구 토큰 무효화 등 배포 게이트 검증 도구

5. `/Users/shlee/Desktop/coding_test_prep_ver3/docs/backend-hardening-report-2026-02-16.md`
6. `/Users/shlee/Desktop/coding_test_prep_ver3/docs/ops-security-policy-runbook.md`
7. `/Users/shlee/Desktop/coding_test_prep_ver3/docs/security-session-rotation-notice-template.md`
8. `/Users/shlee/Desktop/coding_test_prep_ver3/docs/legal/privacy-policy-template.md`
9. `/Users/shlee/Desktop/coding_test_prep_ver3/docs/legal/terms-of-service-template.md`
- 운영 보안/정책 실행을 위한 보고서, 런북, 공지/법률 템플릿

---

## 3) 검증 결과

실행/확인한 항목:

1. `pnpm check`: 통과
2. `pnpm test`: 통과 (`8 files, 41 tests`)
3. `pnpm build`: 통과
4. `pnpm lint`: 에러 0, 기존 경고 10건 유지
5. `pnpm release:env -- --target all`: 통과(샘플 운영 env 주입 기준)
6. `scripts/generate-jwt-secret.mjs`: 출력 정상(시크릿 생성 가능)

주의사항:

1. `pnpm test`는 환경에 따라 포트 바인딩 제한이 있어 권한 상승이 필요할 수 있음
2. lint 경고 10건은 기존 항목이며 이번 변경으로 인한 신규 lint error는 없음

---

## 4) 운영자가 직접 해야 할 작업

코드 반영 외에 아래는 반드시 운영자가 직접 수행해야 합니다.

1. 정책 문서 실배포
- 개인정보처리방침/이용약관 확정 후 운영 URL 게시
- 권장 URL:
  - `https://<app-domain>/privacy`
  - `https://<app-domain>/terms`

2. EAS 환경변수 반영
- `EXPO_PUBLIC_API_BASE_URL`
- `EAS_PROJECT_ID`
- `EXPO_PUBLIC_PRIVACY_POLICY_URL`
- `EXPO_PUBLIC_TERMS_OF_SERVICE_URL`

3. API 운영 환경 점검
- `NODE_ENV=production`
- `DATABASE_URL`
- `JWT_SECRET`(신규로 교체)
- `ALLOWED_ORIGINS`(운영 도메인만)
- `REDIS_URL`(권장)

4. JWT 시크릿 교체 및 재배포
- `pnpm security:jwt-secret`로 신규 시크릿 생성
- 배포 플랫폼 Secret Store 반영
- API 재배포
- 사용자 재로그인 안내 공지 배포

5. 실도메인 배포 게이트 검증
- `pnpm release:gate -- --api https://<api-domain> --privacy https://<app-domain>/privacy --terms https://<app-domain>/terms`
- 가능하면 `OLD_SESSION_TOKEN`으로 구 토큰 무효화까지 확인

---

## 5) Go / No-Go 체크

## Go 조건

1. 정책 URL 실제 배포 및 200 응답 확인
2. EAS/API 환경변수 반영 완료
3. `JWT_SECRET` 교체 후 API 재배포 완료
4. `release:env`, `release:gate`, `smoke:api` 통과
5. 재로그인 후 보호 API 정상 동작 확인

## No-Go 조건

1. 정책 URL 미배포 또는 플레이스홀더 URL 유지
2. 시크릿 교체 미완료
3. `release:gate` 또는 `/api/health` 실패
4. 구 토큰이 계속 유효한 상태로 남아있음

---

## 6) 공용 API/인터페이스 반영 항목

1. 시크릿 교체 후 기존 토큰 무효화
- 기존 토큰으로 `/api/auth/me` 및 보호된 tRPC 호출 시 인증 실패로 귀결

2. release 빌드 필수 env
- `EXPO_PUBLIC_PRIVACY_POLICY_URL`
- `EXPO_PUBLIC_TERMS_OF_SERVICE_URL`

3. 보안 반영 핵심 파일
- `/Users/shlee/Desktop/coding_test_prep_ver3/server/_core/oauth.ts`
- `/Users/shlee/Desktop/coding_test_prep_ver3/server/routers.ts`
- `/Users/shlee/Desktop/coding_test_prep_ver3/server/db.ts`

---

## 7) 참고 문서

1. `/Users/shlee/Desktop/coding_test_prep_ver3/REVIEW_APP_RELEASE_READINESS.md`
2. `/Users/shlee/Desktop/coding_test_prep_ver3/docs/backend-hardening-report-2026-02-16.md`
3. `/Users/shlee/Desktop/coding_test_prep_ver3/docs/ops-security-policy-runbook.md`
4. `/Users/shlee/Desktop/coding_test_prep_ver3/DEPLOY.md`
5. `/Users/shlee/Desktop/coding_test_prep_ver3/docs/internal-release-checklist.md`
