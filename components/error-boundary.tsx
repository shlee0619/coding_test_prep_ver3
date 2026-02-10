import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { Sentry } from "@/lib/sentry";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const colors = useColors();
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
        backgroundColor: colors.background,
      }}
    >
      <Text
        style={{
          fontSize: 20,
          fontWeight: "700",
          color: colors.foreground,
          marginBottom: 12,
          textAlign: "center",
        }}
      >
        문제가 발생했습니다
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: colors.muted,
          textAlign: "center",
          marginBottom: 24,
          lineHeight: 22,
        }}
      >
        예상치 못한 오류가 발생했습니다.{"\n"}앱을 다시 시도해 주세요.
      </Text>
      <TouchableOpacity
        style={{
          backgroundColor: colors.tint,
          paddingHorizontal: 24,
          paddingVertical: 12,
          borderRadius: 24,
        }}
        onPress={onRetry}
        accessibilityLabel="다시 시도"
        accessibilityRole="button"
        accessibilityHint="오류 발생 시 앱을 다시 시도합니다"
      >
        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
          다시 시도
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
    Sentry.captureException(error, {
      extra: {
        componentStack: errorInfo.componentStack,
      },
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorFallback onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}
