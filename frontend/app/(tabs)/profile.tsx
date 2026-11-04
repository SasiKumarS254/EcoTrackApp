import { useState, useEffect, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, TextInput, Alert, StatusBar, Modal, Share
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../context/ThemeContext";
import { Radius, Shadow, FontSize } from "../../constants/theme";
import {
  fetchRegisteredEvents,
  fetchCommunityPosts,
  fetchFullUserProfile,
  addPet,
  createCommunityPost,
  fetchScanHistory,
  updateUserProfile,
} from "../../services/api";



export default function ProfileScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"posts" | "saved" | "passes" | "scans" | "pets" | "achievements">("posts");

  // Edit Profile Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [role, setRole] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  // Animal Vault Modal & Form
  const [showAddPetModal, setShowAddPetModal] = useState(false);
  const [petName, setPetName] = useState("");
  const [petSpecies, setPetSpecies] = useState("");
  const [petBreed, setPetBreed] = useState("");
  const [petAge, setPetAge] = useState("");
  const [petWeight, setPetWeight] = useState("");
  const [isSavingPet, setIsSavingPet] = useState(false);

  const [myPosts, setMyPosts] = useState<any[]>([]);
  const [myScans, setMyScans] = useState<any[]>([]);
  const [myPasses, setMyPasses] = useState<any[]>([]);
  const [myPets, setMyPets] = useState<any[]>([]);
  const [myAchievements, setMyAchievements] = useState<any[]>([
    {
      id: "ach_1",
      name: "Certified Trainer",
      icon: "🏋️",
      desc: "Register your first custom AI training program.",
      color: "#10b981",
    },
    {
      id: "ach_2",
      name: "Master Welfare Coach",
      icon: "🎓",
      desc: "Register 3 or more AI training programs.",
      color: "#f59e0b",
    },
    {
      id: "ach_3",
      name: "AI Bio-Scanner Pioneer",
      icon: "🔬",
      desc: "Perform your first AI pose estimation scan.",
      color: "#06b6d4",
    },
    {
      id: "ach_4",
      name: "Elite Species Analyst",
      icon: "🧬",
      desc: "Perform 5 or more AI pose estimation scans.",
      color: "#8b5cf6",
    },
  ]);

  const handlePickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Media library access is needed to choose profile photo.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        setAvatarUri(res.assets[0].uri);
      }
    } catch {
      Alert.alert("Picker Error", "Could not choose photo from gallery.");
    }
  };

  const handleTakeAvatarPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Camera Permission Required", "Camera access is needed to capture profile photo.");
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        setAvatarUri(res.assets[0].uri);
      }
    } catch {
      Alert.alert("Camera Error", "Could not open camera.");
    }
  };


  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        let u: any = null;
        const sessionRaw = await AsyncStorage.getItem("@ecotrack_user_session");
        if (sessionRaw) {
          try { u = JSON.parse(sessionRaw); } catch {}
        }
        if (!u) {
          const storedId = await AsyncStorage.getItem("@ecotrack_user_id");
          if (storedId) {
            u = { id: storedId, user_id: storedId };
          } else {
            u = { id: "usr_cef118e82cf2444d", user_id: "usr_cef118e82cf2444d", name: "Sasi", email: "sasik27273@gmail.com" };
          }
        }
        if (!active) return;

        setUser(u);
        setAvatarUri(u.avatar_url || u.avatar || null);
        const resolvedName = u.name || u.display_name || (u.email ? u.email.split("@")[0] : "EcoTrack Member");
        setName(resolvedName);
        setBio(u.bio || "EcoTrack Wildlife & Companion Animal Welfare Member");
        setLocation(u.location || (u.city && u.country ? `${u.city}, ${u.country}` : u.city || u.country || "Active Member"));
        setRole(
          u.role === "admin"
            ? "System Administrator"
            : u.role === "seller"
            ? "Verified Shelter / Breeder"
            : "Community Member"
        );

        const activeId = u.user_id || u.id;
        if (activeId) {
          // Fetch full profile (Animal Vault, Achievements & Updated Stats)
          try {
            const full = await fetchFullUserProfile(activeId);
            if (active && full) {
              if (full.profile) {
                const p = full.profile;
                const pName = p.display_name || p.name || resolvedName;
                setName(pName);
                if (p.bio) setBio(p.bio);
                if (p.city || p.country) {
                  const loc = p.city && p.country ? `${p.city}, ${p.country}` : (p.city || p.country);
                  setLocation(loc);
                }
                if (p.avatar_url || p.avatar) {
                  setAvatarUri(p.avatar_url || p.avatar);
                }
                setUser((prev: any) => ({
                  ...prev,
                  ...p,
                  reputation_score: p.reputation_score || prev?.reputation_score || 120,
                  impactStats: full.impactStats || prev?.impactStats,
                }));
              }
              if (Array.isArray(full.pets)) setMyPets(full.pets);
              if (Array.isArray(full.achievements) && full.achievements.length > 0) {
                setMyAchievements(
                  full.achievements.map((a: any) => ({
                    id: a.id || a.badge_code || `ach_${Math.random()}`,
                    name: a.badge_name || a.name || a.title || "Welfare Advocate",
                    icon: a.icon || "🏆",
                    desc: a.description || a.desc || "Conservation achievement unlocked.",
                    color: a.color || "#10b981",
                  }))
                );
              }
            }
          } catch (err) {
            console.warn("Could not load full profile data:", err);
          }

          // Fetch real passes from registered events
          try {
            const passes = await fetchRegisteredEvents(activeId);
            if (active && Array.isArray(passes)) {
              setMyPasses(
                passes.map((p: any) => ({
                  id: p.ticket_id || `PASS-${p.id || "REG"}`,
                  title: p.title || p.name || "Community Event",
                  venue: p.location || "EcoTrack Venue",
                  date: p.date || p.date_str || "Scheduled",
                }))
              );
            }
          } catch (err) {
            console.warn("Could not load passes:", err);
          }

          // Fetch real community posts created by this user
          try {
            const allPosts = await fetchCommunityPosts();
            if (active && Array.isArray(allPosts)) {
              const userPosts = allPosts.filter(
                (p: any) => p.user_id === activeId || p.author_name === resolvedName
              );
              setMyPosts(
                userPosts.map((p: any) => ({
                  id: p.id,
                  title: p.caption || p.content || "Community Update",
                  date: p.created_at || "Recent",
                  likes: p.likes_count ?? p.likes ?? 0,
                  comments: Array.isArray(p.comments) ? p.comments.length : 0,
                }))
              );
            }
          } catch (err) {
            console.warn("Could not load user posts:", err);
          }

          // Fetch user scans from local history or backend
          try {
            let loadedScans: any[] = [];
            const userScansKey = `@ecotrack_scans_history_${activeId}`;
            const scansRaw = (await AsyncStorage.getItem(userScansKey)) || (await AsyncStorage.getItem("@ecotrack_scans_history"));
            if (scansRaw) {
              const parsedScans = JSON.parse(scansRaw);
              if (Array.isArray(parsedScans) && parsedScans.length > 0) {
                loadedScans = parsedScans;
              }
            }
            if (loadedScans.length === 0) {
              try {
                const history = await fetchScanHistory(activeId);
                if (Array.isArray(history) && history.length > 0) {
                  loadedScans = history;
                }
              } catch {}
            }
            if (active && loadedScans.length > 0) {
              setMyScans(
                loadedScans.map((s: any, idx: number) => ({
                  id: s.id || `scan_${idx + 1}`,
                  species: s.detected_species || s.species || s.mode || "Canine",
                  exercise: s.exercise_name || s.exercise || "Gait Kinematics",
                  grade: s.grade || "Grade A",
                  score: s.score || (s.detection_confidence ? Math.round(s.detection_confidence * 100) : 93),
                  date: s.created_at ? new Date(s.created_at).toLocaleDateString() : (s.date || "Recent Scan"),
                }))
              );
            }
          } catch (err) {
            console.warn("Could not load scans:", err);
          }
        }
      } catch (e) {
        console.warn("Error loading user profile", e);
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, []);

  const handleSaveProfile = async () => {
    const updated = {
      ...user,
      name,
      display_name: name,
      bio,
      location,
      role,
      avatar_url: avatarUri || user?.avatar_url || user?.avatar,
      avatar: avatarUri || user?.avatar || user?.avatar_url,
    };
    setUser(updated);
    await AsyncStorage.setItem("@ecotrack_user_session", JSON.stringify(updated));
    setShowEditModal(false);
    try {
      await updateUserProfile({
        name,
        display_name: name,
        bio,
        city: location.includes(",") ? location.split(",")[0].trim() : location,
        country: location.includes(",") ? location.split(",")[1].trim() : "India",
        avatar_url: avatarUri || user?.avatar_url || user?.avatar,
      });
    } catch {}
    Alert.alert("Profile Updated ✨", "Your profile details have been saved.");
  };

  const handleLogout = async () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to log out of your EcoTrack account?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem("@ecotrack_user_session");
            await AsyncStorage.removeItem("@ecotrack_auth_token");
            await AsyncStorage.setItem("@ecotrack_logged_out", "true");
            router.replace("/auth/login");
          },
        },
      ]
    );
  };

  const handleShareAchievement = async (badgeName: string, icon: string) => {
    try {
      const text = `🏆 I just unlocked the "${badgeName}" achievement on EcoTrack! ${icon}\nJoin me in protecting animal welfare!`;
      try {
        await createCommunityPost({
          content: text,
          caption: text,
          post_type: "achievement",
        });
      } catch {}

      await Share.share({
        message: text,
        title: `EcoTrack Achievement: ${badgeName}`,
      });
    } catch {
      Alert.alert("Achievement Unlocked! 🏆", `Shared "${badgeName}" achievement.`);
    }
  };

  const handleAddPetSubmit = async () => {
    if (!petName.trim() || !petSpecies.trim()) {
      Alert.alert("Required Fields", "Please enter both Animal Name and Species.");
      return;
    }
    setIsSavingPet(true);
    try {
      const newPet = {
        name: petName.trim(),
        species: petSpecies.trim(),
        breed: petBreed.trim() || "Standard Breed",
        age: petAge.trim() || "1 Year",
        weight: petWeight.trim() || "10 kg",
      };
      const res = await addPet(newPet);
      if (res && res.pet) {
        setMyPets((prev) => [res.pet, ...prev]);
      } else {
        setMyPets((prev) => [{ id: `pet_${Date.now()}`, ...newPet }, ...prev]);
      }
      setShowAddPetModal(false);
      setPetName("");
      setPetSpecies("");
      setPetBreed("");
      setPetAge("");
      setPetWeight("");
      Alert.alert("Animal Registered 🐾", `${newPet.name} has been added to your Animal Vault!`);
    } catch (e: any) {
      Alert.alert("Registration Failed", e?.message || "Could not register animal.");
    } finally {
      setIsSavingPet(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* TOP HEADER */}
      <View style={styles.topHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(tabs)");
              }
            }}
          >
            <Ionicons name="arrow-back" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.topIconWrap}>
            <Ionicons name="person" size={20} color="#fff" />
          </View>
          <View>
            <Text style={styles.topTitle}>My Profile</Text>
            <Text style={styles.topSub}>Credentials & Welfare Records</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={16} color={colors.danger} />
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* HERO CARD */}
        <View style={styles.profileHeroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.avatarWrap}>
              <Text style={styles.avatarText}>
                {name ? name.charAt(0).toUpperCase() : "U"}
              </Text>
            </View>

            <View style={{ flex: 1, marginLeft: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Text style={styles.profileName}>{name || "EcoTrack Member"}</Text>
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                </View>
              </View>

              <Text style={styles.profileRole}>{role || "Community Member"}</Text>

              <View style={styles.metaRow}>
                <Ionicons name="mail-outline" size={12} color={colors.textMuted} />
                <Text style={styles.metaText}>{user?.email || "verified_member@ecotrack.org"}</Text>
              </View>

              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={12} color={colors.textMuted} />
                <Text style={styles.metaText}>{location || "Active Member"}</Text>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.metaText}>Member since 2026</Text>
              </View>
            </View>
          </View>

          <Text style={styles.profileBio}>{bio || "EcoTrack Wildlife & Companion Animal Welfare Member"}</Text>

          {/* Action Buttons Row */}
          <View style={styles.profileActionRow}>
            <TouchableOpacity style={styles.editProfileBtn} onPress={() => setShowEditModal(true)}>
              <Ionicons name="create-outline" size={15} color={colors.primary} />
              <Text style={styles.editProfileBtnText}>Edit Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchAccountBtn}
              onPress={() => router.push("/auth/login")}
            >
              <Ionicons name="swap-horizontal" size={15} color="#0284c7" />
              <Text style={styles.switchAccountBtnText}>Switch / Web Login</Text>
            </TouchableOpacity>
          </View>


          {/* Admin Control Center Access Card */}
          {(user?.role === 'admin' || (typeof role === 'string' && role.includes('Admin'))) && (
            <TouchableOpacity
              style={{
                marginTop: 10,
                borderRadius: 12,
                overflow: "hidden",
              }}
              onPress={() => router.push("/admin" as any)}
            >
              <LinearGradient
                colors={["#059669", "#047857"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Ionicons name="shield-checkmark" size={18} color="#ffffff" />
                  <View>
                    <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 13 }}>
                      Admin Control Center
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 11 }}>
                      Manage users, roles & moderate content
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#ffffff" />
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Glass Stats Bar */}
          <View style={styles.statsBar}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{user?.reputation_score || 100}</Text>
              <Text style={styles.statLab}>REPUTATION</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{myScans.length}</Text>
              <Text style={styles.statLab}>SCANS</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{myPosts.length}</Text>
              <Text style={styles.statLab}>POSTS</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{myPasses.length}</Text>
              <Text style={styles.statLab}>PASSES</Text>
            </View>
          </View>
        </View>

        {/* TABS NAVIGATION */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: 16, marginTop: 14 }}>
          <View style={[styles.tabsRow, { marginHorizontal: 0, marginTop: 0 }]}>
            {[
              { key: "posts", label: "My Posts" },
              { key: "scans", label: "AI Scans" },
              { key: "passes", label: "Pass Vault" },
              { key: "pets", label: "Animal Vault" },
              { key: "achievements", label: "Badges" },
            ].map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.tabBtn, activeTab === t.key && styles.tabBtnActive]}
                onPress={() => setActiveTab(t.key as any)}
              >
                <Text style={[styles.tabBtnText, activeTab === t.key && styles.tabBtnTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* TAB CONTENTS */}
        {activeTab === "posts" && (
          <View style={styles.tabContentList}>
            {myPosts.length === 0 ? (
              <View style={styles.emptyActivity}>
                <Ionicons name="chatbubbles-outline" size={36} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No Posts Yet</Text>
                <Text style={styles.emptySub}>Share observations and updates in the Community feed.</Text>
                <TouchableOpacity style={styles.emptyActionBtn} onPress={() => router.push("/community")}>
                  <Text style={styles.emptyActionBtnText}>Go to Community</Text>
                </TouchableOpacity>
              </View>
            ) : (
              myPosts.map((p, idx) => (
                <View key={`post-${p.id || idx}-${idx}`} style={styles.itemCard}>
                  <Text style={styles.itemTitle}>{p.title}</Text>
                  <View style={styles.itemMetaRow}>
                    <Text style={styles.itemDate}>{p.date}</Text>
                    <Text style={styles.metaDot}>•</Text>
                    <Text style={styles.itemDate}>❤️ {p.likes} Likes</Text>
                    <Text style={styles.metaDot}>•</Text>
                    <Text style={styles.itemDate}>💬 {p.comments} Comments</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === "scans" && (
          <View style={styles.tabContentList}>
            {myScans.length === 0 ? (
              <View style={styles.emptyActivity}>
                <Ionicons name="scan-outline" size={36} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No Scans Recorded</Text>
                <Text style={styles.emptySub}>Analyze quadruped gait and postures with the AI Scanner.</Text>
                <TouchableOpacity style={styles.emptyActionBtn} onPress={() => router.push("/aiscanner")}>
                  <Text style={styles.emptyActionBtnText}>Launch AI Scanner</Text>
                </TouchableOpacity>
              </View>
            ) : (
              myScans.map((s, idx) => (
                <View key={`scan-${s.id || idx}-${idx}`} style={styles.itemCard}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <Text style={styles.itemTitle}>{s.exercise}</Text>
                    <View style={styles.scanGradeBadge}>
                      <Text style={styles.scanGradeText}>{s.grade} ({s.score}%)</Text>
                    </View>
                  </View>
                  <Text style={styles.scanSpeciesText}>{s.species}</Text>
                  <Text style={styles.itemDate}>{s.date}</Text>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === "passes" && (
          <View style={styles.tabContentList}>
            {myPasses.length === 0 ? (
              <View style={styles.emptyActivity}>
                <Ionicons name="ticket-outline" size={36} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>Pass Vault Empty</Text>
                <Text style={styles.emptySub}>Register for workshops or rescue drives to receive your entry pass.</Text>
                <TouchableOpacity style={styles.emptyActionBtn} onPress={() => router.push("/events")}>
                  <Text style={styles.emptyActionBtnText}>Browse Events</Text>
                </TouchableOpacity>
              </View>
            ) : (
              myPasses.map((pass, idx) => (
                <View key={`pass-${pass.id || idx}-${idx}`} style={styles.itemCard}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <Text style={styles.itemTitle}>{pass.title}</Text>
                    <View style={styles.passBadge}>
                      <Text style={styles.passBadgeText}>{pass.id}</Text>
                    </View>
                  </View>
                  <Text style={styles.scanSpeciesText}>📍 {pass.venue}</Text>
                  <Text style={styles.itemDate}>📅 {pass.date}</Text>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === "pets" && (
          <View style={styles.tabContentList}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <View>
                <Text style={{ fontSize: 16, fontWeight: "800", color: colors.textPrimary }}>
                  Registered Animals ({myPets.length})
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>Digital animal vault & health records</Text>
              </View>
              <TouchableOpacity
                style={{
                  backgroundColor: colors.primary,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: Radius.md,
                }}
                onPress={() => setShowAddPetModal(true)}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Add Animal</Text>
              </TouchableOpacity>
            </View>

            {myPets.length === 0 ? (
              <View style={styles.emptyActivity}>
                <Ionicons name="paw-outline" size={36} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No Registered Animals</Text>
                <Text style={styles.emptySub}>Digitally register your animals for AI monitoring and health tracking.</Text>
                <TouchableOpacity style={styles.emptyActionBtn} onPress={() => setShowAddPetModal(true)}>
                  <Text style={styles.emptyActionBtnText}>+ Register Animal</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {myPets.map((pet, idx) => (
                  <View key={`pet-${pet.id || idx}-${idx}`} style={styles.itemCard}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <Text style={styles.itemTitle}>{pet.name}</Text>
                      <View style={styles.passBadge}>
                        <Text style={styles.passBadgeText}>{pet.species || pet.breed || "Animal"}</Text>
                      </View>
                    </View>
                    <Text style={styles.scanSpeciesText}>Breed: {pet.breed || "Standard"} • Age: {pet.age || "1 Year"}</Text>
                    <Text style={styles.itemDate}>Weight: {pet.weight || "10 kg"}</Text>
                  </View>
                ))}
                <TouchableOpacity
                  style={[styles.itemCard, { borderStyle: "dashed", borderWidth: 1.5, borderColor: colors.primary, alignItems: "center", justifyContent: "center", paddingVertical: 18, backgroundColor: isDark ? "rgba(16,185,129,0.08)" : "rgba(16,185,129,0.04)" }]}
                  onPress={() => setShowAddPetModal(true)}
                >
                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(16,185,129,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
                    <Ionicons name="add" size={22} color={colors.primary} />
                  </View>
                  <Text style={{ fontWeight: "800", fontSize: 14, color: colors.textPrimary }}>+ Add Another Animal</Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>Register a new animal to your digital vault</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {activeTab === "achievements" && (
          <View style={styles.tabContentList}>
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: colors.textPrimary }}>
                Earned Badges ({myAchievements.length})
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>Your conservation achievements</Text>
            </View>

            {myAchievements.map((ach, idx) => (
              <View key={`ach-${ach.id || idx}-${idx}`} style={[styles.itemCard, { borderLeftWidth: 4, borderLeftColor: ach.color || colors.primary }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Text style={{ fontSize: 28 }}>{ach.icon || "🏆"}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemTitle, { fontSize: 15 }]}>{ach.name}</Text>
                    <Text style={[styles.scanSpeciesText, { marginTop: 2 }]}>{ach.desc}</Text>
                  </View>
                  <TouchableOpacity
                    style={{
                      backgroundColor: colors.primary,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: Radius.md,
                    }}
                    onPress={() => handleShareAchievement(ach.name, ach.icon || "🏆")}
                  >
                    <Ionicons name="share-social-outline" size={13} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>Share</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* SETTINGS CARD */}
        <View style={styles.settingsCard}>
          <Text style={styles.settingsTitle}>Preferences & System</Text>

          <TouchableOpacity style={styles.settingItem} onPress={toggleTheme}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Ionicons name={isDark ? "sunny" : "moon"} size={20} color={colors.primary} />
              <Text style={styles.settingText}>Dark Mode</Text>
            </View>
            <Ionicons name={isDark ? "toggle" : "toggle-outline"} size={28} color={colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => Alert.alert("Offline AI Engine", "EcoTrack ML models are cached offline for field inference.")}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Ionicons name="hardware-chip" size={20} color={colors.secondary} />
              <Text style={styles.settingText}>Offline Computer Vision Status</Text>
            </View>
            <Text style={styles.statusOnlineText}>Active</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* EDIT PROFILE MODAL */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close-circle" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Profile Photo Picker */}
              <View style={styles.avatarEditWrap}>
                <View style={styles.avatarEditImgBox}>
                  <Image
                    source={{
                      uri: avatarUri || user?.avatar_url || user?.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200",
                    }}
                    style={styles.avatarEditImg}
                  />
                  <View style={styles.avatarEditBadge}>
                    <Ionicons name="camera" size={14} color="#fff" />
                  </View>
                </View>

                <View style={styles.avatarBtnRow}>
                  <TouchableOpacity style={styles.avatarPickBtn} onPress={handlePickAvatar} activeOpacity={0.8}>
                    <Ionicons name="images-outline" size={14} color={colors.primary} />
                    <Text style={styles.avatarPickBtnText}>Upload Photo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.avatarPickBtn} onPress={handleTakeAvatarPhoto} activeOpacity={0.8}>
                    <Ionicons name="camera-outline" size={14} color={colors.primary} />
                    <Text style={styles.avatarPickBtnText}>Take Photo</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.modalInput}
                value={name}
                onChangeText={setName}
                placeholder="Name"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.inputLabel}>Role / Specialty</Text>
              <TextInput
                style={styles.modalInput}
                value={role}
                onChangeText={setRole}
                placeholder="Role / Title"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.inputLabel}>Location</Text>
              <TextInput
                style={styles.modalInput}
                value={location}
                onChangeText={setLocation}
                placeholder="City, Country"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.inputLabel}>Bio</Text>
              <TextInput
                style={[styles.modalInput, { height: 70, textAlignVertical: "top" }]}
                value={bio}
                onChangeText={setBio}
                placeholder="Describe your role in animal welfare..."
                placeholderTextColor={colors.textMuted}
                multiline
              />

              <TouchableOpacity style={styles.submitBtn} onPress={handleSaveProfile}>
                <Text style={styles.submitBtnText}>Save Changes</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ADD PET MODAL */}
      <Modal visible={showAddPetModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🐾 Add Animal to Vault</Text>
              <TouchableOpacity onPress={() => setShowAddPetModal(false)}>
                <Ionicons name="close-circle" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Animal Name *</Text>
              <TextInput
                style={styles.modalInput}
                value={petName}
                onChangeText={setPetName}
                placeholder="e.g. Happy"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.inputLabel}>Species *</Text>
              <TextInput
                style={styles.modalInput}
                value={petSpecies}
                onChangeText={setPetSpecies}
                placeholder="e.g. Dog, Cat, Elephant"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.inputLabel}>Breed</Text>
              <TextInput
                style={styles.modalInput}
                value={petBreed}
                onChangeText={setPetBreed}
                placeholder="e.g. Standard Breed"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.inputLabel}>Age</Text>
              <TextInput
                style={styles.modalInput}
                value={petAge}
                onChangeText={setPetAge}
                placeholder="e.g. 1 Year"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.inputLabel}>Weight</Text>
              <TextInput
                style={styles.modalInput}
                value={petWeight}
                onChangeText={setPetWeight}
                placeholder="e.g. 10 kg"
                placeholderTextColor={colors.textMuted}
              />

              <TouchableOpacity
                style={[styles.submitBtn, isSavingPet && { opacity: 0.6 }]}
                onPress={handleAddPetSubmit}
                disabled={isSavingPet}
              >
                <Text style={styles.submitBtnText}>{isSavingPet ? "Registering..." : "Add to Vault"}</Text>
              </TouchableOpacity>

              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    backBtn: {
      width: 34,
      height: 34,
      borderRadius: Radius.md,
      backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 2,
    },
    topIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: "#10b981",
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
    logoutBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? "#450a0a" : "#fee2e2",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: Radius.full,
      gap: 4,
    },
    logoutBtnText: {
      fontSize: 11,
      fontWeight: "800",
      color: colors.danger,
    },

    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
      maxWidth: 1000,
      width: "100%",
      alignSelf: "center",
    },

    profileHeroCard: {
      backgroundColor: colors.bgCard,
      borderRadius: Radius.xl,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
      ...Shadow.sm,
    },
    heroTopRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    avatarWrap: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.primary,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarText: {
      color: "#fff",
      fontSize: 26,
      fontWeight: "900",
    },
    profileName: {
      fontSize: FontSize.lg,
      fontWeight: "900",
      color: colors.textPrimary,
    },
    verifiedBadge: {
      paddingTop: 2,
    },
    profileRole: {
      fontSize: FontSize.xs,
      color: colors.primary,
      fontWeight: "700",
      marginBottom: 4,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    metaText: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: "600",
    },
    metaDot: {
      color: colors.textMuted,
      marginHorizontal: 2,
    },

    profileBio: {
      fontSize: FontSize.xs,
      color: colors.textSecondary,
      lineHeight: 18,
      marginBottom: 14,
    },
    profileActionRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 16,
    },
    editProfileBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
      paddingVertical: 9,
      borderRadius: Radius.md,
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    editProfileBtnText: {
      fontSize: FontSize.xs,
      fontWeight: "800",
      color: colors.primary,
    },
    switchAccountBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark ? "#082f49" : "#e0f2fe",
      paddingVertical: 9,
      borderRadius: Radius.md,
      gap: 6,
      borderWidth: 1,
      borderColor: isDark ? "#0369a1" : "#bae6fd",
    },
    switchAccountBtnText: {
      fontSize: FontSize.xs,
      fontWeight: "800",
      color: "#0284c7",
    },
    emptyActivity: {
      backgroundColor: colors.bgCard,
      borderRadius: Radius.lg,
      padding: 24,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      marginVertical: 4,
    },
    emptyTitle: {
      fontSize: FontSize.sm,
      fontWeight: "800",
      color: colors.textPrimary,
      marginTop: 8,
      marginBottom: 4,
    },
    emptySub: {
      fontSize: FontSize.xs,
      color: colors.textMuted,
      textAlign: "center",
      marginBottom: 12,
      maxWidth: 240,
    },
    emptyActionBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: Radius.md,
    },
    emptyActionBtnText: {
      fontSize: FontSize.xs,
      fontWeight: "800",
      color: "#fff",
    },

    statsBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: isDark ? "#0f172a" : "#f8fafc",
      padding: 12,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statBox: {
      flex: 1,
      alignItems: "center",
    },
    statVal: {
      fontSize: FontSize.md,
      fontWeight: "900",
      color: colors.textPrimary,
      marginBottom: 2,
    },
    statLab: {
      fontSize: 8.5,
      fontWeight: "800",
      color: colors.textMuted,
      letterSpacing: 0.5,
    },
    statDivider: {
      width: 1,
      height: 20,
      backgroundColor: colors.border,
    },

    tabsRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 14,
    },
    tabBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: "center",
      borderRadius: Radius.full,
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    tabBtnText: {
      fontSize: FontSize.xs,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    tabBtnTextActive: {
      color: "#fff",
      fontWeight: "800",
    },

    tabContentList: {
      gap: 10,
      marginBottom: 16,
    },
    itemCard: {
      backgroundColor: colors.bgCard,
      padding: 14,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      ...Shadow.sm,
    },
    itemTitle: {
      fontSize: FontSize.sm,
      fontWeight: "800",
      color: colors.textPrimary,
      marginBottom: 4,
    },
    itemMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    itemDate: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: "600",
    },
    scanGradeBadge: {
      backgroundColor: isDark ? "#064e3b" : "#dcfce7",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: Radius.full,
    },
    scanGradeText: {
      fontSize: 10,
      fontWeight: "800",
      color: colors.primary,
    },
    scanSpeciesText: {
      fontSize: FontSize.xs,
      color: colors.primary,
      fontWeight: "700",
      marginBottom: 4,
    },
    passBadge: {
      backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: Radius.full,
    },
    passBadgeText: {
      fontSize: 10,
      fontWeight: "800",
      color: colors.primary,
    },

    settingsCard: {
      backgroundColor: colors.bgCard,
      borderRadius: Radius.xl,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    settingsTitle: {
      fontSize: FontSize.md,
      fontWeight: "800",
      color: colors.textPrimary,
      marginBottom: 4,
    },
    settingItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    settingText: {
      fontSize: FontSize.sm,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    statusOnlineText: {
      fontSize: FontSize.xs,
      fontWeight: "800",
      color: colors.primary,
    },

    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "flex-end",
      alignItems: "center",
    },
    modalSheet: {
      backgroundColor: colors.bgCard,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 22,
      maxWidth: 640,
      width: "100%",
      maxHeight: "85%",
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: FontSize.lg,
      fontWeight: "900",
      color: colors.textPrimary,
    },
    inputLabel: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.textPrimary,
      marginBottom: 6,
    },
    modalInput: {
      backgroundColor: isDark ? "#0f172a" : "#f8fafc",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: FontSize.sm,
      color: colors.textPrimary,
      marginBottom: 12,
    },
    avatarEditWrap: {
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    avatarEditImgBox: {
      position: "relative",
      width: 84,
      height: 84,
      borderRadius: 42,
      marginBottom: 10,
    },
    avatarEditImg: {
      width: 84,
      height: 84,
      borderRadius: 42,
      borderWidth: 2,
      borderColor: colors.primary,
    },
    avatarEditBadge: {
      position: "absolute",
      bottom: 0,
      right: 0,
      backgroundColor: colors.primary,
      width: 26,
      height: 26,
      borderRadius: 13,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: colors.bgCard,
    },
    avatarBtnRow: {
      flexDirection: "row",
      gap: 10,
    },
    avatarPickBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? "#0f172a" : "#f1f5f9",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 5,
    },
    avatarPickBtnText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    submitBtn: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: Radius.md,
      alignItems: "center",
      marginTop: 6,
      marginBottom: 10,
    },
    submitBtnText: {
      color: "#fff",
      fontSize: FontSize.sm,
      fontWeight: "800",
    },
  });
}
