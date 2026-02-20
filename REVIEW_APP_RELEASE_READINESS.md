# SolveMate 앱 출시 재점검 보고서

- 작성일: 2026-02-16
- 대상 저장소: `/Users/shlee/Desktop/coding_test_prep_ver3`
- 범위: 보완계획 구현 + 출시 준비 상태 재검증

---

## 1) 결론

### 현재 판단: **조건부 No-Go**

코드 레벨 보완사항(인증 우회, IDOR, 정책 URL 빌드 가드)은 반영 완료되었습니다.  
다만 **실제 운영 정책 문서 URL 배포/연결** 및 **운영 시크릿 교체**가 남아 있으므로, 이 두 항목이 완료되기 전까지는 공개 출시를 권장하지 않습니다.

---

## 2) 이번 보완 구현 내역

### 2.1 인증 우회 차단 (완료)

- 수정 파일: `server/_core/oauth.ts`
- 변경 내용:
  - `INVALID_CREDENTIALS`인데 기존 계정이 있으면 로그인 허용하던 경로 제거
  - `INVALID_CREDENTIALS`는 항상 `401` 반환
  - `NETWORK_ERROR` / `CHALLENGE_REQUIRED` / `UNEXPECTED_RESPONSE`는 `503` 반환 및 재시도 메시지 반환

### 2.2 리소스 소유권 검증(IDOR) 보완 (완료)

- 수정 파일: `server/db.ts`, `server/routers.ts`
- 변경 내용:
  - `sync.status({ jobId })`가 사용자 소유 작업만 조회하도록 `getSyncJobForUser(jobId, userId)` 추가/적용
  - `goals.update`, `goals.delete`가 사용자 소유 목표만 수정/삭제하도록
    - `updateGoalForUser(userId, goalId, data)`
    - `deleteGoalForUser(userId, goalId)`
    적용
  - 비소유 자원 접근 시 `NOT_FOUND` 반환

### 2.3 정책 URL 운영 가드 추가 (완료)

- 수정 파일: `constants/const.ts`, `app.config.ts`, `.env.example`, `DEPLOY.md`, `docs/internal-release-checklist.md`
- 변경 내용:
  - `EXPO_PUBLIC_PRIVACY_POLICY_URL`, `EXPO_PUBLIC_TERMS_OF_SERVICE_URL` 환경변수 지원
  - `preview`/`production` 빌드에서 위 URL 누락 시 빌드 실패하도록 강제
  - 배포/체크리스트 문서 동기화

### 2.4 테스트 보강 (완료)

- 수정 파일: `server/__tests__/auth-routes.test.ts`
  - `INVALID_CREDENTIALS` 기존 사용자 재로그인 허용 케이스를 실패(`401`) 기대로 변경
  - 임시 인증 장애(`NETWORK_ERROR`) 시 실패(`503`) 기대로 변경
- 신규 파일: `server/__tests__/ownership-guards.test.ts`
  - `sync.status(jobId)` 사용자 스코프 검증
  - `goals.update/delete` 비소유 자원 차단 검증

---

## 3) 검증 실행 결과

실행 명령:

1. `pnpm check`
2. `pnpm lint`
3. `pnpm test`
4. `pnpm build`
5. `EXPO_PUBLIC_API_BASE_URL=... EAS_PROJECT_ID=... EXPO_PUBLIC_PRIVACY_POLICY_URL=... EXPO_PUBLIC_TERMS_OF_SERVICE_URL=... pnpm build:web`

결과:

- `pnpm check`: 통과
- `pnpm lint`: 통과 (경고 10건, 에러 0건)
- `pnpm test`: 통과 (`8 files, 41 tests passed`)
- `pnpm build`: 통과
- `pnpm build:web`: 통과

참고:

- `pnpm test`는 환경상 포트 바인딩 제한 때문에 권한 상승 실행으로 검증함
- `expo export` 종료 시 `"Something prevented Expo from exiting"` 로그가 있으나 산출물(`dist`) 생성 및 종료 코드는 성공

---

## 4) 남은 출시 필수 항목 (코드 외)

### 4.1 앱 고유 정책 문서 실제 배포 및 URL 연결

- 해야 할 일:
  - 개인정보처리방침 페이지 배포
  - 이용약관 페이지 배포
  - EAS `preview`/`production` 환경에 아래 값 설정
    - `EXPO_PUBLIC_PRIVACY_POLICY_URL`
    - `EXPO_PUBLIC_TERMS_OF_SERVICE_URL`

### 4.2 운영 시크릿 교체

- 해야 할 일:
  - `JWT_SECRET` 운영용 랜덤 시크릿으로 교체
  - 기존 세션 무효화(시크릿 교체 효과)

---

## 5) 권장 후속 개선 (출시 차단 아님)

1. `REDIS_URL` 운영 연결로 토큰 블랙리스트를 프로세스 메모리 의존에서 분리
2. 린트 경고 10건 정리(미사용 변수, Hook dependency)
3. QA 리허설: 로그인 → 동기화 → 추천/분석 → 로그아웃, 오프라인 복구 UX 점검

---

## 6) 최종 판단 기준

아래 2개가 완료되면 공개 출시 `Go`로 전환 가능:

1. 앱 고유 정책 URL 실제 배포 및 환경변수 반영 완료
2. 운영 `JWT_SECRET` 교체 완료
