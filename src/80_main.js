// ===================================================================
// 80 · MAIN
// ===================================================================
const NOTES_HTML = `
<h3 style="margin:14px 0 6px;font-size:13px">Confirmed from references</h3>
<ul style="margin:0;padding-left:18px;display:grid;gap:4px;font-size:12.5px;max-width:70ch">
<li>Typical timing for two-stroke uniflow scavenging: exhaust valve opens about 110° ATDC, scavenge ports open about 140° ATDC and close symmetrically about BDC. Because the ports are fixed in the liner, their opening and closing are symmetric about BDC. (marinediesels.info)</li>
<li>ME/ME-C engines use electronic-hydraulic control (HCU) instead of a camshaft and chain-driven cams, control fuel injection and exhaust valves electronically, and also use electronically controlled cylinder lubricators (Alpha).</li>
<li>The HPS consists of engine-driven pumps (3–5) driven from the crankshaft and electric start-up pumps, and nitrogen bladder accumulators absorb the flow swings of injection and exhaust valve operation.</li>
<li>Auxiliary blowers make up scavenge pressure at start, low speed and low load, and non-return flaps prevent backflow. Start/stop pressures differ between sources (e.g. 0.35/0.45 bar).</li>
<li>S60ME series project guide example: cylinder pitch 1020 mm, rated 105 r/min, scavenge pressure about 3.8 bar abs at 100 % load.</li>
<li><b>Device internals</b>: Fuel supply 4 bar · circulation 10 bar · engine inlet 7–8 bar, engine inlet viscosity about 13 cSt (10–15 cSt), HPS 200/300 bar (by load) and safety valves 310/315 bar, fuel valve opening pressure 350–380 bar, exhaust valve air spring about 7 bar, a single FIVA controls both injection and the exhaust valve, the booster multiplies pressure by the area ratio of control oil piston to fuel plunger, the HPS automatic filter is a back-flushing candle type + redundant filter, and the slide-type fuel valve has almost no sac volume.</li>
</ul>
<h3 style="margin:14px 0 6px;font-size:13px">Simplified or assumed for teaching</h3>
<ul style="margin:0;padding-left:18px;display:grid;gap:4px;font-size:12.5px;max-width:70ch">
<li>Dimensions: bore 600 mm · stroke 2400 mm · connecting rod 2600 mm · crosshead to crown 4600 mm · geometric compression ratio 18. Depth dimensions and external pipe routes are not on the drawing and are placed arbitrarily.</li>
<li>Exhaust valve closing 255°, start of injection −2°, injection duration 8–18°, ignition delay 2.5°, maximum lift 110 mm. The real ME-C controls these electronically by load; here they are fixed assumptions.</li>
<li>Firing order 1-5-3-4-2-6, clockwise rotation seen from the front, 2 fuel valves per cover, HPS chain reduction 2:1.</li>
<li><b>0D thermodynamic model</b>: One cylinder integrated at 0.5° steps (mass and energy conservation, nozzle flow through effective port and exhaust valve areas, Wiebe combustion, Woschni heat loss scaled ×0.55, perfectly mixed scavenging). Discharge coefficients, valve diameter, fuel quantity and the heat-loss factor are educational assumptions, tuned so the rated-point scavenge pressure matches the reference (≈3.8 bar abs).</li>
<li><b>Turbocharger matching</b>: The compressor map is an approximate speed-line formula, the turbine uses the ellipse law, rotor inertia 2.4 kg·m², receiver volumes estimated from the geometry. Turbo lag (a few seconds) appears when the load changes, but as this is not a real turbocharger map the time constants are qualitative.</li>
<li><b>2D section flow field</b>: 2D incompressible + uniform compression approximation on the cylinder centre section only (grid 24 × about 100). Swirl is handled only as a transported scalar, and the combustion location is assumed to follow the spray plume shape. Not a 3D CFD result; scavenging efficiency and short-circuit loss show trends only.</li>
<li>All pressures, temperatures and flows are values computed by the models above, not measurements. On screen they are tagged '0D calc', '2D approx.' .</li>
<li>The drawing’s "Cam shaft" label does not apply to the ME-C, so the control oil HP pipe (double-walled) is placed in the same position. "FIVA v/v"is shown as on the ME-C.</li>
<li>All part shapes (including piston rings, ports, valve seats, nozzles and bearing shells) are simplified. Particles and arrows are a conceptual picture of flow.</li>
<li>The boiler is assumed to be a forced-circulation exhaust gas economiser + steam drum. Condensate return piping is omitted.</li>
<li><b>Device internal views</b> (15 devices): the internal shapes are simplified educational shapes based on published operating principle drawings, not manufacturer drawings. Fuel grade (380 cSt @ 50 °C), circulation, heater NTU / time constant / PI gains, filter mesh size and clogging rate, HPS pump displacement / step-up ratio / swash angle, booster area ratio 3.3, 0.30 L control oil per exhaust valve opening, HCU accumulator 6 L and pre-charge ratio 0.65 are assumptions. Viscosity uses the Walther equation, the accumulator uses adiabatic nitrogen compression, and HCU internal motion is computed from the simulator’s injection and exhaust valve timing tables.</li>
<li>Rotating machines (screw pumps, HPS pump, blower) would flicker if drawn at their real speed, so they are slowed down on screen. The system time multiplier (1× / 10× / 60×) speeds up only the slow fuel-system responses (heater, filter clogging).</li>
</ul>
<h3 style="margin:14px 0 6px;font-size:13px">Further information needed</h3>
<ul style="margin:0;padding-left:18px;display:grid;gap:4px;font-size:12.5px;max-width:70ch">
<li>The exact engine model (e.g. 6S60ME-C10.5) and its Project Guide: stroke, connecting rod length, compression ratio, port height, firing order, direction of rotation.</li>
<li>Exhaust valve and injection timing by load from the engine control system (shop test or ECS settings), measured pressure diagrams (PMI) and shop test records — to calibrate the 0D model.</li>
<li>Turbocharger compressor and turbine maps, air cooler performance data — to replace the matching approximations.</li>
<li>Auxiliary blower start/stop pressures, turbocharger type and number, exhaust gas boiler type and the ship’s system diagrams.</li>
<li>The actual layout of the fuel supply system (venting/mixing tank, heater, viscosity controller, filter positions) and how the HPS is driven (chain/gear, electric).</li>
<li>The real ship’s fuel and control oil system diagrams and equipment specifications (pump type and capacity, heater surface area, filter type and mesh size, HCU accumulator volume) — to replace the assumptions in the device internal views.</li>
<li>Detailed part GLB/glTF models (origin, axes and units: same coordinates as the motion slots, Y up, m).</li>
</ul>
<p style="font-size:11.5px;color:var(--muted);margin-top:10px">Sources: <a href="https://marinediesels.info/2_stroke_engine_parts/Other_info/exhaust_valve_cam.htm" target="_blank" rel="noopener" style="color:var(--accent)">marinediesels.info · Exhaust valve timing</a> · <a href="https://wordpress-sxaew.wasmer.app/?p=589" target="_blank" rel="noopener" style="color:var(--accent)">Differences between MC/MC-C and ME/ME-C</a> · <a href="https://www.merchantnavydecoded.com/?p=90586" target="_blank" rel="noopener" style="color:var(--accent)">ME engine Hydraulic Power Supply</a> · <a href="https://maritimepage.com/what-is-scavenging-in-marine-engines/" target="_blank" rel="noopener" style="color:var(--accent)">Scavenging in marine engines</a> · <a href="https://upcommons.upc.edu/bitstreams/1228fb6b-7583-4138-89cb-9d70da2bc84b/download" target="_blank" rel="noopener" style="color:var(--accent)">5S60ME-B8 project data</a> · Each device internal view lists its own sources in its 'Sources' section.</p>`;

function resize() {
  const w = Math.max(10, viewEl.clientWidth), h = Math.max(10, viewEl.clientHeight);
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  DV.cam.aspect = w / h; DV.cam.updateProjectionMatrix();
}
let lastT = performance.now(), roTick = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  const S = SIM.state;
  if (S.playing) {
    const d = S.speed * S.rpm * 6 * dt;
    advanceFlows(S.theta, S.theta + d); advanceEngine(d); S.theta += d;
    if (S.theta > 36000) S.theta -= 36000;
    SIM.tcAngle += dt * (ENGS.N / 60) * 2 * Math.PI * S.speed * 0.02;  // slowed for display (2 % of the real speed × playback speed)
  }
  if (S.playing) stepFuelSystem(dt * DVS.tscale);
  applyMechanics(S.theta); applyAuxParts(dt);
  MOV.tcRotor.rotation.z = SIM.tcAngle;
  if (CAM.anim) {
    const a = CAM.anim; a.t = Math.min(1, a.t + dt / a.dur); const e = easeCos(a.t);
    camera.position.lerpVectors(a.p0, a.p1, e); controls.target.lerpVectors(a.t0, a.t1, e);
    if (a.t >= 1) CAM.anim = null;
  }
  if (!DV.open) controls.update();
  updateAux();
  FIELD.fade = Math.min(1, FIELD.fade + dt / 0.8);
  if ((roTick & 15) === 0 && ENGS.version !== FIELD.shownVersion) { FIELD.shownVersion = ENGS.version; fieldRequest(); }
  if ((roTick++ & 3) === 0) updateReadouts(S.theta);
  if (DV.open) {
    const st = { dt, dtVis: S.playing ? dt * clamp(S.speed * 4, 0.25, 1) : 0, load: S.load, rpm: S.rpm, playing: S.playing };
    detailTick(dt, st);
    renderer.render(DV.scene, DV.cam);
    detailLabels();
  } else {
    updateFlows(S.theta);
    renderer.render(scene, camera);
    updateLabels();
  }
  requestAnimationFrame(frame);
}
function main() {
  initModel();
  buildEngine();
  buildSystems();
  buildFlows();
  buildUI();
  detailInit();
  settleEngine();          // steady state at the initial operating point (0D + turbo matching)
  stepFuelSystem(900);     // fuel and control oil system steady state
  fieldInit(); fieldRequest();
  updateAux();
  applyMechanics(0);
  setViewMode('section'); cutToCyl(0); setPipesGhost(true);
  homeView(false);
  document.querySelector('#presets [data-p]') && null;
  buildDial();
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { SIM.state.playing = false; SIM.playIcon(); }
  new ResizeObserver(resize).observe(viewEl); resize();
  $('loading').remove();
  requestAnimationFrame(t => { lastT = t; frame(t); });
  window.SIM_API = { SIM, M, CFG, PATHS, PORTS, PARTS, runVerify, applyPreset, setRefAngle, camera, controls, select, pick, setViewMode, setCut, cutToCyl, FLOW_ON, renderer, scene, openVerify, __updateFlows: updateFlows, __advance: advanceFlows, __labels: updateLabels, __readouts: updateReadouts, __mech: applyMechanics, ENGS, TQ, FIELD, settleEngine, evalCycle, advanceEngine, operatingChanged, DV, DEVICES, DEV_OF, detailOpen, detailClose, detailSetCut, detailSelect, FSS, FSP, HCU, hcuAt, stepFuelSystem, DVS, HYD, finishAnim: () => { if (CAM.anim) { camera.position.copy(CAM.anim.p1); controls.target.copy(CAM.anim.t1); CAM.anim = null; controls.update(); } } };
}
requestAnimationFrame(() => setTimeout(() => { try { main(); } catch (e) { console.error(e); const l = $('loading'); if (l) l.textContent = 'Could not build the 3D scene: ' + e.message; } }, 30));

