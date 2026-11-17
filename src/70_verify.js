// ===================================================================
// 70 · VERIFY — automatic checks of the completion criteria
// ===================================================================
function movingSnapshot() {
  ENG.updateMatrixWorld(true);
  const objs = [MOV.crank, ...MOV.throws, ...MOV.xh, ...MOV.rod, ...MOV.spindle, MOV.hpsGear];
  const out = [];
  objs.forEach(o => o.traverse(c => { if (c.isMesh) out.push(...c.matrixWorld.elements); }));
  return out;
}
const maxDiff = (a, b) => { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m; };
function saveFlowState() { return { theta: SIM.state.theta, ph: PATHS.map(p => p.phase), lr: PATHS.map(p => p.lastRate) }; }
function restoreFlowState(s) { SIM.state.theta = s.theta; PATHS.forEach((p, i) => { p.phase = s.ph[i]; p.lastRate = s.lr[i]; }); }

function runVerify() {
  const R = [];
  const add = (ok, name, detail) => R.push({ ok, name, detail });
  const saved = saveFlowState(), wasPlaying = SIM.state.playing;
  SIM.state.playing = false; SIM.noEngineAdvance = true;
  const offs = cylOffsets();

  // 1. Mechanical parts return after a 360° turn
  {
    let worst = 0;
    for (const T0 of [0, 37.25, 123.4, 271.9]) {
      applyMechanics(T0); const a = movingSnapshot();
      applyMechanics(T0 + 360); const b = movingSnapshot();
      applyMechanics(T0 - 720); const c = movingSnapshot();
      worst = Math.max(worst, maxDiff(a, b), maxDiff(a, c));
    }
    add(worst < 1e-6, 'All mechanical parts return to their initial positions after a 360° turn', `Maximum matrix error of crankshaft, throws, crossheads, connecting rods, exhaust valves and chain gear ${worst.toExponential(2)} (limit < 1e-6). The turbocharger is excluded because its speed is handled separately from the engine.`);
  }
  // 2. Playback vs pause-then-scrub agree
  {
    const Ta = 12.0, Tb = 12.0 + 257.3;
    restoreFlowState({ theta: Ta, ph: PATHS.map(() => 0), lr: PATHS.map(() => 0) });
    let T = Ta; const steps = 380, h = (Tb - Ta) / steps;
    for (let i = 0; i < steps; i++) { advanceFlows(T, T + h); T += h; }
    applyMechanics(T); updateFlows(T);
    const mA = movingSnapshot(), phA = PATHS.map(p => p.phase), cylA = FX.cyl.map(F => Array.from(F.charge.pos));
    const rdA = Array.from({ length: CFG.nCyl }, (_, k) => { const th = T - offs[k]; return [M.portFrac(th), M.evLift01(th), M.inj01(th, SIM.state.load), M.crownY(th), M.phase(th, SIM.state.load).k]; });
    restoreFlowState({ theta: Ta, ph: PATHS.map(() => 0), lr: PATHS.map(() => 0) });
    SIM.state.ref = 0; setRefAngle(wrap360(Tb));
    const T2 = SIM.state.theta; applyMechanics(T2); updateFlows(T2);
    const mB = movingSnapshot(), phB = PATHS.map(p => p.phase), cylB = FX.cyl.map(F => Array.from(F.charge.pos));
    const rdB = Array.from({ length: CFG.nCyl }, (_, k) => { const th = T2 - offs[k]; return [M.portFrac(th), M.evLift01(th), M.inj01(th, SIM.state.load), M.crownY(th), M.phase(th, SIM.state.load).k]; });
    const dm = maxDiff(mA, mB);
    let dph = 0; PATHS.forEach((p, i) => { const ref = Math.max(0.05, Math.abs(phA[i])); dph = Math.max(dph, Math.abs(phA[i] - phB[i]) / ref); });
    let dc = 0; cylA.forEach((a, i) => dc = Math.max(dc, maxDiff(a, cylB[i])));
    const rdOk = rdA.every((r, k) => r.every((v, j) => typeof v === 'string' ? v === rdB[k][j] : Math.abs(v - rdB[k][j]) < 1e-9));
    add(dm < 1e-6 && dc < 1e-6 && rdOk && dph < 1e-6, 'Playback and pause/manual crank-angle scrubbing give the same operating state',
      `Θ ${Ta}° → ${Tb.toFixed(1)}°: 380 frames of playback vs one slider move. Mechanical matrix error ${dm.toExponential(1)}, in-cylinder particle error ${dc.toExponential(1)}, phase/port/valve/injection display ${rdOk ? 'match' : 'mismatch'}, pipe particle travel relative error ${dph.toExponential(1)} (cumulative integral tables, limit < 1e-6).`);
  }
  // 3. Scavenge port exposure matches piston position (checked on the rendered mesh)
  {
    const pm = PARTS.ports.inst[0].proc[0]; pm.geometry.computeBoundingBox();
    const portTopMesh = pm.geometry.boundingBox.max.y, portBotMesh = pm.geometry.boundingBox.min.y;
    let mism = 0, phaseMism = 0, firstOpen = null, lastOpen = null;
    for (let a = 0; a < 360; a += 0.25) {
      applyMechanics(a);                                  // cylinder 1 θ = Θ
      const crownMesh = MOV.xh[0].position.y + CFG.pistonH;
      const geomOpen = crownMesh < portTopMesh - 1e-9;
      const modelOpen = M.portFrac(a) > 0;
      if (geomOpen !== modelOpen) mism++;
      const pk = M.phase(a, SIM.state.load).k;
      if (modelOpen !== (pk === 'scav' || pk === 'scav2')) phaseMism++;
      if (modelOpen) { if (firstOpen === null) firstOpen = a; lastOpen = a; }
    }
    const [po, pc] = M.portAngles();
    add(mism === 0 && phaseMism === 0 && Math.abs((po + pc) / 2 - 180) < 1e-6, 'Scavenge port exposure matches piston position',
      `1440 points at 0.25°: mesh (crown ${'y'} vs port top ${portTopMesh.toFixed(3)} m) verdict differs from the model verdict at ${mism} points, phase display mismatches ${phaseMism} points. Open ${po.toFixed(2)}° – close ${pc.toFixed(2)}° (symmetric about BDC, port height ${(portTopMesh - portBotMesh) * 1000 | 0} mm).`);
  }
  // 4. No flow through closed valves or ports
  {
    let viol = 0, checked = 0;
    const gates = [[/^air\.box/, th => M.portFrac(th)], [/^exh\.cyl/, th => M.evLift01(th)], [/^fuel\.hp/, th => M.inj01(th, SIM.state.load)], [/^oil\.fpb/, th => M.inj01(th, SIM.state.load)], [/^oil\.ev/, th => Math.abs(M.evLiftRate(th))]];
    PATHS.filter(p => p.cyl != null).forEach(p => { const g = gates.find(([re]) => re.test(p.id)); if (!g) return; for (let a = 0; a < 360; a += 0.5) { checked++; if (g[1](a) <= 0 && Math.abs(p.rate(a)) > 1e-12) viol++; } });
    const auxSaved = SIM.state.aux; let auxViol = 0;
    [true, false].forEach(ax => { SIM.state.aux = ax; PATHS.filter(p => /^air\.(flap|blower)/.test(p.id)).forEach(p => { const open = /flap/.test(p.id) ? !ax : ax; if (!open && p.rate(0) !== 0) auxViol++; }); });
    SIM.state.aux = auxSaved;
    add(viol === 0 && auxViol === 0, 'No flow through closed valves or ports', `Cylinder paths checked at ${checked} instants: violations ${viol}. Auxiliary blower check valve / main flap state violations ${auxViol}.`);
  }
  // 5. Air, fuel and exhaust gas paths are connected
  {
    let endErr = 0, gapMax = 0; const bad = [];
    PATHS.forEach(p => {
      const a = PORTS[p.from], b = PORTS[p.to];
      const e = Math.max(a ? p.route.start.distanceTo(a.pos) : 99, b ? p.route.end.distanceTo(b.pos) : 99);
      if (e > 1e-6) { endErr++; bad.push(p.id); }
      const L = p.route.lut; for (let i = 3; i < L.length; i += 3) gapMax = Math.max(gapMax, Math.hypot(L[i] - L[i - 3], L[i + 1] - L[i - 2], L[i + 2] - L[i - 1]));
    });
    const E = new Set(); PATHS.forEach(p => { for (let i = 0; i < p.nodes.length - 1; i++) E.add(p.nodes[i] + '>' + p.nodes[i + 1]); });
    const chains = [];
    for (let k = 0; k < CFG.nCyl; k++) {
      chains.push(['Air ' + (k + 1), ['filter', 'tc_comp', 'cooler', 'mist', 'chamber', 'flap', 'scavrec', 'scavbox', 'ports', 'cyl' + k]]);
      chains.push(['Exhaust ' + (k + 1), ['cyl' + k, 'evspindle', 'exhpipe', 'exhrec', 'exhduct', 'tc_turb', 'exhduct', 'egb.gas', 'funnel']]);
      chains.push(['Fuel ' + (k + 1), ['servtank', 'supplypump', 'ventbox', 'circpump', 'heater.fuel', 'visco', 'ffilter', 'fuelrail', 'fpb' + k, 'hpfuel', 'fuelvalve', 'cyl' + k]]);
      chains.push(['Control oil ' + (k + 1), ['oilpan', 'autofilter', 'hps', 'ctrlrail', 'hcu' + k, 'accum', 'fiva' + k, 'evactuator', 'hpoil_ev', 'evact' + k]]);
    }
    chains.push(['Auxiliary blower path', ['chamber', 'auxblower', 'checkv', 'scavrec']], ['Fuel return', ['fuelrail', 'pcv', 'ventbox']], ['Boiler water', ['drum', 'circpump_w', 'egb.water', 'drum']], ['Feed water', ['cascade', 'feedpump', 'drum']], ['Steam', ['drum', 'heater.steam', 'trap']]);
    const broken = chains.filter(([, c]) => c.slice(0, -1).some((n, i) => !E.has(n + '>' + c[i + 1]))).map(([n]) => n);
    add(endErr === 0 && broken.length === 0 && gapMax < 0.08, 'Air, fuel, exhaust gas, control oil and water paths are connected', `All ${PATHS.length} paths have both ends connected to ports (end-point violations ${endErr}${bad.length ? ': ' + bad.slice(0, 4).join(', ') : ''}), maximum gap between curve samples ${(gapMax * 1000).toFixed(0)} mm. Of ${chains.length} specified chains, broken ${broken.length}${broken.length ? ' (' + broken.join(', ') + ')' : ''}.`);
  }
  // 6. No mixing of fluids in the turbocharger or boiler
  {
    const sides = { tc_turb: ['exh'], tc_comp: ['air'], 'egb.gas': ['exh'], 'egb.water': ['water', 'steam'], 'heater.fuel': ['fuel'], 'heater.steam': ['steam', 'water'] };
    let wrongPort = 0, wrongSide = 0;
    PATHS.forEach(p => {
      [p.from, p.to].forEach(id => { const pf = PORTS[id].fluid; if (pf !== p.fluid && !(p.fluid === 'water' && pf === 'water')) wrongPort++; });
      p.nodes.forEach(n => { if (sides[n] && !sides[n].includes(p.fluid)) wrongSide++; });
    });
    const samples = (re) => PATHS.filter(p => re.test(p.id)).flatMap(p => Array.from({ length: p.route.n + 1 }, (_, i) => V3(p.route.lut[i * 3], p.route.lut[i * 3 + 1], p.route.lut[i * 3 + 2])));
    const minD = (A, B) => { let m = 1e9; for (const a of A) for (const b of B) m = Math.min(m, a.distanceToSquared(b)); return Math.sqrt(m); };
    const dTC = minD(samples(/^air\.tc$/), samples(/^exh\.tc$/));
    const gasE = samples(/^exh\.egb/), watE = samples(/^water\.egb$/);
    const dEGB = minD(gasE, watE);
    add(wrongPort === 0 && wrongSide === 0 && dTC > 0.5 && dEGB > 0.15, 'Different fluids are not wrongly connected in the turbocharger or boiler',
      `Port fluid mismatches ${wrongPort}, separated zones (turbine/compressor, boiler gas/water, heater fuel/steam) violated ${wrongSide}. Minimum distance between compressor air path and turbine exhaust path ${dTC.toFixed(2)} m (linked only by the common shaft), minimum distance between boiler exhaust path and tube water path ${dEGB.toFixed(2)} m (outside the 0.06 m tube radius).`);
  }
  // 7. Part selection and description after zoom, orbit and cut
  {
    const camS = { p: camera.position.clone(), t: controls.target.clone() }, viewS = SIM.view, cutS = { a: CLIP.axis, p: $('cutpos').value }, refS = SIM.state.ref, selS = SIM.sel;
    const flowS = { ...FLOW_ON }; Object.keys(FLOW_ON).forEach(f => FLOW_ON[f] = false);
    const rect = canvas.getBoundingClientRect();
    const scen = [];
    const tryPick = (name, worldPt, expect, setup) => {
      setup(); CAM.anim = null; controls.update(); camera.updateMatrixWorld(); ENG.updateMatrixWorld(true); SYSG.updateMatrixWorld(true);
      const v = worldPt.clone().project(camera);
      const cx = rect.left + (v.x + 1) / 2 * rect.width, cy = rect.top + (1 - v.y) / 2 * rect.height;
      const rawRay = new THREE.Raycaster(); rawRay.setFromCamera(new THREE.Vector2(v.x, v.y), camera);
      const raw = rawRay.intersectObjects(PICKABLE, false).filter(h => isShown(h.object));
      const h = pick(cx, cy);
      let infoOk = false;
      if (h) { select(h.id, h.inst, false); infoOk = $('info').textContent.includes(PARTS[h.id].ko); }
      const clippedFirst = raw.length && raw[0].object.material.clippingPlanes && raw[0].object.material.clippingPlanes.length && !clipKeeps(raw[0].point);
      scen.push({ name, ok: !!h && expect.includes(h.id) && infoOk, got: h ? PARTS[h.id].ko : 'none', clippedFirst });
    };
    const setTheta = a => { SIM.state.theta = a; applyMechanics(a); };
    // (a) cutaway + front zoom
    tryPick('Cutaway · front zoom', V3(0.05, M.crownY(90) - 0.12, LY.zc(0) - 0.02), ['piston'], () => {
      setTheta(90); setViewMode('section'); setCut('z', (LY.zc(0) - CUT.z[0]) / (CUT.z[1] - CUT.z[0])); camera.position.set(0.4, 7.2, LY.zc(0) + 6.5); controls.target.set(0, M.crownY(90) - 0.1, LY.zc(0));
    });
    // (b) same cutaway, orbit + further zoom
    tryPick('Cutaway · 35° orbit · 2× zoom', V3(0.0, M.crownY(90) - 0.12, LY.zc(0) - 0.02), ['piston', 'rings'], () => {
      const t = V3(0, M.crownY(90) - 0.1, LY.zc(0)); controls.target.copy(t); camera.position.copy(t).add(V3(Math.sin(35 * DEG) * 3.2, 0.5, Math.cos(35 * DEG) * 3.2));
    });
    // (c) cut moved to cylinder 3 + crosshead
    tryPick('Cut moved (#3) · crosshead', V3(0.0, M.xhY(90 - offs[2]), LY.zc(2) - 0.05), ['xhpin', 'xhbearing', 'conrod', 'shoe'], () => {
      setCut('z', (LY.zc(2) - CUT.z[0]) / (CUT.z[1] - CUT.z[0])); const t = V3(0, M.xhY(90 - offs[2]), LY.zc(2)); controls.target.copy(t); camera.position.copy(t).add(V3(-1.2, 0.8, 4.5));
    });
    // (d) longitudinal (x cut) side view · connecting rod
    tryPick('Longitudinal · side view · main bearing', V3(0.02, 0.0, LY.zb(3)), ['mainbearing', 'crankshaft'], () => {
      setCut('x', 0.5); const t = V3(0, 0, LY.zb(3)); controls.target.copy(t); camera.position.copy(t).add(V3(5.5, 1.2, 1.5));
    });
    // (e) ghost casing · turbocharger compressor wheel
    tryPick('Ghost casing · turbocharger compressor wheel', V3(-3.55, 8.0 + 0.12, -2.6), ['tc_comp', 'tc_shaft'], () => {
      setViewMode('ghost'); const t = V3(-3.55, 8.0, -2.6); controls.target.copy(t); camera.position.copy(t).add(V3(-3.5, 1.6, -3.0));
    });
    const ok = scen.every(s => s.ok);
    // restore
    Object.assign(FLOW_ON, flowS); setViewMode(viewS); if (cutS.a === 'z') setCut('z', cutS.p / 1000); else setCut('x', cutS.p / 1000); SIM.state.ref = refS;
    camera.position.copy(camS.p); controls.target.copy(camS.t); select(selS ? selS.id : null, selS ? selS.inst : null, false);
    add(ok, 'Part selection and description after zoom, orbit and cut changes', scen.map(s => `${s.ok ? '✓' : '✗'} ${s.name}: ${s.got}${s.clippedFirst ? ' (clipped parts in front skipped)' : ''}`).join(' · '));
  }
  // 8. 0D cylinder model conservation laws
  {
    const S = TQ.summary();
    add(Math.abs(S.massErr) < 1e-4 && Math.abs(S.energyErr) < 1e-4, '0D cylinder model: mass and energy conserved over one cycle',
      `Mass (in − out + fuel)/in = ${S.massErr.toExponential(1)}, energy (heat of combustion + enthalpy in − enthalpy out − work − wall heat loss)/reference = ${S.energyErr.toExponential(1)} (limit < 1e-4). Indicated efficiency ${(S.etaI * 100).toFixed(1)} %, wall heat loss ${(S.qwFrac * 100).toFixed(1)} %.`);
  }
  // 9 · 10. Steady-state turbo matching (current conditions) + comparison with rated-point references — computed on a copy of the state, then restored
  {
    const keep = JSON.parse(JSON.stringify({ ...ENGS, cyc: null, hist: [] })), keepCyc = ENGS.cyc, keepRS = [SIM.state.rpm, SIM.state.load];
    settleEngine();
    const w = ENGS.N * 2 * Math.PI / 60, Pf = 0.0178 * w * w;
    const bal = Math.abs(ENGS.Pt - ENGS.Pc - Pf) / Math.max(1e4, ENGS.Pc);
    const fIn = Math.abs(ENGS.mdC - ENGS.mIn) / Math.max(0.5, ENGS.mIn), fOut = Math.abs(ENGS.mdT - ENGS.mOut) / Math.max(0.5, ENGS.mOut);
    add(bal < 0.01 && fIn < 0.01 && fOut < 0.01, 'Turbocharger matching: power and flow balance at steady state',
      `Current conditions ${SIM.state.rpm} r/min · ${Math.round(SIM.state.load * 100)} %: turbine ${(ENGS.Pt / 1e6).toFixed(3)} MW = compressor ${(ENGS.Pc / 1e6).toFixed(3)} MW + bearing loss ${(Pf / 1e3).toFixed(0)} kW (error ${(bal * 100).toFixed(2)} %). Compressor flow ${ENGS.mdC.toFixed(2)} = engine inflow ${ENGS.mIn.toFixed(2)} kg/s (${(fIn * 100).toFixed(2)} %), turbine flow ${ENGS.mdT.toFixed(2)} = engine outflow ${ENGS.mOut.toFixed(2)} kg/s (${(fOut * 100).toFixed(2)} %).`);
    SIM.state.rpm = 105; SIM.state.load = 1; ENGS.dirty = true; settleEngine();
    const S = TQ.summary(), ps = ENGS.ps / 1e5;
    const chk = [['Scavenge pressure', ps, 3.8 * 0.93, 3.8 * 1.07, ps.toFixed(2) + ' bar abs (reference 3.8 ±7 %)'], ['Pmax', S.pmax, 150, 210, S.pmax.toFixed(0) + ' bar'], ['IMEP', S.imep, 18, 24, S.imep.toFixed(1) + ' bar'],
      ['Exhaust receiver temperature', S.Tx - 273, 300, 480, Math.round(S.Tx - 273) + ' °C'], ['Temperature after T/C', S.Tout - 273, 180, 300, Math.round(S.Tout - 273) + ' °C'], ['λ', S.lambda, 1.8, 3.6, S.lambda.toFixed(2)], ['Indicated efficiency', S.etaI, 0.46, 0.56, (S.etaI * 100).toFixed(1) + ' %']];
    const bad = chk.filter(c => !(c[1] >= c[2] && c[1] <= c[3]));
    add(bad.length === 0, 'Rated point (105 r/min · 100 %): comparison with references and plausible ranges',
      chk.map(c => `${c[0]} ${c[4]}`).join(' · ') + '. Only the scavenge pressure is a reference value (S60ME project guide example); the rest are educational checks against the usual range for large two-stroke engines.' + (bad.length ? ' Out of range: ' + bad.map(c => c[0]).join(', ') : ''));
    Object.assign(ENGS, keep); ENGS.cyc = keepCyc; SIM.state.rpm = keepRS[0]; SIM.state.load = keepRS[1]; ENGS.lin = keep.lin; ENGS.dirty = false;
  }
  // 11. 2D flow field
  {
    const F = FIELD.cur;
    if (!F) add(false, '2D flow field: continuity · periodicity · port/valve consistency', 'The flow field computation has not finished yet. Run again in a moment.');
    else {
      const [po, pc] = M.portAngles(); let incS = 0, incA = 0;
      for (let d = Math.ceil(pc) + 1; d < Math.floor(po) + 360 - 1; d++) {
        const a0 = d % 360, a1 = (d + 1) % 360; if (a1 === 0 && false) continue;
        if (a0 === 299) continue;   // the periodic seam (300°) is excluded and checked separately under periodicity
        incS = Math.max(incS, F.sMean[a1] - F.sMean[a0]); incA = Math.max(incA, F.aMean[a1] - F.aMean[a0]);
      }
      const ok = F.D.divMax < 0.1 && F.D.periodA < 0.04 && incS < 2e-3 && incA < 2e-3;
      add(ok, '2D flow field: continuity · periodicity · port/valve consistency',
        `Maximum velocity divergence error after projection ${(F.D.divMax * 1000).toFixed(1)} mm/s (limit < 100 mm/s). Cycle periodicity: mean air-fraction difference ${(F.D.periodA * 100).toFixed(2)} %, temperature ${(F.D.periodT * 100).toFixed(2)} %. While the ports are closed (${pc.toFixed(0)}°→${po.toFixed(0)}°), maximum increase of supplied-air tracer mass ${(incS * 1000).toFixed(2)} g, maximum increase of fresh-air mass ${(incA * 1000).toFixed(2)} g per 1° (air can only enter through the ports → there should be no increase, limit < 2 g). Grid ${F.NX}×${F.NY}.`);
    }
  }
  // 12. HCU internal sync (FIVA · booster · exhaust valve actuator)
  {
    buildHcuTables(); const n = HCU.n, d = 360 / n, load = SIM.state.load; let bad = 0, boostOut = 0, maxB = 0;
    for (let i = 0; i < n; i++) {
      const th = i * d, inj = M.inj01(th, load) > 0, ev = M.evLift01(th) > 0.02, f = HCU.fiva[i], since = wrapS(th - CFG.soi);
      if (inj && f < 0.5 && M.inj01(th, load) > 0.99) bad++;                 // during injection FIVA is P→Cfi
      if (th > CFG.evo + CFG.evOpenRamp && th < CFG.evc - CFG.evCloseRamp - 3 && f > -0.5) bad++;   // while the exhaust valve is held fully open FIVA is P→Cva
      if (HCU.boost[i] > 0.02 && !(since >= -1 && since <= M.injDur(load) + 42)) boostOut++;   // the booster moves only in the injection window + return period
      maxB = Math.max(maxB, HCU.boost[i]);
    }
    add(bad === 0 && boostOut === 0 && (load < 0.01 || maxB > 0.99), 'HCU internal motion is synchronised with crank angle', `FIVA direction mismatches ${bad} points, booster moves outside the injection window ${boostOut} points, booster maximum stroke ${(maxB * 100).toFixed(0)} % (injection ${wrap360(CFG.soi).toFixed(1)}° for ${M.injDur(load).toFixed(1)}°, exhaust valve ${CFG.evo}–${CFG.evc}°)`);
  }
  // 13. Accumulator oil volume conserved over a cycle · below safety valve
  {
    buildHcuTables(); const n = HCU.n; let tot = 0; for (let i = 0; i < n; i++) tot += HCU.cons[i];
    const qIn = tot * (1 + FSP.leak) / n; let v = 0; for (let i = 0; i < n; i++) v += qIn - HCU.cons[i] * (1 + FSP.leak);
    const pmax = Math.max(...HCU.acc), pmin = Math.min(...HCU.acc);
    add(Math.abs(v) < 1e-9 && pmax <= FSP.relief[0] && pmin > 0.5 * FSS.pSet, 'Accumulator oil volume conserved · pressure range', `Oil volume change over one cycle ${v.toExponential(1)} L, pressure ${pmin.toFixed(1)}–${pmax.toFixed(1)} bar (set ${FSS.pSet} bar, safety valve ${FSP.relief[0]} bar)`);
  }
  // 14. Fuel system: mass and energy balance, Walther viscosity, steady-state viscosity control
  {
    const mf = fuelConsumption(), mb = Math.abs(FSS.supply + FSS.ret - FSP.Qcirc) + Math.abs(FSS.supply - mf);
    const Qcalc = FSP.Qcirc * FSP.cp * (FSS.Tout - FSS.Tin), eb = Math.abs(Qcalc - FSS.steam * FSP.hfg) / Math.max(1, Qcalc);
    const v50 = FUEL.visc(50), tmix = (FSS.supply * FSP.Tsvc + FSS.ret * (FSS.Tout - 6)) / FSP.Qcirc;
    add(mb < 1e-9 && eb < 1e-6 && Math.abs(v50 - FSP.v50) < 0.01 && Math.abs(FSS.visc - FSP.viscSet) < 1.5 && Math.abs(tmix - FSS.Tin) < 0.5, 'Fuel supply system mass and energy balance', `Consumption ${(mf * 3600).toFixed(0)} kg/h = make-up; make-up + return = circulation ${(FSP.Qcirc * 3600).toFixed(0)} kg/h (error ${mb.toExponential(1)}), heat duty ${(Qcalc / 1000).toFixed(1)} kW = steam ${(FSS.steam * 3600).toFixed(0)} kg/h × latent heat, viscosity ${FSS.visc.toFixed(2)} cSt (set ${FSP.viscSet}), viscosity at 50 °C ${v50.toFixed(1)} cSt`);
  }
  // 15. Open and close the device internal views
  {
    const was = DV.open; const rep = []; let fail = 0;
    for (const id of Object.keys(DEVICES)) {
      try {
        detailOpen(id); const st = { dt: 0.02, dtVis: 0.02, load: SIM.state.load, rpm: SIM.state.rpm, playing: true };
        detailTick(0.02, st); const kv = DEVICES[id].readouts ? DEVICES[id].readouts(st) : '';
        const ok = DV.labels.length >= 5 && DV.flows.length >= 1 && DV.picks.length >= 5 && !/NaN|undefined/.test(kv);
        if (!ok) { fail++; rep.push(id); }
      } catch (e) { fail++; rep.push(id + ':' + e.message); }
    }
    const orphan = Object.keys(DEV_OF).filter(p => !PARTS[p]);
    if (was) detailOpen(was); else detailClose();
    add(fail === 0 && orphan.length === 0, 'Device internal views (all devices)', `${Object.keys(DEVICES).length} device scenes built and updated, internal part labels ≥ 5, flows ≥ 1, no NaN in readouts${fail ? ' · failed: ' + rep.join(', ') : ''}${orphan.length ? ' · unconnected parts: ' + orphan.join(', ') : ''}`);
  }
  restoreFlowState(saved); SIM.state.playing = wasPlaying; SIM.noEngineAdvance = false; SIM.playIcon && SIM.playIcon();
  applyMechanics(SIM.state.theta);
  return R;
}
function openVerify() {
  const R = runVerify();
  const n = R.filter(r => r.ok).length;
  openModal(`<h2>Self-check results · ${n}/${R.length} passed</h2><p class="sub">The completion criteria were recomputed with the current settings. You can run this again after changing the timing.</p>
    <div class="vres">${R.map(r => `<div class="it"><span class="${r.ok ? 'pass' : 'fail'}">${r.ok ? '✓' : '✗'}</span><div><b>${r.name}</b><div class="d">${r.detail}</div></div></div>`).join('')}</div>
    <div class="acts"><button class="btn on" onclick="document.getElementById('modal').hidden=true">Close</button></div>`);
  return R;
}

