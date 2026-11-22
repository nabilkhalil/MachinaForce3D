import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../../state/store';
import { usePocket } from '../../state/pocketStore';
import { pocketInstant } from '../../sim/pocketInstant';
import { feedToGlobal, forceSignal } from '../../physics/millingForce';
import { POCKET_STRATEGY_INFO, pocketStockAt, wallDev } from '../../physics/pocketProcess';
import { toolSections } from '../../physics/toolBeam';
import { toolSpecOf } from '../../physics/pocketProcess';
import { FORCE_COLORS } from '../../scene/Forces';
import { PlaybackBar, axisStyle, tip } from '../BottomPanel';
import { Btn } from '../controls';
import { download, toCSV } from '../../lib/csv';

type Tab = 'angle' | 'bending' | 'profile' | 'trials';

export function BottomPanel2() {
  const result = usePocket((s) => s.result);
  const cursor = useApp((s) => s.cursor);
  const [tab, setTab] = useState<Tab>('bending');
  if (!result) return <div className="p-3 text-xs text-slate-400">Computing…</div>;
  const inst = pocketInstant(result, cursor.station, cursor.phi);
  const tabs: { id: Tab; label: string }[] = [
    { id: 'angle', label: 'Force vs cutter angle / time' },
    { id: 'bending', label: 'Tool bending: deflection & moment' },
    { id: 'profile', label: 'Wall deviation profile' },
    { id: 'trials', label: 'Experiment comparison' },
  ];
  return (
    <div className="flex h-full flex-col">
      <PlaybackBar n={result.stations.length} passCount={result.passes.length} passIndex={inst.pass.index}
        firstStationOf={(p) => result.passes[p].firstStation} x={inst.tool.x} />
      <div className="flex gap-1 overflow-x-auto border-b border-slate-800 px-2 pt-1">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`whitespace-nowrap rounded-t px-2.5 py-1 text-[11px] ${tab === t.id ? 'bg-slate-800 text-cyan-300' : 'text-slate-400 hover:text-slate-200'}`}>{t.label}</button>
        ))}
        <div className="ml-auto flex gap-1 pb-1"><ExportMenu2 /></div>
      </div>
      <div className="min-h-0 flex-1 p-2">
        {tab === 'angle' && <AngleChart2 />}
        {tab === 'bending' && <BendingChart />}
        {tab === 'profile' && <ProfileChart2 />}
        {tab === 'trials' && <Trials2 />}
      </div>
    </div>
  );
}

function AngleChart2() {
  const result = usePocket((s) => s.result)!;
  const cursor = useApp((s) => s.cursor);
  const forceOn = useApp((s) => s.view.forceOn);
  const idx = Math.floor(cursor.station);
  const data = useMemo(() => {
    const inst = pocketInstant(result, idx, 0);
    const sig = forceSignal(inst.cp, result.params.rpm, 360);
    const sg = forceOn === 'tool' ? 1 : -1;
    return Array.from(sig.phi, (phi, i) => {
      const g = feedToGlobal({ Fx: sig.Fx[i], Fy: sig.Fy[i], Fz: sig.Fz[i] }, inst.pass.feedSign);
      return { deg: (phi * 180) / Math.PI, Fx: sg * g.Fx, Fy: sg * g.Fy, Fz: sg * g.Fz, F: sig.F[i] };
    });
  }, [result, idx, forceOn]);
  const T = 60000 / result.params.rpm;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 16, bottom: 14, left: 0 }}>
        <CartesianGrid stroke="#1e293b" />
        <XAxis dataKey="deg" type="number" domain={[0, 360]} ticks={[0, 60, 120, 180, 240, 300, 360]} tick={axisStyle}
          label={{ value: `tooth-0 angle φ (°) — one revolution = ${T.toFixed(2)} ms`, position: 'insideBottom', offset: -6, fontSize: 10, fill: '#64748b' }} />
        <YAxis tick={axisStyle} label={{ value: `force on ${forceOn} (N)`, angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }} />
        <Tooltip {...tip} formatter={(v) => Number(v).toFixed(1) + ' N'} labelFormatter={(d) => `φ = ${Number(d).toFixed(0)}°`} />
        <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={18} />
        <ReferenceLine x={(cursor.phi * 180) / Math.PI} stroke="#f59e0b" strokeDasharray="3 3" />
        <ReferenceLine y={0} stroke="#475569" />
        <Line dataKey="Fx" stroke={FORCE_COLORS.Fx} dot={false} isAnimationActive={false} />
        <Line dataKey="Fy" stroke={FORCE_COLORS.Fy} dot={false} isAnimationActive={false} />
        <Line dataKey="Fz" stroke={FORCE_COLORS.Fz} dot={false} isAnimationActive={false} />
        <Line dataKey="F" name="|F|" stroke={FORCE_COLORS.F} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function BendingChart() {
  const result = usePocket((s) => s.result)!;
  const cursor = useApp((s) => s.cursor);
  const inst = pocketInstant(result, cursor.station, cursor.phi);
  const st = inst.station;
  const Fnow = Math.hypot(inst.F.Fx, inst.F.Fy);
  const Fpk = st.peakFxy;
  const g = result.grid;
  const pass = inst.pass;
  const data = useMemo(() => {
    const out = [];
    for (let i = 0; i < g.s.length; i += 4) {
      out.push({ s: g.s[i], now: pass.unitDelta[i] * Fnow * 1000, peak: pass.unitDelta[i] * Fpk * 1000, M: (pass.unitMoment[i] * Fpk) / 1000, sig: pass.unitStress[i] * Fpk });
    }
    return out;
  }, [g, pass, Fnow, Fpk]);
  const secs = toolSections(toolSpecOf(result.params));
  const L = result.params.overhang;
  return (
    <div className="grid h-full grid-cols-1 gap-2 md:grid-cols-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 12, bottom: 14, left: 0 }}>
          <CartesianGrid stroke="#1e293b" />
          <XAxis dataKey="s" type="number" domain={[0, L]} tick={axisStyle} label={{ value: 'distance from holder face s (mm) → tip', position: 'insideBottom', offset: -6, fontSize: 10, fill: '#64748b' }} />
          <YAxis tick={axisStyle} label={{ value: 'deflection (µm)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }} />
          <Tooltip {...tip} formatter={(v) => Number(v).toFixed(1) + ' µm'} labelFormatter={(s) => `s = ${Number(s).toFixed(1)} mm`} />
          <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={18} />
          {secs.map((q) => <ReferenceArea key={q.name} x1={q.s0} x2={q.s1} fill={q.name === 'flutes' ? '#f59e0b' : q.name === 'neck' ? '#64748b' : '#1e293b'} fillOpacity={0.12} label={{ value: q.name, fontSize: 9, fill: '#94a3b8', position: 'insideTop' }} />)}
          <ReferenceArea x1={L - (pass.zTop - pass.zBot)} x2={L} fill="#f43f5e" fillOpacity={0.12} />
          <Line dataKey="now" name={`now (|Fxy| = ${Fnow.toFixed(0)} N)`} stroke="#22d3ee" dot={false} isAnimationActive={false} />
          <Line dataKey="peak" name={`peak (|Fxy| = ${Fpk.toFixed(0)} N)`} stroke="#f43f5e" dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 12, bottom: 14, left: 0 }}>
          <CartesianGrid stroke="#1e293b" />
          <XAxis dataKey="s" type="number" domain={[0, L]} tick={axisStyle} label={{ value: 's (mm); red band = engaged flute length', position: 'insideBottom', offset: -6, fontSize: 10, fill: '#64748b' }} />
          <YAxis yAxisId="m" tick={axisStyle} label={{ value: 'M (N·m)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }} />
          <YAxis yAxisId="s" orientation="right" tick={axisStyle} label={{ value: 'σ (MPa)', angle: 90, position: 'insideRight', fontSize: 10, fill: '#64748b' }} />
          <Tooltip {...tip} formatter={(v, n) => (String(n).startsWith('bending M') ? Number(v).toFixed(2) + ' N·m' : Number(v).toFixed(0) + ' MPa')} />
          <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={18} />
          <ReferenceArea yAxisId="m" x1={L - (pass.zTop - pass.zBot)} x2={L} fill="#f43f5e" fillOpacity={0.12} />
          <Line yAxisId="m" dataKey="M" name="bending M at peak force" stroke="#a78bfa" dot={false} isAnimationActive={false} />
          <Line yAxisId="s" dataKey="sig" name="bending stress σ = M·c/I" stroke="#fbbf24" dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ProfileChart2() {
  const result = usePocket((s) => s.result)!;
  const cursor = useApp((s) => s.cursor);
  const ci = Math.floor(cursor.station);
  const data = useMemo(() => {
    const cur = pocketStockAt(result, ci);
    const fin = result.stockFinal;
    const i = Math.floor(fin.nxC / 2);
    return Array.from({ length: fin.nzC }, (_, k) => ({ z: (k + 0.5) * fin.dz, now: wallDev(cur, k * fin.nxC + i) * 1000, final: wallDev(fin, k * fin.nxC + i) * 1000 }));
  }, [result, ci]);
  const p = result.params;
  const tol = p.tolerance * 1000;
  const lo = Math.min(-tol, ...data.map((d) => d.final)) - 5, hi = Math.max(tol, ...data.map((d) => d.final)) + 5;
  return (
    <div className="flex h-full flex-col">
      <div className="text-[11px] text-slate-400">Wall deviation along the depth at X = L/2. + = proud (material left). Shaded band = ± tolerance. Grey = state at the playback position (shows the full allowance before a level is finished).</div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} layout="vertical" margin={{ top: 5, right: 16, bottom: 14, left: 0 }}>
            <CartesianGrid stroke="#1e293b" />
            <XAxis type="number" dataKey="final" domain={[lo, hi]} allowDataOverflow tickFormatter={(v) => Number(v).toFixed(0)} tick={axisStyle} label={{ value: 'deviation (µm)', position: 'insideBottom', offset: -6, fontSize: 10, fill: '#64748b' }} />
            <YAxis type="number" dataKey="z" domain={[0, p.pocketDepth]} reversed tick={axisStyle} label={{ value: 'Z (mm)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }} />
            <Tooltip {...tip} formatter={(v) => Number(v).toFixed(1) + ' µm'} labelFormatter={(z) => `Z = ${Number(z).toFixed(2)} mm`} />
            <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={18} />
            <ReferenceArea x1={-tol} x2={tol} fill="#10b981" fillOpacity={0.12} />
            <ReferenceLine x={0} stroke="#10b981" strokeDasharray="4 3" />
            <Line dataKey="now" name="at playback position" stroke="#94a3b8" dot={false} isAnimationActive={false} />
            <Line dataKey="final" name="final (predicted)" stroke="#f43f5e" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function pocketTrialsCSV(): string {
  const rows: (string | number)[][] = [['label', 'saved_at', 'material', 'coeff_source', 'strategy', 'mode', 'rpm', 'N', 'fz_mm', 'ap_mm', 'ae_mm', 'D_mm', 'helix_deg', 'overhang_mm', 'flute_mm', 'neck', 'neck_d_mm', 'holder_rigid', 'kT_N_per_mm', 'kR_Nmm_per_rad',
    'pocket_depth_mm', 'tolerance_mm', 'peak_F_N', 'tip_defl_mm', 'stress_MPa', 'dev_min_mm', 'dev_max_mm', 'form_error_mm', 'in_tol_fraction', 'avg_MRR_mm3_min', 'cycle_time_s']];
  for (const t of usePocket.getState().trials) {
    const p = t.params, s = t.summary;
    rows.push([t.label, t.savedAt, p.materialId, p.coeffSource, p.strategy, p.mode, p.rpm, p.N, p.fz, p.ap, p.aeFinish, p.D, p.helixDeg, p.overhang, p.fluteLength, String(p.neck), p.neckDiameter, String(p.holderRigid), p.holderKT, p.holderKR,
      p.pocketDepth, p.tolerance, s.peakResultant.toFixed(1), s.maxTipDefl.toFixed(4), s.maxStress.toFixed(0), s.devMin.toFixed(4), s.devMax.toFixed(4), s.formError.toFixed(4), s.inTolFraction.toFixed(3), s.averageMRR.toFixed(0), s.cycleTime.toFixed(1)]);
  }
  return toCSV(rows);
}

function Trials2() {
  const trials = usePocket((s) => s.trials);
  const { saveTrial, clearTrials, removeTrial, loadTrial } = usePocket.getState();
  const [label, setLabel] = useState('');
  const data = trials.map((t) => ({ name: t.label, dev: Math.max(Math.abs(t.summary.devMin), Math.abs(t.summary.devMax)) * 1000, tip: t.summary.maxTipDefl * 1000, mrr: t.summary.averageMRR / 100 }));
  return (
    <div className="grid h-full grid-cols-1 gap-2 lg:grid-cols-[1.4fr_1fr]">
      <div className="flex min-h-0 flex-col">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="trial label (optional)" className="w-40 rounded bg-slate-800 px-2 py-0.5 text-xs ring-1 ring-slate-700" />
          <Btn kind="primary" onClick={() => { saveTrial(label); setLabel(''); }}>Save current as trial</Btn>
          <Btn onClick={() => download('machinaforce-m2-trials.csv', pocketTrialsCSV())} disabled={!trials.length}>Download CSV</Btn>
          <Btn kind="ghost" onClick={clearTrials} disabled={!trials.length}>Clear</Btn>
        </div>
        <div className="min-h-0 flex-1 overflow-auto scroll-thin">
          <table className="w-full text-[11px] tabular">
            <thead className="sticky top-0 bg-slate-900 text-slate-400"><tr>{['Trial', 'Strategy', 'mode', 'L', 'ap', 'ae', 'holder', 'tip µm', 'max|dev| µm', 'form µm', 'σ MPa', 'MRR', ''].map((h) => <th key={h} className="px-1 py-0.5 text-left font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {trials.map((t) => {
                const dev = Math.max(Math.abs(t.summary.devMin), Math.abs(t.summary.devMax));
                return (
                  <tr key={t.id} className="border-t border-slate-800 text-slate-300">
                    <td className="px-1">{t.label}</td><td className="px-1">{POCKET_STRATEGY_INFO[t.params.strategy].name.split(' ').slice(0, 2).join(' ')}</td><td className="px-1">{t.params.mode}</td>
                    <td className="px-1">{t.params.overhang}</td><td className="px-1">{t.params.strategy === 'full-depth' ? t.params.pocketDepth : t.params.ap}</td><td className="px-1">{t.params.aeFinish}</td>
                    <td className="px-1">{t.params.holderRigid ? 'rigid' : `${(t.params.holderKT / 1000).toFixed(0)} N/µm`}</td>
                    <td className="px-1">{(t.summary.maxTipDefl * 1000).toFixed(0)}</td>
                    <td className={`px-1 ${dev <= t.params.tolerance ? 'text-emerald-300' : 'text-rose-300'}`}>{(dev * 1000).toFixed(0)}</td>
                    <td className="px-1">{(t.summary.formError * 1000).toFixed(0)}</td><td className="px-1">{t.summary.maxStress.toFixed(0)}</td><td className="px-1">{t.summary.averageMRR.toFixed(0)}</td>
                    <td className="whitespace-nowrap px-1"><button className="text-cyan-400 hover:underline" onClick={() => loadTrial(t.id)}>load</button> <button className="text-slate-500 hover:text-rose-300" onClick={() => removeTrial(t.id)}>✕</button></td>
                  </tr>
                );
              })}
              {!trials.length && <tr><td colSpan={13} className="px-1 py-3 text-slate-500">No trials yet. Change one parameter at a time and save each run.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#1e293b" /><XAxis dataKey="name" tick={axisStyle} /><YAxis tick={axisStyle} /><Tooltip {...tip} />
          <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={18} />
          <Bar dataKey="dev" name="max |dev| (µm)" fill="#f43f5e" isAnimationActive={false} />
          <Bar dataKey="tip" name="tip deflection (µm)" fill="#22d3ee" isAnimationActive={false} />
          <Bar dataKey="mrr" name="avg MRR (×100 mm³/min)" fill="#38bdf8" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ExportMenu2() {
  const result = usePocket((s) => s.result);
  const cursor = useApp((s) => s.cursor);
  if (!result) return null;
  const toolpath = () => {
    const rows: (string | number)[][] = [['station', 'pass', 'kind', 'z_bot_mm', 'z_top_mm', 'offset_mm', 'x_mm', 'ae_mm', 'ae_eff_mm', 'b_mm', 'mean_FX_N', 'mean_FY_N', 'mean_FZ_N', 'peak_F_N', 'peak_Fxy_N', 'tip_defl_peak_mm', 'stress_peak_MPa', 'dev_min_mm', 'dev_max_mm', 'time_s']];
    result.stations.forEach((s, i) => {
      const ps = result.passes[s.pass];
      rows.push([i, s.pass + 1, ps.kind, ps.zBot, ps.zTop, ps.target.toFixed(4), s.x.toFixed(2), s.ae.toFixed(4), s.aeEff.toFixed(4), s.b.toFixed(2), s.meanF.Fx.toFixed(2), s.meanF.Fy.toFixed(2), s.meanF.Fz.toFixed(2), s.peakResultant.toFixed(2), s.peakFxy.toFixed(2), s.tipDeflPeak.toFixed(5), s.stressPeak.toFixed(1), s.sleMin.toFixed(5), s.sleMax.toFixed(5), s.time.toFixed(3)]);
    });
    download('machinaforce-m2-toolpath.csv', '# MachinaForce 3D Module 2 model output (forces on tool, machine frame). Estimates unless coefficients are calibrated.\n' + toCSV(rows));
  };
  const wall = () => {
    const s = result.stockFinal;
    const rows: (string | number)[][] = [['x_mm', 'z_mm', 'deviation_mm']];
    for (let k = 0; k < s.nzC; k++) for (let i = 0; i < s.nxC; i++) rows.push([((i + 0.5) * s.dx).toFixed(2), ((k + 0.5) * s.dz).toFixed(2), wallDev(s, k * s.nxC + i).toFixed(5)]);
    download('machinaforce-m2-wall-deviation.csv', toCSV(rows));
  };
  const bending = () => {
    const inst = pocketInstant(result, Math.floor(cursor.station), cursor.phi);
    const F = inst.station.peakFxy;
    const rows: (string | number)[][] = [['s_from_holder_mm', 'deflection_at_peak_mm', 'moment_at_peak_Nmm', 'stress_at_peak_MPa']];
    for (let i = 0; i < result.grid.s.length; i++) rows.push([result.grid.s[i].toFixed(3), (inst.pass.unitDelta[i] * F).toFixed(6), (inst.pass.unitMoment[i] * F).toFixed(2), (inst.pass.unitStress[i] * F).toFixed(2)]);
    download('machinaforce-m2-tool-bending.csv', toCSV(rows));
  };
  return (
    <>
      <Btn kind="ghost" onClick={bending}>⬇ bending</Btn>
      <Btn kind="ghost" onClick={toolpath}>⬇ toolpath</Btn>
      <Btn kind="ghost" onClick={wall}>⬇ wall</Btn>
    </>
  );
}
