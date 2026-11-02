import sys
import types
import cv2
import numpy as np

# Pure PyTorch NMS patch
try:
    import torch
    orig_load = torch.load
    def patched_load(*args, **kwargs):
        kwargs['weights_only'] = False
        return orig_load(*args, **kwargs)
    torch.load = patched_load

    def pure_torch_nms(boxes, scores, iou_threshold):
        if boxes.numel() == 0:
            return torch.empty((0,), dtype=torch.int64, device=boxes.device)
        x1, y1, x2, y2 = boxes[:, 0], boxes[:, 1], boxes[:, 2], boxes[:, 3]
        areas = (x2 - x1) * (y2 - y1)
        order = scores.argsort(descending=True)
        keep = []
        while order.numel() > 0:
            if order.numel() == 1:
                keep.append(order[0].item())
                break
            i = order[0].item()
            keep.append(i)
            xx1 = torch.maximum(x1[i], x1[order[1:]])
            yy1 = torch.maximum(y1[i], y1[order[1:]])
            xx2 = torch.minimum(x2[i], x2[order[1:]])
            yy2 = torch.minimum(y2[i], y2[order[1:]])
            w = torch.clamp(xx2 - xx1, min=0)
            h = torch.clamp(yy2 - yy1, min=0)
            inter = w * h
            ovr = inter / (areas[i] + areas[order[1:]] - inter)
            inds = (ovr <= iou_threshold).nonzero().squeeze()
            if inds.numel() == 0:
                break
            order = order[inds + 1]
            if order.ndim == 0:
                order = order.unsqueeze(0)
        return torch.tensor(keep, dtype=torch.int64, device=boxes.device)

    tv = types.ModuleType('torchvision')
    sys.modules['torchvision'] = tv
    tv.ops = types.ModuleType('torchvision.ops')
    tv.ops.nms = pure_torch_nms
    sys.modules['torchvision.ops'] = tv.ops
except Exception as e:
    print(f"Patch error: {e}")

from ultralytics import YOLO

video_path = r"C:\Users\DELL\EcoTrackApp\EcoTrack AppVideo\__Military German Shepherd Masters Ladder & Ramp Training with Precision 🐕🪜__ #K9Training.mp4"
model_path = r"C:\Users\DELL\EcoTrackApp\yolov8n.pt"

cap = cv2.VideoCapture(video_path)
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

model = YOLO(model_path)
animal_classes = {'dog', 'cat', 'horse', 'bear', 'sheep', 'cow'}

downsample = max(1, int(round(fps / 15.0))) # 2
print(f"Video {w}x{h}, {total_frames} frames, analyzing every {downsample} frames (~15 fps)")

active_tracks = {}
next_track_id = 1
frame_idx = 0

def calc_iou(b1, b2):
    x1 = max(b1['x'], b2['x'])
    y1 = max(b1['y'], b2['y'])
    x2 = min(b1['x'] + b1['width'], b2['x'] + b2['width'])
    y2 = min(b1['y'] + b1['height'], b2['y'] + b2['height'])
    if x2 <= x1 or y2 <= y1:
        return 0.0
    inter = (x2 - x1) * (y2 - y1)
    a1 = b1['width'] * b1['height']
    a2 = b2['width'] * b2['height']
    return inter / float(a1 + a2 - inter)

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break
    if frame_idx % downsample == 0:
        fh, fw = frame.shape[:2]
        max_dim = 960
        scale = 1.0
        if max(fh, fw) > max_dim:
            scale = max_dim / max(fh, fw)
            infer_frame = cv2.resize(frame, (int(fw * scale), int(fh * scale)))
        else:
            infer_frame = frame

        det_results = model(infer_frame, verbose=False, conf=0.12)[0]
        detections = []
        for box in det_results.boxes:
            cls_id = int(box.cls[0].item())
            cls_name = det_results.names[cls_id].lower()
            conf = float(box.conf[0].item())
            if cls_name in animal_classes:
                xyxy = box.xyxy[0].tolist()
                detections.append({
                    'x': max(0, int(xyxy[0] / scale)),
                    'y': max(0, int(xyxy[1] / scale)),
                    'width': min(fw, int((xyxy[2] - xyxy[0]) / scale)),
                    'height': min(fh, int((xyxy[3] - xyxy[1]) / scale)),
                    'conf': conf,
                    'class': cls_name
                })

        # Match active tracks
        matched_dets = set()
        for track_id, track in list(active_tracks.items()):
            t_box = track['last_bbox']
            tc_x = t_box['x'] + t_box['width'] / 2
            tc_y = t_box['y'] + t_box['height'] / 2

            best_d_idx = -1
            best_score = -999.0

            for d_idx, det in enumerate(detections):
                if d_idx in matched_dets:
                    continue
                dc_x = det['x'] + det['width'] / 2
                dc_y = det['y'] + det['height'] / 2

                dx = abs(tc_x - dc_x)
                dy = abs(tc_y - dc_y)

                # Strict boundary prevents jumping between vertically stacked animals!
                max_w_tol = max(t_box['width'], 120) * 1.5
                max_h_tol = max(t_box['height'], 120) * 0.9

                if dx < max_w_tol and dy < max_h_tol:
                    iou = calc_iou(t_box, det)
                    dist_norm = np.sqrt(dx**2 + dy**2) / max(fw, fh)
                    score = iou * 2.5 - dist_norm
                    if score > best_score:
                        best_score = score
                        best_d_idx = d_idx

            if best_d_idx != -1:
                matched_dets.add(best_d_idx)
                det = detections[best_d_idx]
                track['last_bbox'] = det
                track['missed'] = 0
                track['history'].append({'frame_idx': frame_idx, 'bbox': det, 'detected': True, 'conf': det['conf']})
            else:
                track['missed'] += 1
                if track['missed'] <= 35: # keep alive for 35 steps
                    track['history'].append({'frame_idx': frame_idx, 'bbox': track['last_bbox'], 'detected': False, 'conf': 0.0})
                else:
                    track['active'] = False

        # Add new tracks
        for d_idx, det in enumerate(detections):
            if d_idx not in matched_dets:
                active_tracks[next_track_id] = {
                    'track_id': next_track_id,
                    'last_bbox': det,
                    'missed': 0,
                    'active': True,
                    'history': [{'frame_idx': frame_idx, 'bbox': det, 'detected': True, 'conf': det['conf']}]
                }
                next_track_id += 1

    frame_idx += 1

cap.release()

print(f"Total raw tracks created: {len(active_tracks)}")
valid_tracks = []
for tid, tr in active_tracks.items():
    det_count = sum(1 for h in tr['history'] if h['detected'])
    if det_count >= 5:
        med_y = np.median([h['bbox']['y'] for h in tr['history'] if h['detected']])
        med_x = np.median([h['bbox']['x'] for h in tr['history'] if h['detected']])
        valid_tracks.append({
            'track_id': tid,
            'det_count': det_count,
            'total_frames': len(tr['history']),
            'med_y': med_y,
            'med_x': med_x,
            'first_f': tr['history'][0]['frame_idx'],
            'last_f': tr['history'][-1]['frame_idx']
        })

print(f"Valid tracks (det_count >= 5): {len(valid_tracks)}")
for vt in valid_tracks:
    print(f"  Track #{vt['track_id']}: {vt['det_count']} detections, frames {vt['first_f']}->{vt['last_f']}, med_y={vt['med_y']:.1f}, med_x={vt['med_x']:.1f}")
