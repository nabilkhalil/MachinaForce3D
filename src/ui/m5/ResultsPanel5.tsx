import { useApp } from '../../state/store';
import { useFixture } from '../../state/fixtureStore';
import { Metric, Tag } from '../controls';
import { cssColor, sequential } from '../../lib/colormap';

const f = (v: number | null | undefined, d = 1) => (v !== null && v !== undefined && Number.isFinite(v) ? v.toFixed(d) : '—');
const STATUS: Record<string, string> = { stick: 'text-emerald-300', slip: 'text-amber-300', lift: 'text-rose-300' };

export function ResultsPanel5() {
  const r = useFixture((s) => s.result);
  const computing = useFixture((s) => s.computing);
  const ms = useFixture((s) => s.computeMs);
  const cursor = useApp((s) => s.cursor);
  const forceOn = useApp((s) => s.view.forceOn);
  if (!r) return <div className="p-3 text-xs text-slate-400">Computing Module 5…</div>;
  const n = r.stations.length;
  const st = r.stations[Math.min(Math.max(Math.floor(cursor.station), 0), n - 1)];
  const s = r.summary, p = r.params;
  const clampSF = Number.isFinite(s.requiredClampScale) && s.requiredClampScale > 0 ? 1 / s.requiredClampScale : NaN;
  const posOK = s.maxAbsEy <= p.tolerance && s.maxAbsEz <= p.tolerance;
  const sign = forceOn === 'tool' ? 1 : -1;
  const stops = Array.from({ length: 11 }, (_, i) => cssColor(sequential(i / 10))).join(',');
  const dirTag = (v: number) => (v > 0 ? <span className="text-emerald-300">into locators</span> : <span className="text-rose-300">away (clamp / friction)</span>);
  return (
    <div className="space-y-3 p-3 text-slate-200">
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span>Cutter at X = {f(st.x, 0)} mm · slot Y = {p.slotY} mm · feed {p.feedDir}</span>
        <span className="text-[10px] text-slate-500">{computing ? 'computing…' : `solved in ${ms.toFixed(0)} ms`}</span>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Mean cutting force on the {forceOn}</h3>
          <Tag kind={p.coeffSource === 'calibrated' ? 'validated' : 'estimate'}>{p.coeffSource === 'calibrated' ? 'calibrated K' : 'estimate'}</Tag>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <Metric label="Fx" value={f(sign * st.meanF.Fx, 0)} unit="N" />
          <Metric label="Fy" value={f(sign * st.meanF.Fy, 0)} unit="N" />
          <Metric label="Fz" value={f(sign * st.meanF.Fz, 0)} unit="N" />
        </div>
        <div className="mt-1 text-[10px] text-slate-500">Peak |F| over a revolution {f(s.peakForce, 0)} N. On the workpiece: X {dirTag(s.into.x)}, Y {dirTag(s.into.y)}, Z {dirTag(s.into.z)}.</div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Workholding security</h3>
          <Tag kind={s.clampOK ? (clampSF >= 2 ? 'ok' : 'warn') : 'fail'}>{s.dislodged ? 'not restrained' : s.anyLift ? 'lift-off' : s.anySlip ? 'slip' : clampSF >= 2 ? 'secure' : 'marginal'}</Tag>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <Metric label="Clamping safety factor" value={f(clampSF, 2)} sub="clamp force / minimum" tone={!Number.isFinite(clampSF) || clampSF < 1 ? 'bad' : clampSF < 2 ? 'warn' : 'ok'} />
          <Metric label="Min friction reserve μN/T" value={f(s.minSlipSF, 2)} sub="over the path" tone={s.minSlipSF < 1 ? 'bad' : s.minSlipSF < 2 ? 'warn' : 'ok'} />
          <Metric label="Min contact force" value={f(s.minNormal, 0)} unit="N" sub={s.minNormalId} tone={s.minNormal <= 0 ? 'bad' : undefined} />
          <Metric label="Total clamp force" value={f(s.totalClamp, 0)} unit="N" />
          <Metric label="Lowest fixture f₁" value={f(s.freqs[0], 0)} unit="Hz" tone={s.freqs.length && s.freqs[0] >= 2 * s.ftp ? 'ok' : 'warn'} />
          <Metric label="Tooth passing" value={f(s.ftp, 0)} unit="Hz" sub={`f₁ / f_tp = ${f(s.freqs[0] / s.ftp, 1)}`} />
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Machined slot (in the datum frame)</h3>
          <Tag kind={s.dislodged ? 'fail' : posOK ? 'ok' : 'fail'}>{s.dislodged ? 'part moved' : posOK ? 'within tolerance' : 'out of tolerance'}</Tag>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <Metric label="Slot position error, max" value={f(s.maxAbsEy * 1000, 1)} unit="µm" tone={s.maxAbsEy > p.tolerance ? 'bad' : 'ok'} sub={`now ${f(st.ey * 1000, 1)}`} />
          <Metric label="Slot depth error, max" value={f(s.maxAbsEz * 1000, 1)} unit="µm" tone={s.maxAbsEz > p.tolerance ? 'bad' : 'ok'} sub={`now ${f(st.ez * 1000, 1)}`} />
          <Metric label="Tilt of the part, max" value={f(s.maxTilt * 1e6, 0)} unit="µrad" />
          <Metric label="Straightness (Y)" value={f(s.straightness * 1000, 1)} unit="µm" />
          <Metric label="Floor flatness (Z)" value={f(s.flatness * 1000, 1)} unit="µm" />
          <Metric label="Cutting time" value={f(s.cycleTime, 1)} unit="s" sub={`vf ${f(s.feedRate, 0)} mm/min`} />
        </div>
        {s.dislodged && <p className="mt-1 text-[10px] text-rose-300">The part is not held: the errors above are not meaningful (rigid-body motion is unbounded in this model).</p>}
      </div>

      <div>
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Contacts at this station (worst cutter angle)</h3>
        <table className="w-full text-[11px] tabular">
          <thead className="text-slate-500"><tr><th className="text-left">Element</th><th className="text-right">clamped N</th><th className="text-right">cutting N</th><th className="text-right">friction T</th><th className="text-right">state</th></tr></thead>
          <tbody>
            {r.els.map((e, i) => {
              const c = st.contacts[i];
              const idle = !r.preloaded[i] && c.status === 'lift';
              return (
                <tr key={e.id} className="border-t border-slate-800">
                  <td title={e.label}>{e.id} <span className="text-slate-500">{e.label}</span></td>
                  <td className="text-right">{f(r.N0[i], 0)}</td><td className="text-right">{f(c.N, 0)}</td><td className="text-right">{f(c.T, 0)}</td>
                  <td className={`text-right ${idle ? 'text-slate-500' : STATUS[c.status]}`}>{idle ? 'unloaded' : c.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div>
        <div className="text-[10px] text-slate-400">Slot floor colour: |feature error| / tolerance. Part motion is exaggerated in 3D; pads: green stick, amber slip, red lift-off, grey unloaded.</div>
        <div className="mt-1 h-2.5 rounded" style={{ background: `linear-gradient(90deg,${stops})` }} />
        <div className="flex justify-between text-[10px] text-slate-500 tabular"><span>0</span><span>± {f(p.tolerance * 1000, 0)} µm (tolerance)</span></div>
      </div>

      {s.warnings.length > 0 && <div className="space-y-1">{s.warnings.map((w, i) => <div key={i} className="rounded bg-orange-950/40 px-2 py-1 text-[11px] leading-snug text-orange-200 ring-1 ring-orange-900">⚠ {w}</div>)}</div>}
    </div>
  );
}
