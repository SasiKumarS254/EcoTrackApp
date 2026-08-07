/**
 * scanner/index.tsx — EcoTrack AI Scanner (Production CV Module)
 * ─────────────────────────────────────────────────────────────────────────────
 * Full-screen AI scanner with:
 *  - Real model loading with per-model status dashboard
 *  - Live camera feed with dynamic bounding box + AP-10K/COCO skeleton overlay
 *  - 8-stage pipeline state machine — halts honestly at each failed gate
 *  - Rep counter from actual joint displacement
 *  - Body visibility verification
 *  - Species selector from Training plan
 *  - Exercise selector from AI Trainer
 *  - Professional dark UI with glassmorphism panels
 */

import React, {
  useState, useRef, useEffect, useCallback, useMemo,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  ScrollView, Modal, TextInput, Animated, StatusBar,
  SafeAreaView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Circle, Line, Rect, Text as SvgText, G } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { FontSize, Radius, Shadow } from '@/constants/theme';

// CV Pipeline
import {
  getSkeletonForSpecies,
  AP10K_SUPPORTED_SPECIES,
  AP10K_KEYPOINT_MAP,
  type SkeletonTemplate,
} from '../../lib/skeletonTemplates';
import {
  detectSpecies, estimateKeypoints, analyzeMotion,
  updateRepCount, checkBodyVisibility, checkImageQuality,
  computeJointAngles, computeGrade, saveScanToBackend,
  syncTrainingAnalytics, type PipelineStatus, type CompleteScanResult,
  PIPELINE_INITIAL_STATE,
} from '../../lib/aiPipeline';
import { getExercisesForSpecies, getExerciseById } from '../../lib/exerciseTemplates';
import { saveMotionResult } from '../../data/trainingAnalyticsStore';

const { width: SW, height: SH } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface ModelLoadStatus {
  name: string;
  status: 'checking' | 'loaded' | 'missing' | 'error';
  detail: string;
}

interface LiveScanState {
  status: PipelineStatus;
  stepLabel: string;
  detection: { species: string; confidence: number; bbox: any } | null;
  keypoints: Array<{ name: string; x: number; y: number; visibility: number; ap10k_idx?: number }>;
  jointAngles: Record<string, number>;
  jointStatuses: Record<string, 'correct' | 'warn' | 'incorrect'>;
  formScore: number;
  postureScore: number;
  balanceScore: number;
  repCount: number;
  fps: number;
  poseSource: string | null;
  bodyVisible: boolean;
  missingRegions: string[];
  errorMessage: string | null;
  skeleton: SkeletonTemplate | null;
  frameQuality: number;
  inferenceMs: number;
}

const LIVE_INITIAL: LiveScanState = {
  status: 'IDLE', stepLabel: 'Ready',
  detection: null, keypoints: [], jointAngles: {}, jointStatuses: {},
  formScore: 0, postureScore: 0, balanceScore: 0, repCount: 0, fps: 0,
  poseSource: null, bodyVisible: false, missingRegions: [],
  errorMessage: null, skeleton: null, frameQuality: 0, inferenceMs: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// Joint Status Colors
// ─────────────────────────────────────────────────────────────────────────────
const JOINT_COLOR = {
  correct:   '#22c55e',
  warn:      '#f59e0b',
  incorrect: '#ef4444',
  default:   '#a78bfa',
  low_conf:  '#64748b',
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function AIScannerScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const params = useLocalSearchParams<{ species?: string; exerciseId?: string }>();

  // Camera
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const cameraRef = useRef<any>(null);

  // Auth
  const [userId, setUserId] = useState<string | null>(null);

  // Model loading
  const [modelStatus, setModelStatus] = useState<ModelLoadStatus[]>([]);
  const [allModelsReady, setAllModelsReady] = useState(false);
  const [loadingModels, setLoadingModels] = useState(true);

  // Scanner state
  const [scanState, setScanState] = useState<LiveScanState>(LIVE_INITIAL);
  const [isScanning, setIsScanning] = useState(false);
  const scanningRef = useRef(false);
  const repStateRef = useRef({ count: 0, lastPosition: -1, inDownPhase: false });
  const frameCountRef = useRef(0);
  const lastFpsRef = useRef(Date.now());

  // Species & Exercise selection
  const [selectedSpecies, setSelectedSpecies] = useState(params.species || 'human');
  const [selectedExerciseId, setSelectedExerciseId] = useState(params.exerciseId || '');
  const [showSpeciesModal, setShowSpeciesModal] = useState(false);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [speciesSearch, setSpeciesSearch] = useState('');

  // Animation values
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const statusAnim = useRef(new Animated.Value(0)).current;

  // ── Load user session ─────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem('@ecotrack_user_session').then(raw => {
      if (raw) setUserId(JSON.parse(raw).user_id);
    });
  }, []);

  // ── Model status check ────────────────────────────────────────────────────
  useEffect(() => {
    checkModelStatus();
  }, []);

  const checkModelStatus = useCallback(async () => {
    setLoadingModels(true);

    const models: ModelLoadStatus[] = [
      { name: 'Species Detector',      status: 'checking', detail: 'YOLOv8n — 80 COCO classes' },
      { name: 'Human Pose (MediaPipe)',status: 'checking', detail: 'BlazePose 33-landmark' },
      { name: 'YOLOv8 Pose',          status: 'checking', detail: 'COCO-17 human + animals' },
      { name: 'Animal Pose (AP-10K)', status: 'checking', detail: 'RTMPose-M 54 species, 17 kpts' },
    ];
    setModelStatus([...models]);

    try {
      const resp = await fetch('http://localhost:5001/model-status', {
        signal: AbortSignal.timeout(5000),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      const ms = data.models;

      models[0].status = ms.yolov8_detector?.loaded  ? 'loaded' : 'missing';
      models[0].detail = ms.yolov8_detector?.loaded
        ? `Loaded: ${ms.yolov8_detector.path?.split('\\').pop()}`
        : `Missing: ${ms.yolov8_detector?.error || 'yolov8n.pt not found'}`;

      models[1].status = ms.mediapipe_pose?.loaded ? 'loaded' : 'missing';
      models[1].detail = ms.mediapipe_pose?.loaded
        ? `Loaded: pose_landmarker_full.task`
        : `Missing: ${ms.mediapipe_pose?.error || 'pose_landmarker_*.task not found'}`;

      models[2].status = ms.yolov8_pose?.loaded ? 'loaded' : 'missing';
      models[2].detail = ms.yolov8_pose?.loaded
        ? `Loaded: ${ms.yolov8_pose.path?.split('\\').pop()}`
        : `Missing: ${ms.yolov8_pose?.error || 'yolov8*-pose.pt not found in models/'}`;

      const animalReady = ms.animal_pose_finetuned?.loaded || ms.rtmpose_animal?.loaded;
      models[3].status = animalReady ? 'loaded' : 'missing';
      models[3].detail = ms.animal_pose_finetuned?.loaded
        ? `Fine-tuned: ${ms.animal_pose_finetuned.path?.split('\\').pop()}`
        : ms.rtmpose_animal?.loaded
          ? `RTMPose-M loaded (AP-10K 54 species)`
          : `Not trained yet — run: python train_animal_pose.py --phase all`;

      // Critical models: detector + at least one pose model
      const criticalReady = models[0].status === 'loaded' &&
        (models[1].status === 'loaded' || models[2].status === 'loaded');

      setAllModelsReady(criticalReady);
      setModelStatus([...models]);

    } catch (err: any) {
      // Backend not reachable
      models.forEach(m => {
        m.status = 'error';
        m.detail = 'Backend AI service not running. Start with: python ai_service.py';
      });
      setModelStatus([...models]);
      setAllModelsReady(false);
    }

    setLoadingModels(false);
  }, []);

  // ── Pulse animation for scanning indicator ────────────────────────────────
  useEffect(() => {
    if (isScanning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0,  duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isScanning]);

  // ── Main scan loop ────────────────────────────────────────────────────────
  const runScanFrame = useCallback(async () => {
    if (!scanningRef.current || !cameraRef.current) return;

    const frameStart = Date.now();
    frameCountRef.current += 1;

    // FPS tracking
    const now = Date.now();
    let fps = scanState.fps;
    if (now - lastFpsRef.current >= 1000) {
      fps = frameCountRef.current;
      frameCountRef.current = 0;
      lastFpsRef.current = now;
    }

    try {
      // Capture frame
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        base64: false,
        skipProcessing: true,
      });

      if (!photo?.uri || !scanningRef.current) return;

      setScanState(prev => ({ ...prev, status: 'DETECTING', stepLabel: 'Detecting species…', fps }));

      // ── Stage 1: Species Detection ───────────────────────────────────────
      const detection = await detectSpecies(photo.uri, selectedSpecies);

      if (!detection.modelAvailable) {
        setScanState(prev => ({
          ...prev, status: 'ERROR',
          errorMessage: 'Species detection model not loaded. Restart the AI service.',
          stepLabel: 'Model Error',
        }));
        stopScanning();
        return;
      }

      if (!detection.detected) {
        setScanState(prev => ({
          ...prev, status: 'SPECIES_NOT_FOUND',
          detection: null,
          stepLabel: `${selectedSpecies} not found`,
          errorMessage: `Target species "${selectedSpecies}" not found in frame. Reposition the camera.`,
          fps,
        }));
        setTimeout(() => { if (scanningRef.current) runScanFrame(); }, 800);
        return;
      }

      const bbox = detection.boundingBox!;
      const imgW  = detection.imageWidth  || 640;
      const imgH  = detection.imageHeight || 480;

      // ── Stage 2: Quality Check ───────────────────────────────────────────
      const quality = checkImageQuality(bbox, imgW, imgH, detection.confidence);
      const frameQuality = Math.round(
        ((bbox.width * bbox.height) / (imgW * imgH)) * 100 * 5
      );

      if (!quality.passed) {
        setScanState(prev => ({
          ...prev, status: 'QUALITY_FAIL',
          detection: { species: detection.className, confidence: detection.confidence, bbox },
          stepLabel: 'Low frame quality',
          errorMessage: quality.reasons.join(' '),
          fps, frameQuality,
        }));
        setTimeout(() => { if (scanningRef.current) runScanFrame(); }, 600);
        return;
      }

      // ── Stage 3: Body Visibility ─────────────────────────────────────────
      const skeleton = getSkeletonForSpecies(selectedSpecies);

      if (!skeleton) {
        setScanState(prev => ({
          ...prev, status: 'ERROR',
          detection: { species: detection.className, confidence: detection.confidence, bbox },
          stepLabel: 'Pose not supported',
          errorMessage: `Pose estimation not available for "${selectedSpecies}". No anatomical model defined.`,
          fps,
        }));
        setTimeout(() => { if (scanningRef.current) runScanFrame(); }, 2000);
        return;
      }

      const visibility = checkBodyVisibility(bbox, imgW, imgH, skeleton);
      setScanState(prev => ({
        ...prev,
        status: visibility.isFullBodyVisible ? 'ESTIMATING_POSE' : 'BODY_INCOMPLETE',
        detection: { species: detection.className, confidence: detection.confidence, bbox },
        bodyVisible: visibility.isFullBodyVisible,
        missingRegions: visibility.missingRegions,
        stepLabel: visibility.isFullBodyVisible ? 'Estimating pose…' : 'Body partially hidden',
        errorMessage: visibility.isFullBodyVisible ? null : visibility.message,
        skeleton,
        fps, frameQuality,
      }));

      if (!visibility.isFullBodyVisible) {
        setTimeout(() => { if (scanningRef.current) runScanFrame(); }, 500);
        return;
      }

      // ── Stage 4: Pose Estimation ─────────────────────────────────────────
      const poseResult = await estimateKeypoints(photo.uri, selectedSpecies, bbox);

      if (!poseResult.success || poseResult.keypoints.length < 4) {
        // Pose model failed but not because species is unsupported — retry
        setTimeout(() => { if (scanningRef.current) runScanFrame(); }, 400);
        return;
      }

      // ── Stage 5: Joint Angle Computation ─────────────────────────────────
      const jointAngles = computeJointAngles(poseResult.keypoints, skeleton, bbox);

      // ── Stage 6: Motion Analysis ─────────────────────────────────────────
      const exercise = selectedExerciseId
        ? getExerciseById(selectedExerciseId)
        : null;

      let jointStatuses: Record<string, 'correct' | 'warn' | 'incorrect'> = {};
      let formScore     = 0;
      let postureScore  = 0;
      let balanceScore  = 0;
      let repCount      = repStateRef.current.count;

      if (exercise) {
        setScanState(prev => ({ ...prev, stepLabel: 'Analyzing motion…', status: 'ANALYZING_MOTION' }));
        const motion = analyzeMotion(jointAngles, exercise);
        jointStatuses = motion.statuses;
        formScore     = motion.formScore;
        postureScore  = motion.postureScore;
        balanceScore  = motion.balanceScore;

        // Rep counting
        repStateRef.current = updateRepCount(repStateRef.current, poseResult.keypoints, exercise);
        repCount = repStateRef.current.count;
      }

      const inferenceMs = Date.now() - frameStart;

      setScanState(prev => ({
        ...prev,
        status: 'SUCCESS',
        stepLabel: exercise ? `${exercise.name} — ${repCount} reps` : 'Pose detected',
        detection: { species: detection.className, confidence: detection.confidence, bbox },
        keypoints: poseResult.keypoints,
        jointAngles,
        jointStatuses,
        formScore,
        postureScore,
        balanceScore,
        repCount,
        poseSource: (poseResult as any).poseSource || null,
        bodyVisible: true,
        missingRegions: [],
        errorMessage: null,
        skeleton,
        fps,
        frameQuality: Math.min(100, frameQuality),
        inferenceMs,
      }));

    } catch (err: any) {
      console.warn('[Scanner] Frame error:', err?.message);
    }

    // Schedule next frame
    if (scanningRef.current) {
      setTimeout(runScanFrame, 150);
    }
  }, [selectedSpecies, selectedExerciseId, scanState.fps]);

  const startScanning = useCallback(async () => {
    if (!allModelsReady) {
      Alert.alert('Models Not Ready', 'Please wait for all models to load before scanning.');
      return;
    }
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) return;
    }
    repStateRef.current = { count: 0, lastPosition: -1, inDownPhase: false };
    frameCountRef.current = 0;
    lastFpsRef.current = Date.now();
    scanningRef.current = true;
    setIsScanning(true);
    setScanState({ ...LIVE_INITIAL, status: 'DETECTING', stepLabel: 'Starting pipeline…' });
    runScanFrame();
  }, [allModelsReady, permission, runScanFrame]);

  const stopScanning = useCallback(() => {
    scanningRef.current = false;
    setIsScanning(false);
    setScanState(prev => ({ ...prev, status: 'IDLE', stepLabel: 'Scan stopped' }));
  }, []);

  const handleUploadImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    const uri = result.assets[0].uri;
    setScanState(prev => ({ ...prev, status: 'DETECTING', stepLabel: 'Analyzing uploaded image…' }));

    try {
      const detection = await detectSpecies(uri, selectedSpecies);
      if (!detection.detected) {
        setScanState(prev => ({
          ...prev, status: 'SPECIES_NOT_FOUND',
          errorMessage: `"${selectedSpecies}" not found in uploaded image.`,
          stepLabel: 'Species not found',
        }));
        return;
      }

      const skeleton = getSkeletonForSpecies(selectedSpecies);
      if (!skeleton) {
        setScanState(prev => ({
          ...prev, status: 'ERROR',
          errorMessage: `No pose model defined for "${selectedSpecies}".`,
          stepLabel: 'Unsupported species',
        }));
        return;
      }

      const poseResult = await estimateKeypoints(uri, selectedSpecies, detection.boundingBox!);
      const jointAngles = computeJointAngles(poseResult.keypoints, skeleton, detection.boundingBox!);
      const exercise = selectedExerciseId ? getExerciseById(selectedExerciseId) : null;
      let motion = { statuses: {}, formScore: 0, postureScore: 0, balanceScore: 0 } as any;
      if (exercise && Object.keys(jointAngles).length > 0) {
        motion = analyzeMotion(jointAngles, exercise);
      }

      const grade = computeGrade(motion.formScore);
      const result: CompleteScanResult = {
        scanId:              `scan_${Date.now()}`,
        timestamp:           new Date().toISOString(),
        analysisSource:      'backend_ai',
        detectedSpecies:     detection.className,
        detectedBreed:       null,
        detectionConfidence: detection.confidence,
        isFullBodyVisible:   true,
        boundingBox:         detection.boundingBox,
        keypoints:           poseResult.keypoints,
        jointAngles,
        jointStatuses:       motion.statuses,
        formScore:           motion.formScore,
        postureScore:        motion.postureScore,
        balanceScore:        motion.balanceScore,
        repsCompleted:       0,
        grade,
        feedback:            [],
        exerciseName:        exercise?.name || 'Image Analysis',
        exerciseId:          selectedExerciseId,
        exerciseDurationSec: 0,
      };

      setScanState(prev => ({
        ...prev,
        status: 'SUCCESS',
        detection: { species: detection.className, confidence: detection.confidence, bbox: detection.boundingBox },
        keypoints: poseResult.keypoints,
        jointAngles,
        jointStatuses: motion.statuses,
        formScore: motion.formScore,
        postureScore: motion.postureScore,
        balanceScore: motion.balanceScore,
        skeleton,
        bodyVisible: true,
        missingRegions: [],
        errorMessage: null,
        stepLabel: 'Analysis complete',
        poseSource: (poseResult as any).poseSource,
      }));

      await saveScanToBackend(result, userId || undefined);
      router.push({ pathname: '/scanReport', params: { data: JSON.stringify(result) } });

    } catch (err: any) {
      setScanState(prev => ({
        ...prev, status: 'ERROR',
        errorMessage: `Analysis failed: ${err.message}`,
        stepLabel: 'Error',
      }));
    }
  }, [selectedSpecies, selectedExerciseId, userId]);

  // ── Finish scan & navigate to report ─────────────────────────────────────
  const finishScan = useCallback(async () => {
    stopScanning();
    const s = scanState;
    if (!s.detection || s.keypoints.length === 0) return;

    const exercise = selectedExerciseId ? getExerciseById(selectedExerciseId) : null;
    const grade    = computeGrade(s.formScore);
    const result: CompleteScanResult = {
      scanId:              `scan_${Date.now()}`,
      timestamp:           new Date().toISOString(),
      analysisSource:      'backend_ai',
      detectedSpecies:     s.detection.species,
      detectedBreed:       null,
      detectionConfidence: s.detection.confidence,
      isFullBodyVisible:   s.bodyVisible,
      boundingBox:         s.detection.bbox,
      keypoints:           s.keypoints,
      jointAngles:         s.jointAngles,
      jointStatuses:       s.jointStatuses,
      formScore:           s.formScore,
      postureScore:        s.postureScore,
      balanceScore:        s.balanceScore,
      repsCompleted:       s.repCount,
      grade,
      feedback:            [],
      exerciseName:        exercise?.name || 'Free Scan',
      exerciseId:          selectedExerciseId,
      exerciseDurationSec: 0,
    };

    await saveScanToBackend(result, userId || undefined);
    if (userId) await syncTrainingAnalytics(result, userId);
    router.push({ pathname: '/scanReport', params: { data: JSON.stringify(result) } });
  }, [scanState, selectedExerciseId, userId]);

  // ── Skeleton renderer ─────────────────────────────────────────────────────
  const renderSkeleton = useCallback(() => {
    const { skeleton, keypoints, jointStatuses, detection } = scanState;
    if (!skeleton || keypoints.length === 0 || !detection?.bbox) return null;

    const bbox = detection.bbox;

    // Build pixel coordinate map from normalized keypoints
    const kpMap: Record<string, { px: number; py: number; vis: number }> = {};
    for (const kp of keypoints) {
      if (kp.visibility >= 0.3) {
        kpMap[kp.name] = {
          px: bbox.x + kp.x * bbox.width,
          py: bbox.y + kp.y * bbox.height,
          vis: kp.visibility,
        };
      }
    }

    const elements: React.ReactElement[] = [];

    // Draw bones
    for (const [a, b] of skeleton.bones) {
      const pa = kpMap[a], pb = kpMap[b];
      if (!pa || !pb) continue;
      const statusA = jointStatuses[a] || 'default';
      const statusB = jointStatuses[b] || 'default';
      const color   = statusA === 'incorrect' || statusB === 'incorrect'
        ? JOINT_COLOR.incorrect
        : statusA === 'warn' || statusB === 'warn'
          ? JOINT_COLOR.warn
          : JOINT_COLOR.correct;

      elements.push(
        <Line
          key={`bone_${a}_${b}`}
          x1={pa.px} y1={pa.py} x2={pb.px} y2={pb.py}
          stroke={color} strokeWidth={2.5} strokeOpacity={0.85}
        />
      );
    }

    // Draw joints
    for (const [name, coords] of Object.entries(kpMap)) {
      const status = jointStatuses[name];
      const color  = status
        ? JOINT_COLOR[status]
        : coords.vis >= 0.65 ? JOINT_COLOR.default : JOINT_COLOR.low_conf;
      const radius = coords.vis >= 0.65 ? 5 : 3;

      elements.push(
        <Circle
          key={`kp_${name}`}
          cx={coords.px} cy={coords.py} r={radius}
          fill={color} fillOpacity={0.9}
          stroke="#000" strokeWidth={0.8}
        />
      );
    }

    return <G>{elements}</G>;
  }, [scanState]);

  // ── Bounding box renderer ─────────────────────────────────────────────────
  const renderBoundingBox = useCallback(() => {
    const { detection, status } = scanState;
    if (!detection?.bbox) return null;

    const { x, y, width, height } = detection.bbox;
    const color = status === 'SUCCESS' ? '#22c55e'
                : status === 'SPECIES_NOT_FOUND' ? '#ef4444'
                : status === 'BODY_INCOMPLETE' ? '#f59e0b'
                : '#6366f1';

    return (
      <G>
        {/* Main box */}
        <Rect
          x={x} y={y} width={width} height={height}
          stroke={color} strokeWidth={2} fill="none" strokeOpacity={0.9}
        />
        {/* Corner markers */}
        {[
          [x, y, x+20, y, x, y+20],
          [x+width, y, x+width-20, y, x+width, y+20],
          [x, y+height, x+20, y+height, x, y+height-20],
          [x+width, y+height, x+width-20, y+height, x+width, y+height-20],
        ].map(([cx, cy, ex, ey, ex2, ey2], i) => (
          <G key={`corner_${i}`}>
            <Line x1={cx} y1={cy} x2={ex} y2={ey} stroke={color} strokeWidth={3} />
            <Line x1={cx} y1={cy} x2={ex2} y2={ey2} stroke={color} strokeWidth={3} />
          </G>
        ))}
        {/* Species label */}
        <Rect x={x} y={y - 22} width={120} height={20} fill={color} fillOpacity={0.85} rx={4} />
        <SvgText x={x + 6} y={y - 7} fontSize="11" fontWeight="700" fill="#fff">
          {detection.species.toUpperCase()} {detection.confidence}%
        </SvgText>
      </G>
    );
  }, [scanState]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  if (loadingModels || !allModelsReady) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0f1e" />
        <LinearGradient colors={['#0a0f1e', '#0f1a2e', '#0d1b38']} style={StyleSheet.absoluteFillObject} />

        <SafeAreaView style={styles.initContainer}>
          {/* Header */}
          <View style={styles.initHeader}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#94a3b8" />
            </TouchableOpacity>
            <Text style={styles.initTitle}>EcoTrack AI Scanner</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={styles.initContent} showsVerticalScrollIndicator={false}>
            {/* Logo + Version */}
            <View style={styles.initLogo}>
              <View style={styles.initLogoRing}>
                <Text style={styles.initLogoEmoji}>🧬</Text>
              </View>
              <Text style={styles.initVersion}>Computer Vision Module v2.0</Text>
              <Text style={styles.initSubtitle}>AP-10K · 54 Species · 17 Anatomical Keypoints</Text>
            </View>

            {/* Model Cards */}
            <View style={styles.modelGrid}>
              {modelStatus.map((m, i) => (
                <View key={i} style={[styles.modelCard, {
                  borderColor: m.status === 'loaded' ? '#16a34a33'
                              : m.status === 'error' || m.status === 'missing' ? '#ef444433'
                              : '#334155',
                }]}>
                  <View style={styles.modelCardLeft}>
                    <View style={[styles.modelDot, {
                      backgroundColor:
                        m.status === 'loaded'  ? '#22c55e' :
                        m.status === 'error'   ? '#ef4444' :
                        m.status === 'missing' ? '#f59e0b' :
                        '#6366f1'
                    }]}>
                      {m.status === 'checking' && (
                        <ActivityIndicator size={10} color="#fff" />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modelName}>{m.name}</Text>
                      <Text style={styles.modelDetail} numberOfLines={2}>{m.detail}</Text>
                    </View>
                  </View>
                  <Text style={[styles.modelStatusBadge, {
                    color:
                      m.status === 'loaded'  ? '#22c55e' :
                      m.status === 'error'   ? '#ef4444' :
                      m.status === 'missing' ? '#f59e0b' :
                      '#6366f1',
                    borderColor:
                      m.status === 'loaded'  ? '#22c55e33' :
                      m.status === 'error'   ? '#ef444433' :
                      m.status === 'missing' ? '#f59e0b33' :
                      '#6366f133',
                  }]}>
                    {m.status === 'checking' ? 'LOADING' :
                     m.status === 'loaded'   ? 'READY' :
                     m.status === 'missing'  ? 'MISSING' : 'ERROR'}
                  </Text>
                </View>
              ))}
            </View>

            {/* Training notice for animal pose */}
            {modelStatus.find(m => m.name === 'Animal Pose (AP-10K)' && m.status === 'missing') && (
              <View style={styles.trainingNotice}>
                <Ionicons name="information-circle" size={20} color="#6366f1" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.trainingNoticeTitle}>Animal Pose Training Required</Text>
                  <Text style={styles.trainingNoticeText}>
                    Run the training pipeline to enable animal-specific 17-keypoint pose estimation for 54+ species.
                    {'\n\n'}{'$ python train_animal_pose.py --phase all'}
                    {'\n\n'}Download AP-10K dataset (10K images, 54 species) from GitHub first.
                    {'\n'}In the meantime, YOLOv8m-pose provides animal pose with AP-10K keypoint remapping.
                  </Text>
                </View>
              </View>
            )}

            {/* Actions */}
            <View style={styles.initActions}>
              <TouchableOpacity
                style={[styles.initBtn, !allModelsReady && !loadingModels && { opacity: 0.5 }]}
                onPress={loadingModels ? undefined : allModelsReady
                  ? () => setLoadingModels(false)
                  : () => Alert.alert(
                      'Critical Models Missing',
                      'The species detector or pose model failed to load. Start the AI service with: python backend/ai_service.py'
                    )
                }
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={allModelsReady ? ['#16a34a', '#15803d'] : ['#374151', '#1f2937']}
                  style={styles.initBtnGrad}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                >
                  <Ionicons
                    name={loadingModels ? 'reload' : allModelsReady ? 'scan' : 'warning'}
                    size={20} color="#fff"
                  />
                  <Text style={styles.initBtnText}>
                    {loadingModels ? 'Checking models…'
                      : allModelsReady ? 'Open Scanner'
                      : 'Models Missing — Check Service'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.recheckBtn} onPress={checkModelStatus}>
                <Ionicons name="refresh" size={16} color="#94a3b8" />
                <Text style={styles.recheckBtnText}>Recheck</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  // ── Active Scanner ─────────────────────────────────────────────────────────
  const { status, detection, keypoints, formScore, postureScore, repCount, fps,
          errorMessage, stepLabel, bodyVisible, missingRegions, poseSource,
          frameQuality, inferenceMs } = scanState;

  const exercises = getExercisesForSpecies(selectedSpecies);
  const selectedExercise = selectedExerciseId ? getExerciseById(selectedExerciseId) : null;

  const filteredSpecies = AP10K_SUPPORTED_SPECIES
    .filter(s => s.toLowerCase().includes(speciesSearch.toLowerCase()))
    .sort();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* ── Camera + Overlay ─────────────────────────────────────────── */}
      <View style={styles.cameraContainer}>
        {permission?.granted ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFillObject}
            facing={facing}
            zoom={0}
          />
        ) : (
          <View style={styles.noPermission}>
            <Ionicons name="videocam-off" size={48} color="#64748b" />
            <Text style={styles.noPermissionText}>Camera permission required</Text>
            <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
              <Text style={styles.permBtnText}>Grant Permission</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* SVG Overlay for bounding box + skeleton */}
        <Svg
          style={StyleSheet.absoluteFillObject}
          width={SW} height={SH}
          pointerEvents="none"
        >
          {renderBoundingBox()}
          {renderSkeleton()}
        </Svg>

        {/* Top HUD */}
        <View style={styles.hudTop}>
          <TouchableOpacity style={styles.hudBack} onPress={() => { stopScanning(); router.back(); }}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>

          <View style={styles.hudCenter}>
            <Animated.View style={[styles.statusDot, { transform: [{ scale: pulseAnim }], backgroundColor:
              status === 'SUCCESS' ? '#22c55e' :
              status === 'SPECIES_NOT_FOUND' || status === 'ERROR' ? '#ef4444' :
              status === 'BODY_INCOMPLETE' || status === 'QUALITY_FAIL' ? '#f59e0b' :
              '#6366f1'
            }]} />
            <Text style={styles.stepLabel} numberOfLines={1}>{stepLabel}</Text>
          </View>

          <View style={styles.hudRight}>
            <Text style={styles.hudFps}>{fps} fps</Text>
            <Text style={styles.hudMs}>{inferenceMs}ms</Text>
          </View>
        </View>

        {/* Bottom HUD */}
        <View style={styles.hudBottom}>
          {/* Error Banner */}
          {errorMessage && (
            <View style={[styles.errorBanner, {
              borderLeftColor:
                status === 'SPECIES_NOT_FOUND' ? '#ef4444' :
                status === 'BODY_INCOMPLETE' ? '#f59e0b' : '#6366f1'
            }]}>
              <Ionicons name="warning" size={16} color={
                status === 'SPECIES_NOT_FOUND' ? '#ef4444' :
                status === 'BODY_INCOMPLETE' ? '#f59e0b' : '#6366f1'
              } />
              <Text style={styles.errorBannerText} numberOfLines={3}>{errorMessage}</Text>
            </View>
          )}

          {/* Stats row */}
          {status === 'SUCCESS' && (
            <View style={styles.statsRow}>
              <View style={styles.statChip}>
                <Text style={styles.statValue}>{repCount}</Text>
                <Text style={styles.statLabel}>Reps</Text>
              </View>
              <View style={styles.statChip}>
                <Text style={[styles.statValue, { color:
                  formScore >= 80 ? '#22c55e' :
                  formScore >= 60 ? '#f59e0b' : '#ef4444'
                }]}>{formScore}%</Text>
                <Text style={styles.statLabel}>Form</Text>
              </View>
              <View style={styles.statChip}>
                <Text style={styles.statValue}>{postureScore}%</Text>
                <Text style={styles.statLabel}>Posture</Text>
              </View>
              <View style={styles.statChip}>
                <Text style={styles.statValue}>{frameQuality}%</Text>
                <Text style={styles.statLabel}>Quality</Text>
              </View>
            </View>
          )}

          {/* Pose source badge */}
          {poseSource && (
            <View style={styles.poseSourceBadge}>
              <Ionicons name="information-circle-outline" size={12} color="#6366f1" />
              <Text style={styles.poseSourceText}>
                {poseSource === 'mediapipe_blazepose' ? 'MediaPipe BlazePose (COCO-17)' :
                 poseSource === 'rtmpose_ap10k'       ? 'RTMPose-M AP-10K (17 kpts)' :
                 poseSource === 'animal_pose_finetuned' ? 'Fine-tuned Animal Pose (AP-10K)' :
                 poseSource === 'yolov8_ap10k_remap'  ? 'YOLOv8 + AP-10K Remap (17 kpts)' :
                 poseSource}
              </Text>
            </View>
          )}

          {/* Controls */}
          <View style={styles.controls}>
            {/* Species */}
            <TouchableOpacity style={styles.controlChip} onPress={() => setShowSpeciesModal(true)}>
              <Ionicons name="paw" size={14} color="#a78bfa" />
              <Text style={styles.controlChipText}>{selectedSpecies}</Text>
              <Ionicons name="chevron-down" size={12} color="#64748b" />
            </TouchableOpacity>

            {/* Exercise */}
            <TouchableOpacity style={styles.controlChip} onPress={() => setShowExerciseModal(true)}>
              <Ionicons name="fitness" size={14} color="#22c55e" />
              <Text style={styles.controlChipText} numberOfLines={1}>
                {selectedExercise?.name || 'Select exercise'}
              </Text>
              <Ionicons name="chevron-down" size={12} color="#64748b" />
            </TouchableOpacity>

            {/* Flip camera */}
            <TouchableOpacity style={styles.iconBtn} onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}>
              <Ionicons name="camera-reverse-outline" size={20} color="#94a3b8" />
            </TouchableOpacity>

            {/* Upload */}
            <TouchableOpacity style={styles.iconBtn} onPress={handleUploadImage}>
              <Ionicons name="image-outline" size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Scan button */}
          <View style={styles.scanBtnRow}>
            {isScanning ? (
              <View style={styles.scanningBtns}>
                <TouchableOpacity style={styles.finishBtn} onPress={finishScan}>
                  <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                  <Text style={styles.finishBtnText}>Finish & Report</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.stopBtn} onPress={stopScanning}>
                  <Ionicons name="stop-circle" size={18} color="#ef4444" />
                  <Text style={styles.stopBtnText}>Stop</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.scanBtn} onPress={startScanning} activeOpacity={0.85}>
                <LinearGradient
                  colors={['#16a34a', '#15803d']}
                  style={styles.scanBtnGrad}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="scan" size={22} color="#fff" />
                  <Text style={styles.scanBtnText}>Start AI Scan</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* ── Species Modal ─────────────────────────────────────────────── */}
      <Modal visible={showSpeciesModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Species</Text>
              <TouchableOpacity onPress={() => setShowSpeciesModal(false)}>
                <Ionicons name="close" size={22} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalSearch}
              placeholder="Search species..."
              placeholderTextColor="#4b5563"
              value={speciesSearch}
              onChangeText={setSpeciesSearch}
              autoCapitalize="none"
            />
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              {filteredSpecies.map(sp => {
                const hasSkeleton = getSkeletonForSpecies(sp) !== null;
                return (
                  <TouchableOpacity
                    key={sp}
                    style={[styles.speciesItem, selectedSpecies === sp && styles.speciesItemActive]}
                    onPress={() => { setSelectedSpecies(sp); setShowSpeciesModal(false); setSpeciesSearch(''); }}
                  >
                    <View>
                      <Text style={[styles.speciesName, selectedSpecies === sp && { color: '#22c55e' }]}>
                        {sp.charAt(0).toUpperCase() + sp.slice(1)}
                      </Text>
                      <Text style={styles.speciesScheme}>
                        {sp === 'human' ? 'COCO-17 · MediaPipe BlazePose' : 'AP-10K-17 · RTMPose-M'}
                      </Text>
                    </View>
                    {hasSkeleton
                      ? <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                      : <Ionicons name="alert-circle" size={16} color="#f59e0b" />
                    }
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Exercise Modal ───────────────────────────────────────────── */}
      <Modal visible={showExerciseModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Exercise</Text>
              <TouchableOpacity onPress={() => setShowExerciseModal(false)}>
                <Ionicons name="close" size={22} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              <TouchableOpacity
                style={[styles.speciesItem, !selectedExerciseId && styles.speciesItemActive]}
                onPress={() => { setSelectedExerciseId(''); setShowExerciseModal(false); }}
              >
                <Text style={styles.speciesName}>Free Pose Scan (no exercise)</Text>
              </TouchableOpacity>
              {exercises.map(ex => (
                <TouchableOpacity
                  key={ex.id}
                  style={[styles.speciesItem, selectedExerciseId === ex.id && styles.speciesItemActive]}
                  onPress={() => { setSelectedExerciseId(ex.id); setShowExerciseModal(false); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.speciesName, selectedExerciseId === ex.id && { color: '#22c55e' }]}>
                      {ex.name}
                    </Text>
                    <Text style={styles.speciesScheme}>{ex.description}</Text>
                  </View>
                  {selectedExerciseId === ex.id && (
                    <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
function getStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: '#000' },

    // ── Camera ──────────────────────────────────────────────────────────
    cameraContainer: { flex: 1, position: 'relative' },
    noPermission: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0f1e' },
    noPermissionText: { color: '#94a3b8', marginTop: 16, fontSize: 15 },
    permBtn: { marginTop: 20, backgroundColor: '#16a34a', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
    permBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

    // ── HUD Top ─────────────────────────────────────────────────────────
    hudTop: {
      position: 'absolute', top: 0, left: 0, right: 0,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingTop: 48, paddingHorizontal: 16, paddingBottom: 12,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    hudBack: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.1)',
      alignItems: 'center', justifyContent: 'center',
    },
    hudCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    stepLabel: { color: '#e2e8f0', fontSize: 13, fontWeight: '600', maxWidth: 200 },
    hudRight: { alignItems: 'flex-end' },
    hudFps: { color: '#22c55e', fontSize: 13, fontWeight: '800' },
    hudMs: { color: '#64748b', fontSize: 10, marginTop: 2 },

    // ── HUD Bottom ──────────────────────────────────────────────────────
    hudBottom: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
      padding: 16, paddingBottom: 32,
      backdropFilter: 'blur(12px)',
    },
    errorBanner: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, padding: 12,
      borderLeftWidth: 3, marginBottom: 10,
    },
    errorBannerText: { flex: 1, color: '#e2e8f0', fontSize: 13, lineHeight: 18 },

    statsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    statChip: {
      flex: 1, backgroundColor: 'rgba(255,255,255,0.06)',
      borderRadius: 10, padding: 10, alignItems: 'center',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    statValue: { color: '#f8fafc', fontSize: 18, fontWeight: '900' },
    statLabel: { color: '#64748b', fontSize: 11, marginTop: 2 },

    poseSourceBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8,
      backgroundColor: 'rgba(99,102,241,0.1)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
      alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)',
    },
    poseSourceText: { color: '#818cf8', fontSize: 11 },

    controls: { flexDirection: 'row', gap: 8, marginBottom: 12, alignItems: 'center' },
    controlChip: {
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    controlChipText: { flex: 1, color: '#e2e8f0', fontSize: 12, fontWeight: '600' },
    iconBtn: {
      width: 40, height: 40, borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.06)',
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },

    scanBtnRow: { alignItems: 'center' },
    scanBtn: { width: '100%', borderRadius: 16, overflow: 'hidden' },
    scanBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
    scanBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

    scanningBtns: { flexDirection: 'row', gap: 10, width: '100%' },
    finishBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: 'rgba(34,197,94,0.15)', borderRadius: 14, paddingVertical: 14,
      borderWidth: 1.5, borderColor: '#22c55e44',
    },
    finishBtnText: { color: '#22c55e', fontWeight: '700', fontSize: 14 },
    stopBtn: {
      width: 80, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 14, paddingVertical: 14,
      borderWidth: 1.5, borderColor: '#ef444433',
    },
    stopBtnText: { color: '#ef4444', fontWeight: '700', fontSize: 13 },

    // ── Init / Loading ───────────────────────────────────────────────────
    initContainer: { flex: 1 },
    initHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.06)',
      alignItems: 'center', justifyContent: 'center',
    },
    initTitle: { color: '#f8fafc', fontSize: 17, fontWeight: '800' },
    initContent: { paddingHorizontal: 20, paddingBottom: 40 },
    initLogo: { alignItems: 'center', paddingVertical: 32 },
    initLogoRing: {
      width: 80, height: 80, borderRadius: 40,
      backgroundColor: 'rgba(22,163,74,0.15)',
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: 'rgba(22,163,74,0.3)',
      marginBottom: 16,
    },
    initLogoEmoji: { fontSize: 36 },
    initVersion: { color: '#f8fafc', fontSize: 16, fontWeight: '700', marginBottom: 4 },
    initSubtitle: { color: '#64748b', fontSize: 12, textAlign: 'center' },

    modelGrid: { gap: 10, marginBottom: 20 },
    modelCard: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderRadius: 14, padding: 14, borderWidth: 1,
    },
    modelCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    modelDot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    modelName: { color: '#e2e8f0', fontSize: 13, fontWeight: '700', marginBottom: 3 },
    modelDetail: { color: '#64748b', fontSize: 11, lineHeight: 16 },
    modelStatusBadge: {
      fontSize: 10, fontWeight: '800', letterSpacing: 0.5,
      borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
    },

    trainingNotice: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 0,
      backgroundColor: 'rgba(99,102,241,0.08)',
      borderRadius: 14, padding: 16, marginBottom: 20,
      borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)',
    },
    trainingNoticeTitle: { color: '#818cf8', fontWeight: '700', fontSize: 13, marginBottom: 6 },
    trainingNoticeText: { color: '#94a3b8', fontSize: 12, lineHeight: 18, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace' },

    initActions: { gap: 10 },
    initBtn: { borderRadius: 16, overflow: 'hidden' },
    initBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
    initBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
    recheckBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 12, borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    recheckBtnText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },

    // ── Modals ───────────────────────────────────────────────────────────
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: '#0f172a', borderTopLeftRadius: 24, borderTopRightRadius: 24,
      maxHeight: SH * 0.75, padding: 20,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    modalTitle: { color: '#f8fafc', fontSize: 17, fontWeight: '800' },
    modalSearch: {
      backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
      paddingHorizontal: 14, paddingVertical: 10,
      color: '#e2e8f0', fontSize: 14,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
      marginBottom: 12,
    },
    speciesItem: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 12, paddingHorizontal: 4,
      borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    speciesItemActive: { backgroundColor: 'rgba(22,163,74,0.08)', borderRadius: 10, paddingHorizontal: 10 },
    speciesName: { color: '#e2e8f0', fontSize: 14, fontWeight: '600' },
    speciesScheme: { color: '#4b5563', fontSize: 11, marginTop: 2 },
  });
}
