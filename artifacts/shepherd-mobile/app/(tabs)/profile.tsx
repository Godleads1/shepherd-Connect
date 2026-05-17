import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useGetCurrentUser, useUpdateUser } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/auth";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user: authUser, logout } = useAuth();
  const isWeb = Platform.OS === "web";

  const { data: user, isLoading, refetch } = useGetCurrentUser({ query: { staleTime: 60_000 } });
  const updateMutation = useUpdateUser();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const topPad = isWeb ? 67 : insets.top + 16;
  const botPad = isWeb ? 34 + 84 : insets.bottom + 84;

  const handleEdit = () => {
    setName(user?.name ?? "");
    setPhone(user?.phone ?? "");
    setEditing(true);
  };

  const handleSave = async () => {
    if (!authUser) return;
    try {
      await updateMutation.mutateAsync({
        id: authUser.userId,
        data: { name: name.trim() || undefined, phone: phone.trim() || undefined },
      });
      await refetch();
      setEditing(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Failed to save changes.");
    }
  };

  const handleLogout = async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const s = styles(colors);

  return (
    <ScrollView
      style={[s.root, { paddingTop: topPad }]}
      contentContainerStyle={{ paddingBottom: botPad }}
      showsVerticalScrollIndicator={false}
    >
      <View style={s.header}>
        <Text style={s.title}>Profile</Text>
        {!editing && (
          <Pressable onPress={handleEdit} style={s.editBtn}>
            <Feather name="edit-2" size={16} color={colors.primary} />
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <>
          <View style={[s.profileCard, { backgroundColor: colors.card }]}>
            <View style={[s.avatar, { backgroundColor: colors.primary }]}>
              <Text style={s.avatarText}>
                {(user?.name ?? "?").charAt(0).toUpperCase()}
              </Text>
            </View>
            {editing ? (
              <View style={s.editFields}>
                <TextInput
                  style={[s.editInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Full name"
                  placeholderTextColor={colors.mutedForeground}
                />
                <TextInput
                  style={[s.editInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Phone number"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="phone-pad"
                />
                <View style={s.editActions}>
                  <Pressable
                    style={[s.saveBtn, { backgroundColor: colors.primary }]}
                    onPress={handleSave}
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={s.saveBtnText}>Save</Text>
                    )}
                  </Pressable>
                  <Pressable
                    style={[s.cancelBtn, { borderColor: colors.border }]}
                    onPress={() => setEditing(false)}
                  >
                    <Text style={[s.cancelBtnText, { color: colors.foreground }]}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={s.profileInfo}>
                <Text style={s.userName}>{user?.name}</Text>
                <Text style={[s.userEmail, { color: colors.mutedForeground }]}>{user?.email}</Text>
                <View style={[s.roleBadge, { backgroundColor: colors.secondary }]}>
                  <Text style={[s.roleText, { color: colors.primary }]}>
                    {(user?.role ?? "").replace("_", " ").toUpperCase()}
                  </Text>
                </View>
              </View>
            )}
          </View>

          <Text style={s.sectionTitle}>Contact</Text>
          <View style={[s.infoCard, { backgroundColor: colors.card }]}>
            <InfoRow icon="mail" label="Email" value={user?.email ?? "—"} colors={colors} />
            <View style={[s.divider, { backgroundColor: colors.border }]} />
            <InfoRow icon="phone" label="Phone" value={user?.phone ?? "Not set"} colors={colors} />
          </View>

          <Text style={s.sectionTitle}>Actions</Text>
          <View style={[s.actionsCard, { backgroundColor: colors.card }]}>
            <ActionRow
              icon="users"
              label="Pickup Delegates"
              color={colors.accent}
              onPress={() => router.push("/delegates/index")}
              colors={colors}
            />
            <View style={[s.divider, { backgroundColor: colors.border }]} />
            <ActionRow
              icon="message-circle"
              label="Share Feedback"
              color="#059669"
              onPress={() => router.push("/feedback/index")}
              colors={colors}
            />
            <View style={[s.divider, { backgroundColor: colors.border }]} />
            <ActionRow
              icon="log-out"
              label="Sign Out"
              color={colors.destructive}
              onPress={handleLogout}
              colors={colors}
              destructive
            />
          </View>

          <Text style={[s.version, { color: colors.mutedForeground }]}>Shepherd Connect v1.0.0</Text>
        </>
      )}
    </ScrollView>
  );
}

interface InfoRowProps {
  icon: string;
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}
function InfoRow({ icon, label, value, colors }: InfoRowProps) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16 }}>
      <Feather name={icon as never} size={18} color={colors.mutedForeground} />
      <View>
        <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{label}</Text>
        <Text style={{ fontSize: 15, fontFamily: "Inter_500Medium", color: colors.foreground, marginTop: 1 }}>{value}</Text>
      </View>
    </View>
  );
}

interface ActionRowProps {
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
  destructive?: boolean;
}
function ActionRow({ icon, label, color, onPress, colors, destructive }: ActionRowProps) {
  return (
    <Pressable
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        padding: 16,
        opacity: pressed ? 0.7 : 1,
      })}
      onPress={onPress}
    >
      <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: color + "22", alignItems: "center", justifyContent: "center" }}>
        <Feather name={icon as never} size={16} color={color} />
      </View>
      <Text style={{ flex: 1, fontSize: 15, fontFamily: "Inter_500Medium", color: destructive ? color : colors.foreground }}>
        {label}
      </Text>
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
    title: { fontSize: 24, fontFamily: "Inter_700Bold", color: colors.foreground },
    editBtn: { padding: 8 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
    profileCard: {
      borderRadius: colors.radius,
      padding: 20,
      alignItems: "center",
      gap: 16,
      marginBottom: 28,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { fontSize: 32, fontFamily: "Inter_700Bold", color: "#ffffff" },
    profileInfo: { alignItems: "center", gap: 4 },
    userName: { fontSize: 20, fontFamily: "Inter_700Bold", color: colors.foreground },
    userEmail: { fontSize: 14, fontFamily: "Inter_400Regular" },
    roleBadge: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 20,
      marginTop: 6,
    },
    roleText: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
    editFields: { width: "100%", gap: 10 },
    editInput: {
      borderWidth: 1,
      borderRadius: colors.radius,
      padding: 12,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
    },
    editActions: { flexDirection: "row", gap: 10 },
    saveBtn: {
      flex: 1,
      padding: 12,
      borderRadius: colors.radius,
      alignItems: "center",
    },
    saveBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
    cancelBtn: {
      flex: 1,
      padding: 12,
      borderRadius: colors.radius,
      alignItems: "center",
      borderWidth: 1,
    },
    cancelBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
    sectionTitle: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      marginBottom: 8,
    },
    infoCard: {
      borderRadius: colors.radius,
      marginBottom: 28,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    actionsCard: {
      borderRadius: colors.radius,
      marginBottom: 28,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    divider: { height: 1, marginLeft: 62 },
    version: { textAlign: "center", fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 16 },
  });
