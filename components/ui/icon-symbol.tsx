// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "chevron.up": "keyboard-arrow-up",
  "chevron.down": "keyboard-arrow-down",
  "doc.text": "description",
  "chart.bar.fill": "bar-chart",
  "lightbulb.fill": "lightbulb",
  "target": "track-changes",
  "gearshape.fill": "settings",
  "person.fill": "person",
  "link": "link",
  "sync": "sync",
  "bookmark.fill": "bookmark",
  "bookmark": "bookmark-border",
  "checkmark.circle.fill": "check-circle",
  "xmark.circle.fill": "cancel",
  "arrow.clockwise": "refresh",
  "arrow.triangle.2.circlepath": "sync",
  "arrow.up.right.square": "open-in-new",
  "plus": "add",
  "pencil": "edit",
  "trash": "delete",
  "arrow.right": "arrow-forward",
  "calendar": "calendar-month",
  "star.fill": "star",
  "info.circle": "info",
  "info.circle.fill": "info",
  "moon.fill": "dark-mode",
  "sun.max.fill": "light-mode",
  "flame.fill": "local-fire-department",
  "chart.bar.xaxis": "insert-chart",
  "person.2.fill": "groups",
  "note.text": "note",
  "exclamationmark.triangle": "warning",
  "exclamationmark.triangle.fill": "warning",
  "slider.horizontal.3": "tune",
  "line.3.horizontal.decrease.circle.fill": "filter-list",
  "magnifyingglass": "search",
  "xmark": "close",
  "list.bullet": "format-list-bulleted",
  "arrow.up.circle": "arrow-circle-up",
  "leaf.fill": "eco",
  "sparkles": "auto-awesome",
} satisfies Record<string, MaterialIconName>;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
