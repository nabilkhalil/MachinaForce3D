/** Module 2 teaching content: tool bending in deep-pocket machining. */
import type { MCQ } from './learning';
import type { PocketParams } from '../physics/pocketProcess';

export const POCKET_HELP: Record<string, string> = {
  overhang: 'Gauge length from holder face to tool tip. It must reach the pocket floor with the holder still clear of the pocket top, so it is set by the DEEPEST feature — every level is then cut with this long tool. Tip deflection grows roughly with L³.',
  fluteLength: 'Length of the fluted (cutting) part. The engaged length can never exceed it. The fluted section is less stiff than a solid one (effective diameter ≈ 0.8·D).',
  neck: 'Long-reach tools have a reduced neck behind the flutes so the shank does not rub the finished wall. The neck is the weakest section: smaller diameter → much lower stiffness (I ∝ d⁴).',
  holder: 'Toolholder + spindle are not rigid. A translational spring kT and a rotational spring kR at the holder face add P/kT + P·a·s/kR of deflection — often 20–40 % of the total for long tools.',
  strategy: 'How the wall depth is divided into passes, and whether to repeat (spring pass) or offset (compensate) the toolpath.',
  pocketDepth: 'Depth of the pocket wall being finished.',
  aeFinish: 'Radial stock left on the wall for finishing. It sets the force, and so the bending.',
  ap: 'Axial depth of each Z-level. The force is proportional to the engaged length, and it acts near the tool tip, where the tool is most flexible.',
  mode: 'Down (climb) or up (conventional) milling. The wall surface is generated at the exit (down) or entry (up) of the tooth, so the force — and the bending direction — at that instant differ.',
};

export const POCKET_QUESTIONS: MCQ[] = [
  {
    id: 'P-A1', stage: 'observe', kind: 'concept',
    prompt: 'Why is the deep-pocket wall left with extra material (positive deviation) after finishing?',
    options: ['The wall bends away from the tool', 'The tool bends away from the wall under the radial cutting force, so the edge does not reach the programmed position', 'Thermal growth of the spindle', 'The CAM tolerance is too coarse'],
    correct: 1,
    why: 'In this module the workpiece is a thick, rigid block. The compliant element is the long tool and its holder; the normal force component pushes the tool back into the pocket.',
  },
  {
    id: 'P-A2', stage: 'observe', kind: 'concept',
    prompt: 'Look at the Tool bending chart. Where is the bending moment largest, and where is the deflection largest?',
    options: ['Both at the tip', 'Moment largest at the holder face; deflection largest at the tip', 'Moment largest at the tip; deflection largest at the holder', 'Both at mid-length'],
    correct: 1,
    why: 'For a cantilever loaded near its end, M(s) = P·(a − s) is maximum at the clamp; deflection accumulates outward and is maximum at the free end. Stress (and breakage risk) is highest at the holder face or the neck.',
  },
  {
    id: 'P-A3', stage: 'observe', kind: 'concept',
    prompt: 'In constant-Z step-down, why does every level show almost the same error pattern?',
    options: ['Because the force is random', 'Because the same tool overhang is used for every level, so the stiffness at the cutting zone is the same', 'Because the wall gets thinner', 'Because the spindle speed changes'],
    correct: 1,
    why: 'The overhang is chosen to reach the deepest level. The holder moves down with each level, so the tool’s engaged zone always sits at the same distance from the holder.',
  },
  {
    id: 'P-B1', stage: 'experiment', kind: 'prediction',
    prompt: 'Predict: increasing overhang from 60 mm to 75 mm (same tool) increases the tip deflection by about…',
    options: ['1.25×', '1.6×', '2×', '3×'],
    correct: 2,
    why: 'δ ∝ L³ for the tool itself: (75/60)³ ≈ 1.95. The holder contribution grows more slowly, so the total is a little below 2×.',
    tryIt: 'Compare “Tool tip deflection (peak)” for overhang 60 and 75 mm.',
  },
  {
    id: 'P-B2', stage: 'experiment', kind: 'prediction',
    prompt: 'Predict: one full-depth flank pass (long flutes) instead of 10 mm step-down will make the wall…',
    options: ['More accurate, because there are fewer passes', 'Strongly tapered — the error grows toward the tool tip because the whole depth is engaged and the force is about five times larger', 'Unchanged', 'Thinner at the top'],
    correct: 1,
    why: 'Engaged length 50 mm instead of 10 mm: about 5× the force, applied over the most flexible part of the tool. The deviation grows toward the pocket floor — a taper (perpendicularity) error.',
    tryIt: 'Set strategy to “Single full-depth flank pass” and flute length ≥ 50 mm.',
  },
  {
    id: 'P-B3', stage: 'experiment', kind: 'prediction',
    prompt: 'Predict: a spring pass (repeat each level at the same position) will…',
    options: ['Remove the whole allowance again', 'Reduce the error, because the second pass meets only the small amount left by deflection, so its force is small', 'Double the error', 'Have no effect'],
    correct: 1,
    why: 'Force scales with the material actually engaged. The second pass sees only the deflection residual; the smaller force bends the tool less. The cost is cycle time.',
    tryIt: 'Switch to “Step-down + spring pass” and compare max deviation and MRR.',
  },
  {
    id: 'P-B4', stage: 'experiment', kind: 'prediction',
    prompt: 'Predict: what share of the tip compliance comes from the holder/spindle (default kT = 30 N/µm, kR = 5×10⁷ N·mm/rad)?',
    options: ['< 2 %', 'About 20–30 %', 'About 80 %', '100 %'],
    correct: 1,
    why: 'The holder springs add P/kT + P·L²/kR. For a 60 mm reach this is a quarter of the total — which is why rigid holders (shrink-fit, hydraulic) matter for long tools.',
    tryIt: 'Read “Holder share” in the Results panel; tick “Rigid holder” to compare.',
  },
  {
    id: 'P-C1', stage: 'solve', kind: 'root-cause',
    prompt: 'Root cause: a mould pocket wall is 40 µm proud near the floor but within tolerance near the top, after a full-depth flank pass. Most likely cause…',
    options: ['Workpiece thermal expansion', 'Tool bending: the long engaged length loads the flexible tip region, so deflection is largest near the tip (pocket floor)', 'Wrong work offset', 'Spindle run-out only'],
    correct: 1,
    why: 'A deviation that grows toward the tool tip is the signature of tool bending. A work-offset error would shift the whole wall uniformly.',
  },
];

export const POCKET_PROBLEM = {
  title: 'Production problem: mould insert pocket, AISI 1045',
  brief:
    'A 50 mm deep, 60 mm long pocket side wall in AISI 1045 must be finished to ± 0.025 mm of its nominal position over the whole wall, with the shop’s Ø10 mm 4-flute long-reach end mill in its existing collet holder (kT = 30 N/µm, kR = 5×10⁷ N·mm/rad). Programmers report the wall is up to 0.05 mm proud. Meet the tolerance while keeping average MRR ≥ 1 000 mm³/min, with static bending stress below 30 % of the carbide rupture strength.',
  material: 'aisi1045' as const,
  pocketDepth: 50,
  wallLength: 60,
  D: 10,
  N: 4,
  tolerance: 0.025,
  minMRR: 1000,
  maxStressRatio: 0.3,
  overhangRange: [52, 80] as [number, number],
  holder: { kT: 30_000, kR: 5e7 },
  baseline: { strategy: 'step-down', ap: 10, aeFinish: 0.3, overhang: 60, mode: 'down', fz: 0.04, rpm: 5000, helixDeg: 35, fluteLength: 22, neck: true, neckDiameter: 9.4, neckLength: 30, holderRigid: false } as Partial<PocketParams>,
  /** one admissible solution (kept for the automated solvability test, never shown to students) */
  knownSolution: { strategy: 'spring-pass', ap: 10, aeFinish: 0.3, overhang: 60, mode: 'up', fz: 0.04, rpm: 5000, helixDeg: 35, fluteLength: 22, neck: true, neckDiameter: 9.4, neckLength: 30, holderRigid: false } as Partial<PocketParams>,
};

export const POCKET_ASSUMPTIONS: { title: string; items: string[] }[] = [
  {
    title: 'Module 2 structural model',
    items: [
      'Workpiece block, fixture and machine are rigid: all error comes from tool + holder deflection.',
      'Tool: Euler–Bernoulli stepped cantilever (shank D, optional neck dn, flutes 0.8·D), carbide E = 600 GPa.',
      'Holder + spindle: linear translational (kT) and rotational (kR) springs at the holder face; values are illustrative.',
      'Force spread uniformly over the engaged flute length; bending from the in-plane force (Fx, Fy); the wall error uses the component normal to the wall (Y).',
      'Bending stress = M·c/I (static). Fatigue, impact, stress concentration at the neck radius and flute root are not included; carbide rupture strength taken as 3 500 MPa (grade-dependent).',
      'Tool natural frequency by Rayleigh’s method (self-weight deflection shape); information only, not a chatter prediction.',
      'Compensation: each level is offset by the mean error of an uncompensated simulation (one iteration of model-based compensation).',
    ],
  },
];
