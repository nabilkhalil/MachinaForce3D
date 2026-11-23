# MachinaForce 3D

### Understanding Cutting Forces in Machining — an interactive 3D CNC learning laboratory

▶ **Open the app: [nabilkhalil.github.io/MachinaForce3D](https://nabilkhalil.github.io/MachinaForce3D/)**

MachinaForce 3D lets you **see** cutting forces. You set up a milling operation on a virtual CNC machining centre, press **Play**, and watch the force vectors, the bending of the wall or the tool, and the error that this bending leaves on the finished part. Change one parameter and the physics is recomputed in about a second.

- **A simulator, not an animation.** Every arrow, colour, graph and chip of removed stock comes from engineering calculations: a mechanistic milling-force model, a finite-element model of the workpiece and a beam model of the tool.
- **Runs in your browser.** No installation, no login, no licence. Your answers and trials are saved only in your own browser.
- **Honest about its limits.** Results are labelled *estimate* unless you enter calibrated cutting coefficients, and every assumption is listed in the app.

![MachinaForce 3D — Module 1, thin-wall milling](docs/images/module1-overview.png)

---

## Contents

1. [Start here (5 minutes)](#start-here-5-minutes)
2. [The screen at a glance](#the-screen-at-a-glance)
3. [Module 1 — Thin-wall milling: step by step](#module-1--thin-wall-milling-step-by-step)
4. [Module 2 — Tool bending in a deep pocket: step by step](#module-2--tool-bending-in-a-deep-pocket-step-by-step)
5. [Module 3 — Chatter: step by step](#module-3--chatter-step-by-step)
6. [Module 4 — Turning a slender shaft: step by step](#module-4--turning-a-slender-shaft-step-by-step)
7. [Module 5 — Fixture stiffness and workpiece movement: step by step](#module-5--fixture-stiffness-and-workpiece-movement-step-by-step)
8. [Module 6 — Tool wear and cutting force: step by step](#module-6--tool-wear-and-cutting-force-step-by-step)
9. [The three learning stages and your score](#the-three-learning-stages-and-your-score)
10. [Reading the results correctly](#reading-the-results-correctly)
11. [Key equations](#key-equations)
12. [Tips, common mistakes and FAQ](#tips-common-mistakes-and-faq)
13. [Panduan ringkas (Bahasa Melayu)](#panduan-ringkas-bahasa-melayu)
14. [For lecturers](#for-lecturers)
15. [For developers](#for-developers)
16. [References](#references)

---

## Start here (5 minutes)

1. **Open the app:** <https://nabilkhalil.github.io/MachinaForce3D/>. Use Chrome, Edge or Firefox on a laptop or desktop. A tablet works; a phone works for viewing only.
2. **Choose a module** in the dropdown at the top left. Start with **Module 1**.
3. **Press ▶ Play** under the 3D view. The end mill moves along the wall. The **green arrow (Fy)** is the force that pushes the wall and the tool apart.
4. **Tick "Learning overlay"** (top right). Every parameter now explains itself in plain engineering language.
5. **Open the Lab guide** (right panel, *Lab guide & assessment*) and follow **A · Observe → B · Experiment → C · Solve**.
6. At the end, type your name in the Lab guide and press **Report** to download your report (HTML; print it to PDF).

> 💡 Rotate the view with the left mouse button, pan with the right button, zoom with the wheel. The buttons **iso / front / top / side / machine** jump to standard views.

---

## The screen at a glance

| Area | What it is for |
|---|---|
| **Top bar** | Module selector · learning stages (A/B/C/Validate) · Learning overlay · Equations · Assumptions · References · Reset |
| **Left panel** | All machining parameters: workpiece, tool, cutting conditions, strategy, workholding, cutting coefficients |
| **Centre** | The 3D machining centre. The **View** box (top left) controls force arrows, exaggeration, colour map, section and exploded views |
| **Playback bar** | ▶ Play / Pause, previous/next pass, toolpath slider, speed, and **φ** (the cutter angle, i.e. which way tooth 0 points) |
| **Bottom panel** | Graphs synchronised with the tool position, plus the **Experiment comparison** table |
| **Right panel** | *Results & indicators* (forces, deflection, dimensional error, productivity, warnings) or *Lab guide & assessment* |

**Colours used everywhere**

| Colour | Meaning |
|---|---|
| 🔴 red arrow | **Fx**, along the feed direction (X) |
| 🟢 green arrow | **Fy**, normal to the wall (Y) — the one that bends things |
| 🔵 blue arrow | **Fz**, along the spindle axis (Z) |
| 🟠 amber arrow | **\|F\|**, the resultant force |
| 🟠 amber flute | tooth 0 — the tooth whose angle φ is shown in the graphs |
| 🟥 red patch | the tool–workpiece contact zone |

The same X/Y/Z frame is used in the 3D view, the graphs, the equations and the CSV files. By default the arrows show the force **on the tool**. Switch the View box to *workpiece* to see the equal and opposite force (Newton's third law). A table dynamometer measures the force on the workpiece.

---

## Module 1 — Thin-wall milling: step by step

**The problem.** A thin aerospace rib (Al 7075-T651, 50 × 40 mm, 2 mm thick) is finished with an Ø8 mm end mill. The cutting force bends the wall away from the tool, so the tool removes less material than programmed. The wall comes out **too thick**, especially at the top.

![Thickness-error map and profile](docs/images/module1-thickness.png)

1. **Watch one pass.** Press Play and watch the green arrow and the wall. Set *Deformation* to ×30 in the View box to make the bending visible. The colour shows how much the wall moves at this instant.
2. **Read the force graph.** Open **Force vs cutter angle / time**. One pulse is one tooth passing, so 3 teeth give 3 pulses per revolution. The dashed line follows the φ slider.
3. **See the final error.** Drag the toolpath slider to the end. Set *Colour* to **thickness dev.** and open **Wall thickness profile**. Red means thicker than nominal; the shaded band is the tolerance.
4. **Compare strategies.** In *Toolpath strategy*, try **Single-side**, **Alternating**, **Rough all, then finish all** and **Step-support**. Step-support leaves thick stock below each level to support the wall: watch the error drop.
5. **Experiment.** Change *one* thing at a time (feed per tooth, axial depth, wall thickness, tool overhang, up/down milling) and **Save current as trial** each time.

![Experiment comparison](docs/images/lab-guide.png)

**What you should discover:** wall stiffness grows with *t³*, tool deflection grows with *L³*, edge forces do not scale with feed, and the order of the passes can matter more than the cutting speed.

---

## Module 2 — Tool bending in a deep pocket: step by step

**The problem.** A 50 mm deep pocket wall in steel is finished with a long Ø10 mm end mill (overhang 60 mm, L/D = 6). Here the workpiece is rigid and **the tool bends**, together with its holder. The wall is left standing proud of its nominal position.

![Module 2 — tool bending](docs/images/module2-bending.png)

1. **Select Module 2** in the top-left dropdown and press **Play**. Set *Deformation* to ×50–×100 to see the tool bend.
2. **Open "Tool bending: deflection & moment".** Deflection is largest at the **tip**; bending moment and stress are largest at the **holder face**. The stress jumps where the tool gets thinner (neck, flutes).
3. **Open "Wall deviation profile".** Every 10 mm level shows the same pattern. The overhang is set by the deepest level, so every level is cut with the same long tool.
4. **Try the remedies:** a shorter overhang, a **rigid holder**, a smaller *ap* or *ae*, **up-milling**, a **spring pass** (repeat the level), or **compensation** (offset the path by the predicted error). Note what each one costs in cycle time.
5. Watch the **Holder share** indicator: about a quarter of the bending comes from the holder and spindle, not the tool.

---

## Module 3 — Chatter: step by step

**The problem.** Push the axial depth too far and the cut starts to "sing": the tool vibrates on its own, leaves wavy marks and can break. This is **regenerative chatter**. Each tooth cuts the wavy surface left by the previous one, so the vibration feeds itself. It is a **dynamic** effect, so Module 3 uses a separate dynamic model.

![Module 3 — stability lobes](docs/images/module3-lobes.png)

1. **Select Module 3.** The baseline (6 000 rpm, ap = 1.2 mm) chatters. Press **Play** and watch the tool shake (×60) and the chatter marks appear on the machined face.
2. **Read the verdict banner.** *Chatter* is decided from the **motion**, never from the force level. Open **Vibration vs time**: the amber dots, sampled once per tooth, scatter. In **Vibration spectrum** the main peak (≈ 613 Hz) is **not** a tooth-passing harmonic.
3. **Open the Stability lobe diagram.** Below the curve is stable; above is chatter. Your cut is the red or green dot. Press **Compute time-domain boundary** to check the analytical lobes against an independent simulation: they should almost overlap.
4. **Find the pocket.** Click the chart near **9 000 rpm** (tooth-passing frequency = natural frequency). The cut becomes stable even with a much deeper ap. Slower is *not* always safer.
5. **Experiment** with damping ζ, stiffness k, natural frequency fn and radial depth ae. Try ae = 1.5 mm and compare the two methods: at low immersion the analytical lobes are too optimistic.
6. **Validate (lab):** upload a tap-test FRF to fit fn, ζ and k for your own tool, then upload your test cuts to see them on the lobe diagram.

---

## Module 4 — Turning a slender shaft: step by step

**The problem.** A long, thin shaft (Ø25 → Ø24 mm, 300 mm, L/D ≈ 12) is finish-turned on a CNC lathe. The cutting force has three components. The **passive force Fp** pushes the shaft away from the tool, so the diameter comes out too large, most of all where the shaft is least supported.

![Module 4 — turning a slender shaft](docs/images/module4-turning.png)

1. **Select Module 4.** The view switches to a lathe. Here the axes follow the **lathe convention**: **Z** is the spindle axis (from the chuck face), **X** is radial toward the tool (CNC programs X as a diameter), and Y is up.
2. **Press Play** and read the three arrows on the tool: **Fc** (green, −Y, cutting) is the largest and sets the power; **Ff** (blue, Z) is the feed force; **Fp** (red, +X) is the passive force that bends the shaft.
3. **Open "Diameter error profile".** Between the chuck and the tailstock the error is barrel-shaped. **Shaft deflection (now)** shows why: the bent shape under the force at the current tool position.
4. **Change the workholding.** Try *Chuck only*, then *Chuck + tailstock*, then add a **steady rest**. The error changes by more than an order of magnitude.
5. **Open "Forces vs depth of cut".** At small depths the cut lies on the tool's nose radius, so the entering angle κr has almost no effect and Fp is large. Try nose radius 0.4 vs 0.8 mm and watch the accuracy–roughness trade-off (Ra ≈ f²/32rε).
6. **Validate (lab):** upload a 3-component dynamometer record (Fc, Ff, Fp) and micrometer readings along the shaft.

---

## Module 5 — Fixture stiffness and workpiece movement: step by step

**The problem.** A steel block (150 × 80 × 50 mm) sits on a **3-2-1 fixture**: 3 locators under the base, 2 on the side and 1 at the end, held by strap clamps and a side clamp. A Ø16 mm slot is milled along it. The cutting force pushes the clamped block a few micrometres on its contacts, so the slot comes out displaced from the datum. If the force overcomes friction or unloads a locator, the part **slips** or **lifts off** and the error becomes large and random.

![Module 5 — fixture stiffness and workpiece movement](docs/images/module5-fixture.png)

1. **Select Module 5.** The block is drawn on its fixture. The motion of the block is exaggerated (×400 by default, set in *View*) because it is only micrometres.
2. **Press Play** and set *Forces on* → **workpiece**. Watch the pads: **green** = sticking, **amber** = slipping, **red** = lifted off, grey = not loaded.
3. **Open "Contact forces (now)".** The left chart compares each contact force after clamping with the force during the cut; the right chart compares the friction force needed with the friction available (μN). A contact is safe while the amber bar stays below the green bar.
4. **Open "Slot error along X".** eY is the slot position error and eZ the depth error, measured from the locators (the datum). Both stay inside the green tolerance band in the good layout.
5. **Change the layout** to *Locators too close together*. The block tilts much more and the slot error grows several times. Then try *Clamps away from locators*: a clamp now pushes where nothing supports the part and a locator is unseated before cutting even starts.
6. **Reverse the feed direction** (+X → −X). In slotting the largest force is across the feed; with −X it pushes the part into the side clamp instead of the solid side locators, and the safety factor drops.
7. **Run the "Clamping force study".** More clamp force raises the friction reserve almost in proportion but reduces the slot error only slightly. Clamp force is for **security**; locator layout and stiffness are for **accuracy**.
8. **Validate (lab):** upload a static push test on the clamped part (force and dial-gauge reading) to check the contact stiffness, and CMM readings of the slot (`x_mm, eY_mm, eZ_mm`).

---

## Module 6 — Tool wear and cutting force: step by step

**The problem.** As an end mill wears, a flat **flank wear land VB** grows on the clearance face behind each cutting edge. The land rubs on the machined surface, so the cutting force and power rise even though the same amount of metal is removed. Baseline: finish milling Ti-6Al-4V with a Ø12 mm, 4-flute end mill (ap = 10 mm, ae = 1.2 mm).

1. **Select Module 6** and move the **VB slider** from 0 to 0.30 mm. Watch the wear land grow on every flute (drawn wider than real) and in the **cutting-edge close-up** (top right), where the tangential and radial forces split into a shearing part and an edge/ploughing part.
2. **Open "Forces vs cutter angle"** (worn vs fresh dashed) and **"Fresh vs worn"**. The radial (thrust) force grows fastest.
3. **Open "Force vs VB" and "Power & energy vs VB".** Power and specific cutting energy (J/mm³) rise with VB at constant MRR.
4. **Tick "Wear-growth mode"** and press Play: VB now follows an illustrative rate model along the timeline. **"Wear vs machining time"** shows when the replacement criterion is reached and how many parts one tool can make.
5. **Change vc and fz** and compare parts per tool, tools per batch and total time (Results → Replacement & productivity).
6. **Validate (lab):** upload mean forces measured with tools of known VB to **fit the wear coefficients**, and VB-versus-time readings to check the wear rate.

> The replacement criterion defaults to VB = 0.30 mm, the uniform flank-wear criterion commonly used in ISO 8688-2 end-milling tool-life tests (VBmax = 0.5 mm for localized wear). The wear-growth model is a teaching device, not a validated tool-life prediction, and roughness is shown only as a qualitative risk.

---

## The three learning stages and your score

| Stage | What you do | Points |
|---|---|---|
| **A · Observe** | Watch the baseline; answer concept questions on force components, deformation and error | 1 per question |
| **B · Experiment** | Make a **prediction first**, then test it by changing one parameter; save and compare trials | 1 per question |
| **C · Solve** | Fix an industrial production problem: meet the tolerance **and** the productivity target, then justify your choice in ≥ 30 words | 3 for the solution + 1 for the justification |
| **Validate** | (Optional, with the lab dynamometer) upload measured forces or wall measurements and compare | — |

- Press **Load the current (failing) programme** in Stage C to start from the problem setup. Don't change the *fixed* items (material, geometry, tool size, tolerance, coefficients), or the check will fail.
- Your justification is checked automatically only for length and key concepts. **Your lecturer grades the reasoning.**
- **Report** downloads an HTML report with your score, configuration, answers and trials, plus a CSV of your trials.

Lab worksheets: [Module 1](docs/WORKSHEET.md) · [Module 2](docs/WORKSHEET_M2.md) · [Module 3](docs/WORKSHEET_M3.md) · [Module 4](docs/WORKSHEET_M4.md) · [Module 5](docs/WORKSHEET_M5.md)

---

## Reading the results correctly

- **Peak elastic deflection is not the final error.** The wall or tool springs back after the cutter passes. The final error is the relative deflection at the instant each point of the surface is generated.
- **Positive deviation = material left** (wall too thick or proud). Negative = overcut.
- **"estimate"** means the cutting coefficients are illustrative, not measured. Treat the trends as reliable and the absolute numbers as approximate.
- **Modules 1 and 2 are quasi-static.** Their *Dynamics check* compares the tooth-passing frequency with the natural frequency. If the ratio is high, open **Module 3**, which models vibration and chatter properly.
- **Orange warnings** flag physically doubtful set-ups: holder collision, engaged length longer than the flutes, very long tools, excessive stress.

---

## Key equations

| Quantity | Equation |
|---|---|
| Uncut chip thickness | h(φ) = fz · sin φ |
| Tooth forces | Ft = Ktc·b·h + Kte·b  Fr = Krc·b·h + Kre·b  Fa = Kac·b·h + Kae·b |
| Global forces (on tool) | Fx = −Ft cos φ − Fr sin φ  Fy = Ft sin φ − Fr cos φ  Fz = Fa |
| Engagement | up-milling φ: 0 → arccos(1 − 2ae/D); down-milling φ: π − arccos(1 − 2ae/D) → π |
| Feed rate | vf = n · N · fz (mm/min) |
| Material removal rate | MRR = ae · ap · vf (mm³/min) |
| Cutting speed | vc = π · D · n / 1000 (m/min) |
| Tooth-passing frequency | f_tp = n · N / 60 (Hz) |
| Cantilever deflection | δ = F · L³ / (3 · E · I), with I = b · t³ / 12 for a wall and π·d⁴/64 for a tool |
| Tool receptance (Module 3) | G(f) = 1 / (k (1 − r² + 2iζr)), r = f/fn |
| Stability pockets | n ≈ 60 · fn / (N (k + 1)), k = 0, 1, 2 … |
| Minimum stable depth (slotting, one flexible direction) | a_lim,min = 8 k ζ (1 + ζ) / (N · Krc) |
| Turning forces (Module 4) | Fc = Ktc·b·h + Kte·b, FN = Krc·b·h + Kre·b, Ff = FN sin κe, Fp = FN cos κe; h = f sin κe, b = ap / sin κe |
| Turning power, speed, MRR | Pc = Fc·vc / 60 000 (kW), n = 1000·vc / (π D), Q = vc·ap·f (cm³/min) |
| Theoretical roughness | Ra ≈ f² / (32 rε) |
| Rigid-body motion (Module 5) | u(p) = δ + θ × (p − c); K q = W, K = Σ k Jᵀ J, J = [n, (p − c) × n] |
| Contact conditions (Module 5) | N = N0 − k (u · n) ≥ 0 (else lift-off); \|T\| ≤ μ N (else slip); k = k_ref (N0 / 1 kN)^(1/3) |
| Tool wear (Module 6) | Kte(VB) = Kte0 + ate·VB, Kre(VB) = Kre0 + are·VB, Kae(VB) = Kae0 + aae·VB; P = T·ω, u = P / MRR |
| Wear growth (Module 6, illustrative) | dVB/dt = A·(vc/vref)^p·(fz/fref)^q; parts per tool = floor(t_crit / t_part) |
| Feature error (Module 5) | e = −u(cutting point) in the datum frame; clamping safety factor = 1 / (minimum clamp multiplier) |

Open **Equations** in the app for the full model and the sign convention.

---

## Tips, common mistakes and FAQ

- **Change one parameter at a time**, otherwise you cannot tell which change caused the result.
- **Nothing moves?** Press Play. If the tool has reached the end of the path, Play restarts from the beginning.
- **Numbers look frozen while you drag a slider?** The simulation re-runs when you release it (0.1–1 s).
- **Lost your settings?** *Reset* restores the baseline. Saved trials stay until you press *Clear*.
- **Are my answers sent anywhere?** No. Everything stays in your browser. Use *Report* to hand in your work.
- **Can I use my own cutting coefficients?** Yes: *Cutting-force coefficients* in the left panel. Tick "calibrated" only if they come from your own dynamometer tests.
- **Module 5 says "PART NOT HELD"?** The fixture cannot resist the cutting force at all (slip or lift-off with no static solution). The error numbers are then not meaningful: fix the layout, clamps or feed direction first.
- **The lobes and the time-domain dots disagree?** Near the boundary and at low radial immersion this is expected. Trust the time-domain verdict and treat the point as marginal.

---

## Panduan ringkas (Bahasa Melayu)

1. Buka aplikasi: <https://nabilkhalil.github.io/MachinaForce3D/> (Chrome/Edge/Firefox, komputer riba disyorkan).
2. Pilih modul di bahagian atas kiri: **Module 1** (dinding nipis), **Module 2** (lenturan mata alat dalam poket dalam), **Module 3** (getaran *chatter*), **Module 4** (pelarikan aci langsing), **Module 5** (kekukuhan lekapan dan pergerakan bahan kerja) atau **Module 6** (kehausan mata alat dan daya pemotongan).
3. Tekan **▶ Play**. Anak panah **hijau (Fy)** ialah daya yang menolak dinding dan mata alat menjauhi satu sama lain.
4. Tandakan **Learning overlay** untuk penerangan setiap parameter.
5. Ikut **Lab guide**: **A · Observe → B · Experiment → C · Solve**. Ramal dahulu, kemudian ubah **satu** parameter sahaja dan simpan setiap percubaan (*Save current as trial*).
6. Akhir sekali, isi nama dan tekan **Report** untuk memuat turun laporan.

Nota: nilai daya dan pesongan ialah **anggaran model** (pekali pemotongan ilustratif), bukan ukuran sebenar.

---

## For lecturers

- **Modules:** 1 Thin-wall milling ✅ · 2 Tool bending in deep pockets ✅ · 3 Chatter and dynamic instability ✅ · 4 Turning slender shafts ✅ · 5 Fixture stiffness and workpiece movement ✅ · 6 Tool wear and cutting force ✅
- **Tool-wear lab link (Module 6):** mean forces at several measured VB values (`VB_mm, Fx_N, Fy_N, Fz_N`) give fitted wear coefficients; tool-microscope readings (`time_min, VB_mm`) give the wear rate.
- **Fixture lab link (Module 5):** a static push test on the clamped part (`x_mm, y_mm, z_mm, Fx_N, Fy_N, Fz_N, disp_um`) checks the contact stiffness; CMM slot readings (`x_mm, eY_mm, eZ_mm`) check the predicted feature errors.
- **Dynamometer link (Module 4):** compare 3-component turning forces (`Fc_N, Ff_N, Fp_N`) and micrometer readings (`z_mm, diameter_mm`) with the model.
- **Tap-test link (Module 3):** students can fit fn, ζ, k from an impact-hammer FRF (`freq_hz, real, imag` in m/N) and plot their cutting tests (`rpm, ap_mm, chatter`) on the lobe diagram.
- **Lab link:** the *Validate* stage compares the model with a measured force signal (`angle_deg` or `time_s`, `FX_N`, `FY_N`, `FZ_N`) and with measured wall thickness (Module 1) or wall deviation (Module 2). It reports RMSE and percentage error. *Synthetic example* buttons generate clearly labelled practice files.
- **Offline / LMS:** `npm run build:single` produces one self-contained HTML file that can be uploaded to URLearn or opened without internet.
- **Verification:** 146 automated tests compare the numerical models with analytical solutions (closed-form mean forces, cantilever and stepped-beam deflections, natural frequencies, mesh convergence, volume conservation, closed-form stability limits, rigid-body equilibrium of the fixture, friction and lift-off logic, and analytical lobes cross-checked against an independent time-domain simulation). See [docs/VALIDATION.md](docs/VALIDATION.md). Verification shows the equations are solved correctly; validation against your own measurements is still required before quoting absolute values.
- **Documentation:** [docs/PHYSICS.md](docs/PHYSICS.md) (models, sign convention, assumptions) · [docs/PROGRESS.md](docs/PROGRESS.md) (milestones, limitations).

---

## For developers

```bash
npm ci
npm run dev          # http://localhost:5173
npm test             # 146 verification tests (Vitest)
npm run build        # production build → dist/
npm run build:single # one self-contained HTML file → dist-single/index.html
```

Stack: React 19, TypeScript, Vite 7, Three.js / React Three Fiber / Drei, Tailwind CSS 4, Zustand, Recharts. The physics in `src/physics/` has no UI dependencies and runs in a Web Worker.

```
src/physics/   force model, plate FE, tool beam, stock model, process simulations
src/scene/     3D machine, workpieces, tools, force vectors
src/ui/        panels, charts, lab guide, assessment, validation
src/content/   learning text, questions, problems, references
tests/         verification suite
docs/          physics, validation, progress, worksheets, images
```

**Deploy (GitHub Pages):** every push to `main` runs `.github/workflows/deploy.yml` (install → test → build → publish). One-time setup: *Settings → Pages → Source: GitHub Actions*. The build uses relative paths, so the same `dist/` also works on Cloudflare Pages (`wrangler.toml` included).

---

## References

1. Lassila et al. (2024). Numerical evaluation of cutting strategies for thin-walled parts. *Scientific Reports*. [doi:10.1038/s41598-024-51883-1](https://doi.org/10.1038/s41598-024-51883-1)
2. Bolar & Joshi (2021). Experimental investigation and optimization of wall deflection and material removal rate in milling thin-wall parts. *Manufacturing Review*. [doi:10.1051/mfreview/2021015](https://doi.org/10.1051/mfreview/2021015)
3. Zawada-Michałowska (2025). Thin Wall Milling at a Maximized Axial Depth of Cut: An Analysis of Thermal and Mechanical Interactions. *Materials*. [doi:10.3390/ma18235347](https://doi.org/10.3390/ma18235347)
4. Si & Wang (2018). Error compensation in the five-axis flank milling of thin-walled workpieces. *Proc. IMechE Part B*. [doi:10.1177/0954405418780163](https://doi.org/10.1177/0954405418780163)
5. Altintas, Y. (2012). *Manufacturing Automation: Metal Cutting Mechanics, Machine Tool Vibrations, and CNC Design* (2nd ed.). Cambridge University Press. (Source of the mechanistic force-model formulation.)

The app uses these works as context and for model formulation. It does not reproduce their numerical results.

---

Developed by **Ts. Dr. Ahmad Nabil bin Mohd Khalil**, Department of Manufacturing, Faculty of Mechanical Engineering & Technology, Universiti Malaysia Perlis (UniMAP), for the Bachelor of Industrial Machining Technology with Honours programme. Built with Claude.
