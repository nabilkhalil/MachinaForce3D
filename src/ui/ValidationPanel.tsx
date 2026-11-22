/**
 * Experimental validation interface: upload measured force signals or measured wall
 * thickness and compare with the model (percentage error, RMSE). Nothing is uploaded to a
 * server — files are parsed in the browser.
 */
import { useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../state/store';
import { instantState } from '../sim/instant';
import { usePocket } from '../state/pocketStore';
import { pocketInstant } from '../sim/pocketInstant';
import { wallDev } from '../physics/pocketProcess';
import type { StockGrid } from '../physics/stock';
import { feedToGlobal, forceSignal } from '../physics/millingForce';
import { download, parseNumericCSV, toCSV } from '../lib/csv';
import { Btn, Tag, Toggle } from './controls';

type Comp = 'FX' | 'FY' | 'FZ';

function rmse(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s / Math.max(a.length, 1));
}
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(a.length, 1);
const pct = (model: number, meas: number) => (Math.abs(meas) > 1e-9 ? ((model - meas) / Math.abs(meas)) * 100 : NaN);

export function ValidationPanel() {
  const module = useApp((s) => s.module);
  const r1 = useApp((s) => s.result);
  const r2 = usePocket((s) => s.result);
  // common view of the active module's result
  const result = module === 2
    ? (r2 ? { params: { rpm: r2.params.rpm, wallLength: r2.params.wallLength, wallHeight: r2.params.pocketDepth, wallThickness: 0, coeffSource: r2.params.coeffSource }, stockFinal: r2.stockFinal } : null)
    : (r1 ? { params: { rpm: r1.params.rpm, wallLength: r1.params.wallLength, wallHeight: r1.params.wallHeight, wallThickness: r1.params.wallThickness, coeffSource: r1.params.coeffSource }, stockFinal: r1.stockFinal } : null);
  /** model value at a stock cell: thickness (Module 1) or wall deviation (Module 2) */
  const geomAt = (st: StockGrid, c: number) => (module === 2 ? wallDev(st, c) : st.back[c] - st.front[c]);
  const cursor = useApp((s) => s.cursor);
  const [forceText, setForceText] = useState<string | null>(null);
  const [thickText, setThickText] = useState<string | null>(null);
  const [onWorkpiece, setOnWorkpiece] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const idx = Math.floor(cursor.station);

  const model = useMemo(() => {
    const src = module === 2 ? r2 : r1;
    if (!src) return null;
    const inst = module === 2 ? pocketInstant(r2!, idx, 0) : instantState(r1!, idx, 0);
    const sig = forceSignal(inst.cp, src.params.rpm, 360);
    const FX: number[] = [], FY: number[] = [], FZ: number[] = [];
    sig.phi.forEach((_, i) => {
      const g = feedToGlobal({ Fx: sig.Fx[i], Fy: sig.Fy[i], Fz: sig.Fz[i] }, inst.pass.feedSign);
      FX.push(g.Fx); FY.push(g.Fy); FZ.push(g.Fz);
    });
    return { FX, FY, FZ };
  }, [module, r1, r2, idx]);

  const forceCmp = useMemo(() => {
    if (!forceText || !model || !result) return null;
    const { header, rows } = parseNumericCSV(forceText);
    const col = (names: string[]) => header.findIndex((h) => names.some((n) => h.startsWith(n)));
    const ia = col(['angle']), it = col(['time', 't_s', 't']), ix = col(['fx']), iy = col(['fy']), iz = col(['fz']);
    if ((ia < 0 && it < 0) || ix < 0 || iy < 0) return { error: 'Need columns: angle_deg (or time_s), FX_N, FY_N[, FZ_N]' };
    const sgn = onWorkpiece ? -1 : 1; // convert measured force to force on tool
    // bin measurement into 1° bins of tooth-0 angle
    const bins: Record<Comp, number[][]> = { FX: Array.from({ length: 360 }, () => []), FY: Array.from({ length: 360 }, () => []), FZ: Array.from({ length: 360 }, () => []) };
    for (const r of rows) {
      const deg = ia >= 0 ? r[ia] : ((r[it] * result.params.rpm) / 60) * 360;
      const b = ((Math.round(deg) % 360) + 360) % 360;
      bins.FX[b].push(sgn * r[ix]); bins.FY[b].push(sgn * r[iy]); if (iz >= 0) bins.FZ[b].push(sgn * r[iz]);
    }
    const meas: Record<Comp, (number | null)[]> = {
      FX: bins.FX.map((v) => (v.length ? mean(v) : null)), FY: bins.FY.map((v) => (v.length ? mean(v) : null)), FZ: bins.FZ.map((v) => (v.length ? mean(v) : null)),
    };
    // best angular alignment (the encoder zero is rarely the model's φ = 0): maximise correlation on FY
    let best = 0, bestErr = Infinity;
    for (let sh = 0; sh < 360; sh++) {
      let e = 0, n = 0;
      for (let i = 0; i < 360; i++) { const m = meas.FY[(i + sh) % 360]; if (m !== null) { e += (m - model.FY[i]) ** 2; n++; } }
      if (n && e / n < bestErr) { bestErr = e / n; best = sh; }
    }
    const out: Record<string, { rmse: number; meanPct: number; peakPct: number; n: number }> = {};
    for (const c of ['FX', 'FY', 'FZ'] as Comp[]) {
      const a: number[] = [], b: number[] = [];
      for (let i = 0; i < 360; i++) { const m = meas[c][(i + best) % 360]; if (m !== null) { a.push(model[c][i]); b.push(m); } }
      if (!b.length || (c === 'FZ' && iz < 0)) continue;
      const peak = (v: number[]) => v.reduce((p, x) => (Math.abs(x) > Math.abs(p) ? x : p), 0);
      out[c] = { rmse: rmse(a, b), meanPct: pct(mean(a), mean(b)), peakPct: pct(peak(a), peak(b)), n: b.length };
    }
    const chart = Array.from({ length: 360 }, (_, i) => ({ deg: i, modelFY: model.FY[i], measFY: meas.FY[(i + best) % 360], modelFX: model.FX[i], measFX: meas.FX[(i + best) % 360] }));
    return { out, shift: best, chart, n: rows.length };
  }, [forceText, model, result, onWorkpiece]);

  const thickCmp = useMemo(() => {
    if (!thickText || !result) return null;
    const { header, rows } = parseNumericCSV(thickText);
    const ix = header.findIndex((h) => h.startsWith('x')), iz = header.findIndex((h) => h.startsWith('z'));
    const it = module === 2 ? header.findIndex((h) => h.startsWith('dev')) : header.findIndex((h) => h.startsWith('thick') || h === 't' || h.startsWith('t_'));
    if (ix < 0 || iz < 0 || it < 0) return { error: module === 2 ? 'Need columns: x_mm, z_mm, deviation_mm' : 'Need columns: x_mm, z_mm, thickness_mm' };
    const s = result.stockFinal;
    const a: number[] = [], b: number[] = [];
    for (const r of rows) {
      const i = Math.min(Math.max(Math.floor(r[ix] / s.dx), 0), s.nxC - 1);
      const k = Math.min(Math.max(Math.floor(r[iz] / s.dz), 0), s.nzC - 1);
      const c = k * s.nxC + i;
      a.push(geomAt(s, c)); b.push(r[it]);
    }
    const errs = a.map((v, i) => v - b[i]);
    const nominal = result.params.wallThickness;
    const devErr = a.map((v, i) => Math.abs(b[i] - nominal) > 1e-6 ? ((v - nominal) - (b[i] - nominal)) / Math.abs(b[i] - nominal) * 100 : NaN).filter(Number.isFinite);
    return {
      n: rows.length, rmse: rmse(a, b), bias: mean(errs), maxAbs: Math.max(...errs.map(Math.abs)),
      meanPct: module === 2 ? NaN : mean(a.map((v, i) => Math.abs(v - b[i]) / b[i] * 100)),
      devPct: devErr.length ? mean(devErr.map(Math.abs)) : NaN,
    };
  }, [thickText, result, module]); // eslint-disable-line react-hooks/exhaustive-deps

  const read = (setter: (s: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 20e6) { setErr('File larger than 20 MB'); return; }
    f.text().then((t) => { setErr(null); setter(t); });
  };

  const syntheticForce = () => {
    if (!model || !result) return;
    const rows: (string | number)[][] = [['angle_deg', 'FX_N', 'FY_N', 'FZ_N']];
    for (let rev = 0; rev < 3; rev++) for (let i = 0; i < 360; i++) {
      const j = (i + 37) % 360; // deliberate encoder offset
      const noise = () => (Math.random() - 0.5) * 6;
      rows.push([rev * 360 + i, (-model.FX[j] * 1.12 + noise()).toFixed(2), (-model.FY[j] * 1.12 + noise()).toFixed(2), (-model.FZ[j] * 1.12 + noise()).toFixed(2)]);
    }
    download('SYNTHETIC-force-signal-example.csv', '# SYNTHETIC example generated from the model (+12 % gain, noise, 37° offset, force on workpiece). NOT measured data.\n' + toCSV(rows));
  };
  const syntheticThick = () => {
    if (!result) return;
    const s = result.stockFinal;
    const rows: (string | number)[][] = [['x_mm', 'z_mm', 'thickness_mm']];
    for (const x of [5, 15, 25, 35, 45]) for (const z of [5, 15, 25, 35, 38]) {
      if (x > result.params.wallLength || z > result.params.wallHeight) continue;
      const c = Math.min(Math.floor(z / s.dz), s.nzC - 1) * s.nxC + Math.min(Math.floor(x / s.dx), s.nxC - 1);
      rows.push([x, z, (geomAt(s, c) + 0.01 + (Math.random() - 0.5) * 0.01).toFixed(4)]);
    }
    if (module === 2) rows[0] = ['x_mm', 'z_mm', 'deviation_mm'];
    download(module === 2 ? 'SYNTHETIC-wall-deviation-example.csv' : 'SYNTHETIC-thickness-example.csv', '# SYNTHETIC example generated from the model (+10 µm bias, ±5 µm noise). NOT measured data.\n' + toCSV(rows));
  };

  if (!result) return null;
  const tip = { contentStyle: { background: '#0f172a', border: '1px solid #334155', fontSize: 11 } };
  return (
    <div className="space-y-3 text-[11px] text-slate-300">
      <div className="rounded bg-slate-900 p-2 ring-1 ring-slate-800">
        <div className="flex items-center justify-between"><h4 className="font-semibold text-slate-100">1 · Measured force signal</h4><Tag kind="assumption">current station</Tag></div>
        <p className="mt-1 text-slate-400">CSV with <code>angle_deg</code> (or <code>time_s</code>), <code>FX_N</code>, <code>FY_N</code>, <code>FZ_N</code> in the machine frame shown in the viewport. The signal is compared with the model at the current playback station; the angular offset is found automatically.</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <input type="file" accept=".csv,.txt" onChange={read(setForceText)} className="text-[11px]" />
          <Btn kind="ghost" onClick={syntheticForce}>synthetic example</Btn>
        </div>
        <div className="mt-1"><Toggle label="Measured on the workpiece (table dynamometer): sign is reversed to compare with force on tool" checked={onWorkpiece} onChange={setOnWorkpiece} /></div>
        {forceCmp && 'error' in forceCmp && <p className="mt-1 text-rose-300">{forceCmp.error}</p>}
        {forceCmp && 'out' in forceCmp && (
          <div className="mt-2 space-y-1.5">
            <table className="w-full tabular">
              <thead className="text-slate-500"><tr><th className="text-left">Comp.</th><th className="text-left">RMSE (N)</th><th className="text-left">Mean error</th><th className="text-left">Peak error</th><th className="text-left">bins</th></tr></thead>
              <tbody>{Object.entries(forceCmp.out!).map(([c, v]) => <tr key={c}><td>{c}</td><td>{v.rmse.toFixed(1)}</td><td>{v.meanPct.toFixed(1)} %</td><td>{v.peakPct.toFixed(1)} %</td><td>{v.n}</td></tr>)}</tbody>
            </table>
            <p className="text-slate-500">{forceCmp.n} samples · alignment shift {forceCmp.shift}° · % error = (model − measured)/|measured|.</p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={forceCmp.chart} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                  <CartesianGrid stroke="#1e293b" />
                  <XAxis dataKey="deg" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} />
                  <Tooltip {...tip} />
                  <Legend wrapperStyle={{ fontSize: 9 }} />
                  <Line dataKey="modelFY" name="model FY" stroke="#22c55e" dot={false} isAnimationActive={false} />
                  <Line dataKey="measFY" name="measured FY" stroke="#86efac" strokeDasharray="3 2" dot={false} connectNulls isAnimationActive={false} />
                  <Line dataKey="modelFX" name="model FX" stroke="#ef4444" dot={false} isAnimationActive={false} />
                  <Line dataKey="measFX" name="measured FX" stroke="#fca5a5" strokeDasharray="3 2" dot={false} connectNulls isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <div className="rounded bg-slate-900 p-2 ring-1 ring-slate-800">
        <h4 className="font-semibold text-slate-100">{module === 2 ? '2 · Measured wall deviation' : '2 · Measured final wall thickness'}</h4>
        {module === 2
          ? <p className="mt-1 text-slate-400">CSV with <code>x_mm</code>, <code>z_mm</code>, <code>deviation_mm</code> (CMM or dial indicator; + = wall proud of nominal). Compared with the predicted wall deviation.</p>
          : <p className="mt-1 text-slate-400">CSV with <code>x_mm</code>, <code>z_mm</code>, <code>thickness_mm</code> (e.g. CMM or micrometer points). Compared with the predicted final thickness.</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <input type="file" accept=".csv,.txt" onChange={read(setThickText)} className="text-[11px]" />
          <Btn kind="ghost" onClick={syntheticThick}>synthetic example</Btn>
        </div>
        {thickCmp && 'error' in thickCmp && <p className="mt-1 text-rose-300">{thickCmp.error}</p>}
        {thickCmp && 'rmse' in thickCmp && (
          <table className="mt-2 w-full tabular">
            <tbody>
              <tr><td>Points</td><td>{thickCmp.n}</td></tr>
              <tr><td>RMSE</td><td>{(thickCmp.rmse! * 1000).toFixed(1)} µm</td></tr>
              <tr><td>Mean bias (model − measured)</td><td>{(thickCmp.bias! * 1000).toFixed(1)} µm</td></tr>
              <tr><td>Max |error|</td><td>{(thickCmp.maxAbs! * 1000).toFixed(1)} µm</td></tr>
              {module === 1 && <tr><td>Mean % error of thickness</td><td>{thickCmp.meanPct!.toFixed(2)} %</td></tr>}
              {module === 1 && <tr><td>Mean % error of deviation from nominal</td><td>{Number.isFinite(thickCmp.devPct) ? thickCmp.devPct!.toFixed(0) + ' %' : '—'}</td></tr>}
            </tbody>
          </table>
        )}
      </div>
      {err && <p className="text-rose-300">{err}</p>}
      <div className="rounded bg-amber-950/30 p-2 text-amber-100/90 ring-1 ring-amber-900">
        <b>Model limitations to report with any comparison:</b> quasi-static (no dynamics/chatter), linear edge-force model with {result.params.coeffSource} coefficients, no run-out, no thermal or residual-stress distortion{module === 2 ? ', rigid workpiece and machine, holder stiffness illustrative' : ', rigid holder and machine, plate FE thickness updated once per pass. Percentage error of the thickness itself looks small because the nominal thickness dominates — judge the model by the error of the deviation from nominal'}.
      </div>
    </div>
  );
}
