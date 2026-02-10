import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { Animated, Text, View, TouchableOpacity, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconSymbol } from "./icon-symbol";
import { useColors } from "@/hooks/use-colors";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  action?: {
    label: string;
    onPress: () => void;
  };
}

interface ToastContextType {
  showToast: (toast: Omit<Toast, "id">) => void;
  hideToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

function ToastItem({ toast, onHide }: { toast: Toast; onHide: () => void }) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  const typeConfig = {
    success: {
      icon: "checkmark.circle.fill" as const,
      bgColor: colors.success + "15",
      borderColor: colors.success,
      iconColor: colors.success,
    },
    error: {
      icon: "xmark.circle.fill" as const,
      bgColor: colors.error + "15",
      borderColor: colors.error,
      iconColor: colors.error,
    },
    info: {
      icon: "info.circle.fill" as const,
      bgColor: colors.tint + "15",
      borderColor: colors.tint,
      iconColor: colors.tint,
    },
    warning: {
      icon: "exclamationmark.triangle.fill" as const,
      bgColor: colors.warning + "15",
      borderColor: colors.warning,
      iconColor: colors.warning,
    },
  };

  const config = typeConfig[toast.type];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    const duration = toast.duration || 3000;
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -20,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => onHide());
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }],
        marginBottom: 8,
        backgroundColor: config.bgColor,
        borderWidth: 1,
        borderColor: config.borderColor,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}
    >
      <IconSymbol name={config.icon} size={20} color={config.iconColor} />
      <Text
        style={{
          flex: 1,
          marginLeft: 12,
          fontSize: 14,
          color: colors.foreground,
          fontWeight: "500",
        }}
      >
        {toast.message}
      </Text>
      {toast.action && (
        <TouchableOpacity
          onPress={() => {
            toast.action?.onPress();
            onHide();
          }}
          style={{
            marginLeft: 12,
            paddingHorizontal: 12,
            paddingVertical: 6,
            backgroundColor: config.borderColor,
            borderRadius: 6,
          }}
          accessibilityLabel={toast.action.label}
          accessibilityRole="button"
        >
          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>
            {toast.action.label}
          </Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        onPress={onHide}
        style={{ marginLeft: 8, padding: 4 }}
        accessibilityLabel="토스트 닫기"
        accessibilityRole="button"
      >
        <IconSymbol name="xmark" size={16} color={colors.muted} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const insets = useSafeAreaInsets();

  const showToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      <View
        style={{
          position: "absolute",
          top: insets.top + 10,
          left: 16,
          right: 16,
          zIndex: 9999,
          pointerEvents: "box-none",
        }}
      >
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onHide={() => hideToast(toast.id)}
          />
        ))}
      </View>
    </ToastContext.Provider>
  );
}
