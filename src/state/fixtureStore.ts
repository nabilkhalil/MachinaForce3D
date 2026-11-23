import { create } from 'zustand';
import { DEFAULT_FIXTURE, type FixtureParams, type FixResult, type FixSummary } from '../physics/fixture';
import { runFixture, latestRequestId } from '../sim/client';
import { playback } from './store';

export interface FixTrial { id: number; label: string; params: FixtureParams; summary: FixSummary; savedAt: string }

export interface FixtureState {
  params: FixtureParams;
  result: FixResult | null;
  computing: boolean;
  computeMs: number;
  error: string | null;
  trials: FixTrial[];
  solveNote: string;
  started: boolean;
  start: () => void;
  setParams: (p: Partial<FixtureParams>) => void;
  resetParams: () => void;
  saveTrial: (label?: string) => void;
  removeTrial: (id: number) => void;
  clearTrials: () => void;
  loadTrial: (id: number) => void;
  setSolveNote: (s: string) => void;
}

function load<T>(key: string, fallback: T): T {
  try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T) : fallback; } catch { return fallback; }
}
function save(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* memory only */ }
}
const fresh = (): FixtureParams => ({ ...DEFAULT_FIXTURE, coeffs: { ...DEFAULT_FIXTURE.coeffs } });
let debounce: ReturnType<typeof setTimeout> | undefined;
let seq = 0;

export const useFixture = create<FixtureState>((set, get) => {
  const recompute = (immediate = false) => {
    clearTimeout(debounce);
    const go = () => {
      set({ computing: true, error: null });
      runFixture(get().params)
        .then(({ result, ms, id }) => {
          if (id !== latestRequestId('fixture')) return;
          playback.station = Math.min(Math.max(0, Math.floor(playback.station)), result.stations.length - 1);
          set({ result, computing: false, computeMs: ms });
        })
        .catch((e) => set({ computing: false, error: String(e) }));
    };
    if (immediate) go(); else debounce = setTimeout(go, 150);
  };
  const trials = load<FixTrial[]>('mf3d.m5.trials', []);
  seq = trials.reduce((m, t) => Math.max(m, t.id), 0);
  return {
    params: fresh(), result: null, computing: false, computeMs: 0, error: null, trials,
    solveNote: load<string>('mf3d.m5.solveNote', ''), started: false,
    start: () => { if (!get().started) { set({ started: true }); recompute(true); } },
    setParams: (p) => { set((s) => ({ params: { ...s.params, ...p } })); recompute(); },
    resetParams: () => { set({ params: fresh() }); playback.station = 0; recompute(true); },
    saveTrial: (label) => {
      const { result, params, trials } = get();
      if (!result) return;
      const t: FixTrial = { id: ++seq, label: label || `Trial ${seq}`, params: JSON.parse(JSON.stringify(params)), summary: JSON.parse(JSON.stringify(result.summary)), savedAt: new Date().toISOString() };
      const next = [...trials, t]; save('mf3d.m5.trials', next); set({ trials: next });
    },
    removeTrial: (id) => { const next = get().trials.filter((t) => t.id !== id); save('mf3d.m5.trials', next); set({ trials: next }); },
    clearTrials: () => { save('mf3d.m5.trials', []); set({ trials: [] }); },
    loadTrial: (id) => { const t = get().trials.find((x) => x.id === id); if (t) { set({ params: JSON.parse(JSON.stringify(t.params)) }); recompute(true); } },
    setSolveNote: (s) => { save('mf3d.m5.solveNote', s); set({ solveNote: s }); },
  };
});
