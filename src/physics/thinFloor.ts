/**
 * Module 7 — Cutting force and workpiece distortion in thin-floor pocket milling.
 *
 * Geometry (pocket frame = machine frame): floor in the X–Y plane, 0 ≤ x ≤ L, 0 ≤ y ≤ W, Z up.
 * Final floor top at z = 0, floor bottom at z = −t_final. A finishing allowance a_f above the final
 * floor is removed in n layers of depth ap (equal layers, last layer at z = 0).
 *
 * Plate model: Reissner–Mindlin Q4 elements of plateFE.ts (2×2 bending, 1-point shear) on an
 * nx × ny mesh; element thickness = t_final + local stock above the final floor (updated as
 * material is removed, stiffness refactorised every `refactorEvery` stations).
 * Boundary: clamped perimeter (w = βx = βy = 0), reduced edge support (w = 0, elastic rotational
 * restraint k_rot = 2·D/W per unit length), or simply supported (w = 0; benchmark only). Supported
 * edges are 'hard' (tangential rotation fixed), as in Kirchhoff theory.
 * Underside support: none, centre pin, 2 × 2 pins (linear springs k_pin), or an elastic bed
 * (Winkler foundation k_bed per unit area).
 *
 * Cutting load: tool force from millingForce.ts (side flutes, closed-form mean over a revolution,
 * linear in the engaged axial depth) PLUS an end-cutting-edge axial term (illustrative,
 * documented):  per engaged tooth Fz_end = (K_zc·fz·sinφ + K_ze)·R  (the flat end edges, length R,
 * cut and rub the floor). The workpiece receives −F_tool; only the axial component bends the
 * plate (in-plane Fx, Fy act as membrane loads and are neglected). The axial load is spread
 * uniformly over the cutter's circular footprint (equivalent contact patch).
 *
 * Force–deflection coupling: the floor under the cutter deflects δ = c·Fz (c = compliance at the
 * cutter for the footprint load). The engaged depth becomes ap_eff = stock − δ ≥ 0 and
 * Fz = a·ap_eff + b, so δ = c(a·stock + b)/(1 + c·a) (closed form, linear model).
 * Surface generation: a floor point under the footprint is cut to z_b + δ(x,y) (the tool bottom
 * z_b in the undeformed frame plus the local deflection at that instant); after unloading it springs
 * back, so the final top = min over all passes of (z_b + δ). Final thickness = t_final + top.
 */
import { MATERIALS, type CoeffSource, type CuttingCoefficients, type MaterialId } from './materials';
import { analyticalMeanForce, cutterForce, engagementAngles, isEngaged, TWO_PI, type CutParams, type MillingMode } from './millingForce';
import { BandCholesky, BandMatrix, elementStiffness, firstNaturalFrequency, halfBandwidth, nodeCount, nodeId, sampleW, type PlateMesh, type PlateModel } from './plateFE';

export type Strategy = 'zigzag' | 'spiral' | 'adaptive';
export type EdgeSupport = 'clamped' | 'reduced' | 'simply';
export type UnderSupport = 'none' | 'centre' | 'pins4' | 'bed';

export interface ThinFloorParams {
  materialId: MaterialId;
  coeffs: CuttingCoefficients;
  coeffSource: CoeffSource;
  /** end-cutting-edge axial coefficients: chip N/mm², edge N/mm (illustrative) */
  Kzc: number;
  Kze: number;
  L: number; // pocket length X, mm
  W: number; // pocket width Y, mm
  tFinal: number; // mm
  tol: number; // ± mm
  allowance: number; // stock on the floor before finishing, mm
  ap: number; // axial depth per floor pass, mm
  D: number;
  N: number;
  rpm: number;
  fz: number;
  ae: number; // stepover for zigzag / spiral, mm
  helixDeg: number;
  strategy: Strategy;
  edge: EdgeSupport;
  under: UnderSupport;
  kPin: number; // N/mm
  kBed: number; // N/mm³
  rapid: number; // mm/min for non-cutting returns
  // numerics
  nx: number;
  ny: number;
  refactorEvery: number;
  maxStations: number;
}

export const DEFAULT_THINFLOOR: ThinFloorParams = {
  materialId: 'al7075',
  coeffs: { ...MATERIALS.al7075.coeffs },
  coeffSource: 'illustrative',
  Kzc: 300,
  Kze: 8,
  L: 80,
  W: 60,
  tFinal: 1.5,
  tol: 0.05,
  allowance: 0.5,
  ap: 0.5,
  D: 8,
  N: 3,
  rpm: 10000,
  fz: 0.06,
  ae: 4,
  helixDeg: 30,
  strategy: 'zigzag',
  edge: 'reduced',
  under: 'none',
  kPin: 5000,
  kBed: 5,
  rapid: 5000,
  nx: 32,
  ny: 24,
  refactorEvery: 20,
  maxStations: 520,
};

export const STRATEGY_INFO: Record<Strategy, { name: string; text: string }> = {
  zigzag: { name: 'A · Zigzag', text: 'Parallel passes along X, stepping over by ae in Y. The direction alternates, so climb and conventional milling alternate. The first pass is a full-width slot.' },
  spiral: { name: 'B · Spiral (inside-out)', text: 'A slot along the pocket centre line, then rectangular rings offset by ae, travelled counter-clockwise (climb with a clockwise spindle) out to the walls.' },
  adaptive: { name: 'C · Adaptive-style', text: 'One-way climb passes at a constant low radial engagement (15 % of D) with chip-thinning feed compensation; rapid returns. Entry assumed trochoidal (no full slot).' },
};

// ------------------------------------------------------------------ floor plate FE
const DOF = 3;

export interface FloorFE {
  mesh: PlateMesh; // Lx = L, H = W, nz = ny
  model: PlateModel;
}

/** Build and factorise the floor plate for element thicknesses t (index i*ny + k). */
export function buildFloor(p: Pick<ThinFloorParams, 'L' | 'W' | 'nx' | 'ny' | 'materialId' | 'edge' | 'under' | 'kPin' | 'kBed' | 'tFinal'>, t: ArrayLike<number>): FloorFE {
  const mesh: PlateMesh = { Lx: p.L, H: p.W, nx: p.nx, nz: p.ny };
  const mat = MATERIALS[p.materialId];
  const nn = nodeCount(mesh);
  const K = new BandMatrix(nn * DOF, halfBandwidth(mesh));
  const a = p.L / p.nx, c = p.W / p.ny;
  const mass = new Float64Array(nn);
  const rho = mat.rho * 1e-12; // kg/m³ → t/mm³
  const cache = new Map<number, Float64Array>();
  for (let i = 0; i < p.nx; i++)
    for (let k = 0; k < p.ny; k++) {
      const te = Math.max(t[i * p.ny + k], 0.05);
      const key = Math.round(te * 1e5);
      let Ke = cache.get(key);
      if (!Ke) { Ke = elementStiffness(a, c, te, { E: mat.E, nu: mat.nu }); cache.set(key, Ke); }
      const nodes = [nodeId(mesh, i, k), nodeId(mesh, i + 1, k), nodeId(mesh, i + 1, k + 1), nodeId(mesh, i, k + 1)];
      for (let q = 0; q < 4; q++)
        for (let dq = 0; dq < DOF; dq++) {
          const gi = nodes[q] * DOF + dq;
          for (let r = 0; r < 4; r++)
            for (let dr = 0; dr < DOF; dr++) {
              const gj = nodes[r] * DOF + dr;
              if (gj <= gi) K.add(gi, gj, Ke[(3 * q + dq) * 12 + 3 * r + dr]);
            }
        }
      for (let q = 0; q < 4; q++) mass[nodes[q]] += (rho * te * a * c) / 4;
    }
  // perimeter supports
  const Dref = (mat.E * p.tFinal ** 3) / (12 * (1 - mat.nu ** 2));
  const pen = mat.E * 1e9;
  const kRot = (2 * Dref) / p.W; // per unit length (reduced edge)
  for (let i = 0; i <= p.nx; i++)
    for (let k = 0; k <= p.ny; k++) {
      const onX = i === 0 || i === p.nx, onY = k === 0 || k === p.ny;
      if (!onX && !onY) continue;
      const id = nodeId(mesh, i, k) * DOF;
      K.add(id, id, pen); // w = 0 on every edge
      // "hard" support: w = 0 along an edge implies zero rotation about the edge normal (tangential slope);
      // dof +1 = βx (∂w/∂x), dof +2 = βy (∂w/∂y)
      if (onX) K.add(id + 2, id + 2, pen);
      if (onY) K.add(id + 1, id + 1, pen);
      if (p.edge === 'clamped') { K.add(id + 1, id + 1, pen); K.add(id + 2, id + 2, pen); }
      else if (p.edge === 'reduced') {
        if (onX) K.add(id + 1, id + 1, kRot * (k === 0 || k === p.ny ? c / 2 : c));
        if (onY) K.add(id + 2, id + 2, kRot * (i === 0 || i === p.nx ? a / 2 : a));
      }
    }
  // underside supports
  const nearest = (x: number, y: number) => nodeId(mesh, Math.round(x / a), Math.round(y / c)) * DOF;
  if (p.under === 'centre') K.add(nearest(p.L / 2, p.W / 2), nearest(p.L / 2, p.W / 2), p.kPin);
  if (p.under === 'pins4') for (const fx of [1 / 3, 2 / 3]) for (const fy of [1 / 3, 2 / 3]) { const id = nearest(fx * p.L, fy * p.W); K.add(id, id, p.kPin); }
  if (p.under === 'bed')
    for (let i = 0; i <= p.nx; i++)
      for (let k = 0; k <= p.ny; k++) {
        const id = nodeId(mesh, i, k) * DOF;
        K.add(id, id, p.kBed * (i === 0 || i === p.nx ? a / 2 : a) * (k === 0 || k === p.ny ? c / 2 : c));
      }
  return { mesh, model: { mesh, K, chol: new BandCholesky(K), mass } };
}

/** Load vector for total force P (N, positive = downward, i.e. +w) spread uniformly over a disk. */
export function diskLoad(mesh: PlateMesh, x: number, y: number, R: number, P: number): Float64Array {
  const f = new Float64Array(nodeCount(mesh) * DOF);
  const pts: [number, number][] = [[0, 0]];
  for (const [rr, n] of [[0.45, 6], [0.8, 12]] as const) for (let j = 0; j < n; j++) pts.push([rr * R * Math.cos((j / n) * TWO_PI), rr * R * Math.sin((j / n) * TWO_PI)]);
  const a = mesh.Lx / mesh.nx, c = mesh.H / mesh.nz;
  for (const [dx, dy] of pts) {
    const xc = Math.min(Math.max(x + dx, 0), mesh.Lx), yc = Math.min(Math.max(y + dy, 0), mesh.H);
    const i = Math.min(Math.floor(xc / a), mesh.nx - 1), k = Math.min(Math.floor(yc / c), mesh.nz - 1);
    const u = (xc - i * a) / a, v = (yc - k * c) / c;
    const share = P / pts.length;
    f[nodeId(mesh, i, k) * DOF] += share * (1 - u) * (1 - v);
    f[nodeId(mesh, i + 1, k) * DOF] += share * u * (1 - v);
    f[nodeId(mesh, i + 1, k + 1) * DOF] += share * u * v;
    f[nodeId(mesh, i, k + 1) * DOF] += share * (1 - u) * v;
  }
  return f;
}

/** Uniform pressure q (N/mm², +w) load vector (consistent bilinear shares). */
export function uniformLoad(mesh: PlateMesh, q: number): Float64Array {
  const f = new Float64Array(nodeCount(mesh) * DOF);
  const a = mesh.Lx / mesh.nx, c = mesh.H / mesh.nz;
  for (let i = 0; i < mesh.nx; i++) for (let k = 0; k < mesh.nz; k++)
    for (const [di, dk] of [[0, 0], [1, 0], [1, 1], [0, 1]]) f[nodeId(mesh, i + di, k + dk) * DOF] += (q * a * c) / 4;
  return f;
}

export function nodalW(mesh: PlateMesh, u: Float64Array): Float32Array {
  const nn = nodeCount(mesh), w = new Float32Array(nn);
  for (let n = 0; n < nn; n++) w[n] = u[n * DOF];
  return w;
}

export const plateRigidity = (E: number, nu: number, t: number) => (E * t ** 3) / (12 * (1 - nu * nu));

// ------------------------------------------------------------------ tool paths
export interface PathStation {
  x: number;
  y: number;
  theta: number; // feed direction, rad
  ae: number; // radial engagement, mm (0 = no cut / link)
  mode: MillingMode;
  fz: number;
  layer: number;
  link: boolean; // positioning move at feed (no material) — or rapid when `rapid`
  rapid: boolean;
  dist: number; // path length from the previous station, mm
}

interface Seg { x0: number; y0: number; x1: number; y1: number; ae: number; side: 'left' | 'right' | 'both'; link?: boolean; rapid?: boolean; fz?: number }

/** Tool-centre segments for one floor layer (centre always within [R, L−R] × [R, W−R]). */
export function pathSegments(p: Pick<ThinFloorParams, 'L' | 'W' | 'D' | 'ae' | 'strategy' | 'fz'>): Seg[] {
  const R = p.D / 2, x0 = R, x1 = p.L - R, y0 = R, y1 = p.W - R;
  const segs: Seg[] = [];
  if (x1 < x0 || y1 < y0) return segs;
  if (p.strategy === 'zigzag' || p.strategy === 'adaptive') {
    const s = p.strategy === 'zigzag' ? Math.min(Math.max(p.ae, 0.05 * p.D), p.D) : Math.min(0.15 * p.D, p.ae);
    const fz = p.strategy === 'adaptive' ? adaptiveFeed(p.fz, s / p.D) : p.fz;
    const ys: number[] = [y0];
    while (ys[ys.length - 1] + s < y1 - 1e-6) ys.push(ys[ys.length - 1] + s);
    if (ys[ys.length - 1] < y1 - 1e-6) ys.push(y1);
    ys.forEach((y, j) => {
      const ae = j === 0 ? (p.strategy === 'zigzag' ? p.D : s) : Math.min(y - ys[j - 1], p.D);
      if (p.strategy === 'zigzag') {
        const fwd = j % 2 === 0;
        if (j > 0) segs.push({ x0: fwd ? x0 : x1, y0: ys[j - 1], x1: fwd ? x0 : x1, y1: y, ae: 0, side: 'left', link: true });
        // uncut material lies at +Y: on the left when travelling +X (up-milling), on the right when travelling −X (climb)
        segs.push({ x0: fwd ? x0 : x1, y0: y, x1: fwd ? x1 : x0, y1: y, ae, side: j === 0 ? 'both' : fwd ? 'left' : 'right', fz });
      } else {
        // one-way climb: travel −X with the uncut material (+Y) on the right; rapid return
        if (j > 0) segs.push({ x0, y0: ys[j - 1], x1, y1: y, ae: 0, side: 'right', link: true, rapid: true });
        segs.push({ x0: x1, y0: y, x1: x0, y1: y, ae, side: 'right', fz });
      }
    });
    return segs;
  }
  // spiral inside-out: centre-line slot, then CCW rings offset by s
  const s = Math.min(Math.max(p.ae, 0.05 * p.D), p.D);
  const cx = p.L / 2, cy = p.W / 2, hx = x1 - cx, hy = y1 - cy;
  const dMax = Math.min(hx, hy);
  const ex0 = hx - dMax, ey0 = hy - dMax;
  segs.push({ x0: cx - ex0, y0: cy - ey0, x1: cx + ex0, y1: cy + ey0, ae: p.D, side: 'both' });
  let prev = 0;
  for (let k = 1; ; k++) {
    const off = Math.min(k * s, dMax);
    const exk = ex0 + off, eyk = ey0 + off, ae = Math.min(off - prev, p.D);
    // radial link from the previous ring corner to this ring's corner
    segs.push({ x0: cx + ex0 + prev, y0: cy - ey0 - prev, x1: cx + exk, y1: cy - eyk, ae: 0, side: 'right', link: true });
    const c = [[cx + exk, cy - eyk], [cx + exk, cy + eyk], [cx - exk, cy + eyk], [cx - exk, cy - eyk], [cx + exk, cy - eyk]];
    for (let j = 0; j < 4; j++) segs.push({ x0: c[j][0], y0: c[j][1], x1: c[j + 1][0], y1: c[j + 1][1], ae, side: 'right' });
    prev = off;
    if (off >= dMax - 1e-9) break;
  }
  return segs;
}

/** Chip-thinning feed compensation: same maximum chip thickness as at ae = D/2, capped at 2.5×. */
export function adaptiveFeed(fz: number, r: number): number {
  const thin = r >= 0.5 ? 1 : 2 * Math.sqrt(Math.max(r * (1 - r), 1e-6));
  return fz * Math.min(1 / thin, 2.5);
}

export function pathLength(segs: Seg[]) {
  let cut = 0, rapid = 0;
  for (const s of segs) { const l = Math.hypot(s.x1 - s.x0, s.y1 - s.y0); if (s.rapid) rapid += l; else cut += l; }
  return { cut, rapid };
}

/** Discretise all layers into stations (spacing chosen so that the total ≤ maxStations). */
export function buildStations(p: ThinFloorParams): { stations: PathStation[]; layers: number; apLayer: number } {
  const segs = pathSegments(p);
  const layers = Math.max(1, Math.min(4, Math.ceil(p.allowance / Math.max(p.ap, 0.05) - 1e-9)));
  const apLayer = p.allowance / layers;
  const len = pathLength(segs).cut;
  const step = Math.max(1.2, (len * layers) / p.maxStations);
  const stations: PathStation[] = [];
  for (let layer = 0; layer < layers; layer++)
    for (const s of segs) {
      const l = Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
      const theta = Math.atan2(s.y1 - s.y0, s.x1 - s.x0);
      if (s.rapid) { stations.push({ x: s.x1, y: s.y1, theta, ae: 0, mode: 'down', fz: p.fz, layer, link: true, rapid: true, dist: l }); continue; }
      const n = Math.max(1, Math.ceil(l / step));
      const mode: MillingMode = s.side === 'left' ? 'up' : 'down';
      for (let j = 0; j <= n; j++) {
        if (j === 0 && stations.length && Math.hypot(stations[stations.length - 1].x - s.x0, stations[stations.length - 1].y - s.y0) < 1e-6) continue;
        const t = j / n;
        stations.push({ x: s.x0 + t * (s.x1 - s.x0), y: s.y0 + t * (s.y1 - s.y0), theta, ae: s.ae, mode, fz: s.fz ?? p.fz, layer, link: !!s.link, rapid: false, dist: j === 0 ? 0 : l / n });
      }
    }
  return { stations, layers, apLayer };
}

// ------------------------------------------------------------------ forces
export interface StationForce {
  /** mean force on the tool, global frame, N */
  Fx: number; Fy: number; Fz: number;
  peak: number; // peak resultant over a revolution, N
  FzPeak: number;
}

/** Side-flute cut parameters (unit axial depth). */
function sideParams(p: ThinFloorParams, st: PathStation, b: number): CutParams {
  return { D: p.D, N: p.N, fz: st.fz, b, ae: Math.max(st.ae, 1e-6), mode: st.mode, K: p.coeffs, helixDeg: p.helixDeg, dz: Math.max(b / 4, 0.02) };
}

/** Mean end-edge axial force (closed form): (N R / 2π)[K_zc fz (cosφst − cosφex) + K_ze (φex − φst)]. */
export function endEdgeMeanFz(p: Pick<ThinFloorParams, 'D' | 'N' | 'Kzc' | 'Kze'>, ae: number, mode: MillingMode, fz: number): number {
  const { phiSt, phiEx } = engagementAngles(p.D, ae, mode);
  const R = p.D / 2;
  return ((p.N * R) / TWO_PI) * (p.Kzc * fz * (Math.cos(phiSt) - Math.cos(phiEx)) + p.Kze * (phiEx - phiSt));
}

/** Instantaneous end-edge axial force at cutter rotation φ. */
export function endEdgeFz(p: Pick<ThinFloorParams, 'D' | 'N' | 'Kzc' | 'Kze'>, ae: number, mode: MillingMode, fz: number, phi: number): number {
  const { phiSt, phiEx } = engagementAngles(p.D, ae, mode);
  let F = 0;
  for (let j = 0; j < p.N; j++) {
    const ph = (((phi + (j * TWO_PI) / p.N) % TWO_PI) + TWO_PI) % TWO_PI;
    if (isEngaged(ph, phiSt, phiEx)) F += (p.Kzc * fz * Math.sin(ph) + p.Kze) * (p.D / 2);
  }
  return F;
}

/** Rotate a feed-frame vector (x along feed, y = left normal) to the global frame. */
export function toGlobal(fx: number, fy: number, theta: number): [number, number] {
  const c = Math.cos(theta), s = Math.sin(theta);
  return [fx * c - fy * s, fx * s + fy * c];
}

/**
 * Mean and peak tool force at a station for engaged depth b (side flutes) plus the end edges.
 * Mean side force is linear in b (closed form); the end-edge term is independent of b (b > 0).
 */
export function stationForce(p: ThinFloorParams, st: PathStation, b: number): StationForce {
  if (st.ae <= 0 || b <= 0) return { Fx: 0, Fy: 0, Fz: 0, peak: 0, FzPeak: 0 };
  const cp = sideParams(p, st, b);
  const m = analyticalMeanForce(cp);
  const [gx, gy] = toGlobal(m.Fx, m.Fy, st.theta);
  const Fz = m.Fz + endEdgeMeanFz(p, st.ae, st.mode, st.fz);
  // peak over one tooth pitch (24 samples)
  let peak = 0, FzPeak = 0;
  for (let j = 0; j < 24; j++) {
    const phi = (j / 24) * (TWO_PI / p.N);
    const F = cutterForce(phi, cp).F;
    const fz = F.Fz + endEdgeFz(p, st.ae, st.mode, st.fz, phi);
    peak = Math.max(peak, Math.hypot(F.Fx, F.Fy, fz));
    FzPeak = Math.max(FzPeak, fz);
  }
  return { Fx: gx, Fy: gy, Fz, peak, FzPeak };
}

// ------------------------------------------------------------------ simulation
export interface FloorStation extends PathStation {
  /** engaged depth after deflection, mm */
  apEff: number;
  force: StationForce;
  /** deflection under the cutter centre (down +), mm */
  wTool: number;
  /** max deflection anywhere on the floor (down +), mm */
  wMax: number;
  /** nodal deflection field (down +), mm */
  w: Float32Array;
  t: number; // cumulative machining time, s
}

export interface FloorSummary {
  meanFz: number; peakF: number; meanFxy: number;
  maxDeflection: number; // instantaneous, mm
  maxErr: number; // max |thickness − t_final|, mm
  meanErr: number;
  minThickness: number;
  maxThickness: number;
  pass: boolean;
  cutTime: number; // s
  mrr: number; // mm³/min
  f1Start: number; f1End: number; ftp: number;
  pathLength: number;
  layers: number;
  lostContact: boolean;
  clipped: boolean;
  warnings: string[];
}

export interface ThinFloorResult {
  params: ThinFloorParams;
  stations: FloorStation[];
  /** final floor-top deviation per cell (mm, + = floor too thick), cell grid nxC × nyC (1 mm) */
  nxC: number; nyC: number;
  err: Float32Array;
  /** station index at which each cell was first cut in each layer (−1 never) */
  firstCut: Int32Array[];
  layers: number; apLayer: number;
  mesh: PlateMesh;
  summary: FloorSummary;
  thicknessStudy: { t: number; w: number }[];
}

/** Compliance (deflection at the cutter, mm/N) and the unit-load field for a disk load at (x, y). */
function unitField(fe: FloorFE, x: number, y: number, R: number) {
  const u = fe.model.chol.solve(diskLoad(fe.mesh, x, y, R, 1));
  const w = nodalW(fe.mesh, u);
  return { w, c: sampleW(fe.mesh, w, x, y) };
}

export function simulateThinFloor(p: ThinFloorParams): ThinFloorResult {
  const { stations: path, layers, apLayer } = buildStations(p);
  const R = p.D / 2;
  const nxC = Math.max(4, Math.round(p.L)), nyC = Math.max(4, Math.round(p.W));
  const cx = p.L / nxC, cy = p.W / nyC;
  const top = new Float32Array(nxC * nyC).fill(p.allowance); // stock top above the final floor, mm
  const firstCut = Array.from({ length: layers }, () => new Int32Array(nxC * nyC).fill(-1));
  const tMin = 0.05;
  let clipped = false, lostContact = false;

  const elemT = () => {
    const t = new Float64Array(p.nx * p.ny);
    const a = p.L / p.nx, c = p.W / p.ny;
    for (let i = 0; i < p.nx; i++) for (let k = 0; k < p.ny; k++) {
      // average stock over the cells inside the element
      let s = 0, n = 0;
      const c0 = Math.floor((i * a) / cx), c1 = Math.max(c0 + 1, Math.ceil(((i + 1) * a) / cx));
      const r0 = Math.floor((k * c) / cy), r1 = Math.max(r0 + 1, Math.ceil(((k + 1) * c) / cy));
      for (let ci = c0; ci < Math.min(c1, nxC); ci++) for (let rj = r0; rj < Math.min(r1, nyC); rj++) { s += top[ci * nyC + rj]; n++; }
      t[i * p.ny + k] = p.tFinal + (n ? s / n : 0);
    }
    return t;
  };
  let fe = buildFloor(p, elemT());
  const f1Start = firstNaturalFrequency(fe.model, 30).f1;
  const out: FloorStation[] = [];
  let time = 0;
  path.forEach((st, si) => {
    if (si > 0 && si % p.refactorEvery === 0) fe = buildFloor(p, elemT());
    const vf = p.rpm * p.N * st.fz; // mm/min
    time += st.rapid ? (st.dist / p.rapid) * 60 : (st.dist / vf) * 60;
    const zb = p.allowance - (st.layer + 1) * apLayer; // tool bottom (undeformed frame)
    // region swept by the cutter bottom since the previous station (capsule of radius R);
    // the engaged material lies at the periphery, not under the centre
    const prev = si > 0 && st.dist > 0 && !st.rapid ? path[si - 1] : st;
    const i0 = Math.max(0, Math.floor((Math.min(st.x, prev.x) - R) / cx)), i1 = Math.min(nxC - 1, Math.floor((Math.max(st.x, prev.x) + R) / cx));
    const j0 = Math.max(0, Math.floor((Math.min(st.y, prev.y) - R) / cy)), j1 = Math.min(nyC - 1, Math.floor((Math.max(st.y, prev.y) + R) / cy));
    const sx = st.x - prev.x, sy = st.y - prev.y, s2 = sx * sx + sy * sy;
    const inDisk = (i: number, j: number) => {
      const x = (i + 0.5) * cx, y = (j + 0.5) * cy;
      const tt = s2 > 0 ? Math.min(Math.max(((x - prev.x) * sx + (y - prev.y) * sy) / s2, 0), 1) : 0;
      return (x - prev.x - tt * sx) ** 2 + (y - prev.y - tt * sy) ** 2 <= R * R;
    };
    let stock = 0;
    if (st.ae > 0 && !st.link) for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (inDisk(i, j)) stock = Math.max(stock, top[i * nyC + j] - zb);
    let force: StationForce = { Fx: 0, Fy: 0, Fz: 0, peak: 0, FzPeak: 0 };
    let w = new Float32Array(nodeCount(fe.mesh)), wTool = 0, apEff = 0;
    if (stock > 1e-6) {
      const uf = unitField(fe, st.x, st.y, R);
      // Fz(b) = a·b + e (linear in the engaged depth b)
      const aCoef = analyticalMeanForce(sideParams(p, st, 1)).Fz;
      const eCoef = endEdgeMeanFz(p, st.ae, st.mode, st.fz);
      // workpiece load = −Fz_tool (downward when Fz_tool > 0) → plate w (down +) = c·Fz_tool
      let delta = (uf.c * (aCoef * stock + eCoef)) / (1 + uf.c * aCoef);
      apEff = stock - delta;
      if (apEff <= 0) { apEff = 0; delta = uf.c * eCoef; lostContact = true; }
      force = stationForce(p, st, Math.max(apEff, 1e-6));
      if (apEff <= 0) force = { ...force, Fz: eCoef, Fx: 0, Fy: 0 };
      const scale = force.Fz;
      w = uf.w.map((v) => v * scale) as Float32Array;
      wTool = sampleW(fe.mesh, w, st.x, st.y);
      // surface generation under the footprint: top = min(top, zb + δ(x, y))
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        if (!inDisk(i, j)) continue;
        const x = (i + 0.5) * cx, y = (j + 0.5) * cy;
        let g = zb + sampleW(fe.mesh, w, x, y);
        if (p.tFinal + g < tMin) { g = tMin - p.tFinal; clipped = true; }
        const idx = i * nyC + j;
        if (g < top[idx]) top[idx] = g;
        if (firstCut[st.layer][idx] < 0) firstCut[st.layer][idx] = out.length;
      }
    } else if (!st.rapid) {
      // link moves at feed (e.g. along a wall) and passes with no stock left: the footprint still
      // sweeps the floor; the engagement is negligible, so the surface is generated at z_b (no load)
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        if (!inDisk(i, j)) continue;
        const idx = i * nyC + j;
        if (zb < top[idx]) top[idx] = zb;
        if (firstCut[st.layer][idx] < 0) firstCut[st.layer][idx] = out.length;
      }
    }
    let wMax = 0;
    for (let n = 0; n < w.length; n++) wMax = Math.max(wMax, Math.abs(w[n]));
    out.push({ ...st, apEff, force, wTool, wMax, w, t: time });
  });
  fe = buildFloor(p, elemT());
  const f1End = firstNaturalFrequency(fe.model, 30).f1;

  // deviation map; cells the flat-bottom cutter cannot reach (corner fillets of radius R) are NaN
  const err = new Float32Array(top);
  const Rm = R + 0.5 * Math.hypot(cx, cy);
  let maxErr = 0, sumErr = 0, minT = Infinity, maxT = -Infinity, nIn = 0;
  for (let n = 0; n < err.length; n++) {
    const x = (Math.floor(n / nyC) + 0.5) * cx, y = ((n % nyC) + 0.5) * cy;
    const dx = Math.max(R - x, 0, x - (p.L - R)), dy = Math.max(R - y, 0, y - (p.W - R));
    if (Math.hypot(dx, dy) > Rm - 0.5 * Math.hypot(cx, cy) && dx > 0 && dy > 0) { err[n] = NaN; continue; }
    nIn++;
    maxErr = Math.max(maxErr, Math.abs(err[n])); sumErr += Math.abs(err[n]); minT = Math.min(minT, p.tFinal + err[n]); maxT = Math.max(maxT, p.tFinal + err[n]);
  }
  const cutting = out.filter((s) => s.force.peak > 0);
  const meanFz = cutting.length ? cutting.reduce((a, s) => a + s.force.Fz, 0) / cutting.length : 0;
  const meanFxy = cutting.length ? cutting.reduce((a, s) => a + Math.hypot(s.force.Fx, s.force.Fy), 0) / cutting.length : 0;
  const peakF = Math.max(0, ...cutting.map((s) => s.force.peak));
  const maxDeflection = Math.max(0, ...out.map((s) => s.wMax));
  const ftp = (p.rpm * p.N) / 60;
  const removed = p.allowance * p.L * p.W;
  const segsLen = pathLength(pathSegments(p));
  const warnings: string[] = [];
  const pass = maxErr <= p.tol + 1e-12;
  if (!pass) warnings.push(`Floor thickness error ${(maxErr * 1000).toFixed(0)} µm exceeds the ±${(p.tol * 1000).toFixed(0)} µm tolerance.`);
  if (f1End < 3 * ftp) warnings.push(`Floor natural frequency (${f1End.toFixed(0)} Hz) is less than 3 × the tooth-passing frequency (${ftp.toFixed(0)} Hz): dynamic amplification is possible and the quasi-static model may under-predict deflection.`);
  if (maxDeflection > 0.3 * p.tFinal) warnings.push(`Peak deflection (${(maxDeflection * 1000).toFixed(0)} µm) exceeds 30 % of the floor thickness: linear small-deflection plate theory is questionable.`);
  if (lostContact) warnings.push('The floor deflects more than the depth of cut at some stations: the tool loses contact and leaves uncut material (only edge rubbing remains).');
  if (clipped) warnings.push(`Generated thickness clipped at ${tMin} mm: the predicted cut would break through the floor.`);
  if (p.coeffSource !== 'calibrated') warnings.push('Cutting and end-edge axial coefficients are illustrative; the deflection scales directly with the axial force.');
  return {
    params: p, stations: out, nxC, nyC, err, firstCut, layers, apLayer, mesh: fe.mesh,
    summary: {
      meanFz, peakF, meanFxy, maxDeflection, maxErr, meanErr: sumErr / Math.max(nIn, 1), minThickness: minT, maxThickness: maxT, pass,
      cutTime: time, mrr: time > 0 ? removed / (time / 60) : 0, f1Start, f1End, ftp, pathLength: segsLen.cut * layers, layers, lostContact, clipped, warnings,
    },
    thicknessStudy: thicknessStudy(p, meanFz),
  };
}

/** Deflection at the pocket centre for a disk load equal to the mean axial force, t = 1…4 mm. */
export function thicknessStudy(p: ThinFloorParams, Fz: number): { t: number; w: number }[] {
  const ts = [1, 1.25, 1.5, 2, 2.5, 3, 4];
  return ts.map((t) => {
    const fe = buildFloor({ ...p, tFinal: t, nx: Math.min(p.nx, 24), ny: Math.min(p.ny, 18) }, new Float64Array(Math.min(p.nx, 24) * Math.min(p.ny, 18)).fill(t));
    const u = fe.model.chol.solve(diskLoad(fe.mesh, p.L / 2, p.W / 2, p.D / 2, Fz));
    return { t, w: sampleW(fe.mesh, nodalW(fe.mesh, u), p.L / 2, p.W / 2) };
  });
}

/** Simulated final thickness (mm) at (x, y) from the deviation map (nearest cell; NaN in uncut corner fillets). */
export function thicknessAt(r: ThinFloorResult, x: number, y: number): number {
  const i = Math.min(Math.max(Math.floor((x / r.params.L) * r.nxC), 0), r.nxC - 1);
  const j = Math.min(Math.max(Math.floor((y / r.params.W) * r.nyC), 0), r.nyC - 1);
  return r.params.tFinal + r.err[i * r.nyC + j];
}

/** Strategy comparison (summaries only). */
export function compareStrategies(p: ThinFloorParams): { strategy: Strategy; maxErr: number; maxDeflection: number; cutTime: number; meanFz: number; pass: boolean }[] {
  return (['zigzag', 'spiral', 'adaptive'] as Strategy[]).map((s) => {
    const r = simulateThinFloor({ ...p, strategy: s, maxStations: Math.min(p.maxStations, 320) });
    return { strategy: s, maxErr: r.summary.maxErr, maxDeflection: r.summary.maxDeflection, cutTime: r.summary.cutTime, meanFz: r.summary.meanFz, pass: r.summary.pass };
  });
}
