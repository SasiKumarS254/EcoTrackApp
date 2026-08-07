import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, StatusBar, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Shadow } from "@/constants/theme";
import { router } from "expo-router";

const API_BASE = "http://localhost:5000/api";

export default function SignupScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

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
      const res = await fetch(`${API_BASE}/auth/signup`, {
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

      Alert.alert("🎉 Welcome!", `Your account is ready, ${data.user.name}!`, [
        { text: "Explore EcoTrack", onPress: () => router.replace("/(tabs)") },
      ]);
    } catch (err) {
      // Offline fallback
      const userId = "local_" + email.replace(/[^a-z0-9]/gi, "_");
      const session = {
        user_id: userId,
        email: email.trim(),
        name: name.trim() || email.split("@")[0],
        token: "offline_token",
        loggedInAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem("@ecotrack_user_session", JSON.stringify(session));
      await AsyncStorage.setItem("@ecotrack_user_id", userId);
      Alert.alert("🎉 Account Ready!", "Signed up in offline mode.", [
        { text: "Continue", onPress: () => router.replace("/(tabs)") },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={["#0b1a13", "#0d2318", "#0f2d1e"]} style={styles.container}>
        <View style={styles.bgCircle1} />
        <View style={styles.bgCircle2} />

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Back */}
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoBox}>
              <Ionicons name="paw" size={34} color="#10b981" />
              <View style={styles.leafBadge}>
                <Ionicons name="leaf" size={12} color="#34d399" />
              </View>
            </View>
            <Text style={styles.brandName}>Join EcoTrack</Text>
            <Text style={styles.brandTagline}>Universal Animal Welfare & AI Ecosystem</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Create Account</Text>
            <Text style={styles.cardSub}>Fill in your details to get started</Text>

            {/* Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={20} color="#10b981" style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="e.g. Alex Johnson" placeholderTextColor="#5a7a6a" value={name} onChangeText={setName} />
              </View>
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Address *</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={20} color="#10b981" style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="you@example.com" placeholderTextColor="#5a7a6a" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
              </View>
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password *</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color="#10b981" style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="Min. 6 characters" placeholderTextColor="#5a7a6a" secureTextEntry={!showPass} value={password} onChangeText={setPassword} />
                <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                  <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={20} color="#5a7a6a" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Confirm Password *</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#10b981" style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="Re-enter password" placeholderTextColor="#5a7a6a" secureTextEntry={!showPass} value={confirmPass} onChangeText={setConfirmPass} />
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

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push("/auth/login")}>
                <Text style={styles.footerLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bgCircle1: { position: "absolute", top: -80, right: -80, width: 280, height: 280, borderRadius: 140, backgroundColor: "rgba(16,185,129,0.08)" },
  bgCircle2: { position: "absolute", bottom: 100, left: -100, width: 350, height: 350, borderRadius: 175, backgroundColor: "rgba(16,185,129,0.05)" },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 40 },
  backBtn: { position: "absolute", top: 0, left: 0, padding: 8, zIndex: 10 },
  header: { alignItems: "center", marginBottom: 28, marginTop: 32 },
  logoBox: { width: 72, height: 72, borderRadius: 20, backgroundColor: "rgba(16,185,129,0.18)", borderWidth: 1.5, borderColor: "rgba(16,185,129,0.4)", justifyContent: "center", alignItems: "center", marginBottom: 14, position: "relative", ...Shadow.md },
  leafBadge: { position: "absolute", top: -4, right: -4, width: 24, height: 24, borderRadius: 12, backgroundColor: "#042f22", borderWidth: 1.5, borderColor: "#10b981", justifyContent: "center", alignItems: "center" },
  brandName: { fontSize: 30, fontWeight: "900", color: "#ffffff", letterSpacing: -1 },
  brandTagline: { fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 6, textAlign: "center" },
  card: { backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", borderRadius: 28, padding: 26 },
  cardTitle: { fontSize: 22, fontWeight: "800", color: "#ffffff", marginBottom: 4 },
  cardSub: { fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 24 },
  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.6)", marginBottom: 7, textTransform: "uppercase", letterSpacing: 0.5 },
  inputWrapper: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderRadius: 14, paddingHorizontal: 14, height: 52 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 14, color: "#ffffff", fontWeight: "500" },
  eyeBtn: { padding: 4 },
  signInBtn: { marginTop: 8, borderRadius: 14, overflow: "hidden", ...Shadow.md },
  signInGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 54 },
  signInText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  footerText: { fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: "500" },
  footerLink: { fontSize: 13, fontWeight: "800", color: "#10b981" },
});