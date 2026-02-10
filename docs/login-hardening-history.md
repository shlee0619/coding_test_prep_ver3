# Login Hardening History

## 1. 문서 목적
이 문서는 `BOJ Helper`에서 발생한 로그인/로그아웃 이슈에 대해,  
시도한 보완 작업과 최종 적용 상태를 추적하기 위한 기록 문서다.

- 기준 저장소: `/Users/shlee/Desktop/coding_test_prep_ver3`
- 대상 범위: `로그인`, `로그아웃`, `세션 쿠키`, `에러 표출`, `회귀 테스트`

---

## 2. 주요 증상 (실사용 보고)
1. 로그아웃 버튼을 눌러도 세션이 유지되는 것처럼 보임
2. 재로그인 시 `LOGIN_999` 에러로 원인 파악이 어려움
3. 로그아웃 이후 로그인 재시도 시 불안정하게 실패

---

## 3. 원인 가설과 보완 시도

### 3.1 쿠키 정책 이슈 (로그아웃 체감 실패)
- 관찰: 개발 환경(HTTP)에서 쿠키 옵션이 브라우저 정책과 충돌 가능
- 기존: `SameSite=None` 고정 + `secure`는 요청 조건 의존
- 문제점: 현대 브라우저에서 `SameSite=None`는 `Secure=true`가 사실상 강제됨

#### 조치
- 파일: `/Users/shlee/Desktop/coding_test_prep_ver3/server/_core/cookies.ts`
- 변경:
  - HTTPS: `sameSite: "none"`, `secure: true`
  - HTTP(local dev): `sameSite: "lax"`, `secure: false`

#### 기대 효과
- 로컬/개발 환경에서 쿠키 set/clear가 더 안정적으로 동작

---

### 3.2 로그아웃 UI 실행 경로 개선
- 관찰: 플랫폼별 confirm 동작이 다르고, 중복 클릭 시 혼선 가능

#### 조치
- 파일: `/Users/shlee/Desktop/coding_test_prep_ver3/app/(tabs)/settings.tsx`
- 변경:
  - 웹: `window.confirm` 경로로 명시 처리
  - 네이티브: `Alert` 유지
  - `isLoggingOut` 상태로 중복 실행 방지
  - 로그아웃 완료 후 `/login`으로 명시 이동

#### 기대 효과
- “버튼 눌렀는데 반응 없다” 체감 감소
- 로그아웃 UX 일관성 확보

---

### 3.3 `LOGIN_999` 과도 노출 문제
- 관찰: 클라이언트가 서버의 실제 에러를 숨기고 포괄 오류(`LOGIN_999`)로 덮어씀

#### 조치
- 파일: `/Users/shlee/Desktop/coding_test_prep_ver3/app/login.tsx`
- 변경:
  - `catch`에서 고정 문구 대신 `err.message`를 우선 노출

#### 기대 효과
- 실제 실패 원인(자격증명 실패/외부 연동 실패/서버 상태)을 화면에서 바로 확인 가능

---

### 3.4 BOJ/solved.ac 의존으로 인한 로그인 실패
- 초기 상태:
  - BOJ 자동 검증 + solved.ac 프로필 조회가 강하게 결합
  - 외부 상태 불안정 시 로그인 전체가 차단되기 쉬움

#### 1차 조치(중간 시도)
- 임시로 “기존 사용자 재로그인만” 허용하는 완화 로직 적용
- 한계:
  - 신규/프로필 불일치 상황에서 여전히 실패 여지 존재

#### 최종 조치
- 파일: `/Users/shlee/Desktop/coding_test_prep_ver3/server/_core/oauth.ts`
- 변경:
  1. `INVALID_CREDENTIALS`(비밀번호/아이디 불일치)만 명확히 차단(401 유지)
  2. `NETWORK_ERROR`, `CHALLENGE_REQUIRED`는 완화 모드로 로그인 진행
  3. solved.ac 프로필 조회 실패 시에도 로그인은 진행
  4. 프로필 동기화/연동 갱신은 “가능할 때만” 수행
  5. 성공 응답에 `warnings` 배열 추가 (완화 모드 진입 사유 전달)

#### 기대 효과
- 외부 서비스 순간 장애가 로그인 전체 실패로 이어지는 문제 완화
- 사용자 입장에서 “재로그인 자체는 가능”한 상태 확보

---

## 4. 현재 로그인 API 동작 요약
대상 엔드포인트: `POST /api/auth/boj/login`

### 성공
- `success: true`
- `app_session_id` 반환
- `user` 반환
- 필요 시 `warnings` 포함

### 실패
- 자격증명 불일치: `401`, `code: INVALID_CREDENTIALS`
- 입력 오류: `400`, `BOJ_LOGIN_001/002`
- DB 저장 실패: `500`, `DB_UNAVAILABLE`
- 예외 처리: `500`, `BOJ_LOGIN_999`

---

## 5. 테스트 보강 내역

### 추가/확장된 테스트 파일
1. `/Users/shlee/Desktop/coding_test_prep_ver3/server/__tests__/boj-auth.test.ts`
2. `/Users/shlee/Desktop/coding_test_prep_ver3/server/__tests__/auth-routes.test.ts`

### 주요 검증 시나리오
- BOJ 검증 성공/실패/네트워크 실패/챌린지 응답
- 로그인 입력 누락 처리
- invalid credentials 시 401
- solved.ac 프로필 미조회 시 로그인 지속 가능 여부
- 완화 모드 로그인 시 warnings 반환

---

## 6. 운영 시 참고 체크리스트
1. 서버 재시작 후 검증 (`pnpm dev:server` 또는 `pnpm dev`)
2. 브라우저 쿠키 상태 확인 (Domain/SameSite/Secure)
3. 로그인 실패 시 UI에 노출된 실제 메시지/코드 확인
4. 반복 실패 시 서버 로그에서 `[Auth] BOJ login failed` 추적

---

## 7. 현재 결론
- 로그인 강건성은 이전 대비 개선됨
- 외부 연동 장애를 “로그인 전체 차단”으로 전파하지 않도록 완화됨
- 다만 BOJ 로그인 자동화 검증 특성상, 원격 사이트 정책/방어 변경 시 추가 보정이 필요할 수 있음

