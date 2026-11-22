/**
 * Thin-wall peripheral milling process simulation (Phase 1).
 *
 * Quasi-static, pass-by-pass simulation:
 *   for each pass (face, Z-level, roughing/finishing):
 *     1. build the plate FE model from the CURRENT stock thickness (stiffness update)
 *     2. step the tool along X; at each station
 *        a. read the actual radial engagement ae and engaged length b from the stock
 *        b. evaluate the mechanistic force over one revolution (mean, peak, signal)
 *        c. solve the wall for a unit patch load at the CURRENT contact location
 *        d. evaluate the force at the surface-generation instant (φ = φst for
 *           up-milling, φ = φex for down-milling) and the resulting tool and wall
 *           deflections → surface location error
 *        e. write the generated surface into the stock height field
 *
 * Force–deflection coupling: the radial immersion actually cut is ae − e, where e is the
 * relative tool–wall deflection at the surface-generation instant; e is found by bisection.
 *
 * Surface generated at height z:   y_s = y_target + δ_tool(z) − w_wall(x, z)
 *   (y in the machine frame; the wall springs back by −w after the tool passes)
 * Material left (positive = undercut / wall thicker than nominal):
 *   e = (w_wall − δ_tool) · n,   n = +1 cutting the front (−Y) face, −1 the back face.
 */
import { MATERIALS, KG_M3_TO_T_MM3, type CoeffSource, type CuttingCoefficients, type MaterialId } from './materials';
import {
  cutterForce, engagementAngles, helixLag, feedRate, feedToGlobal, forceSignal, signalStats, toothPassingFrequency,
  type CutParams, type ForceVector, type MillingMode,
} from './millingForce';
import {
  buildPlate, extractW, firstNaturalFrequency, patchLoadVector, sampleW, type PlateMesh,
} from './plateFE';
import { cellIndex, cellRange, cloneStock, createStock, elementThickness, stockVolume, type StockGrid } from './stock';
import { toolDeflectionAt, toolStiffnessAtLoad } from './toolDeflection';

export type Strategy = 'single-side' | 'alternating' | 'rough-finish' | 'step-support';
export type Face = 'front' | 'back';

export interface ProcessParams {
  materialId: MaterialId;
  coeffs: CuttingCoefficients;
  coeffSource: CoeffSource;
  rpm: number;
  N: number;
  fz: number;
  /** axial depth per Z-level, mm */
  ap: number;
  /** finishing radial depth per side (finishing allowance), mm */
  aeFinish: number;
  /** roughing radial depth per side (only for rough-finish), mm */
  aeRough: number;
  D: number;
  /** helix angle of the end mill, degrees (0 = straight flute) */
  helixDeg: number;
  overhang: number;
  /** final (nominal) wall thickness, mm */
  wallThickness: number;
  wallHeight: number;
  wallLength: number;
  strategy: Strategy;
  mode: MillingMode;
  clampRigid: boolean;
  /** N·mm/rad per mm */
  clampKRot: number;
  /** ± tolerance on wall thickness, mm */
  tolerance: number;
  meshNx: number;
  meshNz: number;
  stationStep: number;
}

export const DEFAULT_PARAMS: ProcessParams = {
  materialId: 'al7075',
  coeffs: { ...MATERIALS.al7075.coeffs },
  coeffSource: 'illustrative',
  rpm: 12000,
  N: 3,
  fz: 0.05,
  ap: 5,
  aeFinish: 0.5,
  aeRough: 1.5,
  D: 8,
  helixDeg: 30,
  overhang: 45,
  wallThickness: 2,
  wallHeight: 40,
  wallLength: 50,
  strategy: 'alternating',
  mode: 'down',
  clampRigid: true,
  clampKRot: 2e5,
  tolerance: 0.05,
  meshNx: 16,
  meshNz: 12,
  stationStep: 2,
};

export interface Pass {
  index: number;
  face: Face;
  kind: 'rough' | 'finish';
  zTop: number;
  zBot: number;
  /** target Y position of the face being cut */
  target: number;
  /** +1: tool feeds toward +X */
  feedSign: 1 | -1;
  /** direction from tool toward material along Y */
  n: 1 | -1;
  firstStation: number;
  lastStation: number;
  /** first natural frequency of the wall at the start of the pass, Hz */
  f1: number;
}

export interface StockEdit {
  face: Face;
  idx: Int32Array;
  val: Float32Array;
}

export interface StationRecord {
  pass: number;
  x: number;
  /** nominal radial depth read from the stock, mm */
  ae: number;
  /** effective radial depth after force–deflection coupling (mid-band), mm */
  aeEff: number;
  b: number;
  zTip: number;
  meanF: ForceVector; // global, on tool
  peakResultant: number;
  meanResultant: number;
  /** signed global FY on tool that has the largest magnitude over a revolution */
  peakFY: number;
  /** global force on tool at the surface-generation instant */
  Fs: ForceVector;
  /** wall Y displacement per +1 N patch load at this contact (nodal) */
  wUnit: Float32Array;
  wallDeflPeak: number;
  toolDeflPeak: number;
  sleMin: number;
  sleMax: number;
  removed: number; // mm³
  time: number; // s, end of station
  edit: StockEdit;
  patch: { x0: number; x1: number };
}

export interface SimSummary {
  feedRate: number; // mm/min
  ftp: number; // Hz
  vc: number; // m/min
  nominalMRR: number; // mm³/min (finishing)
  averageMRR: number; // mm³/min over the whole cycle
  cycleTime: number; // s (cutting only)
  initialThickness: number;
  removedVolume: number;
  volumeBalanceError: number; // mm³, should be ~0
  peakResultant: number;
  meanResultantFinish: number;
  maxWallDefl: number;
  maxToolDefl: number;
  minF1: number;
  dynamicRatio: number; // ftp / minF1
  devMin: number;
  devMax: number;
  devMean: number;
  inTolFraction: number;
  toolStiffness: number; // N/mm at load point (single level)
  warnings: string[];
}

export interface SimResult {
  params: ProcessParams;
  mesh: PlateMesh;
  passes: Pass[];
  stations: StationRecord[];
  stock0: StockGrid;
  stockFinal: StockGrid;
  summary: SimSummary;
}

export function hasRoughing(s: Strategy) {
  return s === 'rough-finish' || s === 'step-support';
}

export const STRATEGY_INFO: Record<Strategy, { name: string; text: string }> = {
  'single-side': {
    name: 'Single-side finishing',
    text: 'Finish the whole front face level by level, then the whole back face. The back face is cut when the wall is already thin.',
  },
  alternating: {
    name: 'Alternating-side finishing',
    text: 'At each Z-level finish the front face, then the back face, then step down. Stock below the level stays at full thickness.',
  },
  'rough-finish': {
    name: 'Rough all, then finish all',
    text: 'Rough both faces over the full height, then finish both faces over the full height. Finishing sees only the finishing allowance as support.',
  },
  'step-support': {
    name: 'Step-support (rough + finish per level)',
    text: 'At each Z-level rough and finish both faces before stepping down, so the thick unmachined stock below supports the level being finished.',
  },
};

export function initialThickness(p: ProcessParams): number {
  return p.wallThickness + 2 * p.aeFinish + (hasRoughing(p.strategy) ? 2 * p.aeRough : 0);
}

export function planPasses(p: ProcessParams): Omit<Pass, 'index' | 'firstStation' | 'lastStation' | 'f1'>[] {
  const levels: { zTop: number; zBot: number }[] = [];
  for (let zTop = p.wallHeight; zTop > 1e-9; zTop -= p.ap) levels.push({ zTop, zBot: Math.max(0, zTop - p.ap) });
  const half = p.wallThickness / 2;
  const mk = (face: Face, kind: 'rough' | 'finish', lv: { zTop: number; zBot: number }) => {
    const n: 1 | -1 = face === 'front' ? 1 : -1;
    // up-milling needs material on +y_feed; y_feed = feedSign·Y  ⇒ feedSign = n for up, −n for down
    const feedSign = (p.mode === 'up' ? n : -n) as 1 | -1;
    const off = kind === 'rough' ? half + p.aeFinish : half;
    return { face, kind, zTop: lv.zTop, zBot: lv.zBot, target: face === 'front' ? -off : off, feedSign, n };
  };
  const out: ReturnType<typeof mk>[] = [];
  if (p.strategy === 'single-side') {
    for (const lv of levels) out.push(mk('front', 'finish', lv));
    for (const lv of levels) out.push(mk('back', 'finish', lv));
  } else if (p.strategy === 'alternating') {
    for (const lv of levels) out.push(mk('front', 'finish', lv), mk('back', 'finish', lv));
  } else if (p.strategy === 'rough-finish') {
    for (const lv of levels) out.push(mk('front', 'rough', lv), mk('back', 'rough', lv));
    for (const lv of levels) out.push(mk('front', 'finish', lv), mk('back', 'finish', lv));
  } else {
    for (const lv of levels)
      out.push(mk('front', 'rough', lv), mk('back', 'rough', lv), mk('front', 'finish', lv), mk('back', 'finish', lv));
  }
  return out;
}

export function cutParamsFor(p: ProcessParams, ae: number, b: number): CutParams {
  return { D: p.D, N: p.N, fz: p.fz, b, ae, mode: p.mode, K: p.coeffs, helixDeg: p.helixDeg, dz: 0.5 };
}

/** Surface-generation immersion angle (where the edge is tangent to the final surface). */
export function surfaceAngle(p: ProcessParams, ae: number): number {
  const { phiSt, phiEx } = engagementAngles(p.D, ae, p.mode);
  return p.mode === 'up' ? phiSt : phiEx;
}

export function simulate(p: ProcessParams): SimResult {
  const mat = MATERIALS[p.materialId];
  const mesh: PlateMesh = { Lx: p.wallLength, H: p.wallHeight, nx: p.meshNx, nz: p.meshNz };
  const T0 = initialThickness(p);
  const stock = createStock(p.wallLength, p.wallHeight, T0);
  const stock0 = cloneStock(stock);
  const vol0 = stockVolume(stock);
  const vf = feedRate(p.rpm, p.N, p.fz);
  const R = p.D / 2;
  const tool = { D: p.D, overhang: p.overhang };
  const clamp = { rigid: p.clampRigid, kRot: p.clampKRot, kTrans: 1e5 };
  const plan = planPasses(p);
  const passes: Pass[] = [];
  const stations: StationRecord[] = [];
  const nStations = Math.max(2, Math.round(p.wallLength / p.stationStep) + 1);
  const step = p.wallLength / (nStations - 1);
  let time = 0;
  let removedTotal = 0;
  let modeGuess: Float64Array | undefined;

  for (let pi = 0; pi < plan.length; pi++) {
    const ps = plan[pi];
    const plate = buildPlate(mesh, elementThickness(stock, mesh.nx, mesh.nz), mat, clamp, mat.rho * KG_M3_TO_T_MM3);
    const eig = firstNaturalFrequency(plate, pi === 0 ? 30 : 8, modeGuess);
    modeGuess = eig.mode;
    const f1 = eig.f1;
    const pass: Pass = { ...ps, index: pi, firstStation: stations.length, lastStation: -1, f1 };
    const faceArr = ps.face === 'front' ? stock.front : stock.back;

    for (let si = 0; si < nStations; si++) {
      const x = ps.feedSign === 1 ? si * step : p.wallLength - si * step;
      const xa = Math.max(0, x - step / 2), xb = Math.min(p.wallLength, x + step / 2);
      const rng = cellRange(stock, xa, xb, ps.zBot, ps.zTop);

      // (a) nominal engagement per stock row, read from the current stock
      const rowAe: number[] = [];
      let nMatRows = 0;
      for (let k = rng.k0; k <= rng.k1; k++) {
        let sum = 0, cnt = 0;
        for (let i = rng.i0; i <= rng.i1; i++) {
          const c = cellIndex(stock, i, k);
          const d = ps.face === 'front' ? ps.target - stock.front[c] : stock.back[c] - ps.target;
          if (d > 1e-6) { sum += d; cnt++; }
        }
        const aeK = cnt > 0 ? Math.min(sum / cnt, p.D) : 0;
        rowAe.push(aeK);
        if (aeK > 0) nMatRows++;
      }
      const nRows = rowAe.length;
      const b = nRows > 0 ? ((ps.zTop - ps.zBot) * nMatRows) / nRows : 0;
      const aeNom = nMatRows > 0 ? rowAe.reduce((x, y) => x + y, 0) / nMatRows : 0;

      // contact patch extent along X (engaged arc)
      const { phiSt, phiEx } = engagementAngles(p.D, Math.max(aeNom, 1e-3), p.mode);
      let lxMin = Infinity, lxMax = -Infinity;
      for (let q = 0; q <= 8; q++) {
        const ph = phiSt + ((phiEx - phiSt) * q) / 8;
        const lx = R * Math.sin(ph);
        lxMin = Math.min(lxMin, lx); lxMax = Math.max(lxMax, lx);
      }
      let px0 = x + ps.feedSign * (ps.feedSign === 1 ? lxMin : lxMax);
      let px1 = x + ps.feedSign * (ps.feedSign === 1 ? lxMax : lxMin);
      if (px1 - px0 < 1) { const m = (px0 + px1) / 2; px0 = m - 0.5; px1 = m + 0.5; }
      px0 = Math.max(0, px0); px1 = Math.min(p.wallLength, px1);
      if (px1 - px0 < 0.2) px0 = Math.max(0, px1 - 0.2);

      // (b) wall compliance: unit patch load (+1 N in +Y) at the CURRENT contact location
      const zc1 = ps.zBot + Math.max(b, 1e-3);
      const fvec = patchLoadVector(mesh, px0, px1, ps.zBot, zc1, 1, 5);
      const wUnit = extractW(mesh, plate.chol.solve(fvec));
      let wUnitMax = 0;
      for (let q = 0; q < wUnit.length; q++) wUnitMax = Math.max(wUnitMax, Math.abs(wUnit[q]));

      // (c) surface generation with force–deflection coupling, row by row.
      //     The edge point at height z is at φs when the tip angle is φ0 = φs + ψ(z − zTip).
      //     The deflection e reduces the real radial immersion to ae − e, which lowers the force:
      //        e = C(z) · F_n(ae − e)      solved by bisection on e ∈ [−ae, ae].
      const idx: number[] = [], val: number[] = [];
      let sleMin = Infinity, sleMax = -Infinity, removed = 0;
      let Fs: ForceVector = { Fx: 0, Fy: 0, Fz: 0 };
      let aeEffMid = aeNom;
      const kMid = Math.round((rng.k0 + rng.k1) / 2);
      for (let k = rng.k0; k <= rng.k1; k++) {
        const aeK = rowAe[k - rng.k0];
        if (aeK <= 0) continue;
        const z = (k + 0.5) * stock.dz;
        const cw = sampleW(mesh, wUnit, x, z); // wall: mm per N in +Y
        const ct = toolDeflectionAt(tool, 1, ps.zBot, ps.zTop - ps.zBot, z); // tool: mm per N
        const lag = helixLag(p.D, p.helixDeg, z - ps.zBot);
        const forceAt = (aeEff: number): ForceVector =>
          aeEff <= 1e-9 ? { Fx: 0, Fy: 0, Fz: 0 }
            : feedToGlobal(cutterForce(surfaceAngle(p, aeEff) + lag, cutParamsFor(p, Math.min(aeEff, p.D), b)).F, ps.feedSign);
        const errAt = (e: number) => { const F = forceAt(aeK - e); return { g: e - (cw * -F.Fy - ct * F.Fy) * ps.n, F }; };
        // g(e) is monotonically increasing on [−ae, ae]; Illinois (modified regula falsi) root search
        let lo = -aeK, hi = aeK;
        let rLo = errAt(lo), rHi = errAt(hi);
        let e: number, F: ForceVector;
        if (rLo.g >= 0) { e = lo; F = rLo.F; }
        else if (rHi.g <= 0) { e = hi; F = rHi.F; }
        else {
          let gLo = rLo.g, gHi = rHi.g, side = 0;
          e = 0; F = rLo.F;
          for (let it = 0; it < 30; it++) {
            e = (lo * gHi - hi * gLo) / (gHi - gLo);
            const r = errAt(e);
            F = r.F;
            if (Math.abs(r.g) < 1e-7 || hi - lo < 1e-7) break;
            if (r.g > 0) { hi = e; gHi = r.g; if (side === 1) gLo /= 2; side = 1; }
            else { lo = e; gLo = r.g; if (side === -1) gHi /= 2; side = -1; }
          }
        }
        if (k === kMid || Fs.Fy === 0) { Fs = F; aeEffMid = Math.max(aeK - e, 0); }
        const wS = cw * -F.Fy;
        const dT = ct * F.Fy;
        const ys = ps.target + dT - wS;
        for (let i = rng.i0; i <= rng.i1; i++) {
          const c = cellIndex(stock, i, k);
          const cur = faceArr[c];
          const has = ps.face === 'front' ? cur < ys : cur > ys;
          if (!has) continue;
          sleMin = Math.min(sleMin, e); sleMax = Math.max(sleMax, e);
          removed += Math.abs(ys - cur) * stock.dx * stock.dz;
          faceArr[c] = ys;
          idx.push(c); val.push(ys);
        }
      }

      // (d) force over one revolution at the effective engagement (feed frame → global)
      const ae = aeNom;
      const cp = cutParamsFor(p, aeEffMid, b);
      const sig = forceSignal(cp, p.rpm, 120);
      const st = signalStats(sig);
      let peakFYf = 0;
      for (let q = 0; q < sig.Fy.length; q++) if (Math.abs(sig.Fy[q]) > Math.abs(peakFYf)) peakFYf = sig.Fy[q];
      const meanF = feedToGlobal(st.mean, ps.feedSign);
      const peakFY = ps.feedSign * peakFYf;
      if (!isFinite(sleMin)) { sleMin = 0; sleMax = 0; }
      removedTotal += removed;
      const dist = si === 0 ? 0 : step;
      time += vf > 0 ? (dist / vf) * 60 : 0;

      stations.push({
        pass: pi, x, ae, aeEff: aeEffMid, b, zTip: ps.zBot, meanF,
        peakResultant: st.peakResultant, meanResultant: st.meanResultant, peakFY, Fs, wUnit,
        wallDeflPeak: wUnitMax * Math.abs(peakFY),
        toolDeflPeak: Math.abs(toolDeflectionAt(tool, peakFY, ps.zBot, ps.zTop - ps.zBot, ps.zBot)),
        sleMin, sleMax, removed, time,
        edit: { face: ps.face, idx: Int32Array.from(idx), val: Float32Array.from(val) },
        patch: { x0: px0, x1: px1 },
      });
    }
    pass.lastStation = stations.length - 1;
    passes.push(pass);
  }

  // ---------------- summary ----------------
  let devMin = Infinity, devMax = -Infinity, devSum = 0, inTol = 0;
  for (let c = 0; c < stock.front.length; c++) {
    const d = stock.back[c] - stock.front[c] - p.wallThickness;
    devMin = Math.min(devMin, d); devMax = Math.max(devMax, d); devSum += d;
    if (Math.abs(d) <= p.tolerance + 1e-9) inTol++;
  }
  const finishSt = stations.filter((s) => passes[s.pass].kind === 'finish' && s.ae > 0);
  const vol1 = stockVolume(stock);
  const ftp = toothPassingFrequency(p.rpm, p.N);
  const minF1 = Math.min(...passes.map((q) => q.f1));
  const warnings: string[] = [];
  if (p.overhang < p.wallHeight + 2)
    warnings.push(`Tool overhang (${p.overhang} mm) is shorter than wall height + 2 mm clearance: the holder would collide with the wall at the lowest level.`);
  if (p.overhang / p.D > 4) warnings.push(`Overhang-to-diameter ratio L/D = ${(p.overhang / p.D).toFixed(1)} > 4: tool deflection and chatter risk grow rapidly (δ ∝ L³).`);
  if (p.aeFinish >= p.D / 2) warnings.push('Radial depth ≥ tool radius: this is no longer a light peripheral finishing cut.');
  const vcNow = (Math.PI * p.D * p.rpm) / 1000;
  if (vcNow < mat.vcRange[0] || vcNow > mat.vcRange[1])
    warnings.push(`Cutting speed ${vcNow.toFixed(0)} m/min is outside the indicative range ${mat.vcRange[0]}–${mat.vcRange[1]} m/min for ${mat.name}.`);
  const ratio = ftp / minF1;
  if (ratio > 0.3)
    warnings.push(`Tooth-passing frequency is ${(ratio * 100).toFixed(0)} % of the wall's first natural frequency: dynamic amplification is likely, so the quasi-static prediction underestimates vibration. Use the Chatter module (planned) for dynamic analysis.`);
  if (p.coeffSource !== 'calibrated')
    warnings.push(`Cutting coefficients are ${p.coeffSource}; force and error magnitudes are estimates, not validated predictions.`);

  const summary: SimSummary = {
    feedRate: vf,
    ftp,
    vc: vcNow,
    nominalMRR: p.aeFinish * p.ap * vf,
    averageMRR: time > 0 ? (removedTotal / time) * 60 : 0,
    cycleTime: time,
    initialThickness: T0,
    removedVolume: removedTotal,
    volumeBalanceError: vol0 - vol1 - removedTotal,
    peakResultant: Math.max(0, ...stations.map((s) => s.peakResultant)),
    meanResultantFinish: finishSt.length ? finishSt.reduce((a, s) => a + s.meanResultant, 0) / finishSt.length : 0,
    maxWallDefl: Math.max(0, ...stations.map((s) => s.wallDeflPeak)),
    maxToolDefl: Math.max(0, ...stations.map((s) => s.toolDeflPeak)),
    minF1,
    dynamicRatio: ratio,
    devMin, devMax, devMean: devSum / stock.front.length,
    inTolFraction: inTol / stock.front.length,
    toolStiffness: toolStiffnessAtLoad(tool, p.overhang - p.ap / 2),
    warnings,
  };

  return { params: p, mesh, passes, stations, stock0, stockFinal: stock, summary };
}

/** Rebuild the stock state after `upToStation` (inclusive) from the initial stock and edits. */
export function stockAt(res: SimResult, upToStation: number, target?: StockGrid): StockGrid {
  const s = target ?? cloneStock(res.stock0);
  if (target) { s.front.set(res.stock0.front); s.back.set(res.stock0.back); }
  applyEdits(res, s, 0, upToStation);
  return s;
}

export function applyEdits(res: SimResult, s: StockGrid, from: number, to: number) {
  for (let q = from; q <= to && q < res.stations.length; q++) {
    const e = res.stations[q].edit;
    const arr = e.face === 'front' ? s.front : s.back;
    for (let j = 0; j < e.idx.length; j++) arr[e.idx[j]] = e.val[j];
  }
}
