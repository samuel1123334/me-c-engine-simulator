// ===================================================================
// 10 · MODEL — 순수 함수. 모든 부품 위치·상태·수치는 크랭크각(θ)에서 계산된다.
// 단위: m, deg(크랭크각, TDC=0, 회전 방향으로 증가), bar
// ===================================================================
const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth01 = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const easeCos = t => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t, 0, 1));
const wrap360 = a => ((a % 360) + 360) % 360;
const wrapS = a => { a = wrap360(a); return a >= 180 ? a - 360 : a; };

// 설정값. src: 'ref' = 참고자료 확인값, 'edu' = 교육용 가정, 'calc' = 다른 값에서 계산
const CFG = {
  bore: 0.60,        // S60ME-C 계열 보어 600 mm (명칭상 보어) — ref
  stroke: 2.40,      // 행정 2400 mm (S60 계열) — edu(대표값)
  conrod: 2.60,      // 커넥팅 로드 길이 — edu
  pistonH: 4.60,     // 크로스헤드 핀 중심 → 피스톤 크라운 상면 — edu
  cr: 18,            // 기하학적 압축비 → 연소실 간극 높이 계산 — edu
  portTopMM: 0,      // 소기 포트 상단 (BDC 크라운 기준, mm) — init에서 140° 기준으로 계산
  portBotMM: 6,      // 소기 포트 하단 (BDC 크라운 기준, mm) — edu
  evo: 110,          // 배기밸브 개방 시작 — ref(일반적 값 '약 110° ATDC')
  evc: 255,          // 배기밸브 폐쇄 완료 — edu (ME-C는 부하별 전자 제어)
  evOpenRamp: 24, evCloseRamp: 36,
  evLiftMax: 0.11,   // 표시용 최대 양정 — edu
  soi: -2,           // 분사 시작 (TDC 기준, 음수=BTDC) — edu
  injDur0: 8, injDur1: 18, // 분사 기간(부하 0%/100%) — edu
  ignDelay: 2.5,     // 착화 지연 — edu
  nCyl: 6, pitch: 1.02, // 실린더 간격 1020 mm (S60ME-B 프로젝트 가이드 값) — ref
  firingOrder: [1, 5, 3, 4, 2, 6], // 점화 순서 — edu
  auxOn: 0.55, auxOff: 0.70, // 보조 송풍기 기동/정지 소기압(bar g) — edu, 자료마다 상이
  rpmMCR: 105,       // S60ME 계열 정격 105 r/min — ref(프로젝트 가이드 예)
};
const CFG_DEFAULT = JSON.parse(JSON.stringify(CFG));

const SRC = {
  bore: 'ref', stroke: 'edu', conrod: 'edu', pistonH: 'edu', cr: 'edu', portTopMM: 'calc', portBotMM: 'edu',
  evo: 'ref', evc: 'edu', soi: 'edu', injDur0: 'edu', injDur1: 'edu', ignDelay: 'edu',
  pitch: 'ref', firingOrder: 'edu', auxOn: 'edu', auxOff: 'edu', rpmMCR: 'ref'
};

const M = {
  r: () => CFG.stroke / 2,
  // 크랭크 핀 중심 (크랭크축 중심 기준). 정면(선수측)에서 볼 때 시계방향 회전 가정
  pin(t) { const r = M.r(); return { x: r * Math.sin(t * DEG), y: r * Math.cos(t * DEG) }; },
  // 크로스헤드 핀 높이: y = r cosθ + √(L² − r² sin²θ)
  xhY(t) { const r = M.r(), L = CFG.conrod, s = Math.sin(t * DEG); return r * Math.cos(t * DEG) + Math.sqrt(L * L - r * r * s * s); },
  // 커넥팅 로드 경사각 (수직 기준, 대단부가 +x 쪽일 때 양수)
  rodAngle(t) { return Math.asin(M.r() * Math.sin(t * DEG) / CFG.conrod); },
  crownY(t) { return M.xhY(t) + CFG.pistonH; },
  crownTDC() { return CFG.conrod + M.r() + CFG.pistonH; },
  crownBDC() { return CFG.conrod - M.r() + CFG.pistonH; },
  clearance() { return CFG.stroke / (CFG.cr - 1); },
  headY() { return M.crownTDC() + M.clearance(); },
  pistonFromTDC(t) { return M.crownTDC() - M.crownY(t); },
  portTop() { return M.crownBDC() + CFG.portTopMM / 1000; },
  portBot() { return M.crownBDC() + CFG.portBotMM / 1000; },
  // 포트 개방률: 피스톤 크라운 상면이 포트 상단 아래로 내려간 만큼 (라이너 형상 × 피스톤 위치)
  portFrac(t) { const c = M.crownY(t), a = M.portTop(), b = M.portBot(); return clamp((a - c) / (a - b), 0, 1); },
  // 크라운이 포트 상단을 지나는 크랭크각 (기하에서 역산)
  portAngles() {
    const target = M.portTop();
    if (target <= M.crownBDC()) return [180, 180];
    let lo = 0, hi = 180;
    for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (M.crownY(mid) > target) lo = mid; else hi = mid; }
    const a = (lo + hi) / 2; return [a, 360 - a];
  },
  evLift01(t) {
    const a = wrap360(t), o = CFG.evo, c = CFG.evc;
    if (a <= o || a >= c) return 0;
    if (a < o + CFG.evOpenRamp) return easeCos((a - o) / CFG.evOpenRamp);
    if (a > c - CFG.evCloseRamp) return easeCos((c - a) / CFG.evCloseRamp);
    return 1;
  },
  evLiftRate(t) { const h = 0.25; return (M.evLift01(t + h) - M.evLift01(t - h)) / (2 * h); },
  injDur(load) { return lerp(CFG.injDur0, CFG.injDur1, clamp(load, 0, 1)); },
  inj01(t, load) {
    if (load <= 0.005) return 0;
    const d = wrapS(t - CFG.soi), D = M.injDur(load);
    if (d < 0 || d > D) return 0;
    return clamp(Math.min(d / 1.5, (D - d) / 1.5, 1), 0, 1);
  },
  injSince(t) { return wrapS(t - CFG.soi); },
  burnDur(load) { return M.injDur(load) + 24; },
  // 윈베(Wiebe) 누적 연소율 — 교육용 단순 모델
  burned(t, load) {
    if (load <= 0.005) return 0;
    const a = wrap360(t - CFG.soi - CFG.ignDelay), D = M.burnDur(load);
    const lim = wrap360(CFG.evo - CFG.soi - CFG.ignDelay);
    if (a > lim) return 0;           // 배기 이후 ~ 다음 분사 전
    const x = clamp(a / D, 0, 1);
    return 1 - Math.exp(-6.9 * Math.pow(x, 1.6));
  },
  // 연소 표현 강도 (0~1): 열발생 구간에서 최대, 배기밸브 개방 전 소멸
  glow(t, load) {
    if (load <= 0.005) return 0;
    const a = wrap360(t - CFG.soi - CFG.ignDelay), D = M.burnDur(load);
    const lim = wrap360(CFG.evo - CFG.soi - CFG.ignDelay);
    if (a > lim) return 0;
    const x = a / D;
    const rise = smooth01(x / 0.12);
    const body = x < 1 ? 1 - 0.45 * x : 0.55 * Math.exp(-(a - D) / 18);
    const tail = smooth01((lim - a) / 10);
    return clamp(rise * body * tail * (0.45 + 0.55 * load), 0, 1);
  },
  phase(t, load) {
    const a = wrap360(t), [po, pc] = M.portAngles();
    const d = wrapS(a - CFG.soi), D = M.injDur(load);
    if (load > 0.005 && d >= 0 && d < D) return { k: 'inj', ko: '연료 분사 · 압축착화' };
    if (a >= CFG.evo && a < po) return { k: 'blow', ko: '배기밸브 개방 · 초기 배기(블로다운)' };
    if (a >= po && a < pc && a < CFG.evc) return { k: 'scav', ko: '소기 · 배기 중첩 (포트 + 배기밸브 개방)' };
    if (a >= po && a < pc) return { k: 'scav2', ko: '소기 포트만 개방 (배기밸브 폐쇄)' };
    if (a >= pc && a < CFG.evc) return { k: 'post', ko: '포트 폐쇄 · 배기밸브 폐쇄 전 (잔류 배기 배출)' };
    if (d < 0) return { k: 'comp', ko: '피스톤 상승 · 공기 압축' };
    return { k: 'exp', ko: '연소 · 팽창 (피스톤 하강)' };
  },
  // ---- (구) 단순 압력식: 0D 모델로 대체됨. 아래 래퍼가 0D 결과를 돌려준다 ----
  pscavG_old(load) { return 0.05 + 2.8 * Math.pow(clamp(load, 0, 1), 1.6); }, // 100%에서 약 3.85 bar abs
  area() { return Math.PI * CFG.bore * CFG.bore / 4; },
  vol(t) { return M.area() * (M.clearance() + M.pistonFromTDC(t)); },
  pcyl_old(t, load) {
    const a = wrap360(t), ps = 1.013 + M.pscavG_old(load);
    const [po, pc] = M.portAngles();
    const pt = ps + 0.05;
    const V = M.vol(a), Vevc = M.vol(CFG.evc), Vevo = M.vol(CFG.evo);
    const closed = a >= CFG.evc || a < CFG.evo;
    const comb = (V0) => {
      const xb = M.burned(a, load);
      return 205 * load * xb * Math.pow(M.vol(0) / V0, 1.3);
    };
    if (closed) return pt * Math.pow(Vevc / V, 1.32) + comb(V);
    const pEvo = pt * Math.pow(Vevc / Vevo, 1.32) + 205 * load * M.burned(CFG.evo - 0.01, load) * Math.pow(M.vol(0) / Vevo, 1.3);
    const pex = ps - 0.15;
    if (a < po) { const k = (a - CFG.evo) / Math.max(1, po - CFG.evo); return pex + (pEvo - pex) * Math.exp(-5.5 * k); }
    if (a < pc) return ps - 0.08;
    return lerp(ps - 0.08, pt, smooth01((a - pc) / Math.max(1, CFG.evc - pc)));
  },
  pscavG() { return (ENGS.ps - TH.pAmb) / 1e5; },
  pcyl(t) { return TQ.p(t); },
  tcRpm() { return ENGS.N; },
  tcRpm_old(load) { return load <= 0.005 ? 0 : 3000 + 13000 * Math.pow(clamp(load, 0, 1), 0.7); },
};

// 실린더별 크랭크각 오프셋 (점화 순서에 따라 균등 배분)
function cylOffsets() {
  const n = CFG.nCyl, step = 360 / n, off = new Array(n).fill(0);
  CFG.firingOrder.forEach((c, i) => { off[c - 1] = i * step; });
  return off;
}

// 소기·블로다운 누적 진행도 테이블 (0.5° 간격) — 실린더 내부 입자 위치용
const TBL = { S: null, B: null, n: 720 };
function buildTables() {
  const n = TBL.n, S = new Float32Array(n + 1), B = new Float32Array(n + 1);
  let s = 0, b = 0;
  const [po] = M.portAngles();
  for (let i = 0; i <= n; i++) {
    const a = i * 360 / n;
    S[i] = s; B[i] = b;
    s += M.portFrac(a) * (360 / n);
    if (a >= CFG.evo && a < po) b += M.evLift01(a) * (360 / n);
  }
  const sMax = s || 1, bMax = b || 1;
  for (let i = 0; i <= n; i++) { S[i] /= sMax; B[i] = Math.min(1, B[i] / bMax); }
  TBL.S = S; TBL.B = B;
}
function tblAt(T, a) { const x = wrap360(a) / 360 * TBL.n, i = Math.floor(x), f = x - i; return T[i] + (T[Math.min(TBL.n, i + 1)] - T[i]) * f; }

function initModel() {
  if (!CFG.portTopMM) CFG.portTopMM = Math.round((M.crownY(140) - M.crownBDC()) * 1000);
  if (!CFG_DEFAULT.portTopMM) CFG_DEFAULT.portTopMM = CFG.portTopMM;
  buildTables();
}

