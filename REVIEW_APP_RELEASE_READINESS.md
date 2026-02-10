# BOJ Helper 앱 출시 준비 상태 리뷰

**리뷰 일자**: 2026-02-02
**리뷰 대상**: BOJ Helper (코딩 테스트 준비 도우미 앱)
**프레임워크**: React Native (Expo 54) + Express.js Backend

---

## 종합 평가: 출시 전 수정 필요 사항 있음

전반적으로 앱의 기능 구현 완성도는 높으나, **보안, 법적 요건, 품질 보증** 측면에서 앱스토어 출시 전 반드시 해결해야 할 이슈들이 있습니다.

---

## 1. 출시 차단 이슈 (BLOCKERS) - 반드시 해결 필요

### 1.1 [CRITICAL] .env 파일이 Git에 커밋됨 - 보안 사고

**파일**: `.env`, `.gitignore`

`.gitignore`에 `.env`가 포함되어 있지 않아, 실제 데이터베이스 비밀번호와 JWT 시크릿이 Git 히스토리에 노출되어 있습니다.

```
DATABASE_URL=mysql://root:tkdgur619!@localhost:3306/boj_helper
JWT_SECRET=temporary_development_secret_key_12345
```

**필요 조치**:
- `.gitignore`에 `.env` 추가
- Git 히스토리에서 `.env` 제거 (`git filter-branch` 또는 `BFG Repo-Cleaner`)
- 데이터베이스 비밀번호 즉시 변경
- 프로덕션용 강력한 JWT 시크릿 생성 (`openssl rand -base64 64`)
- 시크릿 관리 도구 도입 (AWS Secrets Manager, GCP Secret Manager 등)

### 1.2 [CRITICAL] 개인정보 처리방침 / 이용약관 URL이 플레이스홀더

**파일**: `constants/const.ts:8-9`

```typescript
/** 앱스토어 심사용 - 실제 URL로 교체 필요 */
export const PRIVACY_POLICY_URL = "https://example.com/privacy";
export const TERMS_OF_SERVICE_URL = "https://example.com/terms";
```

Apple App Store와 Google Play Store 모두 유효한 개인정보 처리방침 URL을 필수로 요구합니다. `example.com`으로는 심사 거절됩니다.

**필요 조치**:
- 개인정보 처리방침 문서 작성 및 호스팅
- 이용약관 문서 작성 및 호스팅
- 실제 URL로 교체

### 1.3 [CRITICAL] JWT 시크릿이 취약함

현재 JWT 시크릿: `temporary_development_secret_key_12345`

이 시크릿은 추측 가능하며, 이를 악용하면 모든 사용자의 세션을 위조할 수 있습니다.

**필요 조치**:
- 최소 256비트 이상의 랜덤 시크릿 생성
- 환경 변수로만 관리, 코드에 절대 포함하지 않기

### 1.4 [CRITICAL] 테스트 코드 미구현

**파일**: `tests/auth.logout.test.ts:44`
```typescript
// TODO: Remove `.skip` below once you implement user authentication
```

테스트가 사실상 존재하지 않습니다. 프로덕션 출시 전 최소한 핵심 기능에 대한 테스트가 필요합니다.

**필요 조치**:
- 인증 플로우 통합 테스트
- 동기화 로직 단위 테스트
- 추천 엔진 단위 테스트
- API 엔드포인트 E2E 테스트

---

## 2. 주요 개선 필요 사항 (HIGH)

### 2.1 패키지명이 템플릿 기본값

**파일**: `package.json:2`
```json
"name": "app-template"
```

앱 고유 이름으로 변경해야 합니다 (예: `boj-helper`).

### 2.2 인메모리 세션 저장소

**파일**: `server/_core/sdk.ts`, `server/_core/oauth.ts`

토큰 블랙리스트와 OAuth 상태가 서버 메모리에만 저장됩니다.
- 서버 재시작 시 모든 로그아웃된 토큰이 다시 유효해짐
- 다중 서버 환경에서 동작 불가

**필요 조치**:
- Redis 등 외부 저장소로 마이그레이션
- 또는 JWT 만료 시간을 짧게 설정 + Refresh Token 패턴 도입

### 2.3 오프라인 지원 없음

현재 네트워크 연결이 없으면 앱이 정상 동작하지 않습니다. 코딩 테스트 준비 앱 특성상 이동 중 사용이 많을 수 있으므로:

**필요 조치**:
- 캐싱된 데이터로 오프라인 열람 지원
- 네트워크 상태 표시
- 오프라인 상태에서의 적절한 에러 메시지

### 2.4 CORS 프로덕션 설정 미완료

**파일**: `server/_core/index.ts`

현재 localhost 오리진만 허용되어 있고, 프로덕션 도메인은 환경 변수에 의존합니다.

### 2.5 OAuth 리다이렉트 URI 화이트리스트 미완성

**파일**: `server/_core/oauth.ts`

```typescript
const ALLOWED_REDIRECT_PATTERNS = [
  /^http:\/\/localhost:\d+/,
  /^https?:\/\/[a-z0-9-]+\.localhost:\d+/,
  // Production patterns 없음
];
```

---

## 3. 기능 완성도 평가

### 잘 구현된 부분 (Strengths)

| 영역 | 상태 | 설명 |
|------|------|------|
| 대시보드 | ✅ 완성 | 프로필, KPI 카드, 약점 태그, 빠른 액션 |
| 분석 | ✅ 완성 | 태그별 성공률, 약점 식별, 당겨서 새로고침 |
| AI 추천 | ✅ 완성 | 5가지 카테고리, 필터링, 일일 추천, 북마크 |
| 목표 관리 | ✅ 완성 | 2가지 목표 유형, 진행률 추적, CRUD |
| 설정 | ✅ 완성 | 계정 관리, 다크모드, 연동 해제 |
| 문제 상세 | ✅ 완성 | 메타데이터, 메모, 북마크, 상태 변경 |
| 인증 | ✅ 완성 | BOJ 로그인, OAuth, 개발 로그인 |
| 동기화 | ✅ 완성 | 진행률 모달, 자동 추천 생성 |
| 추천 엔진 | ✅ 완성 | 다요소 가중치 알고리즘 (5가지 요인) |
| 로딩 상태 | ✅ 완성 | 스켈레톤 UI, 스피너, 당겨서 새로고침 |
| 에러 처리 | ✅ 완성 | ErrorBoundary, 토스트, 인라인 에러 |
| 다크 모드 | ✅ 완성 | 시스템 연동 + 수동 전환 |
| 타입 안전성 | ✅ 완성 | tRPC + Zod 전체 스택 |

### 보완이 필요한 부분

| 영역 | 상태 | 설명 |
|------|------|------|
| 테스트 | ❌ 미구현 | 테스트 코드 거의 없음 |
| 국제화 (i18n) | ❌ 미구현 | 한국어만 지원, 하드코딩된 문자열 |
| 접근성 (a11y) | ⚠️ 부분적 | accessibilityLabel, accessibilityRole 미적용 |
| 오프라인 | ❌ 미구현 | 네트워크 필수 |
| 푸시 알림 | ⚠️ 인프라만 | expo-notifications 포함, 실제 구현 부분적 |
| 딥링크 | ⚠️ 기본만 | 커스텀 스킴 있으나 유니버설 링크 미설정 |
| 앱 아이콘 | ✅ 존재 | 기본 아이콘 존재, 브랜딩 확인 필요 |
| 스플래시 | ✅ 존재 | 기본 스플래시 존재 |

---

## 4. 앱스토어 심사 체크리스트

### Apple App Store

| 항목 | 상태 | 비고 |
|------|------|------|
| 개인정보 처리방침 URL | ❌ | example.com 플레이스홀더 |
| 앱 아이콘 (1024x1024) | ⚠️ 확인 필요 | assets/images/icon.png |
| 스크린샷 | ❌ 준비 필요 | |
| 앱 설명 | ❌ 준비 필요 | |
| 카테고리 선택 | ❌ 준비 필요 | Education 권장 |
| 나이 등급 | ❌ 준비 필요 | |
| EAS Build 설정 | ⚠️ 확인 필요 | eas.json 없음 |
| 서명 인증서 | ❌ 준비 필요 | |
| 네트워크 에러 처리 | ⚠️ | 오프라인 시 빈 화면 가능성 |

### Google Play Store

| 항목 | 상태 | 비고 |
|------|------|------|
| 개인정보 처리방침 URL | ❌ | example.com 플레이스홀더 |
| 적응형 아이콘 | ✅ | foreground/background/monochrome 있음 |
| 앱 서명 키 | ❌ 준비 필요 | |
| 타겟 API 레벨 | ⚠️ 확인 필요 | app.config.ts에서 확인 |
| 데이터 안전 섹션 | ❌ 준비 필요 | 수집 데이터 목록 |
| 콘텐츠 등급 | ❌ 준비 필요 | |

---

## 5. 코드 품질 평가

### 아키텍처: 4.5/5
- tRPC 풀스택 타입 안전성
- Expo Router 파일 기반 라우팅
- Drizzle ORM 타입 안전 DB
- 관심사 분리 잘 되어 있음
- React Query 서버 상태 관리

### UI/UX: 4/5
- 스켈레톤 로딩 잘 구현
- 토스트 알림 시스템
- 다크/라이트 모드
- 터치 피드백 (Haptics)
- 일관된 디자인 시스템

### 보안: 2/5
- .env 파일 Git 노출 (치명적)
- 약한 JWT 시크릿
- 인메모리 세션 저장소
- CORS/OAuth 프로덕션 설정 미완

### 테스트: 1/5
- 거의 없음

### 문서화: 3/5
- server/README.md 존재
- 코드 내 주석 적절
- 사용자 문서 없음

---

## 6. 출시 전 필수 액션 아이템 (우선순위 순)

### P0 - 즉시 (출시 차단)
1. `.gitignore`에 `.env` 추가 및 Git 히스토리 정리
2. DB 비밀번호, JWT 시크릿 변경
3. 개인정보 처리방침 / 이용약관 실제 URL 설정
4. 프로덕션 환경 변수 설정 (시크릿 관리)

### P1 - 출시 전 (1주 이내)
5. 핵심 기능 테스트 코드 작성
6. 패키지명 변경 (`app-template` → `boj-helper`)
7. EAS Build 설정 (`eas.json`)
8. CORS 프로덕션 오리진 설정
9. OAuth 리다이렉트 URI 화이트리스트 완성
10. 앱스토어 메타데이터 준비 (스크린샷, 설명, 카테고리)

### P2 - 출시 직후 (2주 이내)
11. Redis 세션 저장소 마이그레이션
12. 네트워크 에러 시 적절한 UX 제공
13. 접근성 (accessibilityLabel) 적용
14. 앱 성능 모니터링 도구 연동 (Sentry 등)

### P3 - 향후 개선
15. 오프라인 모드 지원
16. 푸시 알림 완성
17. 국제화 (i18n) 지원
18. 유니버설 링크 설정

---

## 결론

**기능 완성도는 높습니다.** 대시보드, 분석, AI 추천, 목표 관리 등 핵심 기능이 잘 구현되어 있고, UI/UX도 로딩 상태, 에러 처리, 다크모드 등 사용자 경험을 고려한 흔적이 보입니다.

그러나 **보안 이슈(P0)가 반드시 먼저 해결되어야** 합니다. 특히 `.env` 파일의 Git 노출은 프로덕션 환경에서 심각한 보안 사고로 이어질 수 있습니다. 개인정보 처리방침 URL도 앱스토어 심사 통과를 위해 필수입니다.

P0 항목 해결 후, P1 항목까지 완료하면 앱스토어 출시가 가능한 수준입니다.
