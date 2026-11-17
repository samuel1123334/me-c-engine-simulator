// ===================================================================
// 58 · Device internals — cylinder cover valves (slide-type fuel valve, exhaust valve) and scavenge air system (air cooler · water mist catcher, auxiliary blower)
// ===================================================================

// ---------------- Fuel valve (slide type) ----------------
defDevice('fuelvalve', {
  ko: 'Fuel valve (slide type)', en: 'Fuel valve (slide type)', sys: 'Fuel system · cylinder cover', parts: ['fuelvalve', 'nozzle'],
  principle: `<p>Fuel valves, two per cylinder cover (three on large engines). When the booster raises fuel pressure above the <b>opening pressure (about 350–380 bar)</b>, fuel pushing on the underside of the spindle overcomes the closing spring and lifts the spindle.</p>
  <p>In the MAN B&W <b>slide type</b>, there is a <b>cut-off shaft</b> inside the slide (nozzle tip) that carries the spray holes, and it blocks the inside of the holes when closed. So there is almost no fuel volume below the holes (sac volume), which cuts after-dripping, soot and NOx at the end of injection. The spray holes are angled in the direction of the swirl in the combustion chamber.</p>
  <p>When injection ends and the pressure falls, the spring closes the spindle. While the engine is stopped, low-pressure fuel circulates through the valve to keep it warm.</p>`,
  sources: [
    { t: 'ref', text: 'MAN B&W · Slide fuel valve (sac-free), opening pressure', url: 'https://marinediesels.info/2_stroke_engine_parts/Other_info/fuel_valve.htm' },
    { t: 'ref', text: 'MAN Energy Solutions · Slide fuel valve service letter', url: 'https://www.man-es.com/docs/default-source/service-letters/sl2012-557.pdf' },
    { t: 'edu', text: 'Number of holes (5), spindle lift and spring dimensions are educational assumptions' }],
  view: { t: [0, -0.05, -0.05], d: [0.35, 0.1, 1], k: 0.95 },
  build(root) {
    dpart(root, lathe([[0, 0.95], [0.14, 0.95], [0.16, 0.9], [0.16, 0.0], [0.11, -0.05], [0.11, -0.35], [0.07, -0.4], [0.042, -0.4], [0.042, -0.3], [0.08, -0.3], [0.08, -0.06], [0.11, 0.0], [0.11, 0.82], [0.03, 0.82], [0.03, 0.9], [0, 0.9]]), DC.steelD, { ko: 'Valve housing', en: 'Valve housing', d: 'Fits in a bore in the cylinder cover, between the cover cooling water and the HP fuel pipe.' });
    dpart(root, ringG(0.042, 0.075, -0.42, -0.36), DC.brass, { ko: 'Valve head · seat', en: 'Valve head & seat', d: 'Part with the seat the spindle closes on.' });
    const sl = dgroup(root, { ko: 'Slide (nozzle tip)', en: 'Slide (nozzle tip)', d: 'Thin tube with the spray holes. Projects into the combustion chamber.' });
    dadd(sl, lathe([[0.012, -0.95], [0.03, -0.95], [0.04, -0.9], [0.04, -0.42], [0.012, -0.42]]), DC.stellite ?? 0xd9d2b8);
    const sp = new THREE.Group(); root.add(sp);
    dpart(sp, lathe([[0, -0.94], [0.011, -0.94], [0.011, -0.41], [0.04, -0.38], [0.025, -0.36], [0.025, 0.2], [0, 0.2]]), DC.steelL, { ko: 'Spindle · cut-off shaft', en: 'Spindle with cut-off shaft', d: 'The cut-off shaft at the lower end opens and closes the spray holes inside the slide. When lifted, the inside of the holes opens and fuel is injected.' });
    dpart(sp, cylY(0.07, 0.2, 0.25, 24), DC.steelD, { ko: 'Spring plate (thrust piece)', en: 'Thrust piece', d: '', label: false });
    const spr = dpart(root, springG(0.06, 0.25, 0.78, 8, 0.012), DC.spring, { ko: 'Closing spring', en: 'Closing spring', d: 'Spring that sets the opening pressure (about 350–380 bar).' });
    dpart(root, pipeAlong('x', 0.03, 0.16, 0.6, 0.6, 0, 0.012, true), DC.steelL, { ko: 'HP fuel inlet', en: 'HP fuel inlet', d: 'High-pressure fuel from the booster. It runs down a passage inside the housing to below the spindle.' });
    dpart(root, cylY(0.012, -0.36, 0.6, 8).translate(0.095, 0, 0), DC.steelD, { ko: 'Fuel passage', en: 'Fuel bore', d: '', label: false });
    dpart(root, pipeAlong('x', 0.02, -0.6, -0.16, 0.45, 0, 0.008, false), DC.steel, { ko: 'Circulation · leak-off outlet', en: 'Circulation / leak-off outlet', d: 'Warm-up circulation fuel while stopped and spindle leak-off fuel leave here.' });
    // Part of the cover + combustion chamber
    dpart(root, lathe([[0.2, -0.55], [0.75, -0.55], [0.75, -0.25], [0.2, -0.25]]), DC.cast, { ko: 'Cylinder cover (part)', en: 'Cylinder cover', d: '', label: false });
    const gauge = dgauge(root, 0.5, 0.95, 0.02, 0.12, 'Fuel', 0, 1200, 'bar', { ko: 'Pressure at nozzle', en: 'Fuel pressure', d: '' });
    // Spray: 5 holes (only the cut side)
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
    return kvRow('Crank angle (ref. cylinder)', `${s.th.toFixed(1)}°`, 'calc') + kvRow('Pressure at nozzle', `${s.p.toFixed(0)} bar`, 'calc') + kvRow('Opening pressure', '350–380 bar', 'ref')
      + kvRow('Spindle', s.b > 0 ? `Open (${(s.b * 100).toFixed(0)} %)` : 'Closed', 'calc') + kvRow('Start of injection', `${wrap360(CFG.soi).toFixed(1)}°`, 'edu') + kvRow('Valves per cylinder', '2', 'edu');
  },
});

// ---------------- Exhaust valve ----------------
defDevice('exhvalve', {
  ko: 'Exhaust valve', en: 'Exhaust valve (hydraulic open, air spring close)', sys: 'Exhaust · control oil system', parts: ['evspindle', 'evhousing', 'evseat', 'airspring', 'evact'],
  principle: `<p>The exhaust valve in the centre of the cylinder cover is <b>opened hydraulically and closed by an air spring</b>. The oil column sent by the HCU actuator pushes the piston in the top hydraulic cylinder and opens the spindle downwards. Below the air piston halfway up the spindle there is compressed air at about 7 bar; when the oil pressure is released it pushes the spindle back up and closes it.</p>
  <p>Just before closing, a hydraulic damper slows the spindle to soften the seat impact. Small vanes on the spindle stem (spinner) catch the exhaust flow and turn the spindle a little each time, so the seat wears evenly and carbon does not build up. The bottom piece holding the valve seat is water-cooled.</p>`,
  sources: [
    { t: 'ref', text: 'marinediesels.info · Exhaust valve (air spring, hydraulic actuation, spinner)', url: 'https://marinediesels.info/2_stroke_engine_parts/exhaust_valve.htm' },
    { t: 'ref', text: 'MAN B&W · DuraSpindle / W-seat exhaust valve', url: 'https://www.man-es.com/marine/products/two-stroke-engines' },
    { t: 'edu', text: 'Dimensions, air spring volume ratio and rotation speed are educational assumptions (lift and timing are the simulator settings)' }],
  view: { t: [0, 0.25, -0.05], d: [0.4, 0.1, 1], k: 0.85 },
  build(root) {
    const Lm = 0.22;
    // Bottom piece (cooled) + seat
    dpart(root, lathe([[0.3, -0.75], [0.55, -0.75], [0.55, -0.25], [0.5, -0.2], [0.26, -0.2], [0.26, -0.3], [0.33, -0.3], [0.38, -0.55], [0.3, -0.62]]), DC.cast, { ko: 'Bottom piece (cooling water jacket)', en: 'Bottom piece', d: 'Part that holds the valve seat and has cooling water passages. It takes the hot exhaust gas first.' });
    dfluid(root, ringG(0.42, 0.5, -0.68, -0.32, 36), 'water', 0.35);
    dpart(root, ringG(0.23, 0.32, -0.66, -0.58), DC.stellite ?? 0xd9d2b8, { ko: 'Valve seat', en: 'Valve seat (W-seat)', d: 'Hardened seat ring. Seals against the spindle disc on a conical face.' });
    // Housing + exhaust outlet
    dpart(root, lathe([[0.26, -0.2], [0.52, -0.2], [0.52, 0.55], [0.14, 0.55], [0.14, 0.45], [0.42, 0.45], [0.42, -0.12], [0.26, -0.12]]), DC.castL, { ko: 'Valve housing', en: 'Valve housing', d: 'Passage where the exhaust gas passes the seat and turns out sideways to the exhaust pipe.' });
    dpart(root, pipeAlong('x', 0.2, 0.5, 1.05, 0.1, 0, 0.02, true), DC.castL, { ko: 'Exhaust outlet (to exhaust receiver)', en: 'Exhaust outlet', d: '' });
    dpart(root, ringG(0.045, 0.09, 0.42, 0.75), DC.bronze, { ko: 'Spindle guide', en: 'Spindle guide', d: 'Bush guiding the spindle stem. Sealing air keeps exhaust gas from leaking in.' });
    // Spindle
    const sp = new THREE.Group(); root.add(sp);
    dpart(sp, lathe([[0, -0.72], [0.3, -0.72], [0.3, -0.68], [0.24, -0.6], [0.06, -0.5], [0.045, -0.4], [0.045, 1.48], [0, 1.48]]), 0xc9c2b0, { ko: 'Spindle (Nimonic disc)', en: 'Spindle', d: 'Disc (heat-resistant alloy such as Nimonic) and stem in one piece. Opens by moving down.' });
    const spin = new THREE.Group(); sp.add(spin);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; dpart(spin, box(0.09, 0.08, 0.012, 0.09 * Math.cos(a), -0.3, 0.09 * Math.sin(a), 0.004).rotateY(-a + 0.4), 0xb7ae98, i === 3 ? { ko: 'Spinner (rotation vanes)', en: 'Spinner vanes', d: 'Exhaust gas pushes the vanes and turns the spindle. Evens out seat wear and prevents carbon deposits.' } : null); }
    dpart(sp, cylY(0.3, 1.1, 1.18, 40), DC.steelL, { ko: 'Air piston', en: 'Air piston', d: 'Compressed air in the chamber below pushes this piston up and closes the valve.' });
    // Air spring cylinder
    dpart(root, lathe([[0.045, 0.75], [0.36, 0.75], [0.36, 1.25], [0.32, 1.25], [0.32, 0.8], [0.06, 0.8]]), DC.steelD, { ko: 'Air spring cylinder', en: 'Air spring cylinder', d: 'Supplied with control air at about 7 bar. The more the valve opens, the more the air is compressed and the stronger the closing force.' });
    const air = dfluid(root, ringG(0.05, 0.31, 0.8, 1.1, 36), 'air', 0.35);
    // Hydraulic cylinder (top)
    dpart(root, lathe([[0.05, 1.25], [0.2, 1.25], [0.2, 1.65], [0, 1.65], [0, 1.6], [0.16, 1.6], [0.16, 1.3], [0.05, 1.3]]), DC.castL, { ko: 'Hydraulic cylinder', en: 'Hydraulic cylinder (actuator top)', d: 'Cylinder that receives the oil column from the HCU actuator.' });
    const hp = dpart(root, cylY(0.155, 1.48, 1.58, 32), DC.steelL, { ko: 'Hydraulic piston · damper', en: 'Hydraulic piston with damper', d: 'Pushes the spindle open with oil pressure. When closing, a damper orifice slows the last part of the travel.' });
    const oilc = dfluid(root, cylY(0.155, 1.58, 1.6, 28), 'oil', 0.5);
    dpart(root, pipeAlong('x', 0.025, 0.2, 0.7, 1.55, 0, 0.008), DC.steelL, { ko: 'HP oil pipe (from actuator)', en: 'HP oil pipe', d: '' });
    dpart(root, lathe([[0, -0.85], [0.55, -0.85], [0.55, -0.75], [0, -0.75]]).translate(0, -0.0, 0), DC.cast, { ko: 'Cylinder cover (part)', en: 'Cylinder cover', d: '', label: false });
    const g = dgauge(root, 0.85, 1.0, 0.02, 0.12, 'Air spring', 0, 15, 'bar', { ko: 'Air spring pressure', en: '', d: '' });
    // Exhaust gas flow
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
    return kvRow('Crank angle (ref. cylinder)', `${s.th.toFixed(1)}°`, 'calc') + kvRow('Lift', `${(s.L * CFG.evLiftMax * 1000).toFixed(0)} mm`, 'edu') + kvRow('Air spring pressure', `${s.pa.toFixed(1)} bar`, 'calc')
      + kvRow('Supply air', '7 bar', 'ref') + kvRow('Open / close', `${CFG.evo}° / ${CFG.evc}°`, 'edu') + kvRow('Exhaust receiver pressure', `${((ENGS.px) / 1e5).toFixed(2)} bar abs`, 'm0d');
  },
});

// ---------------- Air cooler + water mist catcher ----------------
defDevice('cooler', {
  ko: 'Scavenge air cooler · water mist catcher', en: 'Scavenge air cooler & water mist catcher', sys: 'Scavenge air system', parts: ['cooler', 'mist', 'chamber'],
  principle: `<p>Air leaving the turbocharger compressor is heated by compression to around 150–200 °C. The cooler is a bundle of closely finned tubes: cooling water (fresh water) makes several passes inside the tubes while the air passes down between the fins and cools. The air becomes denser, so more air can be delivered at the same scavenge pressure.</p>
  <p>When the air cools below its dew point, water vapour condenses into droplets. The <b>Water mist catcher</b> below the cooler uses zigzag vanes to turn the flow sharply, so heavy droplets hit the vanes and are collected, and the water drains away. Droplets entering the cylinders would wash off the oil film and increase liner wear.</p>`,
  sources: [
    { t: 'ref', text: 'MAN B&W Project Guide · Scavenge air system: air cooler, water mist catcher', url: 'https://www.man-es.com/applications/projectguides/2stroke/content/printed/S60ME-C10_5.pdf' },
    { t: 'ref', text: 'marinediesels.info · Scavenge air coolers', url: 'https://marinediesels.info/2_stroke_engine_parts/Other_info/scavenge_air_cooler.htm' },
    { t: 'edu', text: 'Tube layout, number of passes and condensate display are educational. Temperatures come from the 0D turbo matching model' }],
  view: { t: [0, 0.05, -0.1], d: [0.3, 0.2, 1], k: 0.8 },
  build(root) {
    const sh = new THREE.Shape(rrectPts(-0.75, -1.1, 0.75, 1.2, 0.04).map(p => V2(p[0], p[1])));
    sh.holes.push(new THREE.Path(rrectPts(-0.7, -1.05, 0.7, 1.15, 0.03).map(p => V2(p[0], p[1]))));
    dpart(root, extXY(sh, -0.45, 0.45), DC.paint, { ko: 'Cooler casing', en: 'Cooler casing', d: '' });
    dpart(root, pipeAlong('y', 0.3, 1.15, 1.55, 0, 0, 0.02, true), DC.paintD ?? DC.castL, { ko: 'Inlet (compressor outlet air)', en: 'Air inlet from compressor', d: '' });
    // Tube bundle (tubes along X, fins are YZ plates)
    const tubes = dgroup(root, { ko: 'Finned tube bundle', en: 'Finned tube bundle', d: 'Thin fins (aluminium or copper) packed closely on copper-alloy tubes greatly increase the air-side heat transfer area.' }, { anchor: [0, 0.55, -0.1] });
    const rowsY = [0.95, 0.8, 0.65, 0.5, 0.35, 0.2];
    rowsY.forEach((y, i) => { [-0.06, -0.18, -0.3].forEach((z, j) => dadd(tubes, cylX(0.035, -0.7, 0.7, 14).translate(0, y, z + (i % 2) * 0.06), 0xb87333)); });
    const fins = []; for (let x = -0.66; x <= 0.66; x += 0.06) fins.push(box(0.006, 0.9, 0.42, x, 0.575, -0.2, 0.002));
    dpart(root, mergeGeometries(fins), 0xc9c3b6, { ko: 'Fins', en: 'Fins', d: 'Thin plates parallel to the air flow. When fouled the pressure drop rises and cooling falls off, so they are cleaned regularly.' }, { metal: 0.6, rough: 0.5 });
    // Water headers
    dpart(root, box(0.16, 1.0, 0.5, -0.82, 0.575, -0.2, 0.03), DC.blueS ?? 0x4f6f8c, { ko: 'Cooling water header (in/out)', en: 'Water header', d: 'Divided by partitions so the cooling water makes several passes.' });
    dpart(root, box(0.16, 1.0, 0.5, 0.82, 0.575, -0.2, 0.03), DC.blueS ?? 0x4f6f8c, { ko: 'Return header', en: 'Return header', d: '', label: false });
    // Water mist catcher
    const mc = dgroup(root, { ko: 'Water mist catcher vanes', en: 'Water mist catcher vanes', d: 'Zigzag vanes bend the flow and catch the droplets.' }, { anchor: [0, -0.45, -0.1] });
    for (let x = -0.6; x <= 0.61; x += 0.12) { const L = [[x, -0.2], [x + 0.05, -0.3], [x, -0.4], [x + 0.05, -0.5], [x, -0.6]]; const R = L.map(p => [p[0] + 0.014, p[1]]).reverse(); dadd(mc, extXY(shapeOf(L.concat(R)), -0.42, 0.0), DC.steelL); }
    dpart(root, box(1.4, 0.05, 0.85, 0, -0.85, -0.0, 0.01), DC.steelD, { ko: 'Drain trough', en: 'Drain trough', d: 'Collected water runs to the drain pipe. A sudden rise in drain flow suggests a cooler leak.' });
    dpart(root, pipeAlong('y', 0.04, -1.4, -1.05, 0.5, 0, 0.01), DC.steel, null);
    dpart(root, pipeAlong('x', 0.3, 0.7, 1.2, -0.75, 0, 0.02, true), DC.castL, { ko: 'Outlet (to scavenge receiver)', en: 'Outlet to scavenge receiver', d: '' });
    const gTi = dgauge(root, -0.45, 1.4, 0.05, 0.1, 'Inlet', 0, 250, '°C', { ko: 'Inlet air temperature', en: '', d: '' });
    const gTo = dgauge(root, 1.0, -0.35, 0.05, 0.1, 'Outlet', 0, 250, '°C', { ko: 'Outlet air temperature', en: '', d: '' });
    // Flows
    const air = () => ENGS.mdC / 30 + 0.05, Tin = () => TCM.compTout(ENGS.N, Math.max(ENGS.mdC, 0.1)) - 273.15, Tout = () => ENGS.Ts - 273.15;
    for (let k = 0; k < 6; k++) { const x = -0.55 + k * 0.22; dflow(root, [[x * 0.4, 1.5, -0.05], [x, 1.05, -0.05 - (k % 2) * 0.1], [x, 0.0, -0.05 - (k % 2) * 0.1], [x + 0.02, -0.25, -0.1], [x - 0.02, -0.45, -0.1], [x, -0.7, -0.1], [0.7, -0.75, -0.05], [1.2, -0.75, -0.03]], 'air', air, { sp: 0.06, rc: 0.06, colorFn: u => new THREE.Color(0xff8a5a).lerp(new THREE.Color(FLC.air), smooth01((u - 0.08) / 0.4)) }); }
    rowsY.forEach((y, i) => dflow(root, i % 2 ? [[0.72, y, -0.12], [-0.72, y, -0.12]] : [[-0.72, y, -0.12], [0.72, y, -0.12]], 'water', () => 0.8, { sp: 0.06 }));
    dflow(root, [[-0.3, -0.3, -0.15], [-0.28, -0.82, -0.15], [0.5, -0.85, -0.1], [0.5, -1.4, -0.03]], 'water', () => clamp((ENGS.ps / 1e5 - 1.5) / 2, 0.05, 1), { sp: 0.08, size: 0.04 });
    return { update() { gTi.set(Tin()); gTo.set(Tout()); } };
  },
  readouts() {
    const Tin = TCM.compTout(ENGS.N, Math.max(ENGS.mdC, 0.1)) - 273.15, Tout = ENGS.Ts - 273.15, Q = ENGS.mdC * 1005 * Math.max(0, Tin - Tout) / 1000;
    return kvRow('Air flow', `${ENGS.mdC.toFixed(1)} kg/s`, 'm0d') + kvRow('Inlet temperature (compressor outlet)', `${Tin.toFixed(0)} °C`, 'm0d') + kvRow('Outlet temperature (scavenge)', `${Tout.toFixed(0)} °C`, 'm0d')
      + kvRow('Heat removed', `${(Q / 1000).toFixed(2)} MW`, 'calc') + kvRow('Cooling water inlet', `${(TH.Tcw - 273.15).toFixed(0)} °C`, 'edu') + kvRow('Scavenge pressure', `${(ENGS.ps / 1e5).toFixed(2)} bar abs`, 'm0d');
  },
});

// ---------------- Auxiliary blower ----------------
defDevice('auxblower', {
  ko: 'Auxiliary blower', en: 'Auxiliary blower', sys: 'Scavenge air system', parts: ['auxblower', 'checkv'],
  principle: `<p>At low load and when starting, exhaust energy is small and the turbocharger alone cannot give enough scavenge pressure. Then an electric centrifugal blower draws air again after the cooler and blows it into the scavenge receiver to make up the scavenge pressure.</p>
  <p>As the impeller turns, the air between the blades is thrown outwards, gaining speed and pressure, and the spiral volute turns the speed into pressure. The <b>check valve (flap)</b> at the blower outlet stops scavenge air flowing back into the blower when it is stopped. The blower starts automatically when scavenge pressure falls below a set value and stops when it rises.</p>`,
  sources: [
    { t: 'ref', text: 'MAN B&W Project Guide · Auxiliary blowers (automatic start/stop, check valves)', url: 'https://www.man-es.com/applications/projectguides/2stroke/content/printed/S60ME-C10_5.pdf' },
    { t: 'edu', text: `Start/stop scavenge pressure ${CFG.auxOn}/${CFG.auxOff} bar g, speed and number of blades are educational assumptions` }],
  view: { t: [0.1, 0.3, -0.1], d: [0.15, 0.25, 1], k: 0.85 }, cutDefault: false,
  build(root) {
    // Volute (spiral casing): spiral wall whose radius grows with angle + outlet duct
    const rA = a => 0.55 + 0.25 * a / (Math.PI * 2), o = [], n = [];
    for (let i = 0; i <= 72; i++) { const a = 0.15 + (Math.PI * 2 - 0.15) * i / 72; o.push([(rA(a) + 0.05) * Math.cos(a), (rA(a) + 0.05) * Math.sin(a)]); n.push([rA(a) * Math.cos(a), rA(a) * Math.sin(a)]); }
    const volG = mergeGeometries([extXY(shapeOf(o.concat(n.reverse())), -0.35, 0.0), box(0.05, 0.95, 0.35, 0.825, 0.475, -0.175, 0.005), box(0.05, 0.67, 0.35, 0.525, 0.615, -0.175, 0.005)].map(g => g.index ? g.toNonIndexed() : g));
    dpart(root, volG, DC.paint, { ko: 'Volute casing', en: 'Volute casing', d: 'Spiral passage whose cross-section widens steadily. Turns the speed of the fast air leaving the impeller into pressure. (front plate left off to show the inside)' });
    dpart(root, cylZ(0.82, -0.4, -0.35, 48), DC.paint, { ko: 'Back plate', en: 'Back plate', d: '', label: false });
    const imp = new THREE.Group(); root.add(imp);
    dpart(imp, cylZ(0.47, -0.33, -0.3, 40), DC.steelL, { ko: 'Impeller hub disc', en: 'Impeller hub disc', d: '' });
    const blades = dgroup(imp, { ko: 'Impeller blades (backward-curved)', en: 'Backward-curved blades', d: 'Blades curved against the direction of rotation. High efficiency and a stable overload characteristic.' }, { anchor: [0.3, 0.2, -0.2] });
    for (let i = 0; i < 12; i++) { const a0 = i / 12 * Math.PI * 2, A = [], B = []; for (let k = 0; k <= 10; k++) { const r = 0.15 + 0.31 * k / 10, a = a0 - 0.6 * k / 10; A.push([r * Math.cos(a), r * Math.sin(a)]); B.push([r * Math.cos(a + 0.05), r * Math.sin(a + 0.05)]); } dadd(blades, extXY(shapeOf(A.concat(B.reverse())), -0.3, -0.06), DC.steelL); }
    dpart(imp, ringZ(0.17, 0.47, -0.06, -0.04, 40), DC.steelL, { ko: 'Front shroud', en: 'Front shroud', d: '', label: false }, { opacity: 0.35 });
    dpart(root, ringZ(0.17, 0.21, -0.04, 0.25, 32), DC.castL, { ko: 'Suction eye (air after the cooler)', en: 'Suction eye', d: '' }, { opacity: 0.3 });
    const shaft = new THREE.Group(); root.add(shaft);
    dpart(shaft, cylZ(0.04, -1.1, -0.15, 16), DC.steelL, null);
    dpart(root, cylZ(0.3, -1.15, -0.5, 36), DC.motor, { ko: 'Electric motor', en: 'Electric motor', d: '' });
    // Outlet + check valve flap
    const fl = new THREE.Group(); fl.position.set(0.675, 1.05, -0.17); root.add(fl);
    const flap = new THREE.Group(); flap.position.set(-0.15, 0.0, 0); fl.add(flap);
    dpart(flap, box(0.3, 0.015, 0.3, 0.15, 0, 0, 0.004), DC.steelD, { ko: 'Check valve flap', en: 'Non-return flap', d: 'Pushed open by the air when the blower runs; when it stops, scavenge pressure and its own weight close it to prevent backflow.' });
    dpart(flap, cylZ(0.02, -0.18, 0.18, 10), DC.steel, null);
    dpart(root, pipeAlong('y', 0.16, 0.95, 1.55, 0.675, -0.17, 0.015, true), DC.castL, { ko: 'Discharge (to scavenge receiver)', en: 'Outlet to scavenge receiver', d: '' });
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
    return kvRow('State', ENGS.aux ? 'Running' : 'Stopped', 'm0d') + kvRow('Scavenge pressure', `${((ENGS.ps - TH.pAmb) / 1e5).toFixed(2)} bar g`, 'm0d') + kvRow('Start / stop setting', `${CFG.auxOn} / ${CFG.auxOff} bar g`, 'edu')
      + kvRow('Check valve', ENGS.aux ? 'Open' : 'Closed', 'calc') + kvRow('Engine load', `${(SIM.state.load * 100).toFixed(0)} %`);
  },
});
