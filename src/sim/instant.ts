import { cutterForce, feedToGlobal, type CutParams, type ForceVector, type ToothState } from '../physics/millingForce';
import { cutParamsFor, type Pass, type SimResult, type StationRecord } from '../physics/process';

export interface InstantState {
  index: number;
  station: StationRecord;
  pass: Pass;
  /** tool axis position (machine frame), mm */
  tool: { x: number; y: number; zTip: number };
  cp: CutParams;
  /** global force on the TOOL at the current cutter angle */
  F: ForceVector;
  teeth: ToothState[];
  /** force on the wall in +Y (= −FY on tool) */
  wallLoad: number;
  /** representative contact point (mid engaged band, on the tool periphery), machine frame */
  contact: [number, number, number];
}

export function instantState(res: SimResult, stationFloat: number, phi: number): InstantState {
  const n = res.stations.length;
  const sf = Math.min(Math.max(stationFloat, 0), n - 1);
  const i = Math.floor(sf);
  const frac = sf - i;
  const st = res.stations[i];
  const pass = res.passes[st.pass];
  let x = st.x;
  if (i + 1 < n && res.stations[i + 1].pass === st.pass) x = st.x + (res.stations[i + 1].x - st.x) * frac;
  const R = res.params.D / 2;
  const y = pass.target - pass.n * R;
  // finer helix slicing than the process solver, for smooth graphs (same model)
  const cp = { ...cutParamsFor(res.params, st.aeEff, st.b), dz: 0.1 };
  const { F, teeth } = cutterForce(phi, cp);
  const Fg = feedToGlobal(F, pass.feedSign);
  return {
    index: i,
    station: st,
    pass,
    tool: { x, y, zTip: pass.zBot },
    cp,
    F: Fg,
    teeth,
    wallLoad: -Fg.Fy,
    contact: [x, y + pass.n * R, pass.zBot + Math.max(st.b, 0.5) / 2],
  };
}

/** Machine-frame (X,Y) position of a tooth tip at immersion φ, relative to the tool axis. */
export function toothXY(phi: number, R: number, feedSign: 1 | -1): [number, number] {
  return [feedSign * R * Math.sin(phi), feedSign * R * Math.cos(phi)];
}
