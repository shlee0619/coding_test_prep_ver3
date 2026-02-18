# 릴리즈 외부 입력 요청 패키지 (2026-02-18)

## 목적

- 오늘 미완료 항목을 외부 의존 입력으로 분리해 즉시 요청/추적

## 필수 입력값

1. 운영 API 도메인
   - 값: `https://<api-domain>`
   - 담당: 인프라/백엔드
2. 운영 앱 도메인
   - 값: `https://<app-domain>`
   - 담당: 인프라/프론트
3. 정책 URL
   - 값: `https://<app-domain>/privacy`, `https://<app-domain>/terms`
   - 담당: 웹/콘텐츠
4. API 운영 시크릿/환경변수 반영 확인
   - `NODE_ENV=production`
   - `DATABASE_URL`
   - `JWT_SECRET` (신규 생성값)
   - `ALLOWED_ORIGINS=https://<app-domain>`
   - 담당: 백엔드/인프라
5. EAS 계정/프로젝트 연동
   - Expo 로그인 계정
   - EAS 프로젝트 링크 상태(`eas init`)
   - 담당: 모바일

## 전달할 명령어 패키지

### A) API 환경 검증

```bash
pnpm release:env -- --target api
```

### B) EAS preview/production 환경 검증

```bash
pnpm release:env -- --target preview,production
```

### C) API 스모크

```bash
pnpm smoke:api https://<api-domain>
```

### D) 최종 게이트

```bash
pnpm release:gate -- --api https://<api-domain> --privacy https://<app-domain>/privacy --terms https://<app-domain>/terms
```

## 요청 메시지 템플릿

```text
[릴리즈 입력 요청 - 2026-02-18]
1) 운영 도메인 확정값:
- API: https://<api-domain>
- APP: https://<app-domain>

2) 정책 URL 게시 확인:
- https://<app-domain>/privacy
- https://<app-domain>/terms

3) API 운영 env 반영 확인:
- NODE_ENV=production
- DATABASE_URL
- JWT_SECRET(신규)
- ALLOWED_ORIGINS=https://<app-domain>

4) EAS 로그인/프로젝트 연동 상태 공유:
- eas whoami
- eas init 가능 여부

확인 즉시 아래 게이트를 실행합니다:
- pnpm smoke:api https://<api-domain>
- pnpm release:gate -- --api https://<api-domain> --privacy https://<app-domain>/privacy --terms https://<app-domain>/terms
```

## 현재 차단 근거

- `app.bojhelper.dev`, `api.bojhelper.dev` DNS resolve 실패(`ENOTFOUND`)
- `nslookup app.bojhelper.dev` 결과: `NXDOMAIN` (2026-02-18 13:28:59 KST)
- `nslookup api.bojhelper.dev` 결과: `NXDOMAIN` (2026-02-18 13:29:00 KST)
- `npx eas-cli whoami` 기준 로그인 미완료
