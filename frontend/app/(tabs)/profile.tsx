import React, { useState, useEffect, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  Alert, TextInput, Modal, Switch, StatusBar, Dimensions, ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../context/ThemeContext";
import { Radius, Shadow, FontSize } from "@/constants/theme";
import { router } from "expo-router";
import { getTrainingAnalytics, TrainingAnalyticsState, MotionAnalysisResult } from "@/data/trainingAnalyticsStore";

const { width } = Dimensions.get("window");
const API_BASE = "http://localhost:5000/api";

type PetProfile = {
  id: number; name: string; species: string;
  breed: string; age: string; weight: string; image: string; isPrimary?: boolean;
};

type UserSession = {
  user_id: string; email: string; name: string; avatar?: string; token?: string;
};

export default function ProfileScreen() {
  const { colors, toggleTheme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState("Eco Explorer");
  const [bio, setBio] = useState("Nature enthusiast • Wildlife Photographer • Conservationist");
  const [location, setLocation] = useState("India");
  const [avatar, setAvatar] = useState("https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200");
  const [stats, setStats] = useState({ rescues: 0, xp: 0, plans: 0 });
  const [analyticsState, setAnalyticsState] = useState<TrainingAnalyticsState | null>(null);

  const [editModal, setEditModal] = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);

  const [pets, setPets] = useState<PetProfile[]>([]);
  const [addPetModal, setAddPetModal] = useState(false);
  const [petName, setPetName] = useState("");
  const [petSpecies, setPetSpecies] = useState("");
  const [petBreed, setPetBreed] = useState("");
  const [petAge, setPetAge] = useState("");
  const [petWeight, setPetWeight] = useState("");
  const [petImage, setPetImage] = useState<string | null>(null);

  // ── LOAD PROFILE FROM BACKEND ──
  useEffect(() => {
    loadProfile();
    getTrainingAnalytics().then(setAnalyticsState);
  }, []);

  const loadProfile = async () => {
    try {
      const raw = await AsyncStorage.getItem("@ecotrack_user_session");
      if (!raw) { router.replace("/auth/login"); return; }
      const sess: UserSession = JSON.parse(raw);
      setSession(sess);

      // Load from backend
      const res = await fetch(`${API_BASE}/users/${sess.user_id}`);
      if (res.ok) {
        const data = await res.json();
        setUsername(data.name || sess.name || "Eco Explorer");
        setBio(data.bio || "Nature enthusiast • Wildlife Photographer");
        setLocation(data.location || "India");
        setAvatar(data.avatar || sess.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200");
        setStats(data.stats || { rescues: 0, xp: 0, plans: 0 });
        setPets(data.pets || []);
      } else {
        // Use session data as fallback
        setUsername(sess.name || "Eco Explorer");
        setAvatar(sess.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200");
      }
    } catch (e) {
      // Offline — load from AsyncStorage cache
      const raw = await AsyncStorage.getItem("@ecotrack_user_session");
      if (raw) {
        const sess: UserSession = JSON.parse(raw);
        setSession(sess);
        setUsername(sess.name || "Eco Explorer");
        setAvatar(sess.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!session) return;
    try {
      await fetch(`${API_BASE}/users/${session.user_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: username, bio, location, avatar }),
      });
      // Update session cache
      const updatedSession = { ...session, name: username, avatar };
      await AsyncStorage.setItem("@ecotrack_user_session", JSON.stringify(updatedSession));
      setSession(updatedSession);
    } catch (e) {
      console.warn("Profile save offline — cached locally");
    }
    setEditModal(false);
    Alert.alert("✅ Saved", "Profile updated successfully!");
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout", style: "destructive", onPress: async () => {
          await AsyncStorage.removeItem("@ecotrack_user_session");
          await AsyncStorage.removeItem("@ecotrack_user_id");
          router.replace("/auth/login");
        }
      }
    ]);
  };

  const pickPetImage = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8,
    });
    if (!r.canceled) setPetImage(r.assets[0].uri);
  };

  const handleAddPet = async () => {
    if (!petName.trim() || !petSpecies.trim()) {
      Alert.alert("Required", "Please enter pet name and species."); return;
    }
    const petData = {
      name: petName, species: petSpecies,
      breed: petBreed || "Standard Breed",
      age: petAge || "1 Year",
      weight: petWeight || "10 kg",
      image: petImage || "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=300",
      isPrimary: pets.length === 0,
    };
    try {
      if (session) {
        const res = await fetch(`${API_BASE}/users/${session.user_id}/pets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(petData),
        });
        const data = await res.json();
        if (data.pet) {
          setPets(prev => [data.pet, ...prev]);
          Alert.alert("🐾 Added!", `${data.pet.name} has been added to your vault.`);
        }
      }
    } catch {
      // Offline fallback
      const newPet: PetProfile = { id: Date.now(), ...petData };
      setPets(prev => [newPet, ...prev]);
      Alert.alert("🐾 Added!", `${petData.name} has been added (offline).`);
    }
    setPetName(""); setPetSpecies(""); setPetBreed(""); setPetAge(""); setPetWeight(""); setPetImage(null);
    setAddPetModal(false);
  };

  const handleRemovePet = (petId: number, petName: string) => {
    Alert.alert("Remove Pet", `Remove ${petName} from your vault?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive", onPress: async () => {
          try {
            if (session) {
              await fetch(`${API_BASE}/users/${session.user_id}/pets/${petId}`, { method: "DELETE" });
            }
          } catch { /* offline */ }
          setPets(prev => prev.filter(p => p.id !== petId));
        }
      }
    ]);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center", backgroundColor: colors.bgLight }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textMuted, marginTop: 12, fontSize: 14 }}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bgLight }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Cover */}
        <View style={styles.headerArea}>
          <Image source={{ uri: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800" }} style={styles.coverImg} />
          <LinearGradient colors={["transparent", "rgba(0,0,0,0.85)"]} style={styles.coverGradient} />
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.actionIcon} onPress={() => setSettingsModal(true)}>
              <Ionicons name="settings-outline" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionIcon} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Identity */}
        <View style={styles.profileSummary}>
          <View style={styles.avatarWrapper}>
            <Image source={{ uri: avatar }} style={[styles.avatar, { borderColor: colors.bgCard }]} />
            <View style={[styles.statusDot, { borderColor: colors.bgCard }]} />
          </View>

          <View style={styles.nameRow}>
            <Text style={[styles.username, { color: colors.textPrimary }]}>{username}</Text>
            <View style={styles.proBadge}>
              <Text style={styles.proText}>PRO</Text>
            </View>
          </View>
          <Text style={[styles.bioText, { color: colors.textSecondary }]}>{bio}</Text>
          {location ? (
            <View style={styles.locationRow}>
              <Ionicons name="location" size={14} color={colors.primary} />
              <Text style={[styles.locationText, { color: colors.primary }]}>{location}</Text>
            </View>
          ) : null}

          {/* Core Stats */}
          <View style={[styles.mainStatsRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.mainStat}>
              <Text style={[styles.statVal, { color: colors.textPrimary }]}>{stats.rescues}</Text>
              <Text style={[styles.statLab, { color: colors.textMuted }]}>Rescues</Text>
            </View>
            <View style={[styles.mainStat, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border }]}>
              <Text style={[styles.statVal, { color: colors.textPrimary }]}>{stats.xp}</Text>
              <Text style={[styles.statLab, { color: colors.textMuted }]}>XP</Text>
            </View>
            <View style={styles.mainStat}>
              <Text style={[styles.statVal, { color: colors.textPrimary }]}>{stats.plans}</Text>
              <Text style={[styles.statLab, { color: colors.textMuted }]}>Plans</Text>
            </View>
          </View>

          <TouchableOpacity style={[styles.editBtn, { backgroundColor: colors.primary }]} onPress={() => setEditModal(true)}>
            <Ionicons name="create-outline" size={18} color="#fff" />
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>

          {/* Email badge */}
          {session?.email ? (
            <View style={[styles.emailBadge, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Ionicons name="mail-outline" size={14} color={colors.textMuted} />
              <Text style={[styles.emailText, { color: colors.textMuted }]}>{session.email}</Text>
            </View>
          ) : null}
        </View>

        {/* ENVIRONMENTAL IMPACT */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>🌍 Environmental Impact</Text>
          <View style={[styles.impactCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.impactGrid}>
              {[
                { icon: "leaf", color: "#16a34a", bg: "#dcfce7", val: "840kg", lab: "CO2 Saved" },
                { icon: "sunny", color: "#d97706", bg: "#fef3c7", val: "12", lab: "Trees Planted" },
                { icon: "water", color: "#0284c7", bg: "#e0f2fe", val: "2.5k L", lab: "Water Saved" },
              ].map((item) => (
                <View key={item.lab} style={styles.impactItem}>
                  <View style={[styles.impactIcon, { backgroundColor: item.bg }]}>
                    <Ionicons name={item.icon as any} size={20} color={item.color} />
                  </View>
                  <Text style={[styles.impactVal, { color: colors.textPrimary }]}>{item.val}</Text>
                  <Text style={[styles.impactLab, { color: colors.textSecondary }]}>{item.lab}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* PET VAULT */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>🐾 Animal & Pet Vault</Text>
            <TouchableOpacity onPress={() => setAddPetModal(true)}>
              <Text style={[styles.viewAllText, { color: colors.primary }]}>+ Add New</Text>
            </TouchableOpacity>
          </View>

          {pets.length === 0 ? (
            <View style={[styles.emptyPets, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={{ fontSize: 32 }}>🐾</Text>
              <Text style={[{ color: colors.textMuted, marginTop: 8, fontSize: 14, fontWeight: "600" }]}>No pets added yet</Text>
              <TouchableOpacity style={[styles.addPetBtn, { backgroundColor: colors.primary }]} onPress={() => setAddPetModal(true)}>
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>Add Your First Pet</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
              {pets.map((pet) => (
                <TouchableOpacity
                  key={pet.id}
                  style={[styles.petCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                  onLongPress={() => handleRemovePet(pet.id, pet.name)}
                >
                  <Image source={{ uri: pet.image }} style={styles.petAvatar} />
                  <View style={styles.petInfo}>
                    <Text style={[styles.petNameText, { color: colors.textPrimary }]}>{pet.name}</Text>
                    <Text style={[styles.petSpeciesText, { color: colors.textSecondary }]}>{pet.breed}</Text>
                    <View style={[styles.tag, { backgroundColor: isDark ? "#1e293b" : "#f1f5f9" }]}>
                      <Text style={[styles.tagText, { color: colors.textSecondary }]}>{pet.age} • {pet.weight}</Text>
                    </View>
                  </View>
                  {pet.isPrimary && (
                    <View style={[styles.primaryBadge, { backgroundColor: colors.primary }]}>
                      <Ionicons name="star" size={10} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>


        {/* ACHIEVEMENTS */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>🏆 Milestones & Achievements</Text>
          <View style={styles.badgeRow}>
            {[
              { id: 1, icon: "shield-checkmark", color: "#16a34a", label: "Guardian" },
              { id: 2, icon: "flame", color: "#f97316", label: "Active" },
              { id: 3, icon: "ribbon", color: "#8b5cf6", label: "Specialist" },
              { id: 4, icon: "planet", color: "#0ea5e9", label: "Global" },
            ].map((b) => (
              <View key={b.id} style={styles.badgeBox}>
                <View style={[styles.badgeIconBox, { backgroundColor: isDark ? colors.bgCard : "#f8fafc", borderColor: colors.border }]}>
                  <Ionicons name={b.icon as any} size={28} color={b.color} />
                </View>
                <Text style={[styles.badgeLabel, { color: colors.textSecondary }]}>{b.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* EDIT PROFILE MODAL */}
      <Modal visible={editModal} animationType="slide" transparent onRequestClose={() => setEditModal(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bgCard }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>✏️ Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditModal(false)}>
                <Ionicons name="close-circle" size={26} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: colors.textSecondary }]}>Display Name</Text>
            <TextInput style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: isDark ? "#0f172a" : "#f9fafb" }]} value={username} onChangeText={setUsername} />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Bio</Text>
            <TextInput style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: isDark ? "#0f172a" : "#f9fafb" }]} value={bio} onChangeText={setBio} multiline />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Location</Text>
            <TextInput style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: isDark ? "#0f172a" : "#f9fafb" }]} value={location} onChangeText={setLocation} />

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={saveProfile}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ADD PET MODAL */}
      <Modal visible={addPetModal} animationType="slide" transparent onRequestClose={() => setAddPetModal(false)}>
        <View style={styles.modalBg}>
          <ScrollView>
            <View style={[styles.modalCard, { backgroundColor: colors.bgCard, marginTop: 60 }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>🐾 Add New Pet</Text>
                <TouchableOpacity onPress={() => setAddPetModal(false)}>
                  <Ionicons name="close-circle" size={26} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {petImage ? (
                <TouchableOpacity onPress={pickPetImage} style={styles.previewBox}>
                  <Image source={{ uri: petImage }} style={{ width: "100%", height: "100%", borderRadius: Radius.md }} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.uploadBox, { borderColor: colors.primary }]} onPress={pickPetImage}>
                  <Ionicons name="camera" size={32} color={colors.primary} />
                  <Text style={[styles.uploadText, { color: colors.primary }]}>Upload Pet Photo</Text>
                </TouchableOpacity>
              )}

              {[
                { label: "Pet Name *", value: petName, setter: setPetName, placeholder: "e.g. Max" },
                { label: "Species *", value: petSpecies, setter: setPetSpecies, placeholder: "e.g. Dog, Cat, Parrot" },
                { label: "Breed", value: petBreed, setter: setPetBreed, placeholder: "e.g. German Shepherd" },
                { label: "Age", value: petAge, setter: setPetAge, placeholder: "e.g. 2 Years" },
                { label: "Weight", value: petWeight, setter: setPetWeight, placeholder: "e.g. 25 kg" },
              ].map(({ label, value, setter, placeholder }) => (
                <View key={label}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
                  <TextInput
                    style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: isDark ? "#0f172a" : "#f9fafb" }]}
                    value={value} onChangeText={setter} placeholder={placeholder} placeholderTextColor={colors.textMuted}
                  />
                </View>
              ))}

              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleAddPet}>
                <Text style={styles.saveBtnText}>Save Pet Profile</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* SETTINGS MODAL */}
      <Modal visible={settingsModal} animationType="slide" transparent onRequestClose={() => setSettingsModal(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bgCard }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>⚙️ App Settings</Text>
              <TouchableOpacity onPress={() => setSettingsModal(false)}>
                <Ionicons name="close-circle" size={26} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.settingRow}>
              <View>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Dark Mode</Text>
                <Text style={[styles.settingSub, { color: colors.textMuted }]}>Switch app color theme</Text>
              </View>
              <Switch value={isDark} onValueChange={toggleTheme} trackColor={{ false: "#d1d5db", true: colors.primary }} />
            </View>

            <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
              <View>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Account</Text>
                <Text style={[styles.settingSub, { color: colors.textMuted }]}>{session?.email}</Text>
              </View>
              <Ionicons name="person-circle-outline" size={28} color={colors.primary} />
            </View>

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={() => setSettingsModal(false)}>
              <Text style={styles.saveBtnText}>Close Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1 },
    headerArea: { height: 200, position: "relative" },
    coverImg: { width: "100%", height: "100%" },
    coverGradient: { ...StyleSheet.absoluteFillObject },
    headerActions: { position: "absolute", top: 54, right: 20, flexDirection: "row", gap: 12 },
    actionIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },

    profileSummary: { alignItems: "center", marginTop: -55, paddingHorizontal: 25 },
    avatarWrapper: { position: "relative", ...Shadow.md },
    avatar: { width: 110, height: 110, borderRadius: 55, borderWidth: 4 },
    statusDot: { position: "absolute", bottom: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: "#22c55e", borderWidth: 3 },
    nameRow: { flexDirection: "row", alignItems: "center", marginTop: 16, gap: 10 },
    username: { fontSize: FontSize.xxl, fontWeight: "800" },
    proBadge: { backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    proText: { color: "#fff", fontSize: 10, fontWeight: "900" },
    bioText: { fontSize: FontSize.sm, textAlign: "center", marginTop: 8, lineHeight: 20 },
    locationRow: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 4 },
    locationText: { fontSize: FontSize.xs, fontWeight: "700" },
    emailBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginTop: 10 },
    emailText: { fontSize: 12, fontWeight: "600" },

    mainStatsRow: { flexDirection: "row", width: "100%", borderRadius: Radius.lg, marginTop: 22, paddingVertical: 16, borderWidth: 1, ...Shadow.sm },
    mainStat: { flex: 1, alignItems: "center" },
    statVal: { fontSize: FontSize.lg, fontWeight: "800" },
    statLab: { fontSize: 10, marginTop: 2, fontWeight: "600" },
    editBtn: { width: "100%", height: 52, borderRadius: Radius.md, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 18, ...Shadow.sm },
    editBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.sm },

    section: { marginTop: 28, paddingHorizontal: 20 },
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
    sectionTitle: { fontSize: FontSize.md, fontWeight: "800" },
    viewAllText: { fontSize: FontSize.xs, fontWeight: "700" },

    impactCard: { padding: 20, borderRadius: Radius.lg, borderWidth: 1, ...Shadow.sm },
    impactGrid: { flexDirection: "row", justifyContent: "space-between" },
    impactItem: { alignItems: "center", width: (width - 100) / 3 },
    impactIcon: { width: 46, height: 46, borderRadius: 23, justifyContent: "center", alignItems: "center", marginBottom: 8 },
    impactVal: { fontSize: FontSize.md, fontWeight: "800" },
    impactLab: { fontSize: 9, fontWeight: "600", marginTop: 2, textAlign: "center" },

    emptyPets: { padding: 28, borderRadius: Radius.lg, borderWidth: 1, alignItems: "center", ...Shadow.sm },
    addPetBtn: { marginTop: 14, paddingHorizontal: 20, paddingVertical: 10, borderRadius: Radius.md },

    petCard: { width: 220, flexDirection: "row", padding: 14, borderRadius: Radius.lg, borderWidth: 1, marginRight: 14, alignItems: "center", ...Shadow.sm },
    petAvatar: { width: 60, height: 60, borderRadius: 30 },
    petInfo: { flex: 1, marginLeft: 12 },
    petNameText: { fontSize: FontSize.sm, fontWeight: "800" },
    petSpeciesText: { fontSize: 10, marginTop: 2 },
    tag: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, marginTop: 6 },
    tagText: { fontSize: 9, fontWeight: "700" },
    primaryBadge: { position: "absolute", top: 10, right: 10, width: 22, height: 22, borderRadius: 11, justifyContent: "center", alignItems: "center" },

    badgeRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
    badgeBox: { alignItems: "center" },
    badgeIconBox: { width: 68, height: 68, borderRadius: 34, justifyContent: "center", alignItems: "center", borderWidth: 1, ...Shadow.sm },
    badgeLabel: { fontSize: 11, fontWeight: "700", marginTop: 8 },

    modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
    modalCard: { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: 28, maxHeight: "92%" },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 22 },
    modalTitle: { fontSize: FontSize.lg, fontWeight: "800" },
    label: { fontSize: FontSize.xs, fontWeight: "700", marginTop: 16, marginBottom: 8 },
    input: { height: 52, borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: 15, fontSize: FontSize.sm },
    saveBtn: { height: 56, borderRadius: Radius.lg, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 28 },
    saveBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.md },
    uploadBox: { height: 100, borderRadius: Radius.md, borderStyle: "dashed", borderWidth: 2, justifyContent: "center", alignItems: "center", gap: 8 },
    uploadText: { fontSize: FontSize.xs, fontWeight: "700" },
    previewBox: { height: 130, borderRadius: Radius.md, overflow: "hidden", marginBottom: 12 },
    settingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    settingLabel: { fontSize: FontSize.sm, fontWeight: "700" },
    settingSub: { fontSize: FontSize.xs, marginTop: 2 },
  });
}
