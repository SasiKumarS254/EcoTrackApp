/**
 * jointAnalysis.ts
 * Production-grade biomechanical joint analysis engine for EcoTrack AI Scanner.
 *
 * For every detected joint, computes:
 *  - Measured angle (from real keypoint geometry)
 *  - Expected range (from species + exercise template)
 *  - Deviation (signed degrees from ideal midpoint)
 *  - Severity classification: correct | warning | incorrect | critical
 *  - Clinical reason the posture is incorrect (medical + plain English)
 *  - Effect on the exercise performance
 *  - Injury risk (specific anatomical structures at risk)
 *  - Step-by-step correction guidance
 *  - Muscle groups involved
 *  - Color code for UI rendering
 *
 * No random values. All outputs are deterministic from measured geometry.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type JointSeverity = 'correct' | 'warning' | 'incorrect' | 'critical';

export interface JointBiomechanicsResult {
  /** Keypoint / joint name */
  jointName: string;
  /** Human-readable label (e.g. "Left Knee") */
  label: string;
  /** Measured angle in degrees from keypoint geometry */
  measuredAngle: number;
  /** Expected angle range for this joint during this exercise */
  expectedMin: number;
  expectedMax: number;
  /** Signed deviation from ideal midpoint in degrees */
  deviationDeg: number;
  /** Classification */
  severity: JointSeverity;
  /** Deviation description for display */
  deviationLabel: string;
  /** Clinical reason why this is incorrect/warned */
  clinicalReason: string;
  /** Plain English translation of the clinical reason */
  plainReason: string;
  /** How this affects the exercise */
  effectOnExercise: string;
  /** Specific anatomical injury risk */
  injuryRisk: string;
  /** Numbered list of correction steps */
  correctionSteps: string[];
  /** Primary muscle groups active at this joint */
  muscleGroups: string[];
  /** Hex color for UI rendering */
  color: string;
  /** Whether this joint is critical for the exercise */
  isCritical: boolean;
}

export interface FullJointAnalysis {
  joints: JointBiomechanicsResult[];
  overallPostureScore: number;       // 0–100
  criticalJointsFailing: string[];   // Names of critical joints that are incorrect/critical
  warningJoints: string[];
  correctJoints: string[];
  symmetryScore: number;             // 0–100 left/right symmetry
  alignmentScore: number;            // 0–100 overall body alignment
  stabilityScore: number;            // 0–100 (computed from joint variance)
  primaryIssue: string | null;       // Most severe single issue
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<JointSeverity, string> = {
  correct:   '#10b981',  // Emerald green
  warning:   '#f59e0b',  // Amber
  incorrect: '#ef4444',  // Red
  critical:  '#dc2626',  // Deep red
};

// ─────────────────────────────────────────────────────────────────────────────
// Biomechanics Knowledge Base
// Indexed by joint key → species-grouped explanations
// ─────────────────────────────────────────────────────────────────────────────

interface JointKnowledge {
  label: string;
  muscleGroups: string[];
  /** Used when angle > expected max */
  overextensionReason: string;
  overextensionPlain: string;
  overextensionEffect: string;
  overextensionRisk: string;
  overextensionCorrection: string[];
  /** Used when angle < expected min */
  underflexionReason: string;
  underflexionPlain: string;
  underflexionEffect: string;
  underflexionRisk: string;
  underflexionCorrection: string[];
}

const HUMAN_JOINT_KNOWLEDGE: Record<string, JointKnowledge> = {
  left_knee: {
    label: 'Left Knee',
    muscleGroups: ['Quadriceps', 'Hamstrings', 'Gastrocnemius', 'Popliteus'],
    overextensionReason: 'Genu recurvatum (hyperextension) — the tibiofemoral joint is displaced posteriorly beyond neutral, loading the posterior cruciate ligament and joint capsule.',
    overextensionPlain: 'Your left knee is bending too far backward. This overstretches the ligaments at the back of the knee.',
    overextensionEffect: 'Reduces shock absorption and force transfer through the kinetic chain, causing compensatory hip and ankle loading.',
    overextensionRisk: 'Posterior Cruciate Ligament (PCL) sprain, popliteal tendinopathy, joint capsule inflammation.',
    overextensionCorrection: [
      'Soften the knee slightly — avoid locking it straight.',
      'Engage your quadriceps actively to hold the knee in a slight 5–10° flexion.',
      'Press your heel firmly into the ground to activate the posterior chain.',
      'Practise single-leg balance with a slight bend to build proprioceptive control.',
    ],
    underflexionReason: 'Insufficient tibiofemoral flexion — the knee fails to reach the required range of motion, indicating quadriceps tightness or limited hip mobility.',
    underflexionPlain: 'Your left knee is not bending enough. This means you are not going deep enough in the movement.',
    underflexionEffect: 'Reduces glute and hamstring activation, shifts load disproportionately to the lumbar spine and hip flexors.',
    underflexionRisk: 'Patellofemoral Pain Syndrome (PFPS), iliotibial band syndrome, lower back strain.',
    underflexionCorrection: [
      'Consciously drive your knee forward over your toes on the descent.',
      'Ensure your heels remain fully in contact with the floor throughout.',
      'Stretch your hip flexors and quadriceps before the session.',
      'Use a box or bench as a depth reference until the movement is consistent.',
    ],
  },
  right_knee: {
    label: 'Right Knee',
    muscleGroups: ['Quadriceps', 'Hamstrings', 'Gastrocnemius', 'Popliteus'],
    overextensionReason: 'Genu recurvatum (hyperextension) — posterior tibial displacement overloads the PCL and posterolateral capsule.',
    overextensionPlain: 'Your right knee is bending too far backward, straining the ligaments.',
    overextensionEffect: 'Destabilises the knee during loading phases, increasing lateral shear forces.',
    overextensionRisk: 'PCL sprain, lateral collateral ligament stress, capsular laxity.',
    overextensionCorrection: [
      'Soften the knee to a slight 5–10° flexion at all times.',
      'Activate the right quadriceps to prevent passive hyperextension.',
      'Strengthen hip external rotators to improve overall knee alignment.',
      'Taping or a knee brace may assist proprioception during early training.',
    ],
    underflexionReason: 'Insufficient tibiofemoral flexion on the right side — asymmetric with the left, suggesting right-sided hip or ankle restriction.',
    underflexionPlain: 'Your right knee is not bending as much as needed. This creates an imbalance between your left and right sides.',
    underflexionEffect: 'Creates left–right asymmetry increasing rotational stress through the lumbar spine and SI joint.',
    underflexionRisk: 'Medial knee stress, sacroiliac joint dysfunction, hip labral irritation.',
    underflexionCorrection: [
      'Focus on consciously driving the right knee forward during descent.',
      'Mobilise the right ankle — stiff ankles restrict knee flexion depth.',
      'Perform right-side specific hip flexor stretches.',
      'Use slow eccentric (4-second) descents to practise range.',
    ],
  },
  left_hip: {
    label: 'Left Hip',
    muscleGroups: ['Gluteus Maximus', 'Hip Flexors', 'Adductors', 'Piriformis', 'TFL'],
    overextensionReason: 'Anterior pelvic tilt with excessive hip flexion — the iliofemoral ligament is under sustained tension and the lumbar spine enters hyperextension.',
    overextensionPlain: 'Your left hip is bending too far forward, which tilts your pelvis and strains your lower back.',
    overextensionEffect: 'Compresses lumbar discs and reduces glute activation — the posterior chain cannot fire effectively.',
    overextensionRisk: 'Lumbar disc herniation, hip flexor tendinopathy, femoroacetabular impingement (FAI).',
    overextensionCorrection: [
      'Brace your core tightly before initiating any movement.',
      'Squeeze your glutes to pull the pelvis into a neutral position.',
      'Reduce forward trunk lean — keep the torso more upright.',
      'Strengthen transverse abdominis with anti-extension core exercises.',
    ],
    underflexionReason: 'Insufficient hip flexion depth — the acetabulum does not rotate sufficiently through the sagittal plane, indicating gluteal or hamstring tightness.',
    underflexionPlain: 'Your left hip is not hinging back far enough. You need to push the hips further back to complete the movement properly.',
    underflexionEffect: 'Shifts the load forward onto the knees and quadriceps rather than the posterior chain (glutes, hamstrings).',
    underflexionRisk: 'Anterior knee pain, patellar tendinopathy, hip labral tear from compensatory movement.',
    underflexionCorrection: [
      'Think about "sitting back" onto a chair rather than squatting straight down.',
      'Place a small plate under your heels if ankle flexibility is limiting depth.',
      'Perform hip hinge drills with a dowel along your spine.',
      'Stretch the hamstrings and glutes daily before training.',
    ],
  },
  right_hip: {
    label: 'Right Hip',
    muscleGroups: ['Gluteus Maximus', 'Hip Flexors', 'Adductors', 'Piriformis'],
    overextensionReason: 'Anterior pelvic tilt on the right side with hip flexor dominance — the iliofemoral ligament is stressed.',
    overextensionPlain: 'Your right hip is tilting too far forward, causing your lower back to arch excessively.',
    overextensionEffect: 'Asymmetric loading on the lumbar vertebrae increases rotational shear forces.',
    overextensionRisk: 'SI joint dysfunction, hip flexor tendinopathy, lumbar spondylolysis.',
    overextensionCorrection: [
      'Consciously pull your right hip back and down to neutral.',
      'Strengthen the right gluteus medius with lateral band walks.',
      'Foam roll the right hip flexor before each session.',
      'Perform supine pelvic tilt exercises to build motor control.',
    ],
    underflexionReason: 'Right hip flexion deficit — the femoral head does not rotate sufficiently in the acetabulum.',
    underflexionPlain: 'Your right hip is not bending back far enough, reducing the effectiveness of the movement on your right side.',
    underflexionEffect: 'Causes right side loading deficit and compensatory lumbar rotation.',
    underflexionRisk: 'Sacroiliac joint stress, right knee valgus, piriformis syndrome.',
    underflexionCorrection: [
      'Drive the right hip crease backward actively on each rep.',
      'Mobilise the right hip with 90/90 hip stretches.',
      'Add right-side single-leg deadlifts for unilateral strengthening.',
    ],
  },
  left_shoulder: {
    label: 'Left Shoulder',
    muscleGroups: ['Deltoid', 'Rotator Cuff (Supraspinatus, Infraspinatus, Subscapularis)', 'Trapezius', 'Serratus Anterior'],
    overextensionReason: 'Glenohumeral elevation beyond neutral — the subacromial space is compressed, pinching the supraspinatus tendon and subacromial bursa.',
    overextensionPlain: 'Your left shoulder is raised too high, squeezing the tendons beneath your shoulder blade.',
    overextensionEffect: 'Reduces pushing power and shifts load to the upper trapezius, causing premature fatigue and cervical strain.',
    overextensionRisk: 'Subacromial impingement syndrome, rotator cuff tendinopathy, AC joint injury.',
    overextensionCorrection: [
      'Actively depress your left shoulder — "pull it away from your ear."',
      'Retract your scapula by squeezing your shoulder blades together.',
      'Strengthen the lower trapezius with prone Y raises.',
      'Stretch the upper trapezius daily with gentle side-neck tilts.',
    ],
    underflexionReason: 'Insufficient glenohumeral flexion — the shoulder fails to achieve the range needed for optimal lever arm positioning.',
    underflexionPlain: 'Your left shoulder is not in the right position for this movement. It needs to come higher or further forward.',
    underflexionEffect: 'Alters the line of force, reducing the mechanical advantage of the pressing or pulling movement.',
    underflexionRisk: 'Biceps tendon stress, anterior shoulder instability, thoracic outlet syndrome.',
    underflexionCorrection: [
      'Warm up the shoulder with arm circles before the set.',
      'Perform band pull-aparts to activate the rotator cuff.',
      'Focus on protracting the scapula at the start of the movement.',
    ],
  },
  right_shoulder: {
    label: 'Right Shoulder',
    muscleGroups: ['Deltoid', 'Rotator Cuff', 'Trapezius', 'Serratus Anterior'],
    overextensionReason: 'Right glenohumeral elevation compresses the subacromial space — asymmetric to the left, indicating dominant-side trapezius overactivation.',
    overextensionPlain: 'Your right shoulder is hunching up toward your ear, compressing the structures inside.',
    overextensionEffect: 'Creates left–right imbalance; the dominant shoulder compensates for the weaker side, increasing injury risk over time.',
    overextensionRisk: 'Rotator cuff impingement, cervicogenic headaches, upper trapezius trigger points.',
    overextensionCorrection: [
      'Consciously pull the right shoulder down and away from the ear.',
      'Practise shoulder packing with loaded carries.',
      'Release the upper trapezius with a lacrosse ball massage.',
    ],
    underflexionReason: 'Right shoulder fails to match left-side flexion — possible right-side posterior capsule tightness.',
    underflexionPlain: 'Your right shoulder is lagging behind the left. This asymmetry can cause one-sided wear over time.',
    underflexionEffect: 'Reduces right-side output and creates rotational imbalance in bilateral exercises.',
    underflexionRisk: 'SLAP tear, posterior shoulder capsule tightness, cervical facet irritation.',
    underflexionCorrection: [
      'Perform right-side posterior capsule stretching (cross-body shoulder stretch).',
      'Unilateral rows and presses to build right-side strength.',
      'Film from the front to compare shoulder heights each session.',
    ],
  },
  left_elbow: {
    label: 'Left Elbow',
    muscleGroups: ['Biceps Brachii', 'Brachialis', 'Triceps Brachii', 'Brachioradialis'],
    overextensionReason: 'Cubital hyperextension — the olecranon is forced into the fossa, compressing cartilage and stressing the ulnar collateral ligament.',
    overextensionPlain: 'Your left elbow is being pushed past straight, which can damage the cartilage and ligaments inside.',
    overextensionEffect: 'Shifts joint stress from muscles to passive ligamentous structures — reduces efficiency and increases injury susceptibility.',
    overextensionRisk: 'Medial epicondylitis (Golfer\'s Elbow), UCL sprain, olecranon bursitis.',
    overextensionCorrection: [
      'Never fully lock the elbow — maintain a 5–10° soft bend at the top.',
      'Keep tension in the triceps throughout the movement.',
      'Reduce load if the elbow tends to hyperextend under fatigue.',
    ],
    underflexionReason: 'Insufficient elbow flexion — the biceps and brachialis are not working through the required range, limiting mechanical output.',
    underflexionPlain: 'Your left elbow is not bending enough during this movement. You need to bend it further to complete the exercise correctly.',
    underflexionEffect: 'Reduces time under tension for elbow flexors and limits the peak contraction needed for effective strength training.',
    underflexionRisk: 'Tendinopathy of the bicipital insertion, anterior forearm compartment syndrome.',
    underflexionCorrection: [
      'Focus on pulling the wrist all the way toward the shoulder on each rep.',
      'Use a lighter load to practise full range of motion before increasing weight.',
      'Stretch the triceps between sets to improve elbow flexion range.',
    ],
  },
  right_elbow: {
    label: 'Right Elbow',
    muscleGroups: ['Biceps Brachii', 'Brachialis', 'Triceps Brachii'],
    overextensionReason: 'Right olecranon hyperextension — the elbow joint is driven past anatomical neutral.',
    overextensionPlain: 'Your right elbow is going past straight. This places unnecessary stress on the joint structures.',
    overextensionEffect: 'Right-side locking under load creates a moment arm disadvantage and reduces force production.',
    overextensionRisk: 'Lateral epicondylitis (Tennis Elbow), cubital tunnel syndrome, UCL sprain.',
    overextensionCorrection: [
      'Keep a slight bend in the elbow throughout each repetition.',
      'Practise the eccentric (lowering) phase slowly — 3 seconds down.',
      'Strengthen the elbow flexors to provide active joint protection.',
    ],
    underflexionReason: 'Right elbow flexion deficit — asymmetric with the left, possibly indicating right-side biceps weakness or neural tension.',
    underflexionPlain: 'Your right elbow is not bending as far as the left. This asymmetry reduces total output on the right side.',
    underflexionEffect: 'Left–right imbalance in elbow position creates asymmetric forces through the wrist, elbow, and shoulder.',
    underflexionRisk: 'Medial elbow stress, nerve entrapment (radial or ulnar), bicipital tendon strain.',
    underflexionCorrection: [
      'Perform right-side isolation curls to identify and address the weakness.',
      'Check for neural tension with an upper limb neurodynamic test.',
      'Ensure equal bilateral loads to prevent compensation.',
    ],
  },
  left_ankle: {
    label: 'Left Ankle',
    muscleGroups: ['Gastrocnemius', 'Soleus', 'Tibialis Anterior', 'Peroneals'],
    overextensionReason: 'Excessive plantar flexion — the ankle is in a tip-toe position, reducing base of support and destabilising the entire kinetic chain.',
    overextensionPlain: 'Your left ankle is tipped too far down (like standing on tip-toes). This reduces your balance and stability.',
    overextensionEffect: 'Shifts centre of mass anteriorly, causing knee and hip compensatory flexion that compromises the entire movement pattern.',
    overextensionRisk: 'Achilles tendinopathy, plantar fasciitis, lateral ankle sprain.',
    overextensionCorrection: [
      'Keep your heel firmly planted on the ground throughout the movement.',
      'Strengthen tibialis anterior with banded dorsiflexion exercises.',
      'Stretch the calves before training to reduce plantar flexion bias.',
    ],
    underflexionReason: 'Restricted dorsiflexion — the talus cannot glide sufficiently in the mortise joint, blocking knee and hip movement upstream.',
    underflexionPlain: 'Your left ankle is too stiff to bend forward properly. This limits how deep you can go in the movement.',
    underflexionEffect: 'Forces compensatory excessive knee valgus or heel rise, which are primary injury mechanisms in squats and lunges.',
    underflexionRisk: 'Patellar tendinopathy, Achilles impingement, navicular stress fracture.',
    underflexionCorrection: [
      'Mobilise the ankle with lunge-against-wall stretches daily.',
      'Perform ankle banded distraction mobilisation.',
      'Use heel elevation (2cm plate under heels) during training while mobility improves.',
      'Foam roll the calf and Achilles for 90 seconds per side.',
    ],
  },
  right_ankle: {
    label: 'Right Ankle',
    muscleGroups: ['Gastrocnemius', 'Soleus', 'Tibialis Anterior', 'Peroneals'],
    overextensionReason: 'Right plantar flexion excess — ankle rises onto toes, reducing stability.',
    overextensionPlain: 'Your right ankle is tipping forward onto the toes. Keep the heel down.',
    overextensionEffect: 'Creates right-side instability and shifts load disproportionately to the right knee.',
    overextensionRisk: 'Right lateral ankle sprain, peroneal tendinopathy, proximal hamstring strain.',
    overextensionCorrection: [
      'Press the right heel firmly down and spread your toes.',
      'Strengthen the right tibialis anterior with heel walk exercises.',
      'Tape the ankle for proprioceptive feedback during early retraining.',
    ],
    underflexionReason: 'Right dorsiflexion restriction — the posterior ankle capsule limits forward tibial travel.',
    underflexionPlain: 'Your right ankle is too rigid and cannot flex forward enough.',
    underflexionEffect: 'Heel rise on the right causes right knee to shift inward (valgus) during squats and lunges.',
    underflexionRisk: 'Medial knee stress, plantar fasciitis, posterior ankle impingement.',
    underflexionCorrection: [
      'Wall ankle stretch: lean forward with the right knee tracking over the toes.',
      'Mobilise the talus with joint mobilisation techniques.',
      'Address gastrocnemius tightness with standing calf stretches.',
    ],
  },
};

// Canine (dog) joint knowledge
const CANINE_JOINT_KNOWLEDGE: Record<string, JointKnowledge> = {
  front_left_elbow: {
    label: 'Front-Left Elbow',
    muscleGroups: ['Triceps Brachii', 'Biceps Brachii', 'Brachialis', 'Extensor Carpi Radialis'],
    overextensionReason: 'Elbow hyperextension beyond the natural range of the olecranon joint in the canine forelimb — may indicate ligamentous laxity or fragmented coronoid process.',
    overextensionPlain: 'The front-left leg is pushing past the normal elbow angle. This strains the joint ligaments.',
    overextensionEffect: 'Reduces forelimb load-bearing capacity and propulsive efficiency in trot or sit-to-stand exercises.',
    overextensionRisk: 'Elbow dysplasia, coronoid fragmentation, medial compartment syndrome.',
    overextensionCorrection: [
      'Reduce exercise intensity and consult a veterinary physiotherapist.',
      'Hydrotherapy can strengthen forelimb musculature without joint impact.',
      'Monitor for signs of lameness — intermittent limping on the left forelimb.',
    ],
    underflexionReason: 'Insufficient elbow flexion — the animal is not completing the full sit or down position, indicating discomfort or muscular weakness.',
    underflexionPlain: 'The front-left leg is not bending enough, which means the animal is not fully completing the movement.',
    underflexionEffect: 'Indicates the animal is compensating by shifting weight to the right forelimb or hindquarters.',
    underflexionRisk: 'Compensatory right elbow overloading, supraspinatus tendinopathy.',
    underflexionCorrection: [
      'Gently encourage full sit position with food lure at ground level.',
      'Have a veterinarian evaluate for joint pain or neurological deficit.',
      'Introduce range-of-motion exercises under veterinary physiotherapy supervision.',
    ],
  },
  rear_left_hip: {
    label: 'Rear-Left Hip',
    muscleGroups: ['Gluteus Medius', 'Biceps Femoris', 'Iliopsoas', 'Pectineus', 'Gracilis'],
    overextensionReason: 'Lumbosacral extension beyond neutral — the coxofemoral joint is displaced anteriorly, stressing the round ligament of the femoral head.',
    overextensionPlain: 'The rear-left hip is extending too far back. This is often a sign of hip dysplasia or muscular weakness.',
    overextensionEffect: 'Reduces hindquarter propulsion efficiency and increases the likelihood of compensatory thoracolumbar strain.',
    overextensionRisk: 'Hip dysplasia progression, caudal lumbar disc disease, iliopsoas strain.',
    overextensionCorrection: [
      'Consult a veterinarian for hip radiographs if the pattern is consistent.',
      'Swimming or underwater treadmill exercises are ideal for hip rehabilitation.',
      'Hindquarter strengthening — cavaletti poles, balance discs.',
    ],
    underflexionReason: 'Insufficient coxofemoral flexion — the hip joint shows reduced range, typical of hip osteoarthritis or pain avoidance.',
    underflexionPlain: 'The rear-left hip is not flexing properly. This may indicate pain, arthritis, or muscle tightness.',
    underflexionEffect: 'Causes the dog to sit asymmetrically (sloppy sit) or refuse to sit fully, loading the lumbosacral region instead.',
    underflexionRisk: 'Hip osteoarthritis progression, lumbosacral stenosis, medial patella luxation.',
    underflexionCorrection: [
      'Encourage symmetrical sitting using target training.',
      'Apply warm compress to the hip before exercise to improve mobility.',
      'Ask a veterinary physiotherapist about passive range of motion exercises.',
    ],
  },
  withers: {
    label: 'Withers / Thoracic Spine',
    muscleGroups: ['Trapezius', 'Rhomboids', 'Multifidus', 'Longissimus Dorsi'],
    overextensionReason: 'Thoracic kyphosis (rounded back) — the spinous processes of T1-T8 are displaced dorsally, indicating weak epaxial musculature or spinal pain.',
    overextensionPlain: 'The dog\'s upper back is rounded too much. This can indicate back muscle weakness or spinal discomfort.',
    overextensionEffect: 'Reduces forelimb range of motion and disrupts the spinal wave movement required for efficient locomotion.',
    overextensionRisk: 'Intervertebral disc disease (IVDD), supraspinous ligament injury, thoracic facet arthropathy.',
    overextensionCorrection: [
      'Encourage head lifting with a treat held above the dog\'s head to naturally extend the thoracic spine.',
      'Cavaletti pole work at walk to improve spinal proprioception.',
      'Reduce the exercise load until a veterinarian can evaluate the spine.',
    ],
    underflexionReason: 'Thoracic hyperextension — the back is excessively arched, causing compression of the dorsal spinous processes.',
    underflexionPlain: 'The dog\'s back is arched too much in the wrong direction.',
    underflexionEffect: 'Impairs lumbosacral flexibility and hindquarter engagement during the push-off phase.',
    underflexionRisk: 'Kissing spine syndrome (impingement of spinous processes), thoracic disc herniation.',
    underflexionCorrection: [
      'Downward dog stretches — encourage the dog to bow with treats at ground level.',
      'Core strengthening on an inflated disc to improve spinal stability.',
    ],
  },
};

// Generic fallback knowledge for unrecognised joints
function genericKnowledge(jointName: string): JointKnowledge {
  return {
    label: jointName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    muscleGroups: ['Local stabilisers', 'Primary movers'],
    overextensionReason: `The ${jointName} joint has exceeded the expected maximum angle for this exercise, placing passive structures under stress.`,
    overextensionPlain: `The ${jointName} is going past its optimal range. Reduce the movement amplitude.`,
    overextensionEffect: 'Reduces movement efficiency and transfers load to joint capsule and ligaments.',
    overextensionRisk: 'Ligamentous sprain, joint capsule irritation, local tendinopathy.',
    overextensionCorrection: [
      'Reduce range of motion until technique is confirmed.',
      'Consult a physiotherapist or veterinary physiotherapist for assessment.',
      'Strengthen the muscles surrounding this joint for active stability.',
    ],
    underflexionReason: `The ${jointName} joint has not reached the minimum required angle for this exercise, indicating restriction or weakness.`,
    underflexionPlain: `The ${jointName} is not moving far enough. Work on mobility and muscle activation at this joint.`,
    underflexionEffect: 'Compensatory movement patterns develop in adjacent joints, increasing systemic injury risk.',
    underflexionRisk: 'Adjacent joint overloading, muscle imbalance progression.',
    underflexionCorrection: [
      'Perform targeted mobility drills for this joint.',
      'Use progressive range of motion training with lower loads.',
      'Have the movement evaluated by a qualified professional.',
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Analysis Engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Performs full biomechanical analysis for all measured joints.
 *
 * @param measuredAngles - Map of joint key → measured angle in degrees (from computeJointAngles)
 * @param exerciseJointSpecs - From ExerciseTemplate.joint_angles
 * @param criticalJoints - From ExerciseTemplate.critical_joints
 * @param species - e.g. 'Human', 'Dog', 'Cat'
 */
export function analyzeAllJoints(
  measuredAngles: Record<string, number>,
  exerciseJointSpecs: Record<string, { min: number; max: number; warn_margin: number; description: string }>,
  criticalJoints: string[],
  species: string = 'Human',
): FullJointAnalysis {
  const results: JointBiomechanicsResult[] = [];
  const speciesLower = species.toLowerCase();

  for (const [jointKey, angle] of Object.entries(measuredAngles)) {
    const spec = exerciseJointSpecs[jointKey];
    if (!spec) continue;

    const result = analyzeJoint(jointKey, angle, spec.min, spec.max, spec.warn_margin, criticalJoints.includes(jointKey), speciesLower);
    results.push(result);
  }

  // Compute aggregate scores
  const overallPostureScore = computePostureScore(results);
  const symmetryScore = computeSymmetryScore(results);
  const alignmentScore = computeAlignmentScore(results);
  const stabilityScore = computeStabilityScore(measuredAngles);

  const criticalFailing = results.filter(r => r.isCritical && (r.severity === 'incorrect' || r.severity === 'critical')).map(r => r.label);
  const warnings = results.filter(r => r.severity === 'warning').map(r => r.label);
  const correct = results.filter(r => r.severity === 'correct').map(r => r.label);

  // Find the worst-severity issue as the primary issue
  const criticalResult = results.find(r => r.severity === 'critical');
  const incorrectResult = results.find(r => r.severity === 'incorrect' && r.isCritical);
  const primaryResult = criticalResult || incorrectResult || results.find(r => r.severity === 'incorrect');
  const primaryIssue = primaryResult ? `${primaryResult.label}: ${primaryResult.plainReason}` : null;

  return {
    joints: results,
    overallPostureScore,
    criticalJointsFailing: criticalFailing,
    warningJoints: warnings,
    correctJoints: correct,
    symmetryScore,
    alignmentScore,
    stabilityScore,
    primaryIssue,
  };
}

/**
 * Analyze a single joint and produce a full biomechanical result.
 */
function analyzeJoint(
  jointKey: string,
  measuredAngle: number,
  expectedMin: number,
  expectedMax: number,
  warnMargin: number,
  isCritical: boolean,
  speciesLower: string,
): JointBiomechanicsResult {
  const idealMidpoint = (expectedMin + expectedMax) / 2;
  const deviationDeg = Math.round((measuredAngle - idealMidpoint) * 10) / 10;
  const absDeviation = Math.abs(deviationDeg);

  // Classify severity
  let severity: JointSeverity;
  const isAbove = measuredAngle > expectedMax;
  const isBelow = measuredAngle < expectedMin;
  const isInRange = !isAbove && !isBelow;

  if (isInRange) {
    severity = 'correct';
  } else if (isAbove && measuredAngle <= expectedMax + warnMargin) {
    severity = 'warning';
  } else if (isBelow && measuredAngle >= expectedMin - warnMargin) {
    severity = 'warning';
  } else if (absDeviation > warnMargin * 2 && isCritical) {
    severity = 'critical';
  } else {
    severity = 'incorrect';
  }

  // Look up knowledge base
  let knowledge: JointKnowledge;
  if (speciesLower === 'human' || speciesLower === 'person') {
    knowledge = HUMAN_JOINT_KNOWLEDGE[jointKey] || genericKnowledge(jointKey);
  } else if (speciesLower === 'dog' || speciesLower === 'canine') {
    knowledge = CANINE_JOINT_KNOWLEDGE[jointKey] || genericKnowledge(jointKey);
  } else {
    knowledge = genericKnowledge(jointKey);
  }

  // Choose reason / effect / risk / correction based on over vs under
  let clinicalReason: string;
  let plainReason: string;
  let effectOnExercise: string;
  let injuryRisk: string;
  let correctionSteps: string[];
  let deviationLabel: string;

  if (severity === 'correct') {
    clinicalReason = 'Joint angle is within the biomechanically optimal range for this exercise.';
    plainReason = 'This joint is in the correct position. Keep it up!';
    effectOnExercise = 'Optimal mechanical advantage and load distribution.';
    injuryRisk = 'Minimal risk when maintained within this range.';
    correctionSteps = ['Maintain current position and movement pattern.'];
    deviationLabel = `Within range (${measuredAngle.toFixed(0)}°)`;
  } else if (isAbove) {
    clinicalReason = knowledge.overextensionReason;
    plainReason = knowledge.overextensionPlain;
    effectOnExercise = knowledge.overextensionEffect;
    injuryRisk = knowledge.overextensionRisk;
    correctionSteps = knowledge.overextensionCorrection;
    deviationLabel = `+${(measuredAngle - expectedMax).toFixed(0)}° above max`;
  } else {
    clinicalReason = knowledge.underflexionReason;
    plainReason = knowledge.underflexionPlain;
    effectOnExercise = knowledge.underflexionEffect;
    injuryRisk = knowledge.underflexionRisk;
    correctionSteps = knowledge.underflexionCorrection;
    deviationLabel = `${(expectedMin - measuredAngle).toFixed(0)}° below min`;
  }

  return {
    jointName: jointKey,
    label: knowledge.label,
    measuredAngle: Math.round(measuredAngle * 10) / 10,
    expectedMin,
    expectedMax,
    deviationDeg,
    severity,
    deviationLabel,
    clinicalReason,
    plainReason,
    effectOnExercise,
    injuryRisk,
    correctionSteps,
    muscleGroups: knowledge.muscleGroups,
    color: SEVERITY_COLORS[severity],
    isCritical,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Score Computation
// ─────────────────────────────────────────────────────────────────────────────

function computePostureScore(results: JointBiomechanicsResult[]): number {
  if (results.length === 0) return 0;
  const weights = results.map(r => r.isCritical ? 2 : 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const weightedScore = results.reduce((sum, r, i) => {
    const score = r.severity === 'correct' ? 100 : r.severity === 'warning' ? 65 : r.severity === 'incorrect' ? 30 : 0;
    return sum + score * weights[i];
  }, 0);
  return Math.round(weightedScore / totalWeight);
}

function computeSymmetryScore(results: JointBiomechanicsResult[]): number {
  const paired: Record<string, number[]> = {};
  for (const r of results) {
    // Group left/right pairs by stripping left_/right_ prefix
    const base = r.jointName.replace(/^(left_|right_|front_left_|front_right_|rear_left_|rear_right_)/, '');
    if (!paired[base]) paired[base] = [];
    paired[base].push(r.measuredAngle);
  }

  const diffs: number[] = [];
  for (const angles of Object.values(paired)) {
    if (angles.length >= 2) {
      diffs.push(Math.abs(angles[0] - angles[1]));
    }
  }

  if (diffs.length === 0) return 90; // No pairs found, assume reasonable symmetry
  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  // 0° difference = 100, 30°+ difference = 0
  return Math.max(0, Math.round(100 - (avgDiff / 30) * 100));
}

function computeAlignmentScore(results: JointBiomechanicsResult[]): number {
  if (results.length === 0) return 0;
  const criticalResults = results.filter(r => r.isCritical);
  if (criticalResults.length === 0) return computePostureScore(results);
  return computePostureScore(criticalResults);
}

function computeStabilityScore(measuredAngles: Record<string, number>): number {
  const values = Object.values(measuredAngles);
  if (values.length < 2) return 85;
  // Stability approximated from variance in measured angles — high variance = less stable
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  // StdDev of ~20° across joints is normal; > 40° is unstable
  return Math.max(0, Math.round(100 - (stdDev / 40) * 60));
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────

export function getSeverityLabel(severity: JointSeverity): string {
  switch (severity) {
    case 'correct':   return 'Correct';
    case 'warning':   return 'Minor Deviation';
    case 'incorrect': return 'Incorrect';
    case 'critical':  return 'Critical Error';
  }
}

export function getJointSeverityColor(severity: JointSeverity): string {
  return SEVERITY_COLORS[severity];
}

export function getOverallAssessment(score: number): { label: string; description: string; color: string } {
  if (score >= 90) return { label: 'Excellent', description: 'Biomechanically optimal form. Maintain this standard.', color: '#10b981' };
  if (score >= 75) return { label: 'Good', description: 'Minor deviations present. Focus on the highlighted joints.', color: '#22c55e' };
  if (score >= 60) return { label: 'Needs Improvement', description: 'Several joint positions require correction. Review the guidance below.', color: '#f59e0b' };
  if (score >= 40) return { label: 'Poor Form', description: 'Significant biomechanical errors present. Reduce load and focus on technique.', color: '#f97316' };
  return { label: 'High Injury Risk', description: 'Critical joint errors detected. Stop the exercise and follow the correction steps.', color: '#ef4444' };
}
