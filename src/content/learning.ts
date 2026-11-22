/** Plain-engineering-language explanations shown in the learning overlay. */
export const PARAM_HELP: Record<string, string> = {
  rpm: 'Spindle speed n. Sets cutting speed vc = πDn/1000 and the tooth-passing frequency n·N/60. In this static model it does not change the force per tooth, but it changes feed rate, productivity and how close the excitation is to the wall’s natural frequency.',
  fz: 'Feed per tooth: how far the workpiece advances per cutting edge. It sets the maximum chip thickness h = fz·sin φ. Shear (cutting) forces grow in proportion to h; edge (ploughing) forces do not, so doubling fz less than doubles the force.',
  N: 'Number of flutes. More teeth → higher feed rate at the same fz, and more teeth in the cut at once (smoother but larger total force at high radial engagement).',
  ap: 'Axial depth of cut per Z-level (the engaged flute length b). Force is proportional to b. Smaller steps mean more passes but less force per pass and more support from the uncut stock below.',
  aeFinish: 'Radial depth of the finishing pass on each face (finishing allowance). Sets the engagement angle φa = arccos(1 − 2ae/D). Very small values may be dominated by edge forces and rubbing.',
  aeRough: 'Radial depth of each roughing pass (used only by strategies with roughing).',
  D: 'Tool diameter. Larger D → much stiffer tool (I ∝ d⁴) but a different engagement angle for the same ae.',
  helixDeg: 'Helix angle of the flutes. A helix spreads each tooth’s contact along the axis, smoothing the force. 0° reproduces the straight-flute model of the equations shown.',
  overhang: 'Tool stick-out from the holder. Tool deflection grows with the cube of overhang (δ ∝ L³). It must exceed the wall height to reach the bottom without the holder hitting the wall.',
  wallThickness: 'Final (nominal) wall thickness. Bending stiffness of the wall grows with t³, so halving the thickness makes it about eight times more flexible.',
  wallHeight: 'Unsupported wall height above the clamped base. For a cantilever, deflection grows with height cubed.',
  materialId: 'Workpiece alloy. Sets Young’s modulus E (stiffness) and the default cutting coefficients (illustrative, not calibrated).',
  strategy: 'Order of passes. It decides how thick the wall is (and how much supporting stock remains) at the moment each surface is finished.',
  mode: 'Down (climb) milling: the tooth enters at maximum chip thickness and exits at zero. Up (conventional) milling: enters at zero and exits at maximum. The final surface is generated at exit (down) or entry (up), so the force at that instant differs.',
  clamp: 'Clamping stiffness at the base. A rigid clamp is an idealisation; a compliant clamp lets the whole wall rotate, adding error.',
  coeffs: 'Specific cutting (K·c) and edge (K·e) coefficients of the linear mechanistic model. They must be calibrated by dynamometer tests for a given tool–material pair before force predictions can be called validated.',
  tolerance: 'Allowed ± deviation of the final wall thickness from nominal.',
};

export interface MCQ {
  id: string;
  stage: 'observe' | 'experiment' | 'solve';
  kind: 'concept' | 'prediction' | 'root-cause';
  prompt: string;
  options: string[];
  correct: number;
  why: string;
  /** suggested experiment to check a prediction */
  tryIt?: string;
}

export const QUESTIONS: MCQ[] = [
  {
    id: 'A1', stage: 'observe', kind: 'concept',
    prompt: 'Which global force component bends the thin wall?',
    options: ['Fx (feed direction)', 'Fy (normal to the wall face)', 'Fz (spindle axis)', 'All three equally'],
    correct: 1,
    why: 'The wall is thin in Y, so its bending stiffness is lowest in Y. Fx and Fz act in the wall plane, where it is very stiff.',
  },
  {
    id: 'A2', stage: 'observe', kind: 'concept',
    prompt: 'A positive thickness deviation in the results means…',
    options: ['The wall was overcut (too thin)', 'Material was left (undercut) because the wall and/or tool deflected away from each other', 'The wall expanded thermally', 'The tool wore down'],
    correct: 1,
    why: 'During the cut the wall bends away and the tool bends back; the edge removes less than nominal. When the force is removed the wall springs back, leaving extra thickness.',
  },
  {
    id: 'A3', stage: 'observe', kind: 'concept',
    prompt: 'Where on the wall is the error largest, and why?',
    options: ['Bottom centre, because the force is highest there', 'Top corners, because the local stiffness is lowest far from the clamp at the free edges', 'Uniform everywhere', 'Mid-height, because of chatter'],
    correct: 1,
    why: 'Stiffness falls with distance from the clamped base and is lowest at the free vertical edges. Use the colour map and the thickness-profile chart to confirm.',
  },
  {
    id: 'A4', stage: 'observe', kind: 'concept',
    prompt: 'The force-vs-angle graph repeats every…',
    options: ['Spindle revolution only', 'Tooth pitch 360°/N, i.e. a period of 60/(n·N) seconds', 'Toolpath pass', 'It does not repeat'],
    correct: 1,
    why: 'Each tooth sees the same engagement, so the pattern repeats once per tooth: the tooth-passing frequency is n·N/60 Hz.',
  },
  {
    id: 'B1', stage: 'experiment', kind: 'prediction',
    prompt: 'Predict: if the final wall thickness is doubled from 2 mm to 4 mm, the wall bending stiffness increases about…',
    options: ['2×', '4×', '8×', 'It does not change'],
    correct: 2,
    why: 'I = b·t³/12, so stiffness ∝ t³: doubling t gives 2³ = 8×.',
    tryIt: 'Set wall thickness to 4 mm and compare maximum wall deflection with a saved 2 mm trial.',
  },
  {
    id: 'B2', stage: 'experiment', kind: 'prediction',
    prompt: 'Predict: doubling feed per tooth fz (0.05 → 0.10 mm) changes the peak cutting force by…',
    options: ['Exactly 2×', 'Less than 2×', 'More than 2×', 'No change'],
    correct: 1,
    why: 'F = Kc·b·h + Ke·b. Only the first term scales with h (∝ fz); the edge term is constant, so the total grows by less than 2×.',
    tryIt: 'Save a trial, change fz to 0.10 mm, save again and compare peak force.',
  },
  {
    id: 'B3', stage: 'experiment', kind: 'prediction',
    prompt: 'Predict: increasing tool overhang from 45 mm to 60 mm increases tool deflection by about…',
    options: ['1.3×', '1.8×', '2.4×', '4×'],
    correct: 2,
    why: 'δ ∝ L³ for a cantilever: (60/45)³ ≈ 2.37.',
    tryIt: 'Compare “Tool deflection” for overhang 45 mm and 60 mm.',
  },
  {
    id: 'B4', stage: 'experiment', kind: 'prediction',
    prompt: 'Predict: compared with alternating-side finishing, single-side finishing (front face first, then back face) will…',
    options: ['Reduce the error on both faces', 'Increase the error, mainly on the second face, because it is cut when the wall is already thin', 'Make no difference', 'Only change productivity'],
    correct: 1,
    why: 'The second face is finished after the first face has removed its allowance over the full height, so the wall is thinner and less stiff when the second face is cut.',
    tryIt: 'Switch strategy between Alternating and Single-side and compare thickness-error maps.',
  },
  {
    id: 'C1', stage: 'solve', kind: 'root-cause',
    prompt: 'Root cause: a finished rib is within tolerance at the bottom but 0.15 mm thick at the top corners. The most likely cause is…',
    options: ['Spindle speed too high', 'Wall deflection under the normal cutting force, because stiffness drops toward the free top edges', 'Thermal expansion of the table', 'Incorrect tool length offset'],
    correct: 1,
    why: 'The error pattern follows the stiffness distribution of a cantilevered plate. A tool-length offset error would shift Z, not create a thickness gradient.',
  },
];

/** Stage C industrial problem definition. */
export const SOLVE_PROBLEM = {
  title: 'Production problem: aerospace rib, batch of 200',
  brief:
    'A supplier must finish a 7075-T651 rib: 50 mm long, 40 mm tall, final thickness 2.00 mm ± 0.10 mm, using the existing Ø8 mm 3-flute carbide end mill (overhang may be set between 42 and 60 mm). The current programme (alternating finishing, 5 mm steps, 0.5 mm per side) leaves the top corners out of tolerance. Find a strategy and parameters that meet the tolerance over the whole wall while keeping productivity at or above 2 000 mm³/min (average over the whole cycle, including roughing).',
  material: 'al7075' as const,
  wallThickness: 2,
  wallHeight: 40,
  wallLength: 50,
  D: 8,
  N: 3,
  tolerance: 0.1,
  minMRR: 2000,
  overhangRange: [42, 60] as [number, number],
};

export interface Reference {
  key: string;
  authors: string;
  year: number;
  title: string;
  venue: string;
  doi?: string;
  use: string;
  category: 'published-finding' | 'model-source';
}

/**
 * All DOIs below were checked against the Scite index on 2026-11-22 (title/year match,
 * no editorial notices). The `use` field states only how the app uses each source; the app
 * does not reproduce their numerical results.
 */
export const REFERENCES: Reference[] = [
  {
    key: 'lassila2024', authors: 'Lassila et al.', year: 2024,
    title: 'Numerical evaluation of cutting strategies for thin-walled parts',
    venue: 'Scientific Reports', doi: '10.1038/s41598-024-51883-1',
    use: 'Context for comparing pass sequences (single-side, alternating, stock-supported) in Module 1.',
    category: 'published-finding',
  },
  {
    key: 'bolar2021', authors: 'Bolar & Joshi', year: 2021,
    title: 'Experimental investigation and optimization of wall deflection and material removal rate in milling thin-wall parts',
    venue: 'Manufacturing Review', doi: '10.1051/mfreview/2021015',
    use: 'Context for the deflection–productivity (MRR) trade-off used in the Stage C problem.',
    category: 'published-finding',
  },
  {
    key: 'zawada2025', authors: 'Zawada-Michałowska', year: 2025,
    title: 'Thin Wall Milling at a Maximized Axial Depth of Cut: An Analysis of Thermal and Mechanical Interactions',
    venue: 'Materials', doi: '10.3390/ma18235347',
    use: 'Context for the effect of axial depth of cut. Note: thermal effects are NOT modelled in this release.',
    category: 'published-finding',
  },
  {
    key: 'si2018', authors: 'Si & Wang', year: 2018,
    title: 'Error compensation in the five-axis flank milling of thin-walled workpieces',
    venue: 'Proc. IMechE Part B: J. Engineering Manufacture', doi: '10.1177/0954405418780163',
    use: 'Context for deflection-induced surface error and its compensation (planned extension).',
    category: 'published-finding',
  },
  {
    key: 'altintas2012', authors: 'Altintas, Y.', year: 2012,
    title: 'Manufacturing Automation: Metal Cutting Mechanics, Machine Tool Vibrations, and CNC Design (2nd ed.)',
    venue: 'Cambridge University Press',
    use: 'Standard formulation of the linear-edge mechanistic milling-force model, immersion-angle convention and closed-form average forces used as benchmarks.',
    category: 'model-source',
  },
];

export interface ModuleInfo {
  id: number;
  title: string;
  status: 'operational' | 'planned';
  note: string;
}

export const MODULES: ModuleInfo[] = [
  { id: 1, title: 'Thin-wall deflection in aerospace blade milling', status: 'operational', note: 'Quasi-static mechanistic force + plate FE + stock removal.' },
  { id: 2, title: 'Tool bending in deep-pocket machining (long overhang)', status: 'operational', note: 'Stepped-cantilever tool with neck and holder/spindle compliance, rigid deep pocket, step-down / spring pass / compensation strategies.' },
  { id: 3, title: 'Chatter and dynamic instability', status: 'operational', note: 'Separate dynamic model: 2-DOF tool modes, ZOA stability lobes cross-checked by a time-domain regenerative simulation; forced vibration vs chatter; tap-test fitting.' },
  { id: 4, title: 'Cutting-force components in turning slender shafts', status: 'planned', note: 'Not yet implemented.' },
  { id: 5, title: 'Workpiece movement and fixture stiffness', status: 'planned', note: 'Base clamp compliance is available in Module 1; full fixture model not yet implemented.' },
  { id: 6, title: 'Tool wear and rising cutting forces in difficult alloys', status: 'planned', note: 'Not yet implemented.' },
];

export const ASSUMPTIONS: { title: string; items: string[] }[] = [
  {
    title: 'Cutting-force model',
    items: [
      'Linear edge-force mechanistic model: F = Kc·b·h + Ke·b for tangential, radial and axial directions.',
      'Chip thickness h = fz·sin φ (circular tool path approximation; tool run-out ignored).',
      'Helical flute discretised into 0.5 mm axial slices; helix = 0° gives the straight-flute model.',
      'Shipped coefficients are illustrative order-of-magnitude values, not calibrated.',
    ],
  },
  {
    title: 'Structural model',
    items: [
      'Wall: Reissner–Mindlin plate FE (Q4, selective reduced integration), clamped or spring-supported at the base; verified against cantilever beam theory (see tests).',
      'Only the force component normal to the wall (Y) bends the wall; in-plane components are carried by the much stiffer in-plane stiffness.',
      'Element thickness updated from the stock model once per pass; neutral-plane shift from one-sided removal ignored.',
      'Tool: Euler–Bernoulli cantilever, effective diameter 0.8·D, rigid holder and spindle (holder compliance would add to tool deflection).',
      'Base block, vise and machine structure are treated as rigid (except the optional base-clamp compliance).',
    ],
  },
  {
    title: 'Surface error',
    items: [
      'Quasi-static: inertia and damping are neglected. Valid only when the tooth-passing frequency is well below the wall’s first natural frequency (the app reports the ratio).',
      'Surface error is the relative tool–wall displacement at the instant each height is generated (φ = entry for up-milling, exit for down-milling).',
      'Force–deflection coupling: the immersion actually cut is reduced by the deflection; solved iteratively at each height.',
      'Peak elastic deflection shown in the viewport is NOT the final error: the wall springs back after the tool passes.',
      'No thermal distortion, residual stress, tool wear or chatter in this module.',
    ],
  },
];
