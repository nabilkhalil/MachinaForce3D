import { useApp, type Stage } from '../../state/store';
import { usePocket } from '../../state/pocketStore';
import { POCKET_PROBLEM, POCKET_QUESTIONS } from '../../content/pocket';
import { MATERIALS } from '../../physics/materials';
import { POCKET_STRATEGY_INFO, type PocketResult } from '../../physics/pocketProcess';
import { Btn, Tag } from '../controls';
import { Question } from '../StagePanel';
import { ValidationPanel } from '../ValidationPanel';
import { download } from '../../lib/csv';
import { pocketTrialsCSV } from './BottomPanel2';

const KEYWORDS = ['stiff', 'deflect', 'bend', 'force', 'overhang', 'holder', 'spring', 'compensat', 'engag', 'taper', 'neck'];

export function evaluatePocket(r: PocketResult | null) {
  if (!r) return null;
  const p = r.params, s = r.summary, pr = POCKET_PROBLEM;
  const setupOK =
    p.materialId === pr.material && p.pocketDepth === pr.pocketDepth && p.wallLength === pr.wallLength && p.D === pr.D && p.N === pr.N &&
    Math.abs(p.tolerance - pr.tolerance) < 1e-9 && p.coeffSource === 'illustrative' && !p.holderRigid &&
    p.holderKT === pr.holder.kT && p.holderKR === pr.holder.kR && p.overhang >= pr.overhangRange[0] && p.overhang <= pr.overhangRange[1] &&
    !s.warnings.some((w) => w.includes('holder would hit') || w.includes('exceeds the flute length') || w.includes('Neck diameter'));
  const maxDev = Math.max(Math.abs(s.devMin), Math.abs(s.devMax));
  return { setupOK, tolOK: maxDev <= pr.tolerance, mrrOK: s.averageMRR >= pr.minMRR, stressOK: s.stressRatio < pr.maxStressRatio, maxDev, mrr: s.averageMRR };
}

export function scorePocket() {
  const st = useApp.getState(), ps = usePocket.getState();
  const mcq = POCKET_QUESTIONS.reduce((a, q) => a + (st.answers[q.id] !== undefined && Number(st.answers[q.id]) === q.correct ? 1 : 0), 0);
  const ev = evaluatePocket(ps.result);
  const words = ps.solveNote.trim().split(/\s+/).filter(Boolean).length;
  const kw = KEYWORDS.filter((k) => ps.solveNote.toLowerCase().includes(k)).length;
  const explain = words >= 30 && kw >= 2 ? 1 : 0;
  const solve = ev && ev.setupOK && ev.stressOK ? (ev.tolOK ? 2 : 0) + (ev.mrrOK ? 1 : 0) : 0;
  return { mcq, mcqMax: POCKET_QUESTIONS.length, solve, solveMax: 3, explain, total: mcq + solve + explain, max: POCKET_QUESTIONS.length + 4, words, kw };
}

function Solve2() {
  const result = usePocket((s) => s.result);
  const note = usePocket((s) => s.solveNote);
  const setNote = usePocket((s) => s.setSolveNote);
  const setParams = usePocket((s) => s.setParams);
  const ev = evaluatePocket(result);
  const pr = POCKET_PROBLEM;
  const sc = scorePocket();
  const load = () => setParams({
    materialId: pr.material, coeffs: { ...MATERIALS[pr.material].coeffs }, coeffSource: 'illustrative', pocketDepth: pr.pocketDepth, wallLength: pr.wallLength,
    D: pr.D, N: pr.N, tolerance: pr.tolerance, holderKT: pr.holder.kT, holderKR: pr.holder.kR, ...pr.baseline,
  });
  return (
    <div className="space-y-2">
      <div className="rounded bg-slate-900 p-2 ring-1 ring-slate-800">
        <h4 className="text-xs font-semibold text-amber-200">{pr.title}</h4>
        <p className="mt-1 text-[11px] leading-snug text-slate-300">{pr.brief}</p>
        <div className="mt-2"><Btn onClick={load}>Load the current (failing) programme</Btn></div>
        <p className="mt-1 text-[10px] text-slate-500">Fixed: material, pocket, tool D and N, holder stiffness, tolerance, illustrative coefficients. Free: strategy, mode, n, fz, ap, ae, overhang ({pr.overhangRange.join('–')} mm), flute/neck geometry, helix.</p>
      </div>
      {ev && (
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          <div className="rounded bg-slate-900 p-1.5 ring-1 ring-slate-800">Setup & feasibility<br /><Tag kind={ev.setupOK ? 'ok' : 'fail'}>{ev.setupOK ? 'matches brief' : 'fixed item changed / infeasible'}</Tag></div>
          <div className="rounded bg-slate-900 p-1.5 ring-1 ring-slate-800">Tolerance<br /><Tag kind={ev.tolOK ? 'ok' : 'fail'}>{(ev.maxDev * 1000).toFixed(0)} µm / {pr.tolerance * 1000}</Tag></div>
          <div className="rounded bg-slate-900 p-1.5 ring-1 ring-slate-800">Productivity<br /><Tag kind={ev.mrrOK ? 'ok' : 'fail'}>{ev.mrr.toFixed(0)} / {pr.minMRR}</Tag></div>
          <div className="rounded bg-slate-900 p-1.5 ring-1 ring-slate-800">Tool stress<br /><Tag kind={ev.stressOK ? 'ok' : 'fail'}>{ev.stressOK ? '< 30 % TRS' : '≥ 30 % TRS'}</Tag></div>
        </div>
      )}
      <div>
        <label className="text-[11px] text-slate-300">Engineering justification (≥ 30 words): why does your plan reduce the tool-bending error, and what did it cost?</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={5} className="mt-1 w-full rounded bg-slate-800 p-2 text-xs text-slate-100 ring-1 ring-slate-700" placeholder="Explain using force, engaged length, overhang, holder stiffness, spring pass or compensation…" />
        <div className="text-[10px] text-slate-500">{sc.words} words · {sc.kw} key concepts detected. Your lecturer grades the reasoning.</div>
      </div>
      {POCKET_QUESTIONS.filter((q) => q.stage === 'solve').map((q) => <Question key={q.id} q={q} />)}
    </div>
  );
}

export function downloadReport2() {
  const st = useApp.getState(), ps = usePocket.getState();
  const sc = scorePocket();
  const r = ps.result;
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  const ev = evaluatePocket(r);
  const q = POCKET_QUESTIONS.map((x) => { const a = st.answers[x.id]; return `<tr><td>${x.id}</td><td>${esc(x.prompt)}</td><td>${a === undefined ? '—' : esc(x.options[Number(a)])}</td><td>${a !== undefined && Number(a) === x.correct ? '✔' : '✘'}</td></tr>`; }).join('');
  const t = ps.trials.map((x) => `<tr><td>${esc(x.label)}</td><td>${POCKET_STRATEGY_INFO[x.params.strategy].name}</td><td>${x.params.mode}</td><td>${x.params.overhang}</td><td>${x.params.ap}</td><td>${x.params.aeFinish}</td><td>${(x.summary.maxTipDefl * 1000).toFixed(0)}</td><td>${(Math.max(Math.abs(x.summary.devMin), Math.abs(x.summary.devMax)) * 1000).toFixed(0)}</td><td>${x.summary.averageMRR.toFixed(0)}</td></tr>`).join('');
  const p = r?.params;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>MachinaForce 3D Module 2 report — ${esc(st.studentName || 'student')}</title>
<style>body{font:13px/1.45 system-ui,sans-serif;max-width:900px;margin:24px auto;color:#111}h1{font-size:20px}h2{font-size:15px;margin-top:22px;border-bottom:1px solid #ccc}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border:1px solid #ccc;padding:3px 5px;text-align:left}.note{background:#fff7e6;border:1px solid #f0c36d;padding:6px 8px}</style></head><body>
<h1>MachinaForce 3D — Module 2: Tool bending in deep-pocket machining</h1>
<p><b>Student:</b> ${esc(st.studentName || '—')} &nbsp; <b>Date:</b> ${new Date().toLocaleString()}</p>
<p class="note">All values are model estimates (${p ? p.coeffSource : 'illustrative'} cutting coefficients, quasi-static stepped-cantilever tool model, illustrative holder stiffness). They are not measured results.</p>
<h2>Score</h2><p>Total <b>${sc.total} / ${sc.max}</b> — questions ${sc.mcq}/${sc.mcqMax}, production problem ${sc.solve}/3, justification ${sc.explain}/1.</p>
<h2>Final configuration</h2>${p && r ? `<table><tr><th>Strategy</th><td>${POCKET_STRATEGY_INFO[p.strategy].name} (${p.mode}-milling)${r.summary.compensation.length ? `; offsets ${r.summary.compensation.map((c) => (c * 1000).toFixed(0)).join(' / ')} µm` : ''}</td></tr><tr><th>Cutting</th><td>n = ${p.rpm} rpm, fz = ${p.fz} mm, ap = ${p.strategy === 'full-depth' ? p.pocketDepth : p.ap} mm, ae = ${p.aeFinish} mm</td></tr><tr><th>Tool</th><td>D = ${p.D} mm, N = ${p.N}, overhang ${p.overhang} mm, flutes ${p.fluteLength} mm${p.neck ? `, neck Ø${p.neckDiameter} × ${p.neckLength} mm` : ''}; holder ${p.holderRigid ? 'rigid' : `kT ${p.holderKT / 1000} N/µm, kR ${(p.holderKR / 1e6).toFixed(0)}×10⁶ N·mm/rad`}</td></tr><tr><th>Predicted wall deviation</th><td>${(r.summary.devMin * 1000).toFixed(0)} to ${(r.summary.devMax * 1000).toFixed(0)} µm; form error ${(r.summary.formError * 1000).toFixed(0)} µm</td></tr><tr><th>Tool</th><td>peak tip deflection ${(r.summary.maxTipDefl * 1000).toFixed(0)} µm; peak stress ${r.summary.maxStress.toFixed(0)} MPa (${(r.summary.stressRatio * 100).toFixed(0)} % TRS)</td></tr><tr><th>Productivity</th><td>average MRR ${r.summary.averageMRR.toFixed(0)} mm³/min; cutting time ${r.summary.cycleTime.toFixed(1)} s</td></tr><tr><th>Production problem</th><td>${ev ? `setup ${ev.setupOK ? 'OK' : 'NOT as brief'}, tolerance ${ev.tolOK ? 'met' : 'not met'}, productivity ${ev.mrrOK ? 'met' : 'not met'}, stress ${ev.stressOK ? 'OK' : 'too high'}` : '—'}</td></tr></table>` : '—'}
<h2>Engineering justification</h2><p>${esc(ps.solveNote || '—').replace(/\n/g, '<br>')}</p>
<h2>Questions</h2><table><tr><th>ID</th><th>Question</th><th>Answer</th><th></th></tr>${q}</table>
<h2>Experimental trials</h2><table><tr><th>Trial</th><th>Strategy</th><th>Mode</th><th>L</th><th>ap</th><th>ae</th><th>tip µm</th><th>max|dev| µm</th><th>MRR</th></tr>${t || '<tr><td colspan=9>none saved</td></tr>'}</table>
</body></html>`;
  download(`machinaforce-m2-report-${(st.studentName || 'student').replace(/\W+/g, '_')}.html`, html, 'text/html');
  if (ps.trials.length) download('machinaforce-m2-trials.csv', pocketTrialsCSV());
}

const INTRO: Record<Stage, { title: string; text: string }> = {
  observe: { title: 'Stage A · Observe (Module 2)', text: 'Play one level. Watch the long tool bend away from the rigid wall (shape exaggerated). Open “Tool bending” to see where the moment and the deflection are largest, then “Wall deviation profile” to see the error the bending leaves on the wall.' },
  experiment: { title: 'Stage B · Experiment (Module 2)', text: 'Predict, then change one factor: overhang, holder stiffness, flute/neck geometry, ap, ae, strategy. Save each run and compare tip deflection, wall error and MRR.' },
  solve: { title: 'Stage C · Solve (Module 2)', text: 'Fix a real mould-shop problem without a stiffer holder: meet the wall tolerance, keep productivity, and keep the tool safely stressed.' },
  validate: { title: 'Validation (Module 2)', text: 'Compare with your measurements: a dynamometer force signal, and CMM or dial-indicator wall deviations along the depth.' },
};

export function StagePanel2() {
  const stage = useApp((s) => s.stage);
  const name = useApp((s) => s.studentName);
  const setName = useApp((s) => s.setStudentName);
  useApp((s) => s.answers); usePocket((s) => s.result); usePocket((s) => s.solveNote);
  const sc = scorePocket();
  return (
    <div className="space-y-2 p-3">
      <div><h3 className="text-sm font-semibold text-slate-100">{INTRO[stage].title}</h3><p className="mt-1 text-[11px] leading-snug text-slate-400">{INTRO[stage].text}</p></div>
      {(stage === 'observe' || stage === 'experiment') && POCKET_QUESTIONS.filter((q) => q.stage === stage).map((q) => <Question key={q.id} q={q} />)}
      {stage === 'solve' && <Solve2 />}
      {stage === 'validate' && <ValidationPanel />}
      {stage !== 'validate' && (
        <div className="rounded bg-slate-900 p-2 ring-1 ring-slate-800">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-200">Module 2 score {sc.total} / {sc.max}</span><span className="text-[10px] text-slate-500">questions {sc.mcq}/{sc.mcqMax} · solve {sc.solve}/3 · explain {sc.explain}/1</span></div>
          <div className="mt-1.5 flex gap-1.5">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Student name / matric no." className="flex-1 rounded bg-slate-800 px-2 py-0.5 text-xs ring-1 ring-slate-700" />
            <Btn kind="primary" onClick={downloadReport2}>Report</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
