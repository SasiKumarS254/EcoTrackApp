import cv2, os, glob, sys
sys.stdout.reconfigure(encoding='utf-8')

VIDEO_DIR = r'c:\Users\DELL\EcoTrackApp\EcoTrack AppVideo'
videos = glob.glob(os.path.join(VIDEO_DIR, '*.mp4'))

print(f"Found {len(videos)} videos:\n")
for v in sorted(videos):
    cap = cv2.VideoCapture(v)
    ok = cap.isOpened()
    fps = cap.get(cv2.CAP_PROP_FPS)
    frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    dur = round(frames / fps, 1) if fps > 0 else 0
    cap.release()
    name = os.path.basename(v)[:70]
    status = "OK" if ok else "FAIL"
    print(f"[{status}] {fps:.1f}fps | {frames} frames | {dur}s | {w}x{h} | {name}")
