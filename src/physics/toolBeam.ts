/**
 * Stepped-cantilever model of an end mill in its holder (Module 2).
 *
 * Axial coordinate s runs from the holder face (s = 0) to the tool tip (s = L = overhang).
 * Sections from the holder outward:
 *   shank  : s ∈ [0, L − Lf − Ln]        diameter D (solid)
 *   neck   : s ∈ [L − Lf − Ln, L − Lf]   diameter dn (reduced-neck / long-reach tools only)
 *   flutes : s ∈ [L − Lf, L]             effective diameter 0.8·D (fluted cross-section)
 * Holder + spindle compliance at the holder face: translational spring kT (N/mm) and
 * rotational spring kR (N·mm/rad). Rigid holder = both infinite.
 *
 * Euler–Bernoulli bending, small deflection. The deflection under any set of transverse point
 * loads is obtained by integrating curvature M/EI twice (trapezoidal rule on a fine grid), with
 * the holder springs as boundary conditions:
 *   θ(0) = M0 / kR,   δ(0) = V0 / kT,   M0 = Σ P·a,   V0 = Σ P.
 * The model is linear, so results for a unit load are stored and scaled by the cutting force.
 */
import { CARBIDE_E, FLUTE_DIAMETER_FACTOR } from './materials';

export interface HolderModel {
  rigid: boolean;
  /** translational stiffness at the holder face, N/mm */
  kT: number;
  /** rotational stiffness at the holder face, N·mm/rad */
  kR: number;
}

export interface ToolSpec {
  D: number;
  overhang: number;
  fluteLength: number;
  /** reduced neck between flutes and shank */
  neck: boolean;
  neckDiameter: number;
  /** neck length measured from the end of the flutes toward the holder, mm */
  neckLength: number;
  E?: number;
  holder: HolderModel;
}

/** Carbide density, kg/m³ (nominal) */
export const CARBIDE_RHO = 14_500;
/** Indicative transverse rupture strength of cemented carbide, MPa (grade-dependent; ~3000–4500). */
export const CARBIDE_TRS = 3500;

export const BEAM_NODES = 241;

export interface Section {
  name: 'shank' | 'neck' | 'flutes';
  s0: number;
  s1: number;
  /** diameter used for bending stiffness, mm */
  dEff: number;
  /** outer diameter used for stress (extreme fibre), mm */
  dOuter: number;
}

export function toolSections(t: ToolSpec): Section[] {
  const L = t.overhang;
  const Lf = Math.min(t.fluteLength, L);
  const sF = L - Lf;
  const out: Section[] = [];
  if (t.neck) {
    const Ln = Math.max(0, Math.min(t.neckLength, L - Lf));
    const sN = sF - Ln;
    if (sN > 0) out.push({ name: 'shank', s0: 0, s1: sN, dEff: t.D, dOuter: t.D });
    if (Ln > 0) out.push({ name: 'neck', s0: Math.max(0, sN), s1: sF, dEff: t.neckDiameter, dOuter: t.neckDiameter });
  } else if (sF > 0) {
    out.push({ name: 'shank', s0: 0, s1: sF, dEff: t.D, dOuter: t.D });
  }
  out.push({ name: 'flutes', s0: sF, s1: L, dEff: FLUTE_DIAMETER_FACTOR * t.D, dOuter: FLUTE_DIAMETER_FACTOR * t.D });
  return out;
}

export interface BeamGrid {
  s: Float64Array;
  EI: Float64Array;
  I: Float64Array;
  c: Float64Array; // extreme-fibre distance
  area: Float64Array;
}

export function beamGrid(t: ToolSpec, n = BEAM_NODES): BeamGrid {
  const E = t.E ?? CARBIDE_E;
  const secs = toolSections(t);
  const s = new Float64Array(n), EI = new Float64Array(n), I = new Float64Array(n), c = new Float64Array(n), area = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const si = (i / (n - 1)) * t.overhang;
    s[i] = si;
    const sec = secs.find((q) => si >= q.s0 - 1e-9 && si <= q.s1 + 1e-9) ?? secs[secs.length - 1];
    I[i] = (Math.PI * sec.dEff ** 4) / 64;
    EI[i] = E * I[i];
    c[i] = sec.dOuter / 2;
    area[i] = (Math.PI * sec.dEff ** 2) / 4;
  }
  return { s, EI, I, c, area };
}

export interface BeamResponse {
  delta: Float64Array; // mm
  theta: Float64Array; // rad
  moment: Float64Array; // N·mm
  stress: Float64Array; // MPa (bending, extreme fibre)
}

/** Response to point loads P_j (N) at axial positions a_j (mm from the holder face). */
export function beamResponse(t: ToolSpec, g: BeamGrid, loads: { a: number; P: number }[]): BeamResponse {
  const n = g.s.length;
  const M = new Float64Array(n), th = new Float64Array(n), d = new Float64Array(n), sig = new Float64Array(n);
  let V0 = 0, M0 = 0;
  for (const l of loads) { V0 += l.P; M0 += l.P * l.a; }
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (const l of loads) if (l.a > g.s[i]) m += l.P * (l.a - g.s[i]);
    M[i] = m;
    sig[i] = (m * g.c[i]) / g.I[i];
  }
  const rigid = t.holder.rigid;
  th[0] = rigid ? 0 : M0 / t.holder.kR;
  d[0] = rigid ? 0 : V0 / t.holder.kT;
  for (let i = 1; i < n; i++) {
    const ds = g.s[i] - g.s[i - 1];
    th[i] = th[i - 1] + 0.5 * ds * (M[i - 1] / g.EI[i - 1] + M[i] / g.EI[i]);
    d[i] = d[i - 1] + 0.5 * ds * (th[i - 1] + th[i]);
  }
  return { delta: d, theta: th, moment: M, stress: sig };
}

/** Unit total load (1 N) distributed uniformly over the axial band [s0, s1]. */
export function uniformBandLoads(s0: number, s1: number, pieces = 24, total = 1): { a: number; P: number }[] {
  const out: { a: number; P: number }[] = [];
  for (let k = 0; k < pieces; k++) out.push({ a: s0 + ((k + 0.5) / pieces) * (s1 - s0), P: total / pieces });
  return out;
}

/** Linear interpolation of a nodal field at axial position s. */
export function sampleBeam(g: BeamGrid, f: ArrayLike<number>, s: number): number {
  const n = g.s.length;
  const L = g.s[n - 1];
  const x = (Math.min(Math.max(s, 0), L) / L) * (n - 1);
  const i = Math.min(Math.floor(x), n - 2);
  const u = x - i;
  return f[i] * (1 - u) + f[i + 1] * u;
}

/**
 * First bending natural frequency (Hz), Rayleigh's method with the static deflection
 * shape under the tool's own (lumped) weight; includes the holder springs.
 */
export function toolNaturalFrequency(t: ToolSpec, g: BeamGrid, rho = CARBIDE_RHO): number {
  const n = g.s.length;
  const gAcc = 9810; // mm/s²
  const rhoT = rho * 1e-12; // t/mm³
  const loads: { a: number; P: number }[] = [];
  const mass: number[] = [];
  for (let i = 1; i < n; i++) {
    const ds = g.s[i] - g.s[i - 1];
    const m = rhoT * 0.5 * (g.area[i] + g.area[i - 1]) * ds;
    mass.push(m);
    loads.push({ a: 0.5 * (g.s[i] + g.s[i - 1]), P: m * gAcc });
  }
  const r = beamResponse(t, g, loads);
  let num = 0, den = 0;
  for (let k = 0; k < loads.length; k++) {
    const dk = sampleBeam(g, r.delta, loads[k].a);
    num += mass[k] * gAcc * dk;
    den += mass[k] * dk * dk;
  }
  return Math.sqrt(num / den) / (2 * Math.PI);
}
