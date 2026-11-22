import { useApp } from '../../state/store';
import { useChatter } from '../../state/chatterStore';
import { usePocket } from '../../state/pocketStore';
import { MATERIALS, type MaterialId, type CuttingCoefficients } from '../../physics/materials';
import type { Mode } from '../../physics/chatter';
import { CHATTER_HELP } from '../../content/chatter';
import { Btn, Section, SelectField, SliderField, Tag, Toggle } from '../controls';

function H({ k }: { k: string }) {
  const learn = useApp((s) => s.view.learn);
  if (!learn || !CHATTER_HELP[k]) return null;
  return <p className="mt-1 rounded bg-cyan-950/40 px-2 py-1 text-[11px] leading-snug text-cyan-100/90 ring-1 ring-cyan-900">{CHATTER_HELP[k]}</p>;
}

function ModeEditor({ label, m, onChange }: { label: string; m: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="space-y-2 rounded bg-slate-900/60 p-2 ring-1 ring-slate-800">
      <div className="text-[11px] font-semibold text-slate-300">{label}</div>
      <SliderField label="Natural frequency" symbol="fn" unit="Hz" value={m.fn} min={100} max={3000} step={5} digits={0} onChange={(v) => onChange({ ...m, fn: v })} />
      <SliderField label="Damping ratio" symbol="ζ" unit="–" value={m.zeta} min={0.005} max={0.15} step={0.005} digits={3} onChange={(v) => onChange({ ...m, zeta: v })} />
      <SliderField label="Static stiffness" symbol="k" unit="N/µm" value={m.k / 1000} min={0.5} max={100} step={0.1} digits={1} onChange={(v) => onChange({ ...m, k: v * 1000 })} />
    </div>
  );
}

const COEFF: (keyof CuttingCoefficients)[] = ['Ktc', 'Krc', 'Kac', 'Kte', 'Kre', 'Kae'];

export function ParamPanel3() {
  const p = useChatter((s) => s.params);
  const set = useChatter((s) => s.setParams);
  const m2 = usePocket((s) => s.result);
  const mat = MATERIALS[p.materialId];
  const srcTag = p.coeffSource === 'calibrated' ? 'validated' : p.coeffSource === 'user-defined' ? 'assumption' : 'estimate';
  const importFromM2 = () => {
    if (!m2) return;
    const md: Mode = { fn: Math.round(m2.summary.toolF1), zeta: 0.03, k: Math.round(m2.summary.toolTipStiffness) };
    set({ modeX: md, modeY: { ...md }, symmetric: true, D: m2.params.D, N: m2.params.N });
  };
  return (
    <div className="text-slate-200">
      <Section title="Tool dynamics (modal parameters)">
        <Toggle label="Symmetric tool (same mode in x and y)" checked={p.symmetric} onChange={(v) => set({ symmetric: v })} />
        <ModeEditor label={p.symmetric ? 'Mode x = y' : 'Mode x (feed direction)'} m={p.modeX} onChange={(m) => set({ modeX: m })} />
        {!p.symmetric && <ModeEditor label="Mode y (normal direction)" m={p.modeY} onChange={(m) => set({ modeY: m })} />}
        <H k="modal" /><H k="fn" /><H k="zeta" /><H k="k" />
        <div className="flex flex-wrap items-center gap-1.5">
          <Btn onClick={importFromM2} disabled={!m2} title={m2 ? 'Use the Module 2 tool tip stiffness and first bending frequency (ζ assumed 0.03)' : 'Open Module 2 once to compute a tool'}>Import tool from Module 2</Btn>
          <span className="text-[10px] text-slate-500">or fit from a tap test in Validate</span>
        </div>
        <div className="text-[10px] text-slate-500">Default values are illustrative of a Ø16 mm end mill in a stiff holder; measure your own tool for real predictions.</div>
      </Section>

      <Section title="Cutting conditions">
        <SliderField label="Spindle speed" symbol="n" unit="rpm" value={p.rpm} min={p.rpmMin} max={p.rpmMax} step={50} digits={0} onChange={(v) => set({ rpm: v })} />
        <H k="rpm" />
        <SliderField label="Axial depth" symbol="ap" unit="mm" value={p.ap} min={0.05} max={15} step={0.05} digits={2} onChange={(v) => set({ ap: v })} />
        <H k="ap" />
        <SliderField label="Radial depth" symbol="ae" unit="mm" value={p.ae} min={0.5} max={p.D} step={0.5} digits={1} onChange={(v) => set({ ae: v })} />
        <H k="ae" />
        <SliderField label="Feed per tooth" symbol="fz" unit="mm/tooth" value={p.fz} min={0.01} max={0.25} step={0.005} digits={3} onChange={(v) => set({ fz: v })} help="fz" />
        <SelectField label="Milling mode" value={p.mode} options={[{ value: 'down', label: 'Down-milling (climb)' }, { value: 'up', label: 'Up-milling (conventional)' }]} onChange={(m) => set({ mode: m })} help="mode" />
      </Section>

      <Section title="Tool and material">
        <SliderField label="Tool diameter" symbol="D" unit="mm" value={p.D} min={4} max={32} step={1} digits={0} onChange={(v) => set({ D: v, ae: Math.min(p.ae, v) })} />
        <SliderField label="Number of teeth" symbol="N" value={p.N} min={1} max={8} step={1} digits={0} onChange={(v) => set({ N: v })} />
        <SelectField<MaterialId> label="Material" value={p.materialId} options={Object.values(MATERIALS).map((m) => ({ value: m.id, label: m.name }))}
          onChange={(id) => set({ materialId: id, coeffs: { ...MATERIALS[id].coeffs }, coeffSource: 'illustrative' })} />
      </Section>

      <Section title="Lobe diagram range" defaultOpen={false}>
        <SliderField label="Minimum speed" unit="rpm" value={p.rpmMin} min={500} max={p.rpmMax - 1000} step={500} digits={0} onChange={(v) => set({ rpmMin: v, rpm: Math.max(p.rpm, v) })} />
        <SliderField label="Maximum speed" unit="rpm" value={p.rpmMax} min={p.rpmMin + 1000} max={40000} step={500} digits={0} onChange={(v) => set({ rpmMax: v, rpm: Math.min(p.rpm, v) })} />
        <SliderField label="Simulated tooth periods" value={p.simTeeth} min={120} max={600} step={20} digits={0} onChange={(v) => set({ simTeeth: v })} />
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
        <p className="text-[10px] text-slate-500">Lobe heights scale with 1/Ktc; Kr = Krc/Ktc sets the force direction. Edge coefficients affect forced vibration, not stability.</p>
        <Toggle label="Calibrated from my own dynamometer tests" checked={p.coeffSource === 'calibrated'} onChange={(v) => set({ coeffSource: v ? 'calibrated' : 'user-defined' })} />
        <button className="text-[11px] text-cyan-400 hover:underline" onClick={() => set({ coeffs: { ...mat.coeffs }, coeffSource: 'illustrative' })}>Restore illustrative defaults for {mat.name}</button>
      </Section>
    </div>
  );
}
