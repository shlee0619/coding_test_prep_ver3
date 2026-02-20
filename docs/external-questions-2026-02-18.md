# 외부 문의 질문 목록 (2026-02-18)

## 사용 방법

- 아래에서 해당 담당자(도메인/DNS, 웹 호스팅, API 호스팅, 모바일/EAS, 보안/인프라)에게 섹션별로 그대로 질문하세요.
- 답변을 받으면 마지막 섹션의 "회신 정리 템플릿"에 채워서 공유하세요.

## 1) 도메인/DNS 담당자에게 질문

1. `solvemate.dev`의 DNS 관리 권한을 가진 계정(플랫폼)은 어디인가요? (예: Cloudflare, Route53, 가비아)
2. `app.solvemate.dev` 레코드가 현재 존재하나요? 없다면 언제 생성 가능한가요?
3. `api.solvemate.dev` 레코드가 현재 존재하나요? 없다면 언제 생성 가능한가요?
4. 각 서브도메인에 어떤 타입으로 등록할 예정인가요? (`CNAME` 또는 `A`)
5. TTL 값은 얼마로 설정하나요?
6. 적용 후 `nslookup app.solvemate.dev`, `nslookup api.solvemate.dev`에서 조회 가능 예상 시각은 언제인가요?

## 2) 웹 호스팅(Vercel 등) 담당자에게 질문

1. 웹 프로젝트에 `app.solvemate.dev` 커스텀 도메인 연결이 완료되었나요?
2. 플랫폼이 요구하는 DNS 값(정확한 레코드 타입/값)은 무엇인가요?
3. `https://app.solvemate.dev/privacy`, `https://app.solvemate.dev/terms`가 비로그인 상태에서 `200` 응답이 나오나요?
4. HTTPS 인증서(자동 발급 포함) 상태가 정상인가요?

## 3) API 호스팅(Render/Fly/AWS 등) 담당자에게 질문

1. API 서비스에 `api.solvemate.dev` 커스텀 도메인 연결이 완료되었나요?
2. 플랫폼이 요구하는 DNS 값(정확한 레코드 타입/값)은 무엇인가요?
3. 현재 `https://api.solvemate.dev/api/health`가 `200`을 반환하나요?
4. 운영 환경변수 반영 상태를 확인해 주세요:
   - `NODE_ENV=production`
   - `DATABASE_URL` 설정됨
   - `JWT_SECRET` 신규값으로 반영됨
   - `ALLOWED_ORIGINS=https://app.solvemate.dev`
5. 최근 배포가 위 설정을 반영한 최신 배포인지(배포 시각/릴리즈 ID) 알려주세요.

## 4) 모바일/EAS 담당자에게 질문

1. 현재 EAS 로그인 주체 계정은 누구인가요?
2. `eas whoami` 결과를 공유해 주세요.
3. 이 저장소에서 `eas init` 실행 가능한 상태인가요?
4. EAS `preview`/`production`에 아래 변수가 설정됐나요?
   - `EXPO_PUBLIC_API_BASE_URL`
   - `EAS_PROJECT_ID`
   - `EXPO_PUBLIC_PRIVACY_POLICY_URL`
   - `EXPO_PUBLIC_TERMS_OF_SERVICE_URL`

## 5) 보안/인프라 담당자에게 질문

1. 오늘 생성한 신규 `JWT_SECRET`를 운영 Secret Store에 반영 가능한가요?
2. 반영 후 API 재배포까지 완료 가능한 예상 시각은 언제인가요?
3. 시크릿 교체 공지 발송 주체/채널은 어디인가요?

## 6) 답변 회신 템플릿 (복붙용)

```text
[외부 입력 회신 - 2026-02-18]
1) DNS
- app.solvemate.dev: (존재/미존재), 레코드 타입/값, 반영 시각
- api.solvemate.dev: (존재/미존재), 레코드 타입/값, 반영 시각

2) 웹
- 커스텀 도메인 연결: 완료/미완료
- /privacy: HTTP 상태코드
- /terms: HTTP 상태코드

3) API
- 커스텀 도메인 연결: 완료/미완료
- /api/health: HTTP 상태코드
- 운영 env 반영: NODE_ENV / DATABASE_URL / JWT_SECRET / ALLOWED_ORIGINS

4) EAS
- eas whoami:
- eas init 가능 여부:
- preview/production env 변수 반영 여부:

5) 차단 이슈/추가 요청
- ...
```

