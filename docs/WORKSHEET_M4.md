# Laboratory worksheet — Cutting-force components in turning slender shafts

**Module 4 with MachinaForce 3D** · Duration ≈ 2 hours (+ optional dynamometer test) · Individual or pairs

Name: ____________________ Matric no.: ____________ Group: ______ Date: __________

## Learning outcomes

1. Identify the cutting (Fc), feed (Ff) and passive (Fp) force components in turning and their directions in the lathe X/Y/Z frame.
2. Calculate cutting power, torque, spindle speed, MRR and theoretical roughness.
3. Explain how the nose radius and entering angle split the force between Ff and Fp.
4. Explain how workholding (chuck, tailstock, centres, steady rest) and slenderness control the diameter error of a shaft.

> All values are **model estimates** (illustrative coefficients and support stiffnesses).

Select **Module 4** and press **Reset**. Baseline: AISI 1045 shaft, Ø25 → Ø24 mm, 300 mm long, turned over 280 mm toward the chuck; chuck + live tailstock; insert κr = 93°, rε = 0.8 mm; vc = 180 m/min, f = 0.15 mm/rev; tolerance ± 0.02 mm.

---

## Part A — Observe (25 min)

A1. Sketch the lathe frame (Z spindle axis, X toward the tool, Y) and draw Fc, Ff and Fp as they act **on the tool**. Then draw them on the workpiece.

A2. Record the three components at mid-length:

| Component | Direction | Value (N) | Share of \|F\| |
|---|---|---|---|
| Fc | | | |
| Ff | | | |
| Fp | | | |

A3. Hand calculations (compare with the Results panel):

| Quantity | Formula | Your value | Simulator |
|---|---|---|---|
| Spindle speed n (rpm) | 1000·vc/(π·d0) | | |
| Feed rate (mm/min) | f·n | | |
| Cutting power (kW) | Fc·vc/60 000 | | |
| Torque (N·m) | Fc·d0/2 | | |
| MRR (cm³/min) | vc·ap·f | | |
| Theoretical Ra (µm) | f²/(32 rε) × 1000 | | |

A4. Open **Diameter error profile**. Sketch it. Where is the shaft most oversize, and why? ______________________________

A5. Open **Shaft deflection (now)**. The Y deflection (from Fc) is larger than the X deflection (from Fp), yet Fc hardly affects the diameter. Explain using δr ≈ δy²/(2r). ______________________________

---

## Part B — Experiment (45 min)

Predict first; change **one** factor; save each run.

| Run | Change | Prediction | max Fp (N) | max dev. (µm) | Ra (µm) | time (s) |
|---|---|---|---|---|---|---|
| 0 | baseline | — | | | | |
| 1 | chuck only | | | | | |
| 2 | between centres | | | | | |
| 3 | + steady rest at Z = 150 mm | | | | | |
| 4 | κr = 75° | | | | | |
| 5 | rε = 0.4 mm | | | | | |
| 6 | f = 0.25 mm/rev | | | | | |
| 7 | spring pass | | | | | |
| 8 | d0 = 30 mm (ap = 3 mm), κr 93° vs 75° | | | | | |

B1. Runs 0 and 4: why does κr make almost no difference at ap = 0.5 mm, but does in run 8? Use the **Forces vs depth of cut** chart. ______________________________

B2. Run 5: what did you gain and what did you lose? ______________________________

B3. Hand check (run 1): treat the shaft as a cantilever, δ = Fp·L³/(3EI) with E = 205 GPa, d = 24 mm, L = 300 mm and Fp from the panel. δ = ______ µm, so the diameter error is about 2δ = ______ µm. Compare with the simulator. ______________________________

B4. Common shop rules say a tailstock is needed above L/D ≈ 4–6 and a steady rest above L/D ≈ 20. Do your results support these rules? ______________________________

---

## Part C — Solve (35 min)

Open **C · Solve** → **Load the current (failing) programme**.

**Problem.** Ø24.00 ± 0.02 mm over 280 mm, Ra ≤ 1.6 µm (theoretical), cutting time ≤ 60 s, spindle power ≤ 11 kW, shaft supported at both ends.

C1. Root cause (which force, which stiffness, where?): ______________________________

C2. Iterations

| It. | Workholding / steady rest | Tool (κr, rε) | vc, f | Strategy | max dev. (µm) | Ra (µm) | time (s) |
|---|---|---|---|---|---|---|---|
| 1 | | | | | | | |
| 2 | | | | | | | |
| 3 | | | | | | | |

C3. Justification (≥ 80 words): force component, stiffness, support positions, finish and time trade-offs.

_____________________________________________________________________________________

_____________________________________________________________________________________

C4. Name three effects missing from the model that could still put real shafts out of tolerance. ______________________________

---

## Part D — Dynamometer test (optional)

1. Turn a test bar on the lathe dynamometer at the baseline conditions; record Fc, Ff, Fp.
2. Upload `Fc_N, Ff_N, Fp_N` in **Validate** at the matching playback position. Record the % errors.
3. Measure the diameter every 30 mm with a micrometer and upload `z_mm, diameter_mm`. RMSE = ______ µm.
4. Which coefficients would you recalibrate first? ______________________________

## Submission
App report (**Lab guide → Report**), trials CSV, this worksheet.

| Component | Weight |
|---|---|
| Part A frame, forces and hand calculations | 25 % |
| Part B predictions, hand check and explanations | 30 % |
| Part C solution meets specification | 15 % |
| Part C justification (lecturer) | 20 % |
| Model limitations | 10 % |
