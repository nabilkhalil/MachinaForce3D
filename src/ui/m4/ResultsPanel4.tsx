import { useApp } from '../../state/store';
import { useTurning } from '../../state/turningStore';
import { Metric, Tag } from '../controls';
import { latheLive } from '../../scene/m4/LatheScene';
import { cssColor, diverging } from '../../lib/colormap';

const f = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—');

export function ResultsPanel4() {
  const r = useTurning((s) => s.result);
  const computing = useTurning((s) => s.computing);
  const ms = useTurning((s) => s.computeMs);
  const cursor = useApp((s) => s.cursor);
  const forceOn = useApp((s) => s.view.forceOn);
  if (!r) return <div className="p-3 text-xs text-slate-400">Computing Module 4…</div>;
  const n = r.stations.length;
  const st = r.stations[Math.min(Math.max(Math.floor(cursor.station), 0), n - 1)];
  const pass = r.passes[st.pass];
  const s = r.summary, p = r.params;
  const maxAbs = Math.max(Math.abs(s.devMin), Math.abs(s.devMax));
  const ok = maxAbs <= p.tolerance;
  const sign = forceOn === 'tool' ? 1 : -1;
  const total = Math.hypot(st.Fc, st.Ff, st.Fp);
  const stops = Array.from({ length: 11 }, (_, i) => cssColor(diverging(i / 5 - 1))).join(',');
  const share = (v: number) => (total > 0 ? `${((100 * v) / total).toFixed(0)} % of |F|` : '');
  return (
    <div className="space-y-3 p-3 text-slate-200">
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span>Pass {st.pass + 1}/{r.passes.length} · {pass.kind} · Z = {f(st.z, 0)} mm · Ø target {pass.target.toFixed(2)}</span>
        <span className="text-[10px] text-slate-500">{computing ? 'computing…' : `solved in ${ms.toFixed(0)} ms`}</span>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Force components on the {forceOn} (lathe frame)</h3>
          <Tag kind={p.coeffSource === 'calibrated' ? 'validated' : 'estimate'}>{p.coeffSource === 'calibrated' ? 'calibrated K' : 'estimate'}</Tag>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <Metric label="Fc cutting (−Y)" value={f(sign * st.Fc)} unit="N" sub={share(st.Fc)} />
          <Metric label="Ff feed (Z)" value={f(sign * st.Ff)} unit="N" sub={share(st.Ff)} />
          <Metric label="Fp passive (+X)" value={f(sign * st.Fp)} unit="N" sub={share(st.Fp)} />
        </div>
        <div className="mt-1 text-[10px] text-slate-500">
          ap {f(st.ap, 3)} mm → effective {f(st.apEff, 3)} mm · equivalent entering angle κe = {f((st.kappaE * 180) / Math.PI, 0)}° (κr = {p.kappa}°, rε = {p.noseR} mm) · |F| = {f(total)} N
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Power & productivity</h3>
        <div className="grid grid-cols-3 gap-1.5">
          <Metric label="Cutting power" value={f(st.power, 2)} unit="kW" tone={s.maxPower > p.machinePower ? 'bad' : undefined} sub={`max ${f(s.maxPower, 2)} / ${p.machinePower} kW`} />
          <Metric label="Torque" value={f(s.torque, 1)} unit="N·m" sub="Fc · d0/2 (max)" />
          <Metric label="Spindle speed" value={f(s.rpm, 0)} unit="rpm" />
          <Metric label="Feed rate" value={f(s.feedRate, 0)} unit="mm/min" />
          <Metric label="MRR = vc·ap·f" value={f(s.mrr, 1)} unit="cm³/min" />
          <Metric label="Cutting time" value={f(s.cycleTime, 1)} unit="s" />
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Deflection (quasi-static)</h3>
        <div className="grid grid-cols-2 gap-1.5">
          <Metric label="Shaft at tool (X), now" value={f(latheLive.shaftDefl * 1000, 1)} unit="µm" sub="away from the tool" />
          <Metric label="Shaft at tool (X), max" value={f(s.maxShaftDefl * 1000, 1)} unit="µm" />
          <Metric label="Tool deflection, now" value={f(st.toolDefl * 1000, 1)} unit="µm" sub={`k = ${f(p.kTool / 1000, 0)} N/µm`} />
          <Metric label="Shaft Y (from Fc), max" value={f(s.maxShaftDeflY * 1000, 1)} unit="µm" sub={`radius effect ${f(s.radiusEffectY * 1000, 3)} µm`} />
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Finished diameter</h3>
          <Tag kind={ok ? 'ok' : 'fail'}>{ok ? 'within tolerance' : 'out of tolerance'}</Tag>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <Metric label="Min dev." value={f(s.devMin * 1000, 1)} unit="µm" tone={Math.abs(s.devMin) > p.tolerance ? 'bad' : 'ok'} />
          <Metric label="Max dev." value={f(s.devMax * 1000, 1)} unit="µm" tone={Math.abs(s.devMax) > p.tolerance ? 'bad' : 'ok'} />
          <Metric label="Length in tol." value={f(s.inTolFraction * 100, 0)} unit="%" tone={s.inTolFraction >= 0.999 ? 'ok' : 'warn'} />
          <Metric label="Cylindricity (max−min)" value={f(s.cylindricity * 1000, 1)} unit="µm" />
          <Metric label="Theoretical Ra" value={f(s.ra, 2)} unit="µm" sub={`Rz ${f(s.rz, 1)} µm`} />
          <Metric label="Shaft f₁" value={f(s.shaftF1, 0)} unit="Hz" sub={`L/D ${f(s.slenderness, 1)}`} />
        </div>
      </div>

      <div>
        <div className="text-[10px] text-slate-400">Shaft colour: diameter deviation from nominal (turned part); centre-line deflection exaggerated in 3D. Dark stripe = rotation.</div>
        <div className="mt-1 h-2.5 rounded" style={{ background: `linear-gradient(90deg,${stops})` }} />
        <div className="flex justify-between text-[10px] text-slate-500 tabular"><span>−{f(latheLive.devRange * 1000, 0)} µm undersize</span><span>0</span><span>+{f(latheLive.devRange * 1000, 0)} µm oversize</span></div>
      </div>

      {s.warnings.length > 0 && <div className="space-y-1">{s.warnings.map((w, i) => <div key={i} className="rounded bg-orange-950/40 px-2 py-1 text-[11px] leading-snug text-orange-200 ring-1 ring-orange-900">⚠ {w}</div>)}</div>}
    </div>
  );
}
