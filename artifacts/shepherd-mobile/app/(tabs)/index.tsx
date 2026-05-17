import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useGetDashboardStats, useListAttendance, useGetMyFamily } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/auth";
import { Skeleton, SkeletonCard } from "@/components/Skeleton";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isWeb = Platform.OS === "web";

  const stats = useGetDashboardStats({ query: { staleTime: 30_000 } });
  const family = useGetMyFamily({ query: { enabled: user?.role === "parent" } });
  const attendance = useListAttendance(
    { familyId: user?.familyId ?? undefined, status: "checked_in" },
    { query: { enabled: !!user?.familyId } }
  );

  const isRefreshing = stats.isRefetching || family.isRefetching;
  const onRefresh = () => {
    stats.refetch();
    family.refetch();
    attendance.refetch();
  };

  const topPad = isWeb ? 67 : insets.top + 16;
  const botPad = isWeb ? 34 + 84 : insets.bottom + 84;

  const s = styles(colors);

  const greetHour = new Date().getHours();
  const greeting =
    greetHour < 12 ? "Good morning" : greetHour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.name?.split(" ")[0] ?? "there";

  const checkedInCount = Array.isArray(attendance.data?.data) ? attendance.data.data.length : 0;

  return (
    <ScrollView
      style={[s.root, { paddingTop: topPad }]}
      contentContainerStyle={{ paddingBottom: botPad }}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>{greeting},</Text>
          <Text style={s.name}>{firstName} 👋</Text>
        </View>
        <Pressable
          style={s.avatarBtn}
          onPress={() => router.push("/(tabs)/profile")}
        >
          <View style={[s.avatar, { backgroundColor: colors.primary }]}>
            <Text style={s.avatarText}>
              {(user?.name ?? "?").charAt(0).toUpperCase()}
            </Text>
          </View>
        </Pressable>
      </View>

      {checkedInCount > 0 && (
        <View style={[s.alertCard, { backgroundColor: "#fffbeb", borderColor: "#fcd34d" }]}>
          <Feather name="check-circle" size={20} color={colors.accent} />
          <Text style={[s.alertText, { color: "#92400e" }]}>
            {checkedInCount} child{checkedInCount > 1 ? "ren" : ""} currently checked in
          </Text>
        </View>
      )}

      <Text style={s.sectionTitle}>Today's Summary</Text>

      {stats.isLoading ? (
        <View style={s.statsGrid}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[s.statCard, { backgroundColor: colors.card }]}>
              <Skeleton height={32} width={60} style={{ marginBottom: 8 }} />
              <Skeleton height={12} width="80%" />
            </View>
          ))}
        </View>
      ) : (
        <View style={s.statsGrid}>
          <StatCard
            label="Checked In"
            value={stats.data?.checkedIn ?? 0}
            color={colors.primary}
            icon="log-in"
            colors={colors}
          />
          <StatCard
            label="Still Present"
            value={stats.data?.stillPresent ?? 0}
            color={colors.accent}
            icon="users"
            colors={colors}
          />
          <StatCard
            label="Picked Up"
            value={stats.data?.pickedUp ?? 0}
            color={colors.success}
            icon="log-out"
            colors={colors}
          />
          <StatCard
            label="Classes"
            value={stats.data?.totalClasses ?? 0}
            color="#8b5cf6"
            icon="book"
            colors={colors}
          />
        </View>
      )}

      <Text style={s.sectionTitle}>Quick Actions</Text>
      <View style={s.actionsGrid}>
        <QuickAction
          icon="users"
          label="My Children"
          onPress={() => router.push("/(tabs)/children")}
          bg="#eff6ff"
          fg={colors.primary}
          colors={colors}
        />
        <QuickAction
          icon="user-plus"
          label="Delegates"
          onPress={() => router.push("/delegates/index")}
          bg="#fef3c7"
          fg="#d97706"
          colors={colors}
        />
        <QuickAction
          icon="message-circle"
          label="Feedback"
          onPress={() => router.push("/feedback/index")}
          bg="#f0fdf4"
          fg="#059669"
          colors={colors}
        />
        <QuickAction
          icon="bell"
          label="Notifications"
          onPress={() => router.push("/(tabs)/notifications")}
          bg="#fdf4ff"
          fg="#9333ea"
          colors={colors}
        />
      </View>

      {family.data && (
        <>
          <Text style={s.sectionTitle}>My Family</Text>
          <View style={[s.familyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[s.familyIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="home" size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.familyName, { color: colors.foreground }]}>{family.data.name}</Text>
              <Text style={[s.familyMeta, { color: colors.mutedForeground }]}>
                {family.data.phone ?? "No phone on file"}
              </Text>
            </View>
            <Pressable onPress={() => router.push("/(tabs)/children")}>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>
        </>
      )}
    </ScrollView>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  color: string;
  icon: string;
  colors: ReturnType<typeof useColors>;
}
function StatCard({ label, value, color, icon, colors }: StatCardProps) {
  const s = StyleSheet.create({
    card: {
      flex: 1,
      minWidth: "45%",
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 16,
      gap: 8,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: color + "22",
      alignItems: "center",
      justifyContent: "center",
    },
    value: { fontSize: 28, fontFamily: "Inter_700Bold", color: colors.foreground },
    label: { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
  });
  return (
    <View style={s.card}>
      <View style={s.iconWrap}>
        <Feather name={icon as never} size={16} color={color} />
      </View>
      <Text style={s.value}>{value}</Text>
      <Text style={s.label}>{label}</Text>
    </View>
  );
}

interface QuickActionProps {
  icon: string;
  label: string;
  onPress: () => void;
  bg: string;
  fg: string;
  colors: ReturnType<typeof useColors>;
}
function QuickAction({ icon, label, onPress, bg, fg, colors }: QuickActionProps) {
  return (
    <Pressable
      style={({ pressed }) => ({
        flex: 1,
        minWidth: "45%",
        backgroundColor: bg,
        borderRadius: colors.radius,
        padding: 20,
        alignItems: "center",
        gap: 10,
        opacity: pressed ? 0.8 : 1,
        transform: pressed ? [{ scale: 0.97 }] : [],
      })}
      onPress={onPress}
    >
      <Feather name={icon as never} size={24} color={fg} />
      <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: fg }}>{label}</Text>
    </Pressable>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    greeting: { fontSize: 15, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    name: { fontSize: 24, fontFamily: "Inter_700Bold", color: colors.foreground },
    avatarBtn: {},
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#ffffff" },
    alertCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 14,
      borderRadius: colors.radius,
      borderWidth: 1,
      marginBottom: 20,
    },
    alertText: { fontSize: 14, fontFamily: "Inter_500Medium", flex: 1 },
    sectionTitle: {
      fontSize: 18,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginBottom: 14,
      marginTop: 4,
    },
    statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 28 },
    actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 28 },
    familyCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      padding: 16,
      borderRadius: colors.radius,
      borderWidth: 1,
      marginBottom: 24,
    },
    familyIcon: {
      width: 48,
      height: 48,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    familyName: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
    familyMeta: { fontSize: 13, fontFamily: "Inter_400Regular" },
  });
