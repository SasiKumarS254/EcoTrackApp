import os
import json
import shutil
import random
import numpy as np
import cv2
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).parent.parent
DATASETS_DIR = BASE_DIR / "backend" / "datasets"
PUBLIC_IMAGES_DIR = BASE_DIR / "backend" / "public" / "species_images"
YOLO_DS_DIR = DATASETS_DIR / "yolo_animal_pose"
SAMPLE_ANN_PATH = DATASETS_DIR / "ap10k_annotations_sample.json"

# Ensure output directories exist
for split in ["train", "val"]:
    (YOLO_DS_DIR / split / "images").mkdir(parents=True, exist_ok=True)
    (YOLO_DS_DIR / split / "labels").mkdir(parents=True, exist_ok=True)

def rotate_point(px, py, cx, cy, angle_deg):
    angle_rad = np.radians(angle_deg)
    cos_a, sin_a = np.cos(angle_rad), np.sin(angle_rad)
    # Translate to origin
    dx, dy = px - cx, py - cy
    # Rotate
    rx = dx * cos_a - dy * sin_a
    ry = dx * sin_a + dy * cos_a
    # Translate back
    return rx + cx, ry + cy

def augment_sample(img, bbox, keypoints, target_w, target_h):
    h, w = img.shape[:2]
    
    # Scale, Rotate, Translate
    scale = random.uniform(0.85, 1.15)
    angle = random.uniform(-12, 12)
    tx = random.randint(-20, 20)
    ty = random.randint(-20, 20)
    
    cx, cy = w / 2.0, h / 2.0
    M = cv2.getRotationMatrix2D((cx, cy), angle, scale)
    M[0, 2] += tx
    M[1, 2] += ty
    
    # Warp image
    aug_img = cv2.warpAffine(img, M, (w, h), borderMode=cv2.BORDER_REFLECT)
    
    # Transform keypoints
    aug_kpts = []
    for i in range(0, len(keypoints), 3):
        kx, ky, kv = keypoints[i], keypoints[i+1], keypoints[i+2]
        if kv > 0:
            # Apply transformation matrix M
            kp_pt = np.array([kx, ky, 1.0])
            rx = np.dot(M[0], kp_pt)
            ry = np.dot(M[1], kp_pt)
            # Clip to image boundaries
            rx = max(0.0, min(float(w), rx))
            ry = max(0.0, min(float(h), ry))
            aug_kpts.extend([rx, ry, kv])
        else:
            aug_kpts.extend([0.0, 0.0, 0])
            
    # Transform bbox
    bx, by, bw, bh = bbox
    points = np.array([
        [bx, by, 1.0],
        [bx + bw, by, 1.0],
        [bx, by + bh, 1.0],
        [bx + bw, by + bh, 1.0]
    ])
    trans_points = np.dot(points, M.T)
    min_x = max(0.0, min(float(w), np.min(trans_points[:, 0])))
    max_x = max(0.0, min(float(w), np.max(trans_points[:, 0])))
    min_y = max(0.0, min(float(h), np.min(trans_points[:, 1])))
    max_y = max(0.0, min(float(h), np.max(trans_points[:, 1])))
    
    aug_bbox = [min_x, min_y, max_x - min_x, max_y - min_y]
    
    # Resize to target dims if needed
    if w != target_w or h != target_h:
        aug_img = cv2.resize(aug_img, (target_w, target_h))
        # Scale bbox
        aug_bbox = [
            aug_bbox[0] * (target_w / w),
            aug_bbox[1] * (target_h / h),
            aug_bbox[2] * (target_w / w),
            aug_bbox[3] * (target_h / h)
        ]
        # Scale keypoints
        for i in range(0, len(aug_kpts), 3):
            if aug_kpts[i+2] > 0:
                aug_kpts[i] *= (target_w / w)
                aug_kpts[i+1] *= (target_h / h)
                
    # Color/brightness jitter
    brightness = random.uniform(0.8, 1.2)
    aug_img = np.clip(aug_img * brightness, 0, 255).astype(np.uint8)
    
    return aug_img, aug_bbox, aug_kpts

def save_to_yolo(img, bbox, kpts, img_path, lbl_path):
    h, w = img.shape[:2]
    cv2.imwrite(str(img_path), img)
    
    # Normalize bbox
    bx, by, bw, bh = bbox
    x_ctr = (bx + bw / 2.0) / w
    y_ctr = (by + bh / 2.0) / h
    norm_w = bw / w
    norm_h = bh / h
    
    parts = [f"0 {x_ctr:.6f} {y_ctr:.6f} {norm_w:.6f} {norm_h:.6f}"]
    for i in range(0, len(kpts), 3):
        kx, ky, kv = kpts[i], kpts[i+1], kpts[i+2]
        if kv > 0:
            parts.append(f"{kx/w:.6f} {ky/h:.6f} {kv}")
        else:
            parts.append("0.000000 0.000000 0")
            
    with open(lbl_path, "w") as f:
        f.write(" ".join(parts) + "\n")

def main():
    print("Initializing dataset preparation from local images...")
    
    # Load sample annotations
    with open(SAMPLE_ANN_PATH) as f:
        ann_data = json.load(f)
        
    images_meta = {img["id"]: img for img in ann_data["images"]}
    ann_by_img = {ann["image_id"]: ann for ann in ann_data["annotations"]}
    
    # Base images mapping
    base_images = {
        1001: PUBLIC_IMAGES_DIR / "Canis_lupus_familiaris.jpg",  # Dog
        1002: PUBLIC_IMAGES_DIR / "Felis_catus.jpg"              # Cat
    }
    
    random.seed(42)
    np.random.seed(42)
    
    for img_id, base_path in base_images.items():
        if not base_path.exists():
            print(f"Error: Base image {base_path} not found!")
            return
            
        print(f"Processing base image: {base_path.name}")
        img = cv2.imread(str(base_path))
        meta = images_meta[img_id]
        ann = ann_by_img[img_id]
        
        target_w, target_h = meta["width"], meta["height"]
        
        # Resize base image to match annotation coords base
        base_resized = cv2.resize(img, (target_w, target_h))
        
        # Generate split counts
        n_train = 60
        n_val = 15
        
        for split, count in [("train", n_train), ("val", n_val)]:
            for i in range(count):
                aug_img, aug_bbox, aug_kpts = augment_sample(
                    base_resized, ann["bbox"], ann["keypoints"], target_w, target_h
                )
                
                name_idx = f"{img_id}_{split}_{i:03d}"
                img_out = YOLO_DS_DIR / split / "images" / f"{name_idx}.jpg"
                lbl_out = YOLO_DS_DIR / split / "labels" / f"{name_idx}.txt"
                
                save_to_yolo(aug_img, aug_bbox, aug_kpts, img_out, lbl_out)
                
    print(f"Successfully generated dataset at {YOLO_DS_DIR}")

if __name__ == "__main__":
    main()
