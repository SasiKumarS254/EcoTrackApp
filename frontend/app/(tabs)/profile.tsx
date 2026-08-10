import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  Alert, TextInput, Modal, Switch, StatusBar, Dimensions, ActivityIndicator,
  FlatList
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../context/ThemeContext";
import { Radius, Shadow, FontSize, Spacing } from "@/constants/theme";
import { router, useFocusEffect } from "expo-router";

const { width } = Dimensions.get("window");
const SOCIAL_BASE = "http://localhost:5000/api/social";

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
  impact_stats?: any;
  organization?: string;
  city?: string;
  country?: string;
};

type EditProfileBody = {
  display_name: string;
  bio: string;
  profession: string;
  organization: string;
  city: string;
  country: string;
};

export default function ProfileRedesignScreen() {
  const { colors, isDark } = useTheme();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pets, setPets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Vault");

  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState<EditProfileBody>({
    display_name: "", bio: "", profession: "", organization: "", city: "", country: ""
  });
  const [isSaving, setIsSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [])
  );

  const fetchProfile = async () => {
    try {
      const raw = await AsyncStorage.getItem("@ecotrack_user_session");
      if (!raw) { router.replace("/auth/login"); return; }
      const session = JSON.parse(raw);

      const res = await fetch(`${SOCIAL_BASE}/me`, {
        headers: { 'Authorization': `Bearer ${session.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        setPets(data.pets || []);

        setEditForm({
          display_name: data.profile.display_name || data.profile.name || "",
          bio: data.profile.bio || "",
          profession: data.profile.profession || "",
          organization: data.profile.organization || "",
          city: data.profile.city || "",
          country: data.profile.country || ""
        });
      }
    } catch (e) {
      console.warn("Profile fetch error", e);
    } finally {
      setIsLoading(false);
    }
  };

  const saveProfile = async () => {
    try {
      setIsSaving(true);
      const raw = await AsyncStorage.getItem("@ecotrack_user_session");
      const session = JSON.parse(raw || "{}");

      const res = await fetch(`${SOCIAL_BASE}/profile`, {
        method: "PUT",
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`
        },
        body: JSON.stringify(editForm)
      });

      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        setEditModal(false);
        Alert.alert("Success", "Welfare profile updated.");
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

  return (
    <View style={[styles.container, { backgroundColor: colors.bgLight }]}>
      <StatusBar barStyle="light-content" />

      {/* ── REDESIGNED HERO ── */}
      <View style={styles.heroContainer}>
        <Image source={{ uri: "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800" }} style={styles.heroCover} />
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.9)"]} style={styles.heroOverlay} />

        <View style={styles.heroContent}>
          <View style={styles.identityRow}>
            <View style={[styles.avatarBorder, { borderColor: colors.primary }]}>
              <Image source={{ uri: profile?.avatar_url || "https://ui-avatars.com/api/?name=Eco&background=10b981&color=fff" }} style={styles.avatar} />
            </View>
            <View style={styles.identityText}>
              <Text style={styles.nameText}>{profile?.display_name || profile?.name}</Text>
              <Text style={styles.roleText}>{profile?.profession || "Eco Practitioner"}</Text>
              <View style={styles.statsRow}>
                <View style={styles.miniStat}>
                  <Text style={styles.statValue}>{profile?.followers_count || 0}</Text>
                  <Text style={styles.statLabel}>Followers</Text>
                </View>
                <View style={[styles.miniStat, { marginHorizontal: 20 }]}>
                  <Text style={styles.statValue}>{profile?.following_count || 0}</Text>
                  <Text style={styles.statLabel}>Following</Text>
                </View>
                <View style={styles.miniStat}>
                  <Text style={styles.statValue}>{profile?.reputation_score || 120}</Text>
                  <Text style={styles.statLabel}>XP</Text>
                </View>
              </View>

              {/* Edit Profile Action */}
              <TouchableOpacity style={[styles.editBtn, { backgroundColor: colors.primary }]} onPress={() => setEditModal(true)}>
                <Ionicons name="pencil" size={16} color="#fff" />
                <Text style={styles.editBtnText}>Edit Profile</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.settingsIcon} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── TAB BAR ── */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {["Vault", "History", "Impact", "Achievements"].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabItem, activeTab === tab && { borderBottomColor: colors.primary }]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, { color: activeTab === tab ? colors.primary : colors.textMuted }]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── CONTENT AREA ── */}
      <ScrollView contentContainerStyle={styles.contentScroll}>
        {activeTab === "Vault" && (
          <View style={styles.vaultSection}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Registered Pets</Text>
              <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]}>
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            {pets.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="paw-outline" size={48} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, marginTop: 10 }}>No animals in vault yet</Text>
              </View>
            ) : (
              <View style={styles.petGrid}>
                {pets.map((pet, index) => (
                  <View key={index} style={[styles.petCard, { backgroundColor: colors.bgCard }]}>
                    <Image source={{ uri: pet.image || (pet.images && pet.images[0]) }} style={styles.petThumb} />
                    <Text style={[styles.petName, { color: colors.textPrimary }]}>{pet.name}</Text>
                    <Text style={[styles.petBreed, { color: colors.textMuted }]}>{pet.breed}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {activeTab === "Impact" && (
          <View style={styles.impactSection}>
             <View style={[styles.impactCard, { backgroundColor: colors.primary }]}>
                <Text style={styles.impactTitle}>Global Carbon Offset</Text>
                <Text style={styles.impactValue}>{profile?.impact_stats?.co2Saved || "0 kg"}</Text>
                <Text style={styles.impactSub}>Verified by EcoTrack Analytics</Text>
             </View>
             <View style={[styles.impactCard, { backgroundColor: "#f59e0b", marginTop: 12 }]}>
                <Text style={styles.impactTitle}>Trees Planted</Text>
                <Text style={styles.impactValue}>{profile?.impact_stats?.treesPlanted || "0"}</Text>
                <Text style={styles.impactSub}>From ecosystem contributions</Text>
             </View>
          </View>
        )}
      </ScrollView>

      {/* ── EDIT PROFILE MODAL ── */}
      <Modal visible={editModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.bgCard }]}>
             <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Edit Welfare Profile</Text>
                <TouchableOpacity onPress={() => setEditModal(false)}>
                   <Ionicons name="close-circle" size={28} color={colors.textMuted} />
                </TouchableOpacity>
             </View>

             <ScrollView style={{ padding: 20 }}>
                {[
                  { label: "Display Name", key: "display_name" },
                  { label: "Bio", key: "bio" },
                  { label: "Profession", key: "profession" },
                  { label: "Organization", key: "organization" },
                  { label: "City", key: "city" },
                  { label: "Country", key: "country" }
                ].map((item) => (
                  <View key={item.key} style={styles.inputGroup}>
                     <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{item.label}</Text>
                     <TextInput
                        style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: isDark ? "#0f172a" : "#f8fafc" }]}
                        value={(editForm as any)[item.key]}
                        onChangeText={(v) => setEditForm({ ...editForm, [item.key]: v })}
                     />
                  </View>
                ))}

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  heroContainer: { height: 280, position: "relative" },
  heroCover: { width: "100%", height: "100%", objectFit: "cover" },
  heroOverlay: { ...StyleSheet.absoluteFillObject },
  heroContent: { position: "absolute", bottom: 20, left: 20, right: 20 },

  identityRow: { flexDirection: "row", alignItems: "center" },
  avatarBorder: { width: 90, height: 90, borderRadius: 30, borderWidth: 3, padding: 3, overflow: "hidden" },
  avatar: { width: "100%", height: "100%", borderRadius: 24 },

  identityText: { marginLeft: 16, flex: 1 },
  nameText: { fontSize: 24, fontWeight: "900", color: "#fff" },
  roleText: { color: "#10b981", fontSize: 13, fontWeight: "700", marginTop: 2 },

  statsRow: { flexDirection: "row", marginTop: 12 },
  miniStat: { alignItems: "center" },
  statValue: { color: "#fff", fontSize: 16, fontWeight: "900" },
  statLabel: { color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: "700", textTransform: "uppercase" },

  settingsIcon: { position: "absolute", top: 50, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },

  tabBar: { flexDirection: "row", paddingHorizontal: 10, borderBottomWidth: 1 },
  tabItem: { paddingVertical: 15, paddingHorizontal: 15, borderBottomWidth: 3, borderBottomColor: "transparent" },
  tabText: { fontSize: 14, fontWeight: "800" },

  contentScroll: { padding: 20 },
  vaultSection: {},
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: "900" },
  addBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },

  emptyCard: { height: 150, borderRadius: Radius.lg, borderStyle: "dashed", borderWidth: 2, borderColor: "#cbd5e1", justifyContent: "center", alignItems: "center" },

  petGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  petCard: { width: (width - 60) / 2, padding: 12, borderRadius: Radius.md, marginBottom: 15, ...Shadow.sm },
  petThumb: { width: "100%", height: 100, borderRadius: Radius.sm, marginBottom: 8 },
  petName: { fontWeight: "900", fontSize: 15 },
  petBreed: { fontSize: 11, fontWeight: "600" },

  editBtn: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginTop: 12, gap: 6 },
  editBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { borderTopLeftRadius: 30, borderTopRightRadius: 30, height: "85%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#eee" },
  modalTitle: { fontSize: 18, fontWeight: "900" },
  inputGroup: { marginBottom: 15 },
  inputLabel: { fontSize: 12, fontWeight: "800", marginBottom: 6, textTransform: "uppercase" },
  input: { height: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, fontSize: 14 },
  saveBtn: { height: 54, borderRadius: 15, justifyContent: "center", alignItems: "center", marginTop: 20 },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "900" },

  impactSection: {},
  impactCard: { padding: 25, borderRadius: Radius.lg, ...Shadow.md },
  impactTitle: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  impactValue: { color: "#fff", fontSize: 32, fontWeight: "900", marginVertical: 4 },
  impactSub: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "600" },
});
