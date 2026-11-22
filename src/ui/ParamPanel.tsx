import { useApp } from '../state/store';
import { MATERIALS, type MaterialId, type CuttingCoefficients } from '../physics/materials';
import { STRATEGY_INFO, hasRoughing, type Strategy } from '../physics/process';
import { Help, Section, SelectField, SliderField, Tag, Toggle } from './controls';

const COEFF_FIELDS: { k: keyof CuttingCoefficients; label: string; unit: string }[] = [
  { k: 'Ktc', label: 'Ktc', unit: 'N/mm²' }, { k: 'Krc', label: 'Krc', unit: 'N/mm²' }, { k: 'Kac', label: 'Kac', unit: 'N/mm²' },
  { k: 'Kte', label: 'Kte', unit: 'N/mm' }, { k: 'Kre', label: 'Kre', unit: 'N/mm' }, { k: 'Kae', label: 'Kae', unit: 'N/mm' },
];

export function ParamPanel() {
  const p = useApp((s) => s.params);
  const set = useApp((s) => s.setParams);
  const mat = MATERIALS[p.materialId];
  const srcTag = p.coeffSource === 'calibrated' ? 'validated' : p.coeffSource === 'user-defined' ? 'assumption' : 'estimate';

  return (
    <div className="text-slate-200">
      <Section title="Workpiece">
        <SelectField<MaterialId>
          label="Material"
          value={p.materialId}
          options={Object.values(MATERIALS).map((m) => ({ value: m.id, label: m.name }))}
          onChange={(id) => set({ materialId: id, coeffs: { ...MATERIALS[id].coeffs }, coeffSource: 'illustrative' })}
          help="materialId"
        />
        <div className="text-[10px] text-slate-500">E = {(mat.E / 1000).toFixed(1)} GPa · ν = {mat.nu} · ρ = {mat.rho} kg/m³ (nominal handbook values)</div>
        <SliderField label="Final wall thickness" symbol="t" unit="mm" value={p.wallThickness} min={1} max={5} step={0.1} onChange={(v) => set({ wallThickness: v })} help="wallThickness" />
        <SliderField label="Wall height" symbol="H" unit="mm" value={p.wallHeight} min={15} max={60} step={1} digits={0} onChange={(v) => set({ wallHeight: v })} help="wallHeight" />
        <SliderField label="Wall length" symbol="L" unit="mm" value={p.wallLength} min={30} max={100} step={2} digits={0} onChange={(v) => set({ wallLength: v })} />
        <SliderField label="Thickness tolerance (±)" unit="mm" value={p.tolerance} min={0.01} max={0.3} step={0.01} onChange={(v) => set({ tolerance: v })} help="tolerance" />
      </Section>

      <Section title="Cutting tool">
        <SliderField label="Diameter" symbol="D" unit="mm" value={p.D} min={4} max={20} step={1} digits={0} onChange={(v) => set({ D: v })} help="D" />
        <SliderField label="Number of teeth" symbol="N" value={p.N} min={1} max={6} step={1} digits={0} onChange={(v) => set({ N: v })} help="N" />
        <SliderField label="Helix angle" symbol="β" unit="°" value={p.helixDeg} min={0} max={50} step={5} digits={0} onChange={(v) => set({ helixDeg: v })} help="helixDeg" />
        <SliderField label="Tool overhang" symbol="Lt" unit="mm" value={p.overhang} min={20} max={90} step={1} digits={0} onChange={(v) => set({ overhang: v })} help="overhang" />
        <div className="text-[10px] text-slate-500">Carbide, E = 600 GPa, effective flute diameter 0.8·D, rigid holder (assumption)</div>
      </Section>

      <Section title="Cutting conditions">
        <SliderField label="Spindle speed" symbol="n" unit="rpm" value={p.rpm} min={500} max={30000} step={100} digits={0} onChange={(v) => set({ rpm: v })} help="rpm" />
        <SliderField label="Feed per tooth" symbol="fz" unit="mm/tooth" value={p.fz} min={0.005} max={0.25} step={0.005} digits={3} onChange={(v) => set({ fz: v })} help="fz" />
        <SliderField label="Axial depth per level" symbol="ap" unit="mm" value={p.ap} min={0.5} max={Math.min(20, p.wallHeight)} step={0.5} digits={1} onChange={(v) => set({ ap: v })} help="ap" />
        <SliderField label="Finishing radial depth" symbol="ae" unit="mm/side" value={p.aeFinish} min={0.05} max={Math.min(4, p.D)} step={0.05} onChange={(v) => set({ aeFinish: v })} help="aeFinish" />
        {hasRoughing(p.strategy) && (
          <SliderField label="Roughing radial depth" symbol="ae,r" unit="mm/side" value={p.aeRough} min={0.2} max={Math.min(6, p.D)} step={0.1} digits={1} onChange={(v) => set({ aeRough: v })} help="aeRough" />
        )}
        <SelectField
          label="Milling mode"
          value={p.mode}
          options={[{ value: 'down', label: 'Down-milling (climb)' }, { value: 'up', label: 'Up-milling (conventional)' }]}
          onChange={(m) => set({ mode: m })}
          help="mode"
        />
      </Section>

      <Section title="Toolpath strategy (constant-Z)">
        <SelectField<Strategy>
          label="Pass sequence"
          value={p.strategy}
          options={(Object.keys(STRATEGY_INFO) as Strategy[]).map((k) => ({ value: k, label: STRATEGY_INFO[k].name }))}
          onChange={(s) => set({ strategy: s })}
          help="strategy"
        />
        <p className="text-[11px] leading-snug text-slate-400">{STRATEGY_INFO[p.strategy].text}</p>
      </Section>

      <Section title="Workholding" defaultOpen={false}>
        <Toggle label="Rigid base clamp (idealised)" checked={p.clampRigid} onChange={(v) => set({ clampRigid: v })} />
        {!p.clampRigid && (
          <SliderField label="Clamp rotational stiffness" unit="kN·mm/rad/mm" value={p.clampKRot / 1000} min={5} max={2000} step={5} digits={0} onChange={(v) => set({ clampKRot: v * 1000 })} />
        )}
        <Help k="clamp" />
      </Section>

      <Section title="Cutting-force coefficients" defaultOpen={false} right={<Tag kind={srcTag}>{p.coeffSource}</Tag>}>
        <div className="grid grid-cols-3 gap-1.5">
          {COEFF_FIELDS.map((f) => (
            <label key={f.k} className="text-[10px] text-slate-400">
              {f.label} <span className="text-slate-600">{f.unit}</span>
              <input
                type="number" step="any" value={p.coeffs[f.k]}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isFinite(v) || v < 0) return;
                  set({ coeffs: { ...p.coeffs, [f.k]: v }, coeffSource: p.coeffSource === 'calibrated' ? 'calibrated' : 'user-defined' });
                }}
                className="mt-0.5 w-full rounded bg-slate-800 px-1 py-0.5 text-right text-xs text-slate-100 tabular ring-1 ring-slate-700"
              />
            </label>
          ))}
        </div>
        <Toggle
          label="These values are calibrated from my own dynamometer tests"
          checked={p.coeffSource === 'calibrated'}
          onChange={(v) => set({ coeffSource: v ? 'calibrated' : 'user-defined' })}
        />
        <button className="text-[11px] text-cyan-400 hover:underline" onClick={() => set({ coeffs: { ...mat.coeffs }, coeffSource: 'illustrative' })}>
          Restore illustrative defaults for {mat.name}
        </button>
        <p className="text-[10px] leading-snug text-slate-500">
          Illustrative = order-of-magnitude values shipped with the app. User-defined = typed in, unverified. Calibrated = you confirm they come from your own force measurements (e.g. slot-milling regression of mean force vs fz).
        </p>
        <Help k="coeffs" />
      </Section>

      <Section title="Numerical settings" defaultOpen={false}>
        <SelectField
          label="Wall FE mesh (X × Z elements)"
          value={`${p.meshNx}x${p.meshNz}`}
          options={[{ value: '10x8', label: '10 × 8 (fast, coarse)' }, { value: '16x12', label: '16 × 12 (default)' }, { value: '24x20', label: '24 × 20 (fine, slower)' }]}
          onChange={(v) => { const [a, b] = v.split('x').map(Number); set({ meshNx: a, meshNz: b }); }}
        />
        <SliderField label="Toolpath station spacing" unit="mm" value={p.stationStep} min={1} max={5} step={0.5} digits={1} onChange={(v) => set({ stationStep: v })} />
      </Section>
    </div>
  );
}
