import { useMemo, useState } from 'react';
import { useApp, type Stage } from '../../state/store';
import { useFixture } from '../../state/fixtureStore';
import { FIXTURE_PROBLEM, FIXTURE_QUESTIONS } from '../../content/fixture';
import { MATERIALS } from '../../physics/materials';
import { errorAt, staticPush, LAYOUT_INFO, type FixResult, type Vec3 } from '../../physics/fixture';
import { Btn, Tag } from '../controls';
import { Question } from '../StagePanel';
import { download, parseNumericCSV, toCSV } from '../../lib/csv';
import { fixTrialsCSV } from './BottomPanel5';

const KEYWORDS = ['locator', 'clamp', 'friction', 'slip', 'lift', 'stiff', 'moment', 'tilt', 'spread', 'feed direction', 'datum', '3-2-1'];

export function evaluateFixture(r: FixResult | null) {
  if (!r) return null;
  const p = r.params, s = r.summary, pr = FIXTURE_PROBLEM, b = pr.baseline;
  const setupOK = p.materialId === pr.material && p.coeffSource === 'illustrative' && Math.abs(p.tolerance - pr.tolerance) < 1e-9 &&
    p.ap === b.ap && p.D === 16 && p.N === 4 && p.rpm === 2500 && p.slotY === 40 && p.Lx === 150 && p.Ly === 80 && p.Lz === 50 &&
    p.kLocator === 5e4 && p.kClamp === 2e4;
  const sf = Number.isFinite(s.requiredClampScale) && s.requiredClampScale > 0 ? 1 / s.requiredClampScale : 0;
  const maxClamp = Math.max(p.topClamp, p.sideClamp, p.endClamp);
  return {
    setupOK,
    tolOK: !s.dislodged && s.maxAbsEy <= pr.tolerance && s.maxAbsEz <= pr.tolerance,
    holdOK: s.clampOK,
    sfOK: sf >= pr.minSafety,
    clampOK: maxClamp <= pr.maxClamp,
    freqOK: s.freqs.length > 0 && s.freqs[0] >= pr.minFreqRatio * s.ftp,
    timeOK: s.cycleTime <= pr.maxCycleTime,
    moved: s.dislodged, ey: s.maxAbsEy, ez: s.maxAbsEz, sf, maxClamp, f1: s.freqs[0] ?? 0, ftp: s.ftp, time: s.cycleTime,
  };
}

export function scoreFixture() {
  const st = useApp.getState(), fs = useFixture.getState();
  const mcq = FIXTURE_QUESTIONS.reduce((a, q) => a + (st.answers[q.id] !== undefined && Number(st.answers[q.id]) === q.correct ? 1 : 0), 0);
  const ev = evaluateFixture(fs.result);
  const words = fs.solveNote.trim().split(/\s+/).filter(Boolean).length;
  const kw = KEYWORDS.filter((k) => fs.solveNote.toLowerCase().includes(k)).length;
  const explain = words >= 30 && kw >= 2 ? 1 : 0;
  const solve = ev && ev.setupOK && ev.clampOK && ev.timeOK ? (ev.tolOK && ev.holdOK ? 2 : 0) + (ev.sfOK && ev.freqOK ? 1 : 0) : 0;
  return { mcq, mcqMax: FIXTURE_QUESTIONS.length, solve, explain, total: mcq + solve + explain, max: FIXTURE_QUESTIONS.length + 4, words, kw };
}

function Solve5() {
  const r = useFixture((s) => s.result);
  const note = useFixture((s) => s.solveNote);
  const setNote = useFixture((s) => s.setSolveNote);
  const setParams = useFixture((s) => s.setParams);
  const pr = FIXTURE_PROBLEM;
  const ev = evaluateFixture(r);
  const sc = scoreFixture();
  const load = () => setParams({ materialId: pr.material, coeffs: { ...MATERIALS[pr.material].coeffs }, coeffSource: 'illustrative', tolerance: pr.tolerance,
    D: 16, N: 4, rpm: 2500, slotY: 40, Lx: 150, Ly: 80, Lz: 50, kLocator: 5e4, kClamp: 2e4, ...pr.baseline });
  const cell = (label: string, ok: boolean, text: string) => (
    <div className="rounded bg-slate-900 p-1.5 ring-1 ring-slate-800">{label}<br /><Tag kind={ok ? 'ok' : 'fail'}>{text}</Tag></div>
  );
  return (
    <div className="space-y-2">
      <div className="rounded bg-slate-900 p-2 ring-1 ring-slate-800">
        <h4 className="text-xs font-semibold text-amber-200">{pr.title}</h4>
        <p className="mt-1 text-[11px] leading-snug text-slate-300">{pr.brief}</p>
        <div className="mt-2"><Btn onClick={load}>Load the current (failing) setup</Btn></div>
        <p className="mt-1 text-[10px] text-slate-500">Fixed: material, block, cutter (Ø16, 4 flutes), 2500 rpm, slot position and depth, contact stiffness, illustrative coefficients. Free: fixture layout, clamp forces (≤ {pr.maxClamp} N each), end clamp, pad type (μ), feed direction, feed per tooth (cutting time ≤ {pr.maxCycleTime} s).</p>
      </div>
      {ev && (
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          {cell('Setup', ev.setupOK && ev.clampOK && ev.timeOK, !ev.setupOK ? 'fixed item changed' : !ev.clampOK ? `clamp ${ev.maxClamp} > ${pr.maxClamp} N` : !ev.timeOK ? `time ${ev.time.toFixed(0)} > ${pr.maxCycleTime} s` : 'matches brief')}
          {cell('Part held', ev.holdOK, ev.holdOK ? 'no slip / lift-off' : 'slips or lifts')}
          {cell('Slot position', ev.tolOK && ev.ey <= pr.tolerance, ev.moved ? 'part moved' : `${(ev.ey * 1000).toFixed(1)} / ${pr.tolerance * 1000} µm`)}
          {cell('Slot depth', ev.tolOK && ev.ez <= pr.tolerance, ev.moved ? 'part moved' : `${(ev.ez * 1000).toFixed(1)} / ${pr.tolerance * 1000} µm`)}
          {cell('Clamping SF', ev.sfOK, `${ev.sf ? ev.sf.toFixed(2) : '—'} / ≥ ${pr.minSafety}`)}
          {cell('Fixture f₁', ev.freqOK, `${ev.f1.toFixed(0)} Hz / ≥ ${(pr.minFreqRatio * ev.ftp).toFixed(0)} Hz`)}
        </div>
      )}
      <div>
        <label className="text-[11px] text-slate-300">Engineering justification (≥ 30 words): why did the part move or tilt, and why does your fixture and cutting plan hold it?</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={5} className="mt-1 w-full rounded bg-slate-800 p-2 text-xs text-slate-100 ring-1 ring-slate-700" placeholder="Explain using locator spread, clamp position, friction, feed direction and contact stiffness…" />
        <div className="text-[10px] text-slate-500">{sc.words} words · {sc.kw} key concepts detected. Your lecturer grades the reasoning.</div>
      </div>
      {FIXTURE_QUESTIONS.filter((q) => q.stage === 'solve').map((q) => <Question key={q.id} q={q} />)}
    </div>
  );
}

function Validate5() {
  const r = useFixture((s) => s.result);
  const params = useFixture((s) => s.params);
  const [pText, setPText] = useState<string | null>(null);
  const [eText, setEText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const read = (cb: (t: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 20e6) { setErr('File larger than 20 MB'); return; }
    f.text().then((t) => { setErr(null); cb(t); });
  };
  const pushCmp = useMemo(() => {
    if (!pText) return null;
    const { header, rows } = parseNumericCSV(pText);
    const col = (n: string) => header.findIndex((h) => h.startsWith(n));
    const ix = col('x'), iy = col('y'), iz = col('z'), ifx = col('fx'), ify = col('fy'), ifz = col('fz'), id = col('disp');
    if ([ix, iy, iz, ifx, ify, ifz, id].some((i) => i < 0) || !rows.length) return { error: 'Need columns: x_mm, y_mm, z_mm, Fx_N, Fy_N, Fz_N, disp_um (measured displacement along the force)' };
    const out = rows.map((q) => {
      const s = staticPush(params, [q[ix], q[iy], q[iz]] as Vec3, [q[ifx], q[ify], q[ifz]] as Vec3);
      return { at: `(${q[ix]}, ${q[iy]}, ${q[iz]})`, F: Math.hypot(q[ifx], q[ify], q[ifz]), meas: q[id], model: s.along * 1000, ok: s.restrained };
    });
    const pct = out.filter((o) => Math.abs(o.meas) > 1e-6).map((o) => ((o.model - o.meas) / o.meas) * 100);
    return { rows: out, meanPct: pct.length ? pct.reduce((a, b) => a + b, 0) / pct.length : NaN };
  }, [pText, params]);
  const errCmp = useMemo(() => {
    if (!eText || !r) return null;
    const { header, rows } = parseNumericCSV(eText);
    const ix = header.findIndex((h) => h.startsWith('x')), iy = header.findIndex((h) => h.startsWith('ey')), iz = header.findIndex((h) => h.startsWith('ez'));
    if (ix < 0 || iy < 0 || iz < 0 || !rows.length) return { error: 'Need columns: x_mm, eY_mm, eZ_mm (measured slot position and depth error vs datum)' };
    const dy: number[] = [], dz: number[] = [];
    for (const q of rows) { const m = errorAt(r, q[ix]); dy.push(m.ey - q[iy]); dz.push(m.ez - q[iz]); }
    const rms = (a: number[]) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
    const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    return { n: rows.length, rmsY: rms(dy), rmsZ: rms(dz), biasY: mean(dy), biasZ: mean(dz) };
  }, [eText, r]);
  const synthPush = () => {
    const pts: [number, number, number, number, number, number][] = [[75, 0.5, 40, 0, -1000, 0], [75, 0.5, 40, 0, 1000, 0], [75, 40, 50, 0, 0, -2000], [149.5, 40, 25, -1000, 0, 0], [20, 79.5, 45, 0, 1000, 0]];
    const rows: (string | number)[][] = [['x_mm', 'y_mm', 'z_mm', 'Fx_N', 'Fy_N', 'Fz_N', 'disp_um']];
    for (const q of pts) { const s = staticPush(params, [q[0], q[1], q[2]], [q[3], q[4], q[5]]); rows.push([...q, (s.along * 1000 * (1.2 + (Math.random() - 0.5) * 0.1)).toFixed(2)]); }
    download('SYNTHETIC-fixture-push-test.csv', '# SYNTHETIC dial-gauge push test generated from the model (+20 % softer, ±5 % noise). NOT measured data.\n' + toCSV(rows));
  };
  const synthErr = () => {
    if (!r) return;
    const rows: (string | number)[][] = [['x_mm', 'eY_mm', 'eZ_mm']];
    for (let x = 20; x <= params.Lx - 20; x += 20) { const m = errorAt(r, x); rows.push([x, (m.ey * 1.15 + 0.002 + (Math.random() - 0.5) * 0.002).toFixed(4), (m.ez * 1.1 + (Math.random() - 0.5) * 0.002).toFixed(4)]); }
    download('SYNTHETIC-slot-CMM.csv', '# SYNTHETIC CMM slot measurement generated from the model (+15 % eY, +2 µm bias, ±1 µm noise). NOT measured data.\n' + toCSV(rows));
  };
  if (!r) return null;
  return (
    <div className="space-y-3 text-[11px] text-slate-300">
      <div className="rounded bg-slate-900 p-2 ring-1 ring-slate-800">
        <h4 className="font-semibold text-slate-100">1 · Static push test on the clamped part</h4>
        <p className="mt-1 text-slate-400">Clamp the part as in the model ({LAYOUT_INFO[params.layout].name}), push with a force gauge at a point and read a dial gauge along the force. Upload <code>x_mm, y_mm, z_mm, Fx_N, Fy_N, Fz_N, disp_um</code>. This checks the contact stiffness values, independently of the cutting coefficients.</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <input type="file" accept=".csv,.txt" onChange={read(setPText)} className="text-[11px]" />
          <Btn kind="ghost" onClick={synthPush}>synthetic example</Btn>
        </div>
        {pushCmp && 'error' in pushCmp && <p className="mt-1 text-rose-300">{pushCmp.error}</p>}
        {pushCmp && 'rows' in pushCmp && (
          <>
            <table className="mt-2 w-full tabular">
              <thead className="text-slate-500"><tr><th className="text-left">Point (mm)</th><th className="text-left">|F| N</th><th className="text-left">Measured µm</th><th className="text-left">Model µm</th></tr></thead>
              <tbody>{pushCmp.rows!.map((q, i) => <tr key={i}><td>{q.at}</td><td>{q.F.toFixed(0)}</td><td>{q.meas.toFixed(2)}</td><td className={q.ok ? '' : 'text-rose-300'}>{q.ok ? q.model.toFixed(2) : 'not held'}</td></tr>)}</tbody>
            </table>
            <p className="mt-1">Mean error {Number.isFinite(pushCmp.meanPct) ? pushCmp.meanPct!.toFixed(0) : '—'} % — if the model is consistently stiffer, lower the locator / clamp stiffness until it matches, then re-run the slot.</p>
          </>
        )}
      </div>
      <div className="rounded bg-slate-900 p-2 ring-1 ring-slate-800">
        <h4 className="font-semibold text-slate-100">2 · Measured slot errors (CMM)</h4>
        <p className="mt-1 text-slate-400">Upload <code>x_mm, eY_mm, eZ_mm</code>: slot centre position and floor depth error relative to the datum faces, along the slot.</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <input type="file" accept=".csv,.txt" onChange={read(setEText)} className="text-[11px]" />
          <Btn kind="ghost" onClick={synthErr}>synthetic example</Btn>
        </div>
        {errCmp && 'error' in errCmp && <p className="mt-1 text-rose-300">{errCmp.error}</p>}
        {errCmp && 'n' in errCmp && (
          <table className="mt-2 w-full tabular"><tbody>
            <tr><td>Points</td><td>{errCmp.n}</td></tr>
            <tr><td>RMS (model − measured), eY</td><td>{(errCmp.rmsY! * 1000).toFixed(1)} µm (bias {(errCmp.biasY! * 1000).toFixed(1)})</td></tr>
            <tr><td>RMS (model − measured), eZ</td><td>{(errCmp.rmsZ! * 1000).toFixed(1)} µm (bias {(errCmp.biasZ! * 1000).toFixed(1)})</td></tr>
          </tbody></table>
        )}
      </div>
      {err && <p className="text-rose-300">{err}</p>}
      <div className="rounded bg-amber-950/30 p-2 text-amber-100/90 ring-1 ring-amber-900">
        <b>Limitations to report:</b> rigid workpiece (no part bending or clamping distortion), point contacts with illustrative stiffness and friction, quasi-static (no fixture vibration), no slip history between stations, no tool deflection (Module 2) or machine error. A measured slot error also contains tool deflection, thermal and machine errors: separate them before blaming the fixture.
      </div>
    </div>
  );
}

export function downloadReport5() {
  const st = useApp.getState(), fs = useFixture.getState();
  const sc = scoreFixture();
  const r = fs.result;
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  const ev = evaluateFixture(r);
  const q = FIXTURE_QUESTIONS.map((x) => { const a = st.answers[x.id]; return `<tr><td>${x.id}</td><td>${esc(x.prompt)}</td><td>${a === undefined ? '—' : esc(x.options[Number(a)])}</td><td>${a !== undefined && Number(a) === x.correct ? '✔' : '✘'}</td></tr>`; }).join('');
  const sfOf = (v: number | null) => (v && v > 0 ? (1 / v).toFixed(2) : '—');
  const t = fs.trials.map((x) => `<tr><td>${esc(x.label)}</td><td>${x.params.layout}</td><td>${x.params.feedDir}</td><td>${x.params.topClamp}/${x.params.sideClamp}/${x.params.endClamp}</td><td>${x.params.mu}</td><td>${(x.summary.maxAbsEy * 1000).toFixed(1)}</td><td>${(x.summary.maxAbsEz * 1000).toFixed(1)}</td><td>${sfOf(x.summary.requiredClampScale)}</td><td>${x.summary.dislodged ? 'moved' : x.summary.anyLift ? 'lift' : x.summary.anySlip ? 'slip' : 'held'}</td></tr>`).join('');
  const p = r?.params, s = r?.summary;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>MachinaForce 3D Module 5 report — ${esc(st.studentName || 'student')}</title>
<style>body{font:13px/1.45 system-ui,sans-serif;max-width:900px;margin:24px auto;color:#111}h1{font-size:20px}h2{font-size:15px;margin-top:22px;border-bottom:1px solid #ccc}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border:1px solid #ccc;padding:3px 5px;text-align:left}.note{background:#fff7e6;border:1px solid #f0c36d;padding:6px 8px}</style></head><body>
<h1>MachinaForce 3D — Module 5: Workpiece movement and fixture stiffness</h1>
<p><b>Student:</b> ${esc(st.studentName || '—')} &nbsp; <b>Date:</b> ${new Date().toLocaleString()}</p>
<p class="note">Values are model estimates (rigid block on point contacts; illustrative contact stiffness, friction and cutting coefficients).</p>
<h2>Score</h2><p>Total <b>${sc.total} / ${sc.max}</b> — questions ${sc.mcq}/${sc.mcqMax}, production problem ${sc.solve}/3, justification ${sc.explain}/1.</p>
<h2>Final configuration</h2>${p && s ? `<table><tr><th>Part</th><td>${MATERIALS[p.materialId].name}, ${p.Lx} × ${p.Ly} × ${p.Lz} mm</td></tr><tr><th>Fixture</th><td>${LAYOUT_INFO[p.layout].name}; top clamps ${p.topClamp} N, side ${p.sideClamp} N, end ${p.endClamp || 'none'}; μ ${p.mu}</td></tr><tr><th>Operation</th><td>slot Ø${p.D}, ${p.N} flutes, ap ${p.ap} mm, fz ${p.fz} mm, ${p.rpm} rpm, feed ${p.feedDir}</td></tr><tr><th>Result</th><td>|eY| ${(s.maxAbsEy * 1000).toFixed(1)} µm, |eZ| ${(s.maxAbsEz * 1000).toFixed(1)} µm, clamping SF ${sfOf(s.requiredClampScale)}, ${s.dislodged ? 'part not held' : s.anyLift ? 'lift-off' : s.anySlip ? 'slip' : 'held'}; f₁ ${s.freqs[0]?.toFixed(0) ?? '—'} Hz vs f_tp ${s.ftp.toFixed(0)} Hz</td></tr><tr><th>Production problem</th><td>${ev ? `setup ${ev.setupOK && ev.clampOK && ev.timeOK ? 'OK' : 'NOT as brief'}, tolerance ${ev.tolOK ? 'met' : 'not met'}, held ${ev.holdOK ? 'yes' : 'no'}, SF ${ev.sfOK ? 'met' : 'not met'}, f₁ ${ev.freqOK ? 'met' : 'not met'}` : '—'}</td></tr></table>` : '—'}
<h2>Engineering justification</h2><p>${esc(fs.solveNote || '—').replace(/\n/g, '<br>')}</p>
<h2>Questions</h2><table><tr><th>ID</th><th>Question</th><th>Answer</th><th></th></tr>${q}</table>
<h2>Experimental trials</h2><table><tr><th>Trial</th><th>Layout</th><th>Feed</th><th>Clamps N</th><th>μ</th><th>|eY| µm</th><th>|eZ| µm</th><th>SF</th><th>State</th></tr>${t || '<tr><td colspan=9>none saved</td></tr>'}</table>
</body></html>`;
  download(`machinaforce-m5-report-${(st.studentName || 'student').replace(/\W+/g, '_')}.html`, html, 'text/html');
  if (fs.trials.length) download('machinaforce-m5-trials.csv', fixTrialsCSV());
}

const INTRO: Record<Stage, { title: string; text: string }> = {
  observe: { title: 'Stage A · Observe (Module 5)', text: 'Press Play. Watch the slot being cut and the block move on its locators (motion exaggerated). Switch the force arrows to “workpiece”. Open “Contact forces”: which locators gain load, which lose it? Then “Slot error along X”.' },
  experiment: { title: 'Stage B · Experiment (Module 5)', text: 'Predict, then change one thing: locator layout, clamp force, friction (pad type), feed direction, depth of cut. Run the “Clamping force study” to see security vs accuracy.' },
  solve: { title: 'Stage C · Solve (Module 5)', text: 'Redesign a fixture so that a slot is cut in position without the part moving.' },
  validate: { title: 'Validation (Module 5)', text: 'Check the contact stiffness with a static push test, then compare predicted slot errors with CMM measurements.' },
};

export function StagePanel5() {
  const stage = useApp((s) => s.stage);
  const name = useApp((s) => s.studentName);
  const setName = useApp((s) => s.setStudentName);
  useApp((s) => s.answers); useFixture((s) => s.result); useFixture((s) => s.solveNote);
  const sc = scoreFixture();
  return (
    <div className="space-y-2 p-3">
      <div><h3 className="text-sm font-semibold text-slate-100">{INTRO[stage].title}</h3><p className="mt-1 text-[11px] leading-snug text-slate-400">{INTRO[stage].text}</p></div>
      {(stage === 'observe' || stage === 'experiment') && FIXTURE_QUESTIONS.filter((q) => q.stage === stage).map((q) => <Question key={q.id} q={q} />)}
      {stage === 'solve' && <Solve5 />}
      {stage === 'validate' && <Validate5 />}
      {stage !== 'validate' && (
        <div className="rounded bg-slate-900 p-2 ring-1 ring-slate-800">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-200">Module 5 score {sc.total} / {sc.max}</span><span className="text-[10px] text-slate-500">questions {sc.mcq}/{sc.mcqMax} · solve {sc.solve}/3 · explain {sc.explain}/1</span></div>
          <div className="mt-1.5 flex gap-1.5">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Student name / matric no." className="flex-1 rounded bg-slate-800 px-2 py-0.5 text-xs ring-1 ring-slate-700" />
            <Btn kind="primary" onClick={downloadReport5}>Report</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
