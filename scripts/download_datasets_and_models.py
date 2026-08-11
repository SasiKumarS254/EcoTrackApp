import os
import sys
import json
import urllib.request
import time

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

MODELS_DIR = os.path.join("backend", "models")
DATASETS_DIR = os.path.join("backend", "datasets")

os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(DATASETS_DIR, exist_ok=True)

# 1. DOWNLOAD REAL PRETRAINED POSE MODELS & WEIGHTS
MODEL_URLS = [
    {
        "name": "pose_landmarker_heavy.task",
        "url": "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task",
        "desc": "MediaPipe Tasks Vision 33-Landmark Heavy Pose Model (29MB)"
    },
    {
        "name": "pose_landmarker_full.task",
        "url": "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
        "desc": "MediaPipe Tasks Vision 33-Landmark Full Pose Model"
    },
    {
        "name": "yolov8n-pose.pt",
        "url": "https://github.com/ultralytics/assets/releases/download/v8.1.0/yolov8n-pose.pt",
        "desc": "YOLOv8 Pose Estimation Checkpoint (PyTorch)"
    },
    {
        "name": "yolov8m-pose.pt",
        "url": "https://github.com/ultralytics/assets/releases/download/v8.1.0/yolov8m-pose.pt",
        "desc": "YOLOv8 Medium High-Accuracy Pose Checkpoint (PyTorch)"
    }
]

# 2. DATASET ANNOTATIONS & SCHEMAS (AP-10K, ANIMAL-POSE, COCO-KEYPOINTS)
DATASETS = [
    {
        "filename": "ap10k_dataset_schema.json",
        "content": {
            "dataset_name": "AP-10K Animal Pose Dataset",
            "version": "1.0.0",
            "total_images": 10015,
            "total_species": 54,
            "species_categories": [
                "dog", "cat", "cow", "horse", "sheep", "monkey", "lion", "tiger",
                "elephant", "bear", "kangaroo", "giraffe", "zebra", "hippo", "rhino",
                "deer", "wolf", "rabbit", "panda", "leopard", "cheetah", "gorilla",
                "dolphin", "parrot", "eagle", "owl"
            ],
            "keypoints": [
                "Nose", "L_Eye", "R_Eye", "L_Ear", "R_Ear", "L_Shoulder", "R_Shoulder",
                "L_Elbow", "R_Elbow", "L_Wrist", "R_Wrist", "L_Hip", "R_Hip",
                "L_Knee", "R_Knee", "L_Ankle", "R_Ankle"
            ],
            "skeleton_bones": [
                [0, 1], [0, 2], [1, 3], [2, 4], [5, 6], [5, 7], [7, 9],
                [6, 8], [8, 10], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16]
            ]
        }
    },
    {
        "filename": "animal_pose_dataset_schema.json",
        "content": {
            "dataset_name": "Animal-Pose Dataset",
            "version": "1.0.0",
            "categories": ["dog", "cat", "cow", "horse", "sheep"],
            "keypoints_20": [
                "L_Eye", "R_Eye", "L_Ear", "R_Ear", "Nose", "Throat", "Withers", "TailBase",
                "L_F_Elbow", "R_F_Elbow", "L_F_Paw", "R_F_Paw", "L_B_Knee", "R_B_Knee",
                "L_B_Paw", "R_B_Paw", "L_F_Shoulder", "R_F_Shoulder", "L_B_Hip", "R_B_Hip"
            ]
        }
    },
    {
        "filename": "coco_keypoints_schema.json",
        "content": {
            "dataset_name": "COCO 2017 Keypoints Dataset",
            "version": "2017",
            "categories": ["person"],
            "keypoints": [
                "nose", "left_eye", "right_eye", "left_ear", "right_ear",
                "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
                "left_wrist", "right_wrist", "left_hip", "right_hip",
                "left_knee", "right_knee", "left_ankle", "right_ankle"
            ]
        }
    }
]

def download_file(url, target_path, desc):
    print(f"📥 Downloading {desc}...")
    print(f"   URL: {url}")
    print(f"   Target: {target_path}")
    try:
        req = urllib.request.Request(
            url,
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        start_time = time.time()
        with urllib.request.urlopen(req, timeout=45) as response, open(target_path, 'wb') as out_file:
            data = response.read()
            out_file.write(data)
        elapsed = time.time() - start_time
        size_mb = len(data) / (1024 * 1024)
        print(f"✅ Downloaded {size_mb:.2f} MB in {elapsed:.1f}s -> {target_path}\n")
        return True
    except Exception as e:
        print(f"⚠️ Download failed for {url}: {e}\n")
        return False

def main():
    print("=" * 75)
    print("ECOTRACK REAL COMPUTER VISION DATASET & MODEL INITIALIZER")
    print("=" * 75)

    # 1. Download Model Checkpoints
    downloaded_models = []
    for item in MODEL_URLS:
        target = os.path.join(MODELS_DIR, item["name"])
        if not os.path.exists(target) or os.path.getsize(target) == 0:
            success = download_file(item["url"], target, item["desc"])
            if success:
                downloaded_models.append(item["name"])
        else:
            size_mb = os.path.getsize(target) / (1024 * 1024)
            print(f"✅ Existing Model Verified: {item['name']} ({size_mb:.2f} MB)")
            downloaded_models.append(item["name"])

    # 2. Initialize Dataset Annotations & Schemas
    for item in DATASETS:
        target = os.path.join(DATASETS_DIR, item["filename"])
        with open(target, "w", encoding="utf-8") as f:
            json.dump(item["content"], f, indent=2)
        print(f"✅ Saved Dataset Schema: {item['filename']}")

    # 3. Save Dataset Manifest
    manifest = {
        "status": "ready",
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "models_dir": os.path.abspath(MODELS_DIR),
        "datasets_dir": os.path.abspath(DATASETS_DIR),
        "installed_models": downloaded_models,
        "installed_datasets": [d["filename"] for d in DATASETS]
    }

    manifest_path = os.path.join(DATASETS_DIR, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print("-" * 75)
    print(f"✅ Dataset & Model Manifest generated at: {manifest_path}")
    print("=" * 75)

if __name__ == "__main__":
    main()
