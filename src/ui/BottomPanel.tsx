import { useMemo, useState } from 'react';
import {
  CartesianGrid, Legend, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar,
} from 'recharts';
import { playback, useApp } from '../state/store';
import { instantState } from '../sim/instant';
import { feedToGlobal, forceSignal } from '../physics/millingForce';
import { stockAt, STRATEGY_INFO } from '../physics/process';
import { FORCE_COLORS } from '../scene/Forces';
import { Btn } from './controls';
import { download, toCSV } from '../lib/csv';

export const axisStyle = { fontSize: 10, fill: '#94a3b8' };
export const tip = { contentStyle: { background: '#0f172a', border: '1px solid #334155', fontSize: 11 }, labelStyle: { color: '#cbd5e1' } };

/** Module-agnostic playback bar. */
export function PlaybackBar({ n, passCount, passIndex, firstStationOf, x, label }: {
  n: number; passCount: number; passIndex: number; firstStationOf: (p: number) => number; x: number; label?: string;
}) {
  const cursor = useApp((s) => s.cursor);
  const playing = useApp((s) => s.playing);
  const speed = useApp((s) => s.speed);
  const { setPlaying, setSpeed, seek, setCursor } = useApp.getState();
  const jump = (d: number) => seek(firstStationOf(Math.min(Math.max(passIndex + d, 0), passCount - 1)));
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-1.5">
      <Btn kind="primary" onClick={() => { if (cursor.station >= n - 1) seek(0); setPlaying(!playing); }}>{playing ? '❚❚ Pause' : '▶ Play'}</Btn>
      <Btn onClick={() => jump(-1)} title="Previous pass">⏮ pass</Btn>
      <Btn onClick={() => jump(1)} title="Next pass">pass ⏭</Btn>
      <Btn onClick={() => { setPlaying(false); seek(0); }} title="Rewind to start">↺</Btn>
      <input
        type="range" min={0} max={Math.max(n - 1, 0)} step={0.01} value={Math.min(cursor.station, n - 1)}
        onChange={(e) => { setPlaying(false); seek(Number(e.target.value)); }}
        className="min-w-[140px] flex-1" aria-label="Toolpath position"
      />
      <span className="tabular w-36 text-[11px] text-slate-400">{label ?? `pass ${passIndex + 1}/${passCount} · X = ${x.toFixed(1)} mm`}</span>
      <label className="flex items-center gap-1 text-[11px] text-slate-400">
        speed
        <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="rounded bg-slate-800 px-1 py-0.5 text-xs ring-1 ring-slate-700">
          {[0.25, 0.5, 1, 2, 4, 8].map((v) => <option key={v} value={v}>{v}×</option>)}
        </select>
      </label>
      {label === undefined && <label className="flex items-center gap-1 text-[11px] text-slate-400" title="Cutter angle of tooth 0 (amber flute)">
        φ
        <input type="range" min={0} max={359} step={1} value={Math.round((cursor.phi * 180) / Math.PI)}
          onChange={(e) => { setPlaying(false); playback.phi = (Number(e.target.value) * Math.PI) / 180; setCursor(playback.station, playback.phi); }}
          className="w-24" aria-label="Cutter angle" />
      </label>}
      <span className="text-[10px] text-slate-500">{label === undefined ? 'Visual time is slowed; physics is quasi-static.' : 'Slow motion of the simulated vibration (time-domain model).'}</span>
    </div>
  );
}

export function Playback() {
  const result = useApp((s) => s.result);
  const cursor = useApp((s) => s.cursor);
  if (!result) return null;
  const inst = instantState(result, cursor.station, cursor.phi);
  return (
    <PlaybackBar n={result.stations.length} passCount={result.passes.length} passIndex={inst.pass.index}
      firstStationOf={(p) => result.passes[p].firstStation} x={inst.tool.x} />
  );
}

type Tab = 'angle' | 'path' | 'profile' | 'trials';

export function BottomPanel() {
  const [tab, setTab] = useState<Tab>('angle');
  const tabs: { id: Tab; label: string }[] = [
    { id: 'angle', label: 'Force vs cutter angle / time' },
    { id: 'path', label: 'Along toolpath' },
    { id: 'profile', label: 'Wall thickness profile' },
    { id: 'trials', label: 'Experiment comparison' },
  ];
  return (
    <div className="flex h-full flex-col">
      <Playback />
      <div className="flex gap-1 overflow-x-auto border-b border-slate-800 px-2 pt-1">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`whitespace-nowrap rounded-t px-2.5 py-1 text-[11px] ${tab === t.id ? 'bg-slate-800 text-cyan-300' : 'text-slate-400 hover:text-slate-200'}`}>{t.label}</button>
        ))}
        <div className="ml-auto"><ExportMenu /></div>
      </div>
      <div className="min-h-0 flex-1 p-2">
        {tab === 'angle' && <AngleChart />}
        {tab === 'path' && <PathChart />}
        {tab === 'profile' && <ProfileChart />}
        {tab === 'trials' && <TrialsView />}
      </div>
    </div>
  );
}

function AngleChart() {
  const result = useApp((s) => s.result);
  const cursor = useApp((s) => s.cursor);
  const forceOn = useApp((s) => s.view.forceOn);
  const idx = Math.floor(cursor.station);
  const data = useMemo(() => {
    if (!result) return [];
    const inst = instantState(result, idx, 0);
    const sig = forceSignal(inst.cp, result.params.rpm, 360);
    const sg = forceOn === 'tool' ? 1 : -1;
    return Array.from(sig.phi, (phi, i) => {
      const g = feedToGlobal({ Fx: sig.Fx[i], Fy: sig.Fy[i], Fz: sig.Fz[i] }, inst.pass.feedSign);
      return { deg: (phi * 180) / Math.PI, tms: sig.t[i] * 1000, Fx: sg * g.Fx, Fy: sg * g.Fy, Fz: sg * g.Fz, F: sig.F[i] };
    });
  }, [result, idx, forceOn]);
  if (!result) return null;
  const T = 60000 / result.params.rpm;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 16, bottom: 14, left: 0 }}>
        <CartesianGrid stroke="#1e293b" />
        <XAxis dataKey="deg" type="number" domain={[0, 360]} ticks={[0, 60, 120, 180, 240, 300, 360]} tick={axisStyle}
          label={{ value: `tooth-0 angle φ (°) — one revolution = ${T.toFixed(2)} ms`, position: 'insideBottom', offset: -6, fontSize: 10, fill: '#64748b' }} />
        <YAxis tick={axisStyle} label={{ value: `force on ${forceOn} (N)`, angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }} />
        <Tooltip {...tip} formatter={(v) => Number(v).toFixed(1) + ' N'} labelFormatter={(d) => `φ = ${Number(d).toFixed(0)}°, t = ${((Number(d) / 360) * T).toFixed(3)} ms`} />
        <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={18} />
        <ReferenceLine x={(cursor.phi * 180) / Math.PI} stroke="#f59e0b" strokeDasharray="3 3" />
        <ReferenceLine y={0} stroke="#475569" />
        <Line dataKey="Fx" stroke={FORCE_COLORS.Fx} dot={false} strokeWidth={1.5} isAnimationActive={false} />
        <Line dataKey="Fy" stroke={FORCE_COLORS.Fy} dot={false} strokeWidth={1.5} isAnimationActive={false} />
        <Line dataKey="Fz" stroke={FORCE_COLORS.Fz} dot={false} strokeWidth={1.5} isAnimationActive={false} />
        <Line dataKey="F" name="|F|" stroke={FORCE_COLORS.F} dot={false} strokeWidth={2} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function PathChart() {
  const result = useApp((s) => s.result);
  const cursor = useApp((s) => s.cursor);
  if (!result) return null;
  const inst = instantState(result, cursor.station, cursor.phi);
  const pass = inst.pass;
  const data = result.stations.slice(pass.firstStation, pass.lastStation + 1).map((s) => ({
    x: s.x, mean: s.meanResultant, peak: s.peakResultant, Fn: Math.abs(s.peakFY),
    sleMin: s.sleMin * 1000, sleMax: s.sleMax * 1000, aeEff: s.aeEff * 1000,
  }));
  return (
    <div className="grid h-full grid-cols-1 gap-2 md:grid-cols-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 12, bottom: 14, left: 0 }}>
          <CartesianGrid stroke="#1e293b" />
          <XAxis dataKey="x" type="number" domain={[0, result.params.wallLength]} tick={axisStyle} label={{ value: `X (mm) — pass ${pass.index + 1}`, position: 'insideBottom', offset: -6, fontSize: 10, fill: '#64748b' }} />
          <YAxis tick={axisStyle} label={{ value: 'force (N)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }} />
          <Tooltip {...tip} formatter={(v) => Number(v).toFixed(1)} />
          <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={18} />
          <ReferenceLine x={inst.tool.x} stroke="#f59e0b" strokeDasharray="3 3" />
          <Line dataKey="mean" name="mean |F|" stroke="#38bdf8" dot={false} isAnimationActive={false} />
          <Line dataKey="peak" name="peak |F|" stroke={FORCE_COLORS.F} dot={false} isAnimationActive={false} />
          <Line dataKey="Fn" name="peak |Fy| (normal to wall)" stroke={FORCE_COLORS.Fy} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 12, bottom: 14, left: 0 }}>
          <CartesianGrid stroke="#1e293b" />
          <XAxis dataKey="x" type="number" domain={[0, result.params.wallLength]} tick={axisStyle} label={{ value: 'X (mm)', position: 'insideBottom', offset: -6, fontSize: 10, fill: '#64748b' }} />
          <YAxis tick={axisStyle} label={{ value: 'µm', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }} />
          <Tooltip {...tip} formatter={(v) => Number(v).toFixed(0) + ' µm'} />
          <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={18} />
          <ReferenceLine x={inst.tool.x} stroke="#f59e0b" strokeDasharray="3 3" />
          <Line dataKey="sleMax" name="surface error max (+ = left)" stroke="#f43f5e" dot={false} isAnimationActive={false} />
          <Line dataKey="sleMin" name="surface error min" stroke="#fb7185" strokeDasharray="4 2" dot={false} isAnimationActive={false} />
          <Line dataKey="aeEff" name="effective ae" stroke="#a3e635" dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ProfileChart() {
  const result = useApp((s) => s.result);
  const cursor = useApp((s) => s.cursor);
  const [xPos, setX] = useState<'mid' | 'end'>('mid');
  const data = useMemo(() => {
    if (!result) return [];
    const cur = stockAt(result, Math.floor(cursor.station));
    const fin = result.stockFinal;
    const i = xPos === 'mid' ? Math.floor(fin.nxC / 2) : 0;
    return Array.from({ length: fin.nzC }, (_, k) => {
      const c = k * fin.nxC + i;
      return { z: (k + 0.5) * fin.dz, now: cur.back[c] - cur.front[c], final: fin.back[c] - fin.front[c] };
    });
  }, [result, Math.floor(cursor.station), xPos]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!result) return null;
  const p = result.params;
  const fin = data.map((d) => d.final);
  const dom: [number, number] = [
    Math.min(p.wallThickness - p.tolerance, ...fin) - 0.02,
    Math.max(p.wallThickness + p.tolerance, ...fin) + 0.02,
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        Section at
        <select value={xPos} onChange={(e) => setX(e.target.value as 'mid' | 'end')} className="rounded bg-slate-800 px-1 py-0.5 text-xs ring-1 ring-slate-700">
          <option value="mid">X = L/2 (mid-length)</option>
          <option value="end">X ≈ 0 (free edge)</option>
        </select>
        <span>Shaded band = nominal ± tolerance. Red = predicted final thickness after spring-back; grey = stock at the playback position (may run off-scale before finishing).</span>
      </div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} layout="vertical" margin={{ top: 5, right: 16, bottom: 14, left: 0 }}>
            <CartesianGrid stroke="#1e293b" />
            <XAxis type="number" dataKey="final" domain={dom} allowDataOverflow tickFormatter={(v) => Number(v).toFixed(2)} tick={axisStyle} label={{ value: 'thickness (mm)', position: 'insideBottom', offset: -6, fontSize: 10, fill: '#64748b' }} />
            <YAxis type="number" dataKey="z" domain={[0, p.wallHeight]} reversed tick={axisStyle} label={{ value: 'Z (mm)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }} />
            <Tooltip {...tip} formatter={(v) => Number(v).toFixed(3) + ' mm'} labelFormatter={(z) => `Z = ${Number(z).toFixed(2)} mm`} />
            <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={18} />
            <ReferenceArea x1={p.wallThickness - p.tolerance} x2={p.wallThickness + p.tolerance} fill="#10b981" fillOpacity={0.12} />
            <ReferenceLine x={p.wallThickness} stroke="#10b981" strokeDasharray="4 3" />
            <Line dataKey="now" name="at current playback position" stroke="#94a3b8" dot={false} isAnimationActive={false} />
            <Line dataKey="final" name="final (predicted)" stroke="#f43f5e" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TrialsView() {
  const trials = useApp((s) => s.trials);
  const { removeTrial, loadTrial, clearTrials, saveTrial } = useApp.getState();
  const [label, setLabel] = useState('');
  const data = trials.map((t) => ({
    name: t.label,
    dev: Math.max(Math.abs(t.summary.devMin), Math.abs(t.summary.devMax)) * 1000,
    force: t.summary.peakResultant,
    mrr: t.summary.averageMRR / 100,
  }));
  return (
    <div className="grid h-full grid-cols-1 gap-2 lg:grid-cols-[1.4fr_1fr]">
      <div className="flex min-h-0 flex-col">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="trial label (optional)" className="w-40 rounded bg-slate-800 px-2 py-0.5 text-xs ring-1 ring-slate-700" />
          <Btn kind="primary" onClick={() => { saveTrial(label); setLabel(''); }}>Save current as trial</Btn>
          <Btn onClick={() => download('machinaforce-trials.csv', trialsCSV())} disabled={!trials.length}>Download CSV</Btn>
          <Btn kind="ghost" onClick={clearTrials} disabled={!trials.length}>Clear</Btn>
        </div>
        <div className="min-h-0 flex-1 overflow-auto scroll-thin">
          <table className="w-full text-[11px] tabular">
            <thead className="sticky top-0 bg-slate-900 text-slate-400">
              <tr>{['Trial', 'Strategy', 'n', 'fz', 'ap', 'ae', 't', 'Lt', 'peak F (N)', 'max|dev| µm', 'in tol %', 'MRR avg', 'time s', ''].map((h) => <th key={h} className="px-1 py-0.5 text-left font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {trials.map((t) => {
                const dev = Math.max(Math.abs(t.summary.devMin), Math.abs(t.summary.devMax));
                return (
                  <tr key={t.id} className="border-t border-slate-800 text-slate-300">
                    <td className="px-1">{t.label}</td>
                    <td className="px-1">{STRATEGY_INFO[t.params.strategy].name.split(' ')[0]} / {t.params.mode}</td>
                    <td className="px-1">{t.params.rpm}</td><td className="px-1">{t.params.fz}</td><td className="px-1">{t.params.ap}</td>
                    <td className="px-1">{t.params.aeFinish}</td><td className="px-1">{t.params.wallThickness}</td><td className="px-1">{t.params.overhang}</td>
                    <td className="px-1">{t.summary.peakResultant.toFixed(0)}</td>
                    <td className={`px-1 ${dev <= t.params.tolerance ? 'text-emerald-300' : 'text-rose-300'}`}>{(dev * 1000).toFixed(0)}</td>
                    <td className="px-1">{(t.summary.inTolFraction * 100).toFixed(0)}</td>
                    <td className="px-1">{t.summary.averageMRR.toFixed(0)}</td>
                    <td className="px-1">{t.summary.cycleTime.toFixed(0)}</td>
                    <td className="whitespace-nowrap px-1">
                      <button className="text-cyan-400 hover:underline" onClick={() => loadTrial(t.id)}>load</button>{' '}
                      <button className="text-slate-500 hover:text-rose-300" onClick={() => removeTrial(t.id)}>✕</button>
                    </td>
                  </tr>
                );
              })}
              {!trials.length && <tr><td colSpan={14} className="px-1 py-3 text-slate-500">No trials yet. Change one parameter at a time and save each run to compare.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#1e293b" />
          <XAxis dataKey="name" tick={axisStyle} />
          <YAxis tick={axisStyle} />
          <Tooltip {...tip} />
          <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={18} />
          <Bar dataKey="dev" name="max |dev| (µm)" fill="#f43f5e" isAnimationActive={false} />
          <Bar dataKey="force" name="peak |F| (N)" fill="#f59e0b" isAnimationActive={false} />
          <Bar dataKey="mrr" name="avg MRR (×100 mm³/min)" fill="#38bdf8" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function trialsCSV(): string {
  const trials = useApp.getState().trials;
  const rows: (string | number)[][] = [[
    'label', 'saved_at', 'material', 'coeff_source', 'strategy', 'mode', 'rpm', 'N', 'fz_mm', 'ap_mm', 'ae_finish_mm', 'ae_rough_mm', 'D_mm', 'helix_deg', 'overhang_mm',
    'wall_t_mm', 'wall_H_mm', 'wall_L_mm', 'tolerance_mm', 'clamp_rigid', 'peak_F_N', 'mean_F_finish_N', 'max_wall_defl_mm', 'max_tool_defl_mm',
    'dev_min_mm', 'dev_max_mm', 'in_tol_fraction', 'feed_rate_mm_min', 'avg_MRR_mm3_min', 'cycle_time_s', 'f_tp_Hz', 'f1_min_Hz',
  ]];
  for (const t of trials) {
    const p = t.params, s = t.summary;
    rows.push([t.label, t.savedAt, p.materialId, p.coeffSource, p.strategy, p.mode, p.rpm, p.N, p.fz, p.ap, p.aeFinish, p.aeRough, p.D, p.helixDeg, p.overhang,
      p.wallThickness, p.wallHeight, p.wallLength, p.tolerance, String(p.clampRigid), s.peakResultant.toFixed(2), s.meanResultantFinish.toFixed(2), s.maxWallDefl.toFixed(4), s.maxToolDefl.toFixed(4),
      s.devMin.toFixed(4), s.devMax.toFixed(4), s.inTolFraction.toFixed(3), s.feedRate.toFixed(1), s.averageMRR.toFixed(1), s.cycleTime.toFixed(2), s.ftp.toFixed(1), s.minF1.toFixed(1)]);
  }
  return toCSV(rows);
}

function ExportMenu() {
  const result = useApp((s) => s.result);
  const cursor = useApp((s) => s.cursor);
  if (!result) return null;
  const stationsCSV = () => {
    const rows: (string | number)[][] = [['station', 'pass', 'kind', 'face', 'z_bot_mm', 'z_top_mm', 'x_mm', 'ae_nominal_mm', 'ae_effective_mm', 'b_mm',
      'mean_FX_N', 'mean_FY_N', 'mean_FZ_N', 'peak_resultant_N', 'peak_FY_N', 'wall_defl_peak_mm', 'tool_defl_peak_mm', 'surface_err_min_mm', 'surface_err_max_mm', 'time_s']];
    result.stations.forEach((s, i) => {
      const ps = result.passes[s.pass];
      rows.push([i, s.pass + 1, ps.kind, ps.face, ps.zBot, ps.zTop, s.x.toFixed(2), s.ae.toFixed(4), s.aeEff.toFixed(4), s.b.toFixed(3),
        s.meanF.Fx.toFixed(2), s.meanF.Fy.toFixed(2), s.meanF.Fz.toFixed(2), s.peakResultant.toFixed(2), s.peakFY.toFixed(2),
        s.wallDeflPeak.toFixed(5), s.toolDeflPeak.toFixed(5), s.sleMin.toFixed(5), s.sleMax.toFixed(5), s.time.toFixed(3)]);
    });
    download('machinaforce-toolpath.csv', '# MachinaForce 3D model output (forces on tool, machine frame). Estimates unless coefficients are calibrated.\n' + toCSV(rows));
  };
  const signalCSV = () => {
    const inst = instantState(result, Math.floor(cursor.station), 0);
    const sig = forceSignal(inst.cp, result.params.rpm, 360);
    const rows: (string | number)[][] = [['angle_deg', 'time_s', 'FX_N', 'FY_N', 'FZ_N', 'F_N']];
    sig.phi.forEach((phi, i) => {
      const g = feedToGlobal({ Fx: sig.Fx[i], Fy: sig.Fy[i], Fz: sig.Fz[i] }, inst.pass.feedSign);
      rows.push([((phi * 180) / Math.PI).toFixed(1), sig.t[i].toExponential(5), g.Fx.toFixed(3), g.Fy.toFixed(3), g.Fz.toFixed(3), sig.F[i].toFixed(3)]);
    });
    download('machinaforce-force-signal.csv', toCSV(rows));
  };
  const thicknessCSV = () => {
    const s = result.stockFinal;
    const rows: (string | number)[][] = [['x_mm', 'z_mm', 'thickness_mm', 'deviation_mm']];
    for (let k = 0; k < s.nzC; k++) for (let i = 0; i < s.nxC; i++) {
      const c = k * s.nxC + i, t = s.back[c] - s.front[c];
      rows.push([((i + 0.5) * s.dx).toFixed(2), ((k + 0.5) * s.dz).toFixed(2), t.toFixed(4), (t - result.params.wallThickness).toFixed(4)]);
    }
    download('machinaforce-final-thickness.csv', toCSV(rows));
  };
  return (
    <div className="flex gap-1 pb-1">
      <Btn kind="ghost" onClick={signalCSV} title="Force signal over one revolution at the current station">⬇ signal</Btn>
      <Btn kind="ghost" onClick={stationsCSV} title="All toolpath stations">⬇ toolpath</Btn>
      <Btn kind="ghost" onClick={thicknessCSV} title="Final thickness map">⬇ thickness</Btn>
    </div>
  );
}
