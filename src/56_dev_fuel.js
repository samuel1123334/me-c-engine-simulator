// ===================================================================
// 56 · Device internals — fuel supply system (three-screw pumps, venting tank, heater + viscometer, full-flow filter, pressure control valve)
// ===================================================================
const DC = { cast: 0x56605c, castL: 0x6c7772, steel: 0x9aa3a8, steelD: 0x6e777c, steelL: 0xc3c9cc, brass: 0xc69a45, bronze: 0xa36d3a,
  rubber: 0x24282a, paint: 0x4f6b62, motor: 0x3f6f8f, red: 0xb24a3a, insul: 0xb9b4a6, mesh: 0xb8b2a0, carbon: 0x2d2f30, spring: 0x8fa3b0 };
const FUEL_COLD = 0x9a6a12, FUEL_HOT = 0xffd84a;
const fuelColT = T => { const u = clamp((T - 80) / 70, 0, 1); return new THREE.Color(FUEL_COLD).lerp(new THREE.Color(FUEL_HOT), u); };
const DVS = { pump: 'circ', block: false, grade: 380, fast: false, tscale: 1, swTarget: null, swAnim: 0 };
const timeCtl = () => `<div class="row"><label>System time</label><div class="seg c3" id="dvTs" style="flex:1">${[1, 10, 60].map(k => `<button class="btn${DVS.tscale === k ? ' on' : ''}" data-k="${k}">${k}×</button>`).join('')}</div></div>`;
const bindTime = () => document.querySelectorAll('#dvTs .btn').forEach(b => b.onclick = () => { DVS.tscale = +b.dataset.k; document.querySelectorAll('#dvTs .btn').forEach(x => x.classList.toggle('on', x === b)); });

// ---------------- Three-screw pump (supply · circulating) ----------------
function threeBorePts(a, R, r, n = 18) {
  const xI = (a * a + R * R - r * r) / (2 * a), yI = Math.sqrt(Math.max(0, R * R - xI * xI));
  const f0 = Math.atan2(yI, xI), p1 = Math.atan2(yI, xI - a), P = [];
  const arc = (cx, rr, b0, b1) => { for (let i = 0; i < n; i++) { const t = b0 + (b1 - b0) * i / n; P.push([cx + rr * Math.cos(t), rr * Math.sin(t)]); } };
  arc(a, r, -p1, p1); arc(0, R, f0, Math.PI - f0); arc(-a, r, Math.PI - p1, Math.PI + p1); arc(0, R, Math.PI + f0, 2 * Math.PI - f0);
  return P;
}
defDevice('screwpump', {
  ko: 'Three-screw pump', en: 'Three-screw pump (fuel supply / circulating)', sys: 'Fuel supply system', parts: ['supplypump', 'circpump'],
  principle: `<p>One power rotor (centre, two-start right-hand thread) meshes with two idler rotors (left-hand) on either side. The sealed pockets trapped between the threads and the casing bores travel along the axis as the rotors turn, so oil is pushed from the suction chamber up to the discharge chamber without pulsation (positive displacement pump).</p>
  <p>The rotor proportions follow the standard IMO-type relation (power rotor OD 5/3·d, idler OD d, centre distance d). If the discharge is blocked, the built-in relief valve opens and returns oil to the suction chamber.</p>
  <p>System pressures: supply pump about 4 bar (to the venting tank), circulating pump about 10 bar (heater → filter → engine). More fuel is circulated than the engine burns; the rest returns to the venting tank through the pressure control valve.</p>`,
  sources: [
    { t: 'ref', text: 'MAN B&W S60ME-C Project Guide · Fuel oil system (supply 4 bar, circulation 10 bar)', url: 'https://www.man-es.com/applications/projectguides/2stroke/content/printed/S60ME-C10_5.pdf' },
    { t: 'ref', text: 'IMO 3-screw pump principle (Colfax/IMO AB)', url: 'https://www.imo-pump.com/products/3-screw-pumps' },
    { t: 'edu', text: 'Rotor length, lead, pump capacity and efficiency, relief setting are educational assumptions' }],
  view: { t: [0, 0.35, -0.1], d: [0.45, 0.2, 1], k: 0.78 },
  controls: () => `<div class="seg c2" id="dvPump"><button class="btn${DVS.pump === 'supply' ? ' on' : ''}" data-p="supply">Supply pump (4 bar)</button><button class="btn${DVS.pump === 'circ' ? ' on' : ''}" data-p="circ">Circulating pump (10 bar)</button></div>
    <label class="chk" style="margin-top:8px"><input type="checkbox" id="dvBlock" ${DVS.block ? 'checked' : ''}> Close the discharge valve (see the relief valve work)</label>`,
  bind() {
    document.querySelectorAll('#dvPump .btn').forEach(b => b.onclick = () => { DVS.pump = b.dataset.p; document.querySelectorAll('#dvPump .btn').forEach(x => x.classList.toggle('on', x === b)); });
    $('dvBlock').onchange = e => { DVS.block = e.target.checked; };
  },
  build(root) {
    const a = 0.15, Rp = 0.125, rp = 0.075, Ri = 0.075, ri = 0.025, lead = 0.5, y0 = -0.32, y1 = 0.62;
    // Casing (outer body): cylinder with suction and discharge chambers + side nozzles
    dpart(root, vesselY(0.36, -0.72, 0.95, 0.04, 0.12, { top: false }), DC.cast, { ko: 'Pump casing', en: 'Pump casing', d: 'Cast body with the suction chamber (bottom) and discharge chamber (top). Surrounds the rotor insert and carries the suction and discharge flanges.' });
    dpart(root, ringG(0.2, 0.42, 0.95, 1.01), DC.castL, null);
    // Rotor insert (three bores)
    const ins = extXZ(xzShape(arcPts(0, 0, 0.32, 0, 360, 48).map(p => [p[0], p[1]]), [threeBorePts(a, Rp + 0.003, Ri + 0.003)]), y0, y1);
    dpart(root, ins, DC.bronze, { ko: 'Rotor insert (bores)', en: 'Rotor housing insert', d: 'Bores the three rotors fit into closely. The small clearance between the threads and the bore forms the sealed pockets. If the clearance grows, internal leakage (backflow) lowers the volumetric efficiency.' }, { metal: 0.6 });
    // Rotors
    const rot = (cx, rr0, rr1, hand, info, col) => {
      const g = new THREE.Group(); g.position.x = cx; root.add(g);
      const gi = dgroup(g, info); const tr = (rr1 - rr0) / 2, rc = (rr0 + rr1) / 2;
      dadd(gi, cylY(rr0 + 0.004, y0 - 0.02, y1 + 0.02, 28), col);
      [0, Math.PI].forEach(ph => dadd(gi, helixTube(rc, hand * lead, y0, y1, tr * 0.95, ph, 160), col));
      return g;
    };
    const power = rot(0, rp, Rp, 1, { ko: 'Power rotor', en: 'Power rotor (drive screw)', d: 'Centre rotor coupled directly to the motor. Its convex two-start thread drives the idlers; axial thrust is taken by the balance piston.' }, DC.steelL);
    const idL = rot(-a, ri, Ri, -1, { ko: 'Idler rotor (left)', en: 'Idler rotor', d: 'Concave-thread rotor meshing with the power rotor and turning the opposite way. It carries almost no torque and only seals, so it wears little.' }, DC.steel);
    const idR = rot(a, ri, Ri, -1, { ko: 'Idler rotor (right)', en: 'Idler rotor', d: 'Same job as the left idler. The two idlers cancel each other’s radial force on the power rotor.' }, DC.steel);
    // Shaft · balance piston · mechanical seal · coupling · motor
    const shaft = new THREE.Group(); root.add(shaft);
    dpart(shaft, cylY(0.045, y1, 1.42, 24), DC.steelL, { ko: 'Drive shaft', en: 'Drive shaft', d: 'Carries motor torque to the power rotor.' });
    dpart(root, ringG(0.05, 0.13, 0.66, 0.74), DC.bronze, { ko: 'Balance piston · bush', en: 'Balance piston', d: 'Piston loaded by the difference between discharge and suction pressure, cancelling the axial thrust that pushes the rotors down.' });
    const seal = dgroup(root, { ko: 'Mechanical shaft seal', en: 'Mechanical seal', d: 'A rotating ring (carbon) and a stationary ring (silicon carbide) pressed together by a spring stop leakage where the shaft passes through. Materials suit hot fuel (up to about 150 °C).' });
    dadd(seal, ringG(0.047, 0.1, 0.98, 1.02), DC.carbon); dadd(seal, ringG(0.047, 0.1, 1.02, 1.05), DC.steelL); dadd(seal, springG(0.075, 1.05, 1.13, 4, 0.008), DC.spring);
    dpart(root, ringG(0.05, 0.17, 1.13, 1.2), DC.castL, null);
    dpart(root, ringG(0.17, 0.2, 1.2, 1.5, 28), DC.cast, { ko: 'Lantern bracket', en: 'Lantern bracket', d: 'Intermediate housing that mounts the motor on the pump. Has an inspection window for the coupling.' });
    const cpl = dgroup(shaft, { ko: 'Coupling', en: 'Flexible coupling', d: 'Flexible coupling that takes up small misalignment between motor shaft and pump shaft.' });
    dadd(cpl, cylY(0.1, 1.3, 1.37, 24), DC.steelD); dadd(cpl, cylY(0.1, 1.39, 1.46, 24), DC.steelD); dadd(cpl, cylY(0.07, 1.37, 1.39, 12), DC.rubber);
    const mot = dgroup(root, { ko: 'Electric motor', en: 'Electric motor', d: 'Usually a 4-pole induction motor (about 1750 r/min @ 60 Hz). Supply and circulating pumps are fitted in pairs, one on standby (automatic changeover).' });
    dadd(mot, vesselY(0.24, 1.5, 2.15, 0.03, 0.06, { bot: false }), DC.motor);
    for (let i = 0; i < 16; i++) { const ang = i / 16 * Math.PI * 2; dadd(mot, box(0.03, 0.55, 0.02, 0.255 * Math.cos(ang), 1.82, 0.255 * Math.sin(ang), 0.004).rotateY(0), DC.motor); }
    const rotor = new THREE.Group(); root.add(rotor);
    dpart(rotor, cylY(0.16, 1.58, 2.02, 28), 0x8b6a3e, { ko: 'Rotor (squirrel cage)', en: 'Squirrel-cage rotor', d: 'Squirrel-cage rotor pulled round by the stator’s rotating field.' });
    dpart(root, ringG(0.165, 0.21, 1.58, 2.02, 28), 0x7a5a2e, { ko: 'Stator winding', en: 'Stator winding', d: 'Three-phase current flowing here creates the rotating field.' }, { metal: 0.3 });
    dpart(rotor, cylY(0.045, 1.46, 2.12, 16), DC.steelL, null);
    // Suction and discharge nozzles
    dpart(root, pipeAlong('x', 0.11, -0.95, -0.3, -0.5, 0, 0.015, true), DC.castL, { ko: 'Suction inlet', en: 'Suction inlet', d: 'Where oil comes in from the tank. If suction pressure is too low, gas comes out of the hot fuel and causes cavitation.' });
    dpart(root, pipeAlong('x', 0.1, 0.3, 0.95, 0.82, 0, 0.015, true), DC.castL, { ko: 'Discharge outlet', en: 'Discharge outlet', d: 'Pressurised oil leaves from the discharge chamber above the rotors.' });
    // Built-in relief valve: discharge chamber → suction chamber bypass
    const rv = new THREE.Group(); rv.position.set(-0.45, 0.2, 0); root.add(rv);
    dpart(rv, vesselY(0.08, -0.5, 0.48, 0.015, 0.03), DC.castL, { ko: 'Relief valve body', en: 'Relief valve body', d: 'Bypass passage between discharge and suction chambers. Opens if the discharge is blocked, protecting the pump and piping.' });
    const rvP = dpart(rv, lathe([[0, -0.32], [0.05, -0.27], [0.05, -0.2], [0.02, -0.18], [0, -0.18]]), DC.steelL, { ko: 'Relief poppet', en: 'Relief poppet', d: 'Lifts when discharge pressure × seat area exceeds the spring force.' });
    const rvS = dpart(rv, springG(0.045, -0.18, 0.3, 7, 0.009), DC.spring, { ko: 'Relief spring', en: 'Relief spring', d: 'Compression spring that sets the relief pressure. Adjusted with the screw on top.' });
    dpart(rv, cylY(0.02, 0.3, 0.6, 12), DC.steelL, null);
    dpart(root, pipeAlong('x', 0.035, -0.37, -0.29, 0.75, 0, 0.008), DC.castL, null);
    dpart(root, pipeAlong('x', 0.035, -0.37, -0.29, -0.15, 0, 0.008), DC.castL, null);
    // Fluid spaces
    dfluid(root, cylY(0.315, -0.7, y0, 32), 'fuel', 0.16);
    dfluid(root, cylY(0.315, y1, 0.95, 32), 'fuel', 0.2);
    // Gauges
    const gS = dgauge(root, -0.72, -0.28, 0.02, 0.1, 'Suction', -1, 3, 'bar', { ko: 'Suction gauge', en: 'Suction gauge', d: 'Suction pressure (including vacuum).' });
    const gD = dgauge(root, 0.72, 1.08, 0.02, 0.1, 'Discharge', 0, 16, 'bar', { ko: 'Discharge gauge', en: 'Discharge gauge', d: 'Discharge pressure. Supply pump about 4 bar, circulating pump about 10 bar.' });
    dpart(root, cylY(0.012, 0.9, 1.0, 8).translate(0.72, 0, 0), DC.steel, null);
    // Flow
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
    return kvRow('Pump', sup ? 'Supply pump' : 'Circulating pump') + kvRow('Speed', '1750 r/min', 'edu') + kvRow('Suction → discharge', sup ? '0.4 → 4.0 bar' : '3.6 → 10.0 bar', 'ref')
      + kvRow('Flow', DVS.block ? '0 (relief recirculation)' : `${(V * 3600).toFixed(1)} m³/h`, 'edu') + kvRow('Shaft power', `${(V * dp * 1e5 / 0.7 / 1000).toFixed(1)} kW`, 'calc')
      + kvRow('Engine fuel consumption', `${(fuelConsumption() * 3600).toFixed(0)} kg/h`, 'm0d') + kvRow('Relief valve', DVS.block ? 'Open (at set pressure)' : 'Closed', 'calc');
  },
});

// ---------------- Venting · mixing tank (venting box) ----------------
defDevice('ventbox', {
  ko: 'Venting · mixing tank', en: 'Venting box (deaerating tank)', sys: 'Fuel supply system', parts: ['ventbox'],
  principle: `<p>A small pressurised tank where hot fuel returning from the engine mixes with make-up fuel from the supply pump. The return fuel carries gas and vapour released during heating, which rises and collects at the top of this tank.</p>
  <p>As gas collects, the level falls and the float drops with it, opening the vent valve at the top. Once the gas has escaped to the service tank, the level rises again and closes the valve. The circulating pumps draw degassed fuel from the bottom of the tank.</p>`,
  sources: [
    { t: 'ref', text: 'MAN B&W Project Guide · Fuel oil system: venting box, automatic de-aerating valve', url: 'https://www.man-es.com/applications/projectguides/2stroke/content/printed/S60ME-C10_5.pdf' },
    { t: 'edu', text: 'Tank size, float valve type, gas generation and venting cycle are educational assumptions' }],
  view: { t: [0, 0.5, -0.1], d: [0.3, 0.15, 1], k: 0.8 },
  build(root) {
    dpart(root, vesselY(0.42, -0.8, 1.3, 0.025, 0.2), DC.paint, { ko: 'Tank shell', en: 'Tank shell', d: 'Pressure vessel. Held at supply pump pressure (about 4 bar) so the hot fuel does not boil.' });
    const lev = dfluid(root, cylY(0.39, -0.6, 1.0, 40), 'fuel', 0.22);
    const gas = dfluid(root, cylY(0.39, 0.9, 1.08, 40), 'gas', 0.12);
    dpart(root, pipeAlong('x', 0.06, -0.95, -0.42, 0.75, 0, 0.012, true), DC.steelD, { ko: 'Make-up fuel inlet', en: 'Supply inlet (from supply pump)', d: 'Fuel from the service tank via the supply pump. The amount equals engine consumption.' });
    dpart(root, pipeAlong('x', 0.07, 0.42, 0.95, 0.35, 0, 0.012, true), DC.steelD, { ko: 'Engine return inlet', en: 'Return inlet (from PCV)', d: 'Fuel that has gone round the engine and through the pressure control valve. Carries gas and vapour.' });
    dpart(root, pipeAlong('y', 0.07, -1.25, -0.78, 0, 0, 0.012, true), DC.steelD, { ko: 'Outlet (to circulating pumps)', en: 'Outlet to circulating pumps', d: 'The circulating pumps draw degassed fuel from the bottom of the tank.' });
    dpart(root, ringG(0.08, 0.1, 0.3, 0.85, 24).translate(0.2, 0, -0.05), DC.steel, { ko: 'Return dip pipe', en: 'Return dip pipe (baffle)', d: 'Releases the return fuel high up below the level so gas rises straight away, and acts as a baffle so it does not flow straight to the outlet.' });
    // Automatic vent valve on top
    const vv = new THREE.Group(); vv.position.y = 1.3; root.add(vv);
    dpart(vv, vesselY(0.14, 0.0, 0.5, 0.015, 0.05, { bot: false }), DC.castL, { ko: 'Automatic de-aerating valve body', en: 'Automatic de-aerating valve', d: 'Float valve at the very top of the tank. Opens when gas collects and vents it to the service tank.' });
    dpart(vv, ringG(0.03, 0.15, -0.04, 0.02), DC.castL, null);
    const float = dpart(vv, sphere(0.085, 0, 0.17, 0), DC.steelL, { ko: 'Float', en: 'Float', d: 'Ball floating in the fuel. When the level falls it drops and opens the vent needle through a lever.' });
    const ndl = dpart(vv, lathe([[0, 0.38], [0.012, 0.4], [0.012, 0.5], [0, 0.5]]), DC.steelL, { ko: 'Vent needle · seat', en: 'Vent needle & seat', d: 'Needle that opens and closes a small orifice. The float closes it from above so only gas escapes and no oil.' });
    dpart(vv, cylY(0.006, 0.25, 0.38, 6), DC.steelL, null);
    dpart(vv, pipeAlong('y', 0.025, 0.5, 0.75, 0, 0, 0.006), DC.steelD, { ko: 'Vent pipe (to service tank)', en: 'Vent pipe to service tank', d: 'Sends the separated gas and a little fuel to the top of the service tank.' });
    // Level gauge
    const lg = new THREE.Group(); lg.position.set(-0.52, 0, 0.0); root.add(lg);
    dpart(lg, ringG(0.022, 0.03, -0.5, 1.15, 16), DC.steelL, { ko: 'Level gauge', en: 'Level gauge', d: 'Glass tube showing the tank level.' }, { opacity: 0.35, nocut: true });
    const lgFill = dfluid(lg, cylY(0.02, -0.5, 1.0, 12), 'fuel', 0.6);
    // Flow
    dflow(root, [[-1.0, 0.75, -0.03], [-0.38, 0.75, -0.03], [-0.25, 0.55, -0.05], [-0.1, -0.2, -0.05], [0, -0.6, -0.03], [0, -1.3, -0.03]], 'fuel', () => fuelConsumption() / 0.6 + 0.05, { sp: 0.06 });
    dflow(root, [[1.0, 0.35, -0.05], [0.2, 0.35, -0.05], [0.2, 0.86, -0.05], [0.05, 0.75, -0.05], [-0.05, 0.1, -0.05], [0, -0.6, -0.04], [0, -1.3, -0.04]], 'fuel', () => 0.8, { sp: 0.06, colorFn: lerpC(0xffd84a, 0xd9a52b) });
    const bubbles = [];
    for (let i = 0; i < 4; i++) bubbles.push(dflow(root, [[0.2 + (i - 1.5) * 0.06, 0.82, -0.04 - i * 0.02], [0.18 + (i - 1.5) * 0.12, 1.0, -0.05 - i * 0.02], [0.05, 1.22, -0.03], [0, 1.45, -0.02], [0, 1.85, -0.02]], 'gas', () => 0.6, { sp: 0.16, size: 0.05, jitter: 0.05 }));
    let gasV = 0, open = 0;
    return {
      update(st) {
        // gas builds up → level falls → float drops → valve opens → gas vents (cycle with hysteresis)
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
    return kvRow('Tank pressure', `${FSP.pSupply.toFixed(1)} bar`, 'ref') + kvRow('Make-up flow (= consumption)', `${(FSS.supply * 3600).toFixed(0)} kg/h`, 'm0d')
      + kvRow('Engine return flow', `${(FSS.ret * 3600).toFixed(0)} kg/h`, 'calc') + kvRow('Mixed temperature', `${FSS.Tin.toFixed(1)} °C`, 'calc')
      + kvRow('Gas volume at top', `${(s.gasV * 100).toFixed(0)} %`, 'edu') + kvRow('Vent valve', s.open ? 'Open (venting gas)' : 'Closed', 'edu');
  },
});

// ---------------- Fuel heater + viscometer + steam control valve + trap ----------------
defDevice('heater', {
  ko: 'Fuel heater · viscosity control', en: 'Steam fuel heater & viscosity control', sys: 'Fuel supply system', parts: ['heater', 'visco', 'trap'],
  principle: `<p>A shell-and-tube steam heater. Steam flows inside a U-tube bundle and gives up latent heat as it condenses, while fuel on the shell side zigzags around baffles across the bundle and is heated. Condensate collects at the lower outlet of the tubes and leaves only through a float steam trap (steam cannot escape).</p>
  <p>A viscometer (vibrating type) in the outlet pipe measures the actual viscosity, and a PI controller changes the steam control valve opening to hold about 13 cSt at the engine inlet. If the fuel gets thicker, the valve opens further to raise the temperature. Change the fuel grade below to see the control response.</p>
  <p>Viscosity is computed from temperature with the Walther equation (ASTM D341): a 380 cSt @ 50 °C fuel reaches 13 cSt at about 140 °C.</p>`,
  sources: [
    { t: 'ref', text: 'MAN B&W Project Guide · Fuel oil system: engine inlet viscosity 10–15 cSt (about 13 cSt recommended), heater and viscometer', url: 'https://www.man-es.com/applications/projectguides/2stroke/content/printed/S60ME-C10_5.pdf' },
    { t: 'ref', text: 'ASTM D341 Walther viscosity–temperature relation' },
    { t: 'ref', text: 'Viscosity sensor (torsional oscillation, e.g. VAF ViscoSense)', url: 'https://www.vaf.nl/products/viscosense3/' },
    { t: 'edu', text: 'Steam pressure 7 bar g, NTU, time constant, PI gains and shell/tube arrangement are educational assumptions' }],
  view: { t: [0.1, 0.1, -0.1], d: [0.25, 0.35, 1], k: 0.74 },
  controls: () => `<div class="row"><label>Grade cSt@50°C</label><div class="seg c3" id="dvGrade" style="flex:1">${[180, 380, 700].map(v => `<button class="btn${DVS.grade === v ? ' on' : ''}" data-v="${v}">${v}</button>`).join('')}</div></div>${timeCtl()}
    <p class="empty" style="margin:6px 0 0;font-size:11.5px">Changing the grade changes the viscosity at the same temperature, so the controller re-adjusts the steam flow. The time constant is tens of seconds, so set system time to 10× or more to see the response clearly.</p>`,
  bind() {
    document.querySelectorAll('#dvGrade .btn').forEach(b => b.onclick = () => { DVS.grade = +b.dataset.v; FSP.v50 = DVS.grade; document.querySelectorAll('#dvGrade .btn').forEach(x => x.classList.toggle('on', x === b)); });
    bindTime();
  },
  build(root) {
    const x0 = -0.9, x1 = 0.95, R = 0.34, tR = 0.022;
    // Shell (X axis) + insulation
    const shell = vesselY(R, x0, x1, 0.022, 0.16, { bot: false }); shell.rotateZ(-Math.PI / 2);
    dpart(root, shell, DC.paint, { ko: 'Shell (fuel side)', en: 'Shell (fuel side)', d: 'Outer body the fuel flows through. Wrapped in insulation to reduce heat loss.' });
    const ins = ringX(R + 0.005, R + 0.045, x0 + 0.05, x1 - 0.12, 40); dpart(root, ins, DC.insul, { ko: 'Insulation', en: 'Insulation', d: '' , label: false }, { metal: 0, rough: 0.9 });
    // Tube sheet · channel head
    dpart(root, cylX(R + 0.03, x0 - 0.04, x0, 40), DC.steelD, { ko: 'Tube sheet', en: 'Tube sheet', d: 'Thick plate into which both ends of the U-tubes are expanded and welded. Separates the steam side from the fuel side.' });
    const ch = vesselY(R, x0 - 0.42, x0 - 0.04, 0.02, 0.14, { top: false }); ch.rotateZ(-Math.PI / 2);
    dpart(root, ch, DC.castL, { ko: 'Channel head (steam side)', en: 'Channel head', d: 'Head split into a steam inlet chamber (top) and a condensate outlet chamber (bottom) by a central partition.' });
    dpart(root, box(0.36, 0.025, 2 * R - 0.03, x0 - 0.22, 0, -0.0, 0.005), DC.steelD, { ko: 'Pass partition', en: 'Pass partition', d: 'Makes steam enter the upper tubes, turn round the U-bends and come back through the lower tubes.' });
    // U-tube bundle (only tubes near the cut face are drawn)
    const tubes = dgroup(root, { ko: 'U-tube bundle', en: 'U-tube bundle (steam inside)', d: 'Steam condenses inside the tubes and releases heat. The U shape lets thermal expansion take place freely.' }, { anchor: [0.2, 0.06, -0.05] });
    const tubeMats = [];
    const rows = [0.06, 0.12, 0.18, 0.24];
    rows.forEach((yy, i) => {
      [-0.03, -0.11, -0.19].forEach((zz, j) => {
        const xr = x1 - 0.22 - i * 0.045;
        const rt = new Route([V3(x0, yy, zz), V3(xr, yy, zz), V3(xr + yy * 0.9, 0, zz), V3(xr, -yy, zz), V3(x0, -yy, zz)].map(v => v), yy * 0.95);
        const m = dadd(tubes, tubeG(rt, tR, 10), DC.bronze); tubeMats.push(m.material);
      });
    });
    // Baffles
    const bfx = [-0.55, -0.15, 0.25, 0.6];
    bfx.forEach((bx, i) => {
      const up = i % 2 === 0, s = new THREE.Shape(); const rr = R - 0.02, cut = up ? -0.1 : 0.1;
      const pts = []; for (let k = 0; k <= 40; k++) { const t = k / 40 * Math.PI * 2; const y = rr * Math.sin(t), z = rr * Math.cos(t); pts.push([z, up ? Math.min(y, 0.2) : Math.max(y, -0.2)]); }
      const g = extXY(shapeOf(pts), -0.012, 0.012); g.rotateY(Math.PI / 2); g.translate(bx, 0, 0);
      dpart(root, g, DC.steelD, i === 1 ? { ko: 'Baffles', en: 'Segmental baffles', d: 'Make the fuel zigzag through the shell so it crosses the bundle several times, and support the tubes. Higher velocity improves heat transfer.' } : null);
    });
    // Nozzles
    dpart(root, pipeAlong('y', 0.075, R - 0.02, R + 0.28, x1 - 0.2, 0, 0.012, true), DC.steelD, { ko: 'Fuel inlet', en: 'Fuel inlet', d: 'Fuel at about 120 °C from the circulating pumps.' });
    dpart(root, pipeAlong('y', 0.075, -R + 0.02, -R - 0.12, x0 + 0.15, 0, 0.012, false), DC.steelD, { ko: 'Fuel outlet', en: 'Fuel outlet', d: 'Heated fuel goes through the viscometer and filter to the engine.' });
    dpart(root, pipeAlong('y', 0.06, 0.18, 0.62, x0 - 0.24, 0, 0.012, false), DC.steel, { ko: 'Steam inlet', en: 'Steam inlet', d: 'Saturated steam at about 7 bar g (about 170 °C).' });
    dpart(root, pipeAlong('y', 0.035, -0.18, -0.6, x0 - 0.24, 0, 0.008, false), DC.steel, { ko: 'Condensate outlet', en: 'Condensate outlet', d: '' , label: false });
    // Steam control valve (pneumatic diaphragm + globe valve)
    const sv = new THREE.Group(); sv.position.set(x0 - 0.24, 0.72, 0); root.add(sv);
    dpart(sv, sphere(0.1, 0, 0, 0).scale(1.3, 1, 1), DC.castL, { ko: 'Steam control valve', en: 'Steam control valve', d: 'Lifts the plug according to the viscosity controller output (4–20 mA → air pressure) to adjust steam flow.' });
    dpart(sv, pipeAlong('x', 0.045, -0.5, -0.12, 0, 0, 0.01, true), DC.steel, null);
    const plug = dpart(sv, lathe([[0, -0.06], [0.04, -0.03], [0.04, 0.02], [0.012, 0.03], [0.012, 0.3], [0, 0.3]]), DC.steelL, { ko: 'Valve plug', en: 'Valve plug & stem', d: 'Lift = opening. The larger the opening, the more steam flows.' });
    dpart(sv, cylY(0.016, 0.08, 0.32, 8).translate(0.08, 0, 0), DC.steelD, null);
    dpart(sv, cylY(0.016, 0.08, 0.32, 8).translate(-0.08, 0, 0), DC.steelD, null);
    dpart(sv, lathe([[0, 0.3], [0.17, 0.3], [0.17, 0.36], [0.12, 0.42], [0, 0.42]]), DC.motor, { ko: 'Pneumatic actuator', en: 'Pneumatic diaphragm actuator', d: 'Plug position is set by the balance between control air pressure on the diaphragm and the spring force.' });
    // Steam trap (ball float)
    const tp = new THREE.Group(); tp.position.set(x0 - 0.24, -0.72, 0); root.add(tp);
    dpart(tp, vesselY(0.12, -0.12, 0.12, 0.015, 0.05), DC.castL, { ko: 'Steam trap (ball float type)', en: 'Ball-float steam trap', d: 'When condensate collects, the ball float rises and opens the outlet; when only steam is left it sinks and closes. Drains condensate without losing steam.' });
    const ball = dpart(tp, sphere(0.06, 0.02, -0.02, -0.01), DC.steelL, { ko: 'Ball float', en: 'Float', d: 'Rises and falls with the condensate level to open and close the outlet.' });
    const trW = dfluid(tp, cylY(0.1, -0.11, -0.03, 20), 'water', 0.35);
    dpart(tp, pipeAlong('x', 0.025, 0.1, 0.5, -0.08, 0, 0.006), DC.steel, null);
    // Viscometer (outlet pipe)
    const vs = new THREE.Group(); vs.position.set(x0 + 0.15, -0.72, 0); root.add(vs);
    dpart(vs, pipeAlong('x', 0.075, -0.0, 1.35, 0, 0, 0.012, false), DC.steelD, null);
    dpart(vs, cylX(0.075, -0.09, -0.0, 24).translate(0, 0, 0), DC.steelD, null);
    dpart(vs, vesselY(0.11, 0.0, 0.3, 0.015, 0.03, { bot: false }).translate(0.55, 0, 0), DC.castL, { ko: 'Viscometer measuring chamber', en: 'Viscosity sensor housing', d: 'The sensor shaft is inserted into the measuring pipe the fuel flows through.' });
    const bob = new THREE.Group(); bob.position.x = 0.55; vs.add(bob);
    dpart(bob, cylY(0.01, -0.05, 0.36, 10), DC.steelL, null);
    dpart(bob, cylY(0.035, -0.06, 0.04, 20), DC.steelL, { ko: 'Vibrating sensing element', en: 'Torsional oscillating element', d: 'The shaft is driven in torsional oscillation at a constant amplitude and the oil’s viscosity damps it. Kinematic viscosity is computed from the damping (= drive power), with temperature compensation.' });
    dpart(vs, box(0.2, 0.14, 0.14, 0.55, 0.42, 0, 0.02), DC.motor, { ko: 'Sensor electronics', en: 'Transmitter', d: 'Oscillation drive and detection circuit. Sends viscosity and temperature to the controller as 4–20 mA.' });
    const ctl = dpart(root, box(0.36, 0.3, 0.1, 0, 0, 0, 0.02), DC.steelD, { ko: 'Viscosity controller (PI)', en: 'Viscosity controller', d: 'Applies proportional and integral action to the difference between set and measured viscosity and outputs the steam control valve opening. On start-up it begins in temperature control and then switches to viscosity control.' }, { nocut: true });
    ctl.position.set(0.55, -0.62, 0.05);
    // Fluid spaces
    dfluid(root, cylX(R - 0.024, x0, x1 - 0.15, 40), 'fuel', 0.1);
    // Gauges
    const gTi = dgauge(root, x1 - 0.2, R + 0.42, 0.02, 0.085, 'Inlet', 50, 200, '°C', { ko: 'Inlet thermometer', en: 'Inlet thermometer', d: '' });
    const gTo = dgauge(root, x0 + 0.4, -R - 0.15, 0.05, 0.085, 'Outlet', 50, 200, '°C', { ko: 'Outlet thermometer', en: 'Outlet thermometer', d: '' });
    // Flow: fuel zigzags (inlet → baffles → outlet), coloured by temperature
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
    return kvRow('Inlet temperature', `${FSS.Tin.toFixed(1)} °C`, 'calc') + kvRow('Outlet temperature', `${FSS.Tout.toFixed(1)} °C`, 'calc')
      + kvRow('Measured viscosity / set point', `${FSS.visc.toFixed(1)} / ${FSP.viscSet} cSt`, 'calc') + kvRow('Control error', `${err >= 0 ? '+' : ''}${err.toFixed(2)} cSt`, 'calc')
      + kvRow('Steam valve opening', `${(FSS.y * 100).toFixed(0)} %`, 'calc') + kvRow('Heat duty', `${(FSS.Q / 1000).toFixed(0)} kW`, 'calc')
      + kvRow('Steam use (= condensate)', `${(FSS.steam * 3600).toFixed(0)} kg/h`, 'calc') + kvRow('Steam (7 bar g)', `${FSP.Tsteam.toFixed(0)} °C`, 'ref')
      + kvRow('Fuel circulation', `${(FSP.Qcirc * 3.6).toFixed(1)} t/h`, 'edu') + kvRow('Target temperature (13 cSt)', `${FUEL.tempFor(FSP.viscSet).toFixed(0)} °C`, 'calc');
  },
});

// ---------------- Fuel full-flow filter (duplex, manual changeover) ----------------
defDevice('ffilter', {
  ko: 'Fuel full-flow filter', en: 'Fuel full-flow filter (duplex)', sys: 'Fuel supply system', parts: ['ffilter'],
  principle: `<p>The last filter, through which all fuel going to the engine passes. It has two identical chambers (A and B); the upper and lower changeover cocks are linked so only one side is used. Fuel flows from outside the element (dirty side) to the inside (clean side), and trapped particles build up on the outer surface of the element.</p>
  <p>As dirt builds up, the differential pressure (inlet − outlet) rises. When it reaches the alarm value, the filter is switched to the other side while running and the clogged element is taken out and cleaned. Differential pressure is also proportional to viscosity, so it rises if the fuel is under-heated too.</p>`,
  sources: [
    { t: 'ref', text: 'MAN B&W Project Guide · Fuel oil system: full-flow filter before engine (duplex, manual changeover)', url: 'https://www.man-es.com/applications/projectguides/2stroke/content/printed/S60ME-C10_5.pdf' },
    { t: 'edu', text: 'Mesh size 50 µm, differential pressure model (viscosity × flow × clogging), alarm value 0.6 bar and clogging rate are educational assumptions' }],
  view: { t: [0, 0.2, -0.1], d: [0.2, 0.3, 1], k: 0.78 },
  controls: () => `<div class="seg c2"><button class="btn" id="dvSw">Switch A ↔ B</button><button class="btn" id="dvClean">Clean standby side</button></div>
    <label class="chk" style="margin-top:8px"><input type="checkbox" id="dvFast" ${DVS.fast ? 'checked' : ''}> Speed up fouling (×200)</label>${timeCtl()}`,
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
      dpart(g, vesselY(0.3, -0.85, 0.75, 0.02, 0.14, { top: false }), DC.paint, { ko: `Filter chamber ${nm}`, en: `Filter chamber ${nm}`, d: 'Pressure vessel holding the element. Drain cock at the bottom, air vent cock on the top cover.' });
      dpart(g, cylY(0.34, 0.75, 0.83, 40), DC.castL, { ko: `Cover ${nm}`, en: 'Cover', d: 'Cover opened to change the element.', label: false });
      dpart(g, boltsY(8, 0.31, 0.72, 0.84, 0.012), DC.steelD, null);
      // Star-shaped (pleated) element
      const pl = []; const n = 28; for (let i = 0; i <= n * 2; i++) { const a = i / (n * 2) * Math.PI * 2, r = i % 2 ? 0.18 : 0.21; pl.push([r * Math.cos(a), r * Math.sin(a)]); }
      const pin = []; for (let i = 0; i <= n * 2; i++) { const a = i / (n * 2) * Math.PI * 2, r = i % 2 ? 0.158 : 0.188; pin.push([r * Math.cos(a), r * Math.sin(a)]); }
      const el = extXZ(shapeOf(pl, [pin]), -0.6, 0.55);
      elems.push(dpart(g, el, DC.mesh, { ko: `Filter element ${nm}`, en: 'Pleated mesh element', d: 'Element of stainless mesh (50 µm, educational) folded into pleats for a larger filtering area. Dirt builds up on the outside.' }, { metal: 0.7, rough: 0.6 }));
      dpart(g, ringG(0.07, 0.085, -0.85, 0.6, 20), DC.steelL, k ? null : { ko: 'Clean-side centre tube', en: 'Perforated centre tube', d: 'Perforated support tube where filtered fuel collects and goes down to the bottom outlet.' });
      dpart(g, ringG(0.08, 0.23, -0.64, -0.6), DC.steelD, null); dpart(g, ringG(0.08, 0.23, 0.55, 0.59), DC.steelD, null);
      dirt.push(dpart(g, ringG(0.212, 0.24, -0.58, 0.53, 40), DC.carbon, k ? null : { ko: 'Accumulated dirt', en: 'Filter cake', d: 'Catalytic fines (Al·Si), sludge, rust and so on in the fuel. The thicker it gets, the higher the differential pressure.' }, { metal: 0, rough: 1 }));
      dfluid(g, cylY(0.275, -0.75, 0.73, 32), 'fuel', 0.1);
      dpart(g, cylY(0.02, -1.0, -0.86, 8), DC.brass, k ? null : { ko: 'Drain cock', en: 'Drain cock', d: 'Cock for draining fuel from the chamber before cleaning.' });
    });
    // Changeover cocks (top: inlet, bottom: outlet)
    const valves = [];
    [[0.98, 'Inlet changeover cock', 'Inlet change-over cock'], [-1.08, 'Outlet changeover cock', 'Outlet change-over cock']].forEach(([y, ko, en], k) => {
      const vb = new THREE.Group(); vb.position.y = y; root.add(vb);
      dpart(vb, cylZ(0.13, -0.16, 0.16, 32), DC.castL, { ko, en, d: 'Turning the tapered plug 90° switches flow to A or B. The upper and lower cocks are linked by a lever so they always use the same side. During changeover both sides are briefly open so flow is never interrupted.' });
      const plug = new THREE.Group(); vb.add(plug); valves.push(plug);
      dpart(plug, cylZ(0.1, -0.15, 0.14, 28), DC.brass, k ? null : { ko: 'Changeover plug', en: 'Taper plug', d: 'Plug with an L-shaped bore.' });
      dpart(plug, box(0.24, 0.035, 0.02, 0, 0, 0.18, 0.008), DC.red, null);
      dpart(vb, pipeAlong('x', 0.06, -0.45, -0.1, 0, 0, 0.012), DC.steelD, null);
      dpart(vb, pipeAlong('x', 0.06, 0.1, 0.45, 0, 0, 0.012), DC.steelD, null);
      dpart(vb, pipeAlong('y', 0.06, k ? -0.4 : 0.1, k ? -0.1 : 0.4, 0, 0, 0.012, true), DC.steelD, null);
      X.forEach(x => dpart(vb, pipeAlong('y', 0.06, k ? 0 : -0.25, k ? 0.24 : 0, x, 0, 0.012), DC.steelD, null));
    });
    dpart(root, cylY(0.012, -1.0, 1.0, 8).translate(0, 0, 0.24), DC.steelD, { ko: 'Linked handle', en: 'Interlinked handle', d: 'Turns both cocks together.' }, { nocut: true });
    // Differential pressure gauge
    const gdp = dgauge(root, 0.0, 0.25, 0.08, 0.12, 'Diff. pressure', 0, 1.2, 'bar', { ko: 'Differential pressure gauge', en: 'Differential pressure gauge', d: 'Pressure difference between inlet and outlet. Shows clogging and viscosity together. Built-in alarm contact (0.6 bar, educational).' });
    // Flow: inlet → upper cock → chamber in use → outside of element → inside → lower cock → outlet
    const route = k => { const x = X[k], s = Math.sign(x); return [[0, 1.45, -0.02], [0, 0.98, -0.02], [x * 0.5, 0.98, -0.03], [x, 0.98, -0.03], [x, 0.7, -0.05], [x + s * 0.25, 0.4, -0.06], [x + s * 0.25, -0.3, -0.06], [x + s * 0.12, -0.4, -0.04], [x, -0.5, -0.03], [x, -1.08, -0.02], [0, -1.08, -0.02], [0, -1.5, -0.02]]; };
    const flowOf = k => () => { const c = Math.cos(valves[0].rotation.z), w = k === 0 ? clamp(c, 0, 1) : clamp(-c, 0, 1); return w * 1.0 + (DVS.swTarget != null ? 0.3 : 0) * (1 - Math.abs(c)); };
    dflow(root, route(0), 'fuel', flowOf(0), { sp: 0.05 }); dflow(root, route(1), 'fuel', flowOf(1), { sp: 0.05 });
    // Dirt particles (approach the element from the dirty side and stop)
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
    return kvRow('In use', `Filter chamber ${nm}${DVS.swTarget != null ? ' (switching)' : ''}`) + kvRow('Diff. pressure', `<span style="color:${al ? 'var(--bad)' : 'inherit'}">${FSS.dpF.toFixed(2)} bar${al ? ' · alarm' : ''}</span>`, 'calc')
      + kvRow('Clogging A / B', `${(FSS.clog[0] * 100).toFixed(0)} % / ${(FSS.clog[1] * 100).toFixed(0)} %`, 'edu') + kvRow('Fuel viscosity', `${FSS.visc.toFixed(1)} cSt`, 'calc')
      + kvRow('Flow through', `${(FSP.Qcirc * 3.6).toFixed(1)} t/h`, 'edu') + kvRow('Mesh size', `${FSP.filterFine} µm`, 'edu');
  },
});

// ---------------- Pressure control valve (return side, holds upstream pressure) ----------------
defDevice('pcv', {
  ko: 'Fuel pressure control valve', en: 'Fuel pressure control valve (back-pressure)', sys: 'Fuel supply system', parts: ['pcv'],
  principle: `<p>A spring-loaded back-pressure valve at the end of the engine fuel return line that keeps the <b>upstream (engine inlet) pressure</b> constant. When the force of inlet pressure lifting the valve disc exceeds the spring force, it opens and lets the surplus fuel flow to the venting tank (about 4 bar).</p>
  <p>When engine consumption rises, the return flow falls and the valve closes a little; when consumption falls it opens further. This holds the engine inlet pressure at about 7–8 bar so the hot fuel does not vaporise and the booster suction valves fill properly.</p>`,
  sources: [
    { t: 'ref', text: 'MAN B&W Project Guide · Fuel oil system: engine inlet pressure 7–8 bar, pressure control valve on the return side', url: 'https://www.man-es.com/applications/projectguides/2stroke/content/printed/S60ME-C10_5.pdf' },
    { t: 'edu', text: 'Valve size, spring arrangement (piston instead of diaphragm) and the opening formula are educational assumptions' }],
  view: { t: [0, 0.3, -0.1], d: [0.3, 0.2, 1], k: 0.85 },
  build(root) {
    dpart(root, lathe([[0, -0.38], [0.24, -0.38], [0.3, -0.2], [0.3, 0.2], [0.18, 0.32], [0.18, 0.4], [0.14, 0.4], [0.14, 0.3], [0.24, 0.18], [0.24, -0.18], [0.2, -0.32], [0, -0.32]]), DC.castL, { ko: 'Valve body', en: 'Valve body', d: 'Globe-type cast body. Inlet at the bottom, outlet at the side.' });
    dpart(root, pipeAlong('y', 0.08, -0.8, -0.36, 0, 0, 0.014, true), DC.steelD, { ko: 'Inlet (engine return pipe)', en: 'Inlet from engine return', d: 'About 8 bar, the same as the engine inlet.' });
    dpart(root, pipeAlong('x', 0.08, 0.28, 0.85, 0.02, 0, 0.014, true), DC.steelD, { ko: 'Outlet (to venting tank)', en: 'Outlet to venting box', d: 'About 4 bar.' });
    dpart(root, ringG(0.075, 0.13, -0.24, -0.2), DC.stellite ?? 0xd9d2b8, { ko: 'Valve seat', en: 'Seat', d: 'Hardened ring the disc sits on.' });
    const disc = new THREE.Group(); root.add(disc);
    dpart(disc, lathe([[0, -0.21], [0.11, -0.21], [0.11, -0.17], [0.04, -0.13], [0.025, -0.13], [0.025, 0.7], [0, 0.7]]), DC.steelL, { ko: 'Disc · stem', en: 'Disc & stem', d: 'Lifts open when inlet pressure × seat area exceeds the spring force.' });
    dpart(disc, cylY(0.13, 0.44, 0.48, 28), DC.steelD, { ko: 'Spring plate', en: 'Spring plate', d: '' , label: false });
    dpart(root, vesselY(0.18, 0.4, 1.12, 0.015, 0.05, { bot: false }), DC.paint, { ko: 'Spring bonnet', en: 'Spring bonnet', d: '' });
    const spr = dpart(root, springG(0.1, 0.48, 1.0, 6, 0.016), DC.spring, { ko: 'Set spring', en: 'Set spring', d: 'Compression spring that sets the pressure. As the opening grows it is compressed a little more, so the pressure rises slightly (proportional offset).' });
    dpart(root, cylY(0.02, 1.0, 1.3, 10), DC.steelL, { ko: 'Adjusting screw', en: 'Adjusting screw', d: 'Screwing it in compresses the spring and raises the set pressure.' });
    dpart(root, cylY(0.1, 1.0, 1.03, 24), DC.steelD, null);
    dfluid(root, cylY(0.2, -0.32, 0.18, 28), 'fuel', 0.15);
    const gI = dgauge(root, -0.35, -0.6, 0.02, 0.1, 'Inlet', 0, 16, 'bar', { ko: 'Inlet gauge', en: 'Inlet gauge', d: '' });
    const gO = dgauge(root, 0.65, 0.3, 0.02, 0.1, 'Outlet', 0, 16, 'bar', { ko: 'Outlet gauge', en: 'Outlet gauge', d: '' });
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
    return kvRow('Inlet pressure (engine side)', `${(FSS.pIn + FSS.pcv * 0.15).toFixed(2)} bar`, 'ref') + kvRow('Outlet pressure', `${FSS.pRet.toFixed(1)} bar`, 'ref')
      + kvRow('Return flow', `${(FSS.ret * 3600).toFixed(0)} kg/h`, 'calc') + kvRow('Valve opening', `${(FSS.pcv * 100).toFixed(0)} %`, 'calc') + kvRow('Engine consumption', `${(fuelConsumption() * 3600).toFixed(0)} kg/h`, 'm0d');
  },
});
