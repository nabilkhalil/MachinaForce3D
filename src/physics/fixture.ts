/**
 * Module 5 — Workpiece movement and fixture stiffness in milling.
 *
 * The workpiece is a RIGID block located by a 3-2-1 scheme and held by clamps. Every fixture
 * element is a point contact with
 *   - a normal spring k_n (compression only — a locator or clamp can push but never pull),
 *   - two tangential "stick" springs k_t = r·k_n, limited by Coulomb friction |T| ≤ μ·N.
 * Clamps carry a preload P along their normal.
 *
 * Generalised displacement of the block about its centroid c:  q = (δx, δy, δz, θx, θy, θz),
 * displacement of a point p:  u(p) = δ + θ × (p − c)   (small rotations).
 * A spring of stiffness k along unit vector d at p contributes k·Jᵀ J with J = [d, (p − c) × d].
 *
 * Two load steps:
 *  1. CLAMPING: clamp preloads + gravity, normal springs only (seating; friction released).
 *     → initial normal forces N0 at every locator and clamp.
 *  2. CUTTING: the milling force on the workpiece (−force on the tool, from the Module 1
 *     mechanistic model) is applied at the cutting point; incremental solution with normal and
 *     sticking tangential springs. Active-set iterations remove contacts that lose compression
 *     (lift-off) and replace sticking springs by a Coulomb force μN where |T| > μN (slip).
 * The machined feature is generated while the block is displaced; after unloading it springs
 * back, so the feature error in the workpiece (datum) frame is  e = −u(p_cut).
 *
 * Fixture natural frequencies: generalised eigenproblem K φ = ω² M φ with the rigid-body mass
 * matrix of the block (information only; dynamics are treated in Module 3).
 */
import { MATERIALS, type CoeffSource, type CuttingCoefficients, type MaterialId } from './materials';
import { cutterForce, feedToGlobal, forceSignal, signalStats, TWO_PI, type CutParams, type ForceVector } from './millingForce';

export type Vec3 = [number, number, number];
export type LayoutId = 'good' | 'narrow' | 'off-locator';
export type FeedDirX = '-X' | '+X';

export interface FixtureElement {
  id: string;
  kind: 'locator' | 'clamp';
  label: string;
  /** contact point on the workpiece, mm */
  p: Vec3;
  /** unit direction in which the element pushes the workpiece */
  n: Vec3;
  /** clamp preload, N (0 for locators) */
  preload: number;
}

export interface FixtureParams {
  materialId: MaterialId;
  coeffs: CuttingCoefficients;
  coeffSource: CoeffSource;
  Lx: number;
  Ly: number;
  Lz: number;
  layout: LayoutId;
  /** preload of each of the two top clamps, N */
  topClamp: number;
  sideClamp: number;
  /** end clamp preload (0 = no end clamp) */
  endClamp: number;
  mu: number;
  kLocator: number; // N/mm
  kClamp: number; // N/mm
  tangentialRatio: number; // k_t / k_n
  // operation: slot along X
  D: number;
  N: number;
  fz: number;
  rpm: number;
  ap: number;
  slotY: number;
  feedDir: FeedDirX;
  tolerance: number; // ± on slot position / depth, mm
  stationStep: number;
  angleSamples: number;
}

export const DEFAULT_FIXTURE: FixtureParams = {
  materialId: 'aisi1045',
  coeffs: { ...MATERIALS.aisi1045.coeffs },
  coeffSource: 'illustrative',
  Lx: 150,
  Ly: 80,
  Lz: 50,
  layout: 'good',
  topClamp: 3000,
  sideClamp: 2000,
  endClamp: 0,
  mu: 0.25,
  kLocator: 5e4,
  kClamp: 2e4,
  tangentialRatio: 0.5,
  D: 16,
  N: 4,
  fz: 0.06,
  rpm: 2500,
  ap: 5,
  slotY: 40,
  feedDir: '+X',
  tolerance: 0.02,
  stationStep: 3,
  angleSamples: 24,
};

export const LAYOUT_INFO: Record<LayoutId, { name: string; text: string }> = {
  good: {
    name: 'Good 3-2-1 layout',
    text: 'Bottom locators spread over the base, side locators far apart, clamps placed directly opposite locators.',
  },
  narrow: {
    name: 'Locators too close together',
    text: 'Same principle, but the locators are bunched near the middle: little resistance to tilting and twisting.',
  },
  'off-locator': {
    name: 'Clamps away from locators',
    text: 'Clamps push where there is no locator underneath (and the side clamp sits high), creating tipping moments.',
  },
};

/** Fixture elements for a layout; positions scale with the block size. */
export function layoutElements(p: FixtureParams): FixtureElement[] {
  const { Lx, Ly, Lz } = p;
  const zLow = Math.min(12, Lz * 0.25);
  const up: Vec3 = [0, 0, 1], down: Vec3 = [0, 0, -1], py: Vec3 = [0, 1, 0], my: Vec3 = [0, -1, 0], px: Vec3 = [1, 0, 0], mx: Vec3 = [-1, 0, 0];
  const L = (id: string, label: string, pt: Vec3, n: Vec3): FixtureElement => ({ id, kind: 'locator', label, p: pt, n, preload: 0 });
  const C = (id: string, label: string, pt: Vec3, n: Vec3, P: number): FixtureElement => ({ id, kind: 'clamp', label, p: pt, n, preload: P });
  const els: FixtureElement[] = [];
  if (p.layout === 'narrow') {
    els.push(
      L('L1', 'Base locator 1', [0.43 * Lx, 0.38 * Ly, 0], up), L('L2', 'Base locator 2', [0.57 * Lx, 0.38 * Ly, 0], up), L('L3', 'Base locator 3', [0.5 * Lx, 0.62 * Ly, 0], up),
      L('L4', 'Side locator 1', [0.43 * Lx, 0, zLow], py), L('L5', 'Side locator 2', [0.57 * Lx, 0, zLow], py),
      L('L6', 'End locator', [0, 0.5 * Ly, zLow], px),
    );
  } else {
    els.push(
      L('L1', 'Base locator 1', [0.13 * Lx, 0.19 * Ly, 0], up), L('L2', 'Base locator 2', [0.87 * Lx, 0.19 * Ly, 0], up), L('L3', 'Base locator 3', [0.5 * Lx, 0.85 * Ly, 0], up),
      L('L4', 'Side locator 1', [0.17 * Lx, 0, zLow], py), L('L5', 'Side locator 2', [0.83 * Lx, 0, zLow], py),
      L('L6', 'End locator', [0, 0.5 * Ly, zLow], px),
    );
  }
  if (p.layout === 'off-locator') {
    // clamps where there is no locator underneath, side clamp high up
    els.push(
      C('C1', 'Top clamp 1', [0.5 * Lx, 0.04 * Ly, Lz], down, p.topClamp), C('C2', 'Top clamp 2', [0.96 * Lx, 0.55 * Ly, Lz], down, p.topClamp),
      C('C4', 'Side clamp', [0.5 * Lx, Ly, 0.9 * Lz], my, p.sideClamp),
    );
  } else {
    // one top clamp directly above each base locator, side clamp opposite the side locators
    const base = els.filter((e) => e.n[2] === 1);
    base.forEach((b, i) => els.push(C(`C${i + 1}`, `Top clamp ${i + 1}`, [b.p[0], b.p[1], Lz], down, p.topClamp)));
    els.push(C('C4', 'Side clamp', [0.5 * Lx, Ly, zLow], my, p.sideClamp));
  }
  if (p.endClamp > 0) els.push(C('C5', 'End clamp', [Lx, 0.5 * Ly, zLow], mx, p.endClamp));
  return els;
}

// ------------------------------------------------------------------ small linear algebra
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const norm = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);

/** Two unit vectors orthogonal to n. */
function tangents(n: Vec3): [Vec3, Vec3] {
  const a: Vec3 = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const t1 = cross(n, a); const l1 = norm(t1);
  const t1n = scale(t1, 1 / l1);
  return [t1n, cross(n, t1n)];
}

/** Solve A x = b (6×6, partial pivoting). Returns null if singular. */
export function solve6(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  let scaleRef = 0;
  for (let i = 0; i < n; i++) scaleRef = Math.max(scaleRef, Math.abs(A[i][i]));
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-9 * Math.max(scaleRef, 1)) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / M[r][r];
  }
  return x;
}

const zeros6 = () => Array.from({ length: 6 }, () => new Array(6).fill(0));
function addSpring(K: number[][], d: Vec3, r: Vec3, k: number) {
  const J = [d[0], d[1], d[2], ...cross(r, d)];
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) K[i][j] += k * J[i] * J[j];
}
function wrench(F: Vec3, r: Vec3): number[] {
  return [F[0], F[1], F[2], ...cross(r, F)];
}
export function pointDisp(q: number[], r: Vec3): Vec3 {
  const th: Vec3 = [q[3], q[4], q[5]];
  const w = cross(th, r);
  return [q[0] + w[0], q[1] + w[1], q[2] + w[2]];
}

// ------------------------------------------------------------------ contact solution
export interface ContactState {
  id: string;
  N: number; // normal force, N (≥ 0)
  T: number; // tangential force magnitude, N
  status: 'stick' | 'slip' | 'lift';
}

export interface FixtureModel {
  els: FixtureElement[];
  c: Vec3;
  r: Vec3[];
  kn: number[];
  kt: number[];
  t: [Vec3, Vec3][];
  N0: number[];
  preloaded: boolean[];
  q0: number[];
  mass: number; // tonne
  inertia: Vec3; // t·mm² about centroid
  mu: number;
  ok: boolean; // clamping step converged with all locators in contact
}

/** contact force below which the stiffness is not reduced further (contacts are never perfectly unloaded) */
const N_FLOOR = 50;

/** Clamping step: preloads + gravity, normal springs only, with lift-off iterations. */
export function clampedState(p: FixtureParams, clampScale = 1): FixtureModel {
  const els = layoutElements(p).map((e) => ({ ...e, preload: e.preload * clampScale }));
  const c: Vec3 = [p.Lx / 2, p.Ly / 2, p.Lz / 2];
  const r = els.map((e) => sub(e.p, c));
  const kBase = els.map((e) => (e.kind === 'locator' ? p.kLocator : p.kClamp));
  const t = els.map((e) => tangents(e.n));
  const rho = MATERIALS[p.materialId].rho * 1e-12;
  const mass = rho * p.Lx * p.Ly * p.Lz;
  const inertia: Vec3 = [(mass * (p.Ly ** 2 + p.Lz ** 2)) / 12, (mass * (p.Lx ** 2 + p.Lz ** 2)) / 12, (mass * (p.Lx ** 2 + p.Ly ** 2)) / 12];
  const g: Vec3 = [0, 0, -mass * 9810];
  const active = els.map(() => true);
  const Ptot = Math.max(1, els.reduce((a, e) => a + e.preload, 0));
  let q = new Array(6).fill(0);
  let N0 = els.map(() => 0);
  let ok = false;
  for (let it = 0; it < 12; it++) {
    const K = zeros6();
    const F = wrench(g, [0, 0, 0]);
    // clamps are force-controlled during clamping (their preload is the force after clamping);
    // locators are compression-only springs
    els.forEach((e, i) => {
      if (e.kind === 'clamp') { const w = wrench(scale(e.n, e.preload), r[i]); for (let k = 0; k < 6; k++) F[k] += w[k]; return; }
      if (active[i]) addSpring(K, e.n, r[i], kBase[i]);
    });
    const sol = solve6(K, F);
    if (!sol) { ok = false; break; }
    q = sol;
    let changed = false;
    N0 = els.map((e, i) => {
      if (e.kind === 'clamp') return e.preload;
      if (!active[i]) return 0;
      const comp = -dot(pointDisp(q, r[i]), e.n);
      const N = kBase[i] * comp;
      if (N < -1e-6 * Ptot) { active[i] = false; changed = true; return 0; }
      return Math.max(N, 0);
    });
    if (!changed) {
      // every locator that some clamp pushes toward must be seated (an end locator with no end clamp may stay unloaded)
      ok = els.every((e, i) => e.kind === 'clamp' || N0[i] > 0 || !els.some((c) => c.kind === 'clamp' && c.preload > 0 && dot(c.n, e.n) < -0.5));
      break;
    }
  }
  // contacts carrying less than 1 % of the largest clamp preload are treated as unloaded
  // (they may pick up load during the cut but do not hold the workpiece by friction)
  const Pmax = Math.max(1, ...els.map((e) => e.preload));
  const preloaded = N0.map((N) => N > 0.01 * Pmax);
  // contact stiffness for the cutting step, linearised about the clamped state: Hertz-type
  // stiffening k = k_ref·(N0 / 1 kN)^(1/3) (k_ref is the stiffness entered for a 1 kN contact force)
  const kn = kBase.map((k, i) => k * Math.cbrt(Math.max(N0[i], N_FLOOR) / 1000));
  const kt = kn.map((k) => k * p.tangentialRatio);
  return { els, c, r, kn, kt, t, N0, preloaded, q0: q, mass, inertia, mu: p.mu, ok };
}

export interface CutResponse {
  q: number[]; // incremental generalised displacement from the clamped state
  contacts: ContactState[];
  restrained: boolean;
  minSlipSF: number; // min μN/|T| over contacts in contact (∞ if no tangential load)
  minNormal: number; // min normal force over elements that started in contact, N
  minNormalId: string;
  slipping: boolean;
  lifted: boolean;
}

/**
 * Incremental response of the clamped workpiece to a force F (on the workpiece) at point pc.
 * Active set: 'lift' elements carry nothing (their clamped-state force is released), 'slip'
 * elements carry a Coulomb force μN against the slip direction, 'stick' elements are springs.
 * A lifted element whose trial normal force becomes compressive is re-engaged (this is how an
 * unloaded locator, e.g. the end locator without an end clamp, picks up load).
 */
export function cutResponse(m: FixtureModel, F: Vec3, pc: Vec3): CutResponse {
  const nE = m.els.length;
  const status: ('stick' | 'slip' | 'lift')[] = m.N0.map((N) => (N > 0 ? 'stick' : 'lift'));
  const slipDir: Vec3[] = m.els.map(() => [0, 0, 0]);
  const trialSF = m.els.map(() => Infinity);
  const flips = m.els.map(() => 0);
  const rc = sub(pc, m.c);
  let q = new Array(6).fill(0);
  const N = m.N0.slice();
  const T: Vec3[] = m.els.map(() => [0, 0, 0] as Vec3);
  let restrained = true;
  for (let it = 0; it < 60; it++) {
    const K = zeros6();
    const Fw = wrench(F, rc);
    for (let i = 0; i < nE; i++) {
      if (status[i] === 'lift') {
        // a lifted element no longer carries its clamping/locating force
        const w = wrench(scale(m.els[i].n, -m.N0[i]), m.r[i]);
        for (let k = 0; k < 6; k++) Fw[k] += w[k];
        continue;
      }
      addSpring(K, m.els[i].n, m.r[i], m.kn[i]);
      if (status[i] === 'stick') { addSpring(K, m.t[i][0], m.r[i], m.kt[i]); addSpring(K, m.t[i][1], m.r[i], m.kt[i]); }
      else {
        const w = wrench(scale(slipDir[i], -m.mu * Math.max(N[i], 0)), m.r[i]);
        for (let k = 0; k < 6; k++) Fw[k] += w[k];
      }
    }
    const sol = solve6(K, Fw);
    if (!sol) { restrained = false; break; }
    q = sol;
    let changed = false;
    let maxDN = 0;
    for (let i = 0; i < nE; i++) {
      const e = m.els[i];
      const u = pointDisp(q, m.r[i]);
      const un = dot(u, e.n);
      const Ni = m.N0[i] - m.kn[i] * un;
      const ut = sub(u, scale(e.n, un));
      if (status[i] === 'lift') {
        N[i] = 0; T[i] = [0, 0, 0];
        if (Ni > 1e-6 * m.kn[i] * 1e-3 && flips[i] < 4) { status[i] = 'stick'; flips[i]++; changed = true; }
        continue;
      }
      if (Ni < 0 && flips[i] < 4) { status[i] = 'lift'; flips[i]++; N[i] = 0; T[i] = [0, 0, 0]; changed = true; continue; }
      maxDN = Math.max(maxDN, Math.abs(Ni - N[i]));
      N[i] = Math.max(Ni, 0);
      if (status[i] === 'stick') {
        T[i] = scale(ut, -m.kt[i]);
        const Tm = norm(T[i]);
        if (Tm > m.mu * N[i] + 1e-9) {
          trialSF[i] = Math.min(trialSF[i], (m.mu * N[i]) / Tm);
          status[i] = 'slip'; slipDir[i] = scale(ut, 1 / norm(ut)); changed = true;
          T[i] = scale(slipDir[i], -m.mu * N[i]);
        }
      } else {
        const l = norm(ut);
        if (l > 1e-15) slipDir[i] = scale(ut, 1 / l);
        T[i] = scale(slipDir[i], -m.mu * N[i]);
      }
    }
    // stop when the active set is stable and slipping friction forces have converged
    if (!changed && maxDN < 1e-3) break;
  }
  let minSlipSF = Infinity, minNormal = Infinity, minNormalId = '';
  const contacts: ContactState[] = m.els.map((e, i) => {
    const Tm = norm(T[i]);
    // safety is judged at the preloaded contacts; an element that only picks up load during the
    // cut (N0 = 0) may micro-slip without the workpiece moving
    if (m.preloaded[i]) {
      if (N[i] < minNormal) { minNormal = N[i]; minNormalId = e.id; }
      if (status[i] === 'stick' && Tm > 1e-9) minSlipSF = Math.min(minSlipSF, (m.mu * N[i]) / Tm);
      if (status[i] === 'slip') minSlipSF = Math.min(minSlipSF, trialSF[i]);
    }
    return { id: e.id, N: N[i], T: Tm, status: status[i] };
  });
  if (!restrained) { minSlipSF = 0; minNormal = 0; }
  return {
    q, contacts, restrained, minSlipSF, minNormal, minNormalId,
    slipping: contacts.some((c, i) => c.status === 'slip' && m.preloaded[i]), lifted: contacts.some((c, i) => c.status === 'lift' && m.preloaded[i]),
  };
}

// ------------------------------------------------------------------ natural frequencies
/** Jacobi eigenvalues of a symmetric matrix. */
function jacobiEigen(A0: number[][]): number[] {
  const n = A0.length;
  const A = A0.map((r) => r.slice());
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] ** 2;
    if (off < 1e-18) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(A[p][q]) < 1e-30) continue;
      const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) {
        const akp = A[k][p], akq = A[k][q];
        A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < n; k++) {
        const apk = A[p][k], aqk = A[q][k];
        A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk;
      }
    }
  }
  return A.map((r, i) => r[i]).sort((a, b) => a - b);
}

/** Rigid-body natural frequencies (Hz) of the clamped workpiece on its contact springs. */
export function fixtureFrequencies(m: FixtureModel): number[] {
  const K = zeros6();
  m.els.forEach((e, i) => {
    if (!m.preloaded[i]) return;
    addSpring(K, e.n, m.r[i], m.kn[i]);
    addSpring(K, m.t[i][0], m.r[i], m.kt[i]);
    addSpring(K, m.t[i][1], m.r[i], m.kt[i]);
  });
  const Md = [m.mass, m.mass, m.mass, ...m.inertia];
  const S = K.map((row, i) => row.map((v, j) => v / Math.sqrt(Md[i] * Md[j])));
  return jacobiEigen(S).map((w2) => Math.sqrt(Math.max(w2, 0)) / TWO_PI);
}

// ------------------------------------------------------------------ toolpath simulation
export interface FixStation {
  x: number;
  meanF: ForceVector; // on the tool, global
  peakF: number;
  /** mean feature error in the workpiece frame at the cutting point, mm (e = −u) */
  ex: number;
  ey: number;
  ez: number;
  /** range of the cutting-point displacement over one revolution, mm */
  vibY: number;
  vibZ: number;
  tilt: Vec3; // mean rotations, rad
  minSlipSF: number;
  minNormal: number;
  minNormalId: string;
  slipping: boolean;
  lifted: boolean;
  restrained: boolean;
  /** generalised displacement at each sampled cutter angle (for animation) */
  qs: Float32Array; // angleSamples × 6
  /** contact states at the most critical sampled angle */
  contacts: ContactState[];
}

export interface FixSummary {
  maxAbsEy: number;
  maxAbsEz: number;
  straightness: number; // range of ey along the slot
  flatness: number; // range of ez
  maxTilt: number; // rad
  minSlipSF: number;
  minNormal: number;
  minNormalId: string;
  anySlip: boolean;
  anyLift: boolean;
  dislodged: boolean;
  requiredClampScale: number; // clamp multiplier giving slip SF = 1 and no lift-off
  totalClamp: number; // N
  freqs: number[];
  ftp: number;
  feedRate: number;
  mrr: number; // mm³/min
  cycleTime: number;
  peakForce: number;
  clampOK: boolean;
  /** for each axis: +1 mean force on the workpiece pushes into the locators, −1 away from them */
  into: { x: number; y: number; z: number };
  /** mean cutting force on the workpiece (−force on the tool), N */
  meanFw: Vec3;
  warnings: string[];
}

export interface FixResult {
  params: FixtureParams;
  els: FixtureElement[];
  N0: number[];
  preloaded: boolean[];
  stations: FixStation[];
  summary: FixSummary;
}

/**
 * Direction check for the 3-2-1 layout (locator normals +X, +Y, +Z): a workpiece force component
 * F·n < 0 pushes into the locator (+1, good); > 0 pushes away from it (−1, held by clamp/friction).
 * Argument: mean force on the TOOL (global); the workpiece receives the opposite.
 */
export function forceDirections(Ftool: ForceVector): { x: number; y: number; z: number } {
  const sgn = (v: number) => (Math.abs(v) < 1e-9 ? 1 : v < 0 ? -1 : 1);
  // workpiece force = −F_tool; into locator when −F_tool·n < 0  ⇔  F_tool·n > 0
  return { x: sgn(Ftool.Fx), y: sgn(Ftool.Fy), z: sgn(Ftool.Fz) };
}

export function slotCutParams(p: FixtureParams): CutParams {
  return { D: p.D, N: p.N, fz: p.fz, b: p.ap, ae: p.D, mode: 'down', K: p.coeffs, helixDeg: 30, dz: 0.5 };
}

/** Evaluate the path for a clamp-force multiplier; used for the minimum-clamp search. */
function pathSafety(p: FixtureParams, scaleC: number, stations: { x: number }[], forcesAt: (x: number) => { F: Vec3; pc: Vec3 }[]) {
  const m = clampedState(p, scaleC);
  if (!m.ok) return { slip: 0, normal: -1 };
  let slip = Infinity, normal = Infinity;
  for (const s of stations) for (const f of forcesAt(s.x)) {
    const r = cutResponse(m, f.F, f.pc);
    slip = Math.min(slip, r.minSlipSF); normal = Math.min(normal, r.minNormal);
    if (!r.restrained || r.lifted) return { slip: 0, normal: -1 };
  }
  return { slip, normal };
}

export function simulateFixture(p: FixtureParams): FixResult {
  const m = clampedState(p);
  const cp = slotCutParams(p);
  const feedSign: 1 | -1 = p.feedDir === '+X' ? 1 : -1;
  const nA = p.angleSamples;
  const pitch = TWO_PI / p.N;
  // forces over one tooth pitch at nA angles (the slot force pattern repeats every pitch)
  const angleForces: ForceVector[] = [];
  for (let a = 0; a < nA; a++) angleForces.push(feedToGlobal(cutterForce((a / nA) * pitch, cp).F, feedSign));
  const st = signalStats(forceSignal(cp, p.rpm, 360));
  const meanF = feedToGlobal(st.mean, feedSign);
  const zc = p.Lz - p.ap / 2;
  const x0 = p.D / 2 + 2, x1 = p.Lx - p.D / 2 - 2;
  const nSt = Math.max(2, Math.round((x1 - x0) / p.stationStep) + 1);
  const xs = Array.from({ length: nSt }, (_, i) => (feedSign === 1 ? x0 + ((x1 - x0) * i) / (nSt - 1) : x1 - ((x1 - x0) * i) / (nSt - 1)));
  const forcesAt = (x: number) => angleForces.map((F) => ({ F: [-F.Fx, -F.Fy, -F.Fz] as Vec3, pc: [x, p.slotY, zc] as Vec3 }));

  const stations: FixStation[] = xs.map((x) => {
    const qs = new Float32Array(nA * 6);
    let minSlip = Infinity, minN = Infinity, minId = '', slip = false, lift = false, restrained = true;
    let worst: ContactState[] = [];
    let worstScore = Infinity;
    const uSum: Vec3 = [0, 0, 0], thSum: Vec3 = [0, 0, 0];
    let yMin = Infinity, yMax = -Infinity, zMin = Infinity, zMax = -Infinity;
    const pc: Vec3 = [x, p.slotY, zc];
    const rc = sub(pc, m.c);
    forcesAt(x).forEach((f, a) => {
      const r = cutResponse(m, f.F, f.pc);
      for (let k = 0; k < 6; k++) qs[a * 6 + k] = r.q[k];
      const u = pointDisp(r.q, rc);
      for (let k = 0; k < 3; k++) { uSum[k] += u[k]; thSum[k] += r.q[3 + k]; }
      yMin = Math.min(yMin, u[1]); yMax = Math.max(yMax, u[1]); zMin = Math.min(zMin, u[2]); zMax = Math.max(zMax, u[2]);
      if (r.minSlipSF < minSlip) minSlip = r.minSlipSF;
      if (r.minNormal < minN) { minN = r.minNormal; minId = r.minNormalId; }
      slip ||= r.slipping; lift ||= r.lifted; restrained &&= r.restrained;
      const score = Math.min(r.minSlipSF, r.minNormal / 100);
      if (score < worstScore) { worstScore = score; worst = r.contacts; }
    });
    const mean = scale(uSum, 1 / nA);
    return {
      x, meanF, peakF: st.peakResultant,
      ex: -mean[0], ey: -mean[1], ez: -mean[2],
      vibY: yMax - yMin, vibZ: zMax - zMin, tilt: scale(thSum, 1 / nA),
      minSlipSF: minSlip, minNormal: minN, minNormalId: minId, slipping: slip, lifted: lift, restrained, qs, contacts: worst,
    };
  });

  // minimum clamp-force multiplier (slip SF ≥ 1 and no lift-off everywhere), bisection on a coarse path
  const coarse = xs.filter((_, i) => i % 4 === 0 || i === xs.length - 1).map((x) => ({ x }));
  const okAt = (s: number) => { const r = pathSafety(p, s, coarse, forcesAt); return r.slip >= 1 && r.normal >= 0; };
  let req = NaN;
  if (okAt(20)) {
    let lo = 0.01, hi = 20;
    if (okAt(lo)) req = lo;
    else { for (let it = 0; it < 22; it++) { const mid = Math.sqrt(lo * hi); if (okAt(mid)) hi = mid; else lo = mid; } req = hi; }
  }

  const eys = stations.map((s) => s.ey), ezs = stations.map((s) => s.ez);
  const freqs = m.ok ? fixtureFrequencies(m) : [];
  const ftp = (p.rpm * p.N) / 60;
  const vf = p.rpm * p.N * p.fz;
  const minSlip = Math.min(...stations.map((s) => s.minSlipSF));
  const minNs = stations.reduce((a, s) => (s.minNormal < a.minNormal ? s : a), stations[0]);
  const totalClamp = m.els.filter((e) => e.kind === 'clamp').reduce((a, e) => a + e.preload, 0);
  const anySlip = stations.some((s) => s.slipping), anyLift = stations.some((s) => s.lifted), dislodged = stations.some((s) => !s.restrained) || !m.ok;
  const warnings: string[] = [];
  if (!m.ok) warnings.push('Clamping alone does not hold every locator in contact: the clamp forces push the block off a locator. Move the clamps over the locators.');
  if (dislodged) warnings.push('The workpiece is not restrained under the cutting force: it would be dislodged from the fixture.');
  else if (anyLift) warnings.push('A locator or clamp loses contact during the cut (lift-off): position is no longer defined by the datum.');
  else if (anySlip) warnings.push('Friction is exceeded at a contact during the cut (slip): the workpiece moves along a locator.');
  if (Number.isFinite(req) && req > 0 && !anySlip && !anyLift && 1 / req < 2)
    warnings.push(`Clamping safety factor is only ${(1 / req).toFixed(2)} (clamp forces / minimum needed); ≥ 2 is a common rule because cutting forces fluctuate and coefficients are uncertain.`);
  const into = forceDirections(meanF);
  const away = (['x', 'y', 'z'] as const).filter((k) => into[k] < 0);
  if (away.length) {
    const names = { x: 'end locator (X)', y: 'side locators (Y)', z: 'base locators (Z)' };
    const held = (k: 'x' | 'y' | 'z') => (k === 'x' ? (p.endClamp > 0 ? 'the end clamp' : 'friction only') : k === 'y' ? 'the side clamp' : 'the top clamps');
    warnings.push(`The mean cutting force on the workpiece points away from the ${away.map((k) => names[k]).join(' and ')}; it is held by ${away.map(held).join(' / ')}. Prefer a feed direction that pushes the largest force component into the locators.`);
  }
  if (freqs.length && freqs[0] < 1.5 * ftp) warnings.push(`Lowest fixture natural frequency (${freqs[0].toFixed(0)} Hz) is close to or below the tooth-passing frequency (${ftp.toFixed(0)} Hz): vibration may be amplified (quasi-static model).`);
  if (p.coeffSource !== 'calibrated') warnings.push(`Cutting coefficients are ${p.coeffSource}; contact stiffness and friction values are illustrative. Results are estimates.`);

  return {
    params: p, els: m.els, N0: m.N0, preloaded: m.preloaded, stations,
    summary: {
      maxAbsEy: Math.max(...eys.map(Math.abs)), maxAbsEz: Math.max(...ezs.map(Math.abs)),
      straightness: Math.max(...eys) - Math.min(...eys), flatness: Math.max(...ezs) - Math.min(...ezs),
      maxTilt: Math.max(...stations.map((s) => Math.hypot(...s.tilt))),
      minSlipSF: minSlip, minNormal: minNs.minNormal, minNormalId: minNs.minNormalId,
      anySlip, anyLift, dislodged,
      requiredClampScale: req, totalClamp, freqs, ftp, feedRate: vf, mrr: p.D * p.ap * vf,
      cycleTime: ((x1 - x0) / vf) * 60, peakForce: st.peakResultant,
      clampOK: !anySlip && !anyLift && !dislodged,
      into, meanFw: [-meanF.Fx, -meanF.Fy, -meanF.Fz],
      warnings,
    },
  };
}

/**
 * Static push test (for validation against a dial-gauge / load-cell measurement): a force F is
 * applied at point pt of the clamped workpiece; returns the displacement of that point, mm.
 */
export function staticPush(p: FixtureParams, pt: Vec3, F: Vec3): { u: Vec3; along: number; restrained: boolean } {
  const m = clampedState(p);
  const r = cutResponse(m, F, pt);
  const u = pointDisp(r.q, sub(pt, m.c));
  const Fm = norm(F);
  return { u, along: Fm > 0 ? dot(u, F) / Fm : 0, restrained: r.restrained && m.ok };
}

/** Feature-error profile in the workpiece frame along the slot, sorted by X (for charts/validation). */
export function errorProfile(res: FixResult): { x: number; ey: number; ez: number }[] {
  return res.stations.map((s) => ({ x: s.x, ey: s.ey, ez: s.ez })).sort((a, b) => a.x - b.x);
}

/** Interpolate the predicted slot errors at X positions (linear, clamped at the ends). */
export function errorAt(res: FixResult, x: number): { ey: number; ez: number } {
  const prof = errorProfile(res);
  if (x <= prof[0].x) return prof[0];
  for (let i = 1; i < prof.length; i++) if (x <= prof[i].x) {
    const a = prof[i - 1], b = prof[i], t = (x - a.x) / (b.x - a.x);
    return { ey: a.ey + t * (b.ey - a.ey), ez: a.ez + t * (b.ez - a.ez) };
  }
  return prof[prof.length - 1];
}

/**
 * Clamping-force study: friction reserve, minimum contact force and slot position error when all
 * clamp forces are multiplied by each scale (coarse path, 9 stations × all sampled angles).
 */
export function clampSweep(p: FixtureParams, scales: number[]): { scale: number; total: number; slipSF: number; minN: number; ey: number; holds: boolean }[] {
  const cp = slotCutParams(p);
  const feedSign: 1 | -1 = p.feedDir === '+X' ? 1 : -1;
  const pitch = TWO_PI / p.N;
  const Fs: Vec3[] = [];
  for (let a = 0; a < p.angleSamples; a++) { const F = feedToGlobal(cutterForce((a / p.angleSamples) * pitch, cp).F, feedSign); Fs.push([-F.Fx, -F.Fy, -F.Fz]); }
  const x0 = p.D / 2 + 2, x1 = p.Lx - p.D / 2 - 2, zc = p.Lz - p.ap / 2;
  const xs = Array.from({ length: 9 }, (_, i) => x0 + ((x1 - x0) * i) / 8);
  return scales.map((sc) => {
    const m = clampedState(p, sc);
    const total = m.els.filter((e) => e.kind === 'clamp').reduce((a, e) => a + e.preload, 0);
    let slip = Infinity, minN = Infinity, ey = 0, holds = m.ok;
    if (m.ok) for (const x of xs) {
      let eSum = 0;
      for (const F of Fs) {
        const r = cutResponse(m, F, [x, p.slotY, zc]);
        slip = Math.min(slip, r.minSlipSF); minN = Math.min(minN, r.minNormal);
        if (!r.restrained || r.lifted || r.slipping) holds = false;
        eSum += -pointDisp(r.q, sub([x, p.slotY, zc], m.c))[1];
      }
      ey = Math.max(ey, Math.abs(eSum / Fs.length));
    }
    if (!m.ok) { slip = 0; minN = 0; }
    return { scale: sc, total, slipSF: slip, minN, ey, holds };
  });
}
