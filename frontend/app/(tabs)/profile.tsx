import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  Alert, TextInput, Modal, StatusBar, Dimensions, ActivityIndicator,
  FlatList
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
  createCommunityPost
} from "../../services/api";

const { width } = Dimensions.get("window");

type UserProfile = {
  id: string;
  name: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  reputation_score: number;
  followers_count: number;
  following_count: number;
  profession?: string;
  organization?: string;
  city?: string;
  country?: string;
  privacy_setting?: string;
  vet_status?: number;
  email?: string;
  created_at?: string;
  role?: string;
};

type EditProfileForm = {
  display_name: string;
  bio: string;
  profession: string;
  organization: string;
  city: string;
  country: string;
  vet_status: number;
  privacy_setting: string;
};

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
  { id: "saved", label: "Bookmarked", icon: "bookmark" },
  { id: "events", label: "Events", icon: "calendar" }
];

export default function ProfileScreen() {
  const { colors, isDark } = useTheme();
  const [profile, setProfile] = useState<UserProfile | null>(null);
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
  const [settingsModal, setSettingsModal] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState<any>(null);
  const [achievementModal, setAchievementModal] = useState(false);
  const [isSharingBadge, setIsSharingBadge] = useState(false);

  const [editForm, setEditForm] = useState<EditProfileForm>({
    display_name: "",
    bio: "",
    profession: "",
    organization: "",
    city: "",
    country: "",
    vet_status: 0,
    privacy_setting: "Public"
  });
  const [isSaving, setIsSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [])
  );

  const fetchProfile = async () => {
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
          country: data.profile.country || "",
          vet_status: data.profile.vet_status || 0,
          privacy_setting: data.profile.privacy_setting || "Public"
        });

        // Load supplemental real lists concurrently
        const userId = data.profile.id;
        const [scansData, postsData, programsData, followersData, followingData, savedData, eventsData, allEventsData] = await Promise.all([
          fetchScanHistory(userId).catch(() => []),
          fetchCommunityPosts(userId).catch(() => []),
          fetchTrainingPrograms(userId).catch(() => []),
          fetchFollowers(userId).catch(() => []),
          fetchFollowing(userId).catch(() => []),
          fetchSavedPosts().catch(() => []),
          fetchRegisteredEvents(userId).catch(() => []),
          fetchEvents().catch(() => [])
        ]);

        setScans(scansData || []);
        setPosts(postsData || []);
        setPrograms(programsData || []);
        setFollowers(followersData || []);
        setFollowing(followingData || []);
        setSavedPosts(savedData || []);

        // Merge backend registered events and local offline tickets
        const localTicketsRaw = await AsyncStorage.getItem(`@ecotrack_tickets_${userId}`);
        const localTickets = localTicketsRaw ? JSON.parse(localTicketsRaw) : [];
        const mergedEvents = Array.isArray(eventsData) ? [...eventsData] : [];

        localTickets.forEach((ticket: any) => {
          if (!mergedEvents.some((e: any) => e.id === ticket.eventId)) {
            const match = Array.isArray(allEventsData) ? allEventsData.find((e: any) => e.id === ticket.eventId) : null;
            if (match) {
              mergedEvents.push({
                ...match,
                user_registration: {
                  user_id: userId,
                  registered_at: ticket.purchaseDate,
                  ticket_id: ticket.serialNumber
                }
              });
            }
          }
        });
        setEvents(mergedEvents);
      } else {
        const raw = await AsyncStorage.getItem("@ecotrack_user_session");
        if (!raw) router.replace("/auth/login");
      }
    } catch (e) {
      console.warn("Profile fetch error", e);
    } finally {
      setIsLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!editForm.display_name.trim()) {
      Alert.alert("Validation Error", "Display Name is required.");
      return;
    }

    try {
      setIsSaving(true);
      const data = await updateSocialProfile(editForm);

      if (data && data.profile) {
        setProfile(data.profile);
        await fetchProfile(); // Re-fetch the entire profile to ensure sync across components
        setEditModal(false);
        Alert.alert("Success", "Profile updated successfully.");
      } else {
        Alert.alert("Error", "Could not save updates to server.");
      }
    } catch (e) {
      Alert.alert("Error", "Could not sync changes to cloud.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Sign out of EcoTrack?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: async () => {
        await AsyncStorage.clear();
        router.replace("/auth/login");
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

  const locText = (profile?.city && profile?.country) ? `${profile.city}, ${profile.country}` : (profile?.city || profile?.country || "Global");

  return (
    <View style={[styles.container, { backgroundColor: colors.bgLight }]}>
      <StatusBar barStyle="light-content" />

      {/* ── REDESIGNED HERO ── */}
      <View style={styles.heroContainer}>
        <Image source={{ uri: "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800" }} style={styles.heroCover} />
        <LinearGradient colors={["transparent", "rgba(11,26,19,0.95)"]} style={styles.heroOverlay} />

        <View style={styles.heroContent}>
          <View style={styles.identityRow}>
            <View style={[styles.avatarBorder, { borderColor: colors.primary }]}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={styles.avatarInitial}>{(profile?.display_name || profile?.name || "E").charAt(0).toUpperCase()}</Text>
                </View>
              )}
            </View>
            <View style={styles.identityText}>
              <View style={styles.nameRow}>
                <Text style={styles.nameText} numberOfLines={1}>{profile?.display_name || profile?.name}</Text>
                {profile?.vet_status === 1 && (
                  <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                    <Ionicons name="medical" size={10} color="#fff" />
                    <Text style={styles.badgeText}>VET</Text>
                  </View>
                )}
              </View>
              <Text style={styles.roleText} numberOfLines={1}>{profile?.profession || "Eco Explorer"}</Text>
              
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.7)" />
                <Text style={styles.metaText}>{locText}</Text>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.miniStat}>
                  <Text style={styles.statValue}>{followers.length}</Text>
                  <Text style={styles.statLabel}>Followers</Text>
                </View>
                <View style={[styles.miniStat, { marginHorizontal: Spacing.md }]}>
                  <Text style={styles.statValue}>{scans.length}</Text>
                  <Text style={styles.statLabel}>Scans</Text>
                </View>
                <View style={styles.miniStat}>
                  <Text style={styles.statValue}>{profile?.reputation_score || 100}</Text>
                  <Text style={styles.statLabel}>XP</Text>
                </View>
              </View>

              {/* Edit Profile Action */}
              <TouchableOpacity style={[styles.editBtn, { backgroundColor: colors.primary }]} onPress={() => setEditModal(true)}>
                <Ionicons name="create-outline" size={14} color="#fff" />
                <Text style={styles.editBtnText}>Edit Profile</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.headerRightContainer}>
          <TouchableOpacity style={styles.headerIconButton} onPress={() => setSettingsModal(true)}>
            <Ionicons name="settings-outline" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── HORIZONTAL RESPONSIVE TAB BAR ── */}
      <View style={[styles.tabBarContainer, { borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tabItem,
                activeTab === tab.id && { borderBottomColor: colors.primary, borderBottomWidth: 3 }
              ]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Ionicons
                name={tab.icon}
                size={16}
                color={activeTab === tab.id ? colors.primary : colors.textMuted}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === tab.id ? colors.primary : colors.textMuted }
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── CONTENT AREA ── */}
      <ScrollView contentContainerStyle={styles.contentScroll} showsVerticalScrollIndicator={false}>
        {/* pets / Animal Vault */}
        {activeTab === "pets" && (
          <View style={styles.section}>
            {pets.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="paw-outline" size={40} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, marginTop: Spacing.xs, fontWeight: "600" }}>No registered pets found</Text>
              </View>
            ) : (
              <View style={styles.petGrid}>
                {pets.map((pet, idx) => (
                  <View key={idx} style={[styles.petCard, { backgroundColor: colors.bgCard }]}>
                    <Image
                      source={{ uri: (pet.images && pet.images[0]) || pet.image || "https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?w=200" }}
                      style={styles.petThumb}
                    />
                    <Text style={[styles.petName, { color: colors.textPrimary }]} numberOfLines={1}>{pet.name}</Text>
                    <Text style={[styles.petBreed, { color: colors.textMuted }]} numberOfLines={1}>{pet.breed || pet.species}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* scans / Scan History */}
        {activeTab === "scans" && (
          <View style={styles.section}>
            {scans.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="scan-outline" size={40} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, marginTop: Spacing.xs, fontWeight: "600" }}>No scan history available</Text>
              </View>
            ) : (
              scans.map((s, idx) => (
                <View key={idx} style={[styles.actionCard, { backgroundColor: colors.bgCard }]}>
                  <View style={[styles.gradeCircle, { backgroundColor: colors.primary + "15" }]}>
                    <Text style={[styles.gradeText, { color: colors.primary }]}>{s.grade || "C"}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{s.detectedSpecies || "Animal"} Analysis</Text>
                    <Text style={{ color: colors.textMuted, fontSize: FontSize.xs }}>{new Date(s.timestamp).toLocaleDateString()}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* posts / Activity Feed */}
        {activeTab === "posts" && (
          <View style={styles.section}>
            {posts.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="document-text-outline" size={40} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, marginTop: Spacing.xs, fontWeight: "600" }}>No posts shared yet</Text>
              </View>
            ) : (
              posts.map((p, idx) => (
                <View key={idx} style={[styles.postCard, { backgroundColor: colors.bgCard }]}>
                  <Text style={[styles.postContent, { color: colors.textPrimary }]}>{p.content}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: FontSize.xs, marginTop: Spacing.xs }}>{new Date(p.created_at).toLocaleDateString()}</Text>
                </View>
              ))
            )}
          </View>
        )}

        {/* training / Programs */}
        {activeTab === "training" && (
          <View style={styles.section}>
            {programs.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="fitness-outline" size={40} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, marginTop: Spacing.xs, fontWeight: "600" }}>No active training plans</Text>
              </View>
            ) : (
              programs.map((p, idx) => (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.7}
                  style={[styles.postCard, { backgroundColor: colors.bgCard, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                  onPress={async () => {
                    const species = p.species || p.title || "";
                    const goal = p.goal || "";
                    const breed = p.breed || "";
                    await AsyncStorage.setItem("@ecotrack_active_log_redirect", JSON.stringify({ species, goal, breed }));
                    router.push("/training");
                  }}
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{p.title || p.species}</Text>
                    <View style={styles.progressBarWrap}>
                      <View style={[styles.progressBar, { width: `${p.progress || 0}%`, backgroundColor: colors.primary }]} />
                    </View>
                    <Text style={{ color: colors.textMuted, fontSize: FontSize.xs, marginTop: 4 }}>Progress: {p.progress || 0}%</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* achievements / Badges */}
        {activeTab === "achievements" && (() => {
          const ALL_ACHIEVEMENTS = [
            { name: "AI Bio-Scanner Pioneer", icon: "🔬", desc: "Perform 3 or more AI pose estimation scans.", metricName: "Scans", target: 3 },
            { name: "Elite Species Analyst", icon: "🧬", desc: "Perform 15 or more AI pose estimation scans.", metricName: "Scans", target: 15 },
            { name: "Certified Trainer", icon: "🏋️", desc: "Register 3 custom AI training programs.", metricName: "Programs", target: 3 },
            { name: "Master Welfare Coach", icon: "🎓", desc: "Register 8 or more AI training programs.", metricName: "Programs", target: 8 },
            { name: "Community Connector", icon: "🤝", desc: "Follow 8 or more members in the EcoTrack network.", metricName: "Follows", target: 8 },
            { name: "Welfare Ambassador", icon: "📢", desc: "Publish 10 or more community feed posts.", metricName: "Posts", target: 10 }
          ];

          const getAchievementProgress = (name: string) => {
            switch (name) {
              case "AI Bio-Scanner Pioneer": return { current: scans.length, target: 3 };
              case "Elite Species Analyst": return { current: scans.length, target: 15 };
              case "Certified Trainer": return { current: programs.length, target: 3 };
              case "Master Welfare Coach": return { current: programs.length, target: 8 };
              case "Community Connector": return { current: following.length, target: 8 };
              case "Welfare Ambassador": return { current: posts.length, target: 10 };
              default: return { current: 0, target: 1 };
            }
          };

          return (
            <View style={styles.section}>
              <Text style={[styles.sectionHeading, { color: colors.textPrimary, marginBottom: Spacing.sm }]}>Achievements & Badges</Text>
              <View style={styles.petGrid}>
                {ALL_ACHIEVEMENTS.map((a, idx) => {
                  const isUnlocked = achievements.some(ach => (ach.badge_name || ach.title) === a.name);
                  const prog = getAchievementProgress(a.name);
                  const pct = Math.min(100, Math.round((prog.current / prog.target) * 100));

                  return (
                    <TouchableOpacity
                      key={idx}
                      activeOpacity={0.8}
                      style={[
                        styles.achievementCard,
                        { backgroundColor: colors.bgCard },
                        !isUnlocked && { opacity: 0.6 }
                      ]}
                      onPress={() => {
                        setSelectedAchievement({ ...a, isUnlocked, progress: prog, pct });
                        setAchievementModal(true);
                      }}
                    >
                      <Text style={styles.badgeEmoji}>{a.icon}</Text>
                      <Text style={[styles.badgeName, { color: colors.textPrimary }]} numberOfLines={1}>{a.name}</Text>
                      <Text style={[styles.badgeDesc, { color: colors.textMuted }]} numberOfLines={2}>{a.desc}</Text>
                      
                      {!isUnlocked ? (
                        <View style={{ width: "100%", marginTop: Spacing.sm }}>
                          <View style={styles.achProgressBg}>
                            <View style={[styles.achProgressBar, { width: `${pct}%`, backgroundColor: colors.textMuted }]} />
                          </View>
                          <Text style={styles.achProgressText}>{prog.current} / {prog.target} {a.metricName}</Text>
                        </View>
                      ) : (
                        <View style={styles.unlockedTag}>
                          <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
                          <Text style={[styles.unlockedTagText, { color: colors.primary }]}>Unlocked</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })()}

        {/* connections / Network */}
        {activeTab === "connections" && (
          <View style={styles.section}>
            <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>Following ({following.length})</Text>
            {following.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>Not following anyone yet</Text>
            ) : (
              following.map((f, idx) => (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.7}
                  style={[styles.connectionRow, { backgroundColor: colors.bgCard }]}
                  onPress={() => router.push(`/profile/${f.id}`)}
                >
                  <Image source={{ uri: f.avatar_url || "https://ui-avatars.com/api/?name=" + encodeURIComponent(f.name) }} style={styles.miniAvatar} />
                  <View style={{ marginLeft: Spacing.sm, flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{f.display_name || f.name}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>@{f.ecotrack_id || "member"}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              ))
            )}

            <Text style={[styles.sectionHeading, { color: colors.textPrimary, marginTop: Spacing.lg }]}>Followers ({followers.length})</Text>
            {followers.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No followers yet</Text>
            ) : (
              followers.map((f, idx) => (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.7}
                  style={[styles.connectionRow, { backgroundColor: colors.bgCard }]}
                  onPress={() => router.push(`/profile/${f.id}`)}
                >
                  <Image source={{ uri: f.avatar_url || "https://ui-avatars.com/api/?name=" + encodeURIComponent(f.name) }} style={styles.miniAvatar} />
                  <View style={{ marginLeft: Spacing.sm, flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{f.display_name || f.name}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>@{f.ecotrack_id || "member"}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* saved / Bookmarked */}
        {activeTab === "saved" && (
          <View style={styles.section}>
            {savedPosts.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="bookmark-outline" size={40} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, marginTop: Spacing.xs, fontWeight: "600" }}>No bookmarked posts</Text>
              </View>
            ) : (
              savedPosts.map((p, idx) => (
                <View key={idx} style={[styles.postCard, { backgroundColor: colors.bgCard }]}>
                  <Text style={[styles.postContent, { color: colors.textPrimary }]}>{p.content}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: FontSize.xs, marginTop: Spacing.xs }}>Saved on {new Date(p.created_at || Date.now()).toLocaleDateString()}</Text>
                </View>
              ))
            )}
          </View>
        )}

        {/* events / Registered Events */}
        {activeTab === "events" && (
          <View style={styles.section}>
            <Text style={[styles.sectionHeading, { color: colors.textPrimary, marginBottom: Spacing.sm }]}>My Pass Vault</Text>
            {events.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="calendar-outline" size={40} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, marginTop: Spacing.xs, fontWeight: "600" }}>No registered entry passes</Text>
              </View>
            ) : (
              events.map((ev, idx) => (
                <View key={idx} style={[styles.digitalPassCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <View style={styles.passHeader}>
                    <Text style={[styles.passCategory, { color: colors.primary }]}>{ev.category?.toUpperCase() || "EVENT"}</Text>
                    <View style={[styles.passBadge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.passBadgeText}>SECURED</Text>
                    </View>
                  </View>

                  <View style={styles.passBody}>
                    <View style={styles.passInfo}>
                      <Text style={[styles.passTitle, { color: colors.textPrimary }]} numberOfLines={1}>{ev.title}</Text>
                      
                      <View style={styles.passDetailRow}>
                        <Ionicons name="calendar-outline" size={12} color={colors.textMuted} style={{ marginRight: 4 }} />
                        <Text style={{ color: colors.textMuted, fontSize: FontSize.xs }}>{ev.date_str || ev.date || "Date Unspecified"}</Text>
                      </View>

                      <View style={styles.passDetailRow}>
                        <Ionicons name="location-outline" size={12} color={colors.textMuted} style={{ marginRight: 4 }} />
                        <Text style={{ color: colors.textMuted, fontSize: FontSize.xs }} numberOfLines={1}>{ev.location || "Online"}</Text>
                      </View>
                    </View>
                    
                    <Image source={{ uri: ev.image || "https://images.unsplash.com/photo-1470240731273-7821a6eeb6bd?w=200" }} style={styles.passThumb} />
                  </View>

                  {/* Perforated Separator Line */}
                  <View style={[styles.perforator, { borderBottomColor: colors.border }]}>
                    <View style={[styles.leftCutout, { backgroundColor: colors.bgLight, borderColor: colors.border }]} />
                    <View style={[styles.rightCutout, { backgroundColor: colors.bgLight, borderColor: colors.border }]} />
                  </View>

                  <View style={styles.passFooter}>
                    <View>
                      <Text style={styles.passSerialLabel}>PASS VAULT ID</Text>
                      <Text style={[styles.passSerialValue, { color: colors.textPrimary }]}>
                        {ev.user_registration?.ticket_id || ev.serialNumber || "ET-PENDING"}
                      </Text>
                    </View>
                    
                    {/* Simulated Entry Barcode */}
                    <View style={styles.barcodeContainer}>
                      <View style={[styles.barcodeBar, { width: 2 }]} />
                      <View style={[styles.barcodeBar, { width: 1, marginLeft: 2 }]} />
                      <View style={[styles.barcodeBar, { width: 3, marginLeft: 1 }]} />
                      <View style={[styles.barcodeBar, { width: 1, marginLeft: 3 }]} />
                      <View style={[styles.barcodeBar, { width: 2, marginLeft: 2 }]} />
                      <View style={[styles.barcodeBar, { width: 4, marginLeft: 1 }]} />
                      <View style={[styles.barcodeBar, { width: 1, marginLeft: 2 }]} />
                      <View style={[styles.barcodeBar, { width: 2, marginLeft: 1 }]} />
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* ── EDIT PROFILE MODAL ── */}
      <Modal visible={editModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.bgCard }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Edit Profile Details</Text>
              <TouchableOpacity onPress={() => setEditModal(false)}>
                <Ionicons name="close-circle" size={28} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: Spacing.md }}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Display Name *</Text>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: isDark ? "#0f172a" : "#f8fafc" }]}
                  value={editForm.display_name}
                  onChangeText={(v) => setEditForm({ ...editForm, display_name: v })}
                  placeholder="Enter Display Name"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Bio</Text>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: isDark ? "#0f172a" : "#f8fafc", height: 80 }]}
                  value={editForm.bio}
                  onChangeText={(v) => setEditForm({ ...editForm, bio: v })}
                  multiline
                  placeholder="Tell us about yourself"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Profession</Text>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: isDark ? "#0f172a" : "#f8fafc" }]}
                  value={editForm.profession}
                  onChangeText={(v) => setEditForm({ ...editForm, profession: v })}
                  placeholder="e.g. Environmentalist"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Organization</Text>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: isDark ? "#0f172a" : "#f8fafc" }]}
                  value={editForm.organization}
                  onChangeText={(v) => setEditForm({ ...editForm, organization: v })}
                  placeholder="e.g. Wildlife Trust"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>City</Text>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: isDark ? "#0f172a" : "#f8fafc" }]}
                  value={editForm.city}
                  onChangeText={(v) => setEditForm({ ...editForm, city: v })}
                  placeholder="e.g. Mumbai"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Country</Text>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: isDark ? "#0f172a" : "#f8fafc" }]}
                  value={editForm.country}
                  onChangeText={(v) => setEditForm({ ...editForm, country: v })}
                  placeholder="e.g. India"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                onPress={saveProfile}
                disabled={isSaving}
              >
                {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── SETTINGS & ACCOUNT MODAL ── */}
      <Modal visible={settingsModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.bgCard }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Account Info & Settings</Text>
              <TouchableOpacity onPress={() => setSettingsModal(false)}>
                <Ionicons name="close-circle" size={28} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: Spacing.md }}>
              <Text style={[styles.sectionHeading, { color: colors.textPrimary, marginBottom: Spacing.sm }]}>Personal Details</Text>
              
              <View style={styles.profileDetailField}>
                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>EMAIL ADDRESS</Text>
                <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{profile?.email || "Not Available"}</Text>
              </View>

              <View style={styles.profileDetailField}>
                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>MEMBER STATUS</Text>
                <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                  {profile?.role === "admin" ? "Lead Admin & Conservation Manager" : "Standard Eco Explorer"}
                </Text>
              </View>

              <View style={styles.profileDetailField}>
                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>ACCOUNT VISIBILITY</Text>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                  <Text style={[styles.detailValue, { color: colors.textPrimary, marginTop: 0 }]}>
                    {editForm.privacy_setting} Account
                  </Text>
                  <TouchableOpacity
                    style={[styles.togglePrivacyBtn, { borderColor: colors.primary }]}
                    onPress={async () => {
                      const newPrivacy = editForm.privacy_setting === "Public" ? "Private" : "Public";
                      setEditForm({ ...editForm, privacy_setting: newPrivacy });
                      try {
                        await updateSocialProfile({ ...editForm, privacy_setting: newPrivacy });
                        if (profile) setProfile({ ...profile, privacy_setting: newPrivacy });
                        Alert.alert("Success", `Account status changed to ${newPrivacy}.`);
                      } catch (e) {
                        Alert.alert("Error", "Failed to update privacy status.");
                      }
                    }}
                  >
                    <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "700" }}>
                      Switch to {editForm.privacy_setting === "Public" ? "Private" : "Public"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.profileDetailField}>
                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>EXPERIENCE SCORE (XP)</Text>
                <Text style={[styles.detailValue, { color: colors.primary }]}>{profile?.reputation_score || 100} XP Earned</Text>
              </View>

              <View style={{ height: Spacing.md }} />
              
              <TouchableOpacity style={styles.logoutButton} onPress={() => { setSettingsModal(false); handleLogout(); }}>
                <Ionicons name="log-out" size={16} color="#ef4444" style={{ marginRight: 6 }} />
                <Text style={styles.logoutButtonText}>Sign Out of EcoTrack</Text>
              </TouchableOpacity>
              
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── ACHIEVEMENT DETAILS & SHARING MODAL ── */}
      <Modal visible={achievementModal} animationType="fade" transparent>
        <View style={[styles.modalOverlay, { justifyContent: "center", paddingHorizontal: Spacing.md }]}>
          <View style={[styles.achDetailCard, { backgroundColor: colors.bgCard }]}>
            <View style={{ alignSelf: "flex-end" }}>
              <TouchableOpacity onPress={() => setAchievementModal(false)}>
                <Ionicons name="close-circle" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {selectedAchievement && (
              <View style={{ alignItems: "center", paddingVertical: Spacing.sm }}>
                <Text style={styles.achDetailEmoji}>{selectedAchievement.icon}</Text>
                <Text style={[styles.achDetailTitle, { color: colors.textPrimary }]}>{selectedAchievement.name}</Text>
                <Text style={[styles.achDetailDesc, { color: colors.textMuted }]}>{selectedAchievement.desc}</Text>

                <View style={styles.achDetailDivider} />

                {selectedAchievement.isUnlocked ? (
                  <View style={{ width: "100%", alignItems: "center" }}>
                    <View style={styles.unlockedContainer}>
                      <Ionicons name="ribbon" size={20} color={colors.primary} />
                      <Text style={[styles.unlockedStatusText, { color: colors.primary }]}>Officially Unlocked</Text>
                    </View>
                    
                    <TouchableOpacity
                      style={[styles.shareBadgeBtn, { backgroundColor: colors.primary }]}
                      onPress={async () => {
                        try {
                          setIsSharingBadge(true);
                          const content = `🏆 EcoTrack Milestone Reached! I just unlocked the "${selectedAchievement.name}" badge (${selectedAchievement.icon}) for: "${selectedAchievement.desc}"! Join the conservation effort!`;
                          let res = null;
                          try {
                            res = await createCommunityPost({ content, post_type: "general" });
                          } catch (e) {
                            console.warn("Sharing failed, using offline fallback", e);
                          }
                          if (!res) {
                            // Offline fallback
                            const key = profile?.id ? `@ecotrack_community_posts_${profile.id}` : "@ecotrack_community_posts";
                            const cachedRaw = await AsyncStorage.getItem(key);
                            const cached = cachedRaw ? JSON.parse(cachedRaw) : [];
                            const newPost = {
                              id: Date.now(),
                              user: profile?.display_name || profile?.name || "You",
                              avatar: profile?.avatar_url || "",
                              image: "",
                              caption: content,
                              likes: 0,
                              time: "Just now",
                              category: "General",
                              liked: false,
                              comments: []
                            };
                            cached.unshift(newPost);
                            await AsyncStorage.setItem(key, JSON.stringify(cached));
                            res = { success: true };
                          }
                          if (res) {
                            Alert.alert("Success 🎉", "Shared to community feed!");
                            setAchievementModal(false);
                          } else {
                            Alert.alert("Error", "Could not publish post.");
                          }
                        } catch (err) {
                          Alert.alert("Error", "Server is currently unreachable.");
                        } finally {
                          setIsSharingBadge(false);
                        }
                      }}
                      disabled={isSharingBadge}
                    >
                      {isSharingBadge ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="share-social-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                          <Text style={styles.shareBadgeBtnText}>Share to Community Feed</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ width: "100%" }}>
                    <Text style={[styles.lockedTitle, { color: colors.textSecondary }]}>Requirements Progress</Text>
                    <View style={styles.achProgressBg}>
                      <View style={[styles.achProgressBar, { width: `${selectedAchievement.pct}%`, backgroundColor: colors.primary }]} />
                    </View>
                    <Text style={[styles.achProgressTextDetail, { color: colors.textMuted }]}>
                      {selectedAchievement.progress.current} / {selectedAchievement.progress.target} {selectedAchievement.metricName} completed ({selectedAchievement.pct}%)
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  heroContainer: { height: 260, position: "relative" },
  heroCover: { width: "100%", height: "100%", resizeMode: "cover" },
  heroOverlay: { ...StyleSheet.absoluteFillObject },
  heroContent: { position: "absolute", bottom: 15, left: 15, right: 15 },

  identityRow: { flexDirection: "row", alignItems: "center" },
  avatarBorder: { width: 84, height: 84, borderRadius: 28, borderWidth: 3, padding: 3, overflow: "hidden" },
  avatar: { width: "100%", height: "100%", borderRadius: 22 },
  avatarInitial: { color: "#fff", fontSize: 32, fontWeight: "900" },

  identityText: { marginLeft: 14, flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  nameText: { fontSize: 20, fontWeight: "900", color: "#fff" },
  badge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeText: { color: "#fff", fontSize: 8, fontWeight: "900" },
  roleText: { color: "#10b981", fontSize: 13, fontWeight: "700", marginTop: 2 },
  
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  metaText: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "600" },

  statsRow: { flexDirection: "row", marginTop: 10 },
  miniStat: { alignItems: "center" },
  statValue: { color: "#fff", fontSize: 14, fontWeight: "900" },
  statLabel: { color: "rgba(255,255,255,0.55)", fontSize: 9, fontWeight: "700", textTransform: "uppercase" },

  headerRightContainer: { position: "absolute", top: 40, right: 15, flexDirection: "row", gap: 10 },
  headerIconButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },

  tabBarContainer: { borderBottomWidth: 1 },
  tabScroll: { paddingHorizontal: Spacing.sm },
  tabItem: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 3, borderBottomColor: "transparent" },
  tabText: { fontSize: 13, fontWeight: "800" },

  contentScroll: { padding: Spacing.md },
  section: { flex: 1 },
  sectionHeading: { fontSize: 14, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: Spacing.xs },
  
  emptyCard: { height: 140, borderRadius: Radius.lg, borderStyle: "dashed", borderWidth: 2, borderColor: "#cbd5e1", justifyContent: "center", alignItems: "center", width: "100%" },
  emptyText: { fontSize: 12, fontStyle: "italic", marginBottom: Spacing.sm },

  petGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10 },
  petCard: { width: (width - Spacing.md * 2 - 10) / 2, padding: Spacing.sm, borderRadius: Radius.md, marginBottom: Spacing.sm, ...Shadow.sm },
  petThumb: { width: "100%", height: 100, borderRadius: Radius.sm, marginBottom: 8, resizeMode: "cover" },
  petName: { fontWeight: "900", fontSize: 14 },
  petBreed: { fontSize: 11, fontWeight: "600" },

  actionCard: { flexDirection: "row", alignItems: "center", padding: Spacing.sm, borderRadius: Radius.md, marginBottom: Spacing.sm, ...Shadow.sm },
  gradeCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  gradeText: { fontSize: 16, fontWeight: "900" },
  cardTitle: { fontWeight: "800", fontSize: 14 },

  postCard: { padding: Spacing.md, borderRadius: Radius.md, marginBottom: Spacing.sm, ...Shadow.sm },
  postContent: { fontSize: 13, fontWeight: "600", lineHeight: 18 },

  progressBarWrap: { height: 6, backgroundColor: "rgba(0,0,0,0.05)", borderRadius: 3, marginTop: Spacing.sm, overflow: "hidden" },
  progressBar: { height: "100%", borderRadius: 3 },

  achievementCard: { width: (width - Spacing.md * 2 - 10) / 2, padding: Spacing.sm, borderRadius: Radius.md, marginBottom: Spacing.sm, alignItems: "center", ...Shadow.sm },
  badgeEmoji: { fontSize: 32, marginBottom: Spacing.xs },
  badgeName: { fontWeight: "900", fontSize: 13, textAlign: "center" },
  badgeDesc: { fontSize: 10, textAlign: "center", marginTop: 2, height: 28 },

  achProgressBg: { height: 4, backgroundColor: "rgba(0,0,0,0.05)", borderRadius: 2, width: "100%", overflow: "hidden", marginTop: 4 },
  achProgressBar: { height: "100%", borderRadius: 2 },
  achProgressText: { fontSize: 9, color: "rgba(0,0,0,0.4)", fontWeight: "700", marginTop: 2, textAlign: "center" },
  achProgressTextDetail: { fontSize: 11, fontWeight: "700", marginTop: 6, textAlign: "center" },

  unlockedTag: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: Spacing.xs },
  unlockedTagText: { fontSize: 10, fontWeight: "800" },

  connectionRow: { flexDirection: "row", alignItems: "center", padding: Spacing.sm, borderRadius: Radius.md, marginBottom: Spacing.xs, ...Shadow.sm },
  miniAvatar: { width: 32, height: 32, borderRadius: 16 },

  digitalPassCard: { width: "100%", borderRadius: Radius.md, borderWidth: 1, marginBottom: Spacing.sm, overflow: "hidden", ...Shadow.sm },
  passHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: Spacing.sm, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.05)" },
  passCategory: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  passBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  passBadgeText: { color: "#fff", fontSize: 8, fontWeight: "900" },

  passBody: { flexDirection: "row", padding: Spacing.sm, gap: 10 },
  passInfo: { flex: 1, justifyContent: "center" },
  passTitle: { fontSize: 15, fontWeight: "800", marginBottom: Spacing.xs },
  passDetailRow: { flexDirection: "row", alignItems: "center", marginTop: 3 },
  passThumb: { width: 64, height: 64, borderRadius: Radius.sm },

  perforator: { height: 1, borderBottomWidth: 1, borderStyle: "dashed", position: "relative", marginVertical: 4 },
  leftCutout: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, position: "absolute", left: -8, top: -7 },
  rightCutout: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, position: "absolute", right: -8, top: -7 },

  passFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: Spacing.sm, backgroundColor: "rgba(0,0,0,0.02)" },
  passSerialLabel: { fontSize: 8, fontWeight: "800", color: "rgba(0,0,0,0.4)" },
  passSerialValue: { fontSize: 12, fontWeight: "900", letterSpacing: 0.5, marginTop: 2 },
  barcodeContainer: { flexDirection: "row", height: 20, alignItems: "center" },
  barcodeBar: { height: "100%", backgroundColor: "#000" },

  settingsCard: { padding: Spacing.md, borderRadius: Radius.md, ...Shadow.sm },
  settingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logoutButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: Spacing.lg, paddingVertical: 12, borderRadius: Radius.md, borderWidth: 1, borderColor: "rgba(239,68,68,0.2)", backgroundColor: "rgba(239,68,68,0.05)" },
  logoutButtonText: { color: "#ef4444", fontWeight: "800", fontSize: 13 },

  editBtn: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, marginTop: 8, gap: 4 },
  editBtnText: { color: "#fff", fontSize: 11, fontWeight: "800" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, height: "80%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: Spacing.md, borderBottomWidth: 1 },
  modalTitle: { fontSize: 16, fontWeight: "900" },
  inputGroup: { marginBottom: Spacing.sm },
  inputLabel: { fontSize: 11, fontWeight: "800", marginBottom: 4, textTransform: "uppercase" },
  input: { height: 46, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 12, fontSize: 13 },
  saveBtn: { height: 48, borderRadius: Radius.md, justifyContent: "center", alignItems: "center", marginTop: Spacing.md },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "900" },

  profileDetailField: { marginBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.05)", paddingBottom: Spacing.xs },
  detailLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  detailValue: { fontSize: 13, fontWeight: "700", marginTop: 4 },
  togglePrivacyBtn: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm },

  achDetailCard: { width: "85%", borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.md },
  achDetailEmoji: { fontSize: 64, marginBottom: Spacing.sm, textAlign: "center" },
  achDetailTitle: { fontSize: 18, fontWeight: "900", textAlign: "center" },
  achDetailDesc: { fontSize: 12, textAlign: "center", marginTop: Spacing.xs, lineHeight: 18 },
  achDetailDivider: { height: 1, backgroundColor: "rgba(0,0,0,0.05)", width: "100%", marginVertical: Spacing.md },
  unlockedContainer: { flexDirection: "row", alignItems: "center", gap: 6, marginVertical: Spacing.sm },
  unlockedStatusText: { fontSize: 14, fontWeight: "800" },
  shareBadgeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", height: 44, borderRadius: Radius.md, width: "100%", marginTop: Spacing.sm },
  shareBadgeBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  lockedTitle: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5, marginBottom: Spacing.xs, textTransform: "uppercase" }
});
