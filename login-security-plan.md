# 로그인/인증 보안 개선 계획

## 0. 문서 목적과 범위
- 목적: 로그인/인증 영역의 보안 문제를 식별하고 단계별 개선안을 제시
- 범위: 클라이언트 인증 로직과 서버 OAuth/토큰/쿠키/환경변수 등 보안 관련 모듈
- 비범위: 추천/문제/동기화 등 앱 기능, DB/마이그레이션, UI 전반 (별도 문서 필요)

> 이 문서는 프로젝트 전체 설명서가 아니라 로그인/인증 보안 개선에 한정된 계획 문서입니다.

## 0.1 관련 문서
- `/server/README.md` - 서버 모듈 참고 (프로젝트 전체 개요는 아님)
- `(TBD) /README.md` - 프로젝트 개요/실행 방법
- `(TBD) /ARCHITECTURE.md` - 전체 구조/도메인 설명

---

## 1. 현재 상태 분석 요약

### 보안 관련 주요 파일 구조
- **클라이언트**: `/app/login.tsx`, `/lib/_core/auth.ts`, `/hooks/use-auth.ts`, `/lib/_core/api.ts`
- **서버**: `/server/_core/oauth.ts`, `/server/_core/sdk.ts`, `/server/_core/cookies.ts`, `/server/_core/context.ts`, `/server/_core/env.ts`, `/server/_core/index.ts`

---

## 2. 발견된 문제점 및 우선순위

### Critical (즉시 수정 필요)

#### 2.1 JWT_SECRET 환경변수 필수 검증 부재 ✅ 완료
- **위치**: `/server/_core/env.ts`
- **문제**: `JWT_SECRET`이 설정되지 않으면 빈 문자열이 되어 모든 토큰이 위조 가능
- **해결**: 환경변수 필수 검증 및 애플리케이션 시작 시 예외 처리
- **적용 내용**:
  - `requireEnv()` 함수로 필수 환경변수 검증
  - `cookieSecret`을 getter로 변경하여 지연 평가
  - `validateRequiredEnvVars()` 함수 추가
  - 서버 시작 시 검증 실패하면 `process.exit(1)`

#### 2.2 CORS Origin 반영 취약점 ✅ 완료
- **위치**: `/server/_core/index.ts`
- **문제**: 모든 Origin을 무조건 반영하여 CSRF 공격에 취약
- **해결**: 화이트리스트 기반 Origin 검증
- **적용 내용**:
  - `ALLOWED_ORIGINS` 화이트리스트 배열 추가
  - `isAllowedOrigin()` 함수로 Origin 검증
  - 개발 환경에서는 localhost 자동 허용
  - 프로덕션에서는 `ALLOWED_ORIGINS` 환경변수로 추가 도메인 설정 가능
  - 허용되지 않은 Origin 요청 시 로깅 및 403 응답

---

### High (높은 우선순위)

#### 2.3 OAuth State 검증 부재 ✅ 완료
- **위치**: `/server/_core/oauth.ts`
- **문제**: Google OAuth 콜백에서 state 매개변수 검증이 없음
- **해결**: state 값을 세션에 저장 후 콜백에서 검증
- **적용 내용**:
  - `OAuthStateStore` 클래스 구현 (메모리 기반, 프로덕션에서는 Redis 권장)
  - `POST /api/oauth/state` 엔드포인트 추가 - state 생성
  - state에 nonce, provider, redirectUri, createdAt 포함
  - 10분 TTL + 일회용 (검증 후 삭제)
  - redirectUri 화이트리스트 검증 추가

#### 2.4 토큰 블랙리스트 메커니즘 없음 ✅ 완료
- **위치**: `/server/_core/sdk.ts`, `/server/_core/oauth.ts`
- **문제**: 로그아웃 시 쿠키만 삭제, 서버에서 토큰 무효화 없음
- **해결**: 토큰 블랙리스트 구현
- **적용 내용**:
  - `TokenBlacklist` 클래스 구현 (메모리 기반, 프로덕션에서는 Redis 권장)
  - JWT 토큰에 `jti` (JWT ID) 추가
  - `verifySession()`에서 블랙리스트 확인
  - `extractTokenInfo()` 메서드 추가
  - 로그아웃 시 토큰 jti를 블랙리스트에 등록
  - 주기적 만료 토큰 정리 (1시간마다)

---

### Medium (중간 우선순위)

#### 2.5 localStorage 보안 위험
- **위치**: `/lib/_core/auth.ts` (76-82줄)
- **문제**: 웹에서 localStorage 사용 - XSS 공격 시 사용자 정보 탈취 가능
- **해결**: 웹도 httpOnly 쿠키 기반 인증 사용

#### 2.6 리다이렉트 URI 검증 부족
- **위치**: `/server/_core/oauth.ts` (213-216줄)
- **문제**: 악의적인 redirectUri로 사용자를 피싱 사이트로 유도 가능
- **해결**: redirectUri 화이트리스트 검증

#### 2.7 토큰 정보 로깅
- **위치**: `/lib/_core/auth.ts`, `/lib/_core/api.ts`
- **문제**: 개발 로그에서 토큰 일부 노출
- **해결**: 프로덕션에서 토큰 관련 로깅 제거

---

### Low (낮은 우선순위)

#### 2.8 에러 메시지 노출
- **위치**: `/lib/_core/api.ts` (60-70줄)
- **문제**: 서버 에러 메시지가 클라이언트에 노출 가능
- **해결**: 공개용 에러 메시지만 반환

#### 2.9 테스트 비활성화
- **위치**: `/tests/auth.logout.test.ts`
- **문제**: 로그아웃 테스트가 `describe.skip`으로 비활성화
- **해결**: 테스트 활성화 및 수정

---

## 3. 구현 계획

### Phase 1: Critical 보안 수정

1. **JWT_SECRET 필수 검증**
   ```typescript
   // /server/_core/env.ts
   export const ENV = {
     cookieSecret: (() => {
       const secret = process.env.JWT_SECRET;
       if (!secret) {
         throw new Error('JWT_SECRET environment variable is required');
       }
       return secret;
     })(),
   };
   ```

2. **CORS 화이트리스트 적용**
   ```typescript
   // /server/_core/index.ts
   const ALLOWED_ORIGINS = [
     'http://localhost:8081',
     'https://yourdomain.com'
   ];
   const origin = req.headers.origin;
   if (origin && ALLOWED_ORIGINS.includes(origin)) {
     res.header('Access-Control-Allow-Origin', origin);
   }
   ```

### Phase 2: High 보안 수정

3. **OAuth State 검증 구현**
   - state 생성 시 랜덤 값 + 타임스탬프 포함
   - 세션/메모리에 저장
   - 콜백에서 검증 후 삭제

4. **토큰 블랙리스트 구현**
   - 로그아웃 시 토큰 ID를 블랙리스트에 추가
   - 토큰 검증 시 블랙리스트 확인

### Phase 3: Medium 보안 개선

5. **웹 인증 방식 개선**
   - localStorage 대신 httpOnly 쿠키 사용
   - 또는 암호화된 저장소 사용

6. **리다이렉트 URI 검증**
   - 허용된 도메인/경로 화이트리스트 구현

7. **프로덕션 로깅 정리**
   - 환경 변수로 로깅 레벨 제어
   - 민감 정보 마스킹

### Phase 4: 추가 개선

8. **에러 처리 표준화**
   - 공개용/내부용 에러 메시지 분리
   - 에러 코드 체계 도입

9. **테스트 코드 정상화**
   - 비활성화된 테스트 활성화
   - 누락된 테스트 케이스 추가

---

## 4. 현재 양호한 부분 (검증 필요)

> 아래 항목은 코드 기준 추정이며 실제 동작/설정 확인 후 갱신 필요

- JWT 토큰 사용 (HS256)
- httpOnly 쿠키 설정
- Secure 플래그 (HTTPS)
- 네이티브 앱에서 SecureStore 사용
- tRPC 기반 타입 안전한 API

---

## 5. 권장사항

| 우선순위 | 항목 | 예상 영향 |
|---------|------|----------|
| Critical | JWT_SECRET 필수화 | 토큰 위조 방지 |
| Critical | CORS 화이트리스트 | CSRF 공격 차단 |
| High | State 검증 | OAuth CSRF 차단 |
| High | 토큰 블랙리스트 | 세션 탈취 위험 감소 |
| Medium | localStorage 제거 | XSS 피해 최소화 |
| Medium | redirectUri 검증 | 피싱 공격 차단 |

---

## 6. 참고 파일 목록

- `/server/_core/env.ts` - 환경변수 설정
- `/server/_core/index.ts` - CORS 설정
- `/server/_core/oauth.ts` - OAuth 콜백 처리
- `/server/_core/sdk.ts` - 세션 토큰 관리
- `/server/_core/cookies.ts` - 쿠키 옵션
- `/lib/_core/auth.ts` - 클라이언트 인증
- `/lib/_core/api.ts` - API 호출
- `/hooks/use-auth.ts` - 인증 Hook
