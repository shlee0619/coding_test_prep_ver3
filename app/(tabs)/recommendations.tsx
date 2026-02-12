// ... (imports remain similar, adding TextInput, Switch)
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Switch,
} from "react-native";
import { useState, useCallback, useMemo } from "react";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { TierBadge } from "@/components/tier-badge";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { RecommendationsSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { getTierName } from "@/shared/types";

// 난이도 범위 프리셋
const LEVEL_PRESETS = [
  { label: "전체 (All)", min: 1, max: 30, color: "bg-primary" },
  { label: "브론즈", min: 1, max: 5, color: "bg-bronze" },
  { label: "실버", min: 6, max: 10, color: "bg-silver" },
  { label: "골드", min: 11, max: 15, color: "bg-gold" },
  { label: "플래티넘", min: 16, max: 20, color: "bg-platinum" },
];

// 카테고리 정의
type Category = "all" | "weakness" | "challenge" | "review" | "popular" | "foundation";

const CATEGORIES: { key: Category; label: string; icon: string; color: string; description: string }[] = [
  { key: "all", label: "전체", icon: "list.bullet", color: "#6B7280", description: "모든 추천" },
  { key: "weakness", label: "약점 보완", icon: "target", color: "#EF4444", description: "부족한 태그 연습" },
  { key: "challenge", label: "도전", icon: "arrow.up.circle", color: "#F59E0B", description: "실력 향상" },
  { key: "review", label: "복습", icon: "arrow.clockwise", color: "#3B82F6", description: "오래된 태그" },
  { key: "popular", label: "인기", icon: "star.fill", color: "#EAB308", description: "검증된 문제" },
  { key: "foundation", label: "기초", icon: "leaf.fill", color: "#22C55E", description: "기본기 다지기" },
];

// 카테고리 색상 가져오기
function getCategoryColor(category: string): string {
  return CATEGORIES.find(c => c.key === category)?.color || "#6B7280";
}

// 카테고리 라벨 가져오기
function getCategoryLabel(category: string): string {
  return CATEGORIES.find(c => c.key === category)?.label || category;
}

export default function RecommendationsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { showToast } = useToast();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category>("all");
  const [resultLimit, setResultLimit] = useState(120);

  // 필터 상태
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [levelMin, setLevelMin] = useState(1);
  const [levelMax, setLevelMax] = useState(30);
  const [tempLevelMin, setTempLevelMin] = useState(1);
  const [tempLevelMax, setTempLevelMax] = useState(30);

  // 태그 필터 상태
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tempSelectedTags, setTempSelectedTags] = useState<string[]>([]);
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const [excludeSolved, setExcludeSolved] = useState(true);
  const [tempExcludeSolved, setTempExcludeSolved] = useState(true);

  // 사용 가능한 태그 목록 조회
  const { data: availableTags } = trpc.analytics.availableTags.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // 추천 목록 조회
  const {
    data: recommendationData,
    isLoading,
    refetch,
  } = trpc.recommendations.list.useQuery(
    {
      realtime: true,
      limit: resultLimit,
      category: selectedCategory === "all" ? undefined : selectedCategory as any,
      levelMin: levelMin > 1 ? levelMin : undefined,
      levelMax: levelMax < 30 ? levelMax : undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      excludeSolved,
    },
    { enabled: isAuthenticated }
  );

  // 오늘의 추천 조회
  const { data: dailyData } = trpc.recommendations.daily.useQuery(undefined, {
    enabled: isAuthenticated && selectedCategory === "all",
  });

  const bookmarkMutation = trpc.problems.toggleBookmark.useMutation({
    onSuccess: (data) => {
      refetch();
      showToast({
        type: "success",
        message: data.isBookmarked ? "북마크에 추가되었습니다" : "북마크가 해제되었습니다",
      });
    },
    onError: () => {
      showToast({ type: "error", message: "북마크 변경에 실패했습니다" });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const openProblemDetail = (problemId: number, reasons?: string[]) => {
    router.push({
      pathname: "/problem/[id]",
      params: {
        id: problemId.toString(),
        reasons: reasons ? encodeURIComponent(JSON.stringify(reasons)) : undefined,
      },
    });
  };

  const toggleBookmark = async (problemId: number) => {
    try {
      await bookmarkMutation.mutateAsync({ problemId });
    } catch {
      // Error handled in onError
    }
  };

  const applyFilters = () => {
    setLevelMin(tempLevelMin);
    setLevelMax(tempLevelMax);
    setSelectedTags(tempSelectedTags);
    setExcludeSolved(tempExcludeSolved);
    setShowFilterModal(false);
  };

  const resetFilters = () => {
    setTempLevelMin(1);
    setTempLevelMax(30);
    setTempSelectedTags([]);
    setTempExcludeSolved(true);
    setExcludeSolved(true);
    setLevelMin(1);
    setLevelMax(30);
    setSelectedTags([]);
    setShowFilterModal(false);
  };

  const toggleTagSelection = (tag: string) => {
    setTempSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  // 필터링된 아이템
  const items = useMemo(() => {
    if (!recommendationData?.items) return [];
    // If we support client-side excluded solved logic in future, add here
    return recommendationData.items;
  }, [recommendationData]);

  // 통계
  const stats = recommendationData?.stats;
  const hasActiveFilters = levelMin > 1 || levelMax < 30 || selectedTags.length > 0 || !excludeSolved;

  // 태그 검색 필터링
  const filteredTags = useMemo(() => {
    if (!availableTags) return [];
    if (!tagSearchQuery) return availableTags;
    return availableTags.filter(t => 
      t.name.toLowerCase().includes(tagSearchQuery.toLowerCase())
    );
  }, [availableTags, tagSearchQuery]);

  if (!authLoading && !isAuthenticated) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center">
          <Text className="text-lg text-muted">로그인이 필요합니다</Text>
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
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-2xl font-bold text-foreground">맞춤 추천</Text>
            <Text className="text-sm text-muted mt-1">
              실시간 연관 추천 모드
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              setTempLevelMin(levelMin);
              setTempLevelMax(levelMax);
              setTempSelectedTags(selectedTags);
              setTempExcludeSolved(excludeSolved);
              setTagSearchQuery("");
              setShowFilterModal(true);
            }}
            className="p-2 rounded-lg"
            style={{
              backgroundColor: hasActiveFilters ? colors.tint + "20" : colors.surface,
              borderWidth: 1,
              borderColor: hasActiveFilters ? colors.tint : colors.border,
            }}
          >
            <IconSymbol
              name="slider.horizontal.3"
              size={22}
              color={hasActiveFilters ? colors.tint : colors.foreground}
            />
          </TouchableOpacity>
        </View>

        {/* 활성 필터 표시 */}
        {hasActiveFilters && (
          <View
            className="mb-4 p-3 rounded-lg"
            style={{ backgroundColor: colors.tint + "10" }}
          >
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center gap-2">
                <IconSymbol name="line.3.horizontal.decrease.circle.fill" size={16} color={colors.tint} />
                <Text style={{ color: colors.tint, fontSize: 13, fontWeight: "600" }}>
                  필터 적용 중
                </Text>
              </View>
              <TouchableOpacity onPress={resetFilters}>
                <IconSymbol name="xmark.circle.fill" size={18} color={colors.tint} />
              </TouchableOpacity>
            </View>
            {(levelMin > 1 || levelMax < 30) && (
              <Text style={{ color: colors.tint, fontSize: 12, marginBottom: 4 }}>
                난이도: {getTierName(levelMin)} ~ {getTierName(levelMax)}
              </Text>
            )}
            {selectedTags.length > 0 && (
              <View className="flex-row flex-wrap gap-1">
                {selectedTags.map(tag => (
                  <View
                    key={tag}
                    className="px-2 py-1 rounded"
                    style={{ backgroundColor: colors.tint + "20" }}
                  >
                    <Text style={{ color: colors.tint, fontSize: 11 }}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* 통계 요약 카드 */}
        {stats && (
          <View
            className="bg-surface rounded-xl p-4 border border-border mb-4"
            style={{ borderLeftWidth: 4, borderLeftColor: colors.tint }}
          >
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm font-medium text-foreground">
                총 {stats.totalCount}개 추천
              </Text>
              {recommendationData?.generatedAt && (
                <Text className="text-xs text-muted">
                  {new Date(recommendationData.generatedAt).toLocaleDateString("ko-KR")} 생성
                </Text>
              )}
            </View>
            <View className="flex-row flex-wrap gap-2">
              {Object.entries(stats.byCategory).map(([cat, count]) => (
                count > 0 && (
                  <View
                    key={cat}
                    className="px-2 py-1 rounded-full"
                    style={{ backgroundColor: getCategoryColor(cat) + "20" }}
                  >
                    <Text style={{ color: getCategoryColor(cat), fontSize: 11 }}>
                      {getCategoryLabel(cat)} {count}
                    </Text>
                  </View>
                )
              ))}
            </View>
          </View>
        )}

        {/* 카테고리 탭 (Horizontal Scroll) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-4"
          contentContainerStyle={{ gap: 8 }}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.key;
            const count =
              cat.key === "all"
                ? stats?.totalCount || 0
                : (stats?.byCategory as any)?.[cat.key] || 0;

            return (
              <TouchableOpacity
                key={cat.key}
                onPress={() => setSelectedCategory(cat.key)}
                className="px-4 py-2 rounded-full flex-row items-center gap-2"
                style={{
                  backgroundColor: isSelected ? cat.color : colors.surface,
                  borderWidth: 1,
                  borderColor: isSelected ? cat.color : colors.border,
                }}
              >
                <IconSymbol
                  name={cat.icon as any}
                  size={14}
                  color={isSelected ? "#FFF" : cat.color}
                />
                <Text
                  style={{
                    color: isSelected ? "#FFF" : colors.foreground,
                    fontSize: 13,
                    fontWeight: isSelected ? "600" : "400",
                  }}
                >
                  {cat.label}
                </Text>
                {count > 0 && (
                  <View
                    className="px-1.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor: isSelected ? "rgba(255,255,255,0.3)" : cat.color + "20",
                    }}
                  >
                    <Text
                      style={{
                        color: isSelected ? "#FFF" : cat.color,
                        fontSize: 10,
                        fontWeight: "600",
                      }}
                    >
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 오늘의 추천 (전체 탭일 때만) */}
        {selectedCategory === "all" && dailyData?.items && dailyData.items.length > 0 && (
          <View className="mb-6">
            <View className="flex-row items-center gap-2 mb-3">
              <IconSymbol name="sparkles" size={18} color={colors.tint} />
              <Text className="text-lg font-semibold text-foreground">오늘의 추천</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12 }}
            >
              {dailyData.items.slice(0, 10).map((rec: any) => (
                <TouchableOpacity
                  key={rec.problemId}
                  className="bg-surface rounded-xl p-3 border border-border"
                  style={{ width: 200 }}
                  onPress={() => openProblemDetail(rec.problemId, rec.reasons)}
                >
                  <View className="flex-row items-center gap-2 mb-2">
                    <View
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: getCategoryColor(rec.category) }}
                    />
                    <TierBadge tier={rec.problem?.level || rec.level} size="small" />
                  </View>
                  <Text
                    className="text-sm font-medium text-foreground mb-1"
                    numberOfLines={2}
                  >
                    {rec.problem?.title || `문제 ${rec.problemId}`}
                  </Text>
                  <Text className="text-xs text-muted">#{rec.problemId}</Text>
                  {rec.reasons?.[0] && (
                    <Text
                      className="text-xs mt-2"
                      style={{ color: getCategoryColor(rec.category) }}
                      numberOfLines={1}
                    >
                      {rec.reasons[0]}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* 추천 목록 */}
        {isLoading ? (
          <RecommendationsSkeleton />
        ) : items && items.length > 0 ? (
          <View className="gap-3">
            {/* 카테고리 설명 */}
            {selectedCategory !== "all" && (
              <View
                className="bg-surface rounded-lg p-3 mb-2"
                style={{
                  borderLeftWidth: 3,
                  borderLeftColor: getCategoryColor(selectedCategory),
                }}
              >
                <Text className="text-sm text-foreground">
                  {CATEGORIES.find((c) => c.key === selectedCategory)?.description}
                </Text>
              </View>
            )}

            {items.map((rec: any) => (
              <TouchableOpacity
                key={rec.problemId}
                className="bg-surface rounded-xl p-4 border border-border"
                onPress={() => openProblemDetail(rec.problemId, rec.reasons)}
                activeOpacity={0.7}
              >
                {/* 상단: 카테고리 + 티어 + 제목 + 북마크 */}
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-1 flex-row items-center gap-2">
                    {/* 카테고리 인디케이터 */}
                    <View
                      className="px-2 py-0.5 rounded"
                      style={{ backgroundColor: getCategoryColor(rec.category) + "20" }}
                    >
                      <Text
                        style={{
                          color: getCategoryColor(rec.category),
                          fontSize: 10,
                          fontWeight: "600",
                        }}
                      >
                        {getCategoryLabel(rec.category)}
                      </Text>
                    </View>
                    <TierBadge tier={rec.problem?.level || rec.level} size="small" />
                    <Text
                      className="text-base font-medium text-foreground flex-1"
                      numberOfLines={1}
                    >
                      {rec.problem?.title || `문제 ${rec.problemId}`}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      toggleBookmark(rec.problemId);
                    }}
                    style={{ padding: 4 }}
                  >
                    <IconSymbol name="bookmark" size={20} color={colors.muted} />
                  </TouchableOpacity>
                </View>

                {/* 문제 번호 + 점수 */}
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-sm text-muted">#{rec.problemId}</Text>
                  {rec.score && (
                    <View className="flex-row items-center gap-1">
                      <Text className="text-xs text-muted">추천도</Text>
                      <View
                        className="h-1.5 rounded-full"
                        style={{
                          width: 40,
                          backgroundColor: colors.border,
                        }}
                      >
                        <View
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${Math.round(rec.score * 100)}%`,
                            backgroundColor: getCategoryColor(rec.category),
                          }}
                        />
                      </View>
                    </View>
                  )}
                </View>

                {/* 태그 */}
                {rec.tags && rec.tags.length > 0 && (
                  <View className="flex-row flex-wrap gap-1 mb-2">
                    {rec.tags.slice(0, 4).map((tag: string) => (
                      <View
                        key={tag}
                        className="px-2 py-1 rounded"
                        style={{ backgroundColor: colors.border }}
                      >
                        <Text className="text-xs text-muted">{tag}</Text>
                      </View>
                    ))}
                    {rec.tags.length > 4 && (
                      <View
                        className="px-2 py-1 rounded"
                        style={{ backgroundColor: colors.border }}
                      >
                        <Text className="text-xs text-muted">+{rec.tags.length - 4}</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* 추천 이유 */}
                {rec.reasons && rec.reasons.length > 0 && (
                  <View className="flex-row flex-wrap gap-1">
                    {rec.reasons.slice(0, 2).map((reason: string, idx: number) => (
                      <View
                        key={idx}
                        className="px-2 py-1 rounded"
                        style={{ backgroundColor: getCategoryColor(rec.category) + "15" }}
                      >
                        <Text style={{ color: getCategoryColor(rec.category), fontSize: 11 }}>
                          {reason}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            ))}

            {items.length >= resultLimit && resultLimit < 300 && (
              <TouchableOpacity
                className="mt-2 py-3 rounded-xl border border-border items-center"
                style={{ backgroundColor: colors.surface }}
                onPress={() => setResultLimit((prev) => Math.min(prev + 60, 300))}
              >
                <Text className="text-sm font-medium text-foreground">추천 더 보기 (+60)</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View className="bg-surface rounded-xl p-6 border border-border items-center">
            <IconSymbol name="lightbulb.fill" size={48} color={colors.muted} />
            <Text className="text-lg font-medium text-foreground mt-4 mb-2">
              추천 문제가 없습니다
            </Text>
            <Text className="text-sm text-muted text-center">
              데이터를 동기화하면 약점 보완을 위한{"\n"}맞춤 문제를 추천해 드립니다
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              maxHeight: "90%",
            }}
          >
            {/* Header */}
            <View className="px-6 pt-6 pb-4 flex-row justify-between items-center border-b border-border bg-background/80 blur-md sticky top-0 z-10">
              <Text className="text-xl font-bold text-foreground">필터 (Filter)</Text>
              <TouchableOpacity 
                onPress={() => setShowFilterModal(false)}
                className="p-1"
              >
                <IconSymbol name="xmark" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView className="p-6 space-y-8">
              {/* Nanido (Difficulty) */}
              <View>
                <View className="flex-row justify-between items-end mb-3">
                  <Text className="text-base font-semibold text-foreground">난이도 범위 (Difficulty)</Text>
                </View>
                
                {/* Presets */}
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  className="mb-6 flex-row"
                  contentContainerStyle={{ gap: 8 }}
                >
                  {LEVEL_PRESETS.map((preset) => (
                    <TouchableOpacity
                      key={preset.label}
                      onPress={() => {
                        setTempLevelMin(preset.min);
                        setTempLevelMax(preset.max);
                      }}
                      className="px-4 py-2 rounded-full border border-border"
                      style={{
                        backgroundColor: (tempLevelMin === preset.min && tempLevelMax === preset.max) 
                          ? colors.tint 
                          : colors.surface,
                        borderColor: (tempLevelMin === preset.min && tempLevelMax === preset.max) 
                          ? colors.tint 
                          : colors.border
                      }}
                    >
                      <Text
                        style={{
                          color: (tempLevelMin === preset.min && tempLevelMax === preset.max) 
                            ? "#FFFFFF" 
                            : colors.muted,
                          fontWeight: "500",
                          fontSize: 14,
                        }}
                      >
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Range Slider Visualization */}
                <View className="bg-surface rounded-xl p-4 border border-border">
                  <View className="flex-row justify-between items-center mb-4">
                    <View className="flex-row items-center gap-2">
                       <TierBadge tier={tempLevelMin} size="small" />
                       <Text className="text-foreground font-medium text-sm">{getTierName(tempLevelMin)}</Text>
                    </View>
                    <Text className="text-muted">~</Text>
                    <View className="flex-row items-center gap-2">
                       <TierBadge tier={tempLevelMax} size="small" />
                       <Text className="text-foreground font-medium text-sm">{getTierName(tempLevelMax)}</Text>
                    </View>
                  </View>
                  
                  {/* Visual Bar */}
                  <View className="relative w-full h-2 bg-border rounded-full overflow-hidden">
                    <View 
                      className="absolute h-full bg-primary"
                      style={{
                        left: `${((tempLevelMin - 1) / 30) * 100}%`,
                        width: `${((tempLevelMax - tempLevelMin + 1) / 30) * 100}%`,
                        backgroundColor: colors.tint
                      }}
                    />
                  </View>
                  {/* Slider Thumbs (Visual only for now, as interaction requires complex gesture handling) */}
                  <View className="relative w-full h-6 mt-[-16px] pointer-events-none">
                     <View 
                        className="absolute w-6 h-6 bg-white rounded-full shadow border"
                        style={{
                          left: `${((tempLevelMin - 1) / 30) * 100}%`,
                          borderColor: colors.border,
                          transform: [{ translateX: -12 }]
                        }}
                     />
                     <View 
                        className="absolute w-6 h-6 bg-white rounded-full shadow border"
                        style={{
                          left: `${((tempLevelMax) / 30) * 100}%`,
                          borderColor: colors.border,
                          transform: [{ translateX: -12 }]
                        }}
                     />
                  </View>
                </View>
              </View>

              {/* Tags Search */}
              <View>
                <Text className="text-base font-semibold text-foreground mb-3">태그로 검색 (Search Tags)</Text>
                
                <View className="relative mb-4">
                  <View className="absolute left-3 top-3 z-10">
                    <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
                  </View>
                  <TextInput
                    className="w-full pl-10 pr-4 py-3 bg-surface rounded-xl text-foreground text-sm border border-border"
                    placeholder="알고리즘 분류 검색 (e.g. DP, Greedy)"
                    placeholderTextColor={colors.muted}
                    value={tagSearchQuery}
                    onChangeText={setTagSearchQuery}
                  />
                </View>

                {availableTags && availableTags.length > 0 ? (
                  <View className="flex-row flex-wrap gap-2">
                    {filteredTags.slice(0, 15).map((tag) => {
                      const isSelected = tempSelectedTags.includes(tag.name);
                      const isWeak = tag.weakScore > 0.5;
                      return (
                        <TouchableOpacity
                          key={tag.name}
                          onPress={() => toggleTagSelection(tag.name)}
                          className="px-3 py-1.5 rounded-lg flex-row items-center gap-1 border"
                          style={{
                             backgroundColor: isSelected ? colors.tint + "15" : isWeak ? "#EF4444" + "15" : colors.surface,
                             borderColor: isSelected ? colors.tint : isWeak ? "#EF4444" + "50" : "transparent"
                          }}
                        >
                          {isWeak && <View className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                          <Text
                            style={{
                              color: isSelected ? colors.tint : isWeak ? "#EF4444" : colors.muted,
                              fontSize: 12,
                              fontWeight: "500",
                            }}
                          >
                            {tag.name}
                          </Text>
                          <Text style={{ color: colors.muted, fontSize: 11 }}>({tag.solvedCount})</Text>
                        </TouchableOpacity>
                      );
                    })}
                    {filteredTags.length > 15 && (
                       <Text className="text-xs text-muted mt-2 ml-1">...외 {filteredTags.length - 15}개</Text>
                    )}
                  </View>
                ) : (
                  <View className="p-4 rounded-lg bg-surface border border-border border-dashed">
                     <Text className="text-sm text-muted text-center">표시할 태그가 없습니다</Text>
                  </View>
                )}
              </View>

              {/* Exclude Solved Toggle */}
              <View className="border-t border-border pt-6 pb-6">
                <View className="flex-row items-center justify-between">
                  <View className="flex-col">
                    <Text className="text-base font-medium text-foreground">해결한 문제 제외</Text>
                    <Text className="text-xs text-muted mt-0.5">이미 푼 문제는 목록에서 숨깁니다.</Text>
                  </View>
                  <Switch
                    value={tempExcludeSolved}
                    onValueChange={setTempExcludeSolved}
                    trackColor={{ false: colors.border, true: colors.tint }}
                    thumbColor={"#ffffff"}
                  />
                </View>
              </View>

              <View className="h-10" />
            </ScrollView>

            {/* Footer Actions */}
            <View className="p-6 pt-4 border-t border-border bg-surface pb-8">
               <View className="flex-row gap-4">
                  <TouchableOpacity
                    onPress={resetFilters}
                    className="flex-1 py-3.5 px-4 rounded-xl bg-surface hover:bg-muted/10 items-center justify-center border border-border"
                  >
                    <Text className="text-sm font-semibold text-foreground">초기화 (Reset)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={applyFilters}
                    className="flex-[2] py-3.5 px-4 rounded-xl items-center justify-center shadow-lg"
                    style={{ backgroundColor: colors.tint, shadowColor: colors.tint, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }}
                  >
                    <Text className="text-sm font-semibold text-white">적용 (Apply)</Text>
                  </TouchableOpacity>
               </View>
            </View>
            
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
