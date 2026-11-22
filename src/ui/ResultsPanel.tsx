import { useMemo } from 'react';
import { useApp } from '../state/store';
import { instantState } from '../sim/instant';
import { forceSignal, signalStats, feedToGlobal } from '../physics/millingForce';
import { STRATEGY_INFO } from '../physics/process';
import { Metric, Tag } from './controls';
import { wallDisplay } from '../scene/WallMesh';
import { cssColor, diverging, sequential } from '../lib/colormap';

const f = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—');

export function ResultsPanel() {
  const result = useApp((s) => s.result);
  const cursor = useApp((s) => s.cursor);
  const view = useApp((s) => s.view);
  const computing = useApp((s) => s.computing);
  const ms = useApp((s) => s.computeMs);

  const inst = useMemo(() => (result ? instantState(result, cursor.station, cursor.phi) : null), [result, cursor]);
  const stats = useMemo(() => {
    if (!result || !inst) return null;
    const st = signalStats(forceSignal(inst.cp, result.params.rpm, 360));
    return { mean: feedToGlobal(st.mean, inst.pass.feedSign), peak: st.peakResultant, meanR: st.meanResultant };
  }, [result, inst]);

  if (!result || !inst || !stats) return <div className="p-3 text-xs text-slate-400">Computing first simulation…</div>;
  const s = result.summary;
  const p = result.params;
  const maxAbsDev = Math.max(Math.abs(s.devMin), Math.abs(s.devMax));
  const ok = maxAbsDev <= p.tolerance;
  const F = inst.F;
  const sign = view.forceOn === 'tool' ? 1 : -1;
  const passNo = inst.pass.index + 1;

  return (
    <div className="space-y-3 p-3 text-slate-200">
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-slate-400">
          Pass {passNo}/{result.passes.length} · {inst.pass.kind} · {inst.pass.face === 'front' ? 'front (−Y)' : 'back (+Y)'} face · Z {f(inst.pass.zBot)}–{f(inst.pass.zTop)} mm
        </div>
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
          <Metric label="Mean Fy" value={f(sign * stats.mean.Fy)} unit="N" sub={`on ${view.forceOn}`} />
        </div>
        <div className="mt-1 text-[10px] text-slate-500">
          ae nominal {f(inst.station.ae, 3)} mm → effective {f(inst.station.aeEff, 3)} mm after deflection · b = {f(inst.station.b, 2)} mm · cutter angle φ = {f((cursor.phi * 180) / Math.PI, 0)}°
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Deflection (quasi-static)</h3>
        <div className="grid grid-cols-2 gap-1.5">
          <Metric label="Wall, instantaneous max" value={f(wallDisplay.maxDisp * 1000, 0)} unit="µm" sub="elastic, recovers" />
          <Metric label="Wall, peak in cycle" value={f(s.maxWallDefl * 1000, 0)} unit="µm" />
          <Metric label="Tool, peak in cycle" value={f(s.maxToolDefl * 1000, 0)} unit="µm" sub={`k = ${f(s.toolStiffness, 0)} N/mm`} />
          <Metric label="Surface error here" value={`${f(inst.station.sleMin * 1000, 0)}…${f(inst.station.sleMax * 1000, 0)}`} unit="µm" sub="+ = material left" />
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Final wall thickness</h3>
          <Tag kind={ok ? 'ok' : 'fail'}>{ok ? 'within tolerance' : 'out of tolerance'}</Tag>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <Metric label="Min dev." value={f(s.devMin * 1000, 0)} unit="µm" tone={Math.abs(s.devMin) > p.tolerance ? 'bad' : 'ok'} />
          <Metric label="Max dev." value={f(s.devMax * 1000, 0)} unit="µm" tone={Math.abs(s.devMax) > p.tolerance ? 'bad' : 'ok'} />
          <Metric label="Area in tol." value={f(s.inTolFraction * 100, 0)} unit="%" tone={s.inTolFraction >= 0.999 ? 'ok' : s.inTolFraction > 0.8 ? 'warn' : 'bad'} />
        </div>
        <div className="mt-1 text-[10px] text-slate-500">Nominal {p.wallThickness.toFixed(2)} ± {p.tolerance.toFixed(2)} mm · stock {s.initialThickness.toFixed(2)} mm · {STRATEGY_INFO[p.strategy].name}</div>
      </div>

      <div>
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Productivity</h3>
        <div className="grid grid-cols-2 gap-1.5">
          <Metric label="Feed rate vf = n·N·fz" value={f(s.feedRate, 0)} unit="mm/min" />
          <Metric label="Cutting speed vc" value={f(s.vc, 0)} unit="m/min" />
          <Metric label="MRR finishing ae·ap·vf" value={f(s.nominalMRR, 0)} unit="mm³/min" />
          <Metric label="Average MRR (cycle)" value={f(s.averageMRR, 0)} unit="mm³/min" />
          <Metric label="Cutting time" value={f(s.cycleTime, 1)} unit="s" sub={`${result.passes.length} passes`} />
          <Metric label="Removed volume" value={f(s.removedVolume / 1000, 2)} unit="cm³" sub={`balance err ${s.volumeBalanceError.toExponential(1)} mm³`} />
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Dynamics check (information only)</h3>
        <div className="grid grid-cols-3 gap-1.5">
          <Metric label="Tooth-passing f" value={f(s.ftp, 0)} unit="Hz" />
          <Metric label="Wall f₁ (min)" value={f(s.minF1, 0)} unit="Hz" />
          <Metric label="f_tp / f₁" value={f(s.dynamicRatio, 2)} tone={s.dynamicRatio > 0.3 ? 'warn' : 'ok'} />
        </div>
        <p className="mt-1 text-[10px] text-slate-500">Static model is reliable only when f_tp ≪ f₁. This check does not predict chatter.</p>
      </div>

      <ColorBar />

      {s.warnings.length > 0 && (
        <div className="space-y-1">
          {s.warnings.map((w, i) => (
            <div key={i} className="rounded bg-orange-950/40 px-2 py-1 text-[11px] leading-snug text-orange-200 ring-1 ring-orange-900">⚠ {w}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function ColorBar() {
  const view = useApp((s) => s.view);
  useApp((s) => s.cursor); // refresh with cursor
  const stops = Array.from({ length: 11 }, (_, i) => i / 10);
  if (view.colorMode === 'displacement') {
    const grad = stops.map((t) => cssColor(sequential(t))).join(',');
    return (
      <div>
        <div className="text-[10px] text-slate-400">Colour: instantaneous wall displacement |w|, scaled to this station’s peak (shape exaggerated ×{view.exaggeration})</div>
        <div className="mt-1 h-2.5 rounded" style={{ background: `linear-gradient(90deg,${grad})` }} />
        <div className="flex justify-between text-[10px] text-slate-500 tabular"><span>0</span><span>{(wallDisplay.scale * 1000).toFixed(0)} µm</span></div>
      </div>
    );
  }
  const grad = stops.map((t) => cssColor(diverging(t * 2 - 1))).join(',');
  const r = wallDisplay.devRange * 1000;
  return (
    <div>
      <div className="text-[10px] text-slate-400">Colour: thickness deviation from nominal (current stock)</div>
      <div className="mt-1 h-2.5 rounded" style={{ background: `linear-gradient(90deg,${grad})` }} />
      <div className="flex justify-between text-[10px] text-slate-500 tabular"><span>−{r.toFixed(0)} µm (thin)</span><span>0</span><span>+{r.toFixed(0)} µm (thick)</span></div>
    </div>
  );
}
