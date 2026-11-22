/** Module 4 teaching content: cutting-force components in turning slender shafts. */
import type { MCQ } from './learning';
import type { TurningParams } from '../physics/turning';

export const TURNING_HELP: Record<string, string> = {
  vc: 'Cutting speed at the workpiece surface. Spindle speed n = 1000·vc/(π·D). In this static model vc changes power and cycle time, not the forces.',
  f: 'Feed per revolution: how far the tool moves along Z per turn. With the depth it sets the chip area A = ap·f, hence the force. It also sets the theoretical roughness Ra ≈ f²/(32 rε).',
  kappa: 'Entering (approach) angle κr between the main cutting edge and the feed direction. Larger κr directs more of the force into the feed direction and less into the passive (radial) direction — but only when the depth is larger than the nose radius zone.',
  noseR: 'Nose (corner) radius rε. A larger radius gives a better theoretical finish but, at small depths, a larger passive force, because the cut takes place on the curved nose where the edge is almost parallel to the shaft axis.',
  workholding: 'How the shaft is supported. A shaft held only in the chuck is a cantilever (deflection ∝ L³). A tailstock centre adds a support at the free end; between centres both ends are supported but free to rotate.',
  steady: 'A steady rest is an extra radial support (rollers) between chuck and tailstock. It dramatically reduces the free span, so stiffness rises roughly with (L/span)³.',
  strategy: 'Single finishing pass, a spring pass (repeat at the same diameter to remove what deflection left), or roughing then a light finishing pass.',
  feedDir: 'Feeding toward the chuck is the usual direction: the feed force pushes the part into the chuck rather than out of it. The already-turned part of the shaft is slightly thinner, so the stiffness at the tool depends a little on the direction. Compare both.',
  tolerance: 'Allowed ± deviation of the finished diameter. For a Ø24 mm shaft, IT7 ≈ 21 µm wide, IT6 ≈ 13 µm.',
};

export const TURNING_QUESTIONS: MCQ[] = [
  {
    id: 'T-A1', stage: 'observe', kind: 'concept',
    prompt: 'Which force component is usually the LARGEST in turning, and which one bends the slender shaft away from the tool?',
    options: ['Fp is largest; Fc bends the shaft', 'Fc (cutting force) is largest; Fp (passive/radial force) bends the shaft away from the tool and changes the diameter', 'Ff is largest; Ff bends the shaft', 'All three are equal'],
    correct: 1,
    why: 'Fc acts tangentially and supplies almost all the cutting power, but its deflection is tangential, which changes the radius only to second order. Fp acts radially, directly changing the cut radius.',
  },
  {
    id: 'T-A2', stage: 'observe', kind: 'concept',
    prompt: 'Cutting power is calculated from…',
    options: ['Fp × vc', 'Fc × vc  (Pc [kW] = Fc [N] · vc [m/min] / 60 000)', 'Ff × feed rate only', '(Fc + Ff + Fp) × vc'],
    correct: 1,
    why: 'Only Fc moves through the cutting-speed distance; Ff × feed rate is tiny and Fp does no work (no motion in X).',
  },
  {
    id: 'T-A3', stage: 'observe', kind: 'concept',
    prompt: 'Between chuck and tailstock, where is the finished diameter largest?',
    options: ['At the chuck', 'Somewhere between the supports, where the shaft is least stiff — giving a barrel-shaped error', 'At the tailstock exactly', 'It is uniform'],
    correct: 1,
    why: 'The diameter error follows the local compliance of the shaft at the tool position. It is lowest near supports and largest in the span (shifted toward the tailstock, which is more compliant than the chuck).',
  },
  {
    id: 'T-B1', stage: 'experiment', kind: 'prediction',
    prompt: 'Predict: removing the tailstock (chuck only) on this L/D ≈ 12 shaft will change the maximum diameter error by about…',
    options: ['× 1.5', '× 3', '× 15 or more', 'No change'],
    correct: 2,
    why: 'A cantilever of length L is far more compliant (δ = PL³/3EI) than a shaft supported at both ends; the error at the free end grows by an order of magnitude.',
    tryIt: 'Change workholding to “Chuck only” and compare max diameter deviation.',
  },
  {
    id: 'T-B2', stage: 'experiment', kind: 'prediction',
    prompt: 'Predict: at ap = 0.5 mm with a 0.8 mm nose radius, changing the entering angle from 93° to 75° will…',
    options: ['Strongly reduce Fp', 'Hardly change the forces, because the whole cut lies on the nose radius', 'Double Fc', 'Reverse Ff'],
    correct: 1,
    why: 'The straight edge is not engaged when ap < rε(1 − cos κr); the equivalent edge is set by the nose alone. κr matters for deeper (roughing) cuts.',
    tryIt: 'Compare forces for κr = 93° and 75° at ap = 0.5 mm, then repeat with d0 = 30 mm (ap = 3 mm).',
  },
  {
    id: 'T-B3', stage: 'experiment', kind: 'prediction',
    prompt: 'Predict: halving the nose radius (0.8 → 0.4 mm) will…',
    options: ['Reduce Fp and the diameter error, but double the theoretical Ra', 'Increase Fp', 'Have no effect on roughness', 'Improve both error and roughness'],
    correct: 0,
    why: 'A smaller nose gives a larger equivalent entering angle (less passive force), but Ra ≈ f²/(32 rε) doubles: a classic accuracy–finish trade-off.',
    tryIt: 'Compare max |Fp|, deviation and theoretical Ra for rε = 0.8 and 0.4 mm.',
  },
  {
    id: 'T-B4', stage: 'experiment', kind: 'prediction',
    prompt: 'Predict: a steady rest at mid-length (k = 30 N/µm) will reduce the diameter error mainly…',
    options: ['Near the chuck', 'In the middle of the span, where the shaft was least stiff', 'Only near the tailstock', 'Nowhere — it only reduces chatter'],
    correct: 1,
    why: 'The support splits the span in two; the least-stiff region (mid-span) gains most. Look at the deflected shape in the Shaft deflection chart.',
    tryIt: 'Tick “Steady rest” and compare the diameter profile.',
  },
  {
    id: 'T-C1', stage: 'solve', kind: 'root-cause',
    prompt: 'Root cause: a Ø24 mm shaft, 300 mm long, measures 24.00 mm near the chuck, 24.02 mm at mid-length and 24.01 mm near the tailstock. Most likely…',
    options: ['Tool wear only', 'Shaft deflection under the passive force between the supports (barrel shape)', 'Spindle thermal growth', 'Wrong X offset'],
    correct: 1,
    why: 'A wrong offset shifts the whole diameter; wear grows steadily along the cut; a barrel shape following the support stiffness points to elastic deflection of the workpiece.',
  },
];

export const TURNING_PROBLEM = {
  title: 'Production problem: slender transmission shaft',
  brief:
    'A batch of AISI 1045 shafts, 300 mm long, is finish-turned from Ø25 mm to Ø24.00 ± 0.02 mm over 280 mm, between the chuck and a live tailstock centre, with a CNMG-type insert (κr = 93°, rε = 0.8 mm). Inspection reports up to 0.023 mm oversize mid-span. Meet the diameter tolerance over the whole turned length with theoretical Ra ≤ 1.6 µm and a cutting time ≤ 60 s per shaft, within the 11 kW spindle.',
  material: 'aisi1045' as const,
  d0: 25,
  dT: 24,
  L: 300,
  cutLength: 280,
  tolerance: 0.02,
  maxRa: 1.6,
  maxTime: 60,
  baseline: { workholding: 'chuck-tailstock', vc: 180, f: 0.15, kappa: 93, noseR: 0.8, strategy: 'single', steadyRest: false, feedDir: 'toward-chuck' } as Partial<TurningParams>,
  /** one admissible solution (for the automated solvability test, never shown to students) */
  knownSolution: { workholding: 'chuck-tailstock', vc: 180, f: 0.15, kappa: 93, noseR: 0.8, strategy: 'single', steadyRest: true, steadyZ: 150, feedDir: 'toward-chuck' } as Partial<TurningParams>,
};

export const TURNING_ASSUMPTIONS: { title: string; items: string[] }[] = [
  {
    title: 'Module 4 turning model',
    items: [
      'Lathe frame: Z along the spindle from the chuck face, X radial toward the tool (programmed as a diameter on CNC), Y tangential; forces reported on the tool.',
      'Linear edge-force model on an equivalent straight edge (chord of the engaged nose + edge); h = f·sin κe, b = ap / sin κe. Milling-derived coefficients are used as illustrative turning coefficients.',
      'Shaft: Euler–Bernoulli beam FE (2 DOF/node); local diameter from the stock, stiffness rebuilt at every tool position; chuck, centres, tailstock and steady rest as linear springs.',
      'Only Fp changes the cut radius directly; the Y deflection from Fc is reported with its second-order radius effect δy²/(2r).',
      'Quasi-static: no whirling, chatter or thermal growth; constant spindle speed set from the bar diameter; tool wear ignored; theoretical (kinematic) roughness only.',
    ],
  },
];
