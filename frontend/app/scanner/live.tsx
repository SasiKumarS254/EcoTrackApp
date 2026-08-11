/**
 * scanner/live.tsx — Live AI Scanner (In-App CV)
 *
 * Real-time camera inference for posture and exercise tracking.
 */

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  StatusBar, ActivityIndicator, Alert, Dimensions, Platform, ScrollView
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Svg, { Circle, Rect } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../context/ThemeContext';

import * as Scanner from '../../lib/scannerCore';
import { analyzeAllJoints } from '../../lib/jointAnalysis';
import { getExerciseById } from '../../lib/exerciseTemplates';
import { getSkeletonForSpecies } from '../../lib/skeletonTemplates';

const { width: SW, height: SH } = Dimensions.get('window');

export default function LiveScannerScreen() {
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams();

  const species = (params.species as string) || 'Human';
  const exerciseId = (params.exerciseId as string) || 'squat';
  const exerciseTemplate = useMemo(() => getExerciseById(exerciseId), [exerciseId]);

  const [permission, requestPermission] = useCameraPermissions();
  const [stage, setStage] = useState<Scanner.ScannerStage>('INITIALIZING');
  const [loadingMsg, setLoadingMsg] = useState('Booting CV Engine...');
  const [haltReason, setHaltReason] = useState<string | null>(null);

  const [fps, setFps] = useState(0);
  const [latency, setLatency] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [repCount, setRepCount] = useState(0);
  const [coachingTip, setCoachingTip] = useState('Position yourself in full view.');

  const [bbox, setBbox] = useState<Scanner.BoundingBox | null>(null);
  const [keypoints, setKeypoints] = useState<Scanner.Keypoint[]>([]);

  const cameraRef = useRef<any>(null);
  const isScanning = useRef(false);
  const frameId = useRef<number | null>(null);

  const startScanner = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert("Permission Required", "Camera access is mandatory for AI scanning.");
        return;
      }
    }

    setStage('INITIALIZING');
    const ok = await Scanner.initializeScanner(setLoadingMsg);
    if (!ok) {
      setHaltReason("Failed to initialize hardware acceleration.");
      setStage('VERIFYING');
      return;
    }

    setStage('DETECTING');
    isScanning.current = true;
    runPipelineLoop();
  };

  const runPipelineLoop = async () => {
    if (!isScanning.current) return;
    const startTime = performance.now();

    try {
      if (cameraRef.current) {
        const detection = await Scanner.detectAndVerify('camera_feed', species);
        if (!detection.detected) {
          setHaltReason(detection.error || "Species not detected.");
          setStage('VERIFYING');
          isScanning.current = false;
          return;
        }

        setConfidence(detection.confidence);
        setBbox(detection.bbox);

        if (detection.bbox) {
          const visibility = Scanner.verifyBodyVisibility(detection.bbox, SW, SH);
          if (!visibility.visible) {
            setHaltReason(visibility.msg);
            setStage('VISIBILITY_CHECK');
            isScanning.current = false;
            return;
          }
        }

        setStage('POSING');
        const kps = await Scanner.estimatePose('camera_feed', species, detection.bbox!);
        setKeypoints(kps);

        setStage('ANALYZING');
        const measuredAngles: Record<string, number> = {};
        const analysis = analyzeAllJoints(
          measuredAngles,
          (exerciseTemplate?.joint_rules || {}) as any, // Updated to use joint_rules
          exerciseTemplate?.critical_joints || [],
          species
        );
        if (analysis.primaryIssue) setCoachingTip(analysis.primaryIssue);
        else setCoachingTip("Form looks excellent. Continue.");

        const endTime = performance.now();
        setLatency(Math.round(endTime - startTime));
        setFps(Math.round(1000 / (endTime - startTime)));
      }
    } catch (e) {
      console.error(e);
    }

    if (isScanning.current) {
      frameId.current = requestAnimationFrame(runPipelineLoop);
    }
  };

  useEffect(() => {
    startScanner();
    return () => {
      isScanning.current = false;
      if (frameId.current) cancelAnimationFrame(frameId.current);
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.statusBar}>
        <View style={styles.statusBadge}>
          <View style={[styles.dot, { backgroundColor: '#10b981' }]} />
          <Text style={styles.statusText}>LIVE INFERENCE ACTIVE</Text>
        </View>
        <View style={styles.metricsContainer}>
          <Text style={styles.metric}>FPS: <Text style={{color: '#fff'}}>{fps}</Text></Text>
          <Text style={styles.metric}>Latency: <Text style={{color: '#fff'}}>{latency}ms</Text></Text>
        </View>
      </View>

      <View style={styles.viewport}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
        <Svg style={StyleSheet.absoluteFill}>
          {bbox && (
            <Rect
              x={bbox.x} y={bbox.y} width={bbox.width} height={bbox.height}
              stroke="#10b981" strokeWidth="1.5" fill="none" strokeDasharray="6,4"
            />
          )}
        </Svg>

        {stage === 'INITIALIZING' && (
          <BlurView intensity={40} style={styles.overlayFull}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.overlayTitle}>INITIALIZING ECOTRACK AI</Text>
            <Text style={styles.overlayDesc}>{loadingMsg}</Text>
          </BlurView>
        )}
      </View>

      <View style={styles.hudBottom}>
        <View style={styles.coachingCard}>
          <Text style={styles.coachingTitle}>💡 AI FEEDBACK</Text>
          <Text style={styles.coachingMsg}>{coachingTip}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.footerBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color="#fff" />
          <Text style={styles.footerBtnText}>End Session</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  statusBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: 'rgba(15,23,42,0.9)' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#064e3b', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { color: '#10b981', fontSize: 10, fontWeight: '900' },
  metricsContainer: { flexDirection: 'row', gap: 12 },
  metric: { color: '#64748b', fontSize: 11, fontWeight: '700' },
  viewport: { flex: 1, backgroundColor: '#000', position: 'relative' },
  overlayFull: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', padding: 32 },
  overlayTitle: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 24, textAlign: 'center' },
  overlayDesc: { color: '#94a3b8', fontSize: 14, textAlign: 'center', marginTop: 12, lineHeight: 22 },
  hudBottom: { position: 'absolute', bottom: 100, left: 20, right: 20 },
  coachingCard: { backgroundColor: 'rgba(15,23,42,0.85)', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#334155' },
  coachingTitle: { color: '#10b981', fontSize: 11, fontWeight: '900', marginBottom: 4 },
  coachingMsg: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footer: { flexDirection: 'row', padding: 16, borderTopWidth: 1, borderTopColor: '#1e293b' },
  footerBtn: { flex: 1, height: 56, backgroundColor: '#1e293b', borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  footerBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
