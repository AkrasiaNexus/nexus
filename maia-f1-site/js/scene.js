import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

// Explode vectors in car space (mm): +X forward, +Y up, +Z right.
// `dir` is the direction, `mm` the distance at full explode.
export const PARTS = {
  nose_cone:    { dir: [1, 0.05, 0], mm: 45 },
  front_wing:   { dir: [1, 0.25, 0], mm: 60 },
  halo:         { dir: [0, 1, 0], mm: 80 },
  cockpit:      { dir: [-0.1, 1, 0], mm: 40 },
  monocoque:    { dir: [0, 0, 0], mm: 0 },
  sidepods_l:   { dir: [0, 0.1, -1], mm: 60 },
  sidepods_r:   { dir: [0, 0.1, 1], mm: 60 },
  floor:        { dir: [0, -0.4, 0], mm: 30 },
  engine_cover: { dir: [-1, 0.7, 0], mm: 50 },
  rear_wing:    { dir: [-1, 0.9, 0], mm: 55 },
  drs_flap:     { dir: [-1, 1, 0], mm: 75 },
  rear_pods_l:  { dir: [-0.4, 0, -1], mm: 55 },
  rear_pods_r:  { dir: [-0.4, 0, 1], mm: 55 },
  wheels_fl:    { dir: [0.3, 0, -1], mm: 80 },
  wheels_fr:    { dir: [0.3, 0, 1], mm: 80 },
  wheels_rl:    { dir: [-0.4, 0, -1], mm: 90 },
  wheels_rr:    { dir: [-0.4, 0, 1], mm: 90 },
};
export const PART_NAMES = Object.keys(PARTS);

const DEG = Math.PI / 180;
const SCALE = 0.01; // mm -> scene units; the car is 2.27 units long
const TARGET = new THREE.Vector3(0, 0.2, 0);
const GOLD = 0xd8b66b;
const EMERALD = 0x2fbf7a;

const SIDES = { side: THREE.DoubleSide }; // the STL shells are not consistently wound
const MATERIALS = {
  body: new THREE.MeshStandardMaterial({ ...SIDES, color: 0x163a2a, metalness: 0.15, roughness: 0.6 }),
  wing: new THREE.MeshStandardMaterial({ ...SIDES, color: 0xb59456, metalness: 0.7, roughness: 0.42 }),
  halo: new THREE.MeshStandardMaterial({ ...SIDES, color: 0x9ca4ae, metalness: 0.9, roughness: 0.35 }),
  wheel: new THREE.MeshStandardMaterial({ ...SIDES, color: 0x141518, metalness: 0.05, roughness: 0.8 }),
};

function materialFor(name) {
  if (name === 'halo') return MATERIALS.halo;
  if (name.startsWith('wheels')) return MATERIALS.wheel;
  if (name.includes('wing') || name.includes('flap') || name === 'front_wing') return MATERIALS.wing;
  return MATERIALS.body;
}

// Air streamlines around the car, plus particles that travel along them.
function buildFlow(root) {
  const group = new THREE.Group();
  group.visible = false;
  const lineMat = new THREE.LineBasicMaterial({ color: EMERALD, transparent: true, opacity: 0, depthWrite: false });
  const dotMat = new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0 });
  const dotGeo = new THREE.SphereGeometry(1.8, 10, 8);
  const streams = [];
  const bands = [14, 28];
  const lanes = [-46, -36, -26, 26, 36, 46];
  bands.forEach((y) => lanes.forEach((z) => {
    const curve = new THREE.CatmullRomCurve3([
      [175, y, z], [110, y + 3, z * 1.03], [40, y + 5, z * 1.08],
      [-40, y + 4, z * 1.1], [-110, y + 2, z * 1.04], [-175, y, z],
    ].map((p) => new THREE.Vector3(...p)));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(90)), lineMat));
    const dot = new THREE.Mesh(dotGeo, dotMat);
    group.add(dot);
    streams.push({ curve, dot, phase: streams.length / (bands.length * lanes.length) });
  }));
  root.add(group);

  return {
    update(s, time) {
      group.visible = s.flow > 0.01;
      lineMat.opacity = 0.32 * s.flow;
      dotMat.opacity = s.flow;
      for (const { curve, dot, phase } of streams) {
        curve.getPointAt((time * 0.12 + phase) % 1, dot.position);
      }
    },
  };
}

/** Builds the renderer, lights and the named car parts. Resolves once the GLB is loaded. */
export async function createCarScene(canvas, url) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 1.0;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  const root = new THREE.Group();
  root.scale.setScalar(SCALE);
  scene.add(root);

  const key = new THREE.DirectionalLight(0xfff1dc, 3.4);
  const rim = new THREE.DirectionalLight(EMERALD, 2.4);
  rim.position.set(-3, 2, -3);
  scene.add(key, rim, new THREE.HemisphereLight(0x3a4456, 0x0b0c0e, 0.9));

  const grid = new THREE.GridHelper(12, 120, 0x2b3038, 0x171b21);
  grid.material.transparent = true;
  grid.material.opacity = 0.55;
  grid.position.y = -0.02; // just under the wheels, so it does not cut the body
  scene.add(grid);

  const gltf = await new GLTFLoader().loadAsync(url);
  const parts = {};
  gltf.scene.traverse((node) => {
    if (!node.isMesh || !PARTS[node.name]) return;
    let geo = toCreasedNormals(node.geometry.toNonIndexed(), 60 * DEG);
    geo.computeBoundingBox();
    const centre = new THREE.Vector3();
    geo.boundingBox.getCenter(centre);
    geo.translate(-centre.x, -centre.y, -centre.z);

    const group = new THREE.Group();
    group.position.copy(centre);
    group.add(new THREE.Mesh(geo, materialFor(node.name)));
    const edgeMat = new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0, depthWrite: false });
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), edgeMat);
    group.add(edges);
    root.add(group);

    const { dir, mm } = PARTS[node.name];
    parts[node.name] = {
      group,
      base: centre,
      offset: new THREE.Vector3(...dir).multiplyScalar(mm),
      edgeMat,
      edges,
    };
  });

  const flow = buildFlow(root);

  function update(s, time) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const portrait = w / h < 0.9;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    // orbit: theta 0 = nose-on, PI/2 = right side, PI = tail-on
    const theta = s.theta + s.dragTheta;
    const phi = THREE.MathUtils.clamp(s.phi + s.dragPhi, -0.15, 1.45);
    const fit = Math.max(1, 1.1 / camera.aspect) * (portrait ? 1 + 0.35 * s.lift : 1); // blueprint is wider
    const d = s.dist * fit;
    camera.position.set(
      TARGET.x + d * Math.cos(phi) * Math.cos(theta),
      TARGET.y + d * Math.sin(phi),
      TARGET.z + d * Math.cos(phi) * Math.sin(theta),
    );
    camera.lookAt(TARGET);
    // Chapter text sits left or right, so push the car into the open side.
    // On phones the text is a bottom sheet, so lift the car instead.
    if (portrait) camera.setViewOffset(w, h, 0, h * (0.14 - 0.3 * s.lift), w, h); // text sits at the bottom, or the top in the blueprint
    else camera.setViewOffset(w, h, -s.shift * w, -s.lift * h * 0.2, w, h);

    root.rotation.y = s.spin;
    for (const p of Object.values(parts)) {
      p.edgeMat.opacity = 0.42 * s.blueprint;
      p.edges.visible = s.blueprint > 0.01; // skip drawing the blueprint lines when hidden
    }
    for (const [name, p] of Object.entries(parts)) {
      const k = s.explode[name] ?? 0;
      p.group.position.copy(p.base).addScaledVector(p.offset, k);
    }
    parts.drs_flap.group.rotation.z = -0.6 * s.drs;

    key.position.set(THREE.MathUtils.lerp(-3, 3, s.sweep), 3, 2.6);
    renderer.toneMappingExposure = s.light;
    flow.update(s, time);

    root.updateMatrixWorld(true);
    renderer.render(scene, camera);
  }

  function resize() {
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  }

  resize();
  return {
    camera,
    update,
    resize,
    anchor(name) {
      return parts[name].group.getWorldPosition(new THREE.Vector3());
    },
  };
}
