// ===================================================================
// 80 · MAIN
// ===================================================================
const NOTES_HTML = `
<h3 style="margin:14px 0 6px;font-size:13px">참고자료로 확인한 사항</h3>
<ul style="margin:0;padding-left:18px;display:grid;gap:4px;font-size:12.5px;max-width:70ch">
<li>2행정 유니플로 소기의 일반적 타이밍: 배기밸브 개방 약 110° ATDC, 소기 포트 약 140° ATDC 개방·하사점 대칭 폐쇄. 포트 위치가 라이너에 고정되어 개폐가 하사점 대칭이 된다는 점. (marinediesels.info)</li>
<li>ME/ME-C는 캠축과 체인 구동 캠 대신 전자·유압 제어(HCU)를 쓰고, 연료 분사와 배기밸브를 전자 제어하며, 실린더 주유기도 전자 제어(Alpha)라는 점.</li>
<li>HPS는 크랭크축으로 구동되는 엔진 구동 펌프(3~5대)와 전동 시동 펌프로 구성되고, 질소 블래더 축압기가 분사·배기밸브 작동 시 유량 변동을 흡수한다는 점.</li>
<li>보조 송풍기는 시동·저속·저부하에서 소기압을 보충하고, 논리턴 플랩이 역류를 막는다는 점. 기동/정지 압력은 자료마다 다름 (예: 0.35/0.45 bar).</li>
<li>S60ME 계열 프로젝트 가이드 예시: 실린더 간격 1020 mm, 정격 105 r/min, 100 % 부하 소기압 약 3.8 bar abs.</li>
<li><b>기기 내부 구조</b>: 연료 공급 4 bar·순환 10 bar·엔진 입구 7–8 bar, 엔진 입구 점도 약 13 cSt(10–15 cSt), HPS 200/300 bar(부하 연동)와 안전밸브 310/315 bar, 분사밸브 개변압 350–380 bar, 배기밸브 공기 스프링 약 7 bar, FIVA 하나가 분사와 배기밸브를 함께 제어, 부스터는 제어유 피스톤과 연료 플런저의 면적비로 압력 증폭, HPS 자동 필터는 캔들 역세식 + 보조 필터, 슬라이드형 분사밸브는 sac volume이 거의 없음.</li>
</ul>
<h3 style="margin:14px 0 6px;font-size:13px">교육용으로 단순화하거나 가정한 사항</h3>
<ul style="margin:0;padding-left:18px;display:grid;gap:4px;font-size:12.5px;max-width:70ch">
<li>치수: 보어 600 mm·행정 2400 mm·커넥팅 로드 2600 mm·크로스헤드–크라운 4600 mm·기하 압축비 18. 깊이 방향 치수와 외부 배관 경로는 그림에 없어 임의 배치.</li>
<li>배기밸브 폐쇄 255°, 분사 시작 −2°, 분사 기간 8~18°, 착화 지연 2.5°, 최대 양정 110 mm. ME-C는 실제로 부하별로 전자 제어되며 이 값은 고정 가정.</li>
<li>점화 순서 1-5-3-4-2-6, 정면 기준 시계방향 회전, 커버당 분사밸브 2개, HPS 체인 감속비 2:1.</li>
<li><b>0D 열역학 모델</b>: 실린더 하나를 0.5° 간격으로 적분 (질량·에너지 보존, 포트·배기밸브 유효면적 노즐 유량, Wiebe 연소, Woschni 열손실 ×0.55 보정, 소기는 완전 혼합 가정). 유량계수·밸브 지름·연료량·열손실 보정계수는 교육용 가정이며, 정격점 소기압이 참고값(≈3.8 bar abs)에 맞도록 조정했습니다.</li>
<li><b>터보차저 매칭</b>: 압축기 맵은 속도선 형태의 근사식, 터빈은 타원 유량식, 회전체 관성 2.4 kg·m², 리시버 체적은 형상에서 추산. 부하 변화 시 터보 랙(수 초)이 나타나지만 실제 터보차저 맵이 아니므로 시간 상수는 정성적입니다.</li>
<li><b>2D 단면 유동장</b>: 실린더 중심 단면만 계산하는 2D 비압축성+균일 압축 근사(격자 24×약 100). 선회류는 수송 스칼라로만 다루고, 연소 위치는 분무 플룸 형상으로 가정했습니다. 3D CFD 결과가 아니며 소기 효율·단락 손실은 경향을 보여 주는 값입니다.</li>
<li>모든 압력·온도·유량은 위 모델의 계산값이며 실측값이 아닙니다. 화면 표시에 '0D 계산', '2D 근사' 표시를 붙였습니다.</li>
<li>그림의 "Cam shaft" 표기는 ME-C에 해당하지 않아 같은 위치에 제어유 고압관(이중관)을 배치. "FIVA v/v"는 ME-C 기준으로 반영.</li>
<li>모든 부품 형상(피스톤 링, 포트, 밸브 시트, 노즐, 베어링 셸 포함)은 단순화 형상. 입자와 화살표는 개념적 흐름 표현.</li>
<li>보일러는 강제 순환식 배기가스 이코노마이저 + 기수 드럼으로 가정. 응축수 복귀 배관은 생략.</li>
<li><b>기기 내부 구조 보기</b>(15종): 내부 형상은 공개된 작동 원리 그림을 바탕으로 한 교육용 단순 형상이며 제조사 도면이 아닙니다. 연료 등급(380 cSt@50 °C), 순환량, 가열기 NTU·시정수·PI 이득, 필터 눈 크기·막힘 속도, HPS 펌프 배제 체적·증속비·사판각, 부스터 면적비 3.3, 배기밸브 1회 제어유 0.30 L, HCU 축압기 6 L·봉입압 비 0.65는 가정값입니다. 점도는 Walther 식, 축압기는 질소 단열 압축, HCU 내부 동작은 시뮬레이터의 분사·배기밸브 타이밍 표에서 계산합니다.</li>
<li>회전 기기(스크루 펌프, HPS 펌프, 송풍기)는 실제 회전수를 그대로 그리면 깜박여 보이므로 화면에서는 감속해 그립니다. 계통 시간 배율(1×/10×/60×)은 연료 계통의 느린 응답(가열기·필터 막힘)만 빠르게 돌립니다.</li>
</ul>
<h3 style="margin:14px 0 6px;font-size:13px">추가 자료가 필요한 사항</h3>
<ul style="margin:0;padding-left:18px;display:grid;gap:4px;font-size:12.5px;max-width:70ch">
<li>대상 엔진의 정확한 모델명(예: 6S60ME-C10.5)과 Project Guide: 행정, 커넥팅 로드 길이, 압축비, 포트 높이, 점화 순서, 회전 방향.</li>
<li>엔진 제어 시스템의 부하별 배기밸브·분사 타이밍 (Shop test 또는 ECS 설정값), 실측 압력 선도(PMI)와 Shop test 기록 — 0D 모델 보정에 사용.</li>
<li>터보차저 압축기·터빈 맵, 공기 냉각기 성능 자료 — 매칭 근사식 교체에 사용.</li>
<li>보조 송풍기 기동/정지 압력, 터보차저 형식과 대수, 배기가스 보일러 종류와 선박 계통도.</li>
<li>연료 공급 계통의 실제 구성 (탈기·혼합 탱크, 가열기, 점도 제어기, 필터 위치)과 HPS 구동 방식(체인/기어, 전동식).</li>
<li>실제 선박의 연료·제어유 계통도와 기기 사양(펌프 형식·용량, 가열기 전열 면적, 필터 형식·눈 크기, HCU 축압기 체적) — 기기 내부 보기의 가정값 교체에 사용.</li>
<li>상세 부품 GLB/glTF 모델 (원점·축·단위: 운동 슬롯과 같은 좌표, Y 위쪽, m).</li>
</ul>
<p style="font-size:11.5px;color:var(--muted);margin-top:10px">출처: <a href="https://marinediesels.info/2_stroke_engine_parts/Other_info/exhaust_valve_cam.htm" target="_blank" rel="noopener" style="color:var(--accent)">marinediesels.info · Exhaust valve timing</a> · <a href="https://wordpress-sxaew.wasmer.app/?p=589" target="_blank" rel="noopener" style="color:var(--accent)">Differences between MC/MC-C and ME/ME-C</a> · <a href="https://www.merchantnavydecoded.com/?p=90586" target="_blank" rel="noopener" style="color:var(--accent)">ME engine Hydraulic Power Supply</a> · <a href="https://maritimepage.com/what-is-scavenging-in-marine-engines/" target="_blank" rel="noopener" style="color:var(--accent)">Scavenging in marine engines</a> · <a href="https://upcommons.upc.edu/bitstreams/1228fb6b-7583-4138-89cb-9d70da2bc84b/download" target="_blank" rel="noopener" style="color:var(--accent)">5S60ME-B8 project data</a> · 각 기기 내부 보기의 '자료 근거' 칸에 기기별 출처를 따로 적었습니다.</p>`;

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
    SIM.tcAngle += dt * (ENGS.N / 60) * 2 * Math.PI * S.speed * 0.02;  // 시각화용 감속 (실제 회전수의 2 % × 재생 속도)
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
  settleEngine();          // 초기 운전 조건의 정상 상태 (0D + 터보 매칭)
  stepFuelSystem(900);     // 연료·제어유 계통 정상 상태
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
requestAnimationFrame(() => setTimeout(() => { try { main(); } catch (e) { console.error(e); const l = $('loading'); if (l) l.textContent = '3D 장면을 만들지 못했습니다: ' + e.message; } }, 30));

