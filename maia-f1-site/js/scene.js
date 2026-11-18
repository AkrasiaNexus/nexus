import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Car space is millimetres: +X forward (nose), +Y up, +Z to the car's right.
// Paint per part follows the team's renders: green body, champagne aero and pods, charcoal wheels, titanium dome.
export const PARTS = {
  nose_cone: 'green', front_wing: 'gold', dome: 'titanium', halo: 'green', chassis: 'green', floor: 'green',
  sidepods_l: 'green', sidepods_r: 'green', rear_pods_l: 'gold', rear_pods_r: 'gold', rear_wing: 'gold',
  co2_canister: 'gold', rear_body: 'green',
  wheels_fl: 'charcoal', wheels_fr: 'charcoal', wheels_rl: 'charcoal', wheels_rr: 'charcoal',
};
export const PART_NAMES = Object.keys(PARTS);

const SCALE = 0.01; // mm -> scene units
const TARGET = new THREE.Vector3(0, 0.2, 0);

// The team's colour scheme (Enterprise portfolio, Team Identity page).
const BRAND = { green: 0x193b25, white: 0xf4f6f5, gold: 0xc6ae7c, charcoal: 0x1e201f, titanium: 0x8c8982 };

function paints() {
  const side = THREE.DoubleSide; // the chassis split leaves open edges; render both faces
  return {
    green: new THREE.MeshPhysicalMaterial({ side, color: BRAND.green, roughness: 0.34, metalness: 0.08, clearcoat: 0.6, clearcoatRoughness: 0.22 }),
    gold: new THREE.MeshPhysicalMaterial({ side, color: BRAND.gold, roughness: 0.3, metalness: 0.7, clearcoat: 0.3, clearcoatRoughness: 0.25 }),
    titanium: new THREE.MeshPhysicalMaterial({ side, color: BRAND.titanium, roughness: 0.25, metalness: 0.85, clearcoat: 0.5, clearcoatRoughness: 0.15 }),
    charcoal: new THREE.MeshStandardMaterial({ side, color: BRAND.charcoal, roughness: 0.62, metalness: 0.05 }),
  };
}

/** A soft pool of light on the studio floor plus a contact shadow under the car. */
function buildFloor() {
  const size = 512;
  const tex = (draw) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    draw(c.getContext('2d'));
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const radial = (stops) => tex((g) => {
    const r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([at, colour]) => r.addColorStop(at, colour));
    g.fillStyle = r;
    g.fillRect(0, 0, size, size);
  });
  const pool = radial([[0, 'rgba(46,58,50,0.55)'], [0.55, 'rgba(24,30,27,0.25)'], [1, 'rgba(0,0,0,0)']]);
  const shadow = radial([[0, 'rgba(0,0,0,0.85)'], [0.6, 'rgba(0,0,0,0.35)'], [1, 'rgba(0,0,0,0)']]);
  const group = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: pool, transparent: true, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2;
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.1), new THREE.MeshBasicMaterial({ map: shadow, transparent: true, depthWrite: false }));
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.002;
  group.add(floor, contact);
  return group;
}

/** Streamlines past the car, with particles riding them (chapter 03). */
function buildFlow(root) {
  const group = new THREE.Group();
  const lineMat = new THREE.LineBasicMaterial({ color: BRAND.titanium, transparent: true, opacity: 0, depthWrite: false });
  const dotMat = new THREE.MeshBasicMaterial({ color: BRAND.white, transparent: true, opacity: 0 });
  const dotGeo = new THREE.SphereGeometry(1.4, 8, 6);
  const streams = [];
  [10, 22, 36].forEach((y) => [-48, -40, 40, 48].forEach((z) => {
    const curve = new THREE.CatmullRomCurve3([
      [190, y, z * 0.5], [120, y + 2, z * 0.85], [40, y + 4, z * 1.05],
      [-40, y + 4, z * 1.08], [-120, y + 2, z], [-200, y, z * 0.9],
    ].map((p) => new THREE.Vector3(...p)));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(80)), lineMat));
    const dot = new THREE.Mesh(dotGeo, dotMat);
    group.add(dot);
    streams.push({ curve, dot, phase: streams.length / 12 });
  }));
  root.add(group);
  return (k, time) => {
    group.visible = k > 0.01;
    lineMat.opacity = 0.28 * k;
    dotMat.opacity = 0.9 * k;
    for (const s of streams) s.curve.getPointAt((time * 0.16 + s.phase) % 1, s.dot.position);
  };
}

export async function createCarScene(canvas, url) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.7;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const key = new THREE.DirectionalLight(0xfff0dc, 3.0);
  const rim = new THREE.DirectionalLight(0x5fd39a, 1.8);
  rim.position.set(-3, 2.2, -2.6);
  scene.add(key, rim, new THREE.HemisphereLight(0x3a4a42, 0x0b0c0c, 0.55));

  const floor = buildFloor();
  scene.add(floor);

  const root = new THREE.Group();
  root.scale.setScalar(SCALE);
  scene.add(root);

  const mats = paints();
  const gltf = await new GLTFLoader().loadAsync(url);
  const parts = {};
  gltf.scene.traverse((node) => {
    const paint = PARTS[node.name];
    if (!node.isMesh || !paint) return;
    const geo = node.geometry; // positions + crease-aware normals baked by the build script
    geo.computeBoundingBox();
    const centre = geo.boundingBox.getCenter(new THREE.Vector3());
    geo.translate(-centre.x, -centre.y, -centre.z); // each part's origin is its centre, for label anchors
    const group = new THREE.Group();
    group.position.copy(centre);
    group.add(new THREE.Mesh(geo, mats[paint]));
    root.add(group);
    parts[node.name] = group;
  });

  const flow = buildFlow(root);
  const scratch = new THREE.Vector3();

  function frame(s, time) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    camera.aspect = w / h;
    const portrait = camera.aspect < 0.9;
    // Phones are narrow: pull back so the whole car fits the width.
    const fit = Math.max(1, 1.15 / camera.aspect);
    const d = s.dist * fit;
    camera.position.set(
      TARGET.x + d * Math.cos(s.phi) * Math.cos(s.theta),
      TARGET.y + d * Math.sin(s.phi),
      TARGET.z + d * Math.cos(s.phi) * Math.sin(s.theta),
    );
    camera.lookAt(TARGET);
    // Desktop: the car sits beside the copy column. Phone: copy is a bottom sheet, so the car rides higher.
    // rise > 0 lifts the car in frame (to make room for panels below it), < 0 lowers it.
    if (portrait) camera.setViewOffset(w, h, 0, h * (0.16 + Math.max(0, s.rise) * 0.5), w, h);
    else camera.setViewOffset(w, h, -s.shift * w, s.rise * h, w, h);
    camera.updateProjectionMatrix();

    key.position.set(Math.cos(s.keyAngle) * 3.4, 3.2, Math.sin(s.keyAngle) * 3.4);
    renderer.toneMappingExposure = s.light * s.car; // the car recedes into the studio dark
    flow(s.flow, time);
    renderer.render(scene, camera);
  }

  function resize() {
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  }
  resize();

  return {
    frame,
    resize,
    /** Screen position (CSS px) of a part's centre, or null if it is behind the camera. */
    project(name) {
      const group = parts[name];
      if (!group) return null;
      group.getWorldPosition(scratch).project(camera);
      if (scratch.z > 1) return null;
      return { x: ((scratch.x + 1) / 2) * canvas.clientWidth, y: ((1 - scratch.y) / 2) * canvas.clientHeight };
    },
  };
}
