# BOJ Helper 배포 가이드

## 스토어 제출 (EAS Submit)

`eas.json`의 submit 프로필은 환경 변수를 사용합니다. 제출 전 아래 값을 설정하세요.

### iOS (App Store Connect)

1. **EAS 시크릿에 설정** (권장)

   ```bash
   eas secret:create --name APPLE_ID --value "your-apple-id@example.com" --scope project
   eas secret:create --name ASC_APP_ID --value "your-app-store-connect-app-id" --scope project
   ```

2. **로컬에서 제출할 때**  
   제출 전 터미널에서 환경 변수 설정 후 실행:

   ```bash
   set APPLE_ID=your-apple-id@example.com
   set ASC_APP_ID=1234567890
   eas submit --platform ios --latest
   ```

   (macOS/Linux: `export APPLE_ID=...` 사용)

### Android (Google Play)

1. [Google Play Console](https://play.google.com/console)에서 서비스 계정 키(JSON) 발급
2. 프로젝트 루트에 `google-service-account.json`으로 저장하거나, 다른 경로 사용 시:

   ```bash
   eas secret:create --name GOOGLE_SERVICE_ACCOUNT_KEY_PATH --value "./path/to/your-key.json" --scope project
   ```

3. 제출:

   ```bash
   eas submit --platform android --latest
   ```

### 제출 전 체크리스트

- [ ] `constants/const.ts`의 `PRIVACY_POLICY_URL`, `TERMS_OF_SERVICE_URL`을 실제 문서 URL로 교체
- [ ] iOS: Apple ID, App Store Connect 앱 ID 설정
- [ ] Android: 서비스 계정 키 파일 배치 및 경로 확인
- [ ] `eas submit --platform ios --latest` / `eas submit --platform android --latest` 로컬 테스트
