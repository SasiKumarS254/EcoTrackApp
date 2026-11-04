import React, { useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Dimensions, Alert
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../context/ThemeContext";
import { Radius, Shadow } from "@/constants/theme";



export default function ExploreScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const navigateTo = (path: string) => {
    try {
      router.navigate(path as any);
    } catch {
      try {
        router.push(path as any);
      } catch {
        router.replace(path as any);
      }
    }
  };

  const hubs = [
    {
      id: "market",
      title: "Boutique Marketplace",
      tagline: "Adoption, Supplies & Nutrition",
      description: "Browse verified animals for adoption, specialized species nutrition, care equipment, and pet wellness supplies.",
      icon: "cart",
      gradient: ["#f97316", "#ea580c"],
      badge: "Verified Listings",
      badgeColor: "#ffedd5",
      badgeTextColor: "#c2410c",
      route: "/(tabs)/marketplace",
      highlights: ["🐾 Adoption Profiles", "🥣 Specialized Nutrition", "🛒 In-App Cart"],
    },
    {
      id: "events",
      title: "Wildlife Events & Vault",
      tagline: "Workshops & QR Ticket Vault",
      description: "Discover animal rescue workshops, adoption drives, and access your offline digital QR admission passes.",
      icon: "calendar",
      gradient: ["#0284c7", "#0369a1"],
      badge: "Digital Pass Vault",
      badgeColor: "#e0f2fe",
      badgeTextColor: "#0369a1",
      route: "/(tabs)/events",
      highlights: ["🎟️ QR Entry Passes", "🦁 Rescue Drives", "👥 Host New Event"],
    },
    {
      id: "services",
      title: "Vet & Emergency Services",
      tagline: "24/7 Hospitals, ER & Grooming",
      description: "Locate verified regional veterinary clinics, grooming centers, emergency pet ambulance, and 24/7 hotlines.",
      icon: "location",
      gradient: ["#10b981", "#059669"],
      badge: "Verified Facilities",
      badgeColor: "#dcfce7",
      badgeTextColor: "#15803d",
      route: "/(tabs)/maps",
      highlights: ["🚑 24/7 ER Helplines", "🏥 Verified Clinics", "📍 GPS Navigation"],
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* TOP HEADER */}
      <View style={styles.topHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={styles.topIconWrap}>
            <Ionicons name="grid" size={20} color="#fff" />
          </View>
          <View>
            <Text style={styles.topTitle}>Explore EcoTrack</Text>
            <Text style={styles.topSub}>Marketplace, Events & Care Services</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.profileHeaderBtn}
          onPress={() => navigateTo("/(tabs)/profile")}
          activeOpacity={0.8}
        >
          <Ionicons name="person-circle" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* BANNER */}
        <View style={styles.bannerCard}>
          <LinearGradient
            colors={isDark ? ["#064e3b", "#0f2e22"] : ["#10b981", "#059669"]}
            style={styles.bannerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.badgeRow}>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveBadgeText}>EcoTrack Ecosystem Hub</Text>
              </View>
            </View>
            <Text style={styles.bannerTitle}>All Wildlife Services in One Place</Text>
            <Text style={styles.bannerSub}>
              Everything you need outside daily training and motion scanning — shop authentic supplies, attend events, or find emergency veterinary care.
            </Text>
          </LinearGradient>
        </View>

        {/* 3 HUBS LIST */}
        <Text style={styles.sectionHeader}>CORE ECOSYSTEM MODULES</Text>

        {hubs.map((hub, idx) => (
          <TouchableOpacity
            key={`explore-hub-${hub.id}-${idx}`}
            style={styles.hubCard}
            onPress={() => navigateTo(hub.route)}
            activeOpacity={0.88}
          >
            <View style={styles.hubHeaderRow}>
              <LinearGradient
                colors={hub.gradient as any}
                style={styles.hubIconBox}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name={hub.icon as any} size={24} color="#ffffff" />
              </LinearGradient>

              <View style={{ flex: 1, marginLeft: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={styles.hubTitle}>{hub.title}</Text>
                  <View style={[styles.hubBadge, { backgroundColor: hub.badgeColor }]}>
                    <Text style={[styles.hubBadgeText, { color: hub.badgeTextColor }]}>{hub.badge}</Text>
                  </View>
                </View>
                <Text style={styles.hubTagline}>{hub.tagline}</Text>
              </View>
            </View>

            <Text style={styles.hubDesc}>{hub.description}</Text>

            {/* Highlights row */}
            <View style={styles.highlightsRow}>
              {hub.highlights.map((h, idx) => (
                <View key={`hl-${hub.id}-${idx}`} style={styles.highlightPill}>
                  <Text style={styles.highlightPillText}>{h}</Text>
                </View>
              ))}
            </View>

            {/* Open CTA Row */}
            <View style={styles.hubFooter}>
              <Text style={styles.hubFooterText}>Open Module</Text>
              <Ionicons name="arrow-forward-circle" size={20} color={colors.primary} />
            </View>
          </TouchableOpacity>
        ))}

        {/* QUICK SHORTCUTS STRIP */}
        <Text style={styles.sectionHeader}>DIRECT SHORTCUTS</Text>
        <View style={styles.shortcutsGrid}>
          <TouchableOpacity
            style={styles.shortcutBtn}
            onPress={() => navigateTo("/(tabs)/marketplace")}
          >
            <Ionicons name="paw" size={18} color="#f97316" />
            <Text style={styles.shortcutBtnText}>Adopt Animal</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shortcutBtn}
            onPress={() => navigateTo("/(tabs)/events")}
          >
            <Ionicons name="qr-code" size={18} color="#0284c7" />
            <Text style={styles.shortcutBtnText}>My Pass Vault</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shortcutBtn}
            onPress={() => navigateTo("/(tabs)/maps")}
          >
            <Ionicons name="medkit" size={18} color="#10b981" />
            <Text style={styles.shortcutBtnText}>24/7 ER Vet</Text>
          </TouchableOpacity>
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
    topHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 18,
      paddingVertical: 14,
      backgroundColor: colors.bgCard,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      maxWidth: 1000,
      width: "100%",
      alignSelf: "center",
    },
    topIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.primary,
      justifyContent: "center",
      alignItems: "center",
    },
    topTitle: {
      fontSize: 18,
      fontWeight: "900",
      color: colors.textPrimary,
    },
    topSub: {
      fontSize: 10.5,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    profileHeaderBtn: {
      padding: 2,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
      maxWidth: 1000,
      width: "100%",
      alignSelf: "center",
    },
    bannerCard: {
      borderRadius: Radius.xl,
      overflow: "hidden",
      marginBottom: 20,
      ...Shadow.md,
    },
    bannerGradient: {
      padding: 20,
    },
    badgeRow: {
      flexDirection: "row",
      marginBottom: 10,
    },
    liveBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.25)",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: Radius.full,
      gap: 6,
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#34d399",
    },
    liveBadgeText: {
      color: "#ffffff",
      fontSize: 11,
      fontWeight: "700",
    },
    bannerTitle: {
      fontSize: 19,
      fontWeight: "900",
      color: "#ffffff",
      marginBottom: 6,
    },
    bannerSub: {
      fontSize: 12.5,
      color: "rgba(255,255,255,0.85)",
      lineHeight: 18,
    },
    sectionHeader: {
      fontSize: 11,
      fontWeight: "900",
      color: colors.textMuted,
      letterSpacing: 1.2,
      marginBottom: 12,
      marginLeft: 4,
    },
    hubCard: {
      backgroundColor: colors.bgCard,
      borderRadius: Radius.xl,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 14,
      ...Shadow.sm,
    },
    hubHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    hubIconBox: {
      width: 48,
      height: 48,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
      ...Shadow.sm,
    },
    hubTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    hubTagline: {
      fontSize: 11.5,
      fontWeight: "600",
      color: colors.textSecondary,
      marginTop: 2,
    },
    hubBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: Radius.full,
    },
    hubBadgeText: {
      fontSize: 9.5,
      fontWeight: "800",
    },
    hubDesc: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 19,
      marginBottom: 14,
    },
    highlightsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 14,
    },
    highlightPill: {
      backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    highlightPillText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    hubFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 6,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    hubFooterText: {
      fontSize: 12.5,
      fontWeight: "800",
      color: colors.primary,
    },
    shortcutsGrid: {
      flexDirection: "row",
      gap: 10,
    },
    shortcutBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: colors.bgCard,
      borderRadius: Radius.lg,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: colors.border,
      ...Shadow.sm,
    },
    shortcutBtnText: {
      fontSize: 11.5,
      fontWeight: "700",
      color: colors.textPrimary,
    },
  });
}

