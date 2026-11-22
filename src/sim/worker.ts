/// <reference lib="webworker" />
import { simulate, type ProcessParams } from '../physics/process';
import { simulatePocket, type PocketParams } from '../physics/pocketProcess';

type Msg = { id: number; kind: 'thinwall'; params: ProcessParams } | { id: number; kind: 'pocket'; params: PocketParams };

self.onmessage = (ev: MessageEvent<Msg>) => {
  const m = ev.data;
  try {
    const t0 = performance.now();
    const result = m.kind === 'pocket' ? simulatePocket(m.params) : simulate(m.params);
    (self as unknown as Worker).postMessage({ id: m.id, result, ms: performance.now() - t0 });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id: m.id, error: String(err) });
  }
};
