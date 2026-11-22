import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../../state/store';
import { useTurning } from '../../state/turningStore';
import { turnStockAt, turningForces } from '../../physics/turning';
import { PlaybackBar, axisStyle, tip } from '../BottomPanel';
import { Btn } from '../controls';
import { download, toCSV } from '../../lib/csv';

type Tab = 'forces' | 'diameter' | 'deflection' | 'depth' | 'trials';
// same colours as the 3D arrows (by lathe axis): Fp ‖ X red, Fc ‖ Y green, Ff ‖ Z blue
const COL = { Fc: '#22c55e', Ff: '#3b82f6', Fp: '#ef4444' };

export function BottomPanel4() {
  const r = useTurning((s) => s.result);
  const cursor = useApp((s) => s.cursor);
  const [tab, setTab] = useState<Tab>('forces');
  if (!r) return <div className="p-3 text-xs text-slate-400">Computing…</div>;
  const n = r.stations.length;
  const st = r.stations[Math.min(Math.max(Math.floor(cursor.station), 0), n - 1)];
  const tabs: { id: Tab; label: string }[] = [
    { id: 'forces', label: 'Force components along the shaft' },
    { id: 'diameter', label: 'Diameter error profile' },
    { id: 'deflection', label: 'Shaft deflection (now)' },
    { id: 'depth', label: 'Forces vs depth of cut' },
    { id: 'trials', label: 'Experiment comparison' },
  ];
  return (
    <div className="flex h-full flex-col">
      <PlaybackBar n={n} passCount={r.passes.length} passIndex={st.pass} firstStationOf={(p) => r.passes[p].firstStation} x={st.z}
        label={`pass ${st.pass + 1}/${r.passes.length} · Z = ${st.z.toFixed(0)} mm`} />
      <div className="flex gap-1 overflow-x-auto border-b border-slate-800 px-2 pt-1">
        {tabs.map((t) => <button key={t.id} onClick={() => setTab(t.id)} className={`whitespace-nowrap rounded-t px-2.5 py-1 text-[11px] ${tab === t.id ? 'bg-slate-800 text-cyan-300' : 'text-slate-400 hover:text-slate-200'}`}>{t.label}</button>)}
        <div className="ml-auto flex gap-1 pb-1"><Export4 /></div>
      </div>
      <div className="min-h-0 flex-1 p-2">
        {tab === 'forces' && <ForcesChart />}
        {tab === 'diameter' && <DiameterChart />}
        {tab === 'deflection' && <DeflectionChart />}
        {tab === 'depth' && <DepthChart />}
        {tab === 'trials' && <Trials4 />}
      </div>
    </div>
  );
}

function ForcesChart() {
  const r = useTurning((s) => s.result)!;
  const cursor = useApp((s) => s.cursor);
  const st = r.stations[Math.min(Math.floor(cursor.station), r.stations.length - 1)];
  const pass = r.passes[st.pass];
  const data = r.stations.slice(pass.firstStation, pass.lastStation + 1).map((s) => ({ z: s.z, Fc: s.Fc, Ff: s.Ff, Fp: s.Fp }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 16, bottom: 14, left: 0 }}>
        <CartesianGrid stroke="#1e293b" />
        <XAxis dataKey="z" type="number" domain={[0, r.params.L]} tick={axisStyle} label={{ value: 'Z from chuck face (mm)', position: 'insideBottom', offset: -6, fontSize: 10, fill: '#64748b' }} />
        <YAxis tick={axisStyle} label={{ value: 'force on tool (N)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }} />
        <Tooltip {...tip} formatter={(v) => Number(v).toFixed(1) + ' N'} labelFormatter={(z) => `Z = ${Number(z).toFixed(0)} mm`} />
        <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={18} />
        <ReferenceLine x={st.z} stroke="#f59e0b" strokeDasharray="3 3" />
        <Line dataKey="Fc" name="Fc cutting (tangential)" stroke={COL.Fc} dot={false} isAnimationActive={false} />
        <Line dataKey="Ff" name="Ff feed (axial)" stroke={COL.Ff} dot={false} isAnimationActive={false} />
        <Line dataKey="Fp" name="Fp passive (radial)" stroke={COL.Fp} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function DiameterChart() {
  const r = useTurning((s) => s.result)!;
  const cursor = useApp((s) => s.cursor);
  const ci = Math.floor(cursor.station);
  const p = r.params;
  const data = useMemo(() => {
    const cur = turnStockAt(r, ci);
    const out = [];
    for (let i = 0; i < r.diaFinal.length; i += 2) out.push({ z: i * r.dz, final: (r.diaFinal[i] - p.dT) * 1000, now: (cur[i] - p.dT) * 1000 });
    return out;
  }, [r, ci, p.dT]);
  const tol = p.tolerance * 1000;
  const turned = data.filter((d) => d.final < (p.d0 - p.dT) * 1000 - 1e-6).map((d) => d.final);
  const hi = Math.max(tol, ...(turned.length ? turned : [0])) * 1.25 + 2;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 16, bottom: 14, left: 0 }}>
        <CartesianGrid stroke="#1e293b" />
        <XAxis dataKey="z" type="number" domain={[0, p.L]} tick={axisStyle} label={{ value: 'Z from chuck face (mm)', position: 'insideBottom', offset: -6, fontSize: 10, fill: '#64748b' }} />
        <YAxis domain={[-tol * 1.25 - 2, hi]} allowDataOverflow tick={axisStyle} tickFormatter={(v) => Number(v).toFixed(0)} label={{ value: 'diameter − nominal (µm)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }} />
        <Tooltip {...tip} formatter={(v) => Number(v).toFixed(1) + ' µm'} labelFormatter={(z) => `Z = ${Number(z).toFixed(0)} mm`} />
        <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={18} />
        <ReferenceArea y1={-tol} y2={tol} fill="#10b981" fillOpacity={0.12} />
        <ReferenceLine y={0} stroke="#10b981" strokeDasharray="4 3" />
        {p.workholding !== 'chuck' && <ReferenceLine x={p.L} stroke="#94a3b8" label={{ value: 'tail', fontSize: 9, fill: '#94a3b8', position: 'top' }} />}
        {p.steadyRest && <ReferenceLine x={p.steadyZ} stroke="#22d3ee" strokeDasharray="2 3" label={{ value: 'steady rest', fontSize: 9, fill: '#22d3ee', position: 'top' }} />}
        <Line dataKey="now" name="at playback position" stroke="#94a3b8" dot={false} isAnimationActive={false} />
        <Line dataKey="final" name="final (predicted)" stroke="#f43f5e" strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function DeflectionChart() {
  const r = useTurning((s) => s.result)!;
  const cursor = useApp((s) => s.cursor);
  const st = r.stations[Math.min(Math.floor(cursor.station), r.stations.length - 1)];
  const p = r.params;
  const data = Array.from(r.nodes, (z, i) => ({ z, w: st.unitShape[i] * st.Fp * 1000, wy: st.unitShape[i] * st.Fc * 1000 }));
  return (
    <div className="flex h-full flex-col">
      <div className="text-[11px] text-slate-400">Shaft centre-line deflection under the force at the current tool position (Z = {st.z.toFixed(0)} mm). X: from Fp, away from the tool; Y: from Fc (barely changes the diameter).</div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 16, bottom: 14, left: 0 }}>
            <CartesianGrid stroke="#1e293b" />
            <XAxis dataKey="z" type="number" domain={[0, p.L]} tick={axisStyle} label={{ value: 'Z from chuck face (mm)', position: 'insideBottom', offset: -6, fontSize: 10, fill: '#64748b' }} />
            <YAxis tick={axisStyle} label={{ value: 'deflection (µm)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }} />
            <Tooltip {...tip} formatter={(v) => Number(v).toFixed(2) + ' µm'} labelFormatter={(z) => `Z = ${Number(z).toFixed(0)} mm`} />
            <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={18} />
            <ReferenceLine x={st.z} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'tool', fontSize: 9, fill: '#f59e0b', position: 'top' }} />
            {p.steadyRest && <ReferenceLine x={p.steadyZ} stroke="#22d3ee" strokeDasharray="2 3" />}
            <ReferenceLine y={0} stroke="#475569" />
            <Line dataKey="w" name="X deflection (from Fp)" stroke={COL.Fp} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line dataKey="wy" name="Y deflection (from Fc)" stroke={COL.Fc} dot={false} strokeDasharray="4 2" isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function DepthChart() {
  const p = useTurning((s) => s.params);
  const data = useMemo(() => {
    const out = [];
    for (let i = 1; i <= 60; i++) {
      const ap = (i / 60) * 4;
      const F = turningForces(ap, p.f, p.kappa, p.noseR, p.coeffs);
      out.push({ ap, Fc: F.Fc, Ff: F.Ff, Fp: F.Fp, ke: (F.kappaE * 180) / Math.PI });
    }
    return out;
  }, [p.f, p.kappa, p.noseR, p.coeffs]);
  const apNow = (p.d0 - p.dT) / 2;
  const noseZone = p.noseR * (1 - Math.cos((Math.min(p.kappa, 179) * Math.PI) / 180));
  return (
    <div className="grid h-full grid-cols-1 gap-2 md:grid-cols-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 12, bottom: 14, left: 0 }}>
          <CartesianGrid stroke="#1e293b" />
          <XAxis dataKey="ap" type="number" domain={[0, 4]} tick={axisStyle} label={{ value: 'radial depth of cut ap (mm)', position: 'insideBottom', offset: -6, fontSize: 10, fill: '#64748b' }} />
          <YAxis tick={axisStyle} label={{ value: 'force (N)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }} />
          <Tooltip {...tip} formatter={(v) => Number(v).toFixed(1)} labelFormatter={(a) => `ap = ${Number(a).toFixed(2)} mm`} />
          <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={18} />
          <ReferenceArea x1={0} x2={noseZone} fill="#f59e0b" fillOpacity={0.08} label={{ value: 'cut on the nose only', fontSize: 9, fill: '#f59e0b', position: 'insideTop' }} />
          <ReferenceLine x={apNow} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: 'this cut', fontSize: 9, fill: '#f43f5e', position: 'top' }} />
          <Line dataKey="Fc" name="Fc" stroke={COL.Fc} dot={false} isAnimationActive={false} />
          <Line dataKey="Ff" name="Ff" stroke={COL.Ff} dot={false} isAnimationActive={false} />
          <Line dataKey="Fp" name="Fp" stroke={COL.Fp} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 12, bottom: 14, left: 0 }}>
          <CartesianGrid stroke="#1e293b" />
          <XAxis dataKey="ap" type="number" domain={[0, 4]} tick={axisStyle} label={{ value: 'ap (mm)', position: 'insideBottom', offset: -6, fontSize: 10, fill: '#64748b' }} />
          <YAxis domain={[0, 110]} tick={axisStyle} label={{ value: 'equivalent entering angle κe (°)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }} />
          <Tooltip {...tip} formatter={(v) => Number(v).toFixed(1) + '°'} labelFormatter={(a) => `ap = ${Number(a).toFixed(2)} mm`} />
          <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={18} />
          <ReferenceLine y={p.kappa} stroke="#94a3b8" strokeDasharray="4 3" label={{ value: `κr = ${p.kappa}°`, fontSize: 9, fill: '#94a3b8', position: 'insideTopRight' }} />
          <ReferenceLine x={apNow} stroke="#f43f5e" strokeDasharray="3 3" />
          <Line dataKey="ke" name="κe — sets the split of FN into Ff (sin κe) and Fp (cos κe)" stroke="#f59e0b" dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function turnTrialsCSV(): string {
  const rows: (string | number)[][] = [['label', 'saved_at', 'material', 'workholding', 'steady_rest', 'steady_z_mm', 'strategy', 'feed_dir', 'd0_mm', 'dT_mm', 'L_mm', 'vc_m_min', 'f_mm_rev', 'kappa_deg', 'nose_mm',
    'max_Fc_N', 'max_Ff_N', 'max_Fp_N', 'max_power_kW', 'max_shaft_defl_mm', 'dev_min_mm', 'dev_max_mm', 'cylindricity_mm', 'in_tol_fraction', 'Ra_um', 'cycle_time_s']];
  for (const t of useTurning.getState().trials) {
    const p = t.params, s = t.summary;
    rows.push([t.label, t.savedAt, p.materialId, p.workholding, String(p.steadyRest), p.steadyZ, p.strategy, p.feedDir, p.d0, p.dT, p.L, p.vc, p.f, p.kappa, p.noseR,
      s.maxFc.toFixed(1), s.maxFf.toFixed(1), s.maxFp.toFixed(1), s.maxPower.toFixed(3), s.maxShaftDefl.toFixed(5), s.devMin.toFixed(5), s.devMax.toFixed(5), s.cylindricity.toFixed(5), s.inTolFraction.toFixed(3), s.ra.toFixed(3), s.cycleTime.toFixed(1)]);
  }
  return toCSV(rows);
}

function Trials4() {
  const trials = useTurning((s) => s.trials);
  const { saveTrial, clearTrials, removeTrial, loadTrial } = useTurning.getState();
  const [label, setLabel] = useState('');
  const data = trials.map((t) => ({ name: t.label, dev: Math.max(Math.abs(t.summary.devMin), Math.abs(t.summary.devMax)) * 1000, Fp: t.summary.maxFp, ra: t.summary.ra * 10 }));
  return (
    <div className="grid h-full grid-cols-1 gap-2 lg:grid-cols-[1.4fr_1fr]">
      <div className="flex min-h-0 flex-col">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="trial label (optional)" className="w-40 rounded bg-slate-800 px-2 py-0.5 text-xs ring-1 ring-slate-700" />
          <Btn kind="primary" onClick={() => { saveTrial(label); setLabel(''); }}>Save current as trial</Btn>
          <Btn onClick={() => download('machinaforce-m4-trials.csv', turnTrialsCSV())} disabled={!trials.length}>Download CSV</Btn>
          <Btn kind="ghost" onClick={clearTrials} disabled={!trials.length}>Clear</Btn>
        </div>
        <div className="min-h-0 flex-1 overflow-auto scroll-thin">
          <table className="w-full text-[11px] tabular">
            <thead className="sticky top-0 bg-slate-900 text-slate-400"><tr>{['Trial', 'support', 'rest', 'strategy', 'f', 'κr', 'rε', 'Fc', 'Fp', 'max dev µm', 'Ra µm', 'time s', ''].map((h) => <th key={h} className="px-1 py-0.5 text-left font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {trials.map((t) => {
                const dev = Math.max(Math.abs(t.summary.devMin), Math.abs(t.summary.devMax));
                return (
                  <tr key={t.id} className="border-t border-slate-800 text-slate-300">
                    <td className="px-1">{t.label}</td><td className="px-1">{t.params.workholding}</td><td className="px-1">{t.params.steadyRest ? `@${t.params.steadyZ}` : '–'}</td><td className="px-1">{t.params.strategy}</td>
                    <td className="px-1">{t.params.f}</td><td className="px-1">{t.params.kappa}</td><td className="px-1">{t.params.noseR}</td>
                    <td className="px-1">{t.summary.maxFc.toFixed(0)}</td><td className="px-1">{t.summary.maxFp.toFixed(0)}</td>
                    <td className={`px-1 ${dev <= t.params.tolerance ? 'text-emerald-300' : 'text-rose-300'}`}>{(dev * 1000).toFixed(1)}</td>
                    <td className="px-1">{t.summary.ra.toFixed(2)}</td><td className="px-1">{t.summary.cycleTime.toFixed(0)}</td>
                    <td className="whitespace-nowrap px-1"><button className="text-cyan-400 hover:underline" onClick={() => loadTrial(t.id)}>load</button> <button className="text-slate-500 hover:text-rose-300" onClick={() => removeTrial(t.id)}>✕</button></td>
                  </tr>
                );
              })}
              {!trials.length && <tr><td colSpan={13} className="px-1 py-3 text-slate-500">No trials yet. Compare chuck only, tailstock, steady rest, nose radius, strategy…</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#1e293b" /><XAxis dataKey="name" tick={axisStyle} /><YAxis tick={axisStyle} /><Tooltip {...tip} />
          <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={18} />
          <Bar dataKey="dev" name="max |dev| (µm)" fill="#f43f5e" isAnimationActive={false} />
          <Bar dataKey="Fp" name="max Fp (N)" fill="#ef4444" fillOpacity={0.5} isAnimationActive={false} />
          <Bar dataKey="ra" name="Ra (×0.1 µm)" fill="#38bdf8" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Export4() {
  const r = useTurning((s) => s.result);
  if (!r) return null;
  const forces = () => {
    const rows: (string | number)[][] = [['station', 'pass', 'kind', 'z_mm', 'ap_mm', 'ap_eff_mm', 'kappa_e_deg', 'Fc_N', 'Ff_N', 'Fp_N', 'power_kW', 'shaft_defl_x_mm', 'shaft_defl_y_mm', 'tool_defl_mm', 'radial_error_mm', 'time_s']];
    r.stations.forEach((s, i) => rows.push([i, s.pass + 1, r.passes[s.pass].kind, s.z.toFixed(1), s.ap.toFixed(4), s.apEff.toFixed(4), ((s.kappaE * 180) / Math.PI).toFixed(1), s.Fc.toFixed(2), s.Ff.toFixed(2), s.Fp.toFixed(2), s.power.toFixed(4), s.shaftDefl.toFixed(6), s.shaftDeflY.toFixed(6), s.toolDefl.toFixed(6), s.e.toFixed(6), s.time.toFixed(2)]));
    download('machinaforce-m4-forces.csv', '# MachinaForce 3D Module 4 (lathe frame; forces on the tool). Estimates unless coefficients are calibrated.\n' + toCSV(rows));
  };
  const diameters = () => {
    const rows: (string | number)[][] = [['z_mm', 'diameter_mm', 'deviation_mm']];
    for (let i = 0; i < r.diaFinal.length; i++) rows.push([(i * r.dz).toFixed(1), r.diaFinal[i].toFixed(5), (r.diaFinal[i] - r.params.dT).toFixed(5)]);
    download('machinaforce-m4-diameter.csv', toCSV(rows));
  };
  return (
    <>
      <Btn kind="ghost" onClick={forces}>⬇ forces</Btn>
      <Btn kind="ghost" onClick={diameters}>⬇ diameter</Btn>
    </>
  );
}
