import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../../state/store';
import { useToolWear } from '../../state/toolWearStore';
import { forceSignal } from '../../physics/millingForce';
import { spindleSpeed, wearCutParams, wearState, ISO_VB_MAX } from '../../physics/toolWear';
import { currentVB } from '../../scene/m6/ToolWearScene';
import { PlaybackBar, axisStyle, tip } from '../BottomPanel';
import { Btn } from '../controls';
import { download, toCSV } from '../../lib/csv';
import { FORCE_COLORS } from '../../scene/Forces';

type Tab = 'angle' | 'force' | 'power' | 'time' | 'compare' | 'trials';
const xLab = (value: string) => ({ value, position: 'insideBottom' as const, offset: -6, fontSize: 10, fill: '#64748b' });
const yLab = (value: string) => ({ value, angle: -90, position: 'insideLeft' as const, fontSize: 10, fill: '#64748b' });

export function BottomPanel6() {
  const r = useToolWear((s) => s.result);
  const cursor = useApp((s) => s.cursor);
  const [tab, setTab] = useState<Tab>('angle');
  if (!r) return <div className="p-3 text-xs text-slate-400">Computing…</div>;
  const n = r.timeline.length;
  const i = Math.min(Math.max(Math.floor(cursor.station), 0), n - 1);
  const tp = r.timeline[i];
  const tabs: { id: Tab; label: string }[] = [
    { id: 'angle', label: 'Forces vs cutter angle' },
    { id: 'force', label: 'Force vs VB' },
    { id: 'power', label: 'Power & energy vs VB' },
    { id: 'time', label: 'Wear vs machining time' },
    { id: 'compare', label: 'Fresh vs worn' },
    { id: 'trials', label: 'Experiment comparison' },
  ];
  return (
    <div className="flex h-full flex-col">
      <PlaybackBar n={n} passCount={1} passIndex={0} firstStationOf={() => 0} x={tp.t}
        label={r.params.growthMode ? `t ${tp.t.toFixed(1)} min · VB ${tp.VB.toFixed(3)}` : `manual VB ${r.params.VB.toFixed(2)} mm · timeline = preview`}
        note="tool-life timeline" />
      <div className="flex gap-1 overflow-x-auto border-b border-slate-800 px-2 pt-1">
        {tabs.map((t) => <button key={t.id} onClick={() => setTab(t.id)} className={`whitespace-nowrap rounded-t px-2.5 py-1 text-[11px] ${tab === t.id ? 'bg-slate-800 text-cyan-300' : 'text-slate-400 hover:text-slate-200'}`}>{t.label}</button>)}
        <div className="ml-auto flex gap-1 pb-1"><Export6 /></div>
      </div>
      <div className="min-h-0 flex-1 p-2">
        {tab === 'angle' && <AngleChart />}
        {tab === 'force' && <VBChart kind="force" />}
        {tab === 'power' && <VBChart kind="power" />}
        {tab === 'time' && <TimeChart />}
        {tab === 'compare' && <CompareChart />}
        {tab === 'trials' && <Trials6 />}
      </div>
    </div>
  );
}

function AngleChart() {
  const r = useToolWear((s) => s.result)!;
  const cursor = useApp((s) => s.cursor);
  const VB = Math.round(currentVB(r, cursor.station) * 1000) / 1000;
  const data = useMemo(() => {
    const p = r.params, rpm = spindleSpeed(p);
    const s0 = forceSignal(wearCutParams(p, 0), rpm, 180), s1 = forceSignal(wearCutParams(p, VB), rpm, 180);
    return Array.from(s0.phi, (phi, k) => ({ deg: (phi * 180) / Math.PI, Fx: s1.Fx[k], Fy: s1.Fy[k], Fz: s1.Fz[k], F: s1.F[k], F0: s0.F[k] }));
  }, [r, VB]);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 16, bottom: 14, left: 0 }}>
        <CartesianGrid stroke="#1e293b" />
        <XAxis dataKey="deg" type="number" domain={[0, 360]} ticks={[0, 90, 180, 270, 360]} tick={axisStyle} label={xLab('cutter rotation φ (°)')} />
        <YAxis tick={axisStyle} label={yLab('force on tool (N), feed frame')} />
        <Tooltip {...tip} formatter={(v) => Number(v).toFixed(0) + ' N'} labelFormatter={(d) => `φ = ${Number(d).toFixed(0)}°`} />
        <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={18} />
        <ReferenceLine y={0} stroke="#475569" />
        <Line dataKey="Fx" name={`Fx (VB ${VB.toFixed(2)})`} stroke={FORCE_COLORS.Fx} dot={false} isAnimationActive={false} />
        <Line dataKey="Fy" name="Fy" stroke={FORCE_COLORS.Fy} dot={false} isAnimationActive={false} />
        <Line dataKey="Fz" name="Fz" stroke={FORCE_COLORS.Fz} dot={false} isAnimationActive={false} />
        <Line dataKey="F" name="|F| worn" stroke={FORCE_COLORS.F} strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line dataKey="F0" name="|F| fresh (VB = 0)" stroke="#94a3b8" strokeDasharray="5 3" dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function VBChart({ kind }: { kind: 'force' | 'power' }) {
  const r = useToolWear((s) => s.result)!;
  const cursor = useApp((s) => s.cursor);
  const VB = currentVB(r, cursor.station);
  const p = r.params;
  const data = r.sweep.map((s) => ({ VB: s.VB, mean: s.meanRes, peak: s.peakRes, Fx: Math.abs(s.mean.Fx), Fy: Math.abs(s.mean.Fy), Fz: Math.abs(s.mean.Fz), P: s.power, u: s.energy }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 16, bottom: 14, left: 0 }}>
        <CartesianGrid stroke="#1e293b" />
        <XAxis dataKey="VB" type="number" domain={[0, 0.5]} ticks={[0, 0.1, 0.2, 0.3, 0.4, 0.5]} tick={axisStyle} label={xLab('flank wear VB (mm)')} />
        {kind === 'force' ? (
          <YAxis tick={axisStyle} label={yLab('force (N)')} />
        ) : (
          <>
            <YAxis yAxisId="P" tick={axisStyle} label={yLab('cutting power (kW)')} />
            <YAxis yAxisId="u" orientation="right" tick={axisStyle} label={{ value: 'specific energy (J/mm³)', angle: 90, position: 'insideRight', fontSize: 10, fill: '#64748b' }} />
          </>
        )}
        <Tooltip {...tip} formatter={(v, nm) => Number(v).toFixed(String(nm).includes('kW') || String(nm).includes('J') ? 3 : 0)} labelFormatter={(v) => `VB = ${Number(v).toFixed(2)} mm`} />
        <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={18} />
        <ReferenceArea x1={p.VBcrit} x2={0.5} {...(kind === 'power' ? { yAxisId: 'P' } : {})} fill="#ef4444" fillOpacity={0.07} />
        <ReferenceLine x={p.VBcrit} {...(kind === 'power' ? { yAxisId: 'P' } : {})} stroke="#ef4444" strokeDasharray="4 3" label={{ value: 'criterion', fontSize: 9, fill: '#ef4444', position: 'top' }} />
        <ReferenceLine x={VB} {...(kind === 'power' ? { yAxisId: 'P' } : {})} stroke="#f59e0b" strokeDasharray="3 3" />
        {kind === 'force' ? (
          <>
            <Line dataKey="peak" name="peak |F|" stroke={FORCE_COLORS.F} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line dataKey="mean" name="mean |F|" stroke="#fde68a" dot={false} isAnimationActive={false} />
            <Line dataKey="Fx" name="|mean Fx|" stroke={FORCE_COLORS.Fx} dot={false} strokeDasharray="4 2" isAnimationActive={false} />
            <Line dataKey="Fy" name="|mean Fy|" stroke={FORCE_COLORS.Fy} dot={false} strokeDasharray="4 2" isAnimationActive={false} />
            <Line dataKey="Fz" name="|mean Fz|" stroke={FORCE_COLORS.Fz} dot={false} strokeDasharray="4 2" isAnimationActive={false} />
          </>
        ) : (
          <>
            <Line yAxisId="P" dataKey="P" name="power (kW)" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line yAxisId="u" dataKey="u" name="specific energy (J/mm³)" stroke="#38bdf8" dot={false} isAnimationActive={false} />
          </>
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

function TimeChart() {
  const r = useToolWear((s) => s.result)!;
  const cursor = useApp((s) => s.cursor);
  const p = r.params, pl = r.plan;
  const tp = r.timeline[Math.min(Math.max(Math.floor(cursor.station), 0), r.timeline.length - 1)];
  const parts = Number.isFinite(pl.tPart) ? Array.from({ length: Math.min(Math.floor((r.timeline[r.timeline.length - 1].t) / pl.tPart), 60) }, (_, k) => (k + 1) * pl.tPart) : [];
  return (
    <div className="flex h-full flex-col">
      <div className="text-[11px] text-slate-400">Illustrative growth model for one tool: dVB/dt = A·(vc/vref)^p·(fz/fref)^q = {(pl.rate * 1000).toFixed(2)} µm/min. Grey ticks = end of each part ({pl.tPart.toFixed(2)} min). {p.growthMode ? '' : 'Growth mode is off: this is a preview; the scene uses the manual VB.'}</div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={r.timeline} margin={{ top: 5, right: 16, bottom: 14, left: 0 }}>
            <CartesianGrid stroke="#1e293b" />
            <XAxis dataKey="t" type="number" domain={[0, 'dataMax']} tick={axisStyle} tickFormatter={(v) => Number(v).toFixed(0)} label={xLab('machining time with this tool (min)')} />
            <YAxis yAxisId="vb" domain={[0, 0.5]} tick={axisStyle} label={yLab('VB (mm)')} />
            <YAxis yAxisId="f" orientation="right" tick={axisStyle} label={{ value: 'peak |F| (N)', angle: 90, position: 'insideRight', fontSize: 10, fill: '#64748b' }} />
            <Tooltip {...tip} formatter={(v, nm) => (String(nm).startsWith('VB') ? Number(v).toFixed(3) + ' mm' : Number(v).toFixed(0) + ' N')} labelFormatter={(t) => `t = ${Number(t).toFixed(1)} min`} />
            <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={18} />
            {parts.map((t) => <ReferenceLine key={t} yAxisId="vb" x={t} stroke="#64748b" strokeOpacity={0.5} strokeDasharray="1 3" />)}
            <ReferenceLine yAxisId="vb" y={p.VBcrit} stroke="#ef4444" strokeDasharray="4 3" label={{ value: `criterion ${p.VBcrit.toFixed(2)} mm`, fontSize: 9, fill: '#ef4444', position: 'insideTopLeft' }} />
            <ReferenceLine yAxisId="vb" y={ISO_VB_MAX} stroke="#7f1d1d" strokeDasharray="2 3" />
            {Number.isFinite(pl.tLife) && <ReferenceLine yAxisId="vb" x={pl.tLife} stroke="#ef4444" label={{ value: `replace @ ${pl.tLife.toFixed(1)} min`, fontSize: 9, fill: '#ef4444', position: 'top' }} />}
            <ReferenceLine yAxisId="vb" x={tp.t} stroke="#f59e0b" strokeDasharray="3 3" />
            <Line yAxisId="vb" dataKey="VB" name="VB (mm)" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line yAxisId="f" dataKey="peakRes" name="peak |F| (N)" stroke={FORCE_COLORS.F} strokeDasharray="4 2" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CompareChart() {
  const r = useToolWear((s) => s.result)!;
  const cursor = useApp((s) => s.cursor);
  const VB = Math.round(currentVB(r, cursor.station) * 1000) / 1000;
  const w = useMemo(() => wearState(r.params, VB), [r, VB]);
  const f = r.fresh;
  const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
  const data = [
    { name: 'mean |F|', fresh: 100, worn: pct(w.meanRes, f.meanRes), crit: pct(r.atCrit.meanRes, f.meanRes) },
    { name: 'peak |F|', fresh: 100, worn: pct(w.peakRes, f.peakRes), crit: pct(r.atCrit.peakRes, f.peakRes) },
    { name: '|Fx|', fresh: 100, worn: pct(Math.abs(w.mean.Fx), Math.abs(f.mean.Fx)), crit: pct(Math.abs(r.atCrit.mean.Fx), Math.abs(f.mean.Fx)) },
    { name: '|Fy|', fresh: 100, worn: pct(Math.abs(w.mean.Fy), Math.abs(f.mean.Fy)), crit: pct(Math.abs(r.atCrit.mean.Fy), Math.abs(f.mean.Fy)) },
    { name: 'power', fresh: 100, worn: pct(w.power, f.power), crit: pct(r.atCrit.power, f.power) },
    { name: 'energy', fresh: 100, worn: pct(w.energy, f.energy), crit: pct(r.atCrit.energy, f.energy) },
  ];
  return (
    <div className="grid h-full grid-cols-1 gap-2 lg:grid-cols-[1.3fr_1fr]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#1e293b" /><XAxis dataKey="name" tick={axisStyle} /><YAxis tick={axisStyle} label={yLab('% of fresh tool')} /><Tooltip {...tip} formatter={(v) => Number(v).toFixed(0) + ' %'} />
          <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={18} />
          <Bar dataKey="fresh" name="fresh (VB 0)" fill="#64748b" isAnimationActive={false} />
          <Bar dataKey="worn" name={`now (VB ${VB.toFixed(2)})`} fill="#f59e0b" isAnimationActive={false} />
          <Bar dataKey="crit" name={`criterion (VB ${r.params.VBcrit.toFixed(2)})`} fill="#ef4444" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      <table className="self-start text-[11px] tabular">
        <thead className="text-slate-500"><tr><th className="text-left">Quantity</th><th className="text-right">fresh</th><th className="text-right">now</th><th className="text-right">criterion</th></tr></thead>
        <tbody className="text-slate-300">
          {[['mean |F| (N)', f.meanRes, w.meanRes, r.atCrit.meanRes, 0], ['peak |F| (N)', f.peakRes, w.peakRes, r.atCrit.peakRes, 0], ['Fx (N)', f.mean.Fx, w.mean.Fx, r.atCrit.mean.Fx, 0], ['Fy (N)', f.mean.Fy, w.mean.Fy, r.atCrit.mean.Fy, 0], ['Fz (N)', f.mean.Fz, w.mean.Fz, r.atCrit.mean.Fz, 0], ['power (kW)', f.power, w.power, r.atCrit.power, 3], ['torque (N·m)', f.torque, w.torque, r.atCrit.torque, 2], ['energy (J/mm³)', f.energy, w.energy, r.atCrit.energy, 2]].map(([k, a, b, c, d]) => (
            <tr key={k as string} className="border-t border-slate-800"><td>{k}</td><td className="text-right">{(a as number).toFixed(d as number)}</td><td className="text-right">{(b as number).toFixed(d as number)}</td><td className="text-right">{(c as number).toFixed(d as number)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function wearTrialsCSV(): string {
  const rows: (string | number)[][] = [['label', 'saved_at', 'material', 'growth_mode', 'VB_mm', 'VBcrit_mm', 'vc_m_min', 'fz_mm', 'ap_mm', 'ae_mm', 'ate', 'are', 'aae', 'mean_F_N', 'peak_F_N', 'increase_pct', 'power_kW', 'energy_J_mm3', 'peak_at_crit_N', 't_life_min', 'parts_per_tool', 'tools', 'total_time_min']];
  for (const t of useToolWear.getState().trials) {
    const p = t.params, s = t.summary;
    rows.push([t.label, t.savedAt, p.materialId, String(p.growthMode), s.VB.toFixed(3), p.VBcrit, p.vc, p.fz, p.ap, p.ae, p.wear.ate, p.wear.are, p.wear.aae,
      s.meanRes.toFixed(1), s.peakRes.toFixed(1), (s.increase * 100).toFixed(1), s.power.toFixed(4), s.energy.toFixed(3), s.peakAtCrit.toFixed(1),
      s.tLife === null || !Number.isFinite(s.tLife) ? 'inf' : s.tLife.toFixed(2), s.partsPerTool, s.tools === null || !Number.isFinite(s.tools) ? 'inf' : s.tools, s.totalTime === null || !Number.isFinite(s.totalTime) ? 'inf' : s.totalTime.toFixed(1)]);
  }
  return toCSV(rows);
}

function Trials6() {
  const trials = useToolWear((s) => s.trials);
  const { saveTrial, clearTrials, removeTrial, loadTrial } = useToolWear.getState();
  const [label, setLabel] = useState('');
  const num = (v: number | null, d = 0) => (v === null || !Number.isFinite(v) ? '—' : v.toFixed(d));
  const data = trials.map((t) => ({ name: t.label, F: t.summary.peakRes, Fc: t.summary.peakAtCrit, T: Number.isFinite(t.summary.totalTime) ? t.summary.totalTime * 10 : 0 }));
  return (
    <div className="grid h-full grid-cols-1 gap-2 lg:grid-cols-[1.4fr_1fr]">
      <div className="flex min-h-0 flex-col">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="trial label (optional)" className="w-40 rounded bg-slate-800 px-2 py-0.5 text-xs ring-1 ring-slate-700" />
          <Btn kind="primary" onClick={() => { saveTrial(label); setLabel(''); }}>Save current as trial</Btn>
          <Btn onClick={() => download('machinaforce-m6-trials.csv', wearTrialsCSV())} disabled={!trials.length}>Download CSV</Btn>
          <Btn kind="ghost" onClick={clearTrials} disabled={!trials.length}>Clear</Btn>
        </div>
        <div className="min-h-0 flex-1 overflow-auto scroll-thin">
          <table className="w-full text-[11px] tabular">
            <thead className="sticky top-0 bg-slate-900 text-slate-400"><tr>{['Trial', 'VB', 'vc', 'fz', 'peak F', '+%', 'P kW', 'F@crit', 'parts/tool', 'tools', 'time min', ''].map((h) => <th key={h} className="px-1 py-0.5 text-left font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {trials.map((t) => (
                <tr key={t.id} className="border-t border-slate-800 text-slate-300">
                  <td className="px-1">{t.label}</td><td className="px-1">{t.summary.VB.toFixed(2)}{t.params.growthMode ? '*' : ''}</td><td className="px-1">{t.params.vc}</td><td className="px-1">{t.params.fz}</td>
                  <td className="px-1">{t.summary.peakRes.toFixed(0)}</td><td className="px-1">{(t.summary.increase * 100).toFixed(0)}</td><td className="px-1">{t.summary.power.toFixed(2)}</td>
                  <td className="px-1">{t.summary.peakAtCrit.toFixed(0)}</td><td className="px-1">{t.summary.partsPerTool}</td><td className="px-1">{num(t.summary.tools)}</td><td className="px-1">{num(t.summary.totalTime, 1)}</td>
                  <td className="whitespace-nowrap px-1"><button className="text-cyan-400 hover:underline" onClick={() => loadTrial(t.id)}>load</button> <button className="text-slate-500 hover:text-rose-300" onClick={() => removeTrial(t.id)}>✕</button></td>
                </tr>
              ))}
              {!trials.length && <tr><td colSpan={12} className="px-1 py-3 text-slate-500">No trials yet. Compare VB levels, cutting speeds, feeds and criteria… (* = growth mode, VB = criterion)</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#1e293b" /><XAxis dataKey="name" tick={axisStyle} /><YAxis tick={axisStyle} /><Tooltip {...tip} />
          <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={18} />
          <Bar dataKey="F" name="peak |F| (N)" fill={FORCE_COLORS.F} isAnimationActive={false} />
          <Bar dataKey="Fc" name="peak |F| at criterion (N)" fill="#ef4444" isAnimationActive={false} />
          <Bar dataKey="T" name="total time (×0.1 min)" fill="#38bdf8" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Export6() {
  const r = useToolWear((s) => s.result);
  if (!r) return null;
  const sweep = () => {
    const rows: (string | number)[][] = [['VB_mm', 'Kte_N_mm', 'Kre_N_mm', 'Kae_N_mm', 'Fx_mean_N', 'Fy_mean_N', 'Fz_mean_N', 'F_mean_N', 'F_peak_N', 'torque_Nm', 'power_kW', 'energy_J_mm3']];
    r.sweep.forEach((s) => rows.push([s.VB.toFixed(3), s.K.Kte.toFixed(2), s.K.Kre.toFixed(2), s.K.Kae.toFixed(3), s.mean.Fx.toFixed(2), s.mean.Fy.toFixed(2), s.mean.Fz.toFixed(2), s.meanRes.toFixed(2), s.peakRes.toFixed(2), s.torque.toFixed(4), s.power.toFixed(5), s.energy.toFixed(4)]));
    download('machinaforce-m6-force-vs-VB.csv', '# MachinaForce 3D Module 6 (feed frame; forces on the tool). Estimates: illustrative cutting and wear coefficients.\n' + toCSV(rows));
  };
  const timeline = () => {
    const rows: (string | number)[][] = [['t_min', 'VB_mm', 'F_mean_N', 'F_peak_N', 'power_kW']];
    r.timeline.forEach((t) => rows.push([t.t.toFixed(3), t.VB.toFixed(4), t.meanRes.toFixed(2), t.peakRes.toFixed(2), t.power.toFixed(5)]));
    download('machinaforce-m6-wear-timeline.csv', '# Illustrative wear-rate model, not a validated tool-life prediction.\n' + toCSV(rows));
  };
  return (
    <>
      <Btn kind="ghost" onClick={sweep}>⬇ VB sweep</Btn>
      <Btn kind="ghost" onClick={timeline}>⬇ timeline</Btn>
    </>
  );
}
