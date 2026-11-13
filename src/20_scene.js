// ===================================================================
// 20 · SCENE — 렌더러, 카메라, 재질(절단면 해칭), 형상 도우미, 부품 레지스트리
// ===================================================================

const $ = id => document.getElementById(id);
const canvas = $('gl'), viewEl = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.localClippingEnabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.environmentIntensity = 0.55;
}
scene.add(new THREE.HemisphereLight(0xdbe6ee, 0x1a2024, 0.55));
const keyLight = new THREE.DirectionalLight(0xfff4e6, 1.5); keyLight.position.set(6, 14, 12); scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x9fc4ff, 0.6); rimLight.position.set(-10, 6, -8); scene.add(rimLight);

const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 500);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.09;
controls.screenSpacePanning = true; controls.minDistance = 0.6; controls.maxDistance = 140;
controls.zoomSpeed = 0.9;

// ---- 절단면 ----
const CLIP = { plane: new THREE.Plane(new THREE.Vector3(0, 0, -1), 10), arr: [], axis: 'z', pos: 0, on: true };
function clipKeeps(p) { return !CLIP.arr.length || CLIP.plane.distanceToPoint(p) >= -1e-4; }

// ---- 재질 ----
const MAT = new Map();
const HOUSING_MATS = new Set(), PIPE_MATS = new Set();
function addCap(m) {
  m.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
      if (!gl_FrontFacing) {
        float h = step(0.55, fract((gl_FragCoord.x + gl_FragCoord.y) / 9.0));
        vec3 b = diffuseColor.rgb;
        vec3 cap = mix(b * 0.42 + vec3(0.30, 0.11, 0.08), b * 0.30 + vec3(0.17, 0.06, 0.05), h);
        gl_FragColor = vec4(cap, 1.0);
      }`);
  };
  m.customProgramCacheKey = () => 'cap-v1';
}
function mat(key, o = {}) {
  const k = key + (o.housing ? '|H' : '') + (o.pipe ? '|P' : '') + (o.noclip ? '|N' : '');
  if (MAT.has(k)) return MAT.get(k);
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(o.color ?? 0x8c959b), metalness: o.metal ?? 0.55, roughness: o.rough ?? 0.45,
    side: THREE.DoubleSide, emissive: new THREE.Color(o.emissive ?? 0x000000), emissiveIntensity: o.ei ?? 1,
    flatShading: !!o.flat,
  });
  if (o.opacity != null) { m.transparent = true; m.opacity = o.opacity; m.depthWrite = false; m.side = THREE.FrontSide; }
  if (!o.noclip) { m.clippingPlanes = CLIP.arr; addCap(m); }
  m.userData = { key: k, baseOpacity: o.opacity ?? 1, housing: !!o.housing, pipe: !!o.pipe };
  if (o.housing) HOUSING_MATS.add(m);
  if (o.pipe) PIPE_MATS.add(m);
  MAT.set(k, m); return m;
}
const C = {
  paint: 0x5d6b66, paintD: 0x48544f, paintL: 0x77857f, steel: 0x9aa3a8, steelD: 0x6e777c, steelL: 0xc3c9cc,
  cast: 0x5a5f61, brass: 0xc69a45, bronze: 0xa36d3a, ring: 0xb87a4a, stellite: 0xd9d2b8, rubber: 0x24282a,
  insul: 0xb9b4a6, cab: 0x3a4248, red: 0xb24a3a, blueS: 0x4f6f8c, yel: 0xa48a2c, pur: 0x6e528f, grn: 0x3f7a5f,
};

// ---- 형상 도우미 ----
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const V2 = (x, y) => new THREE.Vector2(x, y);
// (r, y) 단면을 반시계 방향으로 맞춰 바깥 면이 앞면이 되게 한다 (절단면 해칭이 뒷면에서만 그려지므로 필수)
function lathe(pts, seg = 48, start = 0, len = Math.PI * 2) {
  let q = pts.map(p => [Math.max(0, p[0]), p[1]]);
  const ring = q.concat([[0, q[q.length - 1][1]], [0, q[0][1]]]);
  let area = 0; for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; area += a[0] * b[1] - b[0] * a[1]; }
  if (area < 0) q = q.reverse();
  return new THREE.LatheGeometry(q.map(p => V2(p[0], p[1])), seg, start, len);
}
function ringG(rIn, rOut, y0, y1, seg = 48) { return lathe([[rIn, y0], [rOut, y0], [rOut, y1], [rIn, y1], [rIn, y0]], seg); }
function cylY(r, y0, y1, seg = 32, r2) { const g = new THREE.CylinderGeometry(r2 ?? r, r, y1 - y0, seg); g.translate(0, (y0 + y1) / 2, 0); return g; }
function cylZ(r, z0, z1, seg = 32) { const g = new THREE.CylinderGeometry(r, r, z1 - z0, seg); g.rotateX(Math.PI / 2); g.translate(0, 0, (z0 + z1) / 2); return g; }
function cylX(r, x0, x1, seg = 32) { const g = new THREE.CylinderGeometry(r, r, x1 - x0, seg); g.rotateZ(Math.PI / 2); g.translate((x0 + x1) / 2, 0, 0); return g; }
function ringZ(rIn, rOut, z0, z1, seg = 48) { const g = ringG(rIn, rOut, z0, z1, seg); g.rotateX(Math.PI / 2); return g; }
function ringX(rIn, rOut, x0, x1, seg = 48) { const g = ringG(rIn, rOut, x0, x1, seg); g.rotateZ(-Math.PI / 2); return g; }
function box(w, h, d, x = 0, y = 0, z = 0, r = 0.02) {
  const rr = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
  const g = rr > 0.002 ? new RoundedBoxGeometry(w, h, d, 2, rr) : new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z); return g;
}
function sphere(r, x = 0, y = 0, z = 0) { const g = new THREE.SphereGeometry(r, 28, 18); g.translate(x, y, z); return g; }
function shapeOf(pts, holes = []) {
  const s = new THREE.Shape(pts.map(p => V2(p[0], p[1])));
  holes.forEach(h => {
    const p = new THREE.Path();
    if (h.circle) p.absarc(h.circle[0], h.circle[1], h.circle[2], 0, Math.PI * 2, true);
    else { p.setFromPoints(h.map(q => V2(q[0], q[1]))); }
    s.holes.push(p);
  });
  return s;
}
function rrectPts(x0, y0, x1, y1, r, n = 6) {
  const pts = [], cs = [[x1 - r, y0 + r, -90], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180]];
  cs.forEach(([cx, cy, a0]) => { for (let i = 0; i <= n; i++) { const a = (a0 + 90 * i / n) * DEG; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } });
  return pts;
}
// XY 단면을 z 방향으로 압출
function extXY(shape, z0, z1, bevel = 0) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: z1 - z0, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 24 });
  g.translate(0, 0, z0); return g;
}
// XZ 평면도(x, z)를 y 방향으로 압출
function extXZ(shape, y0, y1) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false, curveSegments: 32 });
  g.rotateX(-Math.PI / 2); g.scale(1, 1, 1); g.translate(0, y0, 0);
  // rotateX(-90°): (sx, sy, d) → (sx, d, -sy). 평면도는 z = -sy 로 정의해 사용
  return g;
}
function xzShape(pts, holes = []) { return shapeOf(pts.map(p => [p[0], -p[1]]), holes.map(h => h.circle ? { circle: [h.circle[0], -h.circle[1], h.circle[2]] } : h.map(q => [q[0], -q[1]]))); }

// ---- 둥근 모서리 경로 (배관과 입자가 같은 곡선을 공유) ----
class Route {
  constructor(pts, rc = 0.18) {
    this.pts = pts.map(p => p.isVector3 ? p.clone() : V3(p[0], p[1], p[2]));
    const P = this.pts, cp = new THREE.CurvePath();
    let cur = P[0].clone();
    for (let i = 1; i < P.length - 1; i++) {
      const a = P[i - 1], b = P[i], c = P[i + 1];
      const l1 = b.distanceTo(a), l2 = c.distanceTo(b);
      if (l1 < 1e-6 || l2 < 1e-6) continue;
      const d1 = b.clone().sub(a).normalize(), d2 = c.clone().sub(b).normalize();
      if (d1.dot(d2) > 0.9995) continue;
      const d = Math.min(rc, l1 * 0.48, l2 * 0.48);
      const A = b.clone().addScaledVector(d1, -d), B = b.clone().addScaledVector(d2, d);
      if (A.distanceTo(cur) > 1e-5) cp.add(new THREE.LineCurve3(cur.clone(), A));
      cp.add(new THREE.QuadraticBezierCurve3(A, b.clone(), B));
      cur = B;
    }
    cp.add(new THREE.LineCurve3(cur.clone(), P[P.length - 1].clone()));
    this.curve = cp;
    this.length = cp.getLength();
    const n = Math.max(8, Math.ceil(this.length / 0.04));
    this.n = n; this.lut = new Float32Array((n + 1) * 3);
    const v = V3(0, 0, 0);
    for (let i = 0; i <= n; i++) { cp.getPointAt(i / n, v); this.lut.set([v.x, v.y, v.z], i * 3); }
  }
  at(u, out) {
    u = clamp(u, 0, 1); const x = u * this.n, i = Math.min(this.n - 1, Math.floor(x)), f = x - i, L = this.lut, j = i * 3;
    return out.set(L[j] + (L[j + 3] - L[j]) * f, L[j + 1] + (L[j + 4] - L[j + 1]) * f, L[j + 2] + (L[j + 5] - L[j + 2]) * f);
  }
  get start() { return this.pts[0]; }
  get end() { return this.pts[this.pts.length - 1]; }
}
function tubeG(route, r, radial = 12) { return new THREE.TubeGeometry(route.curve, Math.max(8, Math.ceil(route.length * 10)), r, radial, false); }

// ---- 부품 레지스트리 ----
// PARTS[id] = { id, ko, en, cat, desc, sys[], pos, inst: [{slot, cyl, meshes[]}], label }
const PARTS = {};
const PICKABLE = [];
const CATS = {
  struct: '구조물', moving: '운동부', comb: '연소실', air: '소기 계통', exh: '배기 계통',
  fuel: '연료 계통', ctrl: '제어유 · HCU', boiler: '보일러', aux: '계측 · 보조',
};
const CAT_VIS = Object.fromEntries(Object.keys(CATS).map(k => [k, true]));
function defPart(id, ko, en, cat, desc, sys = [], pos = 'img', extra = {}) {
  PARTS[id] = { id, ko, en, cat, desc, sys, pos, inst: [], visible: true, label: extra.label !== false, ...extra };
}
function slot(id, parent, cyl = null) {
  const P = PARTS[id]; if (!P) throw new Error('unknown part ' + id);
  const g = new THREE.Group(); g.name = id + (cyl != null ? '#' + (cyl + 1) : '');
  g.userData.part = id; g.userData.cyl = cyl;
  parent.add(g);
  const inst = { slot: g, cyl, meshes: [], proc: [] };
  P.inst.push(inst);
  return {
    g, inst,
    add(geo, m, name) {
      const mesh = new THREE.Mesh(geo, m);
      mesh.userData.part = id; mesh.userData.cyl = cyl; if (name) mesh.name = name;
      g.add(mesh); inst.meshes.push(mesh); inst.proc.push(mesh); PICKABLE.push(mesh);
      return mesh;
    },
  };
}

