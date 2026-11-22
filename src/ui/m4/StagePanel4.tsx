import { useMemo, useState } from 'react';
import { useApp, type Stage } from '../../state/store';
import { useTurning } from '../../state/turningStore';
import { TURNING_PROBLEM, TURNING_QUESTIONS } from '../../content/turning';
import { MATERIALS } from '../../physics/materials';
import type { TurnResult } from '../../physics/turning';
import { Btn, Tag } from '../controls';
import { Question } from '../StagePanel';
import { download, parseNumericCSV, toCSV } from '../../lib/csv';
import { turnTrialsCSV } from './BottomPanel4';

const KEYWORDS = ['passive', 'fp', 'deflect', 'stiff', 'support', 'tailstock', 'steady', 'nose', 'span', 'radial'];

export function evaluateTurning(r: TurnResult | null) {
  if (!r) return null;
  const p = r.params, s = r.summary, pr = TURNING_PROBLEM;
  const setupOK = p.materialId === pr.material && p.d0 === pr.d0 && p.dT === pr.dT && p.L === pr.L && p.cutLength === pr.cutLength &&
    Math.abs(p.tolerance - pr.tolerance) < 1e-9 && p.coeffSource === 'illustrative' && p.workholding !== 'chuck';
  const maxDev = Math.max(Math.abs(s.devMin), Math.abs(s.devMax));
  return { setupOK, tolOK: maxDev <= pr.tolerance, raOK: s.ra <= pr.maxRa, timeOK: s.cycleTime <= pr.maxTime, powerOK: s.maxPower <= p.machinePower, maxDev, ra: s.ra, time: s.cycleTime };
}

export function scoreTurning() {
  const st = useApp.getState(), ts = useTurning.getState();
  const mcq = TURNING_QUESTIONS.reduce((a, q) => a + (st.answers[q.id] !== undefined && Number(st.answers[q.id]) === q.correct ? 1 : 0), 0);
  const ev = evaluateTurning(ts.result);
  const words = ts.solveNote.trim().split(/\s+/).filter(Boolean).length;
  const kw = KEYWORDS.filter((k) => ts.solveNote.toLowerCase().includes(k)).length;
  const explain = words >= 30 && kw >= 2 ? 1 : 0;
  const solve = ev && ev.setupOK && ev.powerOK ? (ev.tolOK ? 2 : 0) + (ev.raOK && ev.timeOK ? 1 : 0) : 0;
  return { mcq, mcqMax: TURNING_QUESTIONS.length, solve, explain, total: mcq + solve + explain, max: TURNING_QUESTIONS.length + 4, words, kw };
}

function Solve4() {
  const r = useTurning((s) => s.result);
  const note = useTurning((s) => s.solveNote);
  const setNote = useTurning((s) => s.setSolveNote);
  const setParams = useTurning((s) => s.setParams);
  const pr = TURNING_PROBLEM;
  const ev = evaluateTurning(r);
  const sc = scoreTurning();
  const load = () => setParams({ materialId: pr.material, coeffs: { ...MATERIALS[pr.material].coeffs }, coeffSource: 'illustrative', d0: pr.d0, dT: pr.dT, L: pr.L, cutLength: pr.cutLength, tolerance: pr.tolerance, ...pr.baseline });
  return (
    <div className="space-y-2">
      <div className="rounded bg-slate-900 p-2 ring-1 ring-slate-800">
        <h4 className="text-xs font-semibold text-amber-200">{pr.title}</h4>
        <p className="mt-1 text-[11px] leading-snug text-slate-300">{pr.brief}</p>
        <div className="mt-2"><Btn onClick={load}>Load the current (failing) programme</Btn></div>
        <p className="mt-1 text-[10px] text-slate-500">Fixed: material, bar and finished diameters, length, tolerance, illustrative coefficients; the shaft must be supported at both ends. Free: workholding stiffness, steady rest, tool geometry, vc, f, strategy, feed direction.</p>
      </div>
      {ev && (
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          <div className="rounded bg-slate-900 p-1.5 ring-1 ring-slate-800">Setup<br /><Tag kind={ev.setupOK && ev.powerOK ? 'ok' : 'fail'}>{ev.setupOK ? (ev.powerOK ? 'matches brief' : 'power exceeded') : 'fixed item changed'}</Tag></div>
          <div className="rounded bg-slate-900 p-1.5 ring-1 ring-slate-800">Diameter<br /><Tag kind={ev.tolOK ? 'ok' : 'fail'}>{(ev.maxDev * 1000).toFixed(1)} / {pr.tolerance * 1000} µm</Tag></div>
          <div className="rounded bg-slate-900 p-1.5 ring-1 ring-slate-800">Roughness<br /><Tag kind={ev.raOK ? 'ok' : 'fail'}>Ra {ev.ra.toFixed(2)} / {pr.maxRa} µm</Tag></div>
          <div className="rounded bg-slate-900 p-1.5 ring-1 ring-slate-800">Cutting time<br /><Tag kind={ev.timeOK ? 'ok' : 'fail'}>{ev.time.toFixed(0)} / {pr.maxTime} s</Tag></div>
        </div>
      )}
      <div>
        <label className="text-[11px] text-slate-300">Engineering justification (≥ 30 words): which force component causes the error, and why does your plan reduce it?</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={5} className="mt-1 w-full rounded bg-slate-800 p-2 text-xs text-slate-100 ring-1 ring-slate-700" placeholder="Explain using Fp, shaft stiffness, supports, nose radius, roughness and time…" />
        <div className="text-[10px] text-slate-500">{sc.words} words · {sc.kw} key concepts detected. Your lecturer grades the reasoning.</div>
      </div>
      {TURNING_QUESTIONS.filter((q) => q.stage === 'solve').map((q) => <Question key={q.id} q={q} />)}
    </div>
  );
}

function Validate4() {
  const r = useTurning((s) => s.result);
  const cursor = useApp((s) => s.cursor);
  const [fText, setFText] = useState<string | null>(null);
  const [dText, setDText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const read = (cb: (t: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 20e6) { setErr('File larger than 20 MB'); return; }
    f.text().then((t) => { setErr(null); cb(t); });
  };
  const st = r ? r.stations[Math.min(Math.floor(cursor.station), r.stations.length - 1)] : null;
  const forceCmp = useMemo(() => {
    if (!fText || !r || !st) return null;
    const { header, rows } = parseNumericCSV(fText);
    const ic = header.findIndex((h) => h.startsWith('fc')), iff = header.findIndex((h) => h.startsWith('ff')), ip = header.findIndex((h) => h.startsWith('fp'));
    if (ic < 0 || iff < 0 || ip < 0 || !rows.length) return { error: 'Need columns: Fc_N, Ff_N, Fp_N (one row per sample or per test; magnitudes)' };
    const mean = (i: number) => rows.reduce((a, q) => a + Math.abs(q[i]), 0) / rows.length;
    const m = { Fc: mean(ic), Ff: mean(iff), Fp: mean(ip) };
    const mod = { Fc: st.Fc, Ff: st.Ff, Fp: st.Fp };
    return { rows: (['Fc', 'Ff', 'Fp'] as const).map((k) => ({ k, meas: m[k], model: mod[k], pct: ((mod[k] - m[k]) / m[k]) * 100 })), n: rows.length };
  }, [fText, r, st]);
  const diaCmp = useMemo(() => {
    if (!dText || !r) return null;
    const { header, rows } = parseNumericCSV(dText);
    const iz = header.findIndex((h) => h.startsWith('z')), id = header.findIndex((h) => h.startsWith('d'));
    if (iz < 0 || id < 0 || !rows.length) return { error: 'Need columns: z_mm, diameter_mm' };
    const errs: number[] = [], devPct: number[] = [];
    for (const q of rows) {
      const i = Math.min(Math.max(Math.round(q[iz] / r.dz), 0), r.diaFinal.length - 1);
      const model = r.diaFinal[i];
      errs.push(model - q[id]);
      const measDev = q[id] - r.params.dT;
      if (Math.abs(measDev) > 1e-4) devPct.push(Math.abs((model - r.params.dT - measDev) / measDev) * 100);
    }
    const rmse = Math.sqrt(errs.reduce((a, e) => a + e * e, 0) / errs.length);
    const bias = errs.reduce((a, e) => a + e, 0) / errs.length;
    return { n: rows.length, rmse, bias, maxAbs: Math.max(...errs.map(Math.abs)), devPct: devPct.length ? devPct.reduce((a, b) => a + b, 0) / devPct.length : NaN };
  }, [dText, r]);
  const synthForces = () => {
    if (!st) return;
    const rows: (string | number)[][] = [['time_s', 'Fc_N', 'Ff_N', 'Fp_N']];
    for (let i = 0; i < 400; i++) { const n = () => (Math.random() - 0.5) * 0.08; rows.push([(i * 0.001).toFixed(3), (st.Fc * (1.08 + n())).toFixed(2), (st.Ff * (0.9 + n())).toFixed(2), (st.Fp * (1.15 + n())).toFixed(2)]); }
    download('SYNTHETIC-dynamometer-turning.csv', '# SYNTHETIC 3-component dynamometer record generated from the model (+8 % Fc, −10 % Ff, +15 % Fp, noise). NOT measured data.\n' + toCSV(rows));
  };
  const synthDia = () => {
    if (!r) return;
    const rows: (string | number)[][] = [['z_mm', 'diameter_mm']];
    for (let z = 30; z <= r.params.L - 10; z += 30) { const i = Math.round(z / r.dz); rows.push([z, (r.diaFinal[i] + 0.003 + (Math.random() - 0.5) * 0.004).toFixed(4)]); }
    download('SYNTHETIC-shaft-diameters.csv', '# SYNTHETIC micrometer readings generated from the model (+3 µm bias, ±2 µm noise). NOT measured data.\n' + toCSV(rows));
  };
  if (!r || !st) return null;
  return (
    <div className="space-y-3 text-[11px] text-slate-300">
      <div className="rounded bg-slate-900 p-2 ring-1 ring-slate-800">
        <h4 className="font-semibold text-slate-100">1 · Three-component dynamometer</h4>
        <p className="mt-1 text-slate-400">Upload <code>Fc_N, Ff_N, Fp_N</code> recorded during a steady cut. Mean magnitudes are compared with the model at the current playback station (Z = {st.z.toFixed(0)} mm, ap = {st.ap.toFixed(2)} mm). Match the cut conditions first.</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <input type="file" accept=".csv,.txt" onChange={read(setFText)} className="text-[11px]" />
          <Btn kind="ghost" onClick={synthForces}>synthetic example</Btn>
        </div>
        {forceCmp && 'error' in forceCmp && <p className="mt-1 text-rose-300">{forceCmp.error}</p>}
        {forceCmp && 'rows' in forceCmp && (
          <table className="mt-2 w-full tabular">
            <thead className="text-slate-500"><tr><th className="text-left">Component</th><th className="text-left">Measured (N)</th><th className="text-left">Model (N)</th><th className="text-left">Error</th></tr></thead>
            <tbody>{forceCmp.rows!.map((q) => <tr key={q.k}><td>{q.k}</td><td>{q.meas.toFixed(1)}</td><td>{q.model.toFixed(1)}</td><td>{q.pct.toFixed(1)} %</td></tr>)}</tbody>
          </table>
        )}
        <p className="mt-1 text-slate-500">To calibrate: repeat at two feeds; the slope of Fc vs f·ap gives Ktc and the intercept (per unit width) gives Kte; same for the force normal to the edge.</p>
      </div>
      <div className="rounded bg-slate-900 p-2 ring-1 ring-slate-800">
        <h4 className="font-semibold text-slate-100">2 · Measured shaft diameters</h4>
        <p className="mt-1 text-slate-400">Upload micrometer readings <code>z_mm, diameter_mm</code> (Z from the chuck face) and compare with the predicted profile.</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <input type="file" accept=".csv,.txt" onChange={read(setDText)} className="text-[11px]" />
          <Btn kind="ghost" onClick={synthDia}>synthetic example</Btn>
        </div>
        {diaCmp && 'error' in diaCmp && <p className="mt-1 text-rose-300">{diaCmp.error}</p>}
        {diaCmp && 'rmse' in diaCmp && (
          <table className="mt-2 w-full tabular"><tbody>
            <tr><td>Points</td><td>{diaCmp.n}</td></tr>
            <tr><td>RMSE</td><td>{(diaCmp.rmse! * 1000).toFixed(1)} µm</td></tr>
            <tr><td>Mean bias (model − measured)</td><td>{(diaCmp.bias! * 1000).toFixed(1)} µm</td></tr>
            <tr><td>Max |error|</td><td>{(diaCmp.maxAbs! * 1000).toFixed(1)} µm</td></tr>
            <tr><td>Mean % error of the deviation from nominal</td><td>{Number.isFinite(diaCmp.devPct) ? diaCmp.devPct!.toFixed(0) + ' %' : '—'}</td></tr>
          </tbody></table>
        )}
      </div>
      {err && <p className="text-rose-300">{err}</p>}
      <div className="rounded bg-amber-950/30 p-2 text-amber-100/90 ring-1 ring-amber-900">
        <b>Limitations to report:</b> quasi-static (no chatter or whirling), illustrative support stiffnesses, milling-derived coefficients, no thermal growth or tool wear, theoretical roughness only. Judge the model by the error of the <i>deviation</i> from nominal, not of the diameter itself.
      </div>
    </div>
  );
}

export function downloadReport4() {
  const st = useApp.getState(), ts = useTurning.getState();
  const sc = scoreTurning();
  const r = ts.result;
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  const ev = evaluateTurning(r);
  const q = TURNING_QUESTIONS.map((x) => { const a = st.answers[x.id]; return `<tr><td>${x.id}</td><td>${esc(x.prompt)}</td><td>${a === undefined ? '—' : esc(x.options[Number(a)])}</td><td>${a !== undefined && Number(a) === x.correct ? '✔' : '✘'}</td></tr>`; }).join('');
  const t = ts.trials.map((x) => `<tr><td>${esc(x.label)}</td><td>${x.params.workholding}${x.params.steadyRest ? ' + rest' : ''}</td><td>${x.params.strategy}</td><td>${x.params.f}</td><td>${x.params.noseR}</td><td>${x.summary.maxFp.toFixed(0)}</td><td>${(Math.max(Math.abs(x.summary.devMin), Math.abs(x.summary.devMax)) * 1000).toFixed(1)}</td><td>${x.summary.ra.toFixed(2)}</td><td>${x.summary.cycleTime.toFixed(0)}</td></tr>`).join('');
  const p = r?.params;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>MachinaForce 3D Module 4 report — ${esc(st.studentName || 'student')}</title>
<style>body{font:13px/1.45 system-ui,sans-serif;max-width:900px;margin:24px auto;color:#111}h1{font-size:20px}h2{font-size:15px;margin-top:22px;border-bottom:1px solid #ccc}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border:1px solid #ccc;padding:3px 5px;text-align:left}.note{background:#fff7e6;border:1px solid #f0c36d;padding:6px 8px}</style></head><body>
<h1>MachinaForce 3D — Module 4: Cutting forces in turning slender shafts</h1>
<p><b>Student:</b> ${esc(st.studentName || '—')} &nbsp; <b>Date:</b> ${new Date().toLocaleString()}</p>
<p class="note">Values are model estimates (illustrative coefficients and support stiffnesses; quasi-static beam model).</p>
<h2>Score</h2><p>Total <b>${sc.total} / ${sc.max}</b> — questions ${sc.mcq}/${sc.mcqMax}, production problem ${sc.solve}/3, justification ${sc.explain}/1.</p>
<h2>Final configuration</h2>${p && r ? `<table><tr><th>Shaft</th><td>${MATERIALS[p.materialId].name}, Ø${p.d0} → Ø${p.dT} ± ${p.tolerance} mm, L = ${p.L} mm (L/D ${r.summary.slenderness.toFixed(1)})</td></tr><tr><th>Workholding</th><td>${p.workholding}${p.steadyRest ? `, steady rest at Z = ${p.steadyZ} mm` : ''}</td></tr><tr><th>Tool & cut</th><td>κr ${p.kappa}°, rε ${p.noseR} mm; vc ${p.vc} m/min, f ${p.f} mm/rev, ${p.strategy}, feed ${p.feedDir}</td></tr><tr><th>Forces (max)</th><td>Fc ${r.summary.maxFc.toFixed(0)} N, Ff ${r.summary.maxFf.toFixed(0)} N, Fp ${r.summary.maxFp.toFixed(0)} N; power ${r.summary.maxPower.toFixed(2)} kW</td></tr><tr><th>Result</th><td>diameter deviation ${(r.summary.devMin * 1000).toFixed(1)} to ${(r.summary.devMax * 1000).toFixed(1)} µm; Ra ${r.summary.ra.toFixed(2)} µm; time ${r.summary.cycleTime.toFixed(0)} s</td></tr><tr><th>Production problem</th><td>${ev ? `setup ${ev.setupOK ? 'OK' : 'NOT as brief'}, diameter ${ev.tolOK ? 'met' : 'not met'}, Ra ${ev.raOK ? 'met' : 'not met'}, time ${ev.timeOK ? 'met' : 'not met'}` : '—'}</td></tr></table>` : '—'}
<h2>Engineering justification</h2><p>${esc(ts.solveNote || '—').replace(/\n/g, '<br>')}</p>
<h2>Questions</h2><table><tr><th>ID</th><th>Question</th><th>Answer</th><th></th></tr>${q}</table>
<h2>Experimental trials</h2><table><tr><th>Trial</th><th>Support</th><th>Strategy</th><th>f</th><th>rε</th><th>max Fp</th><th>max dev µm</th><th>Ra</th><th>time s</th></tr>${t || '<tr><td colspan=9>none saved</td></tr>'}</table>
</body></html>`;
  download(`machinaforce-m4-report-${(st.studentName || 'student').replace(/\W+/g, '_')}.html`, html, 'text/html');
  if (ts.trials.length) download('machinaforce-m4-trials.csv', turnTrialsCSV());
}

const INTRO: Record<Stage, { title: string; text: string }> = {
  observe: { title: 'Stage A · Observe (Module 4)', text: 'Press Play and watch the tool travel toward the chuck. Identify Fc (green arrow, −Y), Ff (blue, Z) and Fp (red, +X). Which is largest? Which bends the shaft? Then open “Diameter error profile” and “Shaft deflection”.' },
  experiment: { title: 'Stage B · Experiment (Module 4)', text: 'Predict, then change one thing: workholding, steady rest, nose radius, entering angle, feed, strategy. Use “Forces vs depth of cut” to see why the nose radius matters at small depths.' },
  solve: { title: 'Stage C · Solve (Module 4)', text: 'Bring a slender shaft into tolerance without losing surface finish or productivity.' },
  validate: { title: 'Validation (Module 4)', text: 'Compare with the lathe dynamometer (Fc, Ff, Fp) and with micrometer readings along the shaft.' },
};

export function StagePanel4() {
  const stage = useApp((s) => s.stage);
  const name = useApp((s) => s.studentName);
  const setName = useApp((s) => s.setStudentName);
  useApp((s) => s.answers); useTurning((s) => s.result); useTurning((s) => s.solveNote);
  const sc = scoreTurning();
  return (
    <div className="space-y-2 p-3">
      <div><h3 className="text-sm font-semibold text-slate-100">{INTRO[stage].title}</h3><p className="mt-1 text-[11px] leading-snug text-slate-400">{INTRO[stage].text}</p></div>
      {(stage === 'observe' || stage === 'experiment') && TURNING_QUESTIONS.filter((q) => q.stage === stage).map((q) => <Question key={q.id} q={q} />)}
      {stage === 'solve' && <Solve4 />}
      {stage === 'validate' && <Validate4 />}
      {stage !== 'validate' && (
        <div className="rounded bg-slate-900 p-2 ring-1 ring-slate-800">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-200">Module 4 score {sc.total} / {sc.max}</span><span className="text-[10px] text-slate-500">questions {sc.mcq}/{sc.mcqMax} · solve {sc.solve}/3 · explain {sc.explain}/1</span></div>
          <div className="mt-1.5 flex gap-1.5">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Student name / matric no." className="flex-1 rounded bg-slate-800 px-2 py-0.5 text-xs ring-1 ring-slate-700" />
            <Btn kind="primary" onClick={downloadReport4}>Report</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
