import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, StatusBar
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../context/ThemeContext";
import { Radius, Shadow, FontSize } from "../../constants/theme";
import { API_BASE_URL } from "../../services/api";

const PRESET_SPECIES = [
  { name: "Dog", icon: "paw", breed: "German Shepherd", weight: 30, goal: "Agility & Core Fitness" },
  { name: "Human", icon: "body", breed: "Athletic", weight: 70, goal: "Muscle & Mobility" },
  { name: "Cat", icon: "fish", breed: "Persian", weight: 4.5, goal: "Joint Flexibility" },
  { name: "Horse", icon: "trophy", breed: "Marwari", weight: 450, goal: "Stamina & Gait" },
  { name: "Bird", icon: "leaf", breed: "Sun Conure", weight: 0.12, goal: "Wing Flight Strength" },
];

export default function SpeciesTrainerScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  // Form State
  const [species, setSpecies] = useState("Dog");
  const [breed, setBreed] = useState("German Shepherd");
  const [age, setAge] = useState("3");
  const [weight, setWeight] = useState("30");
  const [days, setDays] = useState("7");
  const [goal, setGoal] = useState("Agility, Muscle Strength & Joint Mobility");

  // Output & UI State
  const [loading, setLoading] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<any>(null);
  const [completedDrills, setCompletedDrills] = useState<Record<string, boolean>>({});
  const [expandedDrills, setExpandedDrills] = useState<Record<string, boolean>>({});

  const applyPreset = (preset: typeof PRESET_SPECIES[0]) => {
    setSpecies(preset.name);
    setBreed(preset.breed);
    setWeight(String(preset.weight));
    setGoal(preset.goal);
  };

  const handleGeneratePlan = async () => {
    if (!species.trim()) {
      Alert.alert("Missing Species", "Please enter the animal species name.");
      return;
    }
    if (!goal.trim()) {
      Alert.alert("Missing Goal", "Please enter a training goal.");
      return;
    }

    setLoading(true);
    setGeneratedPlan(null);

    try {
      const sessionRaw = await AsyncStorage.getItem("@ecotrack_user_session");
      const session = sessionRaw ? JSON.parse(sessionRaw) : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.token) {
        headers["Authorization"] = `Bearer ${session.token}`;
      }

      const res = await fetch(`${API_BASE_URL}/training/programs`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          species: species.trim(),
          breed: breed.trim() || undefined,
          age: age ? parseFloat(age) : undefined,
          weight: weight ? parseFloat(weight) : undefined,
          days: days ? parseInt(days, 10) : 7,
          goal: goal.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate training plan.");
      }

      const planData = data.program?.progress?.plan || data.plan;
      if (planData) {
        setGeneratedPlan(planData);
        setCompletedDrills({});
      } else {
        throw new Error("No plan data received.");
      }
    } catch {
      // Client-side tailored fallback if network is unreachable
      generateClientFallbackPlan();
    } finally {
      setLoading(false);
    }
  };

  const generateClientFallbackPlan = () => {
    const daysNum = parseInt(days, 10) || 7;
    const daysPlan = [];
    for (let i = 1; i <= daysNum; i++) {
      const isRest = i % 4 === 0;
      daysPlan.push({
        dayNum: i,
        isRest,
        diet: {
          recommendation: isRest
            ? `Anti-inflammatory recovery diet with low carbohydrate, fresh hydration & joint support supplements.`
            : `High protein, balanced lipid ratio tailored for ${species} (${weight || "standard"} kg) active training.`,
        },
        drills: isRest
          ? [
              {
                id: `rest_${i}`,
                name: "Passive Muscle Recovery & Joint Stretching",
                desc: "Gentle low-impact mobility movements to relieve synovial friction and promote recovery.",
                difficulty: "Gentle",
                reps: "15 mins",
                intensity: "Low",
                targetMuscles: "Joint Ligaments & Connective Tissue",
              },
            ]
          : [
              {
                id: `drill_${i}_1`,
                name: `${species} Dynamic Agility & Stride Coordination`,
                desc: `Form-controlled pacing focused on quadruped/bipedal gait mechanics for ${breed || species}.`,
                difficulty: "Intermediate",
                reps: "3 sets × 8 reps",
                intensity: "Moderate",
                targetMuscles: "Core, Quadriceps, Spinal Extensors",
              },
              {
                id: `drill_${i}_2`,
                name: "Postural Stability & Hind-Limb Drive",
                desc: "Isometric holds and resistance intervals to enhance balance and posture alignment.",
                difficulty: "Advanced",
                reps: "4 sets × 10 reps",
                intensity: "High",
                targetMuscles: "Hamstrings, Gluteals, Scapular Stabilizers",
              },
            ],
      });
    }

    setGeneratedPlan({
      speciesName: species,
      breedName: breed,
      goal,
      planDurationDays: daysNum,
      daysPlan,
    });
    setCompletedDrills({});
  };

  const toggleDrillComplete = (drillId: string) => {
    setCompletedDrills((prev) => ({ ...prev, [drillId]: !prev[drillId] }));
  };

  const toggleDrillExpand = (drillId: string) => {
    setExpandedDrills((prev) => ({ ...prev, [drillId]: !prev[drillId] }));
  };

  // Calculate Progress
  const totalDrills = useMemo(() => {
    if (!generatedPlan?.daysPlan) return 0;
    return generatedPlan.daysPlan.reduce((acc: number, d: any) => acc + (d.drills?.length || 0), 0);
  }, [generatedPlan]);

  const completedCount = useMemo(() => {
    return Object.values(completedDrills).filter(Boolean).length;
  }, [completedDrills]);

  const progressPercent = totalDrills > 0 ? Math.round((completedCount / totalDrills) * 100) : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <View style={styles.topHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={styles.topIconWrap}>
            <Ionicons name="barbell" size={20} color="#fff" />
          </View>
          <View>
            <Text style={styles.topTitle}>Species AI Trainer</Text>
            <Text style={styles.topSub}>Weight & Age-Scaled Regimen</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.profileHeaderBtn}
          onPress={() => router.push("/(tabs)/profile")}
          activeOpacity={0.8}
        >
          <Ionicons name="person-circle" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* FORM CARD */}
        <View style={styles.formCard}>
          <Text style={styles.cardHeaderTitle}>Generate Tailored Regimen</Text>
          <Text style={styles.cardHeaderSub}>
            Generate custom, weight & age-scaled training modules for any animal species or human fitness routine.
          </Text>

          {/* Species Presets */}
          <Text style={styles.presetLabel}>Quick Presets:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
            {PRESET_SPECIES.map((p) => (
              <TouchableOpacity
                key={p.name}
                style={[styles.presetChip, species.toLowerCase() === p.name.toLowerCase() && styles.presetChipActive]}
                onPress={() => applyPreset(p)}
              >
                <Ionicons
                  name={p.icon as any}
                  size={14}
                  color={species.toLowerCase() === p.name.toLowerCase() ? "#fff" : colors.primary}
                />
                <Text
                  style={[
                    styles.presetChipText,
                    species.toLowerCase() === p.name.toLowerCase() && styles.presetChipTextActive,
                  ]}
                >
                  {p.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Form Fields */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Animal Species Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Dog, Cat, Horse, Human"
              placeholderTextColor={colors.textMuted}
              value={species}
              onChangeText={setSpecies}
            />
          </View>

          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Breed / Variant</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. German Shepherd"
                placeholderTextColor={colors.textMuted}
                value={breed}
                onChangeText={setBreed}
              />
            </View>

            <View style={[styles.inputGroup, { width: 90 }]}>
              <Text style={styles.label}>Age (Yrs)</Text>
              <TextInput
                style={styles.input}
                placeholder="3"
                placeholderTextColor={colors.textMuted}
                value={age}
                onChangeText={setAge}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Weight (kg)</Text>
              <TextInput
                style={styles.input}
                placeholder="30"
                placeholderTextColor={colors.textMuted}
                value={weight}
                onChangeText={setWeight}
                keyboardType="numeric"
              />
            </View>

            <View style={[styles.inputGroup, { width: 120 }]}>
              <Text style={styles.label}>Plan Days</Text>
              <TextInput
                style={styles.input}
                placeholder="7"
                placeholderTextColor={colors.textMuted}
                value={days}
                onChangeText={setDays}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Training Goal *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Agility, Muscle Strength & Joint Mobility"
              placeholderTextColor={colors.textMuted}
              value={goal}
              onChangeText={setGoal}
            />
          </View>

          <TouchableOpacity
            style={styles.generateBtn}
            onPress={handleGeneratePlan}
            disabled={loading}
            activeOpacity={0.88}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="flash" size={18} color="#fff" />
                <Text style={styles.generateBtnText}>Generate AI Training Plan</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* GENERATED PLAN OUTPUT */}
        {generatedPlan && (
          <View style={styles.planContainer}>
            {/* Plan Header Card */}
            <View style={styles.planSummaryCard}>
              <View style={styles.planSummaryTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planSpeciesTitle}>
                    {generatedPlan.speciesName || species}
                    {generatedPlan.breedName ? ` • ${generatedPlan.breedName}` : ""}
                  </Text>
                  <Text style={styles.planGoalText}>{generatedPlan.goal || goal}</Text>
                </View>
                <View style={styles.planDaysBadge}>
                  <Text style={styles.planDaysBadgeText}>{generatedPlan.planDurationDays || days} Days Plan</Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressBarWrapper}>
                <View style={styles.progressInfoRow}>
                  <Text style={styles.progressLabel}>Program Completion</Text>
                  <Text style={styles.progressValText}>{progressPercent}% ({completedCount}/{totalDrills})</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
                </View>
              </View>
            </View>

            {/* Daily Schedule */}
            {generatedPlan.daysPlan?.map((day: any) => (
              <View key={`day_${day.dayNum}`} style={styles.dayCard}>
                <View style={styles.dayHeaderRow}>
                  <View style={styles.dayBadge}>
                    <Text style={styles.dayBadgeText}>Day {day.dayNum}</Text>
                  </View>
                  <Text style={[styles.dayStatusText, { color: day.isRest ? colors.secondary : colors.primary }]}>
                    {day.isRest ? "REST & RECOVERY" : "ACTIVE TRAINING"}
                  </Text>
                </View>

                {/* Nutrition Protocol Banner */}
                <View style={[styles.dietBanner, day.isRest ? styles.dietBannerRest : styles.dietBannerActive]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <Ionicons
                      name={day.isRest ? "leaf" : "restaurant"}
                      size={14}
                      color={day.isRest ? colors.secondary : colors.primary}
                    />
                    <Text
                      style={[
                        styles.dietBannerTitle,
                        { color: day.isRest ? colors.secondary : colors.primary },
                      ]}
                    >
                      {day.isRest ? "REST DAY NUTRITION" : "TRAINING DAY NUTRITION"}
                    </Text>
                  </View>
                  <Text style={styles.dietDesc}>{day.diet?.recommendation}</Text>
                </View>

                {/* Drills List */}
                {day.drills?.map((drill: any, idx: number) => {
                  const drillKey = `${day.dayNum}_${idx}`;
                  const isDone = Boolean(completedDrills[drillKey]);
                  const isExpanded = Boolean(expandedDrills[drillKey]);

                  return (
                    <View key={drillKey} style={[styles.drillCard, isDone && styles.drillCardDone]}>
                      <View style={styles.drillHeader}>
                        <TouchableOpacity
                          style={styles.checkboxTouch}
                          onPress={() => toggleDrillComplete(drillKey)}
                        >
                          <Ionicons
                            name={isDone ? "checkbox" : "square-outline"}
                            size={22}
                            color={isDone ? colors.primary : colors.textMuted}
                          />
                        </TouchableOpacity>

                        <View style={{ flex: 1 }}>
                          <Text style={[styles.drillName, isDone && styles.drillNameDone]}>
                            {drill.name}
                          </Text>
                          <Text style={styles.drillDesc}>{drill.desc}</Text>
                        </View>
                      </View>

                      {/* Drill Actions & Chips */}
                      <View style={styles.drillActionRow}>
                        <View style={styles.difficultyChip}>
                          <Text style={styles.difficultyChipText}>{drill.difficulty || "Standard"}</Text>
                        </View>

                        <TouchableOpacity
                          style={styles.poseScanBtn}
                          onPress={() =>
                            router.push({
                              pathname: "/(tabs)/aiscanner" as any,
                              params: { species, exercise: drill.name },
                            })
                          }
                        >
                          <Ionicons name="camera" size={13} color="#fff" />
                          <Text style={styles.poseScanBtnText}>AI Pose Scan</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.drillExpandBtn}
                          onPress={() => toggleDrillExpand(drillKey)}
                        >
                          <Ionicons
                            name={isExpanded ? "chevron-up" : "chevron-down"}
                            size={16}
                            color={colors.textSecondary}
                          />
                        </TouchableOpacity>
                      </View>

                      {/* Expanded Drill Details */}
                      {isExpanded && (
                        <View style={styles.drillDetailsBlock}>
                          <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>🔄 Sets / Reps:</Text>
                            <Text style={styles.detailVal}>{drill.reps || "3 sets × 8 reps"}</Text>
                          </View>
                          <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>⚡ Intensity:</Text>
                            <Text style={styles.detailVal}>{drill.intensity || "Moderate"}</Text>
                          </View>
                          <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>💪 Target Muscles:</Text>
                            <Text style={styles.detailVal}>{drill.targetMuscles || "Core & Spine"}</Text>
                          </View>
                          <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>⚠️ Biomechanics:</Text>
                            <Text style={styles.detailVal}>Keep spine neutral; avoid hyperextension.</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        )}

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
    profileHeaderBtn: {
      padding: 4,
    },
    topIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: "#8b5cf6",
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

    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
      maxWidth: 1000,
      width: "100%",
      alignSelf: "center",
    },

    formCard: {
      backgroundColor: colors.bgCard,
      borderRadius: Radius.xl,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 20,
      ...Shadow.sm,
    },
    cardHeaderTitle: {
      fontSize: FontSize.lg,
      fontWeight: "900",
      color: colors.textPrimary,
      marginBottom: 4,
    },
    cardHeaderSub: {
      fontSize: FontSize.xs,
      color: colors.textSecondary,
      lineHeight: 18,
      marginBottom: 16,
    },

    presetLabel: {
      fontSize: 11,
      fontWeight: "800",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 8,
    },
    presetScroll: {
      flexDirection: "row",
      marginBottom: 16,
    },
    presetChip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: Radius.full,
      marginRight: 8,
      gap: 5,
      borderWidth: 1,
      borderColor: colors.border,
    },
    presetChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    presetChipText: {
      fontSize: FontSize.xs,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    presetChipTextActive: {
      color: "#fff",
    },

    inputGroup: {
      marginBottom: 14,
    },
    inputRow: {
      flexDirection: "row",
      gap: 12,
    },
    label: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.textPrimary,
      marginBottom: 6,
    },
    input: {
      backgroundColor: isDark ? "#0f172a" : "#f8fafc",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.md,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: FontSize.sm,
      color: colors.textPrimary,
    },

    generateBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: Radius.md,
      gap: 8,
      marginTop: 8,
      ...Shadow.sm,
    },
    generateBtnText: {
      color: "#fff",
      fontSize: FontSize.md,
      fontWeight: "800",
    },

    planContainer: {
      gap: 16,
      marginBottom: 20,
    },
    planSummaryCard: {
      backgroundColor: colors.bgCard,
      borderRadius: Radius.xl,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      ...Shadow.sm,
    },
    planSummaryTop: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    planSpeciesTitle: {
      fontSize: FontSize.xl,
      fontWeight: "900",
      color: colors.primary,
      marginBottom: 4,
    },
    planGoalText: {
      fontSize: FontSize.xs,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    planDaysBadge: {
      backgroundColor: isDark ? "#064e3b" : "#dcfce7",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: Radius.full,
    },
    planDaysBadgeText: {
      color: colors.primary,
      fontWeight: "800",
      fontSize: 11,
    },

    progressBarWrapper: {
      backgroundColor: isDark ? "#0f172a" : "#f8fafc",
      padding: 12,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    progressInfoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    progressLabel: {
      fontSize: FontSize.xs,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    progressValText: {
      fontSize: FontSize.xs,
      fontWeight: "800",
      color: colors.primary,
    },
    progressTrack: {
      height: 8,
      backgroundColor: isDark ? "#1e293b" : "#e2e8f0",
      borderRadius: 4,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      backgroundColor: colors.primary,
      borderRadius: 4,
    },

    dayCard: {
      backgroundColor: colors.bgCard,
      borderRadius: Radius.xl,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      ...Shadow.sm,
    },
    dayHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    dayBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: Radius.full,
    },
    dayBadgeText: {
      color: "#fff",
      fontSize: 12,
      fontWeight: "800",
    },
    dayStatusText: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.8,
    },

    dietBanner: {
      padding: 12,
      borderRadius: Radius.md,
      marginBottom: 12,
      borderWidth: 1,
    },
    dietBannerActive: {
      backgroundColor: isDark ? "#064e3b22" : "#f0fdf4",
      borderColor: isDark ? "#065f46" : "#bbf7d0",
    },
    dietBannerRest: {
      backgroundColor: isDark ? "#0c4a6e22" : "#f0f9ff",
      borderColor: isDark ? "#0369a1" : "#bae6fd",
    },
    dietBannerTitle: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    dietDesc: {
      fontSize: FontSize.xs,
      color: colors.textPrimary,
      lineHeight: 18,
      fontWeight: "500",
    },

    drillCard: {
      backgroundColor: isDark ? "#0f172a" : "#f8fafc",
      borderRadius: Radius.lg,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
    },
    drillCardDone: {
      opacity: 0.65,
    },
    drillHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      marginBottom: 10,
    },
    checkboxTouch: {
      paddingTop: 2,
    },
    drillName: {
      fontSize: FontSize.sm,
      fontWeight: "800",
      color: colors.textPrimary,
      marginBottom: 2,
    },
    drillNameDone: {
      textDecorationLine: "line-through",
      color: colors.textMuted,
    },
    drillDesc: {
      fontSize: FontSize.xs,
      color: colors.textSecondary,
      lineHeight: 17,
    },

    drillActionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    difficultyChip: {
      backgroundColor: isDark ? "#1e293b" : "#e2e8f0",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: Radius.full,
    },
    difficultyChipText: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    poseScanBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: Radius.full,
      gap: 4,
    },
    poseScanBtnText: {
      color: "#fff",
      fontSize: 11,
      fontWeight: "700",
    },
    drillExpandBtn: {
      padding: 4,
    },

    drillDetailsBlock: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 6,
    },
    detailItem: {
      flexDirection: "row",
      gap: 6,
    },
    detailLabel: {
      fontSize: FontSize.xs,
      fontWeight: "700",
      color: colors.textSecondary,
      width: 120,
    },
    detailVal: {
      flex: 1,
      fontSize: FontSize.xs,
      fontWeight: "600",
      color: colors.textPrimary,
    },
  });
}
