/**
 * Material library.
 *
 * UNITS (used throughout the physics layer):
 *   length mm, force N, stress / modulus MPa (= N/mm²), time s, mass tonne (t),
 *   density stored in kg/m³ and converted where needed (1 kg/m³ = 1e-12 t/mm³).
 *
 * PROVENANCE
 *   - Elastic properties (E, ν, ρ) are nominal handbook values for the alloy/temper.
 *   - Cutting-force coefficients shipped here are ILLUSTRATIVE: they are of the order
 *     of magnitude reported for each material class but are NOT calibrated for any
 *     specific tool, coating, edge preparation or coolant condition. Calibrated values
 *     must come from dynamometer tests (e.g. slot-milling linear regression of mean
 *     forces vs feed per tooth) and are entered through the coefficient editor, where
 *     they are tagged 'calibrated'.
 */

export type CoeffSource = 'illustrative' | 'user-defined' | 'calibrated';

export interface CuttingCoefficients {
  /** Tangential cutting coefficient, N/mm² */
  Ktc: number;
  /** Radial cutting coefficient, N/mm² */
  Krc: number;
  /** Axial cutting coefficient, N/mm² */
  Kac: number;
  /** Tangential edge coefficient, N/mm */
  Kte: number;
  /** Radial edge coefficient, N/mm */
  Kre: number;
  /** Axial edge coefficient, N/mm */
  Kae: number;
}

export interface Material {
  id: MaterialId;
  name: string;
  /** Young's modulus, MPa */
  E: number;
  /** Poisson's ratio */
  nu: number;
  /** Density, kg/m³ */
  rho: number;
  coeffs: CuttingCoefficients;
  /** Indicative cutting speed range for carbide end mills, m/min (for guidance text only) */
  vcRange: [number, number];
  note: string;
}

export type MaterialId = 'al7075' | 'al6061' | 'ti64' | 'aisi1045' | 'in718';

export const MATERIALS: Record<MaterialId, Material> = {
  al7075: {
    id: 'al7075',
    name: 'Aluminium 7075-T651',
    E: 71_700,
    nu: 0.33,
    rho: 2810,
    coeffs: { Ktc: 850, Krc: 280, Kac: 120, Kte: 15, Kre: 20, Kae: 1.5 },
    vcRange: [200, 600],
    note: 'High-strength aerospace alloy; baseline material for the thin-wall module.',
  },
  al6061: {
    id: 'al6061',
    name: 'Aluminium 6061-T6',
    E: 68_900,
    nu: 0.33,
    rho: 2700,
    coeffs: { Ktc: 700, Krc: 230, Kac: 100, Kte: 12, Kre: 16, Kae: 1.2 },
    vcRange: [200, 600],
    note: 'General-purpose structural aluminium.',
  },
  ti64: {
    id: 'ti64',
    name: 'Titanium Ti-6Al-4V (annealed)',
    E: 113_800,
    nu: 0.34,
    rho: 4430,
    coeffs: { Ktc: 1950, Krc: 700, Kac: 450, Kte: 25, Kre: 40, Kae: 3 },
    vcRange: [40, 90],
    note: 'Low modulus + high specific force: thin titanium walls deflect strongly.',
  },
  aisi1045: {
    id: 'aisi1045',
    name: 'Steel AISI 1045 (normalised)',
    E: 205_000,
    nu: 0.29,
    rho: 7850,
    coeffs: { Ktc: 2100, Krc: 800, Kac: 500, Kte: 30, Kre: 45, Kae: 3 },
    vcRange: [120, 250],
    note: 'Medium-carbon steel.',
  },
  in718: {
    id: 'in718',
    name: 'Inconel 718 (aged)',
    E: 200_000,
    nu: 0.29,
    rho: 8190,
    coeffs: { Ktc: 2800, Krc: 1100, Kac: 600, Kte: 35, Kre: 55, Kae: 4 },
    vcRange: [20, 50],
    note: 'Difficult-to-machine nickel superalloy.',
  },
};

/** Tungsten-carbide tool shank/flute modulus, MPa (nominal). */
export const CARBIDE_E = 600_000;
/** Effective-diameter factor for the fluted section of a 2–4 flute end mill (common approximation). */
export const FLUTE_DIAMETER_FACTOR = 0.8;

export const KG_M3_TO_T_MM3 = 1e-12;
