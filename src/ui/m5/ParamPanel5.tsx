import { useApp } from '../../state/store';
import { useFixture } from '../../state/fixtureStore';
import { MATERIALS, type MaterialId, type CuttingCoefficients } from '../../physics/materials';
import { LAYOUT_INFO, type FeedDirX, type LayoutId } from '../../physics/fixture';
import { FIXTURE_HELP } from '../../content/fixture';
import { Section, SelectField, SliderField, Tag, Toggle } from '../controls';

function H({ k }: { k: string }) {
  const learn = useApp((s) => s.view.learn);
  if (!learn || !FIXTURE_HELP[k]) return null;
  return <p className="mt-1 rounded bg-cyan-950/40 px-2 py-1 text-[11px] leading-snug text-cyan-100/90 ring-1 ring-cyan-900">{FIXTURE_HELP[k]}</p>;
}
const COEFF: (keyof CuttingCoefficients)[] = ['Ktc', 'Krc', 'Kac', 'Kte', 'Kre', 'Kae'];

export function ParamPanel5() {
  const p = useFixture((s) => s.params);
  const set = useFixture((s) => s.setParams);
  const mat = MATERIALS[p.materialId];
  const srcTag = p.coeffSource === 'calibrated' ? 'validated' : p.coeffSource === 'user-defined' ? 'assumption' : 'estimate';
  return (
    <div className="text-slate-200">
      <Section title="Workpiece">
        <SelectField<MaterialId> label="Material" value={p.materialId} options={Object.values(MATERIALS).map((m) => ({ value: m.id, label: m.name }))}
          onChange={(id) => set({ materialId: id, coeffs: { ...MATERIALS[id].coeffs }, coeffSource: 'illustrative' })} />
        <div className="text-[10px] text-slate-500">Rigid block {p.Lx} × {p.Ly} × {p.Lz} mm (X × Y × Z), mass {((mat.rho * p.Lx * p.Ly * p.Lz) / 1e9).toFixed(2)} kg. The part itself is treated as rigid; only the contacts deform.</div>
        <SliderField label="Slot position / depth tolerance (±)" unit="mm" value={p.tolerance} min={0.005} max={0.1} step={0.005} digits={3} onChange={(v) => set({ tolerance: v })} />
        <H k="tolerance" />
      </Section>

      <Section title="Fixture (3-2-1 locating)">
        <SelectField<LayoutId> label="Layout" value={p.layout} options={(Object.keys(LAYOUT_INFO) as LayoutId[]).map((k) => ({ value: k, label: LAYOUT_INFO[k].name }))} onChange={(l) => set({ layout: l })} />
        <p className="text-[10px] leading-snug text-slate-500">{LAYOUT_INFO[p.layout].text}</p>
        <H k="layout" />
        <SliderField label={p.layout === 'off-locator' ? 'Top clamp force (each of 2)' : 'Top clamp force (each of 3)'} unit="N" value={p.topClamp} min={100} max={10000} step={100} digits={0} onChange={(v) => set({ topClamp: v })} />
        <H k="topClamp" />
        <SliderField label="Side clamp force" unit="N" value={p.sideClamp} min={100} max={10000} step={100} digits={0} onChange={(v) => set({ sideClamp: v })} />
        <H k="sideClamp" />
        <Toggle label="End clamp (push against the end locator)" checked={p.endClamp > 0} onChange={(v) => set({ endClamp: v ? 1500 : 0 })} />
        {p.endClamp > 0 && <SliderField label="End clamp force" unit="N" value={p.endClamp} min={100} max={10000} step={100} digits={0} onChange={(v) => set({ endClamp: v })} />}
        <H k="endClamp" />
        <SliderField label="Friction coefficient" symbol="μ" value={p.mu} min={0.1} max={0.6} step={0.01} digits={2} onChange={(v) => set({ mu: v })} />
        <H k="mu" />
        <SliderField label="Locator contact stiffness (at 1 kN)" unit="N/µm" value={p.kLocator / 1000} min={5} max={300} step={5} digits={0} onChange={(v) => set({ kLocator: v * 1000 })} />
        <H k="kLocator" />
        <SliderField label="Clamp stiffness (at 1 kN)" unit="N/µm" value={p.kClamp / 1000} min={2} max={200} step={1} digits={0} onChange={(v) => set({ kClamp: v * 1000 })} />
        <H k="kClamp" />
        <div className="text-[10px] text-slate-500">Contact stiffness and friction values are illustrative.</div>
      </Section>

      <Section title="Slot milling operation">
        <SliderField label="Cutter diameter" symbol="D" unit="mm" value={p.D} min={6} max={25} step={1} digits={0} onChange={(v) => set({ D: v })} />
        <SliderField label="Number of flutes" symbol="N" value={p.N} min={2} max={6} step={1} digits={0} onChange={(v) => set({ N: Math.round(v) })} />
        <SliderField label="Slot depth" symbol="ap" unit="mm" value={p.ap} min={1} max={15} step={0.5} digits={1} onChange={(v) => set({ ap: v })} />
        <H k="ap" />
        <SliderField label="Feed per tooth" symbol="fz" unit="mm" value={p.fz} min={0.01} max={0.2} step={0.005} digits={3} onChange={(v) => set({ fz: v })} />
        <H k="fz" />
        <SliderField label="Spindle speed" symbol="n" unit="rpm" value={p.rpm} min={300} max={12000} step={50} digits={0} onChange={(v) => set({ rpm: v })} />
        <SliderField label="Slot position from side datum" symbol="Y" unit="mm" value={p.slotY} min={p.D / 2 + 3} max={p.Ly - p.D / 2 - 3} step={1} digits={0} onChange={(v) => set({ slotY: v })} />
        <SelectField<FeedDirX> label="Feed direction" value={p.feedDir} options={[{ value: '+X', label: '+X (away from the end locator)' }, { value: '-X', label: '−X (toward the end locator)' }]} onChange={(d) => set({ feedDir: d })} />
        <H k="feedDir" />
        <div className="text-[10px] text-slate-500">Full-width slot (ae = D), 30° helix, single pass along X.</div>
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
        <Toggle label="Calibrated from my own dynamometer tests" checked={p.coeffSource === 'calibrated'} onChange={(v) => set({ coeffSource: v ? 'calibrated' : 'user-defined' })} />
        <button className="text-[11px] text-cyan-400 hover:underline" onClick={() => set({ coeffs: { ...mat.coeffs }, coeffSource: 'illustrative' })}>Restore illustrative defaults for {mat.name}</button>
      </Section>
    </div>
  );
}
