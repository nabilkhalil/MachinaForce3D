import { describe, expect, it } from 'vitest';
import { MATERIALS } from '../src/physics/materials';
import { cutterForce, forceSignal, signalStats, analyticalMeanForce } from '../src/physics/millingForce';
import {
  DEFAULT_TOOLWEAR, defaultWear, fitWearCoefficients, fitWearRate, productionPlan, simulateToolWear, spindleSpeed, toolCondition, roughnessRisk,
  vbAt, wearCutParams, wearRate, wearState, wornCoefficients, type ToolWearParams,
} from '../src/physics/toolWear';
import { TOOLWEAR_PROBLEM } from '../src/content/toolWear';

const P = (o: Partial<ToolWearParams> = {}): ToolWearParams => ({ ...DEFAULT_TOOLWEAR, ...o });
const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-12);

describe('Wear-dependent force coefficients', () => {
  it('VB = 0 reproduces the fresh-tool coefficients and the Module 1 force result exactly', () => {
    const p = P();
    expect(wornCoefficients(p.coeffs, 0, p.wear)).toEqual(p.coeffs);
    const cp = wearCutParams(p, 0);
    const ref = signalStats(forceSignal({ D: p.D, N: p.N, fz: p.fz, b: p.ap, ae: p.ae, mode: p.mode, K: MATERIALS.ti64.coeffs, helixDeg: p.helixDeg, dz: 0.5 }, spindleSpeed(p), 180));
    const s = wearState(p, 0);
    expect(s.mean.Fx).toBeCloseTo(ref.mean.Fx, 9);
    expect(s.mean.Fy).toBeCloseTo(ref.mean.Fy, 9);
    expect(s.peakRes).toBeCloseTo(ref.peakResultant, 9);
    // and the numerical mean matches the closed form for the fresh tool
    const a = analyticalMeanForce(cp);
    expect(rel(s.mean.Fy, a.Fy)).toBeLessThan(0.01);
  });

  it('Ke(VB) = Ke0 + a·VB with units N/mm; shearing coefficients unchanged', () => {
    const p = P();
    const K = wornCoefficients(p.coeffs, 0.3, p.wear);
    expect(K.Kte).toBeCloseTo(p.coeffs.Kte + 0.3 * p.wear.ate, 12);
    expect(K.Kre).toBeCloseTo(p.coeffs.Kre + 0.3 * p.wear.are, 12);
    expect(K.Kae).toBeCloseTo(p.coeffs.Kae + 0.3 * p.wear.aae, 12);
    expect([K.Ktc, K.Krc, K.Kac]).toEqual([p.coeffs.Ktc, p.coeffs.Krc, p.coeffs.Kac]);
  });

  it('coefficients never become negative (negative wear slopes, negative VB)', () => {
    const p = P();
    const K = wornCoefficients(p.coeffs, 0.5, { ate: -1000, are: -1000, aae: -1000 });
    expect(Math.min(K.Kte, K.Kre, K.Kae)).toBeGreaterThanOrEqual(0);
    expect(wornCoefficients(p.coeffs, -1, p.wear)).toEqual(p.coeffs);
    Object.values(defaultWear('in718')).forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
  });

  it('force, peak force and power increase monotonically with VB for positive wear coefficients', () => {
    const r = simulateToolWear(P());
    for (let i = 1; i < r.sweep.length; i++) {
      expect(r.sweep[i].meanRes).toBeGreaterThan(r.sweep[i - 1].meanRes);
      expect(r.sweep[i].peakRes).toBeGreaterThan(r.sweep[i - 1].peakRes);
      expect(r.sweep[i].power).toBeGreaterThan(r.sweep[i - 1].power);
    }
    // the radial (thrust) tooth force grows faster (in %) than the tangential one
    const sum = (VB: number) => { const cp = wearCutParams(P(), VB); let t = 0, rr = 0; for (let k = 0; k < 90; k++) { const { teeth } = cutterForce((k / 90) * 2 * Math.PI, cp); teeth.forEach((x) => { t += x.Ft; rr += x.Fr; }); } return { t, rr }; };
    const a = sum(0), b = sum(0.3);
    expect(b.rr / a.rr).toBeGreaterThan(b.t / a.t);
  });

  it('zero wear coefficients: the force does not change with VB', () => {
    const p = P({ wear: { ate: 0, are: 0, aae: 0 } });
    expect(wearState(p, 0.4).meanRes).toBeCloseTo(wearState(p, 0).meanRes, 9);
  });
});

describe('Power and specific energy units', () => {
  it('P [kW] = T [N·m]·ω [rad/s] / 1000, with T = R·ΣFt; u [J/mm³] = P [W] / MRR [mm³/s]', () => {
    const p = P();
    const s = wearState(p, 0.2);
    const rpm = spindleSpeed(p);
    expect(s.power).toBeCloseTo((s.torque * rpm * 2 * Math.PI) / 60 / 1000, 12);
    const mrr = (p.ae * p.ap * rpm * p.N * p.fz) / 60;
    expect(s.energy).toBeCloseTo((s.power * 1000) / mrr, 12);
  });
  it('slotting with edge terms off: torque equals the closed form N·Ktc·b·fz·D/(2π)·… (mean tangential work)', () => {
    // full slot, straight flute, Kte = 0: mean ΣFt = N·Ktc·b·fz/π  →  T = R·N·Ktc·b·fz/π
    const p = P({ ae: 12, helixDeg: 0, coeffs: { ...MATERIALS.ti64.coeffs, Kte: 0, Kre: 0, Kae: 0 }, wear: { ate: 0, are: 0, aae: 0 } });
    const s = wearState(p, 0, 720);
    const T = ((p.D / 2) * p.N * p.coeffs.Ktc * p.ap * p.fz) / Math.PI / 1000;
    expect(rel(s.torque, T)).toBeLessThan(0.01);
    // specific energy of the shearing part = Ktc (N/mm² = J/mm³ ×1e-3 … here u = Ktc·1e-3 J/mm³)
    expect(rel(s.energy, p.coeffs.Ktc / 1000)).toBeLessThan(0.01);
  });
});

describe('Wear progression and replacement', () => {
  it('rate = A at the reference conditions and scales with (vc/vref)^p (fz/fref)^q', () => {
    const p = P({ vc: 60, fz: 0.05 });
    expect(wearRate(p)).toBeCloseTo(p.A, 12);
    expect(wearRate(P({ vc: 120 }))).toBeCloseTo(p.A * 2 ** p.p, 12);
    expect(wearRate(P({ fz: 0.1 }))).toBeCloseTo(p.A * 2 ** p.q, 12);
  });
  it('VB(t) is monotonic non-decreasing and starts at VB0', () => {
    const p = P({ growthMode: true, VB0: 0.02 });
    expect(vbAt(p, 0)).toBeCloseTo(0.02, 12);
    const r = simulateToolWear(p);
    for (let i = 1; i < r.timeline.length; i++) expect(r.timeline[i].VB).toBeGreaterThanOrEqual(r.timeline[i - 1].VB);
    for (let i = 1; i < r.timeline.length; i++) expect(r.timeline[i].peakRes).toBeGreaterThanOrEqual(r.timeline[i - 1].peakRes - 1e-9);
  });
  it('time to criterion and parts per tool are consistent', () => {
    const pl = productionPlan(P());
    expect(pl.tLife).toBeCloseTo(0.3 / 0.01, 9);
    expect(vbAt(P(), pl.partsPerTool * pl.tPart)).toBeLessThanOrEqual(0.3 + 1e-9);
    expect(vbAt(P(), (pl.partsPerTool + 1) * pl.tPart)).toBeGreaterThan(0.3);
    expect(pl.tools).toBe(Math.ceil(40 / pl.partsPerTool));
    expect(pl.totalTime).toBeCloseTo(40 * pl.tPart + (pl.tools - 1) * 6, 9);
  });
});

describe('Condition indicator and warnings', () => {
  it('condition levels follow VB / criterion; roughness risk is qualitative', () => {
    expect(toolCondition(0.02, 0.3)).toBe('fresh');
    expect(toolCondition(0.15, 0.3)).toBe('normal');
    expect(toolCondition(0.25, 0.3)).toBe('approaching');
    expect(toolCondition(0.3, 0.3)).toBe('replace');
    expect(toolCondition(0.5, 0.3)).toBe('beyond');
    expect(roughnessRisk(0.05, 0.3)).toBe('low');
    expect(roughnessRisk(0.35, 0.3)).toBe('high');
  });
  it('a warning appears exactly when VB reaches the criterion', () => {
    const at = (VB: number) => simulateToolWear(P({ VB })).warnings.some((w) => w.includes('replace the tool'));
    expect(at(0.29)).toBe(false);
    expect(at(0.3)).toBe(true);
    expect(at(0.4)).toBe(true);
    expect(simulateToolWear(P({ VBcrit: 0.4 })).warnings.some((w) => w.includes('ISO 8688-2'))).toBe(true);
  });
});

describe('Calibration helpers', () => {
  it('fitting forces generated with known wear coefficients recovers them', () => {
    const truth = { ate: 130, are: 260, aae: 9 };
    const p = P({ wear: truth });
    const data = [0, 0.1, 0.2, 0.3].map((VB) => { const s = wearState(p, VB, 360); return { VB, Fx: s.mean.Fx, Fy: s.mean.Fy, Fz: s.mean.Fz }; });
    const fit = fitWearCoefficients(P(), data)!;
    expect(rel(fit.ate, truth.ate)).toBeLessThan(0.02);
    expect(rel(fit.are, truth.are)).toBeLessThan(0.02);
    expect(rel(fit.aae, truth.aae)).toBeLessThan(0.05);
  });
  it('linear wear-rate fit', () => {
    const f = fitWearRate([0, 5, 10, 15].map((t) => ({ t, VB: 0.02 + 0.008 * t })))!;
    expect(f.rate).toBeCloseTo(0.008, 12);
    expect(f.VB0).toBeCloseTo(0.02, 12);
  });
});

describe('Stage C production problem', () => {
  const judge = (o: Partial<ToolWearParams>) => {
    const r = simulateToolWear(P(o)), pr = TOOLWEAR_PROBLEM;
    return r.plan.tools <= pr.maxTools && r.plan.totalTime <= pr.maxTime && r.atCrit.peakRes <= pr.maxPeakForce && r.params.VBcrit <= pr.maxCrit;
  };
  it('baseline fails', () => expect(judge(TOOLWEAR_PROBLEM.baseline)).toBe(false));
  it('the known solution passes', () => expect(judge(TOOLWEAR_PROBLEM.knownSolution)).toBe(true));
  it('raising the feed without limit violates the force limit', () => expect(judge({ ...TOOLWEAR_PROBLEM.knownSolution, vc: 50, fz: 0.12 })).toBe(false));
});
