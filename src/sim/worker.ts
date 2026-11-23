/// <reference lib="webworker" />
import { simulate, type ProcessParams } from '../physics/process';
import { simulatePocket, type PocketParams } from '../physics/pocketProcess';
import { analyseChatter, timeDomainBoundary, type ChatterParams } from '../physics/chatter';
import { simulateTurning, type TurningParams } from '../physics/turning';
import { simulateFixture, type FixtureParams } from '../physics/fixture';
import { compareStrategies, simulateThinFloor, type ThinFloorParams } from '../physics/thinFloor';

type Msg =
  | { id: number; kind: 'thinwall'; params: ProcessParams }
  | { id: number; kind: 'pocket'; params: PocketParams }
  | { id: number; kind: 'chatter'; params: ChatterParams }
  | { id: number; kind: 'chatterBoundary'; params: ChatterParams }
  | { id: number; kind: 'turning'; params: TurningParams }
  | { id: number; kind: 'fixture'; params: FixtureParams }
  | { id: number; kind: 'thinfloor'; params: ThinFloorParams }
  | { id: number; kind: 'thinfloorCompare'; params: ThinFloorParams };

self.onmessage = (ev: MessageEvent<Msg>) => {
  const m = ev.data;
  try {
    const t0 = performance.now();
    const result =
      m.kind === 'pocket' ? simulatePocket(m.params)
      : m.kind === 'chatter' ? analyseChatter(m.params)
      : m.kind === 'chatterBoundary' ? timeDomainBoundary(m.params, 40, 12, 8, 200)
      : m.kind === 'turning' ? simulateTurning(m.params)
      : m.kind === 'fixture' ? simulateFixture(m.params)
      : m.kind === 'thinfloor' ? simulateThinFloor(m.params)
      : m.kind === 'thinfloorCompare' ? compareStrategies(m.params)
      : simulate(m.params);
    (self as unknown as Worker).postMessage({ id: m.id, result, ms: performance.now() - t0 });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id: m.id, error: String(err) });
  }
};
