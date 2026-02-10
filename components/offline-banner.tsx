import { View, Text } from "react-native";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useColors } from "@/hooks/use-colors";

/**
 * Banner shown when the app is offline.
 * Renders nothing when online.
 */
export function OfflineBanner() {
  const isOnline = useNetworkStatus();
  const colors = useColors();

  if (isOnline) return null;

  return (
    <View
      style={{
        backgroundColor: colors.error ?? "#dc2626",
        paddingVertical: 8,
        paddingHorizontal: 16,
        alignItems: "center",
      }}
      accessibilityLabel="오프라인입니다. 일부 기능이 제한될 수 있습니다."
      accessibilityRole="alert"
    >
      <Text
        style={{
          color: "#fff",
          fontSize: 14,
          fontWeight: "600",
        }}
      >
        오프라인입니다. 일부 기능이 제한될 수 있습니다.
      </Text>
    </View>
  );
}
