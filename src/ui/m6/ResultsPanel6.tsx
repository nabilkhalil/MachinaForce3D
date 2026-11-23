import { useMemo } from 'react';
import { useApp } from '../../state/store';
import { useToolWear } from '../../state/toolWearStore';
import { Metric, Tag } from '../controls';
import { currentVB } from '../../scene/m6/ToolWearScene';
import { CONDITION_LABEL, roughnessRisk, toolCondition, vbAt, wearState } from '../../physics/toolWear';

const f = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—');

export function ResultsPanel6() {
  const r = useToolWear((s) => s.result);
  const ms = useToolWear((s) => s.computeMs);
  const cursor = useApp((s) => s.cursor);
  const forceOn = useApp((s) => s.view.forceOn);
  const VB = r ? currentVB(r, cursor.station) : 0;
  const VBk = Math.round(VB * 1000) / 1000;
  const now = useMemo(() => (r ? wearState(r.params, VBk) : null), [r, VBk]);
  if (!r || !now) return <div className="p-3 text-xs text-slate-400">Computing Module 6…</div>;
  const p = r.params, fr = r.fresh, pl = r.plan;
  const cond = toolCondition(VB, p.VBcrit);
  const risk = roughnessRisk(VB, p.VBcrit);
  const sign = forceOn === 'tool' ? 1 : -1;
  const inc = (a: number, b: number) => `${b > 0 ? (a / b - 1 >= 0 ? '+' : '') + ((a / b - 1) * 100).toFixed(0) : '—'} % vs fresh`;
  const t = p.growthMode ? r.timeline[Math.min(Math.max(Math.floor(cursor.station), 0), r.timeline.length - 1)].t : NaN;
  const condTone = cond === 'fresh' || cond === 'normal' ? 'ok' : cond === 'approaching' ? 'warn' : 'fail';
  return (
    <div className="space-y-3 p-3 text-slate-200">
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span>{p.growthMode ? `Growth mode · t = ${f(t, 1)} min` : 'Manual VB'} · n = {f(pl.rpm, 0)} rpm · f_tp = {f(r.ftp, 0)} Hz</span>
        <span className="text-[10px] text-slate-500">solved in {ms.toFixed(0)} ms</span>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Tool condition</h3>
          <Tag kind={condTone}>{CONDITION_LABEL[cond]}</Tag>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <Metric label="Flank wear VB" value={f(VB, 3)} unit="mm" tone={condTone === 'fail' ? 'bad' : condTone === 'warn' ? 'warn' : 'ok'} sub={`criterion ${p.VBcrit.toFixed(2)} mm`} />
          <Metric label="Used life" value={f((VB / p.VBcrit) * 100, 0)} unit="%" sub="VB / criterion" />
          <Metric label="Roughness risk" value={risk} sub="qualitative only" tone={risk === 'high' ? 'bad' : risk === 'moderate' ? 'warn' : 'ok'} />
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Forces on the {forceOn} (feed frame, mean per rev)</h3>
          <Tag kind={p.coeffSource === 'calibrated' && p.wearSource === 'calibrated' ? 'validated' : 'estimate'}>{p.wearSource === 'calibrated' ? 'calibrated wear' : 'estimate'}</Tag>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <Metric label="Fx" value={f(sign * now.mean.Fx, 0)} unit="N" />
          <Metric label="Fy" value={f(sign * now.mean.Fy, 0)} unit="N" />
          <Metric label="Fz" value={f(sign * now.mean.Fz, 0)} unit="N" />
          <Metric label="Mean resultant" value={f(now.meanRes, 0)} unit="N" sub={inc(now.meanRes, fr.meanRes)} />
          <Metric label="Peak resultant" value={f(now.peakRes, 0)} unit="N" sub={inc(now.peakRes, fr.peakRes)} />
          <Metric label="Peak at criterion" value={f(r.atCrit.peakRes, 0)} unit="N" sub={`VB = ${p.VBcrit.toFixed(2)} mm`} />
        </div>
        <div className="mt-1 text-[10px] text-slate-500">Edge coefficients now: Kte {f(now.K.Kte, 0)}, Kre {f(now.K.Kre, 0)}, Kae {f(now.K.Kae, 1)} N/mm (fresh {f(p.coeffs.Kte, 0)}, {f(p.coeffs.Kre, 0)}, {f(p.coeffs.Kae, 1)}).</div>
      </div>

      <div>
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Power and energy</h3>
        <div className="grid grid-cols-3 gap-1.5">
          <Metric label="Cutting power" value={f(now.power, 3)} unit="kW" sub={inc(now.power, fr.power)} tone={now.power > p.spindlePower ? 'bad' : undefined} />
          <Metric label="Spindle torque" value={f(now.torque, 2)} unit="N·m" />
          <Metric label="Specific energy" value={f(now.energy, 2)} unit="J/mm³" sub={`fresh ${f(fr.energy, 2)}`} />
        </div>
        <div className="mt-1 text-[10px] text-slate-500">P = T·ω with T = R·ΣFt; u = P / MRR. MRR = {f(pl.mrr / 1000, 2)} cm³/min.</div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Replacement & productivity</h3>
          <Tag kind="assumption">illustrative rate</Tag>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <Metric label="Wear rate" value={f(pl.rate * 1000, 2)} unit="µm/min" />
          <Metric label="Time to criterion" value={f(pl.tLife, 1)} unit="min" sub={`from VB0 = ${p.VB0.toFixed(2)}`} />
          <Metric label="Time per part" value={f(pl.tPart, 2)} unit="min" sub={`vf ${f(pl.vf, 0)} mm/min`} />
          <Metric label="Parts per tool" value={f(pl.partsPerTool, 0)} tone={pl.partsPerTool === 0 ? 'bad' : undefined} />
          <Metric label="Tools for batch" value={f(pl.tools, 0)} sub={`${p.batch} parts`} />
          <Metric label="Total time" value={f(pl.totalTime, 1)} unit="min" sub={`incl. ${f(pl.changes, 0)} changes`} />
        </div>
        <div className="mt-1 text-[10px] text-slate-500">VB after one part: {f(vbAt(p, pl.tPart), 3)} mm. Not a validated tool-life prediction — calibrate A, p, q from your wear measurements.</div>
      </div>

      {r.warnings.length > 0 && <div className="space-y-1">{r.warnings.map((w, i) => <div key={i} className="rounded bg-orange-950/40 px-2 py-1 text-[11px] leading-snug text-orange-200 ring-1 ring-orange-900">⚠ {w}</div>)}</div>}
      {p.growthMode && VB >= p.VBcrit && <div className="rounded bg-rose-950/50 px-2 py-1 text-[11px] text-rose-200 ring-1 ring-rose-800">⚠ At this time VB has reached the criterion: the tool should have been replaced.</div>}
    </div>
  );
}
