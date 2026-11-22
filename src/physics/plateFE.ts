/**
 * Reduced-order finite-element model of a thin wall clamped along its base.
 *
 * The wall is modelled as a Reissner–Mindlin plate in the global X–Z plane
 * (X = along the wall length, Z = up). The transverse displacement w is the
 * displacement in global +Y (normal to the wall faces).
 *
 * Element: 4-node bilinear rectangle (Q4), 3 DOF/node [w, βx, βz] with
 *   βx ≈ ∂w/∂x and βz ≈ ∂w/∂z in the thin-plate limit.
 *   Bending: 2×2 Gauss integration. Transverse shear: 1-point (selective reduced
 *   integration) to avoid shear locking for thin walls.
 * Thickness may vary element by element (updated from the stock height-field as
 * material is removed). Neutral-surface offset caused by one-sided removal is ignored.
 *
 * Base (z = 0) support: translational spring on w and rotational spring on βz per
 * unit length (clamping stiffness). 'Rigid' uses a large penalty.
 *
 * Solver: banded Cholesky (symmetric positive definite), nodes numbered along Z
 * first to keep the half-bandwidth = 3·(nz + 2) + 2.
 */

export interface PlateMesh {
  /** wall length (X), mm */
  Lx: number;
  /** wall height (Z), mm */
  H: number;
  nx: number;
  nz: number;
}

export interface PlateMaterial {
  E: number; // MPa
  nu: number;
}

export interface ClampModel {
  rigid: boolean;
  /** rotational stiffness per unit length, N·mm/rad per mm */
  kRot: number;
  /** translational stiffness per unit length, N/mm per mm */
  kTrans: number;
}

const DOF = 3;

export function nodeId(mesh: PlateMesh, i: number, k: number): number {
  return i * (mesh.nz + 1) + k;
}

export function nodeCount(mesh: PlateMesh): number {
  return (mesh.nx + 1) * (mesh.nz + 1);
}

export function halfBandwidth(mesh: PlateMesh): number {
  // max |dof_a - dof_b| within an element: nodes (i,k) and (i+1,k+1) differ by nz+2
  return DOF * (mesh.nz + 2) + DOF - 1;
}

/** Banded symmetric matrix storing the lower band. A(i,j) for i-bw <= j <= i. */
export class BandMatrix {
  readonly n: number;
  readonly bw: number;
  readonly data: Float64Array;
  constructor(n: number, bw: number) {
    this.n = n;
    this.bw = bw;
    this.data = new Float64Array(n * (bw + 1));
  }
  private idx(i: number, j: number) {
    return i * (this.bw + 1) + (j - i + this.bw);
  }
  add(i: number, j: number, v: number) {
    if (j > i) [i, j] = [j, i];
    if (i - j > this.bw) throw new Error('outside band');
    this.data[this.idx(i, j)] += v;
  }
  get(i: number, j: number): number {
    if (j > i) [i, j] = [j, i];
    if (i - j > this.bw) return 0;
    return this.data[this.idx(i, j)];
  }
  /** y = A x */
  mul(x: Float64Array, y: Float64Array) {
    y.fill(0);
    const { n, bw } = this;
    for (let i = 0; i < n; i++) {
      const j0 = Math.max(0, i - bw);
      for (let j = j0; j <= i; j++) {
        const a = this.data[this.idx(i, j)];
        y[i] += a * x[j];
        if (j !== i) y[j] += a * x[i];
      }
    }
  }
}

/** In-place banded Cholesky factorisation; returns L stored in the same layout. */
export class BandCholesky {
  readonly n: number;
  readonly bw: number;
  private L: Float64Array;
  constructor(A: BandMatrix) {
    this.n = A.n;
    this.bw = A.bw;
    const n = this.n, bw = this.bw, W = bw + 1;
    const L = new Float64Array(A.data);
    for (let i = 0; i < n; i++) {
      const j0 = Math.max(0, i - bw);
      for (let j = j0; j <= i; j++) {
        let sum = L[i * W + (j - i + bw)];
        const k0 = Math.max(j0, j - bw);
        for (let k = k0; k < j; k++) {
          sum -= L[i * W + (k - i + bw)] * L[j * W + (k - j + bw)];
        }
        if (i === j) {
          if (sum <= 0) throw new Error(`Stiffness matrix not positive definite at dof ${i}`);
          L[i * W + bw] = Math.sqrt(sum);
        } else {
          L[i * W + (j - i + bw)] = sum / L[j * W + bw];
        }
      }
    }
    this.L = L;
  }
  solve(b: Float64Array, out?: Float64Array): Float64Array {
    const n = this.n, bw = this.bw, W = bw + 1, L = this.L;
    const x = out ?? new Float64Array(n);
    x.set(b);
    // forward:  L y = b   (row-oriented, contiguous access)
    for (let i = 0; i < n; i++) {
      let s = x[i];
      const j0 = Math.max(0, i - bw);
      const row = i * W - i + bw;
      for (let j = j0; j < i; j++) s -= L[row + j] * x[j];
      x[i] = s / L[i * W + bw];
    }
    // backward: Lᵀ x = y  (column-oriented on Lᵀ = row-oriented on L, contiguous access)
    for (let i = n - 1; i >= 0; i--) {
      const xi = (x[i] /= L[i * W + bw]);
      const j0 = Math.max(0, i - bw);
      const row = i * W - i + bw;
      for (let j = j0; j < i; j++) x[j] -= L[row + j] * xi;
    }
    return x;
  }
}

const GP = 1 / Math.sqrt(3);
const XI = [-1, 1, 1, -1];
const ETA = [-1, -1, 1, 1];

/** 12×12 element stiffness for a rectangular Mindlin element a (x) × c (z), thickness t. */
export function elementStiffness(a: number, c: number, t: number, mat: PlateMaterial): Float64Array {
  const { E, nu } = mat;
  const D0 = (E * t ** 3) / (12 * (1 - nu * nu));
  const Db = [D0, nu * D0, 0, nu * D0, D0, 0, 0, 0, (D0 * (1 - nu)) / 2];
  const G = E / (2 * (1 + nu));
  const Ds = (5 / 6) * G * t;
  const Ke = new Float64Array(144);
  const detJ = (a * c) / 4;

  const shape = (xi: number, eta: number) => {
    const N = new Float64Array(4), dNx = new Float64Array(4), dNz = new Float64Array(4);
    for (let i = 0; i < 4; i++) {
      N[i] = 0.25 * (1 + xi * XI[i]) * (1 + eta * ETA[i]);
      dNx[i] = (0.25 * XI[i] * (1 + eta * ETA[i]) * 2) / a;
      dNz[i] = (0.25 * ETA[i] * (1 + xi * XI[i]) * 2) / c;
    }
    return { N, dNx, dNz };
  };

  // Bending (2x2 Gauss)
  for (const xi of [-GP, GP]) {
    for (const eta of [-GP, GP]) {
      const { dNx, dNz } = shape(xi, eta);
      const B = new Float64Array(36); // 3 x 12
      for (let i = 0; i < 4; i++) {
        B[0 * 12 + 3 * i + 1] = dNx[i];
        B[1 * 12 + 3 * i + 2] = dNz[i];
        B[2 * 12 + 3 * i + 1] = dNz[i];
        B[2 * 12 + 3 * i + 2] = dNx[i];
      }
      addBtDB(Ke, B, Db, 3, detJ);
    }
  }
  // Shear (1-point, weight 4)
  {
    const { N, dNx, dNz } = shape(0, 0);
    const B = new Float64Array(24); // 2 x 12
    for (let i = 0; i < 4; i++) {
      B[0 * 12 + 3 * i] = dNx[i];
      B[0 * 12 + 3 * i + 1] = -N[i];
      B[1 * 12 + 3 * i] = dNz[i];
      B[1 * 12 + 3 * i + 2] = -N[i];
    }
    addBtDB(Ke, B, [Ds, 0, 0, Ds], 2, detJ * 4);
  }
  return Ke;
}

function addBtDB(Ke: Float64Array, B: Float64Array, D: number[], m: number, w: number) {
  const DB = new Float64Array(m * 12);
  for (let r = 0; r < m; r++)
    for (let j = 0; j < 12; j++) {
      let s = 0;
      for (let k = 0; k < m; k++) s += D[r * m + k] * B[k * 12 + j];
      DB[r * 12 + j] = s;
    }
  for (let i = 0; i < 12; i++)
    for (let j = 0; j < 12; j++) {
      let s = 0;
      for (let r = 0; r < m; r++) s += B[r * 12 + i] * DB[r * 12 + j];
      Ke[i * 12 + j] += s * w;
    }
}

export interface PlateModel {
  mesh: PlateMesh;
  K: BandMatrix;
  chol: BandCholesky;
  /** lumped translational mass per node (tonne) — for natural frequency */
  mass: Float64Array;
}

/**
 * Assemble and factorise the plate.
 * @param thickness element thickness, length nx*nz, index e = i*nz + k (mm)
 * @param rho density in t/mm³
 */
export function buildPlate(
  mesh: PlateMesh,
  thickness: ArrayLike<number>,
  mat: PlateMaterial,
  clamp: ClampModel,
  rho = 0,
): PlateModel {
  const nn = nodeCount(mesh);
  const n = nn * DOF;
  const K = new BandMatrix(n, halfBandwidth(mesh));
  const a = mesh.Lx / mesh.nx;
  const c = mesh.H / mesh.nz;
  const mass = new Float64Array(nn);
  const cache = new Map<number, Float64Array>();
  for (let i = 0; i < mesh.nx; i++) {
    for (let k = 0; k < mesh.nz; k++) {
      const t = Math.max(thickness[i * mesh.nz + k], 1e-3);
      const key = Math.round(t * 1e6);
      let Ke = cache.get(key);
      if (!Ke) {
        Ke = elementStiffness(a, c, t, mat);
        cache.set(key, Ke);
      }
      const nodes = [nodeId(mesh, i, k), nodeId(mesh, i + 1, k), nodeId(mesh, i + 1, k + 1), nodeId(mesh, i, k + 1)];
      for (let p = 0; p < 4; p++)
        for (let dp = 0; dp < DOF; dp++) {
          const gi = nodes[p] * DOF + dp;
          for (let q = 0; q < 4; q++)
            for (let dq = 0; dq < DOF; dq++) {
              const gj = nodes[q] * DOF + dq;
              if (gj > gi) continue;
              K.add(gi, gj, Ke[(3 * p + dp) * 12 + 3 * q + dq]);
            }
        }
      for (let p = 0; p < 4; p++) mass[nodes[p]] += (rho * t * a * c) / 4;
    }
  }
  // Base supports (k = 0), tributary length per node
  const EI_ref = mat.E * 1e3; // scale for penalty
  for (let i = 0; i <= mesh.nx; i++) {
    const trib = (i === 0 || i === mesh.nx ? 0.5 : 1) * a;
    const id = nodeId(mesh, i, 0) * DOF;
    if (clamp.rigid) {
      const pen = EI_ref * 1e6;
      K.add(id, id, pen);
      K.add(id + 1, id + 1, pen);
      K.add(id + 2, id + 2, pen);
    } else {
      K.add(id, id, clamp.kTrans * trib);
      K.add(id + 2, id + 2, clamp.kRot * trib);
    }
  }
  return { mesh, K, chol: new BandCholesky(K), mass };
}

/** Add a point load P (N, in +Y) at (x, z) to the load vector using shape functions. */
export function addPointLoad(mesh: PlateMesh, f: Float64Array, x: number, z: number, P: number) {
  const a = mesh.Lx / mesh.nx;
  const c = mesh.H / mesh.nz;
  const xc = Math.min(Math.max(x, 0), mesh.Lx);
  const zc = Math.min(Math.max(z, 0), mesh.H);
  const i = Math.min(Math.floor(xc / a), mesh.nx - 1);
  const k = Math.min(Math.floor(zc / c), mesh.nz - 1);
  const xi = ((xc - i * a) / a) * 2 - 1;
  const eta = ((zc - k * c) / c) * 2 - 1;
  const nodes = [nodeId(mesh, i, k), nodeId(mesh, i + 1, k), nodeId(mesh, i + 1, k + 1), nodeId(mesh, i, k + 1)];
  for (let p = 0; p < 4; p++) {
    const N = 0.25 * (1 + xi * XI[p]) * (1 + eta * ETA[p]);
    f[nodes[p] * DOF] += N * P;
  }
}

/** Uniform patch load of total force P over [x0,x1]×[z0,z1], sampled on a sub-grid. */
export function patchLoadVector(
  mesh: PlateMesh,
  x0: number, x1: number, z0: number, z1: number,
  P: number, samples = 6,
): Float64Array {
  const f = new Float64Array(nodeCount(mesh) * DOF);
  const nxs = samples, nzs = samples;
  const w = P / (nxs * nzs);
  for (let a = 0; a < nxs; a++)
    for (let b = 0; b < nzs; b++) {
      const x = x0 + ((a + 0.5) / nxs) * (x1 - x0);
      const z = z0 + ((b + 0.5) / nzs) * (z1 - z0);
      addPointLoad(mesh, f, x, z, w);
    }
  return f;
}

/** Extract nodal w (Y-displacement) from the full solution vector. */
export function extractW(mesh: PlateMesh, u: Float64Array): Float32Array {
  const nn = nodeCount(mesh);
  const w = new Float32Array(nn);
  for (let n = 0; n < nn; n++) w[n] = u[n * DOF];
  return w;
}

/** Bilinear interpolation of nodal w at (x, z). */
export function sampleW(mesh: PlateMesh, w: ArrayLike<number>, x: number, z: number): number {
  const a = mesh.Lx / mesh.nx;
  const c = mesh.H / mesh.nz;
  const xc = Math.min(Math.max(x, 0), mesh.Lx);
  const zc = Math.min(Math.max(z, 0), mesh.H);
  const i = Math.min(Math.floor(xc / a), mesh.nx - 1);
  const k = Math.min(Math.floor(zc / c), mesh.nz - 1);
  const u = (xc - i * a) / a;
  const v = (zc - k * c) / c;
  return (
    w[nodeId(mesh, i, k)] * (1 - u) * (1 - v) +
    w[nodeId(mesh, i + 1, k)] * u * (1 - v) +
    w[nodeId(mesh, i + 1, k + 1)] * u * v +
    w[nodeId(mesh, i, k + 1)] * (1 - u) * v
  );
}

/**
 * First natural frequency (Hz) by inverse iteration with a lumped translational mass.
 * Rotary inertia is neglected (thin-wall approximation).
 */
export function firstNaturalFrequency(model: PlateModel, iterations = 40, start?: Float64Array): { f1: number; mode: Float64Array } {
  const nn = nodeCount(model.mesh);
  const n = nn * DOF;
  let x = new Float64Array(n);
  if (start && start.length === n) x.set(start);
  else for (let p = 0; p < nn; p++) x[p * DOF] = 1;
  const Mx = new Float64Array(n);
  const Kx = new Float64Array(n);
  let omega2 = 0;
  for (let it = 0; it < iterations; it++) {
    Mx.fill(0);
    for (let p = 0; p < nn; p++) Mx[p * DOF] = model.mass[p] * x[p * DOF];
    const y = model.chol.solve(Mx);
    let norm = 0;
    for (let i = 0; i < n; i++) norm = Math.max(norm, Math.abs(y[i]));
    for (let i = 0; i < n; i++) y[i] /= norm;
    x = y;
  }
  model.K.mul(x, Kx);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) num += x[i] * Kx[i];
  for (let p = 0; p < nn; p++) den += model.mass[p] * x[p * DOF] ** 2;
  omega2 = num / den;
  return { f1: Math.sqrt(Math.max(omega2, 0)) / (2 * Math.PI), mode: x };
}
