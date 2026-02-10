import { useState } from "react";
import { Text, View, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useToast } from "@/components/ui/toast";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

export default function ConnectScreen() {
  const router = useRouter();
  const colors = useColors();
  const { showToast } = useToast();
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const connectMutation = trpc.link.connect.useMutation({
    onSuccess: async () => {
      // Start initial sync in background (don't wait for completion)
      syncMutation.mutate();
      // Navigate immediately - sync will continue in background
      router.replace("/");
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const syncMutation = trpc.sync.start.useMutation({
    onError: (err) => {
      showToast({
        type: "error",
        message: err.message || "동기화 시작에 실패했습니다. 대시보드에서 다시 시도해 주세요.",
      });
    },
  });

  const handleConnect = async () => {
    if (!handle.trim() || !password) {
      setError("백준 아이디와 비밀번호를 입력해주세요.");
      return;
    }

    setError(null);
    await connectMutation.mutateAsync({ handle: handle.trim(), password });
  };

  const isLoading = connectMutation.isPending;

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 p-6">
          {/* Header */}
          <View className="flex-row items-center mb-8">
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ padding: 8, marginLeft: -8 }}
              accessibilityLabel="뒤로 가기"
              accessibilityRole="button"
            >
              <IconSymbol name="chevron.right" size={24} color={colors.foreground} style={{ transform: [{ rotate: "180deg" }] }} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View className="flex-1 justify-center">
            <View className="items-center mb-8">
              <View className="w-16 h-16 bg-primary rounded-full items-center justify-center mb-4">
                <IconSymbol name="link" size={32} color="#FFFFFF" />
              </View>
              <Text className="text-2xl font-bold text-foreground mb-2">BOJ 계정 연결</Text>
              <Text className="text-base text-muted text-center">
                백준 계정을 다시 인증해 연동을 갱신합니다
              </Text>
            </View>

            {/* Input */}
            <View className="mb-6">
              <Text className="text-sm font-medium text-foreground mb-2">백준 아이디</Text>
              <TextInput
                className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground text-base"
                placeholder="예: tourist"
                placeholderTextColor={colors.muted}
                value={handle}
                onChangeText={(text) => {
                  setHandle(text);
                  setError(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleConnect}
                editable={!isLoading}
              />
              <Text className="text-sm font-medium text-foreground mb-2 mt-4">비밀번호</Text>
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
                returnKeyType="done"
                onSubmitEditing={handleConnect}
                editable={!isLoading}
              />
              {error && (
                <Text className="text-error text-sm mt-2">{error}</Text>
              )}
            </View>

            {/* Info */}
            <View className="bg-surface rounded-xl p-4 mb-6 border border-border">
              <View className="flex-row items-start gap-3">
                <IconSymbol name="info.circle" size={20} color={colors.muted} />
                <View className="flex-1">
                  <Text className="text-sm text-muted leading-relaxed">
                    입력한 비밀번호는 로그인 검증에만 사용되며 서버에 저장되지 않습니다.
                    solved.ac에 해당 아이디가 연결되어 있어야 데이터 동기화가 가능합니다.
                  </Text>
                </View>
              </View>
            </View>

            {/* Button */}
            <TouchableOpacity
              className="bg-primary rounded-full py-4 items-center"
              onPress={handleConnect}
              disabled={isLoading}
              style={{ opacity: isLoading ? 0.7 : 1 }}
              accessibilityLabel="BOJ 계정 연결하기"
              accessibilityRole="button"
              accessibilityState={{ disabled: isLoading }}
            >
              {isLoading ? (
                <View className="flex-row items-center gap-2">
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text className="text-background font-semibold">
                    {syncMutation.isPending ? "동기화 중..." : "연결 중..."}
                  </Text>
                </View>
              ) : (
                <Text className="text-background font-semibold">연결하기</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
