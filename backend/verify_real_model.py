"""
Quick end-to-end test of the real-data AI model:
1. Loads the trained model + scaler
2. Extracts keypoints from one real video frame
3. Runs real NN inference and prints results
4. Also calls the Flask /model-status endpoint directly
"""
import sys, json, os, pickle, time
import numpy as np
sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, 'models')

print("=" * 60)
print("  REAL MODEL END-TO-END VERIFICATION")
print("=" * 60)

# ── Step 1: Load scaler + model ──────────────────────────────
import torch
import torch.nn as nn

print("\n[1] Loading real-data model + scaler...")
scaler_path = os.path.join(MODELS_DIR, 'scaler.pkl')
pt_path     = os.path.join(MODELS_DIR, 'aiscanner_model_best.pt')
report_path = os.path.join(MODELS_DIR, 'real_training_report.json')

assert os.path.exists(pt_path),     f"MISSING: {pt_path}"
assert os.path.exists(scaler_path), f"MISSING: {scaler_path}"
assert os.path.exists(report_path), f"MISSING: {report_path}"

with open(scaler_path, 'rb') as f:
    scaler = pickle.load(f)

with open(report_path, 'r', encoding='utf-8') as f:
    report = json.load(f)

input_dim    = len(scaler.mean_)
species_list = report.get('supported_species', [])
exercise_list= report.get('supported_exercises', [])
tp = report.get('training_pipeline', {})
m  = report.get('metrics', {})

print(f"  ✅ Scaler loaded (input_dim={input_dim})")
print(f"  ✅ Report loaded")
print(f"     Data source : {report.get('data_source','?')}")
print(f"     Samples     : {tp.get('total_real_samples','?')} real video frames")
print(f"     Grade acc   : {m.get('biomechanics_grade_accuracy','?')}%")
print(f"     Species acc : {m.get('species_classification_accuracy','?')}%")
print(f"     Species     : {species_list}")
print(f"     Exercises   : {exercise_list}")

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

net = AIScannerBiomechanicsNet(input_dim, n_grades=5)
state = torch.load(pt_path, weights_only=False)
net.load_state_dict(state)
net.eval()
print(f"  ✅ Model loaded from {os.path.basename(pt_path)}")

# ── Step 2: Real frame keypoint extraction test ───────────────
import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

print("\n[2] Extracting real keypoints from push-up video...")
VIDEO_PATH = os.path.join(BASE_DIR, '..', 'EcoTrack AppVideo',
                          'vidssave.com How to do a Push-Up _ Proper Form & Technique _ NASM 1080P.mp4')
VIDEO_PATH = os.path.normpath(VIDEO_PATH)

assert os.path.exists(VIDEO_PATH), f"Video not found: {VIDEO_PATH}"

task_path = os.path.join(MODELS_DIR, 'pose_landmarker_full.task')
base_options = mp_python.BaseOptions(model_asset_path=task_path)
pose_options = mp_vision.PoseLandmarkerOptions(
    base_options=base_options,
    running_mode=mp_vision.RunningMode.IMAGE,
    num_poses=1,
    min_pose_detection_confidence=0.4,
)
pose_model = mp_vision.PoseLandmarker.create_from_options(pose_options)

cap = cv2.VideoCapture(VIDEO_PATH)
frame_samples = []
frame_idx = 0
fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
step = max(1, int(fps * 0.5))

while cap.isOpened() and len(frame_samples) < 5:
    ret, frame = cap.read()
    if not ret:
        break
    if frame_idx % step == 0:
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = pose_model.detect(mp_img)
        if result.pose_landmarks and len(result.pose_landmarks) > 0:
            lms = result.pose_landmarks[0]
            def kp(idx):
                lm = lms[idx]
                v = getattr(lm, 'visibility', 1.0)
                if v is not None and v < 0.25:
                    return None
                return (lm.x * frame.shape[1], lm.y * frame.shape[0])
            def angle_at(a, b, c):
                if a is None or b is None or c is None:
                    return 90.0
                ba = np.array(a) - np.array(b)
                bc = np.array(c) - np.array(b)
                n1, n2 = np.linalg.norm(ba), np.linalg.norm(bc)
                if n1 < 1e-6 or n2 < 1e-6:
                    return 90.0
                return float(np.degrees(np.arccos(np.clip(np.dot(ba, bc)/(n1*n2), -1, 1))))

            ls = kp(11); rs = kp(12); le = kp(13); re = kp(14)
            lw = kp(15); rw = kp(16); lh = kp(23); rh = kp(24)
            lk = kp(25); rk = kp(26); la = kp(27); ra = kp(28)

            ang_vec = [
                angle_at(ls, le, lw) / 180.0,
                angle_at(rs, re, rw) / 180.0,
                angle_at(lh, lk, la) / 180.0,
                angle_at(rh, rk, ra) / 180.0,
                angle_at(ls, lh, lk) / 180.0,
                angle_at(rs, rh, rk) / 180.0,
                angle_at(le, ls, lh) / 180.0,
                angle_at(re, rs, rh) / 180.0,
            ]
            frame_samples.append(ang_vec)
            print(f"  Frame {frame_idx}: angles={[round(a*180,1) for a in ang_vec[:4]]}°")
    frame_idx += 1

cap.release()
print(f"  ✅ Extracted {len(frame_samples)} frames with real pose keypoints")

# ── Step 3: Run real NN inference ────────────────────────────
print("\n[3] Running real NN inference on extracted frames...")
GRADE_MAP = {0: 'A', 1: 'B', 2: 'C', 3: 'D', 4: 'F'}

for i, ang_vec in enumerate(frame_samples):
    # Build feature: angles + species one-hot + exercise one-hot + vis
    sp_oh = [1.0 if s == 'human' else 0.0 for s in species_list]
    ex_oh = [1.0 if e == 'human_pushup' else 0.0 for e in exercise_list]
    feat  = ang_vec + sp_oh + ex_oh + [0.8]  # 0.8 = typical visibility

    feat_arr    = np.array(feat, dtype=np.float32).reshape(1, -1)
    feat_scaled = scaler.transform(feat_arr)
    feat_t      = torch.tensor(feat_scaled, dtype=torch.float32)

    with torch.no_grad():
        pred_sc, pred_gr = net(feat_t)

    form_score    = float(pred_sc[0][0].item())
    posture_score = float(pred_sc[0][1].item())
    balance_score = float(pred_sc[0][2].item())
    grade_idx     = int(pred_gr[0].argmax().item())
    grade         = GRADE_MAP[grade_idx]

    print(f"  Frame {i+1}: Form={form_score:.1f} | Posture={posture_score:.1f} | Balance={balance_score:.1f} | Grade={grade}")

# ── Step 4: Test Flask /model-status via HTTP ─────────────────
print("\n[4] Testing Flask API (port 5001 direct)...")
try:
    import urllib.request
    url = 'http://127.0.0.1:5001/model-status'
    with urllib.request.urlopen(url, timeout=5) as resp:
        data = json.loads(resp.read())
    rb = data.get('real_biomechanics_model', {})
    print(f"  Flask /model-status: OK")
    print(f"  real_model_loaded : {rb.get('loaded')}")
    print(f"  grade_accuracy    : {rb.get('grade_accuracy_pct')}%")
    print(f"  species_accuracy  : {rb.get('species_accuracy_pct')}%")
    print(f"  scoring_mode      : {rb.get('scoring_mode')}")
    print(f"  overall_ready     : {data.get('overall_ready')}")
except Exception as e:
    print(f"  Flask direct call failed: {e}")

try:
    url2 = 'http://127.0.0.1:5000/api/ai/model-status'
    with urllib.request.urlopen(url2, timeout=5) as resp:
        data2 = json.loads(resp.read())
    rb2 = data2.get('real_biomechanics_model', {})
    print(f"\n  Node proxy /api/ai/model-status: OK")
    print(f"  real_model_loaded : {rb2.get('loaded')}")
    print(f"  overall_ready     : {data2.get('overall_ready')}")
except Exception as e:
    print(f"  Node proxy call failed: {e}")

print("\n" + "=" * 60)
print("  VERIFICATION COMPLETE")
print("=" * 60)
