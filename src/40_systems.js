// ===================================================================
// 40 · SYSTEMS — 계통 부품 + 유로(경로). 경로 양 끝은 유체 종류가 지정된 포트에 연결된다.
// 같은 Route가 배관 형상과 입자 경로를 동시에 만든다.
// ===================================================================
const PORTS = {};          // id → { pos, fluid, node }
const PATHS = [];          // { id, fluid, route, from, to, nodes[], cyl, rate(θ, st), clip, spacing }
const FLUID = {
  air: { ko: '소기 공기', color: 0x3d8bfd, css: 'var(--air)', style: 'solid' },
  fuel: { ko: '연료', color: 0xf2c230, css: 'var(--fuel)', style: 'solid' },
  comb: { ko: '연소 영역', color: 0xff8a1f, css: 'var(--comb)', style: 'solid' },
  exh: { ko: '배기가스', color: 0xe5484d, css: 'var(--exh)', style: 'solid' },
  oil: { ko: '제어유', color: 0xa46bf0, css: 'var(--oil)', style: 'solid' },
  water: { ko: '보일러 물', color: 0x34c38f, css: 'var(--water)', style: 'dash' },
  steam: { ko: '증기', color: 0xcfdde6, css: 'var(--steam)', style: 'dot' },
};
const PIPE_COL = { air: 0x6f8496, fuel: 0x7b6d3c, exh: C.insul, oil: 0x6c5a86, water: 0x4c7a66, steam: 0x9aa6ad };
function port(id, pos, fluid, node) { PORTS[id] = { id, pos: pos.isVector3 ? pos.clone() : V3(...pos), fluid, node }; return id; }
const P_ = id => { const p = PORTS[id]; if (!p) throw new Error('port ' + id); return p.pos; };

// legs: [{ pts:[...], r: 배관 반경(0=부품 내부), part, clip }]
function flow(id, fluid, legs, o) {
  const all = [];
  const pipes = [];
  legs.forEach(lg => {
    const pts = lg.pts.map(p => typeof p === 'string' ? P_(p).clone() : (p.isVector3 ? p.clone() : V3(...p)));
    if (lg.r) pipes.push({ pts, r: lg.r, part: lg.part, clip: lg.clip ?? o.clip });
    pts.forEach(p => { if (!all.length || all[all.length - 1].distanceTo(p) > 1e-6) all.push(p); });
  });
  const route = new Route(all, o.rc ?? 0.14);
  const rec = { id, fluid, route, from: o.from, to: o.to, nodes: o.nodes || [], cyl: o.cyl ?? null, rate: o.rate, clip: o.clip ?? true, spacing: o.spacing ?? 0.18, phase: 0, lastRate: 0, arrows: o.arrows ?? true, tint: o.tint };
  PATHS.push(rec);
  pipes.forEach(pp => {
    const was = BUILD_SYS; BUILD_SYS = !pp.clip;
    const m = M_('pipe-' + fluid, { color: PIPE_COL[fluid], metal: 0.45, rough: 0.5, pipe: true });
    const rt = new Route(pp.pts, o.rc ?? 0.14);
    slot(pp.part, BUILD_SYS ? SYSG : ENG, rec.cyl).add(tubeG(rt, pp.r, pp.r > 0.12 ? 20 : 10), m);
    BUILD_SYS = was;
  });
  return rec;
}
const SYSG = new THREE.Group(); SYSG.name = 'systems'; ROOT.add(SYSG);

function buildSystems() {
  const H = M.headY(), N = CFG.nCyl;
  const X0 = -3.55, Y0 = 8.0;           // 터보차저 축 중심
  const st = () => SIM.state;
  // 배관 입자 속도 = 0D/평균값 모델 질량유량에 비례 (정격 ≈ 1)
  const airRate = () => Math.max(0.04, ENGS.mdC / 27);
  const exhRate = () => Math.max(0.04, ENGS.mdT / 27);
  const fuelCirc = () => 0.55;
  const oilRate = () => 0.35 + 0.4 * st().load;
  const wRate = () => 0.15 + 0.6 * st().load;

  // ============ 엔진 장착 부품 (절단 적용) ============
  BUILD_SYS = false;
  const mIns = M_('insul2', { color: C.insul, metal: 0.1, rough: 0.85, housing: true });
  const mCast = M_('cast', { color: C.cast, metal: 0.5, rough: 0.55 });
  const mSteelD = M_('steelD', { color: C.steelD, metal: 0.7, rough: 0.4 });
  // 배기가스 리시버
  const RX = -1.88, RY = 9.75, RR = 0.76;
  {
    const s = slot('exhrec', ENG);
    const cap = z => { const g = sphere(RR, 0, 0, 0); g.scale(1, 1, 0.45); g.translate(RX, RY, z); return g; };
    s.add(merge([cylZ(RR, -3.2, 3.2, 48).translate(RX, RY, 0), cap(3.2), cap(-3.2), ...[-2.0, 0, 2.0].map(z => box(0.75, 0.12, 0.2, -1.33, 8.95, z, 0.01)), ...[-2.0, 0, 2.0].map(z => box(0.12, 0.6, 0.2, -1.66, 8.68, z, 0.01)), ...[-3.0, -1.5, 0, 1.5, 3.0].map(z => ringZ(RR, RR + 0.03, z - 0.03, z + 0.03, 48).translate(RX, RY, 0))]), mIns);
  }
  for (let k = 0; k < N; k++) { const z = LY.zc(k); port('exhrec.i' + k, [-1.62, 9.7, z], 'exh', 'exhrec'); }
  port('exhrec.o', [-1.95, 9.6, -1.2], 'exh', 'exhrec');
  // 소기 리시버
  const SX = -1.55, SY = 5.85, SR = 0.62;
  {
    const s = slot('scavrec', ENG);
    const cap = z => { const g = sphere(SR, 0, 0, 0); g.scale(1, 1, 0.4); g.translate(SX, SY, z); return g; };
    s.add(merge([cylZ(SR, -3.2, 3.2, 48).translate(SX, SY, 0), cap(3.2), cap(-3.2)]), M_('scavrec', { color: 0x5f7380, metal: 0.4, rough: 0.5, housing: true }));
  }
  for (let k = 0; k < N; k++) port('scavrec.o' + k, [SX, SY, LY.zc(k)], 'air', 'scavrec');

  // 실린더별 배기·소기·연료·제어유 경로
  for (let k = 0; k < N; k++) {
    const z = LY.zc(k), c = MOV.cyl[k];
    // 포트 정의
    port('evseat' + k, [-0.08, H + 0.05, z - 0.06], 'exh', 'cyl' + k);
    port('portL' + k, [-0.33, 6.09, z - 0.06], 'air', 'cyl' + k);
    port('portR' + k, [0.33, 6.09, z], 'air', 'cyl' + k);
    // 소기: 리시버 → 소기 박스 → 포트
    const sc = th => (M.portFrac(th) > 0 && ENGS.cyc) ? TQ.get(ENGS.cyc.out.mIn, th) / 28 : 0;   // 포트 기하로 개폐, 크기는 0D 유입 질량유량
    flow('air.box' + k + 'L', 'air', [{ pts: ['scavrec.o' + k, [-0.95, 5.95, z - 0.06], [-0.55, 6.03, z - 0.06], 'portL' + k] }], { from: 'scavrec.o' + k, to: 'portL' + k, nodes: ['scavrec', 'scavbox', 'ports', 'cyl' + k], cyl: k, rate: sc, spacing: 0.1 });
    flow('air.box' + k + 'R', 'air', [{ pts: ['scavrec.o' + k, [-0.95, 5.95, z], [-0.64, 6.0, z - 0.42], [0.58, 6.03, z - 0.42], [0.56, 6.06, z - 0.2], 'portR' + k] }], { from: 'scavrec.o' + k, to: 'portR' + k, nodes: ['scavrec', 'scavbox', 'ports', 'cyl' + k], cyl: k, rate: sc, spacing: 0.1 });
    // 배기: 밸브 시트 → 하우징 → 배기관 → 리시버
    flow('exh.cyl' + k, 'exh', [
      { pts: ['evseat' + k, [-0.12, H + 0.6, z - 0.06], [-0.2, H + 0.86, z - 0.06], [-0.66, H + 0.86, z]] },
      { pts: [[-0.66, H + 0.86, z], [-0.95, 9.42, z], [-1.22, 9.62, z]], r: 0.19, part: 'exhpipe' },
      { pts: [[-1.22, 9.62, z], 'exhrec.i' + k] },
    ], {
      from: 'evseat' + k, to: 'exhrec.i' + k, nodes: ['cyl' + k, 'evspindle', 'exhpipe', 'exhrec'], cyl: k, spacing: 0.12,
      rate: th => (M.evLift01(th) > 0 && ENGS.cyc) ? TQ.get(ENGS.cyc.out.mOut, th) / 11 : 0,   // 블로다운 급증·역류 포함 (0D 유출 질량유량)
    });
    // 연료: 공급관 → 부스터 → 고압관 → 분사밸브 2개
    port('rail.b' + k, [1.85, 8.95, z + 0.15], 'fuel', 'fuelrail');
    port('fpb.in' + k, [1.69, 8.52, z + 0.15], 'fuel', 'fpb' + k);
    port('fpb.out' + k, [1.55, 8.75, z + 0.15], 'fuel', 'fpb' + k);
    flow('fuel.feed' + k, 'fuel', [{ pts: ['rail.b' + k, [1.85, 8.52, z + 0.15], 'fpb.in' + k], r: 0.025, part: 'fuelrail' }], { from: 'rail.b' + k, to: 'fpb.in' + k, nodes: ['fuelrail', 'fpb' + k], cyl: k, rate: () => 0.25 * st().load, spacing: 0.1 });
    c.fv.forEach((fv, vi) => {
      const nid = port('nozzle' + k + '_' + vi, fv.nozzle, 'fuel', 'cyl' + k);
      const pts = vi === 0
        ? ['fpb.out' + k, [1.55, 9.45, z + 0.15], [fv.top.x, 9.45, fv.top.z], fv.top]
        : ['fpb.out' + k, [1.55, 9.55, z + 0.15], [0.55, 9.55, z - 0.5], [fv.top.x, 9.55, z - 0.5], [fv.top.x, 9.55, fv.top.z], fv.top];
      flow('fuel.hp' + k + '_' + vi, 'fuel', [{ pts, r: 0.028, part: 'hpfuel' }, { pts: [fv.top, nid] }], { from: 'fpb.out' + k, to: nid, nodes: ['fpb' + k, 'hpfuel', 'fuelvalve', 'cyl' + k], cyl: k, rate: th => M.inj01(th, st().load) * 3.2, spacing: 0.07, rc: 0.08 });
    });
    // 제어유: 고압관 → HCU(축압기) → FIVA → 부스터 / 배기밸브 액추에이터 → 배기밸브
    port('ctrl.o' + k, [1.15, 6.62, z], 'oil', 'ctrlrail');
    port('fiva' + k, [1.52, 7.58, z], 'oil', 'fiva' + k);
    port('fpb.hyd' + k, [1.55, 8.12, z + 0.15], 'oil', 'fpb' + k);
    port('ev.hyd' + k, [0.0, H + 1.95, z], 'oil', 'evact' + k);
    port('hcu.drain' + k, [1.36, 7.02, z + 0.25], 'oil', 'hcu' + k);
    port('cc.drain' + k, [1.24, 3.9, z + 0.25], 'oil', 'crankcase');
    flow('oil.hcu' + k, 'oil', [{ pts: ['ctrl.o' + k, [1.15, 6.92, z]], r: 0.035, part: 'ctrlrail' }, { pts: [[1.15, 6.92, z], [1.3, 7.05, z], [1.5, 7.22, z], 'fiva' + k] }], { from: 'ctrl.o' + k, to: 'fiva' + k, nodes: ['ctrlrail', 'hcu' + k, 'accum', 'fiva' + k], cyl: k, rate: th => 0.3 + 1.2 * M.inj01(th, st().load) + 1.2 * Math.max(0, M.evLiftRate(th)) * 20, spacing: 0.08 });
    flow('oil.fpb' + k, 'oil', [{ pts: ['fiva' + k, [1.55, 7.72, z + 0.15], 'fpb.hyd' + k] }], { from: 'fiva' + k, to: 'fpb.hyd' + k, nodes: ['fiva' + k, 'fpb' + k], cyl: k, rate: th => M.inj01(th, st().load) * 1.6, spacing: 0.06 });
    flow('oil.ev' + k, 'oil', [
      { pts: ['fiva' + k, [1.55, 7.72, z - 0.15], [1.55, 8.12, z - 0.15]] },
      { pts: [[1.55, 8.12, z - 0.15], [1.55, H + 1.95, z - 0.15], [0.45, H + 1.95, z - 0.15], [0.2, H + 1.95, z]], r: 0.03, part: 'hpoil_ev' },
      { pts: [[0.2, H + 1.95, z], 'ev.hyd' + k] },
    ], { from: 'fiva' + k, to: 'ev.hyd' + k, nodes: ['fiva' + k, 'evactuator', 'hpoil_ev', 'evact' + k], cyl: k, rate: th => M.evLiftRate(th) * 40, spacing: 0.1, rc: 0.1 });
    flow('oil.drain' + k, 'oil', [{ pts: ['hcu.drain' + k, [1.36, 6.4, z + 0.25], [1.36, 4.05, z + 0.25], 'cc.drain' + k], r: 0.03, part: 'drain' }], { from: 'hcu.drain' + k, to: 'cc.drain' + k, nodes: ['hcu' + k, 'drain', 'crankcase'], cyl: k, rate: () => 0.3, spacing: 0.15 });
  }
  // 연료 공급·복귀 레일 (엔진 장착)
  port('rail.in', [1.85, 8.95, 3.2], 'fuel', 'fuelrail');
  port('rail.aft', [2.0, 8.95, -3.25], 'fuel', 'fuelrail');
  flow('fuel.rail', 'fuel', [{ pts: ['rail.in', [1.85, 8.95, -3.25], 'rail.aft'], r: 0.05, part: 'fuelrail' }], { from: 'rail.in', to: 'rail.aft', nodes: ['fuelrail'], rate: fuelCirc, spacing: 0.22 });
  // 제어유 고압관
  port('ctrl.in', [1.15, 6.62, -3.0], 'oil', 'ctrlrail');
  port('ctrl.end', [1.15, 6.62, 2.75], 'oil', 'ctrlrail');
  flow('oil.rail', 'oil', [{ pts: ['ctrl.in', 'ctrl.end'], r: 0.075, part: 'ctrlrail' }], { from: 'ctrl.in', to: 'ctrl.end', nodes: ['ctrlrail'], rate: oilRate, spacing: 0.22 });

  // ============ 계통 영역 (절단 미적용) ============
  BUILD_SYS = true;
  const mSys = M_('sysm', { color: 0x6a7780, metal: 0.45, rough: 0.5 });
  const mSysD = M_('sysd', { color: 0x4b555c, metal: 0.45, rough: 0.55 });
  const mMotor = M_('motor', { color: 0x3f6f8a, metal: 0.35, rough: 0.5 });
  const mTank = M_('tank', { color: 0x7d7766, metal: 0.25, rough: 0.6, housing: true });
  const mHousing = M_('sysH', { color: 0x6a7780, metal: 0.45, rough: 0.5, housing: true });
  const mInsS = M_('insulS', { color: C.insul, metal: 0.1, rough: 0.85, housing: true });
  const pump = (part, x, y, z, ax = 'x') => {
    const s = slot(part, SYSG);
    const body = ax === 'x' ? cylX(0.15, x - 0.2, x + 0.2, 24).translate(0, y, z) : cylZ(0.15, z - 0.2, z + 0.2, 24).translate(x, y, 0);
    s.add(merge([body, box(0.5, 0.08, 0.5, x, y - 0.2, z, 0.01)]), mSysD);
    s.add(cylY(0.13, y + 0.12, y + 0.55, 24).translate(x, 0, z), mMotor);
    return s;
  };
  // 바닥판 · 상부 데크 (장식, 선택 불가)
  {
    const fm = new THREE.MeshStandardMaterial({ color: 0x1f272c, metalness: 0.3, roughness: 0.8 });
    const floor = new THREE.Mesh(box(22, 0.05, 11, 1.2, -2.36, 0, 0), fm); ROOT.add(floor);
    const deck = new THREE.Mesh(box(6.9, 0.05, 3.4, -5.4, 10.95, -0.5, 0), fm); ROOT.add(deck);
    const grid = new THREE.GridHelper(22, 44, 0x2c363d, 0x253036); grid.position.set(1.2, -2.33, 0); grid.scale.set(1, 1, 0.5); ROOT.add(grid);
  }

  // ---- 터보차저 ----
  {
    const tb = slot('tc_body', SYSG);
    const comp = lathe([[0.2, -3.02], [0.62, -3.0], [0.72, -2.9], [0.74, -2.68], [0.72, -2.46], [0.5, -2.36], [0.3, -2.34], [0.2, -2.34]], 64);
    const turb = lathe([[0.25, -1.56], [0.55, -1.55], [0.66, -1.44], [0.68, -1.2], [0.64, -0.96], [0.5, -0.86], [0.25, -0.86]], 64);
    const brg = lathe([[0.2, -2.34], [0.32, -2.3], [0.32, -1.6], [0.25, -1.56]], 40);
    const outC = lathe([[0.25, -0.86], [0.5, -0.86], [0.58, -0.6], [0.58, -0.2], [0.25, -0.15]], 48);
    [comp, turb, brg, outC].forEach(g => { g.rotateX(Math.PI / 2); g.translate(X0, Y0, 0); });
    tb.add(merge([comp, brg]), mHousing);
    tb.add(merge([turb, outC, cylY(0.32, Y0 + 0.4, 8.62, 32).translate(X0, 0, -0.5), cylY(0.3, Y0 + 0.5, 8.68, 32).translate(X0, 0, -1.2)]), M_('turbH', { color: 0x76665a, metal: 0.5, rough: 0.45, housing: true }));
    tb.add(merge([cylY(0.2, 7.0, Y0 - 0.5, 28).translate(X0, 0, -2.68), box(1.1, 0.12, 1.2, X0, 6.9, -1.9, 0.02)]), mHousing);
    const fl = slot('filter', SYSG);
    const fg = lathe([[0.18, -3.78], [0.58, -3.78], [0.62, -3.7], [0.62, -3.1], [0.58, -3.02], [0.18, -3.02]], 56); fg.rotateX(Math.PI / 2); fg.translate(X0, Y0, 0);
    const ribs = Array.from({ length: 24 }, (_, i) => { const g = box(0.02, 0.03, 0.66, 0, 0.635, -3.4, 0.002); g.rotateZ(i * 15 * DEG); g.translate(X0, Y0, 0); return g; });
    fl.add(merge([fg, ...ribs]), M_('filterm', { color: 0x8b9298, metal: 0.4, rough: 0.6, housing: true }));
    // 회전체 (공통 축)
    const rot = new THREE.Group(); rot.position.set(X0, Y0, 0); SYSG.add(rot); MOV.tcRotor = rot;
    const sh = slot('tc_shaft', rot); sh.add(cylZ(0.05, -2.9, -1.05, 16), M_('shaft', { color: C.steelL, metal: 0.9, rough: 0.2, noclip: true }));
    const cw = slot('tc_comp', rot);
    const hub = lathe([[0.04, -2.95], [0.1, -2.9], [0.2, -2.74], [0.42, -2.6], [0.42, -2.56], [0.04, -2.56]], 48); hub.rotateX(Math.PI / 2);
    const blades = Array.from({ length: 14 }, (_, i) => { const g = box(0.015, 0.3, 0.32, 0, 0.26, -2.72, 0.003); g.rotateY(0.25); g.rotateZ(i * (360 / 14) * DEG); return g; });
    cw.add(merge([hub, ...blades]), M_('impel', { color: 0x9fb4c6, metal: 0.85, rough: 0.25, noclip: true }));
    const tw = slot('tc_turb', rot);
    const thub = lathe([[0.04, -1.32], [0.3, -1.3], [0.3, -1.24], [0.12, -1.08], [0.04, -1.06]], 48); thub.rotateX(Math.PI / 2);
    const tbl = Array.from({ length: 24 }, (_, i) => { const g = box(0.012, 0.2, 0.16, 0, 0.38, -1.16, 0.002); g.rotateY(-0.45); g.rotateZ(i * 15 * DEG); return g; });
    tw.add(merge([thub, ...tbl]), M_('turbw', { color: 0xb08a6a, metal: 0.85, rough: 0.3, noclip: true }));
  }
  port('filter.in', [X0, Y0, -3.8], 'air', 'filter');
  port('comp.out', [X0, 7.0, -2.68], 'air', 'tc_comp');
  port('turb.in', [X0, 8.66, -1.2], 'exh', 'tc_turb');
  port('turb.out', [X0, 8.62, -0.5], 'exh', 'tc_turb');
  {
    const vol = (zc, r, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + (a1 - a0) * i / n) * DEG; return [X0 + r * Math.cos(a), Y0 + r * Math.sin(a), zc]; });
    flow('air.tc', 'air', [{ pts: ['filter.in', [X0, Y0, -3.1], [X0, Y0, -2.86], [X0, Y0 + 0.3, -2.72], ...vol(-2.68, 0.56, 90, 270, 8), [X0, Y0 - 0.7, -2.68], 'comp.out'] }],
      { from: 'filter.in', to: 'comp.out', nodes: ['filter', 'tc_comp'], rate: airRate, clip: false, spacing: 0.16, rc: 0.12 });
    flow('exh.tc', 'exh', [
      { pts: ['exhrec.o', [-2.45, 9.37, -1.2]] },
      { pts: [[-2.45, 9.37, -1.2], [-3.2, 9.1, -1.2], [X0, 8.85, -1.2], 'turb.in'], r: 0.26, part: 'exhduct', clip: false },
      { pts: ['turb.in', ...vol(-1.2, 0.5, 90, -180, 9), [X0 - 0.2, Y0, -1.2], [X0, Y0, -1.08], [X0, Y0, -0.75], [X0, Y0 + 0.32, -0.5], 'turb.out'] },
    ], { from: 'exhrec.o', to: 'turb.out', nodes: ['exhrec', 'exhduct', 'tc_turb'], rate: exhRate, clip: false, spacing: 0.16, rc: 0.12 });
  }

  // ---- 공기 냉각기 · 수분 분리기 · 출구 챔버 · 플랩 · 보조 송풍기 ----
  {
    const cx = -2.95;
    const cs = slot('cooler', SYSG);
    const fins = []; for (let y = 3.82; y <= 5.45; y += 0.09) fins.push(box(1.02, 0.012, 2.42, cx, y, -1.7, 0));
    const tubes = []; for (let y = 3.86; y <= 5.45; y += 0.18) for (let x = -3.38; x <= -2.5; x += 0.18) tubes.push(cylZ(0.02, -2.92, -0.48, 8).translate(x, y, 0));
    cs.add(merge(fins), M_('fin', { color: 0xa9b3b8, metal: 0.7, rough: 0.35 }));
    cs.add(merge(tubes), M_('ctube', { color: 0xb87a4a, metal: 0.8, rough: 0.35 }));
    const hood = lathe([[0.0, 5.95], [0.42, 5.95], [1.25, 5.5], [0, 5.5]], 4, Math.PI / 4); hood.scale(0.75, 1, 1.68); hood.translate(cx, 0, -1.7);
    cs.add(merge([hood, box(1.12, 1.75, 0.06, cx, 4.63, -2.97, 0.005), box(1.12, 1.75, 0.06, cx, 4.63, -0.43, 0.005), box(0.06, 1.75, 2.5, -3.5, 4.63, -1.7, 0.005), cylX(0.07, -3.9, -3.5, 12).translate(0, 5.2, -2.6), cylX(0.07, -3.9, -3.5, 12).translate(0, 4.0, -2.6)]), mHousing);
    const ms = slot('mist', SYSG);
    const vanes = []; for (let z = -2.85; z <= -0.55; z += 0.12) { const g = box(1.0, 0.5, 0.012, cx, 3.45, z, 0); g.rotateY(0); vanes.push(g); }
    const v2 = vanes.map(g => { g.translate(-cx, -3.45, 0); g.rotateX(0.5); g.translate(cx, 3.45, 0); return g; });
    ms.add(merge(v2), M_('vane', { color: 0x8d9aa0, metal: 0.6, rough: 0.4 }));
    ms.add(merge([box(1.12, 0.6, 0.06, cx, 3.45, -2.97, 0.005), box(1.12, 0.6, 0.06, cx, 3.45, -0.43, 0.005), box(1.12, 0.06, 2.5, cx, 3.15, -1.7, 0.005), cylY(0.04, 2.6, 3.15, 10).translate(cx, 0, -1.7)]), mHousing);
    const ch = slot('chamber', SYSG);
    ch.add(merge([box(0.82, 0.06, 6.5, -1.99, 3.0, 0, 0.005), box(0.82, 0.06, 6.5, -1.99, 5.12, 0, 0.005), box(0.06, 2.12, 6.5, -1.6, 4.06, 0, 0.005), box(0.06, 2.12, 3.6, -2.4, 4.06, 1.45, 0.005), box(0.06, 0.9, 2.5, -2.4, 4.67, -1.7, 0.005), box(0.82, 2.12, 0.06, -1.99, 4.06, 3.25, 0.005), box(0.82, 2.12, 0.06, -1.99, 4.06, -3.25, 0.005)]), mHousing);
  }
  port('cooler.in', [-2.95, 5.95, -1.7], 'air', 'cooler');
  flow('air.toCooler', 'air', [{ pts: ['comp.out', [X0, 6.35, -2.68], [-3.15, 6.05, -2.2], 'cooler.in'], r: 0.24, part: 'cooler' }], { from: 'comp.out', to: 'cooler.in', nodes: ['tc_comp', 'cooler'], rate: airRate, clip: false, spacing: 0.18 });
  [-2.45, -1.7, -0.95].forEach((zl, i) => {
    const pid = port('chamber.i' + i, [-2.3, 3.35, zl], 'air', 'chamber');
    flow('air.cool' + i, 'air', [{ pts: ['cooler.in', [-2.95, 5.6, zl], [-2.95, 3.8, zl], [-2.95, 3.38, zl], pid] }], { from: 'cooler.in', to: pid, nodes: ['cooler', 'mist', 'chamber'], rate: airRate, clip: false, spacing: 0.2 });
  });
  // 메인 논리턴 플랩 (보조 송풍기 정지 시 열림)
  [-2.5, -1.3, -0.1, 1.5].forEach((zf, i) => {
    const s = slot('flap', SYSG);
    const g = box(0.34, 0.03, 0.34, 0, 0, 0, 0.005); const fl = new THREE.Mesh(g, mSysD);
    s.add(cylY(0.2, 5.1, 5.42, 24).translate(-1.95, 0, zf), mHousing);
    const hinge = new THREE.Group(); hinge.position.set(-1.95 - 0.17, 5.22, zf); s.g.add(hinge);
    fl.position.set(0.17, 0, 0); fl.userData.part = 'flap'; hinge.add(fl); s.inst.meshes.push(fl); s.inst.proc.push(fl); PICKABLE.push(fl);
    (MOV.flaps = MOV.flaps || []).push(hinge);
    const a = port('chamber.f' + i, [-2.2, 3.5, zf], 'air', 'chamber'), b = port('scavrec.f' + i, [-1.75, 5.72, zf], 'air', 'scavrec');
    flow('air.flap' + i, 'air', [{ pts: [a, [-2.0, 4.6, zf], [-1.95, 5.22, zf], b] }], { from: a, to: b, nodes: ['chamber', 'flap', 'scavrec'], rate: () => st().aux ? 0 : airRate() * 0.75, clip: false, spacing: 0.2 });
  });
  // 보조 송풍기 2대 + 체크밸브
  [2.15, 0.85].forEach((zB, i) => {
    const s = slot('auxblower', SYSG);
    s.add(merge([cylZ(0.3, zB - 0.18, zB + 0.18, 40).translate(-1.95, 4.1, 0), cylY(0.12, 4.3, 4.62, 20).translate(-1.95, 0, zB)]), mSys);
    s.add(merge([cylX(0.2, -2.95, -2.42, 28).translate(0, 4.1, zB), cylX(0.05, -2.42, -2.25, 12).translate(0, 4.1, zB)]), mMotor);
    const fan = new THREE.Group(); fan.position.set(-1.95, 4.1, zB); SYSG.add(fan); (MOV.fans = MOV.fans || []).push(fan);
    const fb = Array.from({ length: 10 }, (_, j) => { const g = box(0.03, 0.22, 0.26, 0, 0.14, 0, 0.004); g.rotateZ(j * 36 * DEG); return g; });
    slot('auxblower', fan).add(merge(fb), M_('fanb', { color: 0x9fb4c6, metal: 0.8, rough: 0.3, noclip: true }));
    const cv = slot('checkv', SYSG);
    cv.add(cylY(0.15, 4.85, 5.05, 24).translate(-1.95, 0, zB), mSysD);
    const hinge = new THREE.Group(); hinge.position.set(-1.95 - 0.11, 4.95, zB); cv.g.add(hinge);
    const disc = new THREE.Mesh(cylY(0.11, -0.01, 0.01, 20), M_('discm', { color: 0xc9b46a, metal: 0.6, rough: 0.35 })); disc.position.set(0.11, 0, 0); disc.userData.part = 'checkv';
    hinge.add(disc); cv.inst.meshes.push(disc); cv.inst.proc.push(disc); PICKABLE.push(disc);
    (MOV.checks = MOV.checks || []).push(hinge);
    const a = port('chamber.b' + i, [-2.25, 3.5, zB], 'air', 'chamber'), b = port('scavrec.b' + i, [-1.82, 5.7, zB], 'air', 'scavrec');
    flow('air.blower' + i, 'air', [{ pts: [a, [-1.95, 3.85, zB], [-1.95, 4.1, zB], [-1.95, 4.62, zB], [-1.95, 4.95, zB], [-1.95, 5.3, zB], b] }], { from: a, to: b, nodes: ['chamber', 'auxblower', 'checkv', 'scavrec'], rate: () => st().aux ? airRate() * 1.1 : 0, clip: false, spacing: 0.15 });
  });

  // ---- 배기가스 보일러 (이코노마이저) · 굴뚝 ----
  const EZ = -0.5, EX0 = -4.65, EX1 = -2.45, EY0 = 12.2, EY1 = 15.25;
  const rowsY = Array.from({ length: 6 }, (_, i) => 12.55 + i * 0.42);
  const serp = zz => { const pts = [[-5.0, rowsY[0], zz]]; rowsY.forEach((y, i) => { const a = i % 2 === 0 ? -4.35 : -2.75, b = i % 2 === 0 ? -2.75 : -4.35; pts.push([a, y, zz], [b, y, zz]); }); pts.push([-5.0, rowsY[5], zz]); return pts; };
  {
    const s = slot('egb', SYSG);
    const hopIn = lathe([[0.32, 11.75], [1.1 * Math.SQRT2 * 0.98, EY0], [0, EY0]], 4, Math.PI / 4); hopIn.translate(X0, 0, EZ);
    const hopOut = lathe([[1.1 * Math.SQRT2 * 0.98, EY1], [0.36, 15.65], [0, 15.65]], 4, Math.PI / 4); hopOut.translate(X0, 0, EZ);
    const walls = [box(0.06, EY1 - EY0, 2.2, EX0, (EY0 + EY1) / 2, EZ, 0.005), box(0.06, EY1 - EY0, 2.2, EX1, (EY0 + EY1) / 2, EZ, 0.005), box(2.2, EY1 - EY0, 0.06, X0, (EY0 + EY1) / 2, EZ - 1.1, 0.005), box(2.2, EY1 - EY0, 0.06, X0, (EY0 + EY1) / 2, EZ + 1.1, 0.005)];
    s.add(merge([hopIn, hopOut, ...walls]), mInsS);
    s.add(merge([cylZ(0.1, EZ - 0.8, EZ + 0.8, 16).translate(-5.0, rowsY[0], 0), cylZ(0.1, EZ - 0.8, EZ + 0.8, 16).translate(-5.0, rowsY[5], 0)]), mSysD);
    const tb = slot('egbtubes', SYSG);
    const tg = [];
    [EZ - 0.65, EZ, EZ + 0.65].forEach(zz => { const rt = new Route(serp(zz), 0.2); tg.push(tubeG(rt, 0.06, 10)); });
    const g = merge(tg);
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3), cHot = new THREE.Color(0xb5653a), cCold = new THREE.Color(0x8a979e), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) { const t = smooth01((pos.getY(i) - 12.4) / 2.5); tmp.copy(cHot).lerp(cCold, t); col.set([tmp.r, tmp.g, tmp.b], i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const tm = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide }); tm.userData = { baseOpacity: 1, pipe: true }; PIPE_MATS.add(tm);
    tb.add(g, tm);
    const fs = slot('funnel', SYSG);
    fs.add(merge([lathe([[1.0, 17.0], [1.25, 17.0], [0.95, 20.2], [0.7, 20.2]], 6), box(0.06, 0.6, 0.06, X0 + 0.8, 16.7, EZ + 0.8, 0)]), M_('funnelm', { color: 0x8e3b30, metal: 0.3, rough: 0.55, housing: true }));
    const drum = slot('drum', SYSG);
    const dcap = zz => { const g2 = sphere(0.55, 0, 0, 0); g2.scale(1, 1, 0.5); g2.translate(-6.6, 15.9, zz); return g2; };
    drum.add(merge([cylZ(0.55, -1.8, 0.8, 40).translate(-6.6, 15.9, 0), dcap(-1.8), dcap(0.8), box(0.12, 4.9, 0.12, -6.6, 13.47, -1.6, 0.005), box(0.12, 4.9, 0.12, -6.6, 13.47, 0.6, 0.005), cylY(0.08, 16.4, 16.62, 16).translate(-6.6, 0, -1.4), cylY(0.05, 16.62, 16.8, 12).translate(-6.6, 0, -1.4)]), M_('drumm', { color: 0x6d7d86, metal: 0.4, rough: 0.5, housing: true }));
    pump('circpump_w', -6.6, 11.75, -0.9);
    const ct = slot('cascade', SYSG); ct.add(box(0.8, 1.1, 1.0, -8.1, 11.5, -0.5, 0.03), mTank);
    pump('feedpump', -7.35, 11.1, -0.5);
  }
  port('egb.gasIn', [X0, EY0, EZ], 'exh', 'egb.gas');
  port('egb.gasOut', [X0, EY1, EZ], 'exh', 'egb.gas');
  port('funnel.out', [X0, 20.2, EZ], 'exh', 'funnel');
  port('egb.wIn', [-5.0, rowsY[0], EZ], 'water', 'egb.water');
  port('egb.wOut', [-5.0, rowsY[5], EZ], 'water', 'egb.water');
  const exGrad = { y0: 12.3, y1: 15.2 };
  flow('exh.toEgb', 'exh', [{ pts: ['turb.out', [X0, 10.0, EZ], [X0, 11.75, EZ], 'egb.gasIn'], r: 0.32, part: 'exhduct' }], { from: 'turb.out', to: 'egb.gasIn', nodes: ['tc_turb', 'exhduct', 'egb.gas'], rate: exhRate, clip: false, spacing: 0.2 });
  [EZ - 0.325, EZ + 0.325].forEach((zl, i) => {
    flow('exh.egb' + i, 'exh', [{ pts: ['egb.gasIn', [X0 - 0.3 + i * 0.6, 12.35, zl], [X0 - 0.3 + i * 0.6, 15.05, zl], 'egb.gasOut'] }], { from: 'egb.gasIn', to: 'egb.gasOut', nodes: ['egb.gas'], rate: exhRate, clip: false, spacing: 0.17, tint: exGrad });
    flow('exh.egbb' + i, 'exh', [{ pts: ['egb.gasIn', [X0 + 0.55 - i * 1.1, 12.35, zl], [X0 + 0.55 - i * 1.1, 15.05, zl], 'egb.gasOut'] }], { from: 'egb.gasIn', to: 'egb.gasOut', nodes: ['egb.gas'], rate: exhRate, clip: false, spacing: 0.17, tint: exGrad });
  });
  flow('exh.funnel', 'exh', [{ pts: ['egb.gasOut', [X0, 17.0, EZ], 'funnel.out'], r: 0.36, part: 'funnel' }], { from: 'egb.gasOut', to: 'funnel.out', nodes: ['egb.gas', 'funnel'], rate: exhRate, clip: false, spacing: 0.22, tint: exGrad });
  // 물·증기 (별도 유로)
  port('drum.wOut', [-6.6, 15.4, -0.9], 'water', 'drum');
  port('drum.wIn', [-6.1, 15.9, EZ], 'water', 'drum');
  port('drum.feed', [-7.0, 15.9, EZ], 'water', 'drum');
  port('drum.sOut', [-6.6, 16.45, EZ], 'steam', 'drum');
  port('cascade.out', [-7.7, 11.1, EZ], 'water', 'cascade');
  flow('water.down', 'water', [{ pts: ['drum.wOut', [-6.6, 12.0, -0.9]], r: 0.07, part: 'drum' }, { pts: [[-6.6, 12.0, -0.9], [-6.6, 11.75, -0.9], [-6.25, 11.75, -0.9]] }, { pts: [[-6.25, 11.75, -0.9], [-5.6, 11.75, -0.9], [-5.6, 11.75, EZ], [-5.6, rowsY[0], EZ], 'egb.wIn'], r: 0.07, part: 'circpump_w' }],
    { from: 'drum.wOut', to: 'egb.wIn', nodes: ['drum', 'circpump_w', 'egb.water'], rate: wRate, clip: false, spacing: 0.16 });
  flow('water.egb', 'water', [{ pts: serp(EZ) }], { from: 'egb.wIn', to: 'egb.wOut', nodes: ['egb.water'], rate: wRate, clip: false, spacing: 0.14, rc: 0.2, tint: { steam: true, y0: 12.6, y1: 14.7 } });
  flow('water.riser', 'water', [{ pts: ['egb.wOut', [-5.8, rowsY[5], EZ], [-5.8, 15.9, EZ], 'drum.wIn'], r: 0.08, part: 'drum' }], { from: 'egb.wOut', to: 'drum.wIn', nodes: ['egb.water', 'drum'], rate: wRate, clip: false, spacing: 0.15, tint: { steam: true, mix: 0.6 } });
  flow('water.feed', 'water', [{ pts: ['cascade.out', [-7.55, 11.1, EZ]], r: 0.05, part: 'feedpump' }, { pts: [[-7.55, 11.1, EZ], [-7.35, 11.1, EZ], [-7.35, 11.3, EZ]] }, { pts: [[-7.35, 11.3, EZ], [-7.35, 15.9, EZ], 'drum.feed'], r: 0.05, part: 'feedpump' }], { from: 'cascade.out', to: 'drum.feed', nodes: ['cascade', 'feedpump', 'drum'], rate: () => 0.12 + 0.2 * st().load, clip: false, spacing: 0.2 });

  // ---- 연료 공급 계통 (서비스 탱크 → 분사밸브) ----
  {
    const t = slot('servtank', SYSG); t.add(merge([box(1.2, 4.3, 1.2, 8.2, -0.15, 0, 0.03), cylY(0.05, 2.05, 2.4, 12).translate(8.2, 0, 0), box(0.04, 3.4, 0.08, 7.58, -0.2, 0.45, 0.005)]), mTank);
    pump('supplypump', 7.05, -1.9, 0);
    const vb = slot('ventbox', SYSG); vb.add(merge([cylY(0.3, -1.5, 1.1, 32).translate(6.0, 0, 0), sphere(0.3, 6.0, 1.1, 0).scale(1, 1, 1), cylY(0.04, 1.35, 1.7, 10).translate(6.0, 0, 0)]), mTank);
    pump('circpump', 5.15, -1.9, 0);
    const h = slot('heater', SYSG);
    h.add(merge([cylZ(0.24, -0.6, 0.6, 32).translate(4.6, 0.7, 0), cylZ(0.28, -0.66, -0.58, 32).translate(4.6, 0.7, 0), cylZ(0.28, 0.58, 0.66, 32).translate(4.6, 0.7, 0), cylY(0.06, 0.9, 1.0, 12).translate(4.6, 0, -0.3), cylY(0.06, 0.4, 0.5, 12).translate(4.6, 0, 0.3)]), mSys);
    const v = slot('visco', SYSG); v.add(merge([box(0.18, 0.2, 0.18, 4.6, 1.3, 0.85, 0.02), box(0.06, 0.25, 0.06, 4.74, 1.42, 0.85, 0.005)]), M_('visc', { color: 0x58718a, metal: 0.4, rough: 0.5 }));
    const f = slot('ffilter', SYSG); f.add(merge([cylY(0.2, 1.55, 2.5, 28).translate(4.0, 0, 0.85), cylY(0.23, 2.42, 2.55, 28).translate(4.0, 0, 0.85)]), mSys);
    const p = slot('pcv', SYSG); p.add(merge([box(0.22, 0.24, 0.22, 3.55, 5.2, 3.4, 0.02), cylX(0.025, 3.66, 3.9, 8).translate(0, 5.3, 3.4), cylX(0.08, 3.9, 3.94, 16).translate(0, 5.3, 3.4)]), mSysD);
    const tr = slot('trap', SYSG); tr.add(merge([box(0.16, 0.16, 0.16, 4.6, -0.45, 0.3, 0.02)]), mSysD);
  }
  port('servtank.out', [7.6, -1.9, 0], 'fuel', 'servtank');
  port('ventbox.in', [6.0, -0.9, 0], 'fuel', 'ventbox');
  port('ventbox.out', [6.0, -1.5, 0], 'fuel', 'ventbox');
  port('ventbox.ret', [6.0, 0.8, 0], 'fuel', 'ventbox');
  port('heater.sIn', [4.6, 0.96, -0.3], 'steam', 'heater.steam');
  port('heater.sOut', [4.6, 0.44, 0.3], 'water', 'heater.steam');
  port('trap.in', [4.6, -0.37, 0.3], 'water', 'trap');
  flow('fuel.supply', 'fuel', [
    { pts: ['servtank.out', [7.25, -1.9, 0]], r: 0.05, part: 'supplypump' }, { pts: [[7.25, -1.9, 0], [6.85, -1.9, 0]] },
    { pts: [[6.85, -1.9, 0], [6.6, -1.9, 0], [6.6, -0.9, 0], [6.3, -0.9, 0]], r: 0.05, part: 'supplypump' }, { pts: [[6.3, -0.9, 0], 'ventbox.in'] },
  ], { from: 'servtank.out', to: 'ventbox.in', nodes: ['servtank', 'supplypump', 'ventbox'], rate: () => 0.15 + 0.25 * st().load, clip: false, spacing: 0.16 });
  flow('fuel.circ', 'fuel', [
    { pts: ['ventbox.out', [6.0, -1.9, 0], [5.35, -1.9, 0]], r: 0.05, part: 'circpump' }, { pts: [[5.35, -1.9, 0], [4.95, -1.9, 0]] },
    { pts: [[4.95, -1.9, 0], [4.6, -1.9, 0], [4.6, -1.9, -0.85], [4.6, 0.7, -0.85], [4.6, 0.7, -0.66]], r: 0.05, part: 'circpump' },
    { pts: [[4.6, 0.7, -0.66], [4.6, 0.7, 0.66]] },
    { pts: [[4.6, 0.7, 0.66], [4.6, 0.7, 0.85], [4.6, 1.2, 0.85]], r: 0.05, part: 'heater' }, { pts: [[4.6, 1.2, 0.85], [4.6, 1.4, 0.85]] },
    { pts: [[4.6, 1.4, 0.85], [4.6, 1.75, 0.85], [4.2, 1.75, 0.85]], r: 0.05, part: 'visco' }, { pts: [[4.2, 1.75, 0.85], [4.0, 1.75, 0.85], [4.0, 2.55, 0.85]] },
    { pts: [[4.0, 2.55, 0.85], [4.0, 2.9, 0.85], [3.25, 2.9, 0.85], [3.25, 2.9, 3.55], [3.25, 8.95, 3.55], [1.85, 8.95, 3.55], 'rail.in'], r: 0.05, part: 'fuelrail' },
  ], { from: 'ventbox.out', to: 'rail.in', nodes: ['ventbox', 'circpump', 'heater.fuel', 'visco', 'ffilter', 'fuelrail'], rate: fuelCirc, clip: false, spacing: 0.18 });
  flow('fuel.return', 'fuel', [
    { pts: ['rail.aft', [2.0, 8.95, 3.4], [3.55, 8.95, 3.4], [3.55, 5.32, 3.4]], r: 0.05, part: 'fuelrail', clip: true },
    { pts: [[3.55, 5.32, 3.4], [3.55, 5.08, 3.4]] },
    { pts: [[3.55, 5.08, 3.4], [3.55, 3.4, 3.4], [6.0, 3.4, 3.4], [6.0, 3.4, 0], [6.0, 1.35, 0]], r: 0.05, part: 'pcv' }, { pts: [[6.0, 1.35, 0], 'ventbox.ret'] },
  ], { from: 'rail.aft', to: 'ventbox.ret', nodes: ['fuelrail', 'pcv', 'ventbox'], rate: () => fuelCirc() * (1 - 0.3 * st().load), clip: false, spacing: 0.2 });
  flow('steam.heater', 'steam', [{ pts: ['drum.sOut', [-6.6, 17.4, EZ], [-6.6, 17.4, -2.3], [5.4, 17.4, -2.3], [5.4, 1.45, -2.3], [5.4, 1.45, -0.3], [4.6, 1.45, -0.3], 'heater.sIn'], r: 0.06, part: 'drum' }], { from: 'drum.sOut', to: 'heater.sIn', nodes: ['drum', 'heater.steam'], rate: () => 0.25 + 0.4 * st().load, clip: false, spacing: 0.3, rc: 0.3 });
  flow('water.cond', 'water', [{ pts: ['heater.sOut', [4.6, -0.2, 0.3], 'trap.in'], r: 0.035, part: 'trap' }], { from: 'heater.sOut', to: 'trap.in', nodes: ['heater.steam', 'trap'], rate: () => 0.15, clip: false, spacing: 0.12 });

  // ---- 제어유 공급 (오일 팬 → 필터 → HPS → 고압관) ----
  {
    const h = slot('hps', SYSG);
    h.add(merge([box(1.0, 0.9, 0.9, 2.85, 1.1, -3.0, 0.04), ...[-3.3, -3.0, -2.7].map(z => cylY(0.13, 1.55, 1.95, 24).translate(2.95, 0, z)), ...[-3.3, -3.0, -2.7].map(z => cylY(0.07, 1.95, 2.05, 16).translate(2.95, 0, z)), box(0.9, 0.1, 1.0, 2.85, 0.6, -3.0, 0.01)]), M_('hpsm', { color: 0x5a4f74, metal: 0.4, rough: 0.5 }));
    const af = slot('autofilter', SYSG); af.add(merge([cylY(0.22, -1.95, -1.05, 28).translate(2.9, 0, -2.0), cylY(0.25, -1.1, -0.98, 28).translate(2.9, 0, -2.0), box(0.3, 0.2, 0.2, 3.15, -1.2, -2.0, 0.02)]), mSys);
    [-2.85, -2.3].forEach(z => { pump('startpump', 3.75, -1.9, z); });
    const sp = slot('startpump', SYSG); sp.add(merge([tubeG(new Route([[3.75, -1.75, -2.85], [3.75, 0.4, -2.85], [3.35, 0.9, -2.85]], 0.15), 0.035, 8), tubeG(new Route([[3.75, -1.75, -2.3], [3.75, 0.4, -2.3], [3.35, 0.9, -2.3]], 0.15), 0.035, 8)]), M_('pipe-oil', { color: PIPE_COL.oil, metal: 0.45, rough: 0.5, pipe: true, noclip: true }));
  }
  port('oilpan.out', [1.0, -2.0, -2.0], 'oil', 'oilpan');
  port('crankcase.main', [1.24, 3.9, 0], 'oil', 'crankcase');
  port('hps.in', [2.85, 1.05, -3.0], 'oil', 'hps');
  flow('oil.supply', 'oil', [
    { pts: ['oilpan.out', [1.32, -2.0, -2.0], [2.9, -2.0, -2.0], [2.9, -1.95, -2.0]], r: 0.05, part: 'autofilter' },
    { pts: [[2.9, -1.95, -2.0], [2.9, -0.98, -2.0]] },
    { pts: [[2.9, -0.98, -2.0], [2.9, -0.6, -2.0], [2.9, -0.6, -3.0], [2.85, 0.6, -3.0]], r: 0.05, part: 'hps' },
    { pts: [[2.85, 0.6, -3.0], 'hps.in', [2.6, 1.3, -2.75], [2.6, 1.55, -2.75]] },
    { pts: [[2.6, 1.55, -2.75], [2.6, 2.2, -2.75], [2.3, 2.5, -3.0], [2.3, 6.62, -3.0], 'ctrl.in'], r: 0.07, part: 'ctrlrail' },
  ], { from: 'oilpan.out', to: 'ctrl.in', nodes: ['oilpan', 'autofilter', 'hps', 'ctrlrail'], rate: oilRate, clip: false, spacing: 0.2 });
  BUILD_SYS = false;
}

