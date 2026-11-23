# Laboratory worksheet — Workpiece movement and fixture stiffness in milling

**Module 5 with MachinaForce 3D** · Duration ≈ 2 hours (+ optional fixture push test) · Individual or pairs

Name: ____________________ Matric no.: ____________ Group: ______ Date: __________

## Learning outcomes

1. Explain the 3-2-1 locating principle and the different roles of locators and clamps.
2. Determine the direction of the cutting force on the workpiece and decide whether a locator, a clamp or friction resists it.
3. Explain lift-off and slip at fixture contacts and calculate a friction safety margin μN/T.
4. Explain how locator spread, clamp position, clamp force, friction and feed direction affect workpiece security and feature accuracy.

> All values are **model estimates** (rigid block, illustrative contact stiffness, friction and cutting coefficients).

Select **Module 5** and press **Reset**. Baseline: AISI 1045 block 150 × 80 × 50 mm on a good 3-2-1 fixture (three top clamps of 3000 N above the base locators, side clamp 2000 N, no end clamp, μ = 0.25); full-width slot Ø16 mm, 4 flutes, ap = 5 mm, fz = 0.06 mm, 2500 rpm, Y = 40 mm, feed +X; tolerance ± 0.02 mm.

---

## Part A — Observe (25 min)

A1. Sketch the block and mark the six locators (L1–L6) and the clamps (C1–C5). For each group write which degrees of freedom it removes.

| Group | Elements | DOF removed |
|---|---|---|
| Base | L1, L2, L3 | |
| Side | L4, L5 | |
| End | L6 | |

A2. Set *Forces on* → **workpiece**. Record the mean force on the part (Results panel shows the force on the tool; change its sign):

| Component | On the tool (N) | On the workpiece (N) | Pushes into a locator or away? |
|---|---|---|---|
| X | | | |
| Y | | | |
| Z | | | |

A3. Open **Contact forces (now)**. Which contacts gain load during the cut, and which lose it? Why does the end locator L6 carry no clamping force? ______________________________

A4. Hand check of friction at one contact: pick the contact with the smallest friction reserve. N = ______ N, T = ______ N, μN/T = ______. Compare with *Min friction reserve*. ______________________________

A5. Read the slot errors. eY = ______ µm, eZ = ______ µm. Explain in one sentence why the slot is displaced although the machine axes moved exactly along the program. ______________________________

---

## Part B — Experiment (45 min)

Predict first; change **one** factor; save each run (**Experiment comparison → Save current as trial**).

| Run | Change | Prediction | \|eY\| max (µm) | \|eZ\| max (µm) | Clamp SF | State |
|---|---|---|---|---|---|---|
| 0 | baseline | — | | | | |
| 1 | layout: locators too close together | | | | | |
| 2 | layout: clamps away from locators | | | | | |
| 3 | feed −X | | | | | |
| 4 | clamp forces × 2 (6000 / 4000 N) | | | | | |
| 5 | μ = 0.40 (serrated pads) | | | | | |
| 6 | end clamp 1500 N | | | | | |
| 7 | ap = 10 mm | | | | | |

B1. Runs 0 and 1: why does bunching the locators increase the tilt and the slot error so much? Use the idea of a moment arm. ______________________________

B2. Run 2: what happens already during clamping, before cutting starts? ______________________________

B3. Run 3: the force magnitude did not change. Why did the safety factor drop? ______________________________

B4. Run the **Clamping force study**. Sketch friction reserve and |eY| against total clamp force. Is clamp force mainly an accuracy parameter or a security parameter? Explain using μN and k ∝ N^1/3. ______________________________

B5. Compare the lowest fixture natural frequency with the tooth-passing frequency. When would you worry, and which module models the vibration properly? ______________________________

---

## Part C — Solve (35 min)

Open **C · Solve** → **Load the current (failing) setup**.

**Problem.** Keyway slot Ø16 × 8 mm deep along the block at Y = 40 mm: slot position and depth within ± 0.025 mm, no slip or lift-off, clamping safety factor ≥ 2, no clamp above 6000 N, lowest fixture natural frequency ≥ 2 × tooth-passing frequency, cutting time ≤ 20 s.

C1. Root cause (which force component, which contacts, which mechanism — elastic motion, slip or lift-off?): ______________________________

C2. Iterations

| It. | Layout | Feed | Clamps (top/side/end) N | μ | fz | \|eY\| µm | \|eZ\| µm | SF | Held? |
|---|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | | |
| 2 | | | | | | | | | |
| 3 | | | | | | | | | |

C3. Justification (≥ 80 words): locator spread, clamp position over the locators, force direction, friction and clamp force, accuracy vs security.

_____________________________________________________________________________________

_____________________________________________________________________________________

C4. Name three effects missing from the model that could still put real slots out of position (hint: part bending, clamping distortion, tool deflection, thermal effects). ______________________________

---

## Part D — Fixture push test (optional, in the workshop)

1. Clamp a test block on the fixture as in the model. Place a dial gauge (1 µm) against the block, opposite a force gauge.
2. Push at three points (e.g. the side face at the slot height, the top face at the slot, the free end) with 500–2000 N and record the displacement along the force.
3. Upload `x_mm, y_mm, z_mm, Fx_N, Fy_N, Fz_N, disp_um` in **Validate**. Mean error = ______ %. Adjust the locator / clamp stiffness until the model matches, then re-run the slot.
4. Measure the machined slot on a CMM every 20 mm and upload `x_mm, eY_mm, eZ_mm`. RMS (eY) = ______ µm, RMS (eZ) = ______ µm.
5. Which part of the measured error is not caused by the fixture? ______________________________

## Submission
App report (**Lab guide → Report**), trials CSV, this worksheet.

| Component | Weight |
|---|---|
| Part A locating principle, force directions and friction check | 25 % |
| Part B predictions and explanations | 30 % |
| Part C solution meets specification | 15 % |
| Part C justification (lecturer) | 20 % |
| Model limitations | 10 % |
