import { useApp } from '../../state/store';
import { useToolWear } from '../../state/toolWearStore';
import { MATERIALS, type MaterialId, type CuttingCoefficients } from '../../physics/materials';
import { defaultWear, ISO_VB_MAX, ISO_VB_UNIFORM, spindleSpeed, type WearCoefficients } from '../../physics/toolWear';
import type { MillingMode } from '../../physics/millingForce';
import { TOOLWEAR_HELP } from '../../content/toolWear';
import { Btn, Section, SelectField, SliderField, Tag, Toggle } from '../controls';

function H({ k }: { k: string }) {
  const learn = useApp((s) => s.view.learn);
  if (!learn || !TOOLWEAR_HELP[k]) return null;
  return <p className="mt-1 rounded bg-cyan-950/40 px-2 py-1 text-[11px] leading-snug text-cyan-100/90 ring-1 ring-cyan-900">{TOOLWEAR_HELP[k]}</p>;
}
const COEFF: (keyof CuttingCoefficients)[] = ['Ktc', 'Krc', 'Kac', 'Kte', 'Kre', 'Kae'];
const WEAR: { k: keyof WearCoefficients; label: string }[] = [{ k: 'ate', label: 'ate (tangential)' }, { k: 'are', label: 'are (radial)' }, { k: 'aae', label: 'aae (axial)' }];

export function ParamPanel6() {
  const p = useToolWear((s) => s.params);
  const set = useToolWear((s) => s.setParams);
  const resetFresh = useToolWear((s) => s.resetFresh);
  const mat = MATERIALS[p.materialId];
  const srcTag = p.coeffSource === 'calibrated' ? 'validated' : p.coeffSource === 'user-defined' ? 'assumption' : 'estimate';
  const wTag = p.wearSource === 'calibrated' ? 'validated' : p.wearSource === 'user-defined' ? 'assumption' : 'estimate';
  return (
    <div className="text-slate-200">
      <Section title="Tool condition">
        <SliderField label="Flank wear" symbol="VB" unit="mm" value={p.VB} min={0} max={0.5} step={0.01} digits={2} onChange={(v) => set({ VB: v })} />
        <H k="VB" />
        <SliderField label="Replacement criterion" symbol="VBc" unit="mm" value={p.VBcrit} min={0.05} max={0.5} step={0.01} digits={2} onChange={(v) => set({ VBcrit: v })} />
        <div className="text-[10px] text-slate-500">ISO 8688-2 tool-life tests commonly use VB = {ISO_VB_UNIFORM} mm (uniform) or VBmax = {ISO_VB_MAX} mm (localized).</div>
        <H k="VBcrit" />
        <Btn onClick={resetFresh} title="VB = 0, playback to t = 0">↺ Reset to fresh tool</Btn>
        <Toggle label="Wear-growth mode (illustrative rate model)" checked={p.growthMode} onChange={(v) => set({ growthMode: v })} />
        <H k="growth" />
        {p.growthMode && (
          <>
            <p className="text-[10px] text-amber-300/90">VB now follows dVB/dt = A·(vc/vref)^p·(fz/fref)^q along the playback timeline; the manual VB slider is ignored.</p>
            <SliderField label="Initial wear" symbol="VB0" unit="mm" value={p.VB0} min={0} max={0.3} step={0.01} digits={2} onChange={(v) => set({ VB0: v })} />
            <SliderField label="Rate at reference" symbol="A" unit="mm/min" value={p.A} min={0.001} max={0.1} step={0.001} digits={3} onChange={(v) => set({ A: v })} />
            <SliderField label="Reference speed" symbol="vref" unit="m/min" value={p.vref} min={10} max={600} step={5} digits={0} onChange={(v) => set({ vref: v })} />
            <SliderField label="Reference feed" symbol="fref" unit="mm" value={p.fref} min={0.01} max={0.3} step={0.005} digits={3} onChange={(v) => set({ fref: v })} />
            <SliderField label="Speed exponent" symbol="p" value={p.p} min={0} max={6} step={0.1} digits={1} onChange={(v) => set({ p: v })} />
            <SliderField label="Feed exponent" symbol="q" value={p.q} min={0} max={3} step={0.1} digits={1} onChange={(v) => set({ q: v })} />
          </>
        )}
      </Section>

      <Section title="Cutting conditions">
        <SelectField<MaterialId> label="Workpiece material" value={p.materialId} options={Object.values(MATERIALS).map((m) => ({ value: m.id, label: m.name }))}
          onChange={(id) => set({ materialId: id, coeffs: { ...MATERIALS[id].coeffs }, coeffSource: 'illustrative', wear: defaultWear(id), wearSource: 'illustrative', vref: Math.round((MATERIALS[id].vcRange[0] + MATERIALS[id].vcRange[1]) / 2) })} />
        <SliderField label="Cutting speed" symbol="vc" unit="m/min" value={p.vc} min={10} max={600} step={5} digits={0} onChange={(v) => set({ vc: v })} />
        <div className="text-[10px] text-slate-500">n = {spindleSpeed(p).toFixed(0)} rpm · indicative range for {mat.name}: {mat.vcRange[0]}–{mat.vcRange[1]} m/min</div>
        <H k="vc" />
        <SliderField label="Feed per tooth" symbol="fz" unit="mm" value={p.fz} min={0.01} max={0.25} step={0.005} digits={3} onChange={(v) => set({ fz: v })} />
        <H k="fz" />
        <SliderField label="Axial depth" symbol="ap" unit="mm" value={p.ap} min={0.5} max={30} step={0.5} digits={1} onChange={(v) => set({ ap: v })} />
        <H k="ap" />
        <SliderField label="Radial engagement" symbol="ae" unit="mm" value={p.ae} min={0.1} max={p.D} step={0.1} digits={1} onChange={(v) => set({ ae: v })} />
        <H k="ae" />
        <SliderField label="Cutter diameter" symbol="D" unit="mm" value={p.D} min={4} max={25} step={1} digits={0} onChange={(v) => set({ D: v, ae: Math.min(p.ae, v) })} />
        <SliderField label="Number of flutes" symbol="N" value={p.N} min={2} max={6} step={1} digits={0} onChange={(v) => set({ N: Math.round(v) })} />
        <SelectField<MillingMode> label="Milling mode" value={p.mode} options={[{ value: 'down', label: 'Down-milling (climb)' }, { value: 'up', label: 'Up-milling (conventional)' }]} onChange={(m) => set({ mode: m })} />
      </Section>

      <Section title="Production planning">
        <SliderField label="Cutting length per part" unit="mm" value={p.partLength} min={50} max={5000} step={50} digits={0} onChange={(v) => set({ partLength: v })} />
        <SliderField label="Batch size" unit="parts" value={p.batch} min={1} max={500} step={1} digits={0} onChange={(v) => set({ batch: Math.round(v) })} />
        <SliderField label="Tool change time" unit="min" value={p.toolChange} min={0.5} max={30} step={0.5} digits={1} onChange={(v) => set({ toolChange: v })} />
        <SliderField label="Spindle power available" unit="kW" value={p.spindlePower} min={1} max={40} step={0.5} digits={1} onChange={(v) => set({ spindlePower: v })} />
        <H k="production" />
      </Section>

      <Section title="Wear coefficients" defaultOpen={false} right={<Tag kind={wTag}>{p.wearSource}</Tag>}>
        <div className="grid grid-cols-3 gap-1.5">
          {WEAR.map(({ k, label }) => (
            <label key={k} className="text-[10px] text-slate-400">{label}
              <input type="number" step="any" min={0} value={p.wear[k]}
                onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v >= 0) set({ wear: { ...p.wear, [k]: v }, wearSource: p.wearSource === 'calibrated' ? 'calibrated' : 'user-defined' }); }}
                className="mt-0.5 w-full rounded bg-slate-800 px-1 py-0.5 text-right text-xs text-slate-100 tabular ring-1 ring-slate-700" />
            </label>
          ))}
        </div>
        <p className="text-[10px] text-slate-500">N/mm² (edge force per mm of edge, per mm of VB). K·e(VB) = K·e0 + a·e·VB. Fit them from forces measured at several VB values (Validate).</p>
        <H k="wear" />
        <Toggle label="Fitted to my own force-vs-VB measurements" checked={p.wearSource === 'calibrated'} onChange={(v) => set({ wearSource: v ? 'calibrated' : 'user-defined' })} />
        <button className="text-[11px] text-cyan-400 hover:underline" onClick={() => set({ wear: defaultWear(p.materialId), wearSource: 'illustrative' })}>Restore illustrative wear coefficients</button>
      </Section>

      <Section title="Cutting-force coefficients (fresh tool)" defaultOpen={false} right={<Tag kind={srcTag}>{p.coeffSource}</Tag>}>
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
