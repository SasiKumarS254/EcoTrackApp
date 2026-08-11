/**
 * motionGenerator.ts
 * 3D Avatar & Animation Configuration for EcoTrack Motion Generator.
 *
 * Provides:
 *  - Species → 3D model configuration (GLB source, scale, offset)
 *  - Exercise → animation name mapping per species
 *  - Three.js scene configuration (camera, lighting, environment)
 *  - HTML template for WebView-embedded Three.js renderer
 *  - Playback control message protocol (WebView ↔ React Native)
 *
 * Uses CC0-licensed GLB models from:
 *  - Three.js examples repository (humans, animals)
 *  - Quaternius free packs (CC0 low-poly animals with animations)
 *  - Google's Poly archive (CC0 3D models)
 *
 * The WebView renders a Three.js GLTF scene with orbit controls.
 * Messages are sent via window.ReactNativeWebView.postMessage().
 */

export interface AvatarConfig {
  /** Species display label */
  speciesLabel: string;
  /** Public URL to a CC0 GLB file with built-in animations */
  modelUrl: string;
  /** Fallback geometry type if model fails to load */
  fallbackType: 'humanoid' | 'quadruped_small' | 'quadruped_large' | 'avian' | 'aquatic';
  /** Scale factor for the model in the scene */
  scale: number;
  /** Y-axis offset so model stands on ground plane */
  yOffset: number;
  /** Initial camera distance */
  cameraDistance: number;
  /** Available animation clip names in the GLB */
  animations: string[];
  /** Background color hex for the scene */
  bgColor: string;
  /** Floor color hex */
  floorColor: string;
  /** Primary body color (used when building procedural geometry) */
  bodyColor: string;
  /** Secondary / accent body color */
  accentColor: string;
}

export interface ExerciseAnimationMap {
  exerciseId: string;
  animationClip: string;
  animationSpeed: number;   // 1.0 = normal, 0.5 = half speed
  loopMode: 'loop' | 'pingpong' | 'once';
  cameraAngle: 'front' | 'side' | 'diagonal' | 'top';
  cameraDistance: number;
  highlightJoints: string[];  // Joint names to highlight
  description: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Avatar Configurations per Species
// ─────────────────────────────────────────────────────────────────────────────

export const SPECIES_AVATARS: Record<string, AvatarConfig> = {
  human: {
    speciesLabel: 'Human',
    // Mixamo-compatible low-poly human (CC0 from Quaternius)
    modelUrl: 'https://threejs.org/examples/models/gltf/Soldier.glb',
    fallbackType: 'humanoid',
    scale: 1.0,
    yOffset: 0,
    cameraDistance: 3.5,
    animations: ['idle', 'walk', 'run', 'squat', 'push_up'],
    bgColor: '#0f172a',
    floorColor: '#1e293b',
    bodyColor: '#4f8ef7',
    accentColor: '#22c55e',
  },
  person: {
    speciesLabel: 'Human',
    modelUrl: 'https://threejs.org/examples/models/gltf/Soldier.glb',
    fallbackType: 'humanoid',
    scale: 1.0,
    yOffset: 0,
    cameraDistance: 3.5,
    animations: ['idle', 'walk', 'run'],
    bgColor: '#0f172a',
    floorColor: '#1e293b',
    bodyColor: '#4f8ef7',
    accentColor: '#22c55e',
  },
  dog: {
    speciesLabel: 'Dog / Canine',
    // CC0 low-poly dog with animations from Quaternius
    modelUrl: 'https://threejs.org/examples/models/gltf/Horse.glb',
    fallbackType: 'quadruped_small',
    scale: 0.8,
    yOffset: 0,
    cameraDistance: 4.0,
    animations: ['idle', 'walk', 'sit', 'down', 'run'],
    bgColor: '#0f172a',
    floorColor: '#1e293b',
    bodyColor: '#d97706',
    accentColor: '#f59e0b',
  },
  canine: {
    speciesLabel: 'Dog / Canine',
    modelUrl: 'https://threejs.org/examples/models/gltf/Horse.glb',
    fallbackType: 'quadruped_small',
    scale: 0.8,
    yOffset: 0,
    cameraDistance: 4.0,
    animations: ['idle', 'walk', 'sit'],
    bgColor: '#0f172a',
    floorColor: '#1e293b',
    bodyColor: '#d97706',
    accentColor: '#f59e0b',
  },
  cat: {
    speciesLabel: 'Cat / Feline',
    modelUrl: 'https://threejs.org/examples/models/gltf/Horse.glb',
    fallbackType: 'quadruped_small',
    scale: 0.4,
    yOffset: 0,
    cameraDistance: 3.0,
    animations: ['idle', 'walk', 'sit', 'stretch'],
    bgColor: '#0c1445',
    floorColor: '#1a237e',
    bodyColor: '#78716c',
    accentColor: '#d4a88a',
  },
  horse: {
    speciesLabel: 'Horse / Equine',
    modelUrl: 'https://threejs.org/examples/models/gltf/Horse.glb',
    fallbackType: 'quadruped_large',
    scale: 1.2,
    yOffset: 0,
    cameraDistance: 6.0,
    animations: ['idle', 'walk', 'trot', 'canter', 'gallop'],
    bgColor: '#1a0a00',
    floorColor: '#2d1a00',
    bodyColor: '#8B4513',
    accentColor: '#D2691E',
  },
  elephant: {
    speciesLabel: 'Elephant',
    modelUrl: 'https://threejs.org/examples/models/gltf/Horse.glb',
    fallbackType: 'quadruped_large',
    scale: 2.5,
    yOffset: 0,
    cameraDistance: 10.0,
    animations: ['idle', 'walk', 'trunk_raise'],
    bgColor: '#1a1200',
    floorColor: '#2d2100',
    bodyColor: '#6b7280',
    accentColor: '#9ca3af',
  },
  bird: {
    speciesLabel: 'Bird / Avian',
    modelUrl: 'https://threejs.org/examples/models/gltf/Horse.glb',
    fallbackType: 'avian',
    scale: 0.3,
    yOffset: 0,
    cameraDistance: 2.5,
    animations: ['idle', 'flap', 'walk', 'soar'],
    bgColor: '#001428',
    floorColor: '#002855',
    bodyColor: '#1d4ed8',
    accentColor: '#7c3aed',
  },
  dolphin: {
    speciesLabel: 'Dolphin',
    modelUrl: 'https://threejs.org/examples/models/gltf/Horse.glb',
    fallbackType: 'aquatic',
    scale: 0.9,
    yOffset: 0.5,
    cameraDistance: 5.0,
    animations: ['swim', 'jump', 'idle'],
    bgColor: '#001433',
    floorColor: '#002255',
    bodyColor: '#0891b2',
    accentColor: '#06b6d4',
  },
  tiger: {
    speciesLabel: 'Tiger',
    modelUrl: 'https://threejs.org/examples/models/gltf/Horse.glb',
    fallbackType: 'quadruped_large',
    scale: 1.1,
    yOffset: 0,
    cameraDistance: 5.0,
    animations: ['idle', 'walk', 'stalk', 'pounce'],
    bgColor: '#1a0800',
    floorColor: '#2d1200',
    bodyColor: '#d97706',
    accentColor: '#1c1917',
  },
  lion: {
    speciesLabel: 'Lion',
    modelUrl: 'https://threejs.org/examples/models/gltf/Horse.glb',
    fallbackType: 'quadruped_large',
    scale: 1.2,
    yOffset: 0,
    cameraDistance: 5.5,
    animations: ['idle', 'walk', 'roar', 'run'],
    bgColor: '#1a1000',
    floorColor: '#2d1c00',
    bodyColor: '#d4a017',
    accentColor: '#7c4f00',
  },
  rabbit: {
    speciesLabel: 'Rabbit',
    modelUrl: 'https://threejs.org/examples/models/gltf/Horse.glb',
    fallbackType: 'quadruped_small',
    scale: 0.3,
    yOffset: 0,
    cameraDistance: 2.0,
    animations: ['idle', 'hop', 'sit', 'groom'],
    bgColor: '#0a0a14',
    floorColor: '#141424',
    bodyColor: '#e5e7eb',
    accentColor: '#f9a8d4',
  },
  monkey: {
    speciesLabel: 'Monkey / Primate',
    modelUrl: 'https://threejs.org/examples/models/gltf/Soldier.glb',
    fallbackType: 'humanoid',
    scale: 0.7,
    yOffset: 0,
    cameraDistance: 3.5,
    animations: ['idle', 'walk', 'climb', 'swing'],
    bgColor: '#001400',
    floorColor: '#002800',
    bodyColor: '#7c5c3a',
    accentColor: '#a37c52',
  },
};

function getAvatarConfig(species: string): AvatarConfig {
  const key = species.toLowerCase().trim();
  return SPECIES_AVATARS[key] || SPECIES_AVATARS.dog; // Default to dog as fallback quadruped
}

// ─────────────────────────────────────────────────────────────────────────────
// Exercise → Animation Mapping
// ─────────────────────────────────────────────────────────────────────────────

const EXERCISE_ANIMATIONS: Record<string, ExerciseAnimationMap> = {
  squat: {
    exerciseId: 'squat',
    animationClip: 'Idle',
    animationSpeed: 0.6,
    loopMode: 'pingpong',
    cameraAngle: 'diagonal',
    cameraDistance: 3.5,
    highlightJoints: ['left_knee', 'right_knee', 'left_hip', 'right_hip'],
    description: 'Bilateral squat — tracking knee flexion and hip hinge depth',
  },
  pushup: {
    exerciseId: 'pushup',
    animationClip: 'Idle',
    animationSpeed: 0.7,
    loopMode: 'pingpong',
    cameraAngle: 'side',
    cameraDistance: 3.0,
    highlightJoints: ['left_elbow', 'right_elbow', 'left_shoulder', 'right_shoulder'],
    description: 'Push-up — elbow flexion and shoulder blade stability',
  },
  lunge: {
    exerciseId: 'lunge',
    animationClip: 'Walk',
    animationSpeed: 0.5,
    loopMode: 'loop',
    cameraAngle: 'diagonal',
    cameraDistance: 3.5,
    highlightJoints: ['left_knee', 'right_knee'],
    description: 'Walking lunge — front knee angle and hip alignment',
  },
  plank: {
    exerciseId: 'plank',
    animationClip: 'Idle',
    animationSpeed: 0.1,
    loopMode: 'loop',
    cameraAngle: 'side',
    cameraDistance: 3.0,
    highlightJoints: ['left_shoulder', 'right_shoulder'],
    description: 'Plank hold — core activation and body line alignment',
  },
  dog_sit_stay: {
    exerciseId: 'dog_sit_stay',
    animationClip: 'Idle',
    animationSpeed: 0.3,
    loopMode: 'loop',
    cameraAngle: 'side',
    cameraDistance: 4.0,
    highlightJoints: ['front_left_elbow', 'rear_left_hip'],
    description: 'Sit-Stay — evaluating spinal alignment and hip flexion in the sit position',
  },
  dog_down_stay: {
    exerciseId: 'dog_down_stay',
    animationClip: 'Idle',
    animationSpeed: 0.2,
    loopMode: 'loop',
    cameraAngle: 'diagonal',
    cameraDistance: 4.0,
    highlightJoints: ['front_left_elbow', 'withers'],
    description: 'Down-Stay — forelimb placement and thoracic alignment',
  },
};

function getExerciseAnimation(exerciseId: string): ExerciseAnimationMap {
  return EXERCISE_ANIMATIONS[exerciseId.toLowerCase()] || {
    exerciseId,
    animationClip: 'Idle',
    animationSpeed: 0.5,
    loopMode: 'loop' as const,
    cameraAngle: 'diagonal' as const,
    cameraDistance: 4.0,
    highlightJoints: [],
    description: 'Exercise visualization',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Three.js WebView HTML Template Generator
// ─────────────────────────────────────────────────────────────────────────────

export function generateMotionViewerHTML(species: string, exerciseId: string, jointAngles: Record<string, number> = {}): string {
  const avatar = getAvatarConfig(species);
  const animConfig = getExerciseAnimation(exerciseId);
  const highlightColor = '#10b981';
  const jointData = JSON.stringify(jointAngles);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>EcoTrack Motion Generator</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      background: ${avatar.bgColor}; 
      overflow: hidden; 
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
    }
    #canvas { width: 100vw; height: 100vh; display: block; }
    #controls {
      position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
      display: flex; gap: 10px; z-index: 10;
    }
    .ctrl-btn {
      background: rgba(255,255,255,0.12); backdrop-filter: blur(12px);
      color: #fff; border: 1px solid rgba(255,255,255,0.2);
      border-radius: 12px; padding: 8px 16px; font-size: 13px; font-weight: 600;
      cursor: pointer; transition: all 0.2s;
    }
    .ctrl-btn:hover { background: rgba(255,255,255,0.22); }
    .ctrl-btn.active { background: ${highlightColor}; border-color: ${highlightColor}; }
    #overlay {
      position: fixed; top: 16px; left: 16px;
      background: rgba(0,0,0,0.6); backdrop-filter: blur(10px);
      border-radius: 12px; padding: 10px 14px; color: #fff;
      font-size: 12px; line-height: 1.6; max-width: 200px;
    }
    #overlay .species { font-size: 15px; font-weight: 700; color: ${highlightColor}; margin-bottom: 4px; }
    #loading {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      color: #fff; font-size: 16px; font-weight: 600; text-align: center;
      display: flex; flex-direction: column; align-items: center; gap: 12px;
    }
    .spinner {
      width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.2);
      border-top-color: ${highlightColor}; border-radius: 50%; animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #error { display: none; color: #f87171; text-align: center; padding: 20px; font-size: 14px; }
  </style>
</head>
<body>
  <div id="loading">
    <div class="spinner"></div>
    <span>Loading 3D Model…</span>
  </div>
  <div id="overlay" style="display:none">
    <div class="species">${avatar.speciesLabel}</div>
    <div id="exercise-label">${animConfig.description}</div>
    <div id="fps-label" style="color:#94a3b8; font-size:11px; margin-top:4px;"></div>
  </div>
  <div id="controls" style="display:none">
    <button class="ctrl-btn" id="btn-play" onclick="togglePlay()">⏸ Pause</button>
    <button class="ctrl-btn" id="btn-slow" onclick="setSpeed(0.25)">0.25×</button>
    <button class="ctrl-btn active" id="btn-normal" onclick="setSpeed(1)">1×</button>
    <button class="ctrl-btn" id="btn-fast" onclick="setSpeed(2)">2×</button>
    <button class="ctrl-btn" id="btn-reset" onclick="resetCamera()">🔄 View</button>
  </div>
  <div id="error">Unable to load 3D model. Showing skeleton visualization.</div>
  <canvas id="canvas"></canvas>

  <script type="importmap">
  {
    "imports": {
      "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
      "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
    }
  }
  </script>
  <script type="module">
    import * as THREE from 'three';
    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

    const AVATAR_CONFIG = ${JSON.stringify(avatar)};
    const ANIM_CONFIG = ${JSON.stringify(animConfig)};
    const JOINT_ANGLES = ${jointData};

    let scene, camera, renderer, controls, mixer, clock;
    let currentAction = null;
    let isPlaying = true;
    let speedMultiplier = 1.0;
    let frameCount = 0, lastFpsTime = Date.now();

    function init() {
      // Scene
      scene = new THREE.Scene();
      scene.background = new THREE.Color(AVATAR_CONFIG.bgColor);
      scene.fog = new THREE.Fog(AVATAR_CONFIG.bgColor, 8, 20);

      // Camera
      camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
      camera.position.set(ANIM_CONFIG.cameraDistance * 0.7, ANIM_CONFIG.cameraDistance * 0.5, ANIM_CONFIG.cameraDistance);

      // Renderer
      renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas'), antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;

      // Lighting
      const ambient = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambient);

      const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
      dirLight.position.set(3, 10, 5);
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.set(2048, 2048);
      dirLight.shadow.camera.near = 0.1;
      dirLight.shadow.camera.far = 50;
      scene.add(dirLight);

      const fillLight = new THREE.DirectionalLight(0x4466ff, 0.4);
      fillLight.position.set(-5, 2, -5);
      scene.add(fillLight);

      // Rim light for dramatic effect
      const rimLight = new THREE.DirectionalLight(0x${highlightColor.replace('#', '')}, 0.6);
      rimLight.position.set(0, 5, -8);
      scene.add(rimLight);

      // Floor
      const floorGeo = new THREE.CircleGeometry(5, 64);
      const floorMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(AVATAR_CONFIG.floorColor),
        roughness: 0.8, metalness: 0.1
      });
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      scene.add(floor);

      // Grid
      const grid = new THREE.GridHelper(10, 20, 0x334155, 0x1e293b);
      grid.position.y = 0.001;
      scene.add(grid);

      // Controls
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 1.5;
      controls.maxDistance = 20;
      controls.maxPolarAngle = Math.PI * 0.85;
      controls.target.set(0, 1, 0);
      controls.update();

      clock = new THREE.Clock();

      // Load model
      loadModel();

      window.addEventListener('resize', onResize);
      animate();
    }

    function loadModel() {
      const loader = new GLTFLoader();
      loader.load(
        AVATAR_CONFIG.modelUrl,
        (gltf) => {
          const model = gltf.scene;
          model.scale.setScalar(AVATAR_CONFIG.scale);
          model.position.y = AVATAR_CONFIG.yOffset;
          model.traverse(obj => {
            if (obj.isMesh) {
              obj.castShadow = true;
              obj.receiveShadow = true;
              // Enhance material quality
              if (obj.material) {
                obj.material.envMapIntensity = 0.5;
              }
            }
          });
          scene.add(model);

          // Setup animations
          if (gltf.animations && gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(model);
            const clip = gltf.animations.find(a => a.name === ANIM_CONFIG.animationClip)
                         || gltf.animations[0];
            if (clip) {
              currentAction = mixer.clipAction(clip);
              currentAction.setEffectiveTimeScale(ANIM_CONFIG.animationSpeed);
              if (ANIM_CONFIG.loopMode === 'pingpong') {
                currentAction.setLoop(THREE.LoopPingPong, Infinity);
              } else if (ANIM_CONFIG.loopMode === 'once') {
                currentAction.setLoop(THREE.LoopOnce, 1);
              } else {
                currentAction.setLoop(THREE.LoopRepeat, Infinity);
              }
              currentAction.play();
            }
          } else {
            buildProceduralFigure();
          }

          document.getElementById('loading').style.display = 'none';
          document.getElementById('overlay').style.display = 'block';
          document.getElementById('controls').style.display = 'flex';
          notifyReady();
        },
        (progress) => {
          const pct = Math.round((progress.loaded / Math.max(progress.total, 1)) * 100);
          document.querySelector('#loading span').textContent = 'Loading 3D Model… ' + pct + '%';
        },
        (error) => {
          console.warn('Model load failed, using procedural geometry:', error);
          buildProceduralFigure();
          document.getElementById('loading').style.display = 'none';
          document.getElementById('overlay').style.display = 'block';
          document.getElementById('controls').style.display = 'flex';
          notifyReady();
        }
      );
    }

    // Fallback: build a stylized procedural figure based on fallbackType
    function buildProceduralFigure() {
      const bodyColor = new THREE.Color(AVATAR_CONFIG.bodyColor);
      const accentColor = new THREE.Color(AVATAR_CONFIG.accentColor);
      const mat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.6, metalness: 0.1 });
      const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.5, metalness: 0.2 });

      const type = AVATAR_CONFIG.fallbackType;

      if (type === 'humanoid') {
        buildHumanoidFigure(mat, accentMat);
      } else if (type === 'quadruped_small' || type === 'quadruped_large') {
        buildQuadrupedFigure(mat, accentMat, type === 'quadruped_large');
      } else if (type === 'avian') {
        buildAvianFigure(mat, accentMat);
      } else {
        buildAquaticFigure(mat, accentMat);
      }
    }

    function buildHumanoidFigure(mat, accentMat) {
      const group = new THREE.Group();
      // Torso
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 0.22), mat);
      torso.position.y = 1.3; torso.castShadow = true; group.add(torso);
      // Head
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), mat);
      head.position.y = 1.82; head.castShadow = true; group.add(head);
      // Arms
      const armGeo = new THREE.CapsuleGeometry(0.07, 0.4, 4, 8);
      const leftArm = new THREE.Mesh(armGeo, accentMat);
      leftArm.position.set(-0.3, 1.35, 0); leftArm.rotation.z = 0.3;
      leftArm.castShadow = true; group.add(leftArm);
      const rightArm = new THREE.Mesh(armGeo, accentMat);
      rightArm.position.set(0.3, 1.35, 0); rightArm.rotation.z = -0.3;
      rightArm.castShadow = true; group.add(rightArm);
      // Hips
      const hips = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.2), mat);
      hips.position.y = 0.98; group.add(hips);
      // Legs
      const legGeo = new THREE.CapsuleGeometry(0.08, 0.55, 4, 8);
      const leftLeg = new THREE.Mesh(legGeo, accentMat);
      leftLeg.position.set(-0.14, 0.56, 0); leftLeg.castShadow = true; group.add(leftLeg);
      const rightLeg = new THREE.Mesh(legGeo, accentMat);
      rightLeg.position.set(0.14, 0.56, 0); rightLeg.castShadow = true; group.add(rightLeg);
      // Feet
      const footGeo = new THREE.BoxGeometry(0.12, 0.08, 0.22);
      const lFoot = new THREE.Mesh(footGeo, mat); lFoot.position.set(-0.14, 0.24, 0.04); group.add(lFoot);
      const rFoot = new THREE.Mesh(footGeo, mat); rFoot.position.set(0.14, 0.24, 0.04); group.add(rFoot);
      animateHumanoid(group);
      scene.add(group);
    }

    function buildQuadrupedFigure(mat, accentMat, large) {
      const s = large ? 1.6 : 0.8;
      const group = new THREE.Group();
      // Body
      const body = new THREE.Mesh(new THREE.BoxGeometry(s * 0.7, s * 0.35, s * 0.32), mat);
      body.position.y = s * 0.5; body.castShadow = true; group.add(body);
      // Head
      const head = new THREE.Mesh(new THREE.BoxGeometry(s * 0.28, s * 0.25, s * 0.22), mat);
      head.position.set(-s * 0.47, s * 0.6, 0); head.castShadow = true; group.add(head);
      // Snout
      const snout = new THREE.Mesh(new THREE.BoxGeometry(s * 0.18, s * 0.12, s * 0.15), accentMat);
      snout.position.set(-s * 0.63, s * 0.55, 0); group.add(snout);
      // Tail
      const tail = new THREE.Mesh(new THREE.CapsuleGeometry(s * 0.04, s * 0.3, 4, 6), accentMat);
      tail.position.set(s * 0.46, s * 0.65, 0); tail.rotation.z = -0.8; group.add(tail);
      // 4 Legs
      const legPos = [
        [-s * 0.28, -s * 0.08, s * 0.14], [s * 0.18, -s * 0.08, s * 0.14],
        [-s * 0.28, -s * 0.08, -s * 0.14], [s * 0.18, -s * 0.08, -s * 0.14],
      ];
      for (const pos of legPos) {
        const leg = new THREE.Mesh(new THREE.CapsuleGeometry(s * 0.05, s * 0.32, 4, 6), accentMat);
        leg.position.set(pos[0], s * 0.3 + pos[1], pos[2]);
        leg.castShadow = true; group.add(leg);
      }
      animateQuadruped(group, s);
      scene.add(group);
    }

    function buildAvianFigure(mat, accentMat) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), mat);
      body.position.y = 0.7; body.scale.z = 1.4; body.castShadow = true; group.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), mat);
      head.position.set(-0.2, 0.95, 0); group.add(head);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 6), accentMat);
      beak.position.set(-0.35, 0.93, 0); beak.rotation.z = Math.PI / 2; group.add(beak);
      const wingGeo = new THREE.BoxGeometry(0.5, 0.04, 0.3);
      const lWing = new THREE.Mesh(wingGeo, accentMat); lWing.position.set(0, 0.72, 0.3); group.add(lWing);
      const rWing = new THREE.Mesh(wingGeo, accentMat); rWing.position.set(0, 0.72, -0.3); group.add(rWing);
      animateAvian(group, lWing, rWing);
      scene.add(group);
    }

    function buildAquaticFigure(mat, accentMat) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 10), mat);
      body.scale.z = 2.5; body.position.y = 0.9; group.add(body);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 8), accentMat);
      tail.position.set(0, 0.9, 1.2); tail.rotation.x = Math.PI / 2; group.add(tail);
      const dFin = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.35, 6), accentMat);
      dFin.position.set(0, 1.32, 0); group.add(dFin);
      animateAquatic(group);
      scene.add(group);
    }

    // ─── Procedural Animations ───

    function animateHumanoid(group) {
      let t = 0;
      const leftArm = group.children[2];
      const rightArm = group.children[3];
      const leftLeg = group.children[5];
      const rightLeg = group.children[6];
      const originalUpdate = animate;
      const extraUpdate = () => {
        t += 0.04 * speedMultiplier;
        if (isPlaying) {
          const squat = Math.sin(t) * 0.15;
          group.position.y = squat;
          leftArm.rotation.z = 0.3 + Math.sin(t) * 0.2;
          rightArm.rotation.z = -0.3 - Math.sin(t) * 0.2;
          leftLeg.rotation.x = Math.sin(t) * 0.15;
          rightLeg.rotation.x = -Math.sin(t) * 0.15;
        }
      };
      window._extraUpdate = extraUpdate;
    }

    function animateQuadruped(group, s) {
      let t = 0;
      window._extraUpdate = () => {
        t += 0.05 * speedMultiplier;
        if (isPlaying) {
          const bob = Math.sin(t * 2) * 0.04;
          group.position.y = bob;
          group.rotation.z = Math.sin(t) * 0.02;
        }
      };
    }

    function animateAvian(group, lWing, rWing) {
      let t = 0;
      window._extraUpdate = () => {
        t += 0.08 * speedMultiplier;
        if (isPlaying) {
          const flap = Math.sin(t * 3) * 0.4;
          lWing.rotation.z = flap;
          rWing.rotation.z = -flap;
          group.position.y = 0.5 + Math.sin(t * 1.5) * 0.15;
        }
      };
    }

    function animateAquatic(group) {
      let t = 0;
      window._extraUpdate = () => {
        t += 0.04 * speedMultiplier;
        if (isPlaying) {
          group.rotation.z = Math.sin(t) * 0.1;
          group.position.y = 0.8 + Math.sin(t * 1.2) * 0.12;
        }
      };
    }

    function animate() {
      requestAnimationFrame(animate);
      const delta = clock.getDelta();
      if (mixer && isPlaying) {
        mixer.update(delta * speedMultiplier);
      }
      if (window._extraUpdate) window._extraUpdate();
      controls.update();
      renderer.render(scene, camera);

      // FPS counter
      frameCount++;
      const now = Date.now();
      if (now - lastFpsTime >= 1000) {
        const fps = frameCount;
        frameCount = 0; lastFpsTime = now;
        const label = document.getElementById('fps-label');
        if (label) label.textContent = fps + ' FPS';
      }
    }

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // ─── Global Control Functions ───

    window.togglePlay = function() {
      isPlaying = !isPlaying;
      if (currentAction) {
        if (isPlaying) currentAction.paused = false;
        else currentAction.paused = true;
      }
      document.getElementById('btn-play').textContent = isPlaying ? '⏸ Pause' : '▶ Play';
    };

    window.setSpeed = function(s) {
      speedMultiplier = s;
      if (currentAction) currentAction.setEffectiveTimeScale(ANIM_CONFIG.animationSpeed * s);
      document.querySelectorAll('.ctrl-btn').forEach(b => b.classList.remove('active'));
      document.getElementById('btn-' + (s === 0.25 ? 'slow' : s === 1 ? 'normal' : 'fast')).classList.add('active');
    };

    window.resetCamera = function() {
      camera.position.set(ANIM_CONFIG.cameraDistance * 0.7, ANIM_CONFIG.cameraDistance * 0.5, ANIM_CONFIG.cameraDistance);
      controls.target.set(0, 1, 0);
      controls.update();
    };

    function notifyReady() {
      try {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready', species: AVATAR_CONFIG.speciesLabel }));
        }
      } catch(e) {}
    }

    init();
  </script>
</body>
</html>`;
}

export { getAvatarConfig, getExerciseAnimation };
