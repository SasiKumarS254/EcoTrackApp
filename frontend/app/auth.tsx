import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { login, signup, forgotPassword, verifyOtp, resetPassword } from "../services/api";

const { width } = Dimensions.get("window");

type AuthMode = "signin" | "signup" | "forgot" | "otp" | "reset";

export default function AuthScreen() {
  const [mode, setAuthMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [otpTimer, setOtpTimer] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (otpTimer > 0) {
      timerRef.current = setInterval(() => {
        setOtpTimer((t) => t - 1);
      }, 1000);
    } else if (otpTimer === 0 && timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [otpTimer]);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter your email and password.");
      return;
    }
    setIsLoading(true);
    try {
      const { ok, data } = await login({ email, password });
      if (ok) {
        Alert.alert("Welcome back!", `Hello, ${data.user.name}!`);
        router.replace("/(tabs)");
      } else {
        Alert.alert("Login Failed", data.error || "Please check your credentials.");
      }
    } catch (err) {
      Alert.alert("Error", "Server unreachable. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Email and password are required.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters.");
      return;
    }
    setIsLoading(true);
    try {
      const { ok, data } = await signup({ email, name: name || email.split("@")[0], password });
      if (ok) {
        Alert.alert("Welcome to EcoTrack!", `Your account has been created, ${data.user.name}!`);
        router.replace("/(tabs)");
      } else {
        Alert.alert("Signup Failed", data.error || "Please try again.");
      }
    } catch (err) {
      Alert.alert("Error", "Could not connect to server.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email address.");
      return;
    }
    setIsLoading(true);
    try {
      const { ok, data } = await forgotPassword(email);
      if (ok) {
        setAuthMode("otp");
        setOtpTimer(data.expiresInSeconds || 300);
        Alert.alert("OTP Sent", `A verification code has been sent to ${email}.`);
      } else {
        Alert.alert("Error", data.error || "Unable to send OTP.");
      }
    } catch (err) {
      Alert.alert("Error", "Server error.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      Alert.alert("Error", "Please enter the 6-digit code.");
      return;
    }
    setIsLoading(true);
    try {
      const { ok, data } = await verifyOtp(email, otp);
      if (ok) {
        setAuthMode("reset");
      } else {
        Alert.alert("Error", data.error || "Verification failed.");
      }
    } catch (err) {
      Alert.alert("Error", "Network error.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }
    setIsLoading(true);
    try {
      const { ok, data } = await resetPassword({ email, otp, newPassword: password });
      if (ok) {
        Alert.alert("Success", "Password updated! Please sign in.");
        setAuthMode("signin");
        setPassword("");
        setConfirmPassword("");
      } else {
        Alert.alert("Error", data.error || "Reset failed.");
      }
    } catch (err) {
      Alert.alert("Error", "Could not complete reset.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderInput = (
    placeholder: string,
    value: string,
    onChange: (t: string) => void,
    icon: string,
    secure = false,
    keyboard: any = "default"
  ) => (
    <View style={styles.inputContainer}>
      <Ionicons name={icon as any} size={20} color="#10b981" style={styles.inputIcon} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure && !showPassword}
        keyboardType={keyboard}
        autoCapitalize="none"
      />
      {secure && (
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
          <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#94a3b8" />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.root}
    >
      <LinearGradient colors={["#f0fdf4", "#ffffff"]} style={styles.background} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <LinearGradient colors={["#10b981", "#059669"]} style={styles.logoGradient}>
              <Ionicons name="leaf" size={40} color="#fff" />
            </LinearGradient>
          </View>
          <Text style={styles.appName}>EcoTrack</Text>
          <Text style={styles.tagline}>Intelligent Animal Welfare</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.title}>
            {mode === "signin" && "Welcome Back"}
            {mode === "signup" && "Create Account"}
            {mode === "forgot" && "Reset Password"}
            {mode === "otp" && "Verify Identity"}
            {mode === "reset" && "New Password"}
          </Text>
          <Text style={styles.subtitle}>
            {mode === "signin" && "Sign in to continue your journey"}
            {mode === "signup" && "Join our global conservation network"}
            {mode === "forgot" && "Enter your email for a reset code"}
            {mode === "otp" && `Code sent to ${email}`}
            {mode === "reset" && "Secure your account with a new password"}
          </Text>

          {mode === "signup" && renderInput("Full Name", name, setName, "person-outline")}

          {(mode !== "otp" && mode !== "reset") &&
            renderInput("Email Address", email, setEmail, "mail-outline", false, "email-address")}

          {(mode === "signin" || mode === "signup" || mode === "reset") &&
            renderInput("Password", password, setPassword, "lock-closed-outline", true)}

          {mode === "reset" &&
            renderInput("Confirm Password", confirmPassword, setConfirmPassword, "lock-closed-outline", true)}

          {mode === "otp" && (
            <View>
              {renderInput("6-Digit OTP", otp, setOtp, "shield-checkmark-outline", false, "number-pad")}
              <View style={styles.timerRow}>
                <Text style={[styles.timerText, otpTimer === 0 && { color: "#ef4444" }]}>
                  {otpTimer > 0
                    ? `Expires in ${Math.floor(otpTimer / 60)}:${(otpTimer % 60).toString().padStart(2, "0")}`
                    : "OTP Expired"}
                </Text>
                <TouchableOpacity disabled={otpTimer > 0} onPress={handleSendOtp}>
                  <Text style={[styles.resendText, otpTimer > 0 && { opacity: 0.5 }]}>Resend OTP</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {mode === "signin" && (
            <TouchableOpacity onPress={() => setAuthMode("forgot")} style={styles.forgotBtn}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.mainBtn, isLoading && { opacity: 0.7 }]}
            onPress={() => {
              if (mode === "signin") handleSignIn();
              else if (mode === "signup") handleSignUp();
              else if (mode === "forgot") handleSendOtp();
              else if (mode === "otp") handleVerifyOtp();
              else if (mode === "reset") handleResetPassword();
            }}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.mainBtnText}>
                {mode === "signin" && "Sign In"}
                {mode === "signup" && "Create Account"}
                {mode === "forgot" && "Send OTP"}
                {mode === "otp" && "Verify Code"}
                {mode === "reset" && "Update Password"}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>
              {mode === "signin" ? "New to EcoTrack?" : "Already have an account?"}
            </Text>
            <TouchableOpacity onPress={() => {
              if (mode === "signin") setAuthMode("signup");
              else setAuthMode("signin");
            }}>
              <Text style={styles.footerLink}>
                {mode === "signin" ? " Sign Up" : " Sign In"}
              </Text>
            </TouchableOpacity>
          </View>

          {(mode === "forgot" || mode === "otp" || mode === "reset") && (
            <TouchableOpacity onPress={() => setAuthMode("signin")} style={styles.backToLogin}>
              <Ionicons name="arrow-back" size={16} color="#10b981" />
              <Text style={styles.backToLoginText}> Back to Login</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  background: { ...StyleSheet.absoluteFillObject },
  scrollContent: { paddingBottom: 40 },
  header: { alignItems: "center", marginTop: 80, marginBottom: 30 },
  logoContainer: {
    width: 80, height: 80, borderRadius: 24, overflow: "hidden", elevation: 8,
    shadowColor: "#059669", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8
  },
  logoGradient: { flex: 1, justifyContent: "center", alignItems: "center" },
  appName: { fontSize: 32, fontWeight: "900", color: "#065f46", marginTop: 12 },
  tagline: { fontSize: 14, color: "#10b981", fontWeight: "700", letterSpacing: 1 },

  formCard: {
    marginHorizontal: 24,
    backgroundColor: "#fff",
    borderRadius: 30,
    padding: 24,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  title: { fontSize: 24, fontWeight: "900", color: "#0f172a", textAlign: "center" },
  subtitle: { fontSize: 13, color: "#64748b", textAlign: "center", marginTop: 6, marginBottom: 24, lineHeight: 18 },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 15, color: "#0f172a", fontWeight: "600" },
  eyeIcon: { padding: 4 },

  forgotBtn: { alignSelf: "flex-end", marginBottom: 24 },
  forgotText: { fontSize: 13, color: "#10b981", fontWeight: "700" },

  mainBtn: {
    height: 56,
    backgroundColor: "#10b981",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  mainBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: 24, alignItems: "center" },
  footerText: { fontSize: 14, color: "#64748b", fontWeight: "600" },
  footerLink: { fontSize: 14, color: "#10b981", fontWeight: "800" },

  timerRow: { flexDirection: "row", justifyContent: "space-between", marginTop: -8, marginBottom: 16, paddingHorizontal: 4 },
  timerText: { fontSize: 12, color: "#64748b", fontWeight: "700" },
  resendText: { fontSize: 12, color: "#10b981", fontWeight: "800" },

  backToLogin: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 20 },
  backToLoginText: { fontSize: 13, color: "#10b981", fontWeight: "700" },
});