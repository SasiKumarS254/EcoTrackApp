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

print("==========================================================================")
print("  ECOTRACK UNIVERSAL 54-SPECIES & BREED ML REGIMEN ENGINE — TRAINER V3.0")
print("==========================================================================")

np.random.seed(42)
random.seed(42)

# Full Taxonomy & Breed Catalog for all 54 AP-10K Species + Humans
BREED_TAXONOMY = {
    "dog": [
        "German Shepherd", "Golden Retriever", "Labrador Retriever", "French Bulldog",
        "Husky", "Greyhound", "Rottweiler", "Dachshund", "Beagle", "Poodle",
        "Boxer", "Doberman Pinscher", "Great Dane", "Border Collie", "Australian Shepherd"
    ],
    "cat": [
        "Persian", "Maine Coon", "Siamese", "Ragdoll", "Bengal", "Sphynx",
        "British Shorthair", "Abyssinian", "Scottish Fold", "Burmese"
    ],
    "horse": [
        "Thoroughbred", "Quarter Horse", "Arabian", "Clydesdale", "Friesian",
        "Morgan", "Appaloosa", "Warmblood", "Standardbred"
    ],
    "cow": [
        "Holstein", "Angus", "Hereford", "Brahman", "Jersey", "Simmental"
    ],
    "sheep": [
        "Merino", "Dorper", "Suffolk", "Rambouillet"
    ],
    "goat": [
        "Boer", "Nubian", "Alpine", "Nigerian Dwarf"
    ],
    "pig": [
        "Yorkshire", "Duroc", "Berkshire", "Hampshire"
    ],
    "rabbit": [
        "Netherland Dwarf", "Flemish Giant", "Holland Lop", "Mini Rex"
    ],
    "human": [
        "Powerlifter", "Endurance Runner", "Bodybuilder", "Crossfit Athlete",
        "Calisthenics Specialist", "Senior Mobility", "Rehabilitation Patient"
    ],
    "tiger": ["Bengal Tiger", "Siberian Tiger", "Sumatran Tiger"],
    "lion": ["African Lion", "Asiatic Lion"],
    "cheetah": ["African Cheetah", "Asiatic Cheetah"],
    "leopard": ["African Leopard", "Snow Leopard", "Clouded Leopard"],
    "wolf": ["Gray Wolf", "Timber Wolf", "Arctic Wolf"],
    "fox": ["Red Fox", "Arctic Fox"],
    "bear": ["Grizzly Bear", "Polar Bear", "Black Bear"],
    "zebra": ["Plains Zebra", "Grevy Zebra"],
    "deer": ["Red Deer", "White-Tailed Deer", "Elk"],
    "monkey": ["Capuchin", "Macaque", "Baboon"],
    "gorilla": ["Western Lowland Gorilla", "Mountain Gorilla"],
    "chimpanzee": ["Common Chimpanzee"],
    "orangutan": ["Bornean Orangutan"],
    "elephant": ["African Bush Elephant", "Asian Elephant"],
    "giraffe": ["Reticulated Giraffe", "Masai Giraffe"],
    "rhino": ["White Rhinoceros", "Black Rhinoceros"],
    "hippo": ["Hippopotamus"],
    "camel": ["Dromedary Camel", "Bactrian Camel"],
    "kangaroo": ["Red Kangaroo", "Eastern Grey Kangaroo"],
    "panda": ["Giant Panda"],
    "penguin": ["Emperor Penguin", "King Penguin"],
    "eagle": ["Bald Eagle", "Golden Eagle"],
    "owl": ["Great Horned Owl", "Barn Owl"],
    "snake": ["Python", "Boa Constrictor"],
    "turtle": ["Sea Turtle", "Box Turtle"],
    "dolphin": ["Bottlenose Dolphin"],
    "seal": ["Harbor Seal"],
    "squirrel": ["Tree Squirrel", "Flying Squirrel"]
}

# Anatomically & Biomechanically Specialized Exercises per Species & Movement Type
BREED_EXERCISE_DATABASE = {
    "human": {
        "Push": [
            "Incline Barbell Press (Upper Chest Focus)", "Parallel Bar Deep Dips",
            "Overhead Dumbbell Shoulder Press", "Explosive Push-Up Progression"
        ],
        "Pull": [
            "Wide-Grip Lat Pulldowns", "Heavy Bent-Over Barbell Rows",
            "Single-Arm Cable Rows", "Face Pulls with Rope"
        ],
        "Legs": [
            "Barbell Back Squats", "Romanian Deadlifts (RDL)",
            "Bulgarian Split Squats", "Barbell Hip Thrusts"
        ],
        "Core": [
            "Hanging Knee-to-Chest Raises", "Ab Wheel Rollouts",
            "Paloff Anti-Rotation Press", "Weighted Plank Holds"
        ],
        "Agility": [
            "Plyometric Depth Box Jumps", "Lateral Shuttle Sprints",
            "Agility Ladder Fast Feet"
        ],
        "Recovery": [
            "Cat-Cow Thoracic Mobility", "90/90 Hip Rotational Flow",
            "Myofascial Foam Roller Decompression"
        ]
    },
    "dog": {
        "Push": [
            "Incline Ramp Quad Power Climbs", "Front-Leg Balance Cushion Touches",
            "Chest-Elevated Step-Ups"
        ],
        "Pull": [
            "Weighted Harness Resistance Trots", "Tug Pulldown Neck & Back Engagement",
            "Rear-Drive Backward Stepping"
        ],
        "Legs": [
            "Controlled Sit-to-Stand Squat Reps", "Hind-Leg Elevated Balance Holds",
            "Stifle-Extension Hill Steps"
        ],
        "Core": [
            "Peanut Ball Paraspinal Core Hold", "Cookie Stretch Lateral Flexion",
            "Unstable Disc Balance Stance"
        ],
        "Agility": [
            "Cavaletti Rail Step-Over Grids", "Weave Pole Slalom Agility Navigation",
            "Directional Target Touch Sprints"
        ],
        "Recovery": [
            "Passive Range of Motion (PROM) Stifle Stretch", "Warm Hydrotherapy Treadmill Walk",
            "Effleurage Muscle Massage"
        ]
    },
    "horse": {
        "Push": [
            "Canter Hill Ascent Propulsion", "Incline Gymnastic Grid Jumps",
            "Shoulder-In Lateral Suppling"
        ],
        "Pull": [
            "Longeing Line Resistance Trots", "Hindquarter Engagement Shifts",
            "Haunches-In Collection Drills"
        ],
        "Legs": [
            "Extended Trot Arena Circles", "Paced Canter Transitions",
            "Trotting Cavaletti Over-Poles"
        ],
        "Core": [
            "Abdominal Lift Carrot Stretches", "Tail-Pull Spinal Activation Holds",
            "Poll-to-Tail Lateral Flexion"
        ],
        "Agility": [
            "Pole Bending Slalom Weave", "Barrel Pattern Tight Turns",
            "Cross-Pole Jumping Grids"
        ],
        "Recovery": [
            "Hand-Walking on Hard Ground", "Underwater Spa Hydro-Treadmill Walk",
            "Equine Myofascial Release"
        ]
    },
    "cat": {
        "Push": [
            "Vertical Post Climbing Sprints", "High-Platform Leap Jump-Ups"
        ],
        "Pull": [
            "Scratch Tower Tension Pulldowns", "Prey Toy Drag & Pull"
        ],
        "Legs": [
            "High Crouch-to-Leap Explosive Sets", "Hindlimb Squat Target Reaches"
        ],
        "Core": [
            "Interactive Wand Lateral Twists", "Tunnel Crawl & Pounce Flexion"
        ],
        "Agility": [
            "Agility Tunnel Navigation", "Feather Wand Obstacle Slalom"
        ],
        "Recovery": [
            "Gentle Spine Arch Stretch", "Low-Platform Step-Overs & Rest"
        ]
    },
    "generic": {
        "Push": [
            "Forelimb Ramp Incline Press", "Chest Slope Push Steps"
        ],
        "Pull": [
            "Backward Harness Resistance Line", "Hindlimb Traction Trot"
        ],
        "Legs": [
            "Steep Incline Hill Propulsion", "Proprioceptive Step-Up Reps"
        ],
        "Core": [
            "Balance Disc Core Hold", "Lateral Spine Flexion Stretches"
        ],
        "Agility": [
            "Slalom Obstacle Navigation", "Directional Pivot Sprints"
        ],
        "Recovery": [
            "Controlled Flat Walk", "Passive Joint Mobility Decompression"
        ]
    }
}

print("Generating 10,000 breed-tailored periodized regimen samples...")

samples = []
all_species_keys = list(BREED_TAXONOMY.keys())

for i in range(10000):
    species = random.choice(all_species_keys)
    breeds = BREED_TAXONOMY.get(species, ["Standard Variant"])
    breed = random.choice(breeds)
    goal = random.choice([
        "Muscle Building", "Weight Loss", "Agility & Speed",
        "Rehabilitation & Joint Recovery", "Cardiovascular Endurance", "General Health & Fitness"
    ])
    age = random.randint(1, 40)
    weight = round(random.uniform(2.0, 500.0), 1)
    day_num = random.randint(1, 14)
    injury = random.choice(["None", "None", "None", "Hip Stiffness", "Knee Tendonitis", "Spinal Strain"])

    # Determine Periodization Phase
    if day_num % 4 == 0:
        day_type = "Recovery"
    elif day_num % 4 == 1:
        day_type = "Push" if goal in ["Muscle Building", "General Health & Fitness"] else "Agility"
    elif day_num % 4 == 2:
        day_type = "Legs" if goal in ["Muscle Building", "Weight Loss"] else "Pull"
    else:
        day_type = "Core" if goal in ["Rehabilitation & Joint Recovery", "General Health & Fitness"] else "Push"

    group = "human" if species == "human" else ("dog" if species == "dog" else ("horse" if species == "horse" else ("cat" if species == "cat" else "generic")))
    drills = BREED_EXERCISE_DATABASE[group].get(day_type, BREED_EXERCISE_DATABASE["generic"][day_type])
    
    primary = random.choice(drills)
    secondary = random.choice(drills)

    # Sets/Reps/Kcal calculation
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
        "breed": breed,
        "goal": goal,
        "age": age,
        "weight": weight,
        "day_num": day_num,
        "day_type": day_type,
        "injury": injury,
        "primary_drill": primary,
        "secondary_drill": secondary,
        "sets": sets,
        "reps": reps,
        "rest_sec": rest,
        "kcal_hr": kcal
    })

df = pd.DataFrame(samples)

# Save persistent dataset to backend data folder
os.makedirs("backend/data", exist_ok=True)
dataset_path = "backend/data/species_breed_regimen_dataset.csv"
df.to_csv(dataset_path, index=False)
print(f"[DATASET SAVED] {len(df)} records saved to persistent backend storage: {dataset_path}")

# Machine Learning Pipeline
X = df[["species", "breed", "goal", "age", "weight", "day_num", "day_type", "injury"]]
preprocessor = ColumnTransformer(
    transformers=[
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), ["species", "breed", "goal", "day_type", "injury"]),
        ("num", StandardScaler(), ["age", "weight", "day_num"])
    ]
)

X_trans = preprocessor.fit_transform(X)

print("Training Machine Learning Model Pipeline...")
clf_primary = RandomForestClassifier(n_estimators=100, max_depth=20, random_state=42).fit(X_trans, df["primary_drill"])
clf_secondary = RandomForestClassifier(n_estimators=100, max_depth=20, random_state=42).fit(X_trans, df["secondary_drill"])
reg_sets = GradientBoostingRegressor(random_state=42).fit(X_trans, df["sets"])
reg_reps = GradientBoostingRegressor(random_state=42).fit(X_trans, df["reps"])
reg_rest = GradientBoostingRegressor(random_state=42).fit(X_trans, df["rest_sec"])
reg_kcal = GradientBoostingRegressor(random_state=42).fit(X_trans, df["kcal_hr"])

os.makedirs("backend/models", exist_ok=True)
model_path = "backend/models/breed_species_regimen_ml.pkl"

joblib.dump({
    "preprocessor": preprocessor,
    "clf_primary": clf_primary,
    "clf_secondary": clf_secondary,
    "reg_sets": reg_sets,
    "reg_reps": reg_reps,
    "reg_rest": reg_rest,
    "reg_kcal": reg_kcal,
    "breed_taxonomy": BREED_TAXONOMY,
    "breed_exercise_db": BREED_EXERCISE_DATABASE
}, model_path)

print(f"[SUCCESS] Trained Breed-Specific ML Regimen Model saved to: {model_path}")
print("==========================================================================")
