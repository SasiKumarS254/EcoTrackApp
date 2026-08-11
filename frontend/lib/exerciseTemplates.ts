/**
 * exerciseTemplates.ts — EcoTrack Exercise Definitions
 * ─────────────────────────────────────────────────────────────────────────────
 * Exercise templates define joint angle rules for form analysis.
 * Rules use the same keypoint schema as the skeleton templates:
 *  - Human exercises → COCO-17 joint names
 *  - Animal exercises → AP-10K-17 joint names
 *
 * Joint rules define:
 *  - min, max: acceptable angle range (degrees)
 *  - ideal: optimal angle
 *  - tolerance: additional degrees before marking 'incorrect' (default 10)
 *
 * Rep counting uses the rep_tracking_joint + rep_threshold (normalized Y delta).
 */

export interface JointRule {
  min:        number;
  max:        number;
  ideal:      number;
  tolerance?: number;
  label:      string;
}

export interface ExerciseTemplate {
  id:                  string;
  name:                string;
  description:         string;
  species:             string[];   // supported species
  difficulty:          'Beginner' | 'Intermediate' | 'Advanced';
  rep_tracking_joint:  string;     // which keypoint y-position to track for rep counting
  rep_threshold:       number;     // normalized Y delta for rep detection (0.0 - 1.0)
  joint_rules:         Record<string, JointRule>;
  coaching_cues:       string[];
  target_muscles:      string[];
  
  // Legacy / backward compatibility properties
  coaching_tip?:       string;
  completion_reps?:    number;
  joint_angles?:       Record<string, { min: number; max: number }>;
  critical_joints?:    string[];
}

// HUMAN EXERCISES (COCO-17 keypoints)
// ─────────────────────────────────────────────────────────────────────────────

const HUMAN_SQUAT: ExerciseTemplate = {
  id:          'human_squat',
  name:        'Squat',
  description: 'Standard barbell or bodyweight squat — full range of motion',
  species:     ['human'],
  difficulty:  'Beginner',
  rep_tracking_joint: 'left_hip',
  rep_threshold: 0.06,
  joint_rules: {
    left_knee:  { min: 60, max: 100, ideal: 85, label: 'L Knee Flexion', tolerance: 12 },
    right_knee: { min: 60, max: 100, ideal: 85, label: 'R Knee Flexion', tolerance: 12 },
    left_hip:   { min: 60, max: 100, ideal: 80, label: 'L Hip Flexion', tolerance: 12 },
    right_hip:  { min: 60, max: 100, ideal: 80, label: 'R Hip Flexion', tolerance: 12 },
    left_ankle: { min: 70, max: 100, ideal: 88, label: 'L Ankle Dorsiflexion', tolerance: 15 },
    right_ankle:{ min: 70, max: 100, ideal: 88, label: 'R Ankle Dorsiflexion', tolerance: 15 },
  },
  coaching_cues: [
    'Keep your chest tall and proud',
    'Drive knees outward over toes',
    'Hip crease below knee at bottom',
    'Push through whole foot to stand',
  ],
  target_muscles: ['Quadriceps', 'Glutes', 'Hamstrings', 'Core'],
};

const HUMAN_DEADLIFT: ExerciseTemplate = {
  id:          'human_deadlift',
  name:        'Deadlift',
  description: 'Conventional deadlift — hip hinge pattern',
  species:     ['human'],
  difficulty:  'Intermediate',
  rep_tracking_joint: 'left_hip',
  rep_threshold: 0.08,
  joint_rules: {
    left_hip:    { min: 140, max: 180, ideal: 160, label: 'L Hip Extension', tolerance: 12 },
    right_hip:   { min: 140, max: 180, ideal: 160, label: 'R Hip Extension', tolerance: 12 },
    left_knee:   { min: 130, max: 175, ideal: 155, label: 'L Knee', tolerance: 15 },
    right_knee:  { min: 130, max: 175, ideal: 155, label: 'R Knee', tolerance: 15 },
    left_shoulder:  { min: 160, max: 200, ideal: 180, label: 'L Shoulder (neutral)', tolerance: 15 },
    right_shoulder: { min: 160, max: 200, ideal: 180, label: 'R Shoulder (neutral)', tolerance: 15 },
  },
  coaching_cues: [
    'Hinge at hips, not waist',
    'Neutral spine throughout',
    'Bar close to body path',
    'Squeeze glutes at lockout',
  ],
  target_muscles: ['Hamstrings', 'Glutes', 'Erector Spinae', 'Traps', 'Lats'],
};

const HUMAN_PUSHUP: ExerciseTemplate = {
  id:          'human_pushup',
  name:        'Push-Up',
  description: 'Standard push-up — chest to floor',
  species:     ['human'],
  difficulty:  'Beginner',
  rep_tracking_joint: 'left_elbow',
  rep_threshold: 0.05,
  joint_rules: {
    left_elbow:  { min: 70, max: 120, ideal: 90, label: 'L Elbow Flexion', tolerance: 10 },
    right_elbow: { min: 70, max: 120, ideal: 90, label: 'R Elbow Flexion', tolerance: 10 },
    left_shoulder:  { min: 140, max: 180, ideal: 160, label: 'L Shoulder Angle', tolerance: 12 },
    right_shoulder: { min: 140, max: 180, ideal: 160, label: 'R Shoulder Angle', tolerance: 12 },
  },
  coaching_cues: [
    'Maintain plank position',
    'Elbows at 45° from torso',
    'Full range: chest to ground',
    'Lock out elbows at top',
  ],
  target_muscles: ['Pectorals', 'Triceps', 'Anterior Deltoids', 'Core'],
};

const HUMAN_LUNGE: ExerciseTemplate = {
  id:          'human_lunge',
  name:        'Lunge',
  description: 'Walking or stationary forward lunge',
  species:     ['human'],
  difficulty:  'Beginner',
  rep_tracking_joint: 'left_knee',
  rep_threshold: 0.07,
  joint_rules: {
    left_knee:   { min: 80, max: 100, ideal: 90, label: 'Front Knee (90°)', tolerance: 10 },
    right_knee:  { min: 80, max: 100, ideal: 90, label: 'Back Knee', tolerance: 12 },
    left_hip:    { min: 150, max: 180, ideal: 165, label: 'Back Hip Extension', tolerance: 12 },
  },
  coaching_cues: [
    'Front knee directly over ankle',
    'Back knee hovers above ground',
    'Upright torso throughout',
    'Step long enough for 90° bend',
  ],
  target_muscles: ['Quadriceps', 'Glutes', 'Hamstrings', 'Hip Flexors'],
};

const HUMAN_SHOULDER_PRESS: ExerciseTemplate = {
  id:          'human_shoulder_press',
  name:        'Shoulder Press',
  description: 'Overhead press — dumbbells or barbell',
  species:     ['human'],
  difficulty:  'Intermediate',
  rep_tracking_joint: 'left_wrist',
  rep_threshold: 0.10,
  joint_rules: {
    left_elbow:  { min: 85, max: 180, ideal: 170, label: 'L Elbow Extension', tolerance: 10 },
    right_elbow: { min: 85, max: 180, ideal: 170, label: 'R Elbow Extension', tolerance: 10 },
    left_shoulder:  { min: 60, max: 120, ideal: 90, label: 'L Shoulder Abduction', tolerance: 12 },
    right_shoulder: { min: 60, max: 120, ideal: 90, label: 'R Shoulder Abduction', tolerance: 12 },
  },
  coaching_cues: [
    'Full lockout overhead',
    'Keep core braced',
    'Elbows under wrists',
    'Lower to chin level',
  ],
  target_muscles: ['Deltoids', 'Triceps', 'Upper Traps', 'Core'],
};

const HUMAN_PLANK: ExerciseTemplate = {
  id:          'human_plank',
  name:        'Plank',
  description: 'Standard forearm or full plank hold',
  species:     ['human'],
  difficulty:  'Beginner',
  rep_tracking_joint: 'left_hip',
  rep_threshold: 0.02,
  joint_rules: {
    left_hip:    { min: 160, max: 200, ideal: 180, label: 'L Hip Alignment', tolerance: 10 },
    right_hip:   { min: 160, max: 200, ideal: 180, label: 'R Hip Alignment', tolerance: 10 },
    left_knee:   { min: 160, max: 200, ideal: 180, label: 'L Knee Extension', tolerance: 10 },
    right_knee:  { min: 160, max: 200, ideal: 180, label: 'R Knee Extension', tolerance: 10 },
  },
  coaching_cues: [
    'Neutral spine — no sagging hips',
    'Glutes and core tight throughout',
    'Head neutral, gaze down',
    'Push floor away from hands',
  ],
  target_muscles: ['Core', 'Glutes', 'Shoulders', 'Erectors'],
};

const HUMAN_PULL_UP: ExerciseTemplate = {
  id:          'human_pullup',
  name:        'Pull-Up',
  description: 'Strict pull-up — dead hang to chin over bar',
  species:     ['human'],
  difficulty:  'Intermediate',
  rep_tracking_joint: 'left_wrist',
  rep_threshold: 0.12,
  joint_rules: {
    left_elbow:  { min: 50, max: 90, ideal: 70, label: 'L Elbow Flexion (top)', tolerance: 12 },
    right_elbow: { min: 50, max: 90, ideal: 70, label: 'R Elbow Flexion (top)', tolerance: 12 },
  },
  coaching_cues: [
    'Full dead hang at bottom',
    'Pull elbows to hips, not floor',
    'Chin clears bar at top',
    'Avoid kipping or swinging',
  ],
  target_muscles: ['Lats', 'Biceps', 'Rear Deltoids', 'Core'],
};

// ─────────────────────────────────────────────────────────────────────────────
// ANIMAL EXERCISES (AP-10K-17 keypoints)
// ─────────────────────────────────────────────────────────────────────────────

const DOG_SIT: ExerciseTemplate = {
  id:          'dog_sit',
  name:        'Sit',
  description: 'Standard sit cue — hind end on ground, front straight',
  species:     ['dog', 'wolf', 'fox'],
  difficulty:  'Beginner',
  rep_tracking_joint: 'L_Hip',
  rep_threshold: 0.07,
  joint_rules: {
    L_Hip:  { min: 60, max: 100, ideal: 80, label: 'L Hip Flexion (sit)', tolerance: 12 },
    R_Hip:  { min: 60, max: 100, ideal: 80, label: 'R Hip Flexion (sit)', tolerance: 12 },
    L_Knee: { min: 50, max: 90,  ideal: 70, label: 'L Stifle', tolerance: 12 },
    R_Knee: { min: 50, max: 90,  ideal: 70, label: 'R Stifle', tolerance: 12 },
    L_Elbow: { min: 140, max: 180, ideal: 165, label: 'L Fore Leg (straight)', tolerance: 12 },
    R_Elbow: { min: 140, max: 180, ideal: 165, label: 'R Fore Leg (straight)', tolerance: 12 },
  },
  coaching_cues: [
    'Hind legs tucked under body',
    'Front legs perpendicular to ground',
    'Spine tall and balanced',
    'Head forward, ears alert',
  ],
  target_muscles: ['Quadriceps', 'Hip Flexors', 'Core Stabilizers'],
};

const DOG_DOWN: ExerciseTemplate = {
  id:          'dog_down',
  name:        'Down / Lay',
  description: 'Full down position — all four limbs on ground',
  species:     ['dog', 'wolf', 'fox'],
  difficulty:  'Beginner',
  rep_tracking_joint: 'Neck',
  rep_threshold: 0.08,
  joint_rules: {
    L_Hip:  { min: 110, max: 150, ideal: 130, label: 'L Hip (down)', tolerance: 15 },
    R_Hip:  { min: 110, max: 150, ideal: 130, label: 'R Hip (down)', tolerance: 15 },
    L_Shoulder: { min: 80, max: 120, ideal: 100, label: 'L Fore Flex (down)', tolerance: 15 },
    R_Shoulder: { min: 80, max: 120, ideal: 100, label: 'R Fore Flex (down)', tolerance: 15 },
  },
  coaching_cues: [
    'Elbows tucked along ribcage',
    'Chest touching ground',
    'Relaxed posture held quietly',
    'All paws flat on surface',
  ],
  target_muscles: ['Hip Flexors', 'Shoulder Stabilizers', 'Core'],
};

const DOG_STAND: ExerciseTemplate = {
  id:          'dog_stand',
  name:        'Stand',
  description: 'Balanced four-point stance with full leg extension',
  species:     ['dog', 'wolf', 'fox', 'cat', 'horse', 'cow', 'sheep'],
  difficulty:  'Beginner',
  rep_tracking_joint: 'Neck',
  rep_threshold: 0.05,
  joint_rules: {
    L_Elbow: { min: 140, max: 180, ideal: 165, label: 'L Fore Leg Extension', tolerance: 10 },
    R_Elbow: { min: 140, max: 180, ideal: 165, label: 'R Fore Leg Extension', tolerance: 10 },
    L_Knee:  { min: 140, max: 180, ideal: 165, label: 'L Hind Leg Extension', tolerance: 10 },
    R_Knee:  { min: 140, max: 180, ideal: 165, label: 'R Hind Leg Extension', tolerance: 10 },
  },
  coaching_cues: [
    'All four legs fully extended',
    'Level topline (spine parallel to ground)',
    'Weight distributed evenly',
    'Head up, alert expression',
  ],
  target_muscles: ['All Four Limb Extensors', 'Core', 'Postural Stabilizers'],
};

const HORSE_HALT: ExerciseTemplate = {
  id:          'horse_halt',
  name:        'Square Halt',
  description: 'Four-square halt with legs aligned and weight balanced',
  species:     ['horse', 'donkey', 'pony'],
  difficulty:  'Intermediate',
  rep_tracking_joint: 'Neck',
  rep_threshold: 0.03,
  joint_rules: {
    L_Elbow: { min: 145, max: 180, ideal: 165, label: 'L Fore Leg', tolerance: 10 },
    R_Elbow: { min: 145, max: 180, ideal: 165, label: 'R Fore Leg', tolerance: 10 },
    L_Knee:  { min: 145, max: 180, ideal: 165, label: 'L Hind Leg', tolerance: 10 },
    R_Knee:  { min: 145, max: 180, ideal: 165, label: 'R Hind Leg', tolerance: 10 },
    Neck:    { min: 100, max: 140, ideal: 120, label: 'Neck Arch', tolerance: 15 },
  },
  coaching_cues: [
    'All four hooves in square formation',
    'Weight distributed front to back',
    'Neck relaxed and natural',
    'Horse attentive but calm',
  ],
  target_muscles: ['All Limb Extensors', 'Topline Muscles', 'Postural Stabilizers'],
};

const HORSE_TROT: ExerciseTemplate = {
  id:          'horse_trot',
  name:        'Trot Stride',
  description: 'Two-beat diagonal gait — assess joint flexion at peak stride',
  species:     ['horse', 'donkey', 'pony', 'zebra'],
  difficulty:  'Intermediate',
  rep_tracking_joint: 'L_F_Paw',
  rep_threshold: 0.10,
  joint_rules: {
    L_Elbow: { min: 100, max: 140, ideal: 120, label: 'L Fore Elbow Flexion', tolerance: 15 },
    R_Elbow: { min: 100, max: 140, ideal: 120, label: 'R Fore Elbow Flexion', tolerance: 15 },
    L_Knee:  { min: 90, max: 130, ideal: 110, label: 'L Hind Stifle', tolerance: 15 },
    R_Knee:  { min: 90, max: 130, ideal: 110, label: 'R Hind Stifle', tolerance: 15 },
  },
  coaching_cues: [
    'Diagonal pair moves together',
    'Lift foreleg to correct flexion',
    'Hind leg tracks up to foreleg print',
    'Back swinging freely',
  ],
  target_muscles: ['Fore & Hind Limb Flexors', 'Shoulder', 'Hindquarters'],
};

const CAT_STRETCH: ExerciseTemplate = {
  id:          'cat_stretch',
  name:        'Cat Stretch',
  description: 'Full body extension — arched back raised',
  species:     ['cat', 'lion', 'tiger', 'cheetah', 'leopard'],
  difficulty:  'Beginner',
  rep_tracking_joint: 'Neck',
  rep_threshold: 0.06,
  joint_rules: {
    Neck: { min: 100, max: 150, ideal: 130, label: 'Neck Extension', tolerance: 15 },
    L_Hip: { min: 140, max: 180, ideal: 165, label: 'L Hip Extension', tolerance: 12 },
    R_Hip: { min: 140, max: 180, ideal: 165, label: 'R Hip Extension', tolerance: 12 },
  },
  coaching_cues: [
    'Full spine elongation',
    'Hind legs extend behind',
    'Front paws stretch forward',
    'Natural curved topline',
  ],
  target_muscles: ['Spine Extensors', 'Hip Flexors', 'Shoulder Girdle'],
};

const FREE_POSE_SCAN: ExerciseTemplate = {
  id:          'free_pose',
  name:        'Free Pose Scan',
  description: 'No exercise — just pose capture and keypoint analysis',
  species:     ['human', 'dog', 'cat', 'horse', 'cow', 'sheep', 'bird', 'elephant',
                'bear', 'zebra', 'giraffe', 'rabbit', 'monkey'],
  difficulty:  'Beginner',
  rep_tracking_joint: 'Neck',
  rep_threshold: 0.20,
  joint_rules: {},
  coaching_cues: [
    'Hold still for best pose detection',
    'Ensure full body is visible',
    'Good lighting improves accuracy',
  ],
  target_muscles: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Exercise Registry
// ─────────────────────────────────────────────────────────────────────────────
const ALL_EXERCISES: ExerciseTemplate[] = [
  // Human
  HUMAN_SQUAT,
  HUMAN_DEADLIFT,
  HUMAN_PUSHUP,
  HUMAN_LUNGE,
  HUMAN_SHOULDER_PRESS,
  HUMAN_PLANK,
  HUMAN_PULL_UP,
  // Dog / Canine
  DOG_SIT,
  DOG_DOWN,
  DOG_STAND,
  // Horse / Equine
  HORSE_HALT,
  HORSE_TROT,
  // Cat / Feline
  CAT_STRETCH,
  // Universal
  FREE_POSE_SCAN,
];

/**
 * Get all exercises applicable to a species.
 */
export function getExercisesForSpecies(species: string): ExerciseTemplate[] {
  const key = species.toLowerCase().trim();
  const applicable = ALL_EXERCISES.filter(ex => {
    if (ex.id === 'free_pose') return true;
    return ex.species.some(s => s === key || s === 'any');
  });
  // Always add Free Pose Scan at start
  return applicable;
}

/**
 * Get a specific exercise by ID.
 */
export function getExerciseById(id: string): ExerciseTemplate | null {
  return ALL_EXERCISES.find(ex => ex.id === id) ?? null;
}

export default ALL_EXERCISES;
