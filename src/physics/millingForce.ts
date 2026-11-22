/**
 * Mechanistic milling-force model (straight-flute end mill, linear edge-force model).
 *
 * ---------------------------------------------------------------------------
 * COORDINATE FRAMES AND SIGN CONVENTION  (see docs/PHYSICS.md §2)
 * ---------------------------------------------------------------------------
 * Feed frame (x, y, z) — the frame in which the classical equations are written:
 *   x  : feed direction of the tool relative to the workpiece
 *   z  : spindle axis, pointing from the tool tip toward the spindle
 *   y  : z × x  (completes a right-handed set)
 *   Spindle rotates CLOCKWISE when viewed from the spindle looking down −z (M03).
 *   φ  : immersion angle of a cutting edge, measured CLOCKWISE from +y.
 *        φ = 0 → edge at +y,  φ = 90° → edge at +x (leading point), φ = 180° → edge at −y.
 *   Edge position in the feed frame:  (R sin φ, R cos φ).
 *
 *   Up-milling   (conventional): material on the +y side, φst = 0,        φex = φa
 *   Down-milling (climb):        material on the −y side, φst = π − φa,   φex = π
 *   where φa = arccos(1 − 2·ae/D).
 *
 *   ALL forces returned by this module are forces exerted BY THE WORKPIECE ON THE TOOL:
 *     Fx = −Ft cos φ − Fr sin φ
 *     Fy = +Ft sin φ − Fr cos φ
 *     Fz = +Fa
 *   The force on the workpiece is the negative of these (Newton's third law).
 *
 * Global machine frame (X, Y, Z): Z is the spindle axis (up). The feed frame is
 * obtained from it by feedSign s = ±1 (tool moving toward ±X):
 *     x = s·X,  y = s·Y,  z = Z      ⇒   FX = s·Fx,  FY = s·Fy,  FZ = Fz
 * ---------------------------------------------------------------------------
 */
import type { CuttingCoefficients } from './materials';

export type MillingMode = 'up' | 'down';

export interface CutParams {
  /** Tool diameter, mm */
  D: number;
  /** Number of teeth */
  N: number;
  /** Feed per tooth, mm/tooth */
  fz: number;
  /** Engaged axial length (axial depth of cut), mm */
  b: number;
  /** Radial depth of cut, mm */
  ae: number;
  mode: MillingMode;
  K: CuttingCoefficients;
  /** Helix angle, degrees. 0 = straight flute (the base teaching model). */
  helixDeg?: number;
  /** Axial slice thickness for the helical model, mm */
  dz?: number;
}

export interface ToothState {
  /** Immersion angle of this tooth at the tool tip, rad, wrapped to [0, 2π) */
  phi: number;
  /** true if any part of the edge is in the cut */
  engaged: boolean;
  /** Maximum uncut chip thickness along the engaged edge, mm */
  h: number;
  /** Tangential / radial / axial force summed along the engaged edge, N */
  Ft: number;
  Fr: number;
  Fa: number;
  /** This tooth's contribution in the feed frame, N */
  F: ForceVector;
}

export interface ForceVector {
  Fx: number;
  Fy: number;
  Fz: number;
}

export const TWO_PI = Math.PI * 2;

export function wrapAngle(phi: number): number {
  const w = phi % TWO_PI;
  return w < 0 ? w + TWO_PI : w;
}

/** Entry and exit immersion angles (rad) for a peripheral cut of radial depth ae. */
export function engagementAngles(D: number, ae: number, mode: MillingMode): { phiSt: number; phiEx: number } {
  const ratio = Math.min(Math.max(ae / D, 0), 1);
  const phiA = Math.acos(1 - 2 * ratio);
  return mode === 'up' ? { phiSt: 0, phiEx: phiA } : { phiSt: Math.PI - phiA, phiEx: Math.PI };
}

/** True if immersion angle phi (rad) lies inside the engagement arc. */
export function isEngaged(phi: number, phiSt: number, phiEx: number): boolean {
  if (phiEx <= phiSt) return false;
  const p = wrapAngle(phi);
  // tiny tolerance so that the exact entry/exit angles count as engaged
  return p >= phiSt - 1e-12 && p <= phiEx + 1e-12;
}

/** Local tooth forces (tangential, radial, axial) for chip thickness h on edge length b. */
export function toothForces(h: number, b: number, K: CuttingCoefficients): { Ft: number; Fr: number; Fa: number } {
  return {
    Ft: K.Ktc * b * h + K.Kte * b,
    Fr: K.Krc * b * h + K.Kre * b,
    Fa: K.Kac * b * h + K.Kae * b,
  };
}

/** Transform a tooth's (Ft, Fr, Fa) at angle phi into feed-frame (Fx, Fy, Fz) on the tool. */
export function toothToFeedFrame(phi: number, Ft: number, Fr: number, Fa: number): ForceVector {
  const s = Math.sin(phi);
  const c = Math.cos(phi);
  return { Fx: -Ft * c - Fr * s, Fy: Ft * s - Fr * c, Fz: Fa };
}

/**
 * Total force on the tool (feed frame) when tooth 0 is at immersion angle phi0 AT THE TOOL TIP.
 * Teeth are equally pitched: φj = φ0 + j·2π/N.
 * Helical flutes (helixDeg > 0) are discretised into axial slices of thickness dz; the slice at
 * height z above the tip lags the tip by  ψ = 2·z·tan(β)/D,  i.e. φj(z) = φ0 + j·2π/N − ψ(z).
 * With helixDeg = 0 there is a single slice of length b (straight-flute model).
 */
export function cutterForce(phi0: number, p: CutParams): { F: ForceVector; teeth: ToothState[] } {
  const { phiSt, phiEx } = engagementAngles(p.D, p.ae, p.mode);
  const pitch = TWO_PI / p.N;
  const beta = ((p.helixDeg ?? 0) * Math.PI) / 180;
  const kb = (2 * Math.tan(beta)) / p.D;
  const ns = beta === 0 || p.b <= 0 ? 1 : Math.max(1, Math.ceil(p.b / (p.dz ?? 0.25)));
  const db = p.b / ns;
  const F: ForceVector = { Fx: 0, Fy: 0, Fz: 0 };
  const teeth: ToothState[] = [];
  const active = p.ae > 0 && p.b > 0;
  for (let j = 0; j < p.N; j++) {
    const tipPhi = wrapAngle(phi0 + j * pitch);
    const t: ToothState = { phi: tipPhi, engaged: false, h: 0, Ft: 0, Fr: 0, Fa: 0, F: { Fx: 0, Fy: 0, Fz: 0 } };
    if (active) {
      for (let s = 0; s < ns; s++) {
        const phi = wrapAngle(tipPhi - kb * (s + 0.5) * db);
        if (!isEngaged(phi, phiSt, phiEx)) continue;
        const h = Math.max(p.fz * Math.sin(phi), 0);
        const { Ft, Fr, Fa } = toothForces(h, db, p.K);
        const f = toothToFeedFrame(phi, Ft, Fr, Fa);
        t.engaged = true;
        t.h = Math.max(t.h, h);
        t.Ft += Ft; t.Fr += Fr; t.Fa += Fa;
        t.F.Fx += f.Fx; t.F.Fy += f.Fy; t.F.Fz += f.Fz;
      }
    }
    F.Fx += t.F.Fx; F.Fy += t.F.Fy; F.Fz += t.F.Fz;
    teeth.push(t);
  }
  return { F, teeth };
}

/** Immersion lag (rad) of the edge at height z above the tip for helix angle helixDeg. */
export function helixLag(D: number, helixDeg: number, z: number): number {
  return (2 * z * Math.tan((helixDeg * Math.PI) / 180)) / D;
}

export interface ForceSignal {
  /** tooth-0 angle, rad */
  phi: Float64Array;
  /** time from phi = 0, s */
  t: Float64Array;
  Fx: Float64Array;
  Fy: Float64Array;
  Fz: Float64Array;
  F: Float64Array;
}

/** Sample the force over one spindle revolution. rpm is needed only for the time axis. */
export function forceSignal(p: CutParams, rpm: number, samples = 360): ForceSignal {
  const out: ForceSignal = {
    phi: new Float64Array(samples),
    t: new Float64Array(samples),
    Fx: new Float64Array(samples),
    Fy: new Float64Array(samples),
    Fz: new Float64Array(samples),
    F: new Float64Array(samples),
  };
  const omega = (rpm * TWO_PI) / 60; // rad/s
  for (let i = 0; i < samples; i++) {
    const phi = (i / samples) * TWO_PI;
    const { F } = cutterForce(phi, p);
    out.phi[i] = phi;
    out.t[i] = omega > 0 ? phi / omega : 0;
    out.Fx[i] = F.Fx;
    out.Fy[i] = F.Fy;
    out.Fz[i] = F.Fz;
    out.F[i] = Math.hypot(F.Fx, F.Fy, F.Fz);
  }
  return out;
}

export interface SignalStats {
  mean: ForceVector;
  peak: ForceVector; // max |component| with sign
  peakResultant: number;
  meanResultant: number;
}

export function signalStats(s: ForceSignal): SignalStats {
  const n = s.phi.length;
  let mx = 0, my = 0, mz = 0, pr = 0, mr = 0;
  let px = 0, py = 0, pz = 0;
  for (let i = 0; i < n; i++) {
    mx += s.Fx[i]; my += s.Fy[i]; mz += s.Fz[i]; mr += s.F[i];
    if (Math.abs(s.Fx[i]) > Math.abs(px)) px = s.Fx[i];
    if (Math.abs(s.Fy[i]) > Math.abs(py)) py = s.Fy[i];
    if (Math.abs(s.Fz[i]) > Math.abs(pz)) pz = s.Fz[i];
    if (s.F[i] > pr) pr = s.F[i];
  }
  return {
    mean: { Fx: mx / n, Fy: my / n, Fz: mz / n },
    peak: { Fx: px, Fy: py, Fz: pz },
    peakResultant: pr,
    meanResultant: mr / n,
  };
}

/**
 * Closed-form average force per revolution, obtained by integrating the instantaneous
 * force over the engagement arc and multiplying by N/(2π). The per-revolution average is
 * independent of the helix angle (every axial slice sweeps the same arc), so this is also
 * a benchmark for the helical model.
 */
export function analyticalMeanForce(p: CutParams): ForceVector {
  if (p.ae <= 0 || p.b <= 0) return { Fx: 0, Fy: 0, Fz: 0 };
  const { phiSt, phiEx } = engagementAngles(p.D, p.ae, p.mode);
  const { Ktc, Krc, Kac, Kte, Kre, Kae } = p.K;
  const a = p.b, c = p.fz, N = p.N;
  const Ix = (f: number) =>
    ((N * a * c) / (8 * Math.PI)) * (Ktc * Math.cos(2 * f) - Krc * (2 * f - Math.sin(2 * f))) +
    ((N * a) / (2 * Math.PI)) * (-Kte * Math.sin(f) + Kre * Math.cos(f));
  const Iy = (f: number) =>
    ((N * a * c) / (8 * Math.PI)) * (Ktc * (2 * f - Math.sin(2 * f)) + Krc * Math.cos(2 * f)) -
    ((N * a) / (2 * Math.PI)) * (Kte * Math.cos(f) + Kre * Math.sin(f));
  const Iz = (f: number) => ((N * a) / (2 * Math.PI)) * (-Kac * c * Math.cos(f) + Kae * f);
  return { Fx: Ix(phiEx) - Ix(phiSt), Fy: Iy(phiEx) - Iy(phiSt), Fz: Iz(phiEx) - Iz(phiSt) };
}

/** Feed rate vf = n·N·fz  (mm/min). */
export function feedRate(rpm: number, N: number, fz: number): number {
  return rpm * N * fz;
}

/** Peripheral milling material removal rate, mm³/min:  Q = ae · ap · vf. */
export function materialRemovalRate(ae: number, ap: number, vf: number): number {
  return ae * ap * vf;
}

/** Cutting speed vc = π·D·n / 1000  (m/min). */
export function cuttingSpeed(D: number, rpm: number): number {
  return (Math.PI * D * rpm) / 1000;
}

/** Tooth-passing frequency, Hz. */
export function toothPassingFrequency(rpm: number, N: number): number {
  return (rpm * N) / 60;
}

/** Maximum uncut chip thickness for the engagement, mm. */
export function maxChipThickness(p: Pick<CutParams, 'D' | 'ae' | 'fz' | 'mode'>): number {
  const { phiSt, phiEx } = engagementAngles(p.D, p.ae, p.mode);
  const sinMax = phiSt <= Math.PI / 2 && phiEx >= Math.PI / 2 ? 1 : Math.max(Math.sin(phiSt), Math.sin(phiEx));
  return p.fz * sinMax;
}

/** Feed-frame → global frame for feed along ±X (feedSign = ±1). */
export function feedToGlobal(f: ForceVector, feedSign: 1 | -1): ForceVector {
  return { Fx: feedSign * f.Fx, Fy: feedSign * f.Fy, Fz: f.Fz };
}
