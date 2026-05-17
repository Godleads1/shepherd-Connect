import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLogin } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/auth";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const loginMutation = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing fields", "Please enter your email and password.");
      return;
    }
    try {
      const result = await loginMutation.mutateAsync({ email: email.trim().toLowerCase(), password });
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
      const msg = err instanceof Error ? err.message : "Login failed. Check your credentials.";
      Alert.alert("Login failed", msg);
    }
  };

  const s = styles(colors);

  return (
    <KeyboardAvoidingView
      style={[s.root, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 24 }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={s.hero}>
        <View style={s.logoCircle}>
          <Text style={s.logoText}>✝</Text>
        </View>
        <Text style={s.appName}>Shepherd Connect</Text>
        <Text style={s.tagline}>Safe. Known. Celebrated.</Text>
      </View>

      <View style={s.form}>
        <Text style={s.label}>Email</Text>
        <TextInput
          style={s.input}
          value={email}
          onChangeText={setEmail}
          placeholder="parent@church.com"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          testID="email-input"
        />

        <Text style={[s.label, { marginTop: 16 }]}>Password</Text>
        <TextInput
          style={s.input}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={handleLogin}
          testID="password-input"
        />

        <Pressable
          style={({ pressed }) => [s.button, pressed && s.buttonPressed]}
          onPress={handleLogin}
          disabled={loginMutation.isPending}
          testID="login-button"
        >
          {loginMutation.isPending ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={s.buttonText}>Sign In</Text>
          )}
        </Pressable>

        <Pressable
          style={s.linkRow}
          onPress={() => router.push("/(auth)/register")}
        >
          <Text style={s.linkText}>
            New here?{" "}
            <Text style={s.linkAccent}>Create an account</Text>
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 24,
    },
    hero: {
      alignItems: "center",
      marginBottom: 48,
    },
    logoCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 8,
    },
    logoText: {
      fontSize: 32,
      color: "#ffffff",
    },
    appName: {
      fontSize: 28,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginBottom: 6,
    },
    tagline: {
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      letterSpacing: 0.5,
    },
    form: {
      gap: 4,
    },
    label: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      marginBottom: 6,
      letterSpacing: 0.3,
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
    buttonPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.98 }],
    },
    buttonText: {
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
      color: "#ffffff",
    },
    linkRow: {
      marginTop: 20,
      alignItems: "center",
    },
    linkText: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    linkAccent: {
      color: colors.primary,
      fontFamily: "Inter_600SemiBold",
    },
  });
