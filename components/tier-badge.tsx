import { View, Text, StyleSheet } from "react-native";
import { getTierName, getTierColor } from "@/shared/types";

interface TierBadgeProps {
  tier: number;
  size?: "small" | "medium" | "large";
  showName?: boolean;
}

export function TierBadge({ tier, size = "medium", showName = false }: TierBadgeProps) {
  const color = getTierColor(tier);
  const name = getTierName(tier);
  
  const sizeStyles = {
    small: { width: 20, height: 20, fontSize: 10 },
    medium: { width: 28, height: 28, fontSize: 12 },
    large: { width: 40, height: 40, fontSize: 16 },
  };
  
  const { width, height, fontSize } = sizeStyles[size];
  
  // Get tier level (1-5 within each tier group)
  const tierLevel = tier === 0 ? "?" : tier <= 30 ? ((tier - 1) % 5) + 1 : "M";
  
  return (
    <View style={styles.container}>
      <View
        style={[
          styles.badge,
          {
            width,
            height,
            backgroundColor: color,
          },
        ]}
      >
        <Text style={[styles.text, { fontSize, color: "#FFFFFF" }]}>
          {tierLevel}
        </Text>
      </View>
      {showName && (
        <Text style={[styles.name, { color }]}>{name}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  badge: {
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontWeight: "bold",
  },
  name: {
    fontSize: 14,
    fontWeight: "600",
  },
});
