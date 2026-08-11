/**
 * scanner/index.tsx — EcoTrack AI Scanner (Production CV Module)
 * ─────────────────────────────────────────────────────────────────────────────
 * Completely audited and fixed:
 *  - Removed live webcam/camera.
 *  - File upload only (supporting videos up to 500MB).
 *  - Real progress tracking + cancel option (via XMLHttpRequest).
 *  - Resizable panel using a corner drag handle.
 *  - Full UI states: loading, error, empty, cancel, success.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  ScrollView, Modal, TextInput, Animated, StatusBar,
  SafeAreaView, Platform, ActivityIndicator, Alert, PanResponder, Image
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { FontSize, Radius, Shadow } from '@/constants/theme';
import { getExercisesForSpecies, getExerciseById } from '../../lib/exerciseTemplates';
import { analyzeAllJoints } from '../../lib/jointAnalysis';
import { generateDetailedReport } from '../../lib/reportGenerator';

import { fetchTaxonomySpecies, saveScanFull } from '../../services/api';

const { width: SW, height: SH } = Dimensions.get('window');

interface ModelLoadStatus {
  name: string;
  status: 'checking' | 'loaded' | 'missing' | 'error';
  detail: string;
}

export default function AIScannerScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const params = useLocalSearchParams<{ species?: string; exerciseId?: string }>();

  // Auth
  const [userId, setUserId] = useState<string | null>(null);

  // File Upload & Progress State
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [reports, setReports] = useState<any[]>([]);
  const [selectedReportIdx, setSelectedReportIdx] = useState<number>(0);
  const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR' | 'CANCEL'>('IDLE');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  // Model loading
  const [modelStatus, setModelStatus] = useState<ModelLoadStatus[]>([]);
  const [allModelsReady, setAllModelsReady] = useState(false);
  const [loadingModels, setLoadingModels] = useState(true);

  // Species & Exercise selection
  const [selectedSpecies, setSelectedSpecies] = useState(params.species || 'human');
  const [selectedExerciseId, setSelectedExerciseId] = useState(params.exerciseId || '');
  const [showSpeciesModal, setShowSpeciesModal] = useState(false);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [speciesSearch, setSpeciesSearch] = useState('');

  // Resizable Panel States
  const [panelSize, setPanelSize] = useState({ width: SW - 32, height: 280 });

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
      { name: 'Species Detector', status: 'checking', detail: 'YOLOv8n — 80 COCO classes' },
      { name: 'Human Pose (MediaPipe)', status: 'checking', detail: 'BlazePose 33-landmark' },
      { name: 'YOLOv8 Pose', status: 'checking', detail: 'COCO-17 human + animals' },
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

      models[0].status = ms.yolov8_detector?.loaded ? 'loaded' : 'missing';
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

      const criticalReady = models[0].status === 'loaded' &&
        (models[1].status === 'loaded' || models[2].status === 'loaded');

      setAllModelsReady(criticalReady);
      setModelStatus([...models]);
    } catch (err: any) {
      models.forEach(m => {
        m.status = 'error';
        m.detail = 'Backend AI service not running. Start with: python ai_service.py';
      });
      setModelStatus([...models]);
      setAllModelsReady(false);
    }
    setLoadingModels(false);
  }, []);

  // ── File Selection ────────────────────────────────────────────────────────
  const handleSelectVideo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 1.0,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];

      // Validate max file size (500MB)
      const sizeBytes = asset.fileSize || 0;
      const maxBytes = 500 * 1024 * 1024;
      if (sizeBytes > maxBytes) {
        Alert.alert("File Too Large", "Please upload a video file under 500MB.");
        return;
      }

      setSelectedVideo(asset);
      setReports([]);
      setStatus('IDLE');
      setErrorMsg(null);
    } catch (e: any) {
      Alert.alert("Error picking video", e.message);
    }
  };

  // ── Multipart Video Upload & CV Analysis ──────────────────────────────────
  const handleStartAnalysis = () => {
    if (!selectedVideo) return;

    setStatus('LOADING');
    setIsProcessing(true);
    setUploadProgress(0);
    setErrorMsg(null);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    // Use Express backend proxy which supports streaming multipart
    xhr.open('POST', 'http://localhost:5000/api/ai/process-video');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percent);
      }
    };

    xhr.onload = async () => {
      setIsProcessing(false);
      if (xhr.status === 200) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.success && res.reports && res.reports.length > 0) {
            const exTemplate = getExerciseById(selectedExerciseId) || {
              id: 'free_scan',
              name: 'Free Scan',
              description: 'Free scan',
              joint_angles: {},
              critical_joints: [],
              completion_reps: 5
            };

            const compiledReports = res.reports.map((r: any) => {
              const jointAnalysis = analyzeAllJoints(
                r.jointAngles || {},
                (exTemplate.joint_angles || {}) as any,
                exTemplate.critical_joints || [],
                selectedSpecies
              );

              return generateDetailedReport({
                scanId: r.scanId,
                timestamp: r.timestamp,
                analysisSource: 'backend_ai',
                detectedSpecies: selectedSpecies,
                detectedBreed: null,
                detectionConfidence: r.detectionConfidence,
                exerciseTemplate: exTemplate as any,
                jointAnalysis,
                measuredAngles: r.jointAngles || {},
                keypoints: r.keypoints || [],
                repCount: r.repsCompleted || 0,
                exerciseDurationSec: r.duration || 0,
              });
            });

            setReports(compiledReports);
            setSelectedReportIdx(0);
            setStatus('SUCCESS');

            // Auto-update user progress via training sync API
            for (const report of compiledReports) {
              await saveScanFull({
                ...report,
                user_id: userId || 'anonymous'
              }).catch(() => console.warn("Failed to sync progress to database"));
            }
          } else {
            setStatus('ERROR');
            setErrorMsg("No target species detected in the video.");
          }
        } catch (e) {
          setStatus('ERROR');
          setErrorMsg("Failed to parse analysis results.");
        }
      } else {
        setStatus('ERROR');
        setErrorMsg(`Server responded with status ${xhr.status}`);
      }
    };

    xhr.onerror = () => {
      setIsProcessing(false);
      setStatus('ERROR');
      setErrorMsg("Network error occurred during upload.");
    };

    const formData = new FormData();
    formData.append('video', {
      uri: selectedVideo.uri,
      type: 'video/mp4',
      name: 'scan_video.mp4'
    } as any);
    formData.append('species', selectedSpecies);
    formData.append('exercise_id', selectedExerciseId);
    formData.append('user_id', userId || 'anonymous');

    xhr.send(formData);
  };

  const handleCancel = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setIsProcessing(false);
    setStatus('CANCEL');
    setUploadProgress(0);
  };

  const handleViewReport = (report: any) => {
    router.push({
      pathname: '/scanReport',
      params: { data: JSON.stringify(report) }
    });
  };

  // ── PanResponder for Panel Resizing ───────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        setPanelSize(prev => ({
          width: Math.max(200, Math.min(SW - 32, prev.width + gestureState.dx)),
          height: Math.max(150, Math.min(SH * 0.6, prev.height - gestureState.dy)),
        }));
      },
    })
  ).current;

  const exercises = getExercisesForSpecies(selectedSpecies);
  const selectedExercise = selectedExerciseId ? getExerciseById(selectedExerciseId) : null;
  const filteredSpecies = ['human', 'dog', 'cat', 'horse', 'bird', 'sheep', 'cow'];

  if (loadingModels || !allModelsReady) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0f1e" />
        <LinearGradient colors={['#0a0f1e', '#0f1a2e', '#0d1b38']} style={StyleSheet.absoluteFillObject} />
        <SafeAreaView style={styles.initContainer}>
          <View style={styles.initHeader}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#94a3b8" />
            </TouchableOpacity>
            <Text style={styles.initTitle}>EcoTrack AI Scanner</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView contentContainerStyle={styles.initContent} showsVerticalScrollIndicator={false}>
            <View style={styles.initLogo}>
              <View style={styles.initLogoRing}>
                <Text style={styles.initLogoEmoji}>🧬</Text>
              </View>
              <Text style={styles.initVersion}>Computer Vision Module v3.0</Text>
              <Text style={styles.initSubtitle}>Multipart streaming upload & Frame-by-Frame CV</Text>
            </View>
            <View style={styles.modelGrid}>
              {modelStatus.map((m, i) => (
                <View key={i} style={[styles.modelCard, { borderColor: m.status === 'loaded' ? '#16a34a33' : '#ef444433' }]}>
                  <View style={styles.modelCardLeft}>
                    <View style={[styles.modelDot, { backgroundColor: m.status === 'loaded' ? '#22c55e' : '#ef4444' }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modelName}>{m.name}</Text>
                      <Text style={styles.modelDetail}>{m.detail}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
            <TouchableOpacity style={styles.recheckBtn} onPress={checkModelStatus}>
              <Ionicons name="refresh" size={16} color="#94a3b8" />
              <Text style={styles.recheckBtnText}>Recheck</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#94a3b8" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>AI Video Scanner</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Large Preview Area */}
        <View style={styles.previewContainer}>
          {selectedVideo ? (
            <Video
              source={{ uri: selectedVideo.uri }}
              style={StyleSheet.absoluteFillObject}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              isLooping
            />
          ) : (
            <TouchableOpacity style={styles.placeholderContainer} onPress={handleSelectVideo}>
              <Ionicons name="cloud-upload" size={64} color={colors.primary} />
              <Text style={styles.placeholderText}>Tap to select a video file</Text>
              <Text style={styles.placeholderSub}>MP4 formats up to 500MB supported</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Resizable Control Panel */}
        <View style={[styles.resizePanel, { width: panelSize.width, height: panelSize.height }]}>
          <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
            <View style={styles.controlsRow}>
              {/* Species */}
              <TouchableOpacity style={styles.controlChip} onPress={() => setShowSpeciesModal(true)}>
                <Ionicons name="paw" size={14} color="#a78bfa" />
                <Text style={styles.controlChipText}>{selectedSpecies}</Text>
              </TouchableOpacity>

              {/* Exercise */}
              <TouchableOpacity style={styles.controlChip} onPress={() => setShowExerciseModal(true)}>
                <Ionicons name="fitness" size={14} color="#22c55e" />
                <Text style={styles.controlChipText} numberOfLines={1}>
                  {selectedExercise?.name || 'Select exercise'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Select video button */}
            <TouchableOpacity style={styles.uploadBtn} onPress={handleSelectVideo}>
              <Ionicons name="videocam" size={20} color="#fff" />
              <Text style={styles.uploadBtnText}>{selectedVideo ? "Change Video File" : "Select Video File"}</Text>
            </TouchableOpacity>

            {/* UI States */}
            {status === 'LOADING' && (
              <View style={styles.stateBox}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.stateText}>Uploading & Analyzing: {uploadProgress}%</Text>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${uploadProgress}%` }]} />
                </View>
                <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}

            {status === 'ERROR' && (
              <View style={styles.stateBox}>
                <Ionicons name="alert-circle" size={24} color="#ef4444" />
                <Text style={styles.errorText}>{errorMsg || "An error occurred."}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={handleStartAnalysis}>
                  <Text style={styles.retryBtnText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {status === 'CANCEL' && (
              <View style={styles.stateBox}>
                <Ionicons name="close-circle" size={24} color="#f59e0b" />
                <Text style={styles.stateText}>Analysis cancelled by user.</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={handleStartAnalysis}>
                  <Text style={styles.retryBtnText}>Start Again</Text>
                </TouchableOpacity>
              </View>
            )}

            {status === 'SUCCESS' && reports.length > 0 && (
              <View style={styles.stateBox}>
                <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                <Text style={styles.stateText}>Detected {reports.length} tracked targets:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
                  {reports.map((rep, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.targetChip, selectedReportIdx === idx && styles.targetChipActive]}
                      onPress={() => setSelectedReportIdx(idx)}
                    >
                      <Text style={[styles.targetChipText, selectedReportIdx === idx && { color: '#fff' }]}>
                        {rep.targetId}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity
                  style={styles.viewReportBtn}
                  onPress={() => handleViewReport(reports[selectedReportIdx])}
                >
                  <Text style={styles.viewReportBtnText}>View Detailed Report</Text>
                </TouchableOpacity>
              </View>
            )}

            {selectedVideo && status === 'IDLE' && (
              <TouchableOpacity style={styles.analyzeBtn} onPress={handleStartAnalysis}>
                <Text style={styles.analyzeBtnText}>Start Frame-by-Frame CV Analysis</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Corner Resize Handle */}
          <View style={styles.resizeHandle} {...panResponder.panHandlers}>
            <Ionicons name="resize" size={16} color="#64748b" />
          </View>
        </View>
      </SafeAreaView>

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
              {filteredSpecies.map(sp => (
                <TouchableOpacity
                  key={sp}
                  style={[styles.speciesItem, selectedSpecies === sp && styles.speciesItemActive]}
                  onPress={() => { setSelectedSpecies(sp); setShowSpeciesModal(false); setSpeciesSearch(''); }}
                >
                  <Text style={styles.speciesName}>{sp.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
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
                  <Text style={styles.speciesName}>{ex.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: '#020617' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
    headerTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '800' },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
    previewContainer: { flex: 1, margin: 16, borderRadius: Radius.xl, overflow: 'hidden', backgroundColor: '#0b0f19', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
    placeholderContainer: { alignItems: 'center', justifyContent: 'center' },
    placeholderText: { color: '#94a3b8', fontSize: 16, fontWeight: '700', marginTop: 12 },
    placeholderSub: { color: '#475569', fontSize: 12, marginTop: 4 },
    resizePanel: { position: 'absolute', bottom: 16, right: 16, backgroundColor: '#0f172a', borderRadius: Radius.xl, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', ...Shadow.md },
    resizeHandle: { position: 'absolute', bottom: 4, right: 4, padding: 8 },
    controlsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    controlChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, paddingVertical: 10 },
    controlChipText: { color: '#e2e8f0', fontSize: 12, fontWeight: '600' },
    uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingVertical: 12, marginBottom: 12 },
    uploadBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    analyzeBtn: { backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    analyzeBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
    stateBox: { backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 12, alignItems: 'center', width: '100%' },
    stateText: { color: '#cbd5e1', fontSize: 13, marginTop: 4, textAlign: 'center' },
    progressBarBg: { width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, marginVertical: 8, overflow: 'hidden' },
    progressBarFill: { height: '100%', backgroundColor: '#22c55e' },
    cancelBtn: { marginTop: 8, paddingVertical: 6, paddingHorizontal: 16, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.1)' },
    cancelBtnText: { color: '#ef4444', fontSize: 12, fontWeight: '700' },
    errorText: { color: '#ef4444', fontSize: 13, textAlign: 'center', marginVertical: 8 },
    retryBtn: { backgroundColor: 'rgba(255,255,255,0.08)', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
    retryBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    targetChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', marginRight: 6 },
    targetChipActive: { backgroundColor: '#16a34a' },
    targetChipText: { color: '#94a3b8', fontSize: 12, fontWeight: '700' },
    viewReportBtn: { backgroundColor: '#16a34a', width: '100%', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
    viewReportBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
    initContainer: { flex: 1 },
    initHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12 },
    initTitle: { color: '#f8fafc', fontSize: 17, fontWeight: '800' },
    initContent: { paddingHorizontal: 16, paddingBottom: 40 },
    initLogo: { alignItems: 'center', paddingVertical: 24 },
    initLogoRing: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(22,163,74,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(22,163,74,0.3)', marginBottom: 12 },
    initLogoEmoji: { fontSize: 36 },
    initVersion: { color: '#f8fafc', fontSize: 16, fontWeight: '700', marginBottom: 4 },
    initSubtitle: { color: '#64748b', fontSize: 12, textAlign: 'center' },
    modelGrid: { gap: 10, marginBottom: 20 },
    modelCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14, borderWidth: 1 },
    modelCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    modelDot: { width: 12, height: 12, borderRadius: 6 },
    modelName: { color: '#e2e8f0', fontSize: 13, fontWeight: '700', marginBottom: 3 },
    modelDetail: { color: '#64748b', fontSize: 11 },
    recheckBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    recheckBtnText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: '#0f172a', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: SH * 0.6, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    modalTitle: { color: '#f8fafc', fontSize: 17, fontWeight: '800' },
    modalSearch: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: '#e2e8f0', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 12 },
    speciesItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    speciesItemActive: { backgroundColor: 'rgba(22,163,74,0.08)', borderRadius: 10, paddingHorizontal: 10 },
    speciesName: { color: '#e2e8f0', fontSize: 14, fontWeight: '600' },
  });
}
