import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  useListPickupDelegates,
  useCreatePickupDelegate,
  useListChildren,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/auth";
import { useQueryClient } from "@tanstack/react-query";

interface DelegateFormState {
  delegateName: string;
  delegatePhone: string;
  relationship: string;
  childId: string;
}

export default function DelegatesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isWeb = Platform.OS === "web";

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<DelegateFormState>({
    delegateName: "",
    delegatePhone: "",
    relationship: "",
    childId: "",
  });
  const [lastOtp, setLastOtp] = useState<string | null>(null);

  const { data: delegatesData, isLoading, isRefetching, refetch } = useListPickupDelegates(
    { familyId: user?.familyId ?? undefined },
    { query: { enabled: !!user?.familyId } }
  );
  const { data: childrenData } = useListChildren(
    { familyId: user?.familyId ?? undefined, limit: 50 },
    { query: { enabled: !!user?.familyId } }
  );
  const createDelegate = useCreatePickupDelegate();

  const delegates = delegatesData?.data ?? [];
  const children = childrenData?.data ?? [];

  const botPad = isWeb ? 34 + 16 : insets.bottom + 16;
  const topPad = 16;

  const handleAdd = async () => {
    if (!form.delegateName.trim() || !form.childId) {
      Alert.alert("Missing fields", "Please enter delegate name and select a child.");
      return;
    }
    try {
      const result = await createDelegate.mutateAsync({
        data: {
          childId: parseInt(form.childId, 10),
          delegateName: form.delegateName.trim(),
          delegatePhone: form.delegatePhone.trim() || undefined,
          relationship: form.relationship.trim() || undefined,
        },
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/pickup-delegates"] });
      setShowAdd(false);
      setForm({ delegateName: "", delegatePhone: "", relationship: "", childId: "" });
      if (result.otp) {
        setLastOtp(result.otp);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add delegate.";
      Alert.alert("Error", msg);
    }
  };

  const s = styles(colors);

  return (
    <View style={[s.root, { paddingTop: topPad }]}>
      <View style={s.header}>
        <Text style={s.title}>Pickup Delegates</Text>
        <Pressable
          style={[s.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => setShowAdd(true)}
        >
          <Feather name="plus" size={18} color="#ffffff" />
        </Pressable>
      </View>

      {lastOtp && (
        <View style={[s.otpBanner, { backgroundColor: "#fffbeb", borderColor: "#fcd34d" }]}>
          <Feather name="key" size={18} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={s.otpTitle}>Delegate OTP Generated</Text>
            <Text style={s.otpCode}>{lastOtp}</Text>
            <Text style={s.otpHint}>Share this one-time code with your delegate. Valid for 24 hours.</Text>
          </View>
          <Pressable onPress={() => setLastOtp(null)}>
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>
      )}

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : delegates.length === 0 ? (
        <View style={s.center}>
          <Feather name="user-plus" size={48} color={colors.mutedForeground} />
          <Text style={s.emptyTitle}>No delegates yet</Text>
          <Text style={s.emptyText}>
            Add trusted adults who can pick up your children with a one-time OTP.
          </Text>
        </View>
      ) : (
        <FlatList
          data={delegates}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: botPad, paddingHorizontal: 20 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }
          renderItem={({ item }) => {
            const child = children.find((c) => c.id === item.childId);
            return (
              <View style={[s.card, { backgroundColor: colors.card }]}>
                <View style={[s.cardAvatar, { backgroundColor: colors.accent + "22" }]}>
                  <Text style={[s.cardAvatarText, { color: colors.accent }]}>
                    {(item.delegateName ?? "?").charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.cardName, { color: colors.foreground }]}>{item.delegateName}</Text>
                  {item.relationship && (
                    <Text style={[s.cardMeta, { color: colors.mutedForeground }]}>{item.relationship}</Text>
                  )}
                  {child && (
                    <Text style={[s.cardChild, { color: colors.primary }]}>For: {child.name}</Text>
                  )}
                </View>
                <View style={[s.statusChip, { backgroundColor: item.used ? "#f1f5f9" : "#dcfce7" }]}>
                  <Text style={[s.statusChipText, { color: item.used ? colors.mutedForeground : "#065f46" }]}>
                    {item.used ? "Used" : "Active"}
                  </Text>
                </View>
              </View>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}

      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: colors.background }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={[s.modalHeader, { paddingTop: insets.top + 16 }]}>
            <Text style={[s.modalTitle, { color: colors.foreground }]}>Add Delegate</Text>
            <Pressable onPress={() => setShowAdd(false)}>
              <Feather name="x" size={24} color={colors.foreground} />
            </Pressable>
          </View>

          <View style={s.modalBody}>
            <Text style={s.fieldLabel}>Delegate Name *</Text>
            <TextInput
              style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
              value={form.delegateName}
              onChangeText={(v) => setForm((f) => ({ ...f, delegateName: v }))}
              placeholder="Full name of delegate"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="words"
            />

            <Text style={s.fieldLabel}>Phone Number</Text>
            <TextInput
              style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
              value={form.delegatePhone}
              onChangeText={(v) => setForm((f) => ({ ...f, delegatePhone: v }))}
              placeholder="+234 800 000 0000"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="phone-pad"
            />

            <Text style={s.fieldLabel}>Relationship</Text>
            <TextInput
              style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
              value={form.relationship}
              onChangeText={(v) => setForm((f) => ({ ...f, relationship: v }))}
              placeholder="e.g. Uncle, Grandma, Neighbour"
              placeholderTextColor={colors.mutedForeground}
            />

            <Text style={s.fieldLabel}>Child *</Text>
            <View style={s.childPicker}>
              {children.map((c) => (
                <Pressable
                  key={c.id}
                  style={[
                    s.childChip,
                    {
                      backgroundColor: form.childId === String(c.id) ? colors.primary : colors.card,
                      borderColor: form.childId === String(c.id) ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setForm((f) => ({ ...f, childId: String(c.id) }))}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: "Inter_500Medium",
                      color: form.childId === String(c.id) ? "#ffffff" : colors.foreground,
                    }}
                  >
                    {c.name}
                  </Text>
                </Pressable>
              ))}
              {children.length === 0 && (
                <Text style={[s.fieldHint, { color: colors.mutedForeground }]}>
                  No children found. Contact your admin.
                </Text>
              )}
            </View>

            <Text style={[s.fieldHint, { color: colors.mutedForeground }]}>
              A one-time OTP will be generated and shown after saving. Share it with your delegate for pickup.
            </Text>

            <Pressable
              style={({ pressed }) => [s.submitBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
              onPress={handleAdd}
              disabled={createDelegate.isPending}
            >
              {createDelegate.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.submitText}>Add Delegate & Generate OTP</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
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
    title: { fontSize: 24, fontFamily: "Inter_700Bold", color: colors.foreground },
    addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    otpBanner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      padding: 14,
      borderRadius: colors.radius,
      borderWidth: 1,
      marginHorizontal: 20,
      marginBottom: 16,
    },
    otpTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#92400e", marginBottom: 2 },
    otpCode: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#92400e", letterSpacing: 3, marginBottom: 4 },
    otpHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#92400e" },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },
    emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: colors.foreground, textAlign: "center" },
    emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center", lineHeight: 20 },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: colors.radius,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    cardAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
    cardAvatarText: { fontSize: 18, fontFamily: "Inter_700Bold" },
    cardName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
    cardMeta: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 1 },
    cardChild: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
    statusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    statusChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
    modalBody: { padding: 20, gap: 6 },
    fieldLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginTop: 12, marginBottom: 6 },
    input: { borderWidth: 1, borderRadius: colors.radius, padding: 13, fontSize: 15, fontFamily: "Inter_400Regular" },
    fieldHint: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 8, lineHeight: 18 },
    childPicker: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
    childChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
    submitBtn: { marginTop: 24, padding: 16, borderRadius: colors.radius, alignItems: "center" },
    submitText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#ffffff" },
  });
