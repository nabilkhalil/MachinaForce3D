import { describe, expect, it } from 'vitest';
import { MATERIALS } from '../src/physics/materials';
import {
  DEFAULT_TURNING, buildShaft, deflectionAt, equivalentKappa, simulateTurning, solvePointLoad, theoreticalRa, cuttingPower,
  turnStockAt, turningForces, shaftNaturalFrequency, type Supports, type TurningParams,
} from '../src/physics/turning';
import { TURNING_PROBLEM } from '../src/content/turning';

const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-12);
const K = MATERIALS.aisi1045.coeffs;
const E = MATERIALS.aisi1045.E;
const D = 25, I = (Math.PI * D ** 4) / 64, L = 300;
const sup = (w: Supports['workholding'], extra: Partial<Supports> = {}): Supports => ({
  workholding: w, chuckRigid: true, chuckKT: 0, chuckKR: 0, tailK: 1e12, headCentreK: 1e12, steadyRest: false, steadyZ: 150, steadyK: 0, ...extra,
});
const uniform = () => D;

describe('Turning force components', () => {
  it('sharp tool (rε = 0): κe = κr, Ff = FN sin κr, Fp = FN cos κr, chip area b·h = ap·f', () => {
    const F = turningForces(2, 0.2, 75, 0, K);
    expect(F.kappaE).toBeCloseTo((75 * Math.PI) / 180, 12);
    expect(F.Ff).toBeCloseTo(F.FN * Math.sin(F.kappaE), 9);
    expect(F.Fp).toBeCloseTo(F.FN * Math.cos(F.kappaE), 9);
    expect(F.b * F.h).toBeCloseTo(2 * 0.2, 12);
  });
  it('Fc = Ktc·ap·f + Kte·b (units N)', () => {
    const F = turningForces(1, 0.2, 90, 0, K);
    expect(F.Fc).toBeCloseTo(K.Ktc * 1 * 0.2 + K.Kte * 1, 9);
  });
  it('κr = 90°, sharp tool: no passive force; with a nose radius Fp > 0', () => {
    expect(Math.abs(turningForces(1, 0.2, 90, 0, K).Fp)).toBeLessThan(1e-9);
    expect(turningForces(1, 0.2, 90, 0.8, K).Fp).toBeGreaterThan(10);
  });
  it('nose radius: small depth → small equivalent angle; deep cut → κe approaches κr', () => {
    const kr = 75;
    expect(equivalentKappa(0.1, kr, 0.8)).toBeLessThan(equivalentKappa(1, kr, 0.8));
    expect(rel(equivalentKappa(50, kr, 0.8), (kr * Math.PI) / 180)).toBeLessThan(0.02);
    // whole cut on the nose: κe independent of κr
    expect(equivalentKappa(0.3, 93, 0.8)).toBeCloseTo(equivalentKappa(0.3, 75, 0.8), 12);
  });
  it('cutting power Pc = Fc·vc/60 000 and theoretical Ra = f²/(32 rε)', () => {
    expect(cuttingPower(1000, 120)).toBeCloseTo(2, 12);
    expect(theoreticalRa(0.2, 0.8)).toBeCloseTo((0.04 / 25.6) * 1000, 9);
  });
});

describe('Shaft beam FE vs closed-form solutions', () => {
  const tip = (m: ReturnType<typeof buildShaft>, z: number) => deflectionAt(m, solvePointLoad(m, z, 100), z);
  it('cantilever (chuck only), load at the free end: δ = PL³/(3EI)', () => {
    const m = buildShaft(L, 60, E, uniform, sup('chuck'));
    expect(rel(tip(m, L), (100 * L ** 3) / (3 * E * I))).toBeLessThan(1e-4);
  });
  it('between rigid centres, load at mid-span: δ = PL³/(48EI)', () => {
    const m = buildShaft(L, 60, E, uniform, sup('centres'));
    expect(rel(tip(m, L / 2), (100 * L ** 3) / (48 * E * I))).toBeLessThan(1e-4);
  });
  it('chuck + rigid tailstock (propped cantilever), load at a: δ(a) = P a² b³ (3L + b)... closed form', () => {
    const a = 180, b = L - a;
    const exact = (100 * a ** 3 * b ** 2 * (3 * L + b)) / (12 * E * I * L ** 3);
    const m = buildShaft(L, 60, E, uniform, sup('chuck-tailstock'));
    expect(rel(tip(m, a), exact)).toBeLessThan(1e-3);
  });
  it('steady rest reduces mid-span deflection; compliant tailstock increases it', () => {
    const base = tip(buildShaft(L, 60, E, uniform, sup('chuck-tailstock')), 150);
    const rest = tip(buildShaft(L, 60, E, uniform, sup('chuck-tailstock', { steadyRest: true, steadyK: 3e4 })), 150);
    const soft = tip(buildShaft(L, 60, E, uniform, sup('chuck-tailstock', { tailK: 2e4 })), 150);
    expect(rest).toBeLessThan(base);
    expect(soft).toBeGreaterThan(base);
  });
  it('mesh convergence for a load between nodes', () => {
    const c = [15, 30, 60, 120].map((n) => tip(buildShaft(L, n, E, uniform, sup('chuck-tailstock')), 173));
    expect(rel(c[2], c[3])).toBeLessThan(1e-3);
  });
  it('first natural frequency of a cantilever ≈ (1.875²/2π)·√(EI/ρAL⁴) within 2 %', () => {
    const m = buildShaft(L, 60, E, uniform, sup('chuck'));
    const rho = MATERIALS.aisi1045.rho;
    const A = (Math.PI * D * D) / 4;
    const exact = (1.875104 ** 2 / (2 * Math.PI)) * Math.sqrt((E * I) / (rho * 1e-12 * A * L ** 4));
    expect(rel(shaftNaturalFrequency(m, uniform, rho), exact)).toBeLessThan(0.02);
  });
});

describe('Turning process', () => {
  const base: TurningParams = { ...DEFAULT_TURNING };
  const res = simulateTurning(base);
  it('volume conservation and exact replay of the stock edits', () => {
    expect(Math.abs(res.summary.volumeBalanceError)).toBeLessThan(1e-6 * Math.PI * 25 * 25 * 300);
    const d = turnStockAt(res, res.stations.length - 1);
    for (let i = 0; i < d.length; i += 5) expect(d[i]).toBe(res.diaFinal[i]);
  });
  it('coupling: with a sharp tool e = c·g·ap/(1 + c·g) exactly', () => {
    const p = { ...base, noseR: 0, kappa: 75, workholding: 'chuck' as const, chuckRigid: true };
    const r = simulateTurning(p);
    const st = r.stations[0];
    const g = st.Fp / st.apEff; // Fp is linear in depth for a sharp tool
    const c = st.e / st.Fp;
    expect(rel(st.e, (c * g * st.ap) / (1 + c * g))).toBeLessThan(1e-6);
  });
  it('deflection leaves the diameter oversize but never more than the stock', () => {
    expect(res.summary.devMin).toBeGreaterThanOrEqual(-1e-9);
    expect(res.summary.devMax).toBeLessThanOrEqual(base.d0 - base.dT + 1e-9);
  });
  it('workholding ranking: chuck only ≫ centres > chuck + tailstock > with steady rest', () => {
    const dev = (o: Partial<TurningParams>) => simulateTurning({ ...base, ...o }).summary.devMax;
    const chuck = dev({ workholding: 'chuck' }), centres = dev({ workholding: 'centres' }), ct = dev({}), rest = dev({ steadyRest: true });
    expect(chuck).toBeGreaterThan(5 * ct);
    expect(centres).toBeGreaterThan(ct);
    expect(rest).toBeLessThan(ct);
  });
  it('between supports the error profile is barrel-shaped (larger in the span than at both ends)', () => {
    const r = simulateTurning({ ...base, workholding: 'centres' });
    const d = r.diaFinal, n = d.length;
    const mid = d[Math.round(n * 0.55)], nearHead = d[22], nearTail = d[n - 7]; // turned length is Z = 18…298 mm
    expect(mid).toBeGreaterThan(nearHead);
    expect(mid).toBeGreaterThan(nearTail);
  });
  it('T-B2 holds: κr 93° vs 75° makes no difference when the cut is on the nose', () => {
    const a = simulateTurning({ ...base, kappa: 93 }).summary.devMax, b = simulateTurning({ ...base, kappa: 75 }).summary.devMax;
    expect(rel(a, b)).toBeLessThan(1e-9);
  });
  it('T-B3 holds: smaller nose radius → smaller Fp and error, larger Ra', () => {
    const big = simulateTurning(base).summary, small = simulateTurning({ ...base, noseR: 0.4 }).summary;
    expect(small.maxFp).toBeLessThan(big.maxFp);
    expect(small.devMax).toBeLessThan(big.devMax);
    expect(small.ra).toBeGreaterThan(1.9 * big.ra);
  });
  it('spring pass and rough–finish reduce the error', () => {
    expect(simulateTurning({ ...base, strategy: 'spring-pass' }).summary.devMax).toBeLessThan(res.summary.devMax);
    expect(simulateTurning({ ...base, strategy: 'rough-finish' }).summary.devMax).toBeLessThan(res.summary.devMax);
  });
});

describe('Module 4 production problem', () => {
  const setup: TurningParams = { ...DEFAULT_TURNING, d0: TURNING_PROBLEM.d0, dT: TURNING_PROBLEM.dT, L: TURNING_PROBLEM.L, cutLength: TURNING_PROBLEM.cutLength, tolerance: TURNING_PROBLEM.tolerance };
  const ok = (r: ReturnType<typeof simulateTurning>) =>
    Math.max(Math.abs(r.summary.devMin), Math.abs(r.summary.devMax)) <= TURNING_PROBLEM.tolerance && r.summary.ra <= TURNING_PROBLEM.maxRa && r.summary.cycleTime <= TURNING_PROBLEM.maxTime;
  it('the baseline fails', () => expect(ok(simulateTurning({ ...setup, ...TURNING_PROBLEM.baseline }))).toBe(false));
  it('an admissible solution exists', () => expect(ok(simulateTurning({ ...setup, ...TURNING_PROBLEM.knownSolution }))).toBe(true));
});
