import { ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "1. 목적",
    items: [
      "본 약관은 SolveMate가 제공하는 서비스 이용과 관련한 권리, 의무 및 책임사항을 규정합니다.",
    ],
  },
  {
    title: "2. 정의",
    items: [
      "서비스: BOJ 학습 데이터 분석/추천/목표 기능을 포함한 애플리케이션 및 관련 API",
      "이용자: 본 약관에 따라 서비스를 이용하는 회원",
    ],
  },
  {
    title: "3. 약관의 게시와 개정",
    items: [
      "서비스는 본 약관을 앱/웹에 게시합니다.",
      "법령 또는 서비스 변경 시 약관을 개정할 수 있으며 변경 사항을 사전 고지합니다.",
    ],
  },
  {
    title: "4. 서비스 제공 및 변경",
    items: [
      "서비스는 학습 분석, 추천, 동기화, 목표 관리 기능을 제공합니다.",
      "운영상/기술상 필요 시 기능이 변경 또는 중단될 수 있습니다.",
    ],
  },
  {
    title: "5. 이용자의 의무",
    items: [
      "타인의 계정 또는 인증정보를 무단 사용해서는 안 됩니다.",
      "비정상 요청, 자동화 남용, 침해 시도 등 운영 방해 행위를 금지합니다.",
    ],
  },
  {
    title: "6. 서비스 제공자의 의무",
    items: [
      "안정적인 서비스 제공을 위해 노력합니다.",
      "개인정보 보호 관련 법령을 준수합니다.",
    ],
  },
  {
    title: "7. 책임 제한",
    items: [
      "천재지변, 불가항력, 이용자 귀책 사유로 인한 손해에 대해 책임이 제한될 수 있습니다.",
      "외부 연동 서비스 장애로 인해 일시적 기능 제한이 발생할 수 있습니다.",
    ],
  },
  {
    title: "8. 계약 해지 및 이용 제한",
    items: [
      "이용자는 언제든지 탈퇴를 요청할 수 있습니다.",
      "약관 위반 시 서비스 이용을 제한하거나 계약을 해지할 수 있습니다.",
    ],
  },
  {
    title: "9. 준거법 및 관할",
    items: [
      "본 약관은 대한민국 법률을 준거법으로 합니다.",
      "분쟁 발생 시 관련 법령이 정한 관할 법원을 따릅니다.",
    ],
  },
];

export default function TermsOfServiceScreen() {
  const colors = useColors();

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <Stack.Screen options={{ title: "이용약관" }} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <Text className="text-xl font-bold text-foreground mb-2">SolveMate 이용약관</Text>
          <Text className="text-sm text-muted">시행일: 2026-02-17</Text>
        </View>

        {SECTIONS.map((section) => (
          <View
            key={section.title}
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 16,
              padding: 16,
              marginBottom: 12,
            }}
          >
            <Text className="text-base font-semibold text-foreground mb-2">{section.title}</Text>
            {section.items.map((item) => (
              <Text key={item} className="text-sm text-foreground mb-1">
                {`\u2022 ${item}`}
              </Text>
            ))}
          </View>
        ))}

        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 16,
            padding: 16,
          }}
        >
          <Text className="text-base font-semibold text-foreground mb-2">10. 사업자 정보/연락처</Text>
          <Text className="text-sm text-foreground mb-1">서비스명: SolveMate</Text>
          <Text className="text-sm text-foreground mb-1">사업자명: SolveMate Team</Text>
          <Text className="text-sm text-foreground">이메일: support@solvemate.app</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
