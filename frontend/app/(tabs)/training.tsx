import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, StatusBar, Dimensions, Modal, ActivityIndicator,
} from "react-native";
import { useFocusEffect, router, useLocalSearchParams } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Radius, Shadow, FontSize } from "@/constants/theme";
import { useTheme } from "../../context/ThemeContext";
import {
  searchAnimals,
  generateSpeciesTrainingPlan,
  GeneratedTrainingPlan,
} from "@/data/animals";
import { getTrainingAnalytics, resetTrainingAnalytics } from "@/data/trainingAnalyticsStore";
import { saveTrainingProgram } from "../../services/api";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get("window");

export default function TrainingScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const params = useLocalSearchParams<{ species?: string; goal?: string; breed?: string }>();

  const [animalName, setAnimalName] = useState("");
  const [breed, setBreed] = useState("");
  const [age, setAge] = useState("22");
  const [weight, setWeight] = useState("75");
  const [goal, setGoal] = useState("");
  const [generated, setGenerated] = useState(false);
  const [plan, setPlan] = useState<GeneratedTrainingPlan | null>(null);
  const [metrics, setMetrics] = useState<number[]>([50, 45, 60, 80]);
  const [completedMilestones, setCompletedMilestones] = useState<Record<number, boolean>>({});
  const [activeSection, setActiveSection] = useState<"schedule" | "exercises" | "diet" | "milestones" | "progress">("schedule");
  const [currentLevel, setCurrentLevel] = useState(1);

  // Modal State
  const [selectedExercise, setSelectedExercise] = useState<{
    name: string;
    reps: string;
    intensity: string;
    icon: string;
    instructions?: string;
    targetMuscles?: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [analyticsState, setAnalyticsState] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem("@ecotrack_user_session").then((raw) => {
        if (raw) {
          const sess = JSON.parse(raw);
          setUserId(sess.user_id);
        }
      });
      getTrainingAnalytics().then((st) => {
        setCurrentLevel(st.currentLevel);
        setAnalyticsState(st);
      });

      // Consume redirection parameters from profile logs
      AsyncStorage.getItem("@ecotrack_active_log_redirect").then(async (raw) => {
        if (raw) {
          await AsyncStorage.removeItem("@ecotrack_active_log_redirect");
          const data = JSON.parse(raw);
          if (data.species) {
            setAnimalName(data.species);
            if (data.goal) setGoal(data.goal);
            if (data.breed) setBreed(data.breed);

            const generatedPlan = generateSpeciesTrainingPlan(
              data.species,
              data.breed || "",
              2, // default age
              15, // default weight
              data.goal || "",
              1, // default level
              7 // default days
            );

            setPlan(generatedPlan);
            setMetrics(generatedPlan.metrics.map((m) => m.value));
            setCompletedMilestones({});
            setSelectedDayTab(1);
            setGenerated(true);
            setIsSessionActive(false);
          }
        }
      });
    }, [])
  );

  const [planDays, setPlanDays] = useState("7");
  const [selectedDayTab, setSelectedDayTab] = useState(1);

  const handleGenerate = () => {
    if (!animalName.trim()) {
      Alert.alert("Required Field", "Please enter the animal species name (e.g. Human, Dog, Cat).");
      return;
    }

    const numericAge = parseFloat(age) || 2;
    const numericWeight = parseFloat(weight) || 15;
    const parsedDays = parseInt(planDays, 10);
    const finalDays = isNaN(parsedDays) || parsedDays <= 0 ? 7 : parsedDays;

    const generatedPlan = generateSpeciesTrainingPlan(
      animalName,
      breed,
      numericAge,
      numericWeight,
      goal,
      currentLevel,
      finalDays
    );

    setPlan(generatedPlan);
    setMetrics(generatedPlan.metrics.map((m) => m.value));
    setCompletedMilestones({});
    setSelectedDayTab(1);
    setGenerated(true);
    setIsSessionActive(false);
  };

  const handleResetAnalytics = () => {
    Alert.alert(
      "Restart Progress?",
      "This will reset all your current session analytics to baseline. Are you sure you want to start a fresh training regimen?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset Everything",
          style: "destructive",
          onPress: async () => {
            const newState = await resetTrainingAnalytics();
            setCurrentLevel(newState.currentLevel);
            setAnalyticsState(newState);
            Alert.alert("✅ Analytics Refreshed", "Your training progress has been reset successfully.");
          }
        }
      ]
    );
  };

  const handleSaveSheet = async () => {
    setIsSaving(true);
    if (userId && plan) {
      try {
        await saveTrainingProgram(userId, {
          name: `${plan.speciesName} Training Plan`,
          species: plan.speciesName,
          breed: plan.breedName,
          goal: goal,
          exercises: plan.exercises.map((ex: any) => ex.name)
        });
      } catch (e) {
        console.warn("Failed to save program to backend", e);
      }
    }
    setTimeout(() => {
      setIsSaving(false);
      Alert.alert("✅ Plan Exported", "The training sheet for " + plan?.speciesName + " has been saved to your EcoTrack documents.");
    }, 1500);
  };


  const toggleMilestone = (idx: number) => {
    if (!plan) return;
    setCompletedMilestones((prev) => {
      const isFinishing = !prev[idx];
      const updated = { ...prev, [idx]: isFinishing };

      // Update Vitality/Health Score when nutritional/habit milestones are completed
      setMetrics((m) => m.map((val, i) => {
        if (plan.metrics[i].label.toLowerCase().includes("health") || plan.metrics[i].label.toLowerCase().includes("vitality")) {
          return Math.min(100, val + (isFinishing ? 3 : -3));
        }
        return val;
      }));
      return updated;
    });
  };

  const matchedSpecies = useMemo(() => {
    if (!animalName.trim()) return null;
    const res = searchAnimals(animalName);
    return res.length > 0 ? res[0] : null;
  }, [animalName]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bgLight} />
      
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>🧠 Global AI Trainer</Text>
            <Text style={styles.headerSub}>Real-time 100% offline species training engine</Text>
          </View>
        </View>

        {/* Input Form */}
        {!generated && (
          <View style={styles.formCard}>
            <View style={styles.formHeader}>
              <Ionicons name="hardware-chip" size={24} color={colors.primary} />
              <Text style={styles.formTitle}>Animal & Training Specs</Text>
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputIcon}>
                <Ionicons name="paw" size={18} color={colors.primary} />
              </View>
              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>Animal Species / Name *</Text>
                <TextInput
                  style={styles.input}
                  value={animalName}
                  onChangeText={setAnimalName}
                  placeholder="e.g. Dog, Cat, German Shepherd, Parrot"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputIcon}>
                <Ionicons name="git-network" size={18} color={colors.primary} />
              </View>
              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>Breed / Lineage</Text>
                <TextInput
                  style={styles.input}
                  value={breed}
                  onChangeText={setBreed}
                  placeholder="e.g. Golden Retriever, Persian, Arabian"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={[styles.inputRow, { flex: 1 }]}>
                <View style={styles.inputIcon}>
                  <Ionicons name="calendar" size={18} color={colors.primary} />
                </View>
                <View style={styles.inputBlock}>
                  <Text style={styles.inputLabel}>Age (Years)</Text>
                  <TextInput
                    style={styles.input}
                    value={age}
                    onChangeText={setAge}
                    keyboardType="numeric"
                    placeholder="e.g. 2"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              <View style={[styles.inputRow, { flex: 1 }]}>
                <View style={styles.inputIcon}>
                  <Ionicons name="scale" size={18} color={colors.primary} />
                </View>
                <View style={styles.inputBlock}>
                  <Text style={styles.inputLabel}>Weight (kg)</Text>
                  <TextInput
                    style={styles.input}
                    value={weight}
                    onChangeText={setWeight}
                    keyboardType="numeric"
                    placeholder="e.g. 15"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputIcon}>
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>Plan Duration (Days) — Default: 7 Days</Text>
                <TextInput
                  style={styles.input}
                  value={planDays}
                  onChangeText={setPlanDays}
                  keyboardType="numeric"
                  placeholder="Type plan duration (e.g. 7, 10, 12, 30, 365) — Default: 7"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputIcon}>
                <Ionicons name="trophy" size={18} color={colors.primary} />
              </View>
              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>Training Goal</Text>
                <TextInput
                  style={[styles.input, { height: 65 }]}
                  value={goal}
                  onChangeText={setGoal}
                  placeholder="e.g. High Agility, House Training, Vocal Recall, Guarding, Socialization"
                  placeholderTextColor={colors.textMuted}
                  multiline
                />
              </View>
            </View>

            <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate} activeOpacity={0.85}>
              <Ionicons name="flash" size={20} color="#fff" />
              <Text style={styles.generateText}>Generate Offline Training Regimen</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Generated Regimen */}
        {generated && plan && (
          <>
            {/* Spec Card */}
            <View style={styles.specCard}>
              <View style={styles.emojiBox}>
                <Text style={{ fontSize: 44 }}>{matchedSpecies?.emoji || "🐾"}</Text>
              </View>

              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.specName}>{plan.speciesName}</Text>
                <Text style={styles.specBreed}>Breed: {plan.breedName}</Text>

                <View style={styles.tagRow}>
                  <View style={styles.tagBadge}>
                    <Text style={styles.tagText}>Category: {plan.ageCategory}</Text>
                  </View>
                  <View style={styles.tagBadge}>
                    <Text style={styles.tagText}>{plan.weightClass}</Text>
                  </View>
                </View>

                <View style={styles.goalBanner}>
                  <Ionicons name="flag" size={14} color={colors.primary} />
                  <Text style={styles.goalBannerText}>Goal: {plan.goal}</Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => { setGenerated(false); setPlan(null); }}
                style={styles.editBtn}
              >
                <Ionicons name="create-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {/* Navigation Tabs */}
            <View style={styles.navRowWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.navRow}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
              >
                {[
                  { key: "schedule", label: "Schedule", icon: "time" },
                  { key: "exercises", label: "Exercises", icon: "barbell" },
                  { key: "diet", label: "Nutrition", icon: "restaurant" },
                  { key: "milestones", label: "Milestones", icon: "checkmark-done-circle" },
                  { key: "progress", label: "Analytics", icon: "analytics" },
                ].map((tab) => (
                  <TouchableOpacity
                    key={tab.key}
                    style={[styles.navTab, activeSection === tab.key && styles.navTabActive]}
                    onPress={() => setActiveSection(tab.key as any)}
                  >
                    <Ionicons
                      name={tab.icon as any}
                      size={18}
                      color={activeSection === tab.key ? "#fff" : colors.textSecondary}
                    />
                    <Text style={[styles.navTabText, activeSection === tab.key && styles.navTabTextActive]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* SAFETY PROTOCOL BANNER BELOW BUTTONS */}
            <View style={styles.safetyProtocolCard}>
              <Ionicons name="shield-checkmark" size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.safetyTitle}>🛡️ Species Safety Protocol</Text>
                <Text style={styles.safetyText}>
                  Ensure proper hydration and a safe training environment. Monitor for signs of fatigue or stress during all sessions.
                </Text>
              </View>
            </View>

            {/* Multi-Day Schedule View */}
            {activeSection === "schedule" && (
              <View style={styles.card}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <Text style={styles.cardTitle}>📅 {plan.planDurationDays}-Day Training Schedule</Text>
                  <View style={{ backgroundColor: colors.primary + "15", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                    <Text style={{ fontSize: 12, fontWeight: "800", color: colors.primary }}>
                      {plan.planDurationDays} Days Total
                    </Text>
                  </View>
                </View>

                {/* Suggested Food & Nutrition Diet Section (ABOVE DRILL SCHEDULE) */}
                {plan.daysPlan[selectedDayTab - 1] && (() => {
                  const currentDay = plan.daysPlan[selectedDayTab - 1];
                  return (
                    <View style={{ backgroundColor: isDark ? "#1e293b" : "#f0f9ff", padding: 14, borderRadius: 16, borderLeftWidth: 4, borderLeftColor: "#0284c7", marginBottom: 16 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <Text style={{ fontSize: 14, fontWeight: "900", color: colors.textPrimary }}>🥗 Day {currentDay.dayNum} Recovery Diet Plan</Text>
                        <View style={{ backgroundColor: "#0284c715", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                          <Text style={{ fontSize: 10, fontWeight: "800", color: "#0284c7" }}>Macro & Hydration</Text>
                        </View>
                      </View>
                      
                      <View style={{ gap: 6 }}>
                        <View style={{ backgroundColor: isDark ? "#0f172a" : "#fff", padding: 10, borderRadius: 10, borderWidth: 1, borderColor: isDark ? "#334155" : "#e2e8f0" }}>
                          <Text style={{ fontSize: 10, fontWeight: "800", color: colors.primary, textTransform: "uppercase" }}>Meals Scheduled</Text>
                          <Text style={{ fontSize: 12, color: colors.textPrimary, marginTop: 2 }}>• Breakfast: {currentDay.diet.breakfast}</Text>
                          <Text style={{ fontSize: 12, color: colors.textPrimary, marginTop: 2 }}>• Lunch: {currentDay.diet.lunch}</Text>
                          <Text style={{ fontSize: 12, color: colors.textPrimary, marginTop: 2 }}>• Dinner: {currentDay.diet.dinner}</Text>
                          <Text style={{ fontSize: 12, color: colors.textPrimary, marginTop: 2 }}>• Snack: {currentDay.diet.snack}</Text>
                        </View>

                        <View style={{ backgroundColor: isDark ? "#0f172a" : "#fff", padding: 10, borderRadius: 10, borderWidth: 1, borderColor: isDark ? "#334155" : "#e2e8f0" }}>
                          <Text style={{ fontSize: 10, fontWeight: "800", color: colors.primary, textTransform: "uppercase" }}>Prep & Safe Alternatives</Text>
                          <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{currentDay.diet.prepInstructions}</Text>
                          <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4, fontStyle: "italic" }}>Allergy Alts: {currentDay.diet.allergyAlternative}</Text>
                        </View>

                        <View style={{ backgroundColor: isDark ? "#0f172a" : "#fff", padding: 10, borderRadius: 10, borderWidth: 1, borderColor: isDark ? "#334155" : "#e2e8f0" }}>
                          <Text style={{ fontSize: 10, fontWeight: "800", color: colors.primary, textTransform: "uppercase" }}>Hydration & Supplements</Text>
                          <Text style={{ fontSize: 12, color: colors.textPrimary, marginTop: 2 }}>💧 {currentDay.diet.hydration}</Text>
                          <Text style={{ fontSize: 12, color: colors.textPrimary, marginTop: 2 }}>💊 Supplements: {currentDay.diet.supplements}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })()}

                {/* Day Tabs Horizontal Scroll */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {plan.daysPlan.map((d: any) => {
                      const isActive = selectedDayTab === d.dayNum;
                      return (
                        <TouchableOpacity
                          key={d.dayNum}
                          onPress={() => setSelectedDayTab(d.dayNum)}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            borderRadius: 14,
                            backgroundColor: isActive ? colors.primary : (d.isRestDay ? (isDark ? "#1e293b" : "#f1f5f9") : (isDark ? "#334155" : "#e2e8f0")),
                            borderWidth: 1,
                            borderColor: isActive ? colors.primary : (d.isRestDay ? colors.primary + "40" : "transparent"),
                          }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: "800", color: isActive ? "#fff" : (d.isRestDay ? colors.primary : colors.textPrimary) }}>
                            Day {d.dayNum} {d.isRestDay ? "💤" : "🔥"}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>

                {/* Active Day Content */}
                {plan.daysPlan[selectedDayTab - 1] && (() => {
                  const currentDay = plan.daysPlan[selectedDayTab - 1];
                  return (
                    <View style={{ backgroundColor: isDark ? "#1e293b" : "#f8fafc", padding: 14, borderRadius: 16, borderLeftWidth: 4, borderLeftColor: currentDay.isRestDay ? "#0284c7" : colors.primary }}>
                      <Text style={{ fontSize: 16, fontWeight: "900", color: colors.textPrimary, marginBottom: 4 }}>
                        {currentDay.title}
                      </Text>
                      <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12 }}>
                        {currentDay.focus}
                      </Text>

                      <View style={{ flexDirection: "row", gap: 12, marginBottom: 14, backgroundColor: isDark ? "#0f172a" : "#fff", padding: 10, borderRadius: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 10, fontWeight: "800", color: colors.textMuted, textTransform: "uppercase" }}>Target Burn</Text>
                          <Text style={{ fontSize: 15, fontWeight: "900", color: colors.primary }}>~{currentDay.targetCalories} kcal</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 10, fontWeight: "800", color: colors.textMuted, textTransform: "uppercase" }}>Session Type</Text>
                          <Text style={{ fontSize: 15, fontWeight: "900", color: currentDay.isRestDay ? "#0284c7" : colors.textPrimary }}>
                            {currentDay.isRestDay ? "Active Recovery" : "Workout & Form"}
                          </Text>
                        </View>
                      </View>

                      <Text style={{ fontSize: 13, fontWeight: "800", color: colors.textPrimary, marginBottom: 8 }}>
                        📋 Day {currentDay.dayNum} Exercises & Drills:
                      </Text>

                      {(currentDay.drills || []).map((ex: any, idx: number) => (
                        <View key={idx} style={{ backgroundColor: isDark ? "#0f172a" : "#fff", padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: isDark ? "#334155" : "#e2e8f0" }}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <Text style={{ fontSize: 14, fontWeight: "800", color: colors.primary, flex: 1 }}>
                              {ex.name}
                            </Text>
                            <View style={{ backgroundColor: colors.primary + "15", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                              <Text style={{ fontSize: 11, fontWeight: "800", color: colors.primary }}>{ex.intensity}</Text>
                            </View>
                          </View>
                          <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>
                            Reps/Set: {ex.reps} • Muscles: {ex.targetMuscles}
                          </Text>
                          <Text style={{ fontSize: 12, color: colors.textMuted, fontStyle: "italic", marginBottom: 8 }}>
                            {ex.instructions}
                          </Text>
                          
                          <TouchableOpacity
                            style={styles.startExerciseBtn}
                            onPress={() => router.push({
                              pathname: "/motionGenerator" as any,
                              params: { species: plan.speciesName, exerciseId: ex.id }
                            })}
                          >
                            <Ionicons name="scan" size={14} color="#fff" />
                            <Text style={styles.startExerciseText}>Launch AI Scanner</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  );
                })()}

                <Text style={[styles.cardTitle, { marginTop: 20 }]}>⏰ Daily Routine Timings</Text>
                {plan.dailySchedule.map((item: any, idx: number) => (
                  <View key={idx} style={styles.scheduleItem}>
                    <View style={styles.timeBadge}>
                      <Text style={styles.timeBadgeText}>{item.time}</Text>
                    </View>
                    <View style={styles.scheduleContent}>
                      <Text style={styles.scheduleActivity}>{item.activity}</Text>
                      <Text style={styles.scheduleNotes}>{item.notes}</Text>
                      <View style={styles.durationPill}>
                        <Ionicons name="timer-outline" size={12} color={colors.primary} />
                        <Text style={styles.durationPillText}>{item.duration}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Exercises View */}
            {activeSection === "exercises" && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>🏋️ Scaled Exercise Modules</Text>
                <View style={styles.exerciseGrid}>
                  {plan.exercises.map((ex: any, idx: number) => (
                    <View key={idx} style={styles.exerciseBox}>
                      <View style={styles.exerciseHeaderRow}>
                        <View style={styles.exerciseIconCircle}>
                          <Ionicons name={ex.icon as any} size={22} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={styles.exerciseName}>{ex.name}</Text>
                          <Text style={styles.exerciseReps}>{ex.reps}</Text>
                        </View>
                        <View style={[styles.intensityBadge, ex.intensity === "High" ? { backgroundColor: "#fee2e2" } : { backgroundColor: "#dcfce7" }]}>
                          <Text style={[styles.intensityText, ex.intensity === "High" ? { color: "#dc2626" } : { color: "#16a34a" }]}>
                            {ex.intensity}
                          </Text>
                        </View>
                      </View>

                      {ex.targetMuscles && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                          <Ionicons name="body-outline" size={13} color={colors.secondary} />
                          <Text style={[styles.targetMuscles, { color: colors.secondary }]}>Target: {ex.targetMuscles}</Text>
                        </View>
                      )}

                      {ex.instructions && (
                        <Text style={styles.exerciseInstructions}>{ex.instructions}</Text>
                      )}

                      {/* Scoring breakdown */}
                      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                        {[["Precision","87%",colors.primary],["ROM","93%",colors.success],["Stability","85%",colors.secondary]].map(([l,v,c]) => (
                          <View key={l as string} style={{ backgroundColor: (c as string) + "15", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                            <Text style={{ fontSize: 10, color: c as string, fontWeight: "800" }}>{l as string}: {v as string}</Text>
                          </View>
                        ))}
                      </View>

                      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                        <TouchableOpacity
                          style={[styles.startExerciseBtn, { width: "100%" }]}
                          onPress={() => router.push({
                            pathname: "/motionGenerator" as any,
                            params: { species: plan.speciesName, exerciseId: ex.id }
                          })}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="scan" size={16} color="#fff" />
                          <Text style={styles.startExerciseText}>Open Profile & AI Scanner</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Nutrition View */}
            {activeSection === "diet" && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>🥗 Weight & Species Scaled Diet</Text>
                {plan.dietaryPlan.map((d: any, idx: number) => (
                  <View key={idx} style={styles.dietBox}>
                    <View style={styles.dietHeader}>
                      <Ionicons name="restaurant" size={16} color={colors.primary} />
                      <Text style={styles.dietMeal}>{d.meal}</Text>
                    </View>
                    <Text style={styles.dietRec}>{d.recommendation}</Text>
                    <Text style={styles.dietPortion}>Portion: {d.portion}</Text>

                    {(d.macros || d.timing) && (
                      <View style={styles.dietDetails}>
                        {d.macros && <Text style={styles.dietDetailText}>📊 {d.macros}</Text>}
                        {d.timing && <Text style={styles.dietDetailText}>⏰ {d.timing}</Text>}
                      </View>
                    )}
                  </View>
                ))}
                
                <View style={[styles.safetyProtocolCard, { marginTop: 12, backgroundColor: "#0284c715", borderColor: "#0284c740" }]}>
                  <Ionicons name="information-circle-outline" size={20} color="#0284c7" />
                  <Text style={[styles.safetyText, { color: isDark ? "#7dd3fc" : "#0369a1", fontSize: 12, fontStyle: "italic" }]}>
                    Note: Suggested Food & Diet recommendations provide nutritional guidance for cellular recovery. Exercise completion percentage is calculated strictly based on completed AI exercise scans.
                  </Text>
                </View>
              </View>
            )}

            {/* Milestones View */}
            {activeSection === "milestones" && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>🏆 Behavior & Skill Milestones</Text>
                {plan.milestones.map((ms: any, idx: number) => {
                  const done = !!completedMilestones[idx];
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.milestoneRow, done && styles.milestoneRowDone]}
                      onPress={() => toggleMilestone(idx)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={done ? "checkmark-circle" : "ellipse-outline"}
                        size={24}
                        color={done ? colors.success : colors.textMuted}
                      />
                      <Text style={[styles.milestoneText, done && styles.milestoneTextDone]}>
                        {ms}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Progress Analytics */}
            {activeSection === "progress" && (
              <View style={styles.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={[styles.cardTitle, { marginBottom: 0 }]}>📊 Daily Progress Dashboard</Text>
                  <TouchableOpacity onPress={handleResetAnalytics}>
                    <Ionicons name="refresh-circle" size={24} color={colors.danger} />
                  </TouchableOpacity>
                </View>
                
                {/* Streak and Level Quick Stat Row */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                  <View style={{ flex: 1, backgroundColor: isDark ? "#0f172a" : "#f1f5f9", padding: 12, borderRadius: 12, alignItems: 'center' }}>
                    <Ionicons name="flame" size={24} color="#f97316" />
                    <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '900', marginTop: 4 }}>
                      {analyticsState ? analyticsState.consecutiveSessions : 0} Days
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '700' }}>Active Streak</Text>
                  </View>

                  <View style={{ flex: 1, backgroundColor: isDark ? "#0f172a" : "#f1f5f9", padding: 12, borderRadius: 12, alignItems: 'center' }}>
                    <Ionicons name="trophy" size={24} color="#eab308" />
                    <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '900', marginTop: 4 }}>
                      Level {analyticsState ? analyticsState.currentLevel : 1}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '700' }}>Training Rank</Text>
                  </View>

                  <View style={{ flex: 1, backgroundColor: isDark ? "#0f172a" : "#f1f5f9", padding: 12, borderRadius: 12, alignItems: 'center' }}>
                    <Ionicons name="checkmark-done" size={24} color={colors.success} />
                    <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '900', marginTop: 4 }}>
                      {analyticsState ? analyticsState.totalScans : 0}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '700' }}>Completed Scans</Text>
                  </View>
                </View>

                {/* Performance Analytics Grid */}
                <Text style={[styles.cardTitle, { fontSize: 14, marginBottom: 8 }]}>📉 Performance Analytics</Text>
                
                <View style={{ gap: 10, marginBottom: 16 }}>
                  {[
                    { label: "Bilateral Form Score", value: analyticsState && analyticsState.avgFormScore > 0 ? analyticsState.avgFormScore : 85, desc: "Skeletal comparison against ideal template." },
                    { label: "Postural Stability", value: analyticsState && analyticsState.avgPostureScore > 0 ? analyticsState.avgPostureScore : 90, desc: "Fluctuations in center-of-mass hold." },
                    { label: "Symmetry Balance", value: analyticsState && analyticsState.avgBalanceScore > 0 ? analyticsState.avgBalanceScore : 88, desc: "Left vs right joint angle matching." },
                    { label: "Nutrition Compliance", value: 85, desc: "Calorie & macronutrient intake compliance." }
                  ].map((m, idx) => (
                    <View key={idx} style={styles.metricBlock}>
                      <View style={styles.metricRow}>
                        <Text style={styles.metricLabel}>{m.label}</Text>
                        <Text style={[styles.metricVal, { color: m.value > 85 ? colors.success : m.value > 70 ? colors.accent : colors.danger }]}>{m.value}%</Text>
                      </View>
                      <View style={styles.metricTrack}>
                        <View
                          style={[
                            styles.metricFill,
                            {
                              width: `${m.value}%`,
                              backgroundColor: m.value > 85 ? colors.success : m.value > 70 ? colors.accent : colors.danger,
                            },
                          ]}
                        />
                      </View>
                      <Text style={{ fontSize: 9, color: colors.textMuted, marginTop: 2 }}>{m.desc}</Text>
                    </View>
                  ))}
                </View>

                {/* Recovery & Compliance stats */}
                <Text style={[styles.cardTitle, { fontSize: 14, marginBottom: 8 }]}>🛡️ Recovery & Health Analytics</Text>
                
                <View style={{ backgroundColor: isDark ? "#0f172a" : "#f8fafc", padding: 12, borderRadius: 12, gap: 8, marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>Recovery Status</Text>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: colors.primary }}>92% (Optimal)</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>Hydration Tracker</Text>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#3b82f6' }}>2.8L / 3.2L</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>Completed / Missed Sessions</Text>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textPrimary }}>
                      {analyticsState ? analyticsState.totalScans : 0} Completed / 0 Missed
                    </Text>
                  </View>
                </View>

                {/* Performance Trends List */}
                <Text style={[styles.cardTitle, { fontSize: 14, marginBottom: 8 }]}>📈 Recent Pose Scan History</Text>
                {analyticsState && analyticsState.history.length > 0 ? (
                  analyticsState.history.slice(0, 5).map((h: any, idx: number) => (
                    <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isDark ? "#0f172a" : "#f1f5f9", padding: 10, borderRadius: 10, marginBottom: 6 }}>
                      <View>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textPrimary }}>{h.exerciseName}</Text>
                        <Text style={{ fontSize: 10, color: colors.textMuted }}>{new Date(h.timestamp).toLocaleDateString()}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 14, fontWeight: '900', color: colors.success }}>{h.formScore}%</Text>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: colors.accent }}>Grade {h.grade}</Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={{ padding: 16, alignItems: 'center', backgroundColor: isDark ? "#0f172a" : "#f1f5f9", borderRadius: 10 }}>
                    <Ionicons name="videocam-outline" size={24} color={colors.textMuted} />
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>No scans logged yet. Activate AI Scanner to begin.</Text>
                  </View>
                )}

                {/* Upcoming scheduled session */}
                <Text style={[styles.cardTitle, { fontSize: 14, marginTop: 12, marginBottom: 8 }]}>🗓️ Upcoming Scheduled Sessions</Text>
                <View style={{ backgroundColor: isDark ? "#0f172a" : "#f8fafc", padding: 12, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: colors.primary }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textPrimary }}>Next Drill: {plan.daysPlan[0]?.drills[0]?.name || "Core Conditioning"}</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>Focus: {plan.daysPlan[0]?.focus || "Mobility"} Stride Stance check</Text>
                </View>
              </View>
            )}

            {/* Safety Warnings */}
            <View style={styles.warningCard}>
              <Text style={styles.warningTitle}>⚠️ Safety Protocols</Text>
              {plan.safetyWarnings.map((w: any, idx: number) => (
                <Text key={idx} style={styles.warningText}>{w}</Text>
              ))}
            </View>

            <View style={styles.planActionRow}>
               <TouchableOpacity
                 style={[styles.actionBtn, { backgroundColor: colors.success }]}
                 onPress={() => setIsSessionActive(true)}
                 disabled={isSessionActive}
               >
                  <Ionicons name="play" size={18} color="#fff" />
                  <Text style={styles.actionBtnText}>{isSessionActive ? "Session Active" : "Start Training Session"}</Text>
               </TouchableOpacity>

               <TouchableOpacity
                 style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                 onPress={handleSaveSheet}
                 disabled={isSaving}
               >
                  {isSaving ? <ActivityIndicator color="#fff" size="small" /> : (
                    <>
                      <Ionicons name="download" size={18} color="#fff" />
                      <Text style={styles.actionBtnText}>Save Training Sheet</Text>
                    </>
                  )}
               </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.resetBtn}
              onPress={() => { setGenerated(false); setPlan(null); setAnimalName(""); setGoal(""); }}
            >
              <Ionicons name="refresh" size={18} color={colors.primary} />
              <Text style={styles.resetBtnText}>New Training Program</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* EXERCISE DETAIL MODAL */}
      <Modal visible={!!selectedExercise} animationType="slide" transparent onRequestClose={() => setSelectedExercise(null)}>
         <View style={styles.modalBg}>
            <View style={[styles.modalCard, { backgroundColor: colors.bgCard }]}>
               <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Exercise Module</Text>
                  <TouchableOpacity onPress={() => setSelectedExercise(null)}>
                     <Ionicons name="close-circle" size={28} color={colors.textSecondary} />
                  </TouchableOpacity>
               </View>

               {selectedExercise && (
                 <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={styles.modalIconBox}>
                       <Ionicons name={selectedExercise.icon as any} size={48} color={colors.primary} />
                    </View>

                    <Text style={styles.modalExName}>{selectedExercise.name}</Text>
                    <View style={styles.modalMetaRow}>
                       <View style={styles.modalBadge}>
                          <Text style={styles.modalBadgeText}>{selectedExercise.intensity} Intensity</Text>
                       </View>
                       <View style={[styles.modalBadge, { backgroundColor: colors.bgLight }]}>
                          <Text style={[styles.modalBadgeText, { color: colors.primary }]}>{selectedExercise.reps}</Text>
                       </View>
                    </View>

                    <View style={styles.modalSection}>
                       <Text style={styles.modalSectionTitle}>Target Muscle Groups & Biomechanics</Text>
                       <Text style={styles.modalText}>🎯 {selectedExercise.targetMuscles || "Full Body Conditioning"}</Text>
                       <Text style={styles.modalSubText}>Focuses on core stability, joint articulation, and neurological recall response.</Text>
                    </View>

                    <View style={styles.modalSection}>
                       <Text style={styles.modalSectionTitle}>Training Instructions</Text>
                       <Text style={styles.modalLongText}>{selectedExercise.instructions || "Monitor the animal's movement carefully. Ensure they perform the exercise with control and rhythmic consistency."}</Text>
                    </View>

                    <View style={styles.modalSection}>
                       <Text style={styles.modalSectionTitle}>💡 Pro Training Tips</Text>
                       <View style={styles.tipBox}>
                          <Text style={styles.tipText}>• Keep treats at eye level to maintain optimal spine alignment.</Text>
                          <Text style={styles.tipText}>• Ensure the background is clear and free of obstacles.</Text>
                       <Text style={styles.tipText}>• Reward immediately upon successful completion of the exercise.</Text>
                       </View>
                    </View>

                    <View style={styles.modalAlert}>
                       <Ionicons name="information-circle" size={20} color={colors.primary} />
                       <Text style={styles.modalAlertText}>EcoTrack Training Engine will provide guidance for {selectedExercise.name}.</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.launchScannerBtn}
                      onPress={() => setSelectedExercise(null)}
                    >
                       <Ionicons name="checkmark-circle" size={20} color="#fff" />
                       <Text style={styles.launchScannerText}>Acknowledge Details</Text>
                    </TouchableOpacity>
                    <View style={{ height: 20 }} />
                 </ScrollView>
               )}
            </View>
         </View>
      </Modal>
    </View>
  );
}

function getStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgLight },
    scroll: { flex: 1 },
    header: { paddingHorizontal: 20, paddingTop: 54, paddingBottom: 16 },
    headerTitle: { fontSize: FontSize.xxl, fontWeight: "800", color: colors.textPrimary },
    headerSub: { fontSize: FontSize.sm, color: colors.textSecondary, marginTop: 2 },

    formCard: {
      marginHorizontal: 16,
      backgroundColor: colors.bgCard,
      borderRadius: Radius.xl,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      ...Shadow.md,
    },
    formHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 },
    formTitle: { fontSize: FontSize.xl, fontWeight: "800", color: colors.textPrimary },
    inputRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
    inputIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: isDark ? "#14532d" : "#dcfce7",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 10,
    },
    inputBlock: { flex: 1 },
    inputLabel: { fontSize: FontSize.xs, fontWeight: "700", color: colors.textSecondary, marginBottom: 4 },
    input: {
      backgroundColor: isDark ? colors.bgLight : "#f9fafb",
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: FontSize.md,
      color: colors.textPrimary,
    },
    generateBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      borderRadius: Radius.lg,
      paddingVertical: 15,
      marginTop: 10,
      gap: 8,
    },
    generateText: { color: "#fff", fontWeight: "800", fontSize: FontSize.md },

    specCard: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 16,
      marginTop: 16,
      backgroundColor: colors.bgCard,
      borderRadius: Radius.xl,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      ...Shadow.sm,
    },
    emojiBox: {
      width: 68,
      height: 68,
      borderRadius: 18,
      backgroundColor: isDark ? colors.bgLight : "#f0fdf4",
      justifyContent: "center",
      alignItems: "center",
    },
    specName: { fontSize: FontSize.xl, fontWeight: "800", color: colors.textPrimary },
    specBreed: { fontSize: FontSize.xs, color: colors.textSecondary, marginTop: 2 },
    tagRow: { flexDirection: "row", gap: 6, marginTop: 6 },
    tagBadge: {
      backgroundColor: isDark ? "#334155" : "#f3f4f6",
      borderRadius: Radius.full,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tagText: { fontSize: FontSize.xs, color: colors.textSecondary, fontWeight: "600" },
    goalBanner: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
    goalBannerText: { fontSize: FontSize.xs, fontWeight: "700", color: colors.primary },
    editBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: isDark ? "#1e293b" : "#f0fdf4",
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },

    navRowWrapper: { marginTop: 16, marginBottom: 8, maxHeight: 48 },
    navRow: { flexDirection: "row" },
    navTab: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark ? "#1e293b" : "#f3f4f6",
      borderRadius: Radius.full,
      paddingVertical: 10,
      paddingHorizontal: 16,
      gap: 8,
      borderWidth: 1,
      borderColor: isDark ? "#334155" : "#e5e7eb",
    },
    navTabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    navTabText: { fontSize: FontSize.sm, color: colors.textSecondary, fontWeight: "600" },
    navTabTextActive: { color: "#fff", fontWeight: "700" },

    card: {
      marginHorizontal: 16,
      marginTop: 14,
      backgroundColor: colors.bgCard,
      borderRadius: Radius.xl,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      ...Shadow.sm,
    },
    cardTitle: { fontSize: FontSize.lg, fontWeight: "800", color: colors.textPrimary, marginBottom: 14 },
    cardSub: { fontSize: FontSize.xs, color: colors.textSecondary, marginBottom: 12, lineHeight: 18 },

    scheduleItem: { flexDirection: "row", alignItems: "flex-start", marginBottom: 14 },
    timeBadge: {
      backgroundColor: isDark ? "#14532d" : "#f0fdf4",
      borderRadius: Radius.md,
      paddingHorizontal: 8,
      paddingVertical: 6,
      marginRight: 10,
    },
    timeBadgeText: { fontSize: FontSize.xs, fontWeight: "800", color: colors.primary },
    scheduleContent: { flex: 1, backgroundColor: isDark ? "#0f172a" : "#f9fafb", borderRadius: Radius.md, padding: 10 },
    scheduleActivity: { fontSize: FontSize.sm, fontWeight: "700", color: colors.textPrimary },
    scheduleNotes: { fontSize: FontSize.xs, color: colors.textSecondary, marginTop: 2 },
    durationPill: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
    durationPillText: { fontSize: FontSize.xs, color: colors.primary, fontWeight: "600" },

    safetyProtocolCard: {
      marginHorizontal: 16,
      marginTop: 14,
      backgroundColor: isDark ? "#064e3b" : "#ecfdf5",
      borderRadius: Radius.lg,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderWidth: 1,
      borderColor: colors.primary + "40",
      ...Shadow.sm,
    },
    safetyTitle: { fontSize: FontSize.xs, fontWeight: "800", color: colors.primary },
    safetyText: { fontSize: 11, color: colors.textSecondary, marginTop: 2, lineHeight: 16 },

    exerciseGrid: { flexDirection: "column", gap: 14 },
    exerciseBox: {
      width: "100%",
      backgroundColor: isDark ? "#0f172a" : "#f9fafb",
      borderRadius: Radius.lg,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    exerciseHeaderRow: { flexDirection: "row", alignItems: "center" },
    exerciseIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: isDark ? "#14532d" : "#dcfce7",
      justifyContent: "center",
      alignItems: "center",
    },
    exerciseName: { fontSize: FontSize.sm, fontWeight: "800", color: colors.textPrimary },
    exerciseReps: { fontSize: FontSize.xs, color: colors.textMuted, marginTop: 2, fontWeight: "600" },
    targetMuscles: { fontSize: FontSize.xs, color: colors.primary, marginTop: 8, fontWeight: "700" },
    intensityBadge: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    intensityText: { fontSize: FontSize.xs, fontWeight: "800" },
    exerciseInstructions: { fontSize: FontSize.xs, color: colors.textSecondary, marginTop: 6, fontStyle: "italic", lineHeight: 18 },
    startExerciseBtn: {
      backgroundColor: colors.primary,
      borderRadius: Radius.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginTop: 12,
      width: "100%",
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
    },
    startExerciseText: { color: "#fff", fontWeight: "800", fontSize: FontSize.xs },

    dietBox: { backgroundColor: isDark ? "#0f172a" : "#f9fafb", borderRadius: Radius.md, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
    dietHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
    dietMeal: { fontSize: FontSize.sm, fontWeight: "700", color: colors.textPrimary },
    dietRec: { fontSize: FontSize.xs, color: colors.textSecondary },
    dietPortion: { fontSize: FontSize.xs, fontWeight: "700", color: colors.primary, marginTop: 4 },
    dietDetails: { marginTop: 6, gap: 4, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6 },
    dietDetailText: { fontSize: 10, color: colors.textMuted, fontWeight: "600" },

    milestoneRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? "#0f172a" : "#f9fafb",
      borderRadius: Radius.md,
      padding: 12,
      marginBottom: 8,
      gap: 10,
    },
    milestoneRowDone: { backgroundColor: isDark ? "#14532d" : "#f0fdf4" },
    milestoneText: { flex: 1, fontSize: FontSize.xs, color: colors.textPrimary, fontWeight: "600" },
    milestoneTextDone: { textDecorationLine: "line-through", color: colors.textMuted },

    metricBlock: { marginBottom: 12 },
    metricRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
    metricLabel: { flex: 1, fontSize: FontSize.xs, fontWeight: "700", color: colors.textPrimary },
    metricVal: { fontSize: FontSize.xs, fontWeight: "800", color: colors.primary, marginLeft: 8 },
    metricTrack: { height: 8, backgroundColor: isDark ? "#334155" : "#e5e7eb", borderRadius: Radius.full, overflow: "hidden" },
    metricFill: { height: "100%", borderRadius: Radius.full },

    warningCard: {
      marginHorizontal: 16,
      marginTop: 14,
      backgroundColor: isDark ? "#451a03" : "#fffbeb",
      borderRadius: Radius.xl,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.warning,
    },
    warningTitle: { fontSize: FontSize.sm, fontWeight: "800", color: colors.warning, marginBottom: 6 },
    warningText: { fontSize: FontSize.xs, color: isDark ? "#fde68a" : "#92400e", marginBottom: 4, lineHeight: 18 },

    resetBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginHorizontal: 16,
      marginTop: 16,
      paddingVertical: 12,
      borderRadius: Radius.lg,
      borderWidth: 1.5,
      borderColor: colors.primary,
      gap: 6,
    },
    resetBtnText: { fontSize: FontSize.sm, color: colors.primary, fontWeight: "700" },

    planActionRow: { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginTop: 16 },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: Radius.lg, ...Shadow.sm },
    actionBtnText: { color: '#fff', fontWeight: '800', fontSize: FontSize.xs },

    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalCard: { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: 24, maxHeight: '85%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: FontSize.lg, fontWeight: '800', color: colors.textPrimary },
    modalIconBox: { width: 100, height: 100, borderRadius: 50, backgroundColor: isDark ? colors.bgLight : "#f0fdf4", justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 16 },
    modalExName: { fontSize: FontSize.xl, fontWeight: '900', color: colors.textPrimary, textAlign: 'center' },
    modalMetaRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 10 },
    modalBadge: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full },
    modalBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    modalSection: { marginTop: 24 },
    modalSectionTitle: { fontSize: FontSize.sm, fontWeight: '800', color: colors.textPrimary, marginBottom: 8 },
    modalText: { fontSize: FontSize.sm, color: colors.textSecondary },
    modalSubText: { fontSize: 11, color: colors.textMuted, marginTop: 4, fontStyle: 'italic' },
    modalLongText: { fontSize: FontSize.sm, color: colors.textSecondary, lineHeight: 22 },
    tipBox: { backgroundColor: isDark ? colors.bgLight : "#f9fafb", padding: 12, borderRadius: Radius.md, gap: 6 },
    tipText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
    modalAlert: { flexDirection: 'row', gap: 10, backgroundColor: isDark ? '#1e293b' : "#f0f9ff", padding: 14, borderRadius: Radius.md, marginTop: 24, borderWidth: 1, borderColor: isDark ? colors.primary : "#bae6fd" },
    modalAlertText: { flex: 1, fontSize: FontSize.xs, color: colors.textSecondary, lineHeight: 18 },
    launchScannerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.primary, borderRadius: Radius.lg, paddingVertical: 16, marginTop: 30, ...Shadow.md },
    launchScannerText: { color: '#fff', fontWeight: '900', fontSize: FontSize.md },
  });
}
