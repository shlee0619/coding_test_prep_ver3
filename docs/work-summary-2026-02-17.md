# 작업 요약 (2026-02-17)

## 목적

- 내부 베타 출시 계획 실행
- 정책 URL 블로커 완화
- 릴리즈 검증 파이프라인 실행 가능 상태 확보

## 이번에 처리한 작업

### 1) 정책 페이지 라우트 추가

- 앱 내부 정책 페이지 추가:
  - `app/privacy.tsx`
  - `app/terms.tsx`
- 라우트 등록:
  - `app/_layout.tsx`
  - `privacy`, `terms` 스택 스크린 추가

### 2) 설정 화면 정책 링크 폴백 처리

- 정책 URL이 미설정/placeholder(`example.com`, `boj-helper.app`)일 때
  외부 링크 대신 앱 내부 `/privacy`, `/terms`로 이동하도록 변경
- 변경 파일:
  - `app/(tabs)/settings.tsx`

### 3) 정책 문서 초안 확정본 작성

- `docs/legal/privacy-policy.md`
- `docs/legal/terms-of-service.md`
- 런북 경로 문구 업데이트:
  - `docs/ops-security-policy-runbook.md`

### 4) 실행 로그 문서화

- `docs/internal-beta-execution-2026-02-17.md` 추가

## 검증 결과

아래 명령 기준으로 통과 확인:

```bash
pnpm check
pnpm lint
pnpm test
pnpm build
```

- 타입체크: 통과
- 린트: 에러 0, 경고 10(기존 경고 유지)
- 테스트: 41/41 통과
- 서버 빌드: 통과

추가 검증:

```bash
EXPO_PUBLIC_API_BASE_URL=https://api.bojhelper.dev \
EAS_PROJECT_ID=11111111-1111-1111-1111-111111111111 \
EXPO_PUBLIC_PRIVACY_POLICY_URL=https://app.bojhelper.dev/privacy \
EXPO_PUBLIC_TERMS_OF_SERVICE_URL=https://app.bojhelper.dev/terms \
pnpm build:web
```

- `build:web` 통과
- 정적 라우트에 `/privacy`, `/terms` 포함 확인

```bash
NODE_ENV=production \
DATABASE_URL='mysql://user:password@db.internal:3306/boj_helper' \
JWT_SECRET='this-is-a-demo-secret-string-with-more-than-32-characters-12345' \
ALLOWED_ORIGINS='https://app.bojhelper.dev' \
pnpm release:env -- --target api
```

```bash
EXPO_PUBLIC_API_BASE_URL='https://api.bojhelper.dev' \
EAS_PROJECT_ID='11111111-1111-1111-1111-111111111111' \
EXPO_PUBLIC_PRIVACY_POLICY_URL='https://app.bojhelper.dev/privacy' \
EXPO_PUBLIC_TERMS_OF_SERVICE_URL='https://app.bojhelper.dev/terms' \
pnpm release:env -- --target preview,production
```

- 두 검증 모두 `OK` 확인

## 현재 남은 블로커 (외부 의존)

1. 실서비스 도메인 확정 및 실제 정책 URL 게시
2. API 운영 환경변수 반영(`NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`, `ALLOWED_ORIGINS`)
3. EAS 로그인 후 preview 빌드 진행
4. 실도메인 기준 `release:gate` 실행

## 참고

- EAS CLI 설치/실행은 확인됨(`eas-cli/18.0.1`)
- 현재 상태: `npx eas-cli whoami` 기준 로그인 미완료(`Not logged in`)
