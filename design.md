# SolveMate 모바일 앱 디자인 문서

## 앱 개요

BOJ(백준 온라인 저지) 사용자를 위한 학습 대시보드 앱으로, solved.ac API를 통해 풀이 데이터를 수집하고 분석하여 맞춤형 문제 추천과 학습 계획 관리를 제공합니다.

---

## 화면 구성 (Screen List)

### 1. 온보딩/인증 플로우
- **로그인 화면 (Login)**: Manus OAuth 로그인
- **BOJ Handle 연결 화면 (Connect)**: BOJ 핸들 입력 및 연결
- **초기 동기화 화면 (Initial Sync)**: 최초 데이터 동기화 진행 상태

### 2. 메인 탭 화면
- **대시보드 (Dashboard)**: 핵심 통계 요약 및 빠른 액션
- **분석 (Analytics)**: 태그별/난이도별 상세 분석
- **추천 (Recommendations)**: 맞춤 문제 추천 리스트
- **목표 (Goals)**: 학습 목표 설정 및 진행 추적
- **설정 (Settings)**: 계정 및 연동 관리

### 3. 상세 화면
- **문제 상세 (Problem Detail)**: 문제 정보 및 추천 이유
- **태그 상세 (Tag Detail)**: 특정 태그 분석 상세

---

## 화면별 상세 설계

### 1. 로그인 화면 (Login)
**레이아웃**: 세로 중앙 정렬
- 앱 로고 및 타이틀
- 앱 설명 텍스트 (1-2줄)
- "Manus로 로그인" 버튼 (Primary)
- 하단 이용약관/개인정보처리방침 링크

### 2. BOJ Handle 연결 화면 (Connect)
**레이아웃**: 상단 정렬, 폼 중심
- 헤더: "BOJ 계정 연결"
- 설명 텍스트: solved.ac 연동 안내
- 텍스트 입력: BOJ Handle
- "연결하기" 버튼 (Primary)
- 연결 상태 표시 (검증 중/성공/실패)

### 3. 대시보드 (Dashboard) - 메인 탭
**레이아웃**: 스크롤 가능한 카드 리스트
- **상단 헤더**
  - 사용자 이름 및 BOJ 핸들
  - 마지막 동기화 시간
  - 새로고침 버튼

- **KPI 카드 섹션** (2x2 그리드)
  - 총 해결 문제 수
  - 최근 7일 해결
  - 연속 풀이일 (스트릭)
  - 평균 난이도 (티어)

- **주간 풀이 추세 차트**
  - 최근 7일 일별 풀이 수 바 차트

- **약점 태그 Top 5 카드**
  - 태그명, 약점 점수, 시도/성공 비율
  - "추천 보기" 버튼

- **빠른 액션**
  - "오늘의 추천 문제" 카드 (1개)

### 4. 분석 (Analytics) - 메인 탭
**레이아웃**: 세그먼트 컨트롤 + 스크롤 콘텐츠
- **세그먼트 컨트롤**: 태그별 / 난이도별

- **태그별 분석 뷰**
  - 태그 리스트 (FlatList)
  - 각 항목: 태그명, 시도/성공 수, 성공률 바, 약점 배지
  - 탭하면 태그 상세로 이동

- **난이도별 분석 뷰**
  - 티어별 분포 차트 (Bronze~Ruby)
  - 각 티어 해결 문제 수 표시

### 5. 추천 (Recommendations) - 메인 탭
**레이아웃**: 필터 바 + FlatList
- **필터 바**
  - 난이도 범위 선택 (슬라이더 또는 드롭다운)
  - 태그 필터 (다중 선택)
  - "미해결만" 토글

- **추천 문제 리스트**
  - 문제 카드: 번호, 제목, 티어 아이콘, 태그들
  - 추천 이유 (1줄 요약)
  - 북마크 버튼, "풀었음" 체크 버튼

### 6. 목표 (Goals) - 메인 탭
**레이아웃**: 목표 카드 리스트 + FAB
- **활성 목표 섹션**
  - 목표 카드: 제목, 진행률 바, 기간
  - 예: "이번 주 20문제 풀기" (15/20, 75%)

- **완료된 목표 섹션** (접힘 가능)

- **FAB (Floating Action Button)**
  - "새 목표 추가"

### 7. 설정 (Settings) - 메인 탭
**레이아웃**: 섹션별 리스트
- **계정 섹션**
  - 프로필 정보 (이름, 이메일)
  - 로그아웃 버튼

- **연동 섹션**
  - BOJ Handle 정보
  - 연동 해제 버튼
  - 수동 동기화 버튼

- **앱 정보 섹션**
  - 버전 정보
  - 이용약관, 개인정보처리방침

### 8. 문제 상세 (Problem Detail)
**레이아웃**: 스크롤 가능한 상세 뷰
- **헤더**: 문제 번호, 제목, 티어 아이콘
- **태그 칩 리스트**
- **사용자 상태**: 미해결/해결/북마크
- **추천 이유 섹션**
  - 점수 구성 요약 (설명 가능한 형태)
  - 예: "그래프 태그 보완 필요 (+30점)"
- **액션 버튼들**
  - "BOJ에서 풀기" (외부 링크)
  - "풀었음" 체크
  - 북마크 토글
- **메모 입력 영역**

---

## 주요 사용자 플로우

### 플로우 1: 최초 설정
1. 앱 실행 → 로그인 화면
2. "Manus로 로그인" 탭 → OAuth 인증
3. BOJ Handle 연결 화면으로 이동
4. Handle 입력 → "연결하기" 탭
5. solved.ac 검증 → 초기 동기화 시작
6. 동기화 완료 → 대시보드로 이동

### 플로우 2: 일상 학습
1. 앱 실행 → 대시보드
2. KPI 확인 → 약점 태그 확인
3. "추천 보기" 탭 → 추천 탭으로 이동
4. 문제 선택 → 문제 상세
5. "BOJ에서 풀기" → 외부 브라우저
6. 문제 풀이 후 앱 복귀 → "풀었음" 체크

### 플로우 3: 데이터 동기화
1. 대시보드에서 새로고침 버튼 탭
2. 동기화 진행 상태 표시
3. 완료 시 데이터 갱신

### 플로우 4: 목표 설정
1. 목표 탭 → FAB 탭
2. 목표 유형 선택 (문제 수/태그 집중)
3. 기간 설정 (주간/월간)
4. 목표값 입력 → 저장
5. 대시보드에서 진행률 확인

---

## 컬러 팔레트

### Primary Colors
- **Primary**: `#0A7EA4` (Teal Blue) - 주요 액션, 강조
- **Primary Dark**: `#086B8C` - 눌림 상태

### Tier Colors (solved.ac 기준)
- **Bronze**: `#AD5600`
- **Silver**: `#435F7A`
- **Gold**: `#EC9A00`
- **Platinum**: `#27E2A4`
- **Diamond**: `#00B4FC`
- **Ruby**: `#FF0062`

### Semantic Colors
- **Success**: `#22C55E` - 해결됨, 목표 달성
- **Warning**: `#F59E0B` - 주의, 약점
- **Error**: `#EF4444` - 실패, 오류

### Neutral Colors
- **Background Light**: `#FFFFFF`
- **Background Dark**: `#151718`
- **Surface Light**: `#F5F5F5`
- **Surface Dark**: `#1E2022`
- **Foreground Light**: `#11181C`
- **Foreground Dark**: `#ECEDEE`
- **Muted Light**: `#687076`
- **Muted Dark**: `#9BA1A6`

---

## 타이포그래피

- **제목 (H1)**: 28px, Bold
- **섹션 제목 (H2)**: 20px, SemiBold
- **카드 제목 (H3)**: 16px, SemiBold
- **본문**: 14px, Regular
- **캡션**: 12px, Regular
- **KPI 숫자**: 32px, Bold

---

## 컴포넌트 스타일

### 카드
- 배경: `surface`
- 모서리: 12px radius
- 패딩: 16px
- 그림자: 미세한 elevation

### 버튼 (Primary)
- 배경: `primary`
- 텍스트: `background` (흰색)
- 모서리: 24px radius (pill shape)
- 높이: 48px

### 입력 필드
- 배경: `surface`
- 테두리: `border` 1px
- 모서리: 8px radius
- 높이: 48px

### 태그 칩
- 배경: `surface`
- 테두리: `border` 1px
- 모서리: 16px radius
- 패딩: 4px 12px

### 티어 배지
- 원형 또는 방패 모양
- 티어별 색상 적용
- 크기: 24px (소), 32px (중), 48px (대)

---

## 네비게이션 구조

```
Tab Navigator
├── 대시보드 (Dashboard) - house.fill
├── 분석 (Analytics) - chart.bar.fill
├── 추천 (Recommendations) - lightbulb.fill
├── 목표 (Goals) - target
└── 설정 (Settings) - gearshape.fill

Stack Navigator (각 탭 내부)
├── 문제 상세 (Problem Detail)
├── 태그 상세 (Tag Detail)
├── 목표 생성/수정
└── BOJ Handle 연결
```

---

## 데이터 모델 (프론트엔드)

### User
```typescript
interface User {
  id: number;
  name: string;
  email: string;
  bojHandle: string | null;
  lastSyncAt: Date | null;
}
```

### Problem
```typescript
interface Problem {
  id: number;
  title: string;
  level: number; // 0-30 (Unrated~Ruby I)
  tags: string[];
  status: 'unsolved' | 'solved' | 'attempted';
  isBookmarked: boolean;
  note: string | null;
}
```

### TagStats
```typescript
interface TagStats {
  tag: string;
  attempted: number;
  solved: number;
  weakScore: number;
  lastSolvedAt: Date | null;
}
```

### Recommendation
```typescript
interface Recommendation {
  problemId: number;
  problem: Problem;
  score: number;
  reasons: string[];
}
```

### Goal
```typescript
interface Goal {
  id: number;
  title: string;
  type: 'problem_count' | 'tag_focus';
  target: number;
  current: number;
  startDate: Date;
  endDate: Date;
  status: 'active' | 'completed' | 'failed';
}
```
