import { useMemo } from 'react';
import { useApp } from '../../state/store';
import { usePocket } from '../../state/pocketStore';
import { pocketInstant } from '../../sim/pocketInstant';
import { feedToGlobal, forceSignal, signalStats } from '../../physics/millingForce';
import { POCKET_STRATEGY_INFO } from '../../physics/pocketProcess';
import { CARBIDE_TRS } from '../../physics/toolBeam';
import { Metric, Tag } from '../controls';
import { pocketLive } from '../../scene/m2/PocketScene';
import { cssColor, diverging } from '../../lib/colormap';

const f = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—');

export function ResultsPanel2() {
  const result = usePocket((s) => s.result);
  const computing = usePocket((s) => s.computing);
  const ms = usePocket((s) => s.computeMs);
  const cursor = useApp((s) => s.cursor);
  const view = useApp((s) => s.view);
  const inst = useMemo(() => (result ? pocketInstant(result, cursor.station, cursor.phi) : null), [result, cursor]);
  const stats = useMemo(() => {
    if (!result || !inst) return null;
    const st = signalStats(forceSignal(inst.cp, result.params.rpm, 360));
    return { mean: feedToGlobal(st.mean, inst.pass.feedSign), peak: st.peakResultant, meanR: st.meanResultant };
  }, [result, inst]);
  if (!result || !inst || !stats) return <div className="p-3 text-xs text-slate-400">Computing Module 2…</div>;
  const s = result.summary, p = result.params;
  const maxAbs = Math.max(Math.abs(s.devMin), Math.abs(s.devMax));
  const ok = maxAbs <= p.tolerance;
  const sign = view.forceOn === 'tool' ? 1 : -1;
  const F = inst.F;
  const stops = Array.from({ length: 11 }, (_, i) => cssColor(diverging(i / 5 - 1))).join(',');
  return (
    <div className="space-y-3 p-3 text-slate-200">
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span>Pass {inst.pass.index + 1}/{result.passes.length} · {inst.pass.kind} · Z {f(inst.pass.zBot)}–{f(inst.pass.zTop)} mm{inst.pass.target !== 0 ? ` · offset ${f(inst.pass.target * 1000, 0)} µm` : ''}</span>
        <span className="text-[10px] text-slate-500">{computing ? 'computing…' : `solved in ${ms.toFixed(0)} ms`}</span>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Cutting force · this station</h3>
          <Tag kind={p.coeffSource === 'calibrated' ? 'validated' : 'estimate'}>{p.coeffSource === 'calibrated' ? 'calibrated K' : 'estimate'}</Tag>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          <Metric label="Fx" value={f(sign * F.Fx)} unit="N" />
          <Metric label="Fy" value={f(sign * F.Fy)} unit="N" />
          <Metric label="Fz" value={f(sign * F.Fz)} unit="N" />
          <Metric label="|F|" value={f(Math.hypot(F.Fx, F.Fy, F.Fz))} unit="N" />
        </div>
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          <Metric label="Mean |F|" value={f(stats.meanR)} unit="N" />
          <Metric label="Peak |F|" value={f(stats.peak)} unit="N" />
          <Metric label="Engaged length b" value={f(inst.station.b, 1)} unit="mm" />
        </div>
        <div className="mt-1 text-[10px] text-slate-500">ae nominal {f(inst.station.ae * 1000, 0)} µm → effective {f(inst.station.aeEff * 1000, 0)} µm after tool deflection</div>
      </div>

      <div>
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Tool bending (static)</h3>
        <div className="grid grid-cols-2 gap-1.5">
          <Metric label="Tip deflection, now" value={f(pocketLive.tipDefl * 1000, 0)} unit="µm" sub={`holder face ${f(pocketLive.holderDefl * 1000, 0)} µm`} />
          <Metric label="Tip deflection, peak" value={f(s.maxTipDefl * 1000, 0)} unit="µm" />
          <Metric label="Tip stiffness" value={f(s.toolTipStiffness, 0)} unit="N/mm" sub={`L/D = ${f(p.overhang / p.D, 1)}`} />
          <Metric label="Holder share" value={f(s.holderShare * 100, 0)} unit="%" sub="of tip compliance" />
          <Metric label="Peak bending stress" value={f(s.maxStress, 0)} unit="MPa" tone={s.stressRatio > 0.3 ? 'bad' : s.stressRatio > 0.15 ? 'warn' : 'ok'} sub={`${f(s.stressRatio * 100, 0)} % of TRS ${CARBIDE_TRS}`} />
          <Metric label="Tool f₁ / f_tp" value={`${f(s.toolF1, 0)} / ${f(s.ftp, 0)}`} unit="Hz" tone={s.dynamicRatio > 0.3 ? 'warn' : 'ok'} sub="information only" />
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Finished wall</h3>
          <Tag kind={ok ? 'ok' : 'fail'}>{ok ? 'within tolerance' : 'out of tolerance'}</Tag>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <Metric label="Min dev." value={f(s.devMin * 1000, 0)} unit="µm" tone={Math.abs(s.devMin) > p.tolerance ? 'bad' : 'ok'} />
          <Metric label="Max dev." value={f(s.devMax * 1000, 0)} unit="µm" tone={Math.abs(s.devMax) > p.tolerance ? 'bad' : 'ok'} />
          <Metric label="Area in tol." value={f(s.inTolFraction * 100, 0)} unit="%" tone={s.inTolFraction >= 0.999 ? 'ok' : 'warn'} />
          <Metric label="Form error" value={f(s.formError * 1000, 0)} unit="µm" sub="max−min along Z" />
          <Metric label="Top − bottom" value={f(s.taper * 1000, 0)} unit="µm" sub="taper indicator" />
          <Metric label="Mean dev." value={f(s.devMean * 1000, 0)} unit="µm" />
        </div>
        <div className="mt-1 text-[10px] text-slate-500">+ = wall proud (material left) · {POCKET_STRATEGY_INFO[p.strategy].name}{s.compensation.length ? ` · offsets ${s.compensation.map((c) => (c * 1000).toFixed(0)).join('/')} µm` : ''}</div>
      </div>

      <div>
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Productivity</h3>
        <div className="grid grid-cols-2 gap-1.5">
          <Metric label="Feed rate vf" value={f(s.feedRate, 0)} unit="mm/min" />
          <Metric label="Cutting speed vc" value={f(s.vc, 0)} unit="m/min" />
          <Metric label="Average MRR" value={f(s.averageMRR, 0)} unit="mm³/min" />
          <Metric label="Cutting time" value={f(s.cycleTime, 1)} unit="s" sub={`${result.passes.length} passes`} />
        </div>
      </div>

      <div>
        <div className="text-[10px] text-slate-400">Wall colour: deviation from nominal (wall offset exaggerated ×{view.exaggeration}; tool bending exaggerated ×{view.exaggeration})</div>
        <div className="mt-1 h-2.5 rounded" style={{ background: `linear-gradient(90deg,${stops})` }} />
        <div className="flex justify-between text-[10px] text-slate-500 tabular"><span>−{f(pocketLive.devRange * 1000, 0)} µm overcut</span><span>0</span><span>+{f(pocketLive.devRange * 1000, 0)} µm proud</span></div>
      </div>

      {s.warnings.length > 0 && (
        <div className="space-y-1">{s.warnings.map((w, i) => <div key={i} className="rounded bg-orange-950/40 px-2 py-1 text-[11px] leading-snug text-orange-200 ring-1 ring-orange-900">⚠ {w}</div>)}</div>
      )}
    </div>
  );
}
