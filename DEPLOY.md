# SolveMate 배포 가이드

## 1) 배포 아키텍처 (권장)

- 웹(정적): Vercel (`dist` 산출물)
- API(상시 실행): Render/Fly/AWS 등 always-on 서버
- 모바일(iOS/Android): EAS Build (`preview` 내부배포, `production` 스토어용)

`/api`를 Vercel Serverless에 두지 않는 이유:
- 동기화(`runSync`)가 장시간 작업이라 서버리스 실행 시간 제한에 취약

## 2) 필수 환경변수

### API 서버 (production)

- `NODE_ENV=production`
- `DATABASE_URL` (필수)
- `JWT_SECRET` (필수)
- `ALLOWED_ORIGINS` (필수, 쉼표 구분)
- `REDIS_URL` (권장)

서버는 production에서 `DATABASE_URL`, `ALLOWED_ORIGINS`, `JWT_SECRET`가 없으면 시작하지 않습니다.

운영 환경 반영 전 검증(권장):

```bash
pnpm release:env -- --target api
```

### 앱 빌드 (EAS preview/production)

- `EXPO_PUBLIC_API_BASE_URL` (필수)
- `EAS_PROJECT_ID` (필수)
- `EXPO_PUBLIC_PRIVACY_POLICY_URL` (필수)
- `EXPO_PUBLIC_TERMS_OF_SERVICE_URL` (필수)

`preview`/`production` 빌드에서 위 값이 없으면 `app.config.ts`에서 빌드 실패하도록 강제합니다.

EAS 빌드 환경 검증(권장):

```bash
pnpm release:env -- --target preview,production
```

## 3) Always-on API 배포 (Render 예시)

루트에 `Dockerfile.backend`, `render.yaml`이 포함되어 있습니다.
서버 번들은 `pnpm build` 실행 시 `dist-server/`로 생성됩니다.

1. Render에 저장소 연결
2. Blueprint 또는 수동 Web Service 생성
3. 환경변수 설정
4. Health check 확인: `/api/health`

JWT 시크릿 교체(즉시 만료):

```bash
pnpm security:jwt-secret
# 출력된 값을 JWT_SECRET으로 교체 후 API 재배포
```

## 4) Vercel 웹 배포

`vercel.json`은 정적 export만 배포하도록 설정되어 있습니다.
`.vercelignore`에서 `api/**`를 제외하므로 API 함수는 배포되지 않습니다.

## 5) EAS 내부배포 (preview)

1. EAS 프로젝트 초기화(최초 1회)

```bash
eas init
```

2. EAS 환경변수/시크릿 설정 (preview 환경)

```bash
eas env:create --environment preview --name EXPO_PUBLIC_API_BASE_URL --value "https://api.your-domain.com"
eas env:create --environment preview --name EAS_PROJECT_ID --value "your-project-id"
eas env:create --environment preview --name EXPO_PUBLIC_PRIVACY_POLICY_URL --value "https://app.your-domain.com/privacy"
eas env:create --environment preview --name EXPO_PUBLIC_TERMS_OF_SERVICE_URL --value "https://app.your-domain.com/terms"
```

3. 내부배포 빌드

```bash
eas build --profile preview --platform ios
eas build --profile preview --platform android
```

## 6) 스토어 제출 (production submit)

`eas.json`의 submit 프로필은 환경 변수를 사용합니다.

### iOS (App Store Connect)

```bash
eas secret:create --name APPLE_ID --value "your-apple-id@example.com" --scope project
eas secret:create --name ASC_APP_ID --value "your-app-store-connect-app-id" --scope project
```

### Android (Google Play)

```bash
eas secret:create --name GOOGLE_SERVICE_ACCOUNT_KEY_PATH --value "./path/to/google-service-account.json" --scope project
```

제출:

```bash
eas submit --platform ios --latest
eas submit --platform android --latest
```

## 7) 릴리즈 체크리스트

- [ ] API 서버가 always-on 환경에서 `/api/health` 정상(200)
- [ ] `EXPO_PUBLIC_API_BASE_URL`가 preview/production에 각각 설정됨
- [ ] `EXPO_PUBLIC_PRIVACY_POLICY_URL`, `EXPO_PUBLIC_TERMS_OF_SERVICE_URL`이 실제 문서 URL
- [ ] `pnpm release:env -- --target api` 통과
- [ ] `pnpm release:env -- --target preview,production` 통과
- [ ] JWT 시크릿 교체 후 재로그인 강제 동작 확인
- [ ] `pnpm check && pnpm lint && pnpm test && pnpm build` 통과
- [ ] `pnpm release:gate -- --api https://<api-domain> --privacy https://<app-domain>/privacy --terms https://<app-domain>/terms` 통과
- [ ] EAS preview 빌드(TestFlight/Internal Test)에서 로그인 → 동기화 → 추천 조회 검증
