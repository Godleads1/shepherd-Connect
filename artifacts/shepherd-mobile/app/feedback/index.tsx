import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSubmitFeedback } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/auth";

const CATEGORIES = ["Teaching Quality", "Child Safety", "Staff Attitude", "Facilities", "Communication", "Overall Experience"];

const RATINGS = [
  { value: 1, emoji: "😞", label: "Poor" },
  { value: 2, emoji: "😕", label: "Fair" },
  { value: 3, emoji: "😊", label: "Good" },
  { value: 4, emoji: "😄", label: "Great" },
  { value: 5, emoji: "🤩", label: "Excellent" },
];

export default function FeedbackScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const createFeedback = useSubmitFeedback();
  const isWeb = Platform.OS === "web";

  const [rating, setRating] = useState<number>(0);
  const [category, setCategory] = useState("");
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const topPad = isWeb ? 67 : insets.top;

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert("Rating required", "Please select a rating before submitting.");
      return;
    }
    try {
      await createFeedback.mutateAsync({
        data: {
          rating,
          category: category || "General",
          comment: comment.trim() || undefined,
          isAnonymous: false,
        },
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit feedback.";
      Alert.alert("Error", msg);
    }
  };

  const s = styles(colors);

  if (submitted) {
    return (
      <View style={[s.root, s.center, { paddingTop: topPad }]}>
        <View style={[s.successCircle, { backgroundColor: "#d1fae5" }]}>
          <Feather name="check" size={40} color="#059669" />
        </View>
        <Text style={[s.successTitle, { color: colors.foreground }]}>Thank You!</Text>
        <Text style={[s.successText, { color: colors.mutedForeground }]}>
          Your feedback helps us improve every week. We appreciate your time.
        </Text>
        <Pressable
          style={[s.doneBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.back()}
        >
          <Text style={s.doneBtnText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[s.scrollContent, { paddingTop: topPad + 16, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.heading}>Share Your Feedback</Text>
        <Text style={[s.subheading, { color: colors.mutedForeground }]}>
          Help us make children's church even better
        </Text>

        <Text style={s.sectionLabel}>How was today's service?</Text>
        <View style={s.ratingsRow}>
          {RATINGS.map((r) => (
            <Pressable
              key={r.value}
              style={({ pressed }) => [
                s.ratingBtn,
                {
                  backgroundColor: rating === r.value ? colors.primary : colors.card,
                  borderColor: rating === r.value ? colors.primary : colors.border,
                  transform: pressed ? [{ scale: 0.92 }] : [],
                },
              ]}
              onPress={async () => {
                setRating(r.value);
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Text style={s.ratingEmoji}>{r.emoji}</Text>
              <Text
                style={[
                  s.ratingLabel,
                  { color: rating === r.value ? "#ffffff" : colors.mutedForeground },
                ]}
              >
                {r.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.sectionLabel}>Category</Text>
        <View style={s.categoryGrid}>
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              style={[
                s.categoryChip,
                {
                  backgroundColor: category === cat ? colors.primary + "15" : colors.card,
                  borderColor: category === cat ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setCategory(cat)}
            >
              <Text
                style={[
                  s.categoryText,
                  { color: category === cat ? colors.primary : colors.foreground },
                ]}
              >
                {cat}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.sectionLabel}>Comments (optional)</Text>
        <TextInput
          style={[
            s.commentInput,
            { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
          ]}
          value={comment}
          onChangeText={setComment}
          placeholder="Share any specific thoughts or suggestions..."
          placeholderTextColor={colors.mutedForeground}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <Pressable
          style={({ pressed }) => [
            s.submitBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={handleSubmit}
          disabled={createFeedback.isPending}
        >
          {createFeedback.isPending ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={s.submitText}>Submit Feedback</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingHorizontal: 20 },
    center: { alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 },
    heading: { fontSize: 26, fontFamily: "Inter_700Bold", color: colors.foreground, marginBottom: 4 },
    subheading: { fontSize: 15, fontFamily: "Inter_400Regular", marginBottom: 28 },
    sectionLabel: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      marginBottom: 12,
      marginTop: 8,
    },
    ratingsRow: { flexDirection: "row", gap: 8, marginBottom: 24 },
    ratingBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: colors.radius,
      borderWidth: 1.5,
      alignItems: "center",
      gap: 4,
    },
    ratingEmoji: { fontSize: 22 },
    ratingLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
    categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
    categoryChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
    },
    categoryText: { fontSize: 13, fontFamily: "Inter_500Medium" },
    commentInput: {
      borderWidth: 1,
      borderRadius: colors.radius,
      padding: 14,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      minHeight: 100,
      marginBottom: 28,
    },
    submitBtn: {
      padding: 16,
      borderRadius: colors.radius,
      alignItems: "center",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    submitText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#ffffff" },
    successCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    successTitle: { fontSize: 26, fontFamily: "Inter_700Bold", textAlign: "center" },
    successText: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
    doneBtn: { paddingHorizontal: 40, paddingVertical: 14, borderRadius: colors.radius },
    doneBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#ffffff" },
  });
