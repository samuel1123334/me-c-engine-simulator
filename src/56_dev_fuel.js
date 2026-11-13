// ===================================================================
// 56 · 기기 내부 — 연료 공급 계통 (3축 스크루 펌프, 탈기 탱크, 가열기 + 점도계, 전유량 필터, 압력조절밸브)
// ===================================================================
const DC = { cast: 0x56605c, castL: 0x6c7772, steel: 0x9aa3a8, steelD: 0x6e777c, steelL: 0xc3c9cc, brass: 0xc69a45, bronze: 0xa36d3a,
  rubber: 0x24282a, paint: 0x4f6b62, motor: 0x3f6f8f, red: 0xb24a3a, insul: 0xb9b4a6, mesh: 0xb8b2a0, carbon: 0x2d2f30, spring: 0x8fa3b0 };
const FUEL_COLD = 0x9a6a12, FUEL_HOT = 0xffd84a;
const fuelColT = T => { const u = clamp((T - 80) / 70, 0, 1); return new THREE.Color(FUEL_COLD).lerp(new THREE.Color(FUEL_HOT), u); };
const DVS = { pump: 'circ', block: false, grade: 380, fast: false, tscale: 1, swTarget: null, swAnim: 0 };
const timeCtl = () => `<div class="row"><label>계통 시간</label><div class="seg c3" id="dvTs" style="flex:1">${[1, 10, 60].map(k => `<button class="btn${DVS.tscale === k ? ' on' : ''}" data-k="${k}">${k}×</button>`).join('')}</div></div>`;
const bindTime = () => document.querySelectorAll('#dvTs .btn').forEach(b => b.onclick = () => { DVS.tscale = +b.dataset.k; document.querySelectorAll('#dvTs .btn').forEach(x => x.classList.toggle('on', x === b)); });

// ---------------- 3축 스크루 펌프 (공급·순환) ----------------
function threeBorePts(a, R, r, n = 18) {
  const xI = (a * a + R * R - r * r) / (2 * a), yI = Math.sqrt(Math.max(0, R * R - xI * xI));
  const f0 = Math.atan2(yI, xI), p1 = Math.atan2(yI, xI - a), P = [];
  const arc = (cx, rr, b0, b1) => { for (let i = 0; i < n; i++) { const t = b0 + (b1 - b0) * i / n; P.push([cx + rr * Math.cos(t), rr * Math.sin(t)]); } };
  arc(a, r, -p1, p1); arc(0, R, f0, Math.PI - f0); arc(-a, r, Math.PI - p1, Math.PI + p1); arc(0, R, Math.PI + f0, 2 * Math.PI - f0);
  return P;
}
defDevice('screwpump', {
  ko: '3축 스크루 펌프', en: 'Three-screw pump (fuel supply / circulating)', sys: '연료 공급 계통', parts: ['supplypump', 'circpump'],
  principle: `<p>구동 로터(가운데, 오른나사 2줄) 하나가 양쪽 아이들러 로터(왼나사) 둘과 맞물려 돌아갑니다. 나사산과 케이싱 보어 사이에 갇힌 밀폐 공간이 회전과 함께 축 방향으로 이동하므로, 기름이 맥동 없이 흡입실에서 토출실로 밀려 올라갑니다 (용적형 펌프).</p>
  <p>로터 비율은 IMO 형식의 표준 치수 관계(구동 로터 외경 5/3·d, 아이들러 외경 d, 축간 거리 d)로 그렸습니다. 토출 쪽이 막히면 내장 릴리프 밸브가 열려 기름을 흡입실로 되돌립니다.</p>
  <p>계통 압력: 공급 펌프 약 4 bar(탈기 탱크로), 순환 펌프 약 10 bar(가열기 → 필터 → 엔진). 엔진 소비량보다 많이 순환시키고 나머지는 압력조절밸브를 거쳐 탈기 탱크로 돌아옵니다.</p>`,
  sources: [
    { t: 'ref', text: 'MAN B&W S60ME-C Project Guide · Fuel oil system (공급 4 bar, 순환 10 bar)', url: 'https://www.man-es.com/applications/projectguides/2stroke/content/printed/S60ME-C10_5.pdf' },
    { t: 'ref', text: 'IMO 3-screw pump principle (Colfax/IMO AB)', url: 'https://www.imo-pump.com/products/3-screw-pumps' },
    { t: 'edu', text: '로터 길이, 리드, 펌프 용량·효율, 릴리프 설정압은 교육용 가정' }],
  view: { t: [0, 0.35, -0.1], d: [0.45, 0.2, 1], k: 0.78 },
  controls: () => `<div class="seg c2" id="dvPump"><button class="btn${DVS.pump === 'supply' ? ' on' : ''}" data-p="supply">공급 펌프 (4 bar)</button><button class="btn${DVS.pump === 'circ' ? ' on' : ''}" data-p="circ">순환 펌프 (10 bar)</button></div>
    <label class="chk" style="margin-top:8px"><input type="checkbox" id="dvBlock" ${DVS.block ? 'checked' : ''}> 토출 밸브 잠금 (릴리프 밸브 작동 확인)</label>`,
  bind() {
    document.querySelectorAll('#dvPump .btn').forEach(b => b.onclick = () => { DVS.pump = b.dataset.p; document.querySelectorAll('#dvPump .btn').forEach(x => x.classList.toggle('on', x === b)); });
    $('dvBlock').onchange = e => { DVS.block = e.target.checked; };
  },
  build(root) {
    const a = 0.15, Rp = 0.125, rp = 0.075, Ri = 0.075, ri = 0.025, lead = 0.5, y0 = -0.32, y1 = 0.62;
    // 케이싱 (외부 몸체): 흡입실·토출실이 있는 원통 + 측면 노즐
    dpart(root, vesselY(0.36, -0.72, 0.95, 0.04, 0.12, { top: false }), DC.cast, { ko: '펌프 케이싱', en: 'Pump casing', d: '흡입실(아래)과 토출실(위)을 가진 주물 몸체. 로터 인서트를 감싸고 흡입·토출 플랜지가 붙어 있습니다.' });
    dpart(root, ringG(0.2, 0.42, 0.95, 1.01), DC.castL, null);
    // 로터 인서트 (세 개의 보어)
    const ins = extXZ(xzShape(arcPts(0, 0, 0.32, 0, 360, 48).map(p => [p[0], p[1]]), [threeBorePts(a, Rp + 0.003, Ri + 0.003)]), y0, y1);
    dpart(root, ins, DC.bronze, { ko: '로터 인서트 (보어)', en: 'Rotor housing insert', d: '세 로터가 꼭 맞게 들어가는 보어. 로터 나사산과 보어 사이의 작은 틈새가 밀폐 공간을 만듭니다. 틈새가 커지면 내부 누설(역류)로 용적 효율이 떨어집니다.' }, { metal: 0.6 });
    // 로터
    const rot = (cx, rr0, rr1, hand, info, col) => {
      const g = new THREE.Group(); g.position.x = cx; root.add(g);
      const gi = dgroup(g, info); const tr = (rr1 - rr0) / 2, rc = (rr0 + rr1) / 2;
      dadd(gi, cylY(rr0 + 0.004, y0 - 0.02, y1 + 0.02, 28), col);
      [0, Math.PI].forEach(ph => dadd(gi, helixTube(rc, hand * lead, y0, y1, tr * 0.95, ph, 160), col));
      return g;
    };
    const power = rot(0, rp, Rp, 1, { ko: '구동 로터', en: 'Power rotor (drive screw)', d: '모터와 직결된 가운데 로터. 볼록한 2줄 나사가 아이들러를 돌리며, 축 추력은 균형 피스톤이 받아냅니다.' }, DC.steelL);
    const idL = rot(-a, ri, Ri, -1, { ko: '아이들러 로터 (좌)', en: 'Idler rotor', d: '구동 로터와 맞물려 반대 방향으로 도는 오목 나사 로터. 토크를 거의 전달하지 않고 밀폐 역할만 해 마모가 적습니다.' }, DC.steel);
    const idR = rot(a, ri, Ri, -1, { ko: '아이들러 로터 (우)', en: 'Idler rotor', d: '왼쪽 아이들러와 같은 역할. 두 아이들러가 구동 로터의 반경 방향 힘을 서로 상쇄합니다.' }, DC.steel);
    // 축·밸런스 피스톤·기계식 실·커플링·모터
    const shaft = new THREE.Group(); root.add(shaft);
    dpart(shaft, cylY(0.045, y1, 1.42, 24), DC.steelL, { ko: '구동 축', en: 'Drive shaft', d: '모터 토크를 구동 로터로 전달합니다.' });
    dpart(root, ringG(0.05, 0.13, 0.66, 0.74), DC.bronze, { ko: '밸런스 피스톤·부시', en: 'Balance piston', d: '토출압이 로터를 아래로 미는 축 추력을 상쇄하도록 토출압과 흡입압의 차를 받는 피스톤.' });
    const seal = dgroup(root, { ko: '기계식 축 밀봉', en: 'Mechanical seal', d: '회전 링(카본)과 고정 링(실리콘 카바이드)이 스프링으로 밀착해 축 관통부의 누설을 막습니다. 가열 연료(최대 약 150 °C)에 맞는 재질을 씁니다.' });
    dadd(seal, ringG(0.047, 0.1, 0.98, 1.02), DC.carbon); dadd(seal, ringG(0.047, 0.1, 1.02, 1.05), DC.steelL); dadd(seal, springG(0.075, 1.05, 1.13, 4, 0.008), DC.spring);
    dpart(root, ringG(0.05, 0.17, 1.13, 1.2), DC.castL, null);
    dpart(root, ringG(0.17, 0.2, 1.2, 1.5, 28), DC.cast, { ko: '랜턴 브래킷', en: 'Lantern bracket', d: '모터를 펌프 위에 고정하는 중간 하우징. 커플링 점검창이 있습니다.' });
    const cpl = dgroup(shaft, { ko: '커플링', en: 'Flexible coupling', d: '모터 축과 펌프 축의 미세한 축 어긋남을 흡수하는 탄성 커플링.' });
    dadd(cpl, cylY(0.1, 1.3, 1.37, 24), DC.steelD); dadd(cpl, cylY(0.1, 1.39, 1.46, 24), DC.steelD); dadd(cpl, cylY(0.07, 1.37, 1.39, 12), DC.rubber);
    const mot = dgroup(root, { ko: '전동기', en: 'Electric motor', d: '보통 4극 유도전동기(약 1750 r/min @60 Hz). 공급·순환 펌프는 각각 두 대씩 두어 한 대는 대기(자동 절환)합니다.' });
    dadd(mot, vesselY(0.24, 1.5, 2.15, 0.03, 0.06, { bot: false }), DC.motor);
    for (let i = 0; i < 16; i++) { const ang = i / 16 * Math.PI * 2; dadd(mot, box(0.03, 0.55, 0.02, 0.255 * Math.cos(ang), 1.82, 0.255 * Math.sin(ang), 0.004).rotateY(0), DC.motor); }
    const rotor = new THREE.Group(); root.add(rotor);
    dpart(rotor, cylY(0.16, 1.58, 2.02, 28), 0x8b6a3e, { ko: '회전자 (농형)', en: 'Squirrel-cage rotor', d: '고정자 회전자계에 끌려 도는 농형 회전자.' });
    dpart(root, ringG(0.165, 0.21, 1.58, 2.02, 28), 0x7a5a2e, { ko: '고정자 권선', en: 'Stator winding', d: '3상 교류가 흐르며 회전자계를 만듭니다.' }, { metal: 0.3 });
    dpart(rotor, cylY(0.045, 1.46, 2.12, 16), DC.steelL, null);
    // 흡입·토출 노즐
    dpart(root, pipeAlong('x', 0.11, -0.95, -0.3, -0.5, 0, 0.015, true), DC.castL, { ko: '흡입구', en: 'Suction inlet', d: '탱크에서 기름이 들어오는 입구. 흡입 쪽 압력이 너무 낮으면 가열 연료의 가스가 분리되어 캐비테이션이 생깁니다.' });
    dpart(root, pipeAlong('x', 0.1, 0.3, 0.95, 0.82, 0, 0.015, true), DC.castL, { ko: '토출구', en: 'Discharge outlet', d: '로터 위쪽 토출실에서 압력이 오른 기름이 나갑니다.' });
    // 내장 릴리프 밸브: 토출실 → 흡입실 바이패스
    const rv = new THREE.Group(); rv.position.set(-0.45, 0.2, 0); root.add(rv);
    dpart(rv, vesselY(0.08, -0.5, 0.48, 0.015, 0.03), DC.castL, { ko: '릴리프 밸브 몸체', en: 'Relief valve body', d: '토출실과 흡입실을 잇는 우회 통로. 토출 쪽이 막히면 열려서 펌프와 배관을 보호합니다.' });
    const rvP = dpart(rv, lathe([[0, -0.32], [0.05, -0.27], [0.05, -0.2], [0.02, -0.18], [0, -0.18]]), DC.steelL, { ko: '릴리프 포핏', en: 'Relief poppet', d: '스프링 힘보다 토출압 × 시트 면적이 커지면 들립니다.' });
    const rvS = dpart(rv, springG(0.045, -0.18, 0.3, 7, 0.009), DC.spring, { ko: '릴리프 스프링', en: 'Relief spring', d: '설정압을 정하는 압축 스프링. 위쪽 조정 나사로 조정합니다.' });
    dpart(rv, cylY(0.02, 0.3, 0.6, 12), DC.steelL, null);
    dpart(root, pipeAlong('x', 0.035, -0.37, -0.29, 0.75, 0, 0.008), DC.castL, null);
    dpart(root, pipeAlong('x', 0.035, -0.37, -0.29, -0.15, 0, 0.008), DC.castL, null);
    // 유체 공간
    dfluid(root, cylY(0.315, -0.7, y0, 32), 'fuel', 0.16);
    dfluid(root, cylY(0.315, y1, 0.95, 32), 'fuel', 0.2);
    // 게이지
    const gS = dgauge(root, -0.72, -0.28, 0.02, 0.1, '흡입', -1, 3, 'bar', { ko: '흡입 압력계', en: 'Suction gauge', d: '흡입 압력(진공 포함).' });
    const gD = dgauge(root, 0.72, 1.08, 0.02, 0.1, '토출', 0, 16, 'bar', { ko: '토출 압력계', en: 'Discharge gauge', d: '토출 압력. 공급 펌프 약 4 bar, 순환 펌프 약 10 bar.' });
    dpart(root, cylY(0.012, 0.9, 1.0, 8).translate(0.72, 0, 0), DC.steel, null);
    // 유동
    const fl = () => DVS.block ? 0 : 1, rl = () => DVS.block ? 1 : 0;
    dflow(root, [[-1.0, -0.5, -0.02], [-0.3, -0.5, -0.02], [-0.05, -0.5, -0.02], [-0.05, y0 - 0.02, -0.02]], 'fuel', fl, { sp: 0.05 });
    const hel = (cx, r, hand, ph) => dflow(root, [[cx + r * Math.cos(ph), -0.6, r * Math.sin(ph)], ...helixPts(cx, 0, r, y0, y1, hand * lead, ph, 70), [cx * 0.6, 0.85, -0.04], [0.35, 0.82, -0.02], [1.0, 0.82, -0.02]], 'fuel', st => fl(st) + 0.02, { sp: 0.05, rc: 0.02 });
    hel(0, 0.1, 1, -Math.PI / 2); hel(0, 0.1, 1, Math.PI / 2 + 0.3); hel(-a, 0.05, -1, -2); hel(a, 0.05, -1, -1.2);
    dflow(root, [[0.2, 0.82, -0.03], [-0.29, 0.75, -0.03], [-0.45, 0.75, -0.03], [-0.45, -0.1, -0.03], [-0.45, -0.15, -0.03], [-0.29, -0.15, -0.03], [-0.1, -0.5, -0.03]], 'fuel', rl, { sp: 0.05 });
    let ang = 0, lift = 0;
    return {
      update(st) {
        const on = !DVS.block;
        ang += visRot(1750, st) * 0.6;
        power.rotation.y = ang; idL.rotation.y = -ang; idR.rotation.y = -ang; shaft.rotation.y = ang; rotor.rotation.y = ang;
        const S = DVS.pump === 'supply' ? { ps: 0.4, pd: 4 } : { ps: 3.6, pd: 10 }, pRel = S.pd * 1.6;
        lift += ((on ? 0 : 1) - lift) * (1 - Math.exp(-st.dt * 6));
        rvP.position.y = lift * 0.07; rvS.scale.y = 1 - lift * 0.07 / 0.48; rvS.position.y = 0.3 * (1 - rvS.scale.y);
        gS.set(S.ps); gD.set(on ? S.pd : pRel);
        this.p = { ...S, pRel, lift };
      },
    };
  },
  readouts() {
    const sup = DVS.pump === 'supply', Q = sup ? 0.6 * FSP.Qcirc : FSP.Qcirc, dp = sup ? 4 - 0.4 : FSP.pCirc - FSP.pSupply, V = Q / FSP.rho;
    return kvRow('펌프', sup ? '공급 펌프' : '순환 펌프') + kvRow('회전수', '1750 r/min', 'edu') + kvRow('흡입 → 토출', sup ? '0.4 → 4.0 bar' : '3.6 → 10.0 bar', 'ref')
      + kvRow('유량', DVS.block ? '0 (릴리프 순환)' : `${(V * 3600).toFixed(1)} m³/h`, 'edu') + kvRow('축 동력', `${(V * dp * 1e5 / 0.7 / 1000).toFixed(1)} kW`, 'calc')
      + kvRow('엔진 소비 연료', `${(fuelConsumption() * 3600).toFixed(0)} kg/h`, 'm0d') + kvRow('릴리프 밸브', DVS.block ? '열림 (설정압)' : '닫힘', 'calc');
  },
});

// ---------------- 탈기·혼합 탱크 (Venting box) ----------------
defDevice('ventbox', {
  ko: '탈기·혼합 탱크', en: 'Venting box (deaerating tank)', sys: '연료 공급 계통', parts: ['ventbox'],
  principle: `<p>엔진에서 돌아온 뜨거운 복귀 연료와 공급 펌프가 보내는 보충 연료가 섞이는 작은 압력 탱크입니다. 복귀 연료에는 가열 중 분리된 가스·증기가 섞여 있어, 이 탱크에서 위로 떠올라 상부에 모입니다.</p>
  <p>가스가 모이면 액면이 내려가고 플로트가 함께 내려가 상부 배기 밸브를 엽니다. 가스가 서비스 탱크로 빠져나가면 액면이 다시 올라 밸브를 닫습니다. 순환 펌프는 탱크 바닥에서 가스가 빠진 연료를 빨아갑니다.</p>`,
  sources: [
    { t: 'ref', text: 'MAN B&W Project Guide · Fuel oil system: venting box, automatic de-aerating valve', url: 'https://www.man-es.com/applications/projectguides/2stroke/content/printed/S60ME-C10_5.pdf' },
    { t: 'edu', text: '탱크 크기, 플로트 밸브 형식, 가스 발생량·배기 주기는 교육용 가정' }],
  view: { t: [0, 0.5, -0.1], d: [0.3, 0.15, 1], k: 0.8 },
  build(root) {
    dpart(root, vesselY(0.42, -0.8, 1.3, 0.025, 0.2), DC.paint, { ko: '탱크 몸체', en: 'Tank shell', d: '압력 용기. 공급 펌프 압력(약 4 bar)이 걸려 있어 가열 연료가 끓지 않게 합니다.' });
    const lev = dfluid(root, cylY(0.39, -0.6, 1.0, 40), 'fuel', 0.22);
    const gas = dfluid(root, cylY(0.39, 0.9, 1.08, 40), 'gas', 0.12);
    dpart(root, pipeAlong('x', 0.06, -0.95, -0.42, 0.75, 0, 0.012, true), DC.steelD, { ko: '보충 연료 입구', en: 'Supply inlet (from supply pump)', d: '서비스 탱크에서 공급 펌프로 들어온 연료. 양은 엔진 소비량과 같습니다.' });
    dpart(root, pipeAlong('x', 0.07, 0.42, 0.95, 0.35, 0, 0.012, true), DC.steelD, { ko: '엔진 복귀 입구', en: 'Return inlet (from PCV)', d: '엔진을 돌고 압력조절밸브를 지나온 복귀 연료. 가스와 증기가 섞여 있습니다.' });
    dpart(root, pipeAlong('y', 0.07, -1.25, -0.78, 0, 0, 0.012, true), DC.steelD, { ko: '출구 (순환 펌프로)', en: 'Outlet to circulating pumps', d: '탱크 바닥에서 가스가 빠진 연료를 순환 펌프가 빨아갑니다.' });
    dpart(root, ringG(0.08, 0.1, 0.3, 0.85, 24).translate(0.2, 0, -0.05), DC.steel, { ko: '복귀관 침지관', en: 'Return dip pipe (baffle)', d: '복귀 연료를 액면 아래 위쪽으로 내보내 가스가 바로 떠오르게 하고, 출구로 직접 흘러가지 않게 막는 칸막이 역할.' });
    // 상부 자동 배기 밸브
    const vv = new THREE.Group(); vv.position.y = 1.3; root.add(vv);
    dpart(vv, vesselY(0.14, 0.0, 0.5, 0.015, 0.05, { bot: false }), DC.castL, { ko: '자동 배기 밸브 몸체', en: 'Automatic de-aerating valve', d: '탱크 최상부에 붙은 플로트식 밸브. 가스가 모이면 열려 서비스 탱크로 내보냅니다.' });
    dpart(vv, ringG(0.03, 0.15, -0.04, 0.02), DC.castL, null);
    const float = dpart(vv, sphere(0.085, 0, 0.17, 0), DC.steelL, { ko: '플로트', en: 'Float', d: '연료에 떠 있는 구. 액면이 내려가면 함께 내려가 레버로 배기 니들을 엽니다.' });
    const ndl = dpart(vv, lathe([[0, 0.38], [0.012, 0.4], [0.012, 0.5], [0, 0.5]]), DC.steelL, { ko: '배기 니들·시트', en: 'Vent needle & seat', d: '작은 오리피스를 여닫는 니들. 기름이 새지 않고 가스만 빠지도록 플로트가 위에서 닫습니다.' });
    dpart(vv, cylY(0.006, 0.25, 0.38, 6), DC.steelL, null);
    dpart(vv, pipeAlong('y', 0.025, 0.5, 0.75, 0, 0, 0.006), DC.steelD, { ko: '배기관 (서비스 탱크로)', en: 'Vent pipe to service tank', d: '분리된 가스와 소량의 연료를 서비스 탱크 상부로 보냅니다.' });
    // 액면계
    const lg = new THREE.Group(); lg.position.set(-0.52, 0, 0.0); root.add(lg);
    dpart(lg, ringG(0.022, 0.03, -0.5, 1.15, 16), DC.steelL, { ko: '액면계', en: 'Level gauge', d: '탱크 액면을 보여 주는 유리관.' }, { opacity: 0.35, nocut: true });
    const lgFill = dfluid(lg, cylY(0.02, -0.5, 1.0, 12), 'fuel', 0.6);
    // 유동
    dflow(root, [[-1.0, 0.75, -0.03], [-0.38, 0.75, -0.03], [-0.25, 0.55, -0.05], [-0.1, -0.2, -0.05], [0, -0.6, -0.03], [0, -1.3, -0.03]], 'fuel', () => fuelConsumption() / 0.6 + 0.05, { sp: 0.06 });
    dflow(root, [[1.0, 0.35, -0.05], [0.2, 0.35, -0.05], [0.2, 0.86, -0.05], [0.05, 0.75, -0.05], [-0.05, 0.1, -0.05], [0, -0.6, -0.04], [0, -1.3, -0.04]], 'fuel', () => 0.8, { sp: 0.06, colorFn: lerpC(0xffd84a, 0xd9a52b) });
    const bubbles = [];
    for (let i = 0; i < 4; i++) bubbles.push(dflow(root, [[0.2 + (i - 1.5) * 0.06, 0.82, -0.04 - i * 0.02], [0.18 + (i - 1.5) * 0.12, 1.0, -0.05 - i * 0.02], [0.05, 1.22, -0.03], [0, 1.45, -0.02], [0, 1.85, -0.02]], 'gas', () => 0.6, { sp: 0.16, size: 0.05, jitter: 0.05 }));
    let gasV = 0, open = 0;
    return {
      update(st) {
        // 가스 누적 → 액면 하강 → 플로트 하강 → 밸브 개방 → 가스 배출 (이력 있는 순환)
        gasV += st.dtVis * 0.06 * (0.3 + st.load); if (open) gasV -= st.dtVis * 0.35;
        if (gasV > 1) open = 1; if (gasV <= 0.05) { open = 0; gasV = Math.max(0, gasV); }
        const L = 1.0 - gasV * 0.12;
        lev.scale.y = (L + 0.6) / 1.6; lev.position.y = -0.6 * (1 - lev.scale.y);
        gas.position.y = L - 0.9 - 0.02; gas.scale.y = 1 + gasV * 0.4;
        lgFill.scale.y = lev.scale.y; lgFill.position.y = lev.position.y;
        float.position.y = -gasV * 0.08; ndl.position.y = open ? -0.03 : 0;
        bubbles.forEach(b => b.obj.visible = true);
        this.s = { gasV, open, L };
      },
    };
  },
  readouts() {
    const s = DV.api.s || { gasV: 0, open: 0 };
    return kvRow('탱크 압력', `${FSP.pSupply.toFixed(1)} bar`, 'ref') + kvRow('보충 유량 (= 소비)', `${(FSS.supply * 3600).toFixed(0)} kg/h`, 'm0d')
      + kvRow('엔진 복귀 유량', `${(FSS.ret * 3600).toFixed(0)} kg/h`, 'calc') + kvRow('혼합 온도', `${FSS.Tin.toFixed(1)} °C`, 'calc')
      + kvRow('상부 가스 체적', `${(s.gasV * 100).toFixed(0)} %`, 'edu') + kvRow('배기 밸브', s.open ? '열림 (가스 배출)' : '닫힘', 'edu');
  },
});

// ---------------- 연료 가열기 + 점도계 + 증기 조절밸브 + 트랩 ----------------
defDevice('heater', {
  ko: '연료 가열기 · 점도 제어', en: 'Steam fuel heater & viscosity control', sys: '연료 공급 계통', parts: ['heater', 'visco', 'trap'],
  principle: `<p>쉘·튜브식 증기 가열기입니다. 증기는 U자 관 다발 안을 흐르며 응축하면서 잠열을 내고, 연료는 쉘 쪽에서 칸막이(배플)를 지그재그로 돌며 관 다발을 가로질러 데워집니다. 응축수는 관 아래쪽 출구로 모여 플로트식 증기 트랩을 통해서만 빠져나갑니다 (증기는 못 빠져나감).</p>
  <p>출구 배관의 점도계(진동식)가 실제 점도를 재고, PI 제어기가 증기 조절밸브 개도를 바꿔 엔진 입구 점도를 약 13 cSt로 유지합니다. 연료가 더 끈끈해지면 밸브가 더 열려 온도를 올립니다. 아래에서 연료 등급을 바꿔 제어 응답을 볼 수 있습니다.</p>
  <p>점도는 Walther 식(ASTM D341)으로 온도에서 계산합니다: 380 cSt@50 °C 연료는 약 140 °C에서 13 cSt.</p>`,
  sources: [
    { t: 'ref', text: 'MAN B&W Project Guide · Fuel oil system: 엔진 입구 점도 10–15 cSt(권장 약 13 cSt), 가열기·점도계', url: 'https://www.man-es.com/applications/projectguides/2stroke/content/printed/S60ME-C10_5.pdf' },
    { t: 'ref', text: 'ASTM D341 Walther viscosity–temperature relation' },
    { t: 'ref', text: 'Viscosity sensor (torsional oscillation, e.g. VAF ViscoSense)', url: 'https://www.vaf.nl/products/viscosense3/' },
    { t: 'edu', text: '증기 압력 7 bar g, NTU, 시정수, PI 이득, 쉘/튜브 배치는 교육용 가정' }],
  view: { t: [0.1, 0.1, -0.1], d: [0.25, 0.35, 1], k: 0.74 },
  controls: () => `<div class="row"><label>등급 cSt@50°C</label><div class="seg c3" id="dvGrade" style="flex:1">${[180, 380, 700].map(v => `<button class="btn${DVS.grade === v ? ' on' : ''}" data-v="${v}">${v}</button>`).join('')}</div></div>${timeCtl()}
    <p class="empty" style="margin:6px 0 0;font-size:11.5px">등급을 바꾸면 같은 온도에서 점도가 달라져 제어기가 증기량을 다시 맞춥니다. 시정수가 수십 초라 계통 시간을 10× 이상으로 보면 응답이 잘 보입니다.</p>`,
  bind() {
    document.querySelectorAll('#dvGrade .btn').forEach(b => b.onclick = () => { DVS.grade = +b.dataset.v; FSP.v50 = DVS.grade; document.querySelectorAll('#dvGrade .btn').forEach(x => x.classList.toggle('on', x === b)); });
    bindTime();
  },
  build(root) {
    const x0 = -0.9, x1 = 0.95, R = 0.34, tR = 0.022;
    // 쉘 (X축) + 보온
    const shell = vesselY(R, x0, x1, 0.022, 0.16, { bot: false }); shell.rotateZ(-Math.PI / 2);
    dpart(root, shell, DC.paint, { ko: '쉘 (연료 측)', en: 'Shell (fuel side)', d: '연료가 흐르는 바깥 동체. 보온재로 감싸 열손실을 줄입니다.' });
    const ins = ringX(R + 0.005, R + 0.045, x0 + 0.05, x1 - 0.12, 40); dpart(root, ins, DC.insul, { ko: '보온재', en: 'Insulation', d: '' , label: false }, { metal: 0, rough: 0.9 });
    // 관판·채널 헤드
    dpart(root, cylX(R + 0.03, x0 - 0.04, x0, 40), DC.steelD, { ko: '관판', en: 'Tube sheet', d: 'U자관 양 끝이 확관·용접된 두꺼운 판. 증기 측과 연료 측을 나눕니다.' });
    const ch = vesselY(R, x0 - 0.42, x0 - 0.04, 0.02, 0.14, { top: false }); ch.rotateZ(-Math.PI / 2);
    dpart(root, ch, DC.castL, { ko: '채널 헤드 (증기 측)', en: 'Channel head', d: '증기 입구실(위)과 응축수 출구실(아래)로 나뉜 헤드. 가운데 칸막이가 두 방을 나눕니다.' });
    dpart(root, box(0.36, 0.025, 2 * R - 0.03, x0 - 0.22, 0, -0.0, 0.005), DC.steelD, { ko: '패스 칸막이', en: 'Pass partition', d: '증기가 위쪽 관으로 들어가 U자 끝을 돌아 아래쪽 관으로 나오게 합니다.' });
    // U자관 다발 (절단면 근처의 관만 그림)
    const tubes = dgroup(root, { ko: 'U자 전열관 다발', en: 'U-tube bundle (steam inside)', d: '관 안에서 증기가 응축하며 열을 냅니다. U자 형태라 열팽창을 자유롭게 흡수합니다.' }, { anchor: [0.2, 0.06, -0.05] });
    const tubeMats = [];
    const rows = [0.06, 0.12, 0.18, 0.24];
    rows.forEach((yy, i) => {
      [-0.03, -0.11, -0.19].forEach((zz, j) => {
        const xr = x1 - 0.22 - i * 0.045;
        const rt = new Route([V3(x0, yy, zz), V3(xr, yy, zz), V3(xr + yy * 0.9, 0, zz), V3(xr, -yy, zz), V3(x0, -yy, zz)].map(v => v), yy * 0.95);
        const m = dadd(tubes, tubeG(rt, tR, 10), DC.bronze); tubeMats.push(m.material);
      });
    });
    // 배플
    const bfx = [-0.55, -0.15, 0.25, 0.6];
    bfx.forEach((bx, i) => {
      const up = i % 2 === 0, s = new THREE.Shape(); const rr = R - 0.02, cut = up ? -0.1 : 0.1;
      const pts = []; for (let k = 0; k <= 40; k++) { const t = k / 40 * Math.PI * 2; const y = rr * Math.sin(t), z = rr * Math.cos(t); pts.push([z, up ? Math.min(y, 0.2) : Math.max(y, -0.2)]); }
      const g = extXY(shapeOf(pts), -0.012, 0.012); g.rotateY(Math.PI / 2); g.translate(bx, 0, 0);
      dpart(root, g, DC.steelD, i === 1 ? { ko: '배플 (칸막이)', en: 'Segmental baffles', d: '쉘 안 연료를 지그재그로 흐르게 해 관 다발을 여러 번 가로지르게 하고 관을 지지합니다. 유속이 올라가 열전달이 좋아집니다.' } : null);
    });
    // 노즐
    dpart(root, pipeAlong('y', 0.075, R - 0.02, R + 0.28, x1 - 0.2, 0, 0.012, true), DC.steelD, { ko: '연료 입구', en: 'Fuel inlet', d: '순환 펌프에서 온 약 120 °C 연료.' });
    dpart(root, pipeAlong('y', 0.075, -R + 0.02, -R - 0.12, x0 + 0.15, 0, 0.012, false), DC.steelD, { ko: '연료 출구', en: 'Fuel outlet', d: '가열된 연료가 점도계와 필터를 거쳐 엔진으로 갑니다.' });
    dpart(root, pipeAlong('y', 0.06, 0.18, 0.62, x0 - 0.24, 0, 0.012, false), DC.steel, { ko: '증기 입구', en: 'Steam inlet', d: '약 7 bar g 포화 증기 (약 170 °C).' });
    dpart(root, pipeAlong('y', 0.035, -0.18, -0.6, x0 - 0.24, 0, 0.008, false), DC.steel, { ko: '응축수 출구', en: 'Condensate outlet', d: '' , label: false });
    // 증기 조절밸브 (공압 다이어프램 + 글로브 밸브)
    const sv = new THREE.Group(); sv.position.set(x0 - 0.24, 0.72, 0); root.add(sv);
    dpart(sv, sphere(0.1, 0, 0, 0).scale(1.3, 1, 1), DC.castL, { ko: '증기 조절밸브', en: 'Steam control valve', d: '점도 제어기의 출력(4–20 mA → 공기압)으로 플러그를 올려 증기량을 조절합니다.' });
    dpart(sv, pipeAlong('x', 0.045, -0.5, -0.12, 0, 0, 0.01, true), DC.steel, null);
    const plug = dpart(sv, lathe([[0, -0.06], [0.04, -0.03], [0.04, 0.02], [0.012, 0.03], [0.012, 0.3], [0, 0.3]]), DC.steelL, { ko: '밸브 플러그', en: 'Valve plug & stem', d: '들림 양 = 개도. 개도가 클수록 증기 유량이 늘어납니다.' });
    dpart(sv, cylY(0.016, 0.08, 0.32, 8).translate(0.08, 0, 0), DC.steelD, null);
    dpart(sv, cylY(0.016, 0.08, 0.32, 8).translate(-0.08, 0, 0), DC.steelD, null);
    dpart(sv, lathe([[0, 0.3], [0.17, 0.3], [0.17, 0.36], [0.12, 0.42], [0, 0.42]]), DC.motor, { ko: '공압 액추에이터', en: 'Pneumatic diaphragm actuator', d: '다이어프램에 걸리는 제어 공기압과 스프링 힘의 평형으로 플러그 위치가 정해집니다.' });
    // 증기 트랩 (볼 플로트)
    const tp = new THREE.Group(); tp.position.set(x0 - 0.24, -0.72, 0); root.add(tp);
    dpart(tp, vesselY(0.12, -0.12, 0.12, 0.015, 0.05), DC.castL, { ko: '증기 트랩 (볼 플로트식)', en: 'Ball-float steam trap', d: '응축수가 고이면 볼 플로트가 떠올라 출구를 열고, 증기만 남으면 가라앉아 닫습니다. 증기 손실 없이 응축수만 배출합니다.' });
    const ball = dpart(tp, sphere(0.06, 0.02, -0.02, -0.01), DC.steelL, { ko: '볼 플로트', en: 'Float', d: '응축수 수위에 따라 오르내리며 배출구를 여닫습니다.' });
    const trW = dfluid(tp, cylY(0.1, -0.11, -0.03, 20), 'water', 0.35);
    dpart(tp, pipeAlong('x', 0.025, 0.1, 0.5, -0.08, 0, 0.006), DC.steel, null);
    // 점도계 (출구 배관)
    const vs = new THREE.Group(); vs.position.set(x0 + 0.15, -0.72, 0); root.add(vs);
    dpart(vs, pipeAlong('x', 0.075, -0.0, 1.35, 0, 0, 0.012, false), DC.steelD, null);
    dpart(vs, cylX(0.075, -0.09, -0.0, 24).translate(0, 0, 0), DC.steelD, null);
    dpart(vs, vesselY(0.11, 0.0, 0.3, 0.015, 0.03, { bot: false }).translate(0.55, 0, 0), DC.castL, { ko: '점도계 측정실', en: 'Viscosity sensor housing', d: '연료가 지나가는 측정 배관에 센서 축이 꽂혀 있습니다.' });
    const bob = new THREE.Group(); bob.position.x = 0.55; vs.add(bob);
    dpart(bob, cylY(0.01, -0.05, 0.36, 10), DC.steelL, null);
    dpart(bob, cylY(0.035, -0.06, 0.04, 20), DC.steelL, { ko: '진동 감지 요소', en: 'Torsional oscillating element', d: '축이 일정 진폭으로 비틀림 진동하도록 구동되며, 기름의 점성이 진동을 감쇠시킵니다. 감쇠량(= 구동 전력)으로 동점도를 계산합니다 (온도 보정 포함).' });
    dpart(vs, box(0.2, 0.14, 0.14, 0.55, 0.42, 0, 0.02), DC.motor, { ko: '센서 전자부', en: 'Transmitter', d: '진동 구동·검출 회로. 점도와 온도를 4–20 mA로 제어기에 보냅니다.' });
    const ctl = dpart(root, box(0.36, 0.3, 0.1, 0, 0, 0, 0.02), DC.steelD, { ko: '점도 제어기 (PI)', en: 'Viscosity controller', d: '설정 점도와 측정 점도의 차이를 비례·적분 연산해 증기 조절밸브 개도를 내보냅니다. 기동 시에는 온도 제어로 시작해 점도 제어로 넘어갑니다.' }, { nocut: true });
    ctl.position.set(0.55, -0.62, 0.05);
    // 유체 공간
    dfluid(root, cylX(R - 0.024, x0, x1 - 0.15, 40), 'fuel', 0.1);
    // 게이지
    const gTi = dgauge(root, x1 - 0.2, R + 0.42, 0.02, 0.085, '입구', 50, 200, '°C', { ko: '입구 온도계', en: 'Inlet thermometer', d: '' });
    const gTo = dgauge(root, x0 + 0.4, -R - 0.15, 0.05, 0.085, '출구', 50, 200, '°C', { ko: '출구 온도계', en: 'Outlet thermometer', d: '' });
    // 유동: 연료 지그재그 (입구 → 배플 → 출구), 색은 온도
    const zig = [[x1 - 0.2, R + 0.3, -0.02], [x1 - 0.2, 0.2, -0.05]];
    [0.6, 0.25, -0.15, -0.55].forEach((bx, i) => { const yy = i % 2 === 0 ? -0.24 : 0.24; zig.push([bx + 0.12, yy, -0.06]); zig.push([bx - 0.12, yy, -0.06]); });
    zig.push([x0 + 0.15, -0.2, -0.05], [x0 + 0.15, -0.72, -0.02], [x0 + 1.5, -0.72, -0.02]);
    const fuelFlow = dflow(root, zig, 'fuel', () => 1, { sp: 0.05, rc: 0.1, colorFn: u => fuelColT(lerp(FSS.Tin, FSS.Tout, clamp(u * 1.25, 0, 1))) });
    dflow(root, [[x0 - 0.24, 0.95, -0.02], [x0 - 0.24, 0.12, -0.05], [x0, 0.12, -0.05], [x1 - 0.32, 0.12, -0.08], [x1 - 0.22, 0, -0.08], [x1 - 0.32, -0.12, -0.08], [x0, -0.12, -0.05], [x0 - 0.24, -0.12, -0.05], [x0 - 0.24, -0.72, -0.02], [x0 - 0.24 + 0.5, -0.8, -0.02]], 'steam', () => FSS.y * 1.4, { sp: 0.06, colorFn: u => new THREE.Color(FLC.steam).lerp(new THREE.Color(FLC.water), smooth01((u - 0.45) / 0.3)) });
    let osc = 0;
    return {
      update(st) {
        plug.position.y = FSS.y * 0.05;
        const hot = new THREE.Color(DC.bronze).lerp(new THREE.Color(0xff7a3a), FSS.y * 0.55);
        tubeMats.forEach(m => m.color.copy(hot));
        gTi.set(FSS.Tin); gTo.set(FSS.Tout);
        ball.position.y = clamp(FSS.cond * 3600 / 300, 0, 1) * 0.04;
        osc += st.dtVis * 2 * Math.PI * 1.6; bob.rotation.y = Math.sin(osc) * 0.5 * Math.min(1, 6 / Math.sqrt(FSS.visc * 3));
      },
    };
  },
  readouts() {
    const err = FSS.visc - FSP.viscSet;
    return kvRow('입구 온도', `${FSS.Tin.toFixed(1)} °C`, 'calc') + kvRow('출구 온도', `${FSS.Tout.toFixed(1)} °C`, 'calc')
      + kvRow('측정 점도 / 설정', `${FSS.visc.toFixed(1)} / ${FSP.viscSet} cSt`, 'calc') + kvRow('제어 편차', `${err >= 0 ? '+' : ''}${err.toFixed(2)} cSt`, 'calc')
      + kvRow('증기 밸브 개도', `${(FSS.y * 100).toFixed(0)} %`, 'calc') + kvRow('가열량', `${(FSS.Q / 1000).toFixed(0)} kW`, 'calc')
      + kvRow('증기 소비 (= 응축수)', `${(FSS.steam * 3600).toFixed(0)} kg/h`, 'calc') + kvRow('증기 (7 bar g)', `${FSP.Tsteam.toFixed(0)} °C`, 'ref')
      + kvRow('연료 순환량', `${(FSP.Qcirc * 3.6).toFixed(1)} t/h`, 'edu') + kvRow('목표 온도 (13 cSt)', `${FUEL.tempFor(FSP.viscSet).toFixed(0)} °C`, 'calc');
  },
});

// ---------------- 연료 전유량 필터 (복식, 수동 전환) ----------------
defDevice('ffilter', {
  ko: '연료 전유량 필터', en: 'Fuel full-flow filter (duplex)', sys: '연료 공급 계통', parts: ['ffilter'],
  principle: `<p>엔진으로 가는 연료 전부가 지나가는 마지막 필터입니다. 같은 필터실 두 개(A·B)가 있고 위·아래 전환 콕이 연동되어 한쪽만 씁니다. 연료는 엘리먼트 바깥(오염 측)에서 안쪽(청정 측)으로 흐르고, 걸러진 입자는 엘리먼트 바깥면에 쌓입니다.</p>
  <p>오염이 쌓이면 차압(입구−출구 압력차)이 올라가고, 경보값에 이르면 운전 중에 다른 쪽으로 전환한 뒤 막힌 쪽 엘리먼트를 꺼내 청소합니다. 차압은 점도에도 비례하므로 연료가 덜 데워져도 오릅니다.</p>`,
  sources: [
    { t: 'ref', text: 'MAN B&W Project Guide · Fuel oil system: full-flow filter before engine (duplex, 수동 전환)', url: 'https://www.man-es.com/applications/projectguides/2stroke/content/printed/S60ME-C10_5.pdf' },
    { t: 'edu', text: '눈 크기 50 µm, 차압 모델(점도 × 유량 × 막힘), 경보값 0.6 bar, 막힘 속도는 교육용 가정' }],
  view: { t: [0, 0.2, -0.1], d: [0.2, 0.3, 1], k: 0.78 },
  controls: () => `<div class="seg c2"><button class="btn" id="dvSw">A ↔ B 전환</button><button class="btn" id="dvClean">대기 쪽 청소</button></div>
    <label class="chk" style="margin-top:8px"><input type="checkbox" id="dvFast" ${DVS.fast ? 'checked' : ''}> 오염 가속 (×200)</label>${timeCtl()}`,
  bind() {
    $('dvSw').onclick = () => { if (DVS.swTarget == null) DVS.swTarget = 1 - FSS.side; };
    $('dvClean').onclick = () => { FSS.clog[1 - FSS.side] = 0.02; };
    $('dvFast').onchange = e => { DVS.fast = e.target.checked; FSP.clogRate = DVS.fast ? 200 / 7200 : 1 / 7200; };
    bindTime();
  },
  build(root) {
    const X = [-0.45, 0.45], H = [], dirt = [], elems = [];
    X.forEach((x, k) => {
      const g = new THREE.Group(); g.position.x = x; root.add(g); H.push(g);
      const nm = k ? 'B' : 'A';
      dpart(g, vesselY(0.3, -0.85, 0.75, 0.02, 0.14, { top: false }), DC.paint, { ko: `필터실 ${nm}`, en: `Filter chamber ${nm}`, d: '엘리먼트를 담는 압력 용기. 아래에 배유 콕, 위 커버에 공기 빼기 콕이 있습니다.' });
      dpart(g, cylY(0.34, 0.75, 0.83, 40), DC.castL, { ko: `커버 ${nm}`, en: 'Cover', d: '엘리먼트 교체 시 여는 덮개.', label: false });
      dpart(g, boltsY(8, 0.31, 0.72, 0.84, 0.012), DC.steelD, null);
      // 별 모양(주름) 엘리먼트
      const pl = []; const n = 28; for (let i = 0; i <= n * 2; i++) { const a = i / (n * 2) * Math.PI * 2, r = i % 2 ? 0.18 : 0.21; pl.push([r * Math.cos(a), r * Math.sin(a)]); }
      const pin = []; for (let i = 0; i <= n * 2; i++) { const a = i / (n * 2) * Math.PI * 2, r = i % 2 ? 0.158 : 0.188; pin.push([r * Math.cos(a), r * Math.sin(a)]); }
      const el = extXZ(shapeOf(pl, [pin]), -0.6, 0.55);
      elems.push(dpart(g, el, DC.mesh, { ko: `필터 엘리먼트 ${nm}`, en: 'Pleated mesh element', d: '스테인리스 철망(교육용 50 µm)을 주름지게 접어 여과 면적을 넓힌 엘리먼트. 바깥면에 오염이 쌓입니다.' }, { metal: 0.7, rough: 0.6 }));
      dpart(g, ringG(0.07, 0.085, -0.85, 0.6, 20), DC.steelL, k ? null : { ko: '청정 측 중심관', en: 'Perforated centre tube', d: '여과된 연료가 모여 아래 출구로 내려가는 구멍 뚫린 지지관.' });
      dpart(g, ringG(0.08, 0.23, -0.64, -0.6), DC.steelD, null); dpart(g, ringG(0.08, 0.23, 0.55, 0.59), DC.steelD, null);
      dirt.push(dpart(g, ringG(0.212, 0.24, -0.58, 0.53, 40), DC.carbon, k ? null : { ko: '쌓인 오염물', en: 'Filter cake', d: '연료 속 촉매 미립자(Al·Si), 슬러지, 녹 등. 두께가 늘수록 차압이 오릅니다.' }, { metal: 0, rough: 1 }));
      dfluid(g, cylY(0.275, -0.75, 0.73, 32), 'fuel', 0.1);
      dpart(g, cylY(0.02, -1.0, -0.86, 8), DC.brass, k ? null : { ko: '배유 콕', en: 'Drain cock', d: '청소 전 필터실의 연료를 빼는 콕.' });
    });
    // 전환 콕 (위: 입구, 아래: 출구)
    const valves = [];
    [[0.98, '입구 전환 콕', 'Inlet change-over cock'], [-1.08, '출구 전환 콕', 'Outlet change-over cock']].forEach(([y, ko, en], k) => {
      const vb = new THREE.Group(); vb.position.y = y; root.add(vb);
      dpart(vb, cylZ(0.13, -0.16, 0.16, 32), DC.castL, { ko, en, d: '원뿔형 플러그를 90° 돌려 A 또는 B로 흐름을 바꿉니다. 위·아래 콕이 레버로 연동되어 항상 같은 쪽을 씁니다. 전환 중에는 잠시 양쪽이 같이 열려 흐름이 끊기지 않습니다.' });
      const plug = new THREE.Group(); vb.add(plug); valves.push(plug);
      dpart(plug, cylZ(0.1, -0.15, 0.14, 28), DC.brass, k ? null : { ko: '전환 플러그', en: 'Taper plug', d: '구멍이 L자로 뚫린 플러그.' });
      dpart(plug, box(0.24, 0.035, 0.02, 0, 0, 0.18, 0.008), DC.red, null);
      dpart(vb, pipeAlong('x', 0.06, -0.45, -0.1, 0, 0, 0.012), DC.steelD, null);
      dpart(vb, pipeAlong('x', 0.06, 0.1, 0.45, 0, 0, 0.012), DC.steelD, null);
      dpart(vb, pipeAlong('y', 0.06, k ? -0.4 : 0.1, k ? -0.1 : 0.4, 0, 0, 0.012, true), DC.steelD, null);
      X.forEach(x => dpart(vb, pipeAlong('y', 0.06, k ? 0 : -0.25, k ? 0.24 : 0, x, 0, 0.012), DC.steelD, null));
    });
    dpart(root, cylY(0.012, -1.0, 1.0, 8).translate(0, 0, 0.24), DC.steelD, { ko: '연동 레버', en: 'Interlinked handle', d: '두 콕을 함께 돌립니다.' }, { nocut: true });
    // 차압계
    const gdp = dgauge(root, 0.0, 0.25, 0.08, 0.12, '차압', 0, 1.2, 'bar', { ko: '차압계', en: 'Differential pressure gauge', d: '입구와 출구 압력 차이. 막힘 정도와 점도를 함께 보여 줍니다. 경보 접점(교육용 0.6 bar) 내장.' });
    // 유동: 입구 → 위 콕 → 사용 중 필터실 → 엘리먼트 바깥 → 안쪽 → 아래 콕 → 출구
    const route = k => { const x = X[k], s = Math.sign(x); return [[0, 1.45, -0.02], [0, 0.98, -0.02], [x * 0.5, 0.98, -0.03], [x, 0.98, -0.03], [x, 0.7, -0.05], [x + s * 0.25, 0.4, -0.06], [x + s * 0.25, -0.3, -0.06], [x + s * 0.12, -0.4, -0.04], [x, -0.5, -0.03], [x, -1.08, -0.02], [0, -1.08, -0.02], [0, -1.5, -0.02]]; };
    const flowOf = k => () => { const c = Math.cos(valves[0].rotation.z), w = k === 0 ? clamp(c, 0, 1) : clamp(-c, 0, 1); return w * 1.0 + (DVS.swTarget != null ? 0.3 : 0) * (1 - Math.abs(c)); };
    dflow(root, route(0), 'fuel', flowOf(0), { sp: 0.05 }); dflow(root, route(1), 'fuel', flowOf(1), { sp: 0.05 });
    // 오염 입자 (오염 측에서 엘리먼트로 다가와 멈춤)
    [0, 1].forEach(k => { const x = X[k], s = Math.sign(x); dflow(root, [[x + s * 0.27, 0.5, -0.03], [x + s * 0.23, -0.4, -0.03]], 'dirt', () => flowOf(k)() * 0.4, { sp: 0.12, size: 0.035, jitter: 0.03 }); });
    let ang = FSS.side ? Math.PI : 0;
    return {
      update(st) {
        if (DVS.swTarget != null) {
          const tgt = DVS.swTarget ? Math.PI : 0; ang += Math.sign(tgt - ang) * Math.min(Math.abs(tgt - ang), st.dt * 1.2);
          if (Math.abs(tgt - ang) < 1e-3) { FSS.side = DVS.swTarget; DVS.swTarget = null; }
        } else ang = FSS.side ? Math.PI : 0;
        valves.forEach(v => v.rotation.z = ang);
        [0, 1].forEach(k => { const c = FSS.clog[k]; dirt[k].scale.set(1 + c * 0.25, 1, 1 + c * 0.25); dirt[k].visible = c > 0.03; dirt[k].material.opacity = 1; elems[k].material.color.setHex(c > 0.7 ? 0x8c7a5c : DC.mesh); });
        gdp.set(FSS.dpF);
      },
    };
  },
  readouts() {
    const nm = FSS.side ? 'B' : 'A', al = FSS.dpF > 0.6;
    return kvRow('사용 중', `필터실 ${nm}${DVS.swTarget != null ? ' (전환 중)' : ''}`) + kvRow('차압', `<span style="color:${al ? 'var(--bad)' : 'inherit'}">${FSS.dpF.toFixed(2)} bar${al ? ' · 경보' : ''}</span>`, 'calc')
      + kvRow('막힘 A / B', `${(FSS.clog[0] * 100).toFixed(0)} % / ${(FSS.clog[1] * 100).toFixed(0)} %`, 'edu') + kvRow('연료 점도', `${FSS.visc.toFixed(1)} cSt`, 'calc')
      + kvRow('통과 유량', `${(FSP.Qcirc * 3.6).toFixed(1)} t/h`, 'edu') + kvRow('눈 크기', `${FSP.filterFine} µm`, 'edu');
  },
});

// ---------------- 압력조절밸브 (복귀 측, 상류압 유지) ----------------
defDevice('pcv', {
  ko: '연료 압력조절밸브', en: 'Fuel pressure control valve (back-pressure)', sys: '연료 공급 계통', parts: ['pcv'],
  principle: `<p>엔진 연료 복귀관 끝에서 <b>상류(엔진 입구) 압력</b>을 일정하게 지키는 스프링식 배압 밸브입니다. 입구 압력이 밸브 디스크를 밀어 올리는 힘이 스프링 힘보다 커지면 열려 남는 연료를 탈기 탱크(약 4 bar)로 흘려보냅니다.</p>
  <p>엔진 소비가 늘면 복귀량이 줄어 밸브가 조금 닫히고, 소비가 줄면 더 열립니다. 이렇게 엔진 입구 압력을 약 7–8 bar로 유지해 고온 연료가 증발하지 않게 하고 부스터 흡입 밸브가 충분히 채워지게 합니다.</p>`,
  sources: [
    { t: 'ref', text: 'MAN B&W Project Guide · Fuel oil system: 엔진 입구 압력 7–8 bar, 복귀 측 압력조절밸브', url: 'https://www.man-es.com/applications/projectguides/2stroke/content/printed/S60ME-C10_5.pdf' },
    { t: 'edu', text: '밸브 크기, 스프링 형식(다이어프램 대신 피스톤), 개도 계산식은 교육용 가정' }],
  view: { t: [0, 0.3, -0.1], d: [0.3, 0.2, 1], k: 0.85 },
  build(root) {
    dpart(root, lathe([[0, -0.38], [0.24, -0.38], [0.3, -0.2], [0.3, 0.2], [0.18, 0.32], [0.18, 0.4], [0.14, 0.4], [0.14, 0.3], [0.24, 0.18], [0.24, -0.18], [0.2, -0.32], [0, -0.32]]), DC.castL, { ko: '밸브 몸체', en: 'Valve body', d: '글로브형 주물 몸체. 입구는 아래, 출구는 옆.' });
    dpart(root, pipeAlong('y', 0.08, -0.8, -0.36, 0, 0, 0.014, true), DC.steelD, { ko: '입구 (엔진 복귀관)', en: 'Inlet from engine return', d: '엔진 입구와 같은 약 8 bar.' });
    dpart(root, pipeAlong('x', 0.08, 0.28, 0.85, 0.02, 0, 0.014, true), DC.steelD, { ko: '출구 (탈기 탱크로)', en: 'Outlet to venting box', d: '약 4 bar.' });
    dpart(root, ringG(0.075, 0.13, -0.24, -0.2), DC.stellite ?? 0xd9d2b8, { ko: '밸브 시트', en: 'Seat', d: '디스크가 앉는 경화 링.' });
    const disc = new THREE.Group(); root.add(disc);
    dpart(disc, lathe([[0, -0.21], [0.11, -0.21], [0.11, -0.17], [0.04, -0.13], [0.025, -0.13], [0.025, 0.7], [0, 0.7]]), DC.steelL, { ko: '디스크·스템', en: 'Disc & stem', d: '입구 압력 × 시트 면적이 스프링 힘을 넘으면 들려 열립니다.' });
    dpart(disc, cylY(0.13, 0.44, 0.48, 28), DC.steelD, { ko: '스프링 받침', en: 'Spring plate', d: '' , label: false });
    dpart(root, vesselY(0.18, 0.4, 1.12, 0.015, 0.05, { bot: false }), DC.paint, { ko: '스프링 하우징', en: 'Spring bonnet', d: '' });
    const spr = dpart(root, springG(0.1, 0.48, 1.0, 6, 0.016), DC.spring, { ko: '조정 스프링', en: 'Set spring', d: '설정 압력을 만드는 압축 스프링. 개도가 커질수록 조금 더 눌려 압력이 약간 오릅니다(비례 오차).' });
    dpart(root, cylY(0.02, 1.0, 1.3, 10), DC.steelL, { ko: '조정 나사', en: 'Adjusting screw', d: '돌려서 스프링을 더 누르면 설정 압력이 올라갑니다.' });
    dpart(root, cylY(0.1, 1.0, 1.03, 24), DC.steelD, null);
    dfluid(root, cylY(0.2, -0.32, 0.18, 28), 'fuel', 0.15);
    const gI = dgauge(root, -0.35, -0.6, 0.02, 0.1, '입구', 0, 16, 'bar', { ko: '입구 압력계', en: 'Inlet gauge', d: '' });
    const gO = dgauge(root, 0.65, 0.3, 0.02, 0.1, '출구', 0, 16, 'bar', { ko: '출구 압력계', en: 'Outlet gauge', d: '' });
    dflow(root, [[0, -0.85, -0.02], [0, -0.25, -0.03], [0.12, -0.16, -0.04], [0.22, 0.0, -0.04], [0.3, 0.02, -0.02], [0.9, 0.02, -0.02]], 'fuel', () => FSS.ret / FSP.Qcirc * 1.4, { sp: 0.05, rc: 0.06 });
    return {
      update() {
        const L = FSS.pcv * 0.06; disc.position.y = L; spr.scale.y = (0.52 - L) / 0.52;
        spr.position.y = 1.0 * (1 - spr.scale.y);
        gI.set(FSS.pIn + FSS.pcv * 0.15); gO.set(FSS.pRet);
      },
    };
  },
  readouts() {
    return kvRow('입구 압력 (엔진 측)', `${(FSS.pIn + FSS.pcv * 0.15).toFixed(2)} bar`, 'ref') + kvRow('출구 압력', `${FSS.pRet.toFixed(1)} bar`, 'ref')
      + kvRow('복귀 유량', `${(FSS.ret * 3600).toFixed(0)} kg/h`, 'calc') + kvRow('밸브 개도', `${(FSS.pcv * 100).toFixed(0)} %`, 'calc') + kvRow('엔진 소비', `${(fuelConsumption() * 3600).toFixed(0)} kg/h`, 'm0d');
  },
});
