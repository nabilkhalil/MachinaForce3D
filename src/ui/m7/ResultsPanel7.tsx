import { useApp } from '../../state/store';
import { useThinFloor } from '../../state/thinFloorStore';
import { Metric, Tag } from '../controls';
import { floorStation, floorStops } from '../../scene/m7/ThinFloorScene';

const f = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—');

export function ResultsPanel7() {
  const r = useThinFloor((s) => s.result);
  const computing = useThinFloor((s) => s.computing);
  const ms = useThinFloor((s) => s.computeMs);
  const display = useThinFloor((s) => s.display);
  const cursor = useApp((s) => s.cursor);
  const forceOn = useApp((s) => s.view.forceOn);
  if (!r) return <div className="p-3 text-xs text-slate-400">Computing Module 7…</div>;
  const s = r.summary, p = r.params;
  const { st } = floorStation(r, cursor.station);
  const sign = forceOn === 'tool' ? 1 : -1;
  return (
    <div className="space-y-3 p-3 text-slate-200">
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span>Cutter at ({f(st.x, 0)}, {f(st.y, 0)}) mm · layer {st.layer + 1}/{r.layers} · {st.link ? 'link move' : `${st.mode}-milling, ae ${f(st.ae, 1)} mm`}</span>
        <span className="text-[10px] text-slate-500">{computing ? 'computing…' : `solved in ${ms.toFixed(0)} ms`}</span>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Cutting force on the {forceOn} (mean per rev, machine frame)</h3>
          <Tag kind={p.coeffSource === 'calibrated' ? 'validated' : 'estimate'}>{p.coeffSource === 'calibrated' ? 'calibrated K' : 'estimate'}</Tag>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <Metric label="Fx now" value={f(sign * st.force.Fx, 1)} unit="N" />
          <Metric label="Fy now" value={f(sign * st.force.Fy, 1)} unit="N" />
          <Metric label="Fz now" value={f(sign * st.force.Fz, 1)} unit="N" sub={sign > 0 ? '+ = tool pushed up' : '− = floor pushed down'} />
          <Metric label="Mean axial force" value={f(s.meanFz, 1)} unit="N" sub="cutting stations" />
          <Metric label="Mean in-plane force" value={f(s.meanFxy, 1)} unit="N" />
          <Metric label="Peak resultant" value={f(s.peakF, 0)} unit="N" />
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Floor deflection (elastic, during cutting)</h3>
          <Tag kind={s.maxDeflection > p.tol ? 'warn' : 'ok'}>quasi-static FE</Tag>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <Metric label="Under the cutter now" value={f(st.wTool * 1000, 1)} unit="µm" sub={`engaged depth ${f(st.apEff, 3)} mm`} />
          <Metric label="Max on floor now" value={f(st.wMax * 1000, 1)} unit="µm" />
          <Metric label="Max during the job" value={f(s.maxDeflection * 1000, 1)} unit="µm" tone={s.maxDeflection > p.tol ? 'warn' : 'ok'} />
          <Metric label="Floor f₁ (start → end)" value={`${f(s.f1Start, 0)} → ${f(s.f1End, 0)}`} unit="Hz" tone={s.f1End < 3 * s.ftp ? 'warn' : 'ok'} />
          <Metric label="Tooth passing" value={f(s.ftp, 0)} unit="Hz" sub={`f₁/f_tp = ${f(s.f1End / s.ftp, 1)}`} />
          <Metric label="Layers" value={`${r.layers} × ${f(r.apLayer, 2)}`} unit="mm" />
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Final floor thickness (after springback)</h3>
          <Tag kind={s.pass ? 'ok' : 'fail'}>{s.pass ? 'within tolerance' : 'out of tolerance'}</Tag>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <Metric label="Max |thickness error|" value={f(s.maxErr * 1000, 1)} unit="µm" tone={s.pass ? 'ok' : 'bad'} sub={`tolerance ±${f(p.tol * 1000, 0)} µm`} />
          <Metric label="Mean |error|" value={f(s.meanErr * 1000, 1)} unit="µm" />
          <Metric label="Thickness range" value={`${f(s.minThickness, 3)}–${f(s.maxThickness, 3)}`} unit="mm" />
          <Metric label="Cutting time" value={f(s.cutTime, 1)} unit="s" sub={`path ${f(s.pathLength, 0)} mm`} />
          <Metric label="MRR" value={f(s.mrr / 1000, 2)} unit="cm³/min" />
          <Metric label="Feed rate" value={f(p.rpm * p.N * p.fz, 0)} unit="mm/min" sub={p.strategy === 'adaptive' ? 'before chip-thinning comp.' : undefined} />
        </div>
      </div>

      <div>
        <div className="text-[10px] text-slate-400">{display === 'deflection' ? `Floor colour: |w| / max deflection (${f(s.maxDeflection * 1000, 0)} µm).` : `Floor colour: |final thickness error| / tolerance (${f(p.tol * 1000, 0)} µm); grey = not yet finished.`} Dashed cyan grid = undeformed nominal floor.</div>
        <div className="mt-1 h-2.5 rounded" style={{ background: `linear-gradient(90deg,${floorStops()})` }} />
        <div className="flex justify-between text-[10px] text-slate-500 tabular"><span>0</span><span>{display === 'deflection' ? `${f(s.maxDeflection * 1000, 0)} µm` : `${f(p.tol * 1000, 0)} µm`}</span></div>
      </div>

      {s.warnings.length > 0 && <div className="space-y-1">{s.warnings.map((w, i) => <div key={i} className="rounded bg-orange-950/40 px-2 py-1 text-[11px] leading-snug text-orange-200 ring-1 ring-orange-900">⚠ {w}</div>)}</div>}
    </div>
  );
}
