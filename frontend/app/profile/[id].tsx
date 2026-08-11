import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  Alert, StatusBar, Dimensions, ActivityIndicator,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../context/ThemeContext";
import { Radius, Shadow, FontSize } from "@/constants/theme";
import { router, useLocalSearchParams } from "expo-router";
import { fetchSocialProfile, toggleFollow } from "../../services/api";

const { width } = Dimensions.get("window");

type Pet = { id: number; name: string; species: string; breed: string; age: string; images: string };

export default function OtherProfileScreen() {
  const { id } = useLocalSearchParams();
  const { colors, isDark } = useTheme();
  
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [impactStats, setImpactStats] = useState<any>({ co2Saved: '0 kg', treesPlanted: '0 trees', rescues: 0, trainingsCompleted: 0, scannerAnalyses: 0 });
  const [reputationScore, setReputationScore] = useState(120);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followStatus, setFollowStatus] = useState<"None" | "Pending" | "Approved">("None");
  const [isPrivateRestricted, setIsPrivateRestricted] = useState(false);

  useEffect(() => {
    loadOtherProfile();
  }, [id]);

  const loadOtherProfile = async () => {
    try {
      setIsLoading(true);

      const sessionRaw = await AsyncStorage.getItem("@ecotrack_user_session");
      if (!sessionRaw) { router.replace("/auth/login"); return; }
      const sess = JSON.parse(sessionRaw);

      // Check if viewing self
      if (sess.user_id === id) {
        router.replace("/(tabs)/profile");
        return;
      }

      const data = await fetchSocialProfile(id as string);
      if (data) {
        const p = data.profile || {};
        setProfile(p);
        setFollowStatus(data.followStatus || "None");
        setIsPrivateRestricted(!!data.is_private_restricted);
        
        if (p.reputation_score !== undefined) setReputationScore(p.reputation_score);
        if (p.followers_count !== undefined) setFollowersCount(p.followers_count);
        if (p.following_count !== undefined) setFollowingCount(p.following_count);

        if (!data.is_private_restricted) {
          setPets(data.pets || []);
          setAchievements(data.achievements || []);
          if (data.impactStats) setImpactStats(data.impactStats);
        }
      } else {
        Alert.alert("Error", "Could not load user profile.");
        router.back();
      }
    } catch (e) {
      console.warn("Failed to load other profile", e);
      Alert.alert("Offline", "Could not load user profile. Please verify your connection.");
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!id) return;
    try {
      const data = await toggleFollow(id as string);
      if (data) {
        if (data.status === "Unfollowed") {
          setFollowStatus("None");
          setFollowersCount(prev => Math.max(0, prev - 1));
          // If profile is private, unfollowing will restrict view again
          if (profile.privacy_setting === "Private") {
            setIsPrivateRestricted(true);
            setPets([]);
            setAchievements([]);
            setImpactStats({ co2Saved: '0 kg', treesPlanted: '0 trees', rescues: 0, trainingsCompleted: 0, scannerAnalyses: 0 });
          }
        } else if (data.status === "Pending") {
          setFollowStatus("Pending");
        } else if (data.status === "Approved") {
          setFollowStatus("Approved");
          setFollowersCount(prev => prev + 1);
          setIsPrivateRestricted(false);
          // Reload profile to fetch full detail
          loadOtherProfile();
        }
      }
    } catch (e) {
      console.warn("Follow toggle failed", e);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingCenter, { backgroundColor: colors.bgLight }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!profile) return null;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bgLight }]} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" />

      {/* Cover Image & Back Button */}
      <View style={styles.headerArea}>
        <Image
          source={{ uri: profile.cover_url || "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800" }}
          style={styles.coverImg}
        />
        <LinearGradient colors={["rgba(0,0,0,0.6)", "transparent"]} style={styles.coverGradient} />
        
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Profile Details Header */}
      <View style={styles.profileSummary}>
        <View style={styles.avatarWrapper}>
          <Image
            source={{ uri: profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.display_name || "User")}&background=10b981&color=fff&size=200` }}
            style={[styles.avatar, { borderColor: colors.bgLight }]}
          />
        </View>

        <View style={styles.nameRow}>
          <Text style={[styles.username, { color: colors.textPrimary }]}>{profile.display_name || profile.name}</Text>
          <View style={[styles.proBadge, { backgroundColor: '#eab308' }]}>
            <Text style={styles.proText}>{reputationScore} XP</Text>
          </View>
        </View>

        {profile.profession || profile.organization ? (
          <Text style={[styles.subText, { color: colors.textMuted }]}>
            {profile.profession} {profile.organization ? `• ${profile.organization}` : ""}
          </Text>
        ) : null}

        <Text style={[styles.bioText, { color: colors.textSecondary }]}>{profile.bio || "EcoTrack Enthusiast"}</Text>

        {/* Follow/Connect Button */}
        <TouchableOpacity
          style={[
            styles.followBtn,
            {
              backgroundColor: followStatus === "Approved" ? colors.border : colors.primary,
              borderColor: followStatus === "Approved" ? colors.border : "transparent"
            }
          ]}
          onPress={handleFollowToggle}
        >
          <Ionicons
            name={followStatus === "Approved" ? "checkmark-circle" : followStatus === "Pending" ? "time" : "person-add"}
            size={18}
            color="#fff"
          />
          <Text style={styles.followBtnText}>
            {followStatus === "Approved" ? "Following" : followStatus === "Pending" ? "Requested" : "Follow"}
          </Text>
        </TouchableOpacity>

        {/* Core Stats Grid (2x3 Layout) */}
        <View style={[styles.mainStatsRow, { backgroundColor: colors.bgCard, borderColor: colors.border, flexDirection: 'column', gap: 12, paddingVertical: 14, marginTop: 22 }]}>
          <View style={{ flexDirection: 'row', width: '100%' }}>
            <View style={styles.mainStat}>
              <Text style={[styles.statVal, { color: colors.textPrimary }]}>{followersCount}</Text>
              <Text style={[styles.statLab, { color: colors.textMuted }]}>Followers</Text>
            </View>
            <View style={[styles.mainStat, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border }]}>
              <Text style={[styles.statVal, { color: colors.textPrimary }]}>{followingCount}</Text>
              <Text style={[styles.statLab, { color: colors.textMuted }]}>Following</Text>
            </View>
            <View style={styles.mainStat}>
              <Text style={[styles.statVal, { color: colors.textPrimary }]}>{isPrivateRestricted ? "—" : pets.length}</Text>
              <Text style={[styles.statLab, { color: colors.textMuted }]}>Pets</Text>
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: colors.border, width: '100%' }} />
          <View style={{ flexDirection: 'row', width: '100%' }}>
            <View style={styles.mainStat}>
              <Text style={[styles.statVal, { color: colors.textPrimary }]}>{isPrivateRestricted ? "—" : impactStats?.rescues || 0}</Text>
              <Text style={[styles.statLab, { color: colors.textMuted }]}>Rescues</Text>
            </View>
            <View style={[styles.mainStat, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border }]}>
              <Text style={[styles.statVal, { color: colors.textPrimary }]}>{isPrivateRestricted ? "—" : impactStats?.scannerAnalyses || 0}</Text>
              <Text style={[styles.statLab, { color: colors.textMuted }]}>Scans</Text>
            </View>
            <View style={styles.mainStat}>
              <Text style={[styles.statVal, { color: colors.textPrimary }]}>{isPrivateRestricted ? "—" : impactStats?.trainingsCompleted || 0}</Text>
              <Text style={[styles.statLab, { color: colors.textMuted }]}>Trainings</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Privacy Lock Check */}
      {isPrivateRestricted ? (
        <View style={[styles.lockedCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Ionicons name="lock-closed" size={48} color={colors.primary} />
          <Text style={[styles.lockedTitle, { color: colors.textPrimary }]}>This Account is Private</Text>
          <Text style={[styles.lockedText, { color: colors.textMuted }]}>
            Follow this user to see their pets, environmental achievements, and milestone badges.
          </Text>
        </View>
      ) : (
        <View>
          {/* Pets section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>🐾 Registered Pets</Text>
            {pets.length === 0 ? (
              <View style={[styles.emptyContent, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={{ color: colors.textMuted }}>No registered pets found.</Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                {pets.map((pet) => (
                  <View key={pet.id} style={[styles.petCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Image source={{ uri: pet.images || "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=200" }} style={styles.petImg} />
                    <Text style={[styles.petName, { color: colors.textPrimary }]}>{pet.name}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 10 }}>{pet.species} • {pet.breed}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Environmental Impact section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>🌍 Environmental Impact</Text>
            <View style={[styles.impactCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <View style={styles.impactGrid}>
                {[
                  { icon: "leaf", color: "#16a34a", bg: "#dcfce7", val: impactStats?.co2Saved || "0 kg", lab: "CO2 Saved" },
                  { icon: "sunny", color: "#d97706", bg: "#fef3c7", val: impactStats?.treesPlanted || "0 trees", lab: "Trees Planted" },
                  { icon: "time", color: "#0284c7", bg: "#e0f2fe", val: impactStats?.volunteerHours || "0 hrs", lab: "Volunteer Work" },
                ].map((item) => (
                  <View key={item.lab} style={styles.impactItem}>
                    <View style={[styles.impactIcon, { backgroundColor: item.bg }]}>
                      <Ionicons name={item.icon as any} size={20} color={item.color} />
                    </View>
                    <Text style={[styles.impactVal, { color: colors.textPrimary }]}>{item.val}</Text>
                    <Text style={[styles.impactLab, { color: colors.textMuted }]}>{item.lab}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Badges / Achievements section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>🏆 Badges & Milestones</Text>
            {achievements.length === 0 ? (
              <View style={[styles.emptyContent, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={{ color: colors.textMuted }}>No milestones unlocked yet.</Text>
              </View>
            ) : (
              <View style={[styles.achievementsGrid, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                {achievements.map((ach) => (
                  <View key={ach.badge_code} style={styles.achRow}>
                    <Text style={styles.badgeEmoji}>{ach.icon || "⭐"}</Text>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.achName, { color: colors.textPrimary }]}>{ach.badge_name}</Text>
                      <Text style={[styles.achDesc, { color: colors.textMuted }]}>{ach.description}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingCenter: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerArea: { height: 160, position: "relative" },
  coverImg: { width: "100%", height: "100%" },
  coverGradient: { ...StyleSheet.absoluteFillObject },
  backBtn: { position: "absolute", top: 50, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  
  profileSummary: { alignItems: "center", marginTop: -50, paddingHorizontal: 24 },
  avatarWrapper: { position: "relative", ...Shadow.md },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 4 },
  nameRow: { flexDirection: "row", alignItems: "center", marginTop: 14, gap: 8 },
  username: { fontSize: FontSize.xl, fontWeight: "800" },
  proBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  proText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  subText: { fontSize: FontSize.xs, marginTop: 4 },
  bioText: { fontSize: FontSize.sm, textAlign: "center", marginTop: 8, lineHeight: 20, paddingHorizontal: 16 },

  followBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, width: 160, height: 40, borderRadius: Radius.md, marginTop: 16, ...Shadow.sm },
  followBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },

  mainStatsRow: { flexDirection: "row", width: "100%", borderRadius: Radius.lg, paddingVertical: 14, borderWidth: 1, ...Shadow.sm },
  mainStat: { flex: 1, alignItems: "center" },
  statVal: { fontSize: FontSize.lg, fontWeight: "800" },
  statLab: { fontSize: 10, marginTop: 2, fontWeight: "600" },

  section: { marginTop: 24, paddingHorizontal: 20 },
  sectionTitle: { fontSize: FontSize.md, fontWeight: "800", marginBottom: 12 },
  emptyContent: { padding: 20, borderRadius: Radius.lg, borderWidth: 1, alignItems: "center" },
  
  petCard: { padding: 12, borderRadius: Radius.lg, borderWidth: 1, width: 120, alignItems: "center", marginRight: 12 },
  petImg: { width: 60, height: 60, borderRadius: 30, marginBottom: 8 },
  petName: { fontWeight: "700", fontSize: FontSize.sm },

  impactCard: { padding: 20, borderRadius: Radius.lg, borderWidth: 1, ...Shadow.sm },
  impactGrid: { flexDirection: "row", justifyContent: "space-between" },
  impactItem: { alignItems: "center", width: (width - 100) / 3 },
  impactIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  impactVal: { fontSize: FontSize.sm, fontWeight: "800" },
  impactLab: { fontSize: 9, marginTop: 2 },

  achievementsGrid: { padding: 16, borderRadius: Radius.lg, borderWidth: 1 },
  achRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  badgeEmoji: { fontSize: 24 },
  achName: { fontWeight: "700", fontSize: FontSize.sm },
  achDesc: { fontSize: FontSize.xs, marginTop: 2 },

  lockedCard: { marginTop: 30, marginHorizontal: 20, padding: 32, borderRadius: Radius.lg, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  lockedTitle: { fontSize: FontSize.md, fontWeight: "800", marginTop: 12 },
  lockedText: { fontSize: FontSize.xs, textAlign: "center", marginTop: 8, lineHeight: 18 }
});
