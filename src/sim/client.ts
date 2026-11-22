import type { ProcessParams, SimResult } from '../physics/process';
import type { PocketParams, PocketResult } from '../physics/pocketProcess';
import { simulate } from '../physics/process';
import { simulatePocket } from '../physics/pocketProcess';
import { analyseChatter, timeDomainBoundary, type ChatterParams, type ChatterResult } from '../physics/chatter';
import SimWorker from './worker?worker&inline';

type Kind = 'thinwall' | 'pocket' | 'chatter' | 'chatterBoundary';
let worker: Worker | null = null;
let seq = 0;
const latest: Record<Kind, number> = { thinwall: 0, pocket: 0, chatter: 0, chatterBoundary: 0 };
const pending = new Map<number, { resolve: (r: { result: unknown; ms: number }) => void; reject: (e: unknown) => void }>();

function getWorker(): Worker | null {
  if (worker) return worker;
  try {
    worker = new SimWorker();
    worker.onmessage = (ev) => {
      const { id, result, ms, error } = ev.data;
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (error) p.reject(new Error(error));
      else p.resolve({ result, ms });
    };
    return worker;
  } catch {
    return null;
  }
}

function run<R>(kind: Kind, params: unknown, local: () => R): Promise<{ result: R; ms: number; id: number }> {
  const id = ++seq;
  latest[kind] = id;
  const w = getWorker();
  if (!w) {
    const t0 = performance.now();
    const result = local();
    return Promise.resolve({ result, ms: performance.now() - t0, id });
  }
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: (r) => resolve({ result: r.result as R, ms: r.ms, id }), reject });
    w.postMessage({ id, kind, params });
  });
}

/** Run the Module 1 simulation off the main thread (falls back to the main thread if workers are unavailable). */
export function runSimulation(params: ProcessParams) {
  return run<SimResult>('thinwall', params, () => simulate(params));
}
export function runPocket(params: PocketParams) {
  return run<PocketResult>('pocket', params, () => simulatePocket(params));
}
export function runChatter(params: ChatterParams) {
  return run<ChatterResult>('chatter', params, () => analyseChatter(params));
}
export function runChatterBoundary(params: ChatterParams) {
  return run<{ rpm: number; a: number }[]>('chatterBoundary', params, () => timeDomainBoundary(params, 40, 12, 8, 200));
}
export function latestRequestId(kind: Kind = 'thinwall') {
  return latest[kind];
}
