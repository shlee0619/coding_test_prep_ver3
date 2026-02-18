# 운영 보안/정책 마무리 런북

## 목표

- 정책 URL 실반영
- `JWT_SECRET` 교체로 기존 세션 즉시 만료
- 배포 전 검증 자동화 스크립트 통과

## 1) 정책 URL 준비

1. `docs/legal/privacy-policy.md`, `docs/legal/terms-of-service.md`를 실제 정보로 확정
   - 초안 템플릿은 `docs/legal/privacy-policy-template.md`, `docs/legal/terms-of-service-template.md`
2. 운영 도메인에 게시:
   - `https://<app-domain>/privacy`
   - `https://<app-domain>/terms`
3. 확인:
   - HTTPS
   - 비로그인 접근 가능
   - HTTP 200

## 2) 환경변수 반영

### EAS (preview/production)

```bash
eas env:create --environment preview --name EXPO_PUBLIC_PRIVACY_POLICY_URL --value "https://<app-domain>/privacy"
eas env:create --environment preview --name EXPO_PUBLIC_TERMS_OF_SERVICE_URL --value "https://<app-domain>/terms"
eas env:create --environment production --name EXPO_PUBLIC_PRIVACY_POLICY_URL --value "https://<app-domain>/privacy"
eas env:create --environment production --name EXPO_PUBLIC_TERMS_OF_SERVICE_URL --value "https://<app-domain>/terms"
```

### API (production)

- `NODE_ENV=production`
- `DATABASE_URL`
- `JWT_SECRET` (신규 값)
- `ALLOWED_ORIGINS` (운영 도메인만)
- `REDIS_URL` (권장)

## 3) JWT 시크릿 교체

1. 신규 시크릿 생성:

```bash
pnpm security:jwt-secret
```

2. 배포 플랫폼 Secret Store에 `JWT_SECRET` 업데이트
3. API 재배포
4. `docs/security-session-rotation-notice-template.md` 기반 공지 발행

## 4) 검증

1. 환경 검증:

```bash
pnpm release:env -- --target api
pnpm release:env -- --target preview,production
```

2. 코드 품질/빌드:

```bash
pnpm check
pnpm lint
pnpm test
pnpm build
```

3. 운영 게이트:

```bash
pnpm release:gate -- --api https://<api-domain> --privacy https://<app-domain>/privacy --terms https://<app-domain>/terms
```

4. 구 토큰 무효화 검증(선택):

```bash
OLD_SESSION_TOKEN="<old-token>" pnpm release:gate -- --api https://<api-domain> --privacy https://<app-domain>/privacy --terms https://<app-domain>/terms
```

## 5) Go 조건

1. 정책 URL 정상 응답(200)
2. `release:env` 통과
3. `release:gate` 통과
4. 재로그인 후 보호 API 정상 동작
