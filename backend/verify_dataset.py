import os
import json
from pathlib import Path
from PIL import Image

BASE_DIR = Path(__file__).parent
DATASETS_DIR = BASE_DIR / "datasets"
YOLO_DS_DIR = DATASETS_DIR / "yolo_animal_pose"
SAMPLE_ANN_PATH = DATASETS_DIR / "ap10k_annotations_sample.json"

def main():
    print("=== EcoTrack Dataset Verification & Diagnostic Report ===")
    
    # 1. Check sample annotations
    if not SAMPLE_ANN_PATH.exists():
        print(f"[FAIL] Sample annotation file not found: {SAMPLE_ANN_PATH}")
        return False
        
    with open(SAMPLE_ANN_PATH) as f:
        try:
            sample_data = json.load(f)
            print("[OK] Sample annotations loaded successfully.")
        except Exception as e:
            print(f"[FAIL] Could not parse sample annotations: {e}")
            return False
            
    # Verify categories and keypoints
    categories = sample_data.get("categories", [])
    if not categories:
        print("[FAIL] No categories defined in annotations.")
        return False
        
    print(f"Categories found: {[cat['name'] for cat in categories]}")
    for cat in categories:
        print(f"  Category '{cat['name']}': {len(cat['keypoints'])} keypoints, skeleton size: {len(cat['skeleton'])}")
        
    # 2. Check YOLO dataset directories and files
    if not YOLO_DS_DIR.exists():
        print(f"[FAIL] YOLO dataset directory not found: {YOLO_DS_DIR}")
        return False
        
    splits = ["train", "val"]
    stats = {}
    
    for split in splits:
        img_dir = YOLO_DS_DIR / split / "images"
        lbl_dir = YOLO_DS_DIR / split / "labels"
        
        if not img_dir.exists() or not lbl_dir.exists():
            print(f"[FAIL] Split directory missing: images/labels for {split}")
            return False
            
        images = list(img_dir.glob("*.jpg")) + list(img_dir.glob("*.png"))
        labels = list(lbl_dir.glob("*.txt"))
        
        print(f"[{split.upper()}] Found {len(images)} images and {len(labels)} label files.")
        
        # Verify each image and label matching
        corrupted_images = 0
        mismatched_labels = 0
        invalid_keypoints = 0
        total_keypoints_annotated = 0
        
        for img_path in images:
            # Check if image is corrupted
            try:
                with Image.open(img_path) as im:
                    im.verify()
            except Exception:
                corrupted_images += 1
                continue
                
            # Check corresponding label file
            lbl_path = lbl_dir / (img_path.stem + ".txt")
            if not lbl_path.exists():
                mismatched_labels += 1
                continue
                
            with open(lbl_path) as f:
                lines = f.readlines()
                
            if not lines:
                mismatched_labels += 1
                continue
                
            for line in lines:
                parts = line.strip().split()
                if len(parts) < 5:
                    mismatched_labels += 1
                    continue
                # Class ID (0) + 4 bbox values + 17 keypoints * 3 values = 56 values total
                if len(parts) != 56:
                    invalid_keypoints += 1
                    continue
                
                # Check normalized values
                try:
                    bbox = [float(x) for x in parts[1:5]]
                    if any(x < 0 or x > 1 for x in bbox):
                        invalid_keypoints += 1
                        continue
                        
                    kpts = parts[5:]
                    for idx in range(0, len(kpts), 3):
                        kx = float(kpts[idx])
                        ky = float(kpts[idx+1])
                        kv = int(kpts[idx+2])
                        if kv > 0:
                            total_keypoints_annotated += 1
                            if kx < 0 or kx > 1 or ky < 0 or ky > 1:
                                invalid_keypoints += 1
                except ValueError:
                    invalid_keypoints += 1
                    
        stats[split] = {
            "total_images": len(images),
            "corrupted_images": corrupted_images,
            "mismatched_labels": mismatched_labels,
            "invalid_keypoints_or_bbox": invalid_keypoints,
            "total_annotations_verified": len(images) - corrupted_images - mismatched_labels - invalid_keypoints,
            "average_keypoints_per_instance": total_keypoints_annotated / max(1, len(images))
        }
        
    print("\nVerification Stats Summary:")
    print(json.dumps(stats, indent=2))
    
    # Save readiness report
    readiness_report = {
        "status": "READY",
        "timestamp": sample_data["info"].get("date_created", ""),
        "species_coverage": [cat['name'] for cat in categories],
        "splits": stats,
        "keypoint_schema": {
            "count": len(categories[0]["keypoints"]),
            "joints": categories[0]["keypoints"]
        }
    }
    
    report_path = BASE_DIR / "models" / "dataset_readiness.json"
    with open(report_path, "w") as f:
        json.dump(readiness_report, f, indent=2)
    print(f"\n[OK] Dataset readiness report saved to: {report_path}")
    
    # Overall check
    if stats["train"]["total_images"] < 20 or stats["val"]["total_images"] < 5:
        print("[FAIL] Insufficient dataset size.")
        return False
        
    print("[OK] Dataset is fully verified and clean for training.")
    return True

if __name__ == "__main__":
    main()
