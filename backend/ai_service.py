"""
EcoTrack AI Service — Production CV Backend
=============================================
Endpoints:
  POST /detect         — YOLOv8 species detection
  POST /pose           — Pose estimation (MediaPipe for humans, RTMPose/YOLOv8 for animals)
  POST /process-video  — Frame-by-frame video analysis
  GET  /model-status   — Which models are loaded and ready
  POST /scan-save      — Persist scan to SQLite
  GET  /scan-history   — Retrieve user scan history

Animal Pose: Uses RTMPose-M (AP-10K pretrained, 17-keypoint schema) when available.
             Falls back to YOLOv8m-pose with AP-10K joint remapping.
             Never generates fake keypoints. Reports model status honestly.
"""

import os, json, base64, time, uuid, sqlite3
from pathlib import Path
from datetime import datetime
import numpy as np
import cv2
from flask import Flask, request, jsonify
from flask_cors import CORS
import mediapipe as mp
from ultralytics import YOLO

app = Flask(__name__)
CORS(app)

# ─────────────────────────────────────────────────────────────────────────────
# Directories & Paths
# ─────────────────────────────────────────────────────────────────────────────
BASE_DIR   = Path(__file__).parent
MODELS_DIR = BASE_DIR / "models"
DB_PATH    = BASE_DIR / "ecotrack_scans.db"

# ─────────────────────────────────────────────────────────────────────────────
# SQLite Scan History Database
# ─────────────────────────────────────────────────────────────────────────────
def init_scan_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS scans (
            scan_id          TEXT PRIMARY KEY,
            user_id          TEXT NOT NULL,
            species          TEXT,
            breed            TEXT,
            exercise         TEXT,
            exercise_id      TEXT,
            scan_timestamp   TEXT,
            detection_conf   REAL,
            pose_conf        REAL,
            form_score       REAL,
            posture_score    REAL,
            balance_score    REAL,
            rep_count        INTEGER,
            grade            TEXT,
            joint_angles     TEXT,
            keypoints        TEXT,
            biomechanics     TEXT,
            feedback         TEXT,
            media_ref        TEXT,
            trainer_synced   INTEGER DEFAULT 0,
            scanner_version  TEXT,
            analysis_source  TEXT,
            created_at       TEXT
        )
    """)
    conn.commit()
    conn.close()

init_scan_db()

# ─────────────────────────────────────────────────────────────────────────────
# AP-10K 17-Keypoint Schema
# ─────────────────────────────────────────────────────────────────────────────
AP10K_KEYPOINT_NAMES = [
    "L_Eye", "R_Eye", "Nose", "Neck", "root_of_tail",
    "L_Shoulder", "L_Elbow", "L_F_Paw",
    "R_Shoulder", "R_Elbow", "R_F_Paw",
    "L_Hip", "L_Knee", "L_B_Paw",
    "R_Hip", "R_Knee", "R_B_Paw"
]

# Species-specific joint name overrides (cosmetic labeling only)
SPECIES_JOINT_LABELS = {
    "horse": {
        "L_Eye": "L_Eye", "R_Eye": "R_Eye", "Nose": "Poll",
        "Neck": "Withers", "root_of_tail": "Croup",
        "L_Shoulder": "L_Shoulder", "L_Elbow": "L_Elbow",
        "L_F_Paw": "L_Fore_Hoof", "R_Shoulder": "R_Shoulder",
        "R_Elbow": "R_Elbow", "R_F_Paw": "R_Fore_Hoof",
        "L_Hip": "L_Hip", "L_Knee": "L_Stifle",
        "L_B_Paw": "L_Hind_Hoof", "R_Hip": "R_Hip",
        "R_Knee": "R_Stifle", "R_B_Paw": "R_Hind_Hoof"
    },
    "dog": {
        "L_Eye": "L_Eye", "R_Eye": "R_Eye", "Nose": "Nose",
        "Neck": "Withers", "root_of_tail": "Tail_Root",
        "L_F_Paw": "L_Fore_Paw", "R_F_Paw": "R_Fore_Paw",
        "L_B_Paw": "L_Hind_Paw", "R_B_Paw": "R_Hind_Paw",
        "L_Elbow": "L_Elbow", "R_Elbow": "R_Elbow",
        "L_Knee": "L_Stifle", "R_Knee": "R_Stifle",
        "L_Hip": "L_Hip", "R_Hip": "R_Hip",
        "L_Shoulder": "L_Shoulder", "R_Shoulder": "R_Shoulder"
    },
    "cat": {
        "L_Eye": "L_Eye", "R_Eye": "R_Eye", "Nose": "Nose",
        "Neck": "Neck", "root_of_tail": "Tail_Base",
        "L_F_Paw": "L_Fore_Paw", "R_F_Paw": "R_Fore_Paw",
        "L_B_Paw": "L_Hind_Paw", "R_B_Paw": "R_Hind_Paw",
        "L_Elbow": "L_Elbow", "R_Elbow": "R_Elbow",
        "L_Knee": "L_Knee", "R_Knee": "R_Knee",
        "L_Hip": "L_Hip", "R_Hip": "R_Hip",
        "L_Shoulder": "L_Shoulder", "R_Shoulder": "R_Shoulder"
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# Species → COCO-80 class mapping (for YOLOv8 detector)
# ─────────────────────────────────────────────────────────────────────────────
SPECIES_TO_COCO = {
    'human': 'person', 'person': 'person', 'man': 'person',
    'woman': 'person', 'child': 'person', 'boy': 'person', 'girl': 'person',
    'dog': 'dog', 'puppy': 'dog', 'canine': 'dog',
    'wolf': 'dog', 'coyote': 'dog', 'husky': 'dog',
    'cat': 'cat', 'kitten': 'cat', 'feline': 'cat',
    'lion': 'cat', 'tiger': 'cat', 'cheetah': 'cat', 'leopard': 'cat',
    'horse': 'horse', 'pony': 'horse', 'foal': 'horse', 'stallion': 'horse',
    'donkey': 'horse', 'mule': 'horse',
    'cow': 'cow', 'bull': 'cow', 'calf': 'cow', 'cattle': 'cow',
    'buffalo': 'cow', 'bison': 'cow',
    'sheep': 'sheep', 'lamb': 'sheep', 'goat': 'sheep',
    'bird': 'bird', 'eagle': 'bird', 'parrot': 'bird', 'owl': 'bird',
    'flamingo': 'bird', 'penguin': 'bird', 'peacock': 'bird',
    'elephant': 'elephant',
    'bear': 'bear', 'panda': 'bear',
    'zebra': 'zebra',
    'giraffe': 'giraffe',
    'rabbit': 'dog',
    'monkey': 'person', 'gorilla': 'person', 'chimpanzee': 'person',
    'crocodile': 'dog', 'lizard': 'dog', 'snake': 'dog',
    'deer': 'horse',
    'camel': 'horse',
    'kangaroo': 'horse',
}

# ─────────────────────────────────────────────────────────────────────────────
# Model Loading
# ─────────────────────────────────────────────────────────────────────────────
MODEL_STATUS = {
    "yolov8_detector":    {"loaded": False, "path": None, "error": None},
    "yolov8_pose":        {"loaded": False, "path": None, "error": None},
    "mediapipe_pose":     {"loaded": False, "path": None, "error": None},
    "rtmpose_animal":     {"loaded": False, "path": None, "error": None},
    "animal_pose_finetuned": {"loaded": False, "path": None, "error": None},
}

# Load YOLOv8 Detector
print("[INIT] Loading YOLOv8 detector (yolov8n.pt)...")
try:
    yolo_det_path = BASE_DIR.parent / "yolov8n.pt"
    if not yolo_det_path.exists():
        yolo_det_path = "yolov8n.pt"
    yolo_det = YOLO(str(yolo_det_path))
    MODEL_STATUS["yolov8_detector"]["loaded"] = True
    MODEL_STATUS["yolov8_detector"]["path"]   = str(yolo_det_path)
    print(f"[INIT] YOLOv8 detector loaded: {yolo_det_path}")
except Exception as e:
    yolo_det = None
    MODEL_STATUS["yolov8_detector"]["error"] = str(e)
    print(f"[INIT] ERROR loading detector: {e}")

# Load YOLOv8 Pose (human + general animals)
print("[INIT] Loading YOLOv8 pose model...")
try:
    yolo_pose_path = MODELS_DIR / "yolov8m-pose.pt"
    if not yolo_pose_path.exists():
        yolo_pose_path = MODELS_DIR / "yolov8n-pose.pt"
    if yolo_pose_path.exists():
        yolo_pose = YOLO(str(yolo_pose_path))
        MODEL_STATUS["yolov8_pose"]["loaded"] = True
        MODEL_STATUS["yolov8_pose"]["path"]   = str(yolo_pose_path)
        print(f"[INIT] YOLOv8 pose loaded: {yolo_pose_path}")
    else:
        raise FileNotFoundError(f"No yolov8*-pose.pt found in {MODELS_DIR}")
except Exception as e:
    yolo_pose = None
    MODEL_STATUS["yolov8_pose"]["error"] = str(e)
    print(f"[INIT] ERROR loading pose model: {e}")

# Load Fine-tuned Animal Pose (if available — produced by train_animal_pose.py)
print("[INIT] Checking for fine-tuned animal pose model...")
animal_pose_model = None
for candidate in ["animal_pose_v1.pt", "animal_pose_best.pt"]:
    path = MODELS_DIR / candidate
    if path.exists():
        try:
            animal_pose_model = YOLO(str(path))
            MODEL_STATUS["animal_pose_finetuned"]["loaded"] = True
            MODEL_STATUS["animal_pose_finetuned"]["path"]   = str(path)
            print(f"[INIT] Fine-tuned animal pose model loaded: {path}")
            break
        except Exception as e:
            MODEL_STATUS["animal_pose_finetuned"]["error"] = str(e)
            print(f"[INIT] Could not load {path}: {e}")

if not animal_pose_model:
    print("[INIT] No fine-tuned animal pose model found. Using yolov8m-pose with AP10K keypoint remapping.")
    print("[INIT] Run: python train_animal_pose.py --phase all (to train the animal-specific model)")

# Load RTMPose checkpoint (if MMPose is installed)
rtmpose_inferencer = None
print("[INIT] Checking for RTMPose animal checkpoint...")
rtmpose_ckpt = MODELS_DIR / "rtmpose-m_ap10k.pth"
if rtmpose_ckpt.exists():
    try:
        from mmpose.apis import MMPoseInferencer
        rtmpose_inferencer = MMPoseInferencer(
            pose2d='animal',
            pose2d_weights=str(rtmpose_ckpt),
            device='cuda:0' if _has_gpu_static() else 'cpu'
        )
        MODEL_STATUS["rtmpose_animal"]["loaded"] = True
        MODEL_STATUS["rtmpose_animal"]["path"]   = str(rtmpose_ckpt)
        print(f"[INIT] RTMPose-M animal model loaded: {rtmpose_ckpt}")
    except Exception as e:
        MODEL_STATUS["rtmpose_animal"]["error"] = str(e)
        print(f"[INIT] RTMPose not available (mmpose not installed or config error): {e}")
else:
    MODEL_STATUS["rtmpose_animal"]["error"] = f"Checkpoint not found: {rtmpose_ckpt}. Run: python train_animal_pose.py --phase download"
    print(f"[INIT] RTMPose checkpoint not found at {rtmpose_ckpt}")

# Load MediaPipe Pose Landmarker (for humans)
print("[INIT] Loading MediaPipe Pose Landmarker...")
pose_estimator = None
try:
    from mediapipe.tasks import python
    from mediapipe.tasks.python import vision

    for task_name in ["pose_landmarker_full.task", "pose_landmarker_heavy.task", "pose_landmarker_lite.task"]:
        task_path = MODELS_DIR / task_name
        if task_path.exists():
            base_options = python.BaseOptions(model_asset_path=str(task_path))
            options = vision.PoseLandmarkerOptions(
                base_options=base_options,
                output_segmentation_masks=False
            )
            pose_estimator = vision.PoseLandmarker.create_from_options(options)
            MODEL_STATUS["mediapipe_pose"]["loaded"] = True
            MODEL_STATUS["mediapipe_pose"]["path"]   = str(task_path)
            print(f"[INIT] MediaPipe Pose loaded: {task_path}")
            break

    if not pose_estimator:
        MODEL_STATUS["mediapipe_pose"]["error"] = "No pose_landmarker_*.task file found in models/"
        print(f"[INIT] MediaPipe task file not found in {MODELS_DIR}")

except Exception as e:
    MODEL_STATUS["mediapipe_pose"]["error"] = str(e)
    print(f"[INIT] MediaPipe Pose error: {e}")

def _has_gpu_static():
    try:
        import torch
        return torch.cuda.is_available()
    except ImportError:
        return False

# Bounding box tracker (EMA smoothing)
tracker_box = None

def track_bounding_box(new_box):
    global tracker_box
    if new_box is None:
        tracker_box = None
        return None

    if tracker_box is None:
        tracker_box = new_box
        return tracker_box

    x1, y1, w1, h1 = new_box['x'], new_box['y'], new_box['width'], new_box['height']
    x2, y2, w2, h2 = tracker_box['x'], tracker_box['y'], tracker_box['width'], tracker_box['height']

    c1_x, c1_y = x1 + w1/2, y1 + h1/2
    c2_x, c2_y = x2 + w2/2, y2 + h2/2
    dist = np.sqrt((c1_x - c2_x)**2 + (c1_y - c2_y)**2)

    if dist < 150:
        alpha = 0.35
        smoothed = {
            'x': int(alpha * x1 + (1 - alpha) * x2),
            'y': int(alpha * y1 + (1 - alpha) * y2),
            'width':  int(alpha * w1 + (1 - alpha) * w2),
            'height': int(alpha * h1 + (1 - alpha) * h2),
        }
        tracker_box = smoothed
        return smoothed
    else:
        tracker_box = new_box
        return new_box

# ─────────────────────────────────────────────────────────────────────────────
# Image decoding
# ─────────────────────────────────────────────────────────────────────────────
def decode_base64_image(image_base64: str):
    try:
        if ',' in image_base64:
            image_base64 = image_base64.split(',')[1]
        img_bytes = base64.b64decode(image_base64)
        np_arr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        return img
    except Exception as e:
        print(f"[ERROR] Image decode failed: {e}")
        return None

# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/model-status', methods=['GET'])
def model_status():
    """Report which models are loaded and ready."""
    overall_ready = (
        MODEL_STATUS["yolov8_detector"]["loaded"] and
        MODEL_STATUS["yolov8_pose"]["loaded"]
    )
    return jsonify({
        "overall_ready": overall_ready,
        "models": MODEL_STATUS,
        "animal_pose_capability": {
            "rtmpose_available": MODEL_STATUS["rtmpose_animal"]["loaded"],
            "finetuned_available": MODEL_STATUS["animal_pose_finetuned"]["loaded"],
            "fallback_available": MODEL_STATUS["yolov8_pose"]["loaded"],
            "keypoint_schema": "AP-10K 17-point",
            "keypoint_names": AP10K_KEYPOINT_NAMES,
            "species_count": 54,
        },
        "human_pose_capability": {
            "mediapipe_available": MODEL_STATUS["mediapipe_pose"]["loaded"],
            "yolo_fallback": MODEL_STATUS["yolov8_pose"]["loaded"],
            "keypoint_schema": "COCO 17-point",
        }
    })


@app.route('/detect', methods=['POST'])
def detect():
    """Species detection using YOLOv8."""
    if not MODEL_STATUS["yolov8_detector"]["loaded"]:
        return jsonify({
            "error": "Species detection model not loaded",
            "modelAvailable": False,
            "missingModel": "yolov8_detector",
            "action": "Ensure yolov8n.pt is present and restart the service"
        }), 503

    data = request.get_json()
    if not data or 'image_base64' not in data:
        return jsonify({'error': 'image_base64 required'}), 400

    target_class = data.get('target_class', '').lower().strip()
    img = decode_base64_image(data['image_base64'])
    if img is None:
        return jsonify({'error': 'Invalid image data'}), 400

    h, w = img.shape[:2]
    results = yolo_det(img, verbose=False)[0]

    detections = []
    best_target = None
    best_target_score = 0.0

    mapped_target = SPECIES_TO_COCO.get(target_class, target_class)

    for box in results.boxes:
        cls_id   = int(box.cls[0].item())
        cls_name = results.names[cls_id].lower()
        conf     = float(box.conf[0].item())

        detections.append({'className': cls_name, 'confidence': int(conf * 100)})

        if cls_name == target_class or cls_name == mapped_target:
            if conf > best_target_score:
                best_target_score = conf
                xyxy = box.xyxy[0].tolist()
                best_target = {
                    'detected':   True,
                    'className':  cls_name,
                    'confidence': int(conf * 100),
                    'boundingBox': {
                        'x':      int(xyxy[0]),
                        'y':      int(xyxy[1]),
                        'width':  int(xyxy[2] - xyxy[0]),
                        'height': int(xyxy[3] - xyxy[1]),
                    }
                }

    detections = sorted(detections, key=lambda x: x['confidence'], reverse=True)[:8]

    if best_target and best_target_score >= 0.30:
        best_target['boundingBox'] = track_bounding_box(best_target['boundingBox'])
        best_target['allDetections'] = detections
        best_target['modelAvailable'] = True
        best_target['imageWidth']  = w
        best_target['imageHeight'] = h
        return jsonify(best_target)

    return jsonify({
        'detected':      False,
        'className':     '',
        'confidence':    0,
        'boundingBox':   None,
        'allDetections': detections,
        'modelAvailable': True,
        'imageWidth':    w,
        'imageHeight':   h,
        'halted':        True,
        'haltReason':    f"Target species '{target_class}' not found in frame",
    })


@app.route('/pose', methods=['POST'])
def pose():
    """
    Pose estimation endpoint.
    - Human:  MediaPipe PoseLandmarker (33 joints) with YOLOv8 fallback
    - Animal: Fine-tuned animal pose model → RTMPose → YOLOv8m-pose with AP-10K remapping
    Returns AP-10K 17-keypoint schema for all animals.
    """
    data = request.get_json()
    if not data or 'image_base64' not in data:
        return jsonify({'error': 'image_base64 required'}), 400

    species     = data.get('species', 'human').lower().strip()
    bounding_box = data.get('bounding_box', None)

    img = decode_base64_image(data['image_base64'])
    if img is None:
        return jsonify({'error': 'Invalid image data'}), 400

    img_h, img_w = img.shape[:2]
    keypoints = []
    pose_source = None
    pose_conf = 0.0

    # Crop to bounding box region
    if bounding_box:
        bx = max(0, int(bounding_box['x']))
        by = max(0, int(bounding_box['y']))
        bw = min(img_w - bx, int(bounding_box['width']))
        bh = min(img_h - by, int(bounding_box['height']))
        crop_img = img[by:by+bh, bx:bx+bw]
        offset_x, offset_y = bx, by
    else:
        crop_img = img
        offset_x, offset_y = 0, 0
        bw, bh = img_w, img_h

    if crop_img.size == 0:
        return jsonify({'success': False, 'error': 'Empty crop region', 'keypoints': []})

    is_human = species in ('human', 'person', 'man', 'woman', 'child', 'boy', 'girl')

    # ── HUMAN: MediaPipe PoseLandmarker ──────────────────────────────────────
    if is_human:
        if pose_estimator:
            try:
                rgb_img  = cv2.cvtColor(crop_img, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_img)
                results  = pose_estimator.detect(mp_image)

                if results.pose_landmarks and len(results.pose_landmarks) > 0:
                    landmarks = results.pose_landmarks[0]
                    # MediaPipe BlazePose 33-landmark → COCO-17 subset
                    MEDIAPIPE_TO_COCO = {
                        'nose':           0,  'left_eye':      2,  'right_eye':     5,
                        'left_ear':       7,  'right_ear':     8,
                        'left_shoulder': 11,  'right_shoulder':12,
                        'left_elbow':    13,  'right_elbow':   14,
                        'left_wrist':    15,  'right_wrist':   16,
                        'left_hip':      23,  'right_hip':     24,
                        'left_knee':     25,  'right_knee':    26,
                        'left_ankle':    27,  'right_ankle':   28,
                    }
                    for name, idx in MEDIAPIPE_TO_COCO.items():
                        lm = landmarks[idx]
                        keypoints.append({
                            'name':       name,
                            'x':          float(lm.x),
                            'y':          float(lm.y),
                            'visibility': float(lm.visibility),
                        })
                    pose_source = 'mediapipe_blazepose'
                    pose_conf   = float(np.mean([lm.visibility for lm in landmarks]))
            except Exception as e:
                print(f"[WARN] MediaPipe pose failed: {e}")

        # Fallback: YOLOv8 pose for humans
        if not keypoints and yolo_pose:
            try:
                results = yolo_pose(crop_img, verbose=False)[0]
                if len(results.keypoints) > 0:
                    kps = results.keypoints[0].data[0].tolist()
                    COCO_NAMES = [
                        'nose','left_eye','right_eye','left_ear','right_ear',
                        'left_shoulder','right_shoulder','left_elbow','right_elbow',
                        'left_wrist','right_wrist','left_hip','right_hip',
                        'left_knee','right_knee','left_ankle','right_ankle'
                    ]
                    for idx, kp in enumerate(kps[:17]):
                        kx, ky, conf = kp
                        keypoints.append({
                            'name':       COCO_NAMES[idx],
                            'x':          float(kx / bw) if bw > 0 else 0.0,
                            'y':          float(ky / bh) if bh > 0 else 0.0,
                            'visibility': float(conf),
                        })
                    pose_source = 'yolov8_pose_fallback'
                    pose_conf   = float(np.mean([kp[2] for kp in kps[:17]]))
            except Exception as e:
                print(f"[WARN] YOLOv8 human pose failed: {e}")

    # ── ANIMAL: Fine-tuned → RTMPose → YOLOv8 fallback ──────────────────────
    else:
        # Priority 1: Fine-tuned animal pose model (from train_animal_pose.py)
        if animal_pose_model and not keypoints:
            try:
                results = animal_pose_model(crop_img, verbose=False)[0]
                if len(results.keypoints) > 0:
                    kps = results.keypoints[0].data[0].tolist()
                    species_labels = SPECIES_JOINT_LABELS.get(species, {})
                    for idx, kp in enumerate(kps[:17]):
                        kx, ky, conf = kp
                        raw_name   = AP10K_KEYPOINT_NAMES[idx] if idx < len(AP10K_KEYPOINT_NAMES) else f"kp_{idx}"
                        label_name = species_labels.get(raw_name, raw_name)
                        keypoints.append({
                            'name':       label_name,
                            'x':          float(kx / bw) if bw > 0 else 0.0,
                            'y':          float(ky / bh) if bh > 0 else 0.0,
                            'visibility': float(conf),
                            'ap10k_idx':  idx,
                        })
                    pose_source = 'animal_pose_finetuned'
                    pose_conf   = float(np.mean([kp[2] for kp in kps[:17]]))
            except Exception as e:
                print(f"[WARN] Fine-tuned animal pose failed: {e}")

        # Priority 2: RTMPose (mmpose)
        if rtmpose_inferencer and not keypoints:
            try:
                result_gen   = rtmpose_inferencer(crop_img)
                result       = next(result_gen)
                predictions  = result['predictions'][0][0]
                kpts         = predictions['keypoints']
                scores       = predictions['keypoint_scores']
                species_labels = SPECIES_JOINT_LABELS.get(species, {})
                for idx, (kpt, score) in enumerate(zip(kpts[:17], scores[:17])):
                    raw_name   = AP10K_KEYPOINT_NAMES[idx] if idx < len(AP10K_KEYPOINT_NAMES) else f"kp_{idx}"
                    label_name = species_labels.get(raw_name, raw_name)
                    keypoints.append({
                        'name':       label_name,
                        'x':          float(kpt[0] / bw) if bw > 0 else 0.0,
                        'y':          float(kpt[1] / bh) if bh > 0 else 0.0,
                        'visibility': float(score),
                        'ap10k_idx':  idx,
                    })
                pose_source = 'rtmpose_ap10k'
                pose_conf   = float(np.mean(scores[:17]))
            except Exception as e:
                print(f"[WARN] RTMPose inference failed: {e}")

        # Priority 3: YOLOv8m-pose with AP-10K keypoint remapping
        if yolo_pose and not keypoints:
            try:
                results = yolo_pose(crop_img, verbose=False)[0]
                if len(results.keypoints) > 0:
                    kps = results.keypoints[0].data[0].tolist()
                    # YOLOv8 COCO 17-keypoint → AP-10K 17-keypoint remapping
                    # (approximate anatomical mapping for animals)
                    YOLO_TO_AP10K = {
                        0:  (2,  "Nose"),        # nose    → Nose
                        1:  (0,  "L_Eye"),       # left_eye → L_Eye
                        2:  (1,  "R_Eye"),       # right_eye → R_Eye
                        5:  (5,  "L_Shoulder"),  # left_shoulder → L_Shoulder
                        6:  (8,  "R_Shoulder"),  # right_shoulder → R_Shoulder
                        7:  (6,  "L_Elbow"),     # left_elbow → L_Elbow
                        8:  (9,  "R_Elbow"),     # right_elbow → R_Elbow
                        9:  (7,  "L_F_Paw"),     # left_wrist → L_F_Paw
                        10: (10, "R_F_Paw"),     # right_wrist → R_F_Paw
                        11: (11, "L_Hip"),       # left_hip → L_Hip
                        12: (14, "R_Hip"),       # right_hip → R_Hip
                        13: (12, "L_Knee"),      # left_knee → L_Knee
                        14: (15, "R_Knee"),      # right_knee → R_Knee
                        15: (13, "L_B_Paw"),     # left_ankle → L_B_Paw
                        16: (16, "R_B_Paw"),     # right_ankle → R_B_Paw
                    }
                    species_labels = SPECIES_JOINT_LABELS.get(species, {})
                    produced_ap10k = set()
                    for yolo_idx, (ap10k_idx, ap10k_name) in YOLO_TO_AP10K.items():
                        if yolo_idx >= len(kps):
                            continue
                        if ap10k_idx in produced_ap10k:
                            continue
                        kx, ky, conf = kps[yolo_idx]
                        raw_name   = ap10k_name
                        label_name = species_labels.get(raw_name, raw_name)
                        keypoints.append({
                            'name':       label_name,
                            'x':          float(kx / bw) if bw > 0 else 0.0,
                            'y':          float(ky / bh) if bh > 0 else 0.0,
                            'visibility': float(conf),
                            'ap10k_idx':  ap10k_idx,
                        })
                        produced_ap10k.add(ap10k_idx)

                    pose_source = 'yolov8_ap10k_remap'
                    pose_conf   = float(np.mean([kp[2] for kp in kps[:17]]))
            except Exception as e:
                print(f"[WARN] YOLOv8 animal fallback pose failed: {e}")

    success = len(keypoints) > 0

    # Normalize body box to 0-1 relative coords
    body_box = None
    if bounding_box and img_w > 0 and img_h > 0:
        body_box = {
            'x':      bounding_box['x'] / img_w,
            'y':      bounding_box['y'] / img_h,
            'width':  bounding_box['width'] / img_w,
            'height': bounding_box['height'] / img_h,
        }

    return jsonify({
        'success':      success,
        'keypoints':    keypoints,
        'bodyBox':      body_box,
        'poseSource':   pose_source,
        'poseConf':     round(pose_conf, 3),
        'keypoint_schema': 'ap10k_17' if not is_human else 'coco_17',
        'is_human':     is_human,
        'species':      species,
        'model_used':   pose_source,
        'animal_pose_model_available': (
            MODEL_STATUS["animal_pose_finetuned"]["loaded"] or
            MODEL_STATUS["rtmpose_animal"]["loaded"]
        ),
    })


@app.route('/process-video', methods=['POST'])
def process_video():
    """Frame-by-frame video analysis."""
    import tempfile

    data = request.get_json()
    if not data or 'video_base64' not in data:
        return jsonify({'error': 'video_base64 required'}), 400

    species     = data.get('species', 'human').lower()
    exercise_id = data.get('exercise_id', '')
    is_human    = species in ('human', 'person')

    video_base64 = data['video_base64']
    if ',' in video_base64:
        video_base64 = video_base64.split(',')[1]

    try:
        video_bytes = base64.b64decode(video_base64)
    except Exception:
        return jsonify({'error': 'Invalid video base64 data'}), 400

    with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as tmp:
        tmp.write(video_bytes)
        temp_path = tmp.name

    try:
        cap = cv2.VideoCapture(temp_path)
        if not cap.isOpened():
            return jsonify({'error': 'Could not open video file'}), 400

        fps            = cap.get(cv2.CAP_PROP_FPS) or 30.0
        downsample     = max(1, int(fps / 7.5))
        mapped_target  = SPECIES_TO_COCO.get(species, species)
        frames_data    = []
        frame_idx      = 0

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % downsample == 0:
                fh, fw = frame.shape[:2]
                
                # Standardize frame size to maximum 640px for rapid, resolution-invariant inference
                max_dim = 640
                scale = 1.0
                if max(fh, fw) > max_dim:
                    scale = max_dim / max(fh, fw)
                    infer_frame = cv2.resize(frame, (int(fw * scale), int(fh * scale)))
                else:
                    infer_frame = frame

                best_box  = None
                best_conf = 0.0

                if yolo_det:
                    det_results = yolo_det(infer_frame, verbose=False)[0]
                    for box in det_results.boxes:
                        cls_id   = int(box.cls[0].item())
                        cls_name = det_results.names[cls_id].lower()
                        conf     = float(box.conf[0].item())
                        if (cls_name == species or cls_name == mapped_target) and conf > best_conf:
                            best_conf = conf
                            xyxy = box.xyxy[0].tolist()
                            best_box = {
                                'x': int(xyxy[0] / scale), 'y': int(xyxy[1] / scale),
                                'width': int((xyxy[2] - xyxy[0]) / scale),
                                'height': int((xyxy[3] - xyxy[1]) / scale),
                            }

                if best_box and best_conf >= 0.30:
                    best_box = track_bounding_box(best_box)
                    bx = max(0, best_box['x'])
                    by = max(0, best_box['y'])
                    bw_c = min(fw - bx, best_box['width'])
                    bh_c = min(fh - by, best_box['height'])
                    crop = frame[by:by+bh_c, bx:bx+bw_c]

                    keypoints = []
                    pose_src  = None

                    if is_human:
                        if pose_estimator and crop.size > 0:
                            try:
                                rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
                                mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                                mp_res = pose_estimator.detect(mp_img)
                                if mp_res.pose_landmarks:
                                    lms = mp_res.pose_landmarks[0]
                                    COCO_MAP = {
                                        'nose':0,'left_eye':2,'right_eye':5,
                                        'left_ear':7,'right_ear':8,
                                        'left_shoulder':11,'right_shoulder':12,
                                        'left_elbow':13,'right_elbow':14,
                                        'left_wrist':15,'right_wrist':16,
                                        'left_hip':23,'right_hip':24,
                                        'left_knee':25,'right_knee':26,
                                        'left_ankle':27,'right_ankle':28,
                                    }
                                    for name, idx in COCO_MAP.items():
                                        lm = lms[idx]
                                        keypoints.append({'name':name,'x':float(lm.x),'y':float(lm.y),'visibility':float(lm.visibility)})
                                    pose_src = 'mediapipe'
                            except:
                                pass

                    if not keypoints:
                        pose_model = animal_pose_model if not is_human and animal_pose_model else yolo_pose
                        if pose_model and crop.size > 0:
                            try:
                                r = pose_model(crop, verbose=False)[0]
                                if len(r.keypoints) > 0:
                                    kps = r.keypoints[0].data[0].tolist()
                                    schema = AP10K_KEYPOINT_NAMES if not is_human else [
                                        'nose','left_eye','right_eye','left_ear','right_ear',
                                        'left_shoulder','right_shoulder','left_elbow','right_elbow',
                                        'left_wrist','right_wrist','left_hip','right_hip',
                                        'left_knee','right_knee','left_ankle','right_ankle'
                                    ]
                                    for idx, kp in enumerate(kps[:17]):
                                        name = schema[idx] if idx < len(schema) else f"kp_{idx}"
                                        keypoints.append({
                                            'name': name,
                                            'x': float(kp[0]/bw_c) if bw_c>0 else 0.0,
                                            'y': float(kp[1]/bh_c) if bh_c>0 else 0.0,
                                            'visibility': float(kp[2]),
                                        })
                                    pose_src = 'yolov8'
                            except:
                                pass

                    if keypoints:
                        frames_data.append({
                            'frame_idx':     frame_idx,
                            'timestamp_sec': float(frame_idx / fps),
                            'detected':      True,
                            'className':     species,
                            'confidence':    int(best_conf * 100),
                            'boundingBox':   best_box,
                            'keypoints':     keypoints,
                            'poseSource':    pose_src,
                        })

            frame_idx += 1

        vid_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 640
        vid_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 480
        cap.release()
        os.unlink(temp_path)

        return jsonify({
            'success':              True,
            'frames':               frames_data,
            'fps':                  fps,
            'processed_frames':     len(frames_data),
            'imageWidth':           vid_w,
            'imageHeight':          vid_h,
        })

    except Exception as e:
        if os.path.exists(temp_path):
            os.unlink(temp_path)
        return jsonify({'error': str(e)}), 500


@app.route('/realtime-scan', methods=['POST'])
def realtime_scan():
    """
    Combined species detection and pose estimation in a single endpoint.
    Reduces HTTP request round-trips for smooth real-time webcam analysis.
    """
    if not MODEL_STATUS["yolov8_detector"]["loaded"]:
        return jsonify({
            "error": "Species detection model not loaded",
            "modelAvailable": False
        }), 503

    data = request.get_json()
    if not data or 'image_base64' not in data:
        return jsonify({'error': 'image_base64 required'}), 400

    species = data.get('species', 'human').lower().strip()
    target_class = 'person' if species in ('human', 'person', 'man', 'woman', 'child', 'boy', 'girl') else species

    img = decode_base64_image(data['image_base64'])
    if img is None:
        return jsonify({'error': 'Invalid image data'}), 400

    img_h, img_w = img.shape[:2]
    
    # 1. Species Detection
    results = yolo_det(img, verbose=False)[0]
    best_target = None
    best_target_score = 0.0
    mapped_target = SPECIES_TO_COCO.get(target_class, target_class)

    for box in results.boxes:
        cls_id   = int(box.cls[0].item())
        cls_name = results.names[cls_id].lower()
        conf     = float(box.conf[0].item())

        if cls_name == target_class or cls_name == mapped_target:
            if conf > best_target_score:
                best_target_score = conf
                xyxy = box.xyxy[0].tolist()
                best_target = {
                    'detected':   True,
                    'className':  cls_name,
                    'confidence': int(conf * 100),
                    'boundingBox': {
                        'x':      int(xyxy[0]),
                        'y':      int(xyxy[1]),
                        'width':  int(xyxy[2] - xyxy[0]),
                        'height': int(xyxy[3] - xyxy[1]),
                    }
                }

    if not best_target or best_target_score < 0.30:
        return jsonify({
            'detected':      False,
            'className':     '',
            'confidence':    0,
            'boundingBox':   None,
            'keypoints':     [],
            'modelAvailable': True
        })

    # Track bounding box
    bbox = track_bounding_box(best_target['boundingBox'])
    best_target['boundingBox'] = bbox

    # 2. Pose Estimation
    bx = max(0, int(bbox['x']))
    by = max(0, int(bbox['y']))
    bw = min(img_w - bx, int(bbox['width']))
    bh = min(img_h - by, int(bbox['height']))
    crop_img = img[by:by+bh, bx:bx+bw]

    keypoints = []
    pose_source = None
    pose_conf = 0.0

    if crop_img.size > 0:
        is_human = species in ('human', 'person', 'man', 'woman', 'child', 'boy', 'girl')
        
        # ── HUMAN: MediaPipe PoseLandmarker ──────────────────────────────────────
        if is_human:
            if pose_estimator:
                try:
                    rgb_img  = cv2.cvtColor(crop_img, cv2.COLOR_BGR2RGB)
                    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_img)
                    results  = pose_estimator.detect(mp_image)

                    if results.pose_landmarks and len(results.pose_landmarks) > 0:
                        landmarks = results.pose_landmarks[0]
                        MEDIAPIPE_TO_COCO = {
                            'nose':           0,  'left_eye':      2,  'right_eye':     5,
                            'left_ear':       7,  'right_ear':     8,
                            'left_shoulder': 11,  'right_shoulder':12,
                            'left_elbow':    13,  'right_elbow':   14,
                            'left_wrist':    15,  'right_wrist':   16,
                            'left_hip':      23,  'right_hip':     24,
                            'left_knee':     25,  'right_knee':    26,
                            'left_ankle':    27,  'right_ankle':   28,
                        }
                        for name, idx in MEDIAPIPE_TO_COCO.items():
                            lm = landmarks[idx]
                            keypoints.append({
                                'name':       name,
                                'x':          float(lm.x),
                                'y':          float(lm.y),
                                'visibility': float(lm.visibility),
                            })
                        pose_source = 'mediapipe_blazepose'
                        pose_conf   = float(np.mean([lm.visibility for lm in landmarks]))
                except Exception as e:
                    print(f"[WARN] MediaPipe pose failed: {e}")

            # Fallback: YOLOv8 pose for humans
            if not keypoints and yolo_pose:
                try:
                    results = yolo_pose(crop_img, verbose=False)[0]
                    if len(results.keypoints) > 0:
                        kps = results.keypoints[0].data[0].tolist()
                        COCO_NAMES = [
                            'nose','left_eye','right_eye','left_ear','right_ear',
                            'left_shoulder','right_shoulder','left_elbow','right_elbow',
                            'left_wrist','right_wrist','left_hip','right_hip',
                            'left_knee','right_knee','left_ankle','right_ankle'
                        ]
                        for idx, kp in enumerate(kps[:17]):
                            kx, ky, conf = kp
                            keypoints.append({
                                'name':       COCO_NAMES[idx],
                                'x':          float(kx / bw) if bw > 0 else 0.0,
                                'y':          float(ky / bh) if bh > 0 else 0.0,
                                'visibility': float(conf),
                            })
                        pose_source = 'yolov8_pose_fallback'
                        pose_conf   = float(np.mean([kp[2] for kp in kps[:17]]))
                except Exception as e:
                    print(f"[WARN] YOLOv8 human pose failed: {e}")

        # ── ANIMAL: Fine-tuned → RTMPose → YOLOv8 fallback ──────────────────────
        else:
            # Priority 1: Fine-tuned animal pose model
            if animal_pose_model:
                try:
                    results = animal_pose_model(crop_img, verbose=False)[0]
                    if len(results.keypoints) > 0:
                        kps = results.keypoints[0].data[0].tolist()
                        species_labels = SPECIES_JOINT_LABELS.get(species, {})
                        for idx, kp in enumerate(kps[:17]):
                            kx, ky, conf = kp
                            raw_name   = AP10K_KEYPOINT_NAMES[idx] if idx < len(AP10K_KEYPOINT_NAMES) else f"kp_{idx}"
                            label_name = species_labels.get(raw_name, raw_name)
                            keypoints.append({
                                'name':       label_name,
                                'x':          float(kx / bw) if bw > 0 else 0.0,
                                'y':          float(ky / bh) if bh > 0 else 0.0,
                                'visibility': float(conf),
                                'ap10k_idx':  idx,
                            })
                        pose_source = 'animal_pose_finetuned'
                        pose_conf   = float(np.mean([kp[2] for kp in kps[:17]]))
                except Exception as e:
                    print(f"[WARN] Fine-tuned animal pose failed: {e}")

            # Priority 2: RTMPose
            if rtmpose_inferencer and not keypoints:
                try:
                    result_gen   = rtmpose_inferencer(crop_img)
                    result       = next(result_gen)
                    predictions  = result['predictions'][0][0]
                    kpts         = predictions['keypoints']
                    scores       = predictions['keypoint_scores']
                    species_labels = SPECIES_JOINT_LABELS.get(species, {})
                    for idx, (kpt, score) in enumerate(zip(kpts[:17], scores[:17])):
                        raw_name   = AP10K_KEYPOINT_NAMES[idx] if idx < len(AP10K_KEYPOINT_NAMES) else f"kp_{idx}"
                        label_name = species_labels.get(raw_name, raw_name)
                        keypoints.append({
                            'name':       label_name,
                            'x':          float(kpt[0] / bw) if bw > 0 else 0.0,
                            'y':          float(kpt[1] / bh) if bh > 0 else 0.0,
                            'visibility': float(score),
                            'ap10k_idx':  idx,
                        })
                    pose_source = 'rtmpose_ap10k'
                    pose_conf   = float(np.mean(scores[:17]))
                except Exception as e:
                    print(f"[WARN] RTMPose inference failed: {e}")

            # Priority 3: YOLOv8 pose fallback
            if yolo_pose and not keypoints:
                try:
                    results = yolo_pose(crop_img, verbose=False)[0]
                    if len(results.keypoints) > 0:
                        kps = results.keypoints[0].data[0].tolist()
                        YOLO_TO_AP10K = {
                            0:  (2,  "Nose"),
                            1:  (0,  "L_Eye"),
                            2:  (1,  "R_Eye"),
                            5:  (5,  "L_Shoulder"),
                            6:  (8,  "R_Shoulder"),
                            7:  (6,  "L_Elbow"),
                            8:  (9,  "R_Elbow"),
                            9:  (7,  "L_F_Paw"),
                            10: (10, "R_F_Paw"),
                            11: (11, "L_Hip"),
                            12: (14, "R_Hip"),
                            13: (12, "L_Knee"),
                            14: (15, "R_Knee"),
                            15: (13, "L_B_Paw"),
                            16: (16, "R_B_Paw"),
                        }
                        species_labels = SPECIES_JOINT_LABELS.get(species, {})
                        produced_ap10k = set()
                        for yolo_idx, (ap10k_idx, ap10k_name) in YOLO_TO_AP10K.items():
                            if yolo_idx >= len(kps):
                                continue
                            if ap10k_idx in produced_ap10k:
                                continue
                            kx, ky, conf = kps[yolo_idx]
                            raw_name   = ap10k_name
                            label_name = species_labels.get(raw_name, raw_name)
                            keypoints.append({
                                'name':       label_name,
                                'x':          float(kx / bw) if bw > 0 else 0.0,
                                'y':          float(ky / bh) if bh > 0 else 0.0,
                                'visibility': float(conf),
                                'ap10k_idx':  ap10k_idx,
                            })
                            produced_ap10k.add(ap10k_idx)

                        pose_source = 'yolov8_ap10k_remap'
                        pose_conf   = float(np.mean([kp[2] for kp in kps[:17]]))
                except Exception as e:
                    print(f"[WARN] YOLOv8 animal fallback pose failed: {e}")

    # Normalize body box to 0-1 relative coords
    body_box = {
        'x':      bbox['x'] / img_w,
        'y':      bbox['y'] / img_h,
        'width':  bbox['width'] / img_w,
        'height': bbox['height'] / img_h,
    }

    return jsonify({
        'success':      len(keypoints) > 0,
        'detected':     True,
        'className':    best_target['className'],
        'confidence':   best_target['confidence'],
        'boundingBox':  bbox,
        'keypoints':    keypoints,
        'bodyBox':      body_box,
        'poseSource':   pose_source,
        'poseConf':     round(pose_conf, 3),
        'keypoint_schema': 'coco_17' if is_human else 'ap10k_17',
        'is_human':     is_human,
        'species':      species,
        'model_used':   pose_source,
        'modelAvailable': True
    })


@app.route('/scan-save', methods=['POST'])
def scan_save():
    """Save a completed scan to SQLite."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body required'}), 400

    user_id = data.get('user_id', 'anonymous')
    scan_id = data.get('scanId') or str(uuid.uuid4())

    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute("""
            INSERT OR REPLACE INTO scans
            (scan_id, user_id, species, breed, exercise, exercise_id,
             scan_timestamp, detection_conf, pose_conf, form_score, posture_score,
             balance_score, rep_count, grade, joint_angles, keypoints, biomechanics,
             feedback, media_ref, trainer_synced, scanner_version, analysis_source, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            scan_id,
            user_id,
            data.get('detectedSpecies', ''),
            data.get('detectedBreed', ''),
            data.get('exerciseName', ''),
            data.get('exerciseId', ''),
            data.get('timestamp', datetime.now().isoformat()),
            data.get('detectionConfidence', 0),
            data.get('poseConf', 0),
            data.get('formScore', 0),
            data.get('postureScore', 0),
            data.get('balanceScore', 0),
            data.get('repsCompleted', 0),
            data.get('grade', ''),
            json.dumps(data.get('jointAngles', {})),
            json.dumps(data.get('keypoints', [])),
            json.dumps(data.get('biomechanics', {})),
            json.dumps(data.get('feedback', [])),
            data.get('mediaRef', ''),
            1 if data.get('trainerSynced') else 0,
            data.get('scannerVersion', '2.0.0'),
            data.get('analysisSource', 'backend_ai'),
            datetime.now().isoformat(),
        ))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'scanId': scan_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/scan-history', methods=['GET'])
def scan_history():
    """Retrieve scan history for a user."""
    user_id = request.args.get('user_id', 'anonymous')
    limit   = min(int(request.args.get('limit', 50)), 100)

    try:
        conn  = sqlite3.connect(DB_PATH)
        cursor = conn.execute("""
            SELECT scan_id, species, breed, exercise, scan_timestamp,
                   detection_conf, pose_conf, form_score, posture_score, balance_score,
                   rep_count, grade, joint_angles, keypoints, feedback,
                   scanner_version, analysis_source, created_at
            FROM scans
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        """, (user_id, limit))

        rows = []
        for row in cursor.fetchall():
            rows.append({
                'scanId':            row[0],
                'species':           row[1],
                'breed':             row[2],
                'exercise':          row[3],
                'timestamp':         row[4],
                'detectionConf':     row[5],
                'poseConf':          row[6],
                'formScore':         row[7],
                'postureScore':      row[8],
                'balanceScore':      row[9],
                'repCount':          row[10],
                'grade':             row[11],
                'jointAngles':       json.loads(row[12] or '{}'),
                'keypoints':         json.loads(row[13] or '[]'),
                'feedback':          json.loads(row[14] or '[]'),
                'scannerVersion':    row[15],
                'analysisSource':    row[16],
                'createdAt':         row[17],
            })

        conn.close()
        return jsonify({'success': True, 'scans': rows, 'count': len(rows)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print("\n[START] EcoTrack AI Service ready")
    print(f"[START] Models loaded:")
    for name, st in MODEL_STATUS.items():
        status = "LOADED" if st["loaded"] else f"MISSING ({st['error']})"
        print(f"[START]   {name}: {status}")
    print("[START] Listening on port 5001\n")
    app.run(host='0.0.0.0', port=5001, debug=False)
