// ===================================================================
// 10 · MODEL — pure functions. Every part position, state and value is computed from crank angle (θ).
// Units: m, deg (crank angle, TDC = 0, increasing in the direction of rotation), bar
// ===================================================================
const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth01 = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const easeCos = t => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t, 0, 1));
const wrap360 = a => ((a % 360) + 360) % 360;
const wrapS = a => { a = wrap360(a); return a >= 180 ? a - 360 : a; };

// Settings. src: 'ref' = confirmed from references, 'edu' = educational assumption, 'calc' = derived from other values
const CFG = {
  bore: 0.60,        // S60ME-C series bore 600 mm (nominal bore) — ref
  stroke: 2.40,      // stroke 2400 mm (S60 series) — edu (typical value)
  conrod: 2.60,      // connecting-rod length — edu
  pistonH: 4.60,     // crosshead pin centre → top of piston crown — edu
  cr: 18,            // geometric compression ratio → used to compute the clearance height — edu
  portTopMM: 0,      // top of scavenge ports (from crown at BDC, mm) — computed in init for 140°
  portBotMM: 6,      // bottom of scavenge ports (from crown at BDC, mm) — edu
  evo: 110,          // exhaust valve opening — ref (typical value 'about 110° ATDC')
  evc: 255,          // exhaust valve fully closed — edu (ME-C controls this electronically by load)
  evOpenRamp: 24, evCloseRamp: 36,
  evLiftMax: 0.11,   // maximum lift for display — edu
  soi: -2,           // start of injection (relative to TDC, negative = BTDC) — edu
  injDur0: 8, injDur1: 18, // injection duration (0 % / 100 % load) — edu
  ignDelay: 2.5,     // ignition delay — edu
  nCyl: 6, pitch: 1.02, // cylinder pitch 1020 mm (S60ME-B project guide value) — ref
  firingOrder: [1, 5, 3, 4, 2, 6], // firing order — edu
  auxOn: 0.55, auxOff: 0.70, // auxiliary blower start/stop scavenge pressure (bar g) — edu, sources differ
  rpmMCR: 105,       // S60ME series rated 105 r/min — ref (project guide example)
};
const CFG_DEFAULT = JSON.parse(JSON.stringify(CFG));

const SRC = {
  bore: 'ref', stroke: 'edu', conrod: 'edu', pistonH: 'edu', cr: 'edu', portTopMM: 'calc', portBotMM: 'edu',
  evo: 'ref', evc: 'edu', soi: 'edu', injDur0: 'edu', injDur1: 'edu', ignDelay: 'edu',
  pitch: 'ref', firingOrder: 'edu', auxOn: 'edu', auxOff: 'edu', rpmMCR: 'ref'
};

const M = {
  r: () => CFG.stroke / 2,
  // Crank pin centre (relative to the crankshaft centre). Assumes clockwise rotation seen from the front (fore end)
  pin(t) { const r = M.r(); return { x: r * Math.sin(t * DEG), y: r * Math.cos(t * DEG) }; },
  // Crosshead pin height: y = r cosθ + √(L² − r² sin²θ)
  xhY(t) { const r = M.r(), L = CFG.conrod, s = Math.sin(t * DEG); return r * Math.cos(t * DEG) + Math.sqrt(L * L - r * r * s * s); },
  // Connecting-rod angle (from vertical, positive when the big end is on the +x side)
  rodAngle(t) { return Math.asin(M.r() * Math.sin(t * DEG) / CFG.conrod); },
  crownY(t) { return M.xhY(t) + CFG.pistonH; },
  crownTDC() { return CFG.conrod + M.r() + CFG.pistonH; },
  crownBDC() { return CFG.conrod - M.r() + CFG.pistonH; },
  clearance() { return CFG.stroke / (CFG.cr - 1); },
  headY() { return M.crownTDC() + M.clearance(); },
  pistonFromTDC(t) { return M.crownTDC() - M.crownY(t); },
  portTop() { return M.crownBDC() + CFG.portTopMM / 1000; },
  portBot() { return M.crownBDC() + CFG.portBotMM / 1000; },
  // Port opening fraction: how far the top of the piston crown has dropped below the top of the ports (liner geometry × piston position)
  portFrac(t) { const c = M.crownY(t), a = M.portTop(), b = M.portBot(); return clamp((a - c) / (a - b), 0, 1); },
  // Crank angle at which the crown passes the top of the ports (solved back from the geometry)
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
  // Wiebe cumulative burn fraction — simple educational model
  burned(t, load) {
    if (load <= 0.005) return 0;
    const a = wrap360(t - CFG.soi - CFG.ignDelay), D = M.burnDur(load);
    const lim = wrap360(CFG.evo - CFG.soi - CFG.ignDelay);
    if (a > lim) return 0;           // after exhaust ~ before the next injection
    const x = clamp(a / D, 0, 1);
    return 1 - Math.exp(-6.9 * Math.pow(x, 1.6));
  },
  // Combustion display intensity (0–1): highest during heat release, gone before the exhaust valve opens
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
    if (load > 0.005 && d >= 0 && d < D) return { k: 'inj', ko: 'Fuel injection · compression ignition' };
    if (a >= CFG.evo && a < po) return { k: 'blow', ko: 'Exhaust valve open · blowdown' };
    if (a >= po && a < pc && a < CFG.evc) return { k: 'scav', ko: 'Scavenging · exhaust overlap (ports + exhaust valve open)' };
    if (a >= po && a < pc) return { k: 'scav2', ko: 'Scavenge ports open only (exhaust valve closed)' };
    if (a >= pc && a < CFG.evc) return { k: 'post', ko: 'Ports closed · before exhaust valve closes (residual exhaust out)' };
    if (d < 0) return { k: 'comp', ko: 'Piston rising · air compression' };
    return { k: 'exp', ko: 'Combustion · expansion (piston descending)' };
  },
  // ---- (old) simple pressure formula: replaced by the 0D model. The wrapper below returns the 0D result ----
  pscavG_old(load) { return 0.05 + 2.8 * Math.pow(clamp(load, 0, 1), 1.6); }, // about 3.85 bar abs at 100 %
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

// Crank-angle offset per cylinder (evenly spread by firing order)
function cylOffsets() {
  const n = CFG.nCyl, step = 360 / n, off = new Array(n).fill(0);
  CFG.firingOrder.forEach((c, i) => { off[c - 1] = i * step; });
  return off;
}

// Cumulative scavenging/blowdown progress table (0.5° steps) — for in-cylinder particle positions
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

