import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useGetChild, useGetChildQrCode, useListAttendance } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

export default function ChildDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const childId = parseInt(id ?? "0", 10);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const { data: child, isLoading } = useGetChild({ id: childId });
  const { data: qrData } = useGetChildQrCode({ id: childId });
  const { data: attendanceData } = useListAttendance(
    { childId, limit: 10 },
    { query: { enabled: !!childId } }
  );

  const recent = attendanceData?.data ?? [];

  const botPad = isWeb ? 34 + 16 : insets.bottom + 16;
  const s = styles(colors);

  if (isLoading) {
    return (
      <View style={[s.root, s.center]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!child) {
    return (
      <View style={[s.root, s.center]}>
        <Feather name="alert-circle" size={40} color={colors.destructive} />
        <Text style={[s.emptyTitle, { color: colors.destructive }]}>Child not found</Text>
        <Pressable style={[s.btn, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
          <Text style={s.btnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={{ paddingBottom: botPad, paddingHorizontal: 20, paddingTop: 16 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[s.heroCard, { backgroundColor: colors.card }]}>
        <View style={[s.avatar, { backgroundColor: colors.primary + "22" }]}>
          <Text style={[s.avatarText, { color: colors.primary }]}>
            {child.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={[s.childName, { color: colors.foreground }]}>{child.name}</Text>
        {child.dateOfBirth && (
          <Text style={[s.childMeta, { color: colors.mutedForeground }]}>
            Age {getAge(child.dateOfBirth)} · {child.gender === "male" ? "Boy" : child.gender === "female" ? "Girl" : ""}
          </Text>
        )}
        <View style={[s.statusRow]}>
          <View style={[s.statusBadge, { backgroundColor: child.isActive ? "#d1fae5" : colors.muted }]}>
            <View style={[s.statusDot, { backgroundColor: child.isActive ? "#10b981" : colors.mutedForeground }]} />
            <Text style={[s.statusText, { color: child.isActive ? "#065f46" : colors.mutedForeground }]}>
              {child.isActive ? "Active" : "Inactive"}
            </Text>
          </View>
        </View>
      </View>

      {child.allergies && (
        <View style={[s.alertCard, { backgroundColor: "#fef3c7", borderColor: "#fcd34d" }]}>
          <Feather name="alert-triangle" size={16} color="#d97706" />
          <View style={{ flex: 1 }}>
            <Text style={s.alertTitle}>Allergy Alert</Text>
            <Text style={s.alertText}>{child.allergies}</Text>
          </View>
        </View>
      )}

      {child.medicalNotes && (
        <View style={[s.alertCard, { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }]}>
          <Feather name="info" size={16} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[s.alertTitle, { color: colors.primary }]}>Medical Notes</Text>
            <Text style={[s.alertText, { color: "#1e40af" }]}>{child.medicalNotes}</Text>
          </View>
        </View>
      )}

      {qrData && (
        <>
          <Text style={s.sectionTitle}>Check-In QR Code</Text>
          <View style={[s.qrCard, { backgroundColor: colors.card }]}>
            <Text style={[s.qrHint, { color: colors.mutedForeground }]}>
              Show this QR code to the attendant at the check-in kiosk
            </Text>
            {qrData.qrCodeUrl ? (
              <Image
                source={{ uri: qrData.qrCodeUrl }}
                style={s.qrImage}
                resizeMode="contain"
              />
            ) : (
              <View style={[s.qrPlaceholder, { backgroundColor: colors.muted }]}>
                <Feather name="grid" size={48} color={colors.mutedForeground} />
                <Text style={[s.qrToken, { color: colors.foreground }]}>{qrData.token}</Text>
              </View>
            )}
            <Text style={[s.qrToken, { color: colors.foreground, textAlign: "center" }]}>
              Token: {qrData.token}
            </Text>
          </View>
        </>
      )}

      {recent.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Recent Attendance</Text>
          <View style={[s.attendanceCard, { backgroundColor: colors.card }]}>
            {recent.slice(0, 5).map((rec, i) => (
              <View key={rec.id}>
                <View style={s.attendanceRow}>
                  <View style={[s.attIcon, { backgroundColor: getAttColor(rec.status) + "22" }]}>
                    <Feather name={getAttIcon(rec.status) as never} size={14} color={getAttColor(rec.status)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.attStatus, { color: colors.foreground }]}>
                      {formatStatus(rec.status)}
                    </Text>
                    <Text style={[s.attDate, { color: colors.mutedForeground }]}>
                      {rec.checkInTime ? new Date(rec.checkInTime).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : ""}
                    </Text>
                  </View>
                  {rec.checkInTime && (
                    <Text style={[s.attTime, { color: colors.mutedForeground }]}>
                      {new Date(rec.checkInTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  )}
                </View>
                {i < Math.min(recent.length, 5) - 1 && (
                  <View style={[s.divider, { backgroundColor: colors.border }]} />
                )}
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
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

function getAttColor(status: string | null | undefined): string {
  switch (status) {
    case "checked_in": return "#10b981";
    case "checked_out": return "#3b82f6";
    case "absent": return "#ef4444";
    default: return "#94a3b8";
  }
}

function getAttIcon(status: string | null | undefined): string {
  switch (status) {
    case "checked_in": return "log-in";
    case "checked_out": return "log-out";
    case "absent": return "x-circle";
    default: return "circle";
  }
}

function formatStatus(status: string | null | undefined): string {
  switch (status) {
    case "checked_in": return "Checked In";
    case "checked_out": return "Checked Out";
    case "absent": return "Absent";
    default: return status ?? "";
  }
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    center: { alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },
    heroCard: {
      borderRadius: colors.radius,
      padding: 24,
      alignItems: "center",
      gap: 8,
      marginBottom: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    avatar: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
    avatarText: { fontSize: 28, fontFamily: "Inter_700Bold" },
    childName: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center" },
    childMeta: { fontSize: 14, fontFamily: "Inter_400Regular" },
    statusRow: { flexDirection: "row", marginTop: 4 },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 20,
    },
    statusDot: { width: 7, height: 7, borderRadius: 4 },
    statusText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
    alertCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      padding: 14,
      borderRadius: colors.radius,
      borderWidth: 1,
      marginBottom: 12,
    },
    alertTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#92400e", marginBottom: 2 },
    alertText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#92400e" },
    sectionTitle: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      marginBottom: 8,
      marginTop: 12,
    },
    qrCard: {
      borderRadius: colors.radius,
      padding: 20,
      alignItems: "center",
      gap: 14,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
      marginBottom: 8,
    },
    qrHint: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
    qrImage: { width: 180, height: 180 },
    qrPlaceholder: {
      width: 180,
      height: 180,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
    },
    qrToken: { fontSize: 14, fontFamily: "Inter_600SemiBold", letterSpacing: 2 },
    attendanceCard: {
      borderRadius: colors.radius,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
      marginBottom: 8,
    },
    attendanceRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
    attIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    attStatus: { fontSize: 14, fontFamily: "Inter_500Medium" },
    attDate: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
    attTime: { fontSize: 12, fontFamily: "Inter_400Regular" },
    divider: { height: 1, marginLeft: 58 },
    btn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: colors.radius, marginTop: 8 },
    btnText: { color: "#ffffff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
    emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  });
