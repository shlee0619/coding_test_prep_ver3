import React, { useEffect, useState } from "react";
import { Modal, View, Text, Animated, TouchableOpacity } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "./ui/icon-symbol";
import { trpc } from "@/lib/trpc";

interface SyncProgressModalProps {
  visible: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export function SyncProgressModal({ visible, onClose, onComplete }: SyncProgressModalProps) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("동기화 준비 중...");
  const [status, setStatus] = useState<"QUEUED" | "RUNNING" | "SUCCESS" | "FAILED">("QUEUED");
  const animatedProgress = React.useRef(new Animated.Value(0)).current;

  const { data: syncStatus, refetch } = trpc.sync.status.useQuery(undefined, {
    enabled: visible,
    refetchInterval: visible && status !== "SUCCESS" && status !== "FAILED" ? 1000 : false,
  });

  // 동기화 완료 시 모든 관련 쿼리 무효화
  const invalidateAllQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [["dashboard"]] }),
      queryClient.invalidateQueries({ queryKey: [["recommendations"]] }),
      queryClient.invalidateQueries({ queryKey: [["analytics"]] }),
      queryClient.invalidateQueries({ queryKey: [["goals"]] }),
      queryClient.invalidateQueries({ queryKey: [["sync"]] }),
    ]);
  };

  useEffect(() => {
    if (!syncStatus) return;

    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    setProgress(syncStatus.progress);
    setMessage(syncStatus.message || getDefaultMessage(syncStatus.status, syncStatus.progress));
    setStatus(syncStatus.status);

    Animated.timing(animatedProgress, {
      toValue: syncStatus.progress / 100,
      duration: 300,
      useNativeDriver: false,
    }).start();

    if (syncStatus.status === "SUCCESS") {
      // 동기화 완료 시 모든 관련 쿼리 무효화
      invalidateAllQueries().then(() => {
        if (!mounted) return;
        timeoutId = setTimeout(() => {
          if (!mounted) return;
          onComplete?.();
          onClose();
        }, 1500);
      });
    }

    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [syncStatus, animatedProgress, onComplete, onClose]);

  useEffect(() => {
    if (visible) {
      setProgress(0);
      setMessage("동기화 준비 중...");
      setStatus("QUEUED");
      animatedProgress.setValue(0);
    }
  }, [visible]);

  const getDefaultMessage = (status: string, progress: number): string => {
    switch (status) {
      case "QUEUED":
        return "동기화 대기 중...";
      case "RUNNING":
        if (progress < 10) return "프로필 정보 가져오는 중...";
        if (progress < 30) return "풀이 목록 조회 중...";
        if (progress < 60) return "문제 정보 수집 중...";
        if (progress < 80) return "태그 분석 중...";
        if (progress < 95) return "추천 생성 중...";
        return "마무리 중...";
      case "SUCCESS":
        return "동기화 완료!";
      case "FAILED":
        return "동기화 실패";
      default:
        return "처리 중...";
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "SUCCESS":
        return <IconSymbol name="checkmark.circle.fill" size={48} color={colors.success} />;
      case "FAILED":
        return <IconSymbol name="xmark.circle.fill" size={48} color={colors.error} />;
      default:
        return <IconSymbol name="arrow.triangle.2.circlepath" size={48} color={colors.tint} />;
    }
  };

  const progressWidth = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 20,
            padding: 24,
            width: "100%",
            maxWidth: 320,
            alignItems: "center",
          }}
        >
          {/* Icon */}
          <View style={{ marginBottom: 20 }}>{getStatusIcon()}</View>

          {/* Title */}
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: colors.foreground,
              marginBottom: 8,
            }}
          >
            {status === "SUCCESS" ? "동기화 완료" : status === "FAILED" ? "동기화 실패" : "데이터 동기화"}
          </Text>

          {/* Message */}
          <Text
            style={{
              fontSize: 14,
              color: colors.muted,
              textAlign: "center",
              marginBottom: 20,
            }}
          >
            {message}
          </Text>

          {/* Progress Bar */}
          {status !== "SUCCESS" && status !== "FAILED" && (
            <View style={{ width: "100%", marginBottom: 16 }}>
              <View
                style={{
                  height: 8,
                  backgroundColor: colors.border,
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <Animated.View
                  style={{
                    height: "100%",
                    backgroundColor: colors.tint,
                    borderRadius: 4,
                    width: progressWidth,
                  }}
                />
              </View>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.muted,
                  textAlign: "center",
                  marginTop: 8,
                }}
              >
                {progress}%
              </Text>
            </View>
          )}

          {/* Close Button (only when done or failed) */}
          {(status === "SUCCESS" || status === "FAILED") && (
            <TouchableOpacity
              onPress={onClose}
              style={{
                backgroundColor: status === "SUCCESS" ? colors.tint : colors.error,
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 8,
                marginTop: 8,
              }}
              accessibilityLabel={status === "SUCCESS" ? "확인" : "닫기"}
              accessibilityRole="button"
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>
                {status === "SUCCESS" ? "확인" : "닫기"}
              </Text>
            </TouchableOpacity>
          )}

          {/* Cancel Button (while running) */}
          {status !== "SUCCESS" && status !== "FAILED" && (
            <TouchableOpacity
              onPress={onClose}
              style={{ marginTop: 8, padding: 8 }}
              accessibilityLabel="백그라운드에서 계속"
              accessibilityRole="button"
            >
              <Text style={{ color: colors.muted, fontSize: 14 }}>백그라운드에서 계속</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}
