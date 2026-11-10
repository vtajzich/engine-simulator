import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const BG = 0x0c0e11;

export function createScene(host) {
  const canvas = document.createElement('canvas');
  canvas.className = 'gl';
  canvas.tabIndex = 0;
  host.prepend(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.localClippingEnabled = true;
  renderer.setClearColor(BG, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.9;

  const key = new THREE.DirectionalLight(0xfff1de, 1.7);
  key.position.set(500, 900, 900);
  const rim = new THREE.DirectionalLight(0x8fb4ff, 0.7);
  rim.position.set(-700, 300, -600);
  scene.add(key, rim, new THREE.HemisphereLight(0xaab6c8, 0x20242b, 0.45));

  // faint ground reference grid (below the lowest part, Y ≈ −140)
  const grid = new THREE.GridHelper(2400, 24, 0x2b313b, 0x1a1e25);
  grid.position.set(380, -175, 0);
  grid.material.transparent = true; grid.material.opacity = 0.55; grid.material.depthWrite = false;
  scene.add(grid);

  const camera = new THREE.PerspectiveCamera(36, 1, 5, 8000);
  camera.position.set(380, 360, 1380);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.target.set(370, 110, 0);
  controls.minDistance = 60;
  controls.maxDistance = 3500;
  controls.update();

  let dirty = true;
  controls.addEventListener('change', () => { dirty = true; });

  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    dirty = true;
  }
  new ResizeObserver(resize).observe(host);
  resize();

  // ---- camera tween
  let tween = null;
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function flyTo(view, duration = 1.2) {
    if (!view) return;
    if (duration <= 0) {
      camera.position.fromArray(view.position); controls.target.fromArray(view.target); controls.update(); dirty = true; tween = null; return;
    }
    tween = {
      t: 0, d: duration,
      p0: camera.position.clone(), t0: controls.target.clone(),
      p1: new THREE.Vector3().fromArray(view.position), t1: new THREE.Vector3().fromArray(view.target),
    };
  }
  function updateTween(dt) {
    if (!tween) return false;
    tween.t = Math.min(1, tween.t + dt / tween.d);
    const k = ease(tween.t);
    camera.position.lerpVectors(tween.p0, tween.p1, k);
    controls.target.lerpVectors(tween.t0, tween.t1, k);
    if (tween.t >= 1) tween = null;
    dirty = true;
    return true;
  }
  canvas.addEventListener('pointerdown', () => { tween = null; });
  canvas.addEventListener('wheel', () => { tween = null; }, { passive: true });

  return {
    renderer, scene, camera, controls, canvas, flyTo, updateTween,
    markDirty() { dirty = true; },
    consumeDirty() { const d = dirty; dirty = false; return d; },
    get tweening() { return !!tween; },
  };
}
