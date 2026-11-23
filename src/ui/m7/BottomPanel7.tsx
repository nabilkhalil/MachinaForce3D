import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../../state/store';
import { useThinFloor } from '../../state/thinFloorStore';
import { STRATEGY_INFO, thicknessAt, type compareStrategies, type ThinFloorResult } from '../../physics/thinFloor';
import { runThinFloorCompare } from '../../sim/client';
import { PlaybackBar, axisStyle, tip } from '../BottomPanel';
import { Btn } from '../controls';
import { download, toCSV } from '../../lib/csv';
import { cssColor, sequential } from '../../lib/colormap';
import { FORCE_COLORS } from '../../scene/Forces';

type Tab = 'force' | 'defl' | 'map' | 'profile' | 'thick' | 'strategy' | 'trials';
const xLab = (value: string) => ({ value, position: 'insideBottom' as const, offset: -6, fontSize: 10, fill: '#64748b' });
const yLab = (value: string) => ({ value, angle: -90, position: 'insideLeft' as const, fontSize: 10, fill: '#64748b' });

function pathPos(r: ThinFloorResult) {
  let s = 0;
  return r.stations.map((st) => (s += st.rapid ? 0 : st.dist));
}

export function BottomPanel7() {
  const r = useThinFloor((s) => s.result);
  const cursor = useApp((s) => s.cursor);
  const [tab, setTab] = useState<Tab>('force');
  if (!r) return <div className="p-3 text-xs text-slate-400">Computing…</div>;
  const n = r.stations.length;
  const i = Math.min(Math.max(Math.floor(cursor.station), 0), n - 1);
  const st = r.stations[i];
  const tabs: { id: Tab; label: string }[] = [
    { id: 'force', label: 'Forces vs position' },
    { id: 'defl', label: 'Deflection vs position' },
    { id: 'map', label: 'Thickness deviation map' },
    { id: 'profile', label: 'Thickness profiles' },
    { id: 'thick', label: 'Deflection vs thickness' },
    { id: 'strategy', label: 'Strategy comparison' },
    { id: 'trials', label: 'Experiment comparison' },
  ];
  return (
    <div className="flex h-full flex-col">
      <PlaybackBar n={n} passCount={r.layers} passIndex={st.layer} firstStationOf={(k) => Math.max(0, r.stations.findIndex((s) => s.layer === k))} x={st.x}
        label={`(${st.x.toFixed(0)}, ${st.y.toFixed(0)}) mm · t ${st.t.toFixed(1)} s`} note={`floor layer ${st.layer + 1}/${r.layers}`} />
      <div className="flex gap-1 overflow-x-auto border-b border-slate-800 px-2 pt-1">
        {tabs.map((t) => <button key={t.id} onClick={() => setTab(t.id)} className={`whitespace-nowrap rounded-t px-2.5 py-1 text-[11px] ${tab === t.id ? 'bg-slate-800 text-cyan-300' : 'text-slate-400 hover:text-slate-200'}`}>{t.label}</button>)}
        <div className="ml-auto flex gap-1 pb-1"><Export7 /></div>
      </div>
      <div className="min-h-0 flex-1 p-2">
        {tab === 'force' && <StationChart kind="force" />}
        {tab === 'defl' && <StationChart kind="defl" />}
        {tab === 'map' && <ErrorMap />}
        {tab === 'profile' && <Profiles />}
        {tab === 'thick' && <ThicknessChart />}
        {tab === 'strategy' && <StrategyChart />}
        {tab === 'trials' && <Trials7 />}
      </div>
    </div>
  );
}

function StationChart({ kind }: { kind: 'force' | 'defl' }) {
  const r = useThinFloor((s) => s.result)!;
  const cursor = useApp((s) => s.cursor);
  const forceOn = useApp((s) => s.view.forceOn);
  const sign = forceOn === 'tool' ? 1 : -1;
  const pos = useMemo(() => pathPos(r), [r]);
  const data = useMemo(() => r.stations.map((s, k) => ({ s: pos[k], Fx: sign * s.force.Fx, Fy: sign * s.force.Fy, Fz: sign * s.force.Fz, wt: s.wTool * 1000, wm: s.wMax * 1000 })), [r, pos, sign]);
  const now = pos[Math.min(Math.max(Math.floor(cursor.station), 0), pos.length - 1)];
  const layerStarts = r.stations.map((s, k) => (k > 0 && s.layer !== r.stations[k - 1].layer ? pos[k] : null)).filter((v): v is number => v !== null);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 16, bottom: 14, left: 0 }}>
        <CartesianGrid stroke="#1e293b" />
        <XAxis dataKey="s" type="number" domain={[0, 'dataMax']} tick={axisStyle} tickFormatter={(v) => Number(v).toFixed(0)} label={xLab('cutter position along the tool path (mm)')} />
        <YAxis tick={axisStyle} label={yLab(kind === 'force' ? `mean force on ${forceOn} (N)` : 'floor deflection (µm, down +)')} />
        <Tooltip {...tip} formatter={(v) => Number(v).toFixed(kind === 'force' ? 1 : 2)} labelFormatter={(v) => `s = ${Number(v).toFixed(0)} mm`} />
        <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={18} />
        <ReferenceLine x={now} stroke="#f59e0b" strokeDasharray="3 3" />
        {layerStarts.map((x) => <ReferenceLine key={x} x={x} stroke="#64748b" label={{ value: 'next layer', fontSize: 9, fill: '#94a3b8', position: 'top' }} />)}
        {kind === 'defl' && <ReferenceLine y={r.params.tol * 1000} stroke="#ef4444" strokeDasharray="4 3" label={{ value: 'tolerance', fontSize: 9, fill: '#ef4444', position: 'insideTopLeft' }} />}
        {kind === 'force' ? (
          <>
            <Line dataKey="Fx" name="Fx" stroke={FORCE_COLORS.Fx} dot={false} isAnimationActive={false} />
            <Line dataKey="Fy" name="Fy" stroke={FORCE_COLORS.Fy} dot={false} isAnimationActive={false} />
            <Line dataKey="Fz" name="Fz (axial)" stroke={FORCE_COLORS.Fz} strokeWidth={2} dot={false} isAnimationActive={false} />
          </>
        ) : (
          <>
            <Line dataKey="wt" name="under the cutter" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line dataKey="wm" name="max on the floor" stroke="#38bdf8" dot={false} isAnimationActive={false} />
          </>
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

function ErrorMap() {
  const r = useThinFloor((s) => s.result)!;
  const p = r.params;
  const [hover, setHover] = useState<string>('');
  const { nxC, nyC, err } = r;
  const vmax = Math.max(p.tol, r.summary.maxErr);
  const stops = Array.from({ length: 11 }, (_, i) => cssColor(sequential(i / 10))).join(',');
  return (
    <div className="flex h-full gap-3">
      <svg viewBox={`-2 -2 ${p.L + 4} ${p.W + 4}`} className="h-full max-w-[60%]" preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => setHover('')}>
        <g transform={`translate(0 ${p.W}) scale(1 -1)`}>
          {Array.from({ length: nxC }, (_, i) => Array.from({ length: nyC }, (_, j) => {
            const v = err[i * nyC + j];
            const fill = Number.isFinite(v) ? cssColor(sequential(Math.min(Math.abs(v) / vmax, 1))) : '#1e293b';
            return <rect key={i * nyC + j} x={(i * p.L) / nxC} y={(j * p.W) / nyC} width={p.L / nxC + 0.05} height={p.W / nyC + 0.05} fill={fill}
              stroke={Number.isFinite(v) && Math.abs(v) > p.tol ? '#ef4444' : 'none'} strokeWidth={0.15}
              onMouseEnter={() => setHover(Number.isFinite(v) ? `x ${((i + 0.5) * p.L / nxC).toFixed(1)}, y ${((j + 0.5) * p.W / nyC).toFixed(1)} mm: t = ${(p.tFinal + v).toFixed(3)} mm (${v >= 0 ? '+' : ''}${(v * 1000).toFixed(1)} µm)` : 'corner fillet (not floor)')} />;
          }))}
          <rect x={0} y={0} width={p.L} height={p.W} fill="none" stroke="#94a3b8" strokeWidth={0.4} />
        </g>
      </svg>
      <div className="min-w-0 flex-1 space-y-2 text-[11px] text-slate-300">
        <p>Final floor thickness deviation from {p.tFinal} mm (+ = too thick), top view, X → right, Y → up. Red outline: outside ±{(p.tol * 1000).toFixed(0)} µm.</p>
        <div className="h-2.5 rounded" style={{ background: `linear-gradient(90deg,${stops})` }} />
        <div className="flex justify-between text-[10px] text-slate-500 tabular"><span>0</span><span>{(vmax * 1000).toFixed(0)} µm</span></div>
        <p className="tabular text-cyan-200">{hover || 'Hover a cell for its thickness.'}</p>
        <p className="text-slate-500">Max |error| {(r.summary.maxErr * 1000).toFixed(1)} µm · mean {(r.summary.meanErr * 1000).toFixed(1)} µm · {r.summary.pass ? 'PASS' : 'FAIL'}</p>
      </div>
    </div>
  );
}

function Profiles() {
  const r = useThinFloor((s) => s.result)!;
  const p = r.params;
  const [axis, setAxis] = useState<'x' | 'y'>('x');
  const data = useMemo(() => {
    const n = 81;
    return Array.from({ length: n }, (_, k) => {
      const u = k / (n - 1);
      const x = axis === 'x' ? u * p.L : p.L / 2, y = axis === 'x' ? p.W / 2 : u * p.W;
      const t = thicknessAt(r, x, y);
      return { s: axis === 'x' ? x : y, t: Number.isFinite(t) ? t : null };
    });
  }, [r, axis, p]);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <Btn kind={axis === 'x' ? 'primary' : undefined} onClick={() => setAxis('x')}>along X at y = W/2</Btn>
        <Btn kind={axis === 'y' ? 'primary' : undefined} onClick={() => setAxis('y')}>along Y at x = L/2</Btn>
        <span>Final thickness after springback; green band = tolerance.</span>
      </div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 16, bottom: 14, left: 8 }}>
            <CartesianGrid stroke="#1e293b" />
            <XAxis dataKey="s" type="number" domain={[0, axis === 'x' ? p.L : p.W]} tick={axisStyle} tickFormatter={(v) => Number(v).toFixed(0)} label={xLab(`${axis} (mm)`)} />
            <YAxis domain={[(dataMin: number) => Math.min(dataMin, p.tFinal - p.tol) - 0.01, (dataMax: number) => Math.max(dataMax, p.tFinal + p.tol) + 0.01]} tick={axisStyle} tickFormatter={(v) => Number(v).toFixed(3)} label={yLab('floor thickness (mm)')} />
            <Tooltip {...tip} formatter={(v) => Number(v).toFixed(4) + ' mm'} labelFormatter={(v) => `${axis} = ${Number(v).toFixed(1)} mm`} />
            <ReferenceArea y1={p.tFinal - p.tol} y2={p.tFinal + p.tol} fill="#10b981" fillOpacity={0.12} />
            <ReferenceLine y={p.tFinal} stroke="#10b981" strokeDasharray="4 3" />
            <Line dataKey="t" name="thickness" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ThicknessChart() {
  const r = useThinFloor((s) => s.result)!;
  const data = r.thicknessStudy.map((d) => ({ t: d.t, w: d.w * 1000 }));
  return (
    <div className="flex h-full flex-col">
      <div className="text-[11px] text-slate-400">Centre deflection for the mean axial force ({r.summary.meanFz.toFixed(1)} N) applied at the pocket centre, current supports, uniform floor thickness. D = E t³ / [12(1 − ν²)] ⇒ w ∝ 1/t³.</div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 16, bottom: 14, left: 0 }}>
            <CartesianGrid stroke="#1e293b" />
            <XAxis dataKey="t" type="number" domain={[1, 4]} tick={axisStyle} label={xLab('floor thickness t (mm)')} />
            <YAxis scale="log" domain={['auto', 'auto']} tick={axisStyle} tickFormatter={(v) => Number(v).toFixed(1)} label={yLab('centre deflection (µm, log)')} />
            <Tooltip {...tip} formatter={(v) => Number(v).toFixed(2) + ' µm'} labelFormatter={(v) => `t = ${v} mm`} />
            <ReferenceLine x={r.params.tFinal} stroke="#f59e0b" strokeDasharray="3 3" />
            <ReferenceLine y={r.params.tol * 1000} stroke="#ef4444" strokeDasharray="4 3" label={{ value: 'tolerance', fontSize: 9, fill: '#ef4444', position: 'insideTopRight' }} />
            <Line dataKey="w" name="w centre" stroke="#38bdf8" strokeWidth={2} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function StrategyChart() {
  const p = useThinFloor((s) => s.params);
  const [data, setData] = useState<ReturnType<typeof compareStrategies> | null>(null);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const now = JSON.stringify(p);
  const run = async () => { setBusy(true); try { setData((await runThinFloorCompare(p)).result); setKey(now); } finally { setBusy(false); } };
  const rows = data?.map((d) => ({ name: STRATEGY_INFO[d.strategy].name, err: d.maxErr * 1000, defl: d.maxDeflection * 1000, time: d.cutTime, Fz: d.meanFz }));
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
        <Btn kind="primary" onClick={run} disabled={busy}>{busy ? 'running 3 simulations…' : 'Compare strategies'}</Btn>
        <span>Same conditions, three tool paths (coarser station spacing).</span>
        {data && key !== now && <span className="text-amber-300">parameters changed — run again</span>}
      </div>
      {rows ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-[1.3fr_1fr]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 5, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="#1e293b" /><XAxis dataKey="name" tick={axisStyle} /><YAxis tick={axisStyle} /><Tooltip {...tip} formatter={(v) => Number(v).toFixed(1)} />
              <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={18} />
              <ReferenceLine y={p.tol * 1000} stroke="#ef4444" strokeDasharray="4 3" />
              <Bar dataKey="err" name="max |thickness error| (µm)" fill="#f59e0b" isAnimationActive={false} />
              <Bar dataKey="defl" name="max deflection (µm)" fill="#38bdf8" isAnimationActive={false} />
              <Bar dataKey="time" name="cutting time (s)" fill="#a78bfa" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
          <table className="self-start text-[11px] tabular">
            <thead className="text-slate-500"><tr><th className="text-left">Strategy</th><th className="text-right">|err| µm</th><th className="text-right">w max µm</th><th className="text-right">mean Fz N</th><th className="text-right">time s</th><th></th></tr></thead>
            <tbody className="text-slate-300">{data!.map((d) => <tr key={d.strategy} className="border-t border-slate-800"><td>{STRATEGY_INFO[d.strategy].name}</td><td className="text-right">{(d.maxErr * 1000).toFixed(1)}</td><td className="text-right">{(d.maxDeflection * 1000).toFixed(1)}</td><td className="text-right">{d.meanFz.toFixed(1)}</td><td className="text-right">{d.cutTime.toFixed(1)}</td><td className={d.pass ? 'text-emerald-300' : 'text-rose-300'}>{d.pass ? 'pass' : 'fail'}</td></tr>)}</tbody>
          </table>
        </div>
      ) : <p className="p-3 text-[11px] text-slate-500">Press “Compare strategies” to simulate zigzag, spiral and adaptive-style finishing with the current settings.</p>}
    </div>
  );
}

export function floorTrialsCSV(): string {
  const rows: (string | number)[][] = [['label', 'saved_at', 'material', 'L_mm', 'W_mm', 't_mm', 'tol_mm', 'strategy', 'edge', 'under', 'D_mm', 'N', 'rpm', 'fz_mm', 'ae_mm', 'ap_mm', 'allowance_mm',
    'mean_Fz_N', 'peak_F_N', 'max_deflection_mm', 'max_abs_error_mm', 'pass', 'cut_time_s', 'MRR_mm3_min', 'f1_end_Hz']];
  for (const t of useThinFloor.getState().trials) {
    const p = t.params, s = t.summary;
    rows.push([t.label, t.savedAt, p.materialId, p.L, p.W, p.tFinal, p.tol, p.strategy, p.edge, p.under, p.D, p.N, p.rpm, p.fz, p.ae, p.ap, p.allowance,
      s.meanFz.toFixed(2), s.peakF.toFixed(1), s.maxDeflection.toFixed(5), s.maxErr.toFixed(5), String(s.pass), s.cutTime.toFixed(2), s.mrr.toFixed(0), s.f1End.toFixed(0)]);
  }
  return toCSV(rows);
}

function Trials7() {
  const trials = useThinFloor((s) => s.trials);
  const { saveTrial, clearTrials, removeTrial, loadTrial } = useThinFloor.getState();
  const [label, setLabel] = useState('');
  const data = trials.map((t) => ({ name: t.label, err: t.summary.maxErr * 1000, time: t.summary.cutTime }));
  return (
    <div className="grid h-full grid-cols-1 gap-2 lg:grid-cols-[1.4fr_1fr]">
      <div className="flex min-h-0 flex-col">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="trial label (optional)" className="w-40 rounded bg-slate-800 px-2 py-0.5 text-xs ring-1 ring-slate-700" />
          <Btn kind="primary" onClick={() => { saveTrial(label); setLabel(''); }}>Save current as trial</Btn>
          <Btn onClick={() => download('machinaforce-m7-trials.csv', floorTrialsCSV())} disabled={!trials.length}>Download CSV</Btn>
          <Btn kind="ghost" onClick={clearTrials} disabled={!trials.length}>Clear</Btn>
        </div>
        <div className="min-h-0 flex-1 overflow-auto scroll-thin">
          <table className="w-full text-[11px] tabular">
            <thead className="sticky top-0 bg-slate-900 text-slate-400"><tr>{['Trial', 'strategy', 'support', 't', 'fz', 'ae', 'rpm', 'Fz N', 'w µm', '|err| µm', 'time s', ''].map((h) => <th key={h} className="px-1 py-0.5 text-left font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {trials.map((t) => (
                <tr key={t.id} className="border-t border-slate-800 text-slate-300">
                  <td className="px-1">{t.label}</td><td className="px-1">{t.params.strategy}</td><td className="px-1">{t.params.edge}/{t.params.under}</td><td className="px-1">{t.params.tFinal}</td>
                  <td className="px-1">{t.params.fz}</td><td className="px-1">{t.params.ae}</td><td className="px-1">{t.params.rpm}</td><td className="px-1">{t.summary.meanFz.toFixed(1)}</td>
                  <td className="px-1">{(t.summary.maxDeflection * 1000).toFixed(1)}</td><td className={`px-1 ${t.summary.pass ? 'text-emerald-300' : 'text-rose-300'}`}>{(t.summary.maxErr * 1000).toFixed(1)}</td><td className="px-1">{t.summary.cutTime.toFixed(1)}</td>
                  <td className="whitespace-nowrap px-1"><button className="text-cyan-400 hover:underline" onClick={() => loadTrial(t.id)}>load</button> <button className="text-slate-500 hover:text-rose-300" onClick={() => removeTrial(t.id)}>✕</button></td>
                </tr>
              ))}
              {!trials.length && <tr><td colSpan={12} className="px-1 py-3 text-slate-500">No trials yet. Compare thickness, span, fz, support and strategy…</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#1e293b" /><XAxis dataKey="name" tick={axisStyle} /><YAxis tick={axisStyle} /><Tooltip {...tip} formatter={(v) => Number(v).toFixed(1)} />
          <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={18} />
          <Bar dataKey="err" name="max |error| (µm)" fill="#f59e0b" isAnimationActive={false} />
          <Bar dataKey="time" name="cutting time (s)" fill="#a78bfa" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Export7() {
  const r = useThinFloor((s) => s.result);
  if (!r) return null;
  const stations = () => {
    const rows: (string | number)[][] = [['station', 'layer', 'x_mm', 'y_mm', 'mode', 'ae_mm', 'ap_eff_mm', 'Fx_tool_N', 'Fy_tool_N', 'Fz_tool_N', 'w_under_cutter_mm', 'w_max_mm', 'time_s']];
    r.stations.forEach((s, k) => rows.push([k, s.layer + 1, s.x.toFixed(2), s.y.toFixed(2), s.link ? 'link' : s.mode, s.ae.toFixed(2), s.apEff.toFixed(4), s.force.Fx.toFixed(2), s.force.Fy.toFixed(2), s.force.Fz.toFixed(2), s.wTool.toFixed(6), s.wMax.toFixed(6), s.t.toFixed(3)]));
    download('machinaforce-m7-stations.csv', '# MachinaForce 3D Module 7 (machine frame; forces on the tool; deflection positive downward). Estimates: illustrative coefficients.\n' + toCSV(rows));
  };
  const map = () => {
    const rows: (string | number)[][] = [['x_mm', 'y_mm', 'thickness_mm', 'deviation_mm']];
    for (let i = 0; i < r.nxC; i++) for (let j = 0; j < r.nyC; j++) {
      const v = r.err[i * r.nyC + j];
      if (Number.isFinite(v)) rows.push([((i + 0.5) * r.params.L / r.nxC).toFixed(2), ((j + 0.5) * r.params.W / r.nyC).toFixed(2), (r.params.tFinal + v).toFixed(5), v.toFixed(5)]);
    }
    download('machinaforce-m7-thickness-map.csv', '# Simulated final floor thickness (model estimate).\n' + toCSV(rows));
  };
  return (
    <>
      <Btn kind="ghost" onClick={stations}>⬇ stations</Btn>
      <Btn kind="ghost" onClick={map}>⬇ map</Btn>
    </>
  );
}
