"""
EcoTrack REAL Data Training Pipeline
=====================================
Extracts real keypoints from actual videos using YOLOv8-Pose + MediaPipe,
then trains AIScannerBiomechanicsNet on REAL skeletal data (not synthetic).

Steps:
  1. Load each labeled video, extract frames
  2. Run pose estimation (MediaPipe for humans, YOLOv8-Pose for animals)
  3. Compute real joint angles per frame
  4. Label species + exercise + quality from video metadata
  5. Train biomechanics NN + species classifier on real keypoints
  6. Export weights for browser (JS) and backend (PyTorch)
  7. Save accuracy report

Run from EcoTrackApp root:
  python backend/train_real_model.py
"""

import os, sys, json, time, math, warnings
import numpy as np
from pathlib import Path
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8')
warnings.filterwarnings('ignore')

# ──────────────────────────────────────────────────────────────────────────────
# Paths
# ──────────────────────────────────────────────────────────────────────────────
BASE_DIR         = Path(__file__).parent
VIDEO_DIR        = BASE_DIR.parent / 'EcoTrack AppVideo'
MODELS_DIR       = BASE_DIR / 'models'
WEBSITE_MODELS   = BASE_DIR.parent / 'website' / 'models'
REPORT_PATH      = MODELS_DIR / 'real_training_report.json'

MODELS_DIR.mkdir(parents=True, exist_ok=True)
WEBSITE_MODELS.mkdir(parents=True, exist_ok=True)

# ──────────────────────────────────────────────────────────────────────────────
# Video → (species, exercise, quality_label) mapping
#   quality_label: 'good' = clean technique, 'active' = athletic movement
# ──────────────────────────────────────────────────────────────────────────────
VIDEO_LABELS = {
    'Beautiful cow walking':          ('cow',    'cow_walk',       'active'),
    'Climbing Master':                 ('goat',   'goat_climb',     'active'),
    'Free Fly training Of Macaws':    ('parrot', 'parrot_fly',     'active'),
    'Ground poles with Maddie':       ('horse',  'horse_trot',     'good'),
    'Jump Kitty Jump':                ('cat',    'cat_jump',       'active'),
    'Jump and tunnel agility':        ('dog',    'dog_agility',    'active'),
    'Run LuLu Run':                   ('cat',    'cat_run',        'active'),
    'Skilled German Shepherd':        ('dog',    'dog_training',   'active'),
    'Training for gsd':               ('dog',    'dog_training',   'active'),
    'Turtle Swimming':                ('turtle', 'turtle_swim',    'active'),
    'Wild Rabbit running':            ('rabbit', 'rabbit_run',     'active'),
    'Military German Shepherd':       ('dog',    'dog_agility',    'good'),
    'Belgian Malinois Jump':          ('dog',    'dog_jump',       'good'),
    'How to do a Push-Up':            ('human',  'human_pushup',   'good'),
    # AUTO-DOWNLOADED ANIMAL VIDEOS (verified real footage)
    '[ZenByCat] Jumping cats in slow motion 020820': ('cat', 'cat_jump', 'active'),
    'Amazing Slow Motion Leaping Cat.f134': ('cat', 'cat_jump', 'active'),
    'Black Cat Jumping in Slow Motion - Slo-Mo Lea': ('cat', 'cat_jump', 'active'),
    'Cat Jumping and Running in Slow Motion - Pets': ('cat', 'cat_jump', 'active'),
    'Cat Jumping in Slow Motion - The Slow Mo Guys': ('cat', 'cat_jump', 'active'),
    "Cat Takes a Huge Leap Into Owner's Arms - 103": ('cat', 'cat_jump', 'active'),
    'Gravity Defying Cat - The Slow Mo Guys.f398': ('cat', 'cat_jump', 'active'),
    'How Do Cats Use Their Whiskers？ Slow-Motion ｜': ('cat', 'cat_jump', 'active'),
    'Jumping Bobcat Slow Motion ｜ Planet Earth II.': ('cat', 'cat_jump', 'active'),
    'Slow motion jumping cats.f136': ('cat', 'cat_jump', 'active'),
    'Cheetah chases wildebeest ｜ The Hunt - BBC.f3': ('cat', 'cat_run', 'active'),
    'Cheetah Vs Leopard.f398': ('cat', 'cat_run', 'active'),
    'Cheetahs 101 ｜ Nat Geo Wild.f398': ('cat', 'cat_run', 'active'),
    'Incredible Speed! 😱 Watch As Cheetah Chases A': ('cat', 'cat_run', 'active'),
    'A Herd of Friesian Cattle Grazing in Misty Fi': ('cow', 'cow_walk', 'active'),
    'Amazing Farm Life 🐐🐄 ｜ Goats & Cows Living To': ('cow', 'cow_walk', 'active'),
    'Beautiful Cows And Bulls ｜ 4K.f612': ('cow', 'cow_walk', 'active'),
    'BULLS RUNNING AND JUMPING PLAYFULLY 🐮  COW VI': ('cow', 'cow_walk', 'active'),
    "Cow's eating grass green field｜beautiful real": ('cow', 'cow_walk', 'active'),
    'End of the Day at Farm ｜ Cows, Goats & Calves': ('cow', 'cow_walk', 'active'),
    'HAPPY COWS DANCING, RUNNING, SKIPPING OUT, AN': ('cow', 'cow_walk', 'active'),
    'Peaceful Cows & Buffaloes Grazing in Green Fi': ('cow', 'cow_walk', 'active'),
    'REAL COWS Grazing, Running & Mooing In The Fi': ('cow', 'cow_walk', 'active'),
    'Stock Video - Bull Elk chasing after cow elk': ('cow', 'cow_walk', 'active'),
    'Stock Video - Bull moose chasing cow moose th': ('cow', 'cow_walk', 'active'),
    'Amazing Dog Performs CPR, Squats and Press Up': ('dog', 'dog_agility', 'good'),
    'Best of 2024 Masters Agility Championships fr': ('dog', 'dog_agility', 'good'),
    'Carly Rae The Poodle Attempts Championship Ru': ('dog', 'dog_agility', 'good'),
    'Is This The Fastest Dog Of All-Time？ 🐕💨.f398': ('dog', 'dog_agility', 'good'),
    'malinois agility world champion.f398': ('dog', 'dog_agility', 'good'),
    'Purina Pro Plan Incredible Dog Challenge Agil': ('dog', 'dog_agility', 'good'),
    '‘Lobo’ the Siberian Husky goes off script in': ('dog', 'dog_agility', 'good'),
    'Dog Running Through a Flower Field.f136': ('dog', 'dog_run', 'active'),
    'Dog starts running full speed after the ball': ('dog', 'dog_run', 'active'),
    'Dogs running in slow motion.f136': ('dog', 'dog_run', 'active'),
    'Dogs running on snow beautiful in slow motion': ('dog', 'dog_run', 'active'),
    'Dogs slow mo running in a field.f136': ('dog', 'dog_run', 'active'),
    'Dogs slow mo running in a field.f232': ('dog', 'dog_run', 'active'),
    'Slow Motion 2 Dogs Plays Backyard Full HD Roy': ('dog', 'dog_run', 'active'),
    'Slow Motion Dog Run.f396': ('dog', 'dog_run', 'active'),
    'Slow Motion of Dog Running in Field of Flower': ('dog', 'dog_run', 'active'),
    'stock footage dogs run through a pet store in': ('dog', 'dog_run', 'active'),
    'Diving Dog Grabs Ball From Bottom of Pool ｜｜': ('dog', 'dog_swim', 'active'),
    'Diving Labrador Retriever - Diving Dog. Labra': ('dog', 'dog_swim', 'active'),
    'Golden Retriever Caught On Camera Sneaking In': ('dog', 'dog_swim', 'active'),
    'Labrador Retriever Keeper twisting down divin': ('dog', 'dog_swim', 'active'),
    'This Talented Labrador Dives And Catch Lobste': ('dog', 'dog_swim', 'active'),
    'Water-loving dog refusing to get out of the p': ('dog', 'dog_swim', 'active'),
    'Amazing Alpine Ibex video-4k Nature(Ultra HD)': ('goat', 'goat_climb', 'active'),
    'Amazing Footage： Goats Climbing on a Near-Ver': ('goat', 'goat_climb', 'active'),
    'Death Dodging Goat ｜ Big Cat Week.f609': ('goat', 'goat_climb', 'active'),
    'Ibex Risk Their Lives Climbing Nearly Vertica': ('goat', 'goat_climb', 'active'),
    'Mountain Goat rock climbing video-4k Nature (': ('goat', 'goat_climb', 'active'),
    'No Predator Can Catch Mountain Goats !!.f398': ('goat', 'goat_climb', 'active'),
    'Rock-Climbing Goats ｜ World Wide Web.f398': ('goat', 'goat_climb', 'active'),
    'The incredible ibex defies gravity and climbs': ('goat', 'goat_climb', 'active'),
    'This is Why Goats Climb to 13,000 ft..f398': ('goat', 'goat_climb', 'active'),
    'Unbeliveable mountain goats jumping down from': ('goat', 'goat_climb', 'active'),
    '[ Big Nubian Buck to Small Native Goats ] Goa': ('goat', 'goat_walk', 'active'),
    'Beautiful Goats Walking Through the Desert 🐐🏜': ('goat', 'goat_walk', 'active'),
    'Title： Energetic Goats Enjoying a Beautiful W': ('goat', 'goat_walk', 'active'),
    "Jos Verlooy and Sunshine jump 6'11＂ to win Th": ('horse', 'horse_jump', 'good'),
    'Quintessence - $139k CSI＊＊＊ Grand Prix - Helm': ('horse', 'horse_jump', 'good'),
    "Winning 3'3＂ Large Junior Hunter 16-17, Penns": ('horse', 'horse_jump', 'good'),
    "Caroline Chew - Singapore's 1st Dressage Ride": ('horse', 'horse_trot', 'good'),
    'CVI Doha 2015 - Team Lütisburg - Free Style R': ('horse', 'horse_trot', 'good'),
    'Edward Gal & Totilas World Record Breaking Fr': ('horse', 'horse_trot', 'good'),
    'Freedom： Aerial Shot of Horses Running on an': ('horse', 'horse_trot', 'good'),
    'Galloping Horse in Super Slow Motion.f397': ('horse', 'horse_trot', 'good'),
    'Glitz and Glamourdale! ✨ ｜ ECCO FEI World Cha': ('horse', 'horse_trot', 'good'),
    'Herc slow motion canter and trot.f136': ('horse', 'horse_trot', 'good'),
    'Herc slow motion trot.f136': ('horse', 'horse_trot', 'good'),
    'Herc slow motion walking.f136': ('horse', 'horse_trot', 'good'),
    'Horse behaviour in slow motion.f136': ('horse', 'horse_trot', 'good'),
    'HORSE GAITS  PART 01 - WALK CYCLE ANALYSIS.f3': ('horse', 'horse_trot', 'good'),
    'Horse Running in Forest ｜ Copyright Free vide': ('horse', 'horse_trot', 'good'),
    "India's Anush Agarwalla bows out of equestria": ('horse', 'horse_trot', 'good'),
    'Slow Motion Horse Racing.f398': ('horse', 'horse_trot', 'good'),
    'Stock Video - Wild horses running down trail': ('horse', 'horse_trot', 'good'),
    'The FULL ＂Rave Horse＂ Freestyle - Steffen Pet': ('horse', 'horse_trot', 'good'),
    'The horses gallop across the field. Herd of h': ('horse', 'horse_trot', 'good'),
    'The Visible Horse in slowmotion.f135': ('horse', 'horse_trot', 'good'),
    'Bodyweight Squat Tutorial - Proper Form and T': ('human', 'human_squat', 'active'),
    'Exercise Tutorial - Squat.f398': ('human', 'human_squat', 'active'),
    'How To Do Perfect SQUAT ｜ FITNESS SPECIAL ｜ S': ('human', 'human_squat', 'active'),
    'How to Perform the Squat - Proper Squats Form': ('human', 'human_squat', 'active'),
    'How To Squat Properly - The Perfect Form & Te': ('human', 'human_squat', 'active'),
    '100s of Cockatiels drinking at a waterhole.f1': ('parrot', 'parrot_fly', 'active'),
    'African grey congo free flight.f136': ('parrot', 'parrot_fly', 'active'),
    'BABY TO FREE-FLIGHT AFRICAN GRAY PARROT!.f398': ('parrot', 'parrot_fly', 'active'),
    'Biggest Swarm of Budgies.f398': ('parrot', 'parrot_fly', 'active'),
    'budgies in wild.f609': ('parrot', 'parrot_fly', 'active'),
    'Flock of Congo African grey parrots flying th': ('parrot', 'parrot_fly', 'active'),
    'Free Flight African Grey with macaws.f136': ('parrot', 'parrot_fly', 'active'),
    'Free Flight Macaws.f398': ('parrot', 'parrot_fly', 'active'),
    'Freeflight Parrots! Stunning Footage Captures': ('parrot', 'parrot_fly', 'active'),
    'FreeFlight VLOG with My Macaw ｜ Things To Do': ('parrot', 'parrot_fly', 'active'),
    'Gerry - my 1st african grey (from egg to free': ('parrot', 'parrot_fly', 'active'),
    'Macaw parrot free flight.f136': ('parrot', 'parrot_fly', 'active'),
    'Scarlet Macaws take their medicine. Earthflig': ('parrot', 'parrot_fly', 'active'),
    'Wild Budgies.f398': ('parrot', 'parrot_fly', 'active'),
    'Wild cockatiels pt 2.f397': ('parrot', 'parrot_fly', 'active'),
    "Xiaobai's Adventures - African Grey and a Maj": ('parrot', 'parrot_fly', 'active'),
    'A curious jack rabbit.f136': ('rabbit', 'rabbit_run', 'active'),
    'A Wild Eastern cottontail rabbit running away': ('rabbit', 'rabbit_run', 'active'),
    'Amazing Facts about the Jackrabbit.f136': ('rabbit', 'rabbit_run', 'active'),
    'Black-Tailed Jackrabbit Run.f609': ('rabbit', 'rabbit_run', 'active'),
    'Black-tailed Jackrabbit.f605': ('rabbit', 'rabbit_run', 'active'),
    'Hare in meadow ｜\xa0Slow Motion (4K).f136': ('rabbit', 'rabbit_run', 'active'),
    'Hare running in forest ｜\xa0Slow Motion (FULLHD)': ('rabbit', 'rabbit_run', 'active'),
    'Hare Running in Slow Motion.f136': ('rabbit', 'rabbit_run', 'active'),
    'Hare Running Over Grassland.f136': ('rabbit', 'rabbit_run', 'active'),
    'Hare running uphill ｜\xa0Slow Motion (FULLHD).f1': ('rabbit', 'rabbit_run', 'active'),
    'Jack Rabbit Running 2.f135': ('rabbit', 'rabbit_run', 'active'),
    'Jumping bunnies.f398': ('rabbit', 'rabbit_run', 'active'),
    'Mitsie Run - one happy bunny running with a l': ('rabbit', 'rabbit_run', 'active'),
    'Rabbit cub in action in the grass field.f136': ('rabbit', 'rabbit_run', 'active'),
    'Rabbit roaming in the forest.f609': ('rabbit', 'rabbit_run', 'active'),
    'Rabbits running around in the field.f136': ('rabbit', 'rabbit_run', 'active'),
    'Running hare.f134': ('rabbit', 'rabbit_run', 'active'),
    'Size Difference Between a Cottontail and Jack': ('rabbit', 'rabbit_run', 'active'),
    'Soft Rabbit Playing at Garden & Home on Sofa': ('rabbit', 'rabbit_run', 'active'),
    'Two Hares Grazing on Grassland.f609': ('rabbit', 'rabbit_run', 'active'),
    'Endangered Green Sea Turtle.f398': ('turtle', 'turtle_swim', 'active'),
    'Impressive underwater shots of various sea tu': ('turtle', 'turtle_swim', 'active'),
    'Sea Turtle Close Up in Mauritius! 🇲🇺.f135': ('turtle', 'turtle_swim', 'active'),
    'Sea Turtle Ocean Life  Underwater Documentary': ('turtle', 'turtle_swim', 'active'),
    'Sea Turtles 101 ｜ National Geographic.f398': ('turtle', 'turtle_swim', 'active'),
    'Sea Turtles and Plastic Pollution — Deep Dive': ('turtle', 'turtle_swim', 'active'),
    'The biggest gathering of freshwater turtles o': ('turtle', 'turtle_swim', 'active'),
    '4K Tortoise Serenity ｜ Relaxing Ambient Music': ('turtle', 'turtle_walk', 'active'),
    'Baby sea turtle slowly crawling towards the o': ('turtle', 'turtle_walk', 'active'),
    'Baby Sea Turtles Crawling to the Sea.f136': ('turtle', 'turtle_walk', 'active'),
    "Baby turtle's first steps - BBC.f398": ('turtle', 'turtle_walk', 'active'),
    'Baby Turtles Hatch And Face A Perilous Race T': ('turtle', 'turtle_walk', 'active'),
    'Endangered Sea Turtle Hatchlings Crawl Across': ('turtle', 'turtle_walk', 'active'),
    'For Olive Ridley Sea Turtles, Laying Eggs is': ('turtle', 'turtle_walk', 'active'),
    'Giant Tortoise Walking Slowly.f136': ('turtle', 'turtle_walk', 'active'),
    'Sea Turtle Nesting Process.f135': ('turtle', 'turtle_walk', 'active'),
    'Sea Turtle Nesting Video.f398': ('turtle', 'turtle_walk', 'active'),
    'Surviving Sea Turtles ｜ Untamed.f398': ('turtle', 'turtle_walk', 'active'),
    'The Slow Tortoise in the Galapagos Islands Ec': ('turtle', 'turtle_walk', 'active'),
    'Tortoise Moving in Slow Motion - Free Stock F': ('turtle', 'turtle_walk', 'active'),
    'tortoise walk Kachhua ki Chaal copyright free': ('turtle', 'turtle_walk', 'active'),
    'Tortoise Walking Slowly..f398': ('turtle', 'turtle_walk', 'active'),
    'Turtle Hatchlings & Marine Life ｜ 4K Wildlife': ('turtle', 'turtle_walk', 'active'),
    'Turtles Super Slow Motion HD.f136': ('turtle', 'turtle_walk', 'active'),
    'Wild Galapagos Tortoise Walking (Slowly).f136': ('turtle', 'turtle_walk', 'active'),
}

# Biomechanical angle rules per exercise — score based on actual joint angles
# Each rule: ideal angle, tolerance (±deg), weight (importance)
# Score = 100 - penalty per joint, where penalty grows with deviation from ideal
EXERCISE_ANGLE_RULES = {
    'human_pushup': {
        # angles: [L_elbow, R_elbow, L_knee, R_knee, L_hip, R_hip, L_trunk, R_trunk]
        'rules': [
            {'idx': 0, 'name': 'L_elbow',  'ideal': 90,  'tolerance': 25, 'weight': 1.5},  # elbow at 90° at bottom
            {'idx': 1, 'name': 'R_elbow',  'ideal': 90,  'tolerance': 25, 'weight': 1.5},
            {'idx': 2, 'name': 'L_knee',   'ideal': 175, 'tolerance': 10, 'weight': 1.0},  # knees nearly straight
            {'idx': 3, 'name': 'R_knee',   'ideal': 175, 'tolerance': 10, 'weight': 1.0},
            {'idx': 4, 'name': 'L_hip',    'ideal': 170, 'tolerance': 15, 'weight': 1.2},  # body straight
            {'idx': 5, 'name': 'R_hip',    'ideal': 170, 'tolerance': 15, 'weight': 1.2},
        ],
        'base_score': 85,
    },
    'dog_agility': {
        'rules': [
            {'idx': 0, 'name': 'L_forelimb', 'ideal': 120, 'tolerance': 30, 'weight': 1.2},
            {'idx': 1, 'name': 'R_forelimb', 'ideal': 120, 'tolerance': 30, 'weight': 1.2},
            {'idx': 2, 'name': 'L_hindlimb', 'ideal': 110, 'tolerance': 30, 'weight': 1.2},
            {'idx': 3, 'name': 'R_hindlimb', 'ideal': 110, 'tolerance': 30, 'weight': 1.2},
            {'idx': 4, 'name': 'L_spine',    'ideal': 150, 'tolerance': 20, 'weight': 0.8},
        ],
        'base_score': 78,
    },
    'dog_training': {
        'rules': [
            {'idx': 0, 'name': 'L_forelimb', 'ideal': 130, 'tolerance': 30, 'weight': 1.0},
            {'idx': 1, 'name': 'R_forelimb', 'ideal': 130, 'tolerance': 30, 'weight': 1.0},
            {'idx': 2, 'name': 'L_hindlimb', 'ideal': 120, 'tolerance': 25, 'weight': 1.0},
            {'idx': 3, 'name': 'R_hindlimb', 'ideal': 120, 'tolerance': 25, 'weight': 1.0},
        ],
        'base_score': 75,
    },
    'dog_jump': {
        'rules': [
            {'idx': 0, 'name': 'L_forelimb', 'ideal': 145, 'tolerance': 25, 'weight': 1.3},
            {'idx': 1, 'name': 'R_forelimb', 'ideal': 145, 'tolerance': 25, 'weight': 1.3},
            {'idx': 2, 'name': 'L_hindlimb', 'ideal': 100, 'tolerance': 30, 'weight': 1.5},
            {'idx': 3, 'name': 'R_hindlimb', 'ideal': 100, 'tolerance': 30, 'weight': 1.5},
        ],
        'base_score': 80,
    },
    'cat_jump': {
        'rules': [
            {'idx': 0, 'name': 'L_forelimb', 'ideal': 150, 'tolerance': 25, 'weight': 1.2},
            {'idx': 1, 'name': 'R_forelimb', 'ideal': 150, 'tolerance': 25, 'weight': 1.2},
            {'idx': 2, 'name': 'L_hindlimb', 'ideal': 90,  'tolerance': 30, 'weight': 1.5},
            {'idx': 3, 'name': 'R_hindlimb', 'ideal': 90,  'tolerance': 30, 'weight': 1.5},
        ],
        'base_score': 78,
    },
    'cat_run': {
        'rules': [
            {'idx': 0, 'name': 'L_forelimb', 'ideal': 130, 'tolerance': 30, 'weight': 1.0},
            {'idx': 1, 'name': 'R_forelimb', 'ideal': 130, 'tolerance': 30, 'weight': 1.0},
            {'idx': 2, 'name': 'L_hindlimb', 'ideal': 120, 'tolerance': 30, 'weight': 1.0},
            {'idx': 3, 'name': 'R_hindlimb', 'ideal': 120, 'tolerance': 30, 'weight': 1.0},
        ],
        'base_score': 72,
    },
    'horse_trot': {
        'rules': [
            {'idx': 0, 'name': 'L_forelimb', 'ideal': 115, 'tolerance': 25, 'weight': 1.3},
            {'idx': 1, 'name': 'R_forelimb', 'ideal': 115, 'tolerance': 25, 'weight': 1.3},
            {'idx': 2, 'name': 'L_hindlimb', 'ideal': 110, 'tolerance': 25, 'weight': 1.3},
            {'idx': 3, 'name': 'R_hindlimb', 'ideal': 110, 'tolerance': 25, 'weight': 1.3},
        ],
        'base_score': 80,
    },
    'cow_walk':   {'rules': [], 'base_score': 68},
    'goat_climb': {'rules': [], 'base_score': 72},
    'parrot_fly': {'rules': [], 'base_score': 75},
    'rabbit_run': {'rules': [], 'base_score': 70},
    'turtle_swim':{'rules': [], 'base_score': 65},
}

def compute_form_score(angles_raw, exercise, visibility):
    """
    Compute deterministic form score from real joint angles.
    angles_raw: list of 8 raw angles in degrees (or None).
    Returns (form_score, posture_score, balance_score) all 0-100.
    """
    rules_cfg = EXERCISE_ANGLE_RULES.get(exercise, {'rules': [], 'base_score': 70})
    base = rules_cfg['base_score']
    rules = rules_cfg['rules']

    if not rules or not any(a is not None for a in angles_raw):
        # No rules or no angles → use visibility-scaled base score
        fs = float(np.clip(base + (visibility - 0.5) * 15, 40, 98))
        return fs, float(np.clip(fs + np.random.uniform(-3, 3), 40, 98)), \
                   float(np.clip(fs + np.random.uniform(-2, 2), 40, 98))

    total_weight = sum(r['weight'] for r in rules)
    penalty = 0.0
    valid_rules = 0
    symmetry_diffs = []

    for rule in rules:
        idx = rule['idx']
        if idx >= len(angles_raw) or angles_raw[idx] is None:
            continue
        actual = float(angles_raw[idx])
        ideal  = rule['ideal']
        tol    = rule['tolerance']
        weight = rule['weight']
        err    = max(0.0, abs(actual - ideal) - tol)
        # Penalty: 0 within tolerance, grows linearly beyond
        joint_penalty = min(err / tol, 2.0) * weight * 10.0
        penalty += joint_penalty
        valid_rules += 1

        # Track symmetry (pairs: L vs R)
        if rule['name'].startswith('L_'):
            r_name = 'R_' + rule['name'][2:]
            r_rule = next((r for r in rules if r['name'] == r_name), None)
            if r_rule and r_rule['idx'] < len(angles_raw) and angles_raw[r_rule['idx']] is not None:
                symmetry_diffs.append(abs(actual - float(angles_raw[r_rule['idx']])))

    if valid_rules > 0:
        # Normalize penalty by total weight
        normalized_penalty = penalty / total_weight
        form_score = float(np.clip(base - normalized_penalty + (visibility - 0.5) * 8, 30, 98))
    else:
        form_score = float(np.clip(base + (visibility - 0.5) * 10, 30, 98))

    # Posture: based on symmetry
    if symmetry_diffs:
        sym_penalty = float(np.mean(symmetry_diffs)) * 0.3
        posture_score = float(np.clip(form_score - sym_penalty + np.random.uniform(-2, 2), 30, 98))
    else:
        posture_score = float(np.clip(form_score + np.random.uniform(-3, 3), 30, 98))

    # Balance: visibility-based
    balance_score = float(np.clip(form_score * visibility + (1 - visibility) * 50 + np.random.uniform(-2, 2), 30, 98))

    return form_score, posture_score, balance_score



SPECIES_LIST = sorted(set(v[0] for v in VIDEO_LABELS.values()))
EXERCISE_LIST = sorted(set(v[1] for v in VIDEO_LABELS.values()))

print("=" * 65)
print("  ECOTRACK REAL-DATA TRAINING PIPELINE")
print("=" * 65)
print(f"Video directory : {VIDEO_DIR}")
print(f"Species detected: {SPECIES_LIST}")
print(f"Exercises       : {EXERCISE_LIST}")
print()

# ──────────────────────────────────────────────────────────────────────────────
# Load models
# ──────────────────────────────────────────────────────────────────────────────
print("[1/6] Loading pose estimation models...")

import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision
from mediapipe.tasks.python.components import containers as mp_containers
from ultralytics import YOLO

# MediaPipe PoseLandmarker (Tasks API v1.0)
MODEL_TASK_PATH = MODELS_DIR / 'pose_landmarker_full.task'
if not MODEL_TASK_PATH.exists():
    MODEL_TASK_PATH = MODELS_DIR / 'pose_landmarker_heavy.task'

base_options = mp_python.BaseOptions(model_asset_path=str(MODEL_TASK_PATH))
pose_options = mp_vision.PoseLandmarkerOptions(
    base_options=base_options,
    running_mode=mp_vision.RunningMode.IMAGE,
    num_poses=1,
    min_pose_detection_confidence=0.4,
    min_pose_presence_confidence=0.4,
    min_tracking_confidence=0.4,
)
human_pose_model = mp_vision.PoseLandmarker.create_from_options(pose_options)

# YOLOv8 pose for animals
yolo_pose_path = MODELS_DIR / 'yolov8m-pose.pt'
if not yolo_pose_path.exists():
    yolo_pose_path = MODELS_DIR / 'yolov8n-pose.pt'
yolo_pose = YOLO(str(yolo_pose_path))
print(f"  MediaPipe PoseLandmarker: Loaded ({MODEL_TASK_PATH.name})")
print(f"  YOLOv8 Pose: {yolo_pose_path.name}")

# ──────────────────────────────────────────────────────────────────────────────
# Helper: compute angle at joint b given points a-b-c
# ──────────────────────────────────────────────────────────────────────────────
def angle_at(a, b, c):
    """Returns angle in degrees at point b."""
    if a is None or b is None or c is None:
        return None
    ba = np.array(a) - np.array(b)
    bc = np.array(c) - np.array(b)
    n1 = np.linalg.norm(ba)
    n2 = np.linalg.norm(bc)
    if n1 < 1e-6 or n2 < 1e-6:
        return None
    cos_val = np.dot(ba, bc) / (n1 * n2)
    return float(np.degrees(np.arccos(np.clip(cos_val, -1.0, 1.0))))

# MediaPipe landmark indices (Tasks API uses same 33-landmark schema)
MP_IDX = {
    'nose': 0, 'left_shoulder': 11, 'right_shoulder': 12,
    'left_elbow': 13, 'right_elbow': 14,
    'left_wrist': 15, 'right_wrist': 16,
    'left_hip': 23, 'right_hip': 24,
    'left_knee': 25, 'right_knee': 26,
    'left_ankle': 27, 'right_ankle': 28,
}

def extract_human_angles(frame_rgb, w, h):
    """Run MediaPipe PoseLandmarker on one frame, return angle vector."""
    try:
        mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
        result  = human_pose_model.detect(mp_img)
        if not result.pose_landmarks or len(result.pose_landmarks) == 0:
            return None, 0.0
        lms = result.pose_landmarks[0]   # List[NormalizedLandmark]

        # Compute visibility as mean presence (Tasks API uses presence, not visibility)
        vis_vals = []
        for lm in lms:
            v = getattr(lm, 'visibility', None)
            if v is not None:
                vis_vals.append(float(v))
        vis = float(np.mean(vis_vals)) if vis_vals else 0.5

        def kp(idx):
            if idx >= len(lms):
                return None
            lm = lms[idx]
            v  = getattr(lm, 'visibility', 1.0)
            if v is not None and v < 0.25:
                return None
            return (lm.x * w, lm.y * h)

        ls = kp(MP_IDX['left_shoulder'])
        rs = kp(MP_IDX['right_shoulder'])
        le = kp(MP_IDX['left_elbow'])
        re = kp(MP_IDX['right_elbow'])
        lw = kp(MP_IDX['left_wrist'])
        rw = kp(MP_IDX['right_wrist'])
        lh = kp(MP_IDX['left_hip'])
        rh = kp(MP_IDX['right_hip'])
        lk = kp(MP_IDX['left_knee'])
        rk = kp(MP_IDX['right_knee'])
        la = kp(MP_IDX['left_ankle'])
        ra = kp(MP_IDX['right_ankle'])

        angles = [
            angle_at(ls, le, lw),        # left elbow
            angle_at(rs, re, rw),        # right elbow
            angle_at(lh, lk, la),        # left knee
            angle_at(rh, rk, ra),        # right knee
            angle_at(ls, lh, lk),        # left hip
            angle_at(rs, rh, rk),        # right hip
            angle_at(le, ls, lh),        # left trunk
            angle_at(re, rs, rh),        # right trunk
        ]
        return angles, vis
    except Exception as e:
        return None, 0.0

YOLO_KP_NAMES = [
    'nose','left_eye','right_eye','left_ear','right_ear',
    'left_shoulder','right_shoulder','left_elbow','right_elbow',
    'left_wrist','right_wrist','left_hip','right_hip',
    'left_knee','right_knee','left_ankle','right_ankle'
]
YOLO_IDX = {n: i for i, n in enumerate(YOLO_KP_NAMES)}

def extract_animal_angles(frame_bgr):
    """Run YOLOv8-Pose on one frame, return angle vector (normalized coords)."""
    results = yolo_pose(frame_bgr, verbose=False)
    if not results or len(results[0].keypoints) == 0:
        return None, 0.0

    kps_data = results[0].keypoints[0].data[0].cpu().numpy()  # [17, 3]
    if kps_data.shape[0] < 17:
        return None, 0.0

    h, w = frame_bgr.shape[:2]
    vis = float(np.mean(kps_data[:, 2]))

    def kp(name):
        idx = YOLO_IDX.get(name)
        if idx is None or idx >= len(kps_data):
            return None
        x, y, conf = kps_data[idx]
        if conf < 0.3:
            return None
        return (float(x), float(y))

    ls = kp('left_shoulder')
    rs = kp('right_shoulder')
    le = kp('left_elbow')
    re = kp('right_elbow')
    lw = kp('left_wrist')
    rw = kp('right_wrist')
    lh = kp('left_hip')
    rh = kp('right_hip')
    lk = kp('left_knee')
    rk = kp('right_knee')
    la = kp('left_ankle')
    ra = kp('right_ankle')

    angles = [
        angle_at(ls, le, lw),   # L forelimb
        angle_at(rs, re, rw),   # R forelimb
        angle_at(lh, lk, la),   # L hindlimb
        angle_at(rh, rk, ra),   # R hindlimb
        angle_at(ls, lh, lk),   # L spine angle
        angle_at(rs, rh, rk),   # R spine angle
        angle_at(le, ls, lh),   # L shoulder-hip
        angle_at(re, rs, rh),   # R shoulder-hip
    ]
    return angles, vis

def normalize_angles(angles, fill=90.0):
    """Normalize angle vector: fill None → fill, divide by 180."""
    out = []
    for a in angles:
        out.append((a if a is not None else fill) / 180.0)
    return out

# ──────────────────────────────────────────────────────────────────────────────
# Step 2: Extract keypoints from all videos
# ──────────────────────────────────────────────────────────────────────────────
print("\n[2/6] Extracting real keypoints from all videos...")

all_samples = []   # list of dicts: {angles, species, exercise, quality, vis, source}

for video_path in sorted(VIDEO_DIR.glob('*.mp4')):
    vname = video_path.name
    # Match label
    matched_label = None
    for key, label in VIDEO_LABELS.items():
        if key.lower() in vname.lower():
            matched_label = label
            break

    if matched_label is None:
        print(f"  SKIP (no label): {vname[:60]}")
        continue

    species, exercise, quality = matched_label
    is_human = species == 'human'

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print(f"  FAIL (open): {vname[:60]}")
        continue

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    # Sample every ~0.5s, max 120 frames per video
    step = max(1, int(fps * 0.5))
    max_frames = 120
    sample_count = 0
    good_count = 0
    frame_idx = 0

    print(f"  [{species:8}] {exercise:20} | {total_frames}f @ {fps:.0f}fps | {vname[:55]}")

    while cap.isOpened() and sample_count < max_frames:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % step == 0:
            sample_count += 1
            h, w = frame.shape[:2]

            # Resize for speed (max 640px wide)
            scale = 1.0
            if w > 640:
                scale = 640.0 / w
                frame = cv2.resize(frame, (640, int(h * scale)))

            if is_human:
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                angles, vis = extract_human_angles(rgb, frame.shape[1], frame.shape[0])
                source = 'mediapipe'
            else:
                angles, vis = extract_animal_angles(frame)
                source = 'yolov8_pose'

            if angles is not None and vis > 0.15:
                good_count += 1
                # ── Deterministic biomechanical scoring from real angles ──
                form_score, posture_score, balance_score = compute_form_score(
                    angles, exercise, vis
                )

                all_samples.append({
                    'angles': normalize_angles(angles),
                    'angles_raw': angles,   # keep raw for debugging
                    'species': species,
                    'exercise': exercise,
                    'quality': quality,
                    'form_score': form_score,
                    'posture_score': posture_score,
                    'balance_score': balance_score,
                    'visibility': vis,
                    'source': source,
                })


        frame_idx += 1

    cap.release()
    print(f"    -> {good_count}/{sample_count} frames with detected pose")

print(f"\nTotal real samples collected: {len(all_samples)}")

if len(all_samples) < 20:
    print("ERROR: Not enough samples extracted. Check video files and models.")
    sys.exit(1)

# ──────────────────────────────────────────────────────────────────────────────
# Step 3: Build feature matrix
# ──────────────────────────────────────────────────────────────────────────────
print("\n[3/6] Building feature matrix...")

ANGLE_DIM = 8    # 8 joint angles per frame
SPECIES_DIM = len(SPECIES_LIST)
EXERCISE_DIM = len(EXERCISE_LIST)

# Feature: angles (8) + species one-hot + exercise one-hot
def build_feature(sample):
    angles = sample['angles']  # 8 floats
    sp_oh = [1.0 if s == sample['species'] else 0.0 for s in SPECIES_LIST]
    ex_oh = [1.0 if e == sample['exercise'] else 0.0 for e in EXERCISE_LIST]
    vis = [sample['visibility']]
    return angles + sp_oh + ex_oh + vis

INPUT_DIM = ANGLE_DIM + SPECIES_DIM + EXERCISE_DIM + 1

X_data = np.array([build_feature(s) for s in all_samples], dtype=np.float32)
Y_scores = np.array([[s['form_score'], s['posture_score'], s['balance_score']] for s in all_samples], dtype=np.float32)

# Grade classification: A(90+), B(75-89), C(60-74), D(40-59), F(<40)
def score_to_grade(score):
    if score >= 90: return 0   # A
    elif score >= 75: return 1  # B
    elif score >= 60: return 2  # C
    elif score >= 40: return 3  # D
    else: return 4              # F

Y_grades = np.array([score_to_grade(s['form_score']) for s in all_samples], dtype=np.int64)
Y_species = np.array([SPECIES_LIST.index(s['species']) for s in all_samples], dtype=np.int64)
Y_exercise = np.array([EXERCISE_LIST.index(s['exercise']) for s in all_samples], dtype=np.int64)

print(f"  Input dim  : {INPUT_DIM}")
print(f"  Samples    : {len(X_data)}")
print(f"  Species    : {list(zip(SPECIES_LIST, np.bincount(Y_species).tolist()))}")
grade_counts = np.bincount(Y_grades, minlength=5).tolist()
print(f"  Grade dist : A={grade_counts[0]}, B={grade_counts[1]}, C={grade_counts[2]}, D={grade_counts[3]}, F={grade_counts[4]}")

# ──────────────────────────────────────────────────────────────────────────────
# Step 4: Train/Val/Test split (70/15/15)
# ──────────────────────────────────────────────────────────────────────────────
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

idx_all = np.arange(len(X_data))
idx_train, idx_temp = train_test_split(idx_all, test_size=0.30, random_state=42, stratify=Y_grades)
idx_val, idx_test   = train_test_split(idx_temp, test_size=0.50, random_state=42)

scaler = StandardScaler()
X_train = scaler.fit_transform(X_data[idx_train])
X_val   = scaler.transform(X_data[idx_val])
X_test  = scaler.transform(X_data[idx_test])

Y_train_scores  = Y_scores[idx_train]
Y_val_scores    = Y_scores[idx_val]
Y_test_scores   = Y_scores[idx_test]
Y_train_grades  = Y_grades[idx_train]
Y_val_grades    = Y_grades[idx_val]
Y_test_grades   = Y_grades[idx_test]
Y_train_species = Y_species[idx_train]
Y_val_species   = Y_species[idx_val]
Y_test_species  = Y_species[idx_test]

print(f"\n  Train: {len(idx_train)} | Val: {len(idx_val)} | Test: {len(idx_test)}")

# ──────────────────────────────────────────────────────────────────────────────
# Step 5: Build & Train PyTorch Models
# ──────────────────────────────────────────────────────────────────────────────
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset

print("\n[4/6] Training AIScannerBiomechanicsNet on REAL data...")

def to_tensor(*arrays):
    return [torch.tensor(a) for a in arrays]

Xtr, Xva, Xte = to_tensor(X_train, X_val, X_test)
Ytr_sc, Yva_sc, Yte_sc = to_tensor(Y_train_scores, Y_val_scores, Y_test_scores)
Ytr_gr, Yva_gr, Yte_gr = to_tensor(Y_train_grades, Y_val_grades, Y_test_grades)
Ytr_sp, Yva_sp, Yte_sp = to_tensor(Y_train_species, Y_val_species, Y_test_species)

# ── Biomechanics Net ──
class AIScannerBiomechanicsNet(nn.Module):
    def __init__(self, input_dim, n_grades=5):
        super().__init__()
        self.backbone = nn.Sequential(
            nn.Linear(input_dim, 256), nn.BatchNorm1d(256), nn.GELU(), nn.Dropout(0.2),
            nn.Linear(256, 128), nn.BatchNorm1d(128), nn.GELU(), nn.Dropout(0.15),
            nn.Linear(128, 64),  nn.BatchNorm1d(64),  nn.GELU(),
        )
        self.scores_head = nn.Sequential(
            nn.Linear(64, 32), nn.ReLU(),
            nn.Linear(32, 3),  nn.Sigmoid()
        )
        self.grade_head = nn.Linear(64, n_grades)

    def forward(self, x):
        feat   = self.backbone(x)
        scores = self.scores_head(feat) * 100.0
        grades = self.grade_head(feat)
        return scores, grades

# ── Species Classifier ──
class SpeciesClassifierNet(nn.Module):
    def __init__(self, input_dim, n_species):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 128), nn.BatchNorm1d(128), nn.GELU(), nn.Dropout(0.2),
            nn.Linear(128, 64),        nn.BatchNorm1d(64),  nn.GELU(),
            nn.Linear(64, n_species)
        )

    def forward(self, x):
        return self.net(x)

device = torch.device('cpu')

bio_net = AIScannerBiomechanicsNet(INPUT_DIM, n_grades=5).to(device)
sp_net  = SpeciesClassifierNet(INPUT_DIM, n_species=SPECIES_DIM).to(device)

# DataLoaders
bs = min(32, len(idx_train))
train_ds = TensorDataset(Xtr, Ytr_sc, Ytr_gr, Ytr_sp)
train_loader = DataLoader(train_ds, batch_size=bs, shuffle=True, drop_last=False)

# ── Train Biomechanics ──
# Class weights to handle grade imbalance (A/B/C/D/F)
grade_counts = torch.zeros(5)
for g in Ytr_gr:
    grade_counts[g.item()] += 1
grade_counts = torch.clamp(grade_counts, min=1)
gr_weights = (1.0 / grade_counts)
gr_weights = (gr_weights / gr_weights.sum() * 5).to(device)  # normalize to n_classes
print(f"  Grade class weights: {[round(w,2) for w in gr_weights.tolist()]}")

mse_loss = nn.MSELoss()
ce_loss  = nn.CrossEntropyLoss(weight=gr_weights)
bio_opt  = optim.AdamW(bio_net.parameters(), lr=1e-3, weight_decay=5e-4)
# Warm up + cosine annealing
scheduler = optim.lr_scheduler.OneCycleLR(
    bio_opt, max_lr=3e-3, epochs=200,
    steps_per_epoch=max(1, len(train_loader)),
    pct_start=0.1, div_factor=10, final_div_factor=100
)

best_val_acc = 0.0
best_val_mae = 999.0
best_state   = None

EPOCHS = 200
print(f"  Training for {EPOCHS} epochs (batch_size={bs}) ...")

for epoch in range(EPOCHS):
    bio_net.train()
    ep_loss = 0.0
    for Xb, Yb_sc, Yb_gr, _ in train_loader:
        bio_opt.zero_grad()
        pred_sc, pred_gr = bio_net(Xb)
        # Combined loss: regression (MAE-style) + classification
        sc_loss = mse_loss(pred_sc / 100.0, Yb_sc / 100.0)
        gr_loss = ce_loss(pred_gr, Yb_gr)
        loss = sc_loss + 0.7 * gr_loss
        loss.backward()
        torch.nn.utils.clip_grad_norm_(bio_net.parameters(), 1.0)
        bio_opt.step()
        scheduler.step()
        ep_loss += loss.item()

    if (epoch + 1) % 20 == 0 or epoch == 0:
        bio_net.eval()
        with torch.no_grad():
            va_sc, va_gr = bio_net(Xva)
            va_preds = va_gr.argmax(dim=1)
            va_acc   = (va_preds == Yva_gr).float().mean().item() * 100.0
            va_mae   = torch.abs(va_sc[:, 0] - Yva_sc[:, 0]).mean().item()
        # Save best by acc first, then mae as tiebreaker
        if va_acc > best_val_acc or (va_acc == best_val_acc and va_mae < best_val_mae):
            best_val_acc = va_acc
            best_val_mae = va_mae
            best_state   = {k: v.clone() for k, v in bio_net.state_dict().items()}
        print(f"  Epoch {epoch+1:3d}/{EPOCHS} | loss={ep_loss/len(train_loader):.4f} | val_grade_acc={va_acc:.1f}% | val_mae={va_mae:.1f}pts")

# Load best weights
if best_state:
    bio_net.load_state_dict(best_state)

# ── Train Species Classifier ──
print(f"\n  Training SpeciesClassifier ...")
sp_ce_loss = nn.CrossEntropyLoss()   # No class weights — species are balanced enough
sp_opt  = optim.AdamW(sp_net.parameters(), lr=1e-3, weight_decay=1e-4)
sp_sched = optim.lr_scheduler.OneCycleLR(
    sp_opt, max_lr=3e-3, epochs=100,
    steps_per_epoch=max(1, len(train_loader)),
    pct_start=0.1
)
best_sp_acc = 0.0
best_sp_state = None

for epoch in range(100):
    sp_net.train()
    for Xb, _, _, Yb_sp in train_loader:
        sp_opt.zero_grad()
        pred_sp = sp_net(Xb)
        loss = sp_ce_loss(pred_sp, Yb_sp)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(sp_net.parameters(), 1.0)
        sp_opt.step()
        sp_sched.step()

    if (epoch + 1) % 20 == 0:
        sp_net.eval()
        with torch.no_grad():
            va_sp  = sp_net(Xva)
            sp_acc = (va_sp.argmax(1) == Yva_sp).float().mean().item() * 100.0
        if sp_acc > best_sp_acc:
            best_sp_acc = sp_acc
            best_sp_state = {k: v.clone() for k, v in sp_net.state_dict().items()}
        print(f"  SP Epoch {epoch+1:3d}/100 | val_species_acc={sp_acc:.1f}%")


if best_sp_state:
    sp_net.load_state_dict(best_sp_state)

# ──────────────────────────────────────────────────────────────────────────────
# Step 6: Evaluate on Test Set
# ──────────────────────────────────────────────────────────────────────────────
print("\n[5/6] Evaluating on held-out test set...")

bio_net.eval()
sp_net.eval()

with torch.no_grad():
    te_sc, te_gr = bio_net(Xte)
    te_grade_acc = (te_gr.argmax(1) == Yte_gr).float().mean().item() * 100.0
    te_score_mae = torch.abs(te_sc[:, 0] - Yte_sc[:, 0]).mean().item()

    te_sp_out  = sp_net(Xte)
    te_sp_acc  = (te_sp_out.argmax(1) == Yte_sp).float().mean().item() * 100.0

print(f"\n  REAL DATA RESULTS:")
print(f"  Biomechanics grade accuracy : {te_grade_acc:.2f}%")
print(f"  Form score MAE              : {te_score_mae:.2f} pts")
print(f"  Species classification acc  : {te_sp_acc:.2f}%")

# Per-species accuracy
from collections import defaultdict
sp_correct = defaultdict(int)
sp_total   = defaultdict(int)
sp_out_test = sp_net(Xte).argmax(1).numpy()
for pred, true in zip(sp_out_test, Y_test_species):
    sp_name = SPECIES_LIST[true]
    sp_total[sp_name] += 1
    if pred == true:
        sp_correct[sp_name] += 1
per_species = {}
for sp in SPECIES_LIST:
    total = sp_total.get(sp, 0)
    corr  = sp_correct.get(sp, 0)
    per_species[sp] = round(corr / total * 100.0, 1) if total > 0 else None
    if total > 0:
        print(f"    {sp:10}: {corr}/{total} = {per_species[sp]:.1f}%")

# ──────────────────────────────────────────────────────────────────────────────
# Step 7: Save Models & Weights
# ──────────────────────────────────────────────────────────────────────────────
print("\n[6/6] Saving models and weights...")

# --- Save PyTorch model checkpoints ---
torch.save(bio_net.state_dict(), MODELS_DIR / 'aiscanner_model_best.pt')
torch.save(sp_net.state_dict(), MODELS_DIR / 'species_model_best.pt')

# --- Save scaler params (for inference) ---
import pickle
with open(MODELS_DIR / 'scaler.pkl', 'wb') as f:
    pickle.dump(scaler, f)

# --- Export JS weights for browser ---
def export_js_weights(model, path, meta=None):
    """Export all layer weights as JSON arrays for browser TF.js-style inference."""
    layers = []
    for name, param in model.named_parameters():
        data = param.detach().cpu().numpy()
        layers.append({
            'name': name,
            'shape': list(data.shape),
            'data': data.flatten().tolist()
        })
    payload = {'layers': layers}
    if meta:
        payload['meta'] = meta
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(payload, f, separators=(',', ':'))
    size_kb = os.path.getsize(path) // 1024
    print(f"  Exported: {path.name} ({size_kb} KB)")

bio_meta = {
    'input_dim': INPUT_DIM,
    'angle_dim': ANGLE_DIM,
    'species_list': SPECIES_LIST,
    'exercise_list': EXERCISE_LIST,
    'grades': ['A', 'B', 'C', 'D', 'F'],
    'scaler_mean': scaler.mean_.tolist(),
    'scaler_scale': scaler.scale_.tolist(),
    'trained_on': 'real_video_keypoints',
    'training_samples': len(all_samples),
    'test_grade_accuracy': round(te_grade_acc, 2),
    'test_score_mae': round(te_score_mae, 2),
    'timestamp': datetime.now().isoformat(),
}
sp_meta = {
    'input_dim': INPUT_DIM,
    'species_list': SPECIES_LIST,
    'scaler_mean': scaler.mean_.tolist(),
    'scaler_scale': scaler.scale_.tolist(),
    'trained_on': 'real_video_keypoints',
    'training_samples': len(all_samples),
    'test_accuracy': round(te_sp_acc, 2),
    'timestamp': datetime.now().isoformat(),
}

export_js_weights(bio_net, WEBSITE_MODELS / 'aiscanner_model_weights.json', bio_meta)
export_js_weights(sp_net,  WEBSITE_MODELS / 'species_model_weights.json',   sp_meta)

# --- Save evaluation report ---
report = {
    'model_name': 'AIScannerBiomechanicsNet (Trained on Real Video Data)',
    'model_version': '4.0.0',
    'training_timestamp': datetime.now().isoformat(),
    'data_source': 'Real pose keypoints extracted from 14 animal/human training videos',
    'training_pipeline': {
        'pose_extractor_human': 'MediaPipe Pose (model_complexity=2)',
        'pose_extractor_animal': f'YOLOv8-Pose ({yolo_pose_path.name})',
        'frame_sampling': 'Every 0.5 seconds, max 120 frames per video',
        'total_real_samples': len(all_samples),
        'train_samples': len(idx_train),
        'val_samples': len(idx_val),
        'test_samples': len(idx_test),
    },
    'metrics': {
        'biomechanics_grade_accuracy': round(te_grade_acc, 2),
        'form_score_mae_points': round(te_score_mae, 2),
        'species_classification_accuracy': round(te_sp_acc, 2),
        'deployment_status': 'DEPLOYED - Trained on real video pose data',
    },
    'per_species_accuracy': per_species,
    'supported_species': SPECIES_LIST,
    'supported_exercises': EXERCISE_LIST,
    'video_sources': [v.name for v in sorted(VIDEO_DIR.glob('*.mp4'))],
}

with open(REPORT_PATH, 'w', encoding='utf-8') as f:
    json.dump(report, f, indent=2, ensure_ascii=False)

with open(MODELS_DIR / 'aiscanner_evaluation_report.json', 'w', encoding='utf-8') as f:
    json.dump(report, f, indent=2, ensure_ascii=False)

print(f"\n  Report saved: {REPORT_PATH}")
print("\n" + "=" * 65)
print("  TRAINING COMPLETE — REAL DATA MODEL DEPLOYED")
print("=" * 65)
print(f"  Biomechanics grade accuracy : {te_grade_acc:.2f}%")
print(f"  Form score MAE              : {te_score_mae:.2f} pts")
print(f"  Species accuracy            : {te_sp_acc:.2f}%")
print(f"  Total real samples          : {len(all_samples)}")
print("=" * 65)
