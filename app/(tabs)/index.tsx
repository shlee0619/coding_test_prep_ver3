import { ScrollView, Text, View, TouchableOpacity, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useState, useCallback } from "react";

import { ScreenContainer } from "@/components/screen-container";
import { TierBadge } from "@/components/tier-badge";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { SyncProgressModal } from "@/components/sync-progress-modal";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { getTierName } from "@/shared/types";

export default function DashboardScreen() {
  const router = useRouter();
  const colors = useColors();
  const { showToast } = useToast();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);

  const { data: dashboard, isLoading, refetch } = trpc.dashboard.summary.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const syncMutation = trpc.sync.start.useMutation({
    onSuccess: () => {
      setShowSyncModal(true);
    },
    onError: (error) => {
      showToast({
        type: "error",
        message: error.message || "동기화 시작에 실패했습니다",
      });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleSync = async () => {
    try {
      await syncMutation.mutateAsync();
    } catch {
      // Error handled in onError
    }
  };

  const handleSyncComplete = () => {
    refetch();
    showToast({
      type: "success",
      message: "동기화가 완료되었습니다",
    });
  };

  // Show login prompt if not authenticated
  if (!authLoading && !isAuthenticated) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center gap-6">
          <View className="items-center gap-2">
            <Text className="text-4xl font-bold text-foreground">SolveMate</Text>
            <Text className="text-base text-muted text-center">
              백준 온라인 저지 학습을 도와드립니다
            </Text>
          </View>
          <View className="w-full max-w-sm bg-surface rounded-2xl p-6 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-2">시작하기</Text>
            <Text className="text-sm text-muted leading-relaxed mb-4">
              로그인하여 BOJ 계정을 연결하고 맞춤형 분석과 추천을 받아보세요.
            </Text>
            <TouchableOpacity
              className="bg-primary px-6 py-3 rounded-full"
              style={{ opacity: 1 }}
              onPress={() => router.push("/login")}
              accessibilityLabel="로그인"
              accessibilityRole="button"
            >
              <Text className="text-background font-semibold text-center">로그인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  // Show connect prompt if no linked account
  if (!isLoading && dashboard && !dashboard.linkedAccount) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center gap-6">
          <View className="items-center gap-2">
            <Text className="text-3xl font-bold text-foreground">환영합니다!</Text>
            <Text className="text-base text-muted text-center">
              BOJ 계정을 연결하여 시작하세요
            </Text>
          </View>
          <View className="w-full max-w-sm bg-surface rounded-2xl p-6 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-2">BOJ 계정 연결</Text>
            <Text className="text-sm text-muted leading-relaxed mb-4">
              solved.ac에 등록된 BOJ 핸들을 연결하면 풀이 데이터를 분석하고 맞춤 추천을 받을 수 있습니다.
            </Text>
            <TouchableOpacity
              className="bg-primary px-6 py-3 rounded-full"
              onPress={() => router.push("/connect")}
              accessibilityLabel="BOJ 계정 연결하기"
              accessibilityRole="button"
            >
              <Text className="text-background font-semibold text-center">계정 연결하기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <View>
            <Text className="text-2xl font-bold text-foreground">
              {dashboard?.linkedAccount?.handle || "대시보드"}
            </Text>
            {dashboard?.lastSyncAt && (
              <Text className="text-sm text-muted">
                마지막 동기화: {new Date(dashboard.lastSyncAt).toLocaleDateString("ko-KR")}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={handleSync}
            disabled={syncMutation.isPending || dashboard?.syncStatus === "RUNNING"}
            className="flex-row items-center gap-2 px-4 py-2 rounded-full"
            style={{
              backgroundColor: colors.tint + "15",
              opacity: syncMutation.isPending || dashboard?.syncStatus === "RUNNING" ? 0.5 : 1,
            }}
            accessibilityLabel={syncMutation.isPending || dashboard?.syncStatus === "RUNNING" ? "동기화 중" : "동기화"}
            accessibilityRole="button"
            accessibilityState={{ disabled: syncMutation.isPending || dashboard?.syncStatus === "RUNNING" }}
          >
            <IconSymbol
              name={syncMutation.isPending || dashboard?.syncStatus === "RUNNING" ? "arrow.triangle.2.circlepath" : "arrow.clockwise"}
              size={18}
              color={colors.tint}
            />
            <Text style={{ color: colors.tint, fontSize: 14, fontWeight: "500" }}>
              {syncMutation.isPending || dashboard?.syncStatus === "RUNNING" ? "동기화 중..." : "동기화"}
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* Profile Card */}
            {dashboard?.linkedAccount && (
              <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
                <View className="flex-row items-center gap-3">
                  <TierBadge tier={dashboard.linkedAccount.tier || 0} size="large" />
                  <View className="flex-1">
                    <Text className="text-lg font-semibold text-foreground">
                      {getTierName(dashboard.linkedAccount.tier || 0)}
                    </Text>
                    <Text className="text-sm text-muted">
                      Rating: {dashboard.linkedAccount.rating?.toLocaleString() || 0}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-xs text-muted">총 해결</Text>
                    <Text className="text-xl font-bold text-foreground">
                      {dashboard.linkedAccount.solvedCount || 0}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* KPI Cards */}
            <View className="flex-row flex-wrap gap-3 mb-6">
              <View className="flex-1 min-w-[100px] bg-surface rounded-xl p-4 border border-border">
                <View className="flex-row items-center gap-2 mb-2">
                  <View
                    className="w-8 h-8 rounded-full items-center justify-center"
                    style={{ backgroundColor: colors.success + "20" }}
                  >
                    <IconSymbol name="checkmark.circle.fill" size={18} color={colors.success} />
                  </View>
                </View>
                <Text className="text-2xl font-bold text-foreground">
                  {dashboard?.stats?.totalSolved || 0}
                </Text>
                <Text className="text-xs text-muted">총 해결</Text>
              </View>
              <View className="flex-1 min-w-[100px] bg-surface rounded-xl p-4 border border-border">
                <View className="flex-row items-center gap-2 mb-2">
                  <View
                    className="w-8 h-8 rounded-full items-center justify-center"
                    style={{ backgroundColor: colors.tint + "20" }}
                  >
                    <IconSymbol name="flame.fill" size={18} color={colors.tint} />
                  </View>
                </View>
                <Text className="text-2xl font-bold" style={{ color: colors.tint }}>
                  {dashboard?.stats?.recent7Days || 0}
                </Text>
                <Text className="text-xs text-muted">최근 7일</Text>
              </View>
              <View className="flex-1 min-w-[100px] bg-surface rounded-xl p-4 border border-border">
                <View className="flex-row items-center gap-2 mb-2">
                  <View
                    className="w-8 h-8 rounded-full items-center justify-center"
                    style={{ backgroundColor: colors.warning + "20" }}
                  >
                    <IconSymbol name="calendar" size={18} color={colors.warning} />
                  </View>
                </View>
                <Text className="text-2xl font-bold text-foreground">
                  {dashboard?.stats?.recent30Days || 0}
                </Text>
                <Text className="text-xs text-muted">최근 30일</Text>
              </View>
            </View>

            {/* Weak Tags Section */}
            <View className="mb-6">
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center gap-2">
                  <IconSymbol name="exclamationmark.triangle.fill" size={18} color={colors.warning} />
                  <Text className="text-lg font-semibold text-foreground">약점 태그 Top 5</Text>
                </View>
                <TouchableOpacity onPress={() => router.push("/(tabs)/analytics")}>
                  <Text className="text-sm" style={{ color: colors.tint }}>전체 보기</Text>
                </TouchableOpacity>
              </View>

              {dashboard?.weakTags && dashboard.weakTags.length > 0 ? (
                <View className="bg-surface rounded-xl border border-border overflow-hidden">
                  {dashboard.weakTags.map((tag, index) => {
                    const successRate = tag.attemptedCount > 0
                      ? Math.round((tag.solvedCount / tag.attemptedCount) * 100)
                      : 0;

                    return (
                      <View
                        key={tag.tag}
                        className={`p-4 ${
                          index < dashboard.weakTags.length - 1 ? "border-b border-border" : ""
                        }`}
                      >
                        <View className="flex-row items-center justify-between mb-2">
                          <Text className="text-base font-medium text-foreground flex-1">
                            {tag.tag}
                          </Text>
                          <View
                            className="px-2 py-1 rounded"
                            style={{ backgroundColor: colors.warning + "20" }}
                          >
                            <Text style={{ color: colors.warning, fontSize: 11, fontWeight: "600" }}>
                              약점 {Math.round((tag.weakScore || 0) * 100)}%
                            </Text>
                          </View>
                        </View>
                        <View className="flex-row items-center gap-3">
                          <View className="flex-1 h-2 rounded-full" style={{ backgroundColor: colors.border }}>
                            <View
                              className="h-2 rounded-full"
                              style={{
                                width: `${successRate}%`,
                                backgroundColor: successRate >= 70 ? colors.success : successRate >= 40 ? colors.warning : colors.error,
                              }}
                            />
                          </View>
                          <Text className="text-xs text-muted" style={{ minWidth: 60 }}>
                            {tag.solvedCount}/{tag.attemptedCount} ({successRate}%)
                          </Text>
                        </View>
                        {tag.recentSolvedCount30d !== undefined && (
                          <Text className="text-xs text-muted mt-1">
                            최근 30일: {tag.recentSolvedCount30d}문제
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View className="bg-surface rounded-xl p-6 border border-border items-center">
                  <IconSymbol name="chart.bar.xaxis" size={40} color={colors.muted} />
                  <Text className="text-muted text-center mt-3">
                    동기화 후 약점 태그가 표시됩니다
                  </Text>
                  <TouchableOpacity
                    onPress={handleSync}
                    disabled={syncMutation.isPending}
                    className="mt-3 px-4 py-2 rounded-full"
                    style={{ backgroundColor: colors.tint }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "500" }}>지금 동기화</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Quick Actions */}
            <View>
              <Text className="text-lg font-semibold text-foreground mb-3">빠른 액션</Text>
              <View className="flex-row gap-3">
                <TouchableOpacity
                  className="flex-1 bg-primary rounded-xl p-4 items-center"
                  onPress={() => router.push("/(tabs)/recommendations")}
                  activeOpacity={0.8}
                >
                  <IconSymbol name="lightbulb.fill" size={24} color="#FFFFFF" />
                  <Text className="text-background font-medium mt-2">추천 문제</Text>
                  <Text className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.7)" }}>
                    약점 기반 맞춤 추천
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-surface rounded-xl p-4 items-center border border-border"
                  onPress={() => router.push("/(tabs)/goals")}
                  activeOpacity={0.8}
                >
                  <IconSymbol name="target" size={24} color={colors.foreground} />
                  <Text className="text-foreground font-medium mt-2">목표 설정</Text>
                  <Text className="text-xs text-muted mt-1">
                    학습 목표 관리
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Sync Progress Modal */}
      <SyncProgressModal
        visible={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        onComplete={handleSyncComplete}
      />
    </ScreenContainer>
  );
}
