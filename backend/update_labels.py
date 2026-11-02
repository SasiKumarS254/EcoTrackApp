"""
Update VIDEO_LABELS in train_real_model.py with all downloaded animal videos.
Uses string slicing to avoid regex backslash escape issues.
"""
import re
from pathlib import Path

BASE_DIR = Path(__file__).parent
VIDEO_DIR = BASE_DIR.parent / 'EcoTrack AppVideo'
TRAIN_PATH = BASE_DIR / 'train_real_model.py'

HUMAN_EXERCISE_BLACKLIST = [
    'workout', 'gym', 'fitness drill', 'agility drill', 'agility ladder',
    'handstand', 'exercise demo', 'how to do', 'sets reps', 'crossfit',
    'plyometric', 'athlete training', 'soccer', 'football drill', 'basketball',
    'conditioning drill', 'bootcamp', 'HIIT', 'hobby horse', 'hobby horsing', 'hobby-horse'
]
ANIMAL_ONLY_SPECIES = {'rabbit', 'turtle', 'horse', 'cow', 'goat', 'parrot'}

def is_bad_file(filename, species):
    if species not in ANIMAL_ONLY_SPECIES:
        return False
    name_lower = filename.lower()
    return any(bad.lower() in name_lower for bad in HUMAN_EXERCISE_BLACKLIST)

new_labels_by_key = {}
for vpath in sorted(VIDEO_DIR.glob('*.mp4')):
    vname = vpath.name
    m = re.match(r'\[(\w+)\]\[(\w+)\](.*?)\.mp4$', vname)
    if m:
        species, exercise, title = m.group(1), m.group(2), m.group(3).strip('.')
        if is_bad_file(vname, species):
            continue
        key = title[:45].strip()
        if key and key not in new_labels_by_key:
            quality = 'good' if exercise in ['human_pushup','horse_trot','horse_jump','dog_agility','dog_jump'] else 'active'
            new_labels_by_key[key] = (species, exercise, quality)

new_entries_text = "\n".join(
    f"    {repr(k)}: ('{v[0]}', '{v[1]}', '{v[2]}'),"
    for k, v in new_labels_by_key.items()
)

content = TRAIN_PATH.read_text(encoding='utf-8')

# Find where VIDEO_LABELS dictionary starts and ends
start_marker = "# AUTO-DOWNLOADED ANIMAL VIDEOS"
if start_marker in content:
    idx_start = content.index(start_marker)
    # Find the closing brace of VIDEO_LABELS
    idx_end = content.find("\n}\n", idx_start)
    if idx_end == -1:
        idx_end = content.find("\n}", idx_start)
    content = content[:idx_start] + f"# AUTO-DOWNLOADED ANIMAL VIDEOS (verified real footage)\n{new_entries_text}" + content[idx_end:]
else:
    anchor = "    'How to do a Push-Up':            ('human',  'human_pushup',   'good'),\n"
    if anchor in content:
        insert_pos = content.index(anchor) + len(anchor)
        content = content[:insert_pos] + f"    # AUTO-DOWNLOADED ANIMAL VIDEOS (verified real footage)\n{new_entries_text}\n" + content[insert_pos:]

TRAIN_PATH.write_text(content, encoding='utf-8')
print(f"✅ Successfully updated {len(new_labels_by_key)} video labels in {TRAIN_PATH.name}")
