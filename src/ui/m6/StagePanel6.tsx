import { useMemo, useState } from 'react';
import { useApp, type Stage } from '../../state/store';
import { useToolWear } from '../../state/toolWearStore';
import { TOOLWEAR_PROBLEM, TOOLWEAR_QUESTIONS } from '../../content/toolWear';
import { MATERIALS } from '../../physics/materials';
import { defaultWear, DEFAULT_TOOLWEAR, fitWearCoefficients, fitWearRate, vbAt, wearRate, wearState, type WearResult } from '../../physics/toolWear';
import { Btn, Tag } from '../controls';
import { Question } from '../StagePanel';
import { download, parseNumericCSV, toCSV } from '../../lib/csv';
import { wearTrialsCSV } from './BottomPanel6';

const KEYWORDS = ['wear', 'flank', 'vb', 'edge', 'plough', 'rub', 'speed', 'feed', 'tool change', 'criterion', 'force', 'power'];

export function evaluateToolWear(r: WearResult | null) {
  if (!r) return null;
  const p = r.params, pr = TOOLWEAR_PROBLEM, d = DEFAULT_TOOLWEAR, w = defaultWear(pr.material);
  const setupOK = p.materialId === pr.material && p.coeffSource === 'illustrative' && p.wearSource === 'illustrative' &&
    p.wear.ate === w.ate && p.wear.are === w.are && p.wear.aae === w.aae && p.D === d.D && p.N === d.N && p.ap === d.ap && p.ae === d.ae && p.mode === d.mode &&
    p.A === d.A && p.vref === d.vref && p.fref === d.fref && p.p === d.p && p.q === d.q && p.VB0 === 0 && p.partLength === d.partLength && p.batch === d.batch && p.toolChange === d.toolChange && p.growthMode;
  const pl = r.plan;
  return {
    setupOK,
    critOK: p.VBcrit <= pr.maxCrit + 1e-9,
    toolsOK: pl.tools <= pr.maxTools,
    timeOK: pl.totalTime <= pr.maxTime,
    forceOK: r.atCrit.peakRes <= pr.maxPeakForce,
    powerOK: r.atCrit.power <= p.spindlePower,
    tools: pl.tools, time: pl.totalTime, peak: r.atCrit.peakRes,
  };
}

export function scoreToolWear() {
  const st = useApp.getState(), ws = useToolWear.getState();
  const mcq = TOOLWEAR_QUESTIONS.reduce((a, q) => a + (st.answers[q.id] !== undefined && Number(st.answers[q.id]) === q.correct ? 1 : 0), 0);
  const ev = evaluateToolWear(ws.result);
  const words = ws.solveNote.trim().split(/\s+/).filter(Boolean).length;
  const kw = KEYWORDS.filter((k) => ws.solveNote.toLowerCase().includes(k)).length;
  const explain = words >= 30 && kw >= 2 ? 1 : 0;
  const solve = ev && ev.setupOK && ev.critOK && ev.powerOK ? (ev.toolsOK && ev.timeOK ? 2 : 0) + (ev.forceOK ? 1 : 0) : 0;
  return { mcq, mcqMax: TOOLWEAR_QUESTIONS.length, solve, explain, total: mcq + solve + explain, max: TOOLWEAR_QUESTIONS.length + 4, words, kw };
}

function Solve6() {
  const r = useToolWear((s) => s.result);
  const note = useToolWear((s) => s.solveNote);
  const setNote = useToolWear((s) => s.setSolveNote);
  const setParams = useToolWear((s) => s.setParams);
  const pr = TOOLWEAR_PROBLEM, d = DEFAULT_TOOLWEAR;
  const ev = evaluateToolWear(r);
  const sc = scoreToolWear();
  const load = () => setParams({ materialId: pr.material, coeffs: { ...MATERIALS[pr.material].coeffs }, coeffSource: 'illustrative', wear: defaultWear(pr.material), wearSource: 'illustrative',
    D: d.D, N: d.N, ap: d.ap, ae: d.ae, mode: d.mode, A: d.A, vref: d.vref, fref: d.fref, p: d.p, q: d.q, VB0: 0, partLength: d.partLength, batch: d.batch, toolChange: d.toolChange, spindlePower: d.spindlePower, ...pr.baseline });
  const cell = (label: string, ok: boolean, text: string) => <div className="rounded bg-slate-900 p-1.5 ring-1 ring-slate-800">{label}<br /><Tag kind={ok ? 'ok' : 'fail'}>{text}</Tag></div>;
  return (
    <div className="space-y-2">
      <div className="rounded bg-slate-900 p-2 ring-1 ring-slate-800">
        <h4 className="text-xs font-semibold text-amber-200">{pr.title}</h4>
        <p className="mt-1 text-[11px] leading-snug text-slate-300">{pr.brief}</p>
        <div className="mt-2"><Btn onClick={load}>Load the current (failing) programme</Btn></div>
        <p className="mt-1 text-[10px] text-slate-500">Fixed: material, tool, ap, ae, mode, part length, batch, change time, illustrative cutting/wear coefficients and rate model (growth mode on). Free: vc, fz, replacement criterion (≤ {pr.maxCrit} mm).</p>
      </div>
      {ev && (
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          {cell('Setup', ev.setupOK && ev.critOK && ev.powerOK, !ev.setupOK ? 'fixed item changed' : !ev.critOK ? `criterion > ${pr.maxCrit} mm` : !ev.powerOK ? 'power exceeded' : 'matches brief')}
          {cell('Tools', ev.toolsOK, `${Number.isFinite(ev.tools) ? ev.tools : '∞'} / ≤ ${pr.maxTools}`)}
          {cell('Total time', ev.timeOK, `${Number.isFinite(ev.time) ? ev.time.toFixed(1) : '∞'} / ≤ ${pr.maxTime} min`)}
          {cell('Peak force at criterion', ev.forceOK, `${ev.peak.toFixed(0)} / ≤ ${pr.maxPeakForce} N`)}
        </div>
      )}
      <div>
        <label className="text-[11px] text-slate-300">Engineering justification (≥ 30 words): how do speed and feed change the wear per part, the number of tools and the force at the end of tool life?</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={5} className="mt-1 w-full rounded bg-slate-800 p-2 text-xs text-slate-100 ring-1 ring-slate-700" placeholder="Explain using wear rate, time per part, tool changes, edge forces at VB = criterion…" />
        <div className="text-[10px] text-slate-500">{sc.words} words · {sc.kw} key concepts detected. Your lecturer grades the reasoning.</div>
      </div>
      {TOOLWEAR_QUESTIONS.filter((q) => q.stage === 'solve').map((q) => <Question key={q.id} q={q} />)}
    </div>
  );
}

function Validate6() {
  const r = useToolWear((s) => s.result);
  const setParams = useToolWear((s) => s.setParams);
  const [fText, setFText] = useState<string | null>(null);
  const [wText, setWText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const read = (cb: (t: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 20e6) { setErr('File larger than 20 MB'); return; }
    f.text().then((t) => { setErr(null); cb(t); });
  };
  const forceFit = useMemo(() => {
    if (!fText || !r) return null;
    const { header, rows } = parseNumericCSV(fText);
    const c = (n: string) => header.findIndex((h) => h.startsWith(n));
    const iv = c('vb'), ix = c('fx'), iy = c('fy'), iz = c('fz');
    if ([iv, ix, iy, iz].some((i) => i < 0) || rows.length < 2) return { error: 'Need ≥ 2 rows with columns: VB_mm, Fx_N, Fy_N, Fz_N (mean forces per revolution, feed frame, on the tool, at the current cutting conditions)' };
    const data = rows.map((q) => ({ VB: q[iv], Fx: q[ix], Fy: q[iy], Fz: q[iz] }));
    const cmp = data.map((d) => { const s = wearState(r.params, d.VB); const m = Math.hypot(d.Fx, d.Fy, d.Fz); return { VB: d.VB, meas: m, model: s.meanRes, pct: m > 0 ? ((s.meanRes - m) / m) * 100 : NaN }; });
    return { cmp, fit: fitWearCoefficients(r.params, data) };
  }, [fText, r]);
  const rateFit = useMemo(() => {
    if (!wText || !r) return null;
    const { header, rows } = parseNumericCSV(wText);
    const it = header.findIndex((h) => h.startsWith('t')), iv = header.findIndex((h) => h.startsWith('vb'));
    if (it < 0 || iv < 0 || rows.length < 2) return { error: 'Need ≥ 2 rows with columns: time_min, VB_mm' };
    const data = rows.map((q) => ({ t: q[it], VB: q[iv] }));
    const fit = fitWearRate(data);
    const rms = Math.sqrt(data.reduce((a, d) => a + (vbAt(r.params, d.t) - d.VB) ** 2, 0) / data.length);
    return { fit, rms, model: wearRate(r.params), n: data.length };
  }, [wText, r]);
  const synthForce = () => {
    if (!r) return;
    const rows: (string | number)[][] = [['VB_mm', 'Fx_N', 'Fy_N', 'Fz_N']];
    for (const VB of [0, 0.08, 0.16, 0.24, 0.32]) { const s = wearState({ ...r.params, wear: { ate: r.params.wear.ate * 1.3, are: r.params.wear.are * 0.8, aae: r.params.wear.aae } }, VB); const n = () => 1 + (Math.random() - 0.5) * 0.04; rows.push([VB, (s.mean.Fx * n()).toFixed(1), (s.mean.Fy * n()).toFixed(1), (s.mean.Fz * n()).toFixed(1)]); }
    download('SYNTHETIC-force-vs-VB.csv', '# SYNTHETIC mean forces generated from the model with ate ×1.3, are ×0.8 and ±2 % noise. NOT measured data.\n' + toCSV(rows));
  };
  const synthWear = () => {
    if (!r) return;
    const rows: (string | number)[][] = [['time_min', 'VB_mm']];
    const rate = wearRate(r.params) * 0.8;
    for (let t = 0; t <= 6; t++) { const tm = ((t / 6) * 0.9 * r.params.VBcrit) / Math.max(rate, 1e-9); rows.push([tm.toFixed(2), Math.max(0, 0.02 + rate * tm + (Math.random() - 0.5) * 0.01).toFixed(3)]); }
    download('SYNTHETIC-VB-vs-time.csv', '# SYNTHETIC tool-microscope readings (rate ×0.8, 0.02 mm offset, ±5 µm noise). NOT measured data.\n' + toCSV(rows));
  };
  if (!r) return null;
  return (
    <div className="space-y-3 text-[11px] text-slate-300">
      <div className="rounded bg-slate-900 p-2 ring-1 ring-slate-800">
        <h4 className="font-semibold text-slate-100">1 · Forces measured at several wear levels → wear coefficients</h4>
        <p className="mt-1 text-slate-400">Cut at the current conditions with tools of known VB (measured under a tool microscope), record mean Fx, Fy, Fz on the dynamometer, upload <code>VB_mm, Fx_N, Fy_N, Fz_N</code>. The force is linear in the edge coefficients, so the slopes of the measured forces against VB give ate, are, aae by least squares.</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2"><input type="file" accept=".csv,.txt" onChange={read(setFText)} className="text-[11px]" /><Btn kind="ghost" onClick={synthForce}>synthetic example</Btn></div>
        {forceFit && 'error' in forceFit && <p className="mt-1 text-rose-300">{forceFit.error}</p>}
        {forceFit && 'cmp' in forceFit && (
          <>
            <table className="mt-2 w-full tabular">
              <thead className="text-slate-500"><tr><th className="text-left">VB mm</th><th className="text-left">measured |F̄| N</th><th className="text-left">model N</th><th className="text-left">error</th></tr></thead>
              <tbody>{forceFit.cmp!.map((q, i) => <tr key={i}><td>{q.VB.toFixed(2)}</td><td>{q.meas.toFixed(0)}</td><td>{q.model.toFixed(0)}</td><td>{q.pct.toFixed(1)} %</td></tr>)}</tbody>
            </table>
            {forceFit.fit ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span>Fitted: ate {forceFit.fit.ate.toFixed(0)}, are {forceFit.fit.are.toFixed(0)}, aae {forceFit.fit.aae.toFixed(1)} N/mm²</span>
                <Btn onClick={() => setParams({ wear: forceFit.fit!, wearSource: 'calibrated' })}>Use fitted coefficients</Btn>
              </div>
            ) : <p className="mt-1 text-rose-300">Could not fit (need different VB values).</p>}
          </>
        )}
      </div>
      <div className="rounded bg-slate-900 p-2 ring-1 ring-slate-800">
        <h4 className="font-semibold text-slate-100">2 · Measured wear progression → wear rate</h4>
        <p className="mt-1 text-slate-400">Upload <code>time_min, VB_mm</code> from interrupted cutting tests at the current vc and fz. A straight-line fit gives the measured rate (compare with the model rate and adjust A). Real wear curves usually show running-in, steady and accelerated stages: fit only the steady part.</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2"><input type="file" accept=".csv,.txt" onChange={read(setWText)} className="text-[11px]" /><Btn kind="ghost" onClick={synthWear}>synthetic example</Btn></div>
        {rateFit && 'error' in rateFit && <p className="mt-1 text-rose-300">{rateFit.error}</p>}
        {rateFit && 'fit' in rateFit && rateFit.fit && (
          <table className="mt-2 w-full tabular"><tbody>
            <tr><td>Points</td><td>{rateFit.n}</td></tr>
            <tr><td>Measured rate</td><td>{(rateFit.fit.rate * 1000).toFixed(2)} µm/min (intercept {rateFit.fit.VB0.toFixed(3)} mm)</td></tr>
            <tr><td>Model rate</td><td>{(rateFit.model! * 1000).toFixed(2)} µm/min</td></tr>
            <tr><td>RMS (model − measured) VB</td><td>{(rateFit.rms! * 1000).toFixed(1)} µm</td></tr>
          </tbody></table>
        )}
      </div>
      {err && <p className="text-rose-300">{err}</p>}
      <div className="rounded bg-amber-950/30 p-2 text-amber-100/90 ring-1 ring-amber-900">
        <b>Limitations to report:</b> uniform flank wear on all teeth; edge-force growth linear in VB; no crater wear, chipping, built-up edge, runout, temperature or coolant effects; constant wear rate (no running-in or accelerated stage); roughness only as a qualitative risk. The wear-rate model is not a tool-life prediction until A, p, q are fitted over a range of speeds and feeds.
      </div>
    </div>
  );
}

export function downloadReport6() {
  const st = useApp.getState(), ws = useToolWear.getState();
  const sc = scoreToolWear();
  const r = ws.result;
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  const ev = evaluateToolWear(r);
  const q = TOOLWEAR_QUESTIONS.map((x) => { const a = st.answers[x.id]; return `<tr><td>${x.id}</td><td>${esc(x.prompt)}</td><td>${a === undefined ? '—' : esc(x.options[Number(a)])}</td><td>${a !== undefined && Number(a) === x.correct ? '✔' : '✘'}</td></tr>`; }).join('');
  const t = ws.trials.map((x) => `<tr><td>${esc(x.label)}</td><td>${x.summary.VB.toFixed(2)}</td><td>${x.params.vc}</td><td>${x.params.fz}</td><td>${x.summary.peakRes.toFixed(0)}</td><td>${(x.summary.increase * 100).toFixed(0)} %</td><td>${x.summary.peakAtCrit.toFixed(0)}</td><td>${x.summary.partsPerTool}</td><td>${x.summary.tools ?? '∞'}</td><td>${x.summary.totalTime !== null && Number.isFinite(x.summary.totalTime) ? x.summary.totalTime.toFixed(1) : '∞'}</td></tr>`).join('');
  const p = r?.params;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>MachinaForce 3D Module 6 report — ${esc(st.studentName || 'student')}</title>
<style>body{font:13px/1.45 system-ui,sans-serif;max-width:900px;margin:24px auto;color:#111}h1{font-size:20px}h2{font-size:15px;margin-top:22px;border-bottom:1px solid #ccc}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border:1px solid #ccc;padding:3px 5px;text-align:left}.note{background:#fff7e6;border:1px solid #f0c36d;padding:6px 8px}</style></head><body>
<h1>MachinaForce 3D — Module 6: Tool wear evolution and cutting force</h1>
<p><b>Student:</b> ${esc(st.studentName || '—')} &nbsp; <b>Date:</b> ${new Date().toLocaleString()}</p>
<p class="note">Values are model estimates (illustrative cutting and wear coefficients; illustrative wear-rate model, not a validated tool-life prediction; roughness only as a qualitative risk).</p>
<h2>Score</h2><p>Total <b>${sc.total} / ${sc.max}</b> — questions ${sc.mcq}/${sc.mcqMax}, production problem ${sc.solve}/3, justification ${sc.explain}/1.</p>
<h2>Final configuration</h2>${p && r ? `<table><tr><th>Tool & cut</th><td>${MATERIALS[p.materialId].name}; Ø${p.D} mm, ${p.N} flutes; vc ${p.vc} m/min, fz ${p.fz} mm, ap ${p.ap} mm, ae ${p.ae} mm, ${p.mode}-milling</td></tr><tr><th>Wear</th><td>${p.growthMode ? `growth mode, rate ${(r.plan.rate * 1000).toFixed(2)} µm/min` : `manual VB ${p.VB.toFixed(2)} mm`}; criterion ${p.VBcrit.toFixed(2)} mm; ate ${p.wear.ate}, are ${p.wear.are}, aae ${p.wear.aae} N/mm² (${p.wearSource})</td></tr><tr><th>Forces</th><td>fresh mean ${r.fresh.meanRes.toFixed(0)} N, peak ${r.fresh.peakRes.toFixed(0)} N; at criterion mean ${r.atCrit.meanRes.toFixed(0)} N, peak ${r.atCrit.peakRes.toFixed(0)} N; power ${r.fresh.power.toFixed(3)} → ${r.atCrit.power.toFixed(3)} kW</td></tr><tr><th>Production</th><td>${r.plan.partsPerTool} parts per tool, ${Number.isFinite(r.plan.tools) ? r.plan.tools : '∞'} tools, total ${Number.isFinite(r.plan.totalTime) ? r.plan.totalTime.toFixed(1) : '∞'} min</td></tr><tr><th>Production problem</th><td>${ev ? `setup ${ev.setupOK && ev.critOK && ev.powerOK ? 'OK' : 'NOT as brief'}, tools ${ev.toolsOK ? 'met' : 'not met'}, time ${ev.timeOK ? 'met' : 'not met'}, force ${ev.forceOK ? 'met' : 'not met'}` : '—'}</td></tr></table>` : '—'}
<h2>Engineering justification</h2><p>${esc(ws.solveNote || '—').replace(/\n/g, '<br>')}</p>
<h2>Questions</h2><table><tr><th>ID</th><th>Question</th><th>Answer</th><th></th></tr>${q}</table>
<h2>Experimental trials</h2><table><tr><th>Trial</th><th>VB</th><th>vc</th><th>fz</th><th>peak F</th><th>increase</th><th>F at criterion</th><th>parts/tool</th><th>tools</th><th>time min</th></tr>${t || '<tr><td colspan=10>none saved</td></tr>'}</table>
</body></html>`;
  download(`machinaforce-m6-report-${(st.studentName || 'student').replace(/\W+/g, '_')}.html`, html, 'text/html');
  if (ws.trials.length) download('machinaforce-m6-trials.csv', wearTrialsCSV());
}

const INTRO: Record<Stage, { title: string; text: string }> = {
  observe: { title: 'Stage A · Observe (Module 6)', text: 'Move the VB slider from 0 to 0.3 mm and watch the wear land grow in the close-up and on the flutes, and the force arrows lengthen. Open “Forces vs cutter angle” (fresh dashed vs worn) and “Fresh vs worn”. Which component grows most?' },
  experiment: { title: 'Stage B · Experiment (Module 6)', text: 'Predict, then test: force and power versus VB, the effect of ae and fz on the wear sensitivity, and (growth mode) how vc and fz change the time to the criterion and the parts per tool.' },
  solve: { title: 'Stage C · Solve (Module 6)', text: 'Balance tool changes, cycle time and the force at the end of tool life for a titanium batch.' },
  validate: { title: 'Validation (Module 6)', text: 'Fit the wear coefficients from forces measured with worn tools, and check the wear rate with tool-microscope readings.' },
};

export function StagePanel6() {
  const stage = useApp((s) => s.stage);
  const name = useApp((s) => s.studentName);
  const setName = useApp((s) => s.setStudentName);
  useApp((s) => s.answers); useToolWear((s) => s.result); useToolWear((s) => s.solveNote);
  const sc = scoreToolWear();
  return (
    <div className="space-y-2 p-3">
      <div><h3 className="text-sm font-semibold text-slate-100">{INTRO[stage].title}</h3><p className="mt-1 text-[11px] leading-snug text-slate-400">{INTRO[stage].text}</p></div>
      {(stage === 'observe' || stage === 'experiment') && TOOLWEAR_QUESTIONS.filter((q) => q.stage === stage).map((q) => <Question key={q.id} q={q} />)}
      {stage === 'solve' && <Solve6 />}
      {stage === 'validate' && <Validate6 />}
      {stage !== 'validate' && (
        <div className="rounded bg-slate-900 p-2 ring-1 ring-slate-800">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-200">Module 6 score {sc.total} / {sc.max}</span><span className="text-[10px] text-slate-500">questions {sc.mcq}/{sc.mcqMax} · solve {sc.solve}/3 · explain {sc.explain}/1</span></div>
          <div className="mt-1.5 flex gap-1.5">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Student name / matric no." className="flex-1 rounded bg-slate-800 px-2 py-0.5 text-xs ring-1 ring-slate-700" />
            <Btn kind="primary" onClick={downloadReport6}>Report</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
