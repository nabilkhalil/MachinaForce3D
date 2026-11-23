import { create } from 'zustand';
import { DEFAULT_TOOLWEAR, simulateToolWear, type ToolWearParams, type WearResult } from '../physics/toolWear';
import { playback } from './store';

/** summary saved with a trial (numbers at the evaluated VB) */
export interface WearSummary { VB: number; meanRes: number; peakRes: number; power: number; energy: number; increase: number; peakAtCrit: number; tLife: number; partsPerTool: number; tools: number; totalTime: number }

export function wearSummary(r: WearResult): WearSummary {
  const VB = r.params.growthMode ? r.timeline[r.timeline.length - 1].VB : r.params.VB;
  const s = r.params.growthMode ? r.atCrit : r.manual;
  return { VB: r.params.growthMode ? r.params.VBcrit : VB, meanRes: s.meanRes, peakRes: s.peakRes, power: s.power, energy: s.energy, increase: s.meanRes / r.fresh.meanRes - 1, peakAtCrit: r.atCrit.peakRes, tLife: r.plan.tLife, partsPerTool: r.plan.partsPerTool, tools: r.plan.tools, totalTime: r.plan.totalTime };
}

export interface WearTrial { id: number; label: string; params: ToolWearParams; summary: WearSummary; savedAt: string }

export interface ToolWearState {
  params: ToolWearParams;
  result: WearResult | null;
  computing: boolean;
  computeMs: number;
  error: string | null;
  trials: WearTrial[];
  solveNote: string;
  started: boolean;
  start: () => void;
  setParams: (p: Partial<ToolWearParams>) => void;
  resetParams: () => void;
  /** fit a fresh tool: VB = VB0 = 0 and playback back to t = 0 */
  resetFresh: () => void;
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
const fresh = (): ToolWearParams => ({ ...DEFAULT_TOOLWEAR, coeffs: { ...DEFAULT_TOOLWEAR.coeffs }, wear: { ...DEFAULT_TOOLWEAR.wear } });
let debounce: ReturnType<typeof setTimeout> | undefined;
let seq = 0;

export const useToolWear = create<ToolWearState>((set, get) => {
  const recompute = (immediate = false) => {
    clearTimeout(debounce);
    const go = () => {
      try {
        const t0 = performance.now();
        const result = simulateToolWear(get().params);
        playback.station = Math.min(Math.max(0, Math.floor(playback.station)), result.timeline.length - 1);
        set({ result, computing: false, computeMs: performance.now() - t0, error: null });
      } catch (e) { set({ computing: false, error: String(e) }); }
    };
    if (immediate) go(); else debounce = setTimeout(go, 150);
  };
  const trials = load<WearTrial[]>('mf3d.m6.trials', []);
  seq = trials.reduce((m, t) => Math.max(m, t.id), 0);
  return {
    params: fresh(), result: null, computing: false, computeMs: 0, error: null, trials,
    solveNote: load<string>('mf3d.m6.solveNote', ''), started: false,
    start: () => { if (!get().started) { set({ started: true }); recompute(true); } },
    setParams: (p) => { set((s) => ({ params: { ...s.params, ...p } })); recompute(); },
    resetFresh: () => { set((s) => ({ params: { ...s.params, VB: 0, VB0: 0 } })); playback.station = 0; recompute(true); },
    resetParams: () => { set({ params: fresh() }); playback.station = 0; recompute(true); },
    saveTrial: (label) => {
      const { result, params, trials } = get();
      if (!result) return;
      const t: WearTrial = { id: ++seq, label: label || `Trial ${seq}`, params: JSON.parse(JSON.stringify(params)), summary: wearSummary(result), savedAt: new Date().toISOString() };
      const next = [...trials, t]; save('mf3d.m6.trials', next); set({ trials: next });
    },
    removeTrial: (id) => { const next = get().trials.filter((t) => t.id !== id); save('mf3d.m6.trials', next); set({ trials: next }); },
    clearTrials: () => { save('mf3d.m6.trials', []); set({ trials: [] }); },
    loadTrial: (id) => { const t = get().trials.find((x) => x.id === id); if (t) { set({ params: JSON.parse(JSON.stringify(t.params)) }); recompute(true); } },
    setSolveNote: (s) => { save('mf3d.m6.solveNote', s); set({ solveNote: s }); },
  };
});
