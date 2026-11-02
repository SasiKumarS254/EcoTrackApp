import os
import sys
import json
import random
import numpy as np
import pandas as pd
import joblib

from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer

print("==========================================================")
print("  ECOTRACK PROFESSIONAL MULTI-DAY PERIODIZED ML TRAINER")
print("==========================================================")

np.random.seed(42)
random.seed(42)

# Deep Clinical & Professional Exercise Library per Movement Pattern & Species Group
PROFESSIONAL_EXERCISE_LIBRARY = {
    "human": {
        "Push": [
            {"id": "h_push_1", "name": "Barbell Incline Bench Press", "muscles": "Upper Pectoralis, Anterior Deltoids, Triceps", "joints": "Shoulder, Elbow"},
            {"id": "h_push_2", "name": "Parallel Bar Dips", "muscles": "Lower Pectoralis, Triceps Brachii", "joints": "Shoulder, Elbow"},
            {"id": "h_push_3", "name": "Dumbbell Overhead Press", "muscles": "Deltoids, Upper Trapezius", "joints": "Shoulder, Scapula"},
            {"id": "h_push_4", "name": "Tempo Push-Ups (3-1-1 ECC)", "muscles": "Pectoralis Major, Core Stabilizers", "joints": "Elbow, Core"}
        ],
        "Pull": [
            {"id": "h_pull_1", "name": "Pronated Lat Pulldowns", "muscles": "Latissimus Dorsi, Teres Major", "joints": "Shoulder, Scapula"},
            {"id": "h_pull_2", "name": "Bent-Over Barbell Rows", "muscles": "Rhomboids, Latissimus Dorsi, Posterior Delts", "joints": "Shoulder, Elbow, Hip"},
            {"id": "h_pull_3", "name": "Single-Arm Dumbbell Rows", "muscles": "Latissimus Dorsi, Core Anti-Rotation", "joints": "Shoulder, Elbow"},
            {"id": "h_pull_4", "name": "Face Pulls with Cable", "muscles": "External Rotators, Rear Deltoids, Lower Trap", "joints": "Shoulder, Scapula"}
        ],
        "Legs": [
            {"id": "h_leg_1", "name": "Barbell Back Squats", "muscles": "Quadriceps, Gluteus Maximus", "joints": "Knee, Hip, Ankle"},
            {"id": "h_leg_2", "name": "Romanian Deadlifts (RDL)", "muscles": "Hamstrings, Glute-Ham Junction, Erector Spinae", "joints": "Hip Hinge, Knee"},
            {"id": "h_leg_3", "name": "Bulgarian Split Squats", "muscles": "Quadriceps, Gluteus Medius, Core Balance", "joints": "Knee, Hip, Ankle"},
            {"id": "h_leg_4", "name": "Barbell Hip Thrusts", "muscles": "Gluteus Maximus, Gluteus Medius", "joints": "Hip Flexion/Extension"}
        ],
        "Core": [
            {"id": "h_core_1", "name": "Hanging Leg Raises", "muscles": "Rectus Abdominis, Hip Flexors", "joints": "Lumbar Spine, Hip"},
            {"id": "h_core_2", "name": "Ab Wheel Rollouts", "muscles": "Transverse Abdominis, Latissimus", "joints": "Shoulder, Core"},
            {"id": "h_core_3", "name": "Paloff Press with Resistance Band", "muscles": "Obliques, Transverse Abdominis", "joints": "Core Anti-Rotation"},
            {"id": "h_core_4", "name": "Weighted Planks (Isometric Hold)", "muscles": "Full Core Stabilizers, Erector Spinae", "joints": "Spine Neutral"}
        ],
        "Agility": [
            {"id": "h_agil_1", "name": "Plyometric Box Jumps", "muscles": "Fast-Twitch Quads, Calves, Glutes", "joints": "Ankle, Knee, Hip"},
            {"id": "h_agil_2", "name": "Lateral Cone Shuttle Runs", "muscles": "Adductors, Abductors, Calves", "joints": "Ankle, Knee"},
            {"id": "h_agil_3", "name": "Agility Ladder In-and-Out Footwork", "muscles": "Gastrocnemius, Soleus, Tibialis", "joints": "Ankle"}
        ],
        "Recovery": [
            {"id": "h_rec_1", "name": "Cat-Cow Thoracic Mobility", "muscles": "Thoracic Spine Flexors/Extensors", "joints": "Spine Intervertebral"},
            {"id": "h_rec_2", "name": "90/90 Hip Mobility Flow", "muscles": "Hip Rotators, Piriformis", "joints": "Hip Acetabulum"},
            {"id": "h_rec_3", "name": "Foam Roller Quadriceps & Lats Decompression", "muscles": "Myofascial Tissue", "joints": "Full Body"}
        ]
    },
    "dog": {
        "Push": [
            {"id": "d_push_1", "name": "Incline Ramp Power Climbs", "muscles": "Forelimb Pectorals, Deltoids, Triceps", "joints": "Shoulder, Elbow"},
            {"id": "d_push_2", "name": "Front-Leg Target Stand Touches", "muscles": "Quadriceps, Forearm Flexors", "joints": "Paw, Wrist"}
        ],
        "Pull": [
            {"id": "d_pull_1", "name": "Weighted Harness Drag Sets", "muscles": "Hindlimb Glutes, Hamstrings, Spinal Extensors", "joints": "Hip, Stifle, Hock"},
            {"id": "d_pull_2", "name": "Tug-of-War Resistance Pulley Holds", "muscles": "Cervical Flexors, Latissimus, Jaws", "joints": "Neck, Shoulder"}
        ],
        "Legs": [
            {"id": "d_leg_1", "name": "Controlled Sit-to-Stand Repetitions", "muscles": "Quadriceps, Glutes, Gastrocnemius", "joints": "Stifle (Knee), Hock, Hip"},
            {"id": "d_leg_2", "name": "Hind-Leg Elevated Balance Holds", "muscles": "Hindlimb Core Stabilizers, Glutes", "joints": "Hip, Hock"}
        ],
        "Core": [
            {"id": "d_core_1", "name": "Peanut Ball Dynamic Balance Holds", "muscles": "Paraspinal Muscles, Core Stabilizers", "joints": "Spine Neutral"},
            {"id": "d_core_2", "name": "Side-to-Side Cookie Stretches", "muscles": "Obliques, Intercostals, Cervical Flexors", "joints": "Spinal Column"}
        ],
        "Agility": [
            {"id": "d_agil_1", "name": "Cavaletti Rail Over-Steps (Adjusted Spacing)", "muscles": "Joint Flexors, Proprioceptive Receptors", "joints": "Stifle, Hock, Elbow"},
            {"id": "d_agil_2", "name": "Weave Pole Slalom Navigation", "muscles": "Lateral Core Flexors, Paws", "joints": "Spine, Paws"}
        ],
        "Recovery": [
            {"id": "d_rec_1", "name": "Passive Range of Motion (PROM) Stifle Flexion", "muscles": "Joint Capsule, Ligaments", "joints": "Stifle, Hock"},
            {"id": "d_rec_2", "name": "Warm Hydrotherapy Underwater Treadmill Walk", "muscles": "Low-Impact Full Body", "joints": "All Joints Decompressed"}
        ]
    },
    "generic": {
        "Push": [
            {"id": "g_push_1", "name": "Forelimb Resistance Press Walk", "muscles": "Pectoral & Shoulder Girdle", "joints": "Front Limbs"},
            {"id": "g_push_2", "name": "Upward Slope Chest Push Steps", "muscles": "Quadriceps & Forelimb Pressors", "joints": "Shoulder, Elbow"}
        ],
        "Pull": [
            {"id": "g_pull_1", "name": "Backward Resistance Pull Trot", "muscles": "Posterior Chain & Spinal Extensors", "joints": "Hind Limbs, Spine"},
            {"id": "g_pull_2", "name": "Harness Pulling Lines", "muscles": "Latissimus & Glutes", "joints": "Hip, Hock"}
        ],
        "Legs": [
            {"id": "g_leg_1", "name": "Steep Hill Propulsion Sprints", "muscles": "Glutes, Hamstrings, Quads", "joints": "Hip, Knee, Hock"},
            {"id": "g_leg_2", "name": "Deep Bend Step-Ups", "muscles": "Quadriceps & Stabilizers", "joints": "Knee, Hip"}
        ],
        "Core": [
            {"id": "g_core_1", "name": "Unstable Surface Balance Disc Hold", "muscles": "Spinal Stabilizers, Core", "joints": "Spinal Segmental"},
            {"id": "g_core_2", "name": "Controlled Lateral Trunk Flexion", "muscles": "Obliques & Paraspinal", "joints": "Thoracolumbar Spine"}
        ],
        "Agility": [
            {"id": "g_agil_1", "name": "Obstacle Slalom Weave Trot", "muscles": "Adductors & Fast-Twitch Paws", "joints": "All Limbs"},
            {"id": "g_agil_2", "name": "Directional Pivot Jumps", "muscles": "Proprioceptors & Stabilizers", "joints": "All Joints"}
        ],
        "Recovery": [
            {"id": "g_rec_1", "name": "Low-Impact Flat Walk & Stretch", "muscles": "Full-Body Decompression", "joints": "Decompressed Joints"},
            {"id": "g_rec_2", "name": "Gentle Joint Flexion & Hydration Rest", "muscles": "Musculotendinous Junctions", "joints": "All Flexion Points"}
        ]
    }
}

# Generate 5,000 Dataset Samples for Training Model
SPECIES_SAMPLES = ["human", "dog", "cat", "horse", "cheetah", "lion", "bear", "wolf", "cow", "rabbit"]
GOALS = ["Muscle Building", "Weight Loss", "Agility & Speed", "Rehabilitation & Joint Recovery", "Cardiovascular Endurance", "General Health & Fitness"]

samples = []
for i in range(5000):
    species = random.choice(SPECIES_SAMPLES)
    goal = random.choice(GOALS)
    age = random.randint(1, 45)
    weight = round(random.uniform(3.0, 450.0), 1)
    day_num = random.randint(1, 14)
    injury = random.choice(["None", "None", "None", "Hip Stiffness", "Knee Tendonitis", "Spine Strain"])

    # Determine Periodization Phase based on day_num
    if day_num % 4 == 0:
        day_type = "Recovery"
    elif day_num % 4 == 1:
        day_type = "Push" if goal in ["Muscle Building", "General Health & Fitness"] else "Agility"
    elif day_num % 4 == 2:
        day_type = "Legs" if goal in ["Muscle Building", "Weight Loss"] else "Pull"
    else:
        day_type = "Core" if goal in ["Rehabilitation & Joint Recovery", "General Health & Fitness"] else "Push"

    group = "human" if "human" in species else ("dog" if "dog" in species else "generic")
    category_drills = PROFESSIONAL_EXERCISE_LIBRARY[group].get(day_type, PROFESSIONAL_EXERCISE_LIBRARY["generic"][day_type])
    
    primary_drill = random.choice(category_drills)["name"]
    secondary_drill = random.choice(category_drills)["name"]

    # Compute intensity, sets, reps, rest
    if day_type == "Recovery":
        sets, reps, rest, kcal = 2, 8, 45, 120
    elif goal == "Muscle Building":
        sets, reps, rest, kcal = random.choice([3, 4, 5]), random.choice([8, 10, 12]), 90, 480
    elif goal == "Weight Loss":
        sets, reps, rest, kcal = random.choice([4, 5]), random.choice([15, 20]), 45, 580
    elif goal == "Agility & Speed":
        sets, reps, rest, kcal = random.choice([3, 4]), random.choice([6, 8]), 120, 520
    else:
        sets, reps, rest, kcal = 3, 10, 60, 320

    samples.append({
        "species": species,
        "goal": goal,
        "age": age,
        "weight": weight,
        "day_num": day_num,
        "day_type": day_type,
        "injury": injury,
        "primary_drill": primary_drill,
        "secondary_drill": secondary_drill,
        "sets": sets,
        "reps": reps,
        "rest_sec": rest,
        "kcal_hr": kcal
    })

df = pd.DataFrame(samples)
print(f"Generated periodized dataset with {len(df)} samples.")

# Preprocessing & Model Training
X = df[["species", "goal", "age", "weight", "day_num", "day_type", "injury"]]
preprocessor = ColumnTransformer(
    transformers=[
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), ["species", "goal", "day_type", "injury"]),
        ("num", StandardScaler(), ["age", "weight", "day_num"])
    ]
)

X_trans = preprocessor.fit_transform(X)

clf_primary = RandomForestClassifier(n_estimators=120, random_state=42).fit(X_trans, df["primary_drill"])
clf_secondary = RandomForestClassifier(n_estimators=120, random_state=42).fit(X_trans, df["secondary_drill"])
reg_sets = GradientBoostingRegressor(random_state=42).fit(X_trans, df["sets"])
reg_reps = GradientBoostingRegressor(random_state=42).fit(X_trans, df["reps"])
reg_rest = GradientBoostingRegressor(random_state=42).fit(X_trans, df["rest_sec"])
reg_kcal = GradientBoostingRegressor(random_state=42).fit(X_trans, df["kcal_hr"])

# Save Artifacts
os.makedirs("backend/models", exist_ok=True)
model_path = "backend/models/regimen_ml_model.pkl"

joblib.dump({
    "preprocessor": preprocessor,
    "clf_primary": clf_primary,
    "clf_secondary": clf_secondary,
    "reg_sets": reg_sets,
    "reg_reps": reg_reps,
    "reg_rest": reg_rest,
    "reg_kcal": reg_kcal,
    "exercise_library": PROFESSIONAL_EXERCISE_LIBRARY
}, model_path)

print(f"[SUCCESS] Multi-Day Periodized ML Trainer Model saved to: {model_path}")
print("==========================================================")
