import { describe, expect, it } from 'vitest';
import { CARBIDE_E } from '../src/physics/materials';
import {
  BEAM_NODES, beamGrid, beamResponse, toolNaturalFrequency, uniformBandLoads, type ToolSpec,
} from '../src/physics/toolBeam';
import { DEFAULT_POCKET, simulatePocket, pocketStockAt, type PocketParams } from '../src/physics/pocketProcess';

const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-12);
const rigid = { rigid: true, kT: 1, kR: 1 };
const tip = (t: ToolSpec, P = 100) => beamResponse(t, beamGrid(t), [{ a: t.overhang, P }]).delta[BEAM_NODES - 1];

describe('Stepped tool beam vs closed-form cantilever solutions', () => {
  const uniform: ToolSpec = { D: 10, overhang: 60, fluteLength: 60, neck: false, neckDiameter: 0, neckLength: 0, holder: rigid };
  const I8 = (Math.PI * 8 ** 4) / 64; // fluted section, d_eff = 0.8·10

  it('uniform section, tip load: δ = PL³/(3EI) within 0.1 %', () => {
    expect(rel(tip(uniform), (100 * 60 ** 3) / (3 * CARBIDE_E * I8))).toBeLessThan(1e-3);
  });
  it('uniform section, load at a < L: δ(L) = Pa²(3L − a)/(6EI)', () => {
    const g = beamGrid(uniform);
    const d = beamResponse(uniform, g, [{ a: 40, P: 100 }]).delta[BEAM_NODES - 1];
    expect(rel(d, (100 * 40 ** 2 * (3 * 60 - 40)) / (6 * CARBIDE_E * I8))).toBeLessThan(2e-3);
  });
  it('two-section (shank + flutes), tip load: δ = P[(L³−L₂³)/(3EI₁) + L₂³/(3EI₂)]', () => {
    const t: ToolSpec = { ...uniform, fluteLength: 25 };
    const I1 = (Math.PI * 10 ** 4) / 64, L = 60, L2 = 25;
    const exact = 100 * ((L ** 3 - L2 ** 3) / (3 * CARBIDE_E * I1) + L2 ** 3 / (3 * CARBIDE_E * I8));
    expect(rel(tip(t), exact)).toBeLessThan(5e-3);
  });
  it('holder springs add P/kT + P·L²/kR at the tip', () => {
    const kT = 3e4, kR = 5e7;
    const soft: ToolSpec = { ...uniform, holder: { rigid: false, kT, kR } };
    expect(rel(tip(soft) - tip(uniform), 100 / kT + (100 * 60 * 60) / kR)).toBeLessThan(2e-3);
  });
  it('reduced neck makes the tool more compliant; longer overhang ∝ L³', () => {
    const a: ToolSpec = { ...uniform, fluteLength: 20 };
    const necked: ToolSpec = { ...a, neck: true, neckDiameter: 8, neckLength: 30 };
    expect(tip(necked)).toBeGreaterThan(tip(a));
    expect(tip({ ...uniform, overhang: 80, fluteLength: 80 }) / tip(uniform)).toBeCloseTo((80 / 60) ** 3, 2);
  });
  it('bending moment at the holder face = P·a; stress = M·c/I', () => {
    const g = beamGrid(uniform);
    const r = beamResponse(uniform, g, [{ a: 50, P: 200 }]);
    expect(r.moment[0]).toBeCloseTo(200 * 50, 6);
    expect(r.stress[0]).toBeCloseTo((200 * 50 * 4) / I8, 3);
  });
  it('distributed band load equals the sum of its parts (linearity)', () => {
    const g = beamGrid(uniform);
    const whole = beamResponse(uniform, g, uniformBandLoads(50, 60, 24, 100)).delta[BEAM_NODES - 1];
    const parts = beamResponse(uniform, g, uniformBandLoads(50, 55, 12, 50)).delta[BEAM_NODES - 1]
      + beamResponse(uniform, g, uniformBandLoads(55, 60, 12, 50)).delta[BEAM_NODES - 1];
    expect(rel(whole, parts)).toBeLessThan(1e-9);
  });
  it('first bending frequency matches the uniform cantilever (1.875²/2π)·√(EI/ρAL⁴) within 2 %', () => {
    const g = beamGrid(uniform);
    const f = toolNaturalFrequency(uniform, g);
    const A = (Math.PI * 8 ** 2) / 4, rho = 14500e-12;
    const exact = (1.875104 ** 2 / (2 * Math.PI)) * Math.sqrt((CARBIDE_E * I8) / (rho * A * 60 ** 4));
    expect(rel(f, exact)).toBeLessThan(0.02);
  });
});

describe('Deep-pocket process', () => {
  const base: PocketParams = { ...DEFAULT_POCKET };
  const res = simulatePocket(base);
  it('volume conservation and exact replay of stock edits', () => {
    expect(Math.abs(res.summary.volumeBalanceError)).toBeLessThan(1e-3 * res.summary.removedVolume + 1e-6);
    const s = pocketStockAt(res, res.stations.length - 1);
    for (let c = 0; c < s.front.length; c += 7) expect(s.front[c]).toBe(res.stockFinal.front[c]);
  });
  it('deflection leaves material (positive deviation) but never more than the allowance', () => {
    expect(res.summary.devMax).toBeGreaterThan(0);
    expect(res.summary.devMax).toBeLessThanOrEqual(base.aeFinish + 1e-9);
  });
  it('rigid tool + rigid holder → no form error', () => {
    const r = simulatePocket({ ...base, holderRigid: true, D: 10, overhang: 52, fluteLength: 52, neck: false, coeffs: { ...base.coeffs }, });
    const stiff = simulatePocket({ ...base, holderRigid: true, overhang: 52, fluteLength: 52, neck: false, coeffs: { Ktc: 0, Krc: 0, Kac: 0, Kte: 0, Kre: 0, Kae: 0 } });
    expect(Math.abs(stiff.summary.devMax)).toBeLessThan(1e-9);
    expect(r.summary.devMax).toBeGreaterThan(0);
  });
  it('longer overhang → larger tip deflection and error', () => {
    const a = simulatePocket({ ...base, overhang: 55 }).summary;
    const b = simulatePocket({ ...base, overhang: 75 }).summary;
    expect(b.maxTipDefl).toBeGreaterThan(a.maxTipDefl);
    expect(b.devMax).toBeGreaterThan(a.devMax);
  });
  it('compliant holder adds error compared with a rigid holder', () => {
    expect(simulatePocket({ ...base, holderRigid: false }).summary.devMax).toBeGreaterThan(simulatePocket({ ...base, holderRigid: true }).summary.devMax);
  });
  it('spring pass reduces the maximum error', () => {
    expect(simulatePocket({ ...base, strategy: 'spring-pass' }).summary.devMax).toBeLessThan(res.summary.devMax);
  });
  it('compensation reduces the mean error', () => {
    const c = simulatePocket({ ...base, strategy: 'compensated' }).summary;
    expect(Math.abs(c.devMean)).toBeLessThan(Math.abs(res.summary.devMean));
    expect(c.compensation.length).toBe(5);
  });
  it('P-B1 holds: overhang 60 → 75 mm raises tip deflection by 1.6–2.1×', () => {
    const r = simulatePocket({ ...base, overhang: 75 }).summary.maxTipDefl / res.summary.maxTipDefl;
    expect(r).toBeGreaterThan(1.6);
    expect(r).toBeLessThan(2.1);
  });
  it('P-B4 holds: holder share of tip compliance is 20–30 % for the default holder', () => {
    expect(res.summary.holderShare).toBeGreaterThan(0.2);
    expect(res.summary.holderShare).toBeLessThan(0.3);
  });
  it('P-B2 holds: full-depth flank pass (long flutes) gives a much larger error than step-down', () => {
    expect(simulatePocket({ ...base, strategy: 'full-depth', fluteLength: 52 }).summary.devMax).toBeGreaterThan(2 * res.summary.devMax);
  });
  it('full-depth pass with short flutes is flagged', () => {
    const r = simulatePocket({ ...base, strategy: 'full-depth' });
    expect(r.summary.warnings.some((w) => w.includes('flute length'))).toBe(true);
  });
});

describe('Module 2 production problem', async () => {
  const { POCKET_PROBLEM } = await import('../src/content/pocket');
  const setup: PocketParams = {
    ...DEFAULT_POCKET, materialId: POCKET_PROBLEM.material, pocketDepth: POCKET_PROBLEM.pocketDepth, wallLength: POCKET_PROBLEM.wallLength,
    D: POCKET_PROBLEM.D, N: POCKET_PROBLEM.N, tolerance: POCKET_PROBLEM.tolerance,
  };
  const maxDev = (r: ReturnType<typeof simulatePocket>) => Math.max(Math.abs(r.summary.devMin), Math.abs(r.summary.devMax));
  it('the baseline programme fails', () => {
    expect(maxDev(simulatePocket({ ...setup, ...POCKET_PROBLEM.baseline }))).toBeGreaterThan(POCKET_PROBLEM.tolerance);
  });
  it('an admissible solution exists', () => {
    const r = simulatePocket({ ...setup, ...POCKET_PROBLEM.knownSolution });
    expect(maxDev(r)).toBeLessThanOrEqual(POCKET_PROBLEM.tolerance);
    expect(r.summary.averageMRR).toBeGreaterThanOrEqual(POCKET_PROBLEM.minMRR);
    expect(r.summary.stressRatio).toBeLessThan(POCKET_PROBLEM.maxStressRatio);
  });
});
