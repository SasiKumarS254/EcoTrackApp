import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  Alert, TextInput, Modal, StatusBar, Dimensions, ActivityIndicator,
  FlatList, Share
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../context/ThemeContext";
import { Radius, Shadow, FontSize, Spacing } from "@/constants/theme";
import { router, useFocusEffect } from "expo-router";
import {
  fetchMySocialProfile,
  updateSocialProfile,
  fetchScanHistory,
  fetchFollowers,
  fetchFollowing,
  fetchSavedPosts,
  fetchRegisteredEvents,
  fetchCommunityPosts,
  fetchTrainingPrograms,
  fetchEvents,
  createCommunityPost,
  STORAGE_KEYS
} from "../../services/api";

const { width } = Dimensions.get("window");

type TabConfig = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const TABS: TabConfig[] = [
  { id: "pets", label: "Vault", icon: "paw" },
  { id: "scans", label: "Scans", icon: "scan" },
  { id: "posts", label: "Posts", icon: "document-text" },
  { id: "training", label: "Training", icon: "fitness" },
  { id: "achievements", label: "Badges", icon: "trophy" },
  { id: "connections", label: "Network", icon: "people" },
  { id: "saved", label: "Bookmarks", icon: "bookmark" },
  { id: "events", label: "Tickets", icon: "calendar" }
];

export default function ProfileScreen() {
  const { colors, isDark } = useTheme();

  const [profile, setProfile] = useState<any>(null);
  const [pets, setPets] = useState<any[]>([]);
  const [scans, setScans] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [followers, setFollowers] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pets");
  const [editModal, setEditModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [editForm, setEditForm] = useState({
    display_name: "",
    bio: "",
    profession: "",
    organization: "",
    city: "",
    country: ""
  });

  useFocusEffect(
    useCallback(() => {
      fetchFullProfile();
    }, [])
  );

  const fetchFullProfile = async () => {
    try {
      setIsLoading(true);
      const data = await fetchMySocialProfile();
      if (data && data.profile) {
        setProfile(data.profile);
        setPets(data.pets || []);
        setAchievements(data.achievements || []);

        setEditForm({
          display_name: data.profile.display_name || data.profile.name || "",
          bio: data.profile.bio || "",
          profession: data.profile.profession || "",
          organization: data.profile.organization || "",
          city: data.profile.city || "",
          country: data.profile.country || ""
        });

        const uId = data.profile.id;
        const [scansData, postsData, programsData, followersData, followingData, savedData, eventsData] = await Promise.all([
          fetchScanHistory(uId).catch(() => []),
          fetchCommunityPosts(uId).catch(() => []),
          fetchTrainingPrograms(uId).catch(() => []),
          fetchFollowers(uId).catch(() => []),
          fetchFollowing(uId).catch(() => []),
          fetchSavedPosts().catch(() => []),
          fetchRegisteredEvents(uId).catch(() => [])
        ]);

        setScans(scansData || []);
        setPosts(postsData || []);
        setPrograms(programsData || []);
        setFollowers(followersData || []);
        setFollowing(followingData || []);
        setSavedPosts(savedData || []);
        setEvents(eventsData || []);
      }
    } catch (e) {
      console.warn("Profile fetch error", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const res = await updateSocialProfile(editForm);
      if (res) {
        setEditModal(false);
        fetchFullProfile();
        Alert.alert("Success", "Profile updated successfully.");
      }
    } catch {
      Alert.alert("Error", "Could not sync changes.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Sign out of your session?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: async () => {
        await AsyncStorage.multiRemove([STORAGE_KEYS.AUTH, STORAGE_KEYS.USER_ID, STORAGE_KEYS.SESSION]);
        router.replace("/auth");
      }}
    ]);
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bgLight }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const locText = (profile?.city && profile?.country) ? `${profile.city}, ${profile.country}` : (profile?.city || profile?.country || "Earth");

  return (
    <View style={[styles.container, { backgroundColor: colors.bgLight }]}>
      <StatusBar barStyle="light-content" />

      {/* HERO SECTION */}
      <View style={styles.hero}>
        <Image source={{ uri: "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800" }} style={styles.heroCover} />
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.85)"]} style={styles.heroOverlay} />

        <View style={styles.heroContent}>
          <View style={styles.profileRow}>
            <View style={[styles.avatarBox, { borderColor: colors.primary }]}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={styles.avatarInitial}>{(profile?.display_name || profile?.name || "E").charAt(0).toUpperCase()}</Text>
                </View>
              )}
            </View>
            <View style={styles.profileMeta}>
              <Text style={styles.profileName} numberOfLines={1}>{profile?.display_name || profile?.name}</Text>
              <Text style={styles.profileRole}>{profile?.profession || "EcoTracker"}</Text>
              <View style={styles.locRow}>
                <Ionicons name="location" size={12} color="#10b981" />
                <Text style={styles.locText}>{locText}</Text>
              </View>
            </View>
          </View>

          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{followers.length}</Text>
              <Text style={styles.statLab}>Followers</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{scans.length}</Text>
              <Text style={styles.statLab}>Scans</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{profile?.reputation_score || 100}</Text>
              <Text style={styles.statLab}>XP</Text>
            </View>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setEditModal(true)}>
            <Ionicons name="create-outline" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* TABS */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabItem, activeTab === tab.id && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Ionicons name={tab.icon} size={16} color={activeTab === tab.id ? colors.primary : colors.textMuted} style={{ marginRight: 6 }} />
              <Text style={[styles.tabText, { color: activeTab === tab.id ? colors.primary : colors.textMuted }]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* CONTENT */}
      <ScrollView contentContainerStyle={styles.content}>
        {/* PETS VAULT */}
        {activeTab === "pets" && (
          <View style={styles.grid}>
            {pets.length === 0 ? (
              <View style={styles.empty}><Text style={{ color: colors.textMuted }}>No registered pets</Text></View>
            ) : (
              pets.map((p, i) => (
                <View key={i} style={[styles.petCard, { backgroundColor: colors.bgCard }]}>
                  <Image source={{ uri: p.image || "https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?w=200" }} style={styles.petThumb} />
                  <Text style={[styles.petName, { color: colors.textPrimary }]}>{p.name}</Text>
                  <Text style={styles.petSub}>{p.breed || p.species}</Text>
                </View>
              ))
            )}
          </View>
        )}

        {/* SCANS HISTORY */}
        {activeTab === "scans" && (
          <View style={styles.list}>
            {scans.length === 0 ? (
              <View style={styles.empty}><Text style={{ color: colors.textMuted }}>No scan history</Text></View>
            ) : (
              scans.map((s, i) => (
                <TouchableOpacity key={i} style={[styles.scanItem, { backgroundColor: colors.bgCard }]} onPress={() => router.push({ pathname: "/scanReport", params: { data: JSON.stringify(s) } })}>
                  <View style={[styles.gradeCircle, { backgroundColor: colors.primary + "20" }]}>
                    <Text style={[styles.gradeText, { color: colors.primary }]}>{s.grade || "B"}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>{s.detectedSpecies} Analysis</Text>
                    <Text style={styles.itemSub}>{new Date(s.timestamp).toLocaleDateString()} • {s.exerciseName || "Free Scan"}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* POSTS */}
        {activeTab === "posts" && (
          <View style={styles.list}>
            {posts.length === 0 ? (
              <View style={styles.empty}><Text style={{ color: colors.textMuted }}>No shared posts</Text></View>
            ) : (
              posts.map((p, i) => (
                <View key={i} style={[styles.postCard, { backgroundColor: colors.bgCard }]}>
                  <Text style={[styles.postText, { color: colors.textPrimary }]}>{p.caption || p.content}</Text>
                  <Text style={styles.postDate}>{p.time || new Date(p.timestamp).toLocaleDateString()}</Text>
                </View>
              ))
            )}
          </View>
        )}

        {/* TRAINING PROGRAMS */}
        {activeTab === "training" && (
          <View style={styles.list}>
            {programs.length === 0 ? (
              <View style={styles.empty}><Text style={{ color: colors.textMuted }}>No active programs</Text></View>
            ) : (
              programs.map((p, i) => (
                <TouchableOpacity key={i} style={[styles.progCard, { backgroundColor: colors.bgCard }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>{p.name || p.species}</Text>
                    <View style={styles.progBarBg}><View style={[styles.progBarFill, { width: `${p.progress || 0}%`, backgroundColor: colors.primary }]} /></View>
                    <Text style={styles.itemSub}>Completion: {p.progress || 0}%</Text>
                  </View>
                  <Ionicons name="fitness" size={24} color={colors.primary} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* ACHIEVEMENTS */}
        {activeTab === "achievements" && (
          <View style={styles.grid}>
            {achievements.length === 0 ? (
              <View style={styles.empty}><Text style={{ color: colors.textMuted }}>No badges earned yet</Text></View>
            ) : (
              achievements.map((a, i) => (
                <View key={i} style={[styles.achCard, { backgroundColor: colors.bgCard }]}>
                  <Text style={styles.achEmoji}>{a.icon || "🏆"}</Text>
                  <Text style={[styles.achName, { color: colors.textPrimary }]} numberOfLines={1}>{a.badge_name}</Text>
                  <Text style={styles.achDesc} numberOfLines={2}>{a.description}</Text>
                </View>
              ))
            )}
          </View>
        )}

        {/* TICKETS VAULT */}
        {activeTab === "events" && (
          <View style={styles.list}>
            {events.length === 0 ? (
              <View style={styles.empty}><Text style={{ color: colors.textMuted }}>No digital passes found</Text></View>
            ) : (
              events.map((ev, i) => {
                const serial = ev.user_registration?.ticket_id || `ET-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x250&data=VERIFIED_PASS_${serial}`;
                return (
                  <View key={i} style={[styles.ticketCard, { backgroundColor: colors.bgCard, borderColor: colors.primary }]}>
                    <View style={styles.ticketHeader}>
                      <Text style={[styles.ticketTag, { color: colors.primary }]}>OFFICIAL ENTRY PASS</Text>
                      <View style={[styles.statusTag, { backgroundColor: colors.primary }]}>
                        <Text style={styles.statusText}>VALID</Text>
                      </View>
                    </View>

                    <View style={styles.ticketBody}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.ticketTitle, { color: colors.textPrimary }]}>{ev.title}</Text>
                        <Text style={styles.ticketDetail}>📍 {ev.location}</Text>
                        <Text style={styles.ticketDetail}>🗓️ {ev.date}</Text>
                      </View>
                      <Image source={{ uri: qrUrl }} style={styles.qrCode} />
                    </View>

                    <View style={styles.ticketFooter}>
                      <Text style={styles.serialLab}>REF ID</Text>
                      <Text style={[styles.serialVal, { color: colors.textPrimary }]}>{serial}</Text>
                      <TouchableOpacity style={styles.sharePass} onPress={() => Share.share({ message: `My Verified EcoTrack Entry Pass: ${serial}` })}>
                        <Ionicons name="share-social" size={16} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* EDIT MODAL */}
      <Modal visible={editModal} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bgCard }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditModal(false)}><Ionicons name="close" size={24} color={colors.textPrimary} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLab}>Display Name</Text>
              <TextInput style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} value={editForm.display_name} onChangeText={(v) => setEditForm({...editForm, display_name: v})} />
              
              <Text style={styles.inputLab}>Profession</Text>
              <TextInput style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} value={editForm.profession} onChangeText={(v) => setEditForm({...editForm, profession: v})} />
              
              <Text style={styles.inputLab}>Bio</Text>
              <TextInput style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, height: 80 }]} value={editForm.bio} onChangeText={(v) => setEditForm({...editForm, bio: v})} multiline />

              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSaveProfile} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  hero: { height: 280, position: "relative" },
  heroCover: { width: "100%", height: "100%" },
  heroOverlay: { ...StyleSheet.absoluteFillObject },
  heroContent: { position: "absolute", bottom: 20, left: 20, right: 20 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 15 },
  avatarBox: { width: 90, height: 90, borderRadius: 30, borderWidth: 3, padding: 3, overflow: "hidden" },
  avatar: { width: "100%", height: "100%", borderRadius: 24 },
  avatarInitial: { color: "#fff", fontSize: 36, fontWeight: "900" },
  profileMeta: { flex: 1 },
  profileName: { color: "#fff", fontSize: 24, fontWeight: "900" },
  profileRole: { color: "#10b981", fontSize: 14, fontWeight: "700" },
  locRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  locText: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600" },
  statRow: { flexDirection: "row", marginTop: 20, gap: 20 },
  stat: { alignItems: "center" },
  statVal: { color: "#fff", fontSize: 16, fontWeight: "900" },
  statLab: { color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  headerActions: { position: "absolute", top: 50, right: 15, flexDirection: "row", gap: 10 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },

  tabBar: { borderBottomWidth: 1 },
  tabItem: { flexDirection: "row", alignItems: "center", paddingVertical: 15, paddingHorizontal: 16, borderBottomWidth: 3, borderBottomColor: "transparent" },
  tabText: { fontSize: 13, fontWeight: "800" },

  content: { padding: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  list: { gap: 12 },
  empty: { height: 150, justifyContent: "center", alignItems: "center", borderStyle: "dashed", borderWidth: 2, borderColor: "#cbd5e1", borderRadius: 20, width: "100%" },

  petCard: { width: (width - 44) / 2, padding: 12, borderRadius: 20, ...Shadow.sm },
  petThumb: { width: "100%", height: 110, borderRadius: 16, marginBottom: 10 },
  petName: { fontWeight: "900", fontSize: 15 },
  petSub: { color: "#64748b", fontSize: 12, fontWeight: "600" },

  scanItem: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 18, ...Shadow.sm },
  gradeCircle: { width: 46, height: 46, borderRadius: 23, justifyContent: "center", alignItems: "center" },
  gradeText: { fontSize: 18, fontWeight: "900" },
  itemTitle: { fontWeight: "800", fontSize: 15 },
  itemSub: { color: "#64748b", fontSize: 12, marginTop: 2 },

  postCard: { padding: 16, borderRadius: 18, ...Shadow.sm },
  postText: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
  postDate: { color: "#94a3b8", fontSize: 11, marginTop: 8 },

  progCard: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 18, ...Shadow.sm },
  progBarBg: { height: 6, backgroundColor: "rgba(0,0,0,0.05)", borderRadius: 3, marginVertical: 8 },
  progBarFill: { height: "100%", borderRadius: 3 },

  achCard: { width: (width - 44) / 2, padding: 16, borderRadius: 20, alignItems: "center", ...Shadow.sm },
  achEmoji: { fontSize: 36, marginBottom: 8 },
  achName: { fontWeight: "900", fontSize: 13, textAlign: "center" },
  achDesc: { fontSize: 10, color: "#64748b", textAlign: "center", marginTop: 4 },

  ticketCard: { borderRadius: 24, borderWidth: 2, borderStyle: "dashed", padding: 20, ...Shadow.sm },
  ticketHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 },
  ticketTag: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  statusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  ticketBody: { flexDirection: "row", gap: 15, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.05)", paddingBottom: 15 },
  ticketTitle: { fontSize: 18, fontWeight: "900", marginBottom: 5 },
  ticketDetail: { fontSize: 13, color: "#64748b", marginBottom: 3 },
  qrCode: { width: 80, height: 80, borderRadius: 12, backgroundColor: "#fff" },
  ticketFooter: { flexDirection: "row", alignItems: "center", paddingTop: 15 },
  serialLab: { fontSize: 9, color: "#94a3b8", fontWeight: "800" },
  serialVal: { fontSize: 14, fontWeight: "900", marginLeft: 8, flex: 1 },
  sharePass: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(16,185,129,0.1)", justifyContent: "center", alignItems: "center" },

  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, maxHeight: "80%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 25 },
  modalTitle: { fontSize: 20, fontWeight: "900" },
  inputLab: { fontSize: 12, fontWeight: "800", color: "#64748b", marginBottom: 6, textTransform: "uppercase" },
  input: { height: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, marginBottom: 20, fontSize: 15 },
  saveBtn: { height: 56, borderRadius: 16, justifyContent: "center", alignItems: "center", marginTop: 10, ...Shadow.md },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "900" }
});
