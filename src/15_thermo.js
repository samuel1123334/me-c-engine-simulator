// ===================================================================
// 15 · THERMO — 0D 실린더 열역학 + 터보차저 매칭 (평균값 엔진 모델)
// 실린더: 크랭크각 분해 질량·에너지 보존 (단일 영역, 연소가스 분율 추적)
//   포트·배기밸브 = 유효면적 압축성 노즐 유량, 연소 = Wiebe, 열손실 = Woschni
// 공기 계통: 압축기 맵(속도선) → 냉각기 → (보조 송풍기 직렬) → 소기 리시버 → 실린더
// 배기 계통: 실린더 → 배기 리시버 → 터빈(타원 유량식) → 보일러 배압
// 터보 축: ½Jω² 에너지 방정식 → 부하 변화 시 터보 랙이 나타난다.
// 모든 상수는 교육용 가정이며, 정격점에서 참고자료의 소기압(≈3.8 bar abs)에 맞춰 조정했다.
// ===================================================================
const TH = {
  R: 287, LHV: 42.7e6, AFRst: 14.5, Tw: 520, pAmb: 1.0e5, TAmb: 298, Tcw: 309, epsCool: 0.88,
  dv: 0.33, CdEV: 0.80, woschniC: 0.55, CdP: 0.72, wPortFrac: 0.72,
  mfMCR: 0.064,                // kg/cycle/cyl at 부하 100 %
  wiebeA: 6.9, wiebeM: 0.55, etaComb: 0.985,
  Vs: 10.5, Vx: 11.6,           // 소기·배기 리시버(+박스) 체적 m³ — 형상에서 추산
  J: 2.4,                       // 터보 회전체 관성 kg·m²
  Nref: 15500, PiK: 3.95, mref: 33.0, KT: 2.2, etaT: 0.815, cpG: 1130, gG: 1.35, cpA: 1005,
  dPcool0: 0.035e5, dPboil0: 0.03e5, dPb0: 0.30e5, mBlow: 12.0,
  dtheta: 0.5,                  // 실린더 적분 간격 (°)
};
const NTH = Math.round(360 / TH.dtheta);
const uOf = T => { const x = T - 300; return 718 * x + 0.06 * x * x; };
const TofU = u => 300 + (-718 + Math.sqrt(718 * 718 + 0.24 * u)) / 0.12;
const cvOf = T => 718 + 0.12 * (T - 300);
const gamOf = T => (cvOf(T) + TH.R) / cvOf(T);
function orifice(pu, Tu, pd, A, g) {
  if (A <= 0 || pu <= 0) return 0;
  let pr = pd / pu; const crit = Math.pow(2 / (g + 1), g / (g - 1));
  const psi = r => { const lr = Math.log(r); return Math.sqrt(Math.max(0, 2 * g / (g - 1) * (Math.exp(lr * 2 / g) - Math.exp(lr * (g + 1) / g)))); };
  let f;
  if (pr <= crit) f = psi(crit);
  else if (pr < 0.985) f = psi(pr);
  else f = psi(0.985) * Math.max(0, 1 - pr) / 0.015;     // 압력비 → 1 부근 선형화 (수치 안정)
  return A * pu / Math.sqrt(TH.R * Tu) * f;
}
const GEO = {
  Ap: () => Math.PI * CFG.bore * CFG.bore / 4,
  V: th => M.clearance() * GEO.Ap() + GEO.Ap() * (M.crownTDC() - M.crownY(th)),
  Vd: () => GEO.Ap() * CFG.stroke,
  portArea: th => TH.CdP * TH.wPortFrac * Math.PI * CFG.bore * clamp(M.portTop() - M.crownY(th), 0, M.portTop() - M.portBot()),
  evArea: th => { const l = M.evLift01(th) * CFG.evLiftMax; return TH.CdEV * Math.min(Math.PI * TH.dv * l, Math.PI * TH.dv * TH.dv / 4); },
};
// 크랭크각 0.25° 간격 형상 테이블 (설정 변경 시 재생성)
const GT4 = { key: '', V: null, dV: null, Ap: null, Ae: null, n: 1440 };
function geoTable() {
  const key = [CFG.portTopMM, CFG.evo, CFG.evc, CFG.evLiftMax].join('|');
  if (GT4.key === key) return GT4;
  const n = GT4.n; GT4.V = new Float64Array(n); GT4.dV = new Float64Array(n); GT4.Ap = new Float64Array(n); GT4.Ae = new Float64Array(n);
  for (let i = 0; i < n; i++) { const th = i * 360 / n; GT4.V[i] = GEO.V(th); GT4.dV[i] = (GEO.V(th + 0.01) - GEO.V(th - 0.01)) / 0.02; GT4.Ap[i] = GEO.portArea(th); GT4.Ae[i] = GEO.evArea(th); }
  GT4.key = key; return GT4;
}
function wiebeRate(th, load) {        // dx/dθ (1/°)
  const D = M.burnDur(load), a = wrap360(th - CFG.soi - CFG.ignDelay);
  if (a >= D * 1.6) return 0;
  const x = a / D, m = TH.wiebeM;
  return TH.wiebeA * (m + 1) / D * Math.pow(Math.max(x, 1e-9), m) * Math.exp(-TH.wiebeA * Math.pow(x, m + 1));
}

// ---- 실린더 1 사이클 (θ = EVC → EVC + 360) ----
function cylCycle(inp, init, record = true) {
  const { rpm, mf, ps, Ts, px, Tx, load } = inp;
  const dtdth = 1 / (6 * rpm), B = CFG.bore, Ap = GEO.Ap(), Sp = 2 * CFG.stroke * rpm / 60, Vd = GEO.Vd();
  const th0 = CFG.evc;
  let m, U, mb;
  if (init) { m = init.m; U = init.U; mb = init.mb; }
  else { const V0 = GEO.V(th0), T0 = Ts * 1.12; m = ps * V0 / (TH.R * T0); U = m * uOf(T0); mb = 0.12 * m; }
  let pRef = 0, VRef = 0, TRef = 0;
  const out = record ? {
    p: new Float32Array(NTH), T: new Float32Array(NTH), m: new Float32Array(NTH), V: new Float32Array(NTH), xb: new Float32Array(NTH),
    mIn: new Float32Array(NTH), mOut: new Float32Array(NTH), qc: new Float32Array(NTH), qw: new Float32Array(NTH), yOut: new Float32Array(NTH), xf: new Float32Array(NTH),
  } : null;
  const S = { W: 0, Qc: 0, Qw: 0, Hin: 0, Hout: 0, Min: 0, Mout: 0, Mf: 0, MoutB: 0, pmax: 0, thPmax: 0 };
  let xfCum = 0;
  const G = geoTable(), hB = TH.woschniC * 3.26 * Math.pow(CFG.bore, -0.2);
  const deriv = (th, m, U, mb) => {
    const gi = Math.round(wrap360(th) * 4) % 1440;
    const V = G.V[gi], dV = G.dV[gi];
    const T = TofU(U / m), p = m * TH.R * T / V, g = gamOf(T), xb = clamp(mb / m, 0, 1), y = xb;   // 0D는 완전 혼합 가정 (공간 분포는 2D 유동장에서 계산)
    const hC = uOf(T) + TH.R * T, hS = uOf(Ts) + TH.R * Ts, hX = uOf(Tx) + TH.R * Tx;
    const Ap_ = G.Ap[gi], Ae = G.Ae[gi];
    let mi = 0, hi = 0, bi = 0;            // 포트 (양수 = 유입)
    if (Ap_ > 0) { if (ps >= p) { mi = orifice(ps, Ts, p, Ap_, 1.39); hi = hS; bi = 0; } else { mi = -orifice(p, T, ps, Ap_, g); hi = hC; bi = y; } }
    let mo = 0, ho = 0, bo = 0;            // 배기밸브 (양수 = 유출)
    if (Ae > 0) { if (p >= px) { mo = orifice(p, T, px, Ae, g); ho = hC; bo = y; } else { mo = -orifice(px, Tx, p, Ae, 1.34); ho = hX; bo = 1; } }
    const dx = mf > 0 ? wiebeRate(th, load) : 0;
    const dQc = mf * TH.LHV * TH.etaComb * dx, dmf = mf * dx;
    const closed = Ap_ <= 0 && Ae <= 0;
    let w = 6.18 * Sp;
    if (closed) { w = 2.28 * Sp; if (pRef > 0) { const pm = pRef * Math.pow(VRef / V, 1.35); w += 3.24e-3 * Vd * TRef / (pRef * VRef) * Math.max(0, p - pm); } }
    const Aw = 2.3 * Ap + Math.PI * B * (V / Ap);
    const h = hB * Math.exp(0.8 * Math.log(p / 1000 * w) - 0.55 * Math.log(T));
    const dQw = h * Aw * (T - TH.Tw) * dtdth;
    const dm = (mi - mo) * dtdth + dmf;
    const dU = (mi * hi - mo * ho) * dtdth - p * dV + dQc - dQw;
    const dmb = (mi < 0 ? mi * bi : 0) * dtdth - (mo > 0 ? mo * bo : mo) * dtdth + Math.min(dmf * (1 + TH.AFRst), Math.max(0, m - mb) * 0.5 + dmf);
    return { dm, dU, dmb, p, T, V, dV, mi, mo, hi, ho, bo: mo > 0 ? bo : 1, dQc, dQw, dx, xb, y };
  };
  const h = TH.dtheta;
  for (let k = 0; k < NTH; k++) {
    const th = th0 + k * h;
    if (k === 0) { const T = TofU(U / m); VRef = G.V[Math.round(wrap360(th) * 4) % 1440]; pRef = m * TH.R * T / VRef; TRef = T; }
    const a = deriv(th, m, U, mb);
    const b = deriv(th + h / 2, m + a.dm * h / 2, U + a.dU * h / 2, mb + a.dmb * h / 2);
    if (record) {
      const idx = ((Math.round((th0 + k * h) / h) % NTH) + NTH) % NTH;
      out.p[idx] = a.p; out.T[idx] = a.T; out.m[idx] = m; out.V[idx] = a.V; out.xb[idx] = a.xb;
      out.mIn[idx] = a.mi; out.mOut[idx] = a.mo; out.qc[idx] = a.dQc; out.qw[idx] = a.dQw; out.yOut[idx] = a.bo; out.xf[idx] = xfCum;
    }
    if (a.p > S.pmax) { S.pmax = a.p; S.thPmax = th; }
    // 적분량 (중점값)
    S.W += b.p * b.dV * h; S.Qc += b.dQc * h; S.Qw += b.dQw * h; S.Mf += mf * b.dx * h; xfCum += b.dx * h;
    const dts = h / (6 * rpm);
    S.Min += b.mi * dts; S.Hin += b.mi * b.hi * dts; S.Mout += b.mo * dts; S.Hout += b.mo * b.ho * dts; S.MoutB += (b.mo > 0 ? b.mo * b.y : b.mo) * dts;
    m += b.dm * h; U += b.dU * h; mb = clamp(mb + b.dmb * h, 0, m);
  }
  S.end = { m, U, mb };
  return { S, out };
}

// ---- 압축기 · 송풍기 · 냉각기 · 터빈 ----
const TCM = {
  Nhat: N => Math.max(0, N) / TH.Nref,
  piS: N => 1 + TH.PiK * TCM.Nhat(N) ** 2,
  mch: N => TH.mref * (0.12 + 0.98 * TCM.Nhat(N)),
  // 속도선: 유량 → 압력비 (유량 증가 시 단조 감소)
  pi(N, md) { const mc = TCM.mch(N), ps = TCM.piS(N); if (md <= mc) return 1 + (ps - 1) * Math.sqrt(Math.max(0, 1 - (md / mc) ** 2)); return 1 - 0.0025 * (md - mc) ** 2; },
  eta(N, md) { const r = md / Math.max(1e-6, TCM.mch(N)); return clamp(0.845 - 0.9 * (r - 0.68) ** 2 - 0.05 * (TCM.Nhat(N) - 0.95) ** 2, 0.45, 0.85); },
  dPcool: md => TH.dPcool0 * (md / 27) ** 2,
  dPblow: md => TH.dPb0 * (1 - (md / TH.mBlow) ** 2),
  // 소기 리시버 압력 ps 를 만족하는 공기 유량 (보조 송풍기 직렬 여부 포함)
  airFlow(N, ps, aux) {
    const f = md => TH.pAmb * TCM.pi(N, md) - TCM.dPcool(md) + (aux ? TCM.dPblow(md) : 0) - ps;
    if (f(0) <= 0) return 0;                      // 논리턴 플랩·체크밸브가 역류 차단
    let lo = 0, hi = 80; for (let i = 0; i < 48; i++) { const mid = (lo + hi) / 2; if (f(mid) > 0) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  },
  compPower(N, md) { const pi = TCM.pi(N, md); if (pi <= 1 || md <= 0) return 0; return md * TH.cpA * TH.TAmb * (Math.pow(pi, 0.2857) - 1) / TCM.eta(N, md); },
  compTout(N, md) { const pi = Math.max(1, TCM.pi(N, md)); return TH.TAmb * (1 + (Math.pow(pi, 0.2857) - 1) / TCM.eta(N, md)); },
  turbFlow(px, Tx, po) { return px <= po ? 0 : TH.KT * px / Math.sqrt(Tx) * Math.sqrt(1 - (po / px) ** 2) / 1000; },
  turbPower(md, px, Tx, po) { if (md <= 0) return 0; const e = (TH.gG - 1) / TH.gG; return md * TH.cpG * Tx * TH.etaT * (1 - Math.pow(po / px, e)); },
};

// ---- 평균값 엔진 상태 ----
const ENGS = {
  N: 12000, E: 0, ps: 3.0e5, px: 2.7e5, Ts: 315, Tx: 690, aux: false, auxHold: 0,
  mdC: 0, mdT: 0, Pc: 0, Pt: 0, po: 1.0e5, cyc: null, lin: null, init: null, acc: 0, simT: 0, dirty: true, transient: 0, version: 0,
  hist: [],
};
ENGS.E = 0.5 * TH.J * (ENGS.N * 2 * Math.PI / 60) ** 2;
function engInputs(o = {}) {
  const st = SIM.state;
  return { rpm: st.rpm, load: st.load, mf: st.load * TH.mfMCR, ps: o.ps ?? ENGS.ps, Ts: ENGS.Ts, px: o.px ?? ENGS.px, Tx: ENGS.Tx };
}
function flowsOf(c, rpm) { const k = CFG.nCyl * rpm / 60; return { mIn: c.S.Min * k, mOut: c.S.Mout * k }; }
// 현재 리시버 상태에서 사이클 계산 + 선형화 (∂ṁ/∂ps, ∂ṁ/∂px)
function evalCycle() {
  const inp = engInputs();
  let c = cylCycle(inp, ENGS.init, false);
  c = cylCycle(inp, c.S.end, true);
  ENGS.init = c.S.end;
  const d = 2000;
  const cs = cylCycle(engInputs({ ps: ENGS.ps + d }), ENGS.init, false), cx = cylCycle(engInputs({ px: ENGS.px + d }), ENGS.init, false);
  const f0 = flowsOf(c, inp.rpm), fs = flowsOf(cs, inp.rpm), fx = flowsOf(cx, inp.rpm);
  // 물리적 단조성(소기압↑ → 유량↑, 배기압↑ → 유량↓)으로 기울기 부호를 제한
  ENGS.lin = { ps0: ENGS.ps, px0: ENGS.px, mIn: Math.max(0, f0.mIn), mOut: Math.max(0, f0.mOut),
    dIn_s: Math.max(1e-6, (fs.mIn - f0.mIn) / d), dIn_x: Math.min(-1e-6, (fx.mIn - f0.mIn) / d),
    dOut_s: Math.max(1e-6, (fs.mOut - f0.mOut) / d), dOut_x: Math.min(-1e-6, (fx.mOut - f0.mOut) / d) };
  // 배기 평균 온도 (엔탈피 가중) − 배기관 손실
  const hOut = c.S.Hout / Math.max(1e-6, c.S.Mout);
  let Tg = 600; for (let i = 0; i < 30; i++) { const f = uOf(Tg) + TH.R * Tg - hOut; Tg -= f / (cvOf(Tg) + TH.R); }
  ENGS.Tx = clamp(Tg - 15, 320, 1100);
  ENGS.cyc = { ...c, inp, Tg };
  ENGS.version++;
  ENGS.dirty = false;
}
// 리시버·터보 축 적분 (모의 시간 dt 초)
function stepEngine(dt) {
  const L = ENGS.lin, st = SIM.state;
  const n = Math.max(1, Math.ceil(dt / 0.01)), h = dt / n;
  for (let i = 0; i < n; i++) {
    const mIn = Math.max(0, L.mIn + L.dIn_s * (ENGS.ps - L.ps0) + L.dIn_x * (ENGS.px - L.px0));
    const mOut = Math.max(0, L.mOut + L.dOut_s * (ENGS.ps - L.ps0) + L.dOut_x * (ENGS.px - L.px0));
    const N = Math.sqrt(2 * ENGS.E / TH.J) * 60 / (2 * Math.PI);
    const mdC = TCM.airFlow(N, ENGS.ps, ENGS.aux);
    const po = TH.pAmb + TH.dPboil0 * (ENGS.mdT / 28) ** 2;
    const mdT = TCM.turbFlow(ENGS.px, ENGS.Tx, po);
    const Pc = TCM.compPower(N, mdC), Pt = TCM.turbPower(mdT, ENGS.px, ENGS.Tx, po);
    const w = N * 2 * Math.PI / 60, Pf = 0.0178 * w * w;
    // 리시버 2×2 선형 암시적 오일러 (유량 민감도가 커서 명시적 적분은 불안정)
    const kS = TH.R * ENGS.Ts / TH.Vs, kX = TH.R * ENGS.Tx / TH.Vx;
    const dC = Math.min(0, (TCM.airFlow(N, ENGS.ps + 500, ENGS.aux) - mdC) / 500);
    const dT = Math.max(0, (TCM.turbFlow(ENGS.px + 500, ENGS.Tx, po) - mdT) / 500);
    const rS = kS * (mdC - mIn), rX = kX * (mOut - mdT);
    const a11 = 1 - h * kS * (dC - L.dIn_s), a12 = h * kS * L.dIn_x;
    const a21 = -h * kX * L.dOut_s, a22 = 1 - h * kX * (L.dOut_x - dT);
    const det = a11 * a22 - a12 * a21;
    let dps = h * (rS * a22 - a12 * rX) / det, dpx = h * (a11 * rX - a21 * rS) / det;
    dps = clamp(dps, -0.05 * ENGS.ps, 0.05 * ENGS.ps); dpx = clamp(dpx, -0.05 * ENGS.px, 0.05 * ENGS.px);
    ENGS.ps = Math.max(0.95e5, ENGS.ps + dps); ENGS.px = Math.max(0.98e5, ENGS.px + dpx);
    ENGS.E = Math.max(0, ENGS.E + h * (Pt - Pc - Pf));
    ENGS.N = Math.sqrt(2 * ENGS.E / TH.J) * 60 / (2 * Math.PI);
    ENGS.mdC = mdC; ENGS.mdT = mdT; ENGS.Pc = Pc; ENGS.Pt = Pt; ENGS.po = po; ENGS.mIn = mIn; ENGS.mOut = mOut;
    const Tc = TCM.compTout(N, Math.max(mdC, 0.1));
    ENGS.Ts = TH.Tcw + (1 - TH.epsCool) * (Math.max(Tc, TH.TAmb) - TH.Tcw) + (ENGS.aux ? 6 : 0);
    // 보조 송풍기 (히스테리시스 + 최소 운전 시간)
    ENGS.auxHold = Math.max(0, ENGS.auxHold - h);
    const pg = (ENGS.ps - TH.pAmb) / 1e5;
    if (!ENGS.aux && pg < CFG.auxOn && ENGS.auxHold <= 0) { ENGS.aux = true; ENGS.auxHold = 8; }
    else if (ENGS.aux && pg > CFG.auxOff && ENGS.auxHold <= 0) { ENGS.aux = false; ENGS.auxHold = 8; }
    ENGS.simT += h;
  }
  st.aux = ENGS.aux;
}
// 크랭크가 Δθ 진행할 때 호출 (재생·수동 조절 모두 |Δθ|만큼 모의 시간이 흐름)
function advanceEngine(dTheta) {
  let rem = Math.abs(dTheta);
  if (ENGS.dirty || !ENGS.lin) evalCycle();
  while (rem > 1e-9) {
    const step = Math.min(rem, 360 - ENGS.acc);
    stepEngine(step / (6 * SIM.state.rpm));
    ENGS.acc += step; rem -= step;
    if (ENGS.acc >= 360 - 1e-9) { ENGS.acc = 0; evalCycle(); }
  }
  const pA = ENGS.lin ? Math.abs(ENGS.Pt - ENGS.Pc) / Math.max(1e4, ENGS.Pc) : 1;
  ENGS.transient = pA;
}
// 정상 상태까지 빠르게 진행 (초기화·검증용)
function settleEngine(maxCycles = 400, tol = 2) {
  let k = 0, last = [0, 0, 0];
  for (; k < maxCycles; k++) {
    evalCycle(); stepEngine(60 / SIM.state.rpm);
    const cur = [ENGS.ps, ENGS.px, ENGS.N];
    if (k > 6 && Math.abs(cur[0] - last[0]) < tol && Math.abs(cur[1] - last[1]) < tol && Math.abs(cur[2] - last[2]) < 0.5) break;
    last = cur;
  }
  evalCycle(); ENGS.acc = 0;
  return k;
}
// 크랭크각별 리시버 압력 맥동 (6기통 합성 충전·방출 모델, 주기 수렴)
function receiverPulses() {
  const c = ENGS.cyc; if (!c) return null;
  const offs = cylOffsets(), rpm = SIM.state.rpm, dt = TH.dtheta / (6 * rpm);
  const px = new Float32Array(NTH), ps = new Float32Array(NTH);
  let PX = ENGS.px, PS = ENGS.ps;
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < NTH; i++) {
      let mo = 0, mi = 0;
      for (let k = 0; k < CFG.nCyl; k++) { const j = ((i - Math.round(offs[k] / TH.dtheta)) % NTH + NTH) % NTH; mo += c.out.mOut[j]; mi += c.out.mIn[j]; }
      const mdT = TCM.turbFlow(PX, ENGS.Tx, ENGS.po);
      PX += dt * TH.R * ENGS.Tx / TH.Vx * (mo - mdT);
      PS += dt * TH.R * ENGS.Ts / TH.Vs * (ENGS.mdC - mi);
      px[i] = PX; ps[i] = PS;
    }
    // 평균값을 평균값 모델에 맞춤 (선형 드리프트 제거)
    let ax = 0, as = 0; for (let i = 0; i < NTH; i++) { ax += px[i]; as += ps[i]; } ax /= NTH; as /= NTH;
    for (let i = 0; i < NTH; i++) { px[i] += ENGS.px - ax; ps[i] += ENGS.ps - as; }
    PX = px[NTH - 1]; PS = ps[NTH - 1];
  }
  return { px, ps };
}
// 표시용 조회 (θ: 해당 실린더 크랭크각)
const TQ = {
  idx: th => { const x = wrap360(th) / TH.dtheta, i = Math.floor(x) % NTH; return [i, (i + 1) % NTH, x - Math.floor(x)]; },
  get(arr, th) { const [i, j, f] = TQ.idx(th); return arr[i] + (arr[j] - arr[i]) * f; },
  p: th => ENGS.cyc ? TQ.get(ENGS.cyc.out.p, th) / 1e5 : 1,
  T: th => ENGS.cyc ? TQ.get(ENGS.cyc.out.T, th) : 300,
  xf: th => ENGS.cyc ? TQ.get(ENGS.cyc.out.xf, th) : 0,
  summary() {
    const c = ENGS.cyc, st = SIM.state, S = c.S, rpm = st.rpm, Vd = GEO.Vd();
    const imep = S.W / Vd / 1e5, Pi = S.W * CFG.nCyl * rpm / 60 / 1000;
    const idxEvc = Math.round(CFG.evc / TH.dtheta) % NTH;
    const mTr = c.out.m[idxEvc], xbTr = c.out.xb[idxEvc];
    const rhoS = ENGS.ps / (TH.R * ENGS.Ts);
    const mfDot = S.Mf * CFG.nCyl * rpm / 60;
    const airDot = Math.max(0, S.Min) * CFG.nCyl * rpm / 60;
    return {
      imep, Pi, pmax: S.pmax / 1e5, thPmax: wrap360(S.thPmax), mTr, scav0D: 1 - xbTr,
      delivery: S.Min / (rhoS * Vd), lambda: mfDot > 0 ? airDot / (mfDot * TH.AFRst) : Infinity,
      sfc: Pi > 0 ? mfDot * 3.6e9 / (Pi * 1000) / 1000 : 0, etaI: S.Qc > 0 ? S.W / (S.Mf * TH.LHV) : 0,
      Tx: ENGS.Tx, Tout: ENGS.Tx * (1 - TH.etaT * (1 - Math.pow(ENGS.po / ENGS.px, (TH.gG - 1) / TH.gG))), Ts: ENGS.Ts,
      massErr: (S.Min - S.Mout + S.Mf) / Math.max(1e-9, S.Min), energyErr: (S.Qc + S.Hin - S.Hout - S.W - S.Qw) / Math.max(1, S.Qc + Math.abs(S.Hin)),
      qwFrac: S.Qc > 0 ? S.Qw / S.Qc : 0, airDot, mfDot,
    };
  },
};
// ---- 2D 유동장 계산 입력 (0D 사이클 결과를 0.5° 간격 배열로) ----
function fieldJob(id, quality = 1) {
  const c = ENGS.cyc, rpm = SIM.state.rpm, H = M.headY();
  const crown = new Float32Array(NTH), vp = new Float32Array(NTH), lift = new Float32Array(NTH), since = new Float32Array(NTH), rho = new Float32Array(NTH);
  for (let i = 0; i < NTH; i++) {
    const th = i * TH.dtheta;
    crown[i] = M.crownY(th);
    vp[i] = (M.crownY(th + 0.05) - M.crownY(th - 0.05)) / 0.1 * 6 * rpm;
    lift[i] = M.evLift01(th); since[i] = wrapS(th - CFG.soi); rho[i] = c.out.m[i] / c.out.V[i];
  }
  const noz = [-35, -145].map(ang => {
    const a = ang * DEG, x = 0.262 * Math.cos(a);
    let dx = -Math.cos(a) * 0.75 - Math.sin(a) * 0.45, dy = -0.32; const l = Math.hypot(dx, dy); dx /= l; dy /= l;
    return { x, y: H - 0.04, dx, dy };
  });
  const [po] = M.portAngles();
  return {
    id, NX: quality ? 24 : 16, NY: Math.round((H - M.crownBDC()) / (CFG.bore / (quality ? 24 : 16))),
    B: CFG.bore, y0: M.crownBDC(), yH: H, portTop: M.portTop(), portBot: M.portBot(), rv: TH.dv / 2,
    rpm, crown, vp, lift, since, rho, mIn: c.out.mIn, mOut: c.out.mOut, Tm: c.out.T, dQ: c.out.qc, mCyl: c.out.m,
    rhoIn: ENGS.ps / (TH.R * ENGS.Ts), rhoX: ENGS.px / (TH.R * ENGS.Tx), Ts: ENGS.Ts, Tx: ENGS.Tx, Tw: TH.Tw,
    LHV: TH.LHV, AFR: TH.AFRst, injDur: M.injDur(SIM.state.load), noz, po, evc: CFG.evc, cycles: quality ? 3 : 2,
  };
}

