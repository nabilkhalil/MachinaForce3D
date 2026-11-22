import { useApp } from '../../state/store';
import { useTurning } from '../../state/turningStore';
import { MATERIALS, type MaterialId, type CuttingCoefficients } from '../../physics/materials';
import type { FeedDir, TurnStrategy, Workholding } from '../../physics/turning';
import { TURNING_HELP } from '../../content/turning';
import { Section, SelectField, SliderField, Tag, Toggle } from '../controls';

function H({ k }: { k: string }) {
  const learn = useApp((s) => s.view.learn);
  if (!learn || !TURNING_HELP[k]) return null;
  return <p className="mt-1 rounded bg-cyan-950/40 px-2 py-1 text-[11px] leading-snug text-cyan-100/90 ring-1 ring-cyan-900">{TURNING_HELP[k]}</p>;
}
const COEFF: (keyof CuttingCoefficients)[] = ['Ktc', 'Krc', 'Kac', 'Kte', 'Kre', 'Kae'];

export function ParamPanel4() {
  const p = useTurning((s) => s.params);
  const set = useTurning((s) => s.setParams);
  const mat = MATERIALS[p.materialId];
  const srcTag = p.coeffSource === 'calibrated' ? 'validated' : p.coeffSource === 'user-defined' ? 'assumption' : 'estimate';
  return (
    <div className="text-slate-200">
      <Section title="Shaft (workpiece)">
        <SelectField<MaterialId> label="Material" value={p.materialId} options={Object.values(MATERIALS).map((m) => ({ value: m.id, label: m.name }))}
          onChange={(id) => set({ materialId: id, coeffs: { ...MATERIALS[id].coeffs }, coeffSource: 'illustrative' })} help="materialId" />
        <SliderField label="Bar diameter" symbol="d0" unit="mm" value={p.d0} min={8} max={80} step={0.5} digits={1} onChange={(v) => set({ d0: v, dT: Math.min(p.dT, v - 0.1) })} />
        <SliderField label="Finished diameter" symbol="dT" unit="mm" value={p.dT} min={5} max={p.d0 - 0.1} step={0.05} digits={2} onChange={(v) => set({ dT: v })} />
        <div className="text-[10px] text-slate-500">Radial depth of cut ap = (d0 − dT)/2 = {((p.d0 - p.dT) / 2).toFixed(2)} mm</div>
        <SliderField label="Shaft length (chuck to end)" symbol="L" unit="mm" value={p.L} min={60} max={1000} step={10} digits={0} onChange={(v) => set({ L: v, cutLength: Math.min(p.cutLength, v - 10), steadyZ: Math.min(p.steadyZ, v - 10) })} />
        <SliderField label="Turned length (from the free end)" unit="mm" value={p.cutLength} min={10} max={p.L - 4} step={5} digits={0} onChange={(v) => set({ cutLength: v })} />
        <SliderField label="Diameter tolerance (±)" unit="mm" value={p.tolerance} min={0.005} max={0.2} step={0.005} digits={3} onChange={(v) => set({ tolerance: v })} help="tolerance" />
        <H k="tolerance" />
        <div className="text-[10px] text-slate-500">Slenderness L/D = {(p.L / p.dT).toFixed(1)}</div>
      </Section>

      <Section title="Workholding">
        <SelectField<Workholding> label="Support" value={p.workholding}
          options={[{ value: 'chuck', label: 'Chuck only (cantilever)' }, { value: 'chuck-tailstock', label: 'Chuck + tailstock live centre' }, { value: 'centres', label: 'Between centres (driving dog)' }]}
          onChange={(w) => set({ workholding: w })} />
        <H k="workholding" />
        {p.workholding !== 'centres' && <Toggle label="Rigid chuck (idealised)" checked={p.chuckRigid} onChange={(v) => set({ chuckRigid: v })} />}
        {p.workholding !== 'centres' && !p.chuckRigid && (
          <>
            <SliderField label="Chuck radial stiffness" unit="N/µm" value={p.chuckKT / 1000} min={10} max={1000} step={10} digits={0} onChange={(v) => set({ chuckKT: v * 1000 })} />
            <SliderField label="Chuck tilt stiffness" unit="×10⁶ N·mm/rad" value={p.chuckKR / 1e6} min={5} max={1000} step={5} digits={0} onChange={(v) => set({ chuckKR: v * 1e6 })} />
          </>
        )}
        {p.workholding === 'centres' && <SliderField label="Head centre stiffness" unit="N/µm" value={p.headCentreK / 1000} min={5} max={200} step={1} digits={0} onChange={(v) => set({ headCentreK: v * 1000 })} />}
        {p.workholding !== 'chuck' && <SliderField label="Tail centre stiffness" unit="N/µm" value={p.tailK / 1000} min={2} max={200} step={1} digits={0} onChange={(v) => set({ tailK: v * 1000 })} />}
        <Toggle label="Steady rest" checked={p.steadyRest} onChange={(v) => set({ steadyRest: v })} />
        {p.steadyRest && (
          <>
            <SliderField label="Steady rest position (from chuck)" unit="mm" value={p.steadyZ} min={10} max={p.L - 10} step={5} digits={0} onChange={(v) => set({ steadyZ: v })} />
            <SliderField label="Steady rest stiffness" unit="N/µm" value={p.steadyK / 1000} min={2} max={200} step={1} digits={0} onChange={(v) => set({ steadyK: v * 1000 })} />
          </>
        )}
        <H k="steady" />
        <div className="text-[10px] text-slate-500">Support stiffness values are illustrative.</div>
      </Section>

      <Section title="Tool">
        <SliderField label="Entering angle" symbol="κr" unit="°" value={p.kappa} min={45} max={107} step={1} digits={0} onChange={(v) => set({ kappa: v })} />
        <H k="kappa" />
        <SliderField label="Nose radius" symbol="rε" unit="mm" value={p.noseR} min={0} max={2.4} step={0.1} digits={1} onChange={(v) => set({ noseR: v })} />
        <H k="noseR" />
        <SliderField label="Tool / turret radial stiffness" unit="N/µm" value={p.kTool / 1000} min={5} max={200} step={1} digits={0} onChange={(v) => set({ kTool: v * 1000 })} />
      </Section>

      <Section title="Cutting conditions">
        <SliderField label="Cutting speed" symbol="vc" unit="m/min" value={p.vc} min={20} max={500} step={5} digits={0} onChange={(v) => set({ vc: v })} />
        <H k="vc" />
        <SliderField label="Feed" symbol="f" unit="mm/rev" value={p.f} min={0.03} max={0.6} step={0.01} digits={2} onChange={(v) => set({ f: v })} />
        <H k="f" />
        <SelectField<FeedDir> label="Feed direction" value={p.feedDir} options={[{ value: 'toward-chuck', label: 'Toward the chuck (−Z)' }, { value: 'away-from-chuck', label: 'Away from the chuck (+Z)' }]} onChange={(d) => set({ feedDir: d })} />
        <H k="feedDir" />
        <SelectField<TurnStrategy> label="Strategy" value={p.strategy} options={[{ value: 'single', label: 'Single finishing pass' }, { value: 'spring-pass', label: 'Finishing pass + spring pass' }, { value: 'rough-finish', label: 'Roughing + finishing pass' }]} onChange={(s) => set({ strategy: s })} />
        {p.strategy === 'rough-finish' && <SliderField label="Finishing allowance (radial)" unit="mm" value={p.finishAllowance} min={0.05} max={Math.max(0.05, (p.d0 - p.dT) / 2 - 0.05)} step={0.05} onChange={(v) => set({ finishAllowance: v })} />}
        <H k="strategy" />
        <SliderField label="Spindle power available" unit="kW" value={p.machinePower} min={2} max={50} step={1} digits={0} onChange={(v) => set({ machinePower: v })} />
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
        <p className="text-[10px] text-slate-500">Fc uses Ktc/Kte; the force normal to the edge (split into Ff and Fp) uses Krc/Kre. Calibrate from 3-component dynamometer tests at two feeds.</p>
        <Toggle label="Calibrated from my own dynamometer tests" checked={p.coeffSource === 'calibrated'} onChange={(v) => set({ coeffSource: v ? 'calibrated' : 'user-defined' })} />
        <button className="text-[11px] text-cyan-400 hover:underline" onClick={() => set({ coeffs: { ...mat.coeffs }, coeffSource: 'illustrative' })}>Restore illustrative defaults for {mat.name}</button>
      </Section>
    </div>
  );
}
