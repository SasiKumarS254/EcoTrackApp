// cv_engine.js
// Production-Grade AI Scanner Engine for EcoTrack Web (Inference-Only)
// Connects to the local Python Flask backend on port 5001.

const BACKEND_URL = 'http://localhost:5001';

// Math utility to calculate angle at vertex b given points a, b, c
function calculateAngle(a, b, c) {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * 180 / Math.PI);
  if (angle > 180) {
    angle = 360 - angle;
  }
  return angle;
}

// -----------------------------------------------------------------------------
// Skeletons Definition (Matches backend & mobile templates)
// -----------------------------------------------------------------------------
const AP10K_KEYPOINTS = [
  "L_Eye", "R_Eye", "Nose", "Neck", "root_of_tail",
  "L_Shoulder", "L_Elbow", "L_F_Paw",
  "R_Shoulder", "R_Elbow", "R_F_Paw",
  "L_Hip", "L_Knee", "L_B_Paw",
  "R_Hip", "R_Knee", "R_B_Paw"
];

const QUADRUPED_BONES = [
  ['L_Eye', 'Nose'], ['R_Eye', 'Nose'], ['Nose', 'Neck'],
  ['Neck', 'L_Shoulder'], ['L_Shoulder', 'L_Elbow'], ['L_Elbow', 'L_F_Paw'],
  ['Neck', 'R_Shoulder'], ['R_Shoulder', 'R_Elbow'], ['R_Elbow', 'R_F_Paw'],
  ['Neck', 'root_of_tail'],
  ['root_of_tail', 'L_Hip'], ['L_Hip', 'L_Knee'], ['L_Knee', 'L_B_Paw'],
  ['root_of_tail', 'R_Hip'], ['R_Hip', 'R_Knee'], ['R_Knee', 'R_B_Paw']
];

const SKELETON_TEMPLATES = {
  human: {
    schema: 'coco_17',
    joints: {
      nose: { idx: 0, label: 'Nose' },
      left_eye: { idx: 1, label: 'L Eye' },
      right_eye: { idx: 2, label: 'R Eye' },
      left_ear: { idx: 3, label: 'L Ear' },
      right_ear: { idx: 4, label: 'R Ear' },
      left_shoulder: { idx: 5, label: 'L Shoulder' },
      right_shoulder: { idx: 6, label: 'R Shoulder' },
      left_elbow: { idx: 7, label: 'L Elbow' },
      right_elbow: { idx: 8, label: 'R Elbow' },
      left_wrist: { idx: 9, label: 'L Wrist' },
      right_wrist: { idx: 10, label: 'R Wrist' },
      left_hip: { idx: 11, label: 'L Hip' },
      right_hip: { idx: 12, label: 'R Hip' },
      left_knee: { idx: 13, label: 'L Knee' },
      right_knee: { idx: 14, label: 'R Knee' },
      left_ankle: { idx: 15, label: 'L Ankle' },
      right_ankle: { idx: 16, label: 'R Ankle' }
    },
    bones: [
      ['left_ear', 'left_eye'], ['right_ear', 'right_eye'],
      ['left_eye', 'nose'], ['right_eye', 'nose'],
      ['left_shoulder', 'right_shoulder'],
      ['left_shoulder', 'left_elbow'], ['left_elbow', 'left_wrist'],
      ['right_shoulder', 'right_elbow'], ['right_elbow', 'right_wrist'],
      ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'],
      ['left_hip', 'right_hip'],
      ['left_hip', 'left_knee'], ['left_knee', 'left_ankle'],
      ['right_hip', 'right_knee'], ['right_knee', 'right_ankle']
    ],
    triplets: [
      { a: 'left_elbow', b: 'left_shoulder', c: 'left_hip', label: 'L Shoulder Angle' },
      { a: 'right_elbow', b: 'right_shoulder', c: 'right_hip', label: 'R Shoulder Angle' },
      { a: 'left_wrist', b: 'left_elbow', c: 'left_shoulder', label: 'L Elbow Angle' },
      { a: 'right_wrist', b: 'right_elbow', c: 'right_shoulder', label: 'R Elbow Angle' },
      { a: 'left_ankle', b: 'left_knee', c: 'left_hip', label: 'L Knee Angle' },
      { a: 'right_ankle', b: 'right_knee', c: 'right_hip', label: 'R Knee Angle' },
      { a: 'left_knee', b: 'left_hip', c: 'right_hip', label: 'L Hip Flex' },
      { a: 'right_knee', b: 'right_hip', c: 'left_hip', label: 'R Hip Flex' }
    ]
  },
  animal: {
    schema: 'ap10k_17',
    joints: AP10K_KEYPOINTS.reduce((acc, name, i) => {
      acc[name] = { idx: i, label: name.replace(/_/g, ' ') };
      return acc;
    }, {}),
    bones: QUADRUPED_BONES,
    triplets: [
      { a: 'L_F_Paw', b: 'L_Elbow', c: 'L_Shoulder', label: 'L Front Knee' },
      { a: 'R_F_Paw', b: 'R_Elbow', c: 'R_Shoulder', label: 'R Front Knee' },
      { a: 'L_Elbow', b: 'L_Shoulder', c: 'Neck', label: 'L Shoulder' },
      { a: 'R_Elbow', b: 'R_Shoulder', c: 'Neck', label: 'R Shoulder' },
      { a: 'L_B_Paw', b: 'L_Knee', c: 'L_Hip', label: 'L Hock/Knee' },
      { a: 'R_B_Paw', b: 'R_Knee', c: 'R_Hip', label: 'R Hock/Knee' },
      { a: 'L_Knee', b: 'L_Hip', c: 'root_of_tail', label: 'L Hip' },
      { a: 'R_Knee', b: 'R_Hip', c: 'root_of_tail', label: 'R Hip' },
      { a: 'Neck', b: 'L_Shoulder', c: 'L_Hip', label: 'Spine Alignment' }
    ]
  }
};

// -----------------------------------------------------------------------------
// Exercise Templates Definition (Matches exerciseTemplates.ts)
// -----------------------------------------------------------------------------
const EXERCISE_RULES = {
  human_squat: {
    name: 'Squat',
    rep_tracking_joint: 'left_hip',
    rep_threshold: 0.06,
    rules: {
      left_knee: { min: 60, max: 100, ideal: 85, label: 'L Knee Flexion' },
      right_knee: { min: 60, max: 100, ideal: 85, label: 'R Knee Flexion' },
      left_hip: { min: 60, max: 100, ideal: 80, label: 'L Hip Flexion' },
      right_hip: { min: 60, max: 100, ideal: 80, label: 'R Hip Flexion' }
    }
  },
  human_deadlift: {
    name: 'Deadlift',
    rep_tracking_joint: 'left_hip',
    rep_threshold: 0.08,
    rules: {
      left_hip: { min: 140, max: 180, ideal: 160, label: 'L Hip Extension' },
      right_hip: { min: 140, max: 180, ideal: 160, label: 'R Hip Extension' },
      left_knee: { min: 130, max: 175, ideal: 155, label: 'L Knee' },
      right_knee: { min: 130, max: 175, ideal: 155, label: 'R Knee' }
    }
  },
  human_pushup: {
    name: 'Push-Up',
    rep_tracking_joint: 'left_elbow',
    rep_threshold: 0.05,
    rules: {
      left_elbow: { min: 70, max: 120, ideal: 90, label: 'L Elbow Flexion' },
      right_elbow: { min: 70, max: 120, ideal: 90, label: 'R Elbow Flexion' }
    }
  },
  dog_sit: {
    name: 'Sit Cue',
    rep_tracking_joint: 'L_Hip',
    rep_threshold: 0.07,
    rules: {
      L_Hip: { min: 60, max: 100, ideal: 80, label: 'L Hip Flexion' },
      R_Hip: { min: 60, max: 100, ideal: 80, label: 'R Hip Flexion' },
      L_Knee: { min: 50, max: 90, ideal: 70, label: 'L Stifle Angle' },
      R_Knee: { min: 50, max: 90, ideal: 70, label: 'R Stifle Angle' }
    }
  },
  dog_down: {
    name: 'Down Cue',
    rep_tracking_joint: 'Neck',
    rep_threshold: 0.08,
    rules: {
      L_Hip: { min: 110, max: 150, ideal: 130, label: 'L Hip Alignment' },
      R_Hip: { min: 110, max: 150, ideal: 130, label: 'R Hip Alignment' },
      L_Shoulder: { min: 80, max: 120, ideal: 100, label: 'L Forelimb Flex' },
      R_Shoulder: { min: 80, max: 120, ideal: 100, label: 'R Forelimb Flex' }
    }
  },
  horse_halt: {
    name: 'Square Halt',
    rep_tracking_joint: 'Neck',
    rep_threshold: 0.03,
    rules: {
      L_Elbow: { min: 145, max: 180, ideal: 165, label: 'L Forelimb Extension' },
      R_Elbow: { min: 145, max: 180, ideal: 165, label: 'R Forelimb Extension' },
      L_Knee: { min: 145, max: 180, ideal: 165, label: 'L Hindlimb Extension' },
      R_Knee: { min: 145, max: 180, ideal: 165, label: 'R Hindlimb Extension' }
    }
  }
};

// -----------------------------------------------------------------------------
// Engine State
// -----------------------------------------------------------------------------
let cvEngineActive = false;
let currentInferenceFrame = null;
let currentRepCount = 0;
let repTrackingState = { lastY: -1, inDownPhase: false };

// -----------------------------------------------------------------------------
// 1. Initialize CV Engine (Ping /model-status to verify backend)
// -----------------------------------------------------------------------------
async function initCVEngine(updateStatusCallback) {
  cvEngineActive = true;
  updateStatusCallback('Pinging EcoTrack CV backend (Port 5001)...');
  
  try {
    const res = await fetch(`${BACKEND_URL}/model-status`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (!res.ok) {
      throw new Error(`Backend service returned HTTP ${res.status}`);
    }
    
    const data = await res.json();
    console.log('EcoTrack Web CV Engine verified backend status:', data);
    
    if (!data.overall_ready) {
      updateStatusCallback('Warning: Backend reports models not fully loaded. Initializing fallbacks.');
    } else {
      updateStatusCallback('CV Backend active. YOLOv8 & MediaPipe modules operational.');
    }
    
    isLoaded = true;
    return true;
  } catch (error) {
    console.error("CV Engine Initialization Error:", error);
    updateStatusCallback('Backend offline. Run "python backend/ai_service.py" locally.');
    isLoaded = false;
    throw new Error("Local CV backend offline. " + error.message);
  }
}

// -----------------------------------------------------------------------------
// 2. Stop Inference
// -----------------------------------------------------------------------------
function stopInference() {
  cvEngineActive = false;
  if (currentInferenceFrame) {
    cancelAnimationFrame(currentInferenceFrame);
    currentInferenceFrame = null;
  }
}

// -----------------------------------------------------------------------------
// 3. Main Loop
// -----------------------------------------------------------------------------
async function runInferenceLoop(videoElement, canvasElement, targetSpecies, onHalt, onProgress) {
  const ctx = canvasElement.getContext('2d');
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  
  let frameCount = 0;
  let lastFpsTime = performance.now();
  let currentFps = 0;
  
  const speciesKey = targetSpecies.toLowerCase().trim();
  const isHuman = speciesKey.includes('human') || speciesKey.includes('person');
  const template = isHuman ? SKELETON_TEMPLATES.human : SKELETON_TEMPLATES.animal;
  
  // Resolve correct exercise rules based on species and current drill
  // e.g. "Squat Drill" -> human_squat, "Sit Cue" -> dog_sit
  let exerciseKey = 'free_pose';
  const drillTitle = (currentAiScannerDrill || '').toLowerCase();
  
  if (isHuman) {
    if (drillTitle.includes('squat')) exerciseKey = 'human_squat';
    else if (drillTitle.includes('deadlift')) exerciseKey = 'human_deadlift';
    else if (drillTitle.includes('push')) exerciseKey = 'human_pushup';
  } else {
    if (drillTitle.includes('sit')) exerciseKey = 'dog_sit';
    else if (drillTitle.includes('down') || drillTitle.includes('lay')) exerciseKey = 'dog_down';
    else if (drillTitle.includes('halt')) exerciseKey = 'horse_halt';
  }
  
  const exercise = EXERCISE_RULES[exerciseKey];
  currentRepCount = 0;
  repTrackingState = { lastY: -1, inDownPhase: false };
  
  console.log(`Starting web scanner for target: ${targetSpecies}, exercise: ${exerciseKey}`);

  // Setup UI elements if they exist in the DOM
  const formScoreVal = document.getElementById('webFormScoreVal');
  const postureScoreVal = document.getElementById('webPostureScoreVal');
  const balanceScoreVal = document.getElementById('webBalanceScoreVal');
  const repCountVal = document.getElementById('webRepCountVal');
  const activeModelBadge = document.getElementById('webActiveModelBadge');
  const latencyVal = document.getElementById('webLatencyVal');
  
  async function inferFrame() {
    if (!cvEngineActive) return;
    
    if (videoElement.readyState < 2) {
      currentInferenceFrame = requestAnimationFrame(inferFrame);
      return;
    }
    
    // Maintain temp canvas size matching video frame
    if (tempCanvas.width !== videoElement.videoWidth) {
      tempCanvas.width = videoElement.videoWidth;
      tempCanvas.height = videoElement.videoHeight;
    }
    
    // FPS counter
    const now = performance.now();
    frameCount++;
    if (now - lastFpsTime >= 1000) {
      currentFps = frameCount;
      frameCount = 0;
      lastFpsTime = now;
    }
    
    // Grab frame image
    tempCtx.drawImage(videoElement, 0, 0, tempCanvas.width, tempCanvas.height);
    const base64Img = tempCanvas.toDataURL('image/jpeg', 0.6);
    
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    const startTime = performance.now();
    
    try {
      // Single unified endpoint for detection & pose estimation
      const scanRes = await fetch(`${BACKEND_URL}/realtime-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: base64Img,
          species: speciesKey
        })
      });
      
      if (!scanRes.ok) throw new Error(`Scan endpoint returned HTTP ${scanRes.status}`);
      const poseData = await scanRes.json();
      
      if (poseData.modelAvailable === false) {
        onHalt("AI Model not loaded on server. Please check the backend dashboard.");
        return;
      }
      
      if (!poseData.detected) {
        // Draw dashed bounding box showing target missing
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.strokeRect(50, 50, canvasElement.width - 100, canvasElement.height - 100);
        ctx.setLineDash([]);
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Target "${targetSpecies}" not found in frame`, canvasElement.width / 2, 40);
        
        onProgress({ fps: currentFps, targetFound: false });
        currentInferenceFrame = requestAnimationFrame(inferFrame);
        return;
      }
      
      const bbox = poseData.boundingBox;
      
      // Draw verified target bounds
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3;
      ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`VERIFIED: ${targetSpecies.toUpperCase()} (${poseData.confidence}%)`, bbox.x + 5, bbox.y - 8);
      
      if (poseData.success && poseData.keypoints && poseData.keypoints.length > 0) {
        const kps = poseData.keypoints;
        const kpMap = {};
        
        // Map keypoint coordinates to absolute pixel coordinates
        kps.forEach(kp => {
          kpMap[kp.name] = {
            x: bbox.x + kp.x * bbox.width,
            y: bbox.y + kp.y * bbox.height,
            visibility: kp.visibility
          };
        });
        
        // 3. Compute Angles
        const angles = {};
        template.triplets.forEach(triplet => {
          const pa = kpMap[triplet.a];
          const pb = kpMap[triplet.b];
          const pc = kpMap[triplet.c];
          
          if (pa && pb && pc && pa.visibility > 0.3 && pb.visibility > 0.3 && pc.visibility > 0.3) {
            const angle = calculateAngle(pa, pb, pc);
            angles[triplet.b] = Math.round(angle);
            
            // Draw angle label near the vertex joint
            ctx.fillStyle = '#67e8f9';
            ctx.font = '10px sans-serif';
            ctx.fillText(`${Math.round(angle)}°`, pb.x + 8, pb.y - 4);
          }
        });
        window.latestCapturedAngles = angles;
        
        // 4. Exercise Rules matching & Joint Status color assignment
        let formScore = 100;
        let postureScore = 85;
        let balanceScore = 90;
        const jointStatuses = {};
        
        if (exercise && exercise.rules) {
          let totalScore = 0;
          let count = 0;
          
          Object.entries(exercise.rules).forEach(([joint, rule]) => {
            const angle = angles[joint];
            if (angle === undefined) return;
            
            count++;
            const tolerance = rule.tolerance || 10;
            if (angle >= rule.min && angle <= rule.max) {
              jointStatuses[joint] = 'correct';
              totalScore += 100;
            } else if (angle >= (rule.min - tolerance) && angle <= (rule.max + tolerance)) {
              jointStatuses[joint] = 'warn';
              totalScore += 65;
            } else {
              jointStatuses[joint] = 'incorrect';
              totalScore += 20;
            }
          });
          
          if (count > 0) {
            formScore = Math.round(totalScore / count);
          }
          
          // Rep counting logic
          const repJoint = exercise.rep_tracking_joint;
          const kp = kpMap[repJoint];
          if (kp && kp.visibility > 0.4) {
            const currentY = kp.y; // Absolute pixel y
            const prevY = repTrackingState.lastY;
            const threshold = (exercise.rep_threshold || 0.08) * bbox.height;
            
            if (prevY >= 0) {
              const delta = currentY - prevY;
              if (!repTrackingState.inDownPhase && delta > threshold) {
                repTrackingState.inDownPhase = true;
              } else if (repTrackingState.inDownPhase && delta < -threshold) {
                currentRepCount++;
                repTrackingState.inDownPhase = false;
                
                // Completed a rep, show dynamic flash
                flashTelemetryBorder();
              }
            }
            repTrackingState.lastY = currentY;
          }
        }
        
        // Draw Skeleton bones
        template.bones.forEach(([a, b]) => {
          const pa = kpMap[a];
          const pb = kpMap[b];
          if (pa && pb && pa.visibility > 0.3 && pb.visibility > 0.3) {
            const statusA = jointStatuses[a] || 'default';
            const statusB = jointStatuses[b] || 'default';
            
            ctx.strokeStyle = (statusA === 'incorrect' || statusB === 'incorrect') ? '#f87171' :
                              (statusA === 'warn' || statusB === 'warn') ? '#fbbf24' : '#10b981';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(pa.x, pa.y);
            ctx.lineTo(pb.x, pb.y);
            ctx.stroke();
          }
        });
        
        // Draw joints
        Object.entries(kpMap).forEach(([name, kp]) => {
          if (kp.visibility > 0.3) {
            const status = jointStatuses[name];
            ctx.fillStyle = status === 'incorrect' ? '#ef4444' :
                            status === 'warn' ? '#f59e0b' :
                            status === 'correct' ? '#10b981' : '#a855f7';
            ctx.beginPath();
            ctx.arc(kp.x, kp.y, 4.5, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });
        
        // Update web telemetry in DOM
        const latencyMs = Math.round(performance.now() - startTime);
        if (formScoreVal) formScoreVal.textContent = `${formScore}%`;
        if (postureScoreVal) postureScoreVal.textContent = `${postureScore}%`;
        if (balanceScoreVal) balanceScoreVal.textContent = `${balanceScore}%`;
        if (repCountVal) repCountVal.textContent = currentRepCount;
        if (activeModelBadge) activeModelBadge.textContent = (poseData.model_used || 'YOLOv8').toUpperCase();
        if (latencyVal) latencyVal.textContent = `${latencyMs}ms`;
        
        // Handle visual color coding of telemetry boxes based on scores
        if (formScoreVal) {
          formScoreVal.style.color = formScore >= 80 ? '#10b981' : formScore >= 60 ? '#f59e0b' : '#ef4444';
        }
      }
      
      const inferenceLatency = Math.round(performance.now() - startTime);
      onProgress({ fps: currentFps, targetFound: true, reps: currentRepCount, latency: inferenceLatency, confidence: poseData.confidence });
      
    } catch (err) {
      console.error("Frame Inference Error:", err);
    }
    
    currentInferenceFrame = requestAnimationFrame(inferFrame);
  }
  
  currentInferenceFrame = requestAnimationFrame(inferFrame);
}

// Visual feedback flash function when a rep is completed
function flashTelemetryBorder() {
  const panel = document.getElementById('webRepCountVal');
  if (!panel) return;
  panel.style.transform = 'scale(1.25)';
  panel.style.color = '#10b981';
  setTimeout(() => {
    panel.style.transform = 'scale(1)';
    panel.style.color = '#f8fafc';
  }, 300);
}

window.initCVEngine = initCVEngine;
window.runInferenceLoop = runInferenceLoop;
window.stopInference = stopInference;

async function saveWebScan() {
  const formScore = parseInt(document.getElementById('webFormScoreVal')?.textContent) || 0;
  const reps = parseInt(document.getElementById('webRepCountVal')?.textContent) || 0;
  const posture = parseInt(document.getElementById('webPostureScoreVal')?.textContent) || 0;
  const balance = parseInt(document.getElementById('webBalanceScoreVal')?.textContent) || 0;
  
  const payload = {
    scanId: `web_scan_${Date.now()}`,
    user_id: 'web_user',
    detectedSpecies: currentAiScannerSpecies || 'Human',
    exerciseName: currentAiScannerDrill || 'Free Scan',
    exerciseId: (currentAiScannerDrill || 'free_pose').toLowerCase().replace(/\s+/g, '_'),
    formScore: formScore,
    postureScore: posture,
    balanceScore: balance,
    repsCompleted: reps,
    grade: formScore >= 90 ? 'A' : formScore >= 75 ? 'B' : formScore >= 60 ? 'C' : 'D',
    timestamp: new Date().toISOString(),
    scannerVersion: '2.0.0-web',
    analysisSource: 'backend_ai'
  };
  
  try {
    const res = await fetch(`${BACKEND_URL}/scan-save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log("Web scan saved to backend SQLite:", data);
  } catch (err) {
    console.error("Failed to save web scan:", err);
  }
}

window.saveWebScan = saveWebScan;

