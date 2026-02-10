import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput, Modal } from "react-native";
import { useState, useCallback } from "react";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

export default function GoalsScreen() {
  const colors = useColors();
  const { showToast } = useToast();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: "",
    type: "problem_count" as "problem_count" | "tag_focus",
    targetValue: "",
    days: "7",
    selectedTags: [] as string[],
  });

  const { data: goals, isLoading, refetch } = trpc.goals.list.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const { data: tagStats } = trpc.analytics.tags.useQuery(
    undefined,
    { enabled: isAuthenticated && showModal }
  );

  const createMutation = trpc.goals.create.useMutation({
    onSuccess: () => {
      refetch();
      setShowModal(false);
      setNewGoal({ title: "", type: "problem_count", targetValue: "", days: "7", selectedTags: [] });
      showToast({ type: "success", message: "목표가 추가되었습니다" });
    },
    onError: (err) => {
      showToast({ type: "error", message: err.message || "목표 추가에 실패했습니다" });
    },
  });

  const updateMutation = trpc.goals.update.useMutation({
    onSuccess: () => refetch(),
    onError: (err) => {
      showToast({ type: "error", message: err.message || "목표 수정에 실패했습니다" });
    },
  });

  const deleteMutation = trpc.goals.delete.useMutation({
    onSuccess: () => refetch(),
    onError: (err) => {
      showToast({ type: "error", message: err.message || "목표 삭제에 실패했습니다" });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleCreateGoal = async () => {
    if (!newGoal.title || !newGoal.targetValue) return;
    if (newGoal.type === "tag_focus" && newGoal.selectedTags.length === 0) return;

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + parseInt(newGoal.days || "7"));

    await createMutation.mutateAsync({
      title: newGoal.title,
      type: newGoal.type,
      targetValue: parseInt(newGoal.targetValue),
      targetTags: newGoal.type === "tag_focus" ? newGoal.selectedTags : undefined,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });
  };

  const toggleTagSelection = (tagName: string) => {
    setNewGoal((prev) => ({
      ...prev,
      selectedTags: prev.selectedTags.includes(tagName)
        ? prev.selectedTags.filter((t) => t !== tagName)
        : [...prev.selectedTags, tagName],
    }));
  };

  const handleCompleteGoal = async (goalId: number) => {
    await updateMutation.mutateAsync({ goalId, status: "completed" });
  };

  const handleDeleteGoal = async (goalId: number) => {
    await deleteMutation.mutateAsync({ goalId });
  };

  if (!authLoading && !isAuthenticated) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center">
          <Text className="text-lg text-muted">로그인이 필요합니다</Text>
        </View>
      </ScreenContainer>
    );
  }

  const activeGoals = goals?.filter((g: any) => g.status === "active") || [];
  const completedGoals = goals?.filter((g: any) => g.status === "completed") || [];

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
            <Text className="text-2xl font-bold text-foreground">학습 목표</Text>
            <Text className="text-sm text-muted mt-1">
              목표를 설정하고 진행 상황을 추적하세요
            </Text>
          </View>
          <TouchableOpacity
            className="bg-primary rounded-full p-3"
            onPress={() => setShowModal(true)}
          >
            <IconSymbol name="plus" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" color={colors.tint} />
          </View>
        ) : (
          <>
            {/* Active Goals */}
            <View className="mb-6">
              <Text className="text-lg font-semibold text-foreground mb-3">진행 중</Text>
              {activeGoals.length > 0 ? (
                <View className="gap-3">
                  {activeGoals.map((goal: any) => {
                    const progress = goal.targetValue > 0
                      ? Math.min((goal.currentValue / goal.targetValue) * 100, 100)
                      : 0;
                    const daysLeft = Math.max(0, Math.ceil(
                      (new Date(goal.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                    ));

                    return (
                      <View
                        key={goal.id}
                        className="bg-surface rounded-xl p-4 border border-border"
                      >
                        <View className="flex-row items-start justify-between mb-2">
                          <View className="flex-1">
                            <Text className="text-base font-medium text-foreground">{goal.title}</Text>
                            <Text className="text-sm text-muted">
                              {goal.type === "problem_count" ? "문제 풀이" : "태그 집중"}
                            </Text>
                          </View>
                          <View className="flex-row gap-2">
                            <TouchableOpacity
                              onPress={() => handleCompleteGoal(goal.id)}
                              style={{ padding: 4 }}
                            >
                              <IconSymbol name="checkmark.circle.fill" size={24} color={colors.success} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleDeleteGoal(goal.id)}
                              style={{ padding: 4 }}
                            >
                              <IconSymbol name="trash" size={20} color={colors.error} />
                            </TouchableOpacity>
                          </View>
                        </View>

                        <View className="flex-row items-center justify-between mb-2">
                          <Text className="text-sm text-foreground">
                            {goal.currentValue} / {goal.targetValue}
                          </Text>
                          <Text className="text-sm text-muted">
                            {daysLeft}일 남음
                          </Text>
                        </View>

                        {/* Progress Bar */}
                        <View className="h-2 bg-border rounded-full overflow-hidden">
                          <View
                            className="h-full rounded-full"
                            style={{
                              width: `${progress}%`,
                              backgroundColor: colors.tint,
                            }}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View className="bg-surface rounded-xl p-6 border border-border items-center">
                  <Text className="text-muted text-center">진행 중인 목표가 없습니다</Text>
                </View>
              )}
            </View>

            {/* Completed Goals */}
            {completedGoals.length > 0 && (
              <View>
                <Text className="text-lg font-semibold text-foreground mb-3">완료됨</Text>
                <View className="gap-3">
                  {completedGoals.slice(0, 5).map((goal: any) => (
                    <View
                      key={goal.id}
                      className="bg-surface rounded-xl p-4 border border-border opacity-60"
                    >
                      <View className="flex-row items-center gap-2">
                        <IconSymbol name="checkmark.circle.fill" size={20} color={colors.success} />
                        <Text className="text-base font-medium text-foreground">{goal.title}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Create Goal Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-background rounded-t-3xl p-6">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-foreground">새 목표 만들기</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <View className="gap-4">
              <View>
                <Text className="text-sm font-medium text-foreground mb-2">목표 제목</Text>
                <TextInput
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                  placeholder="예: 이번 주 10문제 풀기"
                  placeholderTextColor={colors.muted}
                  value={newGoal.title}
                  onChangeText={(text) => setNewGoal({ ...newGoal, title: text })}
                />
              </View>

              <View>
                <Text className="text-sm font-medium text-foreground mb-2">목표 유형</Text>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    className={`flex-1 py-3 rounded-xl border ${
                      newGoal.type === "problem_count" ? "bg-primary border-primary" : "bg-surface border-border"
                    }`}
                    onPress={() => setNewGoal({ ...newGoal, type: "problem_count", selectedTags: [] })}
                  >
                    <Text className={`text-center font-medium ${
                      newGoal.type === "problem_count" ? "text-background" : "text-foreground"
                    }`}>
                      문제 풀이
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className={`flex-1 py-3 rounded-xl border ${
                      newGoal.type === "tag_focus" ? "bg-primary border-primary" : "bg-surface border-border"
                    }`}
                    onPress={() => setNewGoal({ ...newGoal, type: "tag_focus" })}
                  >
                    <Text className={`text-center font-medium ${
                      newGoal.type === "tag_focus" ? "text-background" : "text-foreground"
                    }`}>
                      태그 집중
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {newGoal.type === "tag_focus" && (
                <View>
                  <Text className="text-sm font-medium text-foreground mb-2">집중할 태그 선택</Text>
                  <Text className="text-xs text-muted mb-3">
                    선택한 태그의 풀이 수가 목표 수량에 반영됩니다
                  </Text>
                  {tagStats && tagStats.length > 0 ? (
                    <ScrollView
                      style={{ maxHeight: 180 }}
                      showsVerticalScrollIndicator={true}
                      nestedScrollEnabled={true}
                    >
                      <View className="flex-row flex-wrap gap-2">
                        {tagStats.map((stat) => {
                          const isSelected = newGoal.selectedTags.includes(stat.tag);
                          const isWeak = (stat.weakScore || 0) > 0.5;
                          return (
                            <TouchableOpacity
                              key={stat.tag}
                              onPress={() => toggleTagSelection(stat.tag)}
                              className="px-3 py-2 rounded-lg flex-row items-center gap-1"
                              style={{
                                backgroundColor: isSelected ? colors.tint : colors.surface,
                                borderWidth: 1,
                                borderColor: isSelected ? colors.tint : isWeak ? colors.error + "50" : colors.border,
                              }}
                            >
                              {isWeak && !isSelected && (
                                <View
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: colors.error }}
                                />
                              )}
                              <Text
                                style={{
                                  color: isSelected ? "#fff" : colors.foreground,
                                  fontSize: 13,
                                  fontWeight: isSelected ? "600" : "400",
                                }}
                              >
                                {stat.tag}
                              </Text>
                              <Text
                                style={{
                                  color: isSelected ? "rgba(255,255,255,0.7)" : colors.muted,
                                  fontSize: 11,
                                }}
                              >
                                ({stat.solvedCount})
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </ScrollView>
                  ) : (
                    <View className="p-4 rounded-lg" style={{ backgroundColor: colors.surface }}>
                      <Text className="text-sm text-muted text-center">
                        동기화 후 태그를 선택할 수 있습니다
                      </Text>
                    </View>
                  )}
                  {newGoal.selectedTags.length > 0 && (
                    <View className="mt-2 p-2 rounded-lg" style={{ backgroundColor: colors.tint + "10" }}>
                      <Text style={{ color: colors.tint, fontSize: 12 }}>
                        {newGoal.selectedTags.length}개 태그 선택됨: {newGoal.selectedTags.join(", ")}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <View className="flex-row gap-4">
                <View className="flex-1">
                  <Text className="text-sm font-medium text-foreground mb-2">목표 수량</Text>
                  <TextInput
                    className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                    placeholder="10"
                    placeholderTextColor={colors.muted}
                    keyboardType="numeric"
                    value={newGoal.targetValue}
                    onChangeText={(text) => setNewGoal({ ...newGoal, targetValue: text })}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium text-foreground mb-2">기간 (일)</Text>
                  <TextInput
                    className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                    placeholder="7"
                    placeholderTextColor={colors.muted}
                    keyboardType="numeric"
                    value={newGoal.days}
                    onChangeText={(text) => setNewGoal({ ...newGoal, days: text })}
                  />
                </View>
              </View>

              <TouchableOpacity
                className="bg-primary rounded-full py-4 mt-4"
                onPress={handleCreateGoal}
                disabled={
                  createMutation.isPending ||
                  !newGoal.title ||
                  !newGoal.targetValue ||
                  (newGoal.type === "tag_focus" && newGoal.selectedTags.length === 0)
                }
                style={{ opacity: createMutation.isPending ? 0.7 : 1 }}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-background font-semibold text-center">목표 만들기</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
