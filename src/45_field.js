// ===================================================================
// 45 · FIELD — 실린더 내부 2D 단면 유동장 (워커에서 계산, 크랭크각 테이블로 저장)
// MAC 격자 · 반라그랑주 이류 · 공액경사법 압력 투영.
//   경계: 피스톤(이동 벽), 소기 포트(측벽 유입, 0D 질량유량), 배기밸브(상부 유출, 0D 질량유량)
//   균일 체적 변화율 S로 압축·팽창을 표현 (div u = S)
// 스칼라: a = 미연소 공기 분율, T = 온도(0D 평균에 맞춰 정규화), s = 이번 사이클 공급 공기 추적자, w = 선회 속도
// 한 사이클을 주기 상태까지 반복 계산한 뒤 1° 간격 스냅숏으로 저장 → 재생·정지·수동 조절에서 같은 값.
// 2D 단면 근사이며 실제 3D CFD 결과가 아니다.
// ===================================================================
function FIELD_SIM() {
  let WARM = null;   // 직전 계산의 마지막 상태 (같은 격자면 다음 계산의 초기값으로 사용)
  function simulateField(J) {
    const t0 = Date.now();
    const NX = J.NX, NY = J.NY, B = J.B, hx = B / NX, hy = (J.yH - J.y0) / NY, xmin = -B / 2, y0 = J.y0;
    const N = NX * NY, NU = (NX + 1) * NY, NV = NX * (NY + 1);
    let a = new Float32Array(N).fill(0.95), T = new Float32Array(N).fill(J.Tm[Math.round(300 / (360 / J.Tm.length)) % J.Tm.length]), s = new Float32Array(N).fill(1), w = new Float32Array(N);
    let a2 = new Float32Array(N), T2 = new Float32Array(N), s2 = new Float32Array(N), w2 = new Float32Array(N);
    let u = new Float32Array(NU), v = new Float32Array(NV), u2 = new Float32Array(NU), v2 = new Float32Array(NV);
    const phi = new Float64Array(N), rhs = new Float64Array(N), rr = new Float64Array(N), zz = new Float64Array(N), pp = new Float64Array(N), Ap = new Float64Array(N), dg = new Float64Array(N);
    if (J.warm && WARM && WARM.NX === NX && WARM.NY === NY) { a.set(WARM.a); T.set(WARM.T); s.set(WARM.s); w.set(WARM.w); u.set(WARM.u); v.set(WARM.v); }
    const fluid = new Uint8Array(N), cpY = new Float64Array(NY), dpY = new Float64Array(NY), HAT = new Float64Array(NX * NY);
    const WBUF = new Float32Array(N), COS = new Float64Array(NX * NX), LAM = new Float64Array(NX), WK = new Float64Array(NX);
    for (let kx = 0; kx < NX; kx++) { LAM[kx] = (2 - 2 * Math.cos(Math.PI * kx / NX)) / (hx * hx); WK[kx] = kx === 0 ? 1 / NX : 2 / NX; for (let i = 0; i < NX; i++) COS[kx * NX + i] = Math.cos(Math.PI * kx * (i + 0.5) / NX); }
    const ixU = (i, j) => j * (NX + 1) + i, ixV = (i, j) => j * NX + i, ix = (i, j) => j * NX + i;
    const NS = J.crown.length, dth0 = 360 / NS;
    const at = (arr, th) => { const x = (((th % 360) + 360) % 360) / dth0, i = Math.floor(x) % NS, f = x - Math.floor(x); return arr[i] + (arr[(i + 1) % NS] - arr[i]) * f; };
    const yc = j => y0 + (j + 0.5) * hy, xc = i => xmin + (i + 0.5) * hx;
    let Ma = -1, Ms = -1;   // 공기·추적자 질량 수지 (전역 보존 보정용)
    let jb = J.warm && WARM && WARM.NX === NX && WARM.NY === NY ? WARM.jb : 0;
    const tanSw = Math.tan(20 * Math.PI / 180);
    // ---- 보간 ----
    const clampi = (v, a, b) => v < a ? a : v > b ? b : v;
    function sampleC(F, x, y) {
      let fx = (x - xmin) / hx - 0.5, fy = (y - y0) / hy - 0.5;
      fx = clampi(fx, 0, NX - 1.001); fy = clampi(fy, jb, NY - 1.001);
      const i = fx | 0, j = fy | 0, tx = fx - i, ty = fy - j, k = ix(i, j);
      return (F[k] * (1 - tx) + F[k + 1] * tx) * (1 - ty) + (F[k + NX] * (1 - tx) + F[k + NX + 1] * tx) * ty;
    }
    function sampleU(x, y) {
      let fx = (x - xmin) / hx, fy = (y - y0) / hy - 0.5;
      fx = clampi(fx, 0, NX - 0.001); fy = clampi(fy, jb, NY - 1.001);
      const i = fx | 0, j = fy | 0, tx = fx - i, ty = fy - j, k = ixU(i, j);
      return (u[k] * (1 - tx) + u[k + 1] * tx) * (1 - ty) + (u[k + NX + 1] * (1 - tx) + u[k + NX + 2] * tx) * ty;
    }
    function sampleV(x, y) {
      let fx = (x - xmin) / hx - 0.5, fy = (y - y0) / hy;
      fx = clampi(fx, 0, NX - 1.001); fy = clampi(fy, jb, NY - 0.001);
      const i = fx | 0, j = fy | 0, tx = fx - i, ty = fy - j, k = ixV(i, j);
      return (v[k] * (1 - tx) + v[k + 1] * tx) * (1 - ty) + (v[k + NX] * (1 - tx) + v[k + NX + 1] * tx) * ty;
    }
    let BX = 0, BY = 0;
    function back(x, y, dt) {
      const ux = sampleU(x, y), vy = sampleV(x, y);
      const mx = x - 0.5 * dt * ux, my = y - 0.5 * dt * vy;
      BX = x - dt * sampleU(mx, my); BY = y - dt * sampleV(mx, my);
    }
    // ---- 통계 ----
    const D = { inMass: 0, outS: 0, etaSc: 0, etaTr: 0, short: 0, divMax: 0, cgIt: 0, steps: 0 };
    const snapN = 360, snaps = new Uint8Array(snapN * N * 4), omega = new Float32Array(snapN), aMean = new Float32Array(snapN), sMean = new Float32Array(snapN);
    let snapStart = null, snapEnd = null;
    // ---- 한 스텝 ----
    function step(th, dth, record) {
      const rpm = J.rpm, dt = dth / (6 * rpm), thm = th + dth / 2, the = th + dth;
      const crownE = at(J.crown, the), vp = at(J.vp, thm);
      const mIn = at(J.mIn, thm), mOut = at(J.mOut, thm), rho = at(J.rho, thm), Tm = at(J.Tm, the);
      // 1. 유체 영역 갱신 (피스톤 위)
      let jbNew = NY - 1; for (let j = 0; j < NY; j++) if (yc(j) > crownE) { jbNew = j; break; }
      if (jbNew < jb) { for (let j = jbNew; j < jb; j++) for (let i = 0; i < NX; i++) { const k = ix(i, j), kk = ix(i, jb); a[k] = a[kk]; T[k] = T[kk]; s[k] = s[kk]; w[k] = w[kk]; } }
      jb = jbNew;
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) fluid[ix(i, j)] = j >= jb ? 1 : 0;
      // 2. 이류
      const wDec = Math.exp(-1.5 * dt);
      for (let j = jb; j < NY; j++) for (let i = 0; i < NX; i++) {
        const k = ix(i, j); back(xc(i), yc(j), dt);
        let fx = (BX - xmin) / hx - 0.5, fy = (BY - y0) / hy - 0.5;
        fx = fx < 0 ? 0 : fx > NX - 1.001 ? NX - 1.001 : fx; fy = fy < jb ? jb : fy > NY - 1.001 ? NY - 1.001 : fy;
        const ii = fx | 0, jj = fy | 0, tx = fx - ii, ty = fy - jj, q = ix(ii, jj);
        const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
        a2[k] = a[q] * w00 + a[q + 1] * w10 + a[q + NX] * w01 + a[q + NX + 1] * w11;
        T2[k] = T[q] * w00 + T[q + 1] * w10 + T[q + NX] * w01 + T[q + NX + 1] * w11;
        s2[k] = s[q] * w00 + s[q + 1] * w10 + s[q + NX] * w01 + s[q + NX + 1] * w11;
        w2[k] = (w[q] * w00 + w[q + 1] * w10 + w[q + NX] * w01 + w[q + NX + 1] * w11) * wDec;
      }
      for (let j = jb; j < NY; j++) for (let i = 1; i < NX; i++) { back(xmin + i * hx, yc(j), dt); u2[ixU(i, j)] = sampleU(BX, BY); }
      for (let j = jb + 1; j < NY; j++) for (let i = 0; i < NX; i++) { back(xc(i), y0 + j * hy, dt); v2[ixV(i, j)] = sampleV(BX, BY); }
      [a, a2] = [a2, a]; [T, T2] = [T2, T]; [s, s2] = [s2, s]; [w, w2] = [w2, w]; [u, u2] = [u2, u]; [v, v2] = [v2, v];
      for (let j = 0; j < jb; j++) { for (let i = 0; i <= NX; i++) u[ixU(i, j)] = 0; for (let i = 0; i < NX; i++) v[ixV(i, j)] = 0; }
      // 3. 경계 속도 (단위 깊이당 2D 체적 유량 = 3D 평균 축방향 속도 × 보어 폭)
      const Ap3 = Math.PI * B * B / 4;
      for (let i = 0; i < NX; i++) v[ixV(i, jb)] = vp;                      // 피스톤 면
      for (let j = jb; j < NY; j++) { u[ixU(0, j)] = 0; u[ixU(NX, j)] = 0; }
      for (let i = 0; i < NX; i++) v[ixV(i, NY)] = 0;
      let fluxIn = vp * B;                                                    // 순유입 (m²/s)
      const portLo = Math.max(crownE, J.portBot), portHi = J.portTop, hOpen = Math.max(0, portHi - portLo);
      const inflow = [];                                                      // [cell, flux, aIn, TIn, sIn, wIn]
      if (hOpen > 1e-4 && mIn !== 0) {
        const Q2 = (mIn / (mIn > 0 ? J.rhoIn : rho)) / Ap3 * B, uin = Q2 / 2 / hOpen;
        for (let j = jb; j < NY; j++) {
          const lo = Math.max(portLo, y0 + j * hy), hi = Math.min(portHi, y0 + (j + 1) * hy), ov = hi - lo;
          if (ov <= 0) continue;
          const uf = uin * ov / hy;
          u[ixU(0, j)] = uf; u[ixU(NX, j)] = -uf;
          if (mIn > 0) { const F = uf * hy; inflow.push([ix(0, j), F, 1, J.Ts, 1, Math.abs(uin) * tanSw], [ix(NX - 1, j), F, 1, J.Ts, 1, Math.abs(uin) * tanSw]); }
        }
        fluxIn += Q2;
      }
      if (mOut !== 0) {
        const lift = at(J.lift, thm);
        if (lift > 0) {
          const Q2 = (mOut / (mOut > 0 ? rho : J.rhoX)) / Ap3 * B;
          let wsum = 0; const ws = [];
          for (let i = 0; i < NX; i++) { const ov = Math.max(0, Math.min(J.rv, xc(i) + hx / 2) - Math.max(-J.rv, xc(i) - hx / 2)); ws.push(ov); wsum += ov; }
          for (let i = 0; i < NX; i++) if (ws[i] > 0) {
            const vf = Q2 / wsum;
            v[ixV(i, NY)] = vf * (ws[i] / hx);
            if (mOut < 0) inflow.push([ix(i, NY - 1), -vf * ws[i], 0, J.Tx, 0, 0]);
            else if (record !== null) { D.outS += s[ix(i, NY - 1)] * mOut * dt * ws[i] / wsum; }
          }
          fluxIn -= Q2;
        }
      }
      if (mIn > 0 && hOpen > 1e-4) D.inMass += mIn * dt;
      // 4. 경계 스칼라 혼합 (유입 유속만큼 셀 내용 교체)
      if (Ma < 0) { const m0 = at(J.mCyl, th), nF0 = NX * (NY - jb); let sa = 0, ss = 0; for (let j = jb; j < NY; j++) for (let i = 0; i < NX; i++) { sa += a[ix(i, j)]; ss += s[ix(i, j)]; } Ma = sa * m0 / nF0; Ms = ss * m0 / nF0; }
      // 질량 수지: 포트 유입(공기 1), 포트 역류·배기 유출(경계 셀의 분율)
      if (mIn > 0 && hOpen > 1e-4) { Ma += mIn * dt; Ms += mIn * dt; }
      else if (mIn < 0 && hOpen > 1e-4) { let sa = 0, ss = 0, n = 0; for (let j = jb; j < NY; j++) if (u[ixU(0, j)] !== 0) { sa += a[ix(0, j)] + a[ix(NX - 1, j)]; ss += s[ix(0, j)] + s[ix(NX - 1, j)]; n += 2; } if (n) { Ma += mIn * dt * sa / n; Ms += mIn * dt * ss / n; } }
      if (mOut > 0 && at(J.lift, thm) > 0) { let sa = 0, ss = 0, wt = 0; for (let i = 0; i < NX; i++) { const vf = v[ixV(i, NY)]; if (vf > 0) { sa += a[ix(i, NY - 1)] * vf; ss += s[ix(i, NY - 1)] * vf; wt += vf; } } if (wt > 0) { Ma -= mOut * dt * sa / wt; Ms -= mOut * dt * ss / wt; } }
      for (const [k, F, ai, Ti, si, wi] of inflow) { const f = Math.min(1, F * dt / (hx * hy)); a[k] += (ai - a[k]) * f; T[k] += (Ti - T[k]) * f; s[k] += (si - s[k]) * f; w[k] += (wi - w[k]) * f; }
      // 5. 연소 열방출 (분무 플룸 → 후기에는 고온·공기 존재 영역)
      const dQ = at(J.dQ, thm) * dth;
      if (dQ > 0) {
        const nF = NX * (NY - jb), mc = at(J.mCyl, thm) / nF, since = at(J.since, thm), injOn = since >= 0 && since < J.injDur + 4;
        const W = WBUF; let Ws = 0;
        let Tmean = 0; for (let j = jb; j < NY; j++) for (let i = 0; i < NX; i++) Tmean += T[ix(i, j)]; Tmean /= nF;
        for (let j = jb; j < NY; j++) for (let i = 0; i < NX; i++) {
          const k = ix(i, j), x = xc(i), y = yc(j); let wt = 0;
          if (injOn) {
            const L = 0.30 * Math.min(1, Math.max(0.15, since / 6));
            for (const n of J.noz) {
              const rx = x - n.x, ry = y - n.y, sa = rx * n.dx + ry * n.dy, dp = Math.abs(rx * n.dy - ry * n.dx);
              if (sa < 0.2 * L || sa > 1.25 * L) continue;
              const sg = 0.035 + 0.16 * sa;
              wt += Math.exp(-((dp / sg) ** 2)) * Math.exp(-(((sa - 0.8 * L) / (0.55 * L)) ** 2));
            }
          } else wt = Math.max(0, T[k] / Tmean - 0.95) ** 2;
          wt *= a[k] + 0.02; W[k] = wt; Ws += wt;
        }
        if (Ws > 0) {
          const dmP = dQ / (J.LHV * 0.985) * (1 + J.AFR);
          for (let j = jb; j < NY; j++) for (let i = 0; i < NX; i++) {
            const k = ix(i, j), f = W[k] / Ws;
            T[k] += dQ * f / (mc * 900); const an = Math.max(0, a[k] - dmP * f / mc); Ma -= (a[k] - an) * mc; a[k] = an;
          }
        }
      }
      // 6. 벽 열손실 (라이너·커버·피스톤 근처 셀)
      const kw = 1 - Math.exp(-18 * dt);
      for (let j = jb; j < NY; j++) for (let i = 0; i < NX; i++) if (i === 0 || i === NX - 1 || j === jb || j === NY - 1) { const k = ix(i, j); T[k] += (J.Tw - T[k]) * kw * 0.5; }
      // 7. 압력 투영
      const nF = NX * (NY - jb), Afl = nF * hx * hy, S = -fluxIn / Afl;   // 순유입 → 압축 (div u < 0)
      let rsum = 0;
      for (let j = jb; j < NY; j++) for (let i = 0; i < NX; i++) {
        const k = ix(i, j);
        const div = (u[ixU(i + 1, j)] - u[ixU(i, j)]) / hx + (v[ixV(i, j + 1)] - v[ixV(i, j)]) / hy;
        rhs[k] = (S - div) / dt; rsum += rhs[k];
        let d = 0; if (i > 0) d += 1 / (hx * hx); if (i < NX - 1) d += 1 / (hx * hx); if (j > jb) d += 1 / (hy * hy); if (j < NY - 1) d += 1 / (hy * hy);
        dg[k] = d;
      }
      rsum /= nF; for (let j = jb; j < NY; j++) for (let i = 0; i < NX; i++) rhs[ix(i, j)] -= rsum;
      // 직접해: 직사각 유체 영역 + 노이만 경계 → x 방향 DCT로 대각화, 모드별 y 방향 삼중대각 (Thomas)
      for (let kx = 0; kx < NX; kx++) {
        for (let j = jb; j < NY; j++) { let acc = 0; const row = j * NX; for (let i = 0; i < NX; i++) acc += COS[kx * NX + i] * rhs[row + i]; HAT[kx * NY + j] = acc; }
        const lam = LAM[kx] + (kx === 0 ? 1e-7 / (hy * hy) : 0), oy = -1 / (hy * hy);
        let pc = 0, pd = 0;
        for (let j = jb; j < NY; j++) {
          const lo = j > jb ? oy : 0, up = j < NY - 1 ? oy : 0, dgn = lam - lo - up;
          const m = dgn - lo * pc; cpY[j] = up / m; dpY[j] = (HAT[kx * NY + j] - lo * pd) / m; pc = cpY[j]; pd = dpY[j];
        }
        let xv = 0; for (let j = NY - 1; j >= jb; j--) { xv = dpY[j] - cpY[j] * (j < NY - 1 ? xv : 0); HAT[kx * NY + j] = xv; }
      }
      for (let j = jb; j < NY; j++) for (let i = 0; i < NX; i++) { let acc = 0; for (let kx = 0; kx < NX; kx++) acc += WK[kx] * COS[kx * NX + i] * HAT[kx * NY + j]; phi[ix(i, j)] = acc; }
      const it = 1;
      D.cgIt += it;
      for (let j = jb; j < NY; j++) for (let i = 1; i < NX; i++) u[ixU(i, j)] -= dt * (phi[ix(i, j)] - phi[ix(i - 1, j)]) / hx;
      for (let j = jb + 1; j < NY; j++) for (let i = 0; i < NX; i++) v[ixV(i, j)] -= dt * (phi[ix(i, j)] - phi[ix(i, j - 1)]) / hy;
      if (record) {
        let dm = 0; for (let j = jb; j < NY; j++) for (let i = 0; i < NX; i++) { const div = (u[ixU(i + 1, j)] - u[ixU(i, j)]) / hx + (v[ixV(i, j + 1)] - v[ixV(i, j)]) / hy; dm = Math.max(dm, Math.abs(div - S)); }
        D.divMax = Math.max(D.divMax, dm * hx);   // 셀 크기 기준 속도 오차 (m/s)
      }
      // 8. 온도 정규화: 질량 가중 평균(균일 압력에서 조화평균)을 0D 평균 온도에 맞춤
      let inv = 0; for (let j = jb; j < NY; j++) for (let i = 0; i < NX; i++) inv += 1 / Math.max(200, T[ix(i, j)]);
      const kT = Tm / (nF / inv); for (let j = jb; j < NY; j++) for (let i = 0; i < NX; i++) { const k = ix(i, j); T[k] = Math.min(3200, Math.max(250, T[k] * kT)); }
      // 8b. 전역 보존 보정: 셀 분율 합이 질량 수지와 같도록 배율 조정 (반라그랑주 이류·피스톤 셀 추가의 비보존 오차 제거)
      { const m1 = at(J.mCyl, the), mc1 = m1 / nF; let sa = 0, ss = 0;
        for (let j = jb; j < NY; j++) for (let i = 0; i < NX; i++) { sa += a[ix(i, j)]; ss += s[ix(i, j)]; }
        Ma = Math.max(0, Ma); Ms = Math.max(0, Ms);
        const ka = sa > 1e-9 ? Ma / (sa * mc1) : 1, ks = ss > 1e-9 ? Ms / (ss * mc1) : 1;
        let sa2 = 0, ss2 = 0;
        for (let j = jb; j < NY; j++) for (let i = 0; i < NX; i++) { const k = ix(i, j); a[k] = Math.min(1, a[k] * ka); s[k] = Math.min(1, s[k] * ks); sa2 += a[k]; ss2 += s[k]; }
        Ma = sa2 * mc1; Ms = ss2 * mc1; D.corrMax = Math.max(D.corrMax || 0, Math.abs(ka - 1), Math.abs(ks - 1)); }
      // 9. 소기 지표: 포트 개방 순간 추적자 초기화, 배기밸브 폐쇄 순간 기록
      const wr = x => ((x % 360) + 360) % 360;
      if (wr(th) < J.po && wr(the) >= J.po) { s.fill(0); Ms = 0; D.inMass = 0; D.outS = 0; }
      if (wr(th) < J.evc && wr(the) >= J.evc && record !== null) {
        let sm = 0; for (let j = jb; j < NY; j++) for (let i = 0; i < NX; i++) sm += s[ix(i, j)];
        D.etaSc = sm / nF; D.etaTr = D.inMass > 0 ? 1 - D.outS / D.inMass : 0; D.short = D.inMass > 0 ? D.outS / D.inMass : 0;
      }
      D.steps++;
    }
    const LN12 = 255 / Math.log(12);
    function snapshot(deg) {
      const base = deg * N * 4;
      let wm = 0, am = 0, sm = 0, n = 0;
      for (let j = 0; j < NY; j++) {
        const jj = j > jb ? j : jb, ku = jj * (NX + 1), kv = jj * NX, kc = jj * NX;
        for (let i = 0; i < NX; i++) {
          const k = kc + i, o = base + (j * NX + i) * 4;
          const uc = 0.5 * (u[ku + i] + u[ku + i + 1]), vc = 0.5 * (v[kv + i] + v[kv + NX + i]);
          let q = a[k] * 255 + 0.5; snaps[o] = q < 0 ? 0 : q > 255 ? 255 : q;
          q = Math.log(T[k] * 0.004) * LN12 + 0.5; snaps[o + 1] = q < 0 ? 0 : q > 255 ? 255 : q;
          q = uc * 1.27 + 128.5; snaps[o + 2] = q < 1 ? 1 : q > 255 ? 255 : q;
          q = vc * 1.27 + 128.5; snaps[o + 3] = q < 1 ? 1 : q > 255 ? 255 : q;
          if (j >= jb) { wm += w[k]; am += a[k]; sm += s[k]; n++; }
        }
      }
      omega[deg] = 1.5 * (wm / Math.max(1, n)) / (B / 2);
      const mT = at(J.mCyl, deg);   // 공기·추적자 질량 = 셀 평균 분율 × 실린더 질량 (균일 밀도 가정)
      aMean[deg] = am / Math.max(1, n) * mT; sMean[deg] = sm / Math.max(1, n) * mT;
    }
    const copyState = () => ({ a: Float32Array.from(a), T: Float32Array.from(T) });
    // ---- 실행: θ = 300° 에서 시작, cycles 회 반복, 마지막 사이클 기록 ----
    const th0 = 300, gx0 = 105, gx1 = 265;
    const dthOf = th => { const x = ((th % 360) + 360) % 360; return (x >= gx0 && x < gx1) || (x >= 355 || x < 40) ? 0.5 : 1; };
    for (let c = 0; c < J.cycles; c++) {
      const last = c === J.cycles - 1;
      if (last) snapStart = copyState();
      let th = th0 + c * 360;
      const end = th + 360;
      while (th < end - 1e-9) {
        const d = dthOf(th);
        if (last) { const deg = Math.round(((th % 360) + 360) % 360); if (Math.abs(((th % 360) + 360) % 360 - deg) < 1e-6) snapshot(deg % 360); }
        step(th, d, last ? true : null);
        th += d;
      }
    }
    snapEnd = copyState();
    WARM = { NX, NY, jb, a: Float32Array.from(a), T: Float32Array.from(T), s: Float32Array.from(s), w: Float32Array.from(w), u: Float32Array.from(u), v: Float32Array.from(v) };
    let pa = 0, pT = 0; for (let k = 0; k < N; k++) { pa += Math.abs(snapEnd.a[k] - snapStart.a[k]); pT += Math.abs(snapEnd.T[k] - snapStart.T[k]) / Math.max(300, snapStart.T[k]); }
    D.periodA = pa / N; D.periodT = pT / N;
    D.cgAvg = D.cgIt / D.steps; D.ms = Date.now() - t0;
    return { snaps, omega, aMean, sMean, NX, NY, hx, hy, y0, D, id: J.id };
  }
  if (typeof window === 'undefined' && typeof self !== 'undefined' && typeof self.postMessage === 'function') {
    self.onmessage = e => { const r = simulateField(e.data); self.postMessage(r, [r.snaps.buffer, r.omega.buffer, r.aMean.buffer, r.sMean.buffer]); };
  }
  return simulateField;
}

