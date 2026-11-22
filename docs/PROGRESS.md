# Progress log

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
- M3: Module 5 (fixture stiffness) reusing the current engine.
- M4: Module 3 chatter with a separate regenerative (delay) model and stability lobes; Module 6 tool wear.
- M5: Module 4 turning of slender shafts; optional Supabase for class results; Cloudflare deployment after approval.
