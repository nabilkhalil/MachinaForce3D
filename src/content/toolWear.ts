/** Module 6 teaching content: tool wear evolution and cutting force in end milling. */
import type { MCQ } from './learning';
import type { ToolWearParams } from '../physics/toolWear';

export const TOOLWEAR_HELP: Record<string, string> = {
  VB: 'Flank wear VB: width of the worn land on the clearance (flank) face, measured from the cutting edge. The land rubs on the machined surface, adding a ploughing/friction force that does not remove material.',
  VBcrit: 'Replacement criterion. ISO 8688-2 (tool-life testing in end milling) commonly uses VB = 0.3 mm uniform flank wear (or VBmax = 0.5 mm localized wear) as end-of-life criteria for comparing tools. In production you may choose a smaller value for accuracy or surface quality.',
  vc: 'Cutting speed at the tool periphery. Spindle speed n = 1000·vc/(π·D). In the growth model, wear rate rises strongly with vc (exponent p).',
  fz: 'Feed per tooth: sets the chip thickness, hence the shearing force. Wear per minute grows with fz (exponent q), but the time per part falls.',
  ap: 'Axial depth of cut = length of cutting edge in contact (b). Both the shearing and the edge (wear) force scale with it.',
  ae: 'Radial engagement (width of cut). Small ae (finishing) gives thin chips, so the edge/ploughing share of the force — and therefore the effect of wear — is large.',
  growth: 'Optional illustrative wear-rate model dVB/dt = A·(vc/vref)^p·(fz/fref)^q. It gives a straight VB(t) line for fixed conditions. It is a teaching device, not a validated tool-life prediction: calibrate A, p, q from your own wear measurements.',
  wear: 'Wear coefficients: how much each edge coefficient grows per mm of flank wear, Kte(VB) = Kte0 + ate·VB (N/mm² = N/mm per mm). Illustrative until fitted to measured force-versus-VB data (Validate stage).',
  production: 'Production plan: the tool is changed before the part that would take VB past the criterion. Parts per tool = floor(time to criterion / time per part).',
};

export const TOOLWEAR_QUESTIONS: MCQ[] = [
  {
    id: 'W-A1', stage: 'observe', kind: 'concept',
    prompt: 'Which wear mechanism mainly produces the flank wear land VB on a carbide end mill?',
    options: ['Plastic deformation of the shank', 'Abrasion (and adhesion/diffusion at high temperature) as the clearance face rubs on the freshly machined surface', 'Chatter only', 'Thermal expansion of the holder'],
    correct: 1,
    why: 'Hard particles and adhesion at the tool–workpiece interface remove tool material from the clearance face; at higher speeds diffusion and oxidation accelerate it. Crater wear on the rake face and chipping are other modes.',
  },
  {
    id: 'W-A2', stage: 'observe', kind: 'concept',
    prompt: 'In the model, which coefficients change with flank wear, and why?',
    options: ['The shearing coefficients Ktc, Krc, Kac, because the material gets harder', 'The edge coefficients Kte, Kre, Kae, because the wear land adds a rubbing/ploughing force proportional to the contact length, not to the chip thickness', 'Only the axial coefficient', 'None — wear changes only the surface finish'],
    correct: 1,
    why: 'The worn land contacts the machined surface over a width VB along the whole engaged edge. That force exists even for a zero-thickness chip, so it enters the edge (per unit length) terms.',
  },
  {
    id: 'W-A3', stage: 'observe', kind: 'concept',
    prompt: 'Which force component usually rises MOST (in %) as the flank wear land grows?',
    options: ['The tangential (cutting) force', 'The radial (thrust) force normal to the machined surface', 'The axial force', 'All rise by the same percentage'],
    correct: 1,
    why: 'The wear land presses against the machined surface: the normal (radial) component grows fastest, which also increases tool deflection and rubbing heat.',
  },
  {
    id: 'W-B1', stage: 'experiment', kind: 'prediction',
    prompt: 'Predict: in this finishing cut (ae = 1.2 mm on Ø12 mm), increasing VB from 0 to 0.3 mm will raise the mean resultant force by about…',
    options: ['5 %', '20 %', '50–100 %', 'More than 300 %'],
    correct: 2,
    why: 'With thin chips the edge/ploughing share is large, so the illustrative wear coefficients roughly double the resultant force at the criterion. The exact value depends on calibrated coefficients.',
    tryIt: 'Move the VB slider from 0 to 0.30 mm and read “Force increase vs fresh tool”.',
  },
  {
    id: 'W-B2', stage: 'experiment', kind: 'prediction',
    prompt: 'Predict: what happens to the specific cutting energy (J/mm³) as the tool wears?',
    options: ['It stays constant because the MRR is unchanged', 'It rises: more power is consumed for the same volume of material removed, mostly as friction heat at the wear land', 'It falls', 'It becomes negative'],
    correct: 1,
    why: 'u = P/MRR. The MRR is fixed by the cutting conditions, but the tangential edge force and therefore the power increase with VB.',
    tryIt: 'Open “Power vs VB” and compare the specific energy at VB = 0 and at the criterion.',
  },
  {
    id: 'W-B3', stage: 'experiment', kind: 'prediction',
    prompt: 'Predict (growth mode, p = 3, q = 1): raising the cutting speed from 60 to 90 m/min will change the parts machined per tool by about…',
    options: ['No change', 'Half as many parts per tool', 'About one-third to one-half as many', 'Twice as many'],
    correct: 2,
    why: 'Wear rate rises by (90/60)³ ≈ 3.4 while the time per part falls only by 1.5, so wear per part rises ≈ 2.25 × and the parts per tool fall to ≈ 0.44 × (whole parts only).',
    tryIt: 'Tick “Wear-growth mode”, compare “Parts per tool” at vc = 60 and 90 m/min.',
  },
  {
    id: 'W-C1', stage: 'solve', kind: 'root-cause',
    prompt: 'Root cause: late in each tool’s life the walls show burnished bands, the spindle load meter climbs and parts go undersize. Most likely…',
    options: ['Wrong tool diameter', 'Excessive flank wear: rubbing raises the radial force (more deflection) and the power', 'Too low coolant concentration only', 'Program error'],
    correct: 1,
    why: 'A growing wear land increases the thrust force and rubbing; the extra deflection and heat leave dimension and surface errors that appear progressively along the tool life.',
  },
  {
    id: 'W-C2', stage: 'solve', kind: 'concept',
    prompt: 'To machine more parts per tool with the same metal removal rate, the better first move is usually to…',
    options: ['Raise vc and lower fz', 'Lower vc and raise fz (within the force and quality limits)', 'Raise both vc and fz', 'Raise the replacement criterion above 0.5 mm'],
    correct: 1,
    why: 'Wear is far more sensitive to speed than to feed (p ≫ q). Keeping vf = n·N·fz constant with lower n and higher fz reduces the wear per part — but the force per tooth rises, so check the force limit at the worn state.',
  },
  {
    id: 'W-C3', stage: 'solve', kind: 'concept',
    prompt: 'Why should the force limit be checked at the replacement criterion rather than with a fresh tool?',
    options: ['Because the fresh tool is weaker', 'Because the force is highest just before the tool is replaced; a set-up that is safe when fresh may overload the tool, part or fixture when worn', 'Because the standard says so for all materials', 'It makes no difference'],
    correct: 1,
    why: 'Force grows with VB, so the worst case is the end of each tool’s life. Process limits (deflection, breakage, power) must hold at VB = criterion.',
  },
];

export const TOOLWEAR_PROBLEM = {
  title: 'Production problem: titanium brackets — tool changes and cycle time',
  brief:
    'A batch of 40 Ti-6Al-4V brackets is finish-milled with a Ø12 mm, 4-flute carbide end mill (ap = 10 mm, ae = 1.2 mm, down-milling), 600 mm of cutting per part. The current programme runs at vc = 90 m/min and fz = 0.04 mm. The shop replaces tools at VB = 0.30 mm (ISO 8688-2 uniform-wear criterion) and each change takes 6 min. Using the wear-growth model, finish the batch with at most 3 tools and a total time (cutting + tool changes) of at most 65 min, with VB never above 0.30 mm and the peak cutting force at the replacement criterion not above 1150 N (tool and fixture limit).',
  material: 'ti64' as const,
  maxTools: 3,
  maxTime: 65,
  maxCrit: 0.3,
  maxPeakForce: 1150,
  baseline: { vc: 90, fz: 0.04, VBcrit: 0.3, growthMode: true } as Partial<ToolWearParams>,
  /** one admissible solution (for the automated solvability test, never shown to students) */
  knownSolution: { vc: 60, fz: 0.08, VBcrit: 0.3, growthMode: true } as Partial<ToolWearParams>,
};

export const TOOLWEAR_ASSUMPTIONS: { title: string; items: string[] }[] = [
  {
    title: 'Module 6 tool-wear model',
    items: [
      'Mechanistic force model of Module 1 with flank wear entering the EDGE coefficients only: Kte(VB) = Kte0 + ate·VB, Kre(VB) = Kre0 + are·VB, Kae(VB) = Kae0 + aae·VB (clamped at ≥ 0). Shearing coefficients are unchanged.',
      'Wear coefficients are illustrative (default ate = 4 Kte0, are = 5 Kre0, aae = 4 Kae0 per mm of VB) until fitted to measured force-versus-VB data.',
      'Uniform flank wear on every tooth; no crater wear, chipping, built-up edge, edge rounding or runout; wear does not change the tool geometry seen by the chip.',
      'Optional wear growth dVB/dt = A·(vc/vref)^p·(fz/fref)^q gives a constant rate (no running-in or accelerated final stage). It is a teaching device, not a validated tool-life prediction; Taylor’s equation is not applied.',
      'Power from the tangential forces (P = T·ω, T = R·ΣFt); specific energy u = P/MRR in J/mm³. Quasi-static: no thermal model, no dynamics.',
      'Surface roughness is shown only as a qualitative risk indicator (no validated roughness prediction).',
      'VB = 0.3 mm uniform and VBmax = 0.5 mm localized flank wear follow the criteria commonly used in ISO 8688-2 tool-life tests; they compare tools and are not a universal shop replacement rule.',
    ],
  },
];
