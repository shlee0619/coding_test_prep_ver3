import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { getApiBaseUrl } from "@/constants/oauth";
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from "@/constants/const";
import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";

type LoginProviders = {
  boj: boolean;
  dev?: boolean;
};

export default function LoginScreen() {
  const router = useRouter();
  const colors = useColors();
  const { isAuthenticated, refresh } = useAuth();
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [providers, setProviders] = useState<LoginProviders>({ boj: true });

  // Fetch available providers from server
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const apiBase = getApiBaseUrl();
        const res = await fetch(`${apiBase}/api/auth/providers`);
        if (res.ok) {
          const data = await res.json();
          setProviders({ boj: data.boj ?? true, dev: data.dev });
        }
      } catch {
        // Use default
      }
    };
    fetchProviders();
  }, []);

  // Redirect if already authenticated
  if (isAuthenticated) {
    router.replace("/");
    return null;
  }

  const handleBojLogin = async () => {
    if (!handle.trim() || !password) {
      setError("아이디와 비밀번호를 입력해주세요.");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const result = await Api.bojLogin(handle.trim(), password);

      if (result.success && result.app_session_id) {
        // 세션 토큰 저장 (웹: sessionStorage, Native: SecureStore)
        await Auth.setSessionToken(result.app_session_id);
        if (Platform.OS === "web") {
          // Keep backend cookie in sync to avoid stale account cookie wins.
          await Api.establishSession(result.app_session_id);
        }
        if (result.user) {
          await Auth.setUserInfo({
            id: result.user.id,
            openId: result.user.openId,
            name: result.user.name,
            email: result.user.email,
            loginMethod: result.user.loginMethod,
            lastSignedIn: new Date(result.user.lastSignedIn || Date.now()),
          });
        }

        await refresh();
        router.replace("/");
      } else {
        const errMsg = result.error || "로그인에 실패했습니다.";
        const errCode = result.code ? ` [${result.code}]` : "";
        const detail = result.detail ? ` — ${result.detail}` : "";
        setError(`${errMsg}${errCode}${detail}`);
      }
    } catch (err) {
      console.error("BOJ login error:", err);
      const message =
        err instanceof Error && err.message
          ? err.message
          : "로그인 중 오류가 발생했습니다. [LOGIN_999]";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDevLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/auth/dev/login`, {
        method: "POST",
      });
      if (res.ok) {
        if (typeof window !== "undefined") {
          window.location.reload();
        } else {
          await refresh();
          router.replace("/");
        }
      }
    } catch (err) {
      console.error("Dev login error:", err);
      setError("개발 로그인에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 p-6 justify-center">
          {/* Logo and Title */}
          <View className="items-center mb-8">
            <View className="w-24 h-24 bg-primary rounded-3xl items-center justify-center mb-6">
              <Text className="text-5xl font-bold text-background">S</Text>
            </View>
            <Text className="text-3xl font-bold text-foreground mb-2">SolveMate</Text>
            <Text className="text-base text-muted text-center">
              백준 계정으로 solved.ac에 연결
            </Text>
          </View>

          {/* BOJ Login Form */}
          {providers.boj && (
            <View className="mb-6">
              <View className="mb-4">
                <Text className="text-sm font-medium text-foreground mb-2">백준 아이디</Text>
                <TextInput
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground text-base"
                  placeholder="BOJ 핸들 입력"
                  placeholderTextColor={colors.muted}
                  value={handle}
                  onChangeText={(text) => {
                    setHandle(text);
                    setError(null);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  accessibilityLabel="백준 아이디 입력"
                  accessibilityHint="백준 온라인 저지 아이디를 입력하세요"
                />
              </View>
              <View className="mb-4">
                <Text className="text-sm font-medium text-foreground mb-2">비밀번호</Text>
                <TextInput
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground text-base"
                  placeholder="비밀번호 입력"
                  placeholderTextColor={colors.muted}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setError(null);
                  }}
                  secureTextEntry
                  editable={!isLoading}
                  onSubmitEditing={handleBojLogin}
                />
              </View>
              {error && (
                <Text className="text-error text-sm mb-3">{error}</Text>
              )}
              <TouchableOpacity
                className="bg-primary rounded-full py-4 items-center"
                onPress={handleBojLogin}
                disabled={isLoading}
                style={{ opacity: isLoading ? 0.7 : 1 }}
                accessibilityLabel="로그인"
                accessibilityRole="button"
                accessibilityState={{ disabled: isLoading }}
              >
                {isLoading ? (
                  <View className="flex-row items-center gap-2">
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text className="text-background font-semibold">로그인 중...</Text>
                  </View>
                ) : (
                  <Text className="text-background font-semibold text-lg">로그인</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Info */}
          <View className="bg-surface rounded-xl p-4 mb-6 border border-border">
            <View className="flex-row items-start gap-3">
              <IconSymbol name="info.circle" size={20} color={colors.muted} />
              <View className="flex-1">
                <Text className="text-sm text-muted leading-relaxed">
                  백준 온라인 저지(acmicpc.net) 계정으로 로그인합니다. solved.ac에 BOJ 계정이
                  연결되어 있어야 합니다.{" "}
                  <Text
                    className="underline"
                    onPress={() => {
                      if (typeof window !== "undefined") {
                        window.open("https://www.acmicpc.net/setting/solved.ac", "_blank");
                      }
                    }}
                    accessibilityLabel="solved.ac 연결하기"
                    accessibilityRole="link"
                  >
                    solved.ac 연결하기
                  </Text>
                </Text>
              </View>
            </View>
          </View>

          {/* Dev Login */}
          {providers.dev && (
            <TouchableOpacity
              className="rounded-full py-3 items-center mb-2"
              style={{ backgroundColor: "#333333" }}
              onPress={handleDevLogin}
              disabled={isLoading}
              accessibilityLabel="개발자 로그인"
              accessibilityRole="button"
              accessibilityState={{ disabled: isLoading }}
            >
              <Text className="text-white font-semibold text-base">Dev Login</Text>
            </TouchableOpacity>
          )}

          {/* Footer */}
          <View className="mt-6 items-center">
            <Text className="text-xs text-muted text-center">
              로그인 시{" "}
              <Text
                className="text-xs text-tint underline"
                onPress={() => Linking.openURL(TERMS_OF_SERVICE_URL)}
                accessibilityLabel="이용약관"
                accessibilityRole="link"
              >
                이용약관
              </Text>
              {" 및 "}
              <Text
                className="text-xs text-tint underline"
                onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
                accessibilityLabel="개인정보처리방침"
                accessibilityRole="link"
              >
                개인정보처리방침
              </Text>
              에 동의합니다
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
