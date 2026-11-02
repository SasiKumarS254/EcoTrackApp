import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, StatusBar, KeyboardAvoidingView, Platform,
  ScrollView, Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Shadow, Radius } from "@/constants/theme";
import { router } from "expo-router";
import { API_BASE_URL } from "@/services/api";
import { useTheme } from "@/context/ThemeContext";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const { colors, isDark, toggleTheme } = useTheme();

  const handleDemoLogin = async () => {
    setIsLoading(true);
    try {
      const session = {
        id: "usr1",
        user_id: "usr1",
        email: "user@ecotrack.org",
        name: "Eco Explorer",
        display_name: "Eco Explorer",
        avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200",
        avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200",
        reputation_score: 100,
        role: "user",
        loggedInAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem("@ecotrack_user_session", JSON.stringify(session));
      await AsyncStorage.setItem("@ecotrack_user_id", "usr1");
      await AsyncStorage.removeItem("@ecotrack_logged_out");
      router.replace("/(tabs)");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert("Required", "Please enter your email address.");
      return;
    }
    if (!password) {
      Alert.alert("Required", "Please enter your password.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();

      if (!res.ok) {
        Alert.alert("Authentication Error", data.error || "Invalid credentials.");
        setIsLoading(false);
        return;
      }

      const session = {
        id: data.user.id,
        user_id: data.user.id,
        email: data.user.email,
        name: data.user.name || data.user.display_name || '',
        display_name: data.user.display_name || data.user.name || '',
        avatar: data.user.avatar_url || data.user.avatar || '',
        avatar_url: data.user.avatar_url || data.user.avatar || '',
        reputation_score: data.user.reputation_score || 100,
        token: data.token,
        loggedInAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem("@ecotrack_user_session", JSON.stringify(session));
      await AsyncStorage.setItem("@ecotrack_user_id", data.user.id);
      await AsyncStorage.setItem("@ecotrack_auth_token", data.token);
      await AsyncStorage.removeItem("@ecotrack_logged_out");
      router.replace("/(tabs)");
    } catch (err: any) {
      Alert.alert("Authentication Failed", "EcoTrack server is offline or unreachable. Please verify the backend is running, or tap 'Quick Demo Sign-In' below.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <LinearGradient
        colors={isDark ? ["#0b1a13", "#0d2318", "#0f2d1e"] : ["#f0fdf4", "#e8f5e9", "#f8fafc"]}
        style={styles.container}
      >
        {/* Background decoration circles */}
        <View style={[styles.bgCircle1, { backgroundColor: isDark ? "rgba(16,185,129,0.08)" : "rgba(16,185,129,0.12)" }]} />
        <View style={[styles.bgCircle2, { backgroundColor: isDark ? "rgba(16,185,129,0.05)" : "rgba(16,185,129,0.08)" }]} />

        {/* Theme Toggle Button */}
        <TouchableOpacity
          style={[styles.themeToggleBtn, {
            backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(16,185,129,0.12)",
            borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(16,185,129,0.25)",
          }]}
          onPress={toggleTheme}
          accessibilityLabel="Toggle Theme"
        >
          <Ionicons
            name={isDark ? "sunny" : "moon"}
            size={19}
            color={isDark ? "#fbbf24" : colors.primaryDark}
          />
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header with Official Logo */}
          <View style={styles.header}>
            <View style={[styles.logoBox, {
              backgroundColor: isDark ? "rgba(16,185,129,0.16)" : "#ffffff",
              borderColor: isDark ? "rgba(16,185,129,0.35)" : "rgba(16,185,129,0.25)",
            }]}>
              <Image
                source={require("@/assets/images/logo.png")}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={[styles.brandName, { color: colors.textPrimary }]}>EcoTrack</Text>
            <Text style={[styles.brandTagline, { color: colors.textMuted }]}>Universal Animal Welfare & AI Ecosystem</Text>
          </View>

          {/* Card */}
          <View style={[styles.card, {
            backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#ffffff",
            borderColor: isDark ? "rgba(255,255,255,0.1)" : colors.border,
          }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Welcome Back</Text>
            <Text style={[styles.cardSub, { color: colors.textMuted }]}>Sign in to continue your mission</Text>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Email Address</Text>
              <View style={[styles.inputWrapper, {
                backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "#f8fafc",
                borderColor: isDark ? "rgba(255,255,255,0.12)" : colors.border,
              }]}>
                <Ionicons name="mail-outline" size={20} color={colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder="you@example.com"
                  placeholderTextColor={isDark ? "#5a7a6a" : "#94a3b8"}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Password</Text>
              <View style={[styles.inputWrapper, {
                backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "#f8fafc",
                borderColor: isDark ? "rgba(255,255,255,0.12)" : colors.border,
              }]}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder="••••••••"
                  placeholderTextColor={isDark ? "#5a7a6a" : "#94a3b8"}
                  secureTextEntry={!showPass}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                  <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={20} color={isDark ? "#5a7a6a" : "#94a3b8"} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Sign In Button */}
            <TouchableOpacity
              style={[styles.signInBtn, isLoading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#10b981", "#059669"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.signInGradient}
              >
                {isLoading ? (
                  <Text style={styles.signInText}>Signing In...</Text>
                ) : (
                  <>
                    <Ionicons name="log-in-outline" size={20} color="#fff" />
                    <Text style={styles.signInText}>Sign In</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.textMuted }]}>or</Text>
              <View style={[styles.dividerLine, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : colors.border }]} />
            </View>

            {/* Sign Up */}
            <TouchableOpacity
              style={[styles.signUpBtn, {
                backgroundColor: isDark ? "rgba(16,185,129,0.08)" : "rgba(16,185,129,0.06)",
                borderColor: isDark ? "rgba(16,185,129,0.4)" : colors.primary,
              }]}
              onPress={() => router.push("/auth/signup")}
              activeOpacity={0.85}
            >
              <Ionicons name="person-add-outline" size={18} color={colors.primary} />
              <Text style={[styles.signUpText, { color: colors.primary }]}>Create New Account</Text>
            </TouchableOpacity>

            {/* Quick Demo Sign-In */}
            <TouchableOpacity
              style={[styles.demoBtn, isLoading && { opacity: 0.7 }, {
                backgroundColor: isDark ? "rgba(251,191,36,0.08)" : "rgba(251,191,36,0.12)",
                borderColor: isDark ? "rgba(251,191,36,0.35)" : "rgba(245,158,11,0.5)",
              }]}
              onPress={handleDemoLogin}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              <Ionicons name="sparkles" size={17} color={isDark ? "#fbbf24" : "#d97706"} />
              <Text style={[styles.demoBtnText, { color: isDark ? "#fbbf24" : "#b45309" }]}>Quick Demo Sign-In (Explorer Mode)</Text>
            </TouchableOpacity>
          </View>

          {/* Feature pills */}
          <View style={styles.featurePills}>
            {["🦁 10K+ Species", "🔒 Secure", "🌿 Eco Impact"].map((f) => (
              <View key={f} style={[styles.pill, {
                backgroundColor: isDark ? "rgba(16,185,129,0.12)" : "rgba(16,185,129,0.08)",
                borderColor: isDark ? "rgba(16,185,129,0.2)" : "rgba(16,185,129,0.25)",
              }]}>
                <Text style={[styles.pillText, { color: isDark ? "rgba(255,255,255,0.8)" : colors.textSecondary }]}>{f}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  themeToggleBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 54 : 28,
    right: 20,
    zIndex: 50,
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    ...Shadow.sm,
  },
  bgCircle1: {
    position: "absolute", top: -80, right: -80,
    width: 280, height: 280, borderRadius: 140,
  },
  bgCircle2: {
    position: "absolute", bottom: 100, left: -100,
    width: 350, height: 350, borderRadius: 175,
  },
  scroll: {
    flexGrow: 1, justifyContent: "center",
    paddingHorizontal: 24, paddingVertical: 40,
  },
  header: { alignItems: "center", marginBottom: 28, marginTop: 20 },
  logoBox: {
    width: 82, height: 82, borderRadius: 24,
    borderWidth: 1.5,
    justifyContent: "center", alignItems: "center",
    marginBottom: 14,
    ...Shadow.md,
  },
  logoImage: {
    width: 62,
    height: 62,
    borderRadius: 16,
  },
  brandName: {
    fontSize: 34, fontWeight: "900",
    letterSpacing: -1,
  },
  brandTagline: {
    fontSize: 13,
    marginTop: 6, textAlign: "center",
  },

  card: {
    borderWidth: 1,
    borderRadius: 28, padding: 26,
    ...Shadow.md,
  },
  cardTitle: {
    fontSize: 24, fontWeight: "800",
    marginBottom: 4,
  },
  cardSub: { fontSize: 14, marginBottom: 26 },

  inputGroup: { marginBottom: 18 },
  inputLabel: {
    fontSize: 12, fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1,
    borderRadius: 16, paddingHorizontal: 16, height: 56,
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1, fontSize: 15, fontWeight: "500",
  },
  eyeBtn: { padding: 4 },

  signInBtn: { marginTop: 8, borderRadius: 16, overflow: "hidden", ...Shadow.md },
  signInGradient: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, height: 56,
  },
  signInText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  divider: {
    flexDirection: "row", alignItems: "center",
    marginVertical: 20, gap: 12,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 13, fontWeight: "600" },

  signUpBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, height: 52,
    borderWidth: 1.5,
    borderRadius: 16,
  },
  signUpText: { fontSize: 15, fontWeight: "800" },

  demoBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, height: 48, marginTop: 12,
    borderWidth: 1,
    borderRadius: 16,
  },
  demoBtnText: { fontSize: 13.5, fontWeight: "700" },

  featurePills: {
    flexDirection: "row", justifyContent: "center",
    gap: 10, marginTop: 26, flexWrap: "wrap",
  },
  pill: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillText: { fontSize: 12, fontWeight: "600" },
});
