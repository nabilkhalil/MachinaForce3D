import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../../state/store';
import { useFixture } from '../../state/fixtureStore';
import { clampSweep, slotCutParams } from '../../physics/fixture';
import { cutterForce, feedToGlobal, TWO_PI } from '../../physics/millingForce';
import { PlaybackBar, axisStyle, tip } from '../BottomPanel';
import { Btn } from '../controls';
import { download, toCSV } from '../../lib/csv';
import { FORCE_COLORS } from '../../scene/Forces';

type Tab = 'error' | 'contacts' | 'force' | 'clamp' | 'trials';

export function BottomPanel5() {
  const r = useFixture((s) => s.result);
  const cursor = useApp((s) => s.cursor);
  const [tab, setTab] = useState<Tab>('error');
  if (!r) return <div className="p-3 text-xs text-slate-400">Computing…</div>;
  const n = r.stations.length;
  const st = r.stations[Math.min(Math.max(Math.floor(cursor.station), 0), n - 1)];
  const tabs: { id: Tab; label: string }[] = [
    { id: 'error', label: 'Slot error along X' },
    { id: 'contacts', label: 'Contact forces (now)' },
    { id: 'force', label: 'Cutting force on the part' },
    { id: 'clamp', label: 'Clamping force study' },
    { id: 'trials', label: 'Experiment comparison' },
  ];
  return (
    <div className="flex h-full flex-col">
      <PlaybackBar n={n} passCount={1} passIndex={0} firstStationOf={() => 0} x={st.x}
        label={`X = ${st.x.toFixed(0)} mm`} note="one slot pass" />
      <div className="flex gap-1 overflow-x-auto border-b border-slate-800 px-2 pt-1">
        {tabs.map((t) => <button key={t.id} onClick={() => setTab(t.id)} className={`whitespace-nowrap rounded-t px-2.5 py-1 text-[11px] ${tab === t.id ? 'bg-slate-800 text-cyan-300' : 'text-slate-400 hover:text-slate-200'}`}>{t.label}</button>)}
        <div className="ml-auto flex gap-1 pb-1"><Export5 /></div>
      </div>
      <div className="min-h-0 flex-1 p-2">
        {tab === 'error' && <ErrorChart />}
        {tab === 'contacts' && <ContactChart />}
        {tab === 'force' && <ForceChart />}
        {tab === 'clamp' && <ClampStudy />}
        {tab === 'trials' && <Trials5 />}
      </div>
    </div>
  );
}

function ErrorChart() {
  const r = useFixture((s) => s.result)!;
  const cursor = useApp((s) => s.cursor);
  const st = r.stations[Math.min(Math.floor(cursor.station), r.stations.length - 1)];
  const p = r.params;
  const data = [...r.stations].sort((a, b) => a.x - b.x).map((s) => ({ x: s.x, ey: s.ey * 1000, ez: s.ez * 1000 }));
  const tol = p.tolerance * 1000;
  const raw = Math.max(tol * 1.3, ...data.map((d) => Math.max(Math.abs(d.ey), Math.abs(d.ez)) * 1.1));
  const stepE = raw <= 20 ? 5 : raw <= 50 ? 10 : raw <= 200 ? 50 : 250;
  const hi = Math.ceil(raw / stepE) * stepE;
  const ticks = Array.from({ length: Math.round((2 * hi) / stepE) + 1 }, (_, i) => -hi + i * stepE);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 16, bottom: 14, left: 0 }}>
        <CartesianGrid stroke="#1e293b" />
        <XAxis dataKey="x" type="number" domain={[0, p.Lx]} tick={axisStyle} label={{ value: 'X along the slot (mm)', position: 'insideBottom', offset: -6, fontSize: 10, fill: '#64748b' }} />
        <YAxis domain={[-hi, hi]} ticks={ticks} allowDataOverflow tick={axisStyle} tickFormatter={(v) => Number(v).toFixed(0)} label={{ value: 'feature error (µm)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }} />
        <Tooltip {...tip} formatter={(v) => Number(v).toFixed(2) + ' µm'} labelFormatter={(x) => `X = ${Number(x).toFixed(0)} mm`} />
        <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={18} />
        <ReferenceArea y1={-tol} y2={tol} fill="#10b981" fillOpacity={0.12} />
        <ReferenceLine y={0} stroke="#10b981" strokeDasharray="4 3" />
        <ReferenceLine x={st.x} stroke="#f59e0b" strokeDasharray="3 3" />
        <Line dataKey="ey" name="slot position error eY (+ = toward +Y)" stroke={FORCE_COLORS.Fy} strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line dataKey="ez" name="slot depth error eZ (+ = floor too high / shallow)" stroke={FORCE_COLORS.Fz} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ContactChart() {
  const r = useFixture((s) => s.result)!;
  const cursor = useApp((s) => s.cursor);
  const st = r.stations[Math.min(Math.floor(cursor.station), r.stations.length - 1)];
  const data = r.els.map((e, i) => ({ id: e.id, clamped: r.N0[i], cutting: st.contacts[i].N, cap: r.params.mu * st.contacts[i].N, T: st.contacts[i].T }));
  return (
    <div className="grid h-full grid-cols-1 gap-2 md:grid-cols-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#1e293b" /><XAxis dataKey="id" tick={axisStyle} /><YAxis tick={axisStyle} label={{ value: 'normal force (N)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }} /><Tooltip {...tip} formatter={(v) => Number(v).toFixed(0) + ' N'} />
          <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={18} />
          <Bar dataKey="clamped" name="after clamping" fill="#64748b" isAnimationActive={false} />
          <Bar dataKey="cutting" name="during the cut (worst angle)" fill="#22d3ee" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#1e293b" /><XAxis dataKey="id" tick={axisStyle} /><YAxis tick={axisStyle} label={{ value: 'tangential force (N)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }} /><Tooltip {...tip} formatter={(v) => Number(v).toFixed(0) + ' N'} />
          <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={18} />
          <Bar dataKey="T" name="friction force needed T" fill="#f59e0b" isAnimationActive={false} />
          <Bar dataKey="cap" name="friction available μN" fill="#10b981" fillOpacity={0.6} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ForceChart() {
  const p = useFixture((s) => s.params);
  const data = useMemo(() => {
    const cp = slotCutParams(p);
    const fs: 1 | -1 = p.feedDir === '+X' ? 1 : -1;
    const out = [];
    for (let i = 0; i <= 120; i++) {
      const phi = (i / 120) * TWO_PI;
      const F = feedToGlobal(cutterForce(phi, cp).F, fs);
      out.push({ deg: (phi * 180) / Math.PI, Fx: -F.Fx, Fy: -F.Fy, Fz: -F.Fz });
    }
    return out;
  }, [p]);
  return (
    <div className="flex h-full flex-col">
      <div className="text-[11px] text-slate-400">Force ON THE WORKPIECE (= −force on the tool) over one cutter revolution, machine frame. Positive Y pushes the part toward the side clamp, negative Y into the side locators; positive X away from the end locator.</div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 16, bottom: 14, left: 0 }}>
            <CartesianGrid stroke="#1e293b" />
            <XAxis dataKey="deg" type="number" domain={[0, 360]} ticks={[0, 90, 180, 270, 360]} tick={axisStyle} label={{ value: 'cutter rotation φ (°)', position: 'insideBottom', offset: -6, fontSize: 10, fill: '#64748b' }} />
            <YAxis tick={axisStyle} label={{ value: 'force on part (N)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }} />
            <Tooltip {...tip} formatter={(v) => Number(v).toFixed(0) + ' N'} labelFormatter={(d) => `φ = ${Number(d).toFixed(0)}°`} />
            <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={18} />
            <ReferenceLine y={0} stroke="#475569" />
            <Line dataKey="Fx" name="FX on part" stroke={FORCE_COLORS.Fx} dot={false} isAnimationActive={false} />
            <Line dataKey="Fy" name="FY on part" stroke={FORCE_COLORS.Fy} dot={false} isAnimationActive={false} />
            <Line dataKey="Fz" name="FZ on part" stroke={FORCE_COLORS.Fz} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ClampStudy() {
  const p = useFixture((s) => s.params);
  const [data, setData] = useState<ReturnType<typeof clampSweep> | null>(null);
  const [busy, setBusy] = useState(false);
  const [forKey, setForKey] = useState('');
  const key = JSON.stringify(p);
  const run = () => {
    setBusy(true);
    setTimeout(() => {
      const scales = [0.1, 0.2, 0.35, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
      setData(clampSweep(p, scales)); setForKey(key); setBusy(false);
    }, 20);
  };
  const rows = data?.map((d) => ({ total: Math.round(d.total), slip: Math.min(d.slipSF, 6), ey: d.ey * 1000, holds: d.holds }));
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
        <Btn kind="primary" onClick={run} disabled={busy}>{busy ? 'running…' : 'Run study'}</Btn>
        <span>All clamp forces × 0.1 … 3 (coarse path). Friction reserve grows ≈ linearly; the slot error falls only slowly (contact stiffness ∝ N^1/3).</span>
        {data && forKey !== key && <span className="text-amber-300">parameters changed — run again</span>}
      </div>
      <div className="min-h-0 flex-1">
        {rows ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 5, right: 16, bottom: 14, left: 0 }}>
              <CartesianGrid stroke="#1e293b" />
              <XAxis dataKey="total" type="number" domain={['dataMin', 'dataMax']} tick={axisStyle} label={{ value: 'total clamp force (N)', position: 'insideBottom', offset: -6, fontSize: 10, fill: '#64748b' }} />
              <YAxis yAxisId="sf" domain={[0, 6]} tick={axisStyle} label={{ value: 'friction reserve μN/T', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }} />
              <YAxis yAxisId="e" orientation="right" tick={axisStyle} label={{ value: '|eY| max (µm)', angle: 90, position: 'insideRight', fontSize: 10, fill: '#64748b' }} />
              <Tooltip {...tip} formatter={(v, n) => (n === '|eY| (µm)' ? Number(v).toFixed(1) + ' µm' : Number(v).toFixed(2))} labelFormatter={(x) => `Σ clamp = ${x} N`} />
              <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={18} />
              <ReferenceLine yAxisId="sf" y={1} stroke="#ef4444" strokeDasharray="4 3" label={{ value: 'slip', fontSize: 9, fill: '#ef4444', position: 'insideTopLeft' }} />
              <ReferenceLine yAxisId="sf" y={2} stroke="#10b981" strokeDasharray="4 3" label={{ value: 'SF 2', fontSize: 9, fill: '#10b981', position: 'insideTopLeft' }} />
              <ReferenceLine yAxisId="sf" x={Math.round(useFixture.getState().result?.summary.totalClamp ?? 0)} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'now', fontSize: 9, fill: '#f59e0b', position: 'top' }} />
              <Line yAxisId="sf" dataKey="slip" name="friction reserve (capped at 6)" stroke="#10b981" strokeWidth={2} isAnimationActive={false} />
              <Line yAxisId="e" dataKey="ey" name="|eY| (µm)" stroke={FORCE_COLORS.Fy} strokeDasharray="4 2" isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : <p className="p-3 text-[11px] text-slate-500">Press “Run study” to sweep the clamp forces for the current setup.</p>}
      </div>
    </div>
  );
}

export function fixTrialsCSV(): string {
  const rows: (string | number)[][] = [['label', 'saved_at', 'material', 'layout', 'feed_dir', 'top_clamp_N', 'side_clamp_N', 'end_clamp_N', 'mu', 'k_locator_N_um', 'D_mm', 'ap_mm', 'fz_mm', 'rpm',
    'max_abs_eY_mm', 'max_abs_eZ_mm', 'max_tilt_rad', 'clamp_safety', 'min_friction_reserve', 'min_contact_N', 'slip', 'lift_off', 'f1_Hz', 'ftp_Hz', 'cycle_time_s']];
  for (const t of useFixture.getState().trials) {
    const p = t.params, s = t.summary;
    const sf = s.requiredClampScale && s.requiredClampScale > 0 ? 1 / s.requiredClampScale : NaN;
    rows.push([t.label, t.savedAt, p.materialId, p.layout, p.feedDir, p.topClamp, p.sideClamp, p.endClamp, p.mu, p.kLocator / 1000, p.D, p.ap, p.fz, p.rpm,
      s.maxAbsEy.toFixed(5), s.maxAbsEz.toFixed(5), s.maxTilt.toExponential(3), Number.isFinite(sf) ? sf.toFixed(2) : 'n/a', s.minSlipSF?.toFixed?.(2) ?? 'n/a', s.minNormal?.toFixed?.(0) ?? 'n/a',
      String(s.anySlip), String(s.anyLift), s.freqs[0]?.toFixed(0) ?? 'n/a', s.ftp.toFixed(0), s.cycleTime.toFixed(1)]);
  }
  return toCSV(rows);
}

function Trials5() {
  const trials = useFixture((s) => s.trials);
  const { saveTrial, clearTrials, removeTrial, loadTrial } = useFixture.getState();
  const [label, setLabel] = useState('');
  const sfOf = (x: number | null) => (x && x > 0 ? 1 / x : 0);
  const data = trials.map((t) => ({ name: t.label, ey: t.summary.maxAbsEy * 1000, ez: t.summary.maxAbsEz * 1000, sf: sfOf(t.summary.requiredClampScale) * 10 }));
  return (
    <div className="grid h-full grid-cols-1 gap-2 lg:grid-cols-[1.4fr_1fr]">
      <div className="flex min-h-0 flex-col">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="trial label (optional)" className="w-40 rounded bg-slate-800 px-2 py-0.5 text-xs ring-1 ring-slate-700" />
          <Btn kind="primary" onClick={() => { saveTrial(label); setLabel(''); }}>Save current as trial</Btn>
          <Btn onClick={() => download('machinaforce-m5-trials.csv', fixTrialsCSV())} disabled={!trials.length}>Download CSV</Btn>
          <Btn kind="ghost" onClick={clearTrials} disabled={!trials.length}>Clear</Btn>
        </div>
        <div className="min-h-0 flex-1 overflow-auto scroll-thin">
          <table className="w-full text-[11px] tabular">
            <thead className="sticky top-0 bg-slate-900 text-slate-400"><tr>{['Trial', 'layout', 'feed', 'clamps N', 'μ', 'ap', 'eY µm', 'eZ µm', 'SF', 'state', ''].map((h) => <th key={h} className="px-1 py-0.5 text-left font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {trials.map((t) => {
                const s = t.summary, ok = s.maxAbsEy <= t.params.tolerance && s.maxAbsEz <= t.params.tolerance;
                const sf = sfOf(s.requiredClampScale);
                return (
                  <tr key={t.id} className="border-t border-slate-800 text-slate-300">
                    <td className="px-1">{t.label}</td><td className="px-1">{t.params.layout}</td><td className="px-1">{t.params.feedDir}</td>
                    <td className="px-1">{t.params.topClamp}/{t.params.sideClamp}{t.params.endClamp ? `/${t.params.endClamp}` : ''}</td><td className="px-1">{t.params.mu}</td><td className="px-1">{t.params.ap}</td>
                    <td className={`px-1 ${ok ? 'text-emerald-300' : 'text-rose-300'}`}>{(s.maxAbsEy * 1000).toFixed(1)}</td><td className="px-1">{(s.maxAbsEz * 1000).toFixed(1)}</td>
                    <td className={`px-1 ${sf >= 2 ? 'text-emerald-300' : 'text-amber-300'}`}>{sf ? sf.toFixed(2) : '—'}</td>
                    <td className="px-1">{s.dislodged ? 'moved' : s.anyLift ? 'lift' : s.anySlip ? 'slip' : 'held'}</td>
                    <td className="whitespace-nowrap px-1"><button className="text-cyan-400 hover:underline" onClick={() => loadTrial(t.id)}>load</button> <button className="text-slate-500 hover:text-rose-300" onClick={() => removeTrial(t.id)}>✕</button></td>
                  </tr>
                );
              })}
              {!trials.length && <tr><td colSpan={11} className="px-1 py-3 text-slate-500">No trials yet. Compare layouts, feed directions, clamp forces and friction…</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#1e293b" /><XAxis dataKey="name" tick={axisStyle} /><YAxis tick={axisStyle} /><Tooltip {...tip} />
          <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={18} />
          <Bar dataKey="ey" name="|eY| max (µm)" fill={FORCE_COLORS.Fy} isAnimationActive={false} />
          <Bar dataKey="ez" name="|eZ| max (µm)" fill={FORCE_COLORS.Fz} isAnimationActive={false} />
          <Bar dataKey="sf" name="clamp SF (×0.1)" fill="#f59e0b" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Export5() {
  const r = useFixture((s) => s.result);
  if (!r) return null;
  const stations = () => {
    const rows: (string | number)[][] = [['x_mm', 'Fx_tool_mean_N', 'Fy_tool_mean_N', 'Fz_tool_mean_N', 'eY_mm', 'eZ_mm', 'eX_mm', 'tilt_x_rad', 'tilt_y_rad', 'tilt_z_rad', 'min_friction_reserve', 'min_contact_N', 'min_contact_id', 'slip', 'lift_off']];
    [...r.stations].sort((a, b) => a.x - b.x).forEach((s) => rows.push([s.x.toFixed(1), s.meanF.Fx.toFixed(1), s.meanF.Fy.toFixed(1), s.meanF.Fz.toFixed(1), s.ey.toFixed(6), s.ez.toFixed(6), s.ex.toFixed(6),
      s.tilt[0].toExponential(3), s.tilt[1].toExponential(3), s.tilt[2].toExponential(3), Number.isFinite(s.minSlipSF) ? s.minSlipSF.toFixed(3) : 'inf', s.minNormal.toFixed(1), s.minNormalId, String(s.slipping), String(s.lifted)]));
    download('machinaforce-m5-slot.csv', '# MachinaForce 3D Module 5 (machine frame; feature errors in the datum frame). Estimates: illustrative contact stiffness, friction and cutting coefficients.\n' + toCSV(rows));
  };
  const contacts = () => {
    const rows: (string | number)[][] = [['id', 'kind', 'label', 'x_mm', 'y_mm', 'z_mm', 'nx', 'ny', 'nz', 'clamped_N']];
    r.els.forEach((e, i) => rows.push([e.id, e.kind, e.label, ...e.p, ...e.n, r.N0[i].toFixed(1)]));
    download('machinaforce-m5-fixture.csv', toCSV(rows));
  };
  return (
    <>
      <Btn kind="ghost" onClick={stations}>⬇ slot</Btn>
      <Btn kind="ghost" onClick={contacts}>⬇ fixture</Btn>
    </>
  );
}
