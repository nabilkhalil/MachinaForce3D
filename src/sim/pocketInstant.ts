import { cutterForce, feedToGlobal, type CutParams, type ForceVector, type ToothState } from '../physics/millingForce';
import { pocketCutParams, type PocketPass, type PocketResult, type PocketStation } from '../physics/pocketProcess';

export interface PocketInstant {
  index: number;
  station: PocketStation;
  pass: PocketPass;
  tool: { x: number; y: number; zTip: number };
  cp: CutParams;
  F: ForceVector; // global, on tool
  teeth: ToothState[];
  contact: [number, number, number];
}

export function pocketInstant(res: PocketResult, stationFloat: number, phi: number): PocketInstant {
  const n = res.stations.length;
  const sf = Math.min(Math.max(stationFloat, 0), n - 1);
  const i = Math.floor(sf);
  const st = res.stations[i];
  const pass = res.passes[st.pass];
  let x = st.x;
  if (i + 1 < n && res.stations[i + 1].pass === st.pass) x = st.x + (res.stations[i + 1].x - st.x) * (sf - i);
  const R = res.params.D / 2;
  const y = pass.target - R;
  const cp = { ...pocketCutParams(res.params, st.aeEff, st.b), dz: 0.1 };
  const { F, teeth } = cutterForce(phi, cp);
  const Fg = feedToGlobal(F, pass.feedSign);
  return { index: i, station: st, pass, tool: { x, y, zTip: pass.zBot }, cp, F: Fg, teeth, contact: [x, y + R, pass.zBot + Math.max(st.b, 0.5) / 2] };
}
