# Laboratory worksheet — Chatter and dynamic instability

**Module 3 with MachinaForce 3D** · Duration ≈ 2 hours (+ optional tap test) · Individual or pairs

Name: ____________________ Matric no.: ____________ Group: ______ Date: __________

## Learning outcomes

1. Distinguish forced vibration from self-excited (regenerative) chatter using the time signal and the spectrum.
2. Describe a machining structure by its modal parameters fn, ζ, k and read its frequency response function (FRF).
3. Read a stability lobe diagram and select a chatter-free spindle speed and depth of cut.
4. Explain how damping, stiffness, radial immersion and spindle speed change stability, and state the limits of the zero-order lobe model.

> All values are **model estimates** (illustrative modal parameters and cutting coefficients) unless you fit them from your own tap test.

Select **Module 3** and press **Reset**. Baseline: Al 7075-T651, Ø16 mm 4-flute end mill, half immersion (ae = 8 mm) down-milling, fz = 0.08 mm, tool fn = 600 Hz, ζ = 0.03, k = 5.6 N/µm (x and y), n = 6 000 rpm, ap = 1.2 mm.

---

## Part A — Observe (25 min)

A1. Press Play (deformation ×60). Describe the tool motion and the marks on the machined face. ______________________________

A2. Open **Vibration vs time**. What do the once-per-tooth samples (amber dots) do? ______________________________

A3. Open **Vibration spectrum**. Dominant frequency = ______ Hz. Tooth-passing frequency f_tp = n·N/60 = ______ Hz. Is the peak a multiple of f_tp? ______ What does this tell you? ______________________________

A4. Set **n = 9 000 rpm** (same ap). Repeat A2–A3. Verdict: ______ Dominant frequency ______ Hz = ______ × f_tp.

A5. Explain in two sentences why a large cutting force alone does not prove chatter. ______________________________

---

## Part B — Experiment (45 min)

B1. Open **Tool FRF**. Read off: frequency of the magnitude peak ______ Hz, peak |G| ______ µm/N. Check: 1/(2kζ) = ______ µm/N.

B2. Open the **Stability lobe diagram** and press **Compute time-domain boundary**. Do the two methods agree? Where do they differ? ______________________________

B3. Hand check (pocket speed): n = 60·fn/N = ______ rpm; the next pockets at 60·fn/(N·2) = ______ and 60·fn/(N·3) = ______ rpm. Mark them on a sketch of the lobe diagram.

B4. Predict, then test (save each run as a trial):

| Run | Change from baseline | Prediction | Abs. stable depth a_lim,min (mm) | Verdict at baseline n, ap |
|---|---|---|---|---|
| 0 | none | — | | |
| 1 | ζ = 0.06 | | | |
| 2 | k = 11.2 N/µm | | | |
| 3 | fn = 900 Hz | | | |
| 4 | ae = 16 mm (slotting) | | | |
| 5 | ae = 1.5 mm | | | |
| 6 | N = 2 teeth | | | |

B5. Hand check: for slotting with one flexible direction, a_lim,min = 8kζ(1+ζ)/(N·Krc). Using Krc = 280 N/mm², k = 5 600 N/mm, ζ = 0.03, N = 4: a_lim,min = ______ mm.

B6. Run 5: compare the analytical lobes with the time-domain boundary. Which is more conservative, and why? ______________________________

---

## Part C — Solve (35 min)

Open **C · Solve** → **Load the current (chattering) programme**.

**Problem.** Same tool and set-up (modal parameters fixed). Remove chatter (time-domain verdict) and reach **MRR ≥ 60 000 mm³/min** with fz ≤ 0.10 mm and n ≤ 20 000 rpm.

C1. Baseline MRR = ae·ap·n·N·fz = ______ mm³/min. Why does the operator's idea of "slowing down to be safe" fail? ______________________________

C2. Iterations

| It. | n (rpm) | ap (mm) | fz (mm) | ZOA a_lim (mm) | Verdict | MRR (mm³/min) |
|---|---|---|---|---|---|---|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |

C3. Justification (≥ 80 words): use lobes, pocket, phase between successive waves, safety margin below the lobe, and what happens if the real fn differs by 5 %.

_____________________________________________________________________________________

_____________________________________________________________________________________

C4. Name three effects missing from the model that could change your answer on the machine. ______________________________

---

## Part D — Tap test (optional, with impact hammer)

1. Tap the tool tip in x and y; export the receptance as `freq_hz, real, imag` (m/N).
2. In **Validate**, upload it and **Apply** the fitted fn, ζ, k.
3. Cut a few test slots at speeds and depths around a pocket and a trough; record chatter by sound or surface finish (`rpm, ap_mm, chatter`) and upload. What fraction do the lobes classify correctly? ______ %

## Submission
App report (**Lab guide → Report**), trials CSV, this worksheet.

| Component | Weight |
|---|---|
| Part A observations | 20 % |
| Part B predictions, hand checks and explanations | 30 % |
| Part C solution meets specification | 20 % |
| Part C justification (lecturer) | 20 % |
| Model limitations | 10 % |
