import { useChatter } from '../../state/chatterStore';
import { Metric, Tag } from '../controls';
import { chatterLive } from '../../scene/m3/ChatterScene';
import { useApp } from '../../state/store';
import { cssColor, sequential } from '../../lib/colormap';

const f = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—');

export function ResultsPanel3() {
  const r = useChatter((s) => s.result);
  const computing = useChatter((s) => s.computing);
  const ms = useChatter((s) => s.computeMs);
  useApp((s) => s.cursor);
  if (!r) return <div className="p-3 text-xs text-slate-400">Computing Module 3…</div>;
  const p = r.params, s = r.sim;
  const zoaStable = p.ap < r.aLimHere;
  const tdStable = s.verdict === 'stable';
  const pocket = (60 * Math.min(p.modeX.fn, p.modeY.fn)) / p.N;
  const stops = Array.from({ length: 11 }, (_, i) => cssColor(sequential(i / 10))).join(',');
  return (
    <div className="space-y-3 p-3 text-slate-200">
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span>n = {p.rpm} rpm · ap = {f(p.ap, 2)} mm · ae = {p.ae} mm · {p.mode}-milling</span>
        <span className="text-[10px] text-slate-500">{computing ? 'computing…' : `solved in ${ms.toFixed(0)} ms`}</span>
      </div>

      <div className={`rounded p-2 ring-1 ${tdStable ? 'bg-emerald-950/40 ring-emerald-800' : 'bg-rose-950/40 ring-rose-800'}`}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{tdStable ? 'Stable cut — forced vibration only' : 'CHATTER — self-excited vibration'}</span>
          <Tag kind={tdStable ? 'ok' : 'fail'}>time-domain verdict</Tag>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-slate-300">
          {tdStable
            ? `The motion repeats every tooth period (once-per-tooth scatter ${f(s.chatterRatio * 100, 0)} % < 10 %). Dominant vibration at ${f(s.domFreq, 0)} Hz ${s.domIsHarmonic ? '= a tooth-passing harmonic' : ''}.`
            : `Once-per-tooth samples scatter (${f(s.chatterRatio * 100, 0)} % > 10 %). Dominant vibration at ${f(s.domFreq, 0)} Hz${s.domIsHarmonic ? '' : ' — not a tooth-passing harmonic (chatter frequency)'}.`}
        </p>
      </div>

      <div>
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Stability (two independent methods)</h3>
        <div className="grid grid-cols-2 gap-1.5">
          <Metric label="ZOA lobe limit at this speed" value={f(r.aLimHere, 2)} unit="mm" tone={zoaStable ? 'ok' : 'bad'} sub={zoaStable ? `ap below the lobe → stable` : 'ap above the lobe → unstable'} />
          <Metric label="Time-domain verdict" value={tdStable ? 'stable' : 'chatter'} tone={tdStable ? 'ok' : 'bad'} sub={`scatter ratio ${f(s.chatterRatio, 2)}`} />
          <Metric label="Absolute stable depth" value={f(r.lobes.aMin, 2)} unit="mm" sub="ZOA, any speed in range" />
          <Metric label="Main pocket speed" value={f(pocket, 0)} unit="rpm" sub="f_tp = fn  (60·fn/N)" />
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Vibration</h3>
        <div className="grid grid-cols-3 gap-1.5">
          <Metric label="Peak-to-peak y" value={f(s.ppY * 1000, 1)} unit="µm" tone={tdStable ? undefined : 'bad'} />
          <Metric label="Peak-to-peak x" value={f(s.ppX * 1000, 1)} unit="µm" />
          <Metric label="Max force" value={f(s.maxF, 0)} unit="N" />
          <Metric label="Dominant freq." value={f(s.domFreq, 0)} unit="Hz" sub={s.domIsHarmonic ? 'tooth harmonic' : 'non-harmonic'} />
          <Metric label="Tooth passing" value={f(r.ftp, 0)} unit="Hz" />
          <Metric label="Teeth out of cut" value={f(s.jumpOut * 100, 0)} unit="%" sub="jump-out" />
        </div>
        <div className="mt-1 text-[10px] text-slate-500">Forced response (no regeneration, harmonics × FRF): y {f(r.forced.ampY * 1000, 2)} µm, x {f(r.forced.ampX * 1000, 2)} µm; static deflection y {f(r.forced.staticY * 1000, 1)} µm.</div>
      </div>

      <div>
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Dynamic stiffness & productivity</h3>
        <div className="grid grid-cols-2 gap-1.5">
          <Metric label="Min dynamic stiffness x / y" value={`${f(r.kDynMin.x, 0)} / ${f(r.kDynMin.y, 0)}`} unit="N/mm" sub="1 / max|G|  (≈ 2kζ)" />
          <Metric label="Static stiffness x / y" value={`${f(p.modeX.k, 0)} / ${f(p.modeY.k, 0)}`} unit="N/mm" />
          <Metric label="Feed rate vf" value={f(r.feedRate, 0)} unit="mm/min" />
          <Metric label="MRR = ae·ap·vf" value={f(r.mrr, 0)} unit="mm³/min" />
        </div>
      </div>

      <div>
        <div className="text-[10px] text-slate-400">Machined face colour: vibration amplitude when the tool passed (tool motion exaggerated in 3D)</div>
        <div className="mt-1 h-2.5 rounded" style={{ background: `linear-gradient(90deg,${stops})` }} />
        <div className="flex justify-between text-[10px] text-slate-500 tabular"><span>0</span><span>≥ {f(chatterLive.vibScale * 1000, 0)} µm</span></div>
      </div>

      <div className="space-y-1">{r.warnings.map((w, i) => <div key={i} className="rounded bg-orange-950/40 px-2 py-1 text-[11px] leading-snug text-orange-200 ring-1 ring-orange-900">⚠ {w}</div>)}</div>
    </div>
  );
}
