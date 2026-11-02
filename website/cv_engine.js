// cv_engine.js
// Production-Grade AI Scanner Engine for EcoTrack Web (Inference-Only)
// Connects to the local Python Flask backend on port 5001.

const BACKEND_URL = 'http://localhost:5001';

// Math utility to calculate angle at vertex b given points a, b, c
function calculateAngle(a, b, c) {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * 180 / Math.PI);
  if (angle > 180) {
    angle = 360 - angle;
  }
  return angle;
}

// -----------------------------------------------------------------------------
// Skeletons Definition (Matches backend & mobile templates)
// -----------------------------------------------------------------------------
const AP10K_KEYPOINTS = [
  "L_Eye", "R_Eye", "Nose", "Neck", "root_of_tail",
  "L_Shoulder", "L_Elbow", "L_F_Paw",
  "R_Shoulder", "R_Elbow", "R_F_Paw",
  "L_Hip", "L_Knee", "L_B_Paw",
  "R_Hip", "R_Knee", "R_B_Paw"
];

const QUADRUPED_BONES = [
  ['L_Eye', 'Nose'], ['R_Eye', 'Nose'], ['Nose', 'Neck'],
  ['Neck', 'L_Shoulder'], ['L_Shoulder', 'L_Elbow'], ['L_Elbow', 'L_F_Paw'],
  ['Neck', 'R_Shoulder'], ['R_Shoulder', 'R_Elbow'], ['R_Elbow', 'R_F_Paw'],
  ['Neck', 'root_of_tail'],
  ['root_of_tail', 'L_Hip'], ['L_Hip', 'L_Knee'], ['L_Knee', 'L_B_Paw'],
  ['root_of_tail', 'R_Hip'], ['R_Hip', 'R_Knee'], ['R_Knee', 'R_B_Paw']
];

const SKELETON_TEMPLATES = {
  human: {
    schema: 'coco_17',
    joints: {
      nose: { idx: 0, label: 'Nose' },
      left_eye: { idx: 1, label: 'L Eye' },
      right_eye: { idx: 2, label: 'R Eye' },
      left_ear: { idx: 3, label: 'L Ear' },
      right_ear: { idx: 4, label: 'R Ear' },
      left_shoulder: { idx: 5, label: 'L Shoulder' },
      right_shoulder: { idx: 6, label: 'R Shoulder' },
      left_elbow: { idx: 7, label: 'L Elbow' },
      right_elbow: { idx: 8, label: 'R Elbow' },
      left_wrist: { idx: 9, label: 'L Wrist' },
      right_wrist: { idx: 10, label: 'R Wrist' },
      left_hip: { idx: 11, label: 'L Hip' },
      right_hip: { idx: 12, label: 'R Hip' },
      left_knee: { idx: 13, label: 'L Knee' },
      right_knee: { idx: 14, label: 'R Knee' },
      left_ankle: { idx: 15, label: 'L Ankle' },
      right_ankle: { idx: 16, label: 'R Ankle' }
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
      ['right_hip', 'right_knee'], ['right_knee', 'right_ankle']
    ],
    triplets: [
      { a: 'left_elbow', b: 'left_shoulder', c: 'left_hip', label: 'L Shoulder Angle' },
      { a: 'right_elbow', b: 'right_shoulder', c: 'right_hip', label: 'R Shoulder Angle' },
      { a: 'left_wrist', b: 'left_elbow', c: 'left_shoulder', label: 'L Elbow Angle' },
      { a: 'right_wrist', b: 'right_elbow', c: 'right_shoulder', label: 'R Elbow Angle' },
      { a: 'left_ankle', b: 'left_knee', c: 'left_hip', label: 'L Knee Angle' },
      { a: 'right_ankle', b: 'right_knee', c: 'right_hip', label: 'R Knee Angle' },
      { a: 'left_knee', b: 'left_hip', c: 'right_hip', label: 'L Hip Flex' },
      { a: 'right_knee', b: 'right_hip', c: 'left_hip', label: 'R Hip Flex' }
    ]
  },
  animal: {
    schema: 'ap10k_17',
    joints: AP10K_KEYPOINTS.reduce((acc, name, i) => {
      acc[name] = { idx: i, label: name.replace(/_/g, ' ') };
      return acc;
    }, {}),
    bones: QUADRUPED_BONES,
    triplets: [
      { a: 'L_F_Paw', b: 'L_Elbow', c: 'L_Shoulder', label: 'L Front Knee' },
      { a: 'R_F_Paw', b: 'R_Elbow', c: 'R_Shoulder', label: 'R Front Knee' },
      { a: 'L_Elbow', b: 'L_Shoulder', c: 'Neck', label: 'L Shoulder' },
      { a: 'R_Elbow', b: 'R_Shoulder', c: 'Neck', label: 'R Shoulder' },
      { a: 'L_B_Paw', b: 'L_Knee', c: 'L_Hip', label: 'L Hock/Knee' },
      { a: 'R_B_Paw', b: 'R_Knee', c: 'R_Hip', label: 'R Hock/Knee' },
      { a: 'L_Knee', b: 'L_Hip', c: 'root_of_tail', label: 'L Hip' },
      { a: 'R_Knee', b: 'R_Hip', c: 'root_of_tail', label: 'R Hip' },
      { a: 'Neck', b: 'L_Shoulder', c: 'L_Hip', label: 'Spine Alignment' }
    ]
  }
};

// -----------------------------------------------------------------------------
// Exercise Templates Definition (Matches exerciseTemplates.ts)
// -----------------------------------------------------------------------------
const EXERCISE_RULES = {
  human_squat: {
    name: 'Squat',
    rep_tracking_joint: 'left_hip',
    rep_threshold: 0.06,
    rules: {
      left_knee: { min: 60, max: 100, ideal: 85, label: 'L Knee Flexion' },
      right_knee: { min: 60, max: 100, ideal: 85, label: 'R Knee Flexion' },
      left_hip: { min: 60, max: 100, ideal: 80, label: 'L Hip Flexion' },
      right_hip: { min: 60, max: 100, ideal: 80, label: 'R Hip Flexion' }
    }
  },
  human_deadlift: {
    name: 'Deadlift',
    rep_tracking_joint: 'left_hip',
    rep_threshold: 0.08,
    rules: {
      left_hip: { min: 140, max: 180, ideal: 160, label: 'L Hip Extension' },
      right_hip: { min: 140, max: 180, ideal: 160, label: 'R Hip Extension' },
      left_knee: { min: 130, max: 175, ideal: 155, label: 'L Knee' },
      right_knee: { min: 130, max: 175, ideal: 155, label: 'R Knee' }
    }
  },
  human_pushup: {
    name: 'Push-Up',
    rep_tracking_joint: 'left_elbow',
    rep_threshold: 0.05,
    rules: {
      left_elbow: { min: 70, max: 120, ideal: 90, label: 'L Elbow Flexion' },
      right_elbow: { min: 70, max: 120, ideal: 90, label: 'R Elbow Flexion' }
    }
  },
  dog_sit: {
    name: 'Sit Cue',
    rep_tracking_joint: 'L_Hip',
    rep_threshold: 0.07,
    rules: {
      L_Hip: { min: 60, max: 100, ideal: 80, label: 'L Hip Flexion' },
      R_Hip: { min: 60, max: 100, ideal: 80, label: 'R Hip Flexion' },
      L_Knee: { min: 50, max: 90, ideal: 70, label: 'L Stifle Angle' },
      R_Knee: { min: 50, max: 90, ideal: 70, label: 'R Stifle Angle' }
    }
  },
  dog_down: {
    name: 'Down Cue',
    rep_tracking_joint: 'Neck',
    rep_threshold: 0.08,
    rules: {
      L_Hip: { min: 110, max: 150, ideal: 130, label: 'L Hip Alignment' },
      R_Hip: { min: 110, max: 150, ideal: 130, label: 'R Hip Alignment' },
      L_Shoulder: { min: 80, max: 120, ideal: 100, label: 'L Forelimb Flex' },
      R_Shoulder: { min: 80, max: 120, ideal: 100, label: 'R Forelimb Flex' }
    }
  },
  dog_stand: {
    name: 'Stand',
    rep_tracking_joint: 'Neck',
    rep_threshold: 0.05,
    rules: {
      L_Elbow: { min: 140, max: 180, ideal: 165, label: 'L Fore Leg Extension' },
      R_Elbow: { min: 140, max: 180, ideal: 165, label: 'R Fore Leg Extension' },
      L_Knee: { min: 140, max: 180, ideal: 165, label: 'L Hind Leg Extension' },
      R_Knee: { min: 140, max: 180, ideal: 165, label: 'R Hind Leg Extension' }
    }
  },
  horse_halt: {
    name: 'Square Halt',
    rep_tracking_joint: 'Neck',
    rep_threshold: 0.03,
    rules: {
      L_Elbow: { min: 145, max: 180, ideal: 165, label: 'L Forelimb Extension' },
      R_Elbow: { min: 145, max: 180, ideal: 165, label: 'R Forelimb Extension' },
      L_Knee: { min: 145, max: 180, ideal: 165, label: 'L Hindlimb Extension' },
      R_Knee: { min: 145, max: 180, ideal: 165, label: 'R Hindlimb Extension' }
    }
  },
  horse_trot: {
    name: 'Trot Stride',
    rep_tracking_joint: 'L_F_Paw',
    rep_threshold: 0.10,
    rules: {
      L_Elbow: { min: 100, max: 140, ideal: 120, label: 'L Fore Elbow Flexion' },
      R_Elbow: { min: 100, max: 140, ideal: 120, label: 'R Fore Elbow Flexion' },
      L_Knee: { min: 90, max: 130, ideal: 110, label: 'L Hind Stifle' },
      R_Knee: { min: 90, max: 130, ideal: 110, label: 'R Hind Stifle' }
    }
  },
  cat_stretch: {
    name: 'Cat Stretch',
    rep_tracking_joint: 'Neck',
    rep_threshold: 0.06,
    rules: {
      Neck: { min: 100, max: 150, ideal: 130, label: 'Neck Extension' },
      L_Hip: { min: 140, max: 180, ideal: 165, label: 'L Hip Extension' },
      R_Hip: { min: 140, max: 180, ideal: 165, label: 'R Hip Extension' },
      L_Elbow: { min: 145, max: 180, ideal: 168, label: 'L Forelimb Reach' },
      R_Elbow: { min: 145, max: 180, ideal: 168, label: 'R Forelimb Reach' }
    }
  },
  human_lunge: {
    name: 'Lunge',
    rep_tracking_joint: 'left_knee',
    rep_threshold: 0.07,
    rules: {
      left_knee: { min: 80, max: 100, ideal: 90, label: 'Front Knee Flexion' },
      right_knee: { min: 80, max: 100, ideal: 90, label: 'Back Knee Flexion' },
      left_hip: { min: 150, max: 180, ideal: 165, label: 'Back Hip Extension' }
    }
  },
  human_shoulder_press: {
    name: 'Shoulder Press',
    rep_tracking_joint: 'left_wrist',
    rep_threshold: 0.10,
    rules: {
      left_elbow: { min: 85, max: 180, ideal: 170, label: 'L Elbow Extension' },
      right_elbow: { min: 85, max: 180, ideal: 170, label: 'R Elbow Extension' },
      left_shoulder: { min: 60, max: 120, ideal: 90, label: 'L Shoulder Abduction' },
      right_shoulder: { min: 60, max: 120, ideal: 90, label: 'R Shoulder Abduction' }
    }
  },
  human_plank: {
    name: 'Plank',
    rep_tracking_joint: 'left_hip',
    rep_threshold: 0.02,
    rules: {
      left_hip: { min: 160, max: 200, ideal: 180, label: 'L Hip Alignment' },
      right_hip: { min: 160, max: 200, ideal: 180, label: 'R Hip Alignment' },
      left_knee: { min: 160, max: 200, ideal: 180, label: 'L Knee Extension' },
      right_knee: { min: 160, max: 200, ideal: 180, label: 'R Knee Extension' }
    }
  },
  human_pullup: {
    name: 'Pull-Up',
    rep_tracking_joint: 'left_wrist',
    rep_threshold: 0.12,
    rules: {
      left_elbow: { min: 50, max: 90, ideal: 70, label: 'L Elbow Flexion (top)' },
      right_elbow: { min: 50, max: 90, ideal: 70, label: 'R Elbow Flexion (top)' }
    }
  },
  generic_walk: {
    name: 'Gait Walk / Stride',
    rep_tracking_joint: 'L_F_Paw',
    rep_threshold: 0.08,
    rules: {
      L_Elbow: { min: 110, max: 165, ideal: 138, label: 'L Forelimb Flexion' },
      R_Elbow: { min: 110, max: 165, ideal: 138, label: 'R Forelimb Flexion' },
      L_Knee: { min: 105, max: 160, ideal: 132, label: 'L Hind Stifle Flexion' },
      R_Knee: { min: 105, max: 160, ideal: 132, label: 'R Hind Stifle Flexion' }
    }
  },
  generic_run: {
    name: 'Sprint / Run Agility',
    rep_tracking_joint: 'L_F_Paw',
    rep_threshold: 0.12,
    rules: {
      L_Elbow: { min: 85, max: 168, ideal: 125, label: 'L Fore Drive Angle' },
      R_Elbow: { min: 85, max: 168, ideal: 125, label: 'R Fore Drive Angle' },
      L_Knee: { min: 80, max: 172, ideal: 122, label: 'L Hind Stifle Impulsion' },
      R_Knee: { min: 80, max: 172, ideal: 122, label: 'R Hind Stifle Impulsion' }
    }
  },
  generic_jump: {
    name: 'Jump / Kinetic Clearance',
    rep_tracking_joint: 'Neck',
    rep_threshold: 0.14,
    rules: {
      L_Knee: { min: 65, max: 175, ideal: 115, label: 'Takeoff Stifle Launch' },
      R_Knee: { min: 65, max: 175, ideal: 115, label: 'Takeoff Stifle Launch' },
      L_Elbow: { min: 75, max: 170, ideal: 118, label: 'Forelimb Clearance' },
      R_Elbow: { min: 75, max: 170, ideal: 118, label: 'Forelimb Clearance' }
    }
  },
  free_pose: {
    name: 'Free Pose Scan',
    rep_tracking_joint: 'Neck',
    rep_threshold: 0.20,
    rules: {}
  }
};



