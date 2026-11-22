/**
 * Sequential contour map in the style students meet in FE post-processors
 * (blue → cyan → green → yellow → red), with monotonic lightness in the lower half.
 */
const VIRIDIS: [number, number, number][] = [
  [0.16, 0.22, 0.45], [0.13, 0.36, 0.66], [0.12, 0.55, 0.8], [0.15, 0.7, 0.75],
  [0.3, 0.78, 0.55], [0.55, 0.83, 0.35], [0.8, 0.85, 0.25], [0.97, 0.78, 0.2],
  [0.98, 0.6, 0.18], [0.92, 0.38, 0.17], [0.8, 0.16, 0.16],
];
export function sequential(t: number): [number, number, number] {
  const x = Math.min(Math.max(t, 0), 1) * (VIRIDIS.length - 1);
  const i = Math.min(Math.floor(x), VIRIDIS.length - 2);
  const f = x - i;
  const a = VIRIDIS[i], b = VIRIDIS[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
/** Diverging blue–white–red, t ∈ [−1, 1]. Blue = thinner than nominal, red = thicker. */
export function diverging(t: number): [number, number, number] {
  const x = Math.min(Math.max(t, -1), 1);
  const lo: [number, number, number] = [0.13, 0.4, 0.75];
  const mid: [number, number, number] = [0.93, 0.93, 0.93];
  const hi: [number, number, number] = [0.8, 0.15, 0.15];
  const [a, b, f] = x < 0 ? [mid, lo, -x] : [mid, hi, x];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
export function cssColor(c: [number, number, number]) {
  return `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
}
