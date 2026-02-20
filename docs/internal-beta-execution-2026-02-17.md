# SolveMate 내부 베타 실행 로그 (2026-02-17)

## 완료된 항목

### 1) Day 0 기준선 검증

- `pnpm check` 통과
- `pnpm lint` 통과 (경고 10건, 에러 0건)
- `pnpm test` 통과 (`8 files, 41 tests`)
- `pnpm build` 통과

### 2) 정책 URL 준비 (앱 내 공개 경로 구현)

- `/privacy` 라우트 추가: `app/privacy.tsx`
- `/terms` 라우트 추가: `app/terms.tsx`
- 라우팅 등록: `app/_layout.tsx`
- 설정 화면 정책 링크 폴백:
  - 운영 URL이 미설정/placeholder일 때 앱 내부 경로로 이동
  - 변경 파일: `app/(tabs)/settings.tsx`
- 정책 문서 초안 확정본 추가:
  - `docs/legal/privacy-policy.md`
  - `docs/legal/terms-of-service.md`
- 웹 정적 빌드 확인:
  - `pnpm build:web` 실행 결과에 `/privacy`, `/terms` static route 포함 확인

### 3) 릴리즈 검증 스크립트 동작 확인

- `pnpm release:env -- --target api` (검증용 env 주입) 통과
- `pnpm release:env -- --target preview,production` (검증용 env 주입) 통과

## 수행했으나 외부 의존으로 보류된 항목

### 1) EAS 계정 연동

- `npx eas-cli --version` 성공 (`eas-cli/18.0.1`)
- `npx eas-cli whoami` 결과: `Not logged in`
- 영향: `eas init`, `eas build --profile preview ...` 단계 진행 불가

### 2) 실서비스 배포/게이트

- API Always-on 배포(Render/Fly/AWS) 미실행
- 실제 운영 도메인 미확정
- `pnpm release:gate -- --api ... --privacy ... --terms ...` 미실행

## 남은 필수 작업 (실도메인/실시크릿 필요)

1. 운영 도메인 확정
   - `https://<api-domain>`
   - `https://<app-domain>/privacy`
   - `https://<app-domain>/terms`
2. API 운영 환경변수 반영
   - `NODE_ENV=production`
   - `DATABASE_URL`
   - `JWT_SECRET` (신규 랜덤)
   - `ALLOWED_ORIGINS`
3. EAS 로그인 및 환경변수 반영
4. 최종 게이트 실행
   - `pnpm release:env -- --target api`
   - `pnpm release:env -- --target preview,production`
   - `pnpm smoke:api https://<api-domain>`
   - `pnpm release:gate -- --api https://<api-domain> --privacy https://<app-domain>/privacy --terms https://<app-domain>/terms`
