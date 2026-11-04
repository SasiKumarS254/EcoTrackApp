import React, { useState, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, StatusBar
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../context/ThemeContext";
import { Radius, Shadow, FontSize } from "@/constants/theme";
import { fetchRegisteredEvents } from "../../services/api";

export default function DashboardScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const [user, setUser] = useState<any>(null);
  const [upcomingEvent, setUpcomingEvent] = useState<any>(null);

  const loadData = useCallback(async () => {
    try {
      const sessionRaw = await AsyncStorage.getItem("@ecotrack_user_session");
      if (sessionRaw) {
        const session = JSON.parse(sessionRaw);
        setUser(session);
        const userId = session.user_id || session.id;
        if (userId) {
          const events = await fetchRegisteredEvents(userId).catch(() => []);
          if (Array.isArray(events) && events.length > 0) {
            setUpcomingEvent(events[0]);
          } else {
            setUpcomingEvent(null);
          }
        }
      }
    } catch {
      console.warn("Dashboard load error");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* TOP BAR */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <Image
            source={require("@/assets/images/logo.png")}
            style={styles.brandIcon}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.brandTitle}>EcoTrack</Text>
            <Text style={styles.brandTag}>WELFARE ENGINE</Text>
          </View>
        </View>

        <View style={styles.topRightActions}>
          <TouchableOpacity style={styles.themeToggleBtn} onPress={toggleTheme}>
            <Ionicons name={isDark ? "sunny" : "moon"} size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.userPill} onPress={() => router.navigate("/(tabs)/profile" as any)}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>
                {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
              </Text>
            </View>
            <Text style={styles.userNameText} numberOfLines={1}>
              {user?.name ? user.name.split(" ")[0] : "Account"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO CARD */}
        <View style={styles.heroCard}>
          <LinearGradient
            colors={isDark ? ["#064e3b", "#065f46"] : ["#10b981", "#059669"]}
            style={styles.heroGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.heroBadge}>
              <Ionicons name="flash" size={12} color="#fff" />
              <Text style={styles.heroBadgeText}>100% OFFLINE AI ENGINE ACTIVE</Text>
            </View>

            <Text style={styles.heroTitle}>Universal Animal Species & Welfare Ecosystem</Text>
            <Text style={styles.heroDesc}>
              Train animal species & breeds. Analyze movement patterns, check posture health, and manage verified adoption listings — all powered by offline AI.
            </Text>

            <View style={styles.heroBtnRow}>
              <TouchableOpacity
                style={styles.heroPrimaryBtn}
                onPress={() => router.navigate("/training" as any)}
                activeOpacity={0.88}
              >
                <Text style={styles.heroPrimaryBtnText}>🚀 Species Trainer</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.heroSecondaryBtn}
                onPress={() => router.navigate("/marketplace" as any)}
                activeOpacity={0.88}
              >
                <Text style={styles.heroSecondaryBtnText}>🛍️ Marketplace</Text>
              </TouchableOpacity>
            </View>

            <Image
              source={{ uri: "https://images.unsplash.com/photo-1517849845537-4d257902454a?w=480" }}
              style={styles.heroDogImage}
            />
          </LinearGradient>
        </View>

        {/* DYNAMIC ACTIVITY SECTION */}
        {upcomingEvent ? (
          <View style={styles.activityCard}>
            <View style={styles.activityHeader}>
              <Ionicons name="calendar" size={16} color={colors.primary} />
              <Text style={styles.activityHeaderTitle}>Upcoming Registered Event</Text>
            </View>
            <Text style={styles.activityEventTitle}>{upcomingEvent.title}</Text>
            <View style={styles.activityMetaRow}>
              <Ionicons name="location" size={13} color={colors.primary} />
              <Text style={styles.activityMetaText}>{upcomingEvent.location || "City Center Venue"}</Text>
            </View>
            <View style={styles.activityMetaRow}>
              <Ionicons name="time" size={13} color={colors.textMuted} />
              <Text style={styles.activityMetaText}>Date: {upcomingEvent.date || "Scheduled"}</Text>
            </View>
            <TouchableOpacity
              style={styles.activityBtn}
              onPress={() => router.navigate("/events" as any)}
            >
              <Ionicons name="ticket" size={14} color="#fff" />
              <Text style={styles.activityBtnText}>View Entry Pass in Vault</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.welcomeCard}>
            <View style={styles.welcomeTop}>
              <Text style={styles.welcomeTitle}>Welcome to EcoTrack! 👋</Text>
              <Text style={styles.welcomeDesc}>
                Get started by training your animal species with our weight-scaled AI trainer, scanning movement postures in real-time, or discovering verified adoption & medical listings.
              </Text>
            </View>
          </View>
        )}

        {/* QUICK ACTIONS EXECUTIVE BENTO GRID */}
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="sparkles" size={18} color={colors.primary} />
          <Text style={styles.sectionTitle}>Executive Command Hub</Text>
        </View>

        {/* Hero Bento: AI Scanner */}
        <TouchableOpacity
          style={styles.heroBentoCard}
          onPress={() => router.navigate("/aiscanner" as any)}
          activeOpacity={0.88}
        >
          <View style={styles.heroBentoGlow} />
          <View style={styles.heroBentoHeader}>
            <View style={styles.heroBentoIconCircle}>
              <Ionicons name="scan" size={24} color="#10b981" />
            </View>
            <View style={styles.heroLiveBadge}>
              <View style={styles.heroLiveDot} />
              <Text style={styles.heroLiveBadgeText}>RTMPose AP-10K</Text>
            </View>
          </View>
          <Text style={styles.heroBentoTitle}>AI Biomechanical Scanner</Text>
          <Text style={styles.heroBentoDesc}>
            Analyze quadruped posture, joint angles, gait symmetry and load tolerances in real-time.
          </Text>
          <View style={styles.heroBentoFooter}>
            <Text style={styles.heroBentoBtnText}>Launch Live Scanner</Text>
            <Ionicons name="arrow-forward-circle" size={20} color="#10b981" />
          </View>
        </TouchableOpacity>

        {/* 2-Column Bento Grid */}
        <View style={styles.bentoGrid}>
          {/* Species Trainer */}
          <TouchableOpacity
            style={styles.bentoCard}
            onPress={() => router.navigate("/training" as any)}
            activeOpacity={0.85}
          >
            <View style={[styles.bentoIconCircle, { backgroundColor: "rgba(139, 92, 246, 0.12)" }]}>
              <Ionicons name="barbell" size={22} color="#8b5cf6" />
            </View>
            <Text style={styles.bentoTitle}>Species Trainer</Text>
            <Text style={styles.bentoDesc}>Weight-scaled workouts for Canine, Feline & Equine</Text>
            <View style={styles.bentoChevronRow}>
              <Text style={[styles.bentoTag, { color: "#8b5cf6" }]}>Coach Active</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
            </View>
          </TouchableOpacity>

          {/* Explore Hub */}
          <TouchableOpacity
            style={styles.bentoCard}
            onPress={() => router.navigate("/explore" as any)}
            activeOpacity={0.85}
          >
            <View style={[styles.bentoIconCircle, { backgroundColor: "rgba(6, 182, 212, 0.12)" }]}>
              <Ionicons name="compass" size={22} color="#06b6d4" />
            </View>
            <Text style={styles.bentoTitle}>Explore Hub</Text>
            <Text style={styles.bentoDesc}>Central portal for Market, Events & ER care</Text>
            <View style={styles.bentoChevronRow}>
              <Text style={[styles.bentoTag, { color: "#06b6d4" }]}>All-In-One</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
            </View>
          </TouchableOpacity>

          {/* Adoption & Market */}
          <TouchableOpacity
            style={styles.bentoCard}
            onPress={() => router.navigate("/marketplace" as any)}
            activeOpacity={0.85}
          >
            <View style={[styles.bentoIconCircle, { backgroundColor: "rgba(249, 115, 22, 0.12)" }]}>
              <Ionicons name="cart" size={22} color="#f97316" />
            </View>
            <Text style={styles.bentoTitle}>Marketplace</Text>
            <Text style={styles.bentoDesc}>Supplies, verified pets & direct shelter chat</Text>
            <View style={styles.bentoChevronRow}>
              <Text style={[styles.bentoTag, { color: "#f97316" }]}>Verified Direct</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
            </View>
          </TouchableOpacity>

          {/* Events & Pass Vault */}
          <TouchableOpacity
            style={styles.bentoCard}
            onPress={() => router.navigate("/events" as any)}
            activeOpacity={0.85}
          >
            <View style={[styles.bentoIconCircle, { backgroundColor: "rgba(245, 158, 11, 0.12)" }]}>
              <Ionicons name="ticket" size={22} color="#f59e0b" />
            </View>
            <Text style={styles.bentoTitle}>Events & Passes</Text>
            <Text style={styles.bentoDesc}>Rescue drives, digital tickets & QR check-in</Text>
            <View style={styles.bentoChevronRow}>
              <Text style={[styles.bentoTag, { color: "#f59e0b" }]}>Pass Vault</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
            </View>
          </TouchableOpacity>

          {/* 24/7 Vet & ER Care */}
          <TouchableOpacity
            style={styles.bentoCard}
            onPress={() => router.navigate("/maps" as any)}
            activeOpacity={0.85}
          >
            <View style={[styles.bentoIconCircle, { backgroundColor: "rgba(239, 68, 68, 0.12)" }]}>
              <Ionicons name="medical" size={22} color="#ef4444" />
            </View>
            <Text style={styles.bentoTitle}>24×7 Vet Care</Text>
            <Text style={styles.bentoDesc}>Emergency trauma locator & instant bookings</Text>
            <View style={styles.bentoChevronRow}>
              <Text style={[styles.bentoTag, { color: "#ef4444" }]}>ER Locator</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
            </View>
          </TouchableOpacity>

          {/* Community Hub */}
          <TouchableOpacity
            style={styles.bentoCard}
            onPress={() => router.navigate("/community" as any)}
            activeOpacity={0.85}
          >
            <View style={[styles.bentoIconCircle, { backgroundColor: "rgba(99, 102, 241, 0.12)" }]}>
              <Ionicons name="chatbubbles" size={22} color="#6366f1" />
            </View>
            <Text style={styles.bentoTitle}>Community Feed</Text>
            <Text style={styles.bentoDesc}>Share recoveries, ask vet advice & post updates</Text>
            <View style={styles.bentoChevronRow}>
              <Text style={[styles.bentoTag, { color: "#6366f1" }]}>Live Forum</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
            </View>
          </TouchableOpacity>
        </View>

        {/* HIGHLIGHT BANNER */}
        <View style={styles.sanctuaryBanner}>
          <View style={styles.sanctuaryLeft}>
            <Text style={styles.sanctuaryBadge}>PROTECTED SANCTUARY DIRECTORY</Text>
            <Text style={styles.sanctuaryTitle}>Verified 24×7 Trauma Care</Text>
            <Text style={styles.sanctuaryDesc}>Emergency ambulance & veterinary hospital locator active across all partner zones.</Text>
            <TouchableOpacity
              style={styles.sanctuaryBtn}
              onPress={() => router.navigate("/maps" as any)}
            >
              <Text style={styles.sanctuaryBtnText}>Emergency Helpline</Text>
              <Ionicons name="arrow-forward" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function getStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.bgLight,
    },
    topBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 18,
      paddingVertical: 12,
      backgroundColor: colors.bgCard,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      maxWidth: 1000,
      width: "100%",
      alignSelf: "center",
    },
    brandRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    brandIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
    },
    brandTitle: {
      fontSize: 18,
      fontWeight: "900",
      color: colors.textPrimary,
      letterSpacing: -0.5,
    },
    brandTag: {
      fontSize: 9,
      fontWeight: "800",
      color: colors.primary,
      letterSpacing: 1,
    },
    topRightActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    themeToggleBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    userPill: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: Radius.full,
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    userAvatar: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.primary,
      justifyContent: "center",
      alignItems: "center",
    },
    userAvatarText: {
      color: "#fff",
      fontSize: 12,
      fontWeight: "800",
    },
    userNameText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textPrimary,
      maxWidth: 90,
    },

    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
      maxWidth: 1000,
      width: "100%",
      alignSelf: "center",
    },

    heroCard: {
      borderRadius: Radius.xl,
      overflow: "hidden",
      marginBottom: 18,
      ...Shadow.md,
    },
    heroGradient: {
      padding: 22,
      position: "relative",
      minHeight: 220,
      justifyContent: "center",
    },
    heroBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.22)",
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: Radius.full,
      gap: 6,
      marginBottom: 12,
    },
    heroBadgeText: {
      color: "#fff",
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.8,
    },
    heroTitle: {
      color: "#fff",
      fontSize: 21,
      fontWeight: "900",
      lineHeight: 28,
      marginBottom: 8,
      maxWidth: "80%",
    },
    heroDesc: {
      color: "rgba(255,255,255,0.9)",
      fontSize: 12.5,
      lineHeight: 18,
      marginBottom: 18,
      maxWidth: "75%",
      fontWeight: "500",
    },
    heroBtnRow: {
      flexDirection: "row",
      gap: 10,
      flexWrap: "wrap",
    },
    heroPrimaryBtn: {
      backgroundColor: "#fff",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: Radius.full,
      ...Shadow.sm,
    },
    heroPrimaryBtnText: {
      color: "#059669",
      fontWeight: "800",
      fontSize: FontSize.sm,
    },
    heroSecondaryBtn: {
      backgroundColor: "rgba(255,255,255,0.22)",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: Radius.full,
    },
    heroSecondaryBtnText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: FontSize.sm,
    },
    heroDogImage: {
      position: "absolute",
      right: -10,
      bottom: -10,
      width: 140,
      height: 140,
      opacity: 0.92,
      resizeMode: "contain",
    },

    welcomeCard: {
      backgroundColor: colors.bgCard,
      borderRadius: Radius.lg,
      padding: 18,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
      ...Shadow.sm,
    },
    welcomeTop: {},
    welcomeTitle: {
      fontSize: FontSize.lg,
      fontWeight: "900",
      color: colors.textPrimary,
      marginBottom: 6,
    },
    welcomeDesc: {
      fontSize: FontSize.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },

    activityCard: {
      backgroundColor: colors.bgCard,
      borderRadius: Radius.lg,
      padding: 18,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
      ...Shadow.sm,
    },
    activityHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 8,
    },
    activityHeaderTitle: {
      fontSize: 11,
      fontWeight: "800",
      color: colors.primary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    activityEventTitle: {
      fontSize: FontSize.lg,
      fontWeight: "800",
      color: colors.textPrimary,
      marginBottom: 6,
    },
    activityMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 4,
    },
    activityMetaText: {
      fontSize: FontSize.xs,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    activityBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      paddingVertical: 10,
      borderRadius: Radius.md,
      gap: 6,
      marginTop: 12,
    },
    activityBtnText: {
      color: "#fff",
      fontWeight: "800",
      fontSize: FontSize.sm,
    },

    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
      marginTop: 4,
    },
    sectionTitle: {
      fontSize: FontSize.lg,
      fontWeight: "800",
      color: colors.textPrimary,
    },

    /* HERO BENTO CARD */
    heroBentoCard: {
      backgroundColor: isDark ? "#06281e" : "#ecfdf5",
      borderRadius: Radius.xl,
      padding: 18,
      borderWidth: 1.5,
      borderColor: isDark ? "rgba(16, 185, 129, 0.35)" : "#a7f3d0",
      marginBottom: 16,
      position: "relative",
      overflow: "hidden",
      ...Shadow.sm,
    },
    heroBentoGlow: {
      position: "absolute",
      right: -30,
      top: -30,
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: "rgba(16, 185, 129, 0.15)",
    },
    heroBentoHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    heroBentoIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: isDark ? "rgba(16, 185, 129, 0.2)" : "#d1fae5",
      justifyContent: "center",
      alignItems: "center",
    },
    heroLiveBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? "rgba(16, 185, 129, 0.2)" : "#d1fae5",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: Radius.full,
      gap: 6,
    },
    heroLiveDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: "#10b981",
    },
    heroLiveBadgeText: {
      fontSize: 10,
      fontWeight: "800",
      color: "#059669",
      letterSpacing: 0.5,
    },
    heroBentoTitle: {
      fontSize: FontSize.lg,
      fontWeight: "900",
      color: colors.textPrimary,
      marginBottom: 4,
    },
    heroBentoDesc: {
      fontSize: FontSize.xs,
      color: colors.textSecondary,
      lineHeight: 18,
      marginBottom: 14,
    },
    heroBentoFooter: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    heroBentoBtnText: {
      fontSize: FontSize.xs,
      fontWeight: "800",
      color: "#10b981",
    },

    /* 2-COLUMN BENTO GRID */
    bentoGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      marginBottom: 24,
    },
    bentoCard: {
      width: "48%",
      backgroundColor: colors.bgCard,
      borderRadius: Radius.lg,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: "space-between",
      ...Shadow.sm,
    },
    bentoIconCircle: {
      width: 40,
      height: 40,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 10,
    },
    bentoTitle: {
      fontSize: FontSize.sm,
      fontWeight: "800",
      color: colors.textPrimary,
      marginBottom: 4,
    },
    bentoDesc: {
      fontSize: 11,
      color: colors.textMuted,
      lineHeight: 15,
      marginBottom: 12,
      minHeight: 30,
    },
    bentoChevronRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    bentoTag: {
      fontSize: 9.5,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },

    sanctuaryBanner: {
      backgroundColor: isDark ? "#0f172a" : "#f0fdf4",
      borderRadius: Radius.xl,
      padding: 20,
      borderWidth: 1,
      borderColor: isDark ? "#1e293b" : "#bbf7d0",
      marginBottom: 20,
    },
    sanctuaryLeft: {},
    sanctuaryBadge: {
      fontSize: 9.5,
      fontWeight: "800",
      color: colors.primary,
      letterSpacing: 1,
      marginBottom: 6,
    },
    sanctuaryTitle: {
      fontSize: FontSize.lg,
      fontWeight: "900",
      color: colors.textPrimary,
      marginBottom: 6,
    },
    sanctuaryDesc: {
      fontSize: FontSize.xs,
      color: colors.textSecondary,
      lineHeight: 18,
      marginBottom: 14,
    },
    sanctuaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: Radius.full,
      gap: 6,
    },
    sanctuaryBtnText: {
      color: "#fff",
      fontSize: FontSize.xs,
      fontWeight: "800",
    },
  });
}
