// ===================================================================
// 57 · Device internals — control oil (hydraulic) system: HPS swashplate axial piston pump, automatic back-flushing filter, HCU accumulator, FIVA, fuel booster, exhaust valve actuator
// ===================================================================
const HYD = { pRel: 0, flushT: 0, flushing: false, flushK: -1, dpAF: 0.25, test: false };
const thOfRef = () => wrap360(SIM.state.theta - cylOffsets()[SIM.state.ref]);

// ---------------- HPS (variable-displacement swashplate axial piston pump + safety and accumulator block) ----------------
defDevice('hps', {
  ko: 'HPS hydraulic power supply', en: 'Hydraulic power supply (swashplate axial-piston pump)', sys: 'Control oil (hydraulic) system', parts: ['hps', 'startpump', 'ctrlrail'],
  principle: `<p>The HPS filters system lube oil through the automatic back-flushing filter, raises it to 200–300 bar and sends it to each cylinder’s HCU. There are three engine-driven pumps (driven from the crankshaft through a step-up gear) and two electric pumps for starting and low speed; a safety and accumulator block collects the pump outlets.</p>
  <p>The engine-driven pump shown here is a <b>variable-displacement swashplate axial piston pump</b>. As the cylinder block turns with the shaft, the slippers of its nine pistons slide over the tilted swashplate: for half a turn each piston is drawn out of its bore and sucks oil from the suction port (kidney), and for the other half it is pushed back in and delivers oil to the delivery port. Displacement per revolution = number of pistons × piston area × 2·r·tan(swash angle).</p>
  <p>A pressure compensator changes the swash angle: when pressure reaches the set point, the angle reduces so the pump delivers only what is needed. The swash angle therefore follows the engine’s control oil consumption (boosters + exhaust valves). The set pressure switches between 200 and 300 bar with load, and the safety valves are set at 310 / 315 bar.</p>`,
  sources: [
    { t: 'ref', text: 'MAN B&W ME engines · Hydraulic Power Supply: engine-driven and electric pumps, automatic filter, safety and accumulator block', url: 'https://www.merchantnavydecoded.com/?p=90586' },
    { t: 'ref', text: 'MAN B&W Project Guide · Hydraulic power supply (200/300 bar, safety valves)', url: 'https://www.man-es.com/applications/projectguides/2stroke/content/printed/S60ME-C10_5.pdf' },
    { t: 'ref', text: 'Bosch Rexroth A4VSO variable swashplate pump construction', url: 'https://www.boschrexroth.com/en/xc/products/product-groups/mobile-hydraulics/axial-piston-pumps/variable-pumps/a4vso' },
    { t: 'edu', text: 'Pump displacement 250 cm³/rev, step-up ratio 16, maximum swash angle 15° and the block layout are educational assumptions' }],
  view: { t: [0.3, 0.05, -0.1], d: [0.2, 0.45, 1], k: 0.7 },
  controls: () => `<p class="empty" style="margin:0;font-size:11.5px">Moving the load slider below or above 50 % switches the set pressure between 200 and 300 bar; the swash angle changes with load and speed.</p>`,
  build(root) {
    const P = new THREE.Group(); P.rotation.z = -Math.PI / 2; P.position.set(-0.35, 0.05, 0); root.add(P);   // local +Y → world +X
    const ys = -0.42, rb = 0.2, Np = 9;
    dpart(P, vesselY(0.42, -0.68, 0.24, 0.03, 0.08, { top: false }), DC.paint, { ko: 'Pump housing', en: 'Pump housing', d: 'The case is full of leakage oil (case drain), which returns to the tank through the drain pipe.' });
    dpart(P, ringG(0.06, 0.45, 0.2, 0.28, 40), DC.castL, null);
    // Drive shaft + bearings
    const shaft = new THREE.Group(); P.add(shaft);
    dpart(shaft, cylY(0.055, -1.15, 0.46, 24), DC.steelL, { ko: 'Drive shaft', en: 'Drive shaft', d: 'Driven from the engine crankshaft through a step-up gear (16×, educational). Turns the cylinder block with it through a spline.' });
    dpart(shaft, box(0.04, 0.12, 0.03, 0, -1.05, 0.045, 0.005), DC.steelD, null);
    dpart(P, ringG(0.056, 0.13, -0.66, -0.56, 28), DC.bronze, { ko: 'Shaft bearing', en: 'Shaft bearing', d: 'Roller bearing taking radial and axial loads.' });
    dpart(P, ringG(0.056, 0.1, -0.8, -0.68, 24), DC.carbon, { ko: 'Shaft seal', en: 'Shaft seal', d: '', label: false });
    // Swashplate (cradle) + stroking piston
    const sw = new THREE.Group(); sw.position.y = ys; P.add(sw);
    dpart(sw, lathe([[0.07, -0.08], [0.34, -0.08], [0.34, 0.0], [0.07, 0.0]], 40), DC.steelD, { ko: 'Swashplate (cradle)', en: 'Swashplate (cradle)', d: 'Its tilt (swash angle) sets the piston stroke. At 0° the stroke is zero; at the maximum of about 15° delivery is greatest. It tilts on cradle bearings.' });
    dpart(sw, ringG(0.07, 0.3, 0.0, 0.012, 40), DC.bronze, null);
    const ctlP = new THREE.Group(); ctlP.position.set(0, ys, 0.0); P.add(ctlP);
    dpart(P, cylX(0.07, 0.36, 0.62, 24).translate(0, ys + 0.02, 0), DC.castL, { ko: 'Stroking cylinder', en: 'Stroking cylinder', d: 'Piston that pushes the swashplate with control pressure. The pressure compensator sets this pressure.' });
    const stroker = dpart(P, cylX(0.05, 0.3, 0.56, 20).translate(0, ys + 0.02, 0), DC.steelL, { ko: 'Stroking piston', en: 'Stroking piston', d: 'Piston that changes the swash angle. Reduces the angle when pressure rises above the set point.' });
    // Cylinder block (9 bores)
    const blk = new THREE.Group(); P.add(blk);
    const holes = [{ circle: [0, 0, 0.058] }]; for (let i = 0; i < Np; i++) { const a = i / Np * Math.PI * 2; holes.push({ circle: [rb * Math.cos(a), rb * Math.sin(a), 0.052] }); }
    dpart(blk, extXZ(xzShape(arcPts(0, 0, 0.31, 0, 360, 48).map(p => [p[0], p[1]]), holes), -0.2, 0.2), DC.bronze, { ko: 'Cylinder block (barrel)', en: 'Cylinder block', d: 'Turns with the shaft and carries nine pistons. Its end face slides over the valve plate so each bore connects in turn to the suction and delivery kidneys.' }, { metal: 0.6 });
    const pistons = [];
    for (let i = 0; i < Np; i++) {
      const a = i / Np * Math.PI * 2, g = new THREE.Group(); g.position.set(rb * Math.cos(a), 0, rb * Math.sin(a)); blk.add(g);
      const pi = i === 0 ? { ko: 'Piston · slipper', en: 'Piston & slipper', d: 'A slipper on a ball joint slides over the swashplate. High-pressure oil leaks out under the slipper to form an oil film (hydrostatic bearing) that cuts friction.' } : null;
      const pg = dgroup(g, pi);
      dadd(pg, cylY(0.05, 0.05, 0.5, 18), DC.steelL); dadd(pg, sphere(0.045, 0, 0.05, 0), DC.steelL); dadd(pg, cylY(0.07, 0.0, 0.03, 18), DC.bronze);
      pistons.push({ g, a });
    }
    dpart(blk, ringG(0.27, 0.31, -0.25, -0.2, 40), DC.steelD, null);
    // Valve plate (kidney ports)
    const kid = (cx, sgn) => { const p = []; for (let i = 0; i <= 16; i++) { const t = (-50 + 100 * i / 16) * DEG; p.push([sgn * rb * Math.cos(t) + sgn * 0.0, rb * Math.sin(t)]); } return p; };
    const kidHole = sgn => { const out = [], inn = []; for (let i = 0; i <= 16; i++) { const t = (-55 + 110 * i / 16) * DEG; out.push([sgn * (rb + 0.04) * Math.cos(t), (rb + 0.04) * Math.sin(t)]); inn.push([sgn * (rb - 0.04) * Math.cos(t), (rb - 0.04) * Math.sin(t)]); } return out.concat(inn.reverse()); };
    dpart(P, extXZ(xzShape(arcPts(0, 0, 0.31, 0, 360, 48).map(p => [p[0], p[1]]), [{ circle: [0, 0, 0.06] }, kidHole(1), kidHole(-1)]), 0.2, 0.24), DC.brass, { ko: 'Valve plate (kidney ports)', en: 'Valve plate with kidney ports', d: 'Stationary plate with two kidney-shaped openings. The half turn in which the pistons move out connects to the suction kidney; the half turn in which they are pushed in connects to the delivery kidney.' });
    dpart(P, extXZ(xzShape(arcPts(0, 0, 0.45, 0, 360, 48).map(p => [p[0], p[1]]), [{ circle: [0, 0, 0.06] }, kidHole(1), kidHole(-1)]), 0.28, 0.5), DC.castL, { ko: 'Port cover', en: 'Port block (end cover)', d: 'Cover with the suction port (large opening) and the high-pressure delivery port.' });
    dpart(P, pipeAlong('x', 0.11, 0.36, 0.95, 0.4, 0, 0.015, true), DC.steelD, { ko: 'Suction pipe', en: 'Suction (from automatic filter)', d: 'System oil that has passed the automatic back-flushing filter.' });
    dpart(P, pipeAlong('x', 0.06, -0.95, -0.2, 0.4, 0, 0.015, true), DC.steelD, { ko: 'HP delivery pipe', en: 'HP outlet', d: 'Enters the safety and accumulator block at 200–300 bar.' });
    // Pressure compensator
    dpart(P, box(0.26, 0.18, 0.2, -0.33, 0.12, 0, 0.02), DC.motor, { ko: 'Pressure compensator', en: 'Pressure compensator', d: 'Small spool valve that compares delivery pressure with a spring-set pressure. If pressure is high it sends oil to the stroking piston to reduce the swash angle; if low it releases oil to increase it. On the ME, the set pressure is changed by an ECS signal.' });
    dfluid(P, cylY(0.39, -0.62, 0.2, 36), 'oilLo', 0.08);
    // Safety and accumulator block
    const B = new THREE.Group(); B.position.set(0.75, 0.85, 0); root.add(B);
    dpart(root, pipeAlong('x', 0.06, 0.05, 0.5, 0.85, 0, 0.015), DC.steelD, null);
    dpart(B, box(0.5, 0.36, 0.34, 0, 0, -0.0, 0.03), DC.castL, { ko: 'Safety and accumulator block', en: 'Safety and accumulator block', d: 'Collects the pumps’ delivery and sends it to the HCU distribution pipe. Carries non-return valves, safety valves and accumulators.' });
    const accs = [];
    [-0.13, 0.13].forEach((x, k) => {
      const g = new THREE.Group(); g.position.set(x, 0.18, 0); B.add(g);
      dpart(g, vesselY(0.1, 0, 0.62, 0.012, 0.08), DC.red, k ? null : { ko: 'Accumulator (nitrogen bladder)', en: 'Bladder accumulator', d: 'A rubber bladder filled with nitrogen absorbs pump pulsation and sudden demand.' });
      accs.push(dfluid(g, sphere(0.075).scale(1, 2.6, 1).translate(0, 0.38, 0), 'gas', 0.35));
    });
    const rv = new THREE.Group(); rv.position.set(0, -0.18, 0); B.add(rv);
    dpart(rv, vesselY(0.06, -0.42, 0, 0.012, 0.02), DC.steelD, { ko: 'Safety valve', en: 'Safety valve (310/315 bar)', d: 'Opens and returns oil to the tank if pressure exceeds 310 bar (above low-pressure mode) / 315 bar. Closed in normal running.' });
    const rvp = dpart(rv, lathe([[0, -0.1], [0.04, -0.06], [0.04, -0.02], [0, -0.02]]), DC.steelL, null);
    dpart(rv, springG(0.032, -0.36, -0.1, 6, 0.007), DC.spring, null);
    dpart(B, pipeAlong('x', 0.045, 0.25, 0.75, 0.0, 0, 0.012, true), DC.steelL, { ko: 'Double-walled HP distribution pipe', en: 'Double-wall HP pipe to HCUs', d: 'The outer pipe encloses the inner HP pipe so any leak is contained and sent to a leak detector.' });
    dpart(B, ringX(0.055, 0.068, 0.3, 0.75, 20), DC.steelD, null, { opacity: 0.35 });
    const gP = dgauge(root, 0.35, 1.25, 0.05, 0.11, 'System', 0, 400, 'bar', { ko: 'System pressure gauge', en: 'System pressure', d: '' });
    // Flow
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
    return kvRow('Set pressure', `${FSS.pSet.toFixed(0)} bar`, 'ref') + kvRow('Load / speed', `${(SIM.state.load * 100).toFixed(0)} % / ${SIM.state.rpm.toFixed(0)} r/min`)
      + kvRow('Pump speed', `${FSS.pumpN.toFixed(0)} r/min`, 'edu') + kvRow('Swash angle', `${(FSS.swash * 15).toFixed(1)}° (${(FSS.swash * 100).toFixed(0)} %)`, 'calc')
      + kvRow('Control oil use (engine)', `${FSS.qDem.toFixed(2)} L/s`, 'calc') + kvRow('Delivery per pump', `${pumpQ.toFixed(2)} L/s`, 'calc')
      + kvRow('Maximum supply (3 pumps)', `${FSS.qMaxEng.toFixed(1)} L/s`, 'edu') + kvRow('Hydraulic power', `${FSS.powerKW.toFixed(0)} kW`, 'calc')
      + kvRow('Electric start-up pump', FSS.startPumps ? 'Running' : 'Standby', 'calc') + kvRow('Safety valve settings', `${FSP.relief[0]} / ${FSP.relief[1]} bar`, 'ref');
  },
});

// ---------------- Automatic back-flushing filter ----------------
defDevice('autofilter', {
  ko: 'Automatic back-flushing filter', en: 'Automatic back-flushing filter', sys: 'Control oil (hydraulic) system', parts: ['autofilter'],
  principle: `<p>Filter for the system oil going to the HPS (10 µm, educational). Oil enters from below and is filtered as it flows from the <b>inside to the outside</b> of the filter candles arranged in a ring; clean oil leaves from the space outside the candles in the housing.</p>
  <p>When dirt builds up inside the candles and the differential pressure reaches the set point (or after a set time), the flushing arm at the bottom starts turning. When the arm comes under a candle’s inlet, only that candle is connected to the drain (low pressure), so clean oil from outside flows <b>backwards</b> through it and washes the dirt down. The other candles keep filtering meanwhile, so the flow is never interrupted.</p>
  <p>The flushing oil goes to a drain tank, and a redundant filter (25 µm, educational) in series after this filter covers a failure of the automatic filter.</p>`,
  sources: [
    { t: 'ref', text: 'MAN B&W ME · HPS automatic filter (back-flushing, redundant filter)', url: 'https://www.merchantnavydecoded.com/?p=90586' },
    { t: 'ref', text: 'BOLL & KIRCH 6.64 automatic filter principle', url: 'https://www.bollfilter.com/en/products/automatic-filters' },
    { t: 'edu', text: 'Mesh sizes 10 µm / 25 µm, number of candles, flushing differential pressure 0.6 bar and fouling rate are educational assumptions' }],
  view: { t: [0, 0.2, -0.1], d: [0.25, 0.35, 1], k: 0.78 },
  controls: () => `<button class="btn" id="dvFlush" style="width:100%">Back-flush now</button>${timeCtl()}`,
  bind() { $('dvFlush').onclick = () => { HYD.flushing = true; HYD.flushT = 0; }; bindTime(); },
  build(root) {
    const Nc = 12, rc = 0.26;
    dpart(root, vesselY(0.48, -0.75, 0.95, 0.025, 0.14, { bot: false }), DC.paint, { ko: 'Filter housing', en: 'Housing (clean side)', d: 'The space outside the candles is full of clean filtered oil.' });
    dpart(root, lathe([[0, -0.95], [0.5, -0.95], [0.5, -0.75], [0.46, -0.75], [0.46, -0.9], [0, -0.9]]), DC.castL, { ko: 'Lower body (dirty side)', en: 'Lower body (dirty side)', d: '' , label: false });
    dpart(root, cylY(0.46, -0.6, -0.55, 40), DC.steelD, { ko: 'Candle plate', en: 'Candle plate', d: 'Plate with the candle inlet holes in a ring. Dirty side below, clean side above.' });
    const cands = [];
    for (let i = 0; i < Nc; i++) {
      const a = (i + 0.5) / Nc * Math.PI * 2, x = rc * Math.cos(a), z = rc * Math.sin(a);
      const m = dpart(root, ringG(0.042, 0.055, -0.55, 0.62, 18).translate(x, 0, z), DC.mesh, i === Math.round(Nc * 0.75) ? { ko: 'Filter candle', en: 'Filter candle (wedge-wire)', d: 'Cylinder wound from wedge wire. Filters from inside to outside; during back-flushing it is washed from outside to inside.' } : null, { metal: 0.7, rough: 0.55 });
      const dirt = dpart(root, ringG(0.03, 0.042, -0.5, 0.58, 14).translate(x, 0, z), DC.carbon, null, { metal: 0, rough: 1 });
      cands.push({ a, x, z, m, dirt, c: 0.4 + 0.3 * Math.random() });
    }
    const arm = new THREE.Group(); arm.position.y = -0.72; root.add(arm);
    dpart(arm, box(0.34, 0.06, 0.1, rc / 2 + 0.02, 0, 0, 0.02), DC.red, { ko: 'Flushing arm', en: 'Flushing arm', d: 'Turns with the centre shaft and connects one candle inlet at a time to the drain.' });
    dpart(arm, cylY(0.05, -0.03, 0.06, 16).translate(rc, 0, 0), DC.red, null);
    dpart(root, cylY(0.035, -1.25, -0.6, 16), DC.steelL, { ko: 'Flushing drive shaft', en: 'Flushing drive shaft', d: 'Turned by the gear motor (or hydraulic motor) below.' });
    dpart(root, box(0.26, 0.22, 0.26, 0, -1.4, 0, 0.03), DC.motor, { ko: 'Gear motor', en: 'Gear motor', d: '' });
    dpart(root, pipeAlong('x', 0.08, -1.0, -0.46, -0.83, 0, 0.012, true), DC.steelD, { ko: 'Inlet (dirty oil)', en: 'Inlet (unfiltered)', d: 'Oil from the oil pan / system oil.' });
    dpart(root, pipeAlong('x', 0.08, 0.46, 1.0, 0.6, 0, 0.012, true), DC.steelD, { ko: 'Outlet (to HPS)', en: 'Outlet to HPS', d: '' });
    dpart(root, pipeAlong('y', 0.04, -1.2, -0.95, 0.3, 0, 0.01), DC.steelD, { ko: 'Back-flush drain', en: 'Back-flush drain', d: 'The washed-out dirty oil goes to the drain tank.' });
    const gdp = dgauge(root, -0.72, 0.3, 0.02, 0.1, 'Diff. pressure', 0, 1.0, 'bar', { ko: 'Differential pressure switch', en: 'Δp indicator', d: 'Back-flush start signal (0.6 bar, educational).' });
    // Redundant filter
    const rf = new THREE.Group(); rf.position.set(1.25, 0.2, 0); root.add(rf);
    dpart(rf, vesselY(0.18, -0.4, 0.4, 0.015, 0.06), DC.paint, { ko: 'Redundant filter (25 µm)', en: 'Redundant filter', d: 'Filter in series that protects the HPS even if the automatic filter fails.' });
    dpart(rf, ringG(0.06, 0.11, -0.3, 0.3, 24), DC.mesh, null);
    // Flow: each candle (only the candles on the cut side)
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
    return kvRow('Diff. pressure', `${HYD.dpAF.toFixed(2)} bar`, 'edu') + kvRow('Flushing set Δp', '0.60 bar', 'edu') + kvRow('State', HYD.flushing ? `Back-flushing (candle ${HYD.flushK >= 0 ? HYD.flushK + 1 : '-'})` : 'Filtering', 'edu')
      + kvRow('Flow through (HPS use)', `${FSS.qDem.toFixed(2)} L/s`, 'calc') + kvRow('Main filter / redundant filter', '10 µm / 25 µm', 'edu');
  },
});

// ---------------- HCU accumulator ----------------
defDevice('accum', {
  ko: 'HCU accumulator', en: 'HCU bladder accumulator', sys: 'Control oil (hydraulic) system', parts: ['accum'],
  principle: `<p>A nitrogen bladder accumulator fitted to each HCU. At the moment of injection (booster) and exhaust valve opening, far more oil is needed for a short time than the HPS supplies, so the compressed nitrogen in the bladder pushes oil out, and it refills while there is no demand.</p>
  <p>This model integrates the difference between the crank-angle consumption (booster rise rate × volume + exhaust valve opening rate × volume) and the mean supply to get the oil volume change, then computes nitrogen pressure with adiabatic compression (n = 1.4). Move the crank-angle slider to see the bladder expand and the pressure drop during injection and exhaust valve opening.</p>`,
  sources: [
    { t: 'ref', text: 'MAN B&W ME engines · HCU accumulators (nitrogen bladder)', url: 'https://www.merchantnavydecoded.com/?p=90586' },
    { t: 'edu', text: 'Accumulator volume 6 L, pre-charge = 0.65 × working pressure and adiabatic exponent 1.4 are educational assumptions' }],
  view: { t: [0, 0.4, -0.05], d: [0.25, 0.2, 1], k: 0.95 },
  build(root) {
    dpart(root, vesselY(0.3, -0.5, 1.3, 0.03, 0.28), DC.red, { ko: 'Accumulator shell', en: 'Shell', d: 'High-pressure vessel. Nitrogen charging valve on top, oil port at the bottom.' });
    const bl = new THREE.Group(); root.add(bl);
    const bladder = dpart(bl, sphere(0.25, 0, 0, 0).scale(1, 2.6, 1).translate(0, 0.62, 0), DC.rubber, { ko: 'Bladder (nitrogen)', en: 'Bladder (N₂)', d: 'Rubber bag holding nitrogen. It is squeezed smaller when oil comes in and expands when oil is pushed out.' }, { metal: 0, rough: 0.9 });
    dfluid(bl, sphere(0.235, 0, 0, 0).scale(1, 2.55, 1).translate(0, 0.62, 0), 'gas', 0.3);
    dfluid(root, cylY(0.27, -0.42, 1.0, 36), 'oil', 0.12);
    dpart(root, cylY(0.03, 1.28, 1.45, 10), DC.brass, { ko: 'Gas charging valve', en: 'Gas charging valve', d: 'Pre-charge pressure is checked and topped up periodically.' });
    const pop = dpart(root, lathe([[0, -0.5], [0.08, -0.46], [0.08, -0.42], [0, -0.4]]), DC.steelL, { ko: 'Poppet valve', en: 'Anti-extrusion poppet', d: 'Stops the bladder being forced into the port when all the oil has gone.' });
    dpart(root, pipeAlong('y', 0.06, -0.9, -0.48, 0, 0, 0.015, true), DC.steelD, { ko: 'Oil port (HCU block)', en: 'Oil port', d: '' });
    const g = dgauge(root, 0.55, 0.2, 0.02, 0.13, 'Accumulator', 150, 350, 'bar', { ko: 'Pressure', en: 'Pressure', d: '' });
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
    return kvRow('Crank angle (ref. cylinder)', `${s.th.toFixed(1)}°`, 'calc') + kvRow('Accumulator pressure', `${s.p.toFixed(1)} bar`, 'calc') + kvRow('Nitrogen volume', `${s.Vg.toFixed(2)} L`, 'calc')
      + kvRow('Pre-charge (nitrogen)', `${HCU.p0.toFixed(0)} bar`, 'edu') + kvRow('Cycle max · min', `${Math.max(...HCU.acc).toFixed(0)} / ${Math.min(...HCU.acc).toFixed(0)} bar`, 'calc');
  },
});

// ---------------- FIVA valve ----------------
defDevice('fiva', {
  ko: 'FIVA valve', en: 'FIVA valve (Fuel Injection & Valve Actuation)', sys: 'Control oil (hydraulic) system', parts: ['fiva', 'hcu', 'mpc'],
  principle: `<p>FIVA is an electronic proportional control valve, one per cylinder; a single valve controls both <b>fuel injection</b> (driving the booster) and <b>exhaust valve opening and closing</b> (driving the actuator). The cylinder control unit (CCU/MPC) sends commands timed by the crank angle encoder.</p>
  <p>A pilot valve (proportional solenoid) changes the pressure at either end of the main spool to move it, and an LVDT on the end of the main spool feeds back its actual position. With the main spool to one side (+), P → booster (Cfi); to the other side (−), P → exhaust valve actuator (Cva); in the middle (0), both outlets are open to tank, so the booster returns and the exhaust valve closes on its air spring.</p>`,
  sources: [
    { t: 'ref', text: 'MAN B&W ME engine · FIVA valve, HCU, ECS', url: 'https://wordpress-sxaew.wasmer.app/?p=589' },
    { t: 'ref', text: 'MAN Energy Solutions · ME engine control (FIVA/ELFI/ELVA)', url: 'https://www.man-es.com/marine/products/two-stroke-engines/me-c' },
    { t: 'edu', text: 'Spool land layout, port spacing and spool stroke are educational shapes chosen to show the function' }],
  view: { t: [0, 0.15, -0.05], d: [0.1, 0.35, 1], k: 0.85 },
  build(root) {
    const ports = { Tfi: -0.36, Cfi: -0.18, P: 0, Cva: 0.18, Tva: 0.36 };
    dpart(root, box(1.2, 0.5, 0.42, 0, 0, -0.0, 0.03), DC.castL, { ko: 'FIVA body (mounted on the HCU block)', en: 'Valve body', d: 'Drawn translucent so the inside is visible. In reality it is bolted to the HCU block and the ports continue as drillings in the block.' }, { opacity: 0.22 });
    dpart(root, ringX(0.07, 0.09, -0.5, 0.5, 28), DC.steelD, { ko: 'Spool sleeve', en: 'Spool sleeve', d: '' , label: false });
    const pc = { Tfi: ['Tfi', 'Tank (booster side)'], Cfi: ['Cfi', 'To booster'], P: ['P', 'HP supply'], Cva: ['Cva', 'To exhaust valve actuator'], Tva: ['Tva', 'Tank (exhaust side)'] };
    Object.entries(ports).forEach(([k, x]) => {
      const up = k.startsWith('C');
      dpart(root, pipeAlong('y', 0.03, up ? 0.07 : -0.07, up ? 0.45 : -0.45, x, 0, 0.006), k === 'P' ? DC.red : DC.steelD, { ko: `Port ${pc[k][0]}`, en: pc[k][1], d: '' });
    });
    const spool = new THREE.Group(); root.add(spool);
    const sp = dgroup(spool, { ko: 'Main spool', en: 'Main spool', d: 'Three lands open and close the ports. + gives P→Cfi (injection), − gives P→Cva (exhaust valve open), 0 gives Cfi→Tfi · Cva→Tva (drain).' });
    dadd(sp, cylX(0.025, -0.6, 0.62, 16), DC.steelL);
    [-0.42, 0, 0.42].forEach(x => dadd(sp, cylX(0.068, x - 0.04, x + 0.04, 28), DC.steelL));
    const lv = dgroup(root, { ko: 'LVDT position sensor', en: 'LVDT', d: 'An iron core on the spool end moves inside a coil and reports the position as a voltage. The controller uses it to control the spool position in closed loop.' });
    dadd(lv, ringX(0.05, 0.1, 0.62, 0.88, 24), DC.motor); dadd(lv, cylX(0.11, 0.88, 0.92, 24), DC.steelD);
    dpart(spool, cylX(0.03, 0.62, 0.8, 14), 0x8c8c8c, null);
    // Pilot valve + solenoid
    const pl = new THREE.Group(); pl.position.y = 0.42; root.add(pl);
    dpart(pl, box(0.6, 0.2, 0.3, 0, 0.1, 0, 0.02), DC.steelD, { ko: 'Pilot valve', en: 'Pilot valve', d: 'A small spool sends oil to or drains oil from the chambers at either end of the main spool to move it.' }, { opacity: 0.3 });
    const pspool = dpart(pl, cylX(0.025, -0.22, 0.22, 14).translate(0, 0.1, 0), DC.steelL, null);
    dpart(pl, ringX(0.05, 0.11, 0.3, 0.52, 24).translate(0, 0.1, 0), 0x8b6a3e, { ko: 'Proportional solenoid', en: 'Proportional solenoid', d: 'Pushes the pilot spool with a force proportional to the controller current.' }, { metal: 0.3 });
    const ledG = new THREE.MeshBasicMaterial({ color: 0x46c28a }); const led = new THREE.Mesh(sphere(0.025, 0.55, 0.25, 0.05), ledG); pl.add(led);
    dpart(root, cylX(0.05, -0.6, -0.5, 20), DC.steelD, null);
    // Flow
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
    const mode = f > 0.5 ? 'P → Cfi (injection: drive booster)' : f < -0.5 ? 'P → Cva (exhaust valve open)' : Math.abs(f) < 0.1 ? 'Neutral: Cfi→Tfi, Cva→Tva' : 'Switching';
    return kvRow('Crank angle (ref. cylinder)', `${th.toFixed(1)}°`, 'calc') + kvRow('Main spool position', `${(f * 100).toFixed(0)} %`, 'calc') + kvRow('Connection', mode)
      + kvRow('Injection command', `${wrap360(CFG.soi).toFixed(1)}° for ${M.injDur(SIM.state.load).toFixed(1)}°`, 'edu') + kvRow('Exhaust valve command', `${CFG.evo}° – ${CFG.evc}°`, 'edu') + kvRow('Supply pressure P', `${FSS.pSys.toFixed(0)} bar`, 'ref');
  },
});

// ---------------- Fuel pressure booster ----------------
defDevice('fpb', {
  ko: 'Fuel pressure booster', en: 'Fuel oil pressure booster', sys: 'Fuel · control oil system', parts: ['fpb', 'hpfuel'],
  principle: `<p>ME engines have no cam-driven fuel pumps; this booster on the HCU creates the injection pressure. When FIVA sends control oil (200–300 bar) to the lower <b>hydraulic piston</b>, the slim <b>fuel plunger</b> above it rises with it and compresses the fuel. Pressure is multiplied by the ratio of the two areas (3.3, educational), giving an injection pressure of 300 bar × 3.3 ≈ 1000 bar.</p>
  <p>The fuel chamber above the plunger is connected by the HP pipe to the two fuel valves in the cylinder cover. When injection ends, FIVA opens the space under the hydraulic piston to tank, and fuel supply pressure (about 8 bar) refills the fuel chamber through the suction non-return valve, pushing the piston back down. A piston position sensor reports the actual stroke to the ECS to confirm the injected quantity.</p>
  <p>An umbrella seal and sealing oil stop fuel leaking into the control oil.</p>`,
  sources: [
    { t: 'ref', text: 'MAN B&W ME engine · Fuel oil pressure booster, HCU', url: 'https://wordpress-sxaew.wasmer.app/?p=589' },
    { t: 'ref', text: 'ME engine fuel injection system overview', url: 'https://www.merchantnavydecoded.com/?p=90586' },
    { t: 'edu', text: 'Area ratio 3.3, stroke and return time (40°) are educational assumptions' }],
  view: { t: [0, 0.35, -0.05], d: [0.3, 0.15, 1], k: 0.85 },
  build(root) {
    const D = 0.36, d = D / Math.sqrt(FSP.areaRatio), S = 0.26;
    dpart(root, lathe([[0, -0.75], [0.3, -0.75], [0.3, 0.05], [0.2, 0.05], [0.2, 0.0], [D / 2 + 0.005, 0.0], [D / 2 + 0.005, -0.66], [0, -0.66]]), DC.castL, { ko: 'Hydraulic cylinder', en: 'Hydraulic cylinder', d: 'Control oil from FIVA enters the lower chamber.' });
    dpart(root, lathe([[d / 2 + 0.004, 0.05], [0.2, 0.05], [0.2, 0.9], [0.13, 1.0], [0.0, 1.0], [0, 0.88], [d / 2 + 0.004, 0.88]]), DC.steelD, { ko: 'Fuel barrel', en: 'Fuel barrel', d: 'Precision bore the plunger slides in. The top is the fuel compression chamber.' });
    const mv = new THREE.Group(); root.add(mv);
    dpart(mv, cylY(D / 2, -0.62, -0.42, 40), DC.steelL, { ko: 'hydraulic piston', en: 'Hydraulic piston', d: 'Pushes the plunger up with the force of control oil pressure × large area.' });
    dpart(mv, cylY(d / 2, -0.42, 0.42, 28), DC.steelL, { ko: 'fuel plunger', en: 'Fuel plunger', d: 'Compresses fuel over a small area, so the pressure rises by the area ratio.' });
    dpart(root, ringG(d / 2 + 0.003, 0.17, -0.05, 0.03), DC.rubber, { ko: 'Umbrella seal', en: 'Umbrella seal', d: 'Seal separating fuel from control oil. Sealing oil is supplied with it.' });
    dpart(root, cylY(0.015, -1.0, -0.62, 8), 0x8c8c8c, null);
    const sens = dpart(root, ringG(0.03, 0.07, -1.05, -0.78, 20), DC.motor, { ko: 'Piston position sensor', en: 'Position sensor', d: 'Measures piston stroke to confirm injected quantity and start of injection.' });
    const fch = dfluid(root, cylY(d / 2, 0.42, 0.88, 24), 'fuel', 0.35);
    const och = dfluid(root, cylY(D / 2 - 0.005, -0.66, -0.62, 32), 'oil', 0.5);
    // Suction non-return valve
    const sv = new THREE.Group(); sv.position.set(-0.22, 0.95, 0); root.add(sv);
    dpart(sv, pipeAlong('x', 0.04, -0.5, 0.1, 0, 0, 0.01, true), DC.steel, { ko: 'Fuel suction non-return valve', en: 'Suction non-return valve', d: 'Opens when injection ends and the plunger goes down, filling the compression chamber with fuel at about 8 bar. Held shut by high pressure during injection.' });
    const svb = dpart(sv, sphere(0.03, -0.12, 0, 0), DC.steelL, null);
    // HP outlet
    dpart(root, pipeAlong('y', 0.025, 1.0, 1.5, 0, 0, 0.012, true), DC.steelL, { ko: 'HP fuel pipe (to fuel valves)', en: 'HP fuel pipe', d: 'Thick double-walled pipe. About 1000 bar during injection.' });
    dpart(root, ringG(0.03, 0.045, 1.05, 1.5, 18), DC.steelD, null, { opacity: 0.35 });
    // Control oil inlet
    dpart(root, pipeAlong('x', 0.04, 0.3, 0.75, -0.7, 0, 0.01, true), DC.steelD, { ko: 'Control oil in/out (FIVA Cfi)', en: 'Control oil from FIVA', d: '' });
    const gF = dgauge(root, 0.55, 1.1, 0.02, 0.13, 'Fuel', 0, 1200, 'bar', { ko: 'Fuel', en: 'Fuel pressure', d: '' });
    const gO = dgauge(root, 0.6, -0.35, 0.02, 0.11, 'Control oil', 0, 400, 'bar', { ko: 'Control oil', en: 'Oil pressure', d: '' });
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
    return kvRow('Crank angle (ref. cylinder)', `${s.th.toFixed(1)}°`, 'calc') + kvRow('Piston stroke', `${(s.b * 100).toFixed(0)} %`, 'calc') + kvRow('Fuel pressure', `${s.pf.toFixed(0)} bar`, 'calc')
      + kvRow('Max. injection pressure (= system pressure × area ratio)', `${(FSS.pSys * FSP.areaRatio).toFixed(0)} bar`, 'calc') + kvRow('Injection duration', `${D.toFixed(1)}°`, 'edu')
      + kvRow('Fuel per injection', `${(SIM.state.load * TH.mfMCR * 1000).toFixed(1)} g`, 'm0d') + kvRow('Area ratio', FSP.areaRatio.toFixed(1), 'edu');
  },
});

// ---------------- Exhaust valve actuator ----------------
defDevice('evactuator', {
  ko: 'Exhaust valve actuator', en: 'Exhaust valve actuator', sys: 'Control oil system', parts: ['evactuator', 'hpoil_ev'],
  principle: `<p>The actuator on the HCU uses control oil from FIVA to push the <b>hydraulic piston</b>, and the <b>high-pressure piston</b> above it pushes a column of oil through the HP pipe to the hydraulic cylinder of the exhaust valve on the cylinder cover. That oil column pushes the exhaust valve spindle down against the air spring and opens it.</p>
  <p>When FIVA switches to drain, the air spring closes the spindle and pushes the oil column back, bringing the piston down. The actuator stroke and exhaust valve lift follow the same curve.</p>`,
  sources: [
    { t: 'ref', text: 'MAN B&W ME · Exhaust valve actuator & HCU', url: 'https://wordpress-sxaew.wasmer.app/?p=589' },
    { t: 'edu', text: 'Piston diameter, stroke and 0.30 L per opening are educational assumptions' }],
  view: { t: [0, 0.3, -0.05], d: [0.3, 0.15, 1], k: 0.9 },
  build(root) {
    dpart(root, lathe([[0, -0.7], [0.26, -0.7], [0.26, 0.8], [0.12, 0.8], [0.12, 0.72], [0.105, 0.72], [0.105, 0.0], [0.205, 0.0], [0.205, -0.62], [0, -0.62]]), DC.castL, { ko: 'Actuator body', en: 'Actuator body', d: '' });
    const mv = new THREE.Group(); root.add(mv);
    dpart(mv, cylY(0.2, -0.6, -0.4, 36), DC.steelL, { ko: 'hydraulic piston', en: 'Hydraulic piston', d: 'Control oil from FIVA’s Cva outlet pushes from below.' });
    dpart(mv, cylY(0.1, -0.4, 0.4, 28), DC.steelL, { ko: 'high-pressure piston', en: 'High-pressure piston', d: 'Pushes the oil column out into the HP pipe.' });
    const col = dfluid(root, cylY(0.1, 0.4, 0.72, 24), 'oil', 0.4);
    dpart(root, pipeAlong('y', 0.03, 0.8, 1.6, 0, 0, 0.01), DC.steelL, { ko: 'Exhaust valve HP pipe', en: 'HP pipe to exhaust valve', d: 'Leads to the exhaust valve hydraulic cylinder on the cylinder cover (oil column).' });
    dpart(root, pipeAlong('x', 0.04, 0.26, 0.7, -0.65, 0, 0.01, true), DC.steelD, { ko: 'Control oil (FIVA Cva)', en: 'Control oil', d: '' });
    dpart(root, cylY(0.012, 0.0, 0.7, 6).translate(0.18, 0, 0), DC.steelD, { ko: 'Make-up non-return valve', en: 'Make-up valve', d: 'Tops up the oil column from the low-pressure system oil to replace leakage.' });
    const g = dgauge(root, 0.55, 0.25, 0.02, 0.12, 'Oil column', 0, 400, 'bar', { ko: 'Oil column pressure', en: '', d: '' });
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
    return kvRow('Crank angle (ref. cylinder)', `${s.th.toFixed(1)}°`, 'calc') + kvRow('Actuator stroke = valve lift', `${(s.L * 100).toFixed(0)} %`, 'calc')
      + kvRow('Exhaust valve lift', `${(s.L * CFG.evLiftMax * 1000).toFixed(0)} mm`, 'edu') + kvRow('Open / close', `${CFG.evo}° / ${CFG.evc}°`, 'edu') + kvRow('Control oil per opening', `${FSP.Vev.toFixed(2)} L`, 'edu');
  },
});
