import { ScrollView, Text, View, TextInput, TouchableOpacity, RefreshControl } from "react-native";
import { useState, useMemo, useCallback } from "react";

import { ScreenContainer } from "@/components/screen-container";
import { AnalyticsSkeleton } from "@/components/ui/skeleton";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

type TagFilter = "all" | "weak" | "stable" | "strong";

type TagStat = {
  id: number;
  tag: string;
  snapshotDate: string | Date;
  attemptedCount: number;
  solvedCount: number;
  weakScore: number;
  recentSolvedCount30d: number;
};

function getSuccessRate(stat: Pick<TagStat, "attemptedCount" | "solvedCount">): number {
  if (!stat.attemptedCount) return 0;
  return Math.round((stat.solvedCount / stat.attemptedCount) * 100);
}

function getStrengthLabel(weakScore: number): "약점" | "보통" | "강점" {
  if (weakScore >= 0.6) return "약점";
  if (weakScore >= 0.35) return "보통";
  return "강점";
}

export default function AnalyticsScreen() {
  const colors = useColors();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TagFilter>("all");

  const { data, isLoading, refetch } = trpc.analytics.tags.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const rawTagStats = useMemo(() => (data as TagStat[] | undefined) ?? [], [data]);

  const tagStats = useMemo(() => {
    const latestByTag = new Map<string, TagStat>();

    for (const item of rawTagStats) {
      const existing = latestByTag.get(item.tag);
      if (!existing) {
        latestByTag.set(item.tag, item);
        continue;
      }

      const existingTs = new Date(existing.snapshotDate).getTime();
      const currentTs = new Date(item.snapshotDate).getTime();
      if (currentTs >= existingTs) {
        latestByTag.set(item.tag, item);
      }
    }

    return Array.from(latestByTag.values());
  }, [rawTagStats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const filtered = useMemo(() => {
    const lowered = query.trim().toLowerCase();

    return tagStats
      .filter((stat) => {
        if (!lowered) return true;
        return stat.tag.toLowerCase().includes(lowered);
      })
      .filter((stat) => {
        if (filter === "all") return true;
        if (filter === "weak") return stat.weakScore >= 0.6;
        if (filter === "stable") return stat.weakScore >= 0.35 && stat.weakScore < 0.6;
        return stat.weakScore < 0.35;
      })
      .sort((a, b) => b.weakScore - a.weakScore);
  }, [tagStats, query, filter]);

  const summary = useMemo(() => {
    const totalTags = tagStats.length;
    const totalSolved = tagStats.reduce((sum, item) => sum + item.solvedCount, 0);
    const avgSuccessRate =
      totalTags > 0
        ? Math.round(
            tagStats.reduce((sum, item) => sum + getSuccessRate(item), 0) / totalTags,
          )
        : 0;
    const topWeakTag = [...tagStats].sort((a, b) => b.weakScore - a.weakScore)[0] ?? null;

    return {
      totalTags,
      totalSolved,
      avgSuccessRate,
      topWeakTag,
    };
  }, [tagStats]);

  if (!authLoading && !isAuthenticated) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center gap-3">
          <Text className="text-lg text-muted">로그인이 필요합니다</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="mb-6">
          <Text className="text-2xl font-bold text-foreground">태그 분석</Text>
          <Text className="text-sm text-muted mt-1">약점 점수와 성공률을 기준으로 학습 우선순위를 확인하세요.</Text>
        </View>

        {isLoading ? (
          <AnalyticsSkeleton />
        ) : (
          <>
            <View className="flex-row flex-wrap gap-3 mb-5">
              <View className="flex-1 min-w-[100px] bg-surface rounded-xl p-4 border border-border">
                <Text className="text-xs text-muted mb-1">분석 태그</Text>
                <Text className="text-2xl font-bold text-foreground">{summary.totalTags}</Text>
              </View>
              <View className="flex-1 min-w-[100px] bg-surface rounded-xl p-4 border border-border">
                <Text className="text-xs text-muted mb-1">평균 성공률</Text>
                <Text className="text-2xl font-bold" style={{ color: colors.tint }}>
                  {summary.avgSuccessRate}%
                </Text>
              </View>
              <View className="flex-1 min-w-[100px] bg-surface rounded-xl p-4 border border-border">
                <Text className="text-xs text-muted mb-1">총 해결 수</Text>
                <Text className="text-2xl font-bold text-foreground">{summary.totalSolved}</Text>
              </View>
            </View>

            <View className="bg-surface rounded-xl p-4 border border-border mb-5">
              <Text className="text-sm text-muted mb-1">주요 약점 태그</Text>
              <Text className="text-lg font-semibold text-foreground">
                {summary.topWeakTag ? summary.topWeakTag.tag : "데이터 없음"}
              </Text>
              {summary.topWeakTag && (
                <Text className="text-xs text-muted mt-1">
                  약점 점수 {Math.round(summary.topWeakTag.weakScore * 100)}점 · 최근 30일 {summary.topWeakTag.recentSolvedCount30d}문제
                </Text>
              )}
            </View>

            <View className="bg-surface rounded-xl p-4 border border-border mb-4">
              <View className="flex-row items-center gap-2 mb-3">
                <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
                <TextInput
                  className="flex-1 text-foreground"
                  placeholder="태그 검색"
                  placeholderTextColor={colors.muted}
                  value={query}
                  onChangeText={setQuery}
                />
              </View>

              <View className="flex-row gap-2">
                {[
                  { key: "all", label: "전체" },
                  { key: "weak", label: "약점" },
                  { key: "stable", label: "보통" },
                  { key: "strong", label: "강점" },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.key}
                    onPress={() => setFilter(item.key as TagFilter)}
                    className="px-3 py-1.5 rounded-full"
                    style={{
                      backgroundColor: filter === item.key ? colors.tint + "20" : colors.background,
                      borderWidth: 1,
                      borderColor: filter === item.key ? colors.tint : colors.border,
                    }}
                  >
                    <Text
                      style={{
                        color: filter === item.key ? colors.tint : colors.muted,
                        fontSize: 12,
                        fontWeight: "600",
                      }}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View className="bg-surface rounded-xl border border-border overflow-hidden">
              {filtered.length === 0 ? (
                <View className="p-8 items-center">
                  <Text className="text-muted">조건에 맞는 태그가 없습니다</Text>
                </View>
              ) : (
                filtered.map((stat, index) => {
                  const successRate = getSuccessRate(stat);
                  const strengthLabel = getStrengthLabel(stat.weakScore);
                  const strengthColor =
                    strengthLabel === "약점"
                      ? colors.error
                      : strengthLabel === "보통"
                        ? colors.warning
                        : colors.success;

                  return (
                    <View
                      key={stat.id}
                      className={`p-4 ${index < filtered.length - 1 ? "border-b border-border" : ""}`}
                    >
                      <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-base font-medium text-foreground">{stat.tag}</Text>
                        <View
                          className="px-2 py-1 rounded"
                          style={{ backgroundColor: strengthColor + "20" }}
                        >
                          <Text style={{ color: strengthColor, fontSize: 11, fontWeight: "600" }}>
                            {strengthLabel}
                          </Text>
                        </View>
                      </View>

                      <Text className="text-xs text-muted mb-2">
                        해결 {stat.solvedCount} / 시도 {stat.attemptedCount} · 최근 30일 {stat.recentSolvedCount30d}문제
                      </Text>

                      <View className="flex-row items-center gap-2">
                        <View className="flex-1 h-2 rounded-full" style={{ backgroundColor: colors.border }}>
                          <View
                            className="h-2 rounded-full"
                            style={{
                              width: `${successRate}%`,
                              backgroundColor: successRate >= 70 ? colors.success : successRate >= 40 ? colors.warning : colors.error,
                            }}
                          />
                        </View>
                        <Text className="text-xs text-muted" style={{ minWidth: 48 }}>
                          {successRate}%
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
