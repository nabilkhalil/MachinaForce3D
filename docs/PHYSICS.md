# Physics engine

All physics lives in `src/physics/` and has no UI dependencies (it runs in a Web Worker and in Node tests).

| File | Content |
|---|---|
| `materials.ts` | Units, materials (E, ν, ρ), illustrative cutting coefficients and their provenance tags |
| `millingForce.ts` | Mechanistic force model, engagement, frame transforms, kinematics, closed-form mean force |
| `plateFE.ts` | Mindlin plate FE of the wall, banded Cholesky solver, natural frequency |
| `toolDeflection.ts` | Cantilever tool model and the teaching formula δ = FL³/3EI |
| `stock.ts` | Two-sided height-field stock model |
| `process.ts` | Pass planning, force–deflection coupling, stock update, summary and warnings |

## 1. Units

mm, N, MPa (N/mm²), s, rpm; mass in tonnes for dynamics (density converted from kg/m³ by 10⁻¹²).
Results are shown in mm or µm, N, mm/min, mm³/min, Hz.

## 2. Coordinate frames and sign convention

**Machine frame (X, Y, Z)** — used for the 3D scene, the graphs, CSV exports and the equations shown to students:

- X along the wall length (0 … L), Y normal to the wall (front face at −Y, back face at +Y), Z along the spindle axis (up), Z = 0 at the clamped base.
- three.js is Y-up, so the whole scene sits in a group rotated −90° about X: (x, y, z)machine → (x, z, −y)three.

**Feed frame (x, y, z)** — the frame of the classical equations:

- x = feed direction of the tool relative to the workpiece, z = spindle axis, y = z × x.
- Spindle clockwise seen from above (M03). Immersion angle φ measured clockwise from +y. Edge position (R sin φ, R cos φ).
- Up-milling: material on +y, φst = 0, φex = φa. Down-milling: material on −y, φst = π − φa, φex = π. φa = arccos(1 − 2ae/D).
- Transformation for feed toward ±X (s = ±1): x = sX, y = sY, z = Z ⇒ FX = s·Fx, FY = s·Fy, FZ = Fz.

**All forces reported are forces on the tool.** The force on the workpiece is the negative; the viewport can show either.

Pass geometry: cutting the front face (n = +1, material at +Y of the tool) gives up-milling with s = +1 and down-milling with s = −1; the back face is the mirror image (n = −1).

## 3. Mechanistic force model

Per engaged tooth and axial slice of length db:

```
h  = fz · sin φ
Ft = Ktc·db·h + Kte·db,   Fr = Krc·db·h + Kre·db,   Fa = Kac·db·h + Kae·db
Fx = −Ft cos φ − Fr sin φ,   Fy = Ft sin φ − Fr cos φ,   Fz = Fa
```

Helical flutes: the slice at height z above the tip lags by ψ = 2 z tan β / D. β = 0 gives one slice with db = b (the straight-flute model of the brief). Forces are summed over all teeth (pitch 2π/N) and slices; forces act only inside [φst, φex].

**Why the helix matters here.** With a straight flute the chip thickness is exactly zero at the instant the final surface is generated (φ = 0 in up-milling, π in down-milling). The predicted surface error would then depend only on the edge coefficients: it would not respond to fz and would be identical in up- and down-milling, which would teach the wrong lesson. Real end mills have a helix, so other parts of the edge are cutting when a given height is generated. The default is β = 30°; set β = 0 to see the straight-flute behaviour.

## 4. Structure

**Wall.** Reissner–Mindlin plate in the X–Z plane, Q4 elements, 3 DOF/node (w, βx, βz). 2×2 Gauss integration for bending, 1-point for shear (selective reduced integration avoids shear locking at t/H ≈ 0.05). Element thickness = mean stock thickness in the element, updated at the start of every pass. Base: rigid (penalty) or translational + rotational springs per unit length. Default mesh 16×12; 10×8 and 24×20 are selectable.

**Load.** The cutting force normal to the wall is applied as a uniform patch over the engaged arc in X and the engaged flute length in Z, at the current tool position: never permanently at the wall tip.

**Tool.** Cantilever from the holder face, effective diameter 0.8·D, carbide E = 600 GPa, load at the centre of the engaged length. Holder, spindle and interface compliance are not included (this underestimates tool deflection).

**Natural frequency.** Inverse iteration with lumped translational mass (rotary inertia neglected), warm-started between passes. Reported for comparison with the tooth-passing frequency only.

## 5. Surface generation and force–deflection coupling

For each stock row z inside the engaged band:

1. The edge point at z is at φs (entry for up-milling, exit for down-milling) when the tip angle is φ0 = φs + ψ(z − zTip).
2. The relative deflection along the material normal n is e = (C_wall(z) + C_tool(z)) · (−FY·n), where the compliances come from the FE unit-load solution and the tool cantilever.
3. The real immersion is ae − e, so the force depends on e: we solve e = C·F(ae − e) by a bracketed Illinois (regula falsi) iteration on [−ae, ae]. g(e) = e − C·F(ae − e) is monotonic, so the root is unique. Without this coupling a flexible wall can be "predicted" to deflect more than the radial depth, which is impossible.
4. Generated surface: y_s = y_target + δ_tool − w_wall. The stock face is moved to y_s only where material exists.

Peak elastic deflection (shown in the viewport) is **not** the final error: the final error is the spring-back difference at the generation instant, recorded in the stock.

## 6. Strategies

| Strategy | Sequence |
|---|---|
| Single-side | front face all levels (top → bottom), then back face all levels |
| Alternating | per level: front, back |
| Rough all, then finish all | roughing per level for both faces over the full height, then finishing per level |
| Step-support | per level: rough front, rough back, finish front, finish back |

Initial stock thickness = t + 2·ae,finish (+ 2·ae,rough for strategies with roughing).

## 7. Productivity

vf = n·N·fz; vc = πDn/1000; nominal finishing MRR = ae·ap·vf; average MRR = removed volume / cutting time (rapid moves excluded).

## 8. Validity and limits

Quasi-static (f_tp ≪ f₁; the ratio is reported and a warning is raised above 0.3). Linear edge-force model. No run-out, tool wear, thermal distortion, residual stress or chatter. Stiffness is updated per pass, not within a pass. Neutral-surface shift from one-sided removal is ignored. Coefficients shipped with the app are illustrative.

## 9. Performance

The default case (16 passes, 26 stations each) solves in about 0.2 s in Node 22 and runs in a Web Worker in the browser, so the interface does not freeze. The heaviest preset case (step-support, ap = 2 mm, 80 passes) takes about 1 s.


---

# Module 2 — Tool bending in deep-pocket machining

Files: `toolBeam.ts`, `pocketProcess.ts`.

## Geometry
Pocket side wall = plane Y = 0, solid (rigid) material at +Y, pocket at −Y, floor Z = 0, top Z = Hp. The tool finishes the wall from the pocket side (Module 1 "front face", n = +1). Feed toward +X for up-milling, −X for down-milling.

## Tool model
Stepped Euler–Bernoulli cantilever along s (holder face s = 0 → tip s = L): shank D | neck dn (optional, length Ln) | flutes 0.8·D (length Lf). Carbide E = 600 GPa, ρ = 14 500 kg/m³. Holder + spindle: springs kT (N/mm) and kR (N·mm/rad) at s = 0, giving θ(0) = M0/kR and δ(0) = V0/kT. Curvature M/EI is integrated twice on a 241-node grid (trapezoidal rule). Stress σ = M·c/I with c = half the local outer (or effective fluted) diameter; compared with an indicative carbide rupture strength of 3 500 MPa. First bending frequency by Rayleigh's method using the self-weight deflection shape.

## Loading and surface generation
The cutting force is spread uniformly over the engaged flute length (tip at the level bottom, so the engaged band is s ∈ [L − b, L]). The unit-load deflection g(z) = δ(s = L − (z − zTip)) gives, per height z, the coupled error e = g(z)·F(ae − e), solved with the same bracketed Illinois iteration as Module 1. Generated surface y_s = y_target + g·FY; wall deviation d = −y_s (positive = proud).

## Strategies
- **Full-depth**: one level [0, Hp]; flagged if b > Lf (neck/shank would rub).
- **Step-down**: levels of ap from the top.
- **Spring pass**: each level is cut twice at the same target; the second pass engages only the residual.
- **Compensated**: an uncompensated step-down run gives the mean deviation per level; each level's target is then offset into the wall by that amount (one iteration of model-based compensation, cf. Si & Wang 2018 for compensation in flank milling).

## Outputs
Max/min/mean deviation, area in tolerance, form error (max over X of the range along Z), top–bottom taper indicator, peak tip deflection, tip stiffness, holder share of tip compliance, peak bending stress and ratio to rupture strength, tool f₁ vs tooth-passing frequency (information only), vf, average MRR, cutting time.

## Limits
Rigid workpiece and machine; linear holder springs; no runout, no holder-taper contact nonlinearity, no dynamics/chatter, no thermal effects; static stress only (no fatigue/impact/stress concentration).


---

# Module 3 — Chatter and dynamic instability

File: `chatter.ts`. This model is dynamic and independent of the quasi-static Modules 1–2.

## Structure
Tool + holder + spindle: one mode per direction in the feed frame (x = feed, y = normal), m q̈ + c q̇ + k q = F, receptance G(f) = 1/(k(1 − r² + 2iζr)). Workpiece rigid; no x–y cross terms. Dynamic stiffness = 1/|G|, minimum ≈ 2kζ near resonance.

## Regenerative chip thickness
h_j = [fz sin φj + (d(t) − d(t−T))·n] g(φj), n = (sin φj, cos φj), T = tooth period. g = 1 in the engagement arc when h > 0, else the tooth is out of cut. With surface memory, the "previous surface" is the last surface actually cut at that angular position, with the accumulated feed if teeth were out (multiple regeneration).

## Zero-order approximation (stability lobes)
Average directional factors over [φst, φex] (Altintas):
αxx = ½[cos2φ − 2Krφ + Kr sin2φ], αxy = ½[−sin2φ − 2φ + Kr cos2φ], αyx = ½[−sin2φ + 2φ + Kr cos2φ], αyy = ½[−cos2φ − 2Krφ − Kr sin2φ].
Eigenvalues μ of [α][Φ(iωc)] give Λ = −1/μ; a_lim = −(2πΛR/(N Kt))(1+κ²), κ = ΛI/ΛR, ε = π − 2 atan κ, T = (ε + 2kπ)/ωc, n = 60/(N T). Curves are built per eigen-branch and lobe number in chatter-frequency order; the envelope is the lowest lobe at each speed. Benchmark: slotting with only y flexible gives a_lim,min = 8kζ(1+ζ)/(N Krc).

## Time-domain simulation
Exact state transition of each underdamped mode over Δt = T/64 with zero-order hold on the force (evaluated at the step midpoint to avoid entry/exit sampling artefacts); 240 tooth periods by default; the last 40 % is analysed.
- **Chatter test:** sample x, y once per tooth period at a fixed phase. Stable forced vibration is tooth-periodic, so the samples coincide; chatter adds non-synchronous motion. Verdict "chatter" when rms(sample scatter)/rms(motion) > 0.1.
- **Spectrum:** Hann-windowed FFT of y; the dominant peak is classed as a tooth-passing harmonic (forced) or not (chatter frequency).
- **Boundary:** for each speed, bisection on ap with the verdict above.

## Forced response
Force over one tooth period with a rigid tool → Fourier harmonics F_k at k·f_tp → X_k = G(k f_tp)·F_k.

## Tap-test fit
Peak picking on the measured receptance: fn at the minimum of Im G, ζ from the half-power bandwidth of |G|, k = −1/(2ζ Im_min).

## Validity
ZOA is reliable at moderate to high radial immersion and optimistic at low immersion; the time-domain result is the reference there. Not modelled: process damping, speed-dependent spindle dynamics, runout, variable pitch/helix, workpiece modes.


---

# Module 4 — Cutting-force components in turning slender shafts

File: `turning.ts`.

## Frame
ISO lathe frame: Z along the spindle axis from the chuck face, X radial toward the tool (programmed as a diameter), Y completing the right-handed set (the surface passes the tool in −Y). The scene maps lathe (x, y, z) → three.js (z, y, −x), i.e. the tool sits behind the shaft as on a rear-turret CNC lathe. Forces are reported on the tool: Fc → −Y, Ff opposes the feed motion, Fp → +X.

## Force model
Equivalent straight edge: the chord from the bottom of the nose to the point where the edge (nose arc t ∈ [0, κr], then the straight edge at κr) leaves the uncut surface at depth ap gives κe. Then h = f sin κe, b = ap / sin κe, Fc = Ktc b h + Kte b, FN = Krc b h + Kre b, Ff = FN sin κe, Fp = FN cos κe. For a sharp tool κe = κr; with ap < rε(1 − cos κr) the cut is entirely on the nose and κe is independent of κr. Milling-derived coefficients are used as illustrative turning coefficients.

## Shaft
Euler–Bernoulli beam elements (2 DOF/node, default 60), element diameter = mean of the current stock over the element; rebuilt at each tool position. Supports: chuck = translational + rotational springs (or rigid), head/tail centre or live centre = translational spring (rotation free), steady rest = translational spring at the nearest node. Point load via Hermite shape functions; deflection sampled with the same functions. First bending frequency by Rayleigh's method with the self-weight shape.

## Diameter generation
e = (C_shaft(z) + 1/k_tool)·Fp(ap − e) solved by bisection on [0, ap]; generated diameter d = d_target + 2e (never larger than the current stock). The Y deflection from Fc is reported with its radius effect δy²/(2r).

## Productivity and finish
n = 1000 vc/(π d0) (constant spindle speed), vf = f·n, Pc = Fc·vc/60 000, M = Fc·d0/2, Q = vc·ap·f, Ra ≈ f²/(32 rε), Rz ≈ f²/(8 rε).

## Limits
Quasi-static (no whirling or chatter; see Module 3 for dynamics), linear support springs, no thermal growth, no tool wear, no chip-flow-dependent Fc direction, kinematic roughness only.


---

# Module 5 — Workpiece movement and fixture stiffness

File: `fixture.ts`.

## Model
The workpiece is a rigid block (150 × 80 × 50 mm by default) with 6 DOF about its centroid c: q = (δx, δy, δz, θx, θy, θz), u(p) = δ + θ × (p − c) (small rotations). Locating follows the 3-2-1 principle: 3 base locators (normal +Z), 2 side locators (+Y), 1 end locator (+X). Clamps push along −Z (top straps), −Y (side screw) and optionally −X (end screw). Three layouts: *good* (spread locators, a top clamp directly above each base locator, side clamp opposite the side locators), *narrow* (locators bunched near the middle) and *off-locator* (two top clamps where there is no locator underneath, side clamp high).

## Contacts
Each element is a point contact with a compression-only normal spring k_n and two tangential stick springs k_t = 0.5 k_n, limited by Coulomb friction |T| ≤ μN. A spring along unit vector d at p adds k JᵀJ to the 6 × 6 stiffness, J = [d, (p − c) × d]. Contact stiffness for the cut step is linearised about the clamped state with Hertz-type stiffening k = k_ref (N0 / 1 kN)^(1/3) (floor 50 N).

## Load steps
1. **Clamping:** clamp preloads P (force-controlled) + gravity on the locator normal springs; locators that go into tension are released (active set). Result: N0 at every contact. A configuration is rejected (`ok = false`) when a locator that some clamp pushes toward is unseated; an end locator without an end clamp may stay unloaded.
2. **Cutting:** the force on the workpiece W = −F_tool from the Module 1 mechanistic model (full-width slot, ae = D, down-milling convention for the engaged half, 30° helix) at (x_tool, Y_slot, Z_top − ap/2), sampled at 24 angles over one tooth pitch at each station. Incremental solution K q = W + W_lift + W_slip with active-set iterations: lift-off when N = N0 − k_n(u·n) < 0 (its clamped force is then released), slip when |T| > μN (the stick springs are replaced by a Coulomb force μN opposing the slip direction), re-engagement of an unloaded contact when its trial normal force becomes compressive.

## Outputs
Feature error in the datum frame e = −u(cutting point) (mean over the revolution): slot position eY, depth eZ, straightness and flatness along X, tilt. Friction reserve min μN/|T| over preloaded contacts (contacts carrying < 1 % of the largest clamp force are excluded: they may micro-slip without moving the part). Clamping safety factor = 1 / (smallest common clamp multiplier for which μN ≥ |T| and N > 0 everywhere), by bisection on a coarse path. Force-direction check per axis (into the locators or into a clamp / friction). Fixture modes from K φ = ω² M φ with M = diag(m, m, m, Ixx, Iyy, Izz) (Jacobi), compared with the tooth-passing frequency. Static push test for validation.

## Limits
Rigid part (no bending of the workpiece or clamping distortion), point contacts, illustrative stiffness and friction, quasi-static (the fixture modes are information only), stations independent (no accumulated slip), no tool deflection or machine error in the feature error.


---

# Module 6 — Tool wear evolution and cutting force

File: `toolWear.ts` (uses `millingForce.ts` unchanged).

## Force model with flank wear
Flank wear VB (0–0.5 mm, uniform on every tooth) adds a rubbing/ploughing force along the engaged edge, so it enters the edge coefficients: Kte(VB) = Kte0 + ate·VB, Kre(VB) = Kre0 + are·VB, Kae(VB) = Kae0 + aae·VB (K·e in N/mm, a·e in N/mm²; clamped at ≥ 0). Shearing coefficients are unchanged. Defaults ate = 4 Kte0, are = 5 Kre0, aae = 4 Kae0 per mm are illustrative; `fitWearCoefficients` estimates them by least squares from measured mean forces at several VB (the mean force is linear in the edge coefficients).

## Outputs
Forces over one revolution (30° helix, 0.5 mm slices): mean Fx, Fy, Fz, mean and peak resultant, increase vs VB = 0. Torque T = R·ΣFt, power P = T·ω, specific energy u = P/MRR (J/mm³). Condition indicator from VB/VBc (fresh < 0.25, normal < 0.8, approaching < 1, replace ≥ 1, beyond VBmax 0.5 mm). Roughness: qualitative risk only.

## Wear growth (optional, illustrative)
dVB/dt = A·(vc/vref)^p·(fz/fref)^q → VB(t) = VB0 + rate·t for fixed conditions (no running-in or accelerated stage). Time to criterion t_c = (VBc − VB0)/rate; parts per tool = floor(t_c/t_part); tools = ⌈batch/parts per tool⌉; total time = batch·t_part + (tools − 1)·t_change. Not a tool-life prediction; Taylor's equation is not used.

## Criterion
VB = 0.3 mm uniform and VBmax = 0.5 mm localized flank wear are the criteria commonly used in ISO 8688-2 end-milling tool-life tests. They allow tool/condition comparison; a production criterion depends on tolerance, surface and process security.

## Limits
Uniform flank wear; linear growth of edge forces; no crater wear, chipping, built-up edge, edge radius, runout, temperature, coolant or dynamics; wear does not alter the chip geometry; constant wear rate.

