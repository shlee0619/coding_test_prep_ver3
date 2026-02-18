import { ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "1. 수집하는 개인정보 항목",
    items: [
      "계정 식별 정보: BOJ 핸들, 서비스 내부 식별자(openId)",
      "서비스 이용 정보: 동기화 이력, 추천/목표/문제 상태(북마크, 메모 포함)",
      "기술 정보: 접속 로그, 오류 로그(서비스 운영 및 보안 목적)",
    ],
  },
  {
    title: "2. 개인정보 이용 목적",
    items: [
      "사용자 인증 및 계정 관리",
      "문제 추천, 학습 분석, 목표 관리 기능 제공",
      "서비스 안정성 개선 및 장애 대응",
      "부정 이용 및 보안 위협 탐지/대응",
    ],
  },
  {
    title: "3. 보유 및 이용 기간",
    items: [
      "회원 탈퇴 시 지체 없이 파기합니다.",
      "법령상 보관 의무가 있는 정보는 해당 기간 보관 후 파기합니다.",
      "보안/감사 로그는 운영 정책에 따라 최소 기간 보관 후 파기합니다.",
    ],
  },
  {
    title: "4. 제3자 제공 및 처리위탁",
    items: [
      "원칙적으로 이용자 동의 없이 개인정보를 제3자에게 제공하지 않습니다.",
      "인프라 운영을 위해 처리위탁이 필요한 경우 수탁사와 업무 범위를 공개합니다.",
    ],
  },
  {
    title: "5. 이용자 권리",
    items: [
      "개인정보 열람, 정정, 삭제, 처리정지를 요구할 수 있습니다.",
      "계정 탈퇴 요청 시 관련 절차에 따라 처리합니다.",
    ],
  },
  {
    title: "6. 개인정보 보호 조치",
    items: [
      "접근권한 최소화 및 권한 통제",
      "전송 구간 암호화(HTTPS)",
      "비밀정보(시크릿) 안전 보관 및 정기 교체",
    ],
  },
];

export default function PrivacyPolicyScreen() {
  const colors = useColors();

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <Stack.Screen options={{ title: "개인정보처리방침" }} />

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
          <Text className="text-xl font-bold text-foreground mb-2">BOJ Helper 개인정보처리방침</Text>
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
          <Text className="text-base font-semibold text-foreground mb-2">7. 문의처</Text>
          <Text className="text-sm text-foreground mb-1">서비스명: BOJ Helper</Text>
          <Text className="text-sm text-foreground mb-1">사업자명: BOJ Helper Team</Text>
          <Text className="text-sm text-foreground">이메일: support@boj-helper.app</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
