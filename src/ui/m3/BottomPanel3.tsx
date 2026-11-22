import { useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useApp } from '../../state/store';
import { useChatter } from '../../state/chatterStore';
import { PlaybackBar, axisStyle, tip } from '../BottomPanel';
import { Btn } from '../controls';
import { download, toCSV } from '../../lib/csv';
import { chatterLive } from '../../scene/m3/ChatterScene';

type Tab = 'lobes' | 'frf' | 'time' | 'spectrum' | 'trials';

export function BottomPanel3() {
  const r = useChatter((s) => s.result);
  const cursor = useApp((s) => s.cursor);
  const [tab, setTab] = useState<Tab>('lobes');
  if (!r) return <div className="p-3 text-xs text-slate-400">Computing…</div>;
  const n = r.sim.x.length;
  const i = Math.min(Math.floor(cursor.station), n - 1);
  const tMs = n ? (r.sim.t[i] - r.sim.t[0]) * 1000 : 0;
  const tabs: { id: Tab; label: string }[] = [
    { id: 'lobes', label: 'Stability lobe diagram' },
    { id: 'frf', label: 'Tool FRF (tap test)' },
    { id: 'time', label: 'Vibration vs time' },
    { id: 'spectrum', label: 'Vibration spectrum' },
    { id: 'trials', label: 'Experiment comparison' },
  ];
  return (
    <div className="flex h-full flex-col">
      <PlaybackBar n={n} passCount={1} passIndex={0} firstStationOf={() => 0} x={0}
        label={`t = ${tMs.toFixed(2)} ms · tooth ${Math.floor(i / r.sim.stepsPerTooth) + 1}`} note="Slow motion of the simulated vibration (time-domain model)." />
      <div className="flex gap-1 overflow-x-auto border-b border-slate-800 px-2 pt-1">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`whitespace-nowrap rounded-t px-2.5 py-1 text-[11px] ${tab === t.id ? 'bg-slate-800 text-cyan-300' : 'text-slate-400 hover:text-slate-200'}`}>{t.label}</button>
        ))}
        <div className="ml-auto flex gap-1 pb-1"><Export3 /></div>
      </div>
      <div className="min-h-0 flex-1 p-2">
        {tab === 'lobes' && <LobeChart />}
        {tab === 'frf' && <FrfChart />}
        {tab === 'time' && <TimeChart />}
        {tab === 'spectrum' && <SpectrumChart />}
        {tab === 'trials' && <Trials3 />}
      </div>
    </div>
  );
}

function LobeChart() {
  const r = useChatter((s) => s.result)!;
  const boundary = useChatter((s) => s.boundary);
  const busy = useChatter((s) => s.computingBoundary);
  const measured = useChatter((s) => s.measured);
  const { computeBoundary, setParams } = useChatter.getState();
  const p = r.params;
  const env = r.lobes.envelope.filter((e) => Number.isFinite(e.a));
  const yMax = Math.min(Math.max(4 * r.lobes.aMin, p.ap * 1.6, 1), Math.max(...env.map((e) => e.a)) * 1.05);
  const data = env.map((e) => ({ rpm: e.rpm, zoa: Math.min(e.a, yMax * 1.5) }));
  const td = boundary?.map((b) => ({ rpm: b.rpm, td: b.a })) ?? [];
  const stableCuts = measured.filter((m) => !m.chatter).map((m) => ({ rpm: m.rpm, meas: m.ap }));
  const chatCuts = measured.filter((m) => m.chatter).map((m) => ({ rpm: m.rpm, meas: m.ap }));
  const ok = r.sim.verdict === 'stable';
  return (
    <div className="flex h-full flex-col">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
        <span>Below the curve = stable; above = chatter. Dot = your operating point ({ok ? 'stable' : 'chatter'} in the time-domain simulation). Click the chart to move to that speed.</span>
        <Btn onClick={computeBoundary} disabled={busy}>{busy ? 'computing…' : boundary ? 'Recompute time-domain boundary' : 'Compute time-domain boundary (~2 s)'}</Btn>
      </div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 5, right: 16, bottom: 14, left: 0 }}
            onClick={(e) => { const v = Number((e as { activeLabel?: unknown } | null)?.activeLabel); if (Number.isFinite(v)) setParams({ rpm: Math.round(v / 50) * 50 }); }}>
            <CartesianGrid stroke="#1e293b" />
            <XAxis dataKey="rpm" type="number" domain={[p.rpmMin, p.rpmMax]} tick={axisStyle} tickFormatter={(v) => (Number(v) / 1000).toFixed(0) + 'k'}
              label={{ value: 'spindle speed n (rpm)', position: 'insideBottom', offset: -6, fontSize: 10, fill: '#64748b' }} />
            <YAxis type="number" domain={[0, yMax]} allowDataOverflow tick={axisStyle} tickFormatter={(v) => Number(v).toFixed(1)}
              label={{ value: 'axial depth limit a_lim (mm)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }} />
            <Tooltip {...tip} formatter={(v, name) => [Number(v).toFixed(2) + ' mm', String(name)]} labelFormatter={(v) => `n = ${Number(v).toFixed(0)} rpm`} />
            <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={18} />
            <Line data={data} dataKey="zoa" name="ZOA stability lobes (analytical)" stroke="#22d3ee" strokeWidth={2} dot={false} isAnimationActive={false} />
            {td.length > 0 && <Line data={td} dataKey="td" name="time-domain boundary (numerical)" stroke="#f59e0b" strokeDasharray="4 3" dot={{ r: 2 }} isAnimationActive={false} />}
            {stableCuts.length > 0 && <Scatter data={stableCuts} dataKey="meas" name="measured: stable" fill="#10b981" isAnimationActive={false} />}
            {chatCuts.length > 0 && <Scatter data={chatCuts} dataKey="meas" name="measured: chatter" fill="#f43f5e" shape="cross" isAnimationActive={false} />}
            <ReferenceLine x={(60 * Math.min(p.modeX.fn, p.modeY.fn)) / p.N} stroke="#475569" strokeDasharray="2 4" label={{ value: 'f_tp = fn', fontSize: 9, fill: '#64748b', position: 'top' }} />
            <ReferenceDot x={p.rpm} y={Math.min(p.ap, yMax)} r={6} fill={ok ? '#10b981' : '#f43f5e'} stroke="#fff" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function FrfChart() {
  const r = useChatter((s) => s.result)!;
  const sym = r.params.symmetric;
  const harmonics = [1, 2, 3, 4].map((k) => k * r.ftp).filter((f) => f < r.frfCurve[r.frfCurve.length - 1].f);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={r.frfCurve} margin={{ top: 5, right: 16, bottom: 14, left: 0 }}>
        <CartesianGrid stroke="#1e293b" />
        <XAxis dataKey="f" type="number" domain={[0, 'dataMax']} tick={axisStyle} label={{ value: 'frequency (Hz) — dashed: tooth-passing harmonics', position: 'insideBottom', offset: -6, fontSize: 10, fill: '#64748b' }} />
        <YAxis tick={axisStyle} label={{ value: 'receptance (µm/N)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }} />
        <Tooltip {...tip} formatter={(v) => Number(v).toFixed(3) + ' µm/N'} labelFormatter={(f) => `${Number(f).toFixed(0)} Hz`} />
        <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={18} />
        {harmonics.map((f, k) => <ReferenceLine key={k} x={f} stroke="#f59e0b" strokeDasharray="3 3" />)}
        <ReferenceLine y={0} stroke="#475569" />
        <Line dataKey="magX" name={sym ? '|G|' : '|Gxx|'} stroke="#e2e8f0" dot={false} isAnimationActive={false} />
        <Line dataKey="reX" name={sym ? 'real' : 'real xx'} stroke="#38bdf8" dot={false} isAnimationActive={false} />
        <Line dataKey="imX" name={sym ? 'imaginary' : 'imag xx'} stroke="#f43f5e" dot={false} isAnimationActive={false} />
        {!sym && <Line dataKey="reY" name="real yy" stroke="#38bdf8" strokeDasharray="4 2" dot={false} isAnimationActive={false} />}
        {!sym && <Line dataKey="imY" name="imag yy" stroke="#f43f5e" strokeDasharray="4 2" dot={false} isAnimationActive={false} />}
      </LineChart>
    </ResponsiveContainer>
  );
}

function TimeChart() {
  const r = useChatter((s) => s.result)!;
  const cursor = useApp((s) => s.cursor);
  const s = r.sim;
  const data = useMemo(() => {
    const n = s.x.length, stride = Math.max(1, Math.floor(n / 1500));
    const out: { t: number; x: number; y: number }[] = [];
    for (let i = 0; i < n; i += stride) out.push({ t: (s.t[i] - s.t[0]) * 1000, x: s.x[i] * 1000, y: s.y[i] * 1000 });
    return out;
  }, [s]);
  const samples = useMemo(() => s.samples.map((i) => ({ t: (s.t[i] - s.t[0]) * 1000, samp: s.y[i] * 1000 })), [s]);
  const i = Math.min(Math.floor(cursor.station), s.x.length - 1);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart margin={{ top: 5, right: 16, bottom: 14, left: 0 }}>
        <CartesianGrid stroke="#1e293b" />
        <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tick={axisStyle} tickFormatter={(v) => Number(v).toFixed(0)} label={{ value: 'time (ms), steady part of the simulation', position: 'insideBottom', offset: -6, fontSize: 10, fill: '#64748b' }} />
        <YAxis tick={axisStyle} label={{ value: 'tool displacement (µm)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }} />
        <Tooltip {...tip} formatter={(v) => Number(v).toFixed(2) + ' µm'} labelFormatter={(t) => `t = ${Number(t).toFixed(2)} ms`} />
        <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={18} />
        <Line data={data} dataKey="y" name="y (normal)" stroke="#22c55e" dot={false} isAnimationActive={false} />
        <Line data={data} dataKey="x" name="x (feed)" stroke="#ef4444" dot={false} strokeOpacity={0.7} isAnimationActive={false} />
        <Scatter data={samples} dataKey="samp" name="once-per-tooth samples of y" fill="#f59e0b" isAnimationActive={false} />
        <ReferenceLine x={(s.t[i] - s.t[0]) * 1000} stroke="#f59e0b" strokeDasharray="3 3" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function SpectrumChart() {
  const r = useChatter((s) => s.result)!;
  const s = r.sim;
  const data = s.spectrum.map((q) => ({ f: q.f, amp: q.amp * 1000 }));
  const fMax = data.length ? data[data.length - 1].f : 1000;
  const harmonics = Array.from({ length: 8 }, (_, k) => (k + 1) * r.ftp).filter((f) => f < fMax);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 16, bottom: 14, left: 0 }}>
        <CartesianGrid stroke="#1e293b" />
        <XAxis dataKey="f" type="number" domain={[0, fMax]} tick={axisStyle} tickFormatter={(v) => Number(v).toFixed(0)} label={{ value: 'frequency (Hz) — amber: tooth-passing harmonics · grey: natural frequency', position: 'insideBottom', offset: -6, fontSize: 10, fill: '#64748b' }} />
        <YAxis tick={axisStyle} label={{ value: 'y amplitude (µm)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }} />
        <Tooltip {...tip} formatter={(v) => Number(v).toFixed(3) + ' µm'} labelFormatter={(f) => `${Number(f).toFixed(1)} Hz`} />
        {harmonics.map((f, k) => <ReferenceLine key={k} x={f} stroke="#f59e0b" strokeDasharray="3 3" />)}
        <ReferenceLine x={r.params.modeY.fn} stroke="#94a3b8" strokeDasharray="2 4" />
        <ReferenceLine x={s.domFreq} stroke={s.domIsHarmonic ? '#10b981' : '#f43f5e'} label={{ value: `${s.domFreq.toFixed(0)} Hz ${s.domIsHarmonic ? '(harmonic)' : '(chatter)'}`, fontSize: 10, fill: s.domIsHarmonic ? '#10b981' : '#f43f5e', position: 'top' }} />
        <Line dataKey="amp" name="y spectrum" stroke="#22c55e" dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function chatterTrialsCSV(): string {
  const rows: (string | number)[][] = [['label', 'saved_at', 'material', 'D_mm', 'N', 'mode', 'ae_mm', 'ap_mm', 'rpm', 'fz_mm', 'fn_x_Hz', 'zeta_x', 'k_x_N_per_mm', 'fn_y_Hz', 'zeta_y', 'k_y_N_per_mm',
    'zoa_alim_mm', 'zoa_amin_mm', 'td_verdict', 'scatter_ratio', 'dominant_Hz', 'pp_y_mm', 'max_F_N', 'MRR_mm3_min']];
  for (const t of useChatter.getState().trials) {
    const p = t.params, s = t.summary;
    rows.push([t.label, t.savedAt, p.materialId, p.D, p.N, p.mode, p.ae, p.ap, p.rpm, p.fz, p.modeX.fn, p.modeX.zeta, p.modeX.k, p.modeY.fn, p.modeY.zeta, p.modeY.k,
      s.aLimHere.toFixed(3), s.aMin.toFixed(3), s.verdict, s.ratio.toFixed(3), s.domFreq.toFixed(1), s.ppY.toFixed(5), s.maxF.toFixed(1), s.mrr.toFixed(0)]);
  }
  return toCSV(rows);
}

function Trials3() {
  const trials = useChatter((s) => s.trials);
  const { saveTrial, clearTrials, removeTrial, loadTrial } = useChatter.getState();
  const [label, setLabel] = useState('');
  const data = trials.map((t) => ({ name: t.label, mrr: t.summary.mrr / 1000, pp: t.summary.ppY * 1000 }));
  return (
    <div className="grid h-full grid-cols-1 gap-2 lg:grid-cols-[1.4fr_1fr]">
      <div className="flex min-h-0 flex-col">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="trial label (optional)" className="w-40 rounded bg-slate-800 px-2 py-0.5 text-xs ring-1 ring-slate-700" />
          <Btn kind="primary" onClick={() => { saveTrial(label); setLabel(''); }}>Save current as trial</Btn>
          <Btn onClick={() => download('machinaforce-m3-trials.csv', chatterTrialsCSV())} disabled={!trials.length}>Download CSV</Btn>
          <Btn kind="ghost" onClick={clearTrials} disabled={!trials.length}>Clear</Btn>
        </div>
        <div className="min-h-0 flex-1 overflow-auto scroll-thin">
          <table className="w-full text-[11px] tabular">
            <thead className="sticky top-0 bg-slate-900 text-slate-400"><tr>{['Trial', 'n', 'ap', 'ae', 'fn', 'ζ', 'k N/µm', 'ZOA a_lim', 'verdict', 'f dom', 'pp µm', 'MRR', ''].map((h) => <th key={h} className="px-1 py-0.5 text-left font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {trials.map((t) => (
                <tr key={t.id} className="border-t border-slate-800 text-slate-300">
                  <td className="px-1">{t.label}</td><td className="px-1">{t.params.rpm}</td><td className="px-1">{t.params.ap}</td><td className="px-1">{t.params.ae}</td>
                  <td className="px-1">{t.params.modeY.fn}</td><td className="px-1">{t.params.modeY.zeta}</td><td className="px-1">{(t.params.modeY.k / 1000).toFixed(1)}</td>
                  <td className="px-1">{t.summary.aLimHere.toFixed(2)}</td>
                  <td className={`px-1 ${t.summary.verdict === 'stable' ? 'text-emerald-300' : 'text-rose-300'}`}>{t.summary.verdict}</td>
                  <td className="px-1">{t.summary.domFreq.toFixed(0)}</td><td className="px-1">{(t.summary.ppY * 1000).toFixed(1)}</td><td className="px-1">{t.summary.mrr.toFixed(0)}</td>
                  <td className="whitespace-nowrap px-1"><button className="text-cyan-400 hover:underline" onClick={() => loadTrial(t.id)}>load</button> <button className="text-slate-500 hover:text-rose-300" onClick={() => removeTrial(t.id)}>✕</button></td>
                </tr>
              ))}
              {!trials.length && <tr><td colSpan={13} className="px-1 py-3 text-slate-500">No trials yet. Try a trough, a pocket, more damping, more stiffness…</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#1e293b" /><XAxis dataKey="name" tick={axisStyle} /><YAxis tick={axisStyle} /><Tooltip {...tip} />
          <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={18} />
          <Bar dataKey="mrr" name="MRR (cm³/min)" fill="#38bdf8" isAnimationActive={false} />
          <Bar dataKey="pp" name="vibration p-p (µm)" fill="#f43f5e" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Export3() {
  const r = useChatter((s) => s.result);
  const boundary = useChatter((s) => s.boundary);
  if (!r) return null;
  const lobes = () => {
    const rows: (string | number)[][] = [['rpm', 'zoa_alim_mm', 'time_domain_alim_mm']];
    for (const e of r.lobes.envelope) {
      const b = boundary?.find((q) => Math.abs(q.rpm - e.rpm) < (r.params.rpmMax - r.params.rpmMin) / 1200);
      rows.push([e.rpm.toFixed(0), Number.isFinite(e.a) ? e.a.toFixed(4) : '', b ? b.a.toFixed(4) : '']);
    }
    download('machinaforce-m3-lobes.csv', toCSV(rows));
  };
  const time = () => {
    const s = r.sim;
    const rows: (string | number)[][] = [['time_s', 'phi_deg', 'x_mm', 'y_mm', 'Fx_N', 'Fy_N']];
    for (let i = 0; i < s.x.length; i++) rows.push([s.t[i].toExponential(6), ((s.phi[i] * 180) / Math.PI).toFixed(2), s.x[i].toExponential(5), s.y[i].toExponential(5), s.Fx[i].toFixed(3), s.Fy[i].toFixed(3)]);
    download('machinaforce-m3-time.csv', '# MachinaForce 3D Module 3 time-domain simulation (feed frame: x = feed, y = normal; forces on tool)\n' + toCSV(rows));
  };
  return (
    <>
      <Btn kind="ghost" onClick={lobes}>⬇ lobes</Btn>
      <Btn kind="ghost" onClick={time}>⬇ time</Btn>
      <span className="hidden">{chatterLive.frame}</span>
    </>
  );
}
