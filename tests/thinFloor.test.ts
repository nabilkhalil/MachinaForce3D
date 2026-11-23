import { describe, expect, it } from 'vitest';
import { MATERIALS } from '../src/physics/materials';
import { sampleW } from '../src/physics/plateFE';
import {
  DEFAULT_THINFLOOR, buildFloor, buildStations, diskLoad, endEdgeMeanFz, endEdgeFz, nodalW, pathSegments, plateRigidity, simulateThinFloor,
  stationForce, thicknessAt, toGlobal, uniformLoad, type ThinFloorParams,
} from '../src/physics/thinFloor';
import { THINFLOOR_PROBLEM } from '../src/content/thinFloor';

const P = (o: Partial<ThinFloorParams> = {}): ThinFloorParams => ({ ...DEFAULT_THINFLOOR, ...o });
const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-12);
const uniformT = (p: ThinFloorParams, t: number) => new Float64Array(p.nx * p.ny).fill(t);
const centreW = (p: ThinFloorParams, t: number, F = 50) => {
  const fe = buildFloor(p, uniformT(p, t));
  return sampleW(fe.mesh, nodalW(fe.mesh, fe.model.chol.solve(diskLoad(fe.mesh, p.L / 2, p.W / 2, p.D / 2, F))), p.L / 2, p.W / 2);
};

describe('Floor plate solver', () => {
  it('zero load gives zero deflection', () => {
    const p = P();
    const fe = buildFloor(p, uniformT(p, 1.5));
    const w = nodalW(fe.mesh, fe.model.chol.solve(diskLoad(fe.mesh, 40, 30, 4, 0)));
    expect(Math.max(...Array.from(w).map(Math.abs))).toBe(0);
  });

  it('analytical benchmark: simply supported square plate, uniform load, w_max = 0.00406 q a⁴/D (Timoshenko)', () => {
    const a = 60, t = 1.5, q = 0.01;
    const p = P({ L: a, W: a, nx: 40, ny: 40, edge: 'simply', under: 'none', tFinal: t });
    const fe = buildFloor(p, uniformT(p, t));
    const w = nodalW(fe.mesh, fe.model.chol.solve(uniformLoad(fe.mesh, q)));
    const m = MATERIALS[p.materialId];
    const ref = (0.00406 * q * a ** 4) / plateRigidity(m.E, m.nu, t);
    expect(rel(sampleW(fe.mesh, w, a / 2, a / 2), ref)).toBeLessThan(0.02);
  });

  it('mesh refinement converges (clamped plate, centre load)', () => {
    const ws = [8, 16, 32].map((n) => centreW(P({ edge: 'clamped', nx: n, ny: Math.round(n * 0.75) }), 1.5));
    expect(Math.abs(ws[2] - ws[1])).toBeLessThan(Math.abs(ws[1] - ws[0]));
    expect(rel(ws[2], ws[1])).toBeLessThan(0.05);
  });

  it('thicker floors deflect less (≈ 1/t³)', () => {
    const p = P({ edge: 'clamped' });
    const w1 = centreW(p, 1.5), w2 = centreW(p, 3);
    expect(w2).toBeLessThan(w1);
    expect(rel(w1 / w2, 8)).toBeLessThan(0.15);
  });

  it('larger unsupported span is more compliant', () => {
    expect(centreW(P({ L: 120, W: 90 }), 1.5)).toBeGreaterThan(centreW(P({ L: 60, W: 45 }), 1.5));
  });

  it('edge restraint and underside supports reduce displacement', () => {
    const ss = centreW(P({ edge: 'simply' }), 1.5), red = centreW(P({ edge: 'reduced' }), 1.5), cl = centreW(P({ edge: 'clamped' }), 1.5);
    expect(ss).toBeGreaterThan(red);
    expect(red).toBeGreaterThan(cl);
    for (const u of ['centre', 'pins4', 'bed'] as const) expect(centreW(P({ under: u }), 1.5)).toBeLessThan(red);
  });

  it('the displacement field depends on the load position (not a uniform shift)', () => {
    const p = P();
    const fe = buildFloor(p, uniformT(p, 1.5));
    const field = (x: number, y: number) => nodalW(fe.mesh, fe.model.chol.solve(diskLoad(fe.mesh, x, y, 4, 50)));
    const a = field(20, 30), b = field(60, 30);
    expect(sampleW(fe.mesh, a, 20, 30)).toBeGreaterThan(2 * sampleW(fe.mesh, a, 60, 30));
    expect(sampleW(fe.mesh, b, 60, 30)).toBeGreaterThan(2 * sampleW(fe.mesh, b, 20, 30));
    expect(sampleW(fe.mesh, a, 0, 30)).toBeCloseTo(0, 6);
  });
});

describe('Cutting load', () => {
  it('force signs follow the machine convention: tool pushed up (+Fz), workpiece loaded downward', () => {
    const p = P();
    const { stations } = buildStations(p);
    const st = stations.find((s) => !s.link && s.ae > 0)!;
    const f = stationForce(p, st, 0.5);
    expect(f.Fz).toBeGreaterThan(0);
    expect(endEdgeMeanFz(p, st.ae, st.mode, st.fz)).toBeGreaterThan(0);
    // feed-frame → global rotation: feed +X keeps components, feed −X flips Fx and Fy (Module 1 feedToGlobal)
    expect(toGlobal(3, 4, 0)).toEqual([3, 4]);
    const [gx, gy] = toGlobal(3, 4, Math.PI);
    expect(gx).toBeCloseTo(-3, 12); expect(gy).toBeCloseTo(-4, 12);
  });

  it('end-edge mean axial force equals the average of the instantaneous force', () => {
    const p = P();
    let s = 0; const n = 3600;
    for (let i = 0; i < n; i++) s += endEdgeFz(p, 4, 'down', 0.06, (i / n) * 2 * Math.PI);
    expect(rel(s / n, endEdgeMeanFz(p, 4, 'down', 0.06))).toBeLessThan(0.01);
  });
});

describe('Tool paths', () => {
  for (const strategy of ['zigzag', 'spiral', 'adaptive'] as const)
    it(`${strategy}: tool centre stays inside [R, L−R] × [R, W−R]`, () => {
      const p = P({ strategy });
      const R = p.D / 2;
      for (const s of pathSegments(p)) for (const [x, y] of [[s.x0, s.y0], [s.x1, s.y1]]) {
        expect(x).toBeGreaterThanOrEqual(R - 1e-9); expect(x).toBeLessThanOrEqual(p.L - R + 1e-9);
        expect(y).toBeGreaterThanOrEqual(R - 1e-9); expect(y).toBeLessThanOrEqual(p.W - R + 1e-9);
      }
    });
  it('zigzag alternates climb and conventional passes; adaptive uses low engagement and climb only', () => {
    const z = pathSegments(P()).filter((s) => !s.link && s.ae < 8);
    z.forEach((s) => expect(s.side).toBe(s.x1 > s.x0 ? 'left' : 'right')); // material (+Y) left of +X travel, right of −X travel
    const st = buildStations(P()).stations.filter((s) => !s.link && s.ae < 8);
    expect(new Set(st.map((s) => s.mode))).toEqual(new Set(['up', 'down']));
    const a = buildStations(P({ strategy: 'adaptive' })).stations.filter((s) => !s.link);
    expect(Math.max(...a.map((s) => s.ae))).toBeLessThanOrEqual(0.15 * 8 + 1e-9);
    expect(new Set(a.map((s) => s.mode))).toEqual(new Set(['down']));
  });
});

describe('Machining simulation', () => {
  const base = simulateThinFloor(P());
  it('final thickness error differs from the instantaneous deflection and never goes below the nominal floor (floor pushed away)', () => {
    expect(base.summary.maxErr).not.toBeCloseTo(base.summary.maxDeflection, 4);
    expect(base.summary.minThickness).toBeGreaterThanOrEqual(P().tFinal - 1e-6);
    expect(base.summary.maxErr).toBeGreaterThan(0);
    expect(base.summary.maxErr).toBeLessThanOrEqual(base.summary.maxDeflection + 1e-9);
  });
  it('every reachable floor cell is cut; corner fillets (radius R) are excluded', () => {
    expect(base.summary.maxThickness).toBeLessThan(P().tFinal + P().allowance - 1e-3);
    expect(Number.isNaN(thicknessAt(base, 0.3, 0.3))).toBe(true);
    expect(Number.isFinite(thicknessAt(base, 40, 30))).toBe(true);
  });
  it('underside support and thicker floors reduce the thickness error', () => {
    expect(simulateThinFloor(P({ under: 'pins4' })).summary.maxErr).toBeLessThan(base.summary.maxErr);
    expect(simulateThinFloor(P({ tFinal: 3 })).summary.maxErr).toBeLessThan(base.summary.maxErr);
  });
  it('stiffness updates as material is removed: the natural frequency falls', () => {
    expect(base.summary.f1End).toBeLessThan(base.summary.f1Start);
  });
  it('no negative thickness even for an extremely thin floor', () => {
    const r = simulateThinFloor(P({ tFinal: 1, fz: 0.2, maxStations: 200 }));
    expect(r.summary.minThickness).toBeGreaterThan(0);
  });
});

describe('Stage C production problem', () => {
  const judge = (o: Partial<ThinFloorParams>) => {
    const s = simulateThinFloor(P(o)).summary;
    return s.maxErr <= THINFLOOR_PROBLEM.tol && s.cutTime <= THINFLOOR_PROBLEM.maxTime;
  };
  it('baseline fails', () => expect(judge(THINFLOOR_PROBLEM.baseline)).toBe(false));
  it('the known solution passes', () => expect(judge(THINFLOOR_PROBLEM.knownSolution)).toBe(true));
});
