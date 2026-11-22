import { useApp, type Stage } from '../state/store';
import { QUESTIONS, SOLVE_PROBLEM, type MCQ } from '../content/learning';
import { MATERIALS } from '../physics/materials';
import { STRATEGY_INFO, type SimResult } from '../physics/process';
import { Btn, Tag } from './controls';
import { ValidationPanel } from './ValidationPanel';
import { download } from '../lib/csv';
import { trialsCSV } from './BottomPanel';
import { StagePanel2 } from './m2/StagePanel2';
import { StagePanel3 } from './m3/StagePanel3';

const KEYWORDS = ['stiff', 'deflect', 'force', 'support', 'thick', 'overhang', 'engagement', 'radial', 'axial', 'spring'];

export function Question({ q }: { q: MCQ }) {
  const ans = useApp((s) => s.answers[q.id]);
  const answer = useApp((s) => s.answer);
  const chosen = ans === undefined ? -1 : Number(ans);
  const done = chosen >= 0;
  return (
    <div className="rounded bg-slate-900 p-2 ring-1 ring-slate-800">
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className="text-xs text-slate-200"><span className="mr-1 font-semibold text-cyan-300">{q.id}</span>{q.prompt}</p>
        <Tag kind="assumption">{q.kind}</Tag>
      </div>
      <div className="space-y-1">
        {q.options.map((o, i) => {
          const isC = i === q.correct;
          const cls = !done ? 'hover:bg-slate-800' : isC ? 'bg-emerald-900/40 ring-1 ring-emerald-700' : i === chosen ? 'bg-rose-900/40 ring-1 ring-rose-700' : 'opacity-60';
          return (
            <button key={i} disabled={done} onClick={() => answer(q.id, String(i))} className={`block w-full rounded px-2 py-1 text-left text-[11px] text-slate-300 ${cls}`}>
              {String.fromCharCode(65 + i)}. {o}
            </button>
          );
        })}
      </div>
      {done && <p className="mt-1 text-[11px] leading-snug text-slate-400"><b className={chosen === q.correct ? 'text-emerald-300' : 'text-rose-300'}>{chosen === q.correct ? 'Correct.' : 'Not quite.'}</b> {q.why}</p>}
      {q.tryIt && <p className="mt-1 text-[11px] text-amber-200/80">Test it: {q.tryIt}</p>}
    </div>
  );
}

export function evaluateSolve(result: SimResult | null) {
  if (!result) return null;
  const p = result.params, s = result.summary;
  const pr = SOLVE_PROBLEM;
  const setupOK =
    p.materialId === pr.material && p.wallThickness === pr.wallThickness && p.wallHeight === pr.wallHeight && p.wallLength === pr.wallLength &&
    p.D === pr.D && p.N === pr.N && Math.abs(p.tolerance - pr.tolerance) < 1e-9 && p.coeffSource === 'illustrative' &&
    p.overhang >= pr.overhangRange[0] && p.overhang <= pr.overhangRange[1];
  const maxDev = Math.max(Math.abs(s.devMin), Math.abs(s.devMax));
  return { setupOK, tolOK: maxDev <= pr.tolerance, mrrOK: s.averageMRR >= pr.minMRR, maxDev, mrr: s.averageMRR };
}

export function score() {
  const st = useApp.getState();
  const mcq = QUESTIONS.reduce((a, q) => a + (st.answers[q.id] !== undefined && Number(st.answers[q.id]) === q.correct ? 1 : 0), 0);
  const ev = evaluateSolve(st.result);
  const words = st.solveNote.trim().split(/\s+/).filter(Boolean).length;
  const kw = KEYWORDS.filter((k) => st.solveNote.toLowerCase().includes(k)).length;
  const explain = words >= 30 && kw >= 2 ? 1 : 0;
  const solve = ev && ev.setupOK ? (ev.tolOK ? 2 : 0) + (ev.mrrOK ? 1 : 0) : 0;
  return { mcq, mcqMax: QUESTIONS.length, solve, solveMax: 3, explain, explainMax: 1, total: mcq + solve + explain, max: QUESTIONS.length + 4, words, kw };
}

function SolveStage() {
  const result = useApp((s) => s.result);
  const note = useApp((s) => s.solveNote);
  const setNote = useApp((s) => s.setSolveNote);
  const setParams = useApp((s) => s.setParams);
  const ev = evaluateSolve(result);
  const pr = SOLVE_PROBLEM;
  const sc = score();
  const applySetup = () => setParams({
    materialId: pr.material, coeffs: { ...MATERIALS[pr.material].coeffs }, coeffSource: 'illustrative',
    wallThickness: pr.wallThickness, wallHeight: pr.wallHeight, wallLength: pr.wallLength, D: pr.D, N: pr.N, tolerance: pr.tolerance,
    strategy: 'alternating', ap: 5, aeFinish: 0.5, overhang: 45, mode: 'down', fz: 0.05, rpm: 12000, helixDeg: 30, clampRigid: true,
  });
  return (
    <div className="space-y-2">
      <div className="rounded bg-slate-900 p-2 ring-1 ring-slate-800">
        <h4 className="text-xs font-semibold text-amber-200">{pr.title}</h4>
        <p className="mt-1 text-[11px] leading-snug text-slate-300">{pr.brief}</p>
        <div className="mt-2"><Btn onClick={applySetup}>Load the current (failing) programme</Btn></div>
        <p className="mt-1 text-[10px] text-slate-500">Fixed: material, geometry, tool D and N, tolerance, illustrative coefficients. Free: strategy, mode, n, fz, ap, ae, overhang ({pr.overhangRange.join('–')} mm), helix.</p>
      </div>
      {ev && (
        <div className="grid grid-cols-3 gap-1.5 text-[11px]">
          <div className="rounded bg-slate-900 p-1.5 ring-1 ring-slate-800">Setup<br /><Tag kind={ev.setupOK ? 'ok' : 'fail'}>{ev.setupOK ? 'matches brief' : 'changed fixed item'}</Tag></div>
          <div className="rounded bg-slate-900 p-1.5 ring-1 ring-slate-800">Tolerance<br /><Tag kind={ev.tolOK ? 'ok' : 'fail'}>{(ev.maxDev * 1000).toFixed(0)} µm / {pr.tolerance * 1000}</Tag></div>
          <div className="rounded bg-slate-900 p-1.5 ring-1 ring-slate-800">Productivity<br /><Tag kind={ev.mrrOK ? 'ok' : 'fail'}>{ev.mrr.toFixed(0)} / {pr.minMRR}</Tag></div>
        </div>
      )}
      <div>
        <label className="text-[11px] text-slate-300">Engineering justification (≥ 30 words): why does your strategy reduce the error, and what did it cost?</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={5} className="mt-1 w-full rounded bg-slate-800 p-2 text-xs text-slate-100 ring-1 ring-slate-700" placeholder="Explain in terms of force, stiffness, support and productivity…" />
        <div className="text-[10px] text-slate-500">{sc.words} words · {sc.kw} key concepts detected. Auto-scoring checks length and concepts only; your lecturer grades the reasoning.</div>
      </div>
      {QUESTIONS.filter((q) => q.stage === 'solve').map((q) => <Question key={q.id} q={q} />)}
    </div>
  );
}

function ScoreCard() {
  const name = useApp((s) => s.studentName);
  const setName = useApp((s) => s.setStudentName);
  useApp((s) => s.answers); useApp((s) => s.result); useApp((s) => s.solveNote);
  const sc = score();
  return (
    <div className="rounded bg-slate-900 p-2 ring-1 ring-slate-800">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-200">Module 1 score {sc.total} / {sc.max}</span>
        <span className="text-[10px] text-slate-500">concepts {sc.mcq}/{sc.mcqMax} · solve {sc.solve}/{sc.solveMax} · explain {sc.explain}/{sc.explainMax}</span>
      </div>
      <div className="mt-1.5 flex gap-1.5">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Student name / matric no." className="flex-1 rounded bg-slate-800 px-2 py-0.5 text-xs ring-1 ring-slate-700" />
        <Btn kind="primary" onClick={downloadReport}>Report</Btn>
      </div>
      <div className="mt-1.5 flex gap-1.5">
        <Btn kind="ghost" onClick={() => { if (confirm('Clear all answers?')) { localStorage.removeItem('mf3d.answers'); useApp.setState({ answers: {} }); } }}>Reset answers</Btn>
      </div>
    </div>
  );
}

export function downloadReport() {
  const st = useApp.getState();
  const sc = score();
  const r = st.result;
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  const ev = evaluateSolve(r);
  const qRows = QUESTIONS.map((q) => {
    const a = st.answers[q.id];
    const ok = a !== undefined && Number(a) === q.correct;
    return `<tr><td>${q.id}</td><td>${esc(q.prompt)}</td><td>${a === undefined ? '—' : esc(q.options[Number(a)])}</td><td>${ok ? '✔' : '✘'}</td></tr>`;
  }).join('');
  const tRows = st.trials.map((t) => `<tr><td>${esc(t.label)}</td><td>${STRATEGY_INFO[t.params.strategy].name}</td><td>${t.params.mode}</td><td>${t.params.rpm}</td><td>${t.params.fz}</td><td>${t.params.ap}</td><td>${t.params.aeFinish}</td><td>${t.params.overhang}</td><td>${t.summary.peakResultant.toFixed(0)}</td><td>${(Math.max(Math.abs(t.summary.devMin), Math.abs(t.summary.devMax)) * 1000).toFixed(0)}</td><td>${t.summary.averageMRR.toFixed(0)}</td></tr>`).join('');
  const p = r?.params;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>MachinaForce 3D report — ${esc(st.studentName || 'student')}</title>
<style>body{font:13px/1.45 system-ui,sans-serif;max-width:900px;margin:24px auto;color:#111}h1{font-size:20px}h2{font-size:15px;margin-top:22px;border-bottom:1px solid #ccc}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border:1px solid #ccc;padding:3px 5px;text-align:left}.note{background:#fff7e6;border:1px solid #f0c36d;padding:6px 8px}</style></head><body>
<h1>MachinaForce 3D — Thin-wall milling laboratory report</h1>
<p><b>Student:</b> ${esc(st.studentName || '—')} &nbsp; <b>Date:</b> ${new Date().toLocaleString()} &nbsp; <b>Module:</b> 1 Thin-wall deflection</p>
<p class="note">All force and deflection values are model estimates computed with ${p ? p.coeffSource : 'illustrative'} cutting coefficients and a quasi-static model. They are not measured results.</p>
<h2>Score</h2><p>Total <b>${sc.total} / ${sc.max}</b> — concept/prediction questions ${sc.mcq}/${sc.mcqMax}, production problem ${sc.solve}/${sc.solveMax}, justification ${sc.explain}/${sc.explainMax} (auto-check of length and concepts; to be reviewed by the lecturer).</p>
<h2>Final configuration</h2>${p && r ? `<table><tr><th>Strategy</th><td>${STRATEGY_INFO[p.strategy].name} (${p.mode}-milling)</td></tr><tr><th>Cutting</th><td>n = ${p.rpm} rpm, fz = ${p.fz} mm, ap = ${p.ap} mm, ae = ${p.aeFinish} mm/side${p.strategy === 'rough-finish' || p.strategy === 'step-support' ? `, roughing ae = ${p.aeRough} mm` : ''}</td></tr><tr><th>Tool</th><td>D = ${p.D} mm, N = ${p.N}, helix ${p.helixDeg}°, overhang ${p.overhang} mm</td></tr><tr><th>Wall</th><td>${MATERIALS[p.materialId].name}, t = ${p.wallThickness} ± ${p.tolerance} mm, H = ${p.wallHeight} mm, L = ${p.wallLength} mm</td></tr><tr><th>Predicted thickness deviation</th><td>${(r.summary.devMin * 1000).toFixed(0)} to ${(r.summary.devMax * 1000).toFixed(0)} µm; ${(r.summary.inTolFraction * 100).toFixed(0)} % of area in tolerance</td></tr><tr><th>Productivity</th><td>vf = ${r.summary.feedRate.toFixed(0)} mm/min; average MRR ${r.summary.averageMRR.toFixed(0)} mm³/min; cutting time ${r.summary.cycleTime.toFixed(1)} s</td></tr><tr><th>Production problem</th><td>${ev ? `setup ${ev.setupOK ? 'OK' : 'NOT as brief'}, tolerance ${ev.tolOK ? 'met' : 'not met'}, productivity ${ev.mrrOK ? 'met' : 'not met'}` : '—'}</td></tr></table>` : '—'}
<h2>Engineering justification</h2><p>${esc(st.solveNote || '—').replace(/\n/g, '<br>')}</p>
<h2>Questions</h2><table><tr><th>ID</th><th>Question</th><th>Answer</th><th></th></tr>${qRows}</table>
<h2>Experimental trials</h2><table><tr><th>Trial</th><th>Strategy</th><th>Mode</th><th>n</th><th>fz</th><th>ap</th><th>ae</th><th>Lt</th><th>Peak F (N)</th><th>max|dev| µm</th><th>MRR</th></tr>${tRows || '<tr><td colspan=11>none saved</td></tr>'}</table>
<p style="margin-top:28px;color:#666;font-size:11px">Generated by MachinaForce 3D v0.3 (educational simulator). Model assumptions are listed in the application under “Assumptions”.</p>
</body></html>`;
  download(`machinaforce-report-${(st.studentName || 'student').replace(/\W+/g, '_')}.html`, html, 'text/html');
  if (st.trials.length) download('machinaforce-trials.csv', trialsCSV());
}

const INTRO: Record<Stage, { title: string; text: string }> = {
  observe: { title: 'Stage A · Observe', text: 'Press Play and watch one finishing pass. Identify the three force components (red X, green Y, blue Z), the direction the wall bends, and where the thickness error appears. Switch the colour map to “thickness deviation” and look at the profile chart.' },
  experiment: { title: 'Stage B · Experiment', text: 'Make a prediction first, then change ONE parameter, re-run (automatic) and save a trial. Compare peak force, deflection, thickness error and MRR in the Experiment comparison tab.' },
  solve: { title: 'Stage C · Solve', text: 'Use what you learned to fix a real production problem. Meet the tolerance without losing productivity, then justify your choice.' },
  validate: { title: 'Validation (instructor / lab)', text: 'Compare the model with your own measurements from the dynamometer lab. Upload a measured force signal or measured wall-thickness points.' },
};

export function StagePanel() {
  const module = useApp((s) => s.module);
  return module === 3 ? <StagePanel3 /> : module === 2 ? <StagePanel2 /> : <StagePanel1 />;
}

function StagePanel1() {
  const stage = useApp((s) => s.stage);
  const intro = INTRO[stage];
  return (
    <div className="space-y-2 p-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-100">{intro.title}</h3>
        <p className="mt-1 text-[11px] leading-snug text-slate-400">{intro.text}</p>
      </div>
      {stage === 'observe' && QUESTIONS.filter((q) => q.stage === 'observe').map((q) => <Question key={q.id} q={q} />)}
      {stage === 'experiment' && QUESTIONS.filter((q) => q.stage === 'experiment').map((q) => <Question key={q.id} q={q} />)}
      {stage === 'solve' && <SolveStage />}
      {stage === 'validate' && <ValidationPanel />}
      {stage !== 'validate' && <ScoreCard />}
    </div>
  );
}
