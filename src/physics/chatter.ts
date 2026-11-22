/**
 * Module 3 — Chatter and dynamic instability in milling.
 *
 * This is a DYNAMIC model, separate from the quasi-static models of Modules 1–2.
 *
 * Structure: the tool is flexible in the feed (x) and normal (y) directions of the feed frame,
 * each a single-degree-of-freedom mode  m q̈ + c q̇ + k q = F  (fn, ζ, k). The workpiece is rigid.
 *
 * Regenerative chip thickness (tooth j, immersion φj, n = (sin φj, cos φj)):
 *   h_j(t) = [ fz sin φj + (d(t) − d(t − T)) · n ] · g(φj),   T = 60/(n_s N) (tooth period)
 * where d = (x, y) is the tool displacement and g = 1 inside the engagement arc and h > 0
 * (the tooth leaves the cut when h ≤ 0 — the nonlinearity that bounds chatter amplitude).
 *
 * Two independent stability methods:
 *  1. Zero-order approximation (ZOA) of the stability lobes (Altintas–Budak): the time-varying
 *     directional coefficients are replaced by their average over the tooth period:
 *        det( I + Λ [α0][Φ(iωc)] ) = 0,   Λ = −(N/4π) a Kt (1 − e^{−iωc T})
 *        a_lim = −(2π ΛR / (N Kt)) (1 + κ²),  κ = ΛI/ΛR,  ψ = atan κ,  ε = π − 2ψ,
 *        T = (ε + 2kπ)/ωc,  n = 60/(N T)
 *     ZOA is accurate for moderate–high radial immersion; it misses the extra flip (period-
 *     doubling) lobes that appear at very low immersion.
 *  2. Time-domain simulation of the delay equation with the exact discrete state-transition
 *     of each mode (zero-order hold on the force) and the tooth jump-out nonlinearity.
 *     Chatter is detected from the motion itself, NOT from a force threshold:
 *       • once-per-tooth sampling: forced (stable) vibration is periodic at the tooth period, so
 *         samples converge to a point; chatter adds a non-synchronous component and the samples
 *         scatter;
 *       • spectrum: forced vibration lives at tooth-passing harmonics k·f_tp; chatter shows a
 *         dominant peak away from them, near a natural frequency.
 */
import { MATERIALS, type CoeffSource, type CuttingCoefficients, type MaterialId } from './materials';
import { engagementAngles, wrapAngle, isEngaged, TWO_PI, type MillingMode, feedRate } from './millingForce';

export interface Mode {
  /** natural frequency, Hz */
  fn: number;
  /** damping ratio */
  zeta: number;
  /** static stiffness, N/mm */
  k: number;
}

export interface ChatterParams {
  materialId: MaterialId;
  coeffs: CuttingCoefficients;
  coeffSource: CoeffSource;
  D: number;
  N: number;
  mode: MillingMode;
  ae: number;
  ap: number;
  rpm: number;
  fz: number;
  modeX: Mode;
  modeY: Mode;
  symmetric: boolean;
  rpmMin: number;
  rpmMax: number;
  /** tooth periods simulated in the time domain */
  simTeeth: number;
  stepsPerTooth: number;
}

export const DEFAULT_CHATTER: ChatterParams = {
  materialId: 'al7075',
  coeffs: { ...MATERIALS.al7075.coeffs },
  coeffSource: 'illustrative',
  D: 16,
  N: 4,
  mode: 'down',
  ae: 8,
  ap: 2,
  rpm: 9000,
  fz: 0.08,
  modeX: { fn: 600, zeta: 0.03, k: 5600 },
  modeY: { fn: 600, zeta: 0.03, k: 5600 },
  symmetric: true,
  rpmMin: 2000,
  rpmMax: 20000,
  simTeeth: 240,
  stepsPerTooth: 64,
};

// ------------------------------------------------------------------ complex helpers
export type C = [number, number];
const cadd = (a: C, b: C): C => [a[0] + b[0], a[1] + b[1]];
const csub = (a: C, b: C): C => [a[0] - b[0], a[1] - b[1]];
const cmul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cdiv = (a: C, b: C): C => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
const csqrt = (a: C): C => { const r = Math.hypot(a[0], a[1]); const re = Math.sqrt((r + a[0]) / 2); const im = Math.sign(a[1] || 1) * Math.sqrt(Math.max(r - a[0], 0) / 2); return [re, im]; };
const cscale = (a: C, s: number): C => [a[0] * s, a[1] * s];

/** Receptance of one mode at frequency f (Hz), mm/N. */
export function frf(m: Mode, f: number): C {
  const r = f / m.fn;
  return cdiv([1, 0], [m.k * (1 - r * r), m.k * 2 * m.zeta * r]);
}

/** Average directional coefficients over the engagement arc (Altintas), Kr = Krc/Ktc. */
export function directional(phiSt: number, phiEx: number, Kr: number) {
  const F = (f: number) => ({
    xx: 0.5 * (Math.cos(2 * f) - 2 * Kr * f + Kr * Math.sin(2 * f)),
    xy: 0.5 * (-Math.sin(2 * f) - 2 * f + Kr * Math.cos(2 * f)),
    yx: 0.5 * (-Math.sin(2 * f) + 2 * f + Kr * Math.cos(2 * f)),
    yy: 0.5 * (-Math.cos(2 * f) - 2 * Kr * f - Kr * Math.sin(2 * f)),
  });
  const a = F(phiEx), b = F(phiSt);
  return { xx: a.xx - b.xx, xy: a.xy - b.xy, yx: a.yx - b.yx, yy: a.yy - b.yy };
}

export interface LobePoint { rpm: number; a: number; fc: number }
export interface Lobes {
  /** lobe polylines, continuous in chatter frequency (one per eigen-branch, lobe number and gap-free run) */
  curves: LobePoint[][];
  /** stability limit envelope (lowest lobe) sampled on an rpm grid */
  envelope: { rpm: number; a: number }[];
  /** absolute (speed-independent) limit within the scanned range, mm */
  aMin: number;
}

/** ZOA stability lobes. */
export function stabilityLobes(p: ChatterParams, nK = 30, nF = 2400): Lobes {
  const { phiSt, phiEx } = engagementAngles(p.D, p.ae, p.mode);
  const Kt = p.coeffs.Ktc;
  const Kr = p.coeffs.Krc / p.coeffs.Ktc;
  const al = directional(phiSt, phiEx, Kr);
  const fLo = 0.5 * Math.min(p.modeX.fn, p.modeY.fn);
  const fHi = 2.5 * Math.max(p.modeX.fn, p.modeY.fn);
  // runs[branch][k] = list of polylines; a polyline breaks when a frequency sample is invalid
  const open: (LobePoint[] | null)[][] = [0, 1].map(() => Array.from({ length: nK }, () => null));
  const curves: LobePoint[][] = [];
  const close = (b: number, k: number) => { const c = open[b][k]; if (c && c.length > 1) curves.push(c); open[b][k] = null; };
  for (let i = 0; i < nF; i++) {
    const fc = fLo + ((fHi - fLo) * i) / (nF - 1);
    const Gx = frf(p.modeX, fc), Gy = frf(p.modeY, fc);
    // B = [α][Φ] with Φ = diag(Gx, Gy)
    const b11 = cscale(Gx, al.xx), b12 = cscale(Gy, al.xy), b21 = cscale(Gx, al.yx), b22 = cscale(Gy, al.yy);
    const tr = cadd(b11, b22);
    const det = csub(cmul(b11, b22), cmul(b12, b21));
    const disc = csqrt(csub(cmul(tr, tr), cscale(det, 4)));
    const sols: { a: number; eps: number }[] = [];
    for (const mu of [cscale(cadd(tr, disc), 0.5), cscale(csub(tr, disc), 0.5)]) {
      if (Math.hypot(mu[0], mu[1]) < 1e-14) continue;
      const Lam = cdiv([-1, 0], mu);
      const LR = Lam[0], LI = Lam[1];
      if (LR >= 0) continue;
      const kap = LI / LR;
      sols.push({ a: ((-2 * Math.PI * LR) / (p.N * Kt)) * (1 + kap * kap), eps: Math.PI - 2 * Math.atan(kap) });
    }
    sols.sort((u, v) => u.a - v.a); // branch 0 = the more critical eigenvalue, consistently
    for (let bI = 0; bI < 2; bI++) {
      const sol = sols[bI];
      for (let k = 0; k < nK; k++) {
        if (!sol) { close(bI, k); continue; }
        const T = (sol.eps + 2 * k * Math.PI) / (TWO_PI * fc);
        const rpm = 60 / (p.N * T);
        if (T <= 0 || rpm < p.rpmMin * 0.7 || rpm > p.rpmMax * 1.3) { close(bI, k); continue; }
        const run = open[bI][k] ?? (open[bI][k] = []);
        const last = run[run.length - 1];
        if (last && Math.abs(rpm - last.rpm) > 0.05 * rpm) { close(bI, k); open[bI][k] = [{ rpm, a: sol.a, fc }]; continue; }
        run.push({ rpm, a: sol.a, fc });
      }
    }
  }
  for (let bI = 0; bI < 2; bI++) for (let k = 0; k < nK; k++) close(bI, k);
  const nE = 600;
  const envelope: { rpm: number; a: number }[] = [];
  let aMin = Infinity;
  for (let i = 0; i < nE; i++) {
    const rpm = p.rpmMin + ((p.rpmMax - p.rpmMin) * i) / (nE - 1);
    const a = aLimAt(curves, rpm);
    envelope.push({ rpm, a });
    if (Number.isFinite(a)) aMin = Math.min(aMin, a);
  }
  return { curves, envelope, aMin };
}

/** Lowest lobe value at a given spindle speed (segments interpolated along each polyline). */
export function aLimAt(curves: LobePoint[][], rpm: number): number {
  let best = Infinity;
  for (const c of curves)
    for (let i = 0; i + 1 < c.length; i++) {
      const p = c[i], q = c[i + 1];
      const lo = Math.min(p.rpm, q.rpm), hi = Math.max(p.rpm, q.rpm);
      if (rpm < lo || rpm > hi) continue;
      const t = hi > lo ? (rpm - p.rpm) / (q.rpm - p.rpm) : 0;
      best = Math.min(best, p.a + t * (q.a - p.a));
    }
  return best;
}

// ------------------------------------------------------------------ time domain
interface Disc { p11: number; p12: number; p21: number; p22: number; g1: number; g2: number }

/** Exact discrete state transition of an underdamped SDOF over dt with zero-order-hold force. */
export function discretise(m: Mode, dt: number): Disc {
  const wn = TWO_PI * m.fn, z = m.zeta;
  const wd = wn * Math.sqrt(1 - z * z);
  const e = Math.exp(-z * wn * dt), c = Math.cos(wd * dt), s = Math.sin(wd * dt);
  const p11 = e * (c + ((z * wn) / wd) * s), p12 = (e * s) / wd;
  const p21 = (-e * wn * wn * s) / wd, p22 = e * (c - ((z * wn) / wd) * s);
  const mass = m.k / (wn * wn);
  const g1 = ((-2 * z) / wn * p12 - (p22 - 1) / (wn * wn)) / mass;
  const g2 = p12 / mass;
  return { p11, p12, p21, p22, g1, g2 };
}

export interface TimeSim {
  rpm: number;
  ap: number;
  dt: number;
  stepsPerTooth: number;
  /** recorded segment (last part of the simulation) */
  t: Float32Array;
  x: Float32Array;
  y: Float32Array;
  Fx: Float32Array;
  Fy: Float32Array;
  phi: Float32Array;
  /** indices (into the recorded arrays) of once-per-tooth samples */
  samples: number[];
  chatterRatio: number;
  verdict: 'stable' | 'chatter';
  ppY: number; // peak-to-peak y vibration, mm
  ppX: number;
  maxF: number;
  domFreq: number; // dominant vibration frequency, Hz
  domIsHarmonic: boolean;
  spectrum: { f: number; amp: number }[];
  /** fraction of time with all engaged teeth out of cut (jump-out indicator) */
  jumpOut: number;
}

export function simulateTime(p: ChatterParams, rpm: number, ap: number, teeth = p.simTeeth, record = true): TimeSim {
  const M = p.stepsPerTooth;
  const Tt = 60 / (rpm * p.N);
  const dt = Tt / M;
  const steps = teeth * M;
  const dx = discretise(p.modeX, dt), dy = discretise(p.modeY, dt);
  const { phiSt, phiEx } = engagementAngles(p.D, p.ae, p.mode);
  const K = p.coeffs;
  const xs = new Float64Array(steps + 1), ys = new Float64Array(steps + 1);
  let vx = 0, vy = 0;
  const recFrom = Math.floor(steps * 0.6);
  const nRec = steps - recFrom;
  const t = new Float32Array(nRec), xr = new Float32Array(nRec), yr = new Float32Array(nRec), fxr = new Float32Array(nRec), fyr = new Float32Array(nRec), phr = new Float32Array(nRec);
  const pitch = TWO_PI / p.N;
  const dphi = TWO_PI * (rpm / 60) * dt;
  let maxF = 0, outCount = 0;
  // Surface memory (multiple regeneration): for every angular position on the cutter path,
  // the displacement (projected on the edge normal) with which the surface there was last cut,
  // and how many tooth periods ago. If a tooth leaves the cut, the next one meets an older
  // surface and must remove the accumulated feed — this is what bounds chatter amplitude.
  const nSeg = Math.ceil(TWO_PI / pitch) + 1;
  const uSurf = new Float64Array(M * nSeg);
  const missed = new Float64Array(M * nSeg).fill(1);
  for (let i = 0; i < steps; i++) {
    // force evaluated at the step midpoint (zero-order hold): no sample falls exactly on an
    // entry/exit angle, which would otherwise create a spurious period-2 force pattern when
    // one tooth enters exactly as another exits (e.g. 4 teeth at half immersion)
    const phi0 = (i + 0.5) * dphi;
    let Fx = 0, Fy = 0, engagedTeeth = 0, cutting = 0;
    const slot = i % M;
    for (let j = 0; j < p.N; j++) {
      const phi = wrapAngle(phi0 + j * pitch);
      if (!isEngaged(phi, phiSt, phiEx)) continue;
      engagedTeeth++;
      const s = Math.sin(phi), c = Math.cos(phi);
      const key = Math.min(Math.floor(phi / pitch), nSeg - 1) * M + slot;
      const un = xs[i] * s + ys[i] * c; // tool displacement along the edge normal
      // h = (accumulated feed)·sinφ + (current − surface) along n
      const h = missed[key] * p.fz * s + un - uSurf[key];
      if (h <= 0) { missed[key] += 1; continue; }
      uSurf[key] = un; missed[key] = 1;
      cutting++;
      const Ft = K.Ktc * ap * h + K.Kte * ap;
      const Fr = K.Krc * ap * h + K.Kre * ap;
      Fx += -Ft * c - Fr * s;
      Fy += Ft * s - Fr * c;
    }
    if (engagedTeeth > 0 && cutting === 0) outCount++;
    const x0 = xs[i], y0 = ys[i];
    xs[i + 1] = dx.p11 * x0 + dx.p12 * vx + dx.g1 * Fx;
    vx = dx.p21 * x0 + dx.p22 * vx + dx.g2 * Fx;
    ys[i + 1] = dy.p11 * y0 + dy.p12 * vy + dy.g1 * Fy;
    vy = dy.p21 * y0 + dy.p22 * vy + dy.g2 * Fy;
    // numerical guard for violently unstable runs (physically the tooth would break first)
    if (!Number.isFinite(xs[i + 1]) || Math.abs(xs[i + 1]) > 1e2) { xs[i + 1] = Math.sign(xs[i + 1] || 1) * 1e2; vx = 0; }
    if (!Number.isFinite(ys[i + 1]) || Math.abs(ys[i + 1]) > 1e2) { ys[i + 1] = Math.sign(ys[i + 1] || 1) * 1e2; vy = 0; }
    if (i >= recFrom) {
      const r = i - recFrom;
      t[r] = i * dt; xr[r] = xs[i]; yr[r] = ys[i]; fxr[r] = Fx; fyr[r] = Fy; phr[r] = wrapAngle(phi0);
      maxF = Math.max(maxF, Math.hypot(Fx, Fy));
    }
  }
  // once-per-tooth samples in the recorded segment (same phase each tooth)
  const samples: number[] = [];
  for (let r = (M - (recFrom % M)) % M; r < nRec; r += M) samples.push(r);
  const varOf = (a: ArrayLike<number>, idx?: number[]) => {
    const n = idx ? idx.length : a.length;
    let m = 0; for (let q = 0; q < n; q++) m += a[idx ? idx[q] : q]; m /= n;
    let v = 0; for (let q = 0; q < n; q++) v += (a[idx ? idx[q] : q] - m) ** 2;
    return v / n;
  };
  const sampleVar = varOf(xr, samples) + varOf(yr, samples);
  const motionVar = varOf(xr) + varOf(yr);
  const chatterRatio = motionVar > 1e-24 ? Math.sqrt(sampleVar / motionVar) : 0;
  let ymin = Infinity, ymax = -Infinity, xmin = Infinity, xmax = -Infinity;
  for (let q = 0; q < nRec; q++) { ymin = Math.min(ymin, yr[q]); ymax = Math.max(ymax, yr[q]); xmin = Math.min(xmin, xr[q]); xmax = Math.max(xmax, xr[q]); }
  // spectrum of y (Hann window), radix-2 FFT
  const spec = spectrum(yr, dt);
  const ftp = (rpm * p.N) / 60;
  let dom = spec[1] ?? { f: 0, amp: 0 };
  for (let q = 1; q < spec.length; q++) if (spec[q].amp > dom.amp) dom = spec[q];
  const df = spec.length > 1 ? spec[1].f - spec[0].f : 1;
  const hk = Math.round(dom.f / ftp);
  const domIsHarmonic = hk >= 1 && Math.abs(dom.f - hk * ftp) <= Math.max(1.5 * df, 0.01 * ftp);
  const out: TimeSim = {
    rpm, ap, dt, stepsPerTooth: M,
    t: record ? t : new Float32Array(0), x: record ? xr : new Float32Array(0), y: record ? yr : new Float32Array(0),
    Fx: record ? fxr : new Float32Array(0), Fy: record ? fyr : new Float32Array(0), phi: record ? phr : new Float32Array(0),
    samples: record ? samples : [],
    chatterRatio, verdict: chatterRatio > 0.1 ? 'chatter' : 'stable',
    ppY: ymax - ymin, ppX: xmax - xmin, maxF, domFreq: dom.f, domIsHarmonic,
    spectrum: record ? spec.filter((s) => s.f <= 6 * Math.max(p.modeX.fn, p.modeY.fn, ftp)) : [],
    jumpOut: outCount / steps,
  };
  return out;
}

/** Single-sided amplitude spectrum (Hann window), mm. */
export function spectrum(sig: ArrayLike<number>, dt: number): { f: number; amp: number }[] {
  const n0 = sig.length;
  let n = 1; while (n < n0) n <<= 1;
  const re = new Float64Array(n), im = new Float64Array(n);
  let mean = 0; for (let i = 0; i < n0; i++) mean += sig[i]; mean /= n0;
  for (let i = 0; i < n0; i++) re[i] = (sig[i] - mean) * (0.5 - 0.5 * Math.cos((TWO_PI * i) / (n0 - 1)));
  // iterative radix-2 FFT
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -TWO_PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const ar = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci;
        const ai = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
        re[i + j + len / 2] = re[i + j] - ar; im[i + j + len / 2] = im[i + j] - ai;
        re[i + j] += ar; im[i + j] += ai;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
  const out: { f: number; amp: number }[] = [];
  for (let k = 0; k <= n / 2; k++) out.push({ f: k / (n * dt), amp: (4 * Math.hypot(re[k], im[k])) / n0 });
  return out;
}

/** Time-domain stability boundary: for each speed, bisection on ap. */
export function timeDomainBoundary(p: ChatterParams, nRpm = 48, apMax = 15, iters = 7, teeth = 160): { rpm: number; a: number }[] {
  const out: { rpm: number; a: number }[] = [];
  for (let i = 0; i < nRpm; i++) {
    const rpm = p.rpmMin + ((p.rpmMax - p.rpmMin) * i) / (nRpm - 1);
    let lo = 0, hi = apMax;
    if (simulateTime(p, rpm, hi, teeth, false).verdict === 'stable') { out.push({ rpm, a: hi }); continue; }
    for (let it = 0; it < iters; it++) {
      const mid = 0.5 * (lo + hi);
      if (simulateTime(p, rpm, mid, teeth, false).verdict === 'stable') lo = mid; else hi = mid;
    }
    out.push({ rpm, a: 0.5 * (lo + hi) });
  }
  return out;
}

// ------------------------------------------------------------------ forced response
/** Steady forced vibration amplitude (rigid-chip, no regeneration) from force harmonics × FRF. */
export function forcedResponse(p: ChatterParams, harmonics = 6) {
  const ftp = (p.rpm * p.N) / 60;
  const { phiSt, phiEx } = engagementAngles(p.D, p.ae, p.mode);
  // force over one tooth period, rigid tool
  const S = 256;
  const Fx = new Float64Array(S), Fy = new Float64Array(S);
  const pitch = TWO_PI / p.N;
  for (let i = 0; i < S; i++) {
    const phi0 = ((i + 0.5) / S) * pitch;
    for (let j = 0; j < p.N; j++) {
      const phi = wrapAngle(phi0 + j * pitch);
      if (!isEngaged(phi, phiSt, phiEx)) continue;
      const s = Math.sin(phi), c = Math.cos(phi), h = p.fz * s;
      const Ft = p.coeffs.Ktc * p.ap * h + p.coeffs.Kte * p.ap, Fr = p.coeffs.Krc * p.ap * h + p.coeffs.Kre * p.ap;
      Fx[i] += -Ft * c - Fr * s; Fy[i] += Ft * s - Fr * c;
    }
  }
  const rows: { k: number; f: number; Fx: number; Fy: number; X: number; Y: number }[] = [];
  let ampY = 0, ampX = 0;
  for (let k = 0; k <= harmonics; k++) {
    let ax = 0, bx = 0, ay = 0, by = 0;
    for (let i = 0; i < S; i++) {
      const th = (TWO_PI * k * i) / S;
      ax += Fx[i] * Math.cos(th); bx -= Fx[i] * Math.sin(th);
      ay += Fy[i] * Math.cos(th); by -= Fy[i] * Math.sin(th);
    }
    const scale = k === 0 ? 1 / S : 2 / S;
    const FxK: C = [ax * scale, bx * scale], FyK: C = [ay * scale, by * scale];
    const f = k * ftp;
    const Gx = k === 0 ? ([1 / p.modeX.k, 0] as C) : frf(p.modeX, f);
    const Gy = k === 0 ? ([1 / p.modeY.k, 0] as C) : frf(p.modeY, f);
    const X = cmul(Gx, FxK), Y = cmul(Gy, FyK);
    rows.push({ k, f, Fx: Math.hypot(FxK[0], FxK[1]), Fy: Math.hypot(FyK[0], FyK[1]), X: Math.hypot(X[0], X[1]), Y: Math.hypot(Y[0], Y[1]) });
    if (k > 0) { ampX += Math.hypot(X[0], X[1]); ampY += Math.hypot(Y[0], Y[1]); }
  }
  return { ftp, rows, ampX, ampY, staticY: rows[0].Y, staticX: rows[0].X };
}

// ------------------------------------------------------------------ tap-test fit
/** Peak-picking fit of one dominant mode from a measured receptance (mm/N). */
export function fitMode(f: number[], re: number[], im: number[]): Mode | null {
  if (f.length < 5) return null;
  let iMin = 0;
  for (let i = 1; i < im.length; i++) if (im[i] < im[iMin]) iMin = i;
  const mag = f.map((_, i) => Math.hypot(re[i], im[i]));
  let iMax = 0;
  for (let i = 1; i < mag.length; i++) if (mag[i] > mag[iMax]) iMax = i;
  const half = mag[iMax] / Math.SQRT2;
  const cross = (dir: -1 | 1) => {
    for (let i = iMax; i > 0 && i < f.length - 1; i += dir) {
      const j = i + dir;
      if (mag[j] <= half) return f[i] + ((half - mag[i]) / (mag[j] - mag[i])) * (f[j] - f[i]);
    }
    return NaN;
  };
  const f1 = cross(-1), f2 = cross(1);
  const fn = f[iMin];
  const zeta = (f2 - f1) / (2 * fn);
  if (!Number.isFinite(zeta) || zeta <= 0) return null;
  const k = -1 / (2 * zeta * im[iMin]);
  return { fn, zeta, k };
}

export interface ChatterResult {
  params: ChatterParams;
  lobes: Lobes;
  aLimHere: number;
  sim: TimeSim;
  forced: ReturnType<typeof forcedResponse>;
  frfCurve: { f: number; reX: number; imX: number; magX: number; reY: number; imY: number; magY: number }[];
  /** dynamic stiffness minimum 1/max|G| per direction, N/mm */
  kDynMin: { x: number; y: number };
  feedRate: number;
  mrr: number;
  ftp: number;
  warnings: string[];
}

export function analyseChatter(p: ChatterParams): ChatterResult {
  const lobes = stabilityLobes(p);
  const aLimHere = aLimAt(lobes.curves, p.rpm);
  const sim = simulateTime(p, p.rpm, p.ap);
  const forced = forcedResponse(p);
  const fMax = 3 * Math.max(p.modeX.fn, p.modeY.fn);
  const frfCurve = [];
  let mx = 0, my = 0;
  for (let i = 1; i <= 400; i++) {
    const f = (fMax * i) / 400;
    const gx = frf(p.modeX, f), gy = frf(p.modeY, f);
    const ax = Math.hypot(gx[0], gx[1]), ay = Math.hypot(gy[0], gy[1]);
    mx = Math.max(mx, ax); my = Math.max(my, ay);
    frfCurve.push({ f, reX: gx[0] * 1000, imX: gx[1] * 1000, magX: ax * 1000, reY: gy[0] * 1000, imY: gy[1] * 1000, magY: ay * 1000 });
  }
  const vf = feedRate(p.rpm, p.N, p.fz);
  const ftp = (p.rpm * p.N) / 60;
  const warnings: string[] = [];
  const zoaStable = p.ap < aLimHere;
  if (zoaStable !== (sim.verdict === 'stable'))
    warnings.push('The analytical lobes (ZOA) and the time-domain simulation disagree at this point. This is expected close to the stability boundary, and at low radial immersion where ZOA misses period-doubling lobes — trust the time-domain result and treat the point as marginal.');
  if (p.ae / p.D < 0.15) warnings.push('Low radial immersion: the ZOA lobes are less accurate here (intermittent cutting creates extra flip lobes). Compare with the time-domain boundary.');
  if (sim.jumpOut > 0.02 && sim.verdict === 'chatter') warnings.push('Teeth are jumping out of the cut: the chatter amplitude is limited by this nonlinearity, not by the structure.');
  if (p.coeffSource !== 'calibrated') warnings.push(`Cutting coefficients are ${p.coeffSource}; lobe positions depend on the modal parameters, lobe heights on Kt and Kr. Results are estimates.`);
  warnings.push('Modal parameters are illustrative unless entered from a tap test (Validate stage). Workpiece flexibility, spindle-speed-dependent dynamics, runout and process damping are not modelled.');
  return {
    params: p, lobes, aLimHere, sim, forced, frfCurve,
    kDynMin: { x: 1 / mx, y: 1 / my },
    feedRate: vf, mrr: p.ae * p.ap * vf, ftp, warnings,
  };
}
