import React, { useEffect, useRef } from "react";
import { Animated, View, ViewStyle } from "react-native";
import { useColors } from "@/hooks/use-colors";

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = "100%", height = 20, borderRadius = 8, style }: SkeletonProps) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: colors.muted,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  const colors = useColors();

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
        <Skeleton width={40} height={40} borderRadius={20} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Skeleton width="60%" height={16} style={{ marginBottom: 8 }} />
          <Skeleton width="40%" height={12} />
        </View>
      </View>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? "70%" : "100%"}
          height={14}
          style={{ marginBottom: i < lines - 1 ? 8 : 0 }}
        />
      ))}
    </View>
  );
}

export function SkeletonList({ count = 3, lines = 2 }: { count?: number; lines?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={lines} />
      ))}
    </View>
  );
}

export function SkeletonKPICard() {
  const colors = useColors();

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        flex: 1,
        minWidth: 100,
      }}
    >
      <Skeleton width="50%" height={12} style={{ marginBottom: 8 }} />
      <Skeleton width="70%" height={24} style={{ marginBottom: 4 }} />
      <Skeleton width="40%" height={10} />
    </View>
  );
}

export function DashboardSkeleton() {
  const colors = useColors();

  return (
    <View style={{ padding: 16 }}>
      {/* Profile Card Skeleton */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Skeleton width={64} height={64} borderRadius={32} />
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Skeleton width="50%" height={20} style={{ marginBottom: 8 }} />
            <Skeleton width="70%" height={14} style={{ marginBottom: 4 }} />
            <Skeleton width="40%" height={12} />
          </View>
        </View>
      </View>

      {/* KPI Cards Skeleton */}
      <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
        <SkeletonKPICard />
        <SkeletonKPICard />
        <SkeletonKPICard />
      </View>

      {/* Weakness Section Skeleton */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 12,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Skeleton width="40%" height={18} style={{ marginBottom: 16 }} />
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <Skeleton width={24} height={24} borderRadius={12} />
            <Skeleton width="50%" height={14} style={{ marginLeft: 12, flex: 1 }} />
            <Skeleton width={60} height={20} borderRadius={10} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function AnalyticsSkeleton() {
  const colors = useColors();

  return (
    <View style={{ padding: 16 }}>
      <Skeleton width="30%" height={24} style={{ marginBottom: 16 }} />
      <SkeletonList count={6} lines={2} />
    </View>
  );
}

export function RecommendationsSkeleton() {
  const colors = useColors();

  return (
    <View style={{ padding: 16 }}>
      <Skeleton width="40%" height={24} style={{ marginBottom: 16 }} />

      {/* Category Tabs Skeleton */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} width={60} height={32} borderRadius={16} />
        ))}
      </View>

      {/* Stats Card Skeleton */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <View key={i} style={{ alignItems: "center" }}>
              <Skeleton width={40} height={24} style={{ marginBottom: 4 }} />
              <Skeleton width={50} height={12} />
            </View>
          ))}
        </View>
      </View>

      {/* Recommendation Cards Skeleton */}
      <SkeletonList count={4} lines={3} />
    </View>
  );
}
