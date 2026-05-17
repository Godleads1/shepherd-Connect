import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
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

import { useListNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useQueryClient } from "@tanstack/react-query";

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const isWeb = Platform.OS === "web";
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const { data, isLoading, isRefetching, refetch, isError } = useListNotifications(
    { unreadOnly: showUnreadOnly, limit: 50 },
    { query: { staleTime: 15_000 } }
  );

  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = data?.data ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const topPad = isWeb ? 67 : insets.top + 16;
  const botPad = isWeb ? 34 + 84 : insets.bottom + 84;

  const s = styles(colors);

  const handleMarkAll = async () => {
    await markAllRead.mutateAsync({});
    queryClient.invalidateQueries({ queryKey: ["/notifications"] });
  };

  const handleMarkRead = async (id: number) => {
    if (!notifications.find((n) => n.id === id && !n.readStatus)) return;
    await markRead.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: ["/notifications"] });
  };

  return (
    <View style={[s.root, { paddingTop: topPad }]}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.title}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={[s.badge, { backgroundColor: colors.accent }]}>
              <Text style={s.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <Pressable onPress={handleMarkAll} style={({ pressed }) => [s.markAllBtn, pressed && { opacity: 0.7 }]}>
            <Text style={[s.markAllText, { color: colors.primary }]}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      <View style={[s.filterRow, { backgroundColor: colors.muted }]}>
        <Pressable
          style={[s.filterTab, !showUnreadOnly && { backgroundColor: colors.card }]}
          onPress={() => setShowUnreadOnly(false)}
        >
          <Text style={[s.filterText, { color: !showUnreadOnly ? colors.primary : colors.mutedForeground }]}>
            All
          </Text>
        </Pressable>
        <Pressable
          style={[s.filterTab, showUnreadOnly && { backgroundColor: colors.card }]}
          onPress={() => setShowUnreadOnly(true)}
        >
          <Text style={[s.filterText, { color: showUnreadOnly ? colors.primary : colors.mutedForeground }]}>
            Unread
          </Text>
        </Pressable>
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
      ) : notifications.length === 0 ? (
        <View style={s.center}>
          <Feather name="bell-off" size={48} color={colors.mutedForeground} />
          <Text style={s.emptyTitle}>
            {showUnreadOnly ? "No unread notifications" : "All caught up!"}
          </Text>
          <Text style={s.emptyText}>New messages from your church will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: botPad, paddingHorizontal: 20 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleMarkRead(item.id)}
              style={({ pressed }) => [
                s.notifCard,
                {
                  backgroundColor: item.readStatus ? colors.card : colors.primary + "0d",
                  borderLeftColor: item.readStatus ? colors.border : colors.primary,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={[s.iconWrap, { backgroundColor: getTypeColor(item.type) + "22" }]}>
                <Feather name={getTypeIcon(item.type) as never} size={16} color={getTypeColor(item.type)} />
              </View>
              <View style={s.notifBody}>
                <Text style={[s.notifTitle, { color: colors.foreground, fontFamily: item.readStatus ? "Inter_500Medium" : "Inter_700Bold" }]}>
                  {item.title}
                </Text>
                <Text style={[s.notifMessage, { color: colors.mutedForeground }]} numberOfLines={2}>
                  {item.message}
                </Text>
                <Text style={[s.notifTime, { color: colors.mutedForeground }]}>
                  {formatTime(item.createdAt)}
                </Text>
              </View>
              {!item.readStatus && (
                <View style={[s.unreadDot, { backgroundColor: colors.primary }]} />
              )}
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </View>
  );
}

function getTypeIcon(type: string | null | undefined): string {
  switch (type) {
    case "check_in": return "log-in";
    case "check_out": return "log-out";
    case "emergency": return "alert-octagon";
    case "pre_dismissal": return "clock";
    case "feedback_prompt": return "message-square";
    default: return "bell";
  }
}

function getTypeColor(type: string | null | undefined): string {
  switch (type) {
    case "emergency": return "#ef4444";
    case "pre_dismissal": return "#f59e0b";
    case "check_in": return "#10b981";
    case "check_out": return "#3b82f6";
    default: return "#8b5cf6";
  }
}

function formatTime(ts: string | Date | null | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
    title: { fontSize: 24, fontFamily: "Inter_700Bold", color: colors.foreground },
    badge: {
      minWidth: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 6,
    },
    badgeText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#ffffff" },
    markAllBtn: { paddingVertical: 6, paddingHorizontal: 10 },
    markAllText: { fontSize: 13, fontFamily: "Inter_500Medium" },
    filterRow: {
      flexDirection: "row",
      marginHorizontal: 20,
      marginBottom: 16,
      borderRadius: 10,
      padding: 3,
    },
    filterTab: {
      flex: 1,
      paddingVertical: 7,
      alignItems: "center",
      borderRadius: 8,
    },
    filterText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },
    emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: colors.foreground, textAlign: "center" },
    emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center", lineHeight: 20 },
    retryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: colors.radius },
    retryText: { color: "#ffffff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
    notifCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      padding: 14,
      borderRadius: colors.radius,
      borderLeftWidth: 3,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    notifBody: { flex: 1, gap: 3 },
    notifTitle: { fontSize: 14, lineHeight: 20 },
    notifMessage: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
    notifTime: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
    unreadDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, flexShrink: 0 },
  });
