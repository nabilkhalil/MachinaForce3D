/**
 * Module 6 — Tool wear evolution and cutting force in CNC end milling.
 *
 * Flank wear VB (mm) enters the mechanistic model (millingForce.ts) through the EDGE (ploughing /
 * rubbing) coefficients, which grow linearly with the wear-land width:
 *   Kte(VB) = Kte0 + ate·VB,  Kre(VB) = Kre0 + are·VB,  Kae(VB) = Kae0 + aae·VB
 * Units: K·e in N/mm (force per unit cutting-edge length), a·e in N/mm² (= N/mm per mm of VB).
 * The cutting (shearing) coefficients Ktc, Krc, Kac are kept at their fresh values. The wear
 * coefficients are ILLUSTRATIVE until fitted to measured force-vs-VB data.
 *
 * VB is set manually (authoritative input). An optional, illustrative wear-RATE model gives VB(t):
 *   dVB/dt = A·(vc/vref)^p·(fz/fref)^q   (constant rate for given conditions → VB = VB0 + rate·t)
 * It is a teaching device, not a validated tool-life prediction (no Taylor equation is applied).
 */
import { MATERIALS, type CoeffSource, type CuttingCoefficients, type MaterialId } from './materials';
import { cutterForce, forceSignal, signalStats, TWO_PI, type CutParams, type ForceVector, type MillingMode } from './millingForce';

export interface WearCoefficients {
  /** tangential edge-coefficient growth, N/mm² */
  ate: number;
  /** radial edge-coefficient growth, N/mm² */
  are: number;
  /** axial edge-coefficient growth, N/mm² */
  aae: number;
}

export interface ToolWearParams {
  materialId: MaterialId;
  coeffs: CuttingCoefficients; // fresh tool
  coeffSource: CoeffSource;
  wear: WearCoefficients;
  wearSource: 'illustrative' | 'user-defined' | 'calibrated';
  D: number;
  N: number;
  helixDeg: number;
  vc: number; // m/min
  fz: number; // mm/tooth
  ap: number; // axial depth, mm
  ae: number; // radial engagement, mm
  mode: MillingMode;
  /** manual flank wear, mm (authoritative when growth mode is off) */
  VB: number;
  /** replacement criterion (uniform flank wear), mm */
  VBcrit: number;
  growthMode: boolean;
  VB0: number; // initial wear at t = 0, mm
  A: number; // mm/min at vref, fref
  vref: number;
  fref: number;
  p: number;
  q: number;
  // production planning
  partLength: number; // cutting path per part, mm
  batch: number; // parts
  toolChange: number; // min per tool change
  spindlePower: number; // kW
}

/** Illustrative wear-coefficient defaults, scaled from the fresh edge coefficients. */
export function defaultWear(id: MaterialId): WearCoefficients {
  const k = MATERIALS[id].coeffs;
  return { ate: 4 * k.Kte, are: 5 * k.Kre, aae: 4 * k.Kae };
}

export const DEFAULT_TOOLWEAR: ToolWearParams = {
  materialId: 'ti64',
  coeffs: { ...MATERIALS.ti64.coeffs },
  coeffSource: 'illustrative',
  wear: defaultWear('ti64'),
  wearSource: 'illustrative',
  D: 12,
  N: 4,
  helixDeg: 30,
  vc: 60,
  fz: 0.05,
  ap: 10,
  ae: 1.2,
  mode: 'down',
  VB: 0.15,
  VBcrit: 0.3,
  growthMode: false,
  VB0: 0,
  A: 0.01,
  vref: 60,
  fref: 0.05,
  p: 3,
  q: 1,
  partLength: 600,
  batch: 40,
  toolChange: 6,
  spindlePower: 7.5,
};

/** ISO 8688-2 commonly used end-milling tool-life criteria (test standard, not a shop rule). */
export const ISO_VB_UNIFORM = 0.3;
export const ISO_VB_MAX = 0.5;

/** Edge coefficients at wear VB (never negative). */
export function wornCoefficients(K: CuttingCoefficients, VB: number, w: WearCoefficients): CuttingCoefficients {
  const v = Math.max(VB, 0);
  return {
    ...K,
    Kte: Math.max(K.Kte + w.ate * v, 0),
    Kre: Math.max(K.Kre + w.are * v, 0),
    Kae: Math.max(K.Kae + w.aae * v, 0),
  };
}

export const spindleSpeed = (p: Pick<ToolWearParams, 'vc' | 'D'>) => (1000 * p.vc) / (Math.PI * p.D);

export function wearCutParams(p: ToolWearParams, VB: number): CutParams {
  return { D: p.D, N: p.N, fz: p.fz, b: p.ap, ae: p.ae, mode: p.mode, K: wornCoefficients(p.coeffs, VB, p.wear), helixDeg: p.helixDeg, dz: 0.5 };
}

export interface WearState {
  VB: number;
  K: CuttingCoefficients;
  mean: ForceVector; // N, on the tool, feed frame
  meanRes: number; // N
  peakRes: number; // N
  torque: number; // mean spindle torque, N·m
  power: number; // mean cutting power, kW
  energy: number; // specific cutting energy, J/mm³
}

/**
 * Forces, torque, power and specific energy at wear VB over one revolution.
 * Torque from the tangential tooth forces: T = R·ΣFt; P = T·ω.  u = P / MRR (J/mm³ = W·s/mm³).
 */
export function wearState(p: ToolWearParams, VB: number, samples = 180): WearState {
  const cp = wearCutParams(p, VB);
  const rpm = spindleSpeed(p);
  const st = signalStats(forceSignal(cp, rpm, samples));
  let Tsum = 0;
  for (let i = 0; i < samples; i++) {
    const { teeth } = cutterForce((i / samples) * TWO_PI, cp);
    for (const t of teeth) Tsum += t.Ft;
  }
  const torque = ((Tsum / samples) * (p.D / 2)) / 1000; // N·m
  const power = (torque * rpm * TWO_PI) / 60 / 1000; // kW
  const mrr = (p.ae * p.ap * rpm * p.N * p.fz) / 60; // mm³/s
  return { VB, K: cp.K, mean: st.mean, meanRes: Math.hypot(st.mean.Fx, st.mean.Fy, st.mean.Fz), peakRes: st.peakResultant, torque, power, energy: mrr > 0 ? (power * 1000) / mrr : 0 };
}

/** Illustrative wear rate, mm/min. */
export function wearRate(p: Pick<ToolWearParams, 'A' | 'vc' | 'vref' | 'p' | 'fz' | 'fref' | 'q'>): number {
  return Math.max(p.A, 0) * Math.pow(Math.max(p.vc, 0) / p.vref, p.p) * Math.pow(Math.max(p.fz, 0) / p.fref, p.q);
}

export const vbAt = (p: ToolWearParams, tMin: number) => Math.max(p.VB0, 0) + wearRate(p) * Math.max(tMin, 0);

export type ToolCondition = 'fresh' | 'normal' | 'approaching' | 'replace' | 'beyond';
export function toolCondition(VB: number, VBcrit: number): ToolCondition {
  if (VB >= ISO_VB_MAX && VB >= VBcrit) return 'beyond';
  const r = VB / Math.max(VBcrit, 1e-9);
  return r >= 1 ? 'replace' : r >= 0.8 ? 'approaching' : r >= 0.25 ? 'normal' : 'fresh';
}
export const CONDITION_LABEL: Record<ToolCondition, string> = {
  fresh: 'Fresh / running-in', normal: 'Normal wear', approaching: 'Approaching criterion', replace: 'Replace tool (criterion reached)', beyond: `Beyond VBmax ${ISO_VB_MAX} mm`,
};
/** Qualitative surface-roughness RISK (no validated roughness prediction). */
export function roughnessRisk(VB: number, VBcrit: number): 'low' | 'moderate' | 'high' {
  const r = VB / Math.max(VBcrit, 1e-9);
  return r < 0.5 ? 'low' : r < 1 ? 'moderate' : 'high';
}

export interface ProductionPlan {
  rpm: number;
  vf: number; // mm/min
  mrr: number; // mm³/min
  tPart: number; // min
  rate: number; // mm/min
  tLife: number; // min to the criterion (from VB0)
  partsPerTool: number;
  tools: number; // Infinity if a tool cannot finish one part
  changes: number;
  totalTime: number; // min, cutting + tool changes
}

/** Tool replacement plan: change the tool before the part that would take VB past the criterion. */
export function productionPlan(p: ToolWearParams): ProductionPlan {
  const rpm = spindleSpeed(p);
  const vf = rpm * p.N * p.fz;
  const tPart = vf > 0 ? p.partLength / vf : Infinity;
  const rate = wearRate(p);
  const tLife = rate > 0 ? Math.max(p.VBcrit - p.VB0, 0) / rate : Infinity;
  const partsPerTool = Number.isFinite(tLife) ? Math.floor(tLife / tPart + 1e-9) : p.batch;
  const tools = partsPerTool > 0 ? Math.ceil(p.batch / partsPerTool) : Infinity;
  const changes = Number.isFinite(tools) ? Math.max(tools - 1, 0) : Infinity;
  return { rpm, vf, mrr: p.ae * p.ap * vf, tPart, rate, tLife, partsPerTool, tools, changes, totalTime: p.batch * tPart + changes * p.toolChange };
}

export interface TimePoint { t: number; VB: number; meanRes: number; peakRes: number; power: number }

export interface WearResult {
  params: ToolWearParams;
  fresh: WearState;
  manual: WearState;
  atCrit: WearState;
  sweep: WearState[]; // VB = 0 … 0.5 mm
  timeline: TimePoint[]; // growth model, one tool, 0 … horizon
  plan: ProductionPlan;
  ftp: number;
  warnings: string[];
}

export function simulateToolWear(p: ToolWearParams): WearResult {
  const fresh = wearState(p, 0);
  const manual = wearState(p, p.VB);
  const atCrit = wearState(p, p.VBcrit);
  const sweep = Array.from({ length: 26 }, (_, i) => wearState(p, (i / 25) * 0.5, 120));
  const plan = productionPlan(p);
  // timeline to 1.25 × the time to criterion (or to VB = 0.5 mm), 61 points
  const horizon = Number.isFinite(plan.tLife) && plan.tLife > 0 ? Math.min(1.25 * plan.tLife, (0.5 - p.VB0) / Math.max(plan.rate, 1e-12)) : 60;
  const tEnd = Math.max(horizon, 1e-3);
  const timeline: TimePoint[] = Array.from({ length: 61 }, (_, i) => {
    const t = (tEnd * i) / 60;
    const VB = Math.min(vbAt(p, t), 0.5);
    const s = wearState(p, VB, 90);
    return { t, VB, meanRes: s.meanRes, peakRes: s.peakRes, power: s.power };
  });
  const VBnow = p.growthMode ? timeline[timeline.length - 1].VB : p.VB;
  const warnings: string[] = [];
  if (!p.growthMode && p.VB >= p.VBcrit) warnings.push(`VB = ${p.VB.toFixed(2)} mm has reached the replacement criterion (${p.VBcrit.toFixed(2)} mm): replace the tool.`);
  else if (!p.growthMode && p.VB >= 0.8 * p.VBcrit) warnings.push(`VB = ${p.VB.toFixed(2)} mm is within 20 % of the replacement criterion.`);
  if (p.growthMode) warnings.push(`Growth mode: VB reaches the criterion after ${Number.isFinite(plan.tLife) ? plan.tLife.toFixed(1) : '∞'} min of cutting (illustrative rate model, not a validated tool-life prediction).`);
  if (p.VBcrit > ISO_VB_UNIFORM) warnings.push(`The replacement criterion (${p.VBcrit.toFixed(2)} mm) is above the ISO 8688-2 uniform flank-wear criterion of ${ISO_VB_UNIFORM} mm.`);
  if (atCrit.power > p.spindlePower) warnings.push(`At the criterion the cutting power (${atCrit.power.toFixed(2)} kW) exceeds the available spindle power (${p.spindlePower} kW).`);
  if (plan.partsPerTool === 0) warnings.push('One tool cannot finish a single part before reaching the criterion.');
  if (VBnow >= ISO_VB_MAX) warnings.push(`VB ≥ ${ISO_VB_MAX} mm: beyond the ISO 8688-2 localized-wear limit; chipping or edge failure is likely.`);
  if (p.wearSource !== 'calibrated') warnings.push('Wear coefficients (ate, are, aae) and the wear-rate model are illustrative; calibrate them with measured forces and wear before quoting values.');
  return { params: p, fresh, manual, atCrit, sweep, timeline, plan, ftp: (spindleSpeed(p) * p.N) / 60, warnings };
}

/**
 * Least-squares wear coefficients from measured mean forces at several VB values.
 * The mean force is linear in the edge coefficients, so dF/dVB = J·[ate, are, aae] with J the
 * mean-force response to a unit edge coefficient; slopes of measured Fx, Fy, Fz vs VB give the fit.
 */
export function fitWearCoefficients(p: ToolWearParams, data: { VB: number; Fx: number; Fy: number; Fz: number }[]): WearCoefficients | null {
  if (data.length < 2) return null;
  const n = data.length, mv = data.reduce((a, d) => a + d.VB, 0) / n;
  const sxx = data.reduce((a, d) => a + (d.VB - mv) ** 2, 0);
  if (sxx <= 0) return null;
  const slope = (k: 'Fx' | 'Fy' | 'Fz') => { const m = data.reduce((a, d) => a + d[k], 0) / n; return data.reduce((a, d) => a + (d.VB - mv) * (d[k] - m), 0) / sxx; };
  const s = [slope('Fx'), slope('Fy'), slope('Fz')];
  const zero: CuttingCoefficients = { Ktc: 0, Krc: 0, Kac: 0, Kte: 0, Kre: 0, Kae: 0 };
  const unit = (k: 'Kte' | 'Kre' | 'Kae') => {
    const st = signalStats(forceSignal({ ...wearCutParams(p, 0), K: { ...zero, [k]: 1 } }, spindleSpeed(p), 360));
    return [st.mean.Fx, st.mean.Fy, st.mean.Fz];
  };
  const J = [unit('Kte'), unit('Kre'), unit('Kae')]; // columns
  // solve 3×3 normal equations (JᵀJ) a = Jᵀ s
  const M = [0, 1, 2].map((i) => [0, 1, 2].map((j) => J[i][0] * J[j][0] + J[i][1] * J[j][1] + J[i][2] * J[j][2]));
  const r = [0, 1, 2].map((i) => J[i][0] * s[0] + J[i][1] * s[1] + J[i][2] * s[2]);
  const det = (m: number[][]) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const d = det(M);
  if (Math.abs(d) < 1e-12) return null;
  const col = (c: number) => det(M.map((row, i) => row.map((v, j) => (j === c ? r[i] : v))));
  return { ate: Math.max(col(0) / d, 0), are: Math.max(col(1) / d, 0), aae: Math.max(col(2) / d, 0) };
}

/** Linear fit of measured VB(t): returns the wear rate (mm/min) and intercept. */
export function fitWearRate(data: { t: number; VB: number }[]): { rate: number; VB0: number } | null {
  if (data.length < 2) return null;
  const n = data.length, mt = data.reduce((a, d) => a + d.t, 0) / n, mv = data.reduce((a, d) => a + d.VB, 0) / n;
  const sxx = data.reduce((a, d) => a + (d.t - mt) ** 2, 0);
  if (sxx <= 0) return null;
  const rate = data.reduce((a, d) => a + (d.t - mt) * (d.VB - mv), 0) / sxx;
  return { rate, VB0: mv - rate * mt };
}
