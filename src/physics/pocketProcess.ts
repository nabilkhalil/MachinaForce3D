/**
 * Module 2 — Tool bending in deep-pocket side-wall finishing.
 *
 * Geometry (machine frame): the pocket side wall is the plane Y = 0 with solid material at
 * +Y (a thick, rigid block); the pocket (air) is at −Y; the pocket floor is Z = 0 and the
 * pocket top is Z = H. The tool works from the −Y side and finishes the wall, so this is the
 * "front face" case of Module 1 with n = +1.
 *
 * Here the WORKPIECE IS RIGID and the TOOL (plus holder/spindle) is the compliant element:
 *   e(z) = −g(z) · FY · n,   with   e = g·F(ae − e)  solved per height (same coupling as Module 1)
 * where g(z) is the tool deflection at height z per newton of cutting force distributed over
 * the engaged flute length (stepped-cantilever + holder springs, toolBeam.ts).
 *
 * Wall deviation d (mm) = material left relative to the nominal wall Y = 0:
 *   d = −y_face   (positive = wall stands proud / undercut, negative = overcut)
 */
import { MATERIALS, type CoeffSource, type CuttingCoefficients, type MaterialId } from './materials';
import {
  cutterForce, engagementAngles, feedRate, feedToGlobal, forceSignal, helixLag, signalStats, toothPassingFrequency,
  type CutParams, type ForceVector, type MillingMode,
} from './millingForce';
import { cellIndex, cellRange, cloneStock, createStock, stockVolume, type StockGrid } from './stock';
import {
  BEAM_NODES, CARBIDE_TRS, beamGrid, beamResponse, sampleBeam, toolNaturalFrequency, uniformBandLoads,
  type BeamGrid, type ToolSpec,
} from './toolBeam';
import type { StockEdit } from './process';

export type PocketStrategy = 'full-depth' | 'step-down' | 'spring-pass' | 'compensated';

export const POCKET_STRATEGY_INFO: Record<PocketStrategy, { name: string; text: string }> = {
  'full-depth': {
    name: 'Single full-depth flank pass',
    text: 'One finishing pass with the whole wall depth engaged (needs flutes at least as long as the pocket is deep). Large engaged length → large force, and the tool tip bends most.',
  },
  'step-down': {
    name: 'Constant-Z step-down',
    text: 'Finish the wall in Z-levels of depth ap from the top down. Smaller force per level, but each level is cut with the tool tip at a different reach.',
  },
  'spring-pass': {
    name: 'Step-down + spring pass',
    text: 'Repeat each level at the same programmed position. The second pass only meets the material left by deflection, so its force — and its error — is much smaller.',
  },
  compensated: {
    name: 'Step-down with deflection compensation',
    text: 'Offset each level’s toolpath into the wall by the error predicted for that level by an uncompensated simulation (model-based compensation). Corrects the mean error, not the taper within a level.',
  },
};

export interface PocketParams {
  materialId: MaterialId;
  coeffs: CuttingCoefficients;
  coeffSource: CoeffSource;
  rpm: number;
  N: number;
  fz: number;
  D: number;
  helixDeg: number;
  overhang: number;
  fluteLength: number;
  neck: boolean;
  neckDiameter: number;
  neckLength: number;
  holderRigid: boolean;
  /** N/mm */
  holderKT: number;
  /** N·mm/rad */
  holderKR: number;
  pocketDepth: number;
  wallLength: number;
  aeFinish: number;
  ap: number;
  strategy: PocketStrategy;
  mode: MillingMode;
  /** ± tolerance on wall position (profile), mm */
  tolerance: number;
  stationStep: number;
}

export const DEFAULT_POCKET: PocketParams = {
  materialId: 'aisi1045',
  coeffs: { ...MATERIALS.aisi1045.coeffs },
  coeffSource: 'illustrative',
  rpm: 5000,
  N: 4,
  fz: 0.04,
  D: 10,
  helixDeg: 35,
  overhang: 60,
  fluteLength: 22,
  neck: true,
  neckDiameter: 9.4,
  neckLength: 30,
  holderRigid: false,
  holderKT: 30_000,
  holderKR: 5e7,
  pocketDepth: 50,
  wallLength: 60,
  aeFinish: 0.3,
  ap: 10,
  strategy: 'step-down',
  mode: 'down',
  tolerance: 0.03,
  stationStep: 2,
};

export interface PocketPass {
  index: number;
  kind: 'finish' | 'spring';
  zTop: number;
  zBot: number;
  /** programmed face position (Y); 0 = nominal, > 0 = compensated into the wall */
  target: number;
  feedSign: 1 | -1;
  firstStation: number;
  lastStation: number;
  /** tool deflection along the tool (from holder face) per 1 N spread over this level's band */
  unitDelta: Float32Array;
  unitMoment: Float32Array;
  unitStress: Float32Array;
}

export interface PocketStation {
  pass: number;
  x: number;
  ae: number;
  aeEff: number;
  b: number;
  meanF: ForceVector;
  peakResultant: number;
  meanResultant: number;
  peakFY: number;
  /** peak in-plane (XY) force magnitude over a revolution — bends the tool */
  peakFxy: number;
  Fs: ForceVector;
  sleMin: number;
  sleMax: number;
  tipDeflPeak: number;
  stressPeak: number;
  removed: number;
  time: number;
  edit: StockEdit;
}

export interface PocketSummary {
  feedRate: number;
  ftp: number;
  vc: number;
  nominalMRR: number;
  averageMRR: number;
  cycleTime: number;
  removedVolume: number;
  volumeBalanceError: number;
  peakResultant: number;
  maxTipDefl: number;
  maxStress: number;
  stressRatio: number; // maxStress / TRS
  toolTipStiffness: number; // N/mm, point load at tip
  holderShare: number; // fraction of tip compliance from holder/spindle
  toolF1: number;
  dynamicRatio: number;
  devMin: number;
  devMax: number;
  devMean: number;
  /** max over X of (max − min deviation along Z): profile/perpendicularity-type form error */
  formError: number;
  /** mean deviation at the top row minus at the bottom row (taper over the wall depth) */
  taper: number;
  inTolFraction: number;
  compensation: number[]; // per level offsets applied (mm)
  warnings: string[];
}

export interface PocketResult {
  params: PocketParams;
  grid: BeamGrid;
  passes: PocketPass[];
  stations: PocketStation[];
  stock0: StockGrid;
  stockFinal: StockGrid;
  summary: PocketSummary;
}

export function toolSpecOf(p: PocketParams): ToolSpec {
  return {
    D: p.D, overhang: p.overhang, fluteLength: p.fluteLength, neck: p.neck, neckDiameter: p.neckDiameter, neckLength: p.neckLength,
    holder: { rigid: p.holderRigid, kT: p.holderKT, kR: p.holderKR },
  };
}

export function pocketCutParams(p: PocketParams, ae: number, b: number): CutParams {
  return { D: p.D, N: p.N, fz: p.fz, b, ae, mode: p.mode, K: p.coeffs, helixDeg: p.helixDeg, dz: 0.5 };
}

function levels(p: PocketParams) {
  if (p.strategy === 'full-depth') return [{ zTop: p.pocketDepth, zBot: 0 }];
  const out: { zTop: number; zBot: number }[] = [];
  for (let zTop = p.pocketDepth; zTop > 1e-9; zTop -= p.ap) out.push({ zTop, zBot: Math.max(0, zTop - p.ap) });
  return out;
}

/** Wall deviation (material left, mm) of a stock cell. */
export const wallDev = (s: StockGrid, c: number) => -s.front[c];

export function simulatePocket(p: PocketParams, compensation?: number[]): PocketResult {
  // model-based compensation: first run uncompensated, then offset each level by its mean error
  if (p.strategy === 'compensated' && !compensation) {
    const base = simulatePocket({ ...p, strategy: 'step-down' });
    const lv = levels(p);
    const s = base.stockFinal;
    const comp = lv.map((l) => {
      const r = cellRange(s, 0, p.wallLength, l.zBot, l.zTop);
      let sum = 0, n = 0;
      for (let k = r.k0; k <= r.k1; k++) for (let i = r.i0; i <= r.i1; i++) { sum += wallDev(s, cellIndex(s, i, k)); n++; }
      return n ? sum / n : 0;
    });
    return simulatePocket(p, comp);
  }

  const mat = MATERIALS[p.materialId];
  const tool = toolSpecOf(p);
  const grid = beamGrid(tool);
  const stock = createStock(p.wallLength, p.pocketDepth, 1);
  stock.front.fill(-p.aeFinish);
  stock.back.fill(40); // rigid block behind the wall
  const stock0 = cloneStock(stock);
  const vol0 = stockVolume(stock);
  const vf = feedRate(p.rpm, p.N, p.fz);
  const feedSign: 1 | -1 = p.mode === 'up' ? 1 : -1; // front-face case (material at +Y)
  const lv = levels(p);
  const plan: { kind: 'finish' | 'spring'; zTop: number; zBot: number; target: number }[] = [];
  lv.forEach((l, li) => {
    const target = compensation ? compensation[li] ?? 0 : 0;
    plan.push({ kind: 'finish', ...l, target });
    if (p.strategy === 'spring-pass') plan.push({ kind: 'spring', ...l, target });
  });

  const nSt = Math.max(2, Math.round(p.wallLength / p.stationStep) + 1);
  const step = p.wallLength / (nSt - 1);
  const passes: PocketPass[] = [];
  const stations: PocketStation[] = [];
  let time = 0, removedTotal = 0;
  const L = p.overhang;

  for (let pi = 0; pi < plan.length; pi++) {
    const ps = plan[pi];
    const band = ps.zTop - ps.zBot;
    // unit load spread over the engaged flute length; tool tip at zBot ⇒ s = L − (z − zBot)
    const unit = beamResponse(tool, grid, uniformBandLoads(L - band, L));
    const pass: PocketPass = {
      index: pi, kind: ps.kind, zTop: ps.zTop, zBot: ps.zBot, target: ps.target, feedSign,
      firstStation: stations.length, lastStation: -1,
      unitDelta: Float32Array.from(unit.delta), unitMoment: Float32Array.from(unit.moment), unitStress: Float32Array.from(unit.stress),
    };
    let unitStressMax = 0;
    for (let i = 0; i < unit.stress.length; i++) unitStressMax = Math.max(unitStressMax, unit.stress[i]);
    const unitTip = unit.delta[BEAM_NODES - 1];

    for (let si = 0; si < nSt; si++) {
      const x = feedSign === 1 ? si * step : p.wallLength - si * step;
      const rng = cellRange(stock, Math.max(0, x - step / 2), Math.min(p.wallLength, x + step / 2), ps.zBot, ps.zTop);
      const rowAe: number[] = [];
      let nMat = 0;
      for (let k = rng.k0; k <= rng.k1; k++) {
        let sum = 0, cnt = 0;
        for (let i = rng.i0; i <= rng.i1; i++) {
          const d = ps.target - stock.front[cellIndex(stock, i, k)];
          if (d > 1e-6) { sum += d; cnt++; }
        }
        const a = cnt ? Math.min(sum / cnt, p.D) : 0;
        rowAe.push(a);
        if (a > 0) nMat++;
      }
      const b = rowAe.length ? (band * nMat) / rowAe.length : 0;
      const aeNom = nMat ? rowAe.reduce((u, v) => u + v, 0) / nMat : 0;

      const idx: number[] = [], val: number[] = [];
      let sleMin = Infinity, sleMax = -Infinity, removed = 0;
      let Fs: ForceVector = { Fx: 0, Fy: 0, Fz: 0 };
      let aeEffMid = aeNom;
      const kMid = Math.round((rng.k0 + rng.k1) / 2);
      for (let k = rng.k0; k <= rng.k1; k++) {
        const aeK = rowAe[k - rng.k0];
        if (aeK <= 0) continue;
        const z = (k + 0.5) * stock.dz;
        const g = sampleBeam(grid, unit.delta, L - (z - ps.zBot)); // mm per N
        const lag = helixLag(p.D, p.helixDeg, z - ps.zBot);
        const forceAt = (aeEff: number): ForceVector => {
          if (aeEff <= 1e-9) return { Fx: 0, Fy: 0, Fz: 0 };
          const { phiSt, phiEx } = engagementAngles(p.D, Math.min(aeEff, p.D), p.mode);
          const phiS = p.mode === 'up' ? phiSt : phiEx;
          return feedToGlobal(cutterForce(phiS + lag, pocketCutParams(p, Math.min(aeEff, p.D), b)).F, feedSign);
        };
        const errAt = (e: number) => { const F = forceAt(aeK - e); return { g: e + g * F.Fy, F }; }; // n = +1
        let lo = -aeK, hi = aeK;
        const rLo = errAt(lo), rHi = errAt(hi);
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
        const ys = ps.target + g * F.Fy; // generated surface (tool deflects by g·FY)
        for (let i = rng.i0; i <= rng.i1; i++) {
          const c = cellIndex(stock, i, k);
          const cur = stock.front[c];
          if (cur >= ys) continue;
          const dev = -ys;
          sleMin = Math.min(sleMin, dev); sleMax = Math.max(sleMax, dev);
          removed += (ys - cur) * stock.dx * stock.dz;
          stock.front[c] = ys;
          idx.push(c); val.push(ys);
        }
      }
      if (!isFinite(sleMin)) { sleMin = 0; sleMax = 0; }

      const sig = forceSignal(pocketCutParams(p, aeEffMid, b), p.rpm, 120);
      const st = signalStats(sig);
      let peakFYf = 0, peakFxy = 0;
      for (let q = 0; q < sig.Fy.length; q++) {
        if (Math.abs(sig.Fy[q]) > Math.abs(peakFYf)) peakFYf = sig.Fy[q];
        peakFxy = Math.max(peakFxy, Math.hypot(sig.Fx[q], sig.Fy[q]));
      }
      removedTotal += removed;
      time += si === 0 || vf <= 0 ? 0 : (step / vf) * 60;
      stations.push({
        pass: pi, x, ae: aeNom, aeEff: aeEffMid, b,
        meanF: feedToGlobal(st.mean, feedSign), peakResultant: st.peakResultant, meanResultant: st.meanResultant,
        peakFY: feedSign * peakFYf, peakFxy, Fs, sleMin, sleMax,
        tipDeflPeak: unitTip * peakFxy, stressPeak: unitStressMax * peakFxy,
        removed, time, edit: { face: 'front', idx: Int32Array.from(idx), val: Float32Array.from(val) },
      });
    }
    pass.lastStation = stations.length - 1;
    passes.push(pass);
  }

  // ---------------- summary ----------------
  const s = stock;
  let devMin = Infinity, devMax = -Infinity, devSum = 0, inTol = 0, formError = 0;
  for (let c = 0; c < s.front.length; c++) {
    const d = wallDev(s, c);
    devMin = Math.min(devMin, d); devMax = Math.max(devMax, d); devSum += d;
    if (Math.abs(d) <= p.tolerance + 1e-9) inTol++;
  }
  for (let i = 0; i < s.nxC; i++) {
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k < s.nzC; k++) { const d = wallDev(s, cellIndex(s, i, k)); lo = Math.min(lo, d); hi = Math.max(hi, d); }
    formError = Math.max(formError, hi - lo);
  }
  const rowMean = (k: number) => { let m = 0; for (let i = 0; i < s.nxC; i++) m += wallDev(s, cellIndex(s, i, k)); return m / s.nxC; };
  const tipUnit = beamResponse(tool, grid, [{ a: L, P: 1 }]);
  const rigidTip = beamResponse({ ...tool, holder: { rigid: true, kT: 1, kR: 1 } }, grid, [{ a: L, P: 1 }]);
  const tipC = tipUnit.delta[BEAM_NODES - 1];
  const toolF1 = toolNaturalFrequency(tool, grid);
  const ftp = toothPassingFrequency(p.rpm, p.N);
  const maxStress = Math.max(0, ...stations.map((q) => q.stressPeak));
  const vc = (Math.PI * p.D * p.rpm) / 1000;
  const warnings: string[] = [];
  const zMinTip = Math.min(...passes.map((q) => q.zBot));
  if (p.overhang < p.pocketDepth - zMinTip + 2)
    warnings.push(`Overhang ${p.overhang} mm is less than pocket depth + 2 mm: the holder would hit the top of the pocket.`);
  const maxBand = Math.max(...passes.map((q) => q.zTop - q.zBot));
  if (maxBand > p.fluteLength + 1e-9)
    warnings.push(`Engaged length ${maxBand.toFixed(1)} mm exceeds the flute length ${p.fluteLength} mm: the neck/shank would rub the wall. Use step-down or a longer-flute tool.`);
  if (p.neck && p.neckDiameter >= p.D) warnings.push('Neck diameter must be smaller than the cutting diameter to clear the finished wall.');
  if (!p.neck && p.overhang - p.fluteLength > 2)
    warnings.push('No neck relief: in practice the shank behind the flutes would rub a deep finished wall. Long-reach tools use a reduced neck.');
  if (p.overhang / p.D > 4) warnings.push(`L/D = ${(p.overhang / p.D).toFixed(1)}: deflection grows with L³ — expect form error and chatter risk.`);
  if (maxStress / CARBIDE_TRS > 0.3)
    warnings.push(`Peak static bending stress ${maxStress.toFixed(0)} MPa is ${((maxStress / CARBIDE_TRS) * 100).toFixed(0)} % of the carbide rupture strength: breakage risk under impact/fatigue.`);
  if (vc < mat.vcRange[0] || vc > mat.vcRange[1])
    warnings.push(`Cutting speed ${vc.toFixed(0)} m/min is outside the indicative ${mat.vcRange[0]}–${mat.vcRange[1]} m/min for ${mat.name}.`);
  if (ftp / toolF1 > 0.3)
    warnings.push(`Tooth-passing frequency is ${((ftp / toolF1) * 100).toFixed(0)} % of the tool's first bending frequency: the static prediction may underestimate vibration (see Chatter module, planned).`);
  if (p.coeffSource !== 'calibrated') warnings.push(`Cutting coefficients are ${p.coeffSource}; results are estimates.`);

  return {
    params: p, grid, passes, stations, stock0, stockFinal: stock,
    summary: {
      feedRate: vf, ftp, vc,
      nominalMRR: p.aeFinish * (p.strategy === 'full-depth' ? p.pocketDepth : p.ap) * vf,
      averageMRR: time > 0 ? (removedTotal / time) * 60 : 0,
      cycleTime: time, removedVolume: removedTotal, volumeBalanceError: vol0 - stockVolume(stock) - removedTotal,
      peakResultant: Math.max(0, ...stations.map((q) => q.peakResultant)),
      maxTipDefl: Math.max(0, ...stations.map((q) => q.tipDeflPeak)),
      maxStress, stressRatio: maxStress / CARBIDE_TRS,
      toolTipStiffness: 1 / tipC,
      holderShare: p.holderRigid ? 0 : 1 - rigidTip.delta[BEAM_NODES - 1] / tipC,
      toolF1, dynamicRatio: ftp / toolF1,
      devMin, devMax, devMean: devSum / s.front.length,
      formError, taper: rowMean(s.nzC - 1) - rowMean(0),
      inTolFraction: inTol / s.front.length,
      compensation: compensation ?? [],
      warnings,
    },
  };
}

export function pocketStockAt(res: PocketResult, upTo: number, target?: StockGrid): StockGrid {
  const s = target ?? cloneStock(res.stock0);
  if (target) { s.front.set(res.stock0.front); s.back.set(res.stock0.back); }
  for (let q = 0; q <= upTo && q < res.stations.length; q++) {
    const e = res.stations[q].edit;
    for (let j = 0; j < e.idx.length; j++) s.front[e.idx[j]] = e.val[j];
  }
  return s;
}
