/**
 * skeletonTemplates.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Anatomical skeleton definitions for EcoTrack AI Scanner.
 *
 * HUMAN:  COCO-17 keypoint schema (MediaPipe BlazePose output)
 * ANIMAL: AP-10K 17-keypoint schema — same schema used by the backend
 *         RTMPose-M model trained on 54 species across 23 animal families.
 *
 * Joint positions (x, y) are normalized 0–1 relative to the bounding box.
 * These proportions are anatomical defaults used for:
 *   1. Template-based visibility checks (are all required joints visible?)
 *   2. Fallback skeleton display when inference returns partial keypoints
 *   3. Bone connection definitions for SVG/canvas rendering
 *
 * Every skeleton in this file corresponds to a real model's output schema.
 * No skeletons are used for animals unless a matching pose model exists.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Core Types
// ─────────────────────────────────────────────────────────────────────────────

export interface JointDef {
  /** Normalized x position within bounding box (0=left, 1=right) */
  x: number;
  /** Normalized y position within bounding box (0=top, 1=bottom) */
  y: number;
  /** Display label for this joint */
  label: string;
  /** AP-10K keypoint index (0–16) or COCO index for humans */
  idx: number;
  /** Which other joints this one connects to (for bone drawing) */
  connects: string[];
}

export interface SkeletonTemplate {
  /** Unique species identifier */
  id: string;
  /** Display name */
  label: string;
  /** Keypoint schema used ('coco_17' | 'ap10k_17') */
  schema: 'coco_17' | 'ap10k_17';
  /** Model required for pose estimation */
  requiredModel: 'mediapipe_blazepose' | 'rtmpose_ap10k' | 'yolov8_ap10k_remap' | 'animal_pose_finetuned';
  /** Named joint definitions */
  joints: Record<string, JointDef>;
  /** Bone pairs [jointA, jointB] for rendering */
  bones: [string, string][];
  /** Joints that must be visible for full-body verification */
  required_joints: string[];
  /** Joint used for rep counting */
  rep_tracking_joint: string;
  /** [top, bottom] joint pair for spine/alignment axis */
  spine_axis: [string, string];
  /** AP-10K species coverage note */
  coverage_note?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: compute angle between 3 joints (A → B ← C, B is vertex)
// ─────────────────────────────────────────────────────────────────────────────
export function calcJointAngle(
  a: { px: number; py: number },
  b: { px: number; py: number },
  c: { px: number; py: number }
): number {
  const rad =
    Math.atan2(c.py - b.py, c.px - b.px) -
    Math.atan2(a.py - b.py, a.px - b.px);
  let angle = Math.abs((rad * 180.0) / Math.PI);
  if (angle > 180.0) angle = 360.0 - angle;
  return angle;
}

/** Scale normalized joint positions to pixel coordinates within the bbox */
export function scaleJointsToPixels(
  joints: Record<string, JointDef>,
  bbox: { x: number; y: number; width: number; height: number }
): Record<string, { px: number; py: number }> {
  const result: Record<string, { px: number; py: number }> = {};
  for (const [key, j] of Object.entries(joints)) {
    result[key] = {
      px: bbox.x + j.x * bbox.width,
      py: bbox.y + j.y * bbox.height,
    };
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// HUMAN — COCO-17 keypoint schema (MediaPipe BlazePose)
// Supported by: MediaPipe Pose Landmarker + YOLOv8n-pose fallback
// ─────────────────────────────────────────────────────────────────────────────
export const HUMAN_SKELETON: SkeletonTemplate = {
  id: 'human',
  label: 'Human',
  schema: 'coco_17',
  requiredModel: 'mediapipe_blazepose',
  joints: {
    nose:           { x: 0.50, y: 0.04, idx: 0,  label: 'Nose',           connects: ['left_eye', 'right_eye', 'left_shoulder'] },
    left_eye:       { x: 0.45, y: 0.03, idx: 1,  label: 'Left Eye',       connects: ['nose', 'left_ear'] },
    right_eye:      { x: 0.55, y: 0.03, idx: 2,  label: 'Right Eye',      connects: ['nose', 'right_ear'] },
    left_ear:       { x: 0.40, y: 0.04, idx: 3,  label: 'Left Ear',       connects: ['left_eye'] },
    right_ear:      { x: 0.60, y: 0.04, idx: 4,  label: 'Right Ear',      connects: ['right_eye'] },
    left_shoulder:  { x: 0.34, y: 0.22, idx: 5,  label: 'Left Shoulder',  connects: ['right_shoulder', 'left_elbow', 'left_hip'] },
    right_shoulder: { x: 0.66, y: 0.22, idx: 6,  label: 'Right Shoulder', connects: ['left_shoulder', 'right_elbow', 'right_hip'] },
    left_elbow:     { x: 0.24, y: 0.38, idx: 7,  label: 'Left Elbow',     connects: ['left_shoulder', 'left_wrist'] },
    right_elbow:    { x: 0.76, y: 0.38, idx: 8,  label: 'Right Elbow',    connects: ['right_shoulder', 'right_wrist'] },
    left_wrist:     { x: 0.16, y: 0.52, idx: 9,  label: 'Left Wrist',     connects: ['left_elbow'] },
    right_wrist:    { x: 0.84, y: 0.52, idx: 10, label: 'Right Wrist',    connects: ['right_elbow'] },
    left_hip:       { x: 0.38, y: 0.56, idx: 11, label: 'Left Hip',       connects: ['right_hip', 'left_knee', 'left_shoulder'] },
    right_hip:      { x: 0.62, y: 0.56, idx: 12, label: 'Right Hip',      connects: ['left_hip', 'right_knee', 'right_shoulder'] },
    left_knee:      { x: 0.36, y: 0.74, idx: 13, label: 'Left Knee',      connects: ['left_hip', 'left_ankle'] },
    right_knee:     { x: 0.64, y: 0.74, idx: 14, label: 'Right Knee',     connects: ['right_hip', 'right_ankle'] },
    left_ankle:     { x: 0.35, y: 0.91, idx: 15, label: 'Left Ankle',     connects: ['left_knee'] },
    right_ankle:    { x: 0.65, y: 0.91, idx: 16, label: 'Right Ankle',    connects: ['right_knee'] },
  },
  bones: [
    ['left_ear', 'left_eye'], ['right_ear', 'right_eye'],
    ['left_eye', 'nose'], ['right_eye', 'nose'],
    ['left_shoulder', 'right_shoulder'],
    ['left_shoulder', 'left_elbow'], ['left_elbow', 'left_wrist'],
    ['right_shoulder', 'right_elbow'], ['right_elbow', 'right_wrist'],
    ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'],
    ['left_hip', 'right_hip'],
    ['left_hip', 'left_knee'], ['left_knee', 'left_ankle'],
    ['right_hip', 'right_knee'], ['right_knee', 'right_ankle'],
  ],
  required_joints: ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip', 'left_ankle', 'right_ankle'],
  rep_tracking_joint: 'left_hip',
  spine_axis: ['nose', 'left_hip'],
};

// ─────────────────────────────────────────────────────────────────────────────
// AP-10K ANIMAL BASE — 17-keypoint schema
// Used by: RTMPose-M (ap10k pretrained) + YOLOv8m-pose with remapping
// Covers:  54 species across 23 animal families
//
// AP-10K keypoint indices:
//   0:L_Eye  1:R_Eye  2:Nose  3:Neck  4:root_of_tail
//   5:L_Shoulder  6:L_Elbow  7:L_F_Paw
//   8:R_Shoulder  9:R_Elbow  10:R_F_Paw
//   11:L_Hip  12:L_Knee  13:L_B_Paw
//   14:R_Hip  15:R_Knee  16:R_B_Paw
// ─────────────────────────────────────────────────────────────────────────────

// Generic quadruped layout (lateral view)
const QUADRUPED_JOINTS_LATERAL: Record<string, JointDef> = {
  L_Eye:        { x: 0.10, y: 0.12, idx: 0,  label: 'Left Eye',        connects: ['R_Eye', 'Nose'] },
  R_Eye:        { x: 0.14, y: 0.10, idx: 1,  label: 'Right Eye',       connects: ['L_Eye', 'Nose'] },
  Nose:         { x: 0.06, y: 0.15, idx: 2,  label: 'Nose',            connects: ['L_Eye', 'R_Eye', 'Neck'] },
  Neck:         { x: 0.22, y: 0.22, idx: 3,  label: 'Neck / Withers',  connects: ['Nose', 'L_Shoulder', 'R_Shoulder', 'root_of_tail'] },
  root_of_tail: { x: 0.82, y: 0.28, idx: 4,  label: 'Tail Root',       connects: ['Neck', 'L_Hip', 'R_Hip'] },
  L_Shoulder:   { x: 0.28, y: 0.32, idx: 5,  label: 'L Shoulder',      connects: ['Neck', 'L_Elbow'] },
  L_Elbow:      { x: 0.28, y: 0.52, idx: 6,  label: 'L Elbow',         connects: ['L_Shoulder', 'L_F_Paw'] },
  L_F_Paw:      { x: 0.27, y: 0.76, idx: 7,  label: 'L Fore Paw',      connects: ['L_Elbow'] },
  R_Shoulder:   { x: 0.36, y: 0.32, idx: 8,  label: 'R Shoulder',      connects: ['Neck', 'R_Elbow'] },
  R_Elbow:      { x: 0.36, y: 0.52, idx: 9,  label: 'R Elbow',         connects: ['R_Shoulder', 'R_F_Paw'] },
  R_F_Paw:      { x: 0.35, y: 0.76, idx: 10, label: 'R Fore Paw',      connects: ['R_Elbow'] },
  L_Hip:        { x: 0.72, y: 0.32, idx: 11, label: 'L Hip',           connects: ['root_of_tail', 'L_Knee'] },
  L_Knee:       { x: 0.72, y: 0.54, idx: 12, label: 'L Knee / Stifle', connects: ['L_Hip', 'L_B_Paw'] },
  L_B_Paw:      { x: 0.70, y: 0.78, idx: 13, label: 'L Hind Paw',      connects: ['L_Knee'] },
  R_Hip:        { x: 0.78, y: 0.32, idx: 14, label: 'R Hip',           connects: ['root_of_tail', 'R_Knee'] },
  R_Knee:       { x: 0.78, y: 0.54, idx: 15, label: 'R Knee / Stifle', connects: ['R_Hip', 'R_B_Paw'] },
  R_B_Paw:      { x: 0.76, y: 0.78, idx: 16, label: 'R Hind Paw',      connects: ['R_Knee'] },
};

const QUADRUPED_BONES: [string, string][] = [
  ['L_Eye', 'Nose'], ['R_Eye', 'Nose'],
  ['Nose', 'Neck'],
  ['Neck', 'L_Shoulder'], ['L_Shoulder', 'L_Elbow'], ['L_Elbow', 'L_F_Paw'],
  ['Neck', 'R_Shoulder'], ['R_Shoulder', 'R_Elbow'], ['R_Elbow', 'R_F_Paw'],
  ['Neck', 'root_of_tail'],
  ['root_of_tail', 'L_Hip'], ['L_Hip', 'L_Knee'], ['L_Knee', 'L_B_Paw'],
  ['root_of_tail', 'R_Hip'], ['R_Hip', 'R_Knee'], ['R_Knee', 'R_B_Paw'],
];

// ─────────────────────────────────────────────────────────────────────────────
// DOG — AP-10K schema, canine anatomy
// ─────────────────────────────────────────────────────────────────────────────
export const DOG_SKELETON: SkeletonTemplate = {
  id: 'dog',
  label: 'Dog',
  schema: 'ap10k_17',
  requiredModel: 'rtmpose_ap10k',
  joints: {
    ...QUADRUPED_JOINTS_LATERAL,
    Neck:         { ...QUADRUPED_JOINTS_LATERAL.Neck,         label: 'Withers' },
    root_of_tail: { ...QUADRUPED_JOINTS_LATERAL.root_of_tail, label: 'Tail Root / Croup' },
    L_F_Paw:      { ...QUADRUPED_JOINTS_LATERAL.L_F_Paw,      label: 'L Fore Paw' },
    R_F_Paw:      { ...QUADRUPED_JOINTS_LATERAL.R_F_Paw,      label: 'R Fore Paw' },
    L_B_Paw:      { ...QUADRUPED_JOINTS_LATERAL.L_B_Paw,      label: 'L Hind Paw' },
    R_B_Paw:      { ...QUADRUPED_JOINTS_LATERAL.R_B_Paw,      label: 'R Hind Paw' },
  },
  bones: QUADRUPED_BONES,
  required_joints: ['Nose', 'Neck', 'L_Shoulder', 'R_Shoulder', 'L_Hip', 'R_Hip', 'L_F_Paw', 'R_F_Paw'],
  rep_tracking_joint: 'L_Hip',
  spine_axis: ['Nose', 'root_of_tail'],
  coverage_note: 'AP-10K covers domestic dogs, wolves, foxes — 54 species total',
};

// ─────────────────────────────────────────────────────────────────────────────
// CAT — AP-10K schema, feline anatomy
// ─────────────────────────────────────────────────────────────────────────────
export const CAT_SKELETON: SkeletonTemplate = {
  id: 'cat',
  label: 'Cat',
  schema: 'ap10k_17',
  requiredModel: 'rtmpose_ap10k',
  joints: {
    ...QUADRUPED_JOINTS_LATERAL,
    Neck:         { ...QUADRUPED_JOINTS_LATERAL.Neck,         label: 'Neck' },
    root_of_tail: { ...QUADRUPED_JOINTS_LATERAL.root_of_tail, label: 'Tail Base' },
    L_F_Paw:      { ...QUADRUPED_JOINTS_LATERAL.L_F_Paw,      label: 'L Fore Paw' },
    R_F_Paw:      { ...QUADRUPED_JOINTS_LATERAL.R_F_Paw,      label: 'R Fore Paw' },
    L_B_Paw:      { ...QUADRUPED_JOINTS_LATERAL.L_B_Paw,      label: 'L Hind Paw' },
    R_B_Paw:      { ...QUADRUPED_JOINTS_LATERAL.R_B_Paw,      label: 'R Hind Paw' },
  },
  bones: QUADRUPED_BONES,
  required_joints: ['Nose', 'Neck', 'L_Shoulder', 'R_Shoulder', 'L_Hip', 'R_Hip'],
  rep_tracking_joint: 'L_Hip',
  spine_axis: ['Nose', 'root_of_tail'],
  coverage_note: 'AP-10K: domestic cats, lions, tigers, leopards, cheetahs',
};

// ─────────────────────────────────────────────────────────────────────────────
// HORSE — AP-10K schema, equine anatomy with proper veterinary naming
// ─────────────────────────────────────────────────────────────────────────────
export const HORSE_SKELETON: SkeletonTemplate = {
  id: 'horse',
  label: 'Horse',
  schema: 'ap10k_17',
  requiredModel: 'rtmpose_ap10k',
  joints: {
    L_Eye:        { x: 0.08, y: 0.08, idx: 0,  label: 'L Eye',     connects: ['R_Eye', 'Nose'] },
    R_Eye:        { x: 0.12, y: 0.06, idx: 1,  label: 'R Eye',     connects: ['L_Eye', 'Nose'] },
    Nose:         { x: 0.04, y: 0.14, idx: 2,  label: 'Poll/Muzzle', connects: ['L_Eye', 'R_Eye', 'Neck'] },
    Neck:         { x: 0.20, y: 0.20, idx: 3,  label: 'Withers',   connects: ['Nose', 'L_Shoulder', 'R_Shoulder', 'root_of_tail'] },
    root_of_tail: { x: 0.85, y: 0.26, idx: 4,  label: 'Croup',     connects: ['Neck', 'L_Hip', 'R_Hip'] },
    L_Shoulder:   { x: 0.26, y: 0.30, idx: 5,  label: 'L Shoulder',connects: ['Neck', 'L_Elbow'] },
    L_Elbow:      { x: 0.27, y: 0.52, idx: 6,  label: 'L Elbow',   connects: ['L_Shoulder', 'L_F_Paw'] },
    L_F_Paw:      { x: 0.26, y: 0.80, idx: 7,  label: 'L Fore Hoof', connects: ['L_Elbow'] },
    R_Shoulder:   { x: 0.34, y: 0.30, idx: 8,  label: 'R Shoulder',connects: ['Neck', 'R_Elbow'] },
    R_Elbow:      { x: 0.35, y: 0.52, idx: 9,  label: 'R Elbow',   connects: ['R_Shoulder', 'R_F_Paw'] },
    R_F_Paw:      { x: 0.34, y: 0.80, idx: 10, label: 'R Fore Hoof', connects: ['R_Elbow'] },
    L_Hip:        { x: 0.74, y: 0.30, idx: 11, label: 'L Hip',     connects: ['root_of_tail', 'L_Knee'] },
    L_Knee:       { x: 0.74, y: 0.52, idx: 12, label: 'L Stifle',  connects: ['L_Hip', 'L_B_Paw'] },
    L_B_Paw:      { x: 0.72, y: 0.82, idx: 13, label: 'L Hind Hoof', connects: ['L_Knee'] },
    R_Hip:        { x: 0.80, y: 0.30, idx: 14, label: 'R Hip',     connects: ['root_of_tail', 'R_Knee'] },
    R_Knee:       { x: 0.80, y: 0.52, idx: 15, label: 'R Stifle',  connects: ['R_Hip', 'R_B_Paw'] },
    R_B_Paw:      { x: 0.78, y: 0.82, idx: 16, label: 'R Hind Hoof', connects: ['R_Knee'] },
  },
  bones: QUADRUPED_BONES,
  required_joints: ['Nose', 'Neck', 'L_Shoulder', 'R_Shoulder', 'L_Hip', 'R_Hip', 'L_F_Paw', 'R_F_Paw', 'L_B_Paw', 'R_B_Paw'],
  rep_tracking_joint: 'L_Hip',
  spine_axis: ['Nose', 'root_of_tail'],
  coverage_note: 'AP-10K: horses, ponies, donkeys, zebras, deer, camel, kangaroo',
};

// ─────────────────────────────────────────────────────────────────────────────
// COW — AP-10K schema, bovine anatomy
// ─────────────────────────────────────────────────────────────────────────────
export const COW_SKELETON: SkeletonTemplate = {
  id: 'cow',
  label: 'Cow',
  schema: 'ap10k_17',
  requiredModel: 'rtmpose_ap10k',
  joints: {
    ...QUADRUPED_JOINTS_LATERAL,
    Neck:         { ...QUADRUPED_JOINTS_LATERAL.Neck,         label: 'Withers' },
    root_of_tail: { ...QUADRUPED_JOINTS_LATERAL.root_of_tail, label: 'Tail Head' },
    L_F_Paw:      { ...QUADRUPED_JOINTS_LATERAL.L_F_Paw,      x: 0.27, y: 0.82, label: 'L Fore Hoof' },
    R_F_Paw:      { ...QUADRUPED_JOINTS_LATERAL.R_F_Paw,      x: 0.35, y: 0.82, label: 'R Fore Hoof' },
    L_B_Paw:      { ...QUADRUPED_JOINTS_LATERAL.L_B_Paw,      x: 0.70, y: 0.82, label: 'L Hind Hoof' },
    R_B_Paw:      { ...QUADRUPED_JOINTS_LATERAL.R_B_Paw,      x: 0.76, y: 0.82, label: 'R Hind Hoof' },
  },
  bones: QUADRUPED_BONES,
  required_joints: ['Nose', 'Neck', 'L_Shoulder', 'R_Shoulder', 'L_Hip', 'R_Hip'],
  rep_tracking_joint: 'L_Hip',
  spine_axis: ['Nose', 'root_of_tail'],
  coverage_note: 'AP-10K: cows, bulls, buffalo, bison',
};

// ─────────────────────────────────────────────────────────────────────────────
// SHEEP — AP-10K schema
// ─────────────────────────────────────────────────────────────────────────────
export const SHEEP_SKELETON: SkeletonTemplate = {
  id: 'sheep',
  label: 'Sheep / Goat',
  schema: 'ap10k_17',
  requiredModel: 'rtmpose_ap10k',
  joints: { ...QUADRUPED_JOINTS_LATERAL },
  bones: QUADRUPED_BONES,
  required_joints: ['Nose', 'Neck', 'L_Hip', 'R_Hip'],
  rep_tracking_joint: 'L_Hip',
  spine_axis: ['Nose', 'root_of_tail'],
  coverage_note: 'AP-10K: sheep, goats, rams',
};

// ─────────────────────────────────────────────────────────────────────────────
// ELEPHANT — AP-10K schema, larger proportions
// ─────────────────────────────────────────────────────────────────────────────
export const ELEPHANT_SKELETON: SkeletonTemplate = {
  id: 'elephant',
  label: 'Elephant',
  schema: 'ap10k_17',
  requiredModel: 'rtmpose_ap10k',
  joints: {
    L_Eye:        { x: 0.10, y: 0.10, idx: 0,  label: 'L Eye',     connects: ['R_Eye', 'Nose'] },
    R_Eye:        { x: 0.14, y: 0.08, idx: 1,  label: 'R Eye',     connects: ['L_Eye', 'Nose'] },
    Nose:         { x: 0.04, y: 0.20, idx: 2,  label: 'Trunk Tip', connects: ['L_Eye', 'R_Eye', 'Neck'] },
    Neck:         { x: 0.22, y: 0.24, idx: 3,  label: 'Neck',      connects: ['Nose', 'L_Shoulder', 'R_Shoulder', 'root_of_tail'] },
    root_of_tail: { x: 0.85, y: 0.30, idx: 4,  label: 'Tail Root', connects: ['Neck', 'L_Hip', 'R_Hip'] },
    L_Shoulder:   { x: 0.28, y: 0.35, idx: 5,  label: 'L Shoulder', connects: ['Neck', 'L_Elbow'] },
    L_Elbow:      { x: 0.28, y: 0.58, idx: 6,  label: 'L Elbow',   connects: ['L_Shoulder', 'L_F_Paw'] },
    L_F_Paw:      { x: 0.27, y: 0.84, idx: 7,  label: 'L Fore Foot', connects: ['L_Elbow'] },
    R_Shoulder:   { x: 0.36, y: 0.35, idx: 8,  label: 'R Shoulder', connects: ['Neck', 'R_Elbow'] },
    R_Elbow:      { x: 0.36, y: 0.58, idx: 9,  label: 'R Elbow',   connects: ['R_Shoulder', 'R_F_Paw'] },
    R_F_Paw:      { x: 0.35, y: 0.84, idx: 10, label: 'R Fore Foot', connects: ['R_Elbow'] },
    L_Hip:        { x: 0.72, y: 0.35, idx: 11, label: 'L Hip',     connects: ['root_of_tail', 'L_Knee'] },
    L_Knee:       { x: 0.72, y: 0.58, idx: 12, label: 'L Knee',    connects: ['L_Hip', 'L_B_Paw'] },
    L_B_Paw:      { x: 0.70, y: 0.84, idx: 13, label: 'L Hind Foot', connects: ['L_Knee'] },
    R_Hip:        { x: 0.78, y: 0.35, idx: 14, label: 'R Hip',     connects: ['root_of_tail', 'R_Knee'] },
    R_Knee:       { x: 0.78, y: 0.58, idx: 15, label: 'R Knee',    connects: ['R_Hip', 'R_B_Paw'] },
    R_B_Paw:      { x: 0.76, y: 0.84, idx: 16, label: 'R Hind Foot', connects: ['R_Knee'] },
  },
  bones: QUADRUPED_BONES,
  required_joints: ['Nose', 'Neck', 'L_Shoulder', 'R_Shoulder', 'L_Hip', 'R_Hip'],
  rep_tracking_joint: 'L_Hip',
  spine_axis: ['Nose', 'root_of_tail'],
  coverage_note: 'AP-10K: African and Asian elephants',
};

// ─────────────────────────────────────────────────────────────────────────────
// BEAR — AP-10K schema
// ─────────────────────────────────────────────────────────────────────────────
export const BEAR_SKELETON: SkeletonTemplate = {
  id: 'bear',
  label: 'Bear / Panda',
  schema: 'ap10k_17',
  requiredModel: 'rtmpose_ap10k',
  joints: { ...QUADRUPED_JOINTS_LATERAL },
  bones: QUADRUPED_BONES,
  required_joints: ['Nose', 'Neck', 'L_Hip', 'R_Hip'],
  rep_tracking_joint: 'L_Hip',
  spine_axis: ['Nose', 'root_of_tail'],
  coverage_note: 'AP-10K: bears, pandas, koalas',
};

// ─────────────────────────────────────────────────────────────────────────────
// ZEBRA — AP-10K schema (same structure as horse, different species ID)
// ─────────────────────────────────────────────────────────────────────────────
export const ZEBRA_SKELETON: SkeletonTemplate = {
  ...HORSE_SKELETON,
  id: 'zebra',
  label: 'Zebra',
  coverage_note: 'AP-10K: zebras (same equine joint schema)',
};

// ─────────────────────────────────────────────────────────────────────────────
// GIRAFFE — AP-10K schema, elongated neck proportions
// ─────────────────────────────────────────────────────────────────────────────
export const GIRAFFE_SKELETON: SkeletonTemplate = {
  id: 'giraffe',
  label: 'Giraffe',
  schema: 'ap10k_17',
  requiredModel: 'rtmpose_ap10k',
  joints: {
    L_Eye:        { x: 0.10, y: 0.04, idx: 0,  label: 'L Eye',    connects: ['R_Eye', 'Nose'] },
    R_Eye:        { x: 0.14, y: 0.03, idx: 1,  label: 'R Eye',    connects: ['L_Eye', 'Nose'] },
    Nose:         { x: 0.06, y: 0.06, idx: 2,  label: 'Nose',     connects: ['L_Eye', 'R_Eye', 'Neck'] },
    Neck:         { x: 0.30, y: 0.28, idx: 3,  label: 'Withers',  connects: ['Nose', 'L_Shoulder', 'R_Shoulder', 'root_of_tail'] },
    root_of_tail: { x: 0.88, y: 0.32, idx: 4,  label: 'Croup',    connects: ['Neck', 'L_Hip', 'R_Hip'] },
    L_Shoulder:   { x: 0.34, y: 0.35, idx: 5,  label: 'L Shoulder', connects: ['Neck', 'L_Elbow'] },
    L_Elbow:      { x: 0.34, y: 0.55, idx: 6,  label: 'L Elbow',  connects: ['L_Shoulder', 'L_F_Paw'] },
    L_F_Paw:      { x: 0.33, y: 0.82, idx: 7,  label: 'L Fore Hoof', connects: ['L_Elbow'] },
    R_Shoulder:   { x: 0.40, y: 0.35, idx: 8,  label: 'R Shoulder', connects: ['Neck', 'R_Elbow'] },
    R_Elbow:      { x: 0.40, y: 0.55, idx: 9,  label: 'R Elbow',  connects: ['R_Shoulder', 'R_F_Paw'] },
    R_F_Paw:      { x: 0.39, y: 0.82, idx: 10, label: 'R Fore Hoof', connects: ['R_Elbow'] },
    L_Hip:        { x: 0.78, y: 0.35, idx: 11, label: 'L Hip',    connects: ['root_of_tail', 'L_Knee'] },
    L_Knee:       { x: 0.78, y: 0.55, idx: 12, label: 'L Stifle', connects: ['L_Hip', 'L_B_Paw'] },
    L_B_Paw:      { x: 0.76, y: 0.82, idx: 13, label: 'L Hind Hoof', connects: ['L_Knee'] },
    R_Hip:        { x: 0.84, y: 0.35, idx: 14, label: 'R Hip',    connects: ['root_of_tail', 'R_Knee'] },
    R_Knee:       { x: 0.84, y: 0.55, idx: 15, label: 'R Stifle', connects: ['R_Hip', 'R_B_Paw'] },
    R_B_Paw:      { x: 0.82, y: 0.82, idx: 16, label: 'R Hind Hoof', connects: ['R_Knee'] },
  },
  bones: QUADRUPED_BONES,
  required_joints: ['Nose', 'Neck', 'L_Hip', 'R_Hip'],
  rep_tracking_joint: 'L_Hip',
  spine_axis: ['Nose', 'root_of_tail'],
  coverage_note: 'AP-10K: giraffes',
};

// ─────────────────────────────────────────────────────────────────────────────
// BIRD — AP-10K schema (modified for avian anatomy — no tail root)
// ─────────────────────────────────────────────────────────────────────────────
export const BIRD_SKELETON: SkeletonTemplate = {
  id: 'bird',
  label: 'Bird',
  schema: 'ap10k_17',
  requiredModel: 'rtmpose_ap10k',
  joints: {
    L_Eye:        { x: 0.38, y: 0.10, idx: 0,  label: 'L Eye',    connects: ['Nose'] },
    R_Eye:        { x: 0.62, y: 0.10, idx: 1,  label: 'R Eye',    connects: ['Nose'] },
    Nose:         { x: 0.50, y: 0.06, idx: 2,  label: 'Beak',     connects: ['L_Eye', 'R_Eye', 'Neck'] },
    Neck:         { x: 0.50, y: 0.22, idx: 3,  label: 'Neck',     connects: ['Nose', 'L_Shoulder', 'R_Shoulder', 'root_of_tail'] },
    root_of_tail: { x: 0.50, y: 0.60, idx: 4,  label: 'Tail',     connects: ['Neck', 'L_Hip', 'R_Hip'] },
    L_Shoulder:   { x: 0.28, y: 0.30, idx: 5,  label: 'L Wing Base', connects: ['Neck', 'L_Elbow'] },
    L_Elbow:      { x: 0.16, y: 0.40, idx: 6,  label: 'L Wing Mid', connects: ['L_Shoulder', 'L_F_Paw'] },
    L_F_Paw:      { x: 0.06, y: 0.48, idx: 7,  label: 'L Wing Tip', connects: ['L_Elbow'] },
    R_Shoulder:   { x: 0.72, y: 0.30, idx: 8,  label: 'R Wing Base', connects: ['Neck', 'R_Elbow'] },
    R_Elbow:      { x: 0.84, y: 0.40, idx: 9,  label: 'R Wing Mid', connects: ['R_Shoulder', 'R_F_Paw'] },
    R_F_Paw:      { x: 0.94, y: 0.48, idx: 10, label: 'R Wing Tip', connects: ['R_Elbow'] },
    L_Hip:        { x: 0.40, y: 0.68, idx: 11, label: 'L Leg Root', connects: ['root_of_tail', 'L_Knee'] },
    L_Knee:       { x: 0.38, y: 0.78, idx: 12, label: 'L Knee',   connects: ['L_Hip', 'L_B_Paw'] },
    L_B_Paw:      { x: 0.36, y: 0.90, idx: 13, label: 'L Talon',  connects: ['L_Knee'] },
    R_Hip:        { x: 0.60, y: 0.68, idx: 14, label: 'R Leg Root', connects: ['root_of_tail', 'R_Knee'] },
    R_Knee:       { x: 0.62, y: 0.78, idx: 15, label: 'R Knee',   connects: ['R_Hip', 'R_B_Paw'] },
    R_B_Paw:      { x: 0.64, y: 0.90, idx: 16, label: 'R Talon',  connects: ['R_Knee'] },
  },
  bones: [
    ['L_Eye', 'Nose'], ['R_Eye', 'Nose'], ['Nose', 'Neck'],
    ['Neck', 'L_Shoulder'], ['L_Shoulder', 'L_Elbow'], ['L_Elbow', 'L_F_Paw'],
    ['Neck', 'R_Shoulder'], ['R_Shoulder', 'R_Elbow'], ['R_Elbow', 'R_F_Paw'],
    ['Neck', 'root_of_tail'],
    ['root_of_tail', 'L_Hip'], ['L_Hip', 'L_Knee'], ['L_Knee', 'L_B_Paw'],
    ['root_of_tail', 'R_Hip'], ['R_Hip', 'R_Knee'], ['R_Knee', 'R_B_Paw'],
  ],
  required_joints: ['Nose', 'Neck', 'L_Shoulder', 'R_Shoulder', 'root_of_tail'],
  rep_tracking_joint: 'L_Hip',
  spine_axis: ['Nose', 'root_of_tail'],
  coverage_note: 'AP-10K: eagles, parrots, owls, flamingos, peacocks, penguins, ostriches',
};

// ─────────────────────────────────────────────────────────────────────────────
// PRIMATE — AP-10K schema (gorilla, chimp, orangutan, monkey)
// Upright posture variant
// ─────────────────────────────────────────────────────────────────────────────
export const PRIMATE_SKELETON: SkeletonTemplate = {
  id: 'monkey',
  label: 'Primate',
  schema: 'ap10k_17',
  requiredModel: 'rtmpose_ap10k',
  joints: {
    L_Eye:        { x: 0.44, y: 0.05, idx: 0,  label: 'L Eye',       connects: ['R_Eye', 'Nose'] },
    R_Eye:        { x: 0.56, y: 0.05, idx: 1,  label: 'R Eye',       connects: ['L_Eye', 'Nose'] },
    Nose:         { x: 0.50, y: 0.08, idx: 2,  label: 'Nose',        connects: ['L_Eye', 'R_Eye', 'Neck'] },
    Neck:         { x: 0.50, y: 0.20, idx: 3,  label: 'Neck',        connects: ['Nose', 'L_Shoulder', 'R_Shoulder', 'root_of_tail'] },
    root_of_tail: { x: 0.50, y: 0.56, idx: 4,  label: 'Tail/Hip',    connects: ['Neck', 'L_Hip', 'R_Hip'] },
    L_Shoulder:   { x: 0.32, y: 0.24, idx: 5,  label: 'L Shoulder',  connects: ['Neck', 'L_Elbow'] },
    L_Elbow:      { x: 0.22, y: 0.38, idx: 6,  label: 'L Elbow',     connects: ['L_Shoulder', 'L_F_Paw'] },
    L_F_Paw:      { x: 0.14, y: 0.52, idx: 7,  label: 'L Hand',      connects: ['L_Elbow'] },
    R_Shoulder:   { x: 0.68, y: 0.24, idx: 8,  label: 'R Shoulder',  connects: ['Neck', 'R_Elbow'] },
    R_Elbow:      { x: 0.78, y: 0.38, idx: 9,  label: 'R Elbow',     connects: ['R_Shoulder', 'R_F_Paw'] },
    R_F_Paw:      { x: 0.86, y: 0.52, idx: 10, label: 'R Hand',      connects: ['R_Elbow'] },
    L_Hip:        { x: 0.40, y: 0.58, idx: 11, label: 'L Hip',       connects: ['root_of_tail', 'L_Knee'] },
    L_Knee:       { x: 0.38, y: 0.74, idx: 12, label: 'L Knee',      connects: ['L_Hip', 'L_B_Paw'] },
    L_B_Paw:      { x: 0.36, y: 0.90, idx: 13, label: 'L Foot',      connects: ['L_Knee'] },
    R_Hip:        { x: 0.60, y: 0.58, idx: 14, label: 'R Hip',       connects: ['root_of_tail', 'R_Knee'] },
    R_Knee:       { x: 0.62, y: 0.74, idx: 15, label: 'R Knee',      connects: ['R_Hip', 'R_B_Paw'] },
    R_B_Paw:      { x: 0.64, y: 0.90, idx: 16, label: 'R Foot',      connects: ['R_Knee'] },
  },
  bones: [
    ['L_Eye', 'Nose'], ['R_Eye', 'Nose'], ['Nose', 'Neck'],
    ['Neck', 'L_Shoulder'], ['L_Shoulder', 'L_Elbow'], ['L_Elbow', 'L_F_Paw'],
    ['Neck', 'R_Shoulder'], ['R_Shoulder', 'R_Elbow'], ['R_Elbow', 'R_F_Paw'],
    ['Neck', 'root_of_tail'],
    ['root_of_tail', 'L_Hip'], ['L_Hip', 'L_Knee'], ['L_Knee', 'L_B_Paw'],
    ['root_of_tail', 'R_Hip'], ['R_Hip', 'R_Knee'], ['R_Knee', 'R_B_Paw'],
  ],
  required_joints: ['Nose', 'Neck', 'L_Shoulder', 'R_Shoulder', 'L_Hip', 'R_Hip'],
  rep_tracking_joint: 'L_Hip',
  spine_axis: ['Nose', 'root_of_tail'],
  coverage_note: 'AP-10K: gorillas, chimpanzees, orangutans, monkeys',
};

// ─────────────────────────────────────────────────────────────────────────────
// RABBIT — AP-10K schema
// ─────────────────────────────────────────────────────────────────────────────
export const RABBIT_SKELETON: SkeletonTemplate = {
  id: 'rabbit',
  label: 'Rabbit',
  schema: 'ap10k_17',
  requiredModel: 'rtmpose_ap10k',
  joints: { ...QUADRUPED_JOINTS_LATERAL },
  bones: QUADRUPED_BONES,
  required_joints: ['Nose', 'Neck', 'L_Hip', 'R_Hip'],
  rep_tracking_joint: 'L_Hip',
  spine_axis: ['Nose', 'root_of_tail'],
  coverage_note: 'AP-10K: rabbits, hares, hamsters',
};

// ─────────────────────────────────────────────────────────────────────────────
// Registry & Resolver
// ─────────────────────────────────────────────────────────────────────────────

const SKELETON_REGISTRY: Record<string, SkeletonTemplate> = {
  // Human
  human: HUMAN_SKELETON,
  person: HUMAN_SKELETON,

  // Canine family
  dog: DOG_SKELETON,
  wolf: DOG_SKELETON,
  fox: DOG_SKELETON,
  coyote: DOG_SKELETON,
  husky: DOG_SKELETON,

  // Feline family
  cat: CAT_SKELETON,
  lion: CAT_SKELETON,
  tiger: CAT_SKELETON,
  cheetah: CAT_SKELETON,
  leopard: CAT_SKELETON,

  // Equine / Ungulate
  horse: HORSE_SKELETON,
  pony: HORSE_SKELETON,
  zebra: ZEBRA_SKELETON,
  donkey: HORSE_SKELETON,
  deer: HORSE_SKELETON,
  camel: HORSE_SKELETON,
  kangaroo: HORSE_SKELETON,
  giraffe: GIRAFFE_SKELETON,

  // Bovine
  cow: COW_SKELETON,
  bull: COW_SKELETON,
  buffalo: COW_SKELETON,
  bison: COW_SKELETON,
  sheep: SHEEP_SKELETON,
  goat: SHEEP_SKELETON,
  lamb: SHEEP_SKELETON,

  // Large mammals
  elephant: ELEPHANT_SKELETON,
  bear: BEAR_SKELETON,
  panda: BEAR_SKELETON,
  koala: BEAR_SKELETON,

  // Birds
  bird: BIRD_SKELETON,
  eagle: BIRD_SKELETON,
  parrot: BIRD_SKELETON,
  owl: BIRD_SKELETON,
  flamingo: BIRD_SKELETON,
  penguin: BIRD_SKELETON,
  peacock: BIRD_SKELETON,
  ostrich: BIRD_SKELETON,
  hawk: BIRD_SKELETON,
  falcon: BIRD_SKELETON,

  // Primates
  monkey: PRIMATE_SKELETON,
  gorilla: PRIMATE_SKELETON,
  chimpanzee: PRIMATE_SKELETON,
  orangutan: PRIMATE_SKELETON,

  // Small mammals
  rabbit: RABBIT_SKELETON,
  hamster: RABBIT_SKELETON,
  squirrel: RABBIT_SKELETON,
  hedgehog: RABBIT_SKELETON,

  // Pig family
  pig: COW_SKELETON,
  boar: COW_SKELETON,
};

/**
 * Get skeleton template for a given species name.
 * Returns the HUMAN skeleton only for human subjects.
 * Returns AP-10K animal skeleton for all supported animal species.
 * Returns null for unsupported species (pose estimation halts).
 */
export function getSkeletonForSpecies(species: string): SkeletonTemplate | null {
  const key = species.toLowerCase().trim();
  return SKELETON_REGISTRY[key] ?? null;
}

/**
 * Returns true if a pose model exists for this species.
 * Animals return true because the AP-10K RTMPose or YOLOv8 remapping is available.
 * Only returns false for truly unsupported species (reptiles, fish, etc. not in AP-10K).
 */
export function isPoseSupported(species: string): boolean {
  return getSkeletonForSpecies(species) !== null;
}

/**
 * List of species that are in AP-10K training set
 */
export const AP10K_SUPPORTED_SPECIES: string[] = [
  'cheetah','leopard','lion','tiger','wolf','fox','bear','zebra','horse',
  'deer','cow','sheep','dog','cat','rabbit','monkey','elephant','giraffe',
  'ostrich','crocodile','hamster','pig','goat','camel','kangaroo','koala',
  'panda','penguin','flamingo','peacock','parrot','eagle','owl','snake',
  'lizard','turtle','frog','fish','dolphin','seal','walrus','squirrel',
  'raccoon','skunk','badger','otter','beaver','hedgehog','meerkat',
  'gorilla','chimpanzee','orangutan','rhinoceros','hippopotamus','human',
];

/**
 * Provides the AP-10K 17-keypoint index → name mapping.
 * Used to interpret backend pose results correctly.
 */
export const AP10K_KEYPOINT_MAP: Record<number, string> = {
  0: 'L_Eye', 1: 'R_Eye', 2: 'Nose', 3: 'Neck', 4: 'root_of_tail',
  5: 'L_Shoulder', 6: 'L_Elbow', 7: 'L_F_Paw',
  8: 'R_Shoulder', 9: 'R_Elbow', 10: 'R_F_Paw',
  11: 'L_Hip', 12: 'L_Knee', 13: 'L_B_Paw',
  14: 'R_Hip', 15: 'R_Knee', 16: 'R_B_Paw',
};
