import os, sys, json, requests, time
import numpy as np
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

AI_BASE   = "http://127.0.0.1:5001"
VIDEO_DIR = Path(r"C:\Users\DELL\EcoTrackApp\EcoTrack AppVideo")

# Map: (video filename substring, exercise_id, expected_species)
TESTS = [
    ("[cat][cat_jump]Cat Jumping in Slow Motion", "cat_jump", "cat"),
    ("[dog][dog_agility]Amazing Dog Performs",    "dog_agility", "dog"),
    ("Ground poles with Maddie",                  "horse_trot", "horse"),
    ("How to do a Push-Up",                       "human_pushup", "human"),
    ("Wild Rabbit",                               "rabbit_run", "rabbit"),
]

def find_video(substr):
    for p in VIDEO_DIR.glob("*.mp4"):
        if substr.lower() in p.name.lower():
            return p
    return None

def grade_letter(score):
    if score >= 92: return "A+"
    if score >= 85: return "A"
    if score >= 75: return "B"
    if score >= 65: return "C"
    return "D"

def check_report(report, expected_species):
    issues = []
    det = report.get("detectedSpecies","")
    if det.lower() != expected_species.lower():
        issues.append(f"SPECIES MISMATCH: expected={expected_species}, got={det}")
    fs = report.get("formScore",0)
    ps = report.get("postureScore",0)
    bs = report.get("balanceScore",0)
    gr = report.get("grade","")
    if not (30 <= fs <= 100): issues.append(f"FORM SCORE RANGE: {fs}")
    if not (30 <= ps <= 100): issues.append(f"POSTURE SCORE RANGE: {ps}")
    if not (30 <= bs <= 100): issues.append(f"BALANCE SCORE RANGE: {bs}")
    expected_grade = grade_letter(fs)
    if gr != expected_grade:
        issues.append(f"GRADE MISMATCH: form={fs}, expected={expected_grade}, got={gr}")
    if not report.get("jointSummaries"):
        issues.append("NO JOINT SUMMARIES")
    if not report.get("jointAngles"):
        issues.append("NO JOINT ANGLES")
    bsi = report.get("bilateralSymmetryIndex",0)
    if not (50 <= bsi <= 100):
        issues.append(f"BSI OUT OF RANGE: {bsi}")
    if not report.get("exerciseCriteria"):
        issues.append("NO EXERCISE CRITERIA")
    if len(report.get("correctivePrescription","")) < 20:
        issues.append("CORRECTIVE PRESCRIPTION MISSING")
    return issues

print("="*65)
print("  ECOTRACK AI ACCURACY TEST")
print("="*65)

r = requests.get(f"{AI_BASE}/model-status", timeout=5)
ms = r.json()
bio = ms.get("real_biomechanics_model",{})
print(f"\nNN Model: loaded={bio.get('loaded')} | grade_acc={bio.get('grade_accuracy_pct')}% | samples={bio.get('training_samples')}")
print(f"Scoring:  {bio.get('scoring_mode')}")

overall_pass = 0
overall_fail = 0
results = {}

for (substr, exercise_id, expected_species) in TESTS:
    vpath = find_video(substr)
    if vpath is None:
        print(f"\nSKIP: No video matching '{substr[:40]}'")
        results[expected_species] = {"status":"SKIP"}
        continue

    print(f"\n{'─'*65}")
    print(f"[TEST] {expected_species.upper()} | {exercise_id}")
    print(f"  File: {vpath.name[:65]}")

    t0 = time.time()
    try:
        with open(vpath,"rb") as f:
            resp = requests.post(
                f"{AI_BASE}/process-video",
                files={"video":(vpath.name,f,"video/mp4")},
                data={"species":expected_species,"exercise_id":exercise_id,"user_id":"accuracy_test"},
                timeout=180,
            )
    except Exception as e:
        print(f"  ERROR: {e}")
        results[expected_species] = {"status":"ERROR"}
        overall_fail += 1
        continue

    elapsed = time.time() - t0
    if resp.status_code != 200:
        print(f"  HTTP {resp.status_code}: {resp.text[:200]}")
        results[expected_species] = {"status":"HTTP_ERROR"}
        overall_fail += 1
        continue

    data = resp.json()
    if not data.get("success"):
        print(f"  API ERROR: {data.get('error')}")
        results[expected_species] = {"status":"API_ERROR"}
        overall_fail += 1
        continue

    reports = data.get("reports",[])
    if not reports:
        print("  NO REPORTS RETURNED")
        results[expected_species] = {"status":"NO_REPORTS"}
        overall_fail += 1
        continue

    report = max(reports, key=lambda r: r.get("formScore",0))
    issues = check_report(report, expected_species)

    fs  = report.get("formScore",0)
    ps  = report.get("postureScore",0)
    bs  = report.get("balanceScore",0)
    gr  = report.get("grade","?")
    bsi = report.get("bilateralSymmetryIndex",0)
    reps = report.get("repsCompleted",0)
    jc  = len(report.get("jointSummaries",[]))
    vfp = report.get("validFramePercent",0)
    tip = (report.get("coachingTip","") or "")[:80]
    deficits = report.get("identifiedDeficits",[])

    print(f"  Elapsed: {elapsed:.1f}s | Valid frames: {vfp}%")
    print(f"  Form={fs} / Posture={ps} / Balance={bs} | Grade={gr}")
    print(f"  BSI={bsi}% | Reps={reps} | Joints tracked={jc}")
    print(f"  Coaching: {tip}")
    if deficits:
        print(f"  Deficits: {deficits[0][:70]}")

    jsumm = report.get("jointSummaries",[])
    if jsumm:
        print("  Joint ROM:")
        for js in jsumm:
            print(f"    {js.get('name','?'):38s} avg={js.get('avg',0):5.1f}' ROM={js.get('rom',0):5.1f}' [{js.get('status','?')}]")

    crit = report.get("exerciseCriteria",[])
    if crit:
        print("  Criteria:")
        for c in crit:
            sym = "OK" if c.get("status")=="Passed" else "!!"
            print(f"    [{sym}] {c.get('criterion','?')}: {c.get('detail','?')[:60]}")

    if issues:
        print(f"  ISSUES ({len(issues)}):")
        for iss in issues:
            print(f"    x {iss}")
        results[expected_species] = {"status":"FAIL","formScore":fs,"grade":gr,"bsi":bsi,"issues":issues}
        overall_fail += 1
    else:
        print("  ALL CHECKS PASSED")
        results[expected_species] = {"status":"PASS","formScore":fs,"grade":gr,"bsi":bsi}
        overall_pass += 1

print(f"\n{'='*65}")
print(f"  RESULT: {overall_pass} PASS / {overall_fail} FAIL")
print(f"{'='*65}")
for sp,res in results.items():
    s=res.get("status","?")
    sym="OK " if s=="PASS" else ("SKP" if s=="SKIP" else "FAIL")
    print(f"  [{sym}] {sp:10s} Grade={res.get('grade','-')} Form={res.get('formScore','-')}")

OUT=Path(r"C:\Users\DELL\EcoTrackApp\backend\models\accuracy_test_report.json")
with open(OUT,"w") as f:
    json.dump(results,f,indent=2)
print(f"\nReport: {OUT}")
