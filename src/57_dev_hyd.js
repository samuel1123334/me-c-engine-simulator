// ===================================================================
// 57 · 기기 내부 — 제어유(유압) 계통: HPS 사판식 액시얼 피스톤 펌프, 자동 역세 필터, HCU 축압기, FIVA, 연료 부스터, 배기밸브 액추에이터
// ===================================================================
const HYD = { pRel: 0, flushT: 0, flushing: false, flushK: -1, dpAF: 0.25, test: false };
const thOfRef = () => wrap360(SIM.state.theta - cylOffsets()[SIM.state.ref]);

// ---------------- HPS (사판식 가변 용량 액시얼 피스톤 펌프 + 안전·축압 블록) ----------------
defDevice('hps', {
  ko: 'HPS 유압 동력 공급 장치', en: 'Hydraulic power supply (swashplate axial-piston pump)', sys: '제어유 (유압) 계통', parts: ['hps', 'startpump', 'ctrlrail'],
  principle: `<p>HPS는 시스템 윤활유를 자동 역세 필터로 거른 뒤 200–300 bar로 올려 각 실린더의 HCU로 보냅니다. 엔진 구동 펌프 3대(크랭크축에서 증속 기어로 구동)와 시동·저속용 전동 펌프 2대가 있고, 안전·축압 블록이 펌프 출구를 모읍니다.</p>
  <p>여기 그린 엔진 구동 펌프는 <b>사판식 가변 용량 액시얼 피스톤 펌프</b>입니다. 축과 함께 도는 실린더 블록 안 피스톤 9개의 슬리퍼가 기울어진 사판 위를 미끄러지면서, 반 바퀴 동안은 실린더에서 빠져나와 흡입 포트(키드니)로 기름을 빨아들이고 나머지 반 바퀴 동안은 밀려 들어가 토출 포트로 내보냅니다. 1회전 배제 체적 = 피스톤 수 × 단면적 × 2·r·tan(사판각).</p>
  <p>압력 보상 제어기가 사판각을 바꿔, 압력이 설정값에 도달하면 사판각이 줄어 수요만큼만 토출합니다. 그래서 사판각은 엔진의 제어유 소비량(부스터 + 배기밸브)에 비례해 움직입니다. 설정 압력은 부하에 따라 200 / 300 bar로 바뀌고, 안전밸브는 310 / 315 bar입니다.</p>`,
  sources: [
    { t: 'ref', text: 'MAN B&W ME engines · Hydraulic Power Supply: 엔진 구동·전동 펌프, 자동 필터, 안전·축압 블록', url: 'https://www.merchantnavydecoded.com/?p=90586' },
    { t: 'ref', text: 'MAN B&W Project Guide · Hydraulic power supply (200/300 bar, 안전밸브)', url: 'https://www.man-es.com/applications/projectguides/2stroke/content/printed/S60ME-C10_5.pdf' },
    { t: 'ref', text: 'Bosch Rexroth A4VSO 사판식 가변 펌프 구조', url: 'https://www.boschrexroth.com/en/xc/products/product-groups/mobile-hydraulics/axial-piston-pumps/variable-pumps/a4vso' },
    { t: 'edu', text: '펌프 배제 체적 250 cm³/rev, 증속비 16, 최대 사판각 15°, 블록 배치는 교육용 가정' }],
  view: { t: [0.3, 0.05, -0.1], d: [0.2, 0.45, 1], k: 0.7 },
  controls: () => `<p class="empty" style="margin:0;font-size:11.5px">부하 슬라이더를 50 % 아래·위로 움직이면 설정 압력이 200 ↔ 300 bar로 바뀌고, 부하·회전수에 따라 사판각이 달라집니다.</p>`,
  build(root) {
    const P = new THREE.Group(); P.rotation.z = -Math.PI / 2; P.position.set(-0.35, 0.05, 0); root.add(P);   // 로컬 +Y → 월드 +X
    const ys = -0.42, rb = 0.2, Np = 9;
    dpart(P, vesselY(0.42, -0.68, 0.24, 0.03, 0.08, { top: false }), DC.paint, { ko: '펌프 하우징', en: 'Pump housing', d: '케이스 안은 누설유(케이스 드레인)로 차 있고, 드레인 관으로 탱크에 돌아갑니다.' });
    dpart(P, ringG(0.06, 0.45, 0.2, 0.28, 40), DC.castL, null);
    // 구동축 + 베어링
    const shaft = new THREE.Group(); P.add(shaft);
    dpart(shaft, cylY(0.055, -1.15, 0.46, 24), DC.steelL, { ko: '구동 축', en: 'Drive shaft', d: '엔진 크랭크축의 증속 기어(교육용 16배)로 돌아갑니다. 스플라인으로 실린더 블록을 함께 돌립니다.' });
    dpart(shaft, box(0.04, 0.12, 0.03, 0, -1.05, 0.045, 0.005), DC.steelD, null);
    dpart(P, ringG(0.056, 0.13, -0.66, -0.56, 28), DC.bronze, { ko: '축 베어링', en: 'Shaft bearing', d: '반경·축 방향 하중을 받는 롤러 베어링.' });
    dpart(P, ringG(0.056, 0.1, -0.8, -0.68, 24), DC.carbon, { ko: '축 밀봉', en: 'Shaft seal', d: '', label: false });
    // 사판 (요람형) + 제어 피스톤
    const sw = new THREE.Group(); sw.position.y = ys; P.add(sw);
    dpart(sw, lathe([[0.07, -0.08], [0.34, -0.08], [0.34, 0.0], [0.07, 0.0]], 40), DC.steelD, { ko: '사판 (요람형)', en: 'Swashplate (cradle)', d: '기울기(사판각)가 피스톤 행정을 정합니다. 0°면 행정이 0, 최대 약 15°에서 최대 토출. 요람 베어링 위에서 기울어집니다.' });
    dpart(sw, ringG(0.07, 0.3, 0.0, 0.012, 40), DC.bronze, null);
    const ctlP = new THREE.Group(); ctlP.position.set(0, ys, 0.0); P.add(ctlP);
    dpart(P, cylX(0.07, 0.36, 0.62, 24).translate(0, ys + 0.02, 0), DC.castL, { ko: '제어 피스톤 실린더', en: 'Stroking cylinder', d: '제어 압력으로 사판을 미는 피스톤. 압력 보상기가 이 압력을 조절합니다.' });
    const stroker = dpart(P, cylX(0.05, 0.3, 0.56, 20).translate(0, ys + 0.02, 0), DC.steelL, { ko: '제어 피스톤', en: 'Stroking piston', d: '사판각을 바꾸는 피스톤. 압력이 설정값보다 높아지면 사판각을 줄입니다.' });
    // 실린더 블록 (9개 보어)
    const blk = new THREE.Group(); P.add(blk);
    const holes = [{ circle: [0, 0, 0.058] }]; for (let i = 0; i < Np; i++) { const a = i / Np * Math.PI * 2; holes.push({ circle: [rb * Math.cos(a), rb * Math.sin(a), 0.052] }); }
    dpart(blk, extXZ(xzShape(arcPts(0, 0, 0.31, 0, 360, 48).map(p => [p[0], p[1]]), holes), -0.2, 0.2), DC.bronze, { ko: '실린더 블록 (배럴)', en: 'Cylinder block', d: '축과 함께 회전하며 피스톤 9개를 품습니다. 끝면이 밸브판 위를 미끄러지며 각 보어가 흡입·토출 키드니에 차례로 연결됩니다.' }, { metal: 0.6 });
    const pistons = [];
    for (let i = 0; i < Np; i++) {
      const a = i / Np * Math.PI * 2, g = new THREE.Group(); g.position.set(rb * Math.cos(a), 0, rb * Math.sin(a)); blk.add(g);
      const pi = i === 0 ? { ko: '피스톤·슬리퍼', en: 'Piston & slipper', d: '볼 조인트로 연결된 슬리퍼가 사판 위를 미끄러집니다. 슬리퍼 바닥으로 고압유가 새어 나와 유막(정압 베어링)을 만들어 마찰을 줄입니다.' } : null;
      const pg = dgroup(g, pi);
      dadd(pg, cylY(0.05, 0.05, 0.5, 18), DC.steelL); dadd(pg, sphere(0.045, 0, 0.05, 0), DC.steelL); dadd(pg, cylY(0.07, 0.0, 0.03, 18), DC.bronze);
      pistons.push({ g, a });
    }
    dpart(blk, ringG(0.27, 0.31, -0.25, -0.2, 40), DC.steelD, null);
    // 밸브판 (키드니 포트)
    const kid = (cx, sgn) => { const p = []; for (let i = 0; i <= 16; i++) { const t = (-50 + 100 * i / 16) * DEG; p.push([sgn * rb * Math.cos(t) + sgn * 0.0, rb * Math.sin(t)]); } return p; };
    const kidHole = sgn => { const out = [], inn = []; for (let i = 0; i <= 16; i++) { const t = (-55 + 110 * i / 16) * DEG; out.push([sgn * (rb + 0.04) * Math.cos(t), (rb + 0.04) * Math.sin(t)]); inn.push([sgn * (rb - 0.04) * Math.cos(t), (rb - 0.04) * Math.sin(t)]); } return out.concat(inn.reverse()); };
    dpart(P, extXZ(xzShape(arcPts(0, 0, 0.31, 0, 360, 48).map(p => [p[0], p[1]]), [{ circle: [0, 0, 0.06] }, kidHole(1), kidHole(-1)]), 0.2, 0.24), DC.brass, { ko: '밸브판 (키드니 포트)', en: 'Valve plate with kidney ports', d: '고정된 판에 콩팥 모양 구멍 두 개. 피스톤이 빠져나가는 반 바퀴는 흡입 키드니, 밀려 들어가는 반 바퀴는 토출 키드니와 연결됩니다.' });
    dpart(P, extXZ(xzShape(arcPts(0, 0, 0.45, 0, 360, 48).map(p => [p[0], p[1]]), [{ circle: [0, 0, 0.06] }, kidHole(1), kidHole(-1)]), 0.28, 0.5), DC.castL, { ko: '포트 커버', en: 'Port block (end cover)', d: '흡입 포트(큰 구멍)와 고압 토출 포트가 뚫린 덮개.' });
    dpart(P, pipeAlong('x', 0.11, 0.36, 0.95, 0.4, 0, 0.015, true), DC.steelD, { ko: '흡입관', en: 'Suction (from automatic filter)', d: '자동 역세 필터를 거친 시스템 오일.' });
    dpart(P, pipeAlong('x', 0.06, -0.95, -0.2, 0.4, 0, 0.015, true), DC.steelD, { ko: '고압 토출관', en: 'HP outlet', d: '200–300 bar로 안전·축압 블록에 들어갑니다.' });
    // 압력 보상 제어기
    dpart(P, box(0.26, 0.18, 0.2, -0.33, 0.12, 0, 0.02), DC.motor, { ko: '압력 보상 제어기', en: 'Pressure compensator', d: '스프링으로 설정한 압력과 토출 압력을 비교하는 작은 스풀 밸브. 압력이 높으면 제어 피스톤에 기름을 보내 사판각을 줄이고, 낮으면 빼서 키웁니다. ME에서는 ECS 신호로 설정압을 바꿉니다.' });
    dfluid(P, cylY(0.39, -0.62, 0.2, 36), 'oilLo', 0.08);
    // 안전·축압 블록
    const B = new THREE.Group(); B.position.set(0.75, 0.85, 0); root.add(B);
    dpart(root, pipeAlong('x', 0.06, 0.05, 0.5, 0.85, 0, 0.015), DC.steelD, null);
    dpart(B, box(0.5, 0.36, 0.34, 0, 0, -0.0, 0.03), DC.castL, { ko: '안전·축압 블록', en: 'Safety and accumulator block', d: '펌프들의 토출을 모아 HCU 분배관으로 보냅니다. 역지밸브, 안전밸브, 축압기가 붙어 있습니다.' });
    const accs = [];
    [-0.13, 0.13].forEach((x, k) => {
      const g = new THREE.Group(); g.position.set(x, 0.18, 0); B.add(g);
      dpart(g, vesselY(0.1, 0, 0.62, 0.012, 0.08), DC.red, k ? null : { ko: '축압기 (질소 블래더)', en: 'Bladder accumulator', d: '질소를 채운 고무 블래더가 펌프 맥동과 순간 소비를 흡수합니다.' });
      accs.push(dfluid(g, sphere(0.075).scale(1, 2.6, 1).translate(0, 0.38, 0), 'gas', 0.35));
    });
    const rv = new THREE.Group(); rv.position.set(0, -0.18, 0); B.add(rv);
    dpart(rv, vesselY(0.06, -0.42, 0, 0.012, 0.02), DC.steelD, { ko: '안전밸브', en: 'Safety valve (310/315 bar)', d: '압력이 310 bar(저압 모드 이상)·315 bar를 넘으면 열려 기름을 탱크로 돌립니다. 정상 운전 중에는 닫혀 있습니다.' });
    const rvp = dpart(rv, lathe([[0, -0.1], [0.04, -0.06], [0.04, -0.02], [0, -0.02]]), DC.steelL, null);
    dpart(rv, springG(0.032, -0.36, -0.1, 6, 0.007), DC.spring, null);
    dpart(B, pipeAlong('x', 0.045, 0.25, 0.75, 0.0, 0, 0.012, true), DC.steelL, { ko: '이중관 고압 분배관', en: 'Double-wall HP pipe to HCUs', d: '바깥관이 안쪽 고압관을 감싸 누설 시 기름이 새지 않게 하고 누설 감지기로 보냅니다.' });
    dpart(B, ringX(0.055, 0.068, 0.3, 0.75, 20), DC.steelD, null, { opacity: 0.35 });
    const gP = dgauge(root, 0.35, 1.25, 0.05, 0.11, '계통압', 0, 400, 'bar', { ko: '계통 압력계', en: 'System pressure', d: '' });
    // 유동
    const rate = () => FSS.swash * SIM.state.rpm / 90;
    dflow(root, [[0.05, -1.0, -0.02], [0.05, -0.25, -0.03], [-0.12, -0.2, -0.06], [-0.3, -0.2, -0.06]], 'oilLo', rate, { sp: 0.05 });
    dflow(root, [[-0.3, 0.3, -0.06], [-0.12, 0.3, -0.06], [0.05, 0.35, -0.03], [0.05, 0.85, -0.02], [0.75, 0.85, -0.02], [1.5, 0.85, -0.02], [1.75, 0.85, -0.02]], 'oil', rate, { sp: 0.05 });
    let ang = 0;
    return {
      update(st) {
        ang += visRot(FSS.pumpN, st) * 0.5;
        shaft.rotation.y = ang; blk.rotation.y = ang;
        const alpha = FSS.swash * 15 * DEG; sw.rotation.x = -alpha;
        stroker.position.x = -(FSS.swash - 0.5) * 0.12;
        pistons.forEach(p => { const psi = p.a - ang; p.g.position.y = ys + 0.012 + rb * Math.sin(psi) * Math.tan(alpha); });
        gP.set(FSS.pSys); accs.forEach(a => a.scale.y = 1 - 0.1 * FSS.swash);
        rvp.position.y = FSS.pSys > FSP.relief[0] ? 0.02 : 0;
      },
    };
  },
  readouts() {
    const pumpQ = FSS.swash * FSS.qMaxEng / FSP.nEngPumps;
    return kvRow('설정 압력', `${FSS.pSet.toFixed(0)} bar`, 'ref') + kvRow('부하 / 회전수', `${(SIM.state.load * 100).toFixed(0)} % / ${SIM.state.rpm.toFixed(0)} r/min`)
      + kvRow('펌프 회전수', `${FSS.pumpN.toFixed(0)} r/min`, 'edu') + kvRow('사판각', `${(FSS.swash * 15).toFixed(1)}° (${(FSS.swash * 100).toFixed(0)} %)`, 'calc')
      + kvRow('제어유 소비 (엔진)', `${FSS.qDem.toFixed(2)} L/s`, 'calc') + kvRow('펌프 1대 토출', `${pumpQ.toFixed(2)} L/s`, 'calc')
      + kvRow('최대 공급 (3대)', `${FSS.qMaxEng.toFixed(1)} L/s`, 'edu') + kvRow('유압 동력', `${FSS.powerKW.toFixed(0)} kW`, 'calc')
      + kvRow('전동 시동 펌프', FSS.startPumps ? '운전' : '대기', 'calc') + kvRow('안전밸브 설정', `${FSP.relief[0]} / ${FSP.relief[1]} bar`, 'ref');
  },
});

// ---------------- 자동 역세 필터 ----------------
defDevice('autofilter', {
  ko: '자동 역세 필터', en: 'Automatic back-flushing filter', sys: '제어유 (유압) 계통', parts: ['autofilter'],
  principle: `<p>HPS로 가는 시스템 오일을 거르는 필터입니다(교육용 10 µm). 오일은 아래에서 들어와 원형으로 배열된 필터 캔들 <b>안쪽에서 바깥쪽</b>으로 흘러나가며 걸러지고, 깨끗한 오일은 하우징 바깥 공간에서 출구로 나갑니다.</p>
  <p>캔들 안쪽에 오염이 쌓여 차압이 설정값에 이르면(또는 정해진 시간이 지나면) 바닥의 역세 암이 돌기 시작합니다. 암이 한 캔들의 입구 아래에 오면 그 캔들만 드레인(저압)에 연결되어, 바깥의 깨끗한 오일이 <b>거꾸로</b> 흘러 오염을 씻어 내립니다. 나머지 캔들은 그동안에도 계속 여과하므로 흐름이 끊기지 않습니다.</p>
  <p>역세 오일은 드레인 탱크로 가고, 이 필터 뒤에는 보조 필터(교육용 25 µm)가 직렬로 있어 자동 필터 고장에 대비합니다.</p>`,
  sources: [
    { t: 'ref', text: 'MAN B&W ME · HPS automatic filter (back-flushing, redundant filter)', url: 'https://www.merchantnavydecoded.com/?p=90586' },
    { t: 'ref', text: 'BOLL & KIRCH 6.64 automatic filter principle', url: 'https://www.bollfilter.com/en/products/automatic-filters' },
    { t: 'edu', text: '눈 크기 10 µm/25 µm, 캔들 수, 역세 차압 0.6 bar, 오염 속도는 교육용 가정' }],
  view: { t: [0, 0.2, -0.1], d: [0.25, 0.35, 1], k: 0.78 },
  controls: () => `<button class="btn" id="dvFlush" style="width:100%">지금 역세 시작</button>${timeCtl()}`,
  bind() { $('dvFlush').onclick = () => { HYD.flushing = true; HYD.flushT = 0; }; bindTime(); },
  build(root) {
    const Nc = 12, rc = 0.26;
    dpart(root, vesselY(0.48, -0.75, 0.95, 0.025, 0.14, { bot: false }), DC.paint, { ko: '필터 하우징', en: 'Housing (clean side)', d: '캔들 바깥 공간은 걸러진 깨끗한 오일로 차 있습니다.' });
    dpart(root, lathe([[0, -0.95], [0.5, -0.95], [0.5, -0.75], [0.46, -0.75], [0.46, -0.9], [0, -0.9]]), DC.castL, { ko: '하부 몸체 (오염 측)', en: 'Lower body (dirty side)', d: '' , label: false });
    dpart(root, cylY(0.46, -0.6, -0.55, 40), DC.steelD, { ko: '캔들 지지판', en: 'Candle plate', d: '캔들 입구 구멍이 원형으로 뚫린 판. 아래쪽은 오염 측, 위쪽은 청정 측.' });
    const cands = [];
    for (let i = 0; i < Nc; i++) {
      const a = (i + 0.5) / Nc * Math.PI * 2, x = rc * Math.cos(a), z = rc * Math.sin(a);
      const m = dpart(root, ringG(0.042, 0.055, -0.55, 0.62, 18).translate(x, 0, z), DC.mesh, i === Math.round(Nc * 0.75) ? { ko: '필터 캔들', en: 'Filter candle (wedge-wire)', d: '쐐기형 철선을 감은 원통. 안에서 밖으로 여과하고, 역세 때는 밖에서 안으로 씻깁니다.' } : null, { metal: 0.7, rough: 0.55 });
      const dirt = dpart(root, ringG(0.03, 0.042, -0.5, 0.58, 14).translate(x, 0, z), DC.carbon, null, { metal: 0, rough: 1 });
      cands.push({ a, x, z, m, dirt, c: 0.4 + 0.3 * Math.random() });
    }
    const arm = new THREE.Group(); arm.position.y = -0.72; root.add(arm);
    dpart(arm, box(0.34, 0.06, 0.1, rc / 2 + 0.02, 0, 0, 0.02), DC.red, { ko: '역세 암', en: 'Flushing arm', d: '중심축과 함께 돌며 한 번에 캔들 하나의 입구를 드레인으로 연결합니다.' });
    dpart(arm, cylY(0.05, -0.03, 0.06, 16).translate(rc, 0, 0), DC.red, null);
    dpart(root, cylY(0.035, -1.25, -0.6, 16), DC.steelL, { ko: '역세 구동축', en: 'Flushing drive shaft', d: '아래쪽 기어 모터(또는 유압 모터)가 돌립니다.' });
    dpart(root, box(0.26, 0.22, 0.26, 0, -1.4, 0, 0.03), DC.motor, { ko: '기어 모터', en: 'Gear motor', d: '' });
    dpart(root, pipeAlong('x', 0.08, -1.0, -0.46, -0.83, 0, 0.012, true), DC.steelD, { ko: '입구 (오염유)', en: 'Inlet (unfiltered)', d: '오일 팬·시스템 오일에서 온 기름.' });
    dpart(root, pipeAlong('x', 0.08, 0.46, 1.0, 0.6, 0, 0.012, true), DC.steelD, { ko: '출구 (HPS로)', en: 'Outlet to HPS', d: '' });
    dpart(root, pipeAlong('y', 0.04, -1.2, -0.95, 0.3, 0, 0.01), DC.steelD, { ko: '역세 드레인', en: 'Back-flush drain', d: '씻겨 나온 오염유가 드레인 탱크로 갑니다.' });
    const gdp = dgauge(root, -0.72, 0.3, 0.02, 0.1, '차압', 0, 1.0, 'bar', { ko: '차압 스위치', en: 'Δp indicator', d: '역세 시작 신호(교육용 0.6 bar).' });
    // 보조 필터
    const rf = new THREE.Group(); rf.position.set(1.25, 0.2, 0); root.add(rf);
    dpart(rf, vesselY(0.18, -0.4, 0.4, 0.015, 0.06), DC.paint, { ko: '보조 필터 (25 µm)', en: 'Redundant filter', d: '자동 필터가 고장 나도 HPS를 보호하는 직렬 필터.' });
    dpart(rf, ringG(0.06, 0.11, -0.3, 0.3, 24), DC.mesh, null);
    // 유동: 각 캔들 (절단면 쪽 캔들만)
    const flows = [];
    cands.forEach((c, i) => { if (c.z > 0.05) return; flows.push({ c, i, f: dflow(root, [[c.x, -0.85, c.z], [c.x, -0.55, c.z], [c.x, 0.55, c.z], [c.x * 1.6, 0.62, c.z * 1.3]], 'oilLo', () => (HYD.flushK === i ? -1.2 : 0.7), { sp: 0.06, colorFn: u => HYD.flushK === i ? new THREE.Color(FLC.dirt) : new THREE.Color(FLC.oilLo).lerp(new THREE.Color(FLC.oil), u) }) }); });
    dflow(root, [[-1.0, -0.83, -0.02], [-0.3, -0.83, -0.03], [-0.1, -0.83, -0.03]], 'oilLo', () => 0.8, { sp: 0.05 });
    dflow(root, [[0.38, 0.0, -0.04], [0.42, 0.6, -0.03], [1.0, 0.6, -0.02], [1.25, 0.6, -0.02], [1.25, -0.5, -0.02]], 'oil', () => 0.8, { sp: 0.05 });
    dflow(root, [[0.3, -0.75, -0.02], [0.3, -1.25, -0.02]], 'dirt', () => HYD.flushing ? 1 : 0, { sp: 0.06 });
    let armA = 0;
    return {
      update(st) {
        const dt = st.dtVis * DVS.tscale;
        cands.forEach(c => { c.c = Math.min(1, c.c + dt * 0.004); });
        const mean = cands.reduce((s, c) => s + c.c, 0) / Nc; HYD.dpAF = 0.12 + 0.6 * mean * mean;
        if (!HYD.flushing && HYD.dpAF > 0.6) { HYD.flushing = true; HYD.flushT = 0; }
        HYD.flushK = -1;
        if (HYD.flushing) {
          HYD.flushT += st.dtVis; armA = HYD.flushT * 0.6;
          const k = Math.floor(((armA / (Math.PI * 2)) * Nc) % Nc);
          const cand = cands.reduce((best, c, i) => { const d = Math.abs(wrapS((armA - c.a) / DEG)); return d < best.d ? { d, i } : best; }, { d: 1e9, i: -1 });
          if (cand.d < 12) { HYD.flushK = cand.i; cands[cand.i].c = Math.max(0.05, cands[cand.i].c - st.dtVis * 0.8); }
          if (armA >= Math.PI * 2) { HYD.flushing = false; armA = 0; }
          void k;
        }
        arm.rotation.y = -armA;
        cands.forEach((c, i) => { c.dirt.scale.set(0.6 + c.c * 0.4, 1, 0.6 + c.c * 0.4); c.dirt.visible = c.c > 0.08; c.m.material.emissive.setHex(HYD.flushK === i ? 0x5a3010 : 0); });
        gdp.set(HYD.dpAF);
      },
    };
  },
  readouts() {
    return kvRow('차압', `${HYD.dpAF.toFixed(2)} bar`, 'edu') + kvRow('역세 설정 차압', '0.60 bar', 'edu') + kvRow('상태', HYD.flushing ? `역세 중 (캔들 ${HYD.flushK >= 0 ? HYD.flushK + 1 : '-'})` : '여과', 'edu')
      + kvRow('통과 유량 (HPS 소비)', `${FSS.qDem.toFixed(2)} L/s`, 'calc') + kvRow('주 필터 / 보조 필터', '10 µm / 25 µm', 'edu');
  },
});

// ---------------- HCU 축압기 ----------------
defDevice('accum', {
  ko: 'HCU 축압기', en: 'HCU bladder accumulator', sys: '제어유 (유압) 계통', parts: ['accum'],
  principle: `<p>HCU마다 붙은 질소 블래더 축압기입니다. 분사(부스터)와 배기밸브 개방 순간에는 HPS 공급보다 훨씬 많은 기름이 짧게 필요하므로, 축압기 블래더가 압축되어 있던 질소의 힘으로 기름을 내보내고, 소비가 없는 동안 다시 채워집니다.</p>
  <p>이 모델은 크랭크각별 소비량(부스터 상승 속도 × 체적 + 배기밸브 개방 속도 × 체적)과 평균 공급량의 차이를 적분해 기름 체적 변화를 구하고, 질소를 단열 압축(n = 1.4)으로 계산해 압력을 얻습니다. 크랭크각 슬라이더를 움직이면 분사·배기밸브 개방 구간에서 블래더가 부풀고 압력이 떨어지는 것을 볼 수 있습니다.</p>`,
  sources: [
    { t: 'ref', text: 'MAN B&W ME engines · HCU accumulators (nitrogen bladder)', url: 'https://www.merchantnavydecoded.com/?p=90586' },
    { t: 'edu', text: '축압기 체적 6 L, 봉입압 = 0.65 × 작동압, 단열 지수 1.4는 교육용 가정' }],
  view: { t: [0, 0.4, -0.05], d: [0.25, 0.2, 1], k: 0.95 },
  build(root) {
    dpart(root, vesselY(0.3, -0.5, 1.3, 0.03, 0.28), DC.red, { ko: '축압기 쉘', en: 'Shell', d: '고압 용기. 상부에 질소 충전 밸브, 하부에 오일 포트.' });
    const bl = new THREE.Group(); root.add(bl);
    const bladder = dpart(bl, sphere(0.25, 0, 0, 0).scale(1, 2.6, 1).translate(0, 0.62, 0), DC.rubber, { ko: '블래더 (질소)', en: 'Bladder (N₂)', d: '고무 주머니 안에 질소가 들어 있습니다. 기름이 들어오면 눌려 작아지고, 기름을 내보내면 부풉니다.' }, { metal: 0, rough: 0.9 });
    dfluid(bl, sphere(0.235, 0, 0, 0).scale(1, 2.55, 1).translate(0, 0.62, 0), 'gas', 0.3);
    dfluid(root, cylY(0.27, -0.42, 1.0, 36), 'oil', 0.12);
    dpart(root, cylY(0.03, 1.28, 1.45, 10), DC.brass, { ko: '질소 충전 밸브', en: 'Gas charging valve', d: '정기적으로 봉입압을 점검·보충합니다.' });
    const pop = dpart(root, lathe([[0, -0.5], [0.08, -0.46], [0.08, -0.42], [0, -0.4]]), DC.steelL, { ko: '포핏 밸브', en: 'Anti-extrusion poppet', d: '기름이 다 빠지면 블래더가 포트로 밀려 나가지 않도록 막는 밸브.' });
    dpart(root, pipeAlong('y', 0.06, -0.9, -0.48, 0, 0, 0.015, true), DC.steelD, { ko: '오일 포트 (HCU 블록)', en: 'Oil port', d: '' });
    const g = dgauge(root, 0.55, 0.2, 0.02, 0.13, '축압기', 150, 350, 'bar', { ko: '압력', en: 'Pressure', d: '' });
    const fIn = dflow(root, [[0, -0.95, -0.02], [0, -0.45, -0.03], [0.1, 0.0, -0.05]], 'oil', () => 0, { sp: 0.05 });
    return {
      update(st) {
        const th = thOfRef(), p = hcuAt('acc', th), Vg = HCU.Vg0 * Math.pow(FSS.pSet / p, 1 / 1.4);
        const s = Math.pow(Vg / FSP.accV0, 1 / 3) * 1.12; bl.scale.set(s, Math.min(1.02, s * 1.0), s); bl.position.y = 0.62 * (1 - bl.scale.y) * 0.4;
        g.set(p); pop.position.y = 0;
        const i = Math.floor(th / 360 * HCU.n) % HCU.n, net = (HCU.cons[i] ?? 0);
        fIn.rate = () => (net > 1e-6 ? -1.5 : 0.4);
        this.s = { p, Vg, th };
      },
    };
  },
  readouts() {
    const s = DV.api.s || { p: FSS.pSet, Vg: 0, th: 0 };
    return kvRow('크랭크각 (기준 실린더)', `${s.th.toFixed(1)}°`, 'calc') + kvRow('축압기 압력', `${s.p.toFixed(1)} bar`, 'calc') + kvRow('질소 체적', `${s.Vg.toFixed(2)} L`, 'calc')
      + kvRow('봉입압 (질소)', `${HCU.p0.toFixed(0)} bar`, 'edu') + kvRow('사이클 최대·최소', `${Math.max(...HCU.acc).toFixed(0)} / ${Math.min(...HCU.acc).toFixed(0)} bar`, 'calc');
  },
});

// ---------------- FIVA 밸브 ----------------
defDevice('fiva', {
  ko: 'FIVA 밸브', en: 'FIVA valve (Fuel Injection & Valve Actuation)', sys: '제어유 (유압) 계통', parts: ['fiva', 'hcu', 'mpc'],
  principle: `<p>FIVA는 실린더마다 하나 있는 전자 비례 제어 밸브로, 한 밸브가 <b>연료 분사</b>(부스터 구동)와 <b>배기밸브 개폐</b>(액추에이터 구동)를 모두 제어합니다. 실린더 제어 유닛(CCU/MPC)이 크랭크각 엔코더 신호에 맞춰 명령을 보냅니다.</p>
  <p>파일럿 밸브(비례 솔레노이드)가 주 스풀 양끝의 압력을 바꿔 주 스풀을 움직이고, 주 스풀 끝의 LVDT가 실제 위치를 되먹임합니다. 주 스풀이 한쪽(+)으로 가면 P → 부스터(Cfi), 반대쪽(−)으로 가면 P → 배기밸브 액추에이터(Cva), 가운데(0)면 두 출구가 모두 탱크로 열려 부스터는 원위치되고 배기밸브는 공기 스프링으로 닫힙니다.</p>`,
  sources: [
    { t: 'ref', text: 'MAN B&W ME engine · FIVA valve, HCU, ECS', url: 'https://wordpress-sxaew.wasmer.app/?p=589' },
    { t: 'ref', text: 'MAN Energy Solutions · ME engine control (FIVA/ELFI/ELVA)', url: 'https://www.man-es.com/marine/products/two-stroke-engines/me-c' },
    { t: 'edu', text: '스풀 랜드 배치·포트 간격·스풀 행정은 기능을 보여 주기 위한 교육용 형상' }],
  view: { t: [0, 0.15, -0.05], d: [0.1, 0.35, 1], k: 0.85 },
  build(root) {
    const ports = { Tfi: -0.36, Cfi: -0.18, P: 0, Cva: 0.18, Tva: 0.36 };
    dpart(root, box(1.2, 0.5, 0.42, 0, 0, -0.0, 0.03), DC.castL, { ko: 'FIVA 몸체 (HCU 블록에 장착)', en: 'Valve body', d: '내부가 보이도록 반투명으로 그렸습니다. 실제로는 HCU 블록에 볼트로 고정되고, 포트는 블록 안 드릴 통로로 이어집니다.' }, { opacity: 0.22 });
    dpart(root, ringX(0.07, 0.09, -0.5, 0.5, 28), DC.steelD, { ko: '스풀 슬리브', en: 'Spool sleeve', d: '' , label: false });
    const pc = { Tfi: ['Tfi', '탱크 (부스터측)'], Cfi: ['Cfi', '부스터로'], P: ['P', '고압 공급'], Cva: ['Cva', '배기밸브 액추에이터로'], Tva: ['Tva', '탱크 (배기측)'] };
    Object.entries(ports).forEach(([k, x]) => {
      const up = k.startsWith('C');
      dpart(root, pipeAlong('y', 0.03, up ? 0.07 : -0.07, up ? 0.45 : -0.45, x, 0, 0.006), k === 'P' ? DC.red : DC.steelD, { ko: `포트 ${pc[k][0]}`, en: pc[k][1], d: '' });
    });
    const spool = new THREE.Group(); root.add(spool);
    const sp = dgroup(spool, { ko: '주 스풀', en: 'Main spool', d: '세 개의 랜드가 포트를 여닫습니다. +면 P→Cfi(분사), −면 P→Cva(배기밸브 개방), 0이면 Cfi→Tfi·Cva→Tva(배출).' });
    dadd(sp, cylX(0.025, -0.6, 0.62, 16), DC.steelL);
    [-0.42, 0, 0.42].forEach(x => dadd(sp, cylX(0.068, x - 0.04, x + 0.04, 28), DC.steelL));
    const lv = dgroup(root, { ko: 'LVDT 위치 센서', en: 'LVDT', d: '스풀 끝의 철심이 코일 안에서 움직이며 위치를 전압으로 알려 줍니다. 제어기는 이 값으로 스풀 위치를 폐루프 제어합니다.' });
    dadd(lv, ringX(0.05, 0.1, 0.62, 0.88, 24), DC.motor); dadd(lv, cylX(0.11, 0.88, 0.92, 24), DC.steelD);
    dpart(spool, cylX(0.03, 0.62, 0.8, 14), 0x8c8c8c, null);
    // 파일럿 밸브 + 솔레노이드
    const pl = new THREE.Group(); pl.position.y = 0.42; root.add(pl);
    dpart(pl, box(0.6, 0.2, 0.3, 0, 0.1, 0, 0.02), DC.steelD, { ko: '파일럿 밸브', en: 'Pilot valve', d: '작은 스풀이 주 스풀 양끝 실(chamber)에 기름을 보내거나 빼서 주 스풀을 움직입니다.' }, { opacity: 0.3 });
    const pspool = dpart(pl, cylX(0.025, -0.22, 0.22, 14).translate(0, 0.1, 0), DC.steelL, null);
    dpart(pl, ringX(0.05, 0.11, 0.3, 0.52, 24).translate(0, 0.1, 0), 0x8b6a3e, { ko: '비례 솔레노이드', en: 'Proportional solenoid', d: '제어기의 전류에 비례하는 힘으로 파일럿 스풀을 밉니다.' }, { metal: 0.3 });
    const ledG = new THREE.MeshBasicMaterial({ color: 0x46c28a }); const led = new THREE.Mesh(sphere(0.025, 0.55, 0.25, 0.05), ledG); pl.add(led);
    dpart(root, cylX(0.05, -0.6, -0.5, 20), DC.steelD, null);
    // 유동
    const F = () => hcuAt('fiva', thOfRef());
    dflow(root, [[ports.P, -0.45, -0.02], [ports.P, 0, -0.02], [ports.Cfi, 0, -0.02], [ports.Cfi, 0.45, -0.02]], 'oil', () => Math.max(0, F()) * 1.5, { sp: 0.04, rc: 0.03 });
    dflow(root, [[ports.P, -0.45, -0.03], [ports.P, 0, -0.03], [ports.Cva, 0, -0.03], [ports.Cva, 0.45, -0.03]], 'oil', () => Math.max(0, -F()) * 1.5, { sp: 0.04, rc: 0.03 });
    dflow(root, [[ports.Cfi, 0.45, -0.04], [ports.Cfi, 0, -0.04], [ports.Tfi, 0, -0.04], [ports.Tfi, -0.45, -0.04]], 'oilLo', () => (F() < 0.3 && HCU.boost && hcuAt('boost', thOfRef()) > 0.02 ? 1 : 0.02), { sp: 0.04, rc: 0.03 });
    dflow(root, [[ports.Cva, 0.45, -0.05], [ports.Cva, 0, -0.05], [ports.Tva, 0, -0.05], [ports.Tva, -0.45, -0.05]], 'oilLo', () => (F() > -0.3 && M.evLiftRate(thOfRef()) < -1e-3 ? 1 : 0.02), { sp: 0.04, rc: 0.03 });
    return {
      update() {
        const f = F(); spool.position.x = f * 0.1; pspool.position.x = clamp(f * 0.05, -0.04, 0.04);
        ledG.color.setHex(Math.abs(f) > 0.5 ? 0xe3a33b : 0x46c28a);
        this.f = f;
      },
    };
  },
  readouts() {
    const th = thOfRef(), f = DV.api.f ?? 0;
    const mode = f > 0.5 ? 'P → Cfi (분사: 부스터 구동)' : f < -0.5 ? 'P → Cva (배기밸브 개방)' : Math.abs(f) < 0.1 ? '중립: Cfi→Tfi, Cva→Tva' : '전환 중';
    return kvRow('크랭크각 (기준 실린더)', `${th.toFixed(1)}°`, 'calc') + kvRow('주 스풀 위치', `${(f * 100).toFixed(0)} %`, 'calc') + kvRow('연결', mode)
      + kvRow('분사 명령', `${wrap360(CFG.soi).toFixed(1)}° 부터 ${M.injDur(SIM.state.load).toFixed(1)}°`, 'edu') + kvRow('배기밸브 명령', `${CFG.evo}° – ${CFG.evc}°`, 'edu') + kvRow('공급 압력 P', `${FSS.pSys.toFixed(0)} bar`, 'ref');
  },
});

// ---------------- 연료 압력 부스터 ----------------
defDevice('fpb', {
  ko: '연료 압력 부스터', en: 'Fuel oil pressure booster', sys: '연료 · 제어유 계통', parts: ['fpb', 'hpfuel'],
  principle: `<p>ME 엔진에는 캠 구동 연료 펌프가 없고, HCU에 붙은 이 부스터가 분사 압력을 만듭니다. FIVA가 제어유(200–300 bar)를 아래쪽 <b>유압 피스톤</b>에 보내면, 그 위의 가는 <b>연료 플런저</b>가 함께 올라가며 연료를 압축합니다. 두 단면적의 비(교육용 3.3)만큼 압력이 증폭되어 300 bar × 3.3 ≈ 1000 bar의 분사 압력이 됩니다.</p>
  <p>플런저 위 연료실은 고압관으로 실린더 커버의 분사밸브 2개에 연결됩니다. 분사가 끝나면 FIVA가 유압 피스톤 아래를 탱크로 열고, 연료 공급 압력(약 8 bar)이 흡입 역지밸브를 통해 연료실을 다시 채우며 피스톤을 원위치로 밀어 내립니다. 피스톤 위치 센서가 실제 행정을 ECS에 알려 분사량을 확인합니다.</p>
  <p>엄브렐라 실(umbrella seal)과 실링 오일이 연료가 제어유 쪽으로 새어드는 것을 막습니다.</p>`,
  sources: [
    { t: 'ref', text: 'MAN B&W ME engine · Fuel oil pressure booster, HCU', url: 'https://wordpress-sxaew.wasmer.app/?p=589' },
    { t: 'ref', text: 'ME engine fuel injection system overview', url: 'https://www.merchantnavydecoded.com/?p=90586' },
    { t: 'edu', text: '면적비 3.3, 행정, 원위치 시간(40°)은 교육용 가정' }],
  view: { t: [0, 0.35, -0.05], d: [0.3, 0.15, 1], k: 0.85 },
  build(root) {
    const D = 0.36, d = D / Math.sqrt(FSP.areaRatio), S = 0.26;
    dpart(root, lathe([[0, -0.75], [0.3, -0.75], [0.3, 0.05], [0.2, 0.05], [0.2, 0.0], [D / 2 + 0.005, 0.0], [D / 2 + 0.005, -0.66], [0, -0.66]]), DC.castL, { ko: '유압 실린더', en: 'Hydraulic cylinder', d: '아래 실에 FIVA에서 온 제어유가 들어옵니다.' });
    dpart(root, lathe([[d / 2 + 0.004, 0.05], [0.2, 0.05], [0.2, 0.9], [0.13, 1.0], [0.0, 1.0], [0, 0.88], [d / 2 + 0.004, 0.88]]), DC.steelD, { ko: '연료 배럴', en: 'Fuel barrel', d: '플런저가 미끄러지는 정밀 보어. 위쪽이 연료 압축실.' });
    const mv = new THREE.Group(); root.add(mv);
    dpart(mv, cylY(D / 2, -0.62, -0.42, 40), DC.steelL, { ko: '유압 피스톤', en: 'Hydraulic piston', d: '제어유 압력 × 큰 단면적의 힘으로 플런저를 밀어 올립니다.' });
    dpart(mv, cylY(d / 2, -0.42, 0.42, 28), DC.steelL, { ko: '연료 플런저', en: 'Fuel plunger', d: '작은 단면적으로 연료를 압축하므로 압력이 면적비만큼 커집니다.' });
    dpart(root, ringG(d / 2 + 0.003, 0.17, -0.05, 0.03), DC.rubber, { ko: '엄브렐라 실', en: 'Umbrella seal', d: '연료와 제어유 사이를 분리하는 밀봉. 실링 오일이 함께 공급됩니다.' });
    dpart(root, cylY(0.015, -1.0, -0.62, 8), 0x8c8c8c, null);
    const sens = dpart(root, ringG(0.03, 0.07, -1.05, -0.78, 20), DC.motor, { ko: '피스톤 위치 센서', en: 'Position sensor', d: '피스톤 행정을 재어 분사량과 분사 시작을 확인합니다.' });
    const fch = dfluid(root, cylY(d / 2, 0.42, 0.88, 24), 'fuel', 0.35);
    const och = dfluid(root, cylY(D / 2 - 0.005, -0.66, -0.62, 32), 'oil', 0.5);
    // 흡입 역지밸브
    const sv = new THREE.Group(); sv.position.set(-0.22, 0.95, 0); root.add(sv);
    dpart(sv, pipeAlong('x', 0.04, -0.5, 0.1, 0, 0, 0.01, true), DC.steel, { ko: '연료 흡입 역지밸브', en: 'Suction non-return valve', d: '분사가 끝나고 플런저가 내려가면 열려 약 8 bar 공급 연료로 압축실을 채웁니다. 분사 중에는 고압으로 닫힙니다.' });
    const svb = dpart(sv, sphere(0.03, -0.12, 0, 0), DC.steelL, null);
    // 고압 출구
    dpart(root, pipeAlong('y', 0.025, 1.0, 1.5, 0, 0, 0.012, true), DC.steelL, { ko: '고압 연료관 (분사밸브로)', en: 'HP fuel pipe', d: '두꺼운 이중벽 관. 분사 중 약 1000 bar.' });
    dpart(root, ringG(0.03, 0.045, 1.05, 1.5, 18), DC.steelD, null, { opacity: 0.35 });
    // 제어유 입구
    dpart(root, pipeAlong('x', 0.04, 0.3, 0.75, -0.7, 0, 0.01, true), DC.steelD, { ko: '제어유 입·출구 (FIVA Cfi)', en: 'Control oil from FIVA', d: '' });
    const gF = dgauge(root, 0.55, 1.1, 0.02, 0.13, '연료', 0, 1200, 'bar', { ko: '연료압', en: 'Fuel pressure', d: '' });
    const gO = dgauge(root, 0.6, -0.35, 0.02, 0.11, '제어유', 0, 400, 'bar', { ko: '제어유압', en: 'Oil pressure', d: '' });
    const inj = () => M.inj01(thOfRef(), SIM.state.load);
    const ret = () => { const th = thOfRef(), b = hcuAt('boost', th), b2 = hcuAt('boost', th + 1); return b2 < b - 1e-4 ? 1 : 0; };
    dflow(root, [[0.75, -0.7, -0.02], [0.2, -0.7, -0.02], [0, -0.68, -0.02]], 'oil', () => inj() * 1.2 - ret(), { sp: 0.04 });
    dflow(root, [[0, 0.7, -0.02], [0, 1.0, -0.02], [0, 1.6, -0.02]], 'fuel', () => inj() * 2, { sp: 0.035 });
    dflow(root, [[-0.75, 0.95, -0.02], [-0.12, 0.95, -0.02], [-0.03, 0.85, -0.02], [0, 0.6, -0.02]], 'fuel', ret, { sp: 0.04 });
    return {
      update() {
        const th = thOfRef(), b = hcuAt('boost', th); mv.position.y = b * S;
        fch.scale.y = (0.46 - b * S) / 0.46; fch.position.y = 0.88 * (1 - fch.scale.y);
        och.scale.y = (0.04 + b * S) / 0.04; och.position.y = -0.66 * (1 - och.scale.y);
        const pf = injPressure(th); gF.set(pf); gO.set(inj() > 0 ? FSS.pSys : ret() ? 8 : 5);
        svb.position.x = ret() ? 0.03 : 0;
        this.s = { th, b, pf };
      },
    };
  },
  readouts() {
    const s = DV.api.s || { th: 0, b: 0, pf: 8 }, D = M.injDur(SIM.state.load);
    return kvRow('크랭크각 (기준 실린더)', `${s.th.toFixed(1)}°`, 'calc') + kvRow('피스톤 행정', `${(s.b * 100).toFixed(0)} %`, 'calc') + kvRow('연료 압력', `${s.pf.toFixed(0)} bar`, 'calc')
      + kvRow('최대 분사압 (= 계통압 × 면적비)', `${(FSS.pSys * FSP.areaRatio).toFixed(0)} bar`, 'calc') + kvRow('분사 기간', `${D.toFixed(1)}°`, 'edu')
      + kvRow('1회 분사량', `${(SIM.state.load * TH.mfMCR * 1000).toFixed(1)} g`, 'm0d') + kvRow('면적비', FSP.areaRatio.toFixed(1), 'edu');
  },
});

// ---------------- 배기밸브 액추에이터 ----------------
defDevice('evactuator', {
  ko: '배기밸브 액추에이터', en: 'Exhaust valve actuator', sys: '제어유 계통', parts: ['evactuator', 'hpoil_ev'],
  principle: `<p>HCU에 붙은 액추에이터는 FIVA에서 온 제어유로 <b>유압 피스톤</b>을 밀고, 그 위의 <b>고압 피스톤</b>이 오일 기둥을 고압관으로 밀어 실린더 커버 위 배기밸브의 유압 실린더로 보냅니다. 그 오일 기둥이 배기밸브 스핀들을 공기 스프링 힘을 이기고 아래로 밀어 엽니다.</p>
  <p>FIVA가 배출 쪽으로 바뀌면 공기 스프링이 스핀들을 닫으며 오일 기둥을 되밀어 피스톤이 내려옵니다. 액추에이터 행정과 배기밸브 양정이 같은 모양으로 움직입니다.</p>`,
  sources: [
    { t: 'ref', text: 'MAN B&W ME · Exhaust valve actuator & HCU', url: 'https://wordpress-sxaew.wasmer.app/?p=589' },
    { t: 'edu', text: '피스톤 지름, 행정, 1회 소비 0.30 L는 교육용 가정' }],
  view: { t: [0, 0.3, -0.05], d: [0.3, 0.15, 1], k: 0.9 },
  build(root) {
    dpart(root, lathe([[0, -0.7], [0.26, -0.7], [0.26, 0.8], [0.12, 0.8], [0.12, 0.72], [0.105, 0.72], [0.105, 0.0], [0.205, 0.0], [0.205, -0.62], [0, -0.62]]), DC.castL, { ko: '액추에이터 몸체', en: 'Actuator body', d: '' });
    const mv = new THREE.Group(); root.add(mv);
    dpart(mv, cylY(0.2, -0.6, -0.4, 36), DC.steelL, { ko: '유압 피스톤', en: 'Hydraulic piston', d: 'FIVA의 Cva 출구에서 온 제어유가 아래에서 밉니다.' });
    dpart(mv, cylY(0.1, -0.4, 0.4, 28), DC.steelL, { ko: '고압 피스톤', en: 'High-pressure piston', d: '오일 기둥을 고압관으로 밀어냅니다.' });
    const col = dfluid(root, cylY(0.1, 0.4, 0.72, 24), 'oil', 0.4);
    dpart(root, pipeAlong('y', 0.03, 0.8, 1.6, 0, 0, 0.01), DC.steelL, { ko: '배기밸브 고압관', en: 'HP pipe to exhaust valve', d: '실린더 커버 위 배기밸브 유압 실린더로 이어집니다 (오일 기둥).' });
    dpart(root, pipeAlong('x', 0.04, 0.26, 0.7, -0.65, 0, 0.01, true), DC.steelD, { ko: '제어유 (FIVA Cva)', en: 'Control oil', d: '' });
    dpart(root, cylY(0.012, 0.0, 0.7, 6).translate(0.18, 0, 0), DC.steelD, { ko: '오일 보충 역지밸브', en: 'Make-up valve', d: '오일 기둥이 새어 줄어든 만큼 저압 시스템 오일로 보충합니다.' });
    const g = dgauge(root, 0.55, 0.25, 0.02, 0.12, '오일 기둥', 0, 400, 'bar', { ko: '오일 기둥 압력', en: '', d: '' });
    const rate = () => M.evLiftRate(thOfRef());
    dflow(root, [[0.7, -0.65, -0.02], [0.2, -0.65, -0.02], [0, -0.64, -0.02]], 'oil', () => rate() * 25, { sp: 0.04 });
    dflow(root, [[0, 0.5, -0.02], [0, 0.8, -0.02], [0, 1.6, -0.02]], 'oil', () => rate() * 25, { sp: 0.035 });
    return {
      update() {
        const th = thOfRef(), L = M.evLift01(th); mv.position.y = L * 0.25;
        col.scale.y = (0.32 - L * 0.25) / 0.32; col.position.y = 0.72 * (1 - col.scale.y);
        g.set(L > 0.02 ? (M.evLiftRate(th) >= 0 ? FSS.pSys * 0.9 : 30) : 4); this.s = { th, L };
      },
    };
  },
  readouts() {
    const s = DV.api.s || { th: 0, L: 0 };
    return kvRow('크랭크각 (기준 실린더)', `${s.th.toFixed(1)}°`, 'calc') + kvRow('액추에이터 행정 = 밸브 양정', `${(s.L * 100).toFixed(0)} %`, 'calc')
      + kvRow('배기밸브 양정', `${(s.L * CFG.evLiftMax * 1000).toFixed(0)} mm`, 'edu') + kvRow('개방 / 폐쇄', `${CFG.evo}° / ${CFG.evc}°`, 'edu') + kvRow('1회 제어유 소비', `${FSP.Vev.toFixed(2)} L`, 'edu');
  },
});
