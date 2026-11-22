import { create } from 'zustand';
import { DEFAULT_CHATTER, type ChatterParams, type ChatterResult } from '../physics/chatter';
import { runChatter, runChatterBoundary, latestRequestId } from '../sim/client';
import { playback } from './store';

export interface ChatterTrial {
  id: number;
  label: string;
  params: ChatterParams;
  summary: { aLimHere: number; aMin: number; verdict: string; ratio: number; domFreq: number; ppY: number; maxF: number; mrr: number; ftp: number };
  savedAt: string;
}
export interface MeasuredCut { rpm: number; ap: number; chatter: boolean }

export interface ChatterState {
  params: ChatterParams;
  result: ChatterResult | null;
  boundary: { rpm: number; a: number }[] | null;
  boundaryKey: string;
  computing: boolean;
  computingBoundary: boolean;
  computeMs: number;
  error: string | null;
  trials: ChatterTrial[];
  measured: MeasuredCut[];
  solveNote: string;
  started: boolean;
  start: () => void;
  setParams: (p: Partial<ChatterParams>) => void;
  resetParams: () => void;
  computeBoundary: () => void;
  saveTrial: (label?: string) => void;
  removeTrial: (id: number) => void;
  clearTrials: () => void;
  loadTrial: (id: number) => void;
  setMeasured: (m: MeasuredCut[]) => void;
  setSolveNote: (s: string) => void;
}

function load<T>(key: string, fallback: T): T {
  try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T) : fallback; } catch { return fallback; }
}
function save(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* memory only */ }
}
/** Baseline shown on load: the chattering programme of the Stage C problem, so students see chatter first. */
const fresh = (): ChatterParams => ({ ...DEFAULT_CHATTER, rpm: 6000, ap: 1.2, coeffs: { ...DEFAULT_CHATTER.coeffs }, modeX: { ...DEFAULT_CHATTER.modeX }, modeY: { ...DEFAULT_CHATTER.modeY } });
/** Parameters that change the stability boundary (not rpm/ap/fz, which only move the operating point). */
const keyOf = (p: ChatterParams) => JSON.stringify([p.coeffs.Ktc, p.coeffs.Krc, p.D, p.N, p.mode, p.ae, p.modeX, p.modeY, p.rpmMin, p.rpmMax]);

let debounce: ReturnType<typeof setTimeout> | undefined;
let seq = 0;

export const useChatter = create<ChatterState>((set, get) => {
  const recompute = (immediate = false) => {
    clearTimeout(debounce);
    const go = () => {
      set({ computing: true, error: null });
      runChatter(get().params)
        .then(({ result, ms, id }) => {
          if (id !== latestRequestId('chatter')) return;
          playback.station = Math.min(Math.max(0, playback.station), result.sim.x.length - 1);
          const stale = get().boundaryKey !== keyOf(result.params);
          set({ result, computing: false, computeMs: ms, ...(stale ? { boundary: null } : {}) });
        })
        .catch((e) => set({ computing: false, error: String(e) }));
    };
    if (immediate) go(); else debounce = setTimeout(go, 200);
  };
  const trials = load<ChatterTrial[]>('mf3d.m3.trials', []);
  seq = trials.reduce((m, t) => Math.max(m, t.id), 0);
  return {
    params: fresh(),
    result: null,
    boundary: null,
    boundaryKey: '',
    computing: false,
    computingBoundary: false,
    computeMs: 0,
    error: null,
    trials,
    measured: load<MeasuredCut[]>('mf3d.m3.measured', []),
    solveNote: load<string>('mf3d.m3.solveNote', ''),
    started: false,
    start: () => { if (!get().started) { set({ started: true }); recompute(true); } },
    setParams: (p) => {
      set((s) => {
        const next = { ...s.params, ...p };
        if (next.symmetric && (p.modeX || p.symmetric)) next.modeY = { ...next.modeX };
        return { params: next };
      });
      recompute();
    },
    resetParams: () => { set({ params: fresh(), boundary: null }); playback.station = 0; recompute(true); },
    computeBoundary: () => {
      const p = get().params;
      set({ computingBoundary: true });
      runChatterBoundary(p)
        .then(({ result, id }) => { if (id === latestRequestId('chatterBoundary')) set({ boundary: result, boundaryKey: keyOf(p), computingBoundary: false }); })
        .catch((e) => set({ computingBoundary: false, error: String(e) }));
    },
    saveTrial: (label) => {
      const { result, params, trials } = get();
      if (!result) return;
      const t: ChatterTrial = {
        id: ++seq, label: label || `Trial ${seq}`, params: JSON.parse(JSON.stringify(params)),
        summary: { aLimHere: result.aLimHere, aMin: result.lobes.aMin, verdict: result.sim.verdict, ratio: result.sim.chatterRatio, domFreq: result.sim.domFreq, ppY: result.sim.ppY, maxF: result.sim.maxF, mrr: result.mrr, ftp: result.ftp },
        savedAt: new Date().toISOString(),
      };
      const next = [...trials, t]; save('mf3d.m3.trials', next); set({ trials: next });
    },
    removeTrial: (id) => { const next = get().trials.filter((t) => t.id !== id); save('mf3d.m3.trials', next); set({ trials: next }); },
    clearTrials: () => { save('mf3d.m3.trials', []); set({ trials: [] }); },
    loadTrial: (id) => { const t = get().trials.find((x) => x.id === id); if (t) { set({ params: JSON.parse(JSON.stringify(t.params)) }); recompute(true); } },
    setMeasured: (m) => { save('mf3d.m3.measured', m); set({ measured: m }); },
    setSolveNote: (s) => { save('mf3d.m3.solveNote', s); set({ solveNote: s }); },
  };
});
