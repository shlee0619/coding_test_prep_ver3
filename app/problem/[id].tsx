import React, { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { TierBadge } from "@/components/tier-badge";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { getTierName } from "@/shared/types";
import { useToast } from "@/components/ui/toast";

export default function ProblemDetailScreen() {
  const { id, from, reasons: reasonsParam } = useLocalSearchParams<{
    id: string;
    from?: string;
    reasons?: string;
  }>();
  const router = useRouter();
  const colors = useColors();
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const problemId = parseInt(id, 10);
  const [note, setNote] = useState("");
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [showContent, setShowContent] = useState(false);

  // Parse reasons from query param
  const reasons: string[] = reasonsParam ? JSON.parse(decodeURIComponent(reasonsParam)) : [];

  // Fetch problem data
  const { data: problem, isLoading, error } = trpc.problems.get.useQuery(
    { problemId },
    { enabled: !!problemId && isAuthenticated }
  );

  // 문제 본문 (2-2): 펼칠 때만 로드
  const { data: content, isLoading: contentLoading } = trpc.problems.getContent.useQuery(
    { problemId },
    { enabled: showContent && !!problemId && isAuthenticated }
  );

  // Mutations
  const utils = trpc.useUtils();

  const toggleBookmarkMutation = trpc.problems.toggleBookmark.useMutation({
    onSuccess: (data) => {
      utils.problems.get.invalidate({ problemId });
      showToast({
        type: "success",
        message: data.isBookmarked ? "북마크에 추가되었습니다" : "북마크가 해제되었습니다",
      });
    },
    onError: () => {
      showToast({ type: "error", message: "북마크 변경에 실패했습니다" });
    },
  });

  const updateStatusMutation = trpc.problems.updateStatus.useMutation({
    onSuccess: () => {
      utils.problems.get.invalidate({ problemId });
      showToast({ type: "success", message: "풀이 상태가 업데이트되었습니다" });
    },
    onError: () => {
      showToast({ type: "error", message: "상태 변경에 실패했습니다" });
    },
  });

  const updateNoteMutation = trpc.problems.updateNote.useMutation({
    onSuccess: () => {
      utils.problems.get.invalidate({ problemId });
      setIsEditingNote(false);
      showToast({ type: "success", message: "메모가 저장되었습니다" });
    },
    onError: () => {
      showToast({ type: "error", message: "메모 저장에 실패했습니다" });
    },
  });

  const handleOpenBOJ = () => {
    Linking.openURL(`https://www.acmicpc.net/problem/${problemId}`);
  };

  const handleToggleBookmark = () => {
    toggleBookmarkMutation.mutate({ problemId });
  };

  const handleMarkAsSolved = () => {
    Alert.alert(
      "풀이 완료",
      "이 문제를 풀었음으로 표시할까요?",
      [
        { text: "취소", style: "cancel" },
        {
          text: "확인",
          onPress: () => updateStatusMutation.mutate({ problemId, status: "SOLVED" }),
        },
      ]
    );
  };

  const handleSaveNote = () => {
    updateNoteMutation.mutate({ problemId, note: note.trim() });
  };

  React.useEffect(() => {
    if (problem?.userStatus?.note) {
      setNote(problem.userStatus.note ?? "");
    }
  }, [problem?.userStatus?.note]);

  if (isLoading) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ title: "문제 상세" }} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      </ScreenContainer>
    );
  }

  if (error || !problem) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ title: "문제 상세" }} />
        <View className="flex-1 items-center justify-center p-6">
          <IconSymbol name="exclamationmark.triangle" size={48} color={colors.muted} />
          <Text className="text-muted mt-4 text-center">
            문제 정보를 불러올 수 없습니다
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="mt-4 bg-primary px-6 py-3 rounded-full"
          >
            <Text className="text-background font-semibold">돌아가기</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const isSolved = problem.userStatus?.status === "SOLVED";
  const isBookmarked = problem.userStatus?.isBookmarked || false;

  return (
    <ScreenContainer>
      <Stack.Screen
        options={{
          title: `#${problemId}`,
          headerRight: () => (
            <TouchableOpacity onPress={handleToggleBookmark} style={{ padding: 8 }}>
              <IconSymbol
                name={isBookmarked ? "bookmark.fill" : "bookmark"}
                size={24}
                color={isBookmarked ? colors.warning : colors.muted}
              />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Problem Header */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 16,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 12 }}>
            <TierBadge tier={problem.level} size="large" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.muted,
                  marginBottom: 4,
                }}
              >
                #{problemId}
              </Text>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: colors.foreground,
                }}
              >
                {problem.title}
              </Text>
            </View>
            {isSolved && (
              <View
                style={{
                  backgroundColor: colors.success + "20",
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 12,
                }}
              >
                <Text style={{ color: colors.success, fontSize: 12, fontWeight: "600" }}>
                  해결함
                </Text>
              </View>
            )}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <IconSymbol name="person.2.fill" size={14} color={colors.muted} />
              <Text style={{ color: colors.muted, fontSize: 13, marginLeft: 4 }}>
                {problem.acceptedUserCount?.toLocaleString() || 0}명 해결
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <IconSymbol name="arrow.triangle.2.circlepath" size={14} color={colors.muted} />
              <Text style={{ color: colors.muted, fontSize: 13, marginLeft: 4 }}>
                평균 {problem.averageTries?.toFixed(1) || 0}회 시도
              </Text>
            </View>
          </View>
        </View>

        {/* Tags */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.foreground,
              marginBottom: 12,
            }}
          >
            알고리즘 태그
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {problem.tags?.map((tag, idx) => (
              <View
                key={idx}
                style={{
                  backgroundColor: colors.tint + "15",
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 6,
                }}
              >
                <Text style={{ color: colors.tint, fontSize: 13 }}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Problem content (2-2): 지문·예제 */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 16,
          }}
        >
          <TouchableOpacity
            onPress={() => setShowContent((v) => !v)}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <IconSymbol name="doc.text" size={18} color={colors.muted} />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: colors.foreground,
                  marginLeft: 8,
                }}
              >
                문제 본문 보기
              </Text>
            </View>
            <IconSymbol
              name={showContent ? "chevron.up" : "chevron.down"}
              size={18}
              color={colors.muted}
            />
          </TouchableOpacity>
          {showContent && (
            <View style={{ marginTop: 12 }}>
              {contentLoading ? (
                <ActivityIndicator size="small" color={colors.tint} />
              ) : content ? (
                <View style={{ gap: 16 }}>
                  {content.descriptionHtml != null && content.descriptionHtml !== "" && (
                    <View>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "600",
                          color: colors.muted,
                          marginBottom: 6,
                        }}
                      >
                        문제
                      </Text>
                      <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 22 }}>
                        {content.descriptionHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()}
                      </Text>
                    </View>
                  )}
                  {content.sampleInput != null && content.sampleInput !== "" && (
                    <View>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "600",
                          color: colors.muted,
                          marginBottom: 6,
                        }}
                      >
                        예제 입력
                      </Text>
                      <Text
                        style={{
                          color: colors.foreground,
                          fontSize: 13,
                          fontFamily: "monospace",
                          backgroundColor: colors.background,
                          padding: 12,
                          borderRadius: 8,
                        }}
                      >
                        {content.sampleInput}
                      </Text>
                    </View>
                  )}
                  {content.sampleOutput != null && content.sampleOutput !== "" && (
                    <View>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "600",
                          color: colors.muted,
                          marginBottom: 6,
                        }}
                      >
                        예제 출력
                      </Text>
                      <Text
                        style={{
                          color: colors.foreground,
                          fontSize: 13,
                          fontFamily: "monospace",
                          backgroundColor: colors.background,
                          padding: 12,
                          borderRadius: 8,
                        }}
                      >
                        {content.sampleOutput}
                      </Text>
                    </View>
                  )}
                  {(!content.descriptionHtml || content.descriptionHtml === "") &&
                    (!content.sampleInput || content.sampleInput === "") &&
                    (!content.sampleOutput || content.sampleOutput === "") && (
                      <Text style={{ color: colors.muted, fontSize: 13 }}>
                        본문을 불러올 수 없습니다.
                      </Text>
                    )}
                </View>
              ) : (
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  본문을 불러올 수 없습니다. BOJ에서 확인하세요.
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Recommendation Reasons */}
        {reasons.length > 0 && (
          <View
            style={{
              backgroundColor: colors.tint + "10",
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.tint + "30",
              marginBottom: 16,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <IconSymbol name="lightbulb.fill" size={18} color={colors.tint} />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: colors.tint,
                  marginLeft: 8,
                }}
              >
                추천 이유
              </Text>
            </View>
            {reasons.map((reason, idx) => (
              <View key={idx} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 6 }}>
                <Text style={{ color: colors.tint, marginRight: 8 }}>•</Text>
                <Text style={{ color: colors.foreground, fontSize: 14, flex: 1 }}>{reason}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Note Section */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 16,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <IconSymbol name="note.text" size={18} color={colors.muted} />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: colors.foreground,
                  marginLeft: 8,
                }}
              >
                메모
              </Text>
            </View>
            {!isEditingNote && (
              <TouchableOpacity onPress={() => setIsEditingNote(true)}>
                <Text style={{ color: colors.tint, fontSize: 14 }}>
                  {note ? "수정" : "추가"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {isEditingNote ? (
            <View>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="문제에 대한 메모를 작성하세요..."
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={4}
                style={{
                  backgroundColor: colors.background,
                  borderRadius: 8,
                  padding: 12,
                  color: colors.foreground,
                  fontSize: 14,
                  minHeight: 100,
                  textAlignVertical: "top",
                }}
              />
              <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 12, gap: 8 }}>
                <TouchableOpacity
                  onPress={() => {
                    setIsEditingNote(false);
                    setNote(problem.userStatus?.note || "");
                  }}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.foreground }}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveNote}
                  disabled={updateNoteMutation.isPending}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: colors.tint,
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "600" }}>
                    {updateNoteMutation.isPending ? "저장 중..." : "저장"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={{ color: note ? colors.foreground : colors.muted, fontSize: 14 }}>
              {note || "메모가 없습니다"}
            </Text>
          )}
        </View>

        {/* Action Buttons */}
        <View style={{ gap: 12 }}>
          <TouchableOpacity
            onPress={handleOpenBOJ}
            style={{
              backgroundColor: colors.tint,
              padding: 16,
              borderRadius: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconSymbol name="arrow.up.right.square" size={20} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16, marginLeft: 8 }}>
              BOJ에서 풀기
            </Text>
          </TouchableOpacity>

          {!isSolved && (
            <TouchableOpacity
              onPress={handleMarkAsSolved}
              disabled={updateStatusMutation.isPending}
              style={{
                backgroundColor: colors.success,
                padding: 16,
                borderRadius: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconSymbol name="checkmark.circle.fill" size={20} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16, marginLeft: 8 }}>
                {updateStatusMutation.isPending ? "처리 중..." : "풀었음으로 표시"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
