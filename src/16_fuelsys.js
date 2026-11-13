// ===================================================================
// 16 · FUEL & HYDRAULIC SYSTEM STATE — 기기 내부 보기에서 쓰는 계통 상태 (교육용 평균값 모델)
//  자료 확인값: 공급 펌프 약 4 bar, 순환 펌프 10 bar, 엔진 입구(연료 펌프 높이) 7–8 bar,
//              HPS 200/300 bar(부하 연동), 안전밸브 310/315 bar, 분사압 600–1000 bar(부하 연동),
//              분사밸브 개변압 350–380 bar, 주입 점도 약 13 cSt, 배기밸브 공기 스프링 7 bar.
//  교육용 가정: 연료 등급(380 cSt@50 °C), 순환 유량, 가열기 NTU, 필터 막힘 속도, 펌프 배제용적·증속비,
//              부스터 면적비, 배기밸브 액추에이터 유량, 축압기 체적·봉입압.
// ===================================================================
const FSP = {
  v50: 380, B: 3.337,             // Walther 식: loglog(ν+0.7) = A − B·log10(T[K]) — 380 cSt@50 °C, 13 cSt@약 140 °C가 되도록 B 선택 (edu)
  rho: 950, cp: 2.0e3,            // HFO 밀도 kg/m³, 비열 J/kgK (edu)
  Tsvc: 90,                       // 서비스 탱크 온도 °C (edu)
  Qcirc: 2.2,                     // 순환 펌프 유량 kg/s ≈ 8.3 m³/h (정격 소비량의 약 3배, edu)
  pSupply: 4.0, pCirc: 10.0, pInlet: 8.0,     // bar g (ref: 4 / 10 / 7–8 bar)
  viscSet: 13,                    // cSt (ref: 약 13 cSt)
  Tsteam: 170.4, hfg: 2.05e6,     // 7 bar g 포화증기 온도 °C, 증발잠열 J/kg (물성)
  NTU: 1.25, heaterTau: 25,       // 가열기 최대 NTU, 출구온도 시정수 s (edu)
  Kp: 0.035, Ki: 0.012,           // 점도 제어 PI (edu)
  filterFine: 50,                 // 전유량 필터 눈 크기 µm (edu — MAN 자료에 형식·눈 크기 미기재)
  clogRate: 1 / 7200,             // 막힘 증가율 1/s (모의 시간 2시간에 완전 막힘, 교육용 가속)
  // HPS
  pSysLo: 200, pSysHi: 300, pSwitch: 0.5,      // bar, 부하 기준 전환점 (ref: 200/300 bar 두 단계, 전환점은 edu)
  relief: [310, 315],             // 안전밸브 bar (ref)
  nEngPumps: 3, gear: 16, Vpump: 250,          // 엔진 구동 펌프 수 (ref: 3–5대), 증속비·배제용적 cm³/rev (edu)
  areaRatio: 3.3,                 // 부스터 유압 피스톤/연료 플런저 면적비 (edu: 300 bar × 3.3 ≈ 1000 bar)
  Vev: 0.30,                      // 배기밸브 1회 개방 제어유 소비 L (edu)
  leak: 0.05,                     // 누설·주유기 등 추가 소비 비율 (edu)
  accV0: 6.0, accPre: 0.65,       // HCU 축압기 체적 L, 봉입압/작동압 비 (edu)
};
const loglog = v => Math.log10(Math.log10(v + 0.7));
const FUEL = {
  A: () => loglog(FSP.v50) + FSP.B * Math.log10(323.15),
  visc(Tc) { const x = FUEL.A() - FSP.B * Math.log10(Tc + 273.15); return Math.pow(10, Math.pow(10, x)) - 0.7; },
  tempFor(v) { const x = loglog(v); return Math.pow(10, (FUEL.A() - x) / FSP.B) - 273.15; },
};
// 상태 (모의 시간으로 적분)
const FSS = {
  y: 0.55, Tout: 140, Tin: 112, visc: 13, steam: 0, cond: 0, Q: 0, integ: 0.55,
  clog: [0.32, 0.05], side: 0, dpF: 0, pcv: 0.4, pIn: 8.0, pRet: 4.0,
  supply: 0, ret: 0, Qc: FSP.Qcirc, eventLog: [],
  // HPS
  pSet: 300, pSys: 300, swash: 0.5, pumpN: 1440, qDem: 0, qMaxEng: 0, startPumps: false, powerKW: 0,
  t: 0,
};
function fuelConsumption() { const S = ENGS.cyc ? TQ.summary() : null; return S ? S.mfDot : 0; }
function stepFuelSystem(dt) {
  if (dt <= 0) return;
  const n = Math.max(1, Math.ceil(dt / 0.5)), h = dt / n;
  const mf = fuelConsumption();
  for (let i = 0; i < n; i++) {
    FSS.t += h;
    // 탈기·혼합: 서비스 탱크 보충(= 소비량) + 엔진 복귀
    FSS.supply = mf; FSS.ret = Math.max(0, FSP.Qcirc - mf);
    const Tret = FSS.Tout - 6;                             // 엔진 배관에서 약간 냉각 (edu)
    FSS.Tin = (FSS.supply * FSP.Tsvc + FSS.ret * Tret) / FSP.Qcirc;
    // 점도 PI 제어 → 증기 밸브 개도 y
    const err = FSS.visc - FSP.viscSet;                    // 점도가 높으면 더 가열
    FSS.integ = clamp(FSS.integ + FSP.Ki * err * h, 0, 1);
    FSS.y = clamp(FSS.integ + FSP.Kp * err, 0, 1);
    // 가열기: 증기 응축 온도 고정, ε = 1 − exp(−y·NTU)
    const Teq = FSP.Tsteam - (FSP.Tsteam - FSS.Tin) * Math.exp(-FSS.y * FSP.NTU);
    FSS.Tout += (Teq - FSS.Tout) * (1 - Math.exp(-h / FSP.heaterTau));
    FSS.visc = FUEL.visc(FSS.Tout);
    FSS.Q = FSP.Qcirc * FSP.cp * Math.max(0, FSS.Tout - FSS.Tin);
    FSS.steam = FSS.Q / FSP.hfg; FSS.cond = FSS.steam;
    // 전유량 필터: 층류 저항 ∝ 점도 × 유량, 막힘 증가 (사용 중인 쪽만)
    FSS.clog[FSS.side] = Math.min(1, FSS.clog[FSS.side] + FSP.clogRate * h);
    const c = FSS.clog[FSS.side];
    FSS.dpF = 0.012 * FSS.visc * (FSP.Qcirc / 2.2) * (1 + 6 * c * c);   // bar (edu)
    // 압력조절밸브: 엔진 입구 8 bar 유지, 복귀 유량을 4 bar 쪽으로 흘림
    const dpV = Math.max(0.3, FSP.pInlet - FSP.pSupply);
    FSS.pcv = clamp(FSS.ret / (1.0 * Math.sqrt(dpV)), 0.02, 1);
    FSS.pIn = FSP.pInlet; FSS.pRet = FSP.pSupply;
  }
  stepHPS();
}
function hpsDemandLps() {
  // 실린더당 사이클 소비: 부스터(연료 체적 × 면적비) + 배기밸브 액추에이터, 누설 가산
  const st = SIM.state, mfc = st.load * TH.mfMCR;
  const vB = mfc / FSP.rho * 1000 * FSP.areaRatio;      // L
  const perCyc = (vB + FSP.Vev) * (1 + FSP.leak);
  return perCyc * CFG.nCyl * st.rpm / 60;               // L/s
}
function stepHPS() {
  const st = SIM.state;
  if (st.load >= FSP.pSwitch + 0.03) FSS.pSet = FSP.pSysHi; else if (st.load <= FSP.pSwitch - 0.03) FSS.pSet = FSP.pSysLo;
  FSS.pSys = FSS.pSet;
  FSS.pumpN = st.rpm * FSP.gear;
  FSS.qMaxEng = FSP.nEngPumps * FSP.Vpump * FSS.pumpN / 60 / 1000;   // L/s
  FSS.qDem = hpsDemandLps();
  FSS.startPumps = FSS.qDem > 0.98 * FSS.qMaxEng || st.rpm < 25;
  FSS.swash = clamp(FSS.qDem / Math.max(1e-6, FSS.qMaxEng), 0.04, 1);
  FSS.powerKW = FSS.qDem / 1000 * FSS.pSys * 1e5 / 1000 / 0.9;
}
// ---- 실린더 기준 크랭크각 θ에서의 HCU 내부 상태 (한 사이클 표를 만들어 보간) ----
const HCU = { key: '', n: 720, boost: null, acc: null, fiva: null };
function buildHcuTables() {
  const load = SIM.state.load, key = [load.toFixed(3), CFG.soi, CFG.injDur0, CFG.injDur1, CFG.evo, CFG.evc, FSS.pSet].join('|');
  if (key === HCU.key) return;
  const n = HCU.n, d = 360 / n, B = new Float32Array(n), A = new Float32Array(n), F = new Float32Array(n), cons = new Float32Array(n);
  // 부스터 피스톤 위치: 분사 중 누적 분사량에 비례해 상승, 분사 후 40°에 걸쳐 원위치(흡입밸브로 연료 재충전)
  let tot = 0; for (let i = 0; i < n; i++) tot += M.inj01(i * d, load);
  const D = M.injDur(load), s0 = wrap360(CFG.soi);
  for (let i = 0; i < n; i++) {
    const th = i * d, since = wrap360(th - s0);
    let pos = 0;
    if (tot > 0) {
      if (since <= D + 1) { let c = 0; for (let k = 0; k <= since / d; k++) c += M.inj01(s0 + k * d, load); pos = c / tot; }
      else if (since < D + 41) pos = 1 - easeCos((since - D - 1) / 40);
    }
    B[i] = pos;
    // FIVA 주 스풀: +1 = P→Cfi(분사), −1 = P→Cva(배기밸브 개방 유지), 0 = Cfi→Tfi · Cva→Tva (배출)
    const w = (a, b, x) => smooth01((x - a) / 2) * (1 - smooth01((x - b) / 2));
    const injCmd = load > 0.005 ? w(-3, D, wrapS(th - CFG.soi)) : 0;
    const evCmd = w(CFG.evo - 4, CFG.evc - CFG.evCloseRamp, th);
    F[i] = injCmd - evCmd;
  }
  // 소비 유량(L/°): 부스터 상승 속도 × 피스톤 체적 + 배기밸브 개방 속도 × 액추에이터 체적
  const vB = load * TH.mfMCR / FSP.rho * 1000 * FSP.areaRatio;
  for (let i = 0; i < n; i++) { const dB = Math.max(0, B[(i + 1) % n] - B[i]); const dE = Math.max(0, M.evLift01((i + 1) * d) - M.evLift01(i * d)); cons[i] = dB * vB + dE * FSP.Vev; }
  let sum = 0; for (let i = 0; i < n; i++) sum += cons[i];
  const qIn = sum * (1 + FSP.leak) / n;               // 공급은 사이클 평균 (분배관에서 들어옴)
  // 축압기 기름량 변화 → 질소 체적 → 압력 (단열 n=1.4)
  const p0 = FSP.accPre * FSS.pSet, Vg0 = FSP.accV0 * Math.pow(p0 / FSS.pSet, 1 / 1.4);   // 작동압에서의 질소 체적
  let v = 0, vmin = 1e9, vmax = -1e9; const V = new Float32Array(n);
  for (let i = 0; i < n; i++) { V[i] = v; v += qIn - cons[i] * (1 + FSP.leak); vmin = Math.min(vmin, V[i]); vmax = Math.max(vmax, V[i]); }
  const vMean = vmax;                                   // 기름이 가장 많이 찼을 때 = HPS 설정압 (압력 보상 펌프가 그 이상 올리지 않음)
  for (let i = 0; i < n; i++) { const Vg = Vg0 - (V[i] - vMean); A[i] = FSS.pSet * Math.pow(Vg0 / Vg, 1.4); }
  HCU.boost = B; HCU.acc = A; HCU.fiva = F; HCU.cons = cons; HCU.vOil = V; HCU.vMean = vMean; HCU.Vg0 = Vg0; HCU.p0 = p0; HCU.key = key;
}
function hcuAt(arr, th) { buildHcuTables(); if (typeof arr === 'string') arr = HCU[arr]; const x = wrap360(th) / (360 / HCU.n), i = Math.floor(x) % HCU.n, f = x - Math.floor(x); return arr[i] + (arr[(i + 1) % HCU.n] - arr[i]) * f; }
// 분사 압력: 시스템 압력 × 면적비 (분사 중), 그 외 공급압
function injPressure(th) { const b = M.inj01(th, SIM.state.load); return b > 0 ? 10 + (FSS.pSys * FSP.areaRatio - 10) * b : 8; }
