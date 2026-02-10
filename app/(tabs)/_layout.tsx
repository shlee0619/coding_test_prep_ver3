import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "대시보드",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
          tabBarAccessibilityLabel: "대시보드 탭",
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: "분석",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.bar.fill" color={color} />,
          tabBarAccessibilityLabel: "분석 탭",
        }}
      />
      <Tabs.Screen
        name="recommendations"
        options={{
          title: "추천",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="lightbulb.fill" color={color} />,
          tabBarAccessibilityLabel: "추천 탭",
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: "목표",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="target" color={color} />,
          tabBarAccessibilityLabel: "목표 탭",
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "설정",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="gearshape.fill" color={color} />,
          tabBarAccessibilityLabel: "설정 탭",
        }}
      />
    </Tabs>
  );
}
