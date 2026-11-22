# Laboratory worksheet — Cutting forces and thin-wall accuracy

**Module 1: Thin-wall milling with MachinaForce 3D** · Duration ≈ 2 hours · Individual or pairs

Name: ____________________ Matric no.: ____________ Group: ______ Date: __________

## Learning outcomes

By the end of this session you should be able to:

1. Identify the cutting-force components Fx, Fy and Fz in a peripheral milling operation and explain which one controls the dimensional accuracy of a thin wall.
2. Use h = fz·sin φ and F = Kc·b·h + Ke·b to predict how feed, depth of cut and engagement change the cutting force.
3. Explain why elastic deflection of the wall and the tool leaves material (undercut), and why peak deflection is not the same as the final error.
4. Select a machining strategy that meets a tolerance and a productivity target, and justify it in terms of force, stiffness and support.

> All numbers produced by the simulator are **model estimates** with illustrative cutting coefficients. Record them as "predicted", not "measured".

---

## Part A — Observe (20 min)

Load the baseline (**Reset**). Baseline: Al 7075-T651, t = 2 mm, H = 40 mm, L = 50 mm, Ø8 mm 3-flute end mill, 30° helix, overhang 45 mm, n = 12 000 rpm, fz = 0.05 mm, ap = 5 mm, ae = 0.5 mm/side, alternating-side finishing, down-milling.

A1. Press **Play** and watch the first pass. Which colour arrow is the largest most of the time? Which axis is it on? _______________

A2. Switch **Forces on → workpiece**. What happens to the arrows, and why? ______________________________________________

A3. From the **Force vs cutter angle** graph, how many force pulses are there per revolution? ______ What is the period in ms? ______ Check: 60 000 / (n·N) = ______ ms.

A4. Calculate the feed rate and MRR by hand, then compare with the Results panel.

| Quantity | Formula | Your calculation | Simulator |
|---|---|---|---|
| vf (mm/min) | n·N·fz | | |
| MRR (mm³/min) | ae·ap·vf | | |
| vc (m/min) | πDn/1000 | | |

A5. Switch the colour map to **thickness dev.** after playback ends (or open **Wall thickness profile**). Where is the wall thickest? Sketch the profile at X = L/2.

```
Z (mm)
40 |
30 |
20 |
10 |
 0 +---------------------------  thickness (mm)
```

A6. Answer questions A1–A4 in the **Lab guide** tab.

---

## Part B — Experiment (45 min)

Change **one parameter at a time**. Before each run, write your prediction. Save every run as a trial (**Experiment comparison → Save current as trial**).

| Run | Change from baseline | Prediction (↑/↓, by how much?) | Peak \|F\| (N) | Max wall defl. (µm) | Tool defl. (µm) | Max \|dev\| (µm) | Avg MRR (mm³/min) |
|---|---|---|---|---|---|---|---|
| 0 | none (baseline) | — | | | | | |
| 1 | fz = 0.10 mm | | | | | | |
| 2 | ap = 2.5 mm | | | | | | |
| 3 | ae = 0.25 mm | | | | | | |
| 4 | t = 4 mm | | | | | | |
| 5 | overhang = 60 mm | | | | | | |
| 6 | up-milling | | | | | | |
| 7 | single-side strategy | | | | | | |
| 8 | helix = 0° (straight flute) | | | | | | |

B1. Doubling fz did / did not double the peak force. Explain using F = Kc·b·h + Ke·b. ______________________________________

B2. Compare runs 0 and 4. Using I = b·t³/12, what stiffness ratio do you expect? ______ Is the change in maximum wall deflection consistent? ______

B3. Compare runs 0 and 5. Using δ ∝ L³, what tool-deflection ratio do you expect? ______ Simulator ratio: ______

B4. Run 8: what happens to the surface error and to its sensitivity to fz when the flute is straight? Why? (Hint: chip thickness at the instant the surface is generated.) ______________________________________

B5. Answer questions B1–B4 in the **Lab guide**. Download the trials CSV and attach it to your report.

---

## Part C — Solve (40 min)

Open **C · Solve** and press **Load the current (failing) programme**.

**Problem.** Finish a 7075-T651 rib 50 × 40 mm to **2.00 ± 0.10 mm** with the existing Ø8 mm 3-flute end mill (overhang 42–60 mm). Average MRR over the whole cycle must be **≥ 2 000 mm³/min**.

C1. Root-cause analysis: list three reasons the current programme fails.
1. ______________________________________
2. ______________________________________
3. ______________________________________

C2. Record your iterations.

| Iteration | Strategy / mode | n | fz | ap | ae (finish / rough) | Overhang | Max \|dev\| (µm) | Avg MRR | Pass? |
|---|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | | |
| 2 | | | | | | | | | |
| 3 | | | | | | | | | |
| 4 | | | | | | | | | |

C3. Final justification (≥ 80 words; also type a shorter version in the app). Refer to force, stiffness, supporting stock, deflection and the productivity trade-off.

_____________________________________________________________________________________

_____________________________________________________________________________________

_____________________________________________________________________________________

C4. Which modelling assumptions could make your solution fail on a real machine? (Open **Assumptions**; name at least three, including the dynamics check f_tp/f₁.) ________________________________

---

## Part D — Link to the physical lab (optional, with dynamometer)

D1. Export the force signal (**⬇ signal**) for a station that matches your physical test.
D2. Upload your measured force CSV in **Validate**. Remember: a table dynamometer measures the force **on the workpiece**.
D3. Record RMSE and mean % error for FX and FY. Which coefficients would you recalibrate first, and why?

| Component | RMSE (N) | Mean error (%) | Peak error (%) |
|---|---|---|---|
| FX | | | |
| FY | | | |

---

## Submission

1. The report generated by the app (**Lab guide → Report**, HTML; print to PDF).
2. The trials CSV.
3. This worksheet with Parts A–C (and D if done).

### Marking guide (suggested, 100 %)

| Component | Weight |
|---|---|
| Part A calculations and observations | 15 % |
| Part B predictions vs results, with explanations | 30 % |
| Part C solution meets the specification (auto-check) | 20 % |
| Part C justification quality (lecturer) | 25 % |
| Assumptions and limitations (C4) | 10 % |
