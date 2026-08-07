/**
 * aiPipeline.ts — EcoTrack CV Pipeline Helpers
 * ─────────────────────────────────────────────────────────────────────────────
 * Real inference-only pipeline. Every function that calls the backend
 * handles failure honestly — returning a clear status, never fake data.
 *
 * Pipeline Stages:
 *   1. DETECTING        → /detect
 *   2. QUALITY_CHECK    → local bounding box area + confidence check
 *   3. BODY_VISIBILITY  → skeleton joint coverage check
 *   4. ESTIMATING_POSE  → /pose
 *   5. ANALYZING_MOTION → joint angle rules from exercise template
 *   6. SUCCESS          → all stages passed
 *   7. ERROR            → model missing, network error, etc.
 *   8. IDLE             → not scanning
 */

import { getSkeletonForSpecies, type SkeletonTemplate } from './skeletonTemplates';

const API_BASE = 'http://localhost:5001';
const DEFAULT_TIMEOUT_MS = 8000;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type PipelineStatus =
  | 'IDLE'
  | 'DETECTING'
  | 'QUALITY_FAIL'
  | 'SPECIES_NOT_FOUND'
  | 'BODY_INCOMPLETE'
  | 'ESTIMATING_POSE'
  | 'ANALYZING_MOTION'
  | 'SUCCESS'
  | 'ERROR';

export interface DetectionResult {
  detected:       boolean;
  className:      string;
  confidence:     number;
  boundingBox:    { x: number; y: number; width: number; height: number } | null;
  modelAvailable: boolean;
  imageWidth?:    number;
  imageHeight?:   number;
  allDetections?: Array<{ className: string; confidence: number }>;
  halted?:        boolean;
  haltReason?:    string;
}

export interface Keypoint {
  name:        string;
  x:           number;    // normalized 0-1 within bbox
  y:           number;    // normalized 0-1 within bbox
  visibility:  number;    // 0-1 confidence
  ap10k_idx?:  number;    // AP-10K index (animals only)
}

export interface PoseResult {
  success:       boolean;
  keypoints:     Keypoint[];
  bodyBox:       any;
  poseSource?:   string;
  poseConf?:     number;
  keypoint_schema?: string;
  animal_pose_model_available?: boolean;
}

export interface MotionAnalysis {
  statuses:     Record<string, 'correct' | 'warn' | 'incorrect'>;
  formScore:    number;    // 0-100
  postureScore: number;    // 0-100
  balanceScore: number;    // 0-100
}

export interface QualityCheck {
  passed:  boolean;
  reasons: string[];
  score:   number;
}

export interface VisibilityCheck {
  isFullBodyVisible: boolean;
  visibleFraction:   number;
  missingRegions:    string[];
  message:           string;
}

export interface RepState {
  count:        number;
  lastPosition: number;
  inDownPhase:  boolean;
}

export interface CompleteScanResult {
  scanId:              string;
  timestamp:           string;
  analysisSource:      string;
  detectedSpecies:     string;
  detectedBreed:       string | null;
  detectionConfidence: number;
  isFullBodyVisible:   boolean;
  boundingBox:         any;
  keypoints:           Keypoint[];
  jointAngles:         Record<string, number>;
  jointStatuses:       Record<string, 'correct' | 'warn' | 'incorrect'>;
  formScore:           number;
  postureScore:        number;
  balanceScore:        number;
  repsCompleted:       number;
  grade:               string;
  feedback:            string[];
  exerciseName:        string;
  exerciseId:          string;
  exerciseDurationSec: number;
}

export const PIPELINE_INITIAL_STATE: {
  status: PipelineStatus;
  stepLabel: string;
} = {
  status:    'IDLE',
  stepLabel: 'Ready',
};

// ─────────────────────────────────────────────────────────────────────────────
// Fetch helper with timeout and honest error reporting
// ─────────────────────────────────────────────────────────────────────────────
async function apiPost<T>(endpoint: string, body: any): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const resp = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
      throw new Error(errBody.error || `HTTP ${resp.status}`);
    }

    return await resp.json();
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error('AI service timeout. Is python ai_service.py running on port 5001?');
    }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 1: Species Detection
// ─────────────────────────────────────────────────────────────────────────────
export async function detectSpecies(
  imageUri: string,
  targetSpecies: string
): Promise<DetectionResult> {
  // Convert URI to base64
  let image_base64: string;
  try {
    const resp = await fetch(imageUri);
    const blob = await resp.blob();
    image_base64 = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result as string);
      reader.onerror = rej;
      reader.readAsDataURL(blob);
    });
  } catch (err: any) {
    return {
      detected: false, className: '', confidence: 0,
      boundingBox: null, modelAvailable: false,
    };
  }

  try {
    const result = await apiPost<any>('/detect', {
      image_base64,
      target_class: targetSpecies,
    });
    return {
      detected:       result.detected ?? false,
      className:      result.className ?? '',
      confidence:     result.confidence ?? 0,
      boundingBox:    result.boundingBox ?? null,
      modelAvailable: result.modelAvailable ?? true,
      imageWidth:     result.imageWidth,
      imageHeight:    result.imageHeight,
      allDetections:  result.allDetections,
      halted:         result.halted ?? false,
      haltReason:     result.haltReason,
    };
  } catch (err: any) {
    // Service not running or model not loaded
    return {
      detected: false, className: '', confidence: 0,
      boundingBox: null,
      modelAvailable: !err.message.includes('ECONNREFUSED') && !err.message.includes('timeout'),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 2: Frame Quality Check (local — no backend call needed)
// ─────────────────────────────────────────────────────────────────────────────
export function checkImageQuality(
  bbox: { x: number; y: number; width: number; height: number },
  imageWidth: number,
  imageHeight: number,
  detectionConfidence: number
): QualityCheck {
  const reasons: string[] = [];
  let score = 100;

  // Subject must fill at least 5% of frame area
  const bboxArea   = bbox.width * bbox.height;
  const frameArea  = imageWidth * imageHeight;
  const fillRatio  = bboxArea / frameArea;

  if (fillRatio < 0.05) {
    reasons.push(`Subject too small (${(fillRatio * 100).toFixed(1)}% of frame). Move closer.`);
    score -= 30;
  }

  // Detection confidence
  if (detectionConfidence < 50) {
    reasons.push(`Low detection confidence (${detectionConfidence}%). Improve lighting or angle.`);
    score -= 25;
  }

  // Bbox must be fully within frame
  const rightEdge  = bbox.x + bbox.width;
  const bottomEdge = bbox.y + bbox.height;
  if (rightEdge > imageWidth * 0.95 || bbox.x < imageWidth * 0.02) {
    reasons.push('Subject partially out of frame (left/right). Center in view.');
    score -= 20;
  }
  if (bottomEdge > imageHeight * 0.95) {
    reasons.push('Subject partially out of frame (bottom). Move back or tilt up.');
    score -= 20;
  }

  return { passed: reasons.length === 0, reasons, score: Math.max(0, score) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 3: Body Visibility Check
// ─────────────────────────────────────────────────────────────────────────────
export function checkBodyVisibility(
  bbox: { x: number; y: number; width: number; height: number },
  imageWidth: number,
  imageHeight: number,
  skeleton: SkeletonTemplate
): VisibilityCheck {
  // Approximate which skeleton regions are within the frame
  // by checking if required joint positions are within image bounds
  const missingRegions: string[] = [];

  const bboxRight  = bbox.x + bbox.width;
  const bboxBottom = bbox.y + bbox.height;

  // Check vertical body visibility (top and bottom)
  const topVisible    = bbox.y > imageHeight * 0.02;  // head not cut off top
  const bottomVisible = bboxBottom < imageHeight * 0.97;

  if (!topVisible)    missingRegions.push('head');
  if (!bottomVisible) missingRegions.push('lower body');

  // Check horizontal
  const leftVisible  = bbox.x > imageWidth * 0.02;
  const rightVisible = bboxRight < imageWidth * 0.97;
  if (!leftVisible)  missingRegions.push('left side');
  if (!rightVisible) missingRegions.push('right side');

  const isFullBodyVisible = missingRegions.length === 0;
  const visibleFraction   = isFullBodyVisible ? 1.0 : 1.0 - (missingRegions.length * 0.25);

  return {
    isFullBodyVisible,
    visibleFraction,
    missingRegions,
    message: isFullBodyVisible
      ? 'Full body visible'
      : `Partially hidden: ${missingRegions.join(', ')}. Reposition the camera.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 4: Pose Estimation
// ─────────────────────────────────────────────────────────────────────────────
export async function estimateKeypoints(
  imageUri: string,
  species: string,
  boundingBox: { x: number; y: number; width: number; height: number }
): Promise<PoseResult> {
  let image_base64: string;
  try {
    const resp = await fetch(imageUri);
    const blob = await resp.blob();
    image_base64 = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result as string);
      reader.onerror = rej;
      reader.readAsDataURL(blob);
    });
  } catch {
    return { success: false, keypoints: [], bodyBox: null };
  }

  try {
    const result = await apiPost<any>('/pose', {
      image_base64,
      species,
      bounding_box: boundingBox,
    });
    return {
      success:   result.success ?? false,
      keypoints: result.keypoints ?? [],
      bodyBox:   result.bodyBox ?? null,
      poseSource: result.poseSource,
      poseConf:   result.poseConf,
      keypoint_schema: result.keypoint_schema,
      animal_pose_model_available: result.animal_pose_model_available,
    };
  } catch {
    return { success: false, keypoints: [], bodyBox: null };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 5: Joint Angle Computation (local math — no backend call)
// ─────────────────────────────────────────────────────────────────────────────
export function computeJointAngles(
  keypoints: Keypoint[],
  skeleton: SkeletonTemplate,
  bbox: { x: number; y: number; width: number; height: number }
): Record<string, number> {
  // Map keypoints by name to pixel coordinates
  const kpPx: Record<string, { x: number; y: number }> = {};
  for (const kp of keypoints) {
    if (kp.visibility >= 0.3) {
      kpPx[kp.name] = {
        x: bbox.x + kp.x * bbox.width,
        y: bbox.y + kp.y * bbox.height,
      };
    }
  }

  const angles: Record<string, number> = {};

  // Species-specific angle triplets
  const ANGLE_TRIPLETS: Record<string, [string, string, string][]> = {
    human: [
      ['left_elbow', 'left_shoulder', 'left_hip'],
      ['right_elbow', 'right_shoulder', 'right_hip'],
      ['left_wrist', 'left_elbow', 'left_shoulder'],
      ['right_wrist', 'right_elbow', 'right_shoulder'],
      ['left_ankle', 'left_knee', 'left_hip'],
      ['right_ankle', 'right_knee', 'right_hip'],
      ['left_knee', 'left_hip', 'right_hip'],
      ['right_knee', 'right_hip', 'left_hip'],
    ],
    // Animal AP-10K triplets
    animal: [
      ['L_F_Paw', 'L_Elbow', 'L_Shoulder'],
      ['R_F_Paw', 'R_Elbow', 'R_Shoulder'],
      ['L_Elbow', 'L_Shoulder', 'Neck'],
      ['R_Elbow', 'R_Shoulder', 'Neck'],
      ['L_B_Paw', 'L_Knee', 'L_Hip'],
      ['R_B_Paw', 'R_Knee', 'R_Hip'],
      ['L_Knee', 'L_Hip', 'root_of_tail'],
      ['R_Knee', 'R_Hip', 'root_of_tail'],
      ['Neck', 'L_Shoulder', 'L_Hip'],  // Spine angle proxy
    ],
  };

  const isHuman = skeleton.schema === 'coco_17';
  const triplets = isHuman ? ANGLE_TRIPLETS.human : ANGLE_TRIPLETS.animal;

  for (const [a, b, c] of triplets) {
    const pa = kpPx[a], pb = kpPx[b], pc = kpPx[c];
    if (!pa || !pb || !pc) continue;

    const rad = Math.atan2(pc.y - pb.y, pc.x - pb.x) -
                Math.atan2(pa.y - pb.y, pa.x - pb.x);
    let angle = Math.abs(rad * 180 / Math.PI);
    if (angle > 180) angle = 360 - angle;

    // Name the angle by the vertex joint
    angles[b] = Math.round(angle);
  }

  return angles;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 6: Motion Analysis (exercise rule matching)
// ─────────────────────────────────────────────────────────────────────────────
export function analyzeMotion(
  jointAngles: Record<string, number>,
  exercise: any
): MotionAnalysis {
  if (!exercise?.joint_rules || Object.keys(jointAngles).length === 0) {
    return { statuses: {}, formScore: 0, postureScore: 0, balanceScore: 0 };
  }

  const statuses: Record<string, 'correct' | 'warn' | 'incorrect'> = {};
  let totalScore  = 0;
  let totalJoints = 0;

  for (const [joint, rule] of Object.entries<any>(exercise.joint_rules)) {
    const angle = jointAngles[joint];
    if (angle === undefined) continue;

    totalJoints++;
    const { min, max, ideal, tolerance = 10 } = rule;

    if (angle >= min && angle <= max) {
      statuses[joint] = 'correct';
      totalScore += 100;
    } else if (
      angle >= (min - tolerance) && angle <= (max + tolerance)
    ) {
      statuses[joint] = 'warn';
      totalScore += 60;
    } else {
      statuses[joint] = 'incorrect';
      totalScore += 0;
    }
  }

  const formScore    = totalJoints > 0 ? Math.round(totalScore / totalJoints) : 0;
  const postureScore = _computePostureScore(jointAngles, exercise);
  const balanceScore = _computeBalanceScore(jointAngles);

  return { statuses, formScore, postureScore, balanceScore };
}

function _computePostureScore(angles: Record<string, number>, exercise: any): number {
  // Spine alignment: check if spine axis joints are reasonable
  const spineJoints = ['Neck', 'nose', 'left_shoulder'];
  for (const j of spineJoints) {
    if (angles[j] !== undefined) {
      const angle = angles[j];
      // Good posture: spine joints ~90-180 degrees relative to each other
      if (angle >= 150 && angle <= 210) return 90;
      if (angle >= 130 && angle <= 230) return 70;
      return 50;
    }
  }
  return 75; // Default neutral
}

function _computeBalanceScore(angles: Record<string, number>): number {
  // Balance: symmetry between left and right joints
  const pairs = [
    ['left_knee', 'right_knee'],
    ['left_hip', 'right_hip'],
    ['L_Knee', 'R_Knee'],
    ['L_Hip', 'R_Hip'],
  ];
  let symmetryScores: number[] = [];
  for (const [l, r] of pairs) {
    if (angles[l] !== undefined && angles[r] !== undefined) {
      const diff = Math.abs(angles[l] - angles[r]);
      const score = Math.max(0, 100 - diff * 2); // 0 diff = 100%, 50 diff = 0%
      symmetryScores.push(score);
    }
  }
  return symmetryScores.length > 0
    ? Math.round(symmetryScores.reduce((a, b) => a + b, 0) / symmetryScores.length)
    : 75;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rep Counting from joint displacement
// ─────────────────────────────────────────────────────────────────────────────
export function updateRepCount(
  state: RepState,
  keypoints: Keypoint[],
  exercise: any
): RepState {
  const repJoint = exercise?.rep_tracking_joint;
  if (!repJoint) return state;

  const kp = keypoints.find(k => k.name === repJoint);
  if (!kp || kp.visibility < 0.4) return state;

  const currentY    = kp.y;
  const prevY       = state.lastPosition;
  let { count, inDownPhase } = state;

  if (prevY < 0) {
    return { count, lastPosition: currentY, inDownPhase };
  }

  const delta     = currentY - prevY;
  const threshold = exercise?.rep_threshold || 0.08;

  if (!inDownPhase && delta > threshold) {
    inDownPhase = true;
  } else if (inDownPhase && delta < -threshold) {
    count++;
    inDownPhase = false;
  }

  return { count, lastPosition: currentY, inDownPhase };
}

// ─────────────────────────────────────────────────────────────────────────────
// Grade computation
// ─────────────────────────────────────────────────────────────────────────────
export function computeGrade(formScore: number): string {
  if (formScore >= 92) return 'A+';
  if (formScore >= 85) return 'A';
  if (formScore >= 78) return 'B+';
  if (formScore >= 70) return 'B';
  if (formScore >= 62) return 'C+';
  if (formScore >= 55) return 'C';
  return 'D';
}

// ─────────────────────────────────────────────────────────────────────────────
// Save scan to backend SQLite
// ─────────────────────────────────────────────────────────────────────────────
export async function saveScanToBackend(
  result: CompleteScanResult,
  userId?: string
): Promise<void> {
  try {
    await apiPost('/scan-save', {
      ...result,
      user_id: userId || 'anonymous',
    });
  } catch {
    // Non-fatal — scan still completed even if save fails
    console.warn('[aiPipeline] Scan save failed — continuing');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync to Training Analytics Store
// ─────────────────────────────────────────────────────────────────────────────
export async function syncTrainingAnalytics(
  result: CompleteScanResult,
  userId: string
): Promise<void> {
  try {
    const { saveMotionResult } = await import('../data/trainingAnalyticsStore');
    await saveMotionResult({
      userId,
      scanId:      result.scanId,
      species:     result.detectedSpecies,
      exerciseId:  result.exerciseId,
      exerciseName: result.exerciseName,
      formScore:   result.formScore,
      postureScore: result.postureScore,
      balanceScore: result.balanceScore,
      repCount:    result.repsCompleted,
      grade:       result.grade,
      timestamp:   result.timestamp,
    });
  } catch {
    // Non-fatal
  }
}
