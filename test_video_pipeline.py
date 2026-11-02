import cv2
import numpy as np
import requests
import json

def test_pipeline():
    # 1. Create a tiny test video
    video_path = 'test_sample.mp4'
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(video_path, fourcc, 10.0, (320, 240))
    for _ in range(15):
        frame = np.full((240, 320, 3), 120, dtype=np.uint8)
        # Draw a shape to simulate motion
        cv2.circle(frame, (160, 120), 40, (200, 200, 200), -1)
        out.write(frame)
    out.release()
    print("Created test video successfully.")

    # 2. Post to Express endpoint /api/ai/process-video
    url = "http://127.0.0.1:5000/api/ai/process-video"
    with open(video_path, 'rb') as f:
        files = {'video': ('test_sample.mp4', f, 'video/mp4')}
        data = {
            'species': 'Dog',
            'exercise_id': 'dog_stand',
            'user_id': 'test_user_123'
        }
        print(f"Posting multipart video to {url}...")
        resp = requests.post(url, files=files, data=data, timeout=30)
    
    print(f"Status Code: {resp.status_code}")
    if resp.ok:
        res_data = resp.json()
        print("Success! Summary keys:", list(res_data.keys()))
        print("Frame count:", len(res_data.get('frames', [])))
        print("Exercise summary:", res_data.get('exercise_summary'))
    else:
        print("Response error:", resp.text)

if __name__ == '__main__':
    test_pipeline()
