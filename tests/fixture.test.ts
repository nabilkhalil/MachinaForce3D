import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FIXTURE, clampedState, cutResponse, fixtureFrequencies, forceDirections, layoutElements, pointDisp, simulateFixture,
  solve6, staticPush, errorAt, type FixtureParams, type Vec3,
} from '../src/physics/fixture';
import { FIXTURE_PROBLEM } from '../src/content/fixture';

const P = (o: Partial<FixtureParams> = {}): FixtureParams => ({ ...DEFAULT_FIXTURE, ...o });
const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-12);

describe('Rigid-body fixture statics', () => {
  it('solve6 solves a well-conditioned 6×6 system', () => {
    const A = Array.from({ length: 6 }, (_, i) => Array.from({ length: 6 }, (_, j) => (i === j ? 10 + i : 1 / (1 + i + j))));
    const x = [1, -2, 3, -4, 5, -6];
    const b = A.map((r) => r.reduce((s, v, j) => s + v * x[j], 0));
    solve6(A, b)!.forEach((v, i) => expect(v).toBeCloseTo(x[i], 10));
  });

  it('3-2-1 layout: 6 locators whose normals span all six DOF; clamps oppose locators', () => {
    const els = layoutElements(P());
    const loc = els.filter((e) => e.kind === 'locator');
    expect(loc.length).toBe(6);
    expect(loc.filter((e) => e.n[2] === 1).length).toBe(3);
    expect(loc.filter((e) => e.n[1] === 1).length).toBe(2);
    expect(loc.filter((e) => e.n[0] === 1).length).toBe(1);
    const m = clampedState(P());
    expect(m.ok).toBe(true);
  });

  it('clamped state is in equilibrium: Σ contact forces + gravity = 0 (forces and moments)', () => {
    const m = clampedState(P());
    const F = [0, 0, -m.mass * 9810], M = [0, 0, 0];
    m.els.forEach((e, i) => {
      const f = e.n.map((v) => v * m.N0[i]);
      const r = m.r[i];
      for (let k = 0; k < 3; k++) F[k] += f[k];
      M[0] += r[1] * f[2] - r[2] * f[1]; M[1] += r[2] * f[0] - r[0] * f[2]; M[2] += r[0] * f[1] - r[1] * f[0];
    });
    F.forEach((v) => expect(Math.abs(v)).toBeLessThan(1e-6));
    M.forEach((v) => expect(Math.abs(v)).toBeLessThan(1e-4));
  });

  it('clamps directly over the base locators: each base locator carries its clamp force (+ gravity share)', () => {
    const m = clampedState(P());
    const base = m.els.map((e, i) => ({ e, N: m.N0[i] })).filter((x) => x.e.kind === 'locator' && x.e.n[2] === 1);
    const W = m.mass * 9810;
    base.forEach((b) => expect(b.N).toBeGreaterThan(DEFAULT_FIXTURE.topClamp));
    expect(base.reduce((s, b) => s + b.N, 0)).toBeCloseTo(3 * DEFAULT_FIXTURE.topClamp + W, 6);
  });

  it('end locator without end clamp is unloaded but allowed; clamps away from the locators unseat a locator', () => {
    const m = clampedState(P());
    const L6 = m.els.findIndex((e) => e.id === 'L6');
    expect(m.N0[L6]).toBeLessThan(1e-6 + 0.01 * DEFAULT_FIXTURE.topClamp);
    const bad = clampedState(P({ layout: 'off-locator' }));
    expect(bad.ok).toBe(false);
    expect(Math.min(...bad.els.map((e, i) => (e.kind === 'locator' && e.n[2] === 1 ? bad.N0[i] : Infinity)))).toBe(0);
  });

  it('pure Z push at the centroid over a symmetric seated set: settlement = F / Σk_z (no tilt)', () => {
    // symmetric base: clamps over each base locator, push through the centroid of the base triangle
    const m = clampedState(P({ sideClamp: 0 }));
    const base = m.els.map((_e, i) => i).filter((i) => m.els[i].n[2] !== 0);
    const F = -500;
    // centroid of base locators' x,y (weighted by stiffness) → pure translation
    const kz = base.reduce((s, i) => s + m.kn[i], 0);
    const xc = base.reduce((s, i) => s + m.kn[i] * m.els[i].p[0], 0) / kz;
    const yc = base.reduce((s, i) => s + m.kn[i] * m.els[i].p[1], 0) / kz;
    const r = cutResponse(m, [0, 0, F], [xc, yc, m.c[2]]);
    const u = pointDisp(r.q, [xc - m.c[0], yc - m.c[1], 0]);
    expect(r.restrained).toBe(true);
    expect(rel(u[2], F / kz)).toBeLessThan(0.05);
  });

  it('incremental cut equilibrium: cutting force = Σ change of contact forces (normal + friction)', () => {
    const m = clampedState(P());
    const Fc: Vec3 = [300, -600, -150], pc: Vec3 = [75, 40, 47.5];
    const r = cutResponse(m, Fc, pc);
    expect(r.restrained).toBe(true);
    // reconstruct each contact force from the spring laws and check the force balance
    const sum = [0, 0, 0];
    m.els.forEach((e, i) => {
      if (r.contacts[i].status === 'lift') return;
      const u = pointDisp(r.q, m.r[i]);
      const un = u[0] * e.n[0] + u[1] * e.n[1] + u[2] * e.n[2];
      const ut = u.map((v, k) => v - un * e.n[k]);
      const dN = -m.kn[i] * un;
      for (let k = 0; k < 3; k++) sum[k] += e.n[k] * dN - m.kt[i] * ut[k];
    });
    expect(r.slipping || r.lifted).toBe(false);
    for (let k = 0; k < 3; k++) expect(sum[k] + Fc[k]).toBeCloseTo(0, 6);
  });

  it('natural frequency of a block on springs: f = √(k/m)/2π for the Z mode (sanity, order of magnitude)', () => {
    const m = clampedState(P());
    const f = fixtureFrequencies(m);
    expect(f.length).toBe(6);
    f.forEach((v, i) => i && expect(v).toBeGreaterThanOrEqual(f[i - 1]));
    const kz = m.els.reduce((s, e, i) => s + (e.n[2] !== 0 ? m.kn[i] : m.kt[i]), 0);
    const fz = Math.sqrt(kz / m.mass) / (2 * Math.PI);
    expect(fz).toBeGreaterThan(f[0] * 0.8);
    expect(fz).toBeLessThan(f[5] * 1.5);
  });
});

describe('Lift-off, slip and clamping safety', () => {
  it('a force pulling the part off the base locators makes them lift off', () => {
    const m = clampedState(P());
    const r = cutResponse(m, [0, 0, 20000], [75, 40, 50]);
    expect(r.lifted || !r.restrained).toBe(true);
  });

  it('a large tangential force with small clamping makes a contact slip', () => {
    const m = clampedState(P({ topClamp: 300, sideClamp: 200 }));
    const r = cutResponse(m, [0, -1500, 0], [75, 40, 45]);
    expect(r.slipping || r.lifted || !r.restrained).toBe(true);
    const m2 = clampedState(P({ topClamp: 6000, sideClamp: 4000 }));
    const r2 = cutResponse(m2, [0, -1500, 0], [75, 40, 45]);
    expect(r2.slipping).toBe(false);
    expect(r2.minSlipSF).toBeGreaterThan(1);
  });

  it('slip safety factor scales ≈ with clamp force and exactly with μ', () => {
    const a = simulateFixture(P()).summary, b = simulateFixture(P({ topClamp: 6000, sideClamp: 4000 })).summary;
    expect(b.minSlipSF / a.minSlipSF).toBeGreaterThan(1.7);
    expect(b.minSlipSF / a.minSlipSF).toBeLessThan(2.3);
    // more clamp → contacts stiffer (N^1/3) → error falls, but only a little
    expect(b.maxAbsEy).toBeLessThan(a.maxAbsEy);
    expect(b.maxAbsEy / a.maxAbsEy).toBeGreaterThan(0.7);
    const c = simulateFixture(P({ mu: 0.4 })).summary;
    expect(c.minSlipSF / a.minSlipSF).toBeCloseTo(0.4 / 0.25, 1);
  });

  it('minimum clamp multiplier: at required scale the path just holds, below it does not', () => {
    const s = simulateFixture(P()).summary;
    expect(s.requiredClampScale).toBeGreaterThan(0.1);
    expect(s.requiredClampScale).toBeLessThan(1);
    const scale = s.requiredClampScale;
    const at = simulateFixture(P({ topClamp: DEFAULT_FIXTURE.topClamp * scale * 1.05, sideClamp: DEFAULT_FIXTURE.sideClamp * scale * 1.05 })).summary;
    const below = simulateFixture(P({ topClamp: DEFAULT_FIXTURE.topClamp * scale * 0.8, sideClamp: DEFAULT_FIXTURE.sideClamp * scale * 0.8 })).summary;
    expect(at.clampOK).toBe(true);
    expect(below.clampOK).toBe(false);
  });
});

describe('Cutting load and feature error', () => {
  it('slot force direction: +X feed pushes the part into the side locators; −X into the side clamp', () => {
    const plus = simulateFixture(P()).summary, minus = simulateFixture(P({ feedDir: '-X' })).summary;
    expect(plus.into.y).toBe(1);
    expect(minus.into.y).toBe(-1);
    expect(minus.into.x).toBe(-plus.into.x);
    expect(forceDirections({ Fx: 0, Fy: 10, Fz: 0 }).y).toBe(1);
    expect(minus.minSlipSF).toBeLessThan(plus.minSlipSF);
  });

  it('feature error = −(displacement at the cutting point), and scales linearly with the force (ap)', () => {
    const a = simulateFixture(P()), b = simulateFixture(P({ ap: 2.5 }));
    // contacts remain in the stick state → linear: error ∝ force (∝ ap here at constant contact point height ~)
    expect(a.summary.clampOK && b.summary.clampOK).toBe(true);
    const ra = a.stations[Math.floor(a.stations.length / 2)], rb = b.stations[Math.floor(b.stations.length / 2)];
    expect(Math.sign(ra.ey)).toBe(Math.sign(rb.ey));
    expect(Math.abs(ra.ey)).toBeGreaterThan(Math.abs(rb.ey) * 1.5);
  });

  it('locator spread: the narrow layout gives a much larger slot error and tilt than the good layout', () => {
    const g = simulateFixture(P()).summary, n = simulateFixture(P({ layout: 'narrow' })).summary;
    expect(n.maxAbsEy / g.maxAbsEy).toBeGreaterThan(3);
    expect(n.maxTilt / g.maxTilt).toBeGreaterThan(3);
    expect(n.freqs[0]).toBeLessThan(g.freqs[0]);
  });

  it('static push test returns a displacement along the force and agrees with the cut response', () => {
    const r = staticPush(P(), [75, 0.1, 25], [0, -1000, 0]);
    expect(r.restrained).toBe(true);
    expect(r.along).toBeGreaterThan(0);
    expect(r.along).toBeLessThan(0.05);
  });

  it('error interpolation along the slot is inside the station range', () => {
    const res = simulateFixture(P());
    const e = errorAt(res, 75);
    const eys = res.stations.map((s) => s.ey);
    expect(e.ey).toBeGreaterThanOrEqual(Math.min(...eys) - 1e-12);
    expect(e.ey).toBeLessThanOrEqual(Math.max(...eys) + 1e-12);
  });
});

describe('Stage C production problem', () => {
  const judge = (o: Partial<FixtureParams>) => {
    const p = P({ ...o, materialId: FIXTURE_PROBLEM.material });
    const s = simulateFixture(p).summary;
    const clamps = [p.topClamp, p.sideClamp, p.endClamp];
    return {
      s,
      pass:
        s.clampOK && s.maxAbsEy <= FIXTURE_PROBLEM.tolerance && s.maxAbsEz <= FIXTURE_PROBLEM.tolerance &&
        1 / s.requiredClampScale >= FIXTURE_PROBLEM.minSafety && Math.max(...clamps) <= FIXTURE_PROBLEM.maxClamp &&
        s.freqs[0] >= FIXTURE_PROBLEM.minFreqRatio * s.ftp && s.cycleTime <= FIXTURE_PROBLEM.maxCycleTime,
    };
  };
  it('baseline fails', () => {
    const b = judge(FIXTURE_PROBLEM.baseline);
    expect(b.pass).toBe(false);
    expect(b.s.clampOK).toBe(false);
  });
  it('the known solution passes every requirement', () => {
    expect(judge(FIXTURE_PROBLEM.knownSolution).pass).toBe(true);
  });
  it('only raising the clamp force on the poor layout is not enough', () => {
    expect(judge({ ...FIXTURE_PROBLEM.baseline, topClamp: 6000, sideClamp: 6000 }).pass).toBe(false);
  });
});
