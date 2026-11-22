import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CHATTER, aLimAt, analyseChatter, directional, discretise, fitMode, frf, simulateTime, spectrum, stabilityLobes,
  type ChatterParams,
} from '../src/physics/chatter';
import { CHATTER_PROBLEM } from '../src/content/chatter';
import { feedRate } from '../src/physics/millingForce';

const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-12);
const base: ChatterParams = { ...DEFAULT_CHATTER, rpm: 9000, ap: 2 };
const mode = base.modeY;

describe('Modal model (FRF and discretisation)', () => {
  it('receptance: G(0) = 1/k and |G(fn)| = 1/(2kζ)', () => {
    const g0 = frf(mode, 1e-6);
    expect(rel(g0[0], 1 / mode.k)).toBeLessThan(1e-6);
    const gn = frf(mode, mode.fn);
    expect(rel(Math.hypot(gn[0], gn[1]), 1 / (2 * mode.k * mode.zeta))).toBeLessThan(1e-9);
  });
  it('minimum real part = −1/(4kζ(1+ζ)) near fn√(1+2ζ)', () => {
    let best = Infinity;
    for (let f = 500; f < 700; f += 0.01) best = Math.min(best, frf(mode, f)[0]);
    expect(rel(best, -1 / (4 * mode.k * mode.zeta * (1 + mode.zeta)))).toBeLessThan(1e-3);
  });
  it('exact discretisation: static step → 1/k, harmonic amplitude → |G(f)|', () => {
    const d = discretise(mode, 1e-4);
    let x = 0, v = 0;
    for (let i = 0; i < 20000; i++) { const x0 = x; x = d.p11 * x0 + d.p12 * v + d.g1; v = d.p21 * x0 + d.p22 * v + d.g2; }
    expect(rel(x, 1 / mode.k)).toBeLessThan(1e-6);
    const f = 1333, dt = 1 / (f * 64), dd = discretise(mode, dt);
    x = 0; v = 0; let mx = 0;
    for (let i = 0; i < 64 * 400; i++) { const F = Math.cos(2 * Math.PI * f * (i + 0.5) * dt); const x0 = x; x = dd.p11 * x0 + dd.p12 * v + dd.g1 * F; v = dd.p21 * x0 + dd.p22 * v + dd.g2 * F; if (i > 64 * 300) mx = Math.max(mx, Math.abs(x)); }
    const g = frf(mode, f);
    expect(rel(mx, Math.hypot(g[0], g[1]))).toBeLessThan(5e-3);
  });
  it('spectrum: a pure sine peaks at its frequency with its amplitude', () => {
    const dt = 1e-4, n = 4096, sig = Array.from({ length: n }, (_, i) => 0.01 * Math.sin(2 * Math.PI * 437 * i * dt));
    const s = spectrum(sig, dt);
    const pk = s.reduce((a, b) => (b.amp > a.amp ? b : a));
    expect(Math.abs(pk.f - 437)).toBeLessThan(3);
    expect(rel(pk.amp, 0.01)).toBeLessThan(0.15);
  });
});

describe('Stability lobes (zero-order approximation)', () => {
  it('slotting directional factors: αxx = αyy = −πKr, αxy = −π, αyx = π', () => {
    const a = directional(0, Math.PI, 0.33);
    expect(a.xx).toBeCloseTo(-Math.PI * 0.33, 9);
    expect(a.yy).toBeCloseTo(-Math.PI * 0.33, 9);
    expect(a.xy).toBeCloseTo(-Math.PI, 9);
    expect(a.yx).toBeCloseTo(Math.PI, 9);
  });
  it('closed form (slotting, flexible only in y): a_lim,min = 8kζ(1+ζ)/(N·Krc) within 2 %', () => {
    const p: ChatterParams = { ...base, ae: base.D, modeX: { fn: 600, zeta: 0.03, k: 1e12 }, symmetric: false, rpmMin: 2000, rpmMax: 40000 };
    const exact = (8 * mode.k * mode.zeta * (1 + mode.zeta)) / (p.N * p.coeffs.Krc);
    expect(rel(stabilityLobes(p, 40, 6000).aMin, exact)).toBeLessThan(0.02);
  });
  it('largest pocket where the tooth-passing frequency equals fn (n = 60·fn/N)', () => {
    const L = stabilityLobes(base);
    expect(aLimAt(L.curves, 9000)).toBeGreaterThan(5 * L.aMin);
  });
  it('lobe heights scale with stiffness and (approximately) with damping', () => {
    const a1 = stabilityLobes(base).aMin;
    const stiff = stabilityLobes({ ...base, modeX: { ...mode, k: 2 * mode.k }, modeY: { ...mode, k: 2 * mode.k } }).aMin;
    const damp = stabilityLobes({ ...base, modeX: { ...mode, zeta: 0.06 }, modeY: { ...mode, zeta: 0.06 } }).aMin;
    expect(rel(stiff / a1, 2)).toBeLessThan(0.02);
    expect(damp / a1).toBeGreaterThan(1.8);
    expect(damp / a1).toBeLessThan(2.3);
  });
  it('slotting is less stable than half immersion', () => {
    expect(stabilityLobes({ ...base, ae: 16 }).aMin).toBeLessThan(stabilityLobes(base).aMin);
  });
});

describe('Time-domain regenerative simulation and chatter detection', () => {
  it('very shallow cut: stable, dominant vibration at a tooth-passing harmonic', () => {
    const s = simulateTime(base, 20000, 0.05);
    expect(s.verdict).toBe('stable');
    expect(s.domIsHarmonic).toBe(true);
  });
  it('deep cut in a trough: chatter, dominant frequency NOT a harmonic and near fn', () => {
    const s = simulateTime(base, 6000, 3);
    expect(s.verdict).toBe('chatter');
    expect(s.domIsHarmonic).toBe(false);
    expect(Math.abs(s.domFreq - mode.fn) / mode.fn).toBeLessThan(0.25);
  });
  it('chatter is decided by motion, not force: a stable cut can have a larger peak force than a chattering one', () => {
    const stable = simulateTime(base, 9000, 4); // in the pocket, deep cut
    const chat = simulateTime(base, 6000, 0.6); // in a trough, shallow cut
    expect(stable.verdict).toBe('stable');
    expect(chat.verdict).toBe('chatter');
    expect(stable.maxF).toBeGreaterThan(chat.maxF);
  });
  for (const [ae, rpms] of [[8, [5000, 9000, 13000]], [16, [5000, 9000, 13000]], [4, [5000, 12000]]] as const)
    it(`cross-validation (ae = ${ae} mm): time domain stable at 0.6·a_ZOA and chattering at 1.5·a_ZOA`, () => {
      const p = { ...base, ae };
      const L = stabilityLobes(p);
      for (const rpm of rpms) {
        const a = aLimAt(L.curves, rpm);
        expect(simulateTime(p, rpm, 0.6 * a, 200, false).verdict).toBe('stable');
        expect(simulateTime(p, rpm, 1.5 * a, 200, false).verdict).toBe('chatter');
      }
    }, 30000);
  it('low immersion: ZOA is optimistic somewhere in the range (time domain finds chatter below the ZOA lobe)', () => {
    const p = { ...base, ae: 1.5 };
    const L = stabilityLobes(p);
    const found = [3000, 4000, 7000, 10000].some((rpm) => simulateTime(p, rpm, 0.8 * aLimAt(L.curves, rpm), 200, false).verdict === 'chatter');
    expect(found).toBe(true);
    expect(analyseChatter({ ...p, rpm: 7000, ap: 1 }).warnings.some((w) => w.includes('Low radial immersion'))).toBe(true);
  }, 30000);
  it('jump-out with multiple regeneration bounds the chatter amplitude (limit cycle, no divergence)', () => {
    const s = simulateTime(base, 6000, 3);
    expect(s.verdict).toBe('chatter');
    expect(s.ppY).toBeLessThan(2); // mm — bounded by tooth jump-out, not by the numerical guard
    expect(s.jumpOut).toBeGreaterThan(0.1);
  });
});

describe('Tap-test fitting', () => {
  it('peak picking recovers fn, ζ and k from a synthetic FRF within 3 %', () => {
    const m = { fn: 845, zeta: 0.042, k: 7300 };
    const f: number[] = [], re: number[] = [], im: number[] = [];
    for (let q = 200; q <= 2000; q += 0.5) { const g = frf(m, q); f.push(q); re.push(g[0]); im.push(g[1]); }
    const fit = fitMode(f, re, im)!;
    expect(rel(fit.fn, m.fn)).toBeLessThan(0.01);
    expect(rel(fit.zeta, m.zeta)).toBeLessThan(0.03);
    expect(rel(fit.k, m.k)).toBeLessThan(0.03);
  });
});

describe('Module 3 production problem', () => {
  const setup: ChatterParams = { ...base, D: CHATTER_PROBLEM.D, N: CHATTER_PROBLEM.N, ae: CHATTER_PROBLEM.ae, modeX: { ...CHATTER_PROBLEM.mode }, modeY: { ...CHATTER_PROBLEM.mode } };
  it('the baseline chatters', () => {
    const p = { ...setup, ...CHATTER_PROBLEM.baseline };
    expect(simulateTime(p, p.rpm, p.ap).verdict).toBe('chatter');
  });
  it('an admissible chatter-free solution reaches the MRR target', () => {
    const p = { ...setup, ...CHATTER_PROBLEM.knownSolution };
    expect(simulateTime(p, p.rpm, p.ap).verdict).toBe('stable');
    expect(p.ae * p.ap * feedRate(p.rpm, p.N, p.fz)).toBeGreaterThanOrEqual(CHATTER_PROBLEM.minMRR);
  });
});
