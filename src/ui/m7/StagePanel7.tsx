import { useMemo, useState } from 'react';
import { useApp, type Stage } from '../../state/store';
import { useThinFloor } from '../../state/thinFloorStore';
import { THINFLOOR_PROBLEM, THINFLOOR_QUESTIONS } from '../../content/thinFloor';
import { MATERIALS } from '../../physics/materials';
import { DEFAULT_THINFLOOR, STRATEGY_INFO, thicknessAt, type ThinFloorResult } from '../../physics/thinFloor';
import { Btn, Tag } from '../controls';
import { Question } from '../StagePanel';
import { download, parseNumericCSV, toCSV } from '../../lib/csv';
import { floorTrialsCSV } from './BottomPanel7';

const KEYWORDS = ['deflect', 'stiff', 'support', 'span', 'thickness', 'axial', 'springback', 'feed', 'time', 'strategy', 'rigidity', 'pin'];

export function evaluateThinFloor(r: ThinFloorResult | null) {
  if (!r) return null;
  const p = r.params, d = DEFAULT_THINFLOOR, pr = THINFLOOR_PROBLEM;
  const setupOK = p.materialId === 'al7075' && p.coeffSource === 'illustrative' && p.L === 80 && p.W === 60 && p.tFinal === 1.5 && Math.abs(p.tol - pr.tol) < 1e-9 &&
    p.D === 8 && p.N === 3 && p.allowance === d.allowance && p.edge === 'reduced' && p.Kzc === d.Kzc && p.Kze === d.Kze;
  return { setupOK, tolOK: r.summary.pass, timeOK: r.summary.cutTime <= pr.maxTime, err: r.summary.maxErr, time: r.summary.cutTime };
}

export function scoreThinFloor() {
  const st = useApp.getState(), fs = useThinFloor.getState();
  const mcq = THINFLOOR_QUESTIONS.reduce((a, q) => a + (st.answers[q.id] !== undefined && Number(st.answers[q.id]) === q.correct ? 1 : 0), 0);
  const ev = evaluateThinFloor(fs.result);
  const words = fs.solveNote.trim().split(/\s+/).filter(Boolean).length;
  const kw = KEYWORDS.filter((k) => fs.solveNote.toLowerCase().includes(k)).length;
  const trialsOK = fs.trials.length >= THINFLOOR_PROBLEM.minTrials;
  const explain = words >= 40 && kw >= 3 && trialsOK ? 1 : 0;
  const solve = ev && ev.setupOK ? (ev.tolOK ? 2 : 0) + (ev.tolOK && ev.timeOK ? 1 : 0) : 0;
  return { mcq, mcqMax: THINFLOOR_QUESTIONS.length, solve, explain, total: mcq + solve + explain, max: THINFLOOR_QUESTIONS.length + 4, words, kw, trials: fs.trials.length, trialsOK };
}

function Solve7() {
  const r = useThinFloor((s) => s.result);
  const note = useThinFloor((s) => s.solveNote);
  const setNote = useThinFloor((s) => s.setSolveNote);
  const setParams = useThinFloor((s) => s.setParams);
  useThinFloor((s) => s.trials);
  const pr = THINFLOOR_PROBLEM, d = DEFAULT_THINFLOOR;
  const ev = evaluateThinFloor(r);
  const sc = scoreThinFloor();
  const load = () => setParams({ materialId: 'al7075', coeffs: { ...MATERIALS.al7075.coeffs }, coeffSource: 'illustrative', L: 80, W: 60, tFinal: 1.5, tol: pr.tol, D: 8, N: 3, Kzc: d.Kzc, Kze: d.Kze, helixDeg: d.helixDeg, ...pr.baseline });
  const cell = (label: string, ok: boolean, text: string) => <div className="rounded bg-slate-900 p-1.5 ring-1 ring-slate-800">{label}<br /><Tag kind={ok ? 'ok' : 'fail'}>{text}</Tag></div>;
  return (
    <div className="space-y-2">
      <div className="rounded bg-slate-900 p-2 ring-1 ring-slate-800">
        <h4 className="text-xs font-semibold text-amber-200">{pr.title}</h4>
        <p className="mt-1 text-[11px] leading-snug text-slate-300">{pr.brief}</p>
        <div className="mt-2"><Btn onClick={load}>Load the current (failing) programme</Btn></div>
        <p className="mt-1 text-[10px] text-slate-500">Fixed: material, pocket 80 × 60 mm, floor 1.50 ± 0.05 mm, allowance 0.5 mm, Ø8 mm 3-flute tool, reduced edge support, illustrative coefficients. Free: strategy, fz, ae, rpm, axial depth per pass, underside support.</p>
      </div>
      {ev && (
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          {cell('Setup', ev.setupOK, ev.setupOK ? 'matches brief' : 'fixed item changed')}
          {cell('Floor thickness', ev.tolOK, `|err| ${(ev.err * 1000).toFixed(1)} / ${pr.tol * 1000} µm`)}
          {cell('Cutting time', ev.timeOK, `${ev.time.toFixed(1)} / ≤ ${pr.maxTime} s`)}
          {cell('Trials saved', sc.trialsOK, `${sc.trials} / ≥ ${pr.minTrials}`)}
        </div>
      )}
      <div>
        <label className="text-[11px] text-slate-300">Justification (≥ 40 words, ≥ {pr.minTrials} saved trials): what controls the floor error here, which trials did you compare, and why are your conditions the fastest that meet the tolerance?</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={5} className="mt-1 w-full rounded bg-slate-800 p-2 text-xs text-slate-100 ring-1 ring-slate-700" placeholder="Explain using axial force, span, bending rigidity, support, springback and cutting time…" />
        <div className="text-[10px] text-slate-500">{sc.words} words · {sc.kw} key concepts · {sc.trials} trials. Your lecturer grades the reasoning.</div>
      </div>
      {THINFLOOR_QUESTIONS.filter((q) => q.stage === 'solve').map((q) => <Question key={q.id} q={q} />)}
    </div>
  );
}

function Validate7() {
  const r = useThinFloor((s) => s.result);
  const [text, setText] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 20e6) { setErr('File larger than 20 MB'); return; }
    f.text().then((t) => { setErr(null); setText(t); setName(f.name); });
  };
  const cmp = useMemo(() => {
    if (!text || !r) return null;
    const synthetic = /SYNTHETIC/i.test(text);
    const { header, rows } = parseNumericCSV(text);
    const ix = header.findIndex((h) => h.startsWith('x')), iy = header.findIndex((h) => h.startsWith('y')), it = header.findIndex((h) => h.includes('thick'));
    if (ix < 0 || iy < 0 || it < 0 || !rows.length) return { error: 'Need columns: x_mm, y_mm, measured_thickness_mm' };
    const d: { x: number; y: number; meas: number; model: number }[] = [];
    let outside = 0;
    for (const q of rows) { const m = thicknessAt(r, q[ix], q[iy]); if (Number.isFinite(m)) d.push({ x: q[ix], y: q[iy], meas: q[it], model: m }); else outside++; }
    if (!d.length) return { error: 'No measurement points fall on the evaluated floor.' };
    const e = d.map((q) => q.model - q.meas);
    return {
      synthetic, n: d.length, outside, rows: d.slice(0, 12),
      mae: e.reduce((a, v) => a + Math.abs(v), 0) / e.length,
      rmse: Math.sqrt(e.reduce((a, v) => a + v * v, 0) / e.length),
      max: Math.max(...e.map(Math.abs)),
      bias: e.reduce((a, v) => a + v, 0) / e.length,
    };
  }, [text, r]);
  const synth = () => {
    if (!r) return;
    const p = r.params;
    const rows: (string | number)[][] = [['x_mm', 'y_mm', 'measured_thickness_mm']];
    for (let i = 1; i <= 7; i++) for (let j = 1; j <= 5; j++) {
      const x = (i * p.L) / 8, y = (j * p.W) / 6, m = thicknessAt(r, x, y);
      if (Number.isFinite(m)) rows.push([x.toFixed(1), y.toFixed(1), (p.tFinal + (m - p.tFinal) * 1.2 + 0.004 + (Math.random() - 0.5) * 0.006).toFixed(4)]);
    }
    download('SYNTHETIC-floor-thickness.csv', '# SYNTHETIC measurement generated from the model (deviation ×1.2, +4 µm bias, ±3 µm noise). NOT measured data.\n' + toCSV(rows));
  };
  if (!r) return null;
  return (
    <div className="space-y-3 text-[11px] text-slate-300">
      <div className="rounded bg-slate-900 p-2 ring-1 ring-slate-800">
        <h4 className="font-semibold text-slate-100">Measured floor thickness (ultrasonic gauge or CMM)</h4>
        <p className="mt-1 text-slate-400">Upload <code>x_mm, y_mm, measured_thickness_mm</code> in the pocket frame (origin at the pocket corner, X along the length). Each point is compared with the simulated final thickness at the same coordinates ({STRATEGY_INFO[r.params.strategy].name}, {r.params.under} underside support).</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <input type="file" accept=".csv,.txt" onChange={onFile} className="text-[11px]" />
          <Btn kind="ghost" onClick={synth}>download synthetic example</Btn>
        </div>
        {cmp && 'error' in cmp && <p className="mt-1 text-rose-300">{cmp.error}</p>}
        {cmp && 'n' in cmp && (
          <>
            <div className="mt-2"><Tag kind={cmp.synthetic ? 'warn' : 'validated'}>{cmp.synthetic ? 'SYNTHETIC example — not experimental data' : `experimental data: ${name}`}</Tag></div>
            <table className="mt-2 w-full tabular"><tbody>
              <tr><td>Points compared</td><td>{cmp.n}{cmp.outside ? ` (${cmp.outside} outside the evaluated floor ignored)` : ''}</td></tr>
              <tr><td>Mean absolute error</td><td>{(cmp.mae! * 1000).toFixed(1)} µm</td></tr>
              <tr><td>RMSE</td><td>{(cmp.rmse! * 1000).toFixed(1)} µm</td></tr>
              <tr><td>Maximum absolute error</td><td>{(cmp.max! * 1000).toFixed(1)} µm</td></tr>
              <tr><td>Bias (model − measured)</td><td>{(cmp.bias! * 1000).toFixed(1)} µm</td></tr>
            </tbody></table>
            <table className="mt-2 w-full tabular">
              <thead className="text-slate-500"><tr><th className="text-left">x</th><th className="text-left">y</th><th className="text-left">measured</th><th className="text-left">model</th></tr></thead>
              <tbody>{cmp.rows!.map((q, k) => <tr key={k}><td>{q.x}</td><td>{q.y}</td><td>{q.meas.toFixed(4)}</td><td>{q.model.toFixed(4)}</td></tr>)}</tbody>
            </table>
          </>
        )}
        {err && <p className="text-rose-300">{err}</p>}
      </div>
      <div className="rounded bg-amber-950/30 p-2 text-amber-100/90 ring-1 ring-amber-900">
        <b>Limitations to report:</b> quasi-static linear plate model; illustrative end-edge axial coefficients (the deflection scales with them — calibrate Fz with a dynamometer first); idealised edge and pin supports; no residual stress, thermal or clamping distortion; no tool deflection, runout or machine error. A uniform offset in the measured thickness usually comes from the tool-length or datum setting, not from floor bending.
      </div>
    </div>
  );
}

export function downloadReport7() {
  const st = useApp.getState(), fs = useThinFloor.getState();
  const sc = scoreThinFloor();
  const r = fs.result, ev = evaluateThinFloor(r);
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  const q = THINFLOOR_QUESTIONS.map((x) => { const a = st.answers[x.id]; return `<tr><td>${x.id}</td><td>${esc(x.prompt)}</td><td>${a === undefined ? '—' : esc(x.options[Number(a)])}</td><td>${a !== undefined && Number(a) === x.correct ? '✔' : '✘'}</td></tr>`; }).join('');
  const t = fs.trials.map((x) => `<tr><td>${esc(x.label)}</td><td>${x.params.strategy}</td><td>${x.params.edge}/${x.params.under}</td><td>${x.params.fz}</td><td>${x.params.ae}</td><td>${x.params.rpm}</td><td>${(x.summary.maxDeflection * 1000).toFixed(1)}</td><td>${(x.summary.maxErr * 1000).toFixed(1)}</td><td>${x.summary.cutTime.toFixed(1)}</td><td>${x.summary.pass ? 'pass' : 'fail'}</td></tr>`).join('');
  const p = r?.params, s = r?.summary;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>MachinaForce 3D Module 7 report — ${esc(st.studentName || 'student')}</title>
<style>body{font:13px/1.45 system-ui,sans-serif;max-width:900px;margin:24px auto;color:#111}h1{font-size:20px}h2{font-size:15px;margin-top:22px;border-bottom:1px solid #ccc}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border:1px solid #ccc;padding:3px 5px;text-align:left}.note{background:#fff7e6;border:1px solid #f0c36d;padding:6px 8px}</style></head><body>
<h1>MachinaForce 3D — Module 7: Thin-floor pocket milling</h1>
<p><b>Student:</b> ${esc(st.studentName || '—')} &nbsp; <b>Date:</b> ${new Date().toLocaleString()}</p>
<p class="note">Values are model estimates (quasi-static Mindlin plate; illustrative cutting and end-edge axial coefficients).</p>
<h2>Score</h2><p>Total <b>${sc.total} / ${sc.max}</b> — questions ${sc.mcq}/${sc.mcqMax}, production problem ${sc.solve}/3, justification with ≥ ${THINFLOOR_PROBLEM.minTrials} trials ${sc.explain}/1.</p>
<h2>Final configuration</h2>${p && s ? `<table><tr><th>Part</th><td>${MATERIALS[p.materialId].name}; pocket ${p.L} × ${p.W} mm; floor ${p.tFinal} ± ${p.tol} mm; allowance ${p.allowance} mm</td></tr><tr><th>Support</th><td>${p.edge} edges; underside ${p.under}</td></tr><tr><th>Cutting</th><td>${STRATEGY_INFO[p.strategy].name}; Ø${p.D} mm, ${p.N} flutes, ${p.rpm} rpm, fz ${p.fz} mm, ae ${p.ae} mm, ${r!.layers} layer(s)</td></tr><tr><th>Result</th><td>mean Fz ${s.meanFz.toFixed(1)} N; max deflection ${(s.maxDeflection * 1000).toFixed(1)} µm; max |error| ${(s.maxErr * 1000).toFixed(1)} µm (${s.pass ? 'PASS' : 'FAIL'}); cutting time ${s.cutTime.toFixed(1)} s; f₁ ${s.f1End.toFixed(0)} Hz</td></tr><tr><th>Production problem</th><td>${ev ? `setup ${ev.setupOK ? 'OK' : 'NOT as brief'}, tolerance ${ev.tolOK ? 'met' : 'not met'}, time ${ev.timeOK ? 'met' : 'not met'}, trials ${sc.trials}` : '—'}</td></tr></table>` : '—'}
<h2>Justification</h2><p>${esc(fs.solveNote || '—').replace(/\n/g, '<br>')}</p>
<h2>Questions</h2><table><tr><th>ID</th><th>Question</th><th>Answer</th><th></th></tr>${q}</table>
<h2>Trials</h2><table><tr><th>Trial</th><th>Strategy</th><th>Support</th><th>fz</th><th>ae</th><th>rpm</th><th>w max µm</th><th>|err| µm</th><th>time s</th><th></th></tr>${t || '<tr><td colspan=10>none saved</td></tr>'}</table>
</body></html>`;
  download(`machinaforce-m7-report-${(st.studentName || 'student').replace(/\W+/g, '_')}.html`, html, 'text/html');
  if (fs.trials.length) download('machinaforce-m7-trials.csv', floorTrialsCSV());
}

const INTRO: Record<Stage, { title: string; text: string }> = {
  observe: { title: 'Stage A · Observe (Module 7)', text: 'Press Play. Set Forces on → workpiece: the axial force pushes the floor down. Watch the floor bend under the cutter (exaggerated) and where the deflection is largest. Then switch the floor colour to “Final thickness deviation”.' },
  experiment: { title: 'Stage B · Experiment (Module 7)', text: 'Predict, then change one factor at a time: floor thickness, pocket span, feed per tooth, underside support. Save each run as a trial; use “Deflection vs floor thickness” and “Strategy comparison”.' },
  solve: { title: 'Stage C · Solve (Module 7)', text: 'Bring an 80 × 60 mm, 1.5 mm floor within ±0.05 mm in the shortest feasible time.' },
  validate: { title: 'Validation (Module 7)', text: 'Compare measured floor thickness with the simulation at the same coordinates.' },
};

export function StagePanel7() {
  const stage = useApp((s) => s.stage);
  const name = useApp((s) => s.studentName);
  const setName = useApp((s) => s.setStudentName);
  useApp((s) => s.answers); useThinFloor((s) => s.result); useThinFloor((s) => s.solveNote); useThinFloor((s) => s.trials);
  const sc = scoreThinFloor();
  return (
    <div className="space-y-2 p-3">
      <div><h3 className="text-sm font-semibold text-slate-100">{INTRO[stage].title}</h3><p className="mt-1 text-[11px] leading-snug text-slate-400">{INTRO[stage].text}</p></div>
      {(stage === 'observe' || stage === 'experiment') && THINFLOOR_QUESTIONS.filter((q) => q.stage === stage).map((q) => <Question key={q.id} q={q} />)}
      {stage === 'solve' && <Solve7 />}
      {stage === 'validate' && <Validate7 />}
      {stage !== 'validate' && (
        <div className="rounded bg-slate-900 p-2 ring-1 ring-slate-800">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-200">Module 7 score {sc.total} / {sc.max}</span><span className="text-[10px] text-slate-500">questions {sc.mcq}/{sc.mcqMax} · solve {sc.solve}/3 · justify {sc.explain}/1</span></div>
          <div className="mt-1.5 flex gap-1.5">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Student name / matric no." className="flex-1 rounded bg-slate-800 px-2 py-0.5 text-xs ring-1 ring-slate-700" />
            <Btn kind="primary" onClick={downloadReport7}>Report</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
