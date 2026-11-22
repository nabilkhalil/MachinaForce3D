/**
 * Stock (workpiece) model for a straight thin wall: a two-sided height field.
 *
 * The wall occupies X ∈ [0, Lx], Z ∈ [0, H]. For every cell (centre x_i, z_k) the
 * model stores the Y-position of the front face (−Y side) and back face (+Y side).
 * Local thickness = back − front. The same arrays drive (a) the FE element
 * thickness, (b) the radial engagement seen by the cutter and (c) the 3D mesh,
 * so the visual stock and the calculated stock are always identical.
 */

export interface StockGrid {
  Lx: number;
  H: number;
  nxC: number;
  nzC: number;
  dx: number;
  dz: number;
  /** index c = k * nxC + i */
  front: Float32Array;
  back: Float32Array;
}

export function createStock(Lx: number, H: number, thickness: number, dx = 1, dz = 0.5): StockGrid {
  const nxC = Math.max(1, Math.round(Lx / dx));
  const nzC = Math.max(1, Math.round(H / dz));
  const front = new Float32Array(nxC * nzC).fill(-thickness / 2);
  const back = new Float32Array(nxC * nzC).fill(thickness / 2);
  return { Lx, H, nxC, nzC, dx: Lx / nxC, dz: H / nzC, front, back };
}

export function cloneStock(s: StockGrid): StockGrid {
  return { ...s, front: new Float32Array(s.front), back: new Float32Array(s.back) };
}

export function cellIndex(s: StockGrid, i: number, k: number) {
  return k * s.nxC + i;
}

export function stockVolume(s: StockGrid): number {
  let v = 0;
  for (let c = 0; c < s.front.length; c++) v += Math.max(s.back[c] - s.front[c], 0);
  return v * s.dx * s.dz;
}

/** Average thickness of the cells whose centres fall inside each FE element. */
export function elementThickness(s: StockGrid, nx: number, nz: number): Float64Array {
  const out = new Float64Array(nx * nz);
  const cnt = new Float64Array(nx * nz);
  const ex = s.Lx / nx, ez = s.H / nz;
  for (let k = 0; k < s.nzC; k++) {
    const z = (k + 0.5) * s.dz;
    const ek = Math.min(Math.floor(z / ez), nz - 1);
    for (let i = 0; i < s.nxC; i++) {
      const x = (i + 0.5) * s.dx;
      const ei = Math.min(Math.floor(x / ex), nx - 1);
      const c = cellIndex(s, i, k);
      out[ei * nz + ek] += s.back[c] - s.front[c];
      cnt[ei * nz + ek] += 1;
    }
  }
  for (let e = 0; e < out.length; e++) out[e] = cnt[e] > 0 ? out[e] / cnt[e] : 0.01;
  return out;
}

/** Cell index ranges covering [x0,x1) and [z0,z1]. */
export function cellRange(s: StockGrid, x0: number, x1: number, z0: number, z1: number) {
  const i0 = Math.max(0, Math.ceil(x0 / s.dx - 0.5));
  const i1 = Math.min(s.nxC - 1, Math.ceil(x1 / s.dx - 0.5) - 1);
  const k0 = Math.max(0, Math.ceil(z0 / s.dz - 0.5));
  const k1 = Math.min(s.nzC - 1, Math.floor(z1 / s.dz - 0.5 + 1e-9));
  return { i0, i1, k0, k1 };
}
