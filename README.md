# MachinaForce 3D — Understanding Cutting Forces in Machining

Browser-based 3D learning laboratory for undergraduate machining students. It is an
**engineering simulator, not an animation**: every force arrow, colour, graph and stock
change comes from a mechanistic milling-force model, a plate finite-element model of the
workpiece and a stock-removal model that are computed live.

**Release 0.2: Module 1 (thin-wall milling) and Module 2 (tool bending in deep-pocket
machining) are operational.** Modules 3–6 are listed in the app as *planned* and are not
presented as working. Switch modules from the header (or open `#module-2`).

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # 68 verification tests
npm run build        # production build → dist/   (Cloudflare Pages)
npm run build:single # one self-contained HTML file → dist-single/index.html (offline / LMS upload)
```

Requires Node 20+. No paid software, licences, server or database.

## What students can do

- Watch a constant-Z finishing operation on a 7075-T651 wall (50 × 40 × 2 mm baseline) on a generic vertical machining centre, with orbit/zoom/pan, camera presets, section and exploded views.
- See Fx, Fy, Fz and the resultant on the tool or on the workpiece, per-tooth tangential and radial forces, the contact zone, the deformed and undeformed wall, and colour maps of displacement or thickness error.
- Change 13+ parameters (spindle speed, feed per tooth, teeth, ap, ae, tool diameter, helix, overhang, wall thickness/height/length, material, strategy, milling mode, clamp stiffness, cutting coefficients) and get force, deflection, dimensional error and productivity.
- Follow the three-stage learning sequence: **A Observe → B Experiment → C Solve**, with auto-scored concept and prediction questions, an industrial production problem, and a downloadable student report (HTML) plus CSV of trials.
- Compare the model with their own dynamometer and thickness measurements (**Validate**): percentage error and RMSE.

## Project layout

```
src/physics/   cutting-force model, plate FE, tool deflection, stock model, process simulation (no UI code)
src/sim/       Web Worker wrapper and playback-state helper
src/scene/     React Three Fiber scene: machine, fixture, wall, tool, force vectors
src/ui/        panels, charts (Recharts), lab guide, assessment, validation
src/content/   learning text, questions, production problem, references, assumptions
tests/         Vitest verification suite
docs/          PHYSICS.md, VALIDATION.md, PROGRESS.md, WORKSHEET.md
```

## Status labels used in the app

- **estimate**: model output with illustrative or user-defined coefficients (default)
- **calibrated**: the user confirms the coefficients come from their own force tests
- **assumption**: modelling idealisation (listed under *Assumptions*)

No result is labelled *validated* by the app itself; validation means agreement with
measurements, which the *Validate* stage helps quantify.

## Deployment (Cloudflare Pages)

```bash
npm run build
npx wrangler pages deploy dist --project-name machinaforce-3d
```

or connect the Git repository in the Cloudflare dashboard with build command `npm run build` and
output directory `dist`. `wrangler.toml` and `public/_headers` are included. Nothing has been deployed yet.

## References

See the in-app *References* panel and `src/content/learning.ts`. All DOIs were checked against
the Scite index on 22 Nov 2026.
