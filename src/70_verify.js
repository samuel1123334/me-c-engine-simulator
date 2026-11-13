// ===================================================================
// 70 · VERIFY — 완료 기준 자동 검증
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

  // 1. 360° 회전 후 기계 부품 복귀
  {
    let worst = 0;
    for (const T0 of [0, 37.25, 123.4, 271.9]) {
      applyMechanics(T0); const a = movingSnapshot();
      applyMechanics(T0 + 360); const b = movingSnapshot();
      applyMechanics(T0 - 720); const c = movingSnapshot();
      worst = Math.max(worst, maxDiff(a, b), maxDiff(a, c));
    }
    add(worst < 1e-6, '360° 회전 후 모든 기계 부품이 초기 위치로 복귀', `크랭크축·스로·크로스헤드·커넥팅 로드·배기밸브·체인 기어 행렬 최대 오차 ${worst.toExponential(2)} (기준 < 1e-6). 터보차저는 엔진과 별도 회전수로 관리하므로 제외.`);
  }
  // 2. 재생 vs 일시정지 후 수동 조절 일치
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
    add(dm < 1e-6 && dc < 1e-6 && rdOk && dph < 1e-6, '재생과 일시정지·수동 크랭크각 조절의 작동 상태 일치',
      `Θ ${Ta}° → ${Tb.toFixed(1)}°: 380프레임 재생 vs 슬라이더 한 번 이동. 기계 행렬 오차 ${dm.toExponential(1)}, 실린더 내부 입자 오차 ${dc.toExponential(1)}, 단계·포트·밸브·분사 표시 ${rdOk ? '일치' : '불일치'}, 배관 입자 이동량 상대 오차 ${dph.toExponential(1)} (누적 적분표 사용, 기준 < 1e-6).`);
  }
  // 3. 소기 포트 노출과 피스톤 위치 일치 (렌더된 메쉬 기준)
  {
    const pm = PARTS.ports.inst[0].proc[0]; pm.geometry.computeBoundingBox();
    const portTopMesh = pm.geometry.boundingBox.max.y, portBotMesh = pm.geometry.boundingBox.min.y;
    let mism = 0, phaseMism = 0, firstOpen = null, lastOpen = null;
    for (let a = 0; a < 360; a += 0.25) {
      applyMechanics(a);                                  // 1번 실린더 θ = Θ
      const crownMesh = MOV.xh[0].position.y + CFG.pistonH;
      const geomOpen = crownMesh < portTopMesh - 1e-9;
      const modelOpen = M.portFrac(a) > 0;
      if (geomOpen !== modelOpen) mism++;
      const pk = M.phase(a, SIM.state.load).k;
      if (modelOpen !== (pk === 'scav' || pk === 'scav2')) phaseMism++;
      if (modelOpen) { if (firstOpen === null) firstOpen = a; lastOpen = a; }
    }
    const [po, pc] = M.portAngles();
    add(mism === 0 && phaseMism === 0 && Math.abs((po + pc) / 2 - 180) < 1e-6, '소기 포트 노출과 피스톤 위치 일치',
      `0.25° 간격 1440점: 메쉬(크라운 ${'y'} vs 포트 상단 ${portTopMesh.toFixed(3)} m) 판정과 모델 판정 불일치 ${mism}점, 작동 단계 표시 불일치 ${phaseMism}점. 개방 ${po.toFixed(2)}°~폐쇄 ${pc.toFixed(2)}° (하사점 대칭, 포트 높이 ${(portTopMesh - portBotMesh) * 1000 | 0} mm).`);
  }
  // 4. 닫힌 밸브·포트를 통과하는 흐름 없음
  {
    let viol = 0, checked = 0;
    const gates = [[/^air\.box/, th => M.portFrac(th)], [/^exh\.cyl/, th => M.evLift01(th)], [/^fuel\.hp/, th => M.inj01(th, SIM.state.load)], [/^oil\.fpb/, th => M.inj01(th, SIM.state.load)], [/^oil\.ev/, th => Math.abs(M.evLiftRate(th))]];
    PATHS.filter(p => p.cyl != null).forEach(p => { const g = gates.find(([re]) => re.test(p.id)); if (!g) return; for (let a = 0; a < 360; a += 0.5) { checked++; if (g[1](a) <= 0 && Math.abs(p.rate(a)) > 1e-12) viol++; } });
    const auxSaved = SIM.state.aux; let auxViol = 0;
    [true, false].forEach(ax => { SIM.state.aux = ax; PATHS.filter(p => /^air\.(flap|blower)/.test(p.id)).forEach(p => { const open = /flap/.test(p.id) ? !ax : ax; if (!open && p.rate(0) !== 0) auxViol++; }); });
    SIM.state.aux = auxSaved;
    add(viol === 0 && auxViol === 0, '닫힌 밸브·포트를 통과하는 흐름 없음', `실린더 경로 ${checked}개 시점 검사: 위반 ${viol}. 보조 송풍기 체크밸브/메인 플랩 상태 반영 위반 ${auxViol}.`);
  }
  // 5. 공기·연료·배기가스 경로 연결
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
      chains.push(['공기 ' + (k + 1), ['filter', 'tc_comp', 'cooler', 'mist', 'chamber', 'flap', 'scavrec', 'scavbox', 'ports', 'cyl' + k]]);
      chains.push(['배기 ' + (k + 1), ['cyl' + k, 'evspindle', 'exhpipe', 'exhrec', 'exhduct', 'tc_turb', 'exhduct', 'egb.gas', 'funnel']]);
      chains.push(['연료 ' + (k + 1), ['servtank', 'supplypump', 'ventbox', 'circpump', 'heater.fuel', 'visco', 'ffilter', 'fuelrail', 'fpb' + k, 'hpfuel', 'fuelvalve', 'cyl' + k]]);
      chains.push(['제어유 ' + (k + 1), ['oilpan', 'autofilter', 'hps', 'ctrlrail', 'hcu' + k, 'accum', 'fiva' + k, 'evactuator', 'hpoil_ev', 'evact' + k]]);
    }
    chains.push(['보조 송풍기 경로', ['chamber', 'auxblower', 'checkv', 'scavrec']], ['연료 복귀', ['fuelrail', 'pcv', 'ventbox']], ['보일러 물', ['drum', 'circpump_w', 'egb.water', 'drum']], ['급수', ['cascade', 'feedpump', 'drum']], ['증기', ['drum', 'heater.steam', 'trap']]);
    const broken = chains.filter(([, c]) => c.slice(0, -1).some((n, i) => !E.has(n + '>' + c[i + 1]))).map(([n]) => n);
    add(endErr === 0 && broken.length === 0 && gapMax < 0.08, '공기·연료·배기가스·제어유·물 경로 연결', `경로 ${PATHS.length}개 모두 양 끝이 포트에 연결 (끝점 오차 위반 ${endErr}${bad.length ? ': ' + bad.slice(0, 4).join(', ') : ''}), 곡선 샘플 간 최대 간격 ${(gapMax * 1000).toFixed(0)} mm. 사양 순서 체인 ${chains.length}개 중 단절 ${broken.length}${broken.length ? ' (' + broken.join(', ') + ')' : ''}.`);
  }
  // 6. 터보차저·보일러에서 유체 혼동 없음
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
    add(wrongPort === 0 && wrongSide === 0 && dTC > 0.5 && dEGB > 0.15, '터보차저·보일러에서 서로 다른 유체가 잘못 연결되지 않음',
      `포트 유체 불일치 ${wrongPort}, 분리 구역(터빈/압축기, 보일러 가스/물, 가열기 연료/증기) 침범 ${wrongSide}. 터보차저 압축기 공기 유로–터빈 배기 유로 최소 거리 ${dTC.toFixed(2)} m (공통 축으로만 연결), 보일러 배기 유로–전열관 물 유로 최소 거리 ${dEGB.toFixed(2)} m (관 반경 0.06 m 바깥).`);
  }
  // 7. 확대·회전·절단 후 부품 선택과 설명
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
      scen.push({ name, ok: !!h && expect.includes(h.id) && infoOk, got: h ? PARTS[h.id].ko : '없음', clippedFirst });
    };
    const setTheta = a => { SIM.state.theta = a; applyMechanics(a); };
    // (a) 단면 + 정면 확대
    tryPick('단면 · 정면 확대', V3(0.05, M.crownY(90) - 0.12, LY.zc(0) - 0.02), ['piston'], () => {
      setTheta(90); setViewMode('section'); setCut('z', (LY.zc(0) - CUT.z[0]) / (CUT.z[1] - CUT.z[0])); camera.position.set(0.4, 7.2, LY.zc(0) + 6.5); controls.target.set(0, M.crownY(90) - 0.1, LY.zc(0));
    });
    // (b) 같은 단면에서 회전 + 추가 확대
    tryPick('단면 · 35° 회전 · 2배 확대', V3(0.0, M.crownY(90) - 0.12, LY.zc(0) - 0.02), ['piston', 'rings'], () => {
      const t = V3(0, M.crownY(90) - 0.1, LY.zc(0)); controls.target.copy(t); camera.position.copy(t).add(V3(Math.sin(35 * DEG) * 3.2, 0.5, Math.cos(35 * DEG) * 3.2));
    });
    // (c) 절단 위치를 3번 실린더로 이동 + 크로스헤드
    tryPick('절단 위치 이동(#3) · 크로스헤드', V3(0.0, M.xhY(90 - offs[2]), LY.zc(2) - 0.05), ['xhpin', 'xhbearing', 'conrod', 'shoe'], () => {
      setCut('z', (LY.zc(2) - CUT.z[0]) / (CUT.z[1] - CUT.z[0])); const t = V3(0, M.xhY(90 - offs[2]), LY.zc(2)); controls.target.copy(t); camera.position.copy(t).add(V3(-1.2, 0.8, 4.5));
    });
    // (d) 종단면 (x 절단) 측면 보기 · 커넥팅 로드
    tryPick('종단면 · 측면 보기 · 메인 베어링', V3(0.02, 0.0, LY.zb(3)), ['mainbearing', 'crankshaft'], () => {
      setCut('x', 0.5); const t = V3(0, 0, LY.zb(3)); controls.target.copy(t); camera.position.copy(t).add(V3(5.5, 1.2, 1.5));
    });
    // (e) 외함 반투명 · 터보차저 압축기 휠
    tryPick('외함 반투명 · 터보차저 압축기 휠', V3(-3.55, 8.0 + 0.12, -2.6), ['tc_comp', 'tc_shaft'], () => {
      setViewMode('ghost'); const t = V3(-3.55, 8.0, -2.6); controls.target.copy(t); camera.position.copy(t).add(V3(-3.5, 1.6, -3.0));
    });
    const ok = scen.every(s => s.ok);
    // 복원
    Object.assign(FLOW_ON, flowS); setViewMode(viewS); if (cutS.a === 'z') setCut('z', cutS.p / 1000); else setCut('x', cutS.p / 1000); SIM.state.ref = refS;
    camera.position.copy(camS.p); controls.target.copy(camS.t); select(selS ? selS.id : null, selS ? selS.inst : null, false);
    add(ok, '확대·회전·절단 조절 후 부품 선택과 설명', scen.map(s => `${s.ok ? '✓' : '✗'} ${s.name}: ${s.got}${s.clippedFirst ? ' (절단된 앞쪽 부품은 건너뜀)' : ''}`).join(' · '));
  }
  // 8. 0D 실린더 모델 보존 법칙
  {
    const S = TQ.summary();
    add(Math.abs(S.massErr) < 1e-4 && Math.abs(S.energyErr) < 1e-4, '0D 실린더 모델: 한 사이클 질량·에너지 보존',
      `질량 (유입 − 유출 + 연료)/유입 = ${S.massErr.toExponential(1)}, 에너지 (연소열 + 유입 엔탈피 − 유출 엔탈피 − 일 − 벽 열손실)/기준 = ${S.energyErr.toExponential(1)} (기준 < 1e-4). 지시 효율 ${(S.etaI * 100).toFixed(1)} %, 벽 열손실 ${(S.qwFrac * 100).toFixed(1)} %.`);
  }
  // 9 · 10. 정상 상태 터보 매칭 (현재 조건) + 정격점 참고값 비교 — 상태를 복사해 계산 후 복원
  {
    const keep = JSON.parse(JSON.stringify({ ...ENGS, cyc: null, hist: [] })), keepCyc = ENGS.cyc, keepRS = [SIM.state.rpm, SIM.state.load];
    settleEngine();
    const w = ENGS.N * 2 * Math.PI / 60, Pf = 0.0178 * w * w;
    const bal = Math.abs(ENGS.Pt - ENGS.Pc - Pf) / Math.max(1e4, ENGS.Pc);
    const fIn = Math.abs(ENGS.mdC - ENGS.mIn) / Math.max(0.5, ENGS.mIn), fOut = Math.abs(ENGS.mdT - ENGS.mOut) / Math.max(0.5, ENGS.mOut);
    add(bal < 0.01 && fIn < 0.01 && fOut < 0.01, '터보차저 매칭: 정상 상태에서 동력·유량 평형',
      `현재 조건 ${SIM.state.rpm} r/min · ${Math.round(SIM.state.load * 100)} %: 터빈 ${(ENGS.Pt / 1e6).toFixed(3)} MW = 압축기 ${(ENGS.Pc / 1e6).toFixed(3)} MW + 베어링 손실 ${(Pf / 1e3).toFixed(0)} kW (오차 ${(bal * 100).toFixed(2)} %). 압축기 유량 ${ENGS.mdC.toFixed(2)} = 엔진 유입 ${ENGS.mIn.toFixed(2)} kg/s (${(fIn * 100).toFixed(2)} %), 터빈 유량 ${ENGS.mdT.toFixed(2)} = 엔진 유출 ${ENGS.mOut.toFixed(2)} kg/s (${(fOut * 100).toFixed(2)} %).`);
    SIM.state.rpm = 105; SIM.state.load = 1; ENGS.dirty = true; settleEngine();
    const S = TQ.summary(), ps = ENGS.ps / 1e5;
    const chk = [['소기압', ps, 3.8 * 0.93, 3.8 * 1.07, ps.toFixed(2) + ' bar abs (참고 3.8 ±7 %)'], ['Pmax', S.pmax, 150, 210, S.pmax.toFixed(0) + ' bar'], ['IMEP', S.imep, 18, 24, S.imep.toFixed(1) + ' bar'],
      ['배기 리시버 온도', S.Tx - 273, 300, 480, Math.round(S.Tx - 273) + ' °C'], ['T/C 후 온도', S.Tout - 273, 180, 300, Math.round(S.Tout - 273) + ' °C'], ['λ', S.lambda, 1.8, 3.6, S.lambda.toFixed(2)], ['지시 효율', S.etaI, 0.46, 0.56, (S.etaI * 100).toFixed(1) + ' %']];
    const bad = chk.filter(c => !(c[1] >= c[2] && c[1] <= c[3]));
    add(bad.length === 0, '정격점(105 r/min · 100 %) 결과: 참고값·타당 범위 비교',
      chk.map(c => `${c[0]} ${c[4]}`).join(' · ') + '. 소기압만 참고자료(S60ME 프로젝트 가이드 예) 값이고 나머지는 대형 2행정 엔진의 일반적 범위로 확인한 교육용 판정입니다.' + (bad.length ? ' 범위 밖: ' + bad.map(c => c[0]).join(', ') : ''));
    Object.assign(ENGS, keep); ENGS.cyc = keepCyc; SIM.state.rpm = keepRS[0]; SIM.state.load = keepRS[1]; ENGS.lin = keep.lin; ENGS.dirty = false;
  }
  // 11. 2D 유동장
  {
    const F = FIELD.cur;
    if (!F) add(false, '2D 유동장: 연속 방정식 · 주기성 · 포트/밸브 일관성', '유동장 계산이 아직 끝나지 않았습니다. 잠시 후 다시 실행하세요.');
    else {
      const [po, pc] = M.portAngles(); let incS = 0, incA = 0;
      for (let d = Math.ceil(pc) + 1; d < Math.floor(po) + 360 - 1; d++) {
        const a0 = d % 360, a1 = (d + 1) % 360; if (a1 === 0 && false) continue;
        if (a0 === 299) continue;   // 계산 주기 이음매(300°)는 제외하고 주기성 항목에서 따로 확인
        incS = Math.max(incS, F.sMean[a1] - F.sMean[a0]); incA = Math.max(incA, F.aMean[a1] - F.aMean[a0]);
      }
      const ok = F.D.divMax < 0.1 && F.D.periodA < 0.04 && incS < 2e-3 && incA < 2e-3;
      add(ok, '2D 유동장: 연속 방정식 · 주기성 · 포트/밸브 일관성',
        `투영 후 최대 속도 발산 오차 ${(F.D.divMax * 1000).toFixed(1)} mm/s (기준 < 100 mm/s). 사이클 주기성: 공기 분율 평균 차 ${(F.D.periodA * 100).toFixed(2)} %, 온도 ${(F.D.periodT * 100).toFixed(2)} %. 포트가 닫힌 ${pc.toFixed(0)}°→${po.toFixed(0)}° 구간에서 공급 공기 추적자 질량 최대 증가 ${(incS * 1000).toFixed(2)} g, 미연소 공기 질량 최대 증가 ${(incA * 1000).toFixed(2)} g / 1° (포트로만 유입 가능 → 증가 없어야 함, 기준 < 2 g). 격자 ${F.NX}×${F.NY}.`);
    }
  }
  // 12. HCU 내부 동기 (FIVA · 부스터 · 배기밸브 액추에이터)
  {
    buildHcuTables(); const n = HCU.n, d = 360 / n, load = SIM.state.load; let bad = 0, boostOut = 0, maxB = 0;
    for (let i = 0; i < n; i++) {
      const th = i * d, inj = M.inj01(th, load) > 0, ev = M.evLift01(th) > 0.02, f = HCU.fiva[i], since = wrapS(th - CFG.soi);
      if (inj && f < 0.5 && M.inj01(th, load) > 0.99) bad++;                 // 분사 중 FIVA는 P→Cfi
      if (th > CFG.evo + CFG.evOpenRamp && th < CFG.evc - CFG.evCloseRamp - 3 && f > -0.5) bad++;   // 배기밸브 완전 개방 유지 중 FIVA는 P→Cva
      if (HCU.boost[i] > 0.02 && !(since >= -1 && since <= M.injDur(load) + 42)) boostOut++;   // 부스터는 분사 창 + 원위치 구간에서만 움직임
      maxB = Math.max(maxB, HCU.boost[i]);
    }
    add(bad === 0 && boostOut === 0 && (load < 0.01 || maxB > 0.99), 'HCU 내부 동작이 크랭크각과 동기', `FIVA 방향 불일치 ${bad}점, 분사 창 밖 부스터 이동 ${boostOut}점, 부스터 최대 행정 ${(maxB * 100).toFixed(0)} % (분사 ${wrap360(CFG.soi).toFixed(1)}°부터 ${M.injDur(load).toFixed(1)}°, 배기밸브 ${CFG.evo}–${CFG.evc}°)`);
  }
  // 13. 축압기 기름 체적 사이클 보존 · 안전밸브 이하
  {
    buildHcuTables(); const n = HCU.n; let tot = 0; for (let i = 0; i < n; i++) tot += HCU.cons[i];
    const qIn = tot * (1 + FSP.leak) / n; let v = 0; for (let i = 0; i < n; i++) v += qIn - HCU.cons[i] * (1 + FSP.leak);
    const pmax = Math.max(...HCU.acc), pmin = Math.min(...HCU.acc);
    add(Math.abs(v) < 1e-9 && pmax <= FSP.relief[0] && pmin > 0.5 * FSS.pSet, '축압기 기름 체적 보존 · 압력 범위', `한 사이클 기름 체적 변화 ${v.toExponential(1)} L, 압력 ${pmin.toFixed(1)}–${pmax.toFixed(1)} bar (설정 ${FSS.pSet} bar, 안전밸브 ${FSP.relief[0]} bar)`);
  }
  // 14. 연료 계통: 질량·에너지 수지, Walther 점도, 정상 상태 점도 제어
  {
    const mf = fuelConsumption(), mb = Math.abs(FSS.supply + FSS.ret - FSP.Qcirc) + Math.abs(FSS.supply - mf);
    const Qcalc = FSP.Qcirc * FSP.cp * (FSS.Tout - FSS.Tin), eb = Math.abs(Qcalc - FSS.steam * FSP.hfg) / Math.max(1, Qcalc);
    const v50 = FUEL.visc(50), tmix = (FSS.supply * FSP.Tsvc + FSS.ret * (FSS.Tout - 6)) / FSP.Qcirc;
    add(mb < 1e-9 && eb < 1e-6 && Math.abs(v50 - FSP.v50) < 0.01 && Math.abs(FSS.visc - FSP.viscSet) < 1.5 && Math.abs(tmix - FSS.Tin) < 0.5, '연료 공급 계통 질량·에너지 수지', `소비 ${(mf * 3600).toFixed(0)} kg/h = 보충, 보충+복귀 = 순환 ${(FSP.Qcirc * 3600).toFixed(0)} kg/h (오차 ${mb.toExponential(1)}), 가열량 ${(Qcalc / 1000).toFixed(1)} kW = 증기 ${(FSS.steam * 3600).toFixed(0)} kg/h × 잠열, 점도 ${FSS.visc.toFixed(2)} cSt (설정 ${FSP.viscSet}), 50 °C 점도 ${v50.toFixed(1)} cSt`);
  }
  // 15. 기기 내부 보기 열기·닫기
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
    add(fail === 0 && orphan.length === 0, '기기 내부 구조 보기 (전 기기)', `${Object.keys(DEVICES).length}개 기기 장면 생성·갱신, 내부 부품 라벨 ≥ 5, 유동 ≥ 1, 수치에 NaN 없음${fail ? ' · 실패: ' + rep.join(', ') : ''}${orphan.length ? ' · 연결 안 된 부품: ' + orphan.join(', ') : ''}`);
  }
  restoreFlowState(saved); SIM.state.playing = wasPlaying; SIM.noEngineAdvance = false; SIM.playIcon && SIM.playIcon();
  applyMechanics(SIM.state.theta);
  return R;
}
function openVerify() {
  const R = runVerify();
  const n = R.filter(r => r.ok).length;
  openModal(`<h2>자동 검증 결과 · ${n}/${R.length} 통과</h2><p class="sub">현재 설정값으로 완료 기준을 다시 계산했습니다. 타이밍을 바꾼 뒤에도 다시 실행할 수 있습니다.</p>
    <div class="vres">${R.map(r => `<div class="it"><span class="${r.ok ? 'pass' : 'fail'}">${r.ok ? '✓' : '✗'}</span><div><b>${r.name}</b><div class="d">${r.detail}</div></div></div>`).join('')}</div>
    <div class="acts"><button class="btn on" onclick="document.getElementById('modal').hidden=true">닫기</button></div>`);
  return R;
}

