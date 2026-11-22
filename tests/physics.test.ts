import { describe, expect, it } from 'vitest';
import { MATERIALS } from '../src/physics/materials';
import {
  analyticalMeanForce, cutterForce, engagementAngles, feedRate, forceSignal, materialRemovalRate,
  signalStats, toothPassingFrequency, toothToFeedFrame, type CutParams,
} from '../src/physics/millingForce';
import { buildPlate, extractW, nodeCount, nodeId, type PlateMesh } from '../src/physics/plateFE';
import { cantileverDeflection, cantileverWallDeflection, toolDeflectionAt } from '../src/physics/toolDeflection';
import { DEFAULT_PARAMS, simulate, stockAt, type ProcessParams } from '../src/physics/process';
import { createStock, elementThickness, stockVolume } from '../src/physics/stock';

const K = MATERIALS.al7075.coeffs;
const base: CutParams = { D: 8, N: 3, fz: 0.05, b: 5, ae: 0.5, mode: 'down', K };
const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-12);

describe('Unit consistency and kinematics', () => {
  it('feed rate vf = n·N·fz (mm/min)', () => {
    expect(feedRate(12000, 3, 0.05)).toBeCloseTo(1800, 9);
  });
  it('MRR = ae·ap·vf (mm³/min) and scales linearly with each factor', () => {
    const q = materialRemovalRate(0.5, 5, 1800);
    expect(q).toBeCloseTo(4500, 9);
    expect(materialRemovalRate(1, 5, 1800)).toBeCloseTo(2 * q, 9);
  });
  it('tooth-passing frequency = n·N/60 and matches the period of the force signal', () => {
    const rpm = 12000;
    expect(toothPassingFrequency(rpm, 3)).toBeCloseTo(600, 9);
    // the force signal must repeat every tooth pitch (2π/N)
    const s = forceSignal(base, rpm, 360);
    for (let i = 0; i < 240; i++) expect(s.Fy[i]).toBeCloseTo(s.Fy[i + 120], 9);
    // and its time axis: one pitch = 1/ftp seconds
    expect(s.t[120]).toBeCloseTo(1 / 600, 12);
  });
  it('force scales linearly with axial engagement b (N/mm² × mm × mm = N)', () => {
    const f1 = analyticalMeanForce(base);
    const f2 = analyticalMeanForce({ ...base, b: 10 });
    expect(f2.Fy / f1.Fy).toBeCloseTo(2, 9);
  });
});

describe('Zero-force conditions', () => {
  it('no force when ae = 0', () => {
    const s = signalStats(forceSignal({ ...base, ae: 0 }, 10000));
    expect(s.peakResultant).toBe(0);
  });
  it('no force when b = 0', () => {
    expect(signalStats(forceSignal({ ...base, b: 0 }, 10000)).peakResultant).toBe(0);
  });
  it('no force when fz = 0 and edge coefficients are zero', () => {
    const p = { ...base, fz: 0, K: { ...K, Kte: 0, Kre: 0, Kae: 0 } };
    expect(signalStats(forceSignal(p, 10000)).peakResultant).toBeCloseTo(0, 12);
  });
});

describe('Engagement and disengagement', () => {
  it('up-milling arc is [0, φa], down-milling [π − φa, π]', () => {
    const phiA = Math.acos(1 - 2 * (0.5 / 8));
    const up = engagementAngles(8, 0.5, 'up');
    const dn = engagementAngles(8, 0.5, 'down');
    expect(up.phiSt).toBe(0);
    expect(up.phiEx).toBeCloseTo(phiA, 12);
    expect(dn.phiSt).toBeCloseTo(Math.PI - phiA, 12);
    expect(dn.phiEx).toBeCloseTo(Math.PI, 12);
  });
  it('slotting (ae = D) engages 0…π in both modes', () => {
    expect(engagementAngles(8, 8, 'up').phiEx).toBeCloseTo(Math.PI, 12);
    expect(engagementAngles(8, 8, 'down').phiSt).toBeCloseTo(0, 12);
  });
  it('a tooth outside the arc carries no force; inside it does', () => {
    const p: CutParams = { ...base, N: 1, mode: 'up' };
    const { phiEx } = engagementAngles(p.D, p.ae, 'up');
    expect(cutterForce(phiEx * 0.5, p).teeth[0].engaged).toBe(true);
    expect(cutterForce(phiEx + 0.05, p).teeth[0].engaged).toBe(false);
    expect(cutterForce(phiEx + 0.05, p).F.Fy).toBe(0);
  });
  it('uncut chip thickness h = fz·sin φ', () => {
    const p: CutParams = { ...base, N: 1, ae: 8, mode: 'up' };
    const t = cutterForce(Math.PI / 6, p).teeth[0];
    expect(t.h).toBeCloseTo(0.05 * 0.5, 12);
  });
});

describe('Force-coordinate transformation', () => {
  it('edge at φ = 90°: Fy = +Ft, Fx = −Fr (forces on tool)', () => {
    const f = toothToFeedFrame(Math.PI / 2, 100, 40, 10);
    expect(f.Fy).toBeCloseTo(100, 9);
    expect(f.Fx).toBeCloseTo(-40, 9);
    expect(f.Fz).toBe(10);
  });
  it('edge at φ = 0: Fx = −Ft, Fy = −Fr', () => {
    const f = toothToFeedFrame(0, 100, 40, 10);
    expect(f.Fx).toBeCloseTo(-100, 9);
    expect(f.Fy).toBeCloseTo(-40, 9);
  });
  it('preserves the magnitude of the in-plane force', () => {
    for (const phi of [0.1, 0.7, 1.9, 2.8]) {
      const f = toothToFeedFrame(phi, 120, 50, 0);
      expect(Math.hypot(f.Fx, f.Fy)).toBeCloseTo(Math.hypot(120, 50), 9);
    }
  });
});

describe('Numerical vs analytical benchmark (mean force per revolution)', () => {
  for (const mode of ['up', 'down'] as const)
    for (const ae of [0.5, 2, 4, 8])
      it(`${mode}-milling, ae = ${ae} mm: numerical mean within 0.5 % of closed form`, () => {
        const p = { ...base, ae, mode };
        const num = signalStats(forceSignal(p, 10000, 20000)).mean;
        const ana = analyticalMeanForce(p);
        expect(rel(num.Fx, ana.Fx)).toBeLessThan(5e-3);
        expect(rel(num.Fy, ana.Fy)).toBeLessThan(5e-3);
        expect(rel(num.Fz, ana.Fz)).toBeLessThan(5e-3);
      });
  it('helical cutter (30°): mean force equals the straight-flute closed form', () => {
    const p = { ...base, ae: 2, helixDeg: 30, dz: 0.05 };
    const num = signalStats(forceSignal(p, 1e4, 3600)).mean;
    const ana = analyticalMeanForce(p);
    expect(rel(num.Fy, ana.Fy)).toBeLessThan(5e-3);
    expect(rel(num.Fx, ana.Fx)).toBeLessThan(5e-3);
  });
  it('helix smooths the force: lower peak than straight flute, same mean', () => {
    const p = { ...base, ae: 2 };
    const s0 = signalStats(forceSignal(p, 1e4, 3600));
    const s30 = signalStats(forceSignal({ ...p, helixDeg: 30, dz: 0.05 }, 1e4, 3600));
    expect(s30.peakResultant).toBeLessThan(s0.peakResultant);
  });
  it('numerical mean converges as angular resolution increases', () => {
    const p = { ...base, ae: 2 };
    const ana = analyticalMeanForce(p).Fy;
    const e = [90, 360, 1440, 5760].map((n) => rel(signalStats(forceSignal(p, 1e4, n)).mean.Fy, ana));
    expect(e[3]).toBeLessThan(e[0]);
    expect(e[3]).toBeLessThan(2e-3);
  });
});

describe('Elastic deflection: analytical cantilever', () => {
  it('δ = F L³ / (3EI) for a load at the free end', () => {
    const EI = 1e6;
    expect(cantileverDeflection(10, 40, 40, EI)).toBeCloseTo((10 * 40 ** 3) / (3 * EI), 12);
  });
  it('increased force → proportionally increased deflection', () => {
    const d1 = cantileverWallDeflection(50, 40, 71700, 50, 2);
    const d2 = cantileverWallDeflection(100, 40, 71700, 50, 2);
    expect(d2 / d1).toBeCloseTo(2, 12);
  });
  it('increased wall thickness → stiffness ∝ t³', () => {
    const d1 = cantileverWallDeflection(50, 40, 71700, 50, 2);
    const d2 = cantileverWallDeflection(50, 40, 71700, 50, 4);
    expect(d1 / d2).toBeCloseTo(8, 9);
  });
  it('increased tool overhang → tool deflection ∝ L³', () => {
    const d1 = toolDeflectionAt({ D: 8, overhang: 30 }, 100, 0, 1e-9, 0);
    const d2 = toolDeflectionAt({ D: 8, overhang: 60 }, 100, 0, 1e-9, 0);
    expect(d2 / d1).toBeCloseTo(8, 3);
  });
});

describe('Plate finite-element model', () => {
  const mat = { E: 71700, nu: 0.33 };
  const rigid = { rigid: true, kRot: 0, kTrans: 0 };
  function tipLineLoad(nx: number, nz: number, t = 2, P = 100) {
    const mesh: PlateMesh = { Lx: 50, H: 40, nx, nz };
    const th = new Float64Array(nx * nz).fill(t);
    const plate = buildPlate(mesh, th, mat, rigid);
    const f = new Float64Array(nodeCount(mesh) * 3);
    for (let i = 0; i <= nx; i++) f[nodeId(mesh, i, nz) * 3] = (P / nx) * (i === 0 || i === nx ? 0.5 : 1);
    const w = extractW(mesh, plate.chol.solve(f));
    let mean = 0;
    for (let i = 0; i <= nx; i++) mean += w[nodeId(mesh, i, nz)] / (nx + 1);
    return mean;
  }
  const beam = cantileverWallDeflection(100, 40, 71700, 50, 2);

  it('tip line load: FE lies between beam theory and plate-strip limit δ(1−ν²) (±3 %)', () => {
    const w = tipLineLoad(20, 16);
    expect(w).toBeGreaterThan(beam * (1 - 0.33 ** 2) * 0.97);
    expect(w).toBeLessThan(beam * 1.03);
  });
  it('converges under mesh refinement', () => {
    const w = [tipLineLoad(5, 4), tipLineLoad(10, 8), tipLineLoad(20, 16), tipLineLoad(40, 32)];
    const d1 = Math.abs(w[1] - w[0]), d2 = Math.abs(w[2] - w[1]), d3 = Math.abs(w[3] - w[2]);
    expect(d2).toBeLessThan(d1);
    expect(d3).toBeLessThan(d2);
    expect(rel(w[2], w[3])).toBeLessThan(0.01);
  });
  it('thicker wall is stiffer (≈ t³)', () => {
    const r = tipLineLoad(20, 16, 2) / tipLineLoad(20, 16, 4);
    expect(r).toBeGreaterThan(7.5);
    expect(r).toBeLessThan(8.2);
  });
  it('compliant clamp increases deflection', () => {
    const mesh: PlateMesh = { Lx: 50, H: 40, nx: 10, nz: 8 };
    const th = new Float64Array(80).fill(2);
    const f = new Float64Array(nodeCount(mesh) * 3);
    f[nodeId(mesh, 5, 8) * 3] = 50;
    const wr = extractW(mesh, buildPlate(mesh, th, mat, rigid).chol.solve(f))[nodeId(mesh, 5, 8)];
    const ws = extractW(mesh, buildPlate(mesh, th, mat, { rigid: false, kRot: 1e4, kTrans: 1e5 }).chol.solve(f))[nodeId(mesh, 5, 8)];
    expect(ws).toBeGreaterThan(wr);
  });
});

describe('Stock-removal state', () => {
  const p: ProcessParams = { ...DEFAULT_PARAMS, meshNx: 10, meshNz: 8 };
  const res = simulate(p);
  it('volume removed equals the change in stock volume (conservation)', () => {
    expect(Math.abs(res.summary.volumeBalanceError)).toBeLessThan(1e-3 * res.summary.removedVolume + 1e-6);
  });
  it('removed volume never exceeds the nominal allowance volume (deflection leaves material)', () => {
    const nominal = 2 * p.aeFinish * p.wallHeight * p.wallLength;
    expect(res.summary.removedVolume).toBeLessThanOrEqual(nominal * 1.001);
    expect(res.summary.removedVolume).toBeGreaterThan(0.3 * nominal);
  });
  it('replaying station edits reproduces the final stock exactly', () => {
    const s = stockAt(res, res.stations.length - 1);
    for (let c = 0; c < s.front.length; c++) {
      expect(s.front[c]).toBe(res.stockFinal.front[c]);
      expect(s.back[c]).toBe(res.stockFinal.back[c]);
    }
  });
  it('thickness never increases during machining', () => {
    let prev = stockAt(res, 0);
    for (let q = 1; q < res.stations.length; q += 7) {
      const cur = stockAt(res, q);
      for (let c = 0; c < cur.front.length; c += 13)
        expect(cur.back[c] - cur.front[c]).toBeLessThanOrEqual(prev.back[c] - prev.front[c] + 1e-6);
      prev = cur;
    }
  });
  it('FE element thickness is derived from the stock', () => {
    const s = createStock(50, 40, 3);
    const th = elementThickness(s, 10, 8);
    expect(th[0]).toBeCloseTo(3, 6);
    expect(stockVolume(s)).toBeCloseTo(50 * 40 * 3, 3);
  });
});

describe('Process-level physical trends', () => {
  const small = { ...DEFAULT_PARAMS, meshNx: 10, meshNz: 8 };
  it('thinner wall → larger thickness error', () => {
    const thin = simulate({ ...small, wallThickness: 1.5 }).summary.devMax;
    const thick = simulate({ ...small, wallThickness: 4 }).summary.devMax;
    expect(thin).toBeGreaterThan(thick);
  });
  it('up- and down-milling give different surface errors (helical cutter)', () => {
    const up = simulate({ ...small, mode: 'up' }).summary.devMax;
    const dn = simulate({ ...small, mode: 'down' }).summary.devMax;
    expect(Math.abs(up - dn)).toBeGreaterThan(1e-3);
  });
  it('higher feed per tooth → higher peak force', () => {
    const a = simulate({ ...small, fz: 0.03 }).summary.peakResultant;
    const b = simulate({ ...small, fz: 0.08 }).summary.peakResultant;
    expect(b).toBeGreaterThan(a);
  });
  it('longer overhang → larger tool deflection', () => {
    const a = simulate({ ...small, overhang: 42 }).summary.maxToolDefl;
    const b = simulate({ ...small, overhang: 60 }).summary.maxToolDefl;
    expect(b).toBeGreaterThan(a);
  });
  it('wall first natural frequency is close to the cantilever beam value', () => {
    const r = simulate(small);
    // beam (pass 0 has the thickest wall, T0 = 3 mm)
    const t = r.summary.initialThickness / 1000, L = 0.04;
    const f1beam = (1.875104 ** 2 / (2 * Math.PI)) * Math.sqrt((71.7e9 * t * t) / (12 * 2810 * L ** 4));
    expect(rel(r.passes[0].f1, f1beam)).toBeLessThan(0.08);
  });
});

describe('Teaching content: Stage C production problem', async () => {
  const { SOLVE_PROBLEM } = await import('../src/content/learning');
  const base: ProcessParams = {
    ...DEFAULT_PARAMS, wallThickness: SOLVE_PROBLEM.wallThickness, wallHeight: SOLVE_PROBLEM.wallHeight,
    wallLength: SOLVE_PROBLEM.wallLength, D: SOLVE_PROBLEM.D, N: SOLVE_PROBLEM.N, tolerance: SOLVE_PROBLEM.tolerance,
  };
  const maxDev = (r: ReturnType<typeof simulate>) => Math.max(Math.abs(r.summary.devMin), Math.abs(r.summary.devMax));
  it('the baseline programme fails the tolerance (the problem is real)', () => {
    const r = simulate({ ...base, strategy: 'alternating', ap: 5, aeFinish: 0.5, overhang: 45, mode: 'down' });
    expect(maxDev(r)).toBeGreaterThan(SOLVE_PROBLEM.tolerance);
  });
  it('at least one admissible strategy meets tolerance and productivity (the problem is solvable)', () => {
    const r = simulate({ ...base, strategy: 'step-support', ap: 2, aeFinish: 0.25, overhang: 42, mode: 'up' });
    expect(maxDev(r)).toBeLessThanOrEqual(SOLVE_PROBLEM.tolerance);
    expect(r.summary.averageMRR).toBeGreaterThanOrEqual(SOLVE_PROBLEM.minMRR);
  }, 20000);
  it('B4 prediction holds in the model: single-side finishing leaves more error than alternating', () => {
    const single = maxDev(simulate({ ...base, strategy: 'single-side', meshNx: 10, meshNz: 8 }));
    const alt = maxDev(simulate({ ...base, strategy: 'alternating', meshNx: 10, meshNz: 8 }));
    expect(single).toBeGreaterThan(alt);
  });
  it('B2 prediction holds in the model: doubling fz raises peak force by less than 2×', () => {
    const a = simulate({ ...base, fz: 0.05, meshNx: 10, meshNz: 8 }).summary.peakResultant;
    const b = simulate({ ...base, fz: 0.10, meshNx: 10, meshNz: 8 }).summary.peakResultant;
    expect(b / a).toBeGreaterThan(1);
    expect(b / a).toBeLessThan(2);
  });
});
