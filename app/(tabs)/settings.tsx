import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
  Linking,
  Platform,
} from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from "@/constants/const";

import { ScreenContainer } from "@/components/screen-container";
import { TierBadge } from "@/components/tier-badge";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { useThemeContext } from "@/lib/theme-provider";
import { trpc } from "@/lib/trpc";
import { getTierName } from "@/shared/types";

export default function SettingsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { colorScheme, setColorScheme } = useThemeContext();
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isDarkMode = colorScheme === "dark";

  const { data: linkedAccount, isLoading, refetch } = trpc.link.get.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const disconnectMutation = trpc.link.disconnect.useMutation({
    onSuccess: () => refetch(),
  });

  const openPolicy = async (url: string, fallbackPath: "/privacy" | "/terms") => {
    const normalized = url.trim().toLowerCase();
    const isPlaceholderUrl =
      normalized.length === 0 ||
      normalized.includes("solvemate.app") ||
      normalized.includes("example.com");

    if (isPlaceholderUrl) {
      router.push(fallbackPath as never);
      return;
    }

    try {
      await Linking.openURL(url);
    } catch (error) {
      console.warn("[Settings] policy link open failed:", error);
      router.push(fallbackPath as never);
    }
  };

  const runLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace("/login");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleLogout = async () => {
    if (Platform.OS === "web") {
      const confirmed =
        typeof window !== "undefined" ? window.confirm("정말 로그아웃 하시겠습니까?") : true;
      if (!confirmed) return;
      await runLogout();
      return;
    }

    Alert.alert("로그아웃", "정말 로그아웃 하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "로그아웃",
        style: "destructive",
        onPress: () => {
          runLogout().catch((err) => {
            console.error("[Settings] logout failed:", err);
          });
        },
      },
    ]);
  };

  const handleDisconnect = async () => {
    Alert.alert(
      "계정 연결 해제",
      "BOJ 계정 연결을 해제하시겠습니까? 동기화된 데이터는 유지됩니다.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "연결 해제",
          style: "destructive",
          onPress: async () => {
            await disconnectMutation.mutateAsync();
          },
        },
      ]
    );
  };

  if (!authLoading && !isAuthenticated) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center gap-4">
          <Text className="text-lg text-muted">로그인이 필요합니다</Text>
          <TouchableOpacity
            className="bg-primary px-6 py-3 rounded-full"
            onPress={() => router.push("/login")}
            accessibilityLabel="로그인"
            accessibilityRole="button"
          >
            <Text className="text-background font-semibold">로그인</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-foreground">설정</Text>
        </View>

        {/* User Profile Section */}
        <View className="bg-surface rounded-xl border border-border mb-6 overflow-hidden">
          <View className="p-4 border-b border-border">
            <Text className="text-sm font-medium text-muted mb-3">계정</Text>
            <View className="flex-row items-center gap-3">
              <View className="w-12 h-12 bg-primary rounded-full items-center justify-center">
                <Text className="text-xl font-bold text-background">
                  {user?.name?.[0]?.toUpperCase() || "U"}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-base font-medium text-foreground">
                  {user?.name || "사용자"}
                </Text>
                <Text className="text-sm text-muted">{user?.email || ""}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            className="p-4 flex-row items-center justify-between"
            onPress={handleLogout}
            disabled={isLoggingOut}
            accessibilityLabel="로그아웃"
            accessibilityRole="button"
            accessibilityState={{ disabled: isLoggingOut }}
          >
            <Text className="text-base text-error">로그아웃</Text>
            {isLoggingOut ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <IconSymbol name="chevron.right" size={20} color={colors.error} />
            )}
          </TouchableOpacity>
        </View>

        {/* BOJ Account Section */}
        <View className="bg-surface rounded-xl border border-border mb-6 overflow-hidden">
          <View className="p-4 border-b border-border">
            <Text className="text-sm font-medium text-muted mb-3">BOJ 계정</Text>
            
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.tint} />
            ) : linkedAccount ? (
              <View>
                <View className="flex-row items-center gap-3 mb-3">
                  <TierBadge tier={linkedAccount.tier || 0} size="medium" />
                  <View className="flex-1">
                    <Text className="text-base font-medium text-foreground">
                      {linkedAccount.handle}
                    </Text>
                    <Text className="text-sm text-muted">
                      {getTierName(linkedAccount.tier || 0)} · {linkedAccount.solvedCount || 0}문제 해결
                    </Text>
                  </View>
                </View>
                
                <View className="flex-row gap-4">
                  <View className="flex-1">
                    <Text className="text-sm text-muted">Rating</Text>
                    <Text className="text-lg font-semibold text-foreground">
                      {linkedAccount.rating?.toLocaleString() || 0}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm text-muted">해결한 문제</Text>
                    <Text className="text-lg font-semibold text-foreground">
                      {linkedAccount.solvedCount || 0}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View className="items-center py-4">
                <Text className="text-muted mb-3">연결된 BOJ 계정이 없습니다</Text>
                <TouchableOpacity
                  className="bg-primary px-4 py-2 rounded-full"
                  onPress={() => router.push("/connect")}
                  accessibilityLabel="BOJ 계정 연결하기"
                  accessibilityRole="button"
                >
                  <Text className="text-background font-medium">계정 연결하기</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {linkedAccount && (
            <>
              <TouchableOpacity
                className="p-4 flex-row items-center justify-between border-b border-border"
                onPress={() => router.push("/connect")}
                accessibilityLabel="다른 BOJ 계정 연결"
                accessibilityRole="button"
              >
                <Text className="text-base text-foreground">다른 계정 연결</Text>
                <IconSymbol name="chevron.right" size={20} color={colors.muted} />
              </TouchableOpacity>
              
              <TouchableOpacity
                className="p-4 flex-row items-center justify-between"
                onPress={handleDisconnect}
                disabled={disconnectMutation.isPending}
                accessibilityLabel="BOJ 계정 연결 해제"
                accessibilityRole="button"
                accessibilityState={{ disabled: disconnectMutation.isPending }}
              >
                <Text className="text-base text-error">연결 해제</Text>
                {disconnectMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <IconSymbol name="chevron.right" size={20} color={colors.error} />
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Appearance Section */}
        <View className="bg-surface rounded-xl border border-border mb-6 overflow-hidden">
          <View className="p-4 border-b border-border">
            <Text className="text-sm font-medium text-muted mb-1">화면</Text>
          </View>

          <View className="p-4 flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View
                className="w-10 h-10 rounded-full items-center justify-center"
                style={{ backgroundColor: colors.tint + "20" }}
              >
                <IconSymbol
                  name={isDarkMode ? "moon.fill" : "sun.max.fill"}
                  size={20}
                  color={colors.tint}
                />
              </View>
              <View>
                <Text className="text-base text-foreground">다크 모드</Text>
                <Text className="text-xs text-muted">
                  {isDarkMode ? "어두운 테마 사용 중" : "밝은 테마 사용 중"}
                </Text>
              </View>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={(value) => setColorScheme(value ? "dark" : "light")}
              trackColor={{ false: colors.border, true: colors.tint }}
              thumbColor="#fff"
              accessibilityLabel="다크 모드"
              accessibilityRole="switch"
              accessibilityState={{ checked: isDarkMode }}
            />
          </View>
        </View>

        {/* App Info Section */}
        <View className="bg-surface rounded-xl border border-border overflow-hidden">
          <View className="p-4 border-b border-border">
            <Text className="text-sm font-medium text-muted mb-1">앱 정보</Text>
          </View>

          <View className="p-4 flex-row items-center justify-between border-b border-border">
            <Text className="text-base text-foreground">버전</Text>
            <Text className="text-base text-muted">1.0.0</Text>
          </View>

          <TouchableOpacity
            className="p-4 flex-row items-center justify-between border-b border-border"
            onPress={() => openPolicy(TERMS_OF_SERVICE_URL, "/terms")}
            accessibilityLabel="이용약관"
            accessibilityRole="link"
          >
            <Text className="text-base text-foreground">이용약관</Text>
            <IconSymbol name="chevron.right" size={20} color={colors.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            className="p-4 flex-row items-center justify-between"
            onPress={() => openPolicy(PRIVACY_POLICY_URL, "/privacy")}
            accessibilityLabel="개인정보처리방침"
            accessibilityRole="link"
          >
            <Text className="text-base text-foreground">개인정보처리방침</Text>
            <IconSymbol name="chevron.right" size={20} color={colors.muted} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
