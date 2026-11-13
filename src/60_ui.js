// ===================================================================
// 60 · SIM + UI
// ===================================================================
const SIM = {
  state: { theta: 0, playing: true, speed: 0.1, rpm: 90, load: 0.75, aux: false, ref: 0 },
  view: 'section', sel: null, labelsOn: true, labelsAll: false, tcAngle: 0, fanAngle: 0,
};
function updateAux() { SIM.state.aux = ENGS.aux; }   // 보조 송풍기 기동·정지는 평균값 모델의 소기압으로 결정
// 운전 조건이 바뀌면 현재 리시버 상태로 즉시 한 사이클을 다시 계산 (터보는 이후 시간에 따라 따라옴)
function operatingChanged() { ENGS.dirty = true; evalCycle(); updateAux(); buildDial(); pCurveKey = ''; }
// ---- 기계 운동: 모든 변환은 크랭크각 Θ의 함수 ----
function applyMechanics(T) {
  const offs = cylOffsets(), H = M.headY();
  MOV.crank.rotation.z = -wrap360(T) * DEG;
  MOV.throws.forEach((t, k) => { t.rotation.z = offs[k] * DEG; });
  for (let k = 0; k < CFG.nCyl; k++) {
    const th = T - offs[k], y = M.xhY(th);
    MOV.xh[k].position.y = y;
    MOV.rod[k].position.y = y; MOV.rod[k].rotation.z = M.rodAngle(th);
    MOV.spindle[k].position.y = H - M.evLift01(th) * CFG.evLiftMax;
  }
  if (MOV.hpsGear) MOV.hpsGear.rotation.z = -2 * wrap360(T) * DEG;   // 체인 감속비 2:1 (교육용)
}
function applyAuxParts(dt) {
  const aux = SIM.state.aux;
  (MOV.flaps || []).forEach(h => { const tgt = aux ? 0 : -1.05; h.rotation.z += (tgt - h.rotation.z) * Math.min(1, dt * 6); });
  (MOV.checks || []).forEach(h => { const tgt = aux ? -1.0 : 0; h.rotation.z += (tgt - h.rotation.z) * Math.min(1, dt * 6); });
  if (SIM.state.playing && aux) SIM.fanAngle += dt * 9 * (0.3 + SIM.state.speed);
  (MOV.fans || []).forEach(f => f.rotation.z = SIM.fanAngle);
}

// ---- 시각 상태 ----
function setViewMode(v) {
  SIM.view = v;
  CLIP.arr.length = 0; if (v === 'section') CLIP.arr.push(CLIP.plane);
  HOUSING_MATS.forEach(m => {
    const ghost = v === 'ghost';
    m.transparent = ghost || m.userData.baseOpacity < 1; m.opacity = ghost ? 0.14 : m.userData.baseOpacity;
    m.depthWrite = !ghost; m.side = ghost ? THREE.FrontSide : THREE.DoubleSide; m.needsUpdate = true;
  });
  document.querySelectorAll('#viewmodes .btn').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  $('cutbox').style.opacity = v === 'section' ? 1 : 0.45;
}
function setPipesGhost(on) {
  PIPE_MATS.forEach(m => { m.transparent = on; m.opacity = on ? 0.3 : 1; m.depthWrite = !on; m.side = on ? THREE.FrontSide : THREE.DoubleSide; m.needsUpdate = true; });
}
const CUT = { z: [3.75, -3.75], x: [2.7, -2.7] };
function setCut(axis, t) {
  CLIP.axis = axis; const [a, b] = CUT[axis]; CLIP.pos = lerp(a, b, t);
  if (axis === 'z') CLIP.plane.set(V3(0, 0, -1), CLIP.pos); else CLIP.plane.set(V3(-1, 0, 0), CLIP.pos);
  let lab;
  if (axis === 'z') { const k = Math.round(2.5 - CLIP.pos / CFG.pitch); lab = (k >= 0 && k < CFG.nCyl && Math.abs(LY.zc(k) - CLIP.pos) < 0.12) ? '#' + (k + 1) + ' 중심' : 'z ' + CLIP.pos.toFixed(2); }
  else lab = 'x ' + CLIP.pos.toFixed(2);
  $('cutposv').textContent = lab; $('cutpos').value = Math.round(t * 1000);
  document.querySelectorAll('#cutaxis .btn').forEach(b => b.classList.toggle('on', b.dataset.a === axis));
}
function cutToCyl(k) { const [a, b] = CUT.z; setCut('z', (LY.zc(k) - a) / (b - a)); }
function applyVisibility() {
  for (const id in PARTS) {
    const P = PARTS[id], vis = P.visible && CAT_VIS[P.cat];
    P.inst.forEach(i => i.slot.visible = vis);
  }
}
function isShown(o) { while (o) { if (!o.visible) return false; o = o.parent; } return true; }

// ---- 카메라 이동 ----
const CAM = { anim: null };
function flyTo(pos, tgt, dur = 0.9) {
  CAM.anim = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos.clone(), t1: tgt.clone(), t: 0, dur };
}
function fitBox(b3, dir, margin = 1.15) {
  const c = b3.getCenter(V3()), s = b3.getSize(V3());
  const rad = 0.5 * s.length();
  const dist = rad / Math.sin(camera.fov * DEG / 2) * margin * 0.62 / Math.min(1, camera.aspect * 0.9);
  flyTo(c.clone().addScaledVector(dir.clone().normalize(), dist), c);
}
function instBox(inst) { const b = new THREE.Box3(); inst.meshes.forEach(m => { if (m.geometry) { m.geometry.computeBoundingBox(); const bb = m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld); b.union(bb); } }); return b; }
function homeView(fly = true) {
  const tgt = V3(-0.85, 4.25, LY.zc(SIM.state.ref)), pos = V3(-0.85, 4.45, LY.zc(SIM.state.ref) + 40);
  if (fly) flyTo(pos, tgt); else { camera.position.copy(pos); controls.target.copy(tgt); }
}
function fitAll() { const b = new THREE.Box3().setFromObject(ENG); const d = camera.position.clone().sub(controls.target); fitBox(b, d.lengthSq() > 0 ? d : V3(0.3, 0.2, 1), 1.0); }

// ---- 선택 · 정보 ----
const HL = new Map();
function hlMat(m) {
  if (HL.has(m)) return HL.get(m);
  const h = m.clone(); h.emissive = new THREE.Color(0x6b5a2a); h.emissiveIntensity = 0.9;
  if (m.clippingPlanes) { h.clippingPlanes = CLIP.arr; addCap(h); }
  HL.set(m, h); return h;
}
function select(id, inst, fly = true) {
  if (SIM.sel) SIM.sel.inst.meshes.forEach(m => { if (m.userData.baseMat) { m.material = m.userData.baseMat; delete m.userData.baseMat; } });
  SIM.sel = id ? { id, inst } : null;
  if (SIM.sel) {
    inst.meshes.forEach(m => { if (m.material && m.material.isMeshStandardMaterial) { m.userData.baseMat = m.material; m.material = hlMat(m.material); } });
    if (fly) { const b = instBox(inst); if (!b.isEmpty()) { const d = camera.position.clone().sub(controls.target); fitBox(b, d, 1.6); } }
  }
  renderInfo(); renderPartList();
}
function renderInfo() {
  const el = $('info');
  if (!SIM.sel) { el.innerHTML = '<p class="empty">부품을 클릭하면 명칭, 역할, 연결 계통이 여기에 표시됩니다.</p>'; return; }
  const P = PARTS[SIM.sel.id], inst = SIM.sel.inst;
  const posTxt = { img: '기준으로 삼은 엔진 단면도에 표기된 부품 · 위치와 비율을 그림에서 참고', add: '그림에 없는 부품 · 교육용으로 추가 배치', mod: '그림 표기를 ME-C 자료 기준으로 변경' }[P.pos];
  const flows = P.sys.map(s => `<span class="chip fl">${SYS[s]}</span>`).join('');
  const glb = inst.glb ? '상세 모델(GLB) 적용 중' : '절차적 형상 (교육용 단순화)';
  el.innerHTML = `<h3>${P.ko}</h3><div class="en">${P.en}${inst.cyl != null ? ' · 실린더 #' + (inst.cyl + 1) : ''}</div>
    <p>${P.desc}</p><div class="chips">${flows || '<span class="chip">연결 계통 없음</span>'}</div>
    <div class="meta"><div>분류: ${CATS[P.cat]}</div><div>위치 근거: ${posTxt}</div><div>형상: ${glb}</div><div>GLB 슬롯 ID: <code>${P.id}</code></div></div>
    <div class="seg c2" style="margin-top:10px"><button class="btn" id="infoZoom">다시 확대</button><button class="btn" id="infoHide">이 부품 숨기기</button></div>
    ${DEV_OF[P.id] ? `<button class="btn on" id="infoDetail" style="width:100%;margin-top:6px">내부 구조 보기 · ${DEVICES[DEV_OF[P.id]].ko}</button>` : ''}`;
  if (DEV_OF[P.id]) $('infoDetail').onclick = () => detailOpen(DEV_OF[P.id]);
  $('infoZoom').onclick = () => select(SIM.sel.id, SIM.sel.inst, true);
  $('infoHide').onclick = () => { P.visible = false; applyVisibility(); renderPartList(); };
}
function renderPartList() {
  const q = ($('psearch').value || '').trim().toLowerCase();
  const el = $('plist');
  el.innerHTML = Object.values(PARTS).filter(P => !q || P.ko.toLowerCase().includes(q) || P.en.toLowerCase().includes(q)).map(P =>
    `<div class="pitem${SIM.sel && SIM.sel.id === P.id ? ' sel' : ''}" data-id="${P.id}"><input type="checkbox" ${P.visible ? 'checked' : ''} aria-label="${P.ko} 표시"><span>${P.ko}</span><span class="en">${P.en}</span></div>`).join('');
}
function pickInst(P) { return P.inst.find(i => i.cyl === SIM.state.ref) || P.inst.find(i => i.cyl == null) || P.inst[0]; }

// ---- 라벨 ----
const LBL = new Map();
function labelFor(P, inst) {
  const key = P.id + '|' + P.inst.indexOf(inst);
  if (LBL.has(key)) return LBL.get(key);
  const d = document.createElement('div'); d.className = 'lbl'; d.innerHTML = `<b>${P.ko}</b><i>${P.en}</i>`;
  d.onclick = e => { e.stopPropagation(); select(P.id, inst); };
  $('labels').appendChild(d);
  const rec = { el: d, P, inst, shown: false };
  LBL.set(key, rec); return rec;
}
function anchorOf(inst) {
  if (!inst.anchor) { const b = instBox(inst); const c = b.isEmpty() ? V3() : b.getCenter(V3()); inst.anchor = inst.slot.worldToLocal(c.clone()); inst.anchorTop = b.isEmpty() ? 0 : b.max.y - c.y; }
  return inst.slot.localToWorld(inst.anchor.clone());
}
const LABEL_SKIP = new Set(['rings', 'evseat', 'nozzle', 'xhbearing', 'cpbearing', 'combvol', 'tc_shaft', 'exhduct', 'staybolt', 'pco', 'airspring', 'evact', 'lubricator', 'checkv', 'drain', 'startpump', 'trap', 'visco', 'door']);
function updateLabels() {
  const want = [];
  if (SIM.labelsOn) {
    for (const id in PARTS) {
      const P = PARTS[id]; if (!P.label || !P.visible || !CAT_VIS[P.cat]) continue;
      const insts = SIM.labelsAll ? P.inst : [pickInst(P)];
      insts.forEach(inst => { if (inst && (!LABEL_SKIP.has(id) || (SIM.sel && SIM.sel.id === id))) want.push({ P, inst, pri: SIM.sel && SIM.sel.id === id ? 0 : (P.inst.length > 1 && inst.cyl === SIM.state.ref ? 1 : 2) }); });
    }
  }
  const W = viewEl.clientWidth, Hh = viewEl.clientHeight, placed = [];
  const v = V3();
  want.sort((a, b) => a.pri - b.pri);
  const used = new Set();
  for (const w of want) {
    const rec = labelFor(w.P, w.inst); used.add(rec);
    const p = anchorOf(w.inst);
    if (CLIP.arr.length && w.inst.meshes[0] && w.inst.meshes[0].material && w.inst.meshes[0].material.clippingPlanes && !clipKeeps(p)) { rec.el.hidden = true; continue; }
    v.copy(p).project(camera);
    if (v.z > 1 || v.x < -1.05 || v.x > 1.05 || v.y < -1.05 || v.y > 1.05) { rec.el.hidden = true; continue; }
    const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * Hh;
    const bw = 8 + Math.max(w.P.ko.length * 11.5, w.P.en.length * 5.6), bh = 30;
    const r = { x0: x - bw / 2, x1: x + bw / 2, y0: y - bh - 6, y1: y - 2 };
    if (w.pri > 0 && placed.some(q => !(r.x1 < q.x0 || r.x0 > q.x1 || r.y1 < q.y0 || r.y0 > q.y1))) { rec.el.hidden = true; continue; }
    placed.push(r);
    rec.el.hidden = false; rec.el.style.left = x + 'px'; rec.el.style.top = (y - 6) + 'px';
    rec.el.classList.toggle('sel', w.pri === 0);
  }
  LBL.forEach(rec => { if (!used.has(rec)) rec.el.hidden = true; });
}

// ---- 피킹 ----
const ray = new THREE.Raycaster();
function pick(cx, cy) {
  const rect = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(PICKABLE, false).filter(h => {
    const o = h.object; if (!isShown(o)) return false;
    const m = o.material; if (!m) return false;
    if (m.opacity !== undefined && m.transparent && m.opacity < 0.05) return false;
    if (m.clippingPlanes && m.clippingPlanes.length && !clipKeeps(h.point)) return false;
    if (o.userData.part === 'combvol') { const u = m.uniforms; if (u.show.value < 0.5 || h.point.y < u.crown.value || h.point.y > u.head.value) return false; }   // 셰이더에서 버린 영역 제외
    return true;
  });
  if (!hits.length) return null;
  let h = hits[0];
  if (SIM.view === 'ghost' || $('pipesGhost').checked) { const solid = hits.find(x => !(x.object.material.transparent && x.object.material.opacity < 0.5)); if (solid) h = solid; }
  const id = h.object.userData.part, P = PARTS[id];
  const inst = P.inst.find(i => i.meshes.includes(h.object)) || P.inst[0];
  return { id, inst, point: h.point };
}

// ---- 타이밍 다이얼 · 압력 차트 ----
function polar(a, r) { return [r * Math.sin(a * DEG), -r * Math.cos(a * DEG)]; }
function arcPath(a0, a1, r) { if (a1 < a0) a1 += 360; const [x0, y0] = polar(a0, r), [x1, y1] = polar(a1, r); const large = (a1 - a0) > 180 ? 1 : 0; return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`; }
function buildDial() {
  const [po, pc] = M.portAngles(), load = SIM.state.load, D = M.injDur(load), s = wrap360(CFG.soi);
  const ticks = Array.from({ length: 36 }, (_, i) => { const a = i * 10, [x0, y0] = polar(a, 104), [x1, y1] = polar(a, i % 9 === 0 ? 94 : 99); return `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="var(--line2)" stroke-width="${i % 9 === 0 ? 1.6 : 1}"/>`; }).join('');
  const lab = (a, r, t, c = 'var(--muted)') => { const [x, y] = polar(a, r); return `<text x="${x.toFixed(1)}" y="${(y + 3.5).toFixed(1)}" fill="${c}" font-size="9" font-family="var(--mono)" text-anchor="middle">${t}</text>`; };
  $('dial').innerHTML = `
    <circle r="104" fill="none" stroke="var(--line)" />${ticks}
    <path d="${arcPath(CFG.evo, CFG.evc, 86)}" stroke="var(--exh)" stroke-width="9" fill="none" opacity=".9"/>
    <path d="${arcPath(po, pc, 74)}" stroke="var(--air)" stroke-width="9" fill="none" opacity=".9"/>
    <path d="${arcPath(po, Math.min(pc, CFG.evc), 80)}" stroke="var(--accent)" stroke-width="2" fill="none" stroke-dasharray="3 2"/>
    <path d="${arcPath(s, s + D, 62)}" stroke="var(--fuel)" stroke-width="9" fill="none"/>
    <path d="${arcPath(s + CFG.ignDelay, CFG.evo, 50)}" stroke="var(--comb)" stroke-width="5" fill="none" opacity=".55"/>
    ${lab(0, 116, 'TDC', 'var(--fg)')}${lab(180, 116, 'BDC', 'var(--fg)')}
    ${lab(CFG.evo, 118, 'EO ' + CFG.evo + '°', 'var(--exh)')}${lab(CFG.evc, 118, 'EC ' + CFG.evc + '°', 'var(--exh)')}
    ${lab(po - 8, 58, 'PO ' + po.toFixed(0) + '°', 'var(--air)')}${lab(pc + 8, 58, 'PC ' + pc.toFixed(0) + '°', 'var(--air)')}
    <text x="0" y="-8" fill="var(--muted)" font-size="9" text-anchor="middle" font-family="var(--sans)">크랭크각</text>
    <text id="dialv" x="0" y="10" fill="var(--fg)" font-size="17" text-anchor="middle" font-family="var(--mono)">0.0°</text>
    <text x="0" y="26" fill="var(--dim)" font-size="8" text-anchor="middle" font-family="var(--sans)">점선: 소기·배기 중첩</text>
    <g id="needle"><line x1="0" y1="-36" x2="0" y2="-104" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round"/><circle cy="-104" r="4" fill="var(--accent)"/></g>`;
}
let pCurve = null, pCurveKey = '', rcv = null;
function chartBase(g, W, Hc) { g.clearRect(0, 0, W, Hc); g.font = '18px IBM Plex Mono, monospace'; g.lineWidth = 1; }
function drawChart(th) {
  const cv = $('pchart'), g = cv.getContext('2d'), W = cv.width, Hc = cv.height;
  const key = 'v' + ENGS.version;
  if (key !== pCurveKey) { pCurve = []; for (let a = -180; a <= 180; a += 1) pCurve.push(TQ.p(a)); pCurveKey = key; rcv = receiverPulses(); }
  const pad = { l: 34, r: 8, t: 10, b: 24 }, pw = W - pad.l - pad.r, ph = Hc - pad.t - pad.b, pmax = 200;
  const X = a => pad.l + (a + 180) / 360 * pw, Y = p => pad.t + ph - p / pmax * ph;
  chartBase(g, W, Hc); g.fillStyle = '#5f6d74'; g.strokeStyle = '#27323a';
  [0, 50, 100, 150, 200].forEach(p => { g.beginPath(); g.moveTo(pad.l, Y(p)); g.lineTo(W - pad.r, Y(p)); g.stroke(); g.fillText(p, 2, Y(p) + 6); });
  [-180, -90, 0, 90, 180].forEach(a => { g.fillText(a === 0 ? 'TDC' : a + '°', X(a) - (a === 0 ? 18 : 16), Hc - 4); });
  const [po, pc] = M.portAngles(), band = (a0, a1, c) => { g.fillStyle = c; g.fillRect(X(wrapS(a0)), pad.t + ph - 6, X(wrapS(a1)) - X(wrapS(a0)), 6); };
  band(CFG.evo, 180, 'rgba(229,72,77,.6)'); band(-180, CFG.evc - 360, 'rgba(229,72,77,.6)'); band(po, 180, 'rgba(61,139,253,.8)'); band(-180, pc - 360, 'rgba(61,139,253,.8)');
  g.strokeStyle = '#e8ddbf'; g.lineWidth = 2.5; g.beginPath(); pCurve.forEach((p, i) => { const x = X(i - 180), y = Y(p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
  const a = wrapS(th), p = TQ.p(th);
  g.fillStyle = '#ff8a1f'; g.beginPath(); g.arc(X(a), Y(p), 6, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#8a989e'; g.fillText('bar abs', W - 86, pad.t + 16);
  drawPulse(th);
}
// 소기 리시버 · 배기 리시버 · 실린더 압력 (가스 교환 구간 확대)
function drawPulse(th) {
  const cv = $('rchart'); if (!cv || !rcv) return;
  const g = cv.getContext('2d'), W = cv.width, Hc = cv.height, off = cylOffsets()[SIM.state.ref], n = rcv.px.length, dth = 360 / n;
  const at = (arr, a) => arr[((Math.round((a + off) / dth) % n) + n) % n];
  let lo = 1e9, hi = -1e9; for (let i = 0; i < n; i++) { lo = Math.min(lo, rcv.px[i], rcv.ps[i]); hi = Math.max(hi, rcv.px[i], rcv.ps[i]); }
  lo = Math.floor(lo / 1e5 * 10 - 1) / 10; hi = Math.ceil(hi / 1e5 * 10 + 3) / 10;
  const pad = { l: 40, r: 8, t: 10, b: 24 }, pw = W - pad.l - pad.r, ph = Hc - pad.t - pad.b;
  const X = a => pad.l + (a - 90) / 180 * pw, Y = p => pad.t + ph - (p - lo) / (hi - lo) * ph;
  chartBase(g, W, Hc); g.strokeStyle = '#27323a'; g.fillStyle = '#5f6d74';
  const step = (hi - lo) > 1.2 ? 0.5 : 0.2;
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) { g.beginPath(); g.moveTo(pad.l, Y(v)); g.lineTo(W - pad.r, Y(v)); g.stroke(); g.fillText(v.toFixed(1), 2, Y(v) + 6); }
  [90, 135, 180, 225, 270].forEach(a => g.fillText(a === 180 ? 'BDC' : a + '°', X(a) - 18, Hc - 4));
  const line = (fn, col, w, dash) => { g.strokeStyle = col; g.lineWidth = w; g.setLineDash(dash || []); g.beginPath(); let first = true; for (let a = 90; a <= 270; a += 1) { const v = fn(a); if (v > hi + 0.5) { first = true; continue; } const y = Y(Math.min(hi, v)); first ? g.moveTo(X(a), y) : g.lineTo(X(a), y); first = false; } g.stroke(); g.setLineDash([]); };
  line(a => at(rcv.ps, a) / 1e5, '#3d8bfd', 2.5); line(a => at(rcv.px, a) / 1e5, '#e5484d', 2.5); line(a => TQ.p(a), '#e8ddbf', 2, [6, 4]);
  const a = wrap360(th); if (a >= 90 && a <= 270) { g.strokeStyle = '#8a989e'; g.lineWidth = 1; g.beginPath(); g.moveTo(X(a), pad.t); g.lineTo(X(a), pad.t + ph); g.stroke(); }
}
// ---- 상태 표시 ----
const PH_COL = { inj: 'var(--fuel)', exp: 'var(--comb)', blow: 'var(--exh)', scav: 'var(--air)', scav2: 'var(--air)', post: 'var(--exh)', comp: 'var(--muted)' };
const tag = t => `<span class="tag ${t}">${{ calc: '계산', edu: '교육용', ref: '참고', m0d: '0D 계산', m2d: '2D 근사' }[t]}</span>`;
function updateReadouts(T) {
  const k = SIM.state.ref, th = wrap360(T - cylOffsets()[k]), load = SIM.state.load;
  const ph = M.phase(th, load), lift = M.evLift01(th), pf = M.portFrac(th), inj = M.inj01(th, load);
  $('phase').innerHTML = `<span class="dot" style="background:${PH_COL[ph.k]}"></span><span>${ph.ko}</span>`;
  $('needle').setAttribute('transform', `rotate(${th.toFixed(2)})`);
  $('dialv').textContent = th.toFixed(1) + '°';
  const st = (open, txt) => `<span class="state${open ? ' open' : ''}"><i></i>${txt}</span>`;
  const mi = pf > 0 ? TQ.get(ENGS.cyc.out.mIn, th) : 0, mo = lift > 0 ? TQ.get(ENGS.cyc.out.mOut, th) : 0;
  const flowTxt = (m, open) => !open ? '0' : (m < 0 ? '역류 ' : '') + Math.abs(m).toFixed(1) + ' kg/s';
  $('kv').innerHTML = `
    <dt>크랭크각 (실린더 #${k + 1})</dt><dd>${th.toFixed(1)}°${tag('calc')}</dd>
    <dt>피스톤 위치 (상사점 기준)</dt><dd>${(M.pistonFromTDC(th) * 1000).toFixed(0)} mm${tag('calc')}</dd>
    <dt>소기 포트 개방률</dt><dd>${st(pf > 0, (pf * 100).toFixed(0) + ' %')}${tag('calc')}</dd>
    <dt>배기밸브</dt><dd>${st(lift > 0, lift > 0 ? '열림 ' + (lift * CFG.evLiftMax * 1000).toFixed(0) + ' mm' : '닫힘')}${tag('edu')}</dd>
    <dt>연료 분사</dt><dd>${st(inj > 0, inj > 0 ? '분사 중' : '대기')}${tag('calc')}</dd>
    <dt>실린더 압력</dt><dd>${TQ.p(th).toFixed(1)} bar${tag('m0d')}</dd>
    <dt>평균 가스 온도</dt><dd>${Math.round(TQ.T(th) - 273)} °C${tag('m0d')}</dd>
    <dt>연소 진행률</dt><dd>${(Math.min(1, TQ.xf(th)) * 100).toFixed(0)} %${tag('m0d')}</dd>
    <dt>포트 / 배기밸브 유량</dt><dd>${flowTxt(mi, pf > 0)} / ${flowTxt(mo, lift > 0)}${tag('m0d')}</dd>
    <dt>커넥팅 로드 각</dt><dd>${(M.rodAngle(th) / DEG).toFixed(1)}°${tag('calc')}</dd>`;
  const rpm = SIM.state.rpm, sp = SIM.state.speed, S = TQ.summary();
  const bal = (ENGS.Pt - ENGS.Pc - 0.0178 * (ENGS.N * 2 * Math.PI / 60) ** 2) / Math.max(2e4, ENGS.Pc);
  const trans = Math.abs(bal) < 0.02 ? st(true, '정상 상태') : `<span class="state"><i style="background:var(--warn)"></i>${bal > 0 ? '터보 가속 중' : '터보 감속 중'}</span>`;
  $('kv2').innerHTML = `
    <dt>회전수 · 부하 (설정)</dt><dd>${rpm} r/min · ${Math.round(load * 100)} %</dd>
    <dt>화면 재생 속도</dt><dd>${sp.toFixed(sp < 0.1 ? 3 : 2)}× → 화면상 ${(rpm * sp).toFixed(1)} r/min</dd>
    <dt>터보차저 상태</dt><dd>${trans}</dd>
    <dt>터보차저 회전수</dt><dd>${ENGS.N > 50 ? Math.round(ENGS.N).toLocaleString('ko-KR') + ' r/min' : '정지'}${tag('m0d')}</dd>
    <dt>소기 리시버 압력</dt><dd>${(ENGS.ps / 1e5).toFixed(2)} bar abs${tag('m0d')}</dd>
    <dt>배기 리시버 압력</dt><dd>${(ENGS.px / 1e5).toFixed(2)} bar abs${tag('m0d')}</dd>
    <dt>공기 유량 · 압력비</dt><dd>${ENGS.mdC.toFixed(1)} kg/s · ${Math.max(1, TCM.pi(ENGS.N, ENGS.mdC)).toFixed(2)}${tag('m0d')}</dd>
    <dt>터빈 / 압축기 동력</dt><dd>${(ENGS.Pt / 1e6).toFixed(2)} / ${(ENGS.Pc / 1e6).toFixed(2)} MW${tag('m0d')}</dd>
    <dt>보조 송풍기</dt><dd>${st(ENGS.aux, ENGS.aux ? '운전 (플랩 닫힘)' : '정지 (플랩 열림)')}${tag('m0d')}</dd>
    <dt>지시 출력 · IMEP</dt><dd>${(S.Pi / 1000).toFixed(1)} MW · ${S.imep.toFixed(1)} bar${tag('m0d')}</dd>
    <dt>최고 압력 Pmax</dt><dd>${S.pmax.toFixed(0)} bar @ ${S.thPmax.toFixed(0)}°${tag('m0d')}</dd>
    <dt>공기 과잉률 λ (전체)</dt><dd>${isFinite(S.lambda) ? S.lambda.toFixed(2) : '—'}${tag('m0d')}</dd>
    <dt>배기 온도 T/C 전→후</dt><dd>${Math.round(S.Tx - 273)} → ${Math.round(S.Tout - 273)} °C${tag('m0d')}</dd>
    <dt>소기 공기 온도</dt><dd>${Math.round(S.Ts - 273)} °C${tag('m0d')}</dd>
    <dt>지시 효율 · 벽 열손실</dt><dd>${(S.etaI * 100).toFixed(1)} % · ${(S.qwFrac * 100).toFixed(1)} %${tag('m0d')}</dd>
    <dt>점화 순서</dt><dd>${CFG.firingOrder.join('-')}${tag('edu')}</dd>`;
  const F = FIELD.cur;
  $('kv3').innerHTML = F ? `
    <dt title="배기밸브가 닫힐 때 실린더에 갇힌 가스 중 이번 사이클 공급 공기의 비율">소기 효율</dt><dd>${(F.D.etaSc * 100).toFixed(1)} %${tag('m2d')}</dd>
    <dt title="공급된 공기 중 실린더에 남은 비율">공급 공기 포착률</dt><dd>${(F.D.etaTr * 100).toFixed(1)} %${tag('m2d')}</dd>
    <dt title="포트로 들어와 그대로 배기밸브로 빠져나간 공기의 비율">단락 손실</dt><dd>${(F.D.short * 100).toFixed(1)} %${tag('m2d')}</dd>
    <dt title="한 사이클 공급 공기 질량 / (소기 밀도 × 행정체적)">급기비</dt><dd>${S.delivery.toFixed(2)}${tag('m0d')}</dd>
    <dt>선회 속도</dt><dd>${Math.round(F.omega[Math.floor(th) % 360] * 60 / (2 * Math.PI))} r/min${tag('m2d')}</dd>
    <dt>계산 상태</dt><dd>${FIELD.busy ? '갱신 계산 중…' : FIELD.status}</dd>` : `<dt>계산 상태</dt><dd>${FIELD.status}</dd>`;
  $('crankv').textContent = th.toFixed(1) + '°';
  if (!SIM.dragCrank) $('crank').value = Math.round(th * 10);
  $('cylname').textContent = '실린더 #' + (k + 1);
  drawChart(th);
}

// ---- 프리셋 ----
const PRESETS = [
  { id: 'all', ko: '전체 구조', en: '엔진 + 전 계통', view: 'section', flows: 'all', cam: () => [V3(16, 14, 34), V3(-0.5, 7.0, 0)] },
  { id: 'cyl', ko: '실린더 내부', en: '사이클 · 분사 · 소기', view: 'section', flows: ['air', 'fuel', 'comb', 'exh'], cam: () => { const z = LY.zc(SIM.state.ref); return [V3(2.0, 7.9, z + 10.8), V3(0, 7.45, z)]; } },
  { id: 'airexh', ko: '공기 · 배기', en: '터보차저 · 냉각기 · 리시버', view: 'ghost', flows: ['air', 'exh'], cam: () => [V3(-19, 15, 19), V3(-2.3, 8.6, -0.4)] },
  { id: 'fuel', ko: '연료 공급', en: '서비스 탱크 → 분사밸브', view: 'solid', flows: ['fuel', 'oil'], cam: () => [V3(20, 12, 20), V3(3.4, 4.2, 0.6)] },
  { id: 'ctrl', ko: '제어유 · HCU', en: 'FIVA · 부스터 · 액추에이터', view: 'solid', flows: ['oil', 'fuel', 'exh'], cam: () => { const z = LY.zc(SIM.state.ref); return [V3(6.2, 10.4, z + 5.6), V3(1.0, 8.4, z)]; } },
  { id: 'boiler', ko: '배기가스 보일러', en: '가스측 · 물/증기측 분리', view: 'ghost', flows: ['exh', 'water', 'steam'], cam: () => [V3(-12.5, 18.5, 13.5), V3(-5.0, 14.0, -0.5)] },
];
function applyPreset(id) {
  const p = PRESETS.find(q => q.id === id);
  document.querySelectorAll('#presets .btn').forEach(b => b.classList.toggle('on', b.dataset.p === id));
  setViewMode(p.view);
  if (p.view === 'section') { setCut('z', (LY.zc(SIM.state.ref) - CUT.z[0]) / (CUT.z[1] - CUT.z[0])); }
  Object.keys(FLOW_ON).forEach(f => FLOW_ON[f] = p.flows === 'all' || p.flows.includes(f));
  syncFlowChecks();
  const [pos, tgt] = p.cam(); flyTo(pos, tgt, 1.1);
}
function syncFlowChecks() { document.querySelectorAll('#flows input').forEach(i => i.checked = FLOW_ON[i.dataset.f]); }

// ---- 설정 · 자료 근거 · 검증 모달 ----
function openModal(html) { $('dlg').innerHTML = html; $('modal').hidden = false; }
function closeModal() { $('modal').hidden = true; }
function openSettings() {
  const F = [
    ['evo', '배기밸브 개방 시작 (° ATDC)', 'ref'], ['evc', '배기밸브 폐쇄 완료 (° ATDC)', 'edu'], ['soi', '분사 시작 (° , 음수 = BTDC)', 'edu'],
    ['injDur0', '분사 기간 · 부하 0 % (°)', 'edu'], ['injDur1', '분사 기간 · 부하 100 % (°)', 'edu'], ['ignDelay', '착화 지연 (°)', 'edu'],
    ['portTopMM', '소기 포트 상단 높이 (BDC 크라운 기준, mm)', 'calc'], ['auxOn', '보조 송풍기 기동 소기압 (bar g)', 'edu'], ['auxOff', '보조 송풍기 정지 소기압 (bar g)', 'edu'],
  ];
  const [po, pc] = M.portAngles();
  openModal(`<h2>작동 타이밍 설정</h2><p class="sub">모든 값은 크랭크각 공통 기준으로 피스톤 위치, 배기밸브, 분사, 연소 표현에 동시에 반영됩니다. 소기 포트 개폐각은 직접 입력하지 않고 포트 높이와 피스톤 기구학에서 계산됩니다.</p>
    <div class="form">${F.map(([k, l, s]) => `<label class="k" for="cf_${k}">${l}</label><input id="cf_${k}" type="number" step="${k.startsWith('aux') ? 0.01 : 1}" value="${CFG[k]}">${tag(s)}`).join('')}
    <label class="k" for="cf_fo">점화 순서</label><input id="cf_fo" type="text" value="${CFG.firingOrder.join('-')}">${tag('edu')}
    <div class="derived" id="cf_der">현재 포트 개방 ${po.toFixed(1)}° / 폐쇄 ${pc.toFixed(1)}° (기하 계산) · 커넥팅 로드 ${CFG.conrod} m, 행정 ${CFG.stroke} m 고정</div></div>
    <div class="acts"><button class="btn" id="cfReset">기본값</button><button class="btn" id="cfCancel">닫기</button><button class="btn on" id="cfApply">적용</button></div>`);
  $('cf_portTopMM').oninput = () => { const v = +$('cf_portTopMM').value, old = CFG.portTopMM; CFG.portTopMM = v; const [a, b] = M.portAngles(); CFG.portTopMM = old; $('cf_der').textContent = `포트 개방 ${a.toFixed(1)}° / 폐쇄 ${b.toFixed(1)}° (기하 계산) · 커넥팅 로드 ${CFG.conrod} m, 행정 ${CFG.stroke} m 고정`; };
  $('cfCancel').onclick = closeModal;
  $('cfReset').onclick = () => { F.forEach(([k]) => $('cf_' + k).value = CFG_DEFAULT[k]); $('cf_fo').value = CFG_DEFAULT.firingOrder.join('-'); };
  $('cfApply').onclick = () => {
    const nv = {}; F.forEach(([k]) => nv[k] = +$('cf_' + k).value);
    const fo = $('cf_fo').value.split(/[^0-9]+/).filter(Boolean).map(Number);
    const errs = [];
    if (!(nv.evo > 60 && nv.evo < nv.evc && nv.evc < 330)) errs.push('배기밸브 개방은 60°보다 크고 폐쇄보다 작아야 합니다.');
    if (!(nv.portTopMM > CFG.portBotMM + 24 && nv.portTopMM < 600)) errs.push('포트 상단 높이는 30~600 mm 범위로 입력하세요.');
    if (!(nv.injDur0 > 0 && nv.injDur1 >= nv.injDur0 && nv.injDur1 < 60)) errs.push('분사 기간은 0보다 크고 60° 미만이어야 합니다.');
    if (!(nv.auxOn < nv.auxOff)) errs.push('보조 송풍기 정지 압력은 기동 압력보다 커야 합니다.');
    if (fo.length !== CFG.nCyl || new Set(fo).size !== CFG.nCyl || fo.some(v => v < 1 || v > CFG.nCyl)) errs.push('점화 순서는 1~6을 한 번씩 포함해야 합니다.');
    if (errs.length) { $('cf_der').innerHTML = '<span class="fail">' + errs.join(' ') + '</span>'; return; }
    const portChanged = nv.portTopMM !== CFG.portTopMM;
    Object.assign(CFG, nv); CFG.firingOrder = fo;
    buildTables(); if (portChanged) rebuildPorts();
    GT4.key = ''; operatingChanged(); closeModal(); toast('타이밍 설정을 적용했습니다 · 0D·유동장 재계산');
  };
}
function rebuildPorts() {
  const pT = M.portTop(), pB = M.portBot();
  for (const id of ['liner', 'ports']) PARTS[id].inst.forEach(inst => {
    const z = LY.zc(inst.cyl), mesh = inst.proc[0];
    let g;
    if (id === 'ports') {
      const bars = []; for (let i = 0; i < 16; i++) { const b = box(0.035, pT - pB, 0.055, 0.3175, (pT + pB) / 2, 0, 0.003); b.rotateY(22 * DEG); b.rotateY(i * 2 * Math.PI / 16); bars.push(b); }
      g = merge(bars);
    } else {
      g = merge([ringG(0.30, 0.335, LY.linerBot, pB, 56), ringG(0.30, 0.335, pT, 7.9, 56), lathe([[0.30, 7.9], [0.44, 7.9], [0.44, M.headY() - 0.02], [0.40, M.headY()], [0.30, M.headY()]], 56), ringG(0.335, 0.37, 6.6, 6.68, 56)]);
    }
    g.translate(0, 0, z); mesh.geometry.dispose(); mesh.geometry = g; inst.anchor = null;
  });
}
function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; viewEl.appendChild(d); setTimeout(() => d.remove(), 1800); }

// ---- GLB 교체 ----
const gltfLoader = new GLTFLoader();
function applyGLB(buf, name) {
  if (!SIM.sel) { toast('먼저 교체할 부품을 선택하세요'); return; }
  const P = PARTS[SIM.sel.id];
  gltfLoader.parse(buf, '', gltf => {
    P.inst.forEach(inst => {
      if (inst.glb) { inst.slot.remove(inst.glb); inst.meshes = inst.meshes.filter(m => !m.userData.glb); }
      const box3 = new THREE.Box3(); inst.proc.forEach(m => { m.geometry.computeBoundingBox(); box3.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrix)); });
      const obj = gltf.scene.clone(true);
      const ob = new THREE.Box3().setFromObject(obj), os = ob.getSize(V3()), ts = box3.getSize(V3());
      const s = Math.min(ts.x / (os.x || 1), ts.y / (os.y || 1), ts.z / (os.z || 1));
      obj.scale.setScalar(s); const oc = ob.getCenter(V3()).multiplyScalar(s); obj.position.copy(box3.getCenter(V3()).sub(oc));
      obj.traverse(o => { if (o.isMesh) { o.userData.part = P.id; o.userData.glb = true; const mm = (o.material = o.material.clone()); mm.side = THREE.DoubleSide; mm.clippingPlanes = CLIP.arr; addCap(mm); inst.meshes.push(o); PICKABLE.push(o); } });
      inst.proc.forEach(m => m.visible = false);
      inst.slot.add(obj); inst.glb = obj; inst.anchor = null;
    });
    toast(`${P.ko}: ${name} 적용`); renderInfo();
  }, err => toast('GLB를 읽지 못했습니다: ' + (err && err.message || '형식 오류')));
}
function resetGLB() {
  if (!SIM.sel) return; const P = PARTS[SIM.sel.id];
  P.inst.forEach(inst => { if (inst.glb) { inst.slot.remove(inst.glb); inst.glb = null; inst.meshes = inst.meshes.filter(m => !m.userData.glb); } inst.proc.forEach(m => m.visible = true); inst.anchor = null; });
  renderInfo();
}

// ---- UI 구성 ----
const speedOf = v => 0.01 * Math.pow(200, v / 100);
function buildUI() {
  $('presets').innerHTML = PRESETS.map(p => `<button class="btn wide" data-p="${p.id}"><span>${p.ko}</span><span>${p.en}</span></button>`).join('');
  $('presets').onclick = e => { const b = e.target.closest('[data-p]'); if (b) applyPreset(b.dataset.p); };
  $('viewmodes').onclick = e => { const b = e.target.closest('[data-v]'); if (b) setViewMode(b.dataset.v); };
  $('cutaxis').onclick = e => { const b = e.target.closest('[data-a]'); if (!b) return; if (b.dataset.a === 'z') cutToCyl(SIM.state.ref); else setCut('x', 0.5); if (SIM.view !== 'section') setViewMode('section'); };
  $('cutpos').oninput = e => { setCut(CLIP.axis, e.target.value / 1000); if (SIM.view !== 'section') setViewMode('section'); };
  const legendItems = Object.entries(FLUID).map(([k, f]) => `<label class="chk"><input type="checkbox" data-f="${k}" checked><span class="sw ${f.style === 'dash' ? 'dash' : f.style === 'dot' ? 'dot' : ''}" style="--c:${f.css};background:${f.css}"></span>${f.ko}</label>`).join('');
  $('flows').innerHTML = legendItems;
  $('flows').onchange = e => { const f = e.target.dataset.f; if (f) FLOW_ON[f] = e.target.checked; };
  $('cats').innerHTML = Object.entries(CATS).map(([k, v]) => `<label class="chk"><input type="checkbox" data-c="${k}" checked>${v}</label>`).join('');
  $('cats').onchange = e => { const c = e.target.dataset.c; if (c) { CAT_VIS[c] = e.target.checked; applyVisibility(); } };
  $('pipesGhost').onchange = e => setPipesGhost(e.target.checked);
  $('labelsOn').onchange = e => SIM.labelsOn = e.target.checked;
  $('labelsAll').onchange = e => SIM.labelsAll = e.target.checked;
  $('psearch').oninput = renderPartList;
  $('plist').onclick = e => {
    const it = e.target.closest('.pitem'); if (!it) return; const P = PARTS[it.dataset.id];
    if (e.target.tagName === 'INPUT') { P.visible = e.target.checked; applyVisibility(); return; }
    if (!P.visible) { P.visible = true; applyVisibility(); }
    if (!CAT_VIS[P.cat]) { CAT_VIS[P.cat] = true; document.querySelector(`#cats input[data-c="${P.cat}"]`).checked = true; applyVisibility(); }
    select(P.id, pickInst(P));
  };
  $('refcyl').innerHTML = Array.from({ length: CFG.nCyl }, (_, k) => `<option value="${k}">#${k + 1}</option>`).join('');
  $('refcyl').onchange = e => { SIM.state.ref = +e.target.value; if (CLIP.axis === 'z') cutToCyl(SIM.state.ref); if (SIM.sel) { const P = PARTS[SIM.sel.id]; if (P.inst.length > 1) select(P.id, pickInst(P), false); } };
  const playIcon = () => $('playIcon').innerHTML = SIM.state.playing ? '<path d="M4 2h3v12H4zM9 2h3v12H9z" fill="currentColor"/>' : '<path d="M4 2l10 6-10 6z" fill="currentColor"/>';
  SIM.playIcon = playIcon; playIcon();
  $('play').onclick = () => { SIM.state.playing = !SIM.state.playing; playIcon(); };
  $('speed').oninput = e => { SIM.state.speed = speedOf(+e.target.value); $('speedv').textContent = SIM.state.speed.toFixed(SIM.state.speed < 0.1 ? 3 : 2) + '×'; };
  $('speed').value = 44; $('speed').oninput({ target: $('speed') });
  $('crank').addEventListener('pointerdown', () => { SIM.dragCrank = true; SIM.state.playing = false; playIcon(); });
  $('crank').addEventListener('pointerup', () => { SIM.dragCrank = false; });
  $('crank').oninput = e => { SIM.state.playing = false; playIcon(); setRefAngle(+e.target.value / 10); };
  $('rpm').oninput = e => { SIM.state.rpm = +e.target.value; $('rpmv').textContent = e.target.value; operatingChanged(); };
  $('load').oninput = e => { SIM.state.load = +e.target.value / 100; $('loadv').textContent = e.target.value + '%'; operatingChanged(); };
  $('fitAll').onclick = fitAll; $('homeView').onclick = () => homeView(true);
  $('openCfg').onclick = openSettings; $('openVerify').onclick = () => openVerify(); $('openNotes').onclick = openNotes;
  $('modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); if (e.key === ' ' && e.target === document.body) { e.preventDefault(); $('play').click(); } });
  $('glbfile').onchange = e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => applyGLB(rd.result, f.name); rd.readAsArrayBuffer(f); e.target.value = ''; };
  $('glbreset').onclick = resetGLB;
  // 클릭 선택
  let down = null;
  canvas.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5 || e.button !== 0) return;
    if (DV.open) { detailPick(e.clientX, e.clientY); return; }
    const h = pick(e.clientX, e.clientY); if (h) select(h.id, h.inst); else select(null);
  });
  renderPartList();
  // 기기 내부 구조 목록
  const groups = {};
  Object.values(DEVICES).forEach(d => { (groups[d.sys] = groups[d.sys] || []).push(d); });
  $('devlist').innerHTML = Object.entries(groups).map(([g, ds]) => `<div class="dgrp">${g}</div>` + ds.map(d => `<button class="btn wide" data-d="${d.id}"><span>${d.ko}</span><span>${d.en.split(' (')[0]}</span></button>`).join('')).join('');
  $('devlist').onclick = e => { const b = e.target.closest('[data-d]'); if (b) detailOpen(b.dataset.d); };
  $('dvClose').onclick = detailClose; $('dvClose2').onclick = detailClose;
  $('dvCutBtn').onclick = () => detailSetCut(!DV.cut);
  $('dvHome').onclick = () => { if (DV.home) { DV.cam.position.copy(DV.home.p); DV.ctrl.target.copy(DV.home.t); DV.ctrl.update(); } };
  $('dvParts').onclick = e => { const b = e.target.closest('.dp'); if (b) detailSelect(DV.labels[+b.dataset.i]); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && DV.open && $('modal').hidden) detailClose(); });
}
// 기준 실린더 크랭크각을 지정 → 전체 Θ를 연속적으로 이동 (흐름 적분 포함)
function setRefAngle(a) {
  const off = cylOffsets()[SIM.state.ref];
  const cur = SIM.state.theta;
  const d = a - wrap360(cur - off);          // 슬라이더 방향 그대로 (앞으로 끌면 정방향)
  const T1 = cur + d;
  advanceFlows(cur, T1); SIM.state.theta = T1;
  if (!SIM.noEngineAdvance) advanceEngine(d);   // 수동 조절도 |Δθ| 만큼 모의 시간이 흐름
}
function openNotes() {
  openModal(`<h2>자료 근거와 단순화</h2><p class="sub">시뮬레이터의 값과 형상이 어디에서 왔는지 정리했습니다. 실제 엔진 사양서(Project Guide)와 선박 계통도를 받으면 해당 항목을 교체하면 됩니다.</p>${NOTES_HTML}<div class="acts"><button class="btn on" onclick="document.getElementById('modal').hidden=true">닫기</button></div>`);
}

