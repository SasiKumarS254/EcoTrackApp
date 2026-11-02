import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, StatusBar, KeyboardAvoidingView, Platform, ScrollView, Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Shadow, Radius } from "@/constants/theme";
import { router } from "expo-router";
import { API_BASE_URL } from "@/services/api";
import { useTheme } from "@/context/ThemeContext";

export default function SignupScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const { colors, isDark, toggleTheme } = useTheme();

  const handleSignup = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Missing Fields", "Please fill in email and password.");
      return;
    }
    if (password !== confirmPass) {
      Alert.alert("Password Mismatch", "Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak Password", "Password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim() || email.split("@")[0], password }),
      });
      const data = await res.json();

      if (!res.ok) {
        Alert.alert("Signup Failed", data.error || "Could not create account.");
        return;
      }

      const session = {
        user_id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        avatar: data.user.avatar,
        token: data.token,
        loggedInAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem("@ecotrack_user_session", JSON.stringify(session));
      await AsyncStorage.setItem("@ecotrack_user_id", data.user.id);
      await AsyncStorage.setItem("@ecotrack_auth_token", data.token);
      await AsyncStorage.removeItem("@ecotrack_logged_out");

      Alert.alert("🎉 Welcome!", `Your account is ready, ${data.user.name}!`, [
        { text: "Explore EcoTrack", onPress: () => router.replace("/(tabs)") },
      ]);
    } catch (err: any) {
      Alert.alert("Signup Failed", "EcoTrack server is offline or unreachable. Please verify the backend is running.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <LinearGradient
        colors={isDark ? ["#0b1a13", "#0d2318", "#0f2d1e"] : ["#f0fdf4", "#e8f5e9", "#f8fafc"]}
        style={styles.container}
      >
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

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Back */}
          <TouchableOpacity
            style={[styles.backBtn, {
              backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
            }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>

          {/* Header */}
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
            <Text style={[styles.brandName, { color: colors.textPrimary }]}>Join EcoTrack</Text>
            <Text style={[styles.brandTagline, { color: colors.textMuted }]}>Universal Animal Welfare & AI Ecosystem</Text>
          </View>

          {/* Card */}
          <View style={[styles.card, {
            backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#ffffff",
            borderColor: isDark ? "rgba(255,255,255,0.1)" : colors.border,
          }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Create Account</Text>
            <Text style={[styles.cardSub, { color: colors.textMuted }]}>Fill in your details to get started</Text>

            {/* Name */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Full Name</Text>
              <View style={[styles.inputWrapper, {
                backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "#f8fafc",
                borderColor: isDark ? "rgba(255,255,255,0.12)" : colors.border,
              }]}>
                <Ionicons name="person-outline" size={20} color={colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder="e.g. Alex Johnson"
                  placeholderTextColor={isDark ? "#5a7a6a" : "#94a3b8"}
                  value={name}
                  onChangeText={setName}
                />
              </View>
            </View>

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
                  placeholder="Min. 6 characters"
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

            {/* Confirm Password */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Confirm Password</Text>
              <View style={[styles.inputWrapper, {
                backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "#f8fafc",
                borderColor: isDark ? "rgba(255,255,255,0.12)" : colors.border,
              }]}>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder="Re-enter password"
                  placeholderTextColor={isDark ? "#5a7a6a" : "#94a3b8"}
                  secureTextEntry={!showPass}
                  value={confirmPass}
                  onChangeText={setConfirmPass}
                />
              </View>
            </View>

            {/* Create Button */}
            <TouchableOpacity style={[styles.signInBtn, isLoading && { opacity: 0.7 }]} onPress={handleSignup} disabled={isLoading} activeOpacity={0.85}>
              <LinearGradient colors={["#10b981", "#059669"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.signInGradient}>
                {isLoading ? (
                  <Text style={styles.signInText}>Creating Account...</Text>
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                    <Text style={styles.signInText}>Create Account</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
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
  bgCircle1: { position: "absolute", top: -80, right: -80, width: 280, height: 280, borderRadius: 140 },
  bgCircle2: { position: "absolute", bottom: 100, left: -100, width: 350, height: 350, borderRadius: 175 },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 40 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  header: { alignItems: "center", marginBottom: 24 },
  logoBox: { width: 76, height: 76, borderRadius: 22, borderWidth: 1.5, justifyContent: "center", alignItems: "center", marginBottom: 12, ...Shadow.md },
  logoImage: { width: 56, height: 56, borderRadius: 14 },
  brandName: { fontSize: 30, fontWeight: "900", letterSpacing: -1 },
  brandTagline: { fontSize: 13, marginTop: 6, textAlign: "center" },
  card: { borderWidth: 1, borderRadius: 28, padding: 26, ...Shadow.md },
  cardTitle: { fontSize: 22, fontWeight: "800", marginBottom: 4 },
  cardSub: { fontSize: 13, marginBottom: 22 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 12, fontWeight: "700", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  inputWrapper: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, height: 52 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 14, fontWeight: "500" },
  eyeBtn: { padding: 4 },
  signInBtn: { marginTop: 8, borderRadius: 14, overflow: "hidden", ...Shadow.md },
  signInGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 54 },
  signInText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
