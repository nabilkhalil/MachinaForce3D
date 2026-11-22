import { useApp } from '../../state/store';
import { usePocket } from '../../state/pocketStore';
import { MATERIALS, type MaterialId, type CuttingCoefficients } from '../../physics/materials';
import { POCKET_STRATEGY_INFO, type PocketStrategy } from '../../physics/pocketProcess';
import { POCKET_HELP } from '../../content/pocket';
import { Section, SelectField, SliderField, Tag, Toggle } from '../controls';

function H({ k }: { k: string }) {
  const learn = useApp((s) => s.view.learn);
  if (!learn || !POCKET_HELP[k]) return null;
  return <p className="mt-1 rounded bg-cyan-950/40 px-2 py-1 text-[11px] leading-snug text-cyan-100/90 ring-1 ring-cyan-900">{POCKET_HELP[k]}</p>;
}

const COEFF: (keyof CuttingCoefficients)[] = ['Ktc', 'Krc', 'Kac', 'Kte', 'Kre', 'Kae'];

export function ParamPanel2() {
  const p = usePocket((s) => s.params);
  const set = usePocket((s) => s.setParams);
  const mat = MATERIALS[p.materialId];
  const srcTag = p.coeffSource === 'calibrated' ? 'validated' : p.coeffSource === 'user-defined' ? 'assumption' : 'estimate';
  return (
    <div className="text-slate-200">
      <Section title="Pocket (rigid workpiece)">
        <SelectField<MaterialId> label="Material" value={p.materialId}
          options={Object.values(MATERIALS).map((m) => ({ value: m.id, label: m.name }))}
          onChange={(id) => set({ materialId: id, coeffs: { ...MATERIALS[id].coeffs }, coeffSource: 'illustrative' })} help="materialId" />
        <SliderField label="Pocket depth" symbol="Hp" unit="mm" value={p.pocketDepth} min={10} max={90} step={1} digits={0} onChange={(v) => set({ pocketDepth: v })} />
        <H k="pocketDepth" />
        <SliderField label="Wall length" unit="mm" value={p.wallLength} min={20} max={120} step={2} digits={0} onChange={(v) => set({ wallLength: v })} />
        <SliderField label="Wall position tolerance (±)" unit="mm" value={p.tolerance} min={0.005} max={0.2} step={0.005} digits={3} onChange={(v) => set({ tolerance: v })} help="tolerance" />
      </Section>

      <Section title="Long-reach tool">
        <SliderField label="Diameter" symbol="D" unit="mm" value={p.D} min={4} max={20} step={1} digits={0} onChange={(v) => set({ D: v, neckDiameter: Math.min(p.neckDiameter, v - 0.4) })} help="D" />
        <SliderField label="Number of teeth" symbol="N" value={p.N} min={2} max={6} step={1} digits={0} onChange={(v) => set({ N: v })} help="N" />
        <SliderField label="Helix angle" symbol="β" unit="°" value={p.helixDeg} min={0} max={50} step={5} digits={0} onChange={(v) => set({ helixDeg: v })} help="helixDeg" />
        <SliderField label="Overhang (gauge length)" symbol="L" unit="mm" value={p.overhang} min={20} max={120} step={1} digits={0} onChange={(v) => set({ overhang: v })} />
        <H k="overhang" />
        <SliderField label="Flute length" symbol="Lf" unit="mm" value={p.fluteLength} min={5} max={Math.max(5, p.overhang)} step={1} digits={0} onChange={(v) => set({ fluteLength: v })} />
        <H k="fluteLength" />
        <Toggle label="Reduced neck (long-reach geometry)" checked={p.neck} onChange={(v) => set({ neck: v })} />
        {p.neck && (
          <>
            <SliderField label="Neck diameter" symbol="dn" unit="mm" value={p.neckDiameter} min={Math.max(2, p.D * 0.5)} max={p.D - 0.2} step={0.1} digits={1} onChange={(v) => set({ neckDiameter: v })} />
            <SliderField label="Neck length" symbol="Ln" unit="mm" value={p.neckLength} min={0} max={Math.max(0, p.overhang - p.fluteLength)} step={1} digits={0} onChange={(v) => set({ neckLength: v })} />
          </>
        )}
        <H k="neck" />
      </Section>

      <Section title="Holder & spindle">
        <Toggle label="Rigid holder (idealised)" checked={p.holderRigid} onChange={(v) => set({ holderRigid: v })} />
        {!p.holderRigid && (
          <>
            <SliderField label="Translational stiffness kT" unit="N/µm" value={p.holderKT / 1000} min={5} max={200} step={1} digits={0} onChange={(v) => set({ holderKT: v * 1000 })} />
            <SliderField label="Rotational stiffness kR" unit="×10⁶ N·mm/rad" value={p.holderKR / 1e6} min={5} max={500} step={5} digits={0} onChange={(v) => set({ holderKR: v * 1e6 })} />
          </>
        )}
        <H k="holder" />
        <div className="text-[10px] text-slate-500">Default holder values are illustrative of a collet holder; shrink-fit/hydraulic holders are stiffer.</div>
      </Section>

      <Section title="Cutting conditions">
        <SliderField label="Spindle speed" symbol="n" unit="rpm" value={p.rpm} min={500} max={30000} step={100} digits={0} onChange={(v) => set({ rpm: v })} help="rpm" />
        <SliderField label="Feed per tooth" symbol="fz" unit="mm/tooth" value={p.fz} min={0.005} max={0.2} step={0.005} digits={3} onChange={(v) => set({ fz: v })} help="fz" />
        <SliderField label="Finishing radial depth" symbol="ae" unit="mm" value={p.aeFinish} min={0.05} max={Math.min(3, p.D / 2)} step={0.05} onChange={(v) => set({ aeFinish: v })} />
        <H k="aeFinish" />
        {p.strategy !== 'full-depth' && (
          <><SliderField label="Axial depth per level" symbol="ap" unit="mm" value={p.ap} min={1} max={Math.min(40, p.pocketDepth)} step={0.5} digits={1} onChange={(v) => set({ ap: v })} /><H k="ap" /></>
        )}
        <SelectField label="Milling mode" value={p.mode} options={[{ value: 'down', label: 'Down-milling (climb)' }, { value: 'up', label: 'Up-milling (conventional)' }]} onChange={(m) => set({ mode: m })} />
        <H k="mode" />
      </Section>

      <Section title="Finishing strategy">
        <SelectField<PocketStrategy> label="Pass strategy" value={p.strategy}
          options={(Object.keys(POCKET_STRATEGY_INFO) as PocketStrategy[]).map((k) => ({ value: k, label: POCKET_STRATEGY_INFO[k].name }))}
          onChange={(s) => set({ strategy: s })} />
        <p className="text-[11px] leading-snug text-slate-400">{POCKET_STRATEGY_INFO[p.strategy].text}</p>
        <H k="strategy" />
      </Section>

      <Section title="Cutting-force coefficients" defaultOpen={false} right={<Tag kind={srcTag}>{p.coeffSource}</Tag>}>
        <div className="grid grid-cols-3 gap-1.5">
          {COEFF.map((k) => (
            <label key={k} className="text-[10px] text-slate-400">{k}
              <input type="number" step="any" value={p.coeffs[k]}
                onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v >= 0) set({ coeffs: { ...p.coeffs, [k]: v }, coeffSource: p.coeffSource === 'calibrated' ? 'calibrated' : 'user-defined' }); }}
                className="mt-0.5 w-full rounded bg-slate-800 px-1 py-0.5 text-right text-xs text-slate-100 tabular ring-1 ring-slate-700" />
            </label>
          ))}
        </div>
        <Toggle label="These values are calibrated from my own dynamometer tests" checked={p.coeffSource === 'calibrated'} onChange={(v) => set({ coeffSource: v ? 'calibrated' : 'user-defined' })} />
        <button className="text-[11px] text-cyan-400 hover:underline" onClick={() => set({ coeffs: { ...mat.coeffs }, coeffSource: 'illustrative' })}>Restore illustrative defaults for {mat.name}</button>
      </Section>
    </div>
  );
}
