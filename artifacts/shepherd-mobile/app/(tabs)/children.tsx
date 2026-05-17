import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useListChildren } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/auth";

export default function ChildrenScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isWeb = Platform.OS === "web";

  const { data, isLoading, isRefetching, refetch, isError } = useListChildren(
    { familyId: user?.familyId ?? undefined, limit: 50 },
    { query: { enabled: !!user?.familyId } }
  );

  const children = data?.data ?? [];

  const topPad = isWeb ? 67 : insets.top + 16;
  const botPad = isWeb ? 34 + 84 : insets.bottom + 84;

  const s = styles(colors);

  return (
    <View style={[s.root, { paddingTop: topPad }]}>
      <View style={s.header}>
        <Text style={s.title}>My Children</Text>
        <View style={[s.badge, { backgroundColor: colors.primary }]}>
          <Text style={s.badgeText}>{children.length}</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : isError ? (
        <View style={s.center}>
          <Feather name="alert-circle" size={40} color={colors.destructive} />
          <Text style={[s.emptyTitle, { color: colors.destructive, marginTop: 12 }]}>Failed to load</Text>
          <Pressable style={[s.retryBtn, { backgroundColor: colors.primary }]} onPress={() => refetch()}>
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : children.length === 0 ? (
        <View style={s.center}>
          <Feather name="users" size={48} color={colors.mutedForeground} />
          <Text style={s.emptyTitle}>No children registered</Text>
          <Text style={s.emptyText}>Contact your church admin to add your children.</Text>
        </View>
      ) : (
        <FlatList
          data={children}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: botPad, paddingHorizontal: 20 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [s.card, { backgroundColor: colors.card, opacity: pressed ? 0.85 : 1 }]}
              onPress={() => router.push(`/child/${item.id}`)}
            >
              <View style={[s.avatar, { backgroundColor: getAgeColor(item.dateOfBirth, colors) + "22" }]}>
                <Text style={[s.avatarText, { color: getAgeColor(item.dateOfBirth, colors) }]}>
                  {item.name.charAt(0).toUpperCase()}
                </Text>
              </View>

              <View style={s.info}>
                <Text style={s.childName}>{item.name}</Text>
                <Text style={[s.childMeta, { color: colors.mutedForeground }]}>
                  {item.gender === "male" ? "Boy" : item.gender === "female" ? "Girl" : ""}
                  {item.dateOfBirth ? ` · Age ${getAge(item.dateOfBirth)}` : ""}
                </Text>
                {item.allergies ? (
                  <View style={[s.allergyTag, { backgroundColor: "#fef3c7" }]}>
                    <Feather name="alert-triangle" size={10} color="#d97706" />
                    <Text style={s.allergyText}>Allergies</Text>
                  </View>
                ) : null}
              </View>

              <View style={s.right}>
                <View style={[s.statusDot, { backgroundColor: item.isActive ? colors.success : colors.muted }]} />
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} style={{ marginTop: 4 }} />
              </View>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </View>
  );
}

function getAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function getAgeColor(dob: string | null | undefined, colors: ReturnType<typeof useColors>): string {
  if (!dob) return colors.primary;
  const age = getAge(dob);
  if (age < 5) return "#10b981";
  if (age < 10) return "#3b82f6";
  return "#8b5cf6";
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 20,
      marginBottom: 20,
    },
    title: { fontSize: 24, fontFamily: "Inter_700Bold", color: colors.foreground },
    badge: {
      minWidth: 26,
      height: 26,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8,
    },
    badgeText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#ffffff" },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },
    emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: colors.foreground, textAlign: "center" },
    emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center", lineHeight: 20 },
    retryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: colors.radius },
    retryText: { color: "#ffffff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      padding: 16,
      borderRadius: colors.radius,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { fontSize: 22, fontFamily: "Inter_700Bold" },
    info: { flex: 1, gap: 3 },
    childName: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    childMeta: { fontSize: 13, fontFamily: "Inter_400Regular" },
    allergyTag: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 20,
      alignSelf: "flex-start",
      marginTop: 4,
    },
    allergyText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#d97706" },
    right: { alignItems: "center", gap: 4 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
  });
