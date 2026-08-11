// ============================================================
// EcoTrack Professional Exercise Profiles & Instruction Registry
// ============================================================

export interface ExerciseProfile {
  id: string;
  name: string;
  targetSpecies: string;
  objective: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced" | "Expert";
  duration: string;
  reps: string;
  sets: string;
  rest: string;
  caloriesBurned?: string;   // For humans where applicable
  energyExpended?: string;   // For animals where applicable
  equipment: string[];
  environment: string;
  safetyPrecautions: string[];
  prerequisites: string;
  primaryMuscles: string[];
  keyJoints: string[];
  expectedROM: string;
  commonErrors: string[];
  injuryPrevention: string;
  successCriteria: string;
  progression: string;
  regression: string;
  variations: string[];
  coachingNarrative: {
    specialistTitle: string;  // e.g. "Certified Veterinary Specialist (DACVS)" or "CSCS Strength Coach"
    whyIncluded: string;
    benefits: string;
    longTermAdaptation: string;
  };
  trainerBreakdown: {
    purpose: string;
    anatomy: string;
    activationPatterns: string;
    correctiveGuidance: string;
    preExerciseSafety: string;
    shortTermImprovements: string;
    longTermImprovements: string;
    incorrectFormIndicators: string[];
    stopConditions: string;
  };
  media: {
    format: 'video' | 'illustrated_guide' | 'animated_svg' | 'curated_content';
    videoUrl?: string;
    steps?: string[];
    svgAnimationData?: string;
    libraryContent?: string;
  };
}

// Curated profiles for primary exercises
const CURATED_PROFILES: Record<string, Partial<ExerciseProfile>> = {
  // Human Squat
  squat: {
    objective: "Build lower body strength, improve hip mobility, and develop knee/ankle stability.",
    difficulty: "Beginner",
    duration: "10-15 minutes",
    reps: "12-15 repetitions",
    sets: "3-4 sets",
    rest: "60-90 seconds",
    caloriesBurned: "60-80 kcal per session (intensity dependent)",
    equipment: ["None (Bodyweight)", "Optional: Dumbbells or Barbell"],
    environment: "Flat, non-slip floor space with at least 2m x 2m clearance.",
    safetyPrecautions: [
      "Keep heels firmly planted on the ground to distribute weight evenly.",
      "Ensure knees track directly over toes to prevent knee valgus (collapsing inward).",
      "Avoid rounding the lower back (lumbar flexion) at the bottom of the movement."
    ],
    prerequisites: "Basic standing balance and ankle joint mobility.",
    primaryMuscles: ["Quadriceps Femoris (Rectus Femoris, Vastus Lateralis/Medialis)", "Gluteus Maximus", "Hamstrings", "Erector Spinae"],
    keyJoints: ["Knee (Tibiofemoral joint)", "Hip (Acetabulofemoral joint)", "Ankle (Talocrural joint)"],
    expectedROM: "90° to 110° knee flexion with hips dropping below the knee line (parallel squat or ATG).",
    commonErrors: [
      "Knee valgus collapse (knees caving inwards).",
      "Heels lifting off the ground, shifting weight to the patella.",
      "Spinal rounding (loss of neutral lumbar alignment)."
    ],
    injuryPrevention: "Focus on active hip abduction to keep knees aligned, and warm up ankle joints thoroughly before adding resistance.",
    successCriteria: "Ability to complete 15 parallel squats with heels flat and a neutral spine.",
    progression: "Add tempo controls (e.g., 3-second descent) or external resistance (goblet squats or barbell back squats).",
    regression: "Box squats (squatting down to a chair/bench) to limit depth and build eccentric control.",
    variations: ["Jump Squat (Explosive)", "Pistol Squat (Single-leg advanced)"],
    coachingNarrative: {
      specialistTitle: "CSCS Strength & Conditioning Specialist",
      whyIncluded: "The squat is the fundamental biomechanical movement pattern for human functional independence, building core structural integrity and lower limb capacity.",
      benefits: "Improves quadriceps and gluteal motor unit recruitment, enhances bone density in the hips and spine, and expands active range of motion in the ankles and hips.",
      longTermAdaptation: "Over weeks, you will see a reduction in lower back discomfort, enhanced running power, and increased joint resilience under load."
    },
    trainerBreakdown: {
      purpose: "Establish primary sagittal plane hip-hinge and knee-flexion mechanics.",
      anatomy: "Targets the lower extremities, specifically loading the anterior and posterior chains with core bracing.",
      activationPatterns: "High activation of the quadriceps and gluteus maximus during the concentric phase, with co-contraction of the core stabilizers.",
      correctiveGuidance: "If knees cave in, cue the client to 'push the floor apart' or place a resistance band around their thighs.",
      preExerciseSafety: "Check ankle dorsiflexion and ensure client has no acute knee pain.",
      shortTermImprovements: "Immediate improvements in lower extremity blood flow and nervous system activation.",
      longTermImprovements: "Hypertrophy of lower body musculature and significant gains in structural strength.",
      incorrectFormIndicators: ["Heels raising", "Knees caving", "Lumbar rounding", "Chest collapsing"],
      stopConditions: "Sharp pain in the knee joint or lower back; inability to stand back up."
    },
    media: {
      format: "video",
      videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-man-doing-squats-in-front-of-a-mirror-40431-large.mp4",
      steps: [
        "Stand with feet shoulder-width apart, toes pointing slightly outward.",
        "Engage your core, keep your chest high, and look straight ahead.",
        "Inhale and begin the movement by pushing your hips back as if sitting in a chair.",
        "Lower down until your thighs are at least parallel to the floor.",
        "Exhale, drive through your heels, and return to the starting position."
      ]
    }
  },

  // Canine Sit & Stay
  dog_sit_stay: {
    objective: "Develop sustained impulse control, focus, and structural hindquarter stability.",
    difficulty: "Beginner",
    duration: "5-10 minutes",
    reps: "5 reps of 30-second hold",
    sets: "2 sets",
    rest: "60 seconds",
    energyExpended: "15-20 kcal per session (canine metabolic rate equivalent)",
    equipment: ["High-value training treats", "Clicker", "Flat collar and training leash"],
    environment: "Low-distraction indoor space transitioning to outdoor parks.",
    safetyPrecautions: [
      "Do not push down on the dog's hips to force a sit, which can damage the joint.",
      "Keep sessions short and positive to prevent mental fatigue and stress.",
      "Perform on non-slip surfaces to protect the hind limb joints from sliding."
    ],
    prerequisites: "Response to name and basic treat-luring tracking.",
    primaryMuscles: ["Core stabilizers", "Iliopsoas", "Sartorius", "Gluteal muscle group"],
    keyJoints: ["Stifle (Knee) joint", "Coxofemoral (Hip) joint", "Hock joint"],
    expectedROM: "Consistent seated posture with hind legs flexed squarely under the body, tail centered.",
    commonErrors: [
      "Dog rolling onto one hip ('lazy sit'), causing asymmetrical joint loading.",
      "Breaking position early due to premature treat release.",
      "Handler standing too close, reducing distance challenge early."
    ],
    injuryPrevention: "Ensure the dog stands up and stretches between sets. Avoid hard or slippery concrete surfaces.",
    successCriteria: "Holds a square seated position for 30 seconds with handler standing 2 meters away.",
    progression: "Increase distance (up to 10m), duration (up to 3 mins), or add high distractions (rolling ball).",
    regression: "Lure the dog into a sit next to a wall to encourage a straight, square alignment, holding for 5 seconds.",
    variations: ["Out-of-sight Stay", "Emergency Stop-Stay from distance"],
    coachingNarrative: {
      specialistTitle: "Certified Canine Rehabilitation Practitioner (CCRP)",
      whyIncluded: "The Sit & Stay builds core isometric strength in the dog's rear quarters, helping prevent joint laxity while establishing the foundation of obedience training.",
      benefits: "Increases stifle and hip flexor strength, aligns the vertebral column under controlled loads, and improves focus under stress.",
      longTermAdaptation: "Consistent practice prevents rear-limb muscle atrophy, improves pelvic stability, and reduces the likelihood of cruciate ligament injuries."
    },
    trainerBreakdown: {
      purpose: "Train hindquarter flexion loading and neurological focus.",
      anatomy: "Requires muscular stabilization of the lumbar spine, pelvis, and hind limbs.",
      activationPatterns: "Isometric engagement of the gluteals and stifle stabilizers to maintain position, combined with focused attention.",
      correctiveGuidance: "If the dog sits lazy on one hip, step forward to encourage them to stand up, then re-lure them straight forward.",
      preExerciseSafety: "Ensure the dog has no pre-existing hip dysplasia pain or hindlimb soreness.",
      shortTermImprovements: "Noticeable improvement in baseline focus and response to clicker timing.",
      longTermImprovements: "Balanced hip musculature and highly reliable impulse control in public settings.",
      incorrectFormIndicators: ["Lazy hip sit", "Tail tucking (stress)", "Shifting weight off hindlimbs", "Pacing"],
      stopConditions: "Signs of acute rear-leg limping, refusal to sit, or panting representing pain."
    },
    media: {
      format: "illustrated_guide",
      steps: [
        "Position the dog in front of you on a flat, non-slip training mat.",
        "Hold a treat near the dog's nose, then raise it slowly upward and backward over their head.",
        "As their head goes up, their hips will naturally lower into a sit. Click and reward.",
        "Step 1 pace back, raise your hand open-faced (stay signal), and wait 5 seconds.",
        "Step forward, reward, and use a release word (e.g. 'Okay!') before they move."
      ]
    }
  },

  // Feline Ledge Jump
  cat_ledge_jump: {
    objective: "Develop explosive posterior vertical thrust, core alignment, and landing absorption.",
    difficulty: "Intermediate",
    duration: "5 minutes",
    reps: "5-6 vertical leaps",
    sets: "1 set",
    energyExpended: "10-12 kcal (feline target expenditure)",
    equipment: ["Stable high ledge or cat shelf (40-80cm)", "Target stick", "Premium treat lure"],
    environment: "Indoor room with safe landing pads and no sharp obstacles.",
    safetyPrecautions: [
      "Ensure landing platform is heavy and anchored, preventing tip-overs.",
      "Avoid slippery laminate floors; use carpets or rubber mats.",
      "Limit height for kittens under 1 year to protect growth plates."
    ],
    prerequisites: "Stable jump landing from low heights (30cm).",
    primaryMuscles: ["Gastrocnemius", "Biceps femoris", "Quadriceps femoris", "Erector spinae"],
    keyJoints: ["Stifle (Knee)", "Coxofemoral (Hip)", "Hock (Ankle)", "Shoulder (Girdle)"],
    expectedROM: "Complete hindlimb extension at launch (near 180°), full forelimb shoulder flexion on landing.",
    commonErrors: [
      "Uncoordinated launch slip due to a dusty surface.",
      "Awkward landing balance causing wrist impact strain.",
      "Hesitation or refusal due to height anxiety."
    ],
    injuryPrevention: "Check that the platform is clean and dry. Keep takeoff surface close to landing target.",
    successCriteria: "Clears a 60cm vertical jump with a clean, silent 4-paw landing.",
    progression: "Increase vertical height to 80-100cm, or introduce a jump-and-turn angle.",
    regression: "Lower shelf to 30cm or use an intermediate step to make it a two-stage climb.",
    variations: ["Horizontal gap jump", "Platform-to-platform sequence"],
    coachingNarrative: {
      specialistTitle: "Feline Behavioral & Biomechanics Specialist",
      whyIncluded: "Jumping is the ultimate expression of feline athletic health, stretching the spine and conditioning the fast-twitch muscle fibers of the rear thighs.",
      benefits: "Engages hindlimb propulsion systems, builds core abdominal strength, and stimulates visual depth-perception.",
      longTermAdaptation: "Preserves joint elasticity, keeps weight in check, and keeps the spine limber, delaying arthritic stiffness in older cats."
    },
    trainerBreakdown: {
      purpose: "Target explosive plyometric vertical extension.",
      anatomy: "Requires rapid recruitment of the pelvic limbs, hip extensors, and spinal arch muscles.",
      activationPatterns: "Concentric burst from the hindquarters followed by eccentric deceleration through the front shoulders and wrists.",
      correctiveGuidance: "Lure the target slowly so the cat has time to measure the leap with their eyes rather than rushing.",
      preExerciseSafety: "Do not attempt if the cat has diagnosed hip dysplasia or cardiovascular conditions.",
      shortTermImprovements: "Enhanced landing control and accuracy.",
      longTermImprovements: "Improved hindquarter muscle tone and active metabolic rate.",
      incorrectFormIndicators: ["Takeoff slipping", "Lopsided landing", "Spine arching abnormally", "Hesitating over 10s"],
      stopConditions: "Limping, vocalizing in pain during takeoff or landing, or refusal to perform."
    },
    media: {
      format: "animated_svg",
      svgAnimationData: "M10,80 Q30,20 60,30 T90,40", // Simplified trace path
      steps: [
        "Place the cat on a non-slip takeoff mat looking toward a stable 50cm shelf.",
        "Hold the target stick or treat right above the shelf edge to focus their gaze.",
        "Encourage the cat to leap by tapping the shelf. Click as they clear the height.",
        "Reward on the shelf. Let them sit, then lure them back down gently."
      ]
    }
  }
};

/**
 * Main registry lookup that returns a fully customized, professional profile.
 * Incorporates fallback logic to generate biologically accurate profiles for other species.
 */
export function getExerciseProfile(exerciseId: string, speciesName: string): ExerciseProfile {
  const normId = exerciseId.toLowerCase().replace("dog_", "").replace("cat_", "").replace("horse_", "").replace("wild_", "");
  
  // Look up curated base profile
  const base = CURATED_PROFILES[exerciseId] || CURATED_PROFILES[normId] || {};
  const isHuman = speciesName.toLowerCase().includes("human") || speciesName.toLowerCase().includes("person");
  
  // Dynamic fallback generator
  const generated: ExerciseProfile = {
    id: exerciseId,
    name: base.name || exerciseId.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    targetSpecies: speciesName,
    objective: base.objective || `Improve overall physical coordination and strength for the ${speciesName}.`,
    difficulty: (base.difficulty as any) || "Intermediate",
    duration: base.duration || "10-15 minutes",
    reps: base.reps || "10 repetitions",
    sets: base.sets || "3 sets",
    rest: base.rest || "60 seconds",
    equipment: base.equipment || ["Flat, clear training surface", "Treats or incentives"],
    environment: base.environment || "Safe training area free of debris and distractions.",
    safetyPrecautions: base.safetyPrecautions || [
      "Ensure proper warm-up before initiating higher-intensity movements.",
      "Monitor closely for signs of physical stress, limping, or rapid breathing.",
      "Keep clean drinking water nearby at all times."
    ],
    prerequisites: base.prerequisites || "Basic calm behavior and attentiveness.",
    primaryMuscles: base.primaryMuscles || ["Core stabilizers", "Postural alignment muscles"],
    keyJoints: base.keyJoints || ["Hip joints", "Shoulder joints", "Vertebral column joints"],
    expectedROM: base.expectedROM || "Controlled, symmetrical range of motion matching standard species gait.",
    commonErrors: base.commonErrors || [
      "Rushing through the movement without control.",
      "Asymmetrical weight-bearing or limping.",
      "Loss of balance due to slippery surface."
    ],
    injuryPrevention: base.injuryPrevention || "Limit repetitions and ensure flat footing on non-slip rubber mats.",
    successCriteria: base.successCriteria || "Completion of all sets with symmetry and calm recovery.",
    progression: base.progression || "Introduce mild distractions or increase duration by 20%.",
    regression: base.regression || "Provide physical guiding or limit the depth of range.",
    variations: base.variations || ["Slow-tempo variation", "Increased-frequency hold"],
    coachingNarrative: base.coachingNarrative || {
      specialistTitle: isHuman ? "Certified Strength & Conditioning Coach (CSCS)" : "Board-Certified Veterinary Behaviorist",
      whyIncluded: `This drill is included to construct essential movement pathways, training the neurological response for active posture correction.`,
      benefits: `Improves skeletal support, balances bilateral muscle groups, and conditions the metabolic systems.`,
      longTermAdaptation: `Leads to improved stamina, reduced joint wear, and enhanced muscular coordination over a 4-8 week training block.`
    },
    trainerBreakdown: base.trainerBreakdown || {
      purpose: `Condition primary functional movement patterns.`,
      anatomy: `Loads the major structural muscles supporting the spinal column and limbs.`,
      activationPatterns: `Rhythmic recruitment of postural stabilizers and stabilizers.`,
      correctiveGuidance: `Keep targets low and reward steady movements rather than high speed.`,
      preExerciseSafety: `Verify the animal is hydrated and has no joint tenderness.`,
      shortTermImprovements: `Noticeable focus and improved gait fluidness.`,
      longTermImprovements: `Sustained muscular endurance and stable posture.`,
      incorrectFormIndicators: ["Limping", "Hesitating", "Arching back", "Vocalizing"],
      stopConditions: `Any signs of limping, refusal, heavy panting, or distress.`
    },
    media: base.media || {
      format: "illustrated_guide",
      steps: [
        `Prepare a safe, quiet, non-slip training environment.`,
        `Focus the target's attention using a suitable treat or reward.`,
        `Guide the movement slowly, ensuring the limbs follow the target line.`,
        `Mark and reward the exact moment of correct alignment.`,
        `Perform the recommended reps, then allow a 60-second recovery break.`
      ]
    }
  };

  // Add calorie / energy values dynamically
  if (isHuman) {
    generated.caloriesBurned = base.caloriesBurned || "50-70 kcal per session";
  } else {
    generated.energyExpended = base.energyExpended || "8-15 kcal per session";
  }

  return generated;
}
