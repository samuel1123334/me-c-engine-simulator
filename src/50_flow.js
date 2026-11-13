// ===================================================================
// 50 · FLOW — 입자·화살표·중심선. 이동량 = ∫ rate(θ) dθ 이므로 일시정지·수동 조절에서도 상태가 일관된다.
// 입자는 흐름 방향과 개폐 상태를 설명하는 표현이며 유체 해석 결과가 아니다.
// ===================================================================
const FLOW_ON = { air: true, fuel: true, comb: true, exh: true, oil: true, water: true, steam: true };
const FLOW_K = 0.010;   // rate 1일 때 크랭크 1°당 이동 거리 (m)
let dotTex;
function makeDotTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const FX = { groups: [], arrows: null, lines: [], cyl: [], tmp: V3(0, 0, 0), tmp2: V3(0, 0, 0) };
function pointsMat(clip, size = 0.085) {
  const m = new THREE.PointsMaterial({ size, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, alphaTest: 0.04, sizeAttenuation: true });
  if (clip) m.clippingPlanes = CLIP.arr; return m;
}
function buildFlows() {
  dotTex = makeDotTex();
  // 경로별 입자 개수 결정 후 (유체 × 절단 여부) 그룹으로 묶음
  const groups = {};
  PATHS.forEach(p => {
    p.n = Math.max(3, Math.round(p.route.length / p.spacing));
    const key = p.fluid + (p.clip ? '|c' : '|n');
    (groups[key] = groups[key] || { fluid: p.fluid, clip: p.clip, paths: [], count: 0 }).paths.push(p);
    p.offset = groups[key].count; groups[key].count += p.n;
  });
  Object.values(groups).forEach(G => {
    const geo = new THREE.BufferGeometry();
    G.pos = new Float32Array(G.count * 3); G.col = new Float32Array(G.count * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(G.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(G.col, 3).setUsage(THREE.DynamicDrawUsage));
    const pts = new THREE.Points(geo, pointsMat(G.clip, G.fluid === 'fuel' || G.fluid === 'oil' ? 0.065 : 0.085));
    pts.frustumCulled = false; pts.renderOrder = 5; ROOT.add(pts); G.obj = pts; G.geo = geo;
    FX.groups.push(G);
  });
  // 화살표: 원뿔 인스턴스 (유체별)
  const cone = new THREE.ConeGeometry(0.05, 0.16, 10); cone.rotateX(Math.PI / 2);
  FX.arrowSets = {};
  Object.keys(FLUID).forEach(f => {
    const ps = PATHS.filter(p => p.fluid === f && p.arrows);
    let n = 0; ps.forEach(p => { p.nA = Math.max(1, Math.floor(p.route.length / 1.4)); p.aOff = n; n += p.nA; });
    if (!n) return;
    const m = new THREE.MeshBasicMaterial({ color: FLUID[f].color, transparent: true, opacity: 0.95, depthWrite: false });
    if (ps.some(p => p.clip)) m.clippingPlanes = CLIP.arr;
    const im = new THREE.InstancedMesh(cone, m, n); im.frustumCulled = false; im.renderOrder = 6; ROOT.add(im);
    FX.arrowSets[f] = { im, paths: ps };
  });
  // 중심선 (유체별 선 형태)
  PATHS.forEach(p => {
    const g = new THREE.BufferGeometry().setFromPoints(Array.from({ length: p.route.n + 1 }, (_, i) => V3(p.route.lut[i * 3], p.route.lut[i * 3 + 1], p.route.lut[i * 3 + 2])));
    const st = FLUID[p.fluid].style;
    const m = st === 'solid' ? new THREE.LineBasicMaterial({ color: FLUID[p.fluid].color, transparent: true, opacity: 0.32, depthWrite: false })
      : new THREE.LineDashedMaterial({ color: FLUID[p.fluid].color, transparent: true, opacity: 0.75, depthWrite: false, dashSize: st === 'dash' ? 0.22 : 0.05, gapSize: st === 'dash' ? 0.12 : 0.1 });
    if (p.clip) m.clippingPlanes = CLIP.arr;
    const ln = new THREE.Line(g, m); if (st !== 'solid') ln.computeLineDistances(); ln.renderOrder = 4; ln.userData.fluid = p.fluid; ROOT.add(ln); FX.lines.push(ln);
  });
  buildCylFx();
}

// ---- 실린더 내부: 2D 단면 유동장 평면 + 유동장 색의 결정적 입자 + 연료 분무 ----
const NC = 90, NSP = 26;
const FIELD = { cur: null, prev: null, fade: 1, busy: false, pending: false, lastKey: '', worker: null, local: null, jobId: 0, status: '계산 대기', shownVersion: -1 };
const FIELD_VS = `
#include <common>
#include <clipping_planes_pars_vertex>
varying vec2 vXY;
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vXY = (modelMatrix * vec4(position, 1.0)).xy;
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}`;
const FIELD_FS = `
#include <common>
#include <clipping_planes_pars_fragment>
uniform sampler2D tex; uniform float crown, head, y0, bw, phase, show, shAir, shExh, shComb;
varying vec2 vXY;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
vec3 blackbody(float T) {     // 1000–2600 K 근사 흑체색
  float t = clamp((T - 1000.0) / 1600.0, 0.0, 1.0);
  vec3 c1 = vec3(0.55, 0.06, 0.02), c2 = vec3(1.0, 0.36, 0.05), c3 = vec3(1.0, 0.70, 0.30), c4 = vec3(1.0, 0.93, 0.78);
  return t < 0.33 ? mix(c1, c2, t / 0.33) : t < 0.66 ? mix(c2, c3, (t - 0.33) / 0.33) : mix(c3, c4, (t - 0.66) / 0.34);
}
void main() {
  #include <clipping_planes_fragment>
  if (vXY.y < crown || vXY.y > head || show < 0.5) discard;
  vec2 uv = vec2((vXY.x + bw * 0.5) / bw, (vXY.y - y0) / (head - y0));
  vec4 t = texture2D(tex, uv);
  float a = t.r; float T = 250.0 * exp(t.g * 2.4849); vec2 vel = (t.ba * 255.0 - 128.0) / 1.27;
  vec3 airC = vec3(0.13, 0.40, 0.98), burnC = vec3(0.60, 0.12, 0.10), neutral = vec3(0.16, 0.18, 0.20);
  vec3 c = mix(burnC * shExh + neutral * (1.0 - shExh), airC * shAir + neutral * (1.0 - shAir), a);
  float p0 = fract(phase), p1 = fract(phase + 0.5);
  float n0 = vnoise((vXY - vel * 0.0035 * p0) * vec2(26.0, 14.0));
  float n1 = vnoise((vXY - vel * 0.0035 * p1) * vec2(26.0, 14.0) + 17.3);
  float n = mix(n0, n1, abs(1.0 - 2.0 * p0));
  float spd = clamp(length(vel) / 45.0, 0.0, 1.0);
  c *= 0.72 + 0.6 * n * (0.25 + 0.75 * spd);
  float g = smoothstep(1050.0, 2300.0, T) * shComb;
  c = mix(c, blackbody(T), g * 0.92) + blackbody(T) * g * 0.45;
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
function buildCylFx() {
  const H = M.headY(), y0 = M.crownBDC();
  for (let k = 0; k < CFG.nCyl; k++) {
    const c = MOV.cyl[k];
    const mk = n => { const g = new THREE.BufferGeometry(); const pos = new Float32Array(n * 3), col = new Float32Array(n * 3); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return { g, pos, col }; };
    const charge = mk(NC), spray = mk(NSP * 2);
    const pc = new THREE.Points(charge.g, pointsMat(true, 0.07)); pc.frustumCulled = false; pc.renderOrder = 5; ROOT.add(pc);
    const ps = new THREE.Points(spray.g, pointsMat(true, 0.085)); ps.frustumCulled = false; ps.renderOrder = 7; ROOT.add(ps);
    const seeds = Array.from({ length: NC }, (_, i) => ({ u: (i + 0.5) / NC, rho: 0.285 * Math.sqrt(((i * 0.618034) % 1) * 0.95 + 0.02), ang: i * 2.39996 }));
    const sseeds = Array.from({ length: NSP }, (_, i) => ({ t: (i + 0.5) / NSP, a: i * 2.39996, s: ((i * 0.7548) % 1) }));
    // 단면 유동장 평면 (절단면 바로 뒤)
    const data = new Uint8Array(4 * 4 * 4);
    const tex = new THREE.DataTexture(data, 4, 4, THREE.RGBAFormat); tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
    const mat = new THREE.ShaderMaterial({
      uniforms: { tex: { value: tex }, crown: { value: 0 }, head: { value: H }, y0: { value: y0 }, bw: { value: CFG.bore }, phase: { value: 0 }, show: { value: 0 }, shAir: { value: 1 }, shExh: { value: 1 }, shComb: { value: 1 } },
      vertexShader: FIELD_VS, fragmentShader: FIELD_FS, side: THREE.DoubleSide, clipping: true,
    });
    mat.clippingPlanes = CLIP.arr;
    const pg = new THREE.PlaneGeometry(CFG.bore - 0.002, H - y0); pg.translate(0, (H + y0) / 2, c.z - 0.003);
    const plane = new THREE.Mesh(pg, mat); plane.renderOrder = 3;
    const cs = slot('combvol', ENG, k); cs.g.add(plane); plane.userData.part = 'combvol'; plane.userData.cyl = k; cs.inst.meshes.push(plane); cs.inst.proc.push(plane); PICKABLE.push(plane);
    FX.cyl.push({ k, c, charge, spray, pc, ps, seeds, sseeds, plane, mat, tex, data: null });
  }
}
const COL = { air: new THREE.Color(0x3d8bfd), fuel: new THREE.Color(0xf2c230), comb: new THREE.Color(0xff8a1f), exh: new THREE.Color(0xe5484d), oil: new THREE.Color(0xa46bf0), water: new THREE.Color(0x34c38f), steam: new THREE.Color(0xcfdde6), exhCold: new THREE.Color(0x7a2f2a), hot: new THREE.Color(0xffd2a0) };
const _c = new THREE.Color();

// ---- 유동장 계산 요청 · 수신 ----
function fieldInit() {
  try {
    const url = URL.createObjectURL(new Blob(['(' + FIELD_SIM.toString() + ')()'], { type: 'text/javascript' }));
    FIELD.worker = new Worker(url);
    FIELD.worker.onmessage = e => fieldReceive(e.data);
    FIELD.worker.onerror = () => { FIELD.worker = null; FIELD.busy = false; FIELD.status = '워커 오류 · 주 스레드에서 계산'; };
  } catch (e) { FIELD.worker = null; }
  FIELD.local = FIELD_SIM();
}
function fieldKeyNow() {
  const c = ENGS.cyc; if (!c) return '';
  const r = (x, q) => Math.round(x / q);
  return [SIM.state.rpm, r(SIM.state.load, 0.01), r(ENGS.ps, ENGS.ps * 0.015), r(ENGS.px, ENGS.px * 0.015), r(ENGS.Tx, 8), CFG.evo, CFG.evc, CFG.soi, CFG.injDur0, CFG.injDur1, CFG.portTopMM, CFG.ignDelay].join('|');
}
function fieldRequest() {
  const key = fieldKeyNow(); if (!key) return;
  if (key === FIELD.lastKey) return;
  if (FIELD.busy) { FIELD.pending = true; return; }
  FIELD.lastKey = key; FIELD.busy = true; FIELD.pending = false; FIELD.status = '유동장 계산 중…';
  const job = fieldJob(++FIELD.jobId, 1); job.warm = !!FIELD.cur; job.cycles = FIELD.cur ? 2 : 3;
  FIELD.t0 = performance.now();
  if (FIELD.worker) FIELD.worker.postMessage(job);
  else setTimeout(() => fieldReceive(FIELD.local(job)), 30);
}
function fieldReceive(r) {
  // 선회 누적각 (주기 보정: 한 사이클 회전량을 가장 가까운 정수 회전으로 맞춤)
  const rpm = SIM.state.rpm, dt = 1 / (6 * rpm), cum = new Float32Array(361);
  for (let d = 0; d < 360; d++) cum[d + 1] = cum[d] + r.omega[d] * dt;
  const tot = cum[360], tgt = Math.round(tot / (2 * Math.PI)) * 2 * Math.PI;
  for (let d = 0; d <= 360; d++) cum[d] += (tgt - tot) * d / 360;
  r.cum = cum; r.ms = Math.round(performance.now() - FIELD.t0);
  FIELD.prev = FIELD.cur; FIELD.cur = r; FIELD.fade = FIELD.prev ? 0 : 1; FIELD.busy = false;
  FIELD.status = `계산 완료 · ${r.NX}×${r.NY} 격자 · ${(r.ms / 1000).toFixed(1)} s`;
  FX.cyl.forEach(F => {
    if (!F.data || F.data.length !== r.NX * r.NY * 4) {
      F.data = new Uint8Array(r.NX * r.NY * 4);
      F.tex.dispose(); F.tex = new THREE.DataTexture(F.data, r.NX, r.NY, THREE.RGBAFormat);
      F.tex.magFilter = THREE.LinearFilter; F.tex.minFilter = THREE.LinearFilter; F.mat.uniforms.tex.value = F.tex;
    }
  });
  if (FIELD.pending) { FIELD.pending = false; fieldRequest(); }
}
// 크랭크각 th(실린더 기준)에서 유동장 값 채우기 (1° 스냅숏 선형 보간, 새 결과는 교차 페이드)
function fieldFill(F, th) {
  const r = FIELD.cur; if (!r) return false;
  const N4 = r.NX * r.NY * 4, x = wrap360(th), d0 = Math.floor(x) % 360, d1 = (d0 + 1) % 360, f = x - Math.floor(x);
  const A = r.snaps, o0 = d0 * N4, o1 = d1 * N4, out = F.data;
  const P = FIELD.prev && FIELD.fade < 1 && FIELD.prev.NX === r.NX && FIELD.prev.NY === r.NY ? FIELD.prev.snaps : null, g = FIELD.fade;
  for (let i = 0; i < N4; i++) {
    let v = A[o0 + i] + (A[o1 + i] - A[o0 + i]) * f;
    if (P) v = (P[o0 + i] + (P[o1 + i] - P[o0 + i]) * f) * (1 - g) + v * g;
    out[i] = v;
  }
  F.tex.needsUpdate = true;
  return true;
}
function fieldSample(F, x, y) {   // 채워진 텍스처에서 (x, y) 값 [a, T]
  const r = FIELD.cur, NX = r.NX, NY = r.NY;
  const fx = clamp((x + CFG.bore / 2) / CFG.bore * NX - 0.5, 0, NX - 1), fy = clamp((y - r.y0) / (r.hy * NY) * NY - 0.5, 0, NY - 1);
  const k = ((fy | 0) * NX + (fx | 0)) * 4;
  return [F.data[k] / 255, 250 * Math.exp(F.data[k + 1] / 255 * 2.4849)];
}
function swirlAngle(th) { const r = FIELD.cur; if (!r) return 0; const x = wrap360(th), d = Math.floor(x), f = x - d; return r.cum[d] + (r.cum[d + 1] - r.cum[d]) * f; }

function updateCylFx(F, th, load) {
  const c = F.c, z = c.z, H = M.headY(), crown = M.crownY(th);
  const has = fieldFill(F, th);
  const u = F.mat.uniforms;
  u.crown.value = crown; u.show.value = has && (FLOW_ON.air || FLOW_ON.exh || FLOW_ON.comb) ? 1 : 0;
  u.phase.value = wrap360(th) / 6; u.shAir.value = FLOW_ON.air ? 1 : 0; u.shExh.value = FLOW_ON.exh ? 1 : 0; u.shComb.value = FLOW_ON.comb ? 1 : 0;
  // 3D 입자: 단면 유동장 값을 축대칭으로 가정해 색을 정함 (선회 각도는 유동장 선회 속도 적분)
  const pos = F.charge.pos, col = F.charge.col, sw = swirlAngle(th);
  for (let i = 0; i < NC; i++) {
    const s = F.seeds[i], j = i * 3;
    if (!has) { pos[j + 1] = -50; col[j] = col[j + 1] = col[j + 2] = 0; continue; }
    const an = s.ang + sw, y = crown + 0.03 + s.u * (H - crown - 0.06), xr = s.rho * Math.cos(an), zr = s.rho * Math.sin(an);
    const [aa, T] = fieldSample(F, Math.sign(xr || 1) * s.rho, y);
    pos[j] = xr; pos[j + 1] = y; pos[j + 2] = z + zr;
    _c.copy(COL.exh).lerp(COL.air, aa);
    const g = smooth01((T - 1100) / 1200); if (g > 0) _c.lerp(COL.hot, g * 0.85);
    const vis = (aa > 0.5 ? FLOW_ON.air : FLOW_ON.exh) || (g > 0.1 && FLOW_ON.comb);
    if (!vis) { pos[j + 1] = -50; continue; }
    col[j] = _c.r; col[j + 1] = _c.g; col[j + 2] = _c.b;
  }
  F.charge.g.attributes.position.needsUpdate = true; F.charge.g.attributes.color.needsUpdate = true;
  // 연료 분무 — 분사 구간에만
  const sp = F.spray.pos, scol = F.spray.col, inj = M.inj01(th, load), since = M.injSince(th);
  for (let v = 0; v < 2; v++) {
    const fv = c.fv[v]; const pen = Math.min(1, since / 5) * 0.24;
    const d = fv.dir, up = Math.abs(d.y) < 0.9 ? V3(0, 1, 0) : V3(1, 0, 0);
    const e1 = V3().crossVectors(d, up).normalize(), e2 = V3().crossVectors(d, e1).normalize();
    for (let i = 0; i < NSP; i++) {
      const j = (v * NSP + i) * 3, s = F.sseeds[i];
      if (inj > 0 && FLOW_ON.fuel) {
        const t = s.t * pen, spread = t * 0.32 * s.s;
        sp[j] = fv.nozzle.x + d.x * t + (e1.x * Math.cos(s.a) + e2.x * Math.sin(s.a)) * spread;
        sp[j + 1] = fv.nozzle.y + d.y * t + (e1.y * Math.cos(s.a) + e2.y * Math.sin(s.a)) * spread;
        sp[j + 2] = fv.nozzle.z + d.z * t + (e1.z * Math.cos(s.a) + e2.z * Math.sin(s.a)) * spread;
        _c.copy(COL.fuel).multiplyScalar(0.6 + 0.4 * inj); scol[j] = _c.r; scol[j + 1] = _c.g; scol[j + 2] = _c.b;
      } else { sp[j] = 0; sp[j + 1] = -50; sp[j + 2] = 0; scol[j] = scol[j + 1] = scol[j + 2] = 0; }
    }
  }
  F.spray.g.attributes.position.needsUpdate = true; F.spray.g.attributes.color.needsUpdate = true;
}

// 이동량 = G(θ1) − G(θ0). 실린더 경로는 한 사이클 누적 적분표 G를 미리 만들어 두므로
// 재생(작은 간격)과 슬라이더 이동(한 번에 큰 간격)의 결과가 수치적으로 같다.
const GT = { n: 1440, key: '' };
function gateKey() { return [SIM.state.load.toFixed(4), CFG.evo, CFG.evc, CFG.soi, CFG.injDur0, CFG.injDur1, CFG.portTopMM, ENGS.version].join('|'); }
function buildGateTables() {
  const n = GT.n, h = 360 / n;
  for (const p of PATHS) {
    if (p.cyl == null) continue;
    const G = new Float64Array(n + 1); let acc = 0;
    for (let i = 0; i < n; i++) { G[i] = acc; const a = i * h; acc += (p.rate(a) + 4 * p.rate(a + h / 2) + p.rate(a + h)) / 6 * h; }
    G[n] = acc; p.G = G; p.cycle = acc;
  }
  GT.key = gateKey();
}
function cumAt(p, x) {
  const c = Math.floor(x / 360), r = x - c * 360, f = r / 360 * GT.n, i = Math.min(GT.n - 1, Math.floor(f)), t = f - i;
  return c * p.cycle + p.G[i] + (p.G[i + 1] - p.G[i]) * t;
}
function advanceFlows(T0, T1) {
  const d = T1 - T0; if (Math.abs(d) < 1e-9) return;
  if (GT.key !== gateKey()) buildGateTables();
  const offs = cylOffsets();
  for (const p of PATHS) {
    if (p.cyl != null) { const o = offs[p.cyl]; p.phase += (cumAt(p, T1 - o) - cumAt(p, T0 - o)) * FLOW_K; p.lastRate = p.rate(T1 - o); }
    else { const r = p.rate(0); p.phase += r * d * FLOW_K; p.lastRate = r; }
  }
}
function updateFlows(T) {
  const offs = cylOffsets();
  for (const G of FX.groups) {
    const on = FLOW_ON[G.fluid]; G.obj.visible = on;
    if (!on) continue;
    const base = COL[G.fluid];
    for (const p of G.paths) {
      const L = p.route.length, n = p.n;
      const sh = ((p.phase / L) % 1 + 1) % 1;
      for (let i = 0; i < n; i++) {
        const u = (i / n + sh) % 1, j = (p.offset + i) * 3;
        p.route.at(u, FX.tmp);
        G.pos[j] = FX.tmp.x; G.pos[j + 1] = FX.tmp.y; G.pos[j + 2] = FX.tmp.z;
        _c.copy(base);
        if (p.tint) {
          if (p.tint.steam) { const t = p.tint.mix ?? smooth01((FX.tmp.y - p.tint.y0) / (p.tint.y1 - p.tint.y0)); _c.lerp(COL.steam, t * 0.85); }
          else { const t = smooth01((FX.tmp.y - p.tint.y0) / (p.tint.y1 - p.tint.y0)); _c.lerp(COL.exhCold, t); }
        }
        const dim = p.cyl != null && Math.abs(p.lastRate) < 1e-4 ? 0.45 : 1;   // 정지 유체는 흐리게
        G.col[j] = _c.r * dim; G.col[j + 1] = _c.g * dim; G.col[j + 2] = _c.b * dim;
      }
    }
    G.geo.attributes.position.needsUpdate = true; G.geo.attributes.color.needsUpdate = true;
  }
  // 화살표
  const q = new THREE.Quaternion(), m4 = new THREE.Matrix4(), sc = V3(1, 1, 1), zf = V3(0, 0, 1);
  for (const f in FX.arrowSets) {
    const A = FX.arrowSets[f]; A.im.visible = FLOW_ON[f];
    if (!FLOW_ON[f]) continue;
    for (const p of A.paths) {
      const L = p.route.length, sh = ((p.phase / L) % 1 + 1) % 1, sign = p.lastRate < 0 ? -1 : 1;
      const still = Math.abs(p.lastRate) < 1e-4;
      for (let i = 0; i < p.nA; i++) {
        const uu = (((i + 0.5) / p.nA + sh) % 1);
        p.route.at(uu, FX.tmp); p.route.at(Math.min(1, uu + 0.01), FX.tmp2);
        const dir = FX.tmp2.clone().sub(FX.tmp); if (dir.lengthSq() < 1e-10) { p.route.at(Math.max(0, uu - 0.01), FX.tmp2); dir.copy(FX.tmp).sub(FX.tmp2); }
        dir.normalize().multiplyScalar(sign);
        q.setFromUnitVectors(zf, dir);
        const s = (still ? 0.55 : 1) * (p.spacing < 0.11 ? 0.55 : 1); sc.set(s, s, s);
        m4.compose(FX.tmp, q, sc); A.im.setMatrixAt(p.aOff + i, m4);
      }
    }
    A.im.instanceMatrix.needsUpdate = true;
  }
  FX.lines.forEach(l => { l.visible = FLOW_ON[l.userData.fluid]; });
  const load = SIM.state.load;
  for (const F of FX.cyl) updateCylFx(F, T - offs[F.k], load);
}

