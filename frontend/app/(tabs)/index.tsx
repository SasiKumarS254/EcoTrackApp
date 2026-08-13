import React, { useState, useRef, useMemo, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Dimensions, StatusBar, Animated, TextInput, ActivityIndicator,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Radius, Shadow, FontSize, Spacing } from "@/constants/theme";
import { useTheme } from "../../context/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchScanHistory, fetchTrainingPrograms, fetchRegisteredEvents, API_BASE_URL, STORAGE_KEYS } from "../../services/api";

const { width } = Dimensions.get("window");

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const scrollY = useRef(new Animated.Value(0)).current;

  const features = useMemo(() => [
    { id: 3, title: "Marketplace", icon: "cart", color: colors.primary, route: "/marketplace", desc: "Buy, sell & adopt", stat: "Active" },
    { id: 4, title: "AI Training", icon: "school", color: colors.accent, route: "/training", desc: "Personalized plans", stat: "Scaled" },
    { id: 5, title: "Community", icon: "people", color: colors.purple, route: "/community", desc: "Join the network", stat: "Social" },
    { id: 6, title: "Events", icon: "calendar", color: colors.warning, route: "/events", desc: "Wildlife events", stat: "Rescue" },
    { id: 7, title: "Services", icon: "map", color: colors.danger, route: "/maps", desc: "Hospitals & vets", stat: "Nearby" },
    { id: 8, title: "Scanner", icon: "scan", color: "#0ea5e9", route: "/scanner", desc: "AI Pose Analysis", stat: "Real-time" },
  ], [colors]);

  const [greeting] = useState(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  });

  const [user, setUser] = useState<any>(null);
  const [metrics, setMetrics] = useState({
    latestScan: null as any,
    activeProgram: null as any,
    upcomingEvent: null as any,
  });
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [])
  );

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      const sessionRaw = await AsyncStorage.getItem(STORAGE_KEYS.SESSION);
      if (sessionRaw) {
        const session = JSON.parse(sessionRaw);
        setUser(session);

        const userId = session.id;
        const [scans, programs, events] = await Promise.all([
          fetchScanHistory(userId).catch(() => []),
          fetchTrainingPrograms(userId).catch(() => []),
          fetchRegisteredEvents(userId).catch(() => [])
        ]);

        const latestScan = scans && scans.length > 0 ? scans[0] : null;
        const activeProgram = programs && programs.length > 0 ? programs.find((p: any) => p.status !== 'Completed') || programs[0] : null;
        const upcomingEvent = events && events.length > 0 ? events[0] : null;

        setMetrics({ latestScan, activeProgram, upcomingEvent });
      }
    } catch (e) {
      console.warn("Dashboard sync error", e);
    } finally {
      setIsLoading(false);
    }
  };

  const stats = [
    { label: "XP", value: user?.reputation_score || 100, icon: "trophy", color: colors.accent },
    { label: "Scans", value: user?.scans_count || metrics.latestScan ? "1+" : "0", icon: "scan", color: colors.danger },
    { label: "Level", value: "1", icon: "ribbon", color: colors.primary },
  ];

  return (
    <View style={styles.root}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bgLight} />
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
      >
        {/* ── HEADER ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting} 👋</Text>
            <Text style={styles.title}>{user?.name || "Guest"}</Text>
            <Text style={styles.tagline}>Intelligent Animal Companion</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/profile")} style={styles.avatarWrapper}>
            {user?.avatar_url || user?.avatar ? (
              <Image source={{ uri: user.avatar_url || user.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 20 }}>{(user?.name || "E").charAt(0)}</Text>
              </View>
            )}
            <View style={styles.onlineDot} />
          </TouchableOpacity>
        </View>

        {/* ── SEARCH BAR ── */}
        <View style={[styles.searchContainer, { marginHorizontal: 20, marginTop: 12 }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            placeholder="Search marketplace, events or services..."
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.textPrimary }]}
          />
        </View>

        {/* ── HERO CARD ── */}
        <View style={styles.heroCard}>
          <LinearGradient
            colors={isDark ? ["#064e3b", "#065f46"] : ["#10b981", "#059669"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.heroTextBlock}>
            <Text style={styles.heroTitle}>🌍 EcoTrack{"\n"}Network</Text>
            <Text style={styles.heroSub}>Train, rescue & connect — building a better future for wildlife.</Text>
          </View>
          <Image
            source={{ uri: "https://images.unsplash.com/photo-1517849845537-4d257902454a?w=300" }}
            style={styles.heroImage}
          />
        </View>

        {/* ── QUICK STATS ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsRow}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
          {stats.map((s, i) => (
            <View key={i} style={styles.statChip}>
              <View style={styles.statIconWrap}>
                <Ionicons name={s.icon as any} size={18} color={colors.primary} />
              </View>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </ScrollView>

        {/* ── ACTIVITY SECTION ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📈 Recent Activity</Text>
        </View>

        {isLoading ? (
          <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color={colors.primary} /></View>
        ) : (
          <View style={styles.activityGrid}>
            {/* 1. Latest Scan */}
            <View style={styles.activityCard}>
              <View style={styles.activityCardHeader}>
                <Ionicons name="scan" size={18} color={colors.primary} />
                <Text style={styles.activityCardHeaderText}>Latest AI Scan</Text>
              </View>
              {metrics.latestScan ? (
                <View style={styles.activityCardBody}>
                  <Text style={styles.activityMainText}>{metrics.latestScan.detectedSpecies}</Text>
                  <Text style={styles.activitySubText}>Score: {metrics.latestScan.formScore || metrics.latestScan.score}%</Text>
                  <Text style={styles.activityDate}>
                    <Ionicons name="time-outline" size={10} /> {new Date(metrics.latestScan.timestamp || metrics.latestScan.date).toLocaleDateString()}
                  </Text>
                  <TouchableOpacity style={styles.activityAction} onPress={() => router.push("/scanner")}>
                    <Text style={styles.activityActionText}>Run New Scan</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.activityCardBody}>
                  <Text style={styles.activityEmptyText}>No scans in your vault.</Text>
                  <TouchableOpacity style={styles.activityActionPrimary} onPress={() => router.push("/scanner")}>
                    <Text style={styles.activityActionTextPrimary}>Scan Animal</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* 2. Active Training */}
            <View style={styles.activityCard}>
              <View style={styles.activityCardHeader}>
                <Ionicons name="fitness" size={18} color={colors.accent} />
                <Text style={styles.activityCardHeaderText}>Active Training</Text>
              </View>
              {metrics.activeProgram ? (
                <View style={styles.activityCardBody}>
                  <Text style={styles.activityMainText} numberOfLines={1}>{metrics.activeProgram.name || metrics.activeProgram.species}</Text>
                  <View style={styles.activityProgressRow}>
                    <View style={styles.activityProgressBar}>
                      <View style={[styles.activityProgressFill, { width: `${metrics.activeProgram.progress || 0}%`, backgroundColor: colors.primary }]} />
                    </View>
                    <Text style={styles.activityProgressPct}>{metrics.activeProgram.progress || 0}%</Text>
                  </View>
                  <TouchableOpacity style={styles.activityAction} onPress={() => router.push("/training")}>
                    <Text style={styles.activityActionText}>Resume Plan</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.activityCardBody}>
                  <Text style={styles.activityEmptyText}>No active training plan.</Text>
                  <TouchableOpacity style={styles.activityActionPrimary} onPress={() => router.push("/training")}>
                    <Text style={styles.activityActionTextPrimary}>Start Training</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── QUICK ACTIONS GRID ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>
          <Text style={styles.sectionSub}>All Modules</Text>
        </View>
        <View style={styles.featuresGrid}>
          {features.map((f) => (
            <TouchableOpacity
              key={f.id}
              style={styles.featureCard}
              onPress={() => router.push(f.route as any)}
              activeOpacity={0.85}
            >
              <View style={styles.featureIconWrap}>
                <Ionicons name={f.icon as any} size={24} color={colors.primary} />
              </View>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc} numberOfLines={1}>{f.desc}</Text>
              {f.stat && (
                <View style={styles.featureStat}>
                  <Text style={styles.featureStatText}>{f.stat}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── EMERGENCY CARD ── */}
        <TouchableOpacity style={styles.emergencyCard} onPress={() => router.push("/maps")} activeOpacity={0.9}>
          <View style={styles.emergencyLeft}>
            <View style={styles.emergencyIcon}>
              <Ionicons name="warning" size={24} color="#fff" />
            </View>
            <View style={{ marginLeft: 14 }}>
              <Text style={styles.emergencyTitle}>Animal Emergency</Text>
              <Text style={styles.emergencyText}>Find emergency vet services nearby</Text>
            </View>
          </View>
          <View style={styles.emergencyArrow}>
            <Ionicons name="chevron-forward" size={20} color={colors.danger} />
          </View>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

function getStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgLight },
    container: { flex: 1 },

    header: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      paddingHorizontal: 20, paddingTop: 56, paddingBottom: 8,
    },
    greeting: { fontSize: FontSize.md, color: colors.textSecondary, fontWeight: "500" },
    title: { fontSize: FontSize.xxxl, fontWeight: "800", color: colors.primary, marginTop: 2 },
    tagline: { fontSize: FontSize.sm, color: colors.textMuted, marginTop: 2 },
    avatarWrapper: { position: "relative" },
    avatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: colors.primaryLight },
    onlineDot: { position: "absolute", bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.success, borderWidth: 2, borderColor: isDark ? colors.bgCard : "#fff" },

    searchContainer: {
      flexDirection: "row", alignItems: "center", gap: 10,
      backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
      borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 10,
      ...Shadow.sm,
    },
    searchInput: { flex: 1, fontSize: FontSize.sm, padding: 0 },

    heroCard: {
      marginHorizontal: 20, marginTop: 16, borderRadius: Radius.xl,
      flexDirection: "row", overflow: "hidden",
      position: "relative",
      ...Shadow.lg,
    },
    heroTextBlock: { flex: 1, padding: 24, justifyContent: "center" },
    heroTitle: { fontSize: FontSize.xxl, fontWeight: "800", color: "#fff", lineHeight: 32 },
    heroSub: { fontSize: FontSize.sm, color: isDark ? colors.bgLight : "#d1fae5", marginTop: 8, lineHeight: 20 },
    heroImage: { width: 120, height: "100%", opacity: 0.85 },

    statsRow: { paddingLeft: 20, marginTop: 20 },
    statChip: {
      alignItems: "center", justifyContent: "center", backgroundColor: colors.bgCard, borderRadius: Radius.lg,
      width: 100, height: 105, marginRight: 10,
      borderWidth: 1, borderColor: colors.border,
      ...Shadow.sm,
    },
    statIconWrap: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary + "12",
      justifyContent: "center", alignItems: "center", marginBottom: 4
    },
    statValue: { fontSize: FontSize.lg, fontWeight: "800", color: colors.textPrimary, marginTop: 2 },
    statLabel: { fontSize: FontSize.xs, color: colors.textSecondary, marginTop: 2 },

    sectionHeader: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end",
      paddingHorizontal: 20, marginTop: 28, marginBottom: 16,
    },
    sectionTitle: { fontSize: FontSize.xl, fontWeight: "800", color: colors.textPrimary },
    sectionSub: { fontSize: FontSize.sm, color: colors.textMuted },

    activityGrid: { flexDirection: 'row', paddingHorizontal: 16, gap: 12 },
    activityCard: { flex: 1, backgroundColor: colors.bgCard, borderRadius: Radius.xl, padding: 14, borderWidth: 1, borderColor: colors.border, ...Shadow.sm },
    activityCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
    activityCardHeaderText: { fontSize: 12, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase' },
    activityCardBody: { gap: 4 },
    activityMainText: { fontSize: 15, fontWeight: '900', color: colors.textPrimary },
    activitySubText: { fontSize: 12, color: colors.textSecondary },
    activityDate: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
    activityEmptyText: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic', marginBottom: 8 },
    activityAction: { marginTop: 8, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.bgLight, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    activityActionText: { fontSize: 11, fontWeight: '800', color: colors.primary },
    activityActionPrimary: { marginTop: 8, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center' },
    activityActionTextPrimary: { fontSize: 11, fontWeight: '800', color: '#fff' },
    activityProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    activityProgressBar: { flex: 1, height: 4, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 2, overflow: 'hidden' },
    activityProgressFill: { height: '100%', borderRadius: 2 },
    activityProgressPct: { fontSize: 10, fontWeight: '800', color: colors.primary },

    featuresGrid: {
      flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 14, gap: 10,
    },
    featureCard: {
      width: (width - 48) / 3, height: 135, backgroundColor: colors.bgCard, borderRadius: Radius.xl,
      padding: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, ...Shadow.sm,
    },
    featureIconWrap: { width: 50, height: 50, borderRadius: 16, backgroundColor: colors.primary + "12", justifyContent: "center", alignItems: "center", marginBottom: 4 },
    featureTitle: { fontSize: FontSize.sm, fontWeight: "800", color: colors.textPrimary, marginTop: 6, textAlign: "center" },
    featureDesc: { fontSize: 10, color: colors.textMuted, marginTop: 2, textAlign: "center" },
    featureStat: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2, marginTop: 6, backgroundColor: colors.primary + "12" },
    featureStatText: { fontSize: 10, fontWeight: "800", color: colors.primary },

    emergencyCard: {
      marginHorizontal: 20, marginTop: 16, backgroundColor: isDark ? "#450a0a" : "#fff1f2",
      borderRadius: Radius.xl, padding: 18, flexDirection: "row",
      alignItems: "center", justifyContent: "space-between",
      borderWidth: 1.5, borderColor: isDark ? "#7f1d1d" : "#fecdd3",
    },
    emergencyLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
    emergencyIcon: {
      width: 48, height: 48, borderRadius: 14, backgroundColor: colors.danger,
      justifyContent: "center", alignItems: "center",
    },
    emergencyTitle: { fontSize: FontSize.lg, fontWeight: "800", color: colors.danger },
    emergencyText: { fontSize: FontSize.sm, color: isDark ? "#f87171" : "#f87171", marginTop: 2 },
    emergencyArrow: {
      width: 36, height: 36, borderRadius: 12, backgroundColor: isDark ? "#7f1d1d" : "#ffe4e6",
      justifyContent: "center", alignItems: "center",
    },
  });
}

function getStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgLight },
    container: { flex: 1 },

    header: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      paddingHorizontal: 20, paddingTop: 56, paddingBottom: 8,
    },
    greeting: { fontSize: FontSize.md, color: colors.textSecondary, fontWeight: "500" },
    title: { fontSize: FontSize.xxxl, fontWeight: "800", color: colors.primary, marginTop: 2 },
    tagline: { fontSize: FontSize.sm, color: colors.textMuted, marginTop: 2 },
    avatarWrapper: { position: "relative" },
    avatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: colors.primaryLight },
    onlineDot: { position: "absolute", bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.success, borderWidth: 2, borderColor: isDark ? colors.bgCard : "#fff" },

    searchContainer: {
      flexDirection: "row", alignItems: "center", gap: 10,
      backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
      borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 10,
      ...Shadow.sm,
    },
    searchInput: { flex: 1, fontSize: FontSize.sm, padding: 0 },

    // Hero
    heroCard: {
      marginHorizontal: 20, marginTop: 16, borderRadius: Radius.xl,
      flexDirection: "row", overflow: "hidden",
      position: "relative",
      ...Shadow.lg,
    },
    heroTextBlock: { flex: 1, padding: 24, justifyContent: "center" },
    heroBadge: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: isDark ? colors.bgLight : "#fff", borderRadius: Radius.full,
      paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start", marginBottom: 10,
    },
    heroBadgeText: { fontSize: FontSize.xs, fontWeight: "700", color: colors.primary, marginLeft: 4 },
    heroTitle: { fontSize: FontSize.xxl, fontWeight: "800", color: "#fff", lineHeight: 32 },
    heroSub: { fontSize: FontSize.sm, color: isDark ? colors.bgLight : "#d1fae5", marginTop: 8, lineHeight: 20 },
    heroBtn: {
      flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.2)",
      borderRadius: Radius.md, paddingVertical: 10, paddingHorizontal: 16,
      marginTop: 18, alignSelf: "flex-start",
    },
    heroBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.md, marginLeft: 8 },
    heroImage: { width: 120, height: "100%", opacity: 0.85 },

    // Stats
    statsRow: { paddingLeft: 20, marginTop: 20 },
    statChip: {
      alignItems: "center", justifyContent: "center", backgroundColor: colors.bgCard, borderRadius: Radius.lg,
      width: 95, height: 105, marginRight: 10,
      borderWidth: 1, borderColor: colors.border,
      ...Shadow.sm,
    },
    statIconWrap: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary + "12",
      justifyContent: "center", alignItems: "center", marginBottom: 4
    },
    statValue: { fontSize: FontSize.lg, fontWeight: "800", color: colors.textPrimary, marginTop: 2 },
    statLabel: { fontSize: FontSize.xs, color: colors.textSecondary, marginTop: 2 },

    // Section
    sectionHeader: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end",
      paddingHorizontal: 20, marginTop: 28, marginBottom: 16,
    },
    sectionTitle: { fontSize: FontSize.xl, fontWeight: "800", color: colors.textPrimary },
    sectionSub: { fontSize: FontSize.sm, color: colors.textMuted },
    seeAll: { fontSize: FontSize.sm, fontWeight: "700", color: colors.primary },

    // Feature Grid
    featuresGrid: {
      flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 14, gap: 10,
    },
    grid: {
      flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 14, gap: 10, display: "none",
    },
    featureCard: {
      width: (width - 48) / 3, height: 135, backgroundColor: colors.bgCard, borderRadius: Radius.xl,
      padding: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, ...Shadow.sm,
    },
    featureIconWrap: { width: 50, height: 50, borderRadius: 16, backgroundColor: colors.primary + "12", justifyContent: "center", alignItems: "center", marginBottom: 4 },
    featureIcon: { width: 50, height: 50, borderRadius: 16, justifyContent: "center", alignItems: "center" },
    featureTitle: { fontSize: FontSize.sm, fontWeight: "800", color: colors.textPrimary, marginTop: 6, textAlign: "center" },
    featureDesc: { fontSize: 10, color: colors.textMuted, marginTop: 2, textAlign: "center" },
    featureStat: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2, marginTop: 6, backgroundColor: colors.primary + "12" },
    featureStatText: { fontSize: 10, fontWeight: "800", color: colors.primary },

    // Trending Animals
    animalCard: {
      backgroundColor: colors.bgCard, borderRadius: Radius.lg,
      width: 160, marginLeft: 16, padding: 16, borderWidth: 1, borderColor: colors.border, ...Shadow.sm,
    },
    animalEmoji: {
      width: 72, height: 72, borderRadius: 20, backgroundColor: isDark ? colors.bgLight : "#f0fdf4",
      justifyContent: "center", alignItems: "center",
    },
    animalBody: { marginTop: 12 },
    animalName: { fontSize: FontSize.md, fontWeight: "700", color: colors.textPrimary },
    animalClass: { fontSize: FontSize.xs, color: colors.textSecondary, marginTop: 3 },
    statusBadge: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3, marginTop: 8, alignSelf: "flex-start" },
    statusText: { fontSize: FontSize.xs, fontWeight: "700" },

    // AI Card
    aiCard: {
      marginHorizontal: 20, marginTop: 24, backgroundColor: colors.bgCard,
      borderRadius: Radius.xl, padding: 20, borderWidth: 1, borderColor: colors.border, ...Shadow.md,
    },
    aiLeft: { flexDirection: "row", alignItems: "flex-start", marginBottom: 16 },
    aiIconBg: {
      width: 52, height: 52, borderRadius: 16, backgroundColor: isDark ? colors.bgLight : "#dcfce7",
      justifyContent: "center", alignItems: "center",
    },
    aiTitle: { fontSize: FontSize.lg, fontWeight: "800", color: colors.textPrimary },
    aiText: { fontSize: FontSize.sm, color: colors.textSecondary, lineHeight: 20, marginTop: 4 },
    aiBtn: {
      flexDirection: "row", alignItems: "center", backgroundColor: colors.primary,
      borderRadius: Radius.md, paddingVertical: 12, paddingHorizontal: 20, alignSelf: "flex-start",
    },
    aiBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.md, marginRight: 8 },

    // Emergency
    emergencyCard: {
      marginHorizontal: 20, marginTop: 16, backgroundColor: isDark ? "#450a0a" : "#fff1f2",
      borderRadius: Radius.xl, padding: 18, flexDirection: "row",
      alignItems: "center", justifyContent: "space-between",
      borderWidth: 1.5, borderColor: isDark ? "#7f1d1d" : "#fecdd3",
    },
    emergencyLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
    emergencyIcon: {
      width: 48, height: 48, borderRadius: 14, backgroundColor: colors.danger,
      justifyContent: "center", alignItems: "center",
    },
    emergencyTitle: { fontSize: FontSize.lg, fontWeight: "800", color: colors.danger },
    emergencyText: { fontSize: FontSize.sm, color: isDark ? "#f87171" : "#f87171", marginTop: 2 },
    emergencyArrow: {
      width: 36, height: 36, borderRadius: 12, backgroundColor: isDark ? "#7f1d1d" : "#ffe4e6",
      justifyContent: "center", alignItems: "center",
    },
  });
}
