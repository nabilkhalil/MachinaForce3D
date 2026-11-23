/** Module 5 teaching content: workpiece movement and fixture stiffness in milling. */
import type { MCQ } from './learning';
import type { FixtureParams } from '../physics/fixture';

export const FIXTURE_HELP: Record<string, string> = {
  layout:
    'The 3-2-1 principle: 3 locators under the base define a plane (Z, and tilt about X and Y), 2 on the side define a line (Y and rotation about Z), 1 at the end fixes X. Spreading the locators as far apart as possible makes the workpiece resist tilting and twisting.',
  topClamp:
    'Preload of each top clamp. Clamps should press directly over a locator so that the clamping force goes straight into the locator and does not tip the part. More clamping force gives more friction and slightly stiffer contacts, but too much distorts the part and marks the surface.',
  sideClamp: 'Preload of the side clamp, which pushes the part against the two side locators (Y).',
  endClamp: 'Optional end clamp pushing the part against the end locator (X). Without it, only friction resists a cutting force that pulls the part away from the end locator.',
  mu: 'Friction coefficient at the locators and clamps. Plain ground steel ≈ 0.15–0.25; serrated (gripper) pads or knurled jaws ≈ 0.3–0.5. Friction is what stops the part sliding along a locator.',
  kLocator: 'Normal stiffness of one locator contact at 1 kN contact force. It rises slowly with contact force (k ∝ N^1/3, Hertz contact).',
  kClamp: 'Normal stiffness of one clamp at 1 kN (clamp arm, screw and pad). Clamps are usually more compliant than hardened locators.',
  feedDir:
    'Feed direction of the slot cutter. It changes the sign of the cutting force components on the workpiece. Choose it so that the largest component pushes the part INTO the locators, not into the clamps.',
  ap: 'Slot depth (axial depth of cut). The slot is cut full width (ae = D), so the force grows in proportion to ap.',
  fz: 'Feed per tooth. Chip thickness and therefore force grow with fz; cycle time falls with fz.',
  tolerance: 'Allowed ± deviation of the slot position (Y) and slot floor depth (Z) relative to the datum surfaces (the locators).',
};

export const FIXTURE_QUESTIONS: MCQ[] = [
  {
    id: 'F-A1', stage: 'observe', kind: 'concept',
    prompt: 'In a 3-2-1 fixture, how many degrees of freedom do the 3 base locators remove?',
    options: ['One (Z only)', 'Three: translation in Z and rotation about X and Y', 'Six', 'Two'],
    correct: 1,
    why: 'Three points define a plane: the part can no longer move in Z or tilt about X or Y. The 2 side locators remove Y and rotation about Z, and the end locator removes X: 3 + 2 + 1 = 6.',
  },
  {
    id: 'F-A2', stage: 'observe', kind: 'concept',
    prompt: 'Why can a locator only PUSH on the workpiece, never pull?',
    options: ['Locators are made of soft material', 'It is a contact: if the cutting force pulls the part away, the contact force falls to zero and the part lifts off', 'Because of friction', 'It can pull if the clamp is tight'],
    correct: 1,
    why: 'A contact is unilateral. The clamp preload keeps every locator compressed; the cutting force must never reduce a locator force to zero, otherwise the datum is lost (lift-off).',
  },
  {
    id: 'F-A3', stage: 'observe', kind: 'concept',
    prompt: 'The machine moves the tool exactly along the programmed path, but the slot is cut 15 µm away from its nominal position. Why?',
    options: ['The program is wrong', 'The cutting force pushes the clamped part elastically on its contacts while it is cut; after unloading the part springs back, so the slot is displaced relative to the datum', 'Thermal expansion of the spindle only', 'Tool wear'],
    correct: 1,
    why: 'The feature is generated at the displaced position of the workpiece. When the force is removed the part returns, so the feature error is e = −u at the cutting point.',
  },
  {
    id: 'F-B1', stage: 'experiment', kind: 'prediction',
    prompt: 'Predict: bunching the locators near the middle of the block (Layout: “Locators too close together”) changes the slot position error by about…',
    options: ['No change', '× 1.2', '× 3 or more', 'It reduces the error'],
    correct: 2,
    why: 'The cutting force acts far from the locators; with short lever arms the contacts must carry large reaction forces against the tilting moment and the block rotates much more. Rotational stiffness grows with the square of the locator spacing.',
    tryIt: 'Switch the layout and compare “Slot position error” and the tilt angle.',
  },
  {
    id: 'F-B2', stage: 'experiment', kind: 'prediction',
    prompt: 'Predict: doubling all clamp forces will…',
    options: ['Halve the slot error', 'Roughly double the slip safety factor but reduce the slot error only a little', 'Have no effect on anything', 'Increase the slot error'],
    correct: 1,
    why: 'Friction capacity μN grows in proportion to the clamp force, so the safety factor roughly doubles. Contact stiffness grows only as N^1/3 (×1.26), so the elastic displacement drops only slightly. Clamp force is a security parameter, not an accuracy parameter.',
    tryIt: 'Compare “Clamping safety factor” and “Slot position error” at 3000/2000 N and 6000/4000 N.',
  },
  {
    id: 'F-B3', stage: 'experiment', kind: 'prediction',
    prompt: 'Predict: reversing the feed direction from +X to −X in this slot will…',
    options: ['Make no difference — the force magnitude is the same', 'Reduce the clamping safety factor, because the large cross-feed force now pushes the part away from the side locators into the side clamp', 'Increase the safety factor', 'Remove the axial force'],
    correct: 1,
    why: 'In slotting the largest mean force is perpendicular to the feed. Reversing the feed reverses that component. The magnitude is unchanged, but with −X it is resisted by the clamp and friction instead of the solid locators.',
    tryIt: 'Switch the feed direction and look at the force arrows on the part and the safety factor.',
  },
  {
    id: 'F-B4', stage: 'experiment', kind: 'prediction',
    prompt: 'Predict: replacing the plain pads (μ = 0.25) with serrated pads (μ = 0.4) will…',
    options: ['Raise the clamping safety factor by about 60 % without more clamp force', 'Make the part stiffer in Z', 'Have no effect', 'Reduce the slot depth error by 60 %'],
    correct: 0,
    why: 'Slip resistance is μN; with the same N it grows in proportion to μ (0.4/0.25 = 1.6). This is why serrated jaws are used for heavy roughing.',
    tryIt: 'Change the friction coefficient and watch the safety factor.',
  },
  {
    id: 'F-C1', stage: 'solve', kind: 'root-cause',
    prompt: 'Root cause: the slot position on some parts is out by 0.05–0.5 mm, randomly, and witness marks show that the part has moved on the base locators. Most likely…',
    options: ['Spindle runout', 'Insufficient clamping (or the cutting force directed into the clamps): the friction limit at the contacts is exceeded and the part slips', 'Wrong cutter diameter', 'Thermal growth of the table'],
    correct: 1,
    why: 'Elastic deflection gives small, repeatable errors (µm). Large random errors with witness marks indicate rigid-body slip: the cutting force exceeded μN at a contact.',
  },
];

export const FIXTURE_PROBLEM = {
  title: 'Production problem: keyway slot in a steel block',
  brief:
    'A 150 × 80 × 50 mm AISI 1045 block receives a Ø16 mm full-width slot, 8 mm deep, along its length (Y = 40 mm from the side datum) with a 4-flute end mill at 2500 rpm. The current fixture has its locators bunched near the middle and the slot is fed in −X. Inspection finds the slot out of position on many parts, and witness marks show that some parts moved in the fixture. Redesign the setup so that the slot position and depth are within ± 0.025 mm, nothing slips or lifts off, the clamping safety factor is at least 2, no clamp exceeds 6000 N (part distortion), and the lowest fixture natural frequency stays above 2 × the tooth-passing frequency.',
  material: 'aisi1045' as const,
  tolerance: 0.025,
  minSafety: 2,
  maxClamp: 6000,
  minFreqRatio: 2,
  maxCycleTime: 20,
  baseline: { layout: 'narrow', feedDir: '-X', topClamp: 2500, sideClamp: 1500, endClamp: 0, mu: 0.25, ap: 8, fz: 0.06 } as Partial<FixtureParams>,
  /** one admissible solution (for the automated solvability test, never shown to students) */
  knownSolution: { layout: 'good', feedDir: '+X', topClamp: 6000, sideClamp: 4500, endClamp: 0, mu: 0.35, ap: 8, fz: 0.06 } as Partial<FixtureParams>,
};

export const FIXTURE_ASSUMPTIONS: { title: string; items: string[] }[] = [
  {
    title: 'Module 5 fixture model',
    items: [
      'Workpiece is a rigid block (no bending of the part itself); it moves as a rigid body with 6 DOF on its contacts (small rotations).',
      'Each locator and clamp is a point contact: a compression-only normal spring and two tangential stick springs (k_t = 0.5 k_n), limited by Coulomb friction |T| ≤ μN. Lift-off and slip are found by active-set iteration.',
      'Contact stiffness is linearised about the clamped state with Hertz-type stiffening k = k_ref (N/1 kN)^1/3; the values are illustrative, typical of hardened rest buttons and screw clamps.',
      'Two load steps: clamping (preloads + gravity, normal springs only), then the cutting load as an increment. Clamping sequence, clamp-arm elasticity and part distortion by the clamps are not modelled.',
      'Cutting force from the Module 1 mechanistic model (30° helix, full-width slot), applied at the cutter centre at half the slot depth. Quasi-static: the forced vibration at tooth-passing frequency is not amplified (compare with the fixture natural frequencies).',
      'Feature error in the workpiece frame e = −u(cutting point): the feature is generated on the displaced part and springs back when the load is removed. Each station is independent (no cumulative slip history).',
    ],
  },
];
