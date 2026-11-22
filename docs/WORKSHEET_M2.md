# Laboratory worksheet — Tool bending in deep-pocket machining

**Module 2 with MachinaForce 3D** · Duration ≈ 1.5–2 hours · Individual or pairs

Name: ____________________ Matric no.: ____________ Group: ______ Date: __________

## Learning outcomes

1. Model an end mill in its holder as a cantilever and explain why deflection grows with the cube of overhang.
2. Identify where the bending moment, stress and deflection are largest along a long-reach tool.
3. Explain how tool bending turns into a wall-position (form) error in deep-pocket finishing.
4. Compare spring passes, step-down depth, holder stiffness and toolpath compensation as remedies, including their cost.

> All values are **model estimates** (illustrative coefficients and holder stiffness). Record them as "predicted".

Select **Module 2** in the header and press **Reset**. Baseline: AISI 1045, pocket 50 mm deep × 60 mm, Ø10 mm 4-flute tool, 35° helix, overhang 60 mm, flutes 22 mm, neck Ø9.4 × 30 mm, collet holder (kT = 30 N/µm, kR = 5×10⁷ N·mm/rad), n = 5 000 rpm, fz = 0.04 mm, ae = 0.3 mm, ap = 10 mm, step-down, down-milling.

---

## Part A — Observe (20 min)

A1. Play the third pass with deformation ×40–×100. Which way does the tool bend relative to the wall? Why does that leave the wall proud? ______________________________

A2. Open **Tool bending**. Sketch the deflection and the bending moment along the tool. Mark the shank, neck and flutes, and the engaged band.

```
deflection                         moment
 |                                  |
 |                                  |
 +------------------- s → tip       +------------------- s → tip
```

A3. Where is the bending stress highest? Why are there jumps in the stress curve? ______________________________

A4. Hand check: with a rigid holder, a uniform Ø8 mm effective section and the peak |Fxy| from the chart applied at the tip, estimate δ = PL³/(3EI) for L = 60 mm, E = 600 GPa.
δ = ______ µm. The simulator (rigid holder) gives ______ µm. Why do they differ? ______________________________

A5. Open **Wall deviation profile**. Why does each 10 mm level show the same pattern? ______________________________

---

## Part B — Experiment (40 min)

Predict first, then change **one** factor and save each run as a trial.

| Run | Change | Prediction | Tip defl. peak (µm) | Max dev. (µm) | Form error (µm) | Stress (MPa) | Avg MRR |
|---|---|---|---|---|---|---|---|
| 0 | baseline | — | | | | | |
| 1 | overhang 75 mm | | | | | | |
| 2 | rigid holder | | | | | | |
| 3 | no neck (neck off) | | | | | | |
| 4 | ap = 5 mm | | | | | | |
| 5 | ae = 0.15 mm | | | | | | |
| 6 | spring pass | | | | | | |
| 7 | compensated | | | | | | |
| 8 | full-depth, flutes 52 mm | | | | | | |
| 9 | up-milling | | | | | | |

B1. Run 1: expected ratio (75/60)³ = ______; simulator ratio ______. Explain any difference (hint: holder springs). ______________________________

B2. Run 2: what share of the tip compliance came from the holder/spindle? ______ % How would you obtain a stiffer holder in practice? ______________________________

B3. Runs 6 and 7: which reduces the **mean** error more, and which reduces the **form** error more? Why? ______________________________

B4. Run 8: describe the wall shape and explain it from the force distribution on the tool. ______________________________

---

## Part C — Solve (35 min)

Open **C · Solve** → **Load the current (failing) programme**.

**Problem.** Finish the 50 mm deep AISI 1045 wall to **± 0.025 mm** with the existing Ø10 mm 4-flute tool and collet holder (stiffness fixed). Average MRR **≥ 1 000 mm³/min**; static bending stress **< 30 %** of carbide rupture strength. Overhang 52–80 mm.

C1. Root cause of the present error (three points):
1. ______________________________ 2. ______________________________ 3. ______________________________

C2. Iterations

| It. | Strategy / mode | ap | ae | Overhang | Max \|dev\| (µm) | Avg MRR | Stress % | Pass? |
|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | |
| 2 | | | | | | | | |
| 3 | | | | | | | | |

C3. Justification (≥ 80 words) — force, engaged length, overhang, holder share, residual material, cost in cycle time.

_____________________________________________________________________________________

_____________________________________________________________________________________

C4. Which model assumptions could make your solution fail on the shop floor? (runout, chatter — compare f_tp with the tool f₁, holder taper contact, wear) ______________________________

---

## Part D — Physical lab link (optional)

Measure wall deviation along the depth with a dial indicator or CMM at X = L/2 (every 5 mm). Upload `x_mm, z_mm, deviation_mm` in **Validate** and report RMSE and bias.

## Submission
App report (**Lab guide → Report**), trials CSV, this worksheet.

| Component | Weight |
|---|---|
| Part A observations and hand calculation | 20 % |
| Part B predictions vs results with explanations | 30 % |
| Part C solution meets specification | 20 % |
| Part C justification (lecturer) | 20 % |
| Assumptions and limitations | 10 % |
