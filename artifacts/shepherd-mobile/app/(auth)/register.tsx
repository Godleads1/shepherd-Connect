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

import { useRegister } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/auth";

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const registerMutation = useRegister();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert("Missing fields", "Please fill in name, email, and password.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return;
    }
    try {
      const result = await registerMutation.mutateAsync({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role: "parent",
        phone: phone.trim() || undefined,
      });
      await login(result.token, {
        userId: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        familyId: result.user.familyId ?? null,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (err: unknown) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = err instanceof Error ? err.message : "Registration failed.";
      Alert.alert("Registration failed", msg);
    }
  };

  const s = styles(colors);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[s.root, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backText}>← Back</Text>
        </Pressable>

        <Text style={s.title}>Create Account</Text>
        <Text style={s.subtitle}>Join Shepherd Connect as a parent</Text>

        <View style={s.form}>
          <Text style={s.label}>Full Name</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="Your full name"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="words"
            returnKeyType="next"
          />

          <Text style={[s.label, { marginTop: 16 }]}>Email</Text>
          <TextInput
            style={s.input}
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />

          <Text style={[s.label, { marginTop: 16 }]}>Password</Text>
          <TextInput
            style={s.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Min. 6 characters"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry
            returnKeyType="next"
          />

          <Text style={[s.label, { marginTop: 16 }]}>Phone (optional)</Text>
          <TextInput
            style={s.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+234 800 000 0000"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="phone-pad"
            returnKeyType="done"
            onSubmitEditing={handleRegister}
          />

          <Pressable
            style={({ pressed }) => [s.button, pressed && s.buttonPressed]}
            onPress={handleRegister}
            disabled={registerMutation.isPending}
          >
            {registerMutation.isPending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={s.buttonText}>Create Account</Text>
            )}
          </Pressable>

          <Pressable style={s.linkRow} onPress={() => router.back()}>
            <Text style={s.linkText}>
              Already have an account?{" "}
              <Text style={s.linkAccent}>Sign in</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    root: {
      paddingHorizontal: 24,
    },
    backBtn: { marginBottom: 24 },
    backText: { fontSize: 15, color: colors.primary, fontFamily: "Inter_500Medium" },
    title: {
      fontSize: 28,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginBottom: 36,
    },
    form: { gap: 4 },
    label: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      marginBottom: 6,
    },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: colors.radius,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },
    button: {
      marginTop: 28,
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      paddingVertical: 16,
      alignItems: "center",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    buttonPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    buttonText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#ffffff" },
    linkRow: { marginTop: 20, alignItems: "center" },
    linkText: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    linkAccent: { color: colors.primary, fontFamily: "Inter_600SemiBold" },
  });
