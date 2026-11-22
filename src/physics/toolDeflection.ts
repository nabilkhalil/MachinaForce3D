/**
 * Static tool deflection: the end mill is a cantilever fixed in the holder.
 * Teaching approximation: rigid holder/spindle, fluted section modelled with an
 * effective diameter d_eff = 0.8·D over the full overhang, load at the centroid
 * of the engaged flute length. Holder, spindle and interface compliance are NOT
 * included and in practice can add 30–100 % to the tool-side compliance.
 */
import { CARBIDE_E, FLUTE_DIAMETER_FACTOR } from './materials';

export interface ToolBeam {
  D: number; // mm
  overhang: number; // mm, holder face to tool tip
  E?: number; // MPa
}

export function toolSecondMoment(D: number): number {
  const d = FLUTE_DIAMETER_FACTOR * D;
  return (Math.PI * d ** 4) / 64;
}

/**
 * Deflection (mm) at distance x from the holder for a point load F (N) applied at
 * distance a from the holder (Euler–Bernoulli cantilever).
 */
export function cantileverDeflection(F: number, a: number, x: number, EI: number): number {
  if (x <= a) return (F * x * x * (3 * a - x)) / (6 * EI);
  return (F * a * a * (3 * x - a)) / (6 * EI);
}

/** Tool stiffness (N/mm) at the load point. */
export function toolStiffnessAtLoad(tool: ToolBeam, a: number): number {
  const EI = (tool.E ?? CARBIDE_E) * toolSecondMoment(tool.D);
  return (3 * EI) / a ** 3;
}

/**
 * Tool deflection at height z (machine frame) when the tool tip sits at zTip and the
 * engaged band [zTip, zTip + b] carries force F.
 */
export function toolDeflectionAt(tool: ToolBeam, F: number, zTip: number, b: number, z: number): number {
  const EI = (tool.E ?? CARBIDE_E) * toolSecondMoment(tool.D);
  const zHolder = zTip + tool.overhang;
  const a = Math.max(tool.overhang - b / 2, 1e-6);
  const x = Math.min(Math.max(zHolder - z, 0), tool.overhang);
  return cantileverDeflection(F, a, x, EI);
}

/** Simple cantilever wall approximation  δ = F L³ / (3 E I),  I = b t³ / 12. */
export function cantileverWallDeflection(F: number, L: number, E: number, width: number, t: number): number {
  const I = (width * t ** 3) / 12;
  return (F * L ** 3) / (3 * E * I);
}
