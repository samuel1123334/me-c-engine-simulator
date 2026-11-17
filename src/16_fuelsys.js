// ===================================================================
// 16 · FUEL & HYDRAULIC SYSTEM STATE — system state used by the device internal views (educational mean-value model)
//  Confirmed from references: supply pump about 4 bar, circulating pump 10 bar, engine inlet (fuel pump level) 7–8 bar,
//              HPS 200/300 bar (by load), safety valves 310/315 bar, injection pressure 600–1000 bar (by load),
//              fuel valve opening pressure 350–380 bar, injection viscosity about 13 cSt, exhaust valve air spring 7 bar.
//  Educational assumptions: fuel grade (380 cSt @ 50 °C), circulation flow, heater NTU, filter clogging rate, pump displacement and step-up ratio,
//              booster area ratio, exhaust valve actuator flow, accumulator volume and pre-charge.
// ===================================================================
const FSP = {
  v50: 380, B: 3.337,             // Walther equation: loglog(ν+0.7) = A − B·log10(T[K]) — B chosen so that 380 cSt @ 50 °C gives 13 cSt @ about 140 °C (edu)
  rho: 950, cp: 2.0e3,            // HFO density kg/m³, specific heat J/kgK (edu)
  Tsvc: 90,                       // service tank temperature °C (edu)
  Qcirc: 2.2,                     // circulating pump flow kg/s ≈ 8.3 m³/h (about 3× rated consumption, edu)
  pSupply: 4.0, pCirc: 10.0, pInlet: 8.0,     // bar g (ref: 4 / 10 / 7–8 bar)
  viscSet: 13,                    // cSt (ref: about 13 cSt)
  Tsteam: 170.4, hfg: 2.05e6,     // 7 bar g saturated steam temperature °C, latent heat J/kg (property data)
  NTU: 1.25, heaterTau: 25,       // heater maximum NTU, outlet temperature time constant s (edu)
  Kp: 0.035, Ki: 0.012,           // viscosity control PI (edu)
  filterFine: 50,                 // full-flow filter mesh size µm (edu — type and mesh size not given in the MAN documents)
  clogRate: 1 / 7200,             // clogging rate 1/s (fully clogged after 2 h simulated time, accelerated for teaching)
  // HPS
  pSysLo: 200, pSysHi: 300, pSwitch: 0.5,      // bar, load switch-over point (ref: two steps of 200/300 bar; switch-over point is edu)
  relief: [310, 315],             // safety valves bar (ref)
  nEngPumps: 3, gear: 16, Vpump: 250,          // number of engine-driven pumps (ref: 3–5), step-up ratio and displacement cm³/rev (edu)
  areaRatio: 3.3,                 // booster hydraulic piston / fuel plunger area ratio (edu: 300 bar × 3.3 ≈ 1000 bar)
  Vev: 0.30,                      // control oil used per exhaust valve opening L (edu)
  leak: 0.05,                     // extra consumption ratio for leakage, lubricators etc. (edu)
  accV0: 6.0, accPre: 0.65,       // HCU accumulator volume L, pre-charge / working pressure ratio (edu)
};
const loglog = v => Math.log10(Math.log10(v + 0.7));
const FUEL = {
  A: () => loglog(FSP.v50) + FSP.B * Math.log10(323.15),
  visc(Tc) { const x = FUEL.A() - FSP.B * Math.log10(Tc + 273.15); return Math.pow(10, Math.pow(10, x)) - 0.7; },
  tempFor(v) { const x = loglog(v); return Math.pow(10, (FUEL.A() - x) / FSP.B) - 273.15; },
};
// State (integrated over simulated time)
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
    // Venting/mixing: make-up from the service tank (= consumption) + engine return
    FSS.supply = mf; FSS.ret = Math.max(0, FSP.Qcirc - mf);
    const Tret = FSS.Tout - 6;                             // cools slightly in the engine piping (edu)
    FSS.Tin = (FSS.supply * FSP.Tsvc + FSS.ret * Tret) / FSP.Qcirc;
    // Viscosity PI control → steam valve opening y
    const err = FSS.visc - FSP.viscSet;                    // heat more when viscosity is high
    FSS.integ = clamp(FSS.integ + FSP.Ki * err * h, 0, 1);
    FSS.y = clamp(FSS.integ + FSP.Kp * err, 0, 1);
    // Heater: fixed steam condensing temperature, ε = 1 − exp(−y·NTU)
    const Teq = FSP.Tsteam - (FSP.Tsteam - FSS.Tin) * Math.exp(-FSS.y * FSP.NTU);
    FSS.Tout += (Teq - FSS.Tout) * (1 - Math.exp(-h / FSP.heaterTau));
    FSS.visc = FUEL.visc(FSS.Tout);
    FSS.Q = FSP.Qcirc * FSP.cp * Math.max(0, FSS.Tout - FSS.Tin);
    FSS.steam = FSS.Q / FSP.hfg; FSS.cond = FSS.steam;
    // Full-flow filter: laminar resistance ∝ viscosity × flow, clogging grows (on the side in use only)
    FSS.clog[FSS.side] = Math.min(1, FSS.clog[FSS.side] + FSP.clogRate * h);
    const c = FSS.clog[FSS.side];
    FSS.dpF = 0.012 * FSS.visc * (FSP.Qcirc / 2.2) * (1 + 6 * c * c);   // bar (edu)
    // Pressure control valve: holds 8 bar at the engine inlet, passes return flow to the 4 bar side
    const dpV = Math.max(0.3, FSP.pInlet - FSP.pSupply);
    FSS.pcv = clamp(FSS.ret / (1.0 * Math.sqrt(dpV)), 0.02, 1);
    FSS.pIn = FSP.pInlet; FSS.pRet = FSP.pSupply;
  }
  stepHPS();
}
function hpsDemandLps() {
  // Consumption per cylinder per cycle: booster (fuel volume × area ratio) + exhaust valve actuator, plus leakage
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
// ---- HCU internal state at reference-cylinder crank angle θ (build a one-cycle table and interpolate) ----
const HCU = { key: '', n: 720, boost: null, acc: null, fiva: null };
function buildHcuTables() {
  const load = SIM.state.load, key = [load.toFixed(3), CFG.soi, CFG.injDur0, CFG.injDur1, CFG.evo, CFG.evc, FSS.pSet].join('|');
  if (key === HCU.key) return;
  const n = HCU.n, d = 360 / n, B = new Float32Array(n), A = new Float32Array(n), F = new Float32Array(n), cons = new Float32Array(n);
  // Booster piston position: rises with cumulative injected quantity during injection, returns over 40° after injection (fuel refilled through the suction valve)
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
    // FIVA main spool: +1 = P→Cfi (injection), −1 = P→Cva (hold exhaust valve open), 0 = Cfi→Tfi · Cva→Tva (drain)
    const w = (a, b, x) => smooth01((x - a) / 2) * (1 - smooth01((x - b) / 2));
    const injCmd = load > 0.005 ? w(-3, D, wrapS(th - CFG.soi)) : 0;
    const evCmd = w(CFG.evo - 4, CFG.evc - CFG.evCloseRamp, th);
    F[i] = injCmd - evCmd;
  }
  // Consumption (L/°): booster rise rate × piston volume + exhaust valve opening rate × actuator volume
  const vB = load * TH.mfMCR / FSP.rho * 1000 * FSP.areaRatio;
  for (let i = 0; i < n; i++) { const dB = Math.max(0, B[(i + 1) % n] - B[i]); const dE = Math.max(0, M.evLift01((i + 1) * d) - M.evLift01(i * d)); cons[i] = dB * vB + dE * FSP.Vev; }
  let sum = 0; for (let i = 0; i < n; i++) sum += cons[i];
  const qIn = sum * (1 + FSP.leak) / n;               // supply is the cycle average (comes in from the distribution pipe)
  // Accumulator oil volume change → nitrogen volume → pressure (adiabatic n = 1.4)
  const p0 = FSP.accPre * FSS.pSet, Vg0 = FSP.accV0 * Math.pow(p0 / FSS.pSet, 1 / 1.4);   // nitrogen volume at working pressure
  let v = 0, vmin = 1e9, vmax = -1e9; const V = new Float32Array(n);
  for (let i = 0; i < n; i++) { V[i] = v; v += qIn - cons[i] * (1 + FSP.leak); vmin = Math.min(vmin, V[i]); vmax = Math.max(vmax, V[i]); }
  const vMean = vmax;                                   // fullest oil volume = HPS set pressure (the pressure-compensated pumps do not go higher)
  for (let i = 0; i < n; i++) { const Vg = Vg0 - (V[i] - vMean); A[i] = FSS.pSet * Math.pow(Vg0 / Vg, 1.4); }
  HCU.boost = B; HCU.acc = A; HCU.fiva = F; HCU.cons = cons; HCU.vOil = V; HCU.vMean = vMean; HCU.Vg0 = Vg0; HCU.p0 = p0; HCU.key = key;
}
function hcuAt(arr, th) { buildHcuTables(); if (typeof arr === 'string') arr = HCU[arr]; const x = wrap360(th) / (360 / HCU.n), i = Math.floor(x) % HCU.n, f = x - Math.floor(x); return arr[i] + (arr[(i + 1) % HCU.n] - arr[i]) * f; }
// Injection pressure: system pressure × area ratio (during injection), supply pressure otherwise
function injPressure(th) { const b = M.inj01(th, SIM.state.load); return b > 0 ? 10 + (FSS.pSys * FSP.areaRatio - 10) * b : 8; }
