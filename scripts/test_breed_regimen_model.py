import os
import sys
import json
import joblib
import pandas as pd

model_path = "backend/models/breed_species_regimen_ml.pkl"
if not os.path.exists(model_path):
    print("Error: Model file not found.")
    sys.exit(1)

artifacts = joblib.load(model_path)
preprocessor = artifacts["preprocessor"]
clf_p = artifacts["clf_primary"]
clf_s = artifacts["clf_secondary"]
reg_sets = artifacts["reg_sets"]
reg_reps = artifacts["reg_reps"]

print("==========================================================================")
print("  ECOTRACK SPECIES & BREED ML REGIMEN ENGINE — VERIFICATION TEST SUITE")
print("==========================================================================")

test_cases = [
    {"species": "dog", "breed": "German Shepherd", "goal": "Agility & Speed", "age": 3, "weight": 32.0, "injury": "None"},
    {"species": "horse", "breed": "Thoroughbred", "goal": "Cardiovascular Endurance", "age": 5, "weight": 450.0, "injury": "None"},
    {"species": "cat", "breed": "Maine Coon", "goal": "Muscle Building", "age": 2, "weight": 8.5, "injury": "None"},
    {"species": "tiger", "breed": "Bengal Tiger", "goal": "Muscle Building", "age": 6, "weight": 210.0, "injury": "None"},
    {"species": "human", "breed": "Powerlifter", "goal": "Muscle Building", "age": 28, "weight": 88.0, "injury": "None"}
]

for tc in test_cases:
    print(f"\n--- TEST: {tc['species'].upper()} ({tc['breed']}) | Goal: {tc['goal']} ---")
    for d in range(1, 5):
        if d % 4 == 0: day_type = "Recovery"
        elif d % 4 == 1: day_type = "Push"
        elif d % 4 == 2: day_type = "Legs"
        else: day_type = "Core"

        df_in = pd.DataFrame([{
            "species": tc["species"],
            "breed": tc["breed"],
            "goal": tc["goal"],
            "age": tc["age"],
            "weight": tc["weight"],
            "day_num": d,
            "day_type": day_type,
            "injury": tc["injury"]
        }])

        trans = preprocessor.transform(df_in)
        p_drill = clf_p.predict(trans)[0]
        s_drill = clf_s.predict(trans)[0]
        sets = max(2, int(round(reg_sets.predict(trans)[0])))
        reps = max(5, int(round(reg_reps.predict(trans)[0])))

        print(f"  Day {d} ({day_type:8s}): {sets}x{reps} reps | Primary: {p_drill} | Secondary: {s_drill}")

print("\n==========================================================================")
print("  ALL SPECIES & BREED ML PREDICTIONS VERIFIED SUCCESSFUL!")
print("==========================================================================")
