import { useState } from 'react';
import { useApp, type Stage } from '../../state/store';
import { useChatter, type MeasuredCut } from '../../state/chatterStore';
import { CHATTER_PROBLEM, CHATTER_QUESTIONS } from '../../content/chatter';
import { MATERIALS } from '../../physics/materials';
import { aLimAt, fitMode, type ChatterResult, type Mode } from '../../physics/chatter';
import { Btn, Tag } from '../controls';
import { Question } from '../StagePanel';
import { download, parseNumericCSV, toCSV } from '../../lib/csv';
import { chatterTrialsCSV } from './BottomPanel3';

const KEYWORDS = ['lobe', 'pocket', 'regenerat', 'chatter', 'stab', 'damping', 'stiff', 'frequency', 'phase', 'wav'];

export function evaluateChatter(r: ChatterResult | null) {
  if (!r) return null;
  const p = r.params, pr = CHATTER_PROBLEM;
  const same = (a: Mode, b: Mode) => a.fn === b.fn && a.zeta === b.zeta && a.k === b.k;
  const setupOK = p.materialId === pr.material && p.D === pr.D && p.N === pr.N && p.ae === pr.ae && p.coeffSource === 'illustrative' &&
    same(p.modeX, pr.mode) && same(p.modeY, pr.mode) && p.fz <= pr.maxFz + 1e-9 && p.rpm <= pr.maxRpm;
  return { setupOK, stable: r.sim.verdict === 'stable', mrrOK: r.mrr >= pr.minMRR, mrr: r.mrr };
}

export function scoreChatter() {
  const st = useApp.getState(), cs = useChatter.getState();
  const mcq = CHATTER_QUESTIONS.reduce((a, q) => a + (st.answers[q.id] !== undefined && Number(st.answers[q.id]) === q.correct ? 1 : 0), 0);
  const ev = evaluateChatter(cs.result);
  const words = cs.solveNote.trim().split(/\s+/).filter(Boolean).length;
  const kw = KEYWORDS.filter((k) => cs.solveNote.toLowerCase().includes(k)).length;
  const explain = words >= 30 && kw >= 2 ? 1 : 0;
  const solve = ev && ev.setupOK ? (ev.stable ? 2 : 0) + (ev.stable && ev.mrrOK ? 1 : 0) : 0;
  return { mcq, mcqMax: CHATTER_QUESTIONS.length, solve, explain, total: mcq + solve + explain, max: CHATTER_QUESTIONS.length + 4, words, kw };
}

function Solve3() {
  const r = useChatter((s) => s.result);
  const note = useChatter((s) => s.solveNote);
  const setNote = useChatter((s) => s.setSolveNote);
  const setParams = useChatter((s) => s.setParams);
  const pr = CHATTER_PROBLEM;
  const ev = evaluateChatter(r);
  const sc = scoreChatter();
  const load = () => setParams({
    materialId: pr.material, coeffs: { ...MATERIALS[pr.material].coeffs }, coeffSource: 'illustrative', D: pr.D, N: pr.N, ae: pr.ae,
    modeX: { ...pr.mode }, modeY: { ...pr.mode }, symmetric: true, rpmMin: 2000, rpmMax: 20000, ...pr.baseline,
  });
  return (
    <div className="space-y-2">
      <div className="rounded bg-slate-900 p-2 ring-1 ring-slate-800">
        <h4 className="text-xs font-semibold text-amber-200">{pr.title}</h4>
        <p className="mt-1 text-[11px] leading-snug text-slate-300">{pr.brief}</p>
        <div className="mt-2"><Btn onClick={load}>Load the current (chattering) programme</Btn></div>
        <p className="mt-1 text-[10px] text-slate-500">Fixed: material, tool D and N, ae, measured modal parameters, illustrative coefficients. Free: n (≤ 20 000 rpm), ap, fz (≤ 0.10 mm), milling mode.</p>
      </div>
      {ev && (
        <div className="grid grid-cols-3 gap-1.5 text-[11px]">
          <div className="rounded bg-slate-900 p-1.5 ring-1 ring-slate-800">Setup<br /><Tag kind={ev.setupOK ? 'ok' : 'fail'}>{ev.setupOK ? 'matches brief' : 'fixed item changed'}</Tag></div>
          <div className="rounded bg-slate-900 p-1.5 ring-1 ring-slate-800">Chatter-free<br /><Tag kind={ev.stable ? 'ok' : 'fail'}>{ev.stable ? 'stable' : 'chatter'}</Tag></div>
          <div className="rounded bg-slate-900 p-1.5 ring-1 ring-slate-800">MRR<br /><Tag kind={ev.mrrOK ? 'ok' : 'fail'}>{(ev.mrr / 1000).toFixed(1)}k / {pr.minMRR / 1000}k</Tag></div>
        </div>
      )}
      <div>
        <label className="text-[11px] text-slate-300">Engineering justification (≥ 30 words): why is your choice stable, and how did the lobe diagram guide it?</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={5} className="mt-1 w-full rounded bg-slate-800 p-2 text-xs text-slate-100 ring-1 ring-slate-700" placeholder="Explain using lobes, pockets, regeneration, phase, damping, stiffness…" />
        <div className="text-[10px] text-slate-500">{sc.words} words · {sc.kw} key concepts detected. Your lecturer grades the reasoning.</div>
      </div>
      {CHATTER_QUESTIONS.filter((q) => q.stage === 'solve').map((q) => <Question key={q.id} q={q} />)}
    </div>
  );
}

function Validate3() {
  const r = useChatter((s) => s.result);
  const measured = useChatter((s) => s.measured);
  const setMeasured = useChatter((s) => s.setMeasured);
  const setParams = useChatter((s) => s.setParams);
  const [fit, setFit] = useState<Mode | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const readFile = (cb: (t: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 20e6) { setErr('File larger than 20 MB'); return; }
    f.text().then((t) => { setErr(null); cb(t); });
  };
  const onFrf = (text: string) => {
    const { header, rows } = parseNumericCSV(text);
    const iF = header.findIndex((h) => h.startsWith('f')), iR = header.findIndex((h) => h.startsWith('re')), iI = header.findIndex((h) => h.startsWith('im'));
    if (iF < 0 || iR < 0 || iI < 0) { setErr('Need columns: freq_hz, real, imag (receptance, m/N unless the header says mm)'); return; }
    const scale = header[iR].includes('mm') ? 1 : 1000; // m/N → mm/N
    const m = fitMode(rows.map((q) => q[iF]), rows.map((q) => q[iR] * scale), rows.map((q) => q[iI] * scale));
    if (!m) { setErr('Could not identify a dominant mode (need a clear resonance peak with negative imaginary part).'); return; }
    setFit({ fn: Math.round(m.fn), zeta: Math.round(m.zeta * 1000) / 1000, k: Math.round(m.k) });
  };
  const onCuts = (text: string) => {
    const { header, rows } = parseNumericCSV(text);
    const iN = header.findIndex((h) => h.startsWith('rpm') || h.startsWith('n')), iA = header.findIndex((h) => h.startsWith('ap')), iC = header.findIndex((h) => h.startsWith('chat') || h.startsWith('result'));
    if (iN < 0 || iA < 0 || iC < 0) { setErr('Need columns: rpm, ap_mm, chatter (1 = chatter, 0 = stable)'); return; }
    setMeasured(rows.map((q) => ({ rpm: q[iN], ap: q[iA], chatter: q[iC] >= 0.5 })));
  };
  const agree = r && measured.length ? measured.filter((m) => (m.ap >= aLimAt(r.lobes.curves, m.rpm)) === m.chatter).length / measured.length : NaN;
  const synthFrf = () => {
    const m = { fn: 640, zeta: 0.035, k: 6200 };
    const rows: (string | number)[][] = [['freq_hz', 'real', 'imag']];
    for (let f = 100; f <= 2000; f += 2) {
      const rr = f / m.fn, den = (1 - rr * rr) ** 2 + (2 * m.zeta * rr) ** 2;
      const noise = 1 + (Math.random() - 0.5) * 0.04;
      rows.push([f, (((1 - rr * rr) / den / m.k) * noise / 1000).toExponential(5), (((-2 * m.zeta * rr) / den / m.k) * noise / 1000).toExponential(5)]);
    }
    download('SYNTHETIC-tap-test-FRF.csv', '# SYNTHETIC tap-test receptance (m/N) for practice: fn 640 Hz, zeta 0.035, k 6.2 N/um, ±2 % noise. NOT measured data.\n' + toCSV(rows));
  };
  const synthCuts = () => {
    if (!r) return;
    const rows: (string | number)[][] = [['rpm', 'ap_mm', 'chatter']];
    for (const n of [4000, 6000, 8000, 9000, 10000, 12000, 15000]) for (const a of [0.4, 1, 2, 4]) rows.push([n, a, a >= 0.9 * aLimAt(r.lobes.curves, n) ? 1 : 0]);
    download('SYNTHETIC-cutting-tests.csv', '# SYNTHETIC cutting-test results generated from the model lobes (10 % conservative). NOT measured data.\n' + toCSV(rows));
  };
  return (
    <div className="space-y-3 text-[11px] text-slate-300">
      <div className="rounded bg-slate-900 p-2 ring-1 ring-slate-800">
        <h4 className="font-semibold text-slate-100">1 · Tap test → modal parameters</h4>
        <p className="mt-1 text-slate-400">Upload the measured tool-tip receptance (impact hammer + accelerometer, integrated to displacement): CSV <code>freq_hz, real, imag</code> in m/N. The dominant mode is identified by peak picking (half-power bandwidth for ζ, k = −1/(2ζ·Im_min)).</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <input type="file" accept=".csv,.txt" onChange={readFile(onFrf)} className="text-[11px]" />
          <Btn kind="ghost" onClick={synthFrf}>synthetic example</Btn>
        </div>
        {fit && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="tabular">fn = {fit.fn} Hz · ζ = {fit.zeta} · k = {(fit.k / 1000).toFixed(2)} N/µm</span>
            <Btn kind="primary" onClick={() => setParams({ modeX: fit, modeY: { ...fit }, symmetric: true })}>Apply to x and y</Btn>
            <Btn onClick={() => { const cur = useChatter.getState().params; setParams({ modeY: fit, symmetric: false, modeX: { ...cur.modeX } }); }}>Apply to y only</Btn>
          </div>
        )}
      </div>
      <div className="rounded bg-slate-900 p-2 ring-1 ring-slate-800">
        <h4 className="font-semibold text-slate-100">2 · Cutting tests → compare with the lobes</h4>
        <p className="mt-1 text-slate-400">Upload your test cuts: CSV <code>rpm, ap_mm, chatter</code> (1 = chatter heard/seen or a chatter peak in the sound spectrum, 0 = stable). They appear on the lobe diagram.</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <input type="file" accept=".csv,.txt" onChange={readFile(onCuts)} className="text-[11px]" />
          <Btn kind="ghost" onClick={synthCuts}>synthetic example</Btn>
          {measured.length > 0 && <Btn kind="ghost" onClick={() => setMeasured([])}>clear</Btn>}
        </div>
        {measured.length > 0 && <p className="mt-1 tabular">{measured.length} cuts · ZOA lobes classify {(agree * 100).toFixed(0)} % of them correctly.</p>}
      </div>
      {err && <p className="text-rose-300">{err}</p>}
      <div className="rounded bg-amber-950/30 p-2 text-amber-100/90 ring-1 ring-amber-900">
        <b>Limitations to report:</b> one mode per direction; no process damping (it stabilises low speeds in practice); spindle dynamics can change with speed; runout and variable pitch ignored; lobe heights depend on Kt and Kr, so use calibrated coefficients for quantitative comparison.
      </div>
    </div>
  );
}

export function downloadReport3() {
  const st = useApp.getState(), cs = useChatter.getState();
  const sc = scoreChatter();
  const r = cs.result;
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  const ev = evaluateChatter(r);
  const q = CHATTER_QUESTIONS.map((x) => { const a = st.answers[x.id]; return `<tr><td>${x.id}</td><td>${esc(x.prompt)}</td><td>${a === undefined ? '—' : esc(x.options[Number(a)])}</td><td>${a !== undefined && Number(a) === x.correct ? '✔' : '✘'}</td></tr>`; }).join('');
  const t = cs.trials.map((x) => `<tr><td>${esc(x.label)}</td><td>${x.params.rpm}</td><td>${x.params.ap}</td><td>${x.params.ae}</td><td>${x.summary.aLimHere.toFixed(2)}</td><td>${x.summary.verdict}</td><td>${x.summary.domFreq.toFixed(0)}</td><td>${(x.summary.ppY * 1000).toFixed(1)}</td><td>${x.summary.mrr.toFixed(0)}</td></tr>`).join('');
  const p = r?.params;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>MachinaForce 3D Module 3 report — ${esc(st.studentName || 'student')}</title>
<style>body{font:13px/1.45 system-ui,sans-serif;max-width:900px;margin:24px auto;color:#111}h1{font-size:20px}h2{font-size:15px;margin-top:22px;border-bottom:1px solid #ccc}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border:1px solid #ccc;padding:3px 5px;text-align:left}.note{background:#fff7e6;border:1px solid #f0c36d;padding:6px 8px}</style></head><body>
<h1>MachinaForce 3D — Module 3: Chatter and dynamic instability</h1>
<p><b>Student:</b> ${esc(st.studentName || '—')} &nbsp; <b>Date:</b> ${new Date().toLocaleString()}</p>
<p class="note">Results are model estimates (illustrative modal parameters and cutting coefficients unless measured). Stability by ZOA lobes and time-domain simulation.</p>
<h2>Score</h2><p>Total <b>${sc.total} / ${sc.max}</b> — questions ${sc.mcq}/${sc.mcqMax}, production problem ${sc.solve}/3, justification ${sc.explain}/1.</p>
<h2>Final configuration</h2>${p && r ? `<table><tr><th>Cut</th><td>n = ${p.rpm} rpm, ap = ${p.ap} mm, ae = ${p.ae} mm, fz = ${p.fz} mm, ${p.mode}-milling; D = ${p.D} mm, N = ${p.N}</td></tr><tr><th>Modes</th><td>x: ${p.modeX.fn} Hz, ζ ${p.modeX.zeta}, k ${(p.modeX.k / 1000).toFixed(1)} N/µm · y: ${p.modeY.fn} Hz, ζ ${p.modeY.zeta}, k ${(p.modeY.k / 1000).toFixed(1)} N/µm</td></tr><tr><th>Stability</th><td>ZOA limit at this speed ${r.aLimHere.toFixed(2)} mm (absolute ${r.lobes.aMin.toFixed(2)} mm); time-domain: <b>${r.sim.verdict}</b> (scatter ${r.sim.chatterRatio.toFixed(2)}, dominant ${r.sim.domFreq.toFixed(0)} Hz)</td></tr><tr><th>Productivity</th><td>MRR ${r.mrr.toFixed(0)} mm³/min</td></tr><tr><th>Production problem</th><td>${ev ? `setup ${ev.setupOK ? 'OK' : 'NOT as brief'}, ${ev.stable ? 'chatter-free' : 'chatter'}, MRR ${ev.mrrOK ? 'met' : 'not met'}` : '—'}</td></tr></table>` : '—'}
<h2>Engineering justification</h2><p>${esc(cs.solveNote || '—').replace(/\n/g, '<br>')}</p>
<h2>Questions</h2><table><tr><th>ID</th><th>Question</th><th>Answer</th><th></th></tr>${q}</table>
<h2>Experimental trials</h2><table><tr><th>Trial</th><th>n</th><th>ap</th><th>ae</th><th>ZOA a_lim</th><th>verdict</th><th>f dom</th><th>p-p µm</th><th>MRR</th></tr>${t || '<tr><td colspan=9>none saved</td></tr>'}</table>
</body></html>`;
  download(`machinaforce-m3-report-${(st.studentName || 'student').replace(/\W+/g, '_')}.html`, html, 'text/html');
  if (cs.trials.length) download('machinaforce-m3-trials.csv', chatterTrialsCSV());
}

const INTRO: Record<Stage, { title: string; text: string }> = {
  observe: { title: 'Stage A · Observe (Module 3)', text: 'The baseline cut chatters. Press Play: watch the tool shake and the chatter marks appear on the machined face. Then open “Vibration vs time” and “Vibration spectrum”. Now set n = 9 000 rpm and compare: forced vibration only.' },
  experiment: { title: 'Stage B · Experiment (Module 3)', text: 'Predict, then change one thing: damping, stiffness, natural frequency, radial depth, speed. Use the lobe diagram to choose points above and below the curve and confirm them with the time-domain verdict.' },
  solve: { title: 'Stage C · Solve (Module 3)', text: 'Remove chatter AND triple productivity by choosing the right spindle speed and depth — the measured tool cannot be changed.' },
  validate: { title: 'Validation (Module 3)', text: 'Bring the lab in: fit the tool’s modal parameters from a tap test, then plot your cutting tests on the lobe diagram.' },
};

export function StagePanel3() {
  const stage = useApp((s) => s.stage);
  const name = useApp((s) => s.studentName);
  const setName = useApp((s) => s.setStudentName);
  useApp((s) => s.answers); useChatter((s) => s.result); useChatter((s) => s.solveNote);
  const sc = scoreChatter();
  return (
    <div className="space-y-2 p-3">
      <div><h3 className="text-sm font-semibold text-slate-100">{INTRO[stage].title}</h3><p className="mt-1 text-[11px] leading-snug text-slate-400">{INTRO[stage].text}</p></div>
      {(stage === 'observe' || stage === 'experiment') && CHATTER_QUESTIONS.filter((q) => q.stage === stage).map((q) => <Question key={q.id} q={q} />)}
      {stage === 'solve' && <Solve3 />}
      {stage === 'validate' && <Validate3 />}
      {stage !== 'validate' && (
        <div className="rounded bg-slate-900 p-2 ring-1 ring-slate-800">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-200">Module 3 score {sc.total} / {sc.max}</span><span className="text-[10px] text-slate-500">questions {sc.mcq}/{sc.mcqMax} · solve {sc.solve}/3 · explain {sc.explain}/1</span></div>
          <div className="mt-1.5 flex gap-1.5">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Student name / matric no." className="flex-1 rounded bg-slate-800 px-2 py-0.5 text-xs ring-1 ring-slate-700" />
            <Btn kind="primary" onClick={downloadReport3}>Report</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

export type { MeasuredCut };
