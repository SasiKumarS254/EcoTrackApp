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
  const [loginMode, setLoginMode] = useState<"member" | "admin">("member");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const { colors, isDark, toggleTheme } = useTheme();

  const handleDemoLogin = async () => {
    setIsLoading(true);
    try {
      if (loginMode === "admin") {
        const session = {
          id: "usr_admin",
          user_id: "usr_admin",
          email: "admin@ecotrack.org",
          name: "System Administrator",
          display_name: "System Administrator",
          avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200",
          avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200",
          reputation_score: 999,
          role: "admin",
          is_admin: true,
          loggedInAt: new Date().toISOString(),
        };
        await AsyncStorage.setItem("@ecotrack_user_session", JSON.stringify(session));
        await AsyncStorage.setItem("@ecotrack_user_id", "usr_admin");
        await AsyncStorage.removeItem("@ecotrack_logged_out");
        router.replace("/(tabs)");
      } else {
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
          is_admin: false,
          loggedInAt: new Date().toISOString(),
        };
        await AsyncStorage.setItem("@ecotrack_user_session", JSON.stringify(session));
        await AsyncStorage.setItem("@ecotrack_user_id", "usr1");
        await AsyncStorage.removeItem("@ecotrack_logged_out");
        router.replace("/(tabs)");
      }
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

      if (!res.ok || !data?.user) {
        Alert.alert("Authentication Error", data?.error || "Login failed. Please verify your credentials.");
        setIsLoading(false);
        return;
      }

      if (!res.ok) {
        Alert.alert("Authentication Error", data.error || "Invalid credentials.");
        setIsLoading(false);
        return;
      }

      if (loginMode === "admin" && data.user.role !== "admin") {
        Alert.alert(
          "Admin Access Denied",
          `The account ${email} is registered as '${data.user.role}' and lacks administrator authority.`
        );
        setIsLoading(false);
        return;
      }

      const userRole = data.user.role || (loginMode === "admin" ? "admin" : "user");
      const session = {
        id: data.user.id,
        user_id: data.user.id,
        email: data.user.email,
        name: data.user.name || data.user.display_name || '',
        display_name: data.user.display_name || data.user.name || '',
        avatar: data.user.avatar_url || data.user.avatar || '',
        avatar_url: data.user.avatar_url || data.user.avatar || '',
        reputation_score: data.user.reputation_score || (userRole === "admin" ? 999 : 100),
        role: userRole,
        is_admin: userRole === "admin",
        token: data.token,
        loggedInAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem("@ecotrack_user_session", JSON.stringify(session));
      await AsyncStorage.setItem("@ecotrack_user_id", data.user.id);
      await AsyncStorage.setItem("@ecotrack_auth_token", data.token);
      await AsyncStorage.removeItem("@ecotrack_logged_out");
      router.replace("/(tabs)");
    } catch (err: any) {
      console.warn("Login Error:", err);
      Alert.alert(
        "Authentication Failed",
        err?.message ? "Connection error: " + err.message : "EcoTrack server is offline or unreachable. Please verify the backend is running, or tap 'Quick Demo Sign-In' below."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillCredentials = (fillEmail: string, fillPass: string) => {
    setEmail(fillEmail);
    setPassword(fillPass);
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
              backgroundColor: loginMode === "admin"
                ? (isDark ? "rgba(5,150,105,0.22)" : "#ecfdf5")
                : (isDark ? "rgba(16,185,129,0.16)" : "#ffffff"),
              borderColor: loginMode === "admin"
                ? "#059669"
                : (isDark ? "rgba(16,185,129,0.35)" : "rgba(16,185,129,0.25)"),
            }]}>
              <Image
                source={require("@/assets/images/logo.png")}
                style={styles.logoImage}
                resizeMode="contain"
              />
              {loginMode === "admin" && (
                <View style={styles.adminLogoBadge}>
                  <Ionicons name="shield-checkmark" size={12} color="#ffffff" />
                </View>
              )}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[styles.brandName, { color: colors.textPrimary }]}>EcoTrack</Text>
              {loginMode === "admin" && (
                <View style={styles.adminHeaderPill}>
                  <Ionicons name="shield-checkmark" size={10} color="#ffffff" />
                  <Text style={styles.adminHeaderPillText}>ADMIN</Text>
                </View>
              )}
            </View>
            <Text style={[styles.brandTagline, { color: colors.textMuted }]}>
              {loginMode === "admin" ? "Super Administrator Governance & Operations Portal" : "Universal Animal Welfare & AI Ecosystem"}
            </Text>
          </View>

          {/* Mode Switcher: Member vs Admin */}
          <View style={[styles.segmentedControl, {
            backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#e2e8f0",
            borderColor: isDark ? "rgba(255,255,255,0.1)" : colors.border
          }]}>
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                loginMode === "member" && {
                  backgroundColor: colors.primary,
                  ...Shadow.sm
                }
              ]}
              onPress={() => {
                setLoginMode("member");
                setEmail("");
                setPassword("");
              }}
            >
              <Ionicons
                name="person-outline"
                size={15}
                color={loginMode === "member" ? "#ffffff" : colors.textMuted}
              />
              <Text style={[
                styles.segmentBtnText,
                { color: loginMode === "member" ? "#ffffff" : colors.textSecondary }
              ]}>
                Member Login
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentBtn,
                loginMode === "admin" && {
                  backgroundColor: "#059669",
                  ...Shadow.sm
                }
              ]}
              onPress={() => {
                setLoginMode("admin");
                setEmail("admin@ecotrack.org");
                setPassword("admin123");
              }}
            >
              <Ionicons
                name="shield-checkmark"
                size={15}
                color={loginMode === "admin" ? "#ffffff" : colors.textMuted}
              />
              <Text style={[
                styles.segmentBtnText,
                { color: loginMode === "admin" ? "#ffffff" : colors.textSecondary }
              ]}>
                Admin Portal
              </Text>
            </TouchableOpacity>
          </View>

          {/* Card */}
          <View style={[styles.card, {
            backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#ffffff",
            borderColor: loginMode === "admin" ? "rgba(16,185,129,0.35)" : (isDark ? "rgba(255,255,255,0.1)" : colors.border),
          }]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                {loginMode === "admin" ? "Administrator Access" : "Welcome Back"}
              </Text>
              {loginMode === "admin" && (
                <View style={styles.adminMiniBadge}>
                  <Ionicons name="shield-half" size={12} color="#059669" />
                  <Text style={styles.adminMiniBadgeText}>GOVERNANCE</Text>
                </View>
              )}
            </View>

            <Text style={[styles.cardSub, { color: colors.textMuted }]}>
              {loginMode === "admin"
                ? "Platform operations, telemetry & moderation"
                : "Sign in to continue your mission"}
            </Text>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                {loginMode === "admin" ? "Admin Email Address" : "Email Address"}
              </Text>
              <View style={[styles.inputWrapper, {
                backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "#f8fafc",
                borderColor: isDark ? "rgba(255,255,255,0.12)" : colors.border,
              }]}>
                <Ionicons
                  name={loginMode === "admin" ? "shield-outline" : "mail-outline"}
                  size={20}
                  color={loginMode === "admin" ? "#059669" : colors.primary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder={loginMode === "admin" ? "admin@ecotrack.org" : "you@example.com"}
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
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                {loginMode === "admin" ? "Master Security Password" : "Password"}
              </Text>
              <View style={[styles.inputWrapper, {
                backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "#f8fafc",
                borderColor: isDark ? "rgba(255,255,255,0.12)" : colors.border,
              }]}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={loginMode === "admin" ? "#059669" : colors.primary}
                  style={styles.inputIcon}
                />
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

            {/* Admin Quick Credentials Selector */}
            {loginMode === "admin" && (
              <View style={styles.quickFillWrap}>
                <TouchableOpacity
                  style={[styles.quickFillBtn, { backgroundColor: isDark ? "rgba(16,185,129,0.12)" : "rgba(16,185,129,0.08)" }]}
                  onPress={() => handleFillCredentials("admin@ecotrack.org", "admin123")}
                >
                  <Ionicons name="key-outline" size={12} color="#059669" />
                  <Text style={styles.quickFillText}>admin@ecotrack.org (admin123)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.quickFillBtn, { backgroundColor: isDark ? "rgba(2,132,199,0.12)" : "rgba(2,132,199,0.08)" }]}
                  onPress={() => handleFillCredentials("user@ecotrack.org", "demo")}
                >
                  <Ionicons name="key-outline" size={12} color="#0284c7" />
                  <Text style={[styles.quickFillText, { color: "#0284c7" }]}>user@ecotrack.org (demo)</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Sign In Button */}
            <TouchableOpacity
              style={[styles.signInBtn, isLoading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={loginMode === "admin" ? ["#059669", "#047857"] : ["#10b981", "#059669"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.signInGradient}
              >
                {isLoading ? (
                  <Text style={styles.signInText}>Verifying Credentials...</Text>
                ) : (
                  <>
                    <Ionicons name={loginMode === "admin" ? "shield-checkmark" : "log-in-outline"} size={20} color="#fff" />
                    <Text style={styles.signInText}>
                      {loginMode === "admin" ? "Sign In to Admin Center" : "Sign In"}
                    </Text>
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

            {/* Sign Up (Only for Member Mode) */}
            {loginMode === "member" && (
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
            )}

            {/* Quick Demo Sign-In */}
            <TouchableOpacity
              style={[styles.demoBtn, isLoading && { opacity: 0.7 }, {
                backgroundColor: loginMode === "admin" ? (isDark ? "rgba(16,185,129,0.12)" : "rgba(16,185,129,0.12)") : (isDark ? "rgba(251,191,36,0.08)" : "rgba(251,191,36,0.12)"),
                borderColor: loginMode === "admin" ? "#10b981" : (isDark ? "rgba(251,191,36,0.35)" : "rgba(245,158,11,0.5)"),
              }]}
              onPress={handleDemoLogin}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              <Ionicons
                name={loginMode === "admin" ? "shield-checkmark" : "sparkles"}
                size={17}
                color={loginMode === "admin" ? "#10b981" : (isDark ? "#fbbf24" : "#d97706")}
              />
              <Text style={[styles.demoBtnText, { color: loginMode === "admin" ? "#059669" : (isDark ? "#fbbf24" : "#b45309") }]}>
                {loginMode === "admin"
                  ? "Quick Demo Sign-In (Super Admin Mode)"
                  : "Quick Demo Sign-In (Explorer Mode)"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Feature pills */}
          <View style={styles.featurePills}>
            {["🦁 10K+ Species", "🛡️ Admin Guard", "🌿 Eco Impact"].map((f) => (
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
  header: { alignItems: "center", marginBottom: 20, marginTop: 10 },
  logoBox: {
    width: 82, height: 82, borderRadius: 24,
    borderWidth: 1.5,
    justifyContent: "center", alignItems: "center",
    marginBottom: 14,
    ...Shadow.md,
  },
  logoImage: {
    width: 58,
    height: 58,
    borderRadius: 14,
  },
  adminLogoBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: "#059669",
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  adminHeaderPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#059669",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  adminHeaderPillText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  brandName: {
    fontSize: 34, fontWeight: "900",
    letterSpacing: -1,
  },
  brandTagline: {
    fontSize: 13,
    marginTop: 6, textAlign: "center",
  },
  segmentedControl: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    marginBottom: 16,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  card: {
    borderRadius: Radius.lg,
    padding: 22,
    borderWidth: 1,
    ...Shadow.md,
  },
  cardTitle: {
    fontSize: 22, fontWeight: "800",
    letterSpacing: -0.5,
  },
  cardSub: {
    fontSize: 13, marginBottom: 18,
  },
  adminMiniBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16,185,129,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  adminMiniBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#059669",
  },
  inputGroup: { marginBottom: 14 },
  inputLabel: {
    fontSize: 13, fontWeight: "600",
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: "row", alignItems: "center",
    borderRadius: Radius.md,
    borderWidth: 1.5,
    paddingHorizontal: 14, height: 50,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1, fontSize: 15,
  },
  eyeBtn: { padding: 6 },
  quickFillWrap: {
    flexDirection: "column",
    gap: 6,
    marginBottom: 14,
  },
  quickFillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  quickFillText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#059669",
  },
  signInBtn: {
    borderRadius: Radius.md,
    overflow: "hidden",
    marginTop: 6,
    ...Shadow.sm,
  },
  signInGradient: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14, gap: 8,
  },
  signInText: {
    color: "#fff", fontSize: 16,
    fontWeight: "700",
  },
  divider: {
    flexDirection: "row", alignItems: "center",
    marginVertical: 16,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { marginHorizontal: 12, fontSize: 13 },
  signUpBtn: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13, borderRadius: Radius.md,
    borderWidth: 1.5, gap: 8, marginBottom: 10,
  },
  signUpText: {
    fontSize: 15, fontWeight: "700",
  },
  demoBtn: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13, borderRadius: Radius.md,
    borderWidth: 1.5, gap: 8,
  },
  demoBtnText: {
    fontSize: 13, fontWeight: "700",
  },
  featurePills: {
    flexDirection: "row", justifyContent: "center",
    gap: 8, marginTop: 24,
  },
  pill: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
  },
  pillText: {
    fontSize: 12, fontWeight: "600",
  },
});
