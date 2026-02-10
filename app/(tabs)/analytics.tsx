import { ScrollView, Text, View, TextInput, TouchableOpacity } from "react-native";
import { useState } from "react";
import Svg, { Polygon, Line, Circle } from "react-native-svg";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/use-colors";

// Mock Data
const MOCK_TAG_STATS = [
  { tag: "많은 조건 분기", engTag: "Implementation", solved: 1, attempted: 1, rate: 100, recent: 1, status: "약점" },
  { tag: "사칙연산", engTag: "Arithmetic", solved: 9, attempted: 9, rate: 100, recent: 9, status: "강점" },
  { tag: "브루트포스 알고리즘", engTag: "Brute Force", solved: 1, attempted: 1, rate: 100, recent: 1, status: "평이" },
  { tag: "동적 계획법", engTag: "Dynamic Programming", solved: 4, attempted: 10, rate: 40, recent: 5, status: "약점" },
  { tag: "그래프 탐색", engTag: "BFS / DFS", solved: 15, attempted: 16, rate: 93, recent: 8, status: "강점" },
  { tag: "자료 구조", engTag: "Data Structures", solved: 3, attempted: 4, rate: 75, recent: 2, status: "평이" },
];

export default function AnalyticsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [filterStatus, setFilterStatus] = useState("모든 상태");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [sortOrder, setSortOrder] = useState("최근 30일 순");

  return (
    <View className="flex-1 bg-background-light dark:bg-background-dark">
      {/* Header - Custom implementation to match design */}
      <View
        className="bg-surface-light dark:bg-surface-dark shadow-sm border-b border-gray-200 dark:border-gray-800 z-20 px-4 sm:px-6 lg:px-8 flex-row items-center justify-between"
        style={{ paddingTop: insets.top, height: 60 + insets.top }}
      >
        <View className="flex-row items-center gap-3">
          <View className="w-8 h-8 rounded bg-primary items-center justify-center">
            <Text className="text-white font-bold text-lg">B</Text>
          </View>
          <Text className="text-xl font-bold tracking-tight text-text-main-light dark:text-text-main-dark">
            Baekjoon Analytics
          </Text>
        </View>
        <View className="flex-row items-center gap-4">
          <TouchableOpacity className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700">
            <MaterialIcons name="notifications" size={24} color={colors.muted || "#6b7280"} />
          </TouchableOpacity>
          <View className="w-8 h-8 rounded-full bg-gray-300 dark:bg-slate-600 overflow-hidden">
            {/* Placeholder Avatar */}
            <View className="w-full h-full bg-slate-400 items-center justify-center">
              <Text className="text-white text-xs">U</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
      >
        <View className="space-y-8">
          {/* Section Header */}
          <View className="space-y-2">
            <Text className="text-2xl font-bold text-text-main-light dark:text-text-main-dark">
              태그별 분석
            </Text>
            <Text className="text-text-sub-light dark:text-text-sub-dark">
              각 태그별 풀이 현황과 약점을 분석하여 균형 잡힌 코딩 실력을 완성하세요.
            </Text>
          </View>

          {/* Grid Layout - using flex wrap for responsiveness */}
          <View className="flex-col gap-6">

            {/* Radar Chart Card */}
            <View className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 items-center justify-center relative overflow-hidden">
              <Text className="w-full text-left text-lg font-semibold mb-4 text-text-main-light dark:text-text-main-dark">
                알고리즘 밸런스
              </Text>

              <View className="relative w-64 h-64 items-center justify-center">
                <Svg height="100%" width="100%" viewBox="0 0 100 100">
                  {/* Background Polygons */}
                  <Polygon
                    points="50,10 90,30 90,70 50,90 10,70 10,30"
                    stroke="#cbd5e1"
                    strokeWidth="0.5"
                    fill="none"
                  />
                  <Polygon
                    points="50,25 75,37.5 75,62.5 50,75 25,62.5 25,37.5"
                    stroke="#cbd5e1"
                    strokeWidth="0.5"
                    fill="none"
                  />
                  {/* Cross Lines */}
                  <Line x1="50" y1="50" x2="50" y2="10" stroke="#e2e8f0" strokeWidth="0.5" />
                  <Line x1="50" y1="50" x2="90" y2="30" stroke="#e2e8f0" strokeWidth="0.5" />
                  <Line x1="50" y1="50" x2="90" y2="70" stroke="#e2e8f0" strokeWidth="0.5" />
                  <Line x1="50" y1="50" x2="50" y2="90" stroke="#e2e8f0" strokeWidth="0.5" />
                  <Line x1="50" y1="50" x2="10" y2="70" stroke="#e2e8f0" strokeWidth="0.5" />
                  <Line x1="50" y1="50" x2="10" y2="30" stroke="#e2e8f0" strokeWidth="0.5" />

                  {/* Data Polygon */}
                  <Polygon
                    points="50,15 85,35 70,65 50,80 25,65 20,40"
                    fill="rgba(34, 197, 94, 0.2)"
                    stroke="#22c55e"
                    strokeWidth="2"
                  />

                  {/* Data Points */}
                  <Circle cx="50" cy="15" r="1.5" fill="#22c55e" />
                  <Circle cx="85" cy="35" r="1.5" fill="#22c55e" />
                  <Circle cx="70" cy="65" r="1.5" fill="#22c55e" />
                  <Circle cx="50" cy="80" r="1.5" fill="#22c55e" />
                  <Circle cx="25" cy="65" r="1.5" fill="#22c55e" />
                  <Circle cx="20" cy="40" r="1.5" fill="#22c55e" />
                </Svg>

                {/* Labels Layout - Absolute Positioning relative to container */}
                <Text className="absolute top-0 text-[10px] font-medium text-text-sub-light dark:text-text-sub-dark">구현</Text>
                <Text className="absolute top-[25%] right-0 text-[10px] font-medium text-text-sub-light dark:text-text-sub-dark">DP</Text>
                <Text className="absolute bottom-[25%] right-0 text-[10px] font-medium text-text-sub-light dark:text-text-sub-dark">탐색</Text>
                <Text className="absolute bottom-0 text-[10px] font-medium text-text-sub-light dark:text-text-sub-dark">수학</Text>
                <Text className="absolute bottom-[25%] left-0 text-[10px] font-medium text-text-sub-light dark:text-text-sub-dark">그리디</Text>
                <Text className="absolute top-[25%] left-0 text-[10px] font-medium text-text-sub-light dark:text-text-sub-dark">자료구조</Text>
              </View>
            </View>

            {/* Stats Cards Row */}
            <View className="flex-col sm:flex-row gap-4">

              {/* Weakness Card */}
              <View className="flex-1 bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 justify-between">
                <View>
                  <View className="flex-row items-center gap-2 mb-2">
                    <MaterialIcons name="warning" size={16} color="#fb923c" />
                    <Text className="text-sm font-medium text-text-sub-light dark:text-text-sub-dark uppercase tracking-wider">
                      주요 약점 태그
                    </Text>
                  </View>
                  <Text className="text-3xl font-bold text-text-main-light dark:text-text-main-dark">
                    많은 조건 분기
                  </Text>
                </View>
                <View className="mt-4">
                  <View className="flex-row justify-between text-sm mb-1">
                    <Text className="text-text-sub-light dark:text-text-sub-dark">성공률</Text>
                    <Text className="font-semibold text-orange-500">42%</Text>
                  </View>
                  <View className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                    <View className="bg-orange-400 h-2 rounded-full" style={{ width: "42%" }} />
                  </View>
                  <Text className="text-xs text-text-sub-light dark:text-text-sub-dark mt-2">
                    최근 30일 동안 시도 대비 성공률이 낮습니다.
                  </Text>
                </View>
              </View>

              {/* Study Volume Card */}
              <View className="flex-1 bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 justify-between">
                <View>
                  <View className="flex-row items-center gap-2 mb-2">
                    <MaterialIcons name="trending-up" size={16} color={colors.primary} />
                    <Text className="text-sm font-medium text-text-sub-light dark:text-text-sub-dark uppercase tracking-wider">
                      최근 학습량
                    </Text>
                  </View>
                  <Text className="text-3xl font-bold text-text-main-light dark:text-text-main-dark">
                    128 문제
                  </Text>
                </View>
                <View className="mt-4 flex-row items-end justify-between">
                  <View className="flex-row -space-x-2">
                    <View className="w-8 h-8 rounded-full bg-blue-500 items-center justify-center border-2 border-surface-light dark:border-surface-dark">
                      <Text className="text-[10px] text-white font-bold">G</Text>
                    </View>
                    <View className="w-8 h-8 rounded-full bg-gray-500 items-center justify-center border-2 border-surface-light dark:border-surface-dark">
                      <Text className="text-[10px] text-white font-bold">S</Text>
                    </View>
                    <View className="w-8 h-8 rounded-full bg-yellow-600 items-center justify-center border-2 border-surface-light dark:border-surface-dark">
                      <Text className="text-[10px] text-white font-bold">B</Text>
                    </View>
                  </View>
                  <Text className="text-xs text-primary font-medium">+12% vs last month</Text>
                </View>
              </View>

            </View>
          </View>

          {/* Search and Filters */}
          <View className="flex-col sm:flex-row gap-4 bg-surface-light dark:bg-surface-dark p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mt-8">
            <View className="flex-1 relative justify-center">
              <MaterialIcons name="search" size={20} color="#9ca3af" style={{ position: "absolute", left: 12, zIndex: 1 }} />
              <TextInput
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 focus:border-primary text-sm text-text-main-light dark:text-text-main-dark"
                placeholder="태그 검색..."
                placeholderTextColor="#9ca3af"
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-3">
              <View className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600">
                <Text className="text-sm text-text-main-light dark:text-text-main-dark">모든 상태</Text>
              </View>
              <View className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600">
                <Text className="text-sm text-text-main-light dark:text-text-main-dark">최근 30일 순</Text>
              </View>
            </ScrollView>
          </View>

          {/* Data Table */}
          <View className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-8">
            {/* Table Header */}
            <View className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-gray-700 flex-row px-4 py-3">
              <Text className="flex-[2] text-xs uppercase text-text-sub-light dark:text-text-sub-dark font-semibold">알고리즘 태그</Text>
              <Text className="flex-1 text-xs uppercase text-text-sub-light dark:text-text-sub-dark font-semibold text-center">해결 / 시도</Text>
              <Text className="flex-[1.5] text-xs uppercase text-text-sub-light dark:text-text-sub-dark font-semibold text-center hidden sm:flex">성공률</Text>
              <Text className="flex-1 text-xs uppercase text-text-sub-light dark:text-text-sub-dark font-semibold text-center">상태</Text>
            </View>

            {/* Table Rows */}
            {MOCK_TAG_STATS.map((item, index) => (
              <View key={index} className="flex-row items-center px-4 py-4 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                <View className="flex-[2]">
                  <Text className="font-medium text-text-main-light dark:text-text-main-dark text-sm">{item.tag}</Text>
                  <Text className="text-xs text-text-sub-light dark:text-text-sub-dark mt-0.5">{item.engTag}</Text>
                </View>

                <View className="flex-1 items-center">
                  <Text className="text-sm text-text-main-light dark:text-text-main-dark">{item.solved} / {item.attempted}</Text>
                  <Text className="text-xs text-muted sm:hidden">{item.rate}%</Text>
                </View>

                <View className="flex-[1.5] items-center px-2 hidden sm:flex">
                  <View className="w-full flex-row items-center gap-2">
                    <View className="flex-1 bg-gray-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                      <View
                        className={`h-full rounded-full ${item.rate < 50 ? 'bg-red-500' : item.rate < 80 ? 'bg-yellow-500' : 'bg-primary'}`}
                        style={{ width: `${item.rate}%` }}
                      />
                    </View>
                    <Text className={`text-xs font-medium ${item.rate < 50 ? 'text-red-500' : item.rate < 80 ? 'text-yellow-500' : 'text-primary'}`}>
                      {item.rate}%
                    </Text>
                  </View>
                </View>

                <View className="flex-1 items-center">
                  <View className={`px-2.5 py-0.5 rounded-full ${item.status === '약점' ? 'bg-orange-100 dark:bg-orange-900/30' :
                      item.status === '강점' ? 'bg-green-100 dark:bg-green-900/30' :
                        'bg-gray-100 dark:bg-slate-700'
                    }`}>
                    <Text className={`text-xs font-medium ${item.status === '약점' ? 'text-orange-800 dark:text-orange-300' :
                        item.status === '강점' ? 'text-green-800 dark:text-green-300' :
                          'text-gray-800 dark:text-gray-300'
                      }`}>
                      {item.status}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Pagination */}
          <View className="px-6 py-4 flex-row items-center justify-between">
            <Text className="text-xs text-text-sub-light dark:text-text-sub-dark">
              Showing <Text className="font-medium">1</Text> to <Text className="font-medium">6</Text> of <Text className="font-medium">28</Text> results
            </Text>
            <View className="flex-row gap-2">
              <TouchableOpacity className="px-3 py-1 border border-gray-200 dark:border-gray-700 rounded bg-transparent opacity-50" disabled>
                <Text className="text-sm text-text-main-light dark:text-text-main-dark">이전</Text>
              </TouchableOpacity>
              <TouchableOpacity className="px-3 py-1 border border-gray-200 dark:border-gray-700 rounded bg-transparent">
                <Text className="text-sm text-text-main-light dark:text-text-main-dark">다음</Text>
              </TouchableOpacity>
            </View>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}
