/** Module 7 teaching content: cutting force and workpiece distortion in thin-floor pocket milling. */
import type { MCQ } from './learning';
import type { ThinFloorParams } from '../physics/thinFloor';

export const THINFLOOR_HELP: Record<string, string> = {
  tFinal: 'Final floor thickness. Plate bending rigidity D = E·t³ / [12(1 − ν²)]: halving t makes the floor about 8× more flexible.',
  span: 'Pocket length and width = the unsupported span of the floor. For a given load the deflection grows roughly with the square of the span.',
  allowance: 'Stock left on the floor by roughing. It is removed in layers of depth ap; the last layer generates the final floor.',
  ae: 'Stepover (radial engagement) for zigzag and spiral passes. It sets the engaged arc and therefore the side-flute force; the end edges rub the floor in every engaged arc.',
  fz: 'Feed per tooth: chip thickness for both the side flutes and the end (bottom) edges, so the axial force grows with fz. Cutting time falls as fz rises.',
  edge: 'Perimeter support from the pocket walls: "clamped" = stiff thick walls (no rotation at the edge); "reduced" = thinner surrounding structure (elastic rotational restraint).',
  under: 'Underside support under the floor: a support pin at the centre, a 2 × 2 grid of pins, or an elastic bed (support plate, wax or low-melt filler, vacuum fixture).',
  strategy: 'Tool-centre path. Zigzag alternates climb and conventional passes; spiral works outward from the centre; adaptive-style keeps a low, constant engagement with feed compensation.',
  axial: 'End-cutting-edge axial coefficients (illustrative): the flat bottom edges of the end mill cut and rub the floor, adding an axial force (K_zc·fz·sinφ + K_ze)·R per engaged tooth. This dominates the floor load in finishing.',
};

export const THINFLOOR_QUESTIONS: MCQ[] = [
  {
    id: 'T-A1', stage: 'observe', kind: 'concept',
    prompt: 'In floor finishing, in which direction does the axial cutting force push the floor?',
    options: ['Upward, towards the tool', 'Downward, away from the tool: the tool is pushed up (+Fz on the tool) and the floor receives the opposite force', 'Sideways only', 'There is no axial force with an end mill'],
    correct: 1,
    why: 'The end edges and the helix push the tool up; by Newton’s third law the floor is pushed down and bends away from the cutter.',
  },
  {
    id: 'T-A2', stage: 'observe', kind: 'concept',
    prompt: 'Where is the floor deflection largest?',
    options: ['Always at the pocket corners', 'Under the cutter when it is near the middle of the unsupported span', 'Uniform over the whole floor', 'At the walls'],
    correct: 1,
    why: 'The walls hold the edges (w = 0). The bending field follows the load position: it is largest under the cutter when the cutter is far from any support.',
  },
  {
    id: 'T-A3', stage: 'observe', kind: 'concept',
    prompt: 'The floor deflected 70 µm under the cutter. Why is the finished floor THICKER than programmed in that region?',
    options: ['The program is wrong', 'The cutter removed material from a floor that was pushed down; when the load moved away the floor sprang back up, so less material was removed than intended', 'Thermal expansion', 'Tool wear'],
    correct: 1,
    why: 'Surface generation happens on the displaced floor. After elastic springback the machined top is above the nominal level: the thickness error equals the deflection at the moment the surface was cut (the smallest of the passes over that point).',
  },
  {
    id: 'T-B1', stage: 'experiment', kind: 'prediction',
    prompt: 'Predict: doubling the floor thickness from 1.5 to 3 mm (same cutting load) reduces the deflection by about…',
    options: ['2×', '4×', '8×', 'No change'],
    correct: 2,
    why: 'D ∝ t³, so the deflection falls by (3/1.5)³ = 8 for the same load and boundary conditions.',
    tryIt: 'Open “Deflection vs floor thickness”.',
  },
  {
    id: 'T-B2', stage: 'experiment', kind: 'prediction',
    prompt: 'Predict: a single support pin under the centre of the floor will…',
    options: ['Have no effect, the walls already hold the floor', 'Reduce the maximum deflection and the thickness error substantially by halving the effective span', 'Increase the error', 'Only change the natural frequency'],
    correct: 1,
    why: 'The pin adds a stiff support where the floor was most flexible. The effective span is roughly halved and the deflection falls sharply; the natural frequency rises too.',
    tryIt: 'Set “Underside support” to centre pin and compare the thickness map.',
  },
  {
    id: 'T-B3', stage: 'experiment', kind: 'prediction',
    prompt: 'Predict: halving the feed per tooth (0.06 → 0.03 mm) will…',
    options: ['Halve the thickness error and halve the time', 'Reduce the error by less than half (edge rubbing remains) and double the cutting time', 'Remove the error completely', 'Not change the force'],
    correct: 1,
    why: 'Only the chip-thickness-dependent part of the axial force falls; the edge (rubbing) part is independent of fz. The cutting time is inversely proportional to fz.',
  },
  {
    id: 'T-C1', stage: 'solve', kind: 'root-cause',
    prompt: 'Root cause: the CMM shows the floor is thick in the middle of the pocket and correct near the walls. Most likely…',
    options: ['Machine axis error', 'Elastic floor deflection under the axial cutting force (largest in the middle of the span) and springback after the cut', 'Wrong tool length offset (would shift the whole floor uniformly)', 'Coolant temperature'],
    correct: 1,
    why: 'A uniform offset error would shift the whole floor. An error that follows the bending shape (zero at the supports, maximum mid-span) is the signature of workpiece deflection.',
  },
  {
    id: 'T-C2', stage: 'solve', kind: 'concept',
    prompt: 'Which change reduces the thickness error WITHOUT increasing the cutting time?',
    options: ['Lowering fz', 'Switching to adaptive passes', 'Adding underside support (pins or a support plate) under the floor', 'More finishing layers'],
    correct: 2,
    why: 'Support changes the stiffness, not the toolpath, so the time is unchanged. Lower fz, more layers or adaptive passes reduce the force but cost time.',
  },
  {
    id: 'T-C3', stage: 'solve', kind: 'concept',
    prompt: 'Why is the quasi-static model flagged when the floor natural frequency approaches the tooth-passing frequency?',
    options: ['Because the CAD model is wrong', 'Because the force varies at the tooth-passing frequency and can excite the floor: dynamic amplification makes the real deflection larger than the static estimate', 'Because the material softens', 'It is never a problem'],
    correct: 1,
    why: 'A static solution is valid only when the excitation is well below the first natural frequency (here f₁ > 3·f_tp). Near resonance thin floors vibrate and chatter.',
  },
];

export const THINFLOOR_PROBLEM = {
  title: 'Production problem: aerospace pocket with a 1.5 mm floor',
  brief:
    'A 7075-T651 component has an 80 × 60 mm pocket with a 1.50 ± 0.05 mm floor. The floor is held by a relatively thin surrounding structure (reduced edge support). It is finished with a Ø8 mm 3-flute end mill from 0.5 mm of stock. The current programme (zigzag, ae = 4 mm, fz = 0.06 mm, 10 000 rpm, no underside support) leaves the floor too thick in the middle. Find conditions that bring the whole floor within ± 0.05 mm with a finishing cutting time of at most 40 s. Save at least three trials and justify your choice.',
  tol: 0.05,
  maxTime: 40,
  minTrials: 3,
  baseline: { strategy: 'zigzag', edge: 'reduced', under: 'none', fz: 0.06, ae: 4, rpm: 10000, allowance: 0.5, ap: 0.5 } as Partial<ThinFloorParams>,
  /** one admissible solution (for the automated solvability test, never shown to students) */
  knownSolution: { strategy: 'zigzag', edge: 'reduced', under: 'centre', fz: 0.06, ae: 4, rpm: 10000, allowance: 0.5, ap: 0.5 } as Partial<ThinFloorParams>,
};

export const THINFLOOR_ASSUMPTIONS: { title: string; items: string[] }[] = [
  {
    title: 'Module 7 thin-floor model',
    items: [
      'Floor = Reissner–Mindlin plate (Q4, selective reduced integration; same element as Module 1). Thickness varies element by element with the remaining stock; stiffness refactorised every 20 stations.',
      'Edges: w = 0 on the perimeter; clamped walls (rotations fixed) or reduced edge support (rotational spring 2·D/W per unit length, illustrative). Underside pins are linear springs; the elastic bed is a Winkler foundation.',
      'Axial load = side-flute force of the Module 1 model (closed-form mean, 30° helix) + end-cutting-edge term (K_zc·fz·sinφ + K_ze)·R per engaged tooth (illustrative coefficients). Applied as −F_tool, uniformly over the cutter footprint. In-plane forces (membrane) are neglected.',
      'Quasi-static: mean force per revolution, no dynamic amplification (flagged when f₁ < 3·f_tp). Small-deflection linear theory (flagged when w > 0.3 t).',
      'Coupling: engaged depth reduced by the local deflection (closed form for the linear model). Surface generation: final top = min over passes of (tool bottom + local deflection); elastic springback after unloading. No residual stress, thermal distortion or clamping distortion.',
      'Engagement is assigned from the toolpath geometry (first zigzag pass and the spiral centre line are full slots; stepover otherwise); corner engagement changes are ignored. Cells in the corner fillets (radius R) are not part of the floor evaluation.',
    ],
  },
];
