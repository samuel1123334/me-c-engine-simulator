// ===================================================================
// 30 · ENGINE — 단면도 기준 배치 (y: 크랭크축 중심 = 0, x: +쪽 = 그림 오른쪽(연료·HCU), z: +쪽 = 선수(1번 실린더))
// ===================================================================
const merge = gs => mergeGeometries(gs.map(g => g.index ? g.toNonIndexed() : g), false);

const LY = {
  zc: k => (2.5 - k) * CFG.pitch,          // 실린더 k(0~5) 중심
  zb: j => (3 - j) * CFG.pitch,            // 메인 베어링 j(0~6)
  zF: 3.35, zA: -3.35,
  bedTop: 0.55, bedBot: -1.45, panBot: -2.3,
  frTop: 4.5, scavTop: 6.75, jackTop: 8.2,
  linerBot: 5.25,
};
const ROOT = new THREE.Group(); ROOT.name = 'root'; scene.add(ROOT);
const ENG = new THREE.Group(); ENG.name = 'engine'; ROOT.add(ENG);
const MOV = { crank: null, throws: [], xh: [], rod: [], spindle: [], fv: [], hpsGear: null, tcRotor: null, cyl: [] };
let BUILD_SYS = false;   // 계통 영역 부품은 절단면 적용 제외
const M_ = (k, o = {}) => mat(k, BUILD_SYS ? { ...o, noclip: true } : o);

function convexHull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  up.pop(); lo.pop(); return lo.concat(up);
}
const circPts = (cx, cy, r, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + (a1 - a0) * i / n) * DEG; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });

function buildEngine() {
  const r = M.r(), L = CFG.conrod, H = M.headY(), N = CFG.nCyl;
  const mPaint = M_('paint', { color: C.paint, metal: 0.25, rough: 0.62, housing: true });
  const mPaintD = M_('paintD', { color: C.paintD, metal: 0.25, rough: 0.66, housing: true });
  const mPaintL = M_('paintL', { color: C.paintL, metal: 0.25, rough: 0.6 });
  const mSteel = M_('steel', { color: C.steel, metal: 0.8, rough: 0.32 });
  const mSteelL = M_('steelL', { color: C.steelL, metal: 0.85, rough: 0.25 });
  const mSteelD = M_('steelD', { color: C.steelD, metal: 0.7, rough: 0.4 });
  const mCast = M_('cast', { color: C.cast, metal: 0.5, rough: 0.55 });
  const mBrass = M_('brass', { color: C.brass, metal: 0.9, rough: 0.3 });
  const mRing = M_('ring', { color: C.ring, metal: 0.85, rough: 0.3 });
  const mStel = M_('stellite', { color: C.stellite, metal: 0.7, rough: 0.25 });
  const mInsul = M_('insul', { color: C.insul, metal: 0.1, rough: 0.85 });
  const mCab = M_('cab', { color: C.cab, metal: 0.3, rough: 0.6 });
  const mBlack = M_('black', { color: 0x1d2124, metal: 0.4, rough: 0.6 });
  const mRed = M_('redp', { color: C.red, metal: 0.3, rough: 0.5 });
  const mPur = M_('purp', { color: C.pur, metal: 0.5, rough: 0.4 });
  const mYel = M_('yelp', { color: C.yel, metal: 0.5, rough: 0.4 });
  const mLiner = M_('liner', { color: 0x8a8f8f, metal: 0.7, rough: 0.38 });

  // ---------- 베드플레이트 ----------
  {
    const s = slot('bedplate', ENG);
    const gs = [];
    [-1, 1].forEach(sd => {
      gs.push(box(0.1, 1.98, 6.7, sd * 1.85, -0.45, 0, 0.01));
      gs.push(box(0.36, 0.06, 6.7, sd * 1.76, -1.42, 0, 0.01));
      gs.push(box(0.3, 0.06, 6.7, sd * 1.78, 0.52, 0, 0.01));
    });
    const gShape = () => shapeOf([[-1.8, -1.4], [1.8, -1.4], [1.8, 0.5], [-1.8, 0.5]], [{ circle: [0, 0, 0.43] }, { circle: [-1.18, -0.78, 0.2] }, { circle: [1.18, -0.78, 0.2] }]);
    for (let j = 0; j <= N; j++) { const z = LY.zb(j); gs.push(extXY(gShape(), z - 0.08, z + 0.08)); }
    [LY.zF, LY.zA].forEach(z => gs.push(extXY(shapeOf([[-1.9, -1.45], [1.9, -1.45], [1.9, 0.55], [-1.9, 0.55]], [{ circle: [0, 0, 0.40] }]), z - 0.04 * Math.sign(z) - 0.03, z - 0.04 * Math.sign(z) + 0.03)));
    s.add(merge(gs), mPaint);
  }
  // 오일 팬
  {
    const s = slot('oilpan', ENG);
    const out = [[-1.8, -1.45], [1.8, -1.45], [0.95, -2.3], [-0.95, -2.3]];
    const hole = [[-1.68, -1.5], [-0.9, -2.22], [0.9, -2.22], [1.68, -1.5]];
    s.add(merge([extXY(shapeOf(out, [hole]), -3.3, 3.3), extXY(shapeOf(out), 3.3, 3.34), extXY(shapeOf(out), -3.34, -3.3), cylX(0.09, 1.0, 1.32, 16).translate(0, -2.0, -2.0)]), mPaintD);
  }
  // 메인 베어링
  for (let j = 0; j <= N; j++) {
    const z = LY.zb(j), s = slot('mainbearing', ENG);
    s.add(ringZ(0.345, 0.43, z - 0.075, z + 0.075), mBrass);
    const studs = [-0.42, 0.42].map(x => cylY(0.035, 0.28, 0.7, 12).translate(x, 0, z));
    s.add(merge([box(1.05, 0.16, 0.2, 0, 0.5, z, 0.02), ...studs, ...[-0.42, 0.42].map(x => cylY(0.06, 0.58, 0.66, 6).translate(x, 0, z))]), mSteelD);
  }
  // ---------- 프레임 박스 ----------
  const wallX = (y, sd) => sd * (2.0 - (y - LY.bedTop) * (0.8 / (LY.frTop - LY.bedTop)));
  const tilt = Math.atan(0.8 / (LY.frTop - LY.bedTop));
  {
    const s = slot('framebox', ENG);
    const gs = [];
    [-1, 1].forEach(sd => {
      const pts = [[wallX(LY.bedTop, sd), LY.bedTop], [wallX(LY.bedTop, sd) - sd * 0.08, LY.bedTop], [wallX(LY.frTop, sd) - sd * 0.08, LY.frTop], [wallX(LY.frTop, sd), LY.frTop]];
      gs.push(extXY(shapeOf(sd < 0 ? pts : pts.slice().reverse()), LY.zA, LY.zF));
    });
    const outer = [[-2.0, LY.bedTop], [2.0, LY.bedTop], [1.2, LY.frTop], [-1.2, LY.frTop]];
    const hl = [[-1.62, 0.95], [-0.24, 0.95], [-0.24, 4.2], [-1.0, 4.2]], hr = hl.map(p => [-p[0], p[1]]).reverse();
    for (let j = 0; j <= N; j++) { const z = LY.zb(j); gs.push(extXY(shapeOf(outer, [hl, hr]), z - 0.03, z + 0.03)); }
    [LY.zF, LY.zA].forEach(z => gs.push(extXY(shapeOf(outer), z - 0.03, z + 0.03)));
    gs.push(box(2.5, 0.06, 6.7, 0, LY.frTop - 0.03, 0, 0.01));
    s.add(merge(gs), mPaint);
  }
  // 크로스헤드 가이드 (실린더마다 2개)
  for (let k = 0; k < N; k++) {
    const z = LY.zc(k), s = slot('guide', ENG, k);
    s.add(merge([-1, 1].map(sd => box(0.30, 3.5, 0.035, 0, 2.7, z + sd * 0.4525, 0.005))), mSteelL);
  }
  // 도어 (오른쪽), 릴리프 밸브 (왼쪽)
  for (let k = 0; k < N; k++) {
    const z = LY.zc(k);
    const d = slot('door', ENG, k);
    const y = 2.3, x = wallX(y, 1) + 0.02;
    const g = merge([box(0.05, 1.25, 0.66, 0, 0, 0, 0.02), box(0.06, 0.12, 0.08, 0.04, 0.35, 0, 0.01), box(0.06, 0.12, 0.08, 0.04, -0.35, 0, 0.01), cylX(0.03, 0.02, 0.1, 10).translate(0, 0, 0.22)]);
    g.rotateZ(tilt); g.translate(x, y, z); d.add(g, mPaintL);
    const rv = slot('relief', ENG, k);
    const y2 = 1.55, x2 = wallX(y2, -1) - 0.02;
    const g2 = merge([cylX(0.17, -0.06, 0.0, 28), cylX(0.2, -0.13, -0.06, 28), cylX(0.12, -0.2, -0.13, 20)]);
    g2.rotateZ(tilt); g2.translate(x2, y2, z); rv.add(g2, mRed);
  }
  // ---------- 실린더 프레임 · 소기 박스 ----------
  {
    const s = slot('scavbox', ENG);
    const gs = [];
    const zs = LY.zF - 0.05, ze = LY.zA + 0.05;
    // 왼쪽 벽 (리시버 쪽 개구부) — 형상은 (−z, y) 평면에서 정의 후 x 방향 압출
    const winHoles = Array.from({ length: N }, (_, k) => { const z = LY.zc(k); return [[-(z - 0.3), 5.55], [-(z - 0.3), 6.3], [-(z + 0.3), 6.3], [-(z + 0.3), 5.55]]; });
    const wallShape = shapeOf([[-zs, LY.frTop], [-ze, LY.frTop], [-ze, LY.scavTop], [-zs, LY.scavTop]], winHoles);
    const lw = new THREE.ExtrudeGeometry(wallShape, { depth: 0.07, bevelEnabled: false }); lw.rotateY(Math.PI / 2); lw.translate(-0.95, 0, 0);
    gs.push(lw);
    gs.push(box(0.07, LY.scavTop - LY.frTop, zs - ze, 0.915, (LY.frTop + LY.scavTop) / 2, (zs + ze) / 2, 0.005));
    const holes = k => ({ circle: [0, LY.zc(k), 0.27] });
    gs.push(extXZ(xzShape([[-0.95, zs], [0.95, zs], [0.95, ze], [-0.95, ze]], Array.from({ length: N }, (_, k) => holes(k))), LY.frTop, LY.frTop + 0.1));
    gs.push(extXZ(xzShape([[-0.95, zs], [0.95, zs], [0.95, ze], [-0.95, ze]], Array.from({ length: N }, (_, k) => ({ circle: [0, LY.zc(k), 0.345] }))), LY.scavTop - 0.08, LY.scavTop));
    [zs, ze].forEach(z => gs.push(box(1.9, LY.scavTop - LY.frTop, 0.06, 0, (LY.frTop + LY.scavTop) / 2, z - Math.sign(z) * 0.03, 0.005)));
    s.add(merge(gs), mPaintD);
  }
  for (let k = 0; k < N; k++) {
    const z = LY.zc(k), s = slot('cylframe', ENG, k);
    const g = extXZ(xzShape([[-0.95, z - 0.505], [0.95, z - 0.505], [0.95, z + 0.505], [-0.95, z + 0.505]], [{ circle: [0, z, 0.40] }]), LY.scavTop, LY.jackTop);
    s.add(g, mPaint);
  }
  // 스테이 볼트
  for (let j = 0; j <= N; j++) {
    const z = LY.zb(j), s = slot('staybolt', ENG);
    const gs = [];
    [-0.75, 0.75].forEach(x => { gs.push(cylY(0.045, -1.3, LY.jackTop + 0.12, 10).translate(x, 0, z)); gs.push(cylY(0.085, LY.jackTop, LY.jackTop + 0.1, 6).translate(x, 0, z)); gs.push(cylY(0.085, -1.36, -1.28, 6).translate(x, 0, z)); });
    s.add(merge(gs), mSteel);
  }
  // 스터핑 박스
  for (let k = 0; k < N; k++) {
    const z = LY.zc(k), s = slot('stuffing', ENG, k);
    const g = merge([lathe([[0.115, 4.3], [0.26, 4.3], [0.26, 4.36], [0.22, 4.36], [0.22, 4.58], [0.3, 4.58], [0.3, 4.64], [0.115, 4.64]], 40), ...[4.40, 4.47, 4.54].map(y => ringG(0.115, 0.235, y, y + 0.025, 32))]);
    g.translate(0, 0, z); s.add(g, mSteelD);
  }

  // ---------- 크랭크축 (회전 그룹) ----------
  const crank = new THREE.Group(); crank.name = 'crank'; ENG.add(crank); MOV.crank = crank;
  const offs = cylOffsets();
  {
    const s = slot('crankshaft', crank);
    const gs = [];
    for (let j = 0; j <= N; j++) { const z = LY.zb(j); gs.push(cylZ(0.34, z - 0.21, z + 0.21, 40)); }
    gs.push(cylZ(0.25, LY.zb(0) + 0.2, 3.78, 32));
    gs.push(cylZ(0.36, LY.zb(N) - 0.2, -4.08, 40));
    gs.push(cylZ(0.42, -3.62, -3.58, 40));
    s.add(merge(gs), mSteel);
  }
  const webPts = convexHull([...circPts(0, 0, 0.55, 0, 360, 36), ...circPts(0, r, 0.44, 0, 360, 36), ...circPts(0, 0, 0.95, 215, 325, 14)]);
  for (let k = 0; k < N; k++) {
    const z = LY.zc(k);
    const th = new THREE.Group(); th.name = 'throw' + (k + 1); th.rotation.z = offs[k] * DEG; crank.add(th); MOV.throws.push(th);
    const w = slot('crankshaft', th, k);
    const ws = shapeOf(webPts);
    w.add(merge([extXY(ws, z + 0.15, z + 0.31, 0), extXY(ws, z - 0.31, z - 0.15, 0)]), mSteelD);
    const p = slot('crankpin', th, k);
    p.add(cylZ(0.30, z - 0.15, z + 0.15, 40).translate(0, r, 0), mSteelL);
  }
  // 체인 스프로킷 + 플라이휠 (크랭크축과 같은 회전)
  {
    const s = slot('chain', crank);
    const teeth = Array.from({ length: 36 }, (_, i) => { const g = box(0.06, 0.08, 0.1, 0, 0.66, -3.5, 0.005); g.rotateZ(i * 10 * DEG); return g; });
    s.add(merge([cylZ(0.64, -3.55, -3.45, 48), ...teeth]), mSteelD);
    const f = slot('flywheel', crank);
    const prof = [[0.36, -3.78], [1.4, -3.78], [1.55, -3.74], [1.55, -4.02], [1.4, -4.06], [0.36, -4.06]];
    const fw = lathe(prof.map(q => [q[0], q[1]]), 72); fw.rotateX(Math.PI / 2);
    const gearT = Array.from({ length: 90 }, (_, i) => { const g = box(0.05, 0.06, 0.2, 0, 1.58, -3.88, 0.004); g.rotateZ(i * 4 * DEG); return g; });
    f.add(merge([fw, ...gearT]), mCast);
    const marks = Array.from({ length: 36 }, (_, i) => { const g = box(0.012, i % 9 === 0 ? 0.18 : 0.08, 0.01, 0, 1.45 - (i % 9 === 0 ? 0.09 : 0.04), -3.775, 0.001); g.rotateZ(i * 10 * DEG); return g; });
    f.add(merge(marks), M_('mark', { color: 0xe8ddbf, metal: 0.2, rough: 0.5 }));
  }

  // ---------- 실린더별 운동부와 연소실 ----------
  const [po] = M.portAngles();
  for (let k = 0; k < N; k++) {
    const z = LY.zc(k);
    const cylRec = { k, z };
    // 크로스헤드 + 피스톤 로드 + 피스톤 (수직 왕복 강체). 그룹 원점 = 크로스헤드 핀 중심
    const xh = new THREE.Group(); xh.name = 'xh' + (k + 1); xh.position.set(0, M.xhY(0), z); ENG.add(xh); MOV.xh.push(xh);
    slot('xhpin', xh, k).add(merge([cylZ(0.20, -0.352, 0.352, 36), box(0.42, 0.2, 0.26, 0, 0.3, 0, 0.03)]), mSteelL);
    slot('shoe', xh, k).add(merge([-1, 1].map(sd => box(0.40, 0.55, 0.07, 0, 0, sd * 0.395, 0.01))), mBrass);
    const PH = CFG.pistonH;
    slot('pistonrod', xh, k).add(merge([cylY(0.11, 0.4, PH - 0.6, 28), cylY(0.2, 0.38, 0.46, 32), cylY(0.17, PH - 0.66, PH - 0.6, 32)]), mSteelL);
    {
      const s = slot('piston', xh, k);
      const crown = lathe([[0, PH - 0.02], [0.12, PH - 0.035], [0.2, PH - 0.01], [0.27, PH], [0.296, PH - 0.01], [0.296, PH - 0.25], [0.2, PH - 0.25], [0.2, PH - 0.3], [0, PH - 0.3]], 56);
      s.add(crown, mSteel);
      s.add(lathe([[0.18, PH - 0.25], [0.29, PH - 0.25], [0.29, PH - 0.6], [0.18, PH - 0.6]], 48), mSteelD);
    }
    slot('rings', xh, k).add(merge([0.035, 0.075, 0.115, 0.155].map(d => ringG(0.284, 0.301, PH - d - 0.018, PH - d, 56))), mRing);

    // 커넥팅 로드 (원점 = 크로스헤드 핀, 회전 = 로드 각)
    const rod = new THREE.Group(); rod.name = 'rod' + (k + 1); rod.position.set(0, M.xhY(0), z); ENG.add(rod); MOV.rod.push(rod);
    {
      const s = slot('conrod', rod, k);
      const sh = shapeOf([[-0.075, -0.3], [0.075, -0.3], [0.11, -(L - 0.44)], [-0.11, -(L - 0.44)]]);
      const gs = [extXY(sh, -0.09, 0.09, 0.01), ringZ(0.33, 0.47, -0.13, 0.13, 48).translate(0, -L, 0), ringZ(0.22, 0.33, -0.14, 0.14, 40)];
      [-0.4, 0.4].forEach(x => { gs.push(cylY(0.035, -L - 0.42, -L + 0.18, 10).translate(x, 0, 0)); gs.push(cylY(0.06, -L - 0.46, -L - 0.4, 6).translate(x, 0, 0)); });
      gs.push(box(0.98, 0.02, 0.27, 0, -L, 0, 0.001));
      s.add(merge(gs), mSteel);
      slot('cpbearing', rod, k).add(ringZ(0.30, 0.33, -0.13, 0.13, 48).translate(0, -L, 0), mBrass);
      slot('xhbearing', rod, k).add(ringZ(0.20, 0.22, -0.14, 0.14, 40), mBrass);
    }

    // 라이너 + 소기 포트
    {
      const s = slot('liner', ENG, k);
      const pT = M.portTop(), pB = M.portBot();
      const g = merge([
        ringG(0.30, 0.335, LY.linerBot, pB, 56),
        ringG(0.30, 0.335, pT, 7.9, 56),
        lathe([[0.30, 7.9], [0.44, 7.9], [0.44, H - 0.02], [0.40, H], [0.30, H]], 56),
        ringG(0.335, 0.37, 6.6, 6.68, 56),
        ...[0, 1].map(i => { const q = cylX(0.03, 0.30, 0.47, 10); q.rotateY((i ? 40 : -40) * DEG); q.translate(0, 7.55, 0); return q; }),
      ]);
      g.translate(0, 0, z); s.add(g, mLiner);
      const ps = slot('ports', ENG, k);
      const nP = 16, bars = [];
      for (let i = 0; i < nP; i++) {
        const b = box(0.035, pT - pB, 0.055, 0.3175, (pT + pB) / 2, 0, 0.003);
        b.rotateY(22 * DEG);                       // 접선 방향 경사 (선회 유도)
        const g2 = new THREE.BufferGeometry().copy(b); b.dispose();
        g2.translate(0, 0, 0); g2.rotateY(i * 2 * Math.PI / nP);
        bars.push(g2);
      }
      const pg = merge(bars); pg.translate(0, 0, z); ps.add(pg, mLiner);
    }
    // 실린더 커버
    {
      const s = slot('cover', ENG, k);
      const g = lathe([[0.22, H + 0.03], [0.30, H], [0.56, H], [0.56, H + 0.42], [0.30, H + 0.42], [0.22, H + 0.3]], 56);
      const studs = Array.from({ length: 8 }, (_, i) => { const a = (i + 0.5) * 45 * DEG; return [cylY(0.03, H + 0.4, H + 0.56, 10).translate(0.5 * Math.cos(a), 0, 0.5 * Math.sin(a)), cylY(0.055, H + 0.42, H + 0.48, 6).translate(0.5 * Math.cos(a), 0, 0.5 * Math.sin(a))]; }).flat();
      const gm = merge([g, ...studs]); gm.translate(0, 0, z); s.add(gm, mSteelD);
      const seat = slot('evseat', ENG, k);
      const sg = lathe([[0.165, H + 0.0], [0.22, H + 0.0], [0.22, H + 0.07], [0.195, H + 0.07], [0.165, H + 0.035]], 48); sg.translate(0, 0, z);
      seat.add(sg, mStel);
    }
    // 배기밸브 하우징 · 공기 스프링 · 상부 유압 실린더
    {
      const s = slot('evhousing', ENG, k);
      const g = merge([
        lathe([[0.06, H + 0.42], [0.21, H + 0.42], [0.21, H + 0.62], [0.30, H + 0.66], [0.30, H + 1.38], [0.24, H + 1.42], [0.06, H + 1.42]], 48),
        cylX(0.18, -0.64, -0.2, 32).translate(0, H + 0.86, 0),
        ringX(0.17, 0.24, -0.68, -0.6, 32).translate(0, H + 0.86, 0),
      ]);
      g.translate(0, 0, z); s.add(g, mCast);
      const a = slot('airspring', ENG, k);
      const ag = merge([lathe([[0.04, H + 1.42], [0.17, H + 1.42], [0.17, H + 1.75], [0.04, H + 1.75]], 40), cylX(0.03, 0.17, 0.3, 10).translate(0, H + 1.55, 0)]); ag.translate(0, 0, z);
      a.add(ag, mSteelD);
      const hc = slot('evact', ENG, k);
      const hg = merge([cylY(0.115, H + 1.75, H + 2.06, 32), cylY(0.14, H + 1.75, H + 1.8, 32), cylX(0.035, 0.1, 0.2, 10).translate(0, H + 1.95, 0)]); hg.translate(0, 0, z);
      hc.add(hg, mPur);
    }
    // 배기밸브 스핀들 (이동 그룹, 원점 = 닫힌 상태 디스크 하면)
    {
      const sp = new THREE.Group(); sp.name = 'spindle' + (k + 1); sp.position.set(0, H, z); ENG.add(sp); MOV.spindle.push(sp);
      const s = slot('evspindle', sp, k);
      s.add(merge([lathe([[0, -0.005], [0.17, -0.005], [0.2, 0.03], [0.07, 0.07], [0.04, 0.1], [0, 0.1]], 48), cylY(0.035, 0.09, 1.82, 20), cylY(0.14, 1.55, 1.65, 32), cylY(0.08, 1.7, 1.8, 24)]), mSteelL);
    }
    // 연료 분사밸브 2개 (−35°, −145°), 바깥쪽 15° 경사
    cylRec.fv = [];
    [-35, -145].forEach((ang, vi) => {
      const a = ang * DEG, rr = 0.262;
      const nozzle = V3(rr * Math.cos(a), H - 0.03, z + rr * Math.sin(a));
      const out = V3(Math.cos(a), 0, Math.sin(a));
      const axis = V3(0, 1, 0).addScaledVector(out, Math.tan(15 * DEG)).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), axis);
      const s = slot('fuelvalve', ENG, k);
      const g = merge([cylY(0.04, 0.05, 0.62, 20), cylY(0.07, 0.42, 0.66, 24), cylY(0.035, 0.66, 0.76, 12), box(0.16, 0.06, 0.06, 0, 0.5, 0, 0.01)]);
      g.applyQuaternion(q); g.translate(nozzle.x, nozzle.y, nozzle.z); s.add(g, mSteel);
      const n = slot('nozzle', ENG, k);
      const ng = merge([cylY(0.022, 0.0, 0.06, 16), sphere(0.024, 0, 0.0, 0)]); ng.applyQuaternion(q); ng.translate(nozzle.x, nozzle.y, nozzle.z);
      n.add(ng, mBrass);
      const top = nozzle.clone().addScaledVector(axis, 0.76);
      const dir = V3(-Math.cos(a) * 0.75 - Math.sin(a) * 0.45, -0.32, -Math.sin(a) * 0.75 + Math.cos(a) * 0.45).normalize();
      cylRec.fv.push({ nozzle, top, dir });
    });
    // 시동 공기 밸브
    {
      const a = 200 * DEG, x = 0.40 * Math.cos(a), zz = z + 0.40 * Math.sin(a);
      const s = slot('startvalve', ENG, k);
      s.add(merge([cylY(0.065, H + 0.42, H + 0.62, 20).translate(x, 0, zz), cylY(0.045, H + 0.62, H + 0.74, 16).translate(x, 0, zz)]), mSteelD);
      cylRec.sv = V3(x, H + 0.74, zz);
    }
    // HCU 구성품 (오른쪽)
    {
      slot('hcu', ENG, k).add(merge([box(0.22, 1.55, 0.62, 1.3, 7.78, z, 0.02), box(0.26, 0.18, 0.3, 1.07, 7.8, z, 0.01), box(0.26, 0.18, 0.3, 1.07, 7.2, z, 0.01)]), M_('hcu', { color: 0x4a5560, metal: 0.5, rough: 0.45 }));
      const ac = slot('accum', ENG, k);
      ac.add(merge([-1, 1].map(sd => merge([cylY(0.1, 7.05, 7.4, 24), sphere(0.1, 0, 7.4, 0), sphere(0.1, 0, 7.05, 0)]).translate(1.55, 0, z + sd * 0.2))), M_('accum', { color: 0x7a6aa0, metal: 0.4, rough: 0.4 }));
      slot('fiva', ENG, k).add(merge([box(0.16, 0.18, 0.22, 1.52, 7.58, z, 0.02), cylX(0.05, 1.6, 1.8, 16).translate(0, 7.58, z), box(0.04, 0.08, 0.08, 1.82, 7.58, z, 0.005)]), mPur);
      slot('evactuator', ENG, k).add(merge([cylY(0.09, 7.82, 8.12, 24), cylY(0.11, 7.82, 7.86, 24), cylY(0.11, 8.08, 8.12, 24)]).translate(1.55, 0, z - 0.15), mPur);
      slot('fpb', ENG, k).add(merge([cylY(0.12, 8.02, 8.3, 28), cylY(0.14, 8.27, 8.32, 28), cylY(0.08, 8.32, 8.72, 24), cylY(0.1, 8.68, 8.75, 20)]).translate(1.55, 0, z + 0.15), mYel);
      slot('lubricator', ENG, k).add(merge([box(0.14, 0.22, 0.14, 1.12, 7.35, z + 0.36, 0.01), ...[-0.03, 0.03].map(dz => cylX(0.012, 0.95, 1.06, 8).translate(0, 7.42, z + 0.36 + dz))]), M_('lub', { color: 0x5e7a8f, metal: 0.5, rough: 0.4 }));
      slot('mpc', ENG, k).add(merge([box(0.26, 1.1, 0.4, 2.45, 5.85, z, 0.02), box(1.38, 0.08, 0.08, 1.64, 5.85, z, 0.01), box(0.02, 0.9, 0.3, 2.59, 5.85, z, 0.005), cylY(0.02, 6.4, 7.05, 8).translate(2.4, 0, z + 0.12)]), mCab);
      cylRec.mpcLed = V3(2.6, 6.2, z);
    }
    // PCO 온도계
    slot('pco', ENG, k).add(merge([cylX(0.07, 0.0, 0.05, 20), box(0.1, 0.16, 0.06, -0.04, -0.11, 0, 0.01)]).translate(wallX(0.95, 1) + 0.02, 0.95, z + 0.3), M_('gauge', { color: 0xd8d4c8, metal: 0.2, rough: 0.5 }));
    MOV.cyl.push(cylRec);
  }
  // 오일 미스트 검출기 (오른쪽 프레임 벽)
  {
    const s = slot('oilmist', ENG);
    const x = wallX(2.8, 1) + 0.12;
    const gs = [box(0.2, 0.42, 0.5, x, 2.8, 0.0, 0.03), cylZ(0.02, -2.6, 2.6, 8).translate(wallX(3.3, 1) + 0.05, 3.3, 0)];
    for (let k = 0; k < N; k++) gs.push(cylX(0.015, wallX(3.3, 1) - 0.06, wallX(3.3, 1) + 0.05, 8).translate(0, 3.3, LY.zc(k)));
    gs.push(cylY(0.02, 2.95, 3.3, 8).translate(x - 0.04, 0, 0));
    s.add(merge(gs), M_('omd', { color: 0xc9b46a, metal: 0.3, rough: 0.5 }));
  }
  // 엔코더 (선수 축단)
  slot('encoder', ENG).add(merge([cylZ(0.16, 3.78, 3.86, 32), box(0.5, 0.6, 0.2, 0, -0.1, 3.94, 0.03), box(0.5, 0.06, 0.4, 0, -0.43, 3.78, 0.01)]), mCab);
  // 터닝 기어
  {
    const s = slot('turning', ENG);
    const a = 125 * DEG, rp = 1.67, px = rp * Math.sin(a), py = rp * Math.cos(a);
    s.add(merge([cylZ(0.12, -3.98, -3.78, 20).translate(px, py, 0), box(0.55, 0.45, 0.5, px + 0.42, py - 0.32, -3.88, 0.03), cylX(0.16, px + 0.7, px + 1.15, 24).translate(0, py - 0.32, -3.88)]), mCab);
  }
  // 체인 (정지 링크 표현) + HPS 구동 기어
  {
    const s = slot('chain', ENG);
    const c1 = V3(0, 0, -3.5), c2 = V3(2.2, 1.1, -3.5), r1 = 0.68, r2 = 0.34;
    const pts = [];
    const d = c2.clone().sub(c1), len = d.length(), ang = Math.atan2(d.y, d.x), beta = Math.acos((r1 - r2) / len);
    for (let i = 0; i <= 24; i++) { const t = ang + beta + (2 * Math.PI - 2 * beta) * i / 24; pts.push(V3(c1.x + r1 * Math.cos(t), c1.y + r1 * Math.sin(t), -3.5)); }
    for (let i = 0; i <= 12; i++) { const t = ang - beta + 2 * beta * i / 12; pts.push(V3(c2.x + r2 * Math.cos(t), c2.y + r2 * Math.sin(t), -3.5)); }
    const curve = new THREE.CatmullRomCurve3(pts, true);
    s.add(new THREE.TubeGeometry(curve, 160, 0.03, 6, true), M_('chainm', { color: 0x3d4347, metal: 0.8, rough: 0.35 }));
    const gear = new THREE.Group(); gear.position.copy(c2); ENG.add(gear); MOV.hpsGear = gear;
    const gt = Array.from({ length: 20 }, (_, i) => { const g = box(0.05, 0.07, 0.1, 0, 0.38, 0, 0.004); g.rotateZ(i * 18 * DEG); return g; });
    slot('chain', gear).add(merge([cylZ(0.36, -0.05, 0.05, 32), ...gt, cylZ(0.1, -0.05, 0.6, 16)]), mSteelD);
  }

  // 시동 공기 분배관 · 주 시동 밸브
  {
    const s = slot('startpipe', ENG);
    const gs = [cylZ(0.07, -2.9, 3.0, 16).translate(-0.85, 9.02, 0)];
    MOV.cyl.forEach(c => { const rt = new Route([c.sv, [c.sv.x, 9.02, c.sv.z], [-0.85, 9.02, c.sv.z]], 0.08); gs.push(tubeG(rt, 0.03, 8)); });
    s.add(merge(gs), M_('startair', { color: 0x7d8a92, metal: 0.6, rough: 0.4, pipe: true }));
    const m = slot('mainstart', ENG);
    m.add(merge([box(0.32, 0.42, 0.36, -1.15, 7.3, 2.95, 0.03), cylY(0.06, 7.5, 7.75, 16).translate(-1.15, 0, 2.95), cylX(0.09, -1.5, -1.3, 16).translate(0, 7.2, 2.95), tubeG(new Route([[-1.15, 7.7, 2.95], [-1.15, 8.6, 2.95], [-0.85, 8.85, 2.95], [-0.85, 9.02, 2.95]], 0.15), 0.06, 10)]), mRed);
  }
}

