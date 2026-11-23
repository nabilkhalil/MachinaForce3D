import { create } from 'zustand';
import { DEFAULT_PARAMS, type ProcessParams, type SimResult, type SimSummary } from '../physics/process';
import { runSimulation, latestRequestId } from '../sim/client';

export type Stage = 'observe' | 'experiment' | 'solve' | 'validate';
export type ModuleId = 1 | 2 | 3 | 4 | 5 | 6;
export type ColorMode = 'displacement' | 'thickness';
export type ForceOn = 'tool' | 'workpiece';

export interface Trial {
  id: number;
  label: string;
  params: ProcessParams;
  summary: SimSummary;
  savedAt: string;
}

export interface ViewState {
  exaggeration: number;
  showForces: boolean;
  showToothForces: boolean;
  forceOn: ForceOn;
  forceScale: number; // mm per N
  showGhost: boolean;
  showMachine: boolean;
  showDims: boolean;
  colorMode: ColorMode;
  section: boolean;
  exploded: boolean;
  learn: boolean;
  camPreset: 'iso' | 'front' | 'top' | 'side' | 'machine';
  camNonce: number;
}

/**
 * Playback cursor. The 3D scene advances `playback` every frame (mutable, no React render);
 * the store's `cursor` mirrors it at a throttled rate for panels and charts.
 */
export const playback = {
  station: 0, // float index into result.stations
  phi: 0, // tooth-0 tip angle, rad (visual + instantaneous force)
  playing: false,
  speed: 1, // stations per second at 1×
  spinRate: 2.5, // visual cutter revolutions per second
};

export interface AppState {
  module: ModuleId;
  setModule: (m: ModuleId) => void;
  params: ProcessParams;
  result: SimResult | null;
  computing: boolean;
  computeMs: number;
  error: string | null;
  stage: Stage;
  view: ViewState;
  cursor: { station: number; phi: number };
  playing: boolean;
  speed: number;
  trials: Trial[];
  answers: Record<string, string>;
  studentName: string;
  solveNote: string;
  setParams: (p: Partial<ProcessParams>) => void;
  resetParams: () => void;
  setView: (v: Partial<ViewState>) => void;
  setStage: (s: Stage) => void;
  setCursor: (station: number, phi: number) => void;
  setPlaying: (p: boolean) => void;
  setSpeed: (s: number) => void;
  seek: (station: number) => void;
  saveTrial: (label?: string) => void;
  removeTrial: (id: number) => void;
  clearTrials: () => void;
  loadTrial: (id: number) => void;
  answer: (q: string, a: string) => void;
  setStudentName: (n: string) => void;
  setSolveNote: (n: string) => void;
}

let debounce: ReturnType<typeof setTimeout> | undefined;
let trialSeq = 0;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable: keep in memory only */
  }
}

export const useApp = create<AppState>((set, get) => {
  const recompute = (immediate = false) => {
    clearTimeout(debounce);
    const go = () => {
      set({ computing: true, error: null });
      const params = get().params;
      runSimulation(params)
        .then(({ result, ms, id }) => {
          if (id !== latestRequestId('thinwall')) return; // stale
          const keep = Math.min(Math.floor(playback.station), result.stations.length - 1);
          playback.station = Math.max(0, keep);
          set({ result, computing: false, computeMs: ms, cursor: { station: playback.station, phi: playback.phi } });
        })
        .catch((e) => set({ computing: false, error: String(e) }));
    };
    if (immediate) go();
    else debounce = setTimeout(go, 220);
  };
  queueMicrotask(() => recompute(true));

  const trials = load<Trial[]>('mf3d.trials', []);
  trialSeq = trials.reduce((m, t) => Math.max(m, t.id), 0);

  return {
    module: 1,
    setModule: (m) => {
      playback.playing = false;
      playback.station = 0;
      // fixture motion is µm-scale: Module 5 needs a much larger exaggeration than the others
      const ex = get().view.exaggeration;
      const exaggeration = m === 5 ? (ex <= 100 ? 400 : ex) : Math.min(ex, 100);
      const fs = get().view.forceScale;
      const big = (k: number) => k === 5 || k === 6; // ~1 kN forces → shorter arrows
      const forceScale = big(m) ? Math.min(fs, m === 6 ? 0.05 : 0.08) : big(get().module) ? 0.35 : fs;
      set((s) => ({ module: m, playing: false, cursor: { station: 0, phi: playback.phi }, view: { ...s.view, exaggeration, forceScale } }));
      try { history.replaceState(null, '', `#module-${m}`); } catch { /* sandboxed */ }
    },
    params: { ...DEFAULT_PARAMS, coeffs: { ...DEFAULT_PARAMS.coeffs } },
    result: null,
    computing: true,
    computeMs: 0,
    error: null,
    stage: 'observe',
    view: {
      exaggeration: 10,
      showForces: true,
      showToothForces: false,
      forceOn: 'tool',
      forceScale: 0.35,
      showGhost: true,
      showMachine: true,
      showDims: true,
      colorMode: 'displacement',
      section: false,
      exploded: false,
      learn: false,
      camPreset: 'iso',
      camNonce: 0,
    },
    cursor: { station: 0, phi: 0 },
    playing: false,
    speed: 1,
    trials,
    answers: load<Record<string, string>>('mf3d.answers', {}),
    studentName: load<string>('mf3d.student', ''),
    solveNote: load<string>('mf3d.solveNote', ''),
    setParams: (p) => {
      set((s) => ({ params: { ...s.params, ...p } }));
      recompute();
    },
    resetParams: () => {
      set({ params: { ...DEFAULT_PARAMS, coeffs: { ...DEFAULT_PARAMS.coeffs } } });
      playback.station = 0;
      recompute(true);
    },
    setView: (v) => set((s) => ({ view: { ...s.view, ...v } })),
    setStage: (stage) => set({ stage }),
    setCursor: (station, phi) => set({ cursor: { station, phi } }),
    setPlaying: (p) => {
      playback.playing = p;
      set({ playing: p });
    },
    setSpeed: (sp) => {
      playback.speed = sp;
      set({ speed: sp });
    },
    seek: (station) => {
      playback.station = station;
      set({ cursor: { station, phi: playback.phi } });
    },
    saveTrial: (label) => {
      const { result, params, trials } = get();
      if (!result) return;
      const t: Trial = {
        id: ++trialSeq,
        label: label || `Trial ${trialSeq}`,
        params: JSON.parse(JSON.stringify(params)),
        summary: { ...result.summary, warnings: [...result.summary.warnings] },
        savedAt: new Date().toISOString(),
      };
      const next = [...trials, t];
      save('mf3d.trials', next);
      set({ trials: next });
    },
    removeTrial: (id) => {
      const next = get().trials.filter((t) => t.id !== id);
      save('mf3d.trials', next);
      set({ trials: next });
    },
    clearTrials: () => {
      save('mf3d.trials', []);
      set({ trials: [] });
    },
    loadTrial: (id) => {
      const t = get().trials.find((x) => x.id === id);
      if (!t) return;
      set({ params: JSON.parse(JSON.stringify(t.params)) });
      recompute(true);
    },
    answer: (q, a) => {
      const next = { ...get().answers, [q]: a };
      save('mf3d.answers', next);
      set({ answers: next });
    },
    setStudentName: (n) => {
      save('mf3d.student', n);
      set({ studentName: n });
    },
    setSolveNote: (n) => {
      save('mf3d.solveNote', n);
      set({ solveNote: n });
    },
  };
});
