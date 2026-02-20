# DNS NXDOMAIN 해결 런북 (2026-02-18)

## 현재 진단 (2026-02-18 14:44 KST)

- `nslookup solvemate.dev 8.8.8.8` -> `NXDOMAIN`
- `nslookup app.solvemate.dev 8.8.8.8` -> `NXDOMAIN`
- `nslookup api.solvemate.dev 8.8.8.8` -> `NXDOMAIN`

결론: `solvemate.dev` 루트 도메인 자체가 전역 DNS에 존재하지 않아, 서브도메인 레코드 추가 전에 **도메인 등록/네임서버 위임**부터 필요합니다.

---

## 1) 도메인 등록/위임

1. 도메인 등록기관(가비아/Namecheap/Cloudflare Registrar 등)에서 `solvemate.dev` 등록 여부 확인
2. 미등록이면 즉시 구매
3. DNS를 Cloudflare로 운영할 경우:
   - Cloudflare에 `solvemate.dev` Zone 생성
   - 등록기관 Nameserver를 Cloudflare가 준 2개 NS로 변경
4. 위임 반영 확인:

```bash
nslookup -type=NS solvemate.dev 8.8.8.8
nslookup -type=NS solvemate.dev 1.1.1.1
```

---

## 2) 플랫폼에서 커스텀 도메인 먼저 연결

DNS 넣기 전에 플랫폼에서 도메인 연결을 먼저 생성해야 인증서 발급이 빠릅니다.

1. Vercel 프로젝트: `app.solvemate.dev` 추가
2. Render API 서비스: `api.solvemate.dev` 추가

Render 서비스명 기준 기본 도메인 후보:
- `solvemate-api.onrender.com`

주의: 최종 DNS 값은 각 플랫폼 콘솔에 표시된 값을 우선 사용합니다.

---

## 3) DNS 레코드 추가 (Cloudflare 예시)

TTL: `Auto` 또는 `300`

1. `app` 레코드
- Type: `CNAME`
- Name: `app`
- Target: `cname.vercel-dns.com` (또는 Vercel 콘솔 지시값)
- Proxy: DNS only(회색 구름) 권장

2. `api` 레코드
- Type: `CNAME`
- Name: `api`
- Target: `solvemate-api.onrender.com` (또는 Render 콘솔 지시값)
- Proxy: DNS only(회색 구름) 권장

---

## 4) 목표 검증 명령

아래 4개가 모두 성공하면 NXDOMAIN 해소 완료입니다.

```bash
nslookup app.solvemate.dev 8.8.8.8
nslookup api.solvemate.dev 8.8.8.8
curl -I --max-time 15 https://app.solvemate.dev/privacy
curl -I --max-time 15 https://api.solvemate.dev/api/health
```

성공 기준:

1. `nslookup`이 `NXDOMAIN`이 아니고 IP 또는 CNAME을 반환
2. `https://app.solvemate.dev/privacy` 응답 코드 `200`
3. `https://api.solvemate.dev/api/health` 응답 코드 `200`

---

## 5) DNS 해결 후 즉시 후속 실행

```bash
pnpm smoke:api https://api.solvemate.dev
pnpm release:gate -- --api https://api.solvemate.dev --privacy https://app.solvemate.dev/privacy --terms https://app.solvemate.dev/terms
```

