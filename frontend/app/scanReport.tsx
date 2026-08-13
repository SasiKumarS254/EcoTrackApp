import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Animated, SafeAreaView, StatusBar, Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import type { DetailedScanReport } from '../lib/reportGenerator';
import type { JointBiomechanicsResult } from '../lib/jointAnalysis';
import { getSeverityLabel } from '../lib/jointAnalysis';
import { createCommunityPost, STORAGE_KEYS } from '../services/api';

const { width: SW } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// Radial Progress Gauge
// ─────────────────────────────────────────────────────────────────────────────

function RadialGauge({
  score,
  size = 130,
  strokeWidth = 10,
  grade,
  gradeColor,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
  grade: string;
  gradeColor: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const offset = circumference - progress;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <Svg width={size} height={size}>
      <Circle
        cx={cx} cy={cy} r={radius}
        fill="none" stroke="rgba(255,255,255,0.1)"
        strokeWidth={strokeWidth}
      />
      <Circle
        cx={cx} cy={cy} r={radius}
        fill="none" stroke={gradeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${circumference}`}
        strokeDashoffset={`${offset}`}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <SvgText x={cx} y={cy - 10} textAnchor="middle" fontSize="28" fontWeight="900" fill="#ffffff">{score}</SvgText>
      <SvgText x={cx} y={cy + 12} textAnchor="middle" fontSize="12" fontWeight="700" fill="rgba(255,255,255,0.6)">/100</SvgText>
      <SvgText x={cx} y={cy + 30} textAnchor="middle" fontSize="20" fontWeight="900" fill={gradeColor}>{grade}</SvgText>
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Score Card Component
// ─────────────────────────────────────────────────────────────────────────────

function ScoreCard({ label, value, icon, color, isDark }: { label: string; value: number; icon: string; color: string; isDark: boolean }) {
  const barBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  return (
    <View style={[sc.card, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}>
      <View style={sc.iconRow}>
        <Ionicons name={icon as any} size={18} color={color} />
        <Text style={[sc.val, { color }]}>{value}<Text style={sc.pct}>%</Text></Text>
      </View>
      <Text style={[sc.label, { color: isDark ? '#94a3b8' : '#6b7280' }]} numberOfLines={1}>{label}</Text>
      <View style={[sc.barBg, { backgroundColor: barBg }]}>
        <View style={[sc.barFill, { width: `${Math.min(100, value)}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const sc = StyleSheet.create({
  card: { flex: 1, borderRadius: 14, padding: 12, minWidth: (SW - 56) / 2 - 4, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  iconRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  val: { fontSize: 22, fontWeight: '900' },
  pct: { fontSize: 12, fontWeight: '600' },
  label: { fontSize: 10, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  barBg: { height: 4, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main Report Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function ScanReportScreen() {
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams();

  const report: DetailedScanReport | null = useMemo(() => {
    try {
      const raw = params.data || params.report;
      return raw ? JSON.parse(raw as string) : null;
    } catch { return null; }
  }, [params.data, params.report]);

  const [activeTab, setActiveTab] = useState<'overview' | 'joints' | 'recs' | 'rehab'>('overview');
  const [isSharing, setIsSharing] = useState(false);

  const gradeColor = useMemo(() => {
    if (!report) return '#6b7280';
    const s = report.overallPerformanceScore;
    if (s >= 90) return '#10b981';
    if (s >= 75) return '#22c55e';
    if (s >= 60) return '#f59e0b';
    return '#ef4444';
  }, [report]);

  const handleShare = async () => {
    if (!report) return;
    setIsSharing(true);
    try {
      const sess = await AsyncStorage.getItem(STORAGE_KEYS.SESSION);
      const userId = sess ? JSON.parse(sess).id : 'anon';
      const content = `📊 My EcoTrack AI Scan Result for ${report.detectedSpecies}: Scored ${report.overallPerformanceScore}% (${report.grade}) in ${report.exerciseName}! 🧬 #AnimalWelfare #AIScanner`;
      await createCommunityPost({ content, user_id: userId, post_type: 'scanner' });
      Alert.alert("Shared!", "Your results have been posted to the EcoTrack community feed.");
    } catch (e) {
      Alert.alert("Error", "Could not share results.");
    } finally {
      setIsSharing(false);
    }
  };

  if (!report) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const bg = isDark ? '#020617' : '#f8fafc';
  const cardBg = isDark ? '#0f172a' : '#ffffff';
  const textPrimary = isDark ? '#f8fafc' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const borderColor = isDark ? '#1e293b' : '#e2e8f0';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* ── HEADER ── */}
      <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.headerTitle, { color: textPrimary }]}>AI Biomechanical Report</Text>
          <Text style={[styles.headerSub, { color: textMuted }]}>{report.scanId}</Text>
        </View>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} disabled={isSharing}>
          {isSharing ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="share-social" size={20} color={colors.primary} />}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── PERFORMANCE HERO ── */}
        <LinearGradient colors={isDark ? ["#064e3b", "#065f46"] : ["#10b981", "#059669"]} style={styles.heroCard}>
          <View style={styles.heroMain}>
            <RadialGauge score={report.overallPerformanceScore} grade={report.grade} gradeColor="#fff" />
            <View style={styles.heroInfo}>
              <Text style={styles.heroSpecies}>{report.detectedSpecies}</Text>
              <Text style={styles.heroExercise}>{report.exerciseName}</Text>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>{report.analysisSource === 'backend_ai' ? 'Verified AI Inference' : 'Legacy Analysis'}</Text>
              </View>
              <Text style={styles.heroDesc}>{report.gradeDescription}</Text>
            </View>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.hStat}>
              <Text style={styles.hStatVal}>{report.repCount}</Text>
              <Text style={styles.hStatLab}>REPS</Text>
            </View>
            <View style={styles.hStatDivider} />
            <View style={styles.hStat}>
              <Text style={styles.hStatVal}>{report.exerciseDurationSec}s</Text>
              <Text style={styles.hStatLab}>TIME</Text>
            </View>
            <View style={styles.hStatDivider} />
            <View style={styles.hStat}>
              <Text style={styles.hStatVal}>~{report.estimatedCalories}</Text>
              <Text style={styles.hStatLab}>KCAL</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── TAB NAVIGATION ── */}
        <View style={[styles.tabs, { backgroundColor: cardBg, borderColor }]}>
          {(['overview', 'joints', 'recs', 'rehab'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, { color: activeTab === tab ? colors.primary : textMuted }]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <View style={styles.tabContent}>
            <View style={styles.scoreGrid}>
              <View style={styles.scoreRow}>
                <ScoreCard label="Posture" value={report.postureAccuracyScore} icon="body" color="#10b981" isDark={isDark} />
                <ScoreCard label="Balance" value={report.balanceScore} icon="git-merge" color="#0891b2" isDark={isDark} />
              </View>
              <View style={styles.scoreRow}>
                <ScoreCard label="Stability" value={report.movementStabilityScore} icon="analytics" color="#7c3aed" isDark={isDark} />
                <ScoreCard label="Alignment" value={report.bodyAlignmentScore} icon="navigate" color="#f59e0b" isDark={isDark} />
              </View>
            </View>

            <View style={[styles.section, { backgroundColor: cardBg, borderColor }]}>
              <Text style={[styles.sectionTitle, { color: textPrimary }]}>AI Feedback Summary</Text>
              {report.feedback.map((f, i) => (
                <View key={i} style={styles.feedbackItem}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                  <Text style={[styles.feedbackText, { color: textPrimary }]}>{f}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.section, { backgroundColor: cardBg, borderColor }]}>
              <Text style={[styles.sectionTitle, { color: textPrimary }]}>Muscles Activation</Text>
              {report.muscleGroupsInvolved.map((m, i) => (
                <View key={i} style={styles.muscleRow}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={[styles.muscleName, { color: textPrimary }]}>{m.name}</Text>
                      <Text style={[styles.musclePct, { color: colors.primary }]}>{m.activationPercent}%</Text>
                    </View>
                    <View style={styles.muscleBarBg}>
                      <View style={[styles.muscleBarFill, { width: `${m.activationPercent}%`, backgroundColor: colors.primary }]} />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── JOINTS TAB ── */}
        {activeTab === 'joints' && (
          <View style={styles.tabContent}>
            {report.jointAnalysis.joints.map((j, i) => (
              <View key={i} style={[styles.jointCard, { backgroundColor: cardBg, borderColor, borderLeftColor: j.color, borderLeftWidth: 4 }]}>
                <View style={styles.jointHeader}>
                  <Text style={[styles.jointLabel, { color: textPrimary }]}>{j.label}</Text>
                  <View style={[styles.sevBadge, { backgroundColor: j.color + '15' }]}>
                    <Text style={[styles.sevText, { color: j.color }]}>{getSeverityLabel(j.severity)}</Text>
                  </View>
                </View>
                <View style={styles.jointAngles}>
                  <View style={styles.angleBlock}>
                    <Text style={styles.angleLab}>Measured</Text>
                    <Text style={[styles.angleVal, { color: textPrimary }]}>{j.measuredAngle.toFixed(1)}°</Text>
                  </View>
                  <View style={styles.angleBlock}>
                    <Text style={styles.angleLab}>Target</Text>
                    <Text style={[styles.angleVal, { color: textMuted }]}>{j.expectedMin}° - {j.expectedMax}°</Text>
                  </View>
                </View>
                <Text style={[styles.jointReason, { color: textPrimary }]}>{j.plainReason}</Text>
                {j.correctionSteps.length > 0 && (
                  <View style={styles.correctionBox}>
                    <Text style={styles.correctionTitle}>How to Improve:</Text>
                    {j.correctionSteps.map((step, si) => (
                      <Text key={si} style={styles.correctionStep}>• {step}</Text>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* ── RECOMMENDATIONS TAB ── */}
        {activeTab === 'recs' && (
          <View style={styles.tabContent}>
            {report.aiRecommendations.map((rec, i) => (
              <View key={i} style={[styles.recCard, { backgroundColor: cardBg, borderColor }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <View style={[styles.priorityBadge, { backgroundColor: rec.priority === 'High' ? '#fee2e2' : '#fef3c7' }]}>
                    <Text style={[styles.priorityText, { color: rec.priority === 'High' ? '#ef4444' : '#d97706' }]}>{rec.priority} Priority</Text>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>{rec.category}</Text>
                </View>
                <Text style={[styles.recTitle, { color: textPrimary }]}>{rec.title}</Text>
                <Text style={[styles.recDesc, { color: textMuted }]}>{rec.description}</Text>
                <View style={{ marginTop: 12, gap: 6 }}>
                  {rec.actionSteps.map((step, si) => (
                    <View key={si} style={{ flexDirection: 'row', gap: 8 }}>
                      <Text style={{ color: colors.primary, fontWeight: '900' }}>{si + 1}.</Text>
                      <Text style={{ color: textPrimary, fontSize: 13, flex: 1 }}>{step}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}

            <Text style={[styles.subHeading, { color: textPrimary, marginTop: 16 }]}>Recommended Next Steps</Text>
            {report.futureExerciseRecommendations.map((f, i) => (
              <TouchableOpacity key={i} style={[styles.futureCard, { backgroundColor: cardBg, borderColor }]} onPress={() => router.push({ pathname: '/scanner', params: { exerciseId: f.exerciseId, species: report.detectedSpecies } })}>
                <View style={styles.futureHeader}>
                  <Text style={[styles.futureName, { color: textPrimary }]}>{f.exerciseName}</Text>
                  <View style={styles.diffBadge}><Text style={styles.diffText}>{f.estimatedDifficulty}</Text></View>
                </View>
                <Text style={[styles.futureRationale, { color: textMuted }]}>{f.rationale}</Text>
                <View style={styles.readiness}>
                  <Text style={styles.readinessLab}>Readiness Score</Text>
                  <View style={styles.readinessBar}>
                    <View style={[styles.readinessFill, { width: `${f.readinessScore}%` }]} />
                  </View>
                  <Text style={[styles.readinessPct, { color: colors.primary }]}>{f.readinessScore}%</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── REHAB TAB ── */}
        {activeTab === 'rehab' && (
          <View style={styles.tabContent}>
            {report.injuryFindings.length > 0 ? (
              report.injuryFindings.map((inf, i) => (
                <View key={i} style={[styles.injuryCard, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: '#ef4444' }}>{inf.region}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#ef4444' }}>{inf.severity}</Text>
                  </View>
                  <Text style={{ color: '#7f1d1d', fontSize: 14, fontWeight: '600' }}>{inf.description}</Text>
                  <View style={{ marginTop: 10, gap: 4 }}>
                    {inf.immediateActions.map((act, ai) => (
                      <Text key={ai} style={{ color: '#b91c1c', fontSize: 12 }}>🚨 {act}</Text>
                    ))}
                  </View>
                  {inf.vetRequired && (
                    <View style={styles.vetAlert}>
                      <Ionicons name="medical" size={16} color="#fff" />
                      <Text style={styles.vetAlertText}>Professional medical assessment required immediately.</Text>
                    </View>
                  )}
                  <Text style={{ marginTop: 8, fontSize: 11, color: '#ef4444', fontStyle: 'italic' }}>Est. Recovery: {inf.estimatedRecovery}</Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyRehab}>
                <Ionicons name="checkmark-done-circle" size={64} color="#10b981" />
                <Text style={[styles.emptyRehabTitle, { color: textPrimary }]}>No Injury Findings</Text>
                <Text style={[styles.emptyRehabSub, { color: textMuted }]}>AI Scanner did not detect any immediate injury markers or critical biomechanical risks.</Text>
              </View>
            )}

            <View style={[styles.section, { backgroundColor: cardBg, borderColor, marginTop: 12 }]}>
              <Text style={[styles.sectionTitle, { color: textPrimary }]}>Rehabilitation Protocols</Text>
              {report.rehabilitationAdvice.map((adv, i) => (
                <View key={i} style={styles.feedbackItem}>
                  <Ionicons name="heart-half" size={16} color="#0891b2" />
                  <Text style={[styles.feedbackText, { color: textPrimary }]}>{adv}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  headerSub: { fontSize: 10, marginTop: 1, letterSpacing: 0.5 },
  shareBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.08)' },
  scrollContent: { paddingBottom: 40 },

  heroCard: { margin: 16, borderRadius: 24, padding: 20, elevation: 4 },
  heroMain: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  heroInfo: { flex: 1 },
  heroSpecies: { color: '#fff', fontSize: 24, fontWeight: '900' },
  heroExercise: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '700', marginTop: 2 },
  heroBadge: { backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', marginTop: 8 },
  heroBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  heroDesc: { color: '#fff', fontSize: 11, marginTop: 8, lineHeight: 16, fontWeight: '500' },
  heroStats: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', marginTop: 20, paddingTop: 16 },
  hStat: { alignItems: 'center', flex: 1 },
  hStatVal: { color: '#fff', fontSize: 18, fontWeight: '900' },
  hStatLab: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800' },
  hStatDivider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.2)' },

  tabs: { flexDirection: 'row', marginHorizontal: 16, borderRadius: 14, borderWidth: 1, padding: 4, gap: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabText: { fontSize: 12, fontWeight: '800' },
  tabContent: { padding: 16 },

  scoreGrid: { gap: 12, marginBottom: 16 },
  scoreRow: { flexDirection: 'row', gap: 12 },
  section: { borderRadius: 18, padding: 16, borderWidth: 1, marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  feedbackItem: { flexDirection: 'row', gap: 10, marginBottom: 8, alignItems: 'flex-start' },
  feedbackText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '600' },

  muscleRow: { marginBottom: 12 },
  muscleName: { fontSize: 13, fontWeight: '700' },
  musclePct: { fontSize: 12, fontWeight: '800' },
  muscleBarBg: { height: 6, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 3, overflow: 'hidden' },
  muscleBarFill: { height: '100%', borderRadius: 3 },

  jointCard: { borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 12 },
  jointHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  jointLabel: { fontSize: 15, fontWeight: '900' },
  sevBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  sevText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  jointAngles: { flexDirection: 'row', gap: 20, marginBottom: 12 },
  angleBlock: { gap: 2 },
  angleLab: { fontSize: 9, color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase' },
  angleVal: { fontSize: 16, fontWeight: '800' },
  jointReason: { fontSize: 13, lineHeight: 18, fontWeight: '600', marginBottom: 10 },
  correctionBox: { backgroundColor: 'rgba(0,0,0,0.03)', padding: 12, borderRadius: 10, gap: 4 },
  correctionTitle: { fontSize: 12, fontWeight: '800', color: '#10b981', marginBottom: 2 },
  correctionStep: { fontSize: 12, color: '#64748b', fontWeight: '500' },

  recCard: { borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 12 },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  priorityText: { fontSize: 10, fontWeight: '800' },
  recTitle: { fontSize: 16, fontWeight: '900', marginTop: 4 },
  recDesc: { fontSize: 13, lineHeight: 18, marginTop: 4 },

  subHeading: { fontSize: 16, fontWeight: '900', marginBottom: 12 },
  futureCard: { borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 10 },
  futureHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  futureName: { fontSize: 15, fontWeight: '900' },
  diffBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  diffText: { fontSize: 10, fontWeight: '800', color: '#64748b' },
  futureRationale: { fontSize: 12, lineHeight: 17, marginBottom: 12 },
  readiness: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  readinessLab: { fontSize: 10, fontWeight: '800', color: '#94a3b8' },
  readinessBar: { flex: 1, height: 6, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 3, overflow: 'hidden' },
  readinessFill: { height: '100%', backgroundColor: '#10b981' },
  readinessPct: { fontSize: 12, fontWeight: '900' },

  injuryCard: { borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 12 },
  vetAlert: { flexDirection: 'row', gap: 10, backgroundColor: '#ef4444', padding: 12, borderRadius: 12, marginTop: 12, alignItems: 'center' },
  vetAlertText: { color: '#fff', fontSize: 12, fontWeight: '800', flex: 1 },
  emptyRehab: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyRehabTitle: { fontSize: 18, fontWeight: '900' },
  emptyRehabSub: { fontSize: 13, color: '#94a3b8', textAlign: 'center', paddingHorizontal: 32, lineHeight: 18 },
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  headerSub: { fontSize: 12, marginTop: 1 },
  shareBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  motionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  motionBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  scroll: { padding: 16, paddingBottom: 60 },
  heroCard: { borderRadius: 20, padding: 20, marginBottom: 14, overflow: 'hidden' },
  heroContent: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  heroText: { flex: 1, justifyContent: 'center' },
  heroSpecies: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  heroBreed: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600', marginTop: 2 },
  heroExercise: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '700', marginTop: 6, marginBottom: 8 },
  gradeDesc: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  gradeDescText: { fontSize: 11, fontWeight: '700', lineHeight: 15 },
  heroMeta: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700' },
  metaDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', height: 16 },
  section: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.3 },
  detRow: { flexDirection: 'row', justifyContent: 'space-around' },
  detItem: { alignItems: 'center' },
  detLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  detVal: { fontSize: 16, fontWeight: '900' },
  tabs: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, marginBottom: 14, overflow: 'hidden' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 12, fontWeight: '800' },
  tabSubtitle: { fontSize: 13, lineHeight: 18, marginBottom: 12, fontWeight: '500' },
  scoreGrid: { gap: 8, marginBottom: 14 },
  scoreRow: { flexDirection: 'row', gap: 8 },
  jointSummaryRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  summaryChip: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  summaryNum: { fontSize: 28, fontWeight: '900' },
  summaryLabel: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  primaryIssueBox: { borderRadius: 10, borderWidth: 1, padding: 10, flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  primaryIssueText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  muscleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  muscleNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  muscleName: { fontSize: 13, fontWeight: '700', flex: 1 },
  roleTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  roleText: { fontSize: 9, fontWeight: '800' },
  muscleBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  muscleBarFill: { height: '100%', borderRadius: 3 },
  muscleAct: { fontSize: 13, fontWeight: '800', minWidth: 38, textAlign: 'right' },
  feedbackRow: { flexDirection: 'row', gap: 8, marginBottom: 6, alignItems: 'flex-start' },
  feedbackBullet: { fontSize: 18, lineHeight: 22, fontWeight: '900' },
  feedbackText: { flex: 1, fontSize: 13, lineHeight: 19 },
  legendRow: { flexDirection: 'row', justifyContent: 'space-around', borderRadius: 12, borderWidth: 1, padding: 10, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 11, fontWeight: '700' },
  recCard: { borderRadius: 14, borderWidth: 1, borderLeftWidth: 4, padding: 14, marginBottom: 10 },
  recHeader: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
  priorityText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  catBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
  catText: { fontSize: 10, fontWeight: '700' },
  recTitle: { fontSize: 15, fontWeight: '800', marginBottom: 6 },
  recDesc: { fontSize: 13, lineHeight: 18, marginBottom: 10 },
  stepRow: { flexDirection: 'row', gap: 10, marginBottom: 6, alignItems: 'flex-start' },
  stepNum2: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepNum2Text: { color: '#fff', fontSize: 10, fontWeight: '900' },
  stepText2: { flex: 1, fontSize: 13, lineHeight: 18 },
  subHeading: { fontSize: 16, fontWeight: '800', marginTop: 14, marginBottom: 10 },
  futureCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  futureHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  futureName: { fontSize: 15, fontWeight: '800' },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
  diffText: { fontSize: 10, fontWeight: '800' },
  futureRationale: { fontSize: 13, lineHeight: 18, marginBottom: 10 },
  readinessRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  readinessLabel: { fontSize: 11, fontWeight: '700', width: 65 },
  readinessBarBg: { flex: 1, height: 7, borderRadius: 4, overflow: 'hidden' },
  readinessBarFill: { height: '100%', borderRadius: 4 },
  readinessPct: { fontSize: 13, fontWeight: '800', minWidth: 38, textAlign: 'right' },
  injuryCard: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8 },
  injuryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  injuryRegion: { fontSize: 15, fontWeight: '800' },
  sevBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
  sevText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  injuryDesc: { fontSize: 13, lineHeight: 18, marginBottom: 8 },
  vetRequired: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 },
  recoveryLabel: { fontSize: 12, fontWeight: '600' },
  rehabRow: { marginBottom: 8 },
  rehabText: { fontSize: 13, lineHeight: 19 },
  noIssues: { borderRadius: 20, borderWidth: 1, padding: 30, alignItems: 'center', gap: 10 },
  noIssuesTitle: { fontSize: 18, fontWeight: '900' },
  noIssuesText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
