import { useState } from 'react';
import { LabScene } from './scene/LabScene';
import { ParamPanel as ParamPanel1 } from './ui/ParamPanel';
import { ResultsPanel as ResultsPanel1 } from './ui/ResultsPanel';
import { BottomPanel as BottomPanel1 } from './ui/BottomPanel';
import { ParamPanel2 } from './ui/m2/ParamPanel2';
import { ResultsPanel2 } from './ui/m2/ResultsPanel2';
import { BottomPanel2 } from './ui/m2/BottomPanel2';
import { usePocket } from './state/pocketStore';
import { POCKET_ASSUMPTIONS } from './content/pocket';
import { ParamPanel3 } from './ui/m3/ParamPanel3';
import { ResultsPanel3 } from './ui/m3/ResultsPanel3';
import { BottomPanel3 } from './ui/m3/BottomPanel3';
import { useChatter } from './state/chatterStore';
import { CHATTER_ASSUMPTIONS } from './content/chatter';
import { ParamPanel4 } from './ui/m4/ParamPanel4';
import { ResultsPanel4 } from './ui/m4/ResultsPanel4';
import { BottomPanel4 } from './ui/m4/BottomPanel4';
import { useTurning } from './state/turningStore';
import { TURNING_ASSUMPTIONS } from './content/turning';
import { ParamPanel5 } from './ui/m5/ParamPanel5';
import { ResultsPanel5 } from './ui/m5/ResultsPanel5';
import { BottomPanel5 } from './ui/m5/BottomPanel5';
import { useFixture } from './state/fixtureStore';
import { FIXTURE_ASSUMPTIONS } from './content/fixture';
import { useEffect } from 'react';
import { StagePanel } from './ui/StagePanel';
import { Btn, Modal, Tag, Toggle } from './ui/controls';
import { useApp, type ModuleId, type Stage, type ViewState } from './state/store';

const pick = <T,>(m: number, a: T, b: T, c: T, d: T, e: T) => (m === 5 ? e : m === 4 ? d : m === 3 ? c : m === 2 ? b : a);
const ParamPanel = () => pick(useApp((s) => s.module), <ParamPanel1 />, <ParamPanel2 />, <ParamPanel3 />, <ParamPanel4 />, <ParamPanel5 />);
const ResultsPanel = () => pick(useApp((s) => s.module), <ResultsPanel1 />, <ResultsPanel2 />, <ResultsPanel3 />, <ResultsPanel4 />, <ResultsPanel5 />);
const BottomPanel = () => pick(useApp((s) => s.module), <BottomPanel1 />, <BottomPanel2 />, <BottomPanel3 />, <BottomPanel4 />, <BottomPanel5 />);
import { ASSUMPTIONS, MODULES, REFERENCES } from './content/learning';
import { FORCE_COLORS } from './scene/Forces';

function ViewToolbar() {
  const v = useApp((s) => s.view);
  const module = useApp((s) => s.module);
  const setView = useApp((s) => s.setView);
  const t = (k: keyof ViewState) => (val: boolean) => setView({ [k]: val } as Partial<ViewState>);
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 1024);
  return (
    <div className="pointer-events-auto absolute left-2 top-2 z-10 max-w-[230px] rounded-lg bg-slate-950/85 text-slate-200 shadow-lg ring-1 ring-slate-700 backdrop-blur">
      <button className="w-full px-2.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400" onClick={() => setOpen(!open)}>View {open ? '−' : '+'}</button>
      {open && (
        <div className="space-y-1.5 px-2.5 pb-2.5">
          <Toggle label="Force vectors Fx Fy Fz |F|" checked={v.showForces} onChange={t('showForces')} />
          <Toggle label="Per-tooth tangential / radial" checked={v.showToothForces} onChange={t('showToothForces')} />
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-slate-400">Forces on</span>
            {(['tool', 'workpiece'] as const).map((o) => (
              <button key={o} onClick={() => setView({ forceOn: o })} className={`rounded px-1.5 py-0.5 ${v.forceOn === o ? 'bg-cyan-700 text-white' : 'bg-slate-800 text-slate-300'}`}>{o}</button>
            ))}
          </div>
          <label className="block text-[11px] text-slate-400">Arrow scale {(v.forceScale * 100).toFixed(0)} mm / 100 N
            <input type="range" min={0.02} max={0.5} step={0.01} value={v.forceScale} onChange={(e) => setView({ forceScale: Number(e.target.value) })} className="w-full" />
          </label>
          <label className="block text-[11px] text-slate-400">
            Deformation ×{v.exaggeration} {v.exaggeration > 1 && <span className="text-amber-300">(exaggerated)</span>}
            <input type="range" min={1} max={module === 5 ? 2000 : 100} step={1} value={v.exaggeration} onChange={(e) => setView({ exaggeration: Number(e.target.value) })} className="w-full" />
          </label>
          {module === 1 && <Toggle label="Undeformed ghost" checked={v.showGhost} onChange={t('showGhost')} />}
          {module === 2 && <p className="text-[10px] leading-snug text-slate-500">Exaggeration applies to tool bending and to the wall offset. Wall colour = deviation from nominal.</p>}
          {module === 3 && <p className="text-[10px] leading-snug text-slate-500">Exaggeration applies to the simulated tool vibration. Machined-face colour = vibration amplitude (chatter marks).</p>}
          {module === 5 && <p className="text-[10px] leading-snug text-slate-500">Exaggeration applies to the rigid-body motion of the block on its contacts (µm-scale). Pads: green stick, amber slip, red lift-off. Slot floor colour = |error| / tolerance.</p>}
          {module === 4 && <p className="text-[10px] leading-snug text-slate-500">Lathe frame: Z = spindle axis, X toward the tool (rear turret), Y up. Exaggeration applies to the shaft centre-line deflection. Shaft colour = diameter deviation.</p>}
          <div className={`flex items-center gap-1 text-[11px] ${module !== 1 ? 'hidden' : ''}`}>
            <span className="text-slate-400">Colour</span>
            {([['displacement', 'displacement'], ['thickness', 'thickness dev.']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setView({ colorMode: k })} className={`rounded px-1.5 py-0.5 ${v.colorMode === k ? 'bg-cyan-700 text-white' : 'bg-slate-800 text-slate-300'}`}>{l}</button>
            ))}
          </div>
          <Toggle label="Section view at X = L/2" checked={v.section} onChange={t('section')} />
          <Toggle label="Exploded view" checked={v.exploded} onChange={t('exploded')} />
          <Toggle label="Machine structure" checked={v.showMachine} onChange={t('showMachine')} />
          <Toggle label="Dimensions & tolerance" checked={v.showDims} onChange={t('showDims')} />
          <div className="flex flex-wrap gap-1 pt-0.5">
            {(['iso', 'front', 'top', 'side', 'machine'] as const).map((c) => (
              <button key={c} onClick={() => setView({ camPreset: c, camNonce: v.camNonce + 1 })} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700">{c}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Legend() {
  const module = useApp((s) => s.module);
  if (module === 4)
    return (
      <div className="pointer-events-none absolute bottom-2 right-2 z-10 hidden rounded bg-slate-950/80 px-2 py-1 text-[10px] text-slate-300 ring-1 ring-slate-700 md:block">
        <span style={{ color: FORCE_COLORS.Fx }}>■ Fp (X, passive)</span> <span style={{ color: FORCE_COLORS.Fy }}>■ Fc (−Y, cutting)</span> <span style={{ color: FORCE_COLORS.Fz }}>■ Ff (Z, feed)</span>{' '}
        <span style={{ color: FORCE_COLORS.F }}>■ |F|</span> · dark stripe = spindle rotation
      </div>
    );
  return (
    <div className="pointer-events-none absolute bottom-2 right-2 z-10 hidden rounded md:block bg-slate-950/80 px-2 py-1 text-[10px] text-slate-300 ring-1 ring-slate-700">
      <span style={{ color: FORCE_COLORS.Fx }}>■ Fx</span> <span style={{ color: FORCE_COLORS.Fy }}>■ Fy</span> <span style={{ color: FORCE_COLORS.Fz }}>■ Fz</span>{' '}
      <span style={{ color: FORCE_COLORS.F }}>■ |F|</span> <span style={{ color: FORCE_COLORS.Ft }}>■ Ft</span> <span style={{ color: FORCE_COLORS.Fr }}>■ Fr</span>{' '}
      <span className="text-amber-400">amber flute = tooth 0 (φ)</span> · <span className="text-rose-400">■ contact zone</span>
    </div>
  );
}

function ModelModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Model, equations and sign convention" onClose={onClose}>
      <div className="space-y-3 text-[13px] leading-relaxed">
        <section>
          <h3 className="font-semibold text-cyan-300">Coordinate frame (one frame everywhere)</h3>
          <p>Machine frame: <b>X</b> along the wall length, <b>Y</b> normal to the wall faces (front face at −Y), <b>Z</b> spindle axis (up). The same frame is used for the 3D arrows, all graphs, CSV exports and the equations. Spindle turns clockwise seen from above (M03). Immersion angle φ is measured clockwise from the +y axis of the feed frame (x = feed direction, z = spindle axis, y = z × x).</p>
        </section>
        <section>
          <h3 className="font-semibold text-cyan-300">Mechanistic force model (per engaged tooth, per axial slice)</h3>
          <pre className="whitespace-pre-wrap rounded bg-slate-950 p-2 text-[12px] text-slate-200">{`h(φ) = fz · sin φ                         (uncut chip thickness)
Ft = Ktc·b·h + Kte·b     Fr = Krc·b·h + Kre·b     Fa = Kac·b·h + Kae·b
Fx = −Ft cos φ − Fr sin φ    Fy = Ft sin φ − Fr cos φ    Fz = Fa   (force ON THE TOOL, feed frame)
Up-milling:   φst = 0,        φex = arccos(1 − 2ae/D)
Down-milling: φst = π − arccos(1 − 2ae/D),   φex = π
Helix β: slice at height z lags the tip by ψ = 2 z tanβ / D  (β = 0 → straight flute, b = ap)
Global: FX = s·Fx, FY = s·Fy, FZ = Fz,  s = ±1 for feed toward ±X
Total force = Σ over engaged teeth and slices; force on workpiece = −(force on tool)`}</pre>
        </section>
        <section>
          <h3 className="font-semibold text-cyan-300">Kinematics and productivity</h3>
          <pre className="whitespace-pre-wrap rounded bg-slate-950 p-2 text-[12px] text-slate-200">{`vf = n · N · fz  (mm/min)      vc = π D n / 1000  (m/min)      f_tp = n N / 60  (Hz)
MRR = ae · ap · vf  (mm³/min)  — average MRR = removed volume / cutting time`}</pre>
        </section>
        <section>
          <h3 className="font-semibold text-cyan-300">Deflection</h3>
          <pre className="whitespace-pre-wrap rounded bg-slate-950 p-2 text-[12px] text-slate-200">{`Teaching approximation:  δ = F L³ / (3 E I),   I = b t³ / 12     (load at the free end of a uniform cantilever)
Simulator: Mindlin plate FE of the wall, thickness from the stock model, load applied at the current contact patch.
Tool: cantilever, d_eff = 0.8 D, load at the centre of the engaged flute length.
Surface error at height z:   e = (w_wall − δ_tool)·n,   solved with  e = C(z) · F(ae − e)
Generated surface:  y_s = y_target + δ_tool − w_wall   (wall springs back after the cut)`}</pre>
          <p className="text-slate-400">Validity: small elastic deflections, quasi-static (f_tp ≪ f₁), linear elastic material. Peak elastic deflection is not the final dimensional error.</p>
        </section>
        <section>
          <h3 className="font-semibold text-cyan-300">Module 2 — tool bending (stepped cantilever)</h3>
          <pre className="whitespace-pre-wrap rounded bg-slate-950 p-2 text-[12px] text-slate-200">{`s = distance from holder face (0 … L), sections: shank D | neck dn | flutes 0.8·D
M(s) = Σ P_j (a_j − s) for a_j > s          σ(s) = M(s)·c / I(s)
θ(s) = M0/kR + ∫₀ˢ M/EI ds                 δ(s) = V0/kT + ∫₀ˢ θ ds      (holder springs kT, kR)
Uniform tool, tip load:  δ = P L³ / (3 E I) ;  stepped:  δ = P[(L³ − L₂³)/(3EI₁) + L₂³/(3EI₂)]
Generated wall (rigid): y_s = y_target + g(z)·FY,  deviation d = −y_s (+ = proud);  e solved from  e = g(z)·F(ae − e)
Spring pass: repeat the level → engages only the residual.  Compensation: offset level by its predicted mean error.
Tool f₁ (Rayleigh, self-weight shape):  ω² = g Σ m δ / Σ m δ²`}</pre>
        </section>
        <section>
          <h3 className="font-semibold text-cyan-300">Module 3 — chatter (dynamic model)</h3>
          <pre className="whitespace-pre-wrap rounded bg-slate-950 p-2 text-[12px] text-slate-200">{`Tool modes (x = feed, y = normal):  m q̈ + c q̇ + k q = F,   G(f) = 1 / (k (1 − r² + 2iζr)),  r = f/fn
Regenerative chip:  h_j = [ fz sin φj + (d(t) − d(t−T))·n ] g(φj),   n = (sin φj, cos φj),   T = 60/(n_s N)
  (tooth out of cut when h ≤ 0; surface memory handles multiple regeneration)
ZOA lobes:  det(I + Λ[α0][Φ(iωc)]) = 0,  Λ = −(N/4π) a Kt (1 − e^(−iωcT))
  a_lim = −(2π ΛR/(N Kt))(1 + κ²),  κ = ΛI/ΛR,  ε = π − 2 atan κ,  T = (ε + 2kπ)/ωc,  n = 60/(N T)
Slotting, y-flexible only:  a_lim,min = 8 k ζ (1+ζ) / (N Krc)
Pockets:  f_tp ≈ fn/(k+1)   →   n ≈ 60 fn / (N (k+1))
Chatter test (time domain): once-per-tooth samples scatter > 10 % of motion rms; dominant frequency not a tooth harmonic`}</pre>
        </section>
        <section>
          <h3 className="font-semibold text-cyan-300">Module 4 — turning (lathe frame: Z spindle axis, X radial toward the tool)</h3>
          <pre className="whitespace-pre-wrap rounded bg-slate-950 p-2 text-[12px] text-slate-200">{`Equivalent edge (nose radius rε, entering angle κr) → κe;   h = f sin κe,   b = ap / sin κe   (b·h = ap·f)
Fc = Ktc·b·h + Kte·b          FN = Krc·b·h + Kre·b          Ff = FN sin κe          Fp = FN cos κe
On the tool: Fc → −Y,  Ff opposes the feed motion (±Z),  Fp → +X;  the workpiece receives the opposite forces
n = 1000 vc / (π D)     Pc = Fc · vc / 60 000 [kW]     M = Fc · D/2     Q = vc · ap · f [cm³/min]     Ra ≈ f² / (32 rε)
Shaft: beam FE with chuck (kT, kR), tailstock / centres (k), steady rest (k);  closed forms: PL³/3EI, PL³/48EI
Generated diameter:  d = d_target + 2e,   e = (C_shaft(z) + 1/k_tool) · Fp(ap − e)`}</pre>
        </section>
        <section>
          <h3 className="font-semibold text-cyan-300">Module 5 — fixture (rigid block on 3-2-1 point contacts)</h3>
          <pre className="whitespace-pre-wrap rounded bg-slate-950 p-2 text-[12px] text-slate-200">{`q = (δx, δy, δz, θx, θy, θz) about the centroid c;   u(p) = δ + θ × (p − c)
Contact i at p_i, normal n_i (direction it pushes the part):  J_i = [n_i, (p_i − c) × n_i]
K = Σ k_n J_iᵀJ_i + Σ k_t (two tangents)        K q = W_cut + W(clamps, slip, lift-off)
Normal force N_i = N0_i − k_n (u_i · n_i) ≥ 0 (else lift-off);  friction |T_i| ≤ μ N_i (else slip)
Contact stiffness:  k = k_ref (N0 / 1 kN)^(1/3)   (Hertz-type)
Clamping step: clamp preloads P + gravity on the locator springs → N0
Cut step: W_cut = −F_tool (Module 1 model, slot ae = D) at (x_tool, Y_slot, Z_top − ap/2)
Feature error (datum frame):  e = −u(cutting point)      (generated on the displaced part, springs back)
Clamping safety factor = 1 / (smallest clamp multiplier with μN ≥ |T| and N > 0 everywhere)
Fixture modes:  K φ = ω² M φ,  M = diag(m, m, m, Ixx, Iyy, Izz)`}</pre>
        </section>
      </div>
    </Modal>
  );
}

function AssumptionsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Assumptions, estimates and validation status" onClose={onClose}>
      <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
        <Tag kind="estimate">estimate</Tag><span className="text-slate-400">model output with illustrative/user coefficients</span>
        <Tag kind="validated">calibrated</Tag><span className="text-slate-400">coefficients you confirmed from your own tests (validation still requires comparison with measurements)</span>
        <Tag kind="assumption">assumption</Tag><span className="text-slate-400">modelling idealisation</span>
      </div>
      {[...ASSUMPTIONS, ...POCKET_ASSUMPTIONS, ...CHATTER_ASSUMPTIONS, ...TURNING_ASSUMPTIONS, ...FIXTURE_ASSUMPTIONS].map((g) => (
        <div key={g.title} className="mb-3">
          <h3 className="font-semibold text-cyan-300">{g.title}</h3>
          <ul className="ml-5 list-disc space-y-0.5 text-[13px] text-slate-300">{g.items.map((i) => <li key={i}>{i}</li>)}</ul>
        </div>
      ))}
      <h3 className="font-semibold text-cyan-300">Verification performed (automated tests)</h3>
      <p className="text-[13px] text-slate-300">Numerical mean forces match the closed-form average within 0.5 % (up/down milling, ae/D from 0.06 to 1, straight and 30° helix); plate FE under a tip line load lies between beam theory and the plate-strip limit and converges under mesh refinement; first natural frequency within 8 % of the cantilever beam value; stock volume balance exact; tooth-passing period, zero-force, engagement and sign-convention checks. Verification shows the equations are solved correctly — it does not validate the coefficients or the physical accuracy for your machine.</p>
    </Modal>
  );
}

function ReferencesModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Scientific references" onClose={onClose}>
      <p className="mb-3 text-[12px] text-slate-400">DOIs checked against the Scite citation index (22 Nov 2026): all resolved to the listed title and year with no retraction or editorial notice. The app uses these works as context and for model formulation; it does not reproduce their numerical results, and simulated numbers here must not be cited as findings of these papers.</p>
      <ol className="space-y-2.5">
        {REFERENCES.map((r) => (
          <li key={r.key} className="rounded bg-slate-950 p-2 ring-1 ring-slate-800">
            <div className="text-[13px]">{r.authors} ({r.year}). <i>{r.title}</i>. {r.venue}.{' '}
              {r.doi && <a className="text-cyan-400 hover:underline" href={`https://doi.org/${r.doi}`} target="_blank" rel="noreferrer">doi:{r.doi}</a>}
            </div>
            <div className="mt-1 flex items-start gap-2 text-[12px] text-slate-400"><Tag kind={r.category === 'model-source' ? 'assumption' : 'validated'}>{r.category === 'model-source' ? 'model source' : 'published work'}</Tag>{r.use}</div>
          </li>
        ))}
      </ol>
    </Modal>
  );
}

function ModulesModal({ onClose }: { onClose: () => void }) {
  const setModule = useApp((s) => s.setModule);
  const current = useApp((s) => s.module);
  return (
    <Modal title="Case-study modules" onClose={onClose}>
      <ul className="space-y-2">
        {MODULES.map((m) => (
          <li key={m.id} className={`flex items-start justify-between gap-3 rounded bg-slate-950 p-2 ring-1 ${current === m.id ? 'ring-cyan-600' : 'ring-slate-800'}`}>
            <div><div className="text-[13px] text-slate-100">Module {m.id}: {m.title}</div><div className="text-[12px] text-slate-400">{m.note}</div></div>
            <div className="flex flex-col items-end gap-1">
              <Tag kind={m.status === 'operational' ? 'ok' : 'assumption'}>{m.status === 'operational' ? 'operational' : 'planned — not available'}</Tag>
              {m.status === 'operational' && current !== m.id && <Btn kind="primary" onClick={() => { setModule(m.id as ModuleId); onClose(); }}>Open</Btn>}
            </div>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

export default function App() {
  const stage = useApp((s) => s.stage);
  const setStage = useApp((s) => s.setStage);
  const learn = useApp((s) => s.view.learn);
  const setView = useApp((s) => s.setView);
  const module = useApp((s) => s.module);
  const setModule = useApp((s) => s.setModule);
  const reset1 = useApp((s) => s.resetParams);
  const reset2 = usePocket((s) => s.resetParams);
  const reset3 = useChatter((s) => s.resetParams);
  const reset4 = useTurning((s) => s.resetParams);
  const reset5 = useFixture((s) => s.resetParams);
  const reset = pick(module, reset1, reset2, reset3, reset4, reset5);
  const err1 = useApp((s) => s.error);
  const err2 = usePocket((s) => s.error);
  const err3 = useChatter((s) => s.error);
  const err4 = useTurning((s) => s.error);
  const err5 = useFixture((s) => s.error);
  const error = pick(module, err1, err2, err3, err4, err5);
  useEffect(() => {
    if (module === 2) usePocket.getState().start();
    if (module === 3) useChatter.getState().start();
    if (module === 4) useTurning.getState().start();
    if (module === 5) useFixture.getState().start();
  }, [module]);
  useEffect(() => {
    try { const m = /#module-([12345])/.exec(location.hash); if (m) setModule(Number(m[1]) as ModuleId); } catch { /* sandboxed */ }
  }, [setModule]);
  const [modal, setModal] = useState<null | 'model' | 'assume' | 'refs' | 'modules'>(null);
  const [rightTab, setRightTab] = useState<'results' | 'guide'>('results');
  const [mobileTab, setMobileTab] = useState<'params' | 'results' | 'guide'>('results');
  const stages: { id: Stage; label: string }[] = [
    { id: 'observe', label: 'A · Observe' }, { id: 'experiment', label: 'B · Experiment' }, { id: 'solve', label: 'C · Solve' }, { id: 'validate', label: 'Validate' },
  ];
  const goStage = (s: Stage) => { setStage(s); setRightTab('guide'); setMobileTab('guide'); };

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-800 px-3 py-1.5">
        <div>
          <div className="text-sm font-bold tracking-tight"><span className="text-cyan-400">MachinaForce</span> 3D</div>
          <div className="text-[10px] text-slate-500">Understanding cutting forces in machining</div>
        </div>
        <select aria-label="Module" value={module} onChange={(e) => setModule(Number(e.target.value) as ModuleId)}
          className="rounded bg-slate-800 px-2 py-1 text-[11px] font-medium text-amber-200 ring-1 ring-slate-700">
          {MODULES.map((m) => <option key={m.id} value={m.id} disabled={m.status !== 'operational'}>Module {m.id}: {m.title}{m.status !== 'operational' ? ' (planned)' : ''}</option>)}
        </select>
        <nav className="flex gap-1">
          {stages.map((s) => (
            <button key={s.id} onClick={() => goStage(s.id)} className={`rounded px-2 py-1 text-[11px] font-medium ${stage === s.id ? 'bg-cyan-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{s.label}</button>
          ))}
        </nav>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <label className="flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[11px] text-cyan-200 ring-1 ring-slate-700">
            <input type="checkbox" checked={learn} onChange={(e) => setView({ learn: e.target.checked })} className="accent-cyan-400" /> Learning overlay
          </label>
          <Btn kind="ghost" onClick={() => setModal('modules')}>Modules</Btn>
          <Btn kind="ghost" onClick={() => setModal('model')}>Equations</Btn>
          <Btn kind="ghost" onClick={() => setModal('assume')}>Assumptions</Btn>
          <Btn kind="ghost" onClick={() => setModal('refs')}>References</Btn>
          <Btn onClick={reset} title="Restore the baseline experiment">Reset</Btn>
        </div>
      </header>
      {error && <div className="bg-rose-900/60 px-3 py-1 text-xs text-rose-100">Simulation error: {error}</div>}

      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[290px_minmax(0,1fr)_330px]">
        <aside className="hidden min-h-0 overflow-y-auto border-r border-slate-800 scroll-thin lg:block">
          <ParamPanel />
        </aside>
        <main className="flex min-h-0 flex-col">
          <div className="relative h-[52vh] min-h-[280px] lg:h-auto lg:flex-[3]">
            <LabScene />
            <ViewToolbar />
            <Legend />
          </div>
          <div className="h-[300px] border-t border-slate-800 lg:h-auto lg:min-h-[230px] lg:flex-[2]">
            <BottomPanel />
          </div>
          {/* mobile / tablet panels */}
          <div className="lg:hidden">
            <div className="flex border-y border-slate-800">
              {(['params', 'results', 'guide'] as const).map((t) => (
                <button key={t} onClick={() => setMobileTab(t)} className={`flex-1 py-2 text-xs ${mobileTab === t ? 'bg-slate-800 text-cyan-300' : 'text-slate-400'}`}>
                  {t === 'params' ? 'Parameters' : t === 'results' ? 'Results' : 'Lab guide'}
                </button>
              ))}
            </div>
            {mobileTab === 'params' && <ParamPanel />}
            {mobileTab === 'results' && <ResultsPanel />}
            {mobileTab === 'guide' && <StagePanel />}
          </div>
        </main>
        <aside className="hidden min-h-0 flex-col border-l border-slate-800 lg:flex">
          <div className="flex border-b border-slate-800">
            {(['results', 'guide'] as const).map((t) => (
              <button key={t} onClick={() => setRightTab(t)} className={`flex-1 py-1.5 text-[11px] font-medium ${rightTab === t ? 'bg-slate-800 text-cyan-300' : 'text-slate-400 hover:text-slate-200'}`}>
                {t === 'results' ? 'Results & indicators' : 'Lab guide & assessment'}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">{rightTab === 'results' ? <ResultsPanel /> : <StagePanel />}</div>
        </aside>
      </div>

      {modal === 'model' && <ModelModal onClose={() => setModal(null)} />}
      {modal === 'assume' && <AssumptionsModal onClose={() => setModal(null)} />}
      {modal === 'refs' && <ReferencesModal onClose={() => setModal(null)} />}
      {modal === 'modules' && <ModulesModal onClose={() => setModal(null)} />}
    </div>
  );
}
