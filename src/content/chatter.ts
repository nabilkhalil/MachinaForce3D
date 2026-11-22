/** Module 3 teaching content: chatter and dynamic instability. */
import type { MCQ } from './learning';
import type { ChatterParams } from '../physics/chatter';

export const CHATTER_HELP: Record<string, string> = {
  modal: 'The tool (with holder and spindle) behaves like a mass–spring–damper in each direction: natural frequency fn, damping ratio ζ and static stiffness k. Measure them with a tap test (impact hammer + accelerometer) — see the Validate stage.',
  fn: 'Natural frequency: the frequency the tool rings at when tapped. Chatter usually occurs slightly above fn.',
  zeta: 'Damping ratio: how quickly free vibration dies out. The minimum stable depth grows roughly in proportion to k·ζ, so damping is as valuable as stiffness.',
  k: 'Static stiffness: force per unit deflection. Doubling k doubles every lobe height.',
  ae: 'Radial depth of cut. It changes how many teeth are in the cut and the direction of the force, so it changes the whole lobe diagram. ZOA lobes are less accurate below ae/D ≈ 0.15.',
  ap: 'Axial depth of cut — the vertical axis of the lobe diagram. Chatter appears when ap exceeds the lobe at the chosen spindle speed.',
  rpm: 'Spindle speed — the horizontal axis of the lobe diagram. Stable "pockets" occur where the tooth-passing frequency is fn/(k+1): there the waviness left by one tooth is in phase with the next.',
};

export const CHATTER_QUESTIONS: MCQ[] = [
  {
    id: 'C-A1', stage: 'observe', kind: 'concept',
    prompt: 'What is the difference between forced vibration and chatter?',
    options: ['None — both are vibration', 'Forced vibration repeats at the tooth-passing frequency and its harmonics; chatter is self-excited and grows at a different frequency, near a natural frequency', 'Chatter only happens at high force', 'Forced vibration always damages the tool'],
    correct: 1,
    why: 'Forced vibration is the structure responding to the periodic tooth impacts. Chatter feeds on itself through the waviness left on the surface (regeneration) and appears at a chatter frequency that is not a tooth-passing harmonic.',
  },
  {
    id: 'C-A2', stage: 'observe', kind: 'concept',
    prompt: 'In the time-domain chart, the dots are sampled once per tooth period. For stable cutting they…',
    options: ['scatter widely', 'collapse onto (almost) one point, because the motion repeats every tooth period', 'grow steadily', 'disappear'],
    correct: 1,
    why: 'Once-per-tooth sampling acts like a strobe light at the tooth-passing frequency: periodic forced motion looks frozen; chatter (non-synchronous motion) makes the dots spread.',
  },
  {
    id: 'C-A3', stage: 'observe', kind: 'concept',
    prompt: 'Why is a high peak force alone NOT proof of chatter?',
    options: ['Because forces are never high', 'Because a large but periodic force gives stable forced vibration; chatter is defined by self-excited growth (non-synchronous vibration), not by force level', 'Because the dynamometer is inaccurate', 'Because chatter reduces force'],
    correct: 1,
    why: 'Stability is a property of the dynamic system (structure + regenerative cutting), not of the force magnitude. That is why the app judges chatter from the motion, never from a force threshold.',
  },
  {
    id: 'C-B1', stage: 'experiment', kind: 'prediction',
    prompt: 'Predict: doubling the damping ratio ζ (0.03 → 0.06) will change the absolute stable depth of cut a_lim,min by about…',
    options: ['No change', '× 1.2', '× 2', '× 4'],
    correct: 2,
    why: 'a_lim,min ∝ k·ζ(1+ζ): doubling ζ roughly doubles it. Damping is as effective as stiffness — hence damped tool holders.',
    tryIt: 'Change ζ in both directions and compare "Absolute stable depth" in the Results panel.',
  },
  {
    id: 'C-B2', stage: 'experiment', kind: 'prediction',
    prompt: 'Predict: with fn = 600 Hz and 4 teeth, where is the largest stability pocket?',
    options: ['600 rpm', '9 000 rpm (tooth-passing frequency = fn)', '2 400 rpm', 'At the maximum spindle speed'],
    correct: 1,
    why: 'Pockets lie where f_tp ≈ fn/(k+1). For k = 0: n = 60·fn/N = 60·600/4 = 9 000 rpm. Smaller pockets follow at 4 500, 3 000 rpm …',
    tryIt: 'Open the Stability lobes chart and hover over the highest peak.',
  },
  {
    id: 'C-B3', stage: 'experiment', kind: 'prediction',
    prompt: 'Predict: increasing the radial depth from half immersion (ae = 8 mm) to slotting (ae = 16 mm) will…',
    options: ['Raise all lobes', 'Lower the lobes — more teeth in cut and a less favourable force direction', 'Not change the lobes', 'Move the pockets to a different speed'],
    correct: 1,
    why: 'More engaged teeth means more regenerative feedback. The pocket speeds are set by fn and N, so they barely move; the lobe heights drop.',
    tryIt: 'Compare a_lim,min for ae = 8 and 16 mm.',
  },
  {
    id: 'C-B4', stage: 'experiment', kind: 'prediction',
    prompt: 'Predict: at very low radial immersion (ae = 1.5 mm, ae/D ≈ 0.1) the analytical (ZOA) lobes compared with the time-domain simulation will be…',
    options: ['Identical', 'Too optimistic — the time-domain simulation finds chatter at lower depths, because intermittent cutting creates period-doubling instability that ZOA averages away', 'Too pessimistic everywhere', 'Undefined'],
    correct: 1,
    why: 'ZOA replaces the time-varying cutting coefficients by their average. When the tooth is in the cut only briefly, that average hides the flip (period-doubling) lobes. Press "Compute time-domain boundary" to see the gap.',
    tryIt: 'Set ae = 1.5 mm and compute the time-domain boundary.',
  },
  {
    id: 'C-C1', stage: 'solve', kind: 'root-cause',
    prompt: 'Root cause: an operator lowers spindle speed from 9 000 to 6 000 rpm "to be safe", and the part starts chattering with a loud whine. Most likely reason…',
    options: ['The tool got blunt', 'The new speed is in a lobe trough instead of the stability pocket; slower is not always more stable', 'The feed is too low', 'Thermal growth of the spindle'],
    correct: 1,
    why: 'Stability depends on the phase between successive surface waves, which depends on spindle speed. 9 000 rpm sits in the k = 0 pocket; 6 000 rpm sits in a trough.',
  },
];

export const CHATTER_PROBLEM = {
  title: 'Production problem: chatter in aluminium side milling',
  brief:
    'A shop side-mills 7075-T651 with a Ø16 mm 4-flute end mill at half immersion (ae = 8 mm). The tool was tap-tested: fn = 600 Hz, ζ = 0.03, k = 5.6 N/µm in both directions. The current programme (6 000 rpm, ap = 1.2 mm, fz = 0.08 mm) chatters and produces only ~18 000 mm³/min. Find spindle speed, axial depth and feed (fz ≤ 0.10 mm, n ≤ 20 000 rpm) that cut WITHOUT chatter in the time-domain simulation and reach MRR ≥ 60 000 mm³/min.',
  material: 'al7075' as const,
  D: 16,
  N: 4,
  ae: 8,
  mode: { fn: 600, zeta: 0.03, k: 5600 },
  minMRR: 60_000,
  maxFz: 0.1,
  maxRpm: 20_000,
  baseline: { rpm: 6000, ap: 1.2, fz: 0.08, mode: 'down' } as Partial<ChatterParams>,
  /** one admissible solution (kept for the automated solvability test, never shown to students) */
  knownSolution: { rpm: 9000, ap: 3, fz: 0.08, mode: 'down' } as Partial<ChatterParams>,
};

export const CHATTER_ASSUMPTIONS: { title: string; items: string[] }[] = [
  {
    title: 'Module 3 dynamic model',
    items: [
      'Tool + holder + spindle: one mode in each of the feed (x) and normal (y) directions; workpiece rigid; no cross-coupling between x and y.',
      'Regenerative chip thickness with a single delay equal to the tooth period (no runout, equal pitch, straight flutes for the dynamics).',
      'Linear cutting law Ft = Ktc·ap·h + Kte·ap; the tooth leaves the cut when h ≤ 0 (the only nonlinearity).',
      'Stability lobes by the zero-order approximation (average directional factors): reliable at moderate–high immersion, optimistic at low immersion.',
      'Time-domain simulation: exact discrete state transition per mode with a zero-order hold on the force (64 steps per tooth period); chatter is detected from once-per-tooth sampling (ratio > 0.1) and the vibration spectrum, never from force level.',
      'Not modelled: process damping at low speed, speed-dependent spindle dynamics, workpiece flexibility, variable pitch/helix tools.',
    ],
  },
];
