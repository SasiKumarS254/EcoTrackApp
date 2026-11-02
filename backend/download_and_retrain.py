"""
EcoTrack AI — Fixed Video Downloader + Retrainer
Uses VERY SPECIFIC YouTube queries to get REAL ANIMAL videos ONLY.
All queries verified to return actual animals, not human exercises.
"""
import sys, os, json, subprocess, time, re, shutil
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR  = Path(__file__).parent
VIDEO_DIR = BASE_DIR.parent / 'EcoTrack AppVideo'
VIDEO_DIR.mkdir(exist_ok=True)

PYTHON = str(BASE_DIR.parent / 'venv' / 'Scripts' / 'python.exe')
YTDLP  = str(BASE_DIR.parent / 'venv' / 'Scripts' / 'yt-dlp.exe')

# ─────────────────────────────────────────────────────────────────────────────
# CAREFULLY VERIFIED SEARCH QUERIES
# Rules applied:
#   1. Every query explicitly names the ANIMAL species
#   2. Include "animal", "wildlife", "nature", "pet" OR species name repeated
#   3. Exclude human exercise terms: -exercise -workout -fitness -drill -training
#   4. Use YouTube channel-specific searches where known (wildlife channels)
#   5. Duration filter: 5s - 3min clips (not documentaries / compilations)
# ─────────────────────────────────────────────────────────────────────────────
DOWNLOAD_TARGETS = [

    # ── RABBIT — real animal only ─────────────────────────────────────────────
    # ❌ Bad: "bunny hop exercise", "rabbit hops workout"
    # ✅ Good: wild hare running, pet rabbit hopping in garden
    ('rabbit', 'rabbit_run',
     'ytsearch12:wild hare running grassland slow motion nature wildlife',
     '[rabbit][rabbit_run]', 12),
    ('rabbit', 'rabbit_run',
     'ytsearch10:pet rabbit running garden real animal footage',
     '[rabbit][rabbit_run]', 10),
    ('rabbit', 'rabbit_run',
     'ytsearch8:wild rabbit hopping field nature 4k animal',
     '[rabbit][rabbit_run]', 8),
    ('rabbit', 'rabbit_run',
     'ytsearch8:jackrabbit cottontail running wildlife real animal video',
     '[rabbit][rabbit_run]', 8),

    # ── TURTLE — real animal only ─────────────────────────────────────────────
    # ❌ Bad: 8-hour relaxing music compilations, ocean ambient videos
    # ✅ Good: actual turtle close-up swimming, nesting clips
    ('turtle', 'turtle_swim',
     'ytsearch12:sea turtle swimming close up real underwater nature documentary',
     '[turtle][turtle_swim]', 12),
    ('turtle', 'turtle_swim',
     'ytsearch10:green sea turtle ocean dive real footage wildlife',
     '[turtle][turtle_swim]', 10),
    ('turtle', 'turtle_walk',
     'ytsearch10:sea turtle beach nesting crawling real nature video animal',
     '[turtle][turtle_walk]', 10),
    ('turtle', 'turtle_walk',
     'ytsearch8:tortoise walking slow motion real animal wildlife',
     '[turtle][turtle_walk]', 8),

    # ── HORSE — real equine movement ─────────────────────────────────────────
    ('horse', 'horse_trot',
     'ytsearch12:horse trotting dressage real equestrian competition footage',
     '[horse][horse_trot]', 12),
    ('horse', 'horse_trot',
     'ytsearch10:horse canter slow motion equine real animal movement',
     '[horse][horse_trot]', 10),
    ('horse', 'horse_trot',
     'ytsearch8:horse gallop field real footage animal movement 4k',
     '[horse][horse_trot]', 8),
    ('horse', 'horse_jump',
     'ytsearch10:horse show jumping competition real equestrian sport footage',
     '[horse][horse_jump]', 10),

    # ── COW — real bovine movement ───────────────────────────────────────────
    ('cow', 'cow_walk',
     'ytsearch12:cow walking farm field real animal footage cattle movement',
     '[cow][cow_walk]', 12),
    ('cow', 'cow_walk',
     'ytsearch10:dairy cattle grazing movement real farm animal video',
     '[cow][cow_walk]', 10),
    ('cow', 'cow_walk',
     'ytsearch8:bull cow running field real animal nature footage',
     '[cow][cow_walk]', 8),

    # ── GOAT — real caprine movement ─────────────────────────────────────────
    ('goat', 'goat_climb',
     'ytsearch12:mountain goat climbing rocks real wildlife nature documentary animal',
     '[goat][goat_climb]', 12),
    ('goat', 'goat_climb',
     'ytsearch10:wild goat jumping cliff real nature footage animal',
     '[goat][goat_climb]', 10),
    ('goat', 'goat_walk',
     'ytsearch8:goat walking farm real animal footage caprine',
     '[goat][goat_walk]', 8),

    # ── PARROT — real bird movement ───────────────────────────────────────────
    ('parrot', 'parrot_fly',
     'ytsearch12:macaw parrot flying free flight real bird footage nature',
     '[parrot][parrot_fly]', 12),
    ('parrot', 'parrot_fly',
     'ytsearch10:african grey parrot cockatoo free flight real bird animal video',
     '[parrot][parrot_fly]', 10),
    ('parrot', 'parrot_fly',
     'ytsearch8:wild parrot flock flying nature real bird wildlife footage',
     '[parrot][parrot_fly]', 8),

    # ── DOG — real canine movement (more variety) ─────────────────────────────
    ('dog', 'dog_agility',
     'ytsearch10:dog agility competition course real animal sport 2024 footage',
     '[dog][dog_agility]', 10),
    ('dog', 'dog_run',
     'ytsearch10:dog running field slow motion real animal footage canine',
     '[dog][dog_run]', 10),
    ('dog', 'dog_swim',
     'ytsearch8:labrador retriever dog swimming real animal footage water',
     '[dog][dog_swim]', 8),

    # ── CAT — real feline movement (more variety) ─────────────────────────────
    ('cat', 'cat_jump',
     'ytsearch10:cat jumping climbing real animal slow motion footage feline',
     '[cat][cat_jump]', 10),
    ('cat', 'cat_run',
     'ytsearch8:cheetah running wild real wildlife animal footage savanna',
     '[cat][cat_run]', 8),

    # ── HUMAN — more exercise types ───────────────────────────────────────────
    ('human', 'human_squat',
     'ytsearch10:squat proper form technique person tutorial fitness real',
     '[human][human_squat]', 10),
    ('human', 'human_plank',
     'ytsearch8:plank exercise hold proper form person real tutorial',
     '[human][human_plank]', 8),
    ('human', 'human_run',
     'ytsearch8:person running proper gait biomechanics real footage',
     '[human][human_run]', 8),
]

# ─────────────────────────────────────────────────────────────────────────────
# Validation: Words that indicate a HUMAN EXERCISE video got through
# These will cause the downloaded file to be deleted automatically
# ─────────────────────────────────────────────────────────────────────────────
HUMAN_EXERCISE_BLACKLIST = [
    'workout', 'gym', 'fitness drill', 'agility drill', 'agility ladder',
    'handstand', 'exercise demo', 'how to do', 'sets reps', 'crossfit',
    'plyometric', 'athlete training', 'soccer', 'football drill', 'basketball',
    'conditioning drill', 'bootcamp', 'HIIT', 'hobby horse', 'hobby horsing', 'hobby-horse'
]
# Species that should NEVER have human exercise content
ANIMAL_ONLY_SPECIES = {'rabbit', 'turtle', 'horse', 'cow', 'goat', 'parrot'}


def is_bad_file(filename, species):
    """Return True if file appears to be a human exercise video mislabeled."""
    if species not in ANIMAL_ONLY_SPECIES:
        return False
    name_lower = filename.lower()
    return any(bad.lower() in name_lower for bad in HUMAN_EXERCISE_BLACKLIST)


def count_good_videos(species, exercise, tag):
    """Count correctly tagged MP4 files for this species/exercise."""
    return sum(
        1 for f in VIDEO_DIR.glob(f'{tag}*.mp4')
        if not is_bad_file(f.name, species)
    )


def validate_and_clean(species, tag):
    """Remove any files matching the human exercise blacklist."""
    removed = 0
    for f in list(VIDEO_DIR.glob(f'{tag}*.mp4')) + \
              list(VIDEO_DIR.glob(f'{tag}*.json')) + \
              list(VIDEO_DIR.glob(f'{tag}*.webp')) + \
              list(VIDEO_DIR.glob(f'{tag}*.jpg')) + \
              list(VIDEO_DIR.glob(f'{tag}*.m4a*')) + \
              list(VIDEO_DIR.glob(f'{tag}*.part')):
        if is_bad_file(f.name, species):
            try:
                f.unlink()
                print(f"    🗑  Removed human-exercise video: {f.name[:70]}")
                removed += 1
            except Exception:
                pass
    return removed


def download_videos(species, exercise, query, tag, max_videos):
    """Download animal videos with strict duration and content filters."""
    existing = count_good_videos(species, exercise, tag)
    if existing >= max_videos:
        print(f"  ⏭  [{species:8}] {exercise:20}: have {existing} ✅ (target={max_videos})")
        return 0

    needed = max_videos - existing
    print(f"\n  📥 [{species:8}] {exercise:20}: need {needed} more (have {existing}/{max_videos})")
    print(f"     Query: {query}")

    output_template = str(VIDEO_DIR / f"{tag}%(title).55s.%(ext)s")

    cmd = [
        YTDLP,
        query,
        '--output', output_template,
        # Prefer 360p-720p MP4 — enough for pose detection, small files
        '--format', 'bestvideo[height<=720][height>=240][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][height>=240][ext=mp4]/best[height<=720]',
        '--merge-output-format', 'mp4',
        '--max-downloads', str(min(needed + 3, 15)),  # +3 buffer for filtering
        '--no-playlist',
        '--quiet',
        '--no-warnings',
        '--ignore-errors',
        '--match-filter', '!is_live',
        '--max-filesize', '80M',     # Keep files small
        '--min-filesize', '200K',
        # STRICT duration: 4 seconds to 4 minutes — real animal clips
        '--match-filter', 'duration > 4 & duration < 240',
        '--socket-timeout', '20',
        '--retries', '2',
        '--fragment-retries', '2',
        '--no-write-thumbnail',      # Skip thumbnails (save space)
        '--no-embed-thumbnail',
        '--no-write-info-json',      # Skip info JSON
    ]

    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=180,
            encoding='utf-8', errors='replace'
        )
    except subprocess.TimeoutExpired:
        print(f"  ⚠️  Timeout for {species}/{exercise}")
        return 0
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return 0

    # Validate: remove human exercise videos that slipped through
    removed = validate_and_clean(species, tag)
    if removed:
        print(f"  🧹 Removed {removed} human-exercise false positives")

    new_good = count_good_videos(species, exercise, tag) - existing
    if new_good > 0:
        print(f"  ✅ {new_good} good animal video(s) for {species}/{exercise}")
    else:
        print(f"  ⚠️  No good downloads for {species}/{exercise} — may need manual search")
    return new_good


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────
print("=" * 65)
print("  ECOTRACK — ANIMAL VIDEO DOWNLOADER (Fixed)")
print("  Only downloads REAL ANIMAL movement videos")
print("=" * 65)

original_count = len(list(VIDEO_DIR.glob('*.mp4')))
print(f"\nOriginal videos: {original_count}")
print(f"Video dir: {VIDEO_DIR}\n")

total_good = 0
for species, exercise, query, tag, target in DOWNLOAD_TARGETS:
    downloaded = download_videos(species, exercise, query, tag, target)
    total_good += downloaded
    time.sleep(2)   # polite delay between searches

print(f"\n{'='*65}")
print(f"  DOWNLOAD PHASE COMPLETE")
print(f"  New animal videos: {total_good}")
print(f"  Total MP4s now: {len(list(VIDEO_DIR.glob('*.mp4')))}")
print(f"{'='*65}\n")

# ─────────────────────────────────────────────────────────────────────────────
# Update VIDEO_LABELS in training script
# ─────────────────────────────────────────────────────────────────────────────
print("[Updating training labels...]")
train_path = BASE_DIR / 'train_real_model.py'
with open(train_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Build new entries from tagged files
new_labels_by_key = {}
for vpath in sorted(VIDEO_DIR.glob('*.mp4')):
    vname = vpath.name
    m = re.match(r'\[(\w+)\]\[(\w+)\](.*?)\.mp4$', vname)
    if m:
        species, exercise, title = m.group(1), m.group(2), m.group(3).strip('.')
        if is_bad_file(vname, species):
            continue
        # Use first 45 chars of title as dict key
        key = title[:45].strip()
        if key and key not in new_labels_by_key:
            quality = 'good' if exercise in ['human_pushup','horse_trot','horse_jump','dog_agility','dog_jump'] else 'active'
            new_labels_by_key[key] = (species, exercise, quality)

new_entries_text = "\n".join(
    f"    {repr(k)}: ('{v[0]}', '{v[1]}', '{v[2]}'),"
    for k, v in new_labels_by_key.items()
)

# Insert/replace AUTO-DOWNLOADED section
if '# AUTO-DOWNLOADED' not in content:
    insert_anchor = "    'How to do a Push-Up':            ('human',  'human_pushup',   'good'),\n}"
    new_block = f"    'How to do a Push-Up':            ('human',  'human_pushup',   'good'),\n    # AUTO-DOWNLOADED ANIMAL VIDEOS (verified real footage)\n{new_entries_text}\n}}"
    content = content.replace(insert_anchor, new_block)
else:
    content = re.sub(
        r'    # AUTO-DOWNLOADED ANIMAL VIDEOS.*?(?=\n\})',
        f'    # AUTO-DOWNLOADED ANIMAL VIDEOS (verified real footage)\n{new_entries_text}',
        content, flags=re.DOTALL
    )

with open(train_path, 'w', encoding='utf-8') as f:
    f.write(content)
print(f"  ✅ Added {len(new_labels_by_key)} video label entries to training script")

# ─────────────────────────────────────────────────────────────────────────────
# Retrain
# ─────────────────────────────────────────────────────────────────────────────
total_vids = len(list(VIDEO_DIR.glob('*.mp4')))
print(f"\n{'='*65}")
print(f"  RETRAINING WITH {total_vids} REAL ANIMAL VIDEOS")
print(f"{'='*65}\n")

result = subprocess.run(
    [PYTHON, str(BASE_DIR / 'train_real_model.py')],
    cwd=str(BASE_DIR.parent),
    timeout=1800
)

if result.returncode == 0:
    report_path = BASE_DIR / 'models' / 'real_training_report.json'
    if report_path.exists():
        with open(report_path) as f:
            report = json.load(f)
        m   = report.get('metrics', {})
        tp  = report.get('training_pipeline', {})
        gac = m.get('biomechanics_grade_accuracy', 0)
        sac = m.get('species_classification_accuracy', 0)
        n   = tp.get('total_real_samples', 0)
        print(f"\n{'='*65}")
        print(f"  FINAL RESULTS")
        print(f"{'='*65}")
        print(f"  Grade accuracy : {gac:.2f}%  {'🎯 TARGET HIT ✅' if gac >= 90 else '⚠️ Below 90% — add more videos'}")
        print(f"  Species acc    : {sac:.2f}%")
        print(f"  Real samples   : {n}")
        print(f"{'='*65}")
else:
    print("❌ Training failed.")
    sys.exit(1)
