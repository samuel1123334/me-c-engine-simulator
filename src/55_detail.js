// ===================================================================
// 55 · DETAIL VIEW — 기기 내부 구조 보기 (별도 3D 장면, 절단면 해칭, 내부 부품 라벨, 엔진 상태와 동기된 동작·유동)
// 좌표: Y 위, 기기 크기 약 2 단위(축소 모형), 절단면 z = 0 (z ≤ 0 쪽만 남김)
// ===================================================================
const DV = {
  open: null, scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(30, 1, 0.01, 200), ctrl: null,
  plane: new THREE.Plane(new THREE.Vector3(0, 0, -1), 0), planes: [], cut: true, root: null,
  picks: [], flows: [], labels: [], sel: null, dev: null, api: null, mats: [], anim: null, spin: 0, lastSel: null,
};
const DEVICES = {}, DEV_OF = {};
function defDevice(id, spec) { DEVICES[id] = { id, ...spec }; (spec.parts || []).forEach(p => { DEV_OF[p] = id; }); }
function detailInit() {
  DV.scene.environment = scene.environment; DV.scene.environmentIntensity = 0.7;
  DV.scene.add(new THREE.HemisphereLight(0xdbe6ee, 0x1a2024, 0.6));
  const k = new THREE.DirectionalLight(0xfff4e6, 1.6); k.position.set(4, 7, 9); DV.scene.add(k);
  const r = new THREE.DirectionalLight(0x9fc4ff, 0.5); r.position.set(-6, 3, -4); DV.scene.add(r);
  DV.ctrl = new OrbitControls(DV.cam, canvas); DV.ctrl.enabled = false; DV.ctrl.enableDamping = true; DV.ctrl.dampingFactor = 0.1; DV.ctrl.screenSpacePanning = true;
  DV.planes = [DV.plane];
}
// ---- 재질: 절단면은 뒷면 해칭으로 표시 ----
function dmat(color, o = {}) {
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), metalness: o.metal ?? 0.55, roughness: o.rough ?? 0.42, side: THREE.DoubleSide, emissive: new THREE.Color(o.emissive ?? 0), emissiveIntensity: o.ei ?? 1 });
  if (o.opacity != null) { m.transparent = true; m.opacity = o.opacity; m.depthWrite = false; }
  if (!o.nocut) { m.clippingPlanes = DV.cut ? DV.planes : []; if (o.opacity == null) addCap(m); }
  m.userData.base = { emissive: m.emissive.getHex(), ei: m.emissiveIntensity, nocut: !!o.nocut };
  DV.mats.push(m); return m;
}
const FLC = { air: 0x3d8bfd, fuel: 0xf2c230, oil: 0xa46bf0, exh: 0xe5484d, water: 0x34c38f, steam: 0xcfdde6, gas: 0xeef3f6, dirt: 0x8a5a2b, comb: 0xff8a1f, oilLo: 0x7d5bb0 };
// 내부 유체가 차 있는 공간 (반투명, 절단면으로 잘림)
function dfluid(parent, geo, fluid, opacity = 0.22) {
  const m = new THREE.MeshStandardMaterial({ color: FLC[fluid] ?? fluid, transparent: true, opacity, depthWrite: false, metalness: 0, roughness: 1, side: THREE.DoubleSide });
  m.clippingPlanes = DV.cut ? DV.planes : []; const mesh = new THREE.Mesh(geo, m); mesh.renderOrder = 2; parent.add(mesh); DV.mats.push(m); return mesh;
}
// 이름이 있는 내부 부품 (클릭·라벨 대상)
function dpart(parent, geo, color, info, o = {}) {
  const mesh = new THREE.Mesh(geo, dmat(color, o)); parent.add(mesh);
  if (info) { mesh.userData.dinfo = info; DV.picks.push(mesh); if (info.label !== false) DV.labels.push({ mesh, info, anchor: o.anchor ? V3(...o.anchor) : null }); }
  return mesh;
}
// 여러 형상을 한 부품으로
function dgroup(parent, info, o = {}) { const g = new THREE.Group(); parent.add(g); if (info) { g.userData.dinfo = info; if (info.label !== false) DV.labels.push({ mesh: g, info, anchor: o.anchor ? V3(...o.anchor) : null }); } return g; }
function dadd(g, geo, color, o = {}) { const m = new THREE.Mesh(geo, dmat(color, o)); g.add(m); if (g.userData.dinfo) { m.userData.dinfo = g.userData.dinfo; m.userData.dgroup = g; DV.picks.push(m); } return m; }
// 유동 입자: 경로를 따라 이동, rate(st)가 0이면 정지·흐림, 음수면 역방향
function dflow(parent, pts, fluid, rate, o = {}) {
  const route = new Route(pts.map(p => V3(...p)), o.rc ?? 0.04);
  const n = Math.max(4, Math.round(route.length / (o.sp ?? 0.06)));
  const g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ size: o.size ?? 0.045, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, alphaTest: 0.04, sizeAttenuation: true });
  if (!o.nocut) m.clippingPlanes = DV.cut ? DV.planes : []; else m.userData.base = { nocut: true };
  const pts3 = new THREE.Points(g, m); pts3.frustumCulled = false; pts3.renderOrder = 6; parent.add(pts3); DV.mats.push(m);
  const f = { route, n, g, pos, col, phase: Math.random(), rate, fluid, color: new THREE.Color(FLC[fluid] ?? fluid), colorFn: o.colorFn, hideZero: !!o.hideZero, speed: o.speed ?? 1, obj: pts3, jitter: o.jitter ?? 0, last: 0 };
  DV.flows.push(f); return f;
}
const _dc = new THREE.Color(), _dv = V3(0, 0, 0);
function dflowTick(st) {
  for (const f of DV.flows) {
    const r = f.rate(st); f.last = r; if (f.hideZero) { f.obj.visible = Math.abs(r) > 1e-4; if (!f.obj.visible) continue; }
    f.phase += r * st.dtVis * f.speed * 0.5 / Math.max(0.2, f.route.length);
    const sh = ((f.phase % 1) + 1) % 1, dim = Math.abs(r) < 1e-4 ? 0.28 : 1;
    for (let i = 0; i < f.n; i++) {
      const u = (i / f.n + sh) % 1; f.route.at(u, _dv);
      if (f.jitter) { const s = Math.sin(i * 12.9898) * 43758.5453, j = (s - Math.floor(s) - 0.5) * f.jitter; _dv.x += j; _dv.y += j * 0.6; }
      f.pos[i * 3] = _dv.x; f.pos[i * 3 + 1] = _dv.y; f.pos[i * 3 + 2] = _dv.z;
      _dc.copy(f.colorFn ? f.colorFn(u, st) : f.color).multiplyScalar(dim);
      f.col[i * 3] = _dc.r; f.col[i * 3 + 1] = _dc.g; f.col[i * 3 + 2] = _dc.b;
    }
    f.g.attributes.position.needsUpdate = true; f.g.attributes.color.needsUpdate = true;
  }
}
// 나선 (스크루 로터, 스프링 등)
function helixTube(r, pitch, y0, y1, tubeR, phase = 0, seg = 220) {
  const turns = (y1 - y0) / pitch, pts = [];
  for (let i = 0; i <= seg; i++) { const t = i / seg, a = phase + t * turns * Math.PI * 2; pts.push(V3(r * Math.cos(a), y0 + (y1 - y0) * t, r * Math.sin(a))); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, tubeR, 8, false);
}
function springG(r, y0, y1, coils, wire) { return helixTube(r, (y1 - y0) / coils, y0, y1, wire, 0, Math.max(80, coils * 24)); }
// 축 방향 바꾸기: Y축 형상을 X축으로 (+Y → +X)
const toX = g => { g.rotateZ(-Math.PI / 2); return g; };
const toZ = g => { g.rotateX(Math.PI / 2); return g; };
// 원형 플랜지 (Y축)
function flangeY(r, y0, y1, rIn = 0) { return rIn > 0 ? ringG(rIn, r, y0, y1, 40) : cylY(r, y0, y1, 40); }
// 다이얼 게이지 문자판 텍스처
function gaugeTex(label, lo, hi, unit) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#e9e5d8'; g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#222'; g.lineWidth = 3; g.font = '22px IBM Plex Mono, monospace'; g.fillStyle = '#222'; g.textAlign = 'center';
  for (let i = 0; i <= 10; i++) { const a = (-225 + 270 * i / 10) * DEG; g.beginPath(); g.moveTo(128 + 100 * Math.cos(a), 128 + 100 * Math.sin(a)); g.lineTo(128 + (i % 5 ? 88 : 80) * Math.cos(a), 128 + (i % 5 ? 88 : 80) * Math.sin(a)); g.stroke(); if (i % 5 === 0) g.fillText(String(Math.round(lo + (hi - lo) * i / 10)), 128 + 64 * Math.cos(a), 136 + 64 * Math.sin(a)); }
  g.font = '20px IBM Plex Sans KR, sans-serif'; g.fillText(label, 128, 190); g.font = '18px IBM Plex Mono, monospace'; g.fillText(unit, 128, 214);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// 지침식 게이지: 반환값 set(v)로 바늘 이동 (z+ 방향을 향하는 문자판)
function dgauge(parent, x, y, z, R, label, lo, hi, unit, info) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const face = new THREE.Mesh(new THREE.CircleGeometry(R, 40), new THREE.MeshBasicMaterial({ map: gaugeTex(label, lo, hi, unit) })); face.position.z = 0.012; g.add(face);
  const rim = new THREE.Mesh(toZ(ringG(R, R * 1.12, -0.03, 0.02, 40)), dmat(0x9aa3a8, { nocut: true })); g.add(rim);
  const back = new THREE.Mesh(toZ(cylY(R * 1.05, -0.06, -0.03, 40)), dmat(0x3a4248, { nocut: true })); g.add(back);
  const nd = new THREE.Mesh(new THREE.BoxGeometry(R * 0.06, R * 0.8, 0.01), new THREE.MeshBasicMaterial({ color: 0xc0392b })); nd.geometry.translate(0, R * 0.4, 0);
  const piv = new THREE.Group(); piv.position.z = 0.02; piv.add(nd); g.add(piv);
  if (info) { face.userData.dinfo = info; DV.picks.push(face); DV.labels.push({ mesh: g, info, anchor: null }); }
  return { g, set(v) { const t = clamp((v - lo) / (hi - lo), 0, 1); piv.rotation.z = -(-135 + 270 * t) * DEG; } };
}

// ---- 열기 · 닫기 ----
function detailClear() {
  if (DV.root) { DV.scene.remove(DV.root); DV.root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  DV.mats.forEach(m => { if (m.map && m.map.isCanvasTexture) m.map.dispose(); m.dispose(); });
  DV.mats = []; DV.picks = []; DV.flows = []; DV.labels = []; DV.sel = null; $('dlabels').innerHTML = ''; DV.lbl = new Map();
}
function detailOpen(id) {
  const spec = DEVICES[id]; if (!spec) return;
  detailClear();
  DV.open = id; DV.dev = spec; DV.cut = spec.cutDefault ?? true;
  DV.root = new THREE.Group(); DV.scene.add(DV.root);
  DV.api = spec.build(DV.root) || {};
  // 카메라
  DV.cam.aspect = Math.max(10, viewEl.clientWidth) / Math.max(10, viewEl.clientHeight); DV.cam.updateProjectionMatrix();
  const box3 = new THREE.Box3().setFromObject(DV.root), sph = box3.getBoundingSphere(new THREE.Sphere());
  const dir = spec.view ? V3(...spec.view.d).normalize() : V3(0.35, 0.28, 1).normalize();
  const fv = DV.cam.fov * DEG, fh = 2 * Math.atan(Math.tan(fv / 2) * DV.cam.aspect), f = Math.min(fv, fh);
  const R = sph.radius / Math.sin(f / 2) * (spec.fit ?? 0.9);
  const tgt = sph.center.clone(); tgt.y -= sph.radius * 0.16;      // 아래 재생 막대만큼 위로 올려 보이게
  DV.cam.position.copy(tgt).addScaledVector(dir, R); DV.ctrl.target.copy(tgt); DV.home = { p: DV.cam.position.clone(), t: tgt.clone() };
  controls.enabled = false; DV.ctrl.enabled = true;
  $('dview').hidden = false; viewEl.classList.add('detail'); $('app').classList.add('detail'); $('dlabels').hidden = false;
  $('dvTitle').textContent = spec.ko; $('dvSub').textContent = spec.en + ' · ' + spec.sys;
  $('dvPrin').innerHTML = spec.principle;
  $('dvSrc').innerHTML = spec.sources.map(s => `<li>${tag(s.t)} ${s.url ? `<a href="${s.url}" target="_blank" rel="noopener">${s.text}</a>` : s.text}</li>`).join('');
  $('dvParts').innerHTML = DV.labels.map((L, i) => `<button class="dp" data-i="${i}"><b>${L.info.ko}</b><i>${L.info.en || ''}</i></button>`).join('');
  $('dvCtl').innerHTML = spec.controls ? spec.controls() : '';
  if (spec.bind) spec.bind(DV.api);
  $('dvCutBtn').classList.toggle('on', DV.cut);
  detailSelect(null); $('dpane').scrollTop = 0; $('app').querySelector('.pane.left').scrollTop = 0;
  resize();
}
function detailClose() {
  DV.open = null; DV.dev = null; detailClear();
  controls.enabled = true; DV.ctrl.enabled = false;
  $('dview').hidden = true; viewEl.classList.remove('detail'); $('app').classList.remove('detail'); $('dlabels').hidden = true;
  renderInfo();
}
function detailSetCut(on) {
  DV.cut = on; $('dvCutBtn').classList.toggle('on', on);
  DV.mats.forEach(m => { if (m.userData.base && m.userData.base.nocut) return; m.clippingPlanes = on ? DV.planes : []; m.needsUpdate = true; });
}
function detailSelect(L) {
  if (DV.sel) DV.sel.traverse(o => { if (o.material && o.material.userData.base) { o.material.emissive.setHex(o.material.userData.base.emissive); o.material.emissiveIntensity = o.material.userData.base.ei; } });
  DV.sel = L ? L.mesh : null;
  document.querySelectorAll('#dvParts .dp').forEach(b => b.classList.toggle('on', L && DV.labels[+b.dataset.i] === L));
  if (L) {
    L.mesh.traverse(o => { if (o.material && o.material.emissive && o.material.userData.base) { o.material.emissive.setHex(0x6b5a2a); o.material.emissiveIntensity = 0.8; } });
    $('dvSel').innerHTML = `<h3>${L.info.ko}</h3><div class="en">${L.info.en || ''}</div><p>${L.info.d || ''}</p>`;
  } else $('dvSel').innerHTML = '<p class="empty">내부 부품을 클릭하거나 목록에서 고르면 역할이 표시됩니다.</p>';
}
function detailPick(cx, cy) {
  const rect = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
  ray.setFromCamera(ndc, DV.cam);
  const hits = ray.intersectObjects(DV.picks, false).filter(h => !DV.cut || h.object.material.userData.base?.nocut || DV.plane.distanceToPoint(h.point) >= -1e-4);
  if (!hits.length) { detailSelect(null); return; }
  const o = hits[0].object, g = o.userData.dgroup || o, L = DV.labels.find(l => l.mesh === g);
  detailSelect(L || { mesh: g, info: o.userData.dinfo });
}
// ---- 매 프레임 ----
function detailTick(dt, st) {
  if (DV.api.update) DV.api.update(st);
  dflowTick(st);
  DV.ctrl.update();
  if ((DV.tick = (DV.tick || 0) + 1) % 4 === 0 && DV.dev.readouts) $('dvKv').innerHTML = DV.dev.readouts(st);
}
function detailLabels() {
  const W = viewEl.clientWidth, H = viewEl.clientHeight, placed = [], v = V3(), box3 = new THREE.Box3();
  const cont = $('dlabels');
  DV.labels.forEach((L, i) => {
    let el = DV.lbl.get(L);
    if (!el) { el = document.createElement('div'); el.className = 'lbl'; el.innerHTML = `<b>${L.info.ko}</b>${L.info.en ? `<i>${L.info.en}</i>` : ''}`; el.onclick = e => { e.stopPropagation(); detailSelect(L); }; cont.appendChild(el); DV.lbl.set(L, el); }
    if (!$('dvLbl').checked && DV.sel !== L.mesh) { el.hidden = true; return; }
    if (L.anchor) v.copy(L.anchor), L.mesh.localToWorld(v);
    else { box3.setFromObject(L.mesh); if (box3.isEmpty()) { el.hidden = true; return; } box3.getCenter(v); if (DV.cut && v.z > 0) v.z = Math.min(v.z, 0); }
    if (DV.cut && DV.plane.distanceToPoint(v) < -0.02 && !L.anchor) v.z = -0.001;
    v.project(DV.cam);
    if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) { el.hidden = true; return; }
    const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H, bw = 10 + Math.max(L.info.ko.length * 11.5, (L.info.en || '').length * 5.6), bh = 30;
    const r = { x0: x - bw / 2, x1: x + bw / 2, y0: y - bh - 6, y1: y - 2 };
    const sel = DV.sel === L.mesh;
    if (!sel && (x < 8 || placed.some(q => !(r.x1 < q.x0 || r.x0 > q.x1 || r.y1 < q.y0 || r.y0 > q.y1)))) { el.hidden = true; return; }
    placed.push(r); el.hidden = false; el.style.left = x + 'px'; el.style.top = (y - 6) + 'px'; el.classList.toggle('sel', sel);
  });
}
// 공통 표시 도우미
const kvRow = (k, v, t) => `<dt>${k}</dt><dd>${v}${t ? tag(t) : ''}</dd>`;
const fmt = (v, d = 1) => (Math.abs(v) < 1e-9 ? 0 : v).toFixed(d);
// 화면 회전 표시: 실제 회전수를 그대로 그리면 깜박임이 생기므로 재생 속도에 맞춰 감속하고 상한을 둔다
function visRot(rpmReal, st) { return Math.min(rpmReal / 60, 2.2) * 2 * Math.PI * st.dtVis; }

// ---- 기기 형상 도우미 ----
// 접시형 경판이 달린 원통 용기 (Y축, 속이 빈 단면) — 단면이 해칭으로 보인다
function vesselY(R, y0, y1, t, hd = R * 0.5, o = {}) {
  const out = [], inn = [], n = 10, top = o.top !== false, bot = o.bot !== false;
  if (bot) for (let i = 0; i <= n; i++) { const a = i / n * Math.PI / 2; out.push([R * Math.sin(a), y0 + hd * (1 - Math.cos(a))]); }
  else out.push([R, y0]);
  if (top) for (let i = 0; i <= n; i++) { const a = i / n * Math.PI / 2; out.push([R * Math.cos(a), y1 - hd + hd * Math.sin(a)]); }
  else out.push([R, y1]);
  const Ri = R - t, hi = Math.max(0.01, hd - t);
  if (top) for (let i = n; i >= 0; i--) { const a = i / n * Math.PI / 2; inn.push([Ri * Math.cos(a), y1 - t - hi + hi * Math.sin(a)]); }
  else inn.push([Ri, y1]);
  if (bot) for (let i = n; i >= 0; i--) { const a = i / n * Math.PI / 2; inn.push([Ri * Math.sin(a), y0 + t + hi * (1 - Math.cos(a))]); }
  else inn.push([Ri, y0]);
  return lathe(out.concat(inn), o.seg ?? 48);
}
// 축 방향 배관 (속이 빈 관, 플랜지 선택)
function pipeAlong(axis, r, a0, a1, c1 = 0, c2 = 0, t = 0.012, fl = false) {
  const gs = [];
  const mk = (ri, ro, b0, b1) => axis === 'x' ? ringX(ri, ro, b0, b1, 28).translate(0, c1, c2) : axis === 'y' ? ringG(ri, ro, b0, b1, 28).translate(c1, 0, c2) : ringZ(ri, ro, b0, b1, 28).translate(c1, c2, 0);
  gs.push(mk(r - t, r, Math.min(a0, a1), Math.max(a0, a1)));
  if (fl) { const s = Math.sign(a1 - a0); gs.push(mk(r - t, r * 1.7, a1 - s * 0.03, a1).clone()); }
  return gs.length === 1 ? gs[0] : mergeGeometries(gs.map(g => g.index ? g.toNonIndexed() : g));
}
// 볼트 원 (Y축 플랜지 위)
function boltsY(n, rc, y0, y1, rb = 0.012) {
  const gs = []; for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * Math.PI * 2; gs.push(cylY(rb, y0, y1, 8).translate(rc * Math.cos(a), 0, rc * Math.sin(a))); gs.push(cylY(rb * 1.7, y1, y1 + rb * 1.4, 6).translate(rc * Math.cos(a), 0, rc * Math.sin(a))); }
  return mergeGeometries(gs);
}
// 열린 원호 경로 점 (유동 경로용)
function arcPts(cx, cy, r, a0, a1, n = 10, z = 0) { const p = []; for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * DEG; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a), z]); } return p; }
function helixPts(cx, cz, r, y0, y1, pitch, phase = 0, n = 60) { const p = [], turns = (y1 - y0) / pitch; for (let i = 0; i <= n; i++) { const t = i / n, a = phase + t * turns * Math.PI * 2; p.push([cx + r * Math.cos(a), y0 + (y1 - y0) * t, cz + r * Math.sin(a)]); } return p; }
const lerpC = (a, b) => { const A = new THREE.Color(a), B = new THREE.Color(b), o = new THREE.Color(); return u => o.copy(A).lerp(B, clamp(u, 0, 1)); };
