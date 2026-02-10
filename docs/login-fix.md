# Login Fix — BOJ Pre-flight 세션 누락으로 인한 허위 인증 실패 수정

## 1. 문서 목적
이 문서는 `BOJ Helper`에서 발생한 **"올바른 아이디/비밀번호임에도 인증 실패로 처리되는"** 버그의
원인 분석, 수정 내역, 테스트 보강을 기록한다.

- 기준 저장소: `/Users/shlee/Desktop/coding_test_prep_ver3`
- 관련 문서: `docs/login-hardening-history.md` (이전 로그인 강건성 개선 이력)
- 대상 범위: `BOJ 자격증명 검증`, `Pre-flight 세션`, `CSRF 토큰`, `HTTP 상태 코드 처리`

---

## 2. 증상

- 사용자가 정확한 BOJ 아이디와 비밀번호를 입력해도 `INVALID_CREDENTIALS` 오류 발생
- 동일한 자격증명으로 BOJ 사이트 직접 로그인은 정상 동작
- 간헐적이 아닌 **항상** 실패 (서버 IP/환경에 따라 재현율 차이 가능)

---

## 3. 근본 원인

### 3.1 세션 쿠키 없이 로그인 POST 전송

**기존 흐름:**
```
서버 → POST /signin (쿠키 없음, CSRF 없음) → BOJ
```

**BOJ의 실제 로그인 흐름:**
```
브라우저 → GET /login (세션 쿠키 발급 + CSRF 토큰 렌더링)
브라우저 → POST /signin (쿠키 + CSRF 포함) → BOJ
```

기존 `verifyBojCredentials()` 함수는 `/login` 페이지를 먼저 방문하지 않고
곧바로 `/signin`에 POST를 보냈다. BOJ 서버는 세션 쿠키가 없는 요청을
자격증명 불일치와 동일하게 `302 → /login?error=1`로 응답했기 때문에,
**올바른 비밀번호여도 항상 `INVALID_CREDENTIALS`로 분류**되었다.

### 3.2 HTTP 상태 코드 처리 범위 부족

기존 `validateStatus`가 `200`과 `302`만 허용했기 때문에:
- `403` (봇 차단/IP 차단) → catch로 빠져 `NETWORK_ERROR`로 분류
- `429` (요청 횟수 제한) → catch로 빠져 `NETWORK_ERROR`로 분류
- 타입에 정의된 `UNEXPECTED_RESPONSE`는 실제로 반환되지 않음

---

## 4. 수정 내역

### 4.1 Pre-flight GET 요청 추가 (`fetchLoginPageContext`)

- 파일: `/Users/shlee/Desktop/coding_test_prep_ver3/server/boj-auth.ts`
- 변경:
  - `fetchLoginPageContext()` 함수 추가
  - POST 이전에 `GET /login`을 호출하여 세션 쿠키 수집
  - HTML에서 CSRF 토큰 추출 (`cheerio` 사용, `boj-scraper.ts`와 동일 패턴)
  - 추출한 쿠키를 POST의 `Cookie` 헤더에 포함
  - CSRF 토큰이 있으면 form body에 `csrf_key` 필드 추가

```
[수정 후 흐름]
서버 → GET /login (세션 쿠키 + CSRF 수집)
서버 → POST /signin (쿠키 + CSRF 포함) → BOJ
```

#### Pre-flight 실패 시 동작
- Pre-flight GET이 실패해도 **기존 동작(쿠키 없이 POST)으로 폴백**
- `console.warn`으로 로그 기록 후 계속 진행
- 새 기능 추가로 인한 회귀 리스크 최소화

### 4.2 HTTP 상태 코드 처리 확장

- 파일: `/Users/shlee/Desktop/coding_test_prep_ver3/server/boj-auth.ts`
- 변경:
  - `validateStatus` 범위를 `status >= 200 && status < 500`으로 확장
  - `429` → `CHALLENGE_REQUIRED` (요청 횟수 제한)
  - `403` → `CHALLENGE_REQUIRED` (봇 차단/IP 차단)
  - 그 외 미처리 상태 → `UNEXPECTED_RESPONSE`

### 4.3 `UNEXPECTED_RESPONSE` 완화 모드 추가

- 파일: `/Users/shlee/Desktop/coding_test_prep_ver3/server/_core/oauth.ts`
- 변경:
  - `verificationSkipped` 조건에 `UNEXPECTED_RESPONSE` 추가
  - `INVALID_CREDENTIALS`만 로그인을 차단(401)
  - 나머지 실패 코드는 모두 경고와 함께 로그인 허용

```typescript
const verificationSkipped =
  !verifyResult.ok &&
  (verifyResult.code === "CHALLENGE_REQUIRED" ||
    verifyResult.code === "NETWORK_ERROR" ||
    verifyResult.code === "UNEXPECTED_RESPONSE");
```

---

## 5. 수정된 로그인 API 동작 요약

대상 엔드포인트: `POST /api/auth/boj/login`

### BOJ 검증 결과별 동작

| BOJ 응답 | 결과 코드 | 로그인 | 비고 |
|-----------|-----------|--------|------|
| 302 → `/login?error=1` | `INVALID_CREDENTIALS` | 차단 (401) | 아이디/비밀번호 불일치 |
| 302 → `/` 또는 다른 경로 | (성공) | 정상 진행 | 자격증명 확인 완료 |
| 200 | `CHALLENGE_REQUIRED` | 경고 + 허용 | 봇 차단/추가 검증 화면 |
| 403 | `CHALLENGE_REQUIRED` | 경고 + 허용 | IP/봇 차단 |
| 429 | `CHALLENGE_REQUIRED` | 경고 + 허용 | 요청 횟수 제한 |
| 기타 (3xx, 4xx) | `UNEXPECTED_RESPONSE` | 경고 + 허용 | 예상치 못한 응답 |
| 요청 실패 (5xx, 타임아웃 등) | `NETWORK_ERROR` | 경고 + 허용 | 통신 오류 |

---

## 6. 테스트 보강 내역

### 수정된 파일
- `/Users/shlee/Desktop/coding_test_prep_ver3/server/__tests__/boj-auth.test.ts`

### 변경 사항
- `mockPreflightSuccess()` 헬퍼 추가 (모든 테스트에서 `axios.get` 모킹)
- 기존 5개 테스트 업데이트 (pre-flight mock 적용)

### 추가된 테스트 케이스 (5건)

| 테스트 | 검증 내용 |
|--------|-----------|
| 429 rate limiting | 429 → `CHALLENGE_REQUIRED` 반환 |
| 403 forbidden | 403 → `CHALLENGE_REQUIRED` 반환 |
| unhandled status (301) | 미처리 상태 → `UNEXPECTED_RESPONSE` 반환 |
| pre-flight GET failure | GET 실패 시에도 POST 진행 + 정상 결과 |
| no CSRF token in page | CSRF 토큰 없는 페이지 → `csrf_key` 필드 미포함 |

### 테스트 실행 결과
```
✓ server/__tests__/boj-auth.test.ts    (10 tests) — PASS
✓ server/__tests__/auth-routes.test.ts ( 6 tests) — PASS
```

---

## 7. 수정 파일 목록

| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `server/boj-auth.ts` | 수정 | Pre-flight 추가, 쿠키/CSRF 전달, 상태 코드 확장 |
| `server/_core/oauth.ts` | 수정 | `UNEXPECTED_RESPONSE` 완화 모드 추가 |
| `server/__tests__/boj-auth.test.ts` | 수정 | Pre-flight mock 적용 + 테스트 5건 추가 |

---

## 8. 운영 참고사항

1. **성능 영향**: Pre-flight GET으로 인해 로그인 요청 시 ~200-500ms 지연 추가
2. **BOJ 정책 변경 대응**: BOJ가 로그인 폼 구조를 변경할 경우 CSRF 토큰 추출 패턴 확인 필요
   - 현재 `csrf_key`, `_token`, `meta[name="csrf-token"]` 세 가지 패턴 지원
3. **Pre-flight 실패 시**: 기존 동작으로 자동 폴백되므로 즉각적인 서비스 중단 없음
4. **모니터링**: 서버 로그에서 `[BOJ Auth] Pre-flight GET failed` 메시지 추적

---

## 9. 이전 이력과의 관계

`docs/login-hardening-history.md` 섹션 3.4에서 도입한 완화 모드(graceful degradation)를
기반으로 한 확장이다.

- **기존**: `CHALLENGE_REQUIRED`, `NETWORK_ERROR` → 완화 모드
- **이번 추가**: `UNEXPECTED_RESPONSE` → 완화 모드
- **핵심 원칙 유지**: `INVALID_CREDENTIALS`만 로그인 차단, 나머지는 경고와 함께 허용
