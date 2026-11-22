/**
 * Module 4 — Cutting-force components in CNC turning of slender shafts.
 *
 * LATHE COORDINATE FRAME (ISO 841, two-axis lathe with the tool on the +X side):
 *   Z : spindle axis, from the chuck face (Z = 0) toward the tailstock (Z = L)
 *   X : radial, positive from the spindle axis toward the tool (CNC programs X as a diameter)
 *   Y : completes the right-handed set; the workpiece surface passes the tool in −Y
 *
 * FORCES ON THE TOOL (ISO 3002-4 components):
 *   Fc  cutting (tangential) force  — along −Y (the moving surface drags the tool)
 *   Ff  feed force                  — along Z, opposing the feed motion of the tool
 *   Fp  passive (radial) force      — along +X (pushes the tool away from the axis)
 * The workpiece receives the equal and opposite forces: Fp pushes the shaft AWAY from the tool.
 *
 * FORCE MODEL (linear edge model on an equivalent straight edge):
 *   The tool has entering angle κr and nose radius rε. The engaged edge (nose arc + straight
 *   edge) is replaced by its chord from the bottom of the nose to the point where the edge
 *   leaves the uncut surface (equivalent entering angle κe ≤ κr; cf. Colwell's chip-flow idea).
 *   Uncut chip thickness h = f·sin κe and chip width b = ap / sin κe, so b·h = ap·f.
 *     Fc = Ktc·b·h + Kte·b,   FN = Krc·b·h + Kre·b   (normal to the equivalent edge)
 *     Ff = FN·sin κe,         Fp = FN·cos κe
 *   With small depths (ap < rε(1 − cos κr)) the whole cut is on the nose: κe is small, so the
 *   PASSIVE force is large relative to the feed force — the finishing-pass situation.
 *
 * SHAFT MODEL: Euler–Bernoulli beam finite elements (2 DOF/node), element diameter from the
 * current stock (stiffness updated at every station), supports as springs: chuck (translation
 * + rotation), tailstock / centres (translation), optional steady rest (translation).
 * Tool and turret compliance: translational spring kTool in X.
 *
 * SURFACE GENERATION (same coupling as Modules 1–3): the radial depth actually cut is ap − e,
 *   e = (C_shaft(z) + 1/kTool) · Fp(ap − e),   generated diameter = d_target + 2e.
 * The tangential force Fc deflects the shaft in Y; its effect on the radius is second order
 * (≈ δy² / (2r)) and is reported separately.
 */
import { MATERIALS, type CoeffSource, type CuttingCoefficients, type MaterialId } from './materials';
import { BandCholesky, BandMatrix } from './plateFE';

export type Workholding = 'chuck' | 'chuck-tailstock' | 'centres';
export type TurnStrategy = 'single' | 'spring-pass' | 'rough-finish';
export type FeedDir = 'toward-chuck' | 'away-from-chuck';

export interface TurningParams {
  materialId: MaterialId;
  coeffs: CuttingCoefficients;
  coeffSource: CoeffSource;
  /** raw bar diameter, mm */
  d0: number;
  /** finished diameter, mm */
  dT: number;
  /** shaft length from chuck face to tailstock end, mm */
  L: number;
  /** turned length measured from the free / tailstock end, mm */
  cutLength: number;
  vc: number; // m/min
  f: number; // mm/rev
  kappa: number; // entering angle, deg
  noseR: number; // mm
  workholding: Workholding;
  chuckRigid: boolean;
  chuckKT: number; // N/mm
  chuckKR: number; // N·mm/rad
  tailK: number; // N/mm (tailstock live centre or tail centre)
  headCentreK: number; // N/mm (between centres)
  steadyRest: boolean;
  steadyZ: number; // mm from chuck
  steadyK: number; // N/mm
  kTool: number; // N/mm
  strategy: TurnStrategy;
  finishAllowance: number; // radial, mm (rough-finish)
  feedDir: FeedDir;
  tolerance: number; // ± on diameter, mm
  machinePower: number; // kW
  elements: number;
  stationStep: number;
}

export const DEFAULT_TURNING: TurningParams = {
  materialId: 'aisi1045',
  coeffs: { ...MATERIALS.aisi1045.coeffs },
  coeffSource: 'illustrative',
  d0: 25,
  dT: 24,
  L: 300,
  cutLength: 280,
  vc: 180,
  f: 0.15,
  kappa: 93,
  noseR: 0.8,
  workholding: 'chuck-tailstock',
  chuckRigid: false,
  chuckKT: 1e5,
  chuckKR: 1e8,
  tailK: 2e4,
  headCentreK: 5e4,
  steadyRest: false,
  steadyZ: 150,
  steadyK: 3e4,
  kTool: 3e4,
  strategy: 'single',
  finishAllowance: 0.2,
  feedDir: 'toward-chuck',
  tolerance: 0.02,
  machinePower: 11,
  elements: 60,
  stationStep: 2,
};

// ------------------------------------------------------------------ cutting forces
const DEG = Math.PI / 180;

/**
 * Equivalent entering angle (rad) of the engaged edge for depth ap.
 * Edge geometry in the tool reference plane: u along the feed direction, v = depth below the
 * uncut-to-machined transition. The nose arc t ∈ [0, κr] has points (rε sin t, rε (1 − cos t))
 * and is tangent to the straight edge (direction (cos κr, sin κr)) at t = κr.
 * The equivalent edge is the chord from the bottom of the nose to the point at depth ap.
 */
export function equivalentKappa(ap: number, kappaDeg: number, noseR: number): number {
  const kr = Math.min(Math.max(kappaDeg, 1), 179) * DEG;
  if (noseR <= 1e-9 || ap <= 0) return kr;
  const vArcTop = noseR * (1 - Math.cos(kr));
  let u: number;
  if (ap <= vArcTop) {
    u = noseR * Math.sin(Math.acos(1 - ap / noseR));
  } else {
    const s = (ap - vArcTop) / Math.sin(kr);
    u = noseR * Math.sin(kr) + s * Math.cos(kr);
  }
  return Math.atan2(ap, u);
}

export interface TurningForces {
  kappaE: number; // rad
  h: number; // mm
  b: number; // mm
  Fc: number; // N (magnitude)
  Ff: number;
  Fp: number;
  FN: number;
}

export function turningForces(ap: number, f: number, kappaDeg: number, noseR: number, K: CuttingCoefficients): TurningForces {
  if (ap <= 0 || f <= 0) return { kappaE: kappaDeg * DEG, h: 0, b: 0, Fc: 0, Ff: 0, Fp: 0, FN: 0 };
  const ke = equivalentKappa(ap, kappaDeg, noseR);
  const s = Math.max(Math.sin(ke), 1e-6);
  const h = f * s, b = ap / s;
  const Fc = K.Ktc * b * h + K.Kte * b;
  const FN = K.Krc * b * h + K.Kre * b;
  return { kappaE: ke, h, b, Fc, Ff: FN * Math.sin(ke), Fp: FN * Math.cos(ke), FN };
}

/** Spindle speed for cutting speed vc at diameter d, rpm. */
export const spindleSpeed = (vc: number, d: number) => (1000 * vc) / (Math.PI * d);
/** Cutting power, kW:  Pc = Fc · vc / 60 000. */
export const cuttingPower = (Fc: number, vc: number) => (Fc * vc) / 60_000;
/** Theoretical (kinematic) roughness, µm:  Ra ≈ f² / (32 rε),  Rz ≈ f² / (8 rε). */
export const theoreticalRa = (f: number, noseR: number) => (noseR > 0 ? ((f * f) / (32 * noseR)) * 1000 : NaN);
export const theoreticalRz = (f: number, noseR: number) => (noseR > 0 ? ((f * f) / (8 * noseR)) * 1000 : NaN);
/** Material removal rate in turning, cm³/min:  Q = vc · ap · f. */
export const turningMRR = (vc: number, ap: number, f: number) => vc * ap * f;

// ------------------------------------------------------------------ shaft beam FE
export interface ShaftModel {
  nodes: Float64Array; // z of nodes
  chol: BandCholesky;
  K: BandMatrix;
}

export interface Supports {
  workholding: Workholding;
  chuckRigid: boolean;
  chuckKT: number;
  chuckKR: number;
  tailK: number;
  headCentreK: number;
  steadyRest: boolean;
  steadyZ: number;
  steadyK: number;
}

/** Build the beam model; diameterAt(z) gives the current local diameter. */
export function buildShaft(L: number, nEl: number, E: number, diameterAt: (z: number) => number, s: Supports): ShaftModel {
  const nN = nEl + 1;
  const nodes = new Float64Array(nN);
  for (let i = 0; i < nN; i++) nodes[i] = (L * i) / nEl;
  const K = new BandMatrix(2 * nN, 3);
  const l = L / nEl;
  for (let e = 0; e < nEl; e++) {
    // element diameter: mean of three samples
    const z0 = nodes[e];
    const d = (diameterAt(z0 + 0.17 * l) + diameterAt(z0 + 0.5 * l) + diameterAt(z0 + 0.83 * l)) / 3;
    const EI = E * (Math.PI * d ** 4) / 64;
    const c = EI / l ** 3;
    const k = [
      [12, 6 * l, -12, 6 * l],
      [6 * l, 4 * l * l, -6 * l, 2 * l * l],
      [-12, -6 * l, 12, -6 * l],
      [6 * l, 2 * l * l, -6 * l, 4 * l * l],
    ];
    const dof = [2 * e, 2 * e + 1, 2 * e + 2, 2 * e + 3];
    for (let a = 0; a < 4; a++) for (let b = 0; b <= a; b++) K.add(dof[a], dof[b], c * k[a][b]);
  }
  const big = 1e12;
  const last = 2 * (nN - 1);
  if (s.workholding === 'chuck' || s.workholding === 'chuck-tailstock') {
    K.add(0, 0, s.chuckRigid ? big : s.chuckKT);
    K.add(1, 1, s.chuckRigid ? big : s.chuckKR);
  } else {
    K.add(0, 0, s.headCentreK);
  }
  if (s.workholding !== 'chuck') K.add(last, last, s.tailK);
  if (s.steadyRest) {
    // spring at the nearest node
    const i = Math.min(Math.max(Math.round((s.steadyZ / L) * nEl), 0), nEl);
    K.add(2 * i, 2 * i, s.steadyK);
  }
  return { nodes, K, chol: new BandCholesky(K) };
}

/** Hermite shape functions on an element of length l at local ξ ∈ [0, 1]. */
function hermite(xi: number, l: number) {
  return [1 - 3 * xi * xi + 2 * xi ** 3, l * (xi - 2 * xi * xi + xi ** 3), 3 * xi * xi - 2 * xi ** 3, l * (-xi * xi + xi ** 3)];
}

function locate(m: ShaftModel, z: number) {
  const nEl = m.nodes.length - 1;
  const L = m.nodes[nEl];
  const l = L / nEl;
  const zc = Math.min(Math.max(z, 0), L);
  const e = Math.min(Math.floor(zc / l), nEl - 1);
  return { e, xi: (zc - e * l) / l, l };
}

/** Deflection field (nodal v, θ) for a point load P at z. */
export function solvePointLoad(m: ShaftModel, z: number, P: number): Float64Array {
  const f = new Float64Array(m.K.n);
  const { e, xi, l } = locate(m, z);
  const N = hermite(xi, l);
  for (let a = 0; a < 4; a++) f[2 * e + a] += N[a] * P;
  return m.chol.solve(f);
}

export function deflectionAt(m: ShaftModel, u: Float64Array, z: number): number {
  const { e, xi, l } = locate(m, z);
  const N = hermite(xi, l);
  return N[0] * u[2 * e] + N[1] * u[2 * e + 1] + N[2] * u[2 * e + 2] + N[3] * u[2 * e + 3];
}

/** Shaft first bending frequency (Hz), Rayleigh's method with the self-weight shape. */
export function shaftNaturalFrequency(m: ShaftModel, diameterAt: (z: number) => number, rho: number): number {
  const nN = m.nodes.length;
  const l = m.nodes[1] - m.nodes[0];
  const g = 9810;
  const f = new Float64Array(m.K.n);
  const mass = new Float64Array(nN);
  for (let i = 0; i < nN; i++) {
    const d = diameterAt(m.nodes[i]);
    const w = i === 0 || i === nN - 1 ? 0.5 : 1;
    mass[i] = rho * 1e-12 * ((Math.PI * d * d) / 4) * l * w;
    f[2 * i] = mass[i] * g;
  }
  const u = m.chol.solve(f);
  let num = 0, den = 0;
  for (let i = 0; i < nN; i++) { num += mass[i] * g * u[2 * i]; den += mass[i] * u[2 * i] ** 2; }
  return Math.sqrt(num / den) / (2 * Math.PI);
}

// ------------------------------------------------------------------ process
export interface TurnPass {
  index: number;
  kind: 'rough' | 'finish' | 'spring';
  target: number; // target diameter, mm
  zStart: number;
  zEnd: number;
  firstStation: number;
  lastStation: number;
}

export interface TurnStation {
  pass: number;
  z: number;
  ap: number; // nominal radial depth, mm
  apEff: number;
  kappaE: number; // rad
  Fc: number;
  Ff: number;
  Fp: number;
  power: number; // kW
  shaftDefl: number; // X, mm (away from tool)
  shaftDeflY: number; // Y from Fc, mm
  toolDefl: number; // mm
  e: number; // radial error (material left), mm
  /** nodal X deflection of the shaft per +1 N radial load at z (for the deflected-shape view) */
  unitShape: Float32Array;
  edits: { idx: Int32Array; val: Float32Array };
  time: number;
}

export interface TurnSummary {
  rpm: number;
  feedRate: number; // mm/min
  mrr: number; // cm³/min (finishing pass nominal)
  cycleTime: number; // s
  maxFc: number;
  maxFf: number;
  maxFp: number;
  maxPower: number;
  torque: number; // N·m at max Fc
  ra: number; // µm
  rz: number;
  maxShaftDefl: number;
  maxShaftDeflY: number;
  radiusEffectY: number; // mm, second-order effect of Y deflection on the radius
  devMin: number; // diameter deviation over the turned length, mm
  devMax: number;
  cylindricity: number; // devMax − devMin
  inTolFraction: number;
  slenderness: number; // L/D
  shaftF1: number;
  volumeBalanceError: number;
  warnings: string[];
}

export interface TurnResult {
  params: TurningParams;
  nodes: Float64Array;
  passes: TurnPass[];
  stations: TurnStation[];
  dz: number;
  dia0: Float32Array;
  diaFinal: Float32Array;
  summary: TurnSummary;
}

export function supportsOf(p: TurningParams): Supports {
  return {
    workholding: p.workholding, chuckRigid: p.chuckRigid, chuckKT: p.chuckKT, chuckKR: p.chuckKR, tailK: p.tailK,
    headCentreK: p.headCentreK, steadyRest: p.steadyRest, steadyZ: p.steadyZ, steadyK: p.steadyK,
  };
}

export function simulateTurning(p: TurningParams): TurnResult {
  const mat = MATERIALS[p.materialId];
  const dz = 1;
  const nZ = Math.round(p.L / dz) + 1;
  const dia = new Float32Array(nZ).fill(p.d0);
  const dia0 = new Float32Array(dia);
  const diaAt = (z: number) => { const i = Math.min(Math.max(Math.round(z / dz), 0), nZ - 1); return dia[i]; };
  const zFree = p.L - 2; // start 2 mm inside the free / tailstock end
  const zFar = Math.max(zFree - p.cutLength, 2);
  const [zA, zB] = p.feedDir === 'toward-chuck' ? [zFree, zFar] : [zFar, zFree];
  const targets: { kind: TurnPass['kind']; target: number }[] =
    p.strategy === 'rough-finish' ? [{ kind: 'rough', target: p.dT + 2 * p.finishAllowance }, { kind: 'finish', target: p.dT }]
    : p.strategy === 'spring-pass' ? [{ kind: 'finish', target: p.dT }, { kind: 'spring', target: p.dT }]
    : [{ kind: 'finish', target: p.dT }];
  const sup = supportsOf(p);
  const passes: TurnPass[] = [];
  const stations: TurnStation[] = [];
  const rpm = spindleSpeed(p.vc, p.d0);
  const vfeed = p.f * rpm; // mm/min
  let time = 0, removed = 0;
  const vol = () => { let v = 0; for (let i = 0; i < nZ; i++) v += (Math.PI / 4) * dia[i] ** 2 * dz; return v; };
  const vol0 = vol();

  targets.forEach((tg, pi) => {
    const pass: TurnPass = { index: pi, kind: tg.kind, target: tg.target, zStart: zA, zEnd: zB, firstStation: stations.length, lastStation: -1 };
    const nSt = Math.max(2, Math.round(Math.abs(zB - zA) / p.stationStep) + 1);
    for (let si = 0; si < nSt; si++) {
      const z = zA + ((zB - zA) * si) / (nSt - 1);
      const shaft = buildShaft(p.L, p.elements, mat.E, diaAt, sup);
      const u = solvePointLoad(shaft, z, 1);
      const cShaft = deflectionAt(shaft, u, z);
      const c = cShaft + 1 / p.kTool;
      const ap = Math.max((diaAt(z) - tg.target) / 2, 0);
      // coupled solution  e = c · Fp(ap − e),  bracketed bisection (Fp grows with depth)
      let e = 0, F = turningForces(0, p.f, p.kappa, p.noseR, p.coeffs);
      if (ap > 1e-9) {
        let lo = 0, hi = ap;
        for (let it = 0; it < 40; it++) {
          const mid = 0.5 * (lo + hi);
          const Fm = turningForces(ap - mid, p.f, p.kappa, p.noseR, p.coeffs);
          if (mid - c * Fm.Fp > 0) hi = mid; else lo = mid;
        }
        e = 0.5 * (lo + hi);
        F = turningForces(ap - e, p.f, p.kappa, p.noseR, p.coeffs);
      }
      // cut the stock in this station's z-interval
      const half = (Math.abs(zB - zA) / (nSt - 1)) / 2;
      const i0 = Math.max(0, Math.ceil((z - half) / dz)), i1 = Math.min(nZ - 1, Math.floor((z + half) / dz - 1e-9));
      const newD = tg.target + 2 * e;
      const idx: number[] = [], val: number[] = [];
      for (let i = i0; i <= i1; i++) {
        if (dia[i] > newD) {
          removed += (Math.PI / 4) * (dia[i] ** 2 - newD ** 2) * dz;
          dia[i] = newD; idx.push(i); val.push(newD);
        }
      }
      const unitShape = new Float32Array(shaft.nodes.length);
      for (let n = 0; n < shaft.nodes.length; n++) unitShape[n] = u[2 * n];
      time += si === 0 ? 0 : (Math.abs(zB - zA) / (nSt - 1) / vfeed) * 60;
      stations.push({
        pass: pi, z, ap, apEff: Math.max(ap - e, 0), kappaE: F.kappaE, Fc: F.Fc, Ff: F.Ff, Fp: F.Fp,
        power: cuttingPower(F.Fc, p.vc), shaftDefl: cShaft * F.Fp, shaftDeflY: cShaft * F.Fc, toolDefl: F.Fp / p.kTool, e,
        unitShape, edits: { idx: Int32Array.from(idx), val: Float32Array.from(val) }, time,
      });
    }
    pass.lastStation = stations.length - 1;
    passes.push(pass);
  });

  // ---------------- summary over the turned length
  const zLo = Math.min(zA, zB), zHi = Math.max(zA, zB);
  let devMin = Infinity, devMax = -Infinity, inTol = 0, nIn = 0;
  for (let i = 0; i < nZ; i++) {
    const z = i * dz;
    if (z < zLo + 1 || z > zHi - 1) continue;
    const dv = dia[i] - p.dT;
    devMin = Math.min(devMin, dv); devMax = Math.max(devMax, dv); nIn++;
    if (Math.abs(dv) <= p.tolerance + 1e-9) inTol++;
  }
  const fin = stations.filter((s) => passes[s.pass].kind !== 'rough');
  const maxBy = (k: keyof TurnStation, arr = stations) => Math.max(0, ...arr.map((s) => Math.abs(s[k] as number)));
  const maxFc = maxBy('Fc');
  const finalShaft = buildShaft(p.L, p.elements, mat.E, diaAt, sup);
  const shaftF1 = shaftNaturalFrequency(finalShaft, diaAt, mat.rho);
  const slenderness = p.L / p.dT;
  const maxPower = maxBy('power');
  const maxY = maxBy('shaftDeflY');
  const warnings: string[] = [];
  if (p.workholding === 'chuck' && slenderness > 6)
    warnings.push(`L/D = ${slenderness.toFixed(1)} held in the chuck only: common practice is tailstock support above L/D ≈ 4–6.`);
  if (slenderness > 20 && !p.steadyRest)
    warnings.push(`L/D = ${slenderness.toFixed(1)} > 20: a steady rest (or follow rest) is normally required.`);
  if (maxPower > p.machinePower) warnings.push(`Peak cutting power ${maxPower.toFixed(1)} kW exceeds the spindle power ${p.machinePower} kW.`);
  if (p.dT >= p.d0) warnings.push('Finished diameter must be smaller than the bar diameter.');
  if (p.strategy === 'rough-finish' && p.dT + 2 * p.finishAllowance >= p.d0) warnings.push('Finishing allowance leaves nothing for the roughing pass.');
  const apFin = (p.d0 - p.dT) / 2;
  if (p.noseR > 0 && apFin < p.noseR * (1 - Math.cos(Math.min(p.kappa, 90) * DEG)))
    warnings.push(`Depth of cut ${apFin.toFixed(2)} mm is within the nose radius (${p.noseR} mm): the passive force Fp is relatively large (equivalent entering angle ${(fin[0]?.kappaE / DEG || 0).toFixed(0)}°).`);
  if (p.f > 0.8 * p.noseR) warnings.push('Feed is large relative to the nose radius: poor surface finish and edge loading.');
  if (p.coeffSource !== 'calibrated') warnings.push(`Cutting coefficients are ${p.coeffSource} (milling-derived values used for turning); force magnitudes are estimates.`);

  return {
    params: p, nodes: finalShaft.nodes, passes, stations, dz, dia0, diaFinal: dia,
    summary: {
      rpm, feedRate: vfeed, mrr: turningMRR(p.vc, apFin, p.f), cycleTime: time,
      maxFc, maxFf: maxBy('Ff'), maxFp: maxBy('Fp'), maxPower, torque: (maxFc * p.d0) / 2 / 1000,
      ra: theoreticalRa(p.f, p.noseR), rz: theoreticalRz(p.f, p.noseR),
      maxShaftDefl: maxBy('shaftDefl'), maxShaftDeflY: maxY, radiusEffectY: (maxY * maxY) / (2 * (p.dT / 2)),
      devMin: Number.isFinite(devMin) ? devMin : 0, devMax: Number.isFinite(devMax) ? devMax : 0,
      cylindricity: Number.isFinite(devMax) ? devMax - devMin : 0, inTolFraction: nIn ? inTol / nIn : 0,
      slenderness, shaftF1, volumeBalanceError: vol0 - vol() - removed, warnings,
    },
  };
}

export function turnStockAt(res: TurnResult, upTo: number, target?: Float32Array): Float32Array {
  const d = target ?? new Float32Array(res.dia0);
  if (target) d.set(res.dia0);
  for (let q = 0; q <= upTo && q < res.stations.length; q++) {
    const e = res.stations[q].edits;
    for (let j = 0; j < e.idx.length; j++) d[e.idx[j]] = e.val[j];
  }
  return d;
}
