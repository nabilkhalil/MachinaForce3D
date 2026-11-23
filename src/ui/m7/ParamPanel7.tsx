import { useApp } from '../../state/store';
import { useThinFloor } from '../../state/thinFloorStore';
import { MATERIALS, type MaterialId, type CuttingCoefficients } from '../../physics/materials';
import { STRATEGY_INFO, type EdgeSupport, type Strategy, type UnderSupport } from '../../physics/thinFloor';
import { THINFLOOR_HELP } from '../../content/thinFloor';
import { Btn, Section, SelectField, SliderField, Tag, Toggle } from '../controls';

function H({ k }: { k: string }) {
  const learn = useApp((s) => s.view.learn);
  if (!learn || !THINFLOOR_HELP[k]) return null;
  return <p className="mt-1 rounded bg-cyan-950/40 px-2 py-1 text-[11px] leading-snug text-cyan-100/90 ring-1 ring-cyan-900">{THINFLOOR_HELP[k]}</p>;
}
const COEFF: (keyof CuttingCoefficients)[] = ['Ktc', 'Krc', 'Kac', 'Kte', 'Kre', 'Kae'];

export function ParamPanel7() {
  const p = useThinFloor((s) => s.params);
  const set = useThinFloor((s) => s.setParams);
  const display = useThinFloor((s) => s.display);
  const section = useThinFloor((s) => s.section);
  const setDisplay = useThinFloor((s) => s.setDisplay);
  const view = useApp((s) => s.view);
  const setView = useApp((s) => s.setView);
  const mat = MATERIALS[p.materialId];
  const srcTag = p.coeffSource === 'calibrated' ? 'validated' : p.coeffSource === 'user-defined' ? 'assumption' : 'estimate';
  const cam = (c: 'iso' | 'top' | 'front', sec: boolean) => { setDisplay({ section: sec }); setView({ camPreset: c, camNonce: view.camNonce + 1 }); };
  const vc = (Math.PI * p.D * p.rpm) / 1000;
  return (
    <div className="text-slate-200">
      <Section title="View & display">
        <div className="flex flex-wrap gap-1">
          <Btn onClick={() => cam('iso', false)}>Isometric</Btn>
          <Btn onClick={() => cam('top', false)}>Top</Btn>
          <Btn kind={section ? 'primary' : undefined} onClick={() => cam('front', !section)}>Section y = W/2</Btn>
        </div>
        <SelectField<'deflection' | 'deviation'> label="Floor colour" value={display} options={[{ value: 'deflection', label: 'Instantaneous deflection w(x, y)' }, { value: 'deviation', label: 'Final thickness deviation (cut area)' }]} onChange={(d) => setDisplay({ display: d })} />
        <SliderField label="Deformation exaggeration" unit="×" value={view.exaggeration} min={1} max={1000} step={1} digits={0} onChange={(v) => setView({ exaggeration: v })} />
      </Section>

      <Section title="Workpiece (pocket floor)">
        <SelectField<MaterialId> label="Material" value={p.materialId} options={Object.values(MATERIALS).map((m) => ({ value: m.id, label: m.name }))}
          onChange={(id) => set({ materialId: id, coeffs: { ...MATERIALS[id].coeffs }, coeffSource: 'illustrative' })} />
        <SliderField label="Pocket length" symbol="L" unit="mm" value={p.L} min={40} max={120} step={5} digits={0} onChange={(v) => set({ L: v })} />
        <SliderField label="Pocket width" symbol="W" unit="mm" value={p.W} min={30} max={100} step={5} digits={0} onChange={(v) => set({ W: v })} />
        <H k="span" />
        <SliderField label="Final floor thickness" symbol="t" unit="mm" value={p.tFinal} min={1} max={4} step={0.05} digits={2} onChange={(v) => set({ tFinal: v })} />
        <H k="tFinal" />
        <SliderField label="Thickness tolerance (±)" unit="mm" value={p.tol} min={0.02} max={0.1} step={0.005} digits={3} onChange={(v) => set({ tol: v })} />
        <SliderField label="Finishing allowance on the floor" unit="mm" value={p.allowance} min={0.1} max={2} step={0.05} digits={2} onChange={(v) => set({ allowance: v })} />
        <H k="allowance" />
      </Section>

      <Section title="Support">
        <SelectField<EdgeSupport> label="Perimeter support" value={p.edge} options={[{ value: 'clamped', label: 'Perimeter support (stiff walls, clamped)' }, { value: 'reduced', label: 'Reduced edge support (elastic)' }]} onChange={(e) => set({ edge: e })} />
        <H k="edge" />
        <SelectField<UnderSupport> label="Underside support" value={p.under} options={[{ value: 'none', label: 'None' }, { value: 'centre', label: 'Centre support pin' }, { value: 'pins4', label: '2 × 2 support pins' }, { value: 'bed', label: 'Elastic support bed' }]} onChange={(u) => set({ under: u })} />
        {(p.under === 'centre' || p.under === 'pins4') && <SliderField label="Pin stiffness" unit="N/mm" value={p.kPin} min={200} max={50000} step={100} digits={0} onChange={(v) => set({ kPin: v })} />}
        {p.under === 'bed' && <SliderField label="Bed stiffness" unit="N/mm³" value={p.kBed} min={0.2} max={50} step={0.2} digits={1} onChange={(v) => set({ kBed: v })} />}
        <H k="under" />
      </Section>

      <Section title="Strategy">
        <SelectField<Strategy> label="Floor finishing strategy" value={p.strategy} options={(Object.keys(STRATEGY_INFO) as Strategy[]).map((k) => ({ value: k, label: STRATEGY_INFO[k].name }))} onChange={(s) => set({ strategy: s })} />
        <p className="text-[10px] leading-snug text-slate-500">{STRATEGY_INFO[p.strategy].text}</p>
        <H k="strategy" />
      </Section>

      <Section title="Cutting">
        <SliderField label="Cutter diameter" symbol="D" unit="mm" value={p.D} min={4} max={16} step={1} digits={0} onChange={(v) => set({ D: v, ae: Math.min(p.ae, v) })} />
        <SliderField label="Number of flutes" symbol="N" value={p.N} min={2} max={5} step={1} digits={0} onChange={(v) => set({ N: Math.round(v) })} />
        <SliderField label="Spindle speed" symbol="n" unit="rpm" value={p.rpm} min={2000} max={24000} step={500} digits={0} onChange={(v) => set({ rpm: v })} />
        <div className="text-[10px] text-slate-500">vc = {vc.toFixed(0)} m/min · f_tp = {((p.rpm * p.N) / 60).toFixed(0)} Hz</div>
        <SliderField label="Feed per tooth" symbol="fz" unit="mm" value={p.fz} min={0.01} max={0.2} step={0.005} digits={3} onChange={(v) => set({ fz: v })} />
        <H k="fz" />
        <SliderField label="Axial depth per floor pass" symbol="ap" unit="mm" value={p.ap} min={0.1} max={2} step={0.05} digits={2} onChange={(v) => set({ ap: v })} />
        <div className="text-[10px] text-slate-500">{Math.max(1, Math.min(4, Math.ceil(p.allowance / Math.max(p.ap, 0.05) - 1e-9)))} floor layer(s) of {(p.allowance / Math.max(1, Math.min(4, Math.ceil(p.allowance / Math.max(p.ap, 0.05) - 1e-9)))).toFixed(2)} mm</div>
        <SliderField label="Radial engagement (stepover)" symbol="ae" unit="mm" value={p.ae} min={0.4} max={p.D} step={0.1} digits={1} onChange={(v) => set({ ae: v })} />
        <H k="ae" />
        <div className="text-[10px] text-slate-500">Up/down milling follows from the path: zigzag alternates, spiral and adaptive are climb (down) milling.</div>
      </Section>

      <Section title="Force coefficients" defaultOpen={false} right={<Tag kind={srcTag}>{p.coeffSource}</Tag>}>
        <div className="grid grid-cols-3 gap-1.5">
          {COEFF.map((k) => (
            <label key={k} className="text-[10px] text-slate-400">{k}
              <input type="number" step="any" value={p.coeffs[k]}
                onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v >= 0) set({ coeffs: { ...p.coeffs, [k]: v }, coeffSource: p.coeffSource === 'calibrated' ? 'calibrated' : 'user-defined' }); }}
                className="mt-0.5 w-full rounded bg-slate-800 px-1 py-0.5 text-right text-xs text-slate-100 tabular ring-1 ring-slate-700" />
            </label>
          ))}
        </div>
        <SliderField label="End-edge chip coefficient" symbol="K_zc" unit="N/mm²" value={p.Kzc} min={0} max={2000} step={10} digits={0} onChange={(v) => set({ Kzc: v, coeffSource: 'user-defined' })} />
        <SliderField label="End-edge rubbing coefficient" symbol="K_ze" unit="N/mm" value={p.Kze} min={0} max={60} step={0.5} digits={1} onChange={(v) => set({ Kze: v, coeffSource: 'user-defined' })} />
        <H k="axial" />
        <Toggle label="Calibrated from my own dynamometer tests" checked={p.coeffSource === 'calibrated'} onChange={(v) => set({ coeffSource: v ? 'calibrated' : 'user-defined' })} />
        <button className="text-[11px] text-cyan-400 hover:underline" onClick={() => set({ coeffs: { ...mat.coeffs }, Kzc: 300, Kze: 8, coeffSource: 'illustrative' })}>Restore illustrative defaults for {mat.name}</button>
      </Section>
    </div>
  );
}
