// ===================================================================
// 58 · 기기 내부 — 실린더 커버 밸브(슬라이드식 연료 분사밸브, 배기밸브)와 소기 공기 계통(공기 냉각기·수분 분리기, 보조 송풍기)
// ===================================================================

// ---------------- 연료 분사밸브 (슬라이드형) ----------------
defDevice('fuelvalve', {
  ko: '연료 분사밸브 (슬라이드형)', en: 'Fuel valve (slide type)', sys: '연료 계통 · 실린더 커버', parts: ['fuelvalve', 'nozzle'],
  principle: `<p>실린더 커버에 2개(대형 엔진은 3개)씩 있는 분사밸브입니다. 부스터가 연료 압력을 올려 <b>개변압(약 350–380 bar)</b>을 넘으면, 연료가 스핀들 아래 단면을 밀어 닫힘 스프링을 이기고 스핀들을 들어 올립니다.</p>
  <p>MAN B&W의 <b>슬라이드형</b>은 분사 구멍이 뚫린 슬라이드(노즐 끝) 안에 <b>컷오프 축</b>이 들어 있어, 닫힌 상태에서는 구멍 안쪽을 축이 막고 있습니다. 그래서 구멍 아래쪽 연료 고임(sac volume)이 거의 없어 분사 끝의 연료 방울과 그을음·NOx가 줄어듭니다. 분사 구멍은 연소실 선회류 방향으로 기울어 있습니다.</p>
  <p>분사가 끝나 압력이 떨어지면 스프링이 스핀들을 닫습니다. 엔진 정지 중에는 저압 연료가 밸브 안을 순환해 가열 상태를 유지합니다.</p>`,
  sources: [
    { t: 'ref', text: 'MAN B&W · Slide fuel valve (sac-free), opening pressure', url: 'https://marinediesels.info/2_stroke_engine_parts/Other_info/fuel_valve.htm' },
    { t: 'ref', text: 'MAN Energy Solutions · Slide fuel valve service letter', url: 'https://www.man-es.com/docs/default-source/service-letters/sl2012-557.pdf' },
    { t: 'edu', text: '구멍 수(5), 스핀들 양정, 스프링 치수는 교육용 가정' }],
  view: { t: [0, -0.05, -0.05], d: [0.35, 0.1, 1], k: 0.95 },
  build(root) {
    dpart(root, lathe([[0, 0.95], [0.14, 0.95], [0.16, 0.9], [0.16, 0.0], [0.11, -0.05], [0.11, -0.35], [0.07, -0.4], [0.042, -0.4], [0.042, -0.3], [0.08, -0.3], [0.08, -0.06], [0.11, 0.0], [0.11, 0.82], [0.03, 0.82], [0.03, 0.9], [0, 0.9]]), DC.steelD, { ko: '밸브 하우징', en: 'Valve housing', d: '실린더 커버의 구멍에 꽂혀 커버 냉각수와 연료 고압관 사이에 위치합니다.' });
    dpart(root, ringG(0.042, 0.075, -0.42, -0.36), DC.brass, { ko: '밸브 헤드 · 시트', en: 'Valve head & seat', d: '스핀들이 앉는 시트가 가공된 부품.' });
    const sl = dgroup(root, { ko: '슬라이드 (노즐 끝)', en: 'Slide (nozzle tip)', d: '분사 구멍이 뚫린 얇은 관. 연소실 안으로 튀어나와 있습니다.' });
    dadd(sl, lathe([[0.012, -0.95], [0.03, -0.95], [0.04, -0.9], [0.04, -0.42], [0.012, -0.42]]), DC.stellite ?? 0xd9d2b8);
    const sp = new THREE.Group(); root.add(sp);
    dpart(sp, lathe([[0, -0.94], [0.011, -0.94], [0.011, -0.41], [0.04, -0.38], [0.025, -0.36], [0.025, 0.2], [0, 0.2]]), DC.steelL, { ko: '스핀들 · 컷오프 축', en: 'Spindle with cut-off shaft', d: '아래 끝 컷오프 축이 슬라이드 안에서 분사 구멍을 여닫습니다. 들리면 구멍 안쪽이 열려 연료가 분사됩니다.' });
    dpart(sp, cylY(0.07, 0.2, 0.25, 24), DC.steelD, { ko: '스프링 받침 (스러스트 피스)', en: 'Thrust piece', d: '', label: false });
    const spr = dpart(root, springG(0.06, 0.25, 0.78, 8, 0.012), DC.spring, { ko: '닫힘 스프링', en: 'Closing spring', d: '개변압(약 350–380 bar)을 정하는 스프링.' });
    dpart(root, pipeAlong('x', 0.03, 0.16, 0.6, 0.6, 0, 0.012, true), DC.steelL, { ko: '고압 연료 입구', en: 'HP fuel inlet', d: '부스터에서 온 고압 연료. 하우징 안쪽 통로를 따라 스핀들 아래까지 내려갑니다.' });
    dpart(root, cylY(0.012, -0.36, 0.6, 8).translate(0.095, 0, 0), DC.steelD, { ko: '연료 통로', en: 'Fuel bore', d: '', label: false });
    dpart(root, pipeAlong('x', 0.02, -0.6, -0.16, 0.45, 0, 0.008, false), DC.steel, { ko: '순환 · 누설 출구', en: 'Circulation / leak-off outlet', d: '정지 중 예열 순환 연료와 스핀들 누설 연료가 나갑니다.' });
    // 커버 일부 + 연소실
    dpart(root, lathe([[0.2, -0.55], [0.75, -0.55], [0.75, -0.25], [0.2, -0.25]]), DC.cast, { ko: '실린더 커버 (일부)', en: 'Cylinder cover', d: '', label: false });
    const gauge = dgauge(root, 0.5, 0.95, 0.02, 0.12, '연료', 0, 1200, 'bar', { ko: '노즐 앞 압력', en: 'Fuel pressure', d: '' });
    // 분무: 구멍 5개 (절단면 쪽만)
    const hole = (ang, yy) => { const a = ang * DEG, dir = [Math.cos(a), -0.35, Math.sin(a) * 0.4]; return [[0, yy, -0.0], [0.04 * dir[0], yy, -0.005], ...[1, 2, 3].map(k => [0.04 * dir[0] + k * 0.22 * dir[0], yy + k * 0.22 * dir[1], -0.01 - k * 0.04])]; };
    const inj = () => M.inj01(thOfRef(), SIM.state.load);
    [[180, -0.9], [200, -0.84], [0, -0.88], [-20, -0.82], [160, -0.76]].forEach(([a, y]) => dflow(root, hole(a, y), 'fuel', () => inj() * 3, { sp: 0.03, size: 0.04, nocut: true, hideZero: true, colorFn: u => new THREE.Color(FLC.fuel).lerp(new THREE.Color(FLC.comb), smooth01(u * 1.3)) }));
    dflow(root, [[0.6, 0.6, -0.02], [0.095, 0.6, -0.02], [0.095, -0.36, -0.02], [0.03, -0.4, -0.02]], 'fuel', () => inj() * 2 + 0.02, { sp: 0.04 });
    return {
      update() {
        const th = thOfRef(), b = inj(), lift = b * 0.03; sp.position.y = lift;
        spr.scale.y = (0.53 - lift) / 0.53; spr.position.y = 0.78 * (1 - spr.scale.y);
        gauge.set(injPressure(th)); this.s = { th, b, p: injPressure(th) };
      },
    };
  },
  readouts() {
    const s = DV.api.s || { th: 0, b: 0, p: 8 };
    return kvRow('크랭크각 (기준 실린더)', `${s.th.toFixed(1)}°`, 'calc') + kvRow('노즐 앞 압력', `${s.p.toFixed(0)} bar`, 'calc') + kvRow('개변압', '350–380 bar', 'ref')
      + kvRow('스핀들', s.b > 0 ? `열림 (${(s.b * 100).toFixed(0)} %)` : '닫힘', 'calc') + kvRow('분사 시작', `${wrap360(CFG.soi).toFixed(1)}°`, 'edu') + kvRow('밸브 수 / 실린더', '2', 'edu');
  },
});

// ---------------- 배기밸브 ----------------
defDevice('exhvalve', {
  ko: '배기밸브', en: 'Exhaust valve (hydraulic open, air spring close)', sys: '배기 · 제어유 계통', parts: ['evspindle', 'evhousing', 'evseat', 'airspring', 'evact'],
  principle: `<p>실린더 커버 가운데의 배기밸브는 <b>유압으로 열리고 공기 스프링으로 닫힙니다</b>. HCU 액추에이터가 보낸 오일 기둥이 맨 위 유압 실린더의 피스톤을 밀어 스핀들을 아래로 엽니다. 스핀들 중간의 공기 피스톤 아래에는 약 7 bar 압축 공기가 있어, 오일 압력이 빠지면 스핀들을 다시 위로 밀어 닫습니다.</p>
  <p>닫히기 직전에는 유압 댐퍼가 속도를 늦춰 시트 충격을 줄입니다. 스핀들 줄기에 붙은 작은 날개(spinner)가 배기가스 흐름을 받아 스핀들을 조금씩 돌려, 시트가 고르게 닳고 탄소가 끼지 않게 합니다. 밸브 시트가 있는 바닥 부분은 냉각수로 식힙니다.</p>`,
  sources: [
    { t: 'ref', text: 'marinediesels.info · Exhaust valve (air spring, hydraulic actuation, spinner)', url: 'https://marinediesels.info/2_stroke_engine_parts/exhaust_valve.htm' },
    { t: 'ref', text: 'MAN B&W · DuraSpindle / W-seat exhaust valve', url: 'https://www.man-es.com/marine/products/two-stroke-engines' },
    { t: 'edu', text: '치수, 공기 스프링 체적비, 회전 속도는 교육용 가정 (양정·개폐 각은 시뮬레이터 설정값)' }],
  view: { t: [0, 0.25, -0.05], d: [0.4, 0.1, 1], k: 0.85 },
  build(root) {
    const Lm = 0.22;
    // 바닥 부분 (냉각) + 시트
    dpart(root, lathe([[0.3, -0.75], [0.55, -0.75], [0.55, -0.25], [0.5, -0.2], [0.26, -0.2], [0.26, -0.3], [0.33, -0.3], [0.38, -0.55], [0.3, -0.62]]), DC.cast, { ko: '바닥 부분 (냉각수 재킷)', en: 'Bottom piece', d: '밸브 시트를 품고 냉각수 통로가 있는 부분. 고온 배기가스를 가장 먼저 받습니다.' });
    dfluid(root, ringG(0.42, 0.5, -0.68, -0.32, 36), 'water', 0.35);
    dpart(root, ringG(0.23, 0.32, -0.66, -0.58), DC.stellite ?? 0xd9d2b8, { ko: '밸브 시트', en: 'Valve seat (W-seat)', d: '경화 처리된 시트 링. 스핀들 디스크와 원뿔면으로 맞닿아 밀봉합니다.' });
    // 하우징 + 배기 출구
    dpart(root, lathe([[0.26, -0.2], [0.52, -0.2], [0.52, 0.55], [0.14, 0.55], [0.14, 0.45], [0.42, 0.45], [0.42, -0.12], [0.26, -0.12]]), DC.castL, { ko: '밸브 하우징', en: 'Valve housing', d: '배기가스가 시트를 지나 옆의 배기관으로 꺾여 나가는 통로.' });
    dpart(root, pipeAlong('x', 0.2, 0.5, 1.05, 0.1, 0, 0.02, true), DC.castL, { ko: '배기 출구 (배기 리시버로)', en: 'Exhaust outlet', d: '' });
    dpart(root, ringG(0.045, 0.09, 0.42, 0.75), DC.bronze, { ko: '스핀들 가이드', en: 'Spindle guide', d: '스핀들 줄기를 안내하는 부시. 밀봉 공기로 배기가스가 새어들지 않게 합니다.' });
    // 스핀들
    const sp = new THREE.Group(); root.add(sp);
    dpart(sp, lathe([[0, -0.72], [0.3, -0.72], [0.3, -0.68], [0.24, -0.6], [0.06, -0.5], [0.045, -0.4], [0.045, 1.48], [0, 1.48]]), 0xc9c2b0, { ko: '스핀들 (Nimonic 디스크)', en: 'Spindle', d: '디스크(니모닉 등 내열합금)와 줄기가 한 몸. 아래로 내려가면 열립니다.' });
    const spin = new THREE.Group(); sp.add(spin);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; dpart(spin, box(0.09, 0.08, 0.012, 0.09 * Math.cos(a), -0.3, 0.09 * Math.sin(a), 0.004).rotateY(-a + 0.4), 0xb7ae98, i === 3 ? { ko: '스피너 (회전 날개)', en: 'Spinner vanes', d: '배기가스가 날개를 밀어 스핀들을 돌립니다. 시트 마모를 고르게 하고 탄소 퇴적을 막습니다.' } : null); }
    dpart(sp, cylY(0.3, 1.1, 1.18, 40), DC.steelL, { ko: '공기 피스톤', en: 'Air piston', d: '아래쪽 공기실의 압축 공기가 이 피스톤을 위로 밀어 밸브를 닫습니다.' });
    // 공기 스프링 실린더
    dpart(root, lathe([[0.045, 0.75], [0.36, 0.75], [0.36, 1.25], [0.32, 1.25], [0.32, 0.8], [0.06, 0.8]]), DC.steelD, { ko: '공기 스프링 실린더', en: 'Air spring cylinder', d: '약 7 bar 제어 공기가 공급됩니다. 밸브가 열릴수록 공기가 압축되어 닫는 힘이 커집니다.' });
    const air = dfluid(root, ringG(0.05, 0.31, 0.8, 1.1, 36), 'air', 0.35);
    // 유압 실린더 (맨 위)
    dpart(root, lathe([[0.05, 1.25], [0.2, 1.25], [0.2, 1.65], [0, 1.65], [0, 1.6], [0.16, 1.6], [0.16, 1.3], [0.05, 1.3]]), DC.castL, { ko: '유압 실린더', en: 'Hydraulic cylinder (actuator top)', d: 'HCU 액추에이터에서 온 오일 기둥이 들어오는 실린더.' });
    const hp = dpart(root, cylY(0.155, 1.48, 1.58, 32), DC.steelL, { ko: '유압 피스톤 · 댐퍼', en: 'Hydraulic piston with damper', d: '오일 압력으로 스핀들을 밀어 엽니다. 닫힐 때는 댐퍼 오리피스가 마지막 구간의 속도를 줄입니다.' });
    const oilc = dfluid(root, cylY(0.155, 1.58, 1.6, 28), 'oil', 0.5);
    dpart(root, pipeAlong('x', 0.025, 0.2, 0.7, 1.55, 0, 0.008), DC.steelL, { ko: '고압 오일관 (액추에이터에서)', en: 'HP oil pipe', d: '' });
    dpart(root, lathe([[0, -0.85], [0.55, -0.85], [0.55, -0.75], [0, -0.75]]).translate(0, -0.0, 0), DC.cast, { ko: '실린더 커버 (일부)', en: 'Cylinder cover', d: '', label: false });
    const g = dgauge(root, 0.85, 1.0, 0.02, 0.12, '공기 스프링', 0, 15, 'bar', { ko: '공기 스프링 압력', en: '', d: '' });
    // 배기가스 흐름
    const ev = () => M.evLift01(thOfRef());
    [-0.2, 0.2].forEach(x => dflow(root, [[x * 0.5, -1.2, -0.03], [x, -0.8, -0.04], [0.25 * Math.sign(x), -0.6, -0.04], [0.33 * Math.sign(x), -0.3, -0.05], [0.33, 0.1, -0.05], [1.1, 0.1, -0.03]], 'exh', () => ev() * 1.5, { sp: 0.05, rc: 0.08 }));
    let rot = 0;
    return {
      update(st) {
        const L = ev(); sp.position.y = -L * Lm; hp.position.y = -L * Lm; oilc.scale.y = (0.02 + L * Lm) / 0.02; oilc.position.y = 1.6 * (1 - oilc.scale.y);
        air.scale.y = (0.3 - L * Lm) / 0.3; air.position.y = 0.8 * (1 - air.scale.y);
        rot += st.dtVis * L * 0.8; sp.rotation.y = rot;
        const pa = 7 * Math.pow(0.3 / (0.3 - L * Lm * 0.4), 1.3); g.set(pa); this.s = { L, pa, th: thOfRef() };
      },
    };
  },
  readouts() {
    const s = DV.api.s || { L: 0, pa: 7, th: 0 };
    return kvRow('크랭크각 (기준 실린더)', `${s.th.toFixed(1)}°`, 'calc') + kvRow('양정', `${(s.L * CFG.evLiftMax * 1000).toFixed(0)} mm`, 'edu') + kvRow('공기 스프링 압력', `${s.pa.toFixed(1)} bar`, 'calc')
      + kvRow('공급 공기', '7 bar', 'ref') + kvRow('개방 / 폐쇄', `${CFG.evo}° / ${CFG.evc}°`, 'edu') + kvRow('배기 리시버 압력', `${((ENGS.px) / 1e5).toFixed(2)} bar abs`, 'm0d');
  },
});

// ---------------- 공기 냉각기 + 수분 분리기 ----------------
defDevice('cooler', {
  ko: '소기 공기 냉각기 · 수분 분리기', en: 'Scavenge air cooler & water mist catcher', sys: '소기 공기 계통', parts: ['cooler', 'mist', 'chamber'],
  principle: `<p>터보차저 압축기에서 나온 공기는 압축열로 150–200 °C 가까이 뜨거워집니다. 냉각기는 핀이 촘촘히 붙은 관 다발로 이루어져, 관 안에는 냉각수(청수)가 여러 번 왕복하고 공기는 위에서 아래로 핀 사이를 지나며 식습니다. 공기 밀도가 높아져 같은 소기압에서 더 많은 공기를 넣을 수 있습니다.</p>
  <p>공기가 이슬점 아래로 식으면 수증기가 물방울로 맺힙니다. 냉각기 아래의 <b>수분 분리기</b>는 지그재그 날개로 흐름 방향을 급히 바꿔 무거운 물방울을 날개에 부딪혀 모으고, 물은 드레인으로 빠집니다. 물방울이 실린더로 들어가면 유막이 씻겨 라이너 마모가 늘어납니다.</p>`,
  sources: [
    { t: 'ref', text: 'MAN B&W Project Guide · Scavenge air system: air cooler, water mist catcher', url: 'https://www.man-es.com/applications/projectguides/2stroke/content/printed/S60ME-C10_5.pdf' },
    { t: 'ref', text: 'marinediesels.info · Scavenge air coolers', url: 'https://marinediesels.info/2_stroke_engine_parts/Other_info/scavenge_air_cooler.htm' },
    { t: 'edu', text: '관 배열·패스 수·응축량 표시는 교육용. 온도는 0D 터보 매칭 모델 값' }],
  view: { t: [0, 0.05, -0.1], d: [0.3, 0.2, 1], k: 0.8 },
  build(root) {
    const sh = new THREE.Shape(rrectPts(-0.75, -1.1, 0.75, 1.2, 0.04).map(p => V2(p[0], p[1])));
    sh.holes.push(new THREE.Path(rrectPts(-0.7, -1.05, 0.7, 1.15, 0.03).map(p => V2(p[0], p[1]))));
    dpart(root, extXY(sh, -0.45, 0.45), DC.paint, { ko: '냉각기 케이싱', en: 'Cooler casing', d: '' });
    dpart(root, pipeAlong('y', 0.3, 1.15, 1.55, 0, 0, 0.02, true), DC.paintD ?? DC.castL, { ko: '입구 (압축기 출구 공기)', en: 'Air inlet from compressor', d: '' });
    // 관 다발 (X 방향 관, 핀은 YZ 판)
    const tubes = dgroup(root, { ko: '핀 튜브 다발', en: 'Finned tube bundle', d: '구리합금 관에 얇은 핀(알루미늄·구리)을 촘촘히 붙여 공기 쪽 전열 면적을 크게 늘렸습니다.' }, { anchor: [0, 0.55, -0.1] });
    const rowsY = [0.95, 0.8, 0.65, 0.5, 0.35, 0.2];
    rowsY.forEach((y, i) => { [-0.06, -0.18, -0.3].forEach((z, j) => dadd(tubes, cylX(0.035, -0.7, 0.7, 14).translate(0, y, z + (i % 2) * 0.06), 0xb87333)); });
    const fins = []; for (let x = -0.66; x <= 0.66; x += 0.06) fins.push(box(0.006, 0.9, 0.42, x, 0.575, -0.2, 0.002));
    dpart(root, mergeGeometries(fins), 0xc9c3b6, { ko: '핀', en: 'Fins', d: '공기 흐름 방향으로 나란한 얇은 판. 오염되면 차압이 오르고 냉각 성능이 떨어져 정기적으로 세정합니다.' }, { metal: 0.6, rough: 0.5 });
    // 물 헤더
    dpart(root, box(0.16, 1.0, 0.5, -0.82, 0.575, -0.2, 0.03), DC.blueS ?? 0x4f6f8c, { ko: '냉각수 헤더 (입·출구)', en: 'Water header', d: '칸막이로 나뉘어 냉각수가 여러 번 왕복(패스)합니다.' });
    dpart(root, box(0.16, 1.0, 0.5, 0.82, 0.575, -0.2, 0.03), DC.blueS ?? 0x4f6f8c, { ko: '반환 헤더', en: 'Return header', d: '', label: false });
    // 수분 분리기
    const mc = dgroup(root, { ko: '수분 분리기 날개', en: 'Water mist catcher vanes', d: '지그재그 날개가 흐름을 꺾어 물방울을 걸러 냅니다.' }, { anchor: [0, -0.45, -0.1] });
    for (let x = -0.6; x <= 0.61; x += 0.12) { const L = [[x, -0.2], [x + 0.05, -0.3], [x, -0.4], [x + 0.05, -0.5], [x, -0.6]]; const R = L.map(p => [p[0] + 0.014, p[1]]).reverse(); dadd(mc, extXY(shapeOf(L.concat(R)), -0.42, 0.0), DC.steelL); }
    dpart(root, box(1.4, 0.05, 0.85, 0, -0.85, -0.0, 0.01), DC.steelD, { ko: '드레인 홈통', en: 'Drain trough', d: '모인 물이 드레인 관으로 빠집니다. 드레인 양이 갑자기 늘면 냉각기 누수를 의심합니다.' });
    dpart(root, pipeAlong('y', 0.04, -1.4, -1.05, 0.5, 0, 0.01), DC.steel, null);
    dpart(root, pipeAlong('x', 0.3, 0.7, 1.2, -0.75, 0, 0.02, true), DC.castL, { ko: '출구 (소기 리시버로)', en: 'Outlet to scavenge receiver', d: '' });
    const gTi = dgauge(root, -0.45, 1.4, 0.05, 0.1, '입구', 0, 250, '°C', { ko: '입구 공기 온도', en: '', d: '' });
    const gTo = dgauge(root, 1.0, -0.35, 0.05, 0.1, '출구', 0, 250, '°C', { ko: '출구 공기 온도', en: '', d: '' });
    // 흐름
    const air = () => ENGS.mdC / 30 + 0.05, Tin = () => TCM.compTout(ENGS.N, Math.max(ENGS.mdC, 0.1)) - 273.15, Tout = () => ENGS.Ts - 273.15;
    for (let k = 0; k < 6; k++) { const x = -0.55 + k * 0.22; dflow(root, [[x * 0.4, 1.5, -0.05], [x, 1.05, -0.05 - (k % 2) * 0.1], [x, 0.0, -0.05 - (k % 2) * 0.1], [x + 0.02, -0.25, -0.1], [x - 0.02, -0.45, -0.1], [x, -0.7, -0.1], [0.7, -0.75, -0.05], [1.2, -0.75, -0.03]], 'air', air, { sp: 0.06, rc: 0.06, colorFn: u => new THREE.Color(0xff8a5a).lerp(new THREE.Color(FLC.air), smooth01((u - 0.08) / 0.4)) }); }
    rowsY.forEach((y, i) => dflow(root, i % 2 ? [[0.72, y, -0.12], [-0.72, y, -0.12]] : [[-0.72, y, -0.12], [0.72, y, -0.12]], 'water', () => 0.8, { sp: 0.06 }));
    dflow(root, [[-0.3, -0.3, -0.15], [-0.28, -0.82, -0.15], [0.5, -0.85, -0.1], [0.5, -1.4, -0.03]], 'water', () => clamp((ENGS.ps / 1e5 - 1.5) / 2, 0.05, 1), { sp: 0.08, size: 0.04 });
    return { update() { gTi.set(Tin()); gTo.set(Tout()); } };
  },
  readouts() {
    const Tin = TCM.compTout(ENGS.N, Math.max(ENGS.mdC, 0.1)) - 273.15, Tout = ENGS.Ts - 273.15, Q = ENGS.mdC * 1005 * Math.max(0, Tin - Tout) / 1000;
    return kvRow('공기 유량', `${ENGS.mdC.toFixed(1)} kg/s`, 'm0d') + kvRow('입구 온도 (압축기 출구)', `${Tin.toFixed(0)} °C`, 'm0d') + kvRow('출구 온도 (소기)', `${Tout.toFixed(0)} °C`, 'm0d')
      + kvRow('냉각 열량', `${(Q / 1000).toFixed(2)} MW`, 'calc') + kvRow('냉각수 입구', `${(TH.Tcw - 273.15).toFixed(0)} °C`, 'edu') + kvRow('소기압', `${(ENGS.ps / 1e5).toFixed(2)} bar abs`, 'm0d');
  },
});

// ---------------- 보조 송풍기 ----------------
defDevice('auxblower', {
  ko: '보조 송풍기', en: 'Auxiliary blower', sys: '소기 공기 계통', parts: ['auxblower', 'checkv'],
  principle: `<p>저부하·시동 때는 배기 에너지가 작아 터보차저만으로 소기압이 충분하지 않습니다. 이때 전동 원심 송풍기가 냉각기 뒤 공기를 다시 빨아 소기 리시버로 불어 넣어 소기압을 보충합니다.</p>
  <p>임펠러가 돌면 날개 사이 공기가 원심력으로 바깥으로 밀려나며 속도와 압력을 얻고, 나선형 볼류트가 속도를 압력으로 바꿉니다. 송풍기 출구의 <b>체크밸브(플랩)</b>는 송풍기가 멈췄을 때 소기 공기가 송풍기 쪽으로 역류하지 않게 합니다. 소기압이 정해진 값 아래로 떨어지면 자동으로 기동하고, 올라가면 정지합니다.</p>`,
  sources: [
    { t: 'ref', text: 'MAN B&W Project Guide · Auxiliary blowers (자동 기동·정지, 체크밸브)', url: 'https://www.man-es.com/applications/projectguides/2stroke/content/printed/S60ME-C10_5.pdf' },
    { t: 'edu', text: `기동/정지 소기압 ${CFG.auxOn}/${CFG.auxOff} bar g, 회전수, 날개 수는 교육용 가정` }],
  view: { t: [0.1, 0.3, -0.1], d: [0.15, 0.25, 1], k: 0.85 }, cutDefault: false,
  build(root) {
    // 볼류트 (나선형 케이싱): 반경이 각도에 따라 커지는 나선 벽 + 출구 덕트
    const rA = a => 0.55 + 0.25 * a / (Math.PI * 2), o = [], n = [];
    for (let i = 0; i <= 72; i++) { const a = 0.15 + (Math.PI * 2 - 0.15) * i / 72; o.push([(rA(a) + 0.05) * Math.cos(a), (rA(a) + 0.05) * Math.sin(a)]); n.push([rA(a) * Math.cos(a), rA(a) * Math.sin(a)]); }
    const volG = mergeGeometries([extXY(shapeOf(o.concat(n.reverse())), -0.35, 0.0), box(0.05, 0.95, 0.35, 0.825, 0.475, -0.175, 0.005), box(0.05, 0.67, 0.35, 0.525, 0.615, -0.175, 0.005)].map(g => g.index ? g.toNonIndexed() : g));
    dpart(root, volG, DC.paint, { ko: '볼류트 케이싱', en: 'Volute casing', d: '단면이 점점 넓어지는 나선 통로. 임펠러에서 나온 빠른 공기의 속도를 압력으로 바꿉니다. (앞판은 내부가 보이도록 생략)' });
    dpart(root, cylZ(0.82, -0.4, -0.35, 48), DC.paint, { ko: '뒤판', en: 'Back plate', d: '', label: false });
    const imp = new THREE.Group(); root.add(imp);
    dpart(imp, cylZ(0.47, -0.33, -0.3, 40), DC.steelL, { ko: '임펠러 허브판', en: 'Impeller hub disc', d: '' });
    const blades = dgroup(imp, { ko: '임펠러 날개 (후향)', en: 'Backward-curved blades', d: '회전 방향 반대로 굽은 날개. 효율이 높고 과부하 특성이 안정적입니다.' }, { anchor: [0.3, 0.2, -0.2] });
    for (let i = 0; i < 12; i++) { const a0 = i / 12 * Math.PI * 2, A = [], B = []; for (let k = 0; k <= 10; k++) { const r = 0.15 + 0.31 * k / 10, a = a0 - 0.6 * k / 10; A.push([r * Math.cos(a), r * Math.sin(a)]); B.push([r * Math.cos(a + 0.05), r * Math.sin(a + 0.05)]); } dadd(blades, extXY(shapeOf(A.concat(B.reverse())), -0.3, -0.06), DC.steelL); }
    dpart(imp, ringZ(0.17, 0.47, -0.06, -0.04, 40), DC.steelL, { ko: '앞 슈라우드', en: 'Front shroud', d: '', label: false }, { opacity: 0.35 });
    dpart(root, ringZ(0.17, 0.21, -0.04, 0.25, 32), DC.castL, { ko: '흡입구 (냉각기 뒤 공기)', en: 'Suction eye', d: '' }, { opacity: 0.3 });
    const shaft = new THREE.Group(); root.add(shaft);
    dpart(shaft, cylZ(0.04, -1.1, -0.15, 16), DC.steelL, null);
    dpart(root, cylZ(0.3, -1.15, -0.5, 36), DC.motor, { ko: '전동기', en: 'Electric motor', d: '' });
    // 출구 + 체크밸브 플랩
    const fl = new THREE.Group(); fl.position.set(0.675, 1.05, -0.17); root.add(fl);
    const flap = new THREE.Group(); flap.position.set(-0.15, 0.0, 0); fl.add(flap);
    dpart(flap, box(0.3, 0.015, 0.3, 0.15, 0, 0, 0.004), DC.steelD, { ko: '체크밸브 플랩', en: 'Non-return flap', d: '송풍기가 돌면 바람에 밀려 열리고, 멈추면 소기압과 자중으로 닫혀 역류를 막습니다.' });
    dpart(flap, cylZ(0.02, -0.18, 0.18, 10), DC.steel, null);
    dpart(root, pipeAlong('y', 0.16, 0.95, 1.55, 0.675, -0.17, 0.015, true), DC.castL, { ko: '토출 (소기 리시버로)', en: 'Outlet to scavenge receiver', d: '' });
    const on = () => ENGS.aux ? 1 : 0;
    for (let k = 0; k < 3; k++) dflow(root, [[0, 0, 0.5], [0, 0, -0.1], [0.3 * Math.cos(k * 2), 0.3 * Math.sin(k * 2), -0.1], ...arcPts(0, 0, 0.62 + 0.03 * k, k * 115, 360, 14, -0.15).slice(1), [0.675, 0.4, -0.15], [0.675, 1.6, -0.12]], 'air', on, { sp: 0.06, rc: 0.08 });
    let ang = 0, fa = 0;
    return {
      update(st) {
        ang += on() * visRot(1800, st) * 0.5; imp.rotation.z = ang; shaft.rotation.z = ang;
        fa += ((on() ? 1.2 : 0) - fa) * (1 - Math.exp(-st.dt * 3)); flap.rotation.z = fa;
      },
    };
  },
  readouts() {
    return kvRow('상태', ENGS.aux ? '운전' : '정지', 'm0d') + kvRow('소기압', `${((ENGS.ps - TH.pAmb) / 1e5).toFixed(2)} bar g`, 'm0d') + kvRow('기동 / 정지 설정', `${CFG.auxOn} / ${CFG.auxOff} bar g`, 'edu')
      + kvRow('체크밸브', ENGS.aux ? '열림' : '닫힘', 'calc') + kvRow('엔진 부하', `${(SIM.state.load * 100).toFixed(0)} %`);
  },
});
