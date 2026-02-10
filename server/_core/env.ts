// 필수 환경변수 검증 함수
function requireEnv(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(`[ENV] Required environment variable ${name} is not set`);
  }
  return value;
}

// 선택적 환경변수 (기본값 허용)
function optionalEnv(value: string | undefined, defaultValue: string = ""): string {
  return value ?? defaultValue;
}

// cookieSecret은 지연 평가로 처리 (서버 시작 시점에 검증)
let _cookieSecret: string | null = null;

export const ENV = {
  get cookieSecret(): string {
    if (_cookieSecret === null) {
      _cookieSecret = requireEnv("JWT_SECRET", process.env.JWT_SECRET);
    }
    return _cookieSecret;
  },
  databaseUrl: optionalEnv(process.env.DATABASE_URL),
  // Optional: OWNER_OPEN_ID와 일치하는 사용자를 admin으로 승격
  ownerOpenId: optionalEnv(process.env.OWNER_OPEN_ID),
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: optionalEnv(process.env.BUILT_IN_FORGE_API_URL),
  forgeApiKey: optionalEnv(process.env.BUILT_IN_FORGE_API_KEY),
  // Redis (optional - falls back to in-memory when not set)
  redisUrl: optionalEnv(process.env.REDIS_URL),
};

// 서버 시작 시 필수 환경변수 검증
export function validateRequiredEnvVars(): void {
  // cookieSecret getter를 호출하여 JWT_SECRET 검증
  const _ = ENV.cookieSecret;
  console.log("[ENV] Required environment variables validated");
}
