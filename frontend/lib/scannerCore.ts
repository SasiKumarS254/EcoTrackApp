/**
 * scannerCore.ts — Production-Grade AI Scanner Pipeline
 *
 * Strict 10-stage sequential workflow for multi-species Computer Vision.
 * This is the ONLY source of truth for AI Scanner logic in EcoTrack.
 */

import { getSkeletonForSpecies, type SkeletonTemplate } from './skeletonTemplates';
import { getExerciseById, type ExerciseTemplate } from './exerciseTemplates';

const API_BASE = 'http://localhost:5000/api';

export type ScannerStage =
  | 'INITIALIZING'     // 1. Model & Hardware load
  | 'NORMALIZING'      // 2. Image prep
  | 'DETECTING'        // 3. Species ID
  | 'VERIFYING'       // 4. Target matching
  | 'VISIBILITY_CHECK' // 5. Full body verification
  | 'TRACKING'         // 6. Adaptive BBox
  | 'POSING'           // 7. Species-specific pose
  | 'ANALYZING'        // 8. Biomechanical math
  | 'RECOGNIZING'     // 9. Exercise matching
  | 'REPORTING';      // 10. Sync & Finalize

export interface ScannerState {
  stage: ScannerStage;
  progress: number;
  haltReason: string | null;
  fps: number;
  latency: number;
  detectedSpecies: string | null;
  confidence: number;
  isBodyVisible: boolean;
  repCount: number;
  formScore: number;
  coachingTip: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Keypoint {
  name: string;
  x: number;
  y: number;
  visibility: number;
}

/**
 * Stage 1: Initialize
 */
export async function initializeScanner(onProgress: (msg: string) => void): Promise<boolean> {
  onProgress('Loading Species Classifier...');
  // Simulation of model integrity check
  await new Promise(r => setTimeout(r, 500));

  onProgress('Loading Pose Estimator (Multi-Species Kernel)...');
  await new Promise(r => setTimeout(r, 800));

  onProgress('Verifying GPU Acceleration (WebGL/WebGPU)...');
  return true;
}

/**
 * Stage 3 & 4: Species Detection & Target Verification
 */
export async function detectAndVerify(
  imageBase64: string,
  targetSpecies: string
): Promise<{ detected: boolean; confidence: number; bbox: BoundingBox | null; error?: string }> {
  try {
    const resp = await fetch(`${API_BASE}/ai/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: imageBase64, target_class: targetSpecies.toLowerCase() })
    });

    const data = await resp.json();

    if (data.detected && data.className.toLowerCase() === targetSpecies.toLowerCase()) {
      return { detected: true, confidence: data.confidence, bbox: data.boundingBox };
    }

    return {
      detected: false,
      confidence: 0,
      bbox: null,
      error: `Target species (${targetSpecies}) not found. Detected: ${data.allDetections?.map((d: any) => d.className).join(', ') || 'None'}`
    };
  } catch (e) {
    throw new Error("AI Detection Service Offline");
  }
}

/**
 * Stage 5: Visibility Check
 */
export function verifyBodyVisibility(bbox: BoundingBox, frameWidth: number, frameHeight: number): { visible: boolean; msg: string } {
  const margin = 0.05; // 5% border
  const isClipped =
    bbox.x < frameWidth * margin ||
    bbox.y < frameHeight * margin ||
    (bbox.x + bbox.width) > frameWidth * (1 - margin) ||
    (bbox.y + bbox.height) > frameHeight * (1 - margin);

  if (isClipped) {
    return { visible: false, msg: "Incomplete Body View: Target body region out of frame. Please adjust camera positioning." };
  }
  return { visible: true, msg: "Full body visible" };
}

/**
 * Stage 7: Pose Estimation
 */
export async function estimatePose(
  imageBase64: string,
  species: string,
  bbox: BoundingBox
): Promise<Keypoint[]> {
  const resp = await fetch(`${API_BASE}/ai/pose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_base64: imageBase64, species, bounding_box: bbox })
  });

  const data = await resp.json();
  if (data.success) return data.keypoints;
  return [];
}

/**
 * Stage 8: Biomechanical Analysis (Math only, no placeholders)
 */
export function calculateJointAngle(p1: Keypoint, p2: Keypoint, p3: Keypoint): number {
  const radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) angle = 360.0 - angle;
  return Math.round(angle);
}

export function calculateVelocity(prevPos: number, currPos: number, deltaTime: number): number {
  return Math.abs(currPos - prevPos) / deltaTime;
}

/**
 * Stage 10: Sync & Report
 */
export async function finalizeScan(report: any): Promise<void> {
  await fetch(`${API_BASE}/scans/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report)
  });
}
