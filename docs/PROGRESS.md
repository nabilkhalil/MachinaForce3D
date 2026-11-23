# Progress log

## Milestone 6 — 2026-11-23: Module 6, tool wear evolution and cutting force ✅

Delivered
- `src/physics/toolWear.ts`: wear-dependent edge coefficients, forces/torque/power/specific energy vs VB, illustrative wear-rate model, condition indicator, qualitative roughness risk, tool-replacement and batch plan, wear-coefficient and wear-rate fitting.
- Scene: side finishing on the machining centre with wear lands on every flute (∝ VB), worn-tool force arrows, inset cutting-edge close-up (fresh edge, wear land, shearing vs ploughing forces).
- Panels: tool condition, cutting conditions, growth model, production planning, wear and force coefficients; charts (forces vs angle fresh/worn, force vs VB, power & energy vs VB, wear vs time, fresh vs worn, trials); CSV exports; Stage A/B/C (3 MCQs each), titanium tool-change production problem (failing baseline and solvability tested), report; Validate: force-vs-VB fit and VB-vs-time fit.
- 17 new tests (146 total).

Findings (illustrative coefficients)
- Ti-6Al-4V finishing (ae = 0.1 D): VB 0 → 0.3 mm raises the mean resultant force ≈ 85 % and power ≈ 50 %; the radial (thrust) tooth force grows faster than the tangential one.
- With p = 3, q = 1, lowering vc and raising fz at constant vf multiplies the parts per tool; the binding constraint becomes the peak force at the criterion.


## Milestone 5 — 2026-11-23: Module 5, workpiece movement and fixture stiffness ✅

Delivered
- `src/physics/fixture.ts`: rigid 6-DOF workpiece on 3-2-1 point contacts (compression-only normal springs, tangential stick springs, Coulomb friction), Hertz-type contact stiffening, clamping step (preloads + gravity) and incremental cutting step with active-set lift-off / slip / re-engagement; cutting force from the Module 1 model over one tooth pitch at every station; feature errors in the datum frame, friction reserve, minimum clamp-force multiplier (clamping safety factor), force-direction check, fixture natural frequencies, clamp-force sweep, static push test.
- Scene: subplate, locator pins and posts, strap and screw clamps on the machining centre; the block drawn with its exaggerated rigid-body motion; pads coloured by contact state; slot cut progressively with the floor coloured by |error| / tolerance; contact-force labels; "part not held" banner.
- Panels: workpiece, fixture (layout, clamps, end clamp, μ, stiffness), slot operation; results (mean force and direction check, security, slot errors, contact table, warnings); charts (slot error along X, contact normal and friction forces, cutting force on the part over a revolution, clamping-force study, trials); CSV exports.
- Learning: Module 5 Stage A/B/C, keyway-slot production problem (verified failing baseline, verified solvable), scoring, report; Validate: static push test and CMM slot errors.
- 20 new tests (129 total).

Findings
- Default good layout (3 × 3000 N top, 2000 N side, μ = 0.25): slot position error ≈ 11 µm, depth ≈ 2 µm, clamping safety factor ≈ 1.8.
- Bunching the locators near the middle raises the slot error ≈ 4× and the tilt ≈ 6× and makes the part slip; placing clamps away from the locators unseats a base locator during clamping.
- In full-width slotting the largest mean force is perpendicular to the feed: feeding −X instead of +X pushes the part into the side clamp instead of the side locators and lowers the safety factor (≈ 1.8 → 1.3).
- Doubling the clamp forces doubles the friction reserve but lowers the slot error by only ≈ 20 % (k ∝ N^1/3).


## Milestone 4 — 2026-11-22: Module 4, cutting-force components in turning slender shafts ✅

Delivered
- `src/physics/turning.ts`: ISO force components Fc/Ff/Fp with a nose-radius equivalent edge (κe from the chord of the engaged nose + edge, h = f sin κe, b = ap/sin κe), cutting power, torque, MRR, theoretical Ra/Rz; Euler–Bernoulli beam FE of the shaft rebuilt at every tool position from the current diameter profile; chuck (translation + tilt), tailstock / centres and steady rest as springs; tool/turret compliance; force–deflection coupling for the generated diameter; strategies single / spring pass / rough + finish; feed direction; shaft first natural frequency; slenderness, power and nose-radius warnings.
- Lathe scene in its own ISO lathe frame (Z spindle axis, X toward the rear turret, Y up): headstock, rotating chuck or head centre with driving dog, shaft rebuilt from the diameter profile and bent by the computed deflection, tailstock, steady rest, carriage and insert; force arrows Fp/Fc/Ff on the tool or workpiece.
- Panels: shaft, workholding, tool, cutting; results (components with shares, power/torque, deflections incl. the second-order effect of Fc, diameter tolerance, Ra, shaft f₁); charts (components along Z, diameter error profile, shaft deflected shape, forces and κe vs depth of cut, trials); CSV exports.
- Learning: Module 4 Stage A/B/C, slender-shaft production problem (verified failing baseline, verified solvable), scoring, report; Validate: 3-component dynamometer means and micrometer diameters.
- 21 new tests (109 total).

Findings
- With ap = 0.5 mm and rε = 0.8 mm the whole cut lies on the nose: the equivalent entering angle is ≈ 34° whatever κr is, so Fp ≈ 0.45·Fc — the entering angle only matters for deeper cuts.
- Chuck only (L/D ≈ 12) gives ≈ 0.39 mm diameter error vs ≈ 0.023 mm with a tailstock and ≈ 0.013 mm with a mid-span steady rest; a spring pass removes almost all of the remaining error at double the cutting time.
- Fc is ≈ 2× Fp but its tangential deflection (≈ 19 µm) changes the radius by only ≈ 0.015 µm.

## Milestone 3 — 2026-11-22: Module 3, chatter and dynamic instability ✅

Delivered
- `src/physics/chatter.ts` — a dynamic model separate from the static Modules 1–2: one mode per direction (fn, ζ, k), receptance and dynamic stiffness, average directional factors, zero-order-approximation stability lobes, exact-discretisation time-domain simulation of regenerative milling with tooth jump-out and surface memory (multiple regeneration), chatter detection by once-per-tooth sampling and spectrum (never by force level), forced-vibration response from force harmonics × FRF, time-domain stability boundary by bisection, tap-test peak-picking fit.
- 3D: block side milling in the vise; tool motion, rotation and vibration from the simulation; machined face coloured by vibration (chatter marks).
- Panels: modal editor (symmetric/asymmetric, import from Module 2), verdict banner, two-method stability comparison, vibration, dynamic stiffness, productivity; charts: stability lobes with time-domain boundary, measured cuts and operating point (click to set speed), FRF with tooth harmonics, vibration vs time with once-per-tooth samples, spectrum, trials; CSV exports.
- Learning: Module 3 Stage A/B/C, chatter production problem (verified chattering baseline, verified solvable), scoring, report; Validate: tap-test FRF fit and measured cutting tests on the lobe diagram.
- 20 new tests (88 total).

Findings and fixes during development
- 4 teeth at half immersion: one tooth enters exactly as another exits; sampling the force at step boundaries counted the entry spike on alternate teeth only, a spurious period-2 force that looked like chatter. Forces are now evaluated at step midpoints.
- Without surface memory, deep unstable cuts diverged (teeth "dig in" without limit). Tracking the last-cut surface per angular position (multiple regeneration) bounds chatter at realistic amplitudes (≈ 0.05–0.8 mm p-p).
- Lobe curves must be joined in chatter-frequency order per eigen-branch; sorting points by speed joins unrelated branches.
- ZOA agrees with the time-domain boundary within ≈ 5–25 % at ae/D = 0.25–1 and is optimistic by 2–4× at ae/D ≈ 0.1 (missing period-doubling lobes) — used as a teaching point and flagged in the app.

Not yet done (Module 3)
- Semi-discretisation or multi-frequency lobes for low immersion; process damping; variable pitch/helix; speed-dependent spindle dynamics; workpiece-side modes (thin walls); sound-based chatter detection from uploaded audio.

## Milestone 2 — 2026-11-22: Module 2, tool bending in deep-pocket machining ✅

Delivered
- `src/physics/toolBeam.ts`: stepped-cantilever end mill (shank D, optional reduced neck, flutes 0.8·D), holder/spindle translational and rotational springs, distributed band loads, deflection/slope/moment/stress fields, Rayleigh first bending frequency.
- `src/physics/pocketProcess.ts`: rigid deep-pocket side wall, constant-Z finishing, same force–deflection coupling as Module 1 (tool is the compliant element), four strategies — full-depth flank, step-down, spring pass, model-based deflection compensation; form error, taper indicator, bending stress vs carbide rupture strength, holder share of compliance, collision/flute-length/neck checks.
- 3D: pocket block with deviation-coloured wall surface; segmented end mill bending live under the instantaneous force (exaggeration labelled); holder offset by its spring deflection; machine follows either module via a shared tool pose.
- Panels: Module 2 parameters (tool geometry, holder, strategy), results (tip deflection now/peak, stiffness, holder share, stress, wall deviation, form error, productivity), charts (force vs angle, tool deflection + bending moment/stress along the tool with sections and engaged band, wall deviation profile, trial comparison), CSV exports.
- Learning: Module 2 Stage A/B/C questions, mould-pocket production problem (verified failing baseline and verified solvable), scoring, report; validation accepts measured wall deviation.
- Module selector in the header (URL hash #module-2), Modules dialog can open operational modules.
- 21 new tests (68 total).

Findings
- Overhang is fixed by the deepest level, so constant-Z step-down repeats the same error pattern at every level (a stepped wall); each level is proudest at its bottom edge where the tip bends most.
- In the baseline (Ø10 mm, L/D = 6, collet holder) the holder/spindle contributes ≈ 26 % of the tip compliance.
- Full-depth flank finishing with long flutes produces ≈ 3× the error of 10 mm step-down (taper toward the floor); a spring pass or up-milling roughly halves the step-down error; one-iteration compensation removes most of the mean error but not the within-level form error.

Fixed during this milestone
- React 19 + drei `Html` threw "removeChild" when a 3D label unmounted; labels are now always mounted and hidden with CSS.

Not yet done (Module 2)
- Workpiece-wall compliance in Module 2 (thin pocket walls combine Modules 1 and 2), runout, holder taper contact nonlinearity, iterative (multi-pass) compensation, chip-thinning-based feed adjustment.

## Milestone 1 — 2026-11-22: locally runnable Phase 1 prototype ✅

Delivered
- Repository scaffold: React 19, TypeScript, Vite 7, Three.js / React Three Fiber / Drei, Tailwind 4, Zustand, Recharts, Vitest.
- Physics layer (`src/physics`): mechanistic force model (straight and helical flutes), up/down milling, global transform, mean/peak/resultant, vf and MRR; Mindlin plate FE of the wall with thickness updated per pass from the stock; tool cantilever; force–deflection coupling at the surface-generation instant; two-sided height-field stock; four pass strategies; wall natural frequency vs tooth-passing frequency.
- 3D lab: generic C-frame VMC with correct relative motion (table/saddle/head), vise and blank, helical end mill whose flutes match the model's teeth, force vectors (tool or workpiece), per-tooth Ft/Fr, contact zone, deformed + ghost geometry, displacement and thickness-error colour maps, dimensions and tolerance, section and exploded views, camera presets.
- Dashboard: parameter panel with learning overlay, results panel, synchronised graphs (force vs angle/time, along-toolpath force and surface error, thickness profile), trial comparison, CSV exports.
- Learning: Stage A/B/C questions with feedback, production problem with automatic checking, scoring, HTML report.
- Validation interface: force-signal and thickness CSV upload, automatic angle alignment, % error and RMSE, synthetic example files clearly labelled.
- 47 automated verification tests; docs; Cloudflare Pages config; single-file build.

Findings during development (changed the model)
1. A straight-flute model predicts zero chip thickness at the instant the surface is generated, so surface error ignored fz and was identical for up and down milling → added helical slicing (β = 0 still reproduces the base model).
2. Without coupling, a flexible wall was predicted to deflect more than the radial depth → added force–deflection coupling.
3. The step-support strategy (rough + finish each level before stepping down) raised the in-tolerance area from ≈ 40 % to ≈ 90 % in the baseline case, giving a strong, physically grounded Stage C solution path.

Known limitations / not yet done
- Thermal effects, residual stress, run-out, wear and chatter are not modelled in Module 1.
- Holder/spindle compliance not included in tool deflection.
- Generic 5-axis trunnion machine, chip visualisation (illustrative) and toolpath strategies beyond constant-Z are not yet implemented.
- Coefficient calibration wizard (slot-milling regression from uploaded dynamometer data) not yet implemented — coefficients can be typed in and tagged *calibrated*.
- Validation compares one revolution at the current station; multi-station force comparison is a next step.

## Next milestones (proposed)
- M2: calibration wizard; holder compliance; within-pass stiffness update option; performance (incremental FE).
- M5: Module 4 turning of slender shafts; optional Supabase for class results; Cloudflare deployment after approval.
