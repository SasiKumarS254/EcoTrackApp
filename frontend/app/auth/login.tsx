import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, StatusBar, KeyboardAvoidingView, Platform,
  ScrollView, Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Radius, Shadow, FontSize } from "@/constants/theme";
import { router } from "expo-router";

const API_BASE = "http://localhost:5000/api";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

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
      const res = await fetch(`${API_BASE}/auth/login`, {
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
      router.replace("/(tabs)");
    } catch (err: any) {
      Alert.alert("Authentication Failed", "EcoTrack server is offline or unreachable. Please verify the backend is running.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={["#0b1a13", "#0d2318", "#0f2d1e"]}
        style={styles.container}
      >
        {/* Background decoration circles */}
        <View style={styles.bgCircle1} />
        <View style={styles.bgCircle2} />

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoBox}>
              <Ionicons name="paw" size={38} color="#10b981" />
              <View style={styles.leafBadge}>
                <Ionicons name="leaf" size={13} color="#34d399" />
              </View>
            </View>
            <Text style={styles.brandName}>EcoTrack</Text>
            <Text style={styles.brandTagline}>Universal Animal Welfare & AI Ecosystem</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome Back</Text>
            <Text style={styles.cardSub}>Sign in to continue your mission</Text>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={20} color="#10b981" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor="#5a7a6a"
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
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color="#10b981" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#5a7a6a"
                  secureTextEntry={!showPass}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                  <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={20} color="#5a7a6a" />
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
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Sign Up */}
            <TouchableOpacity
              style={styles.signUpBtn}
              onPress={() => router.push("/auth/signup")}
              activeOpacity={0.85}
            >
              <Ionicons name="person-add-outline" size={18} color="#10b981" />
              <Text style={styles.signUpText}>Create New Account</Text>
            </TouchableOpacity>
          </View>

          {/* Feature pills */}
          <View style={styles.featurePills}>
            {["🦁 10K+ Species", "🔒 Secure", "🌿 Eco Impact"].map((f) => (
              <View key={f} style={styles.pill}>
                <Text style={styles.pillText}>{f}</Text>
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
  bgCircle1: {
    position: "absolute", top: -80, right: -80,
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: "rgba(16,185,129,0.08)",
  },
  bgCircle2: {
    position: "absolute", bottom: 100, left: -100,
    width: 350, height: 350, borderRadius: 175,
    backgroundColor: "rgba(16,185,129,0.05)",
  },
  scroll: {
    flexGrow: 1, justifyContent: "center",
    paddingHorizontal: 24, paddingVertical: 40,
  },
  header: { alignItems: "center", marginBottom: 32 },
  logoBox: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: "rgba(16,185,129,0.18)",
    borderWidth: 1.5, borderColor: "rgba(16,185,129,0.4)",
    justifyContent: "center", alignItems: "center",
    marginBottom: 16, position: "relative",
    ...Shadow.md,
  },
  leafBadge: {
    position: "absolute", top: -4, right: -4,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "#042f22", borderWidth: 1.5, borderColor: "#10b981",
    justifyContent: "center", alignItems: "center",
  },
  brandName: {
    fontSize: 36, fontWeight: "900", color: "#ffffff",
    letterSpacing: -1,
  },
  brandTagline: {
    fontSize: 13, color: "rgba(255,255,255,0.5)",
    marginTop: 6, textAlign: "center",
  },

  card: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 28, padding: 28,
    backdropFilter: "blur(20px)",
  },
  cardTitle: {
    fontSize: 24, fontWeight: "800", color: "#ffffff",
    marginBottom: 4,
  },
  cardSub: { fontSize: 14, color: "rgba(255,255,255,0.5)", marginBottom: 28 },

  inputGroup: { marginBottom: 18 },
  inputLabel: {
    fontSize: 12, fontWeight: "700",
    color: "rgba(255,255,255,0.6)", marginBottom: 8,
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 16, paddingHorizontal: 16, height: 56,
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1, fontSize: 15, color: "#ffffff", fontWeight: "500",
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
  dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.1)" },
  dividerText: { color: "rgba(255,255,255,0.3)", fontSize: 13, fontWeight: "600" },

  signUpBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, height: 52,
    borderWidth: 1.5, borderColor: "rgba(16,185,129,0.4)",
    borderRadius: 16, backgroundColor: "rgba(16,185,129,0.08)",
  },
  signUpText: { color: "#10b981", fontSize: 15, fontWeight: "800" },

  featurePills: {
    flexDirection: "row", justifyContent: "center",
    gap: 10, marginTop: 28, flexWrap: "wrap",
  },
  pill: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: "rgba(16,185,129,0.12)",
    borderWidth: 1, borderColor: "rgba(16,185,129,0.2)",
  },
  pillText: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600" },
});
