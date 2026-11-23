# Verification record

Run with `npm test`. Last run: 2026-11-23, **129 / 129 passed** (Module 1: 47, Module 2: 21, Module 3: 20, Module 4: 21, Module 5: 20)

Verification shows that the equations are implemented and solved correctly against
analytical benchmarks. It does **not** validate the cutting coefficients or the physical
accuracy for a particular machine, tool or workpiece. Validation requires comparison with
measured forces and measured wall thickness (see the in-app *Validate* stage).

## Analytical benchmarks used

| Quantity | Benchmark | Acceptance |
|---|---|---|
| Mean force per revolution (Fx, Fy, Fz) | Closed-form integral of the mechanistic model over the engagement arc (Altintas formulation), up/down milling, ae/D = 0.06–1 | ≤ 0.5 % |
| Mean force, 30° helix | Same closed form (average is helix-independent) | ≤ 0.5 % |
| Wall under tip line load | Euler–Bernoulli cantilever δ = PL³/(3EI) and plate-strip limit δ(1−ν²) | FE between the two, ±3 % |
| Mesh convergence | Successive refinement 5×4 → 40×32 | monotonic, 20×16 vs 40×32 < 1 % |
| Wall first natural frequency | Cantilever beam f₁ = (1.875²/2π)·√(EI/ρAL⁴) | ≤ 8 % |
| Stock volume | Initial − final volume = Σ removed | ≤ 0.1 % |
| Tooth-passing period | 60/(n·N) | exact (to 1e-12) |
| **M2** Uniform tool, tip load / load at a < L | PL³/(3EI); Pa²(3L−a)/(6EI) | ≤ 0.2 % |
| **M2** Stepped tool (shank + flutes) | P[(L³−L₂³)/(3EI₁) + L₂³/(3EI₂)] | ≤ 0.5 % |
| **M2** Holder springs | extra tip deflection P/kT + PL²/kR | ≤ 0.2 % |
| **M2** Holder moment and stress | M(0) = P·a, σ = M·c/I | exact |
| **M2** Tool first bending frequency | uniform cantilever (1.875²/2π)√(EI/ρAL⁴) | ≤ 2 % |
| **M3** Receptance | G(0) = 1/k, \|G(fn)\| = 1/(2kζ), min Re G = −1/(4kζ(1+ζ)) | ≤ 0.1 % |
| **M3** Discrete modal integration | static step → 1/k; harmonic amplitude → \|G(f)\| | ≤ 0.5 % |
| **M3** ZOA lobes, slotting, y-flexible | a_lim,min = 8kζ(1+ζ)/(N·Krc) | ≤ 2 % |
| **M3** ZOA vs independent time-domain simulation | stable at 0.6·a_ZOA, chatter at 1.5·a_ZOA (ae/D = 0.25, 0.5, 1; several speeds) | all points |
| **M3** Tap-test peak picking | recovers fn, ζ, k of a synthetic FRF | ≤ 3 % |
| **M4** Force decomposition | sharp tool: κe = κr, Ff = FN sin κr, Fp = FN cos κr, b·h = ap·f | exact |
| **M4** Shaft beam FE | cantilever PL³/3EI; simply supported PL³/48EI; propped cantilever Pa³b²(3L+b)/(12EIL³) | ≤ 0.1 % |
| **M4** Shaft natural frequency | cantilever (1.875²/2π)√(EI/ρAL⁴) | ≤ 2 % |
| **M4** Deflection coupling | sharp tool: e = c·g·ap/(1 + c·g) | ≤ 1e-6 |
| **M4** Power, roughness | Pc = Fc·vc/60 000, Ra = f²/(32 rε) | exact |
| **M5** Clamped-state equilibrium | ΣF = 0 and ΣM = 0 over contact forces + gravity; base locators carry 3P + W | ≤ 1e-6 N, 1e-4 N·mm |
| **M5** Cut-step equilibrium | cutting force = Σ change of contact forces rebuilt from the spring laws | ≤ 1e-6 N |
| **M5** Pure push through the stiffness centre | settlement = F / Σk_z, no tilt | ≤ 5 % |
| **M5** Friction law | slip safety factor ∝ μ (0.25 → 0.4) | ≤ 5 % |
| **M5** Minimum clamp force | at 1.05 × required multiplier the path holds; at 0.8 × it fails | pass/fail |
| **M5** Fixture natural frequency | √(Σk/m)/2π within the range of the six computed modes | order of magnitude |

## Test list

- Unit consistency and kinematics > feed rate vf = n·N·fz (mm/min)
- Unit consistency and kinematics > MRR = ae·ap·vf (mm³/min) and scales linearly with each factor
- Unit consistency and kinematics > tooth-passing frequency = n·N/60 and matches the period of the force signal
- Unit consistency and kinematics > force scales linearly with axial engagement b (N/mm² × mm × mm = N)
- Zero-force conditions > no force when ae = 0
- Zero-force conditions > no force when b = 0
- Zero-force conditions > no force when fz = 0 and edge coefficients are zero
- Engagement and disengagement > up-milling arc is [0, φa], down-milling [π − φa, π]
- Engagement and disengagement > slotting (ae = D) engages 0…π in both modes
- Engagement and disengagement > a tooth outside the arc carries no force; inside it does
- Engagement and disengagement > uncut chip thickness h = fz·sin φ
- Force-coordinate transformation > edge at φ = 90°: Fy = +Ft, Fx = −Fr (forces on tool)
- Force-coordinate transformation > edge at φ = 0: Fx = −Ft, Fy = −Fr
- Force-coordinate transformation > preserves the magnitude of the in-plane force
- Numerical vs analytical benchmark (mean force per revolution) > up-milling, ae = 0.5 mm: numerical mean within 0.5 % of closed form
- Numerical vs analytical benchmark (mean force per revolution) > up-milling, ae = 2 mm: numerical mean within 0.5 % of closed form
- Numerical vs analytical benchmark (mean force per revolution) > up-milling, ae = 4 mm: numerical mean within 0.5 % of closed form
- Numerical vs analytical benchmark (mean force per revolution) > up-milling, ae = 8 mm: numerical mean within 0.5 % of closed form
- Numerical vs analytical benchmark (mean force per revolution) > down-milling, ae = 0.5 mm: numerical mean within 0.5 % of closed form
- Numerical vs analytical benchmark (mean force per revolution) > down-milling, ae = 2 mm: numerical mean within 0.5 % of closed form
- Numerical vs analytical benchmark (mean force per revolution) > down-milling, ae = 4 mm: numerical mean within 0.5 % of closed form
- Numerical vs analytical benchmark (mean force per revolution) > down-milling, ae = 8 mm: numerical mean within 0.5 % of closed form
- Numerical vs analytical benchmark (mean force per revolution) > helical cutter (30°): mean force equals the straight-flute closed form
- Numerical vs analytical benchmark (mean force per revolution) > helix smooths the force: lower peak than straight flute, same mean
- Numerical vs analytical benchmark (mean force per revolution) > numerical mean converges as angular resolution increases
- Elastic deflection: analytical cantilever > δ = F L³ / (3EI) for a load at the free end
- Elastic deflection: analytical cantilever > increased force → proportionally increased deflection
- Elastic deflection: analytical cantilever > increased wall thickness → stiffness ∝ t³
- Elastic deflection: analytical cantilever > increased tool overhang → tool deflection ∝ L³
- Plate finite-element model > tip line load: FE lies between beam theory and plate-strip limit δ(1−ν²) (±3 %)
- Plate finite-element model > converges under mesh refinement
- Plate finite-element model > thicker wall is stiffer (≈ t³)
- Plate finite-element model > compliant clamp increases deflection
- Stock-removal state > volume removed equals the change in stock volume (conservation)
- Stock-removal state > removed volume never exceeds the nominal allowance volume (deflection leaves material)
- Stock-removal state > replaying station edits reproduces the final stock exactly
- Stock-removal state > thickness never increases during machining
- Stock-removal state > FE element thickness is derived from the stock
- Process-level physical trends > thinner wall → larger thickness error
- Process-level physical trends > up- and down-milling give different surface errors (helical cutter)
- Process-level physical trends > higher feed per tooth → higher peak force
- Process-level physical trends > longer overhang → larger tool deflection
- Process-level physical trends > wall first natural frequency is close to the cantilever beam value
- Teaching content: Stage C production problem > the baseline programme fails the tolerance (the problem is real)
- Teaching content: Stage C production problem > at least one admissible strategy meets tolerance and productivity (the problem is solvable)
- Teaching content: Stage C production problem > B4 prediction holds in the model: single-side finishing leaves more error than alternating
- Teaching content: Stage C production problem > B2 prediction holds in the model: doubling fz raises peak force by less than 2×
- Modal model (FRF and discretisation) > receptance: G(0) = 1/k and |G(fn)| = 1/(2kζ)
- Modal model (FRF and discretisation) > minimum real part = −1/(4kζ(1+ζ)) near fn√(1+2ζ)
- Modal model (FRF and discretisation) > exact discretisation: static step → 1/k, harmonic amplitude → |G(f)|
- Modal model (FRF and discretisation) > spectrum: a pure sine peaks at its frequency with its amplitude
- Stability lobes (zero-order approximation) > slotting directional factors: αxx = αyy = −πKr, αxy = −π, αyx = π
- Stability lobes (zero-order approximation) > closed form (slotting, flexible only in y): a_lim,min = 8kζ(1+ζ)/(N·Krc) within 2 %
- Stability lobes (zero-order approximation) > largest pocket where the tooth-passing frequency equals fn (n = 60·fn/N)
- Stability lobes (zero-order approximation) > lobe heights scale with stiffness and (approximately) with damping
- Stability lobes (zero-order approximation) > slotting is less stable than half immersion
- Time-domain regenerative simulation and chatter detection > very shallow cut: stable, dominant vibration at a tooth-passing harmonic
- Time-domain regenerative simulation and chatter detection > deep cut in a trough: chatter, dominant frequency NOT a harmonic and near fn
- Time-domain regenerative simulation and chatter detection > chatter is decided by motion, not force: a stable cut can have a larger peak force than a chattering one
- Time-domain regenerative simulation and chatter detection > cross-validation (ae = 8 mm): time domain stable at 0.6·a_ZOA and chattering at 1.5·a_ZOA
- Time-domain regenerative simulation and chatter detection > cross-validation (ae = 16 mm): time domain stable at 0.6·a_ZOA and chattering at 1.5·a_ZOA
- Time-domain regenerative simulation and chatter detection > cross-validation (ae = 4 mm): time domain stable at 0.6·a_ZOA and chattering at 1.5·a_ZOA
- Time-domain regenerative simulation and chatter detection > low immersion: ZOA is optimistic somewhere in the range (time domain finds chatter below the ZOA lobe)
- Time-domain regenerative simulation and chatter detection > jump-out with multiple regeneration bounds the chatter amplitude (limit cycle, no divergence)
- Tap-test fitting > peak picking recovers fn, ζ and k from a synthetic FRF within 3 %
- Module 3 production problem > the baseline chatters
- Module 3 production problem > an admissible chatter-free solution reaches the MRR target
- Stepped tool beam vs closed-form cantilever solutions > uniform section, tip load: δ = PL³/(3EI) within 0.1 %
- Stepped tool beam vs closed-form cantilever solutions > uniform section, load at a < L: δ(L) = Pa²(3L − a)/(6EI)
- Stepped tool beam vs closed-form cantilever solutions > two-section (shank + flutes), tip load: δ = P[(L³−L₂³)/(3EI₁) + L₂³/(3EI₂)]
- Stepped tool beam vs closed-form cantilever solutions > holder springs add P/kT + P·L²/kR at the tip
- Stepped tool beam vs closed-form cantilever solutions > reduced neck makes the tool more compliant; longer overhang ∝ L³
- Stepped tool beam vs closed-form cantilever solutions > bending moment at the holder face = P·a; stress = M·c/I
- Stepped tool beam vs closed-form cantilever solutions > distributed band load equals the sum of its parts (linearity)
- Stepped tool beam vs closed-form cantilever solutions > first bending frequency matches the uniform cantilever (1.875²/2π)·√(EI/ρAL⁴) within 2 %
- Deep-pocket process > volume conservation and exact replay of stock edits
- Deep-pocket process > deflection leaves material (positive deviation) but never more than the allowance
- Deep-pocket process > rigid tool + rigid holder → no form error
- Deep-pocket process > longer overhang → larger tip deflection and error
- Deep-pocket process > compliant holder adds error compared with a rigid holder
- Deep-pocket process > spring pass reduces the maximum error
- Deep-pocket process > compensation reduces the mean error
- Deep-pocket process > P-B1 holds: overhang 60 → 75 mm raises tip deflection by 1.6–2.1×
- Deep-pocket process > P-B4 holds: holder share of tip compliance is 20–30 % for the default holder
- Deep-pocket process > P-B2 holds: full-depth flank pass (long flutes) gives a much larger error than step-down
- Deep-pocket process > full-depth pass with short flutes is flagged
- Module 2 production problem > the baseline programme fails
- Module 2 production problem > an admissible solution exists
- Turning force components > sharp tool (rε = 0): κe = κr, Ff = FN sin κr, Fp = FN cos κr, chip area b·h = ap·f
- Turning force components > Fc = Ktc·ap·f + Kte·b (units N)
- Turning force components > κr = 90°, sharp tool: no passive force; with a nose radius Fp > 0
- Turning force components > nose radius: small depth → small equivalent angle; deep cut → κe approaches κr
- Turning force components > cutting power Pc = Fc·vc/60 000 and theoretical Ra = f²/(32 rε)
- Shaft beam FE vs closed-form solutions > cantilever (chuck only), load at the free end: δ = PL³/(3EI)
- Shaft beam FE vs closed-form solutions > between rigid centres, load at mid-span: δ = PL³/(48EI)
- Shaft beam FE vs closed-form solutions > chuck + rigid tailstock (propped cantilever), load at a: δ(a) = P a² b³ (3L + b)... closed form
- Shaft beam FE vs closed-form solutions > steady rest reduces mid-span deflection; compliant tailstock increases it
- Shaft beam FE vs closed-form solutions > mesh convergence for a load between nodes
- Shaft beam FE vs closed-form solutions > first natural frequency of a cantilever ≈ (1.875²/2π)·√(EI/ρAL⁴) within 2 %
- Turning process > volume conservation and exact replay of the stock edits
- Turning process > coupling: with a sharp tool e = c·g·ap/(1 + c·g) exactly
- Turning process > deflection leaves the diameter oversize but never more than the stock
- Turning process > workholding ranking: chuck only ≫ centres > chuck + tailstock > with steady rest
- Turning process > between supports the error profile is barrel-shaped (larger in the span than at both ends)
- Turning process > T-B2 holds: κr 93° vs 75° makes no difference when the cut is on the nose
- Turning process > T-B3 holds: smaller nose radius → smaller Fp and error, larger Ra
- Turning process > spring pass and rough–finish reduce the error
- Module 4 production problem > the baseline fails
- Module 4 production problem > an admissible solution exists
- Rigid-body fixture statics > solve6 solves a well-conditioned 6×6 system
- Rigid-body fixture statics > 3-2-1 layout: 6 locators whose normals span all six DOF; clamps oppose locators
- Rigid-body fixture statics > clamped state is in equilibrium: Σ contact forces + gravity = 0 (forces and moments)
- Rigid-body fixture statics > clamps directly over the base locators: each base locator carries its clamp force (+ gravity share)
- Rigid-body fixture statics > end locator without end clamp is unloaded but allowed; clamps away from the locators unseat a locator
- Rigid-body fixture statics > pure Z push at the centroid over a symmetric seated set: settlement = F / Σk_z (no tilt)
- Rigid-body fixture statics > incremental cut equilibrium: cutting force = Σ change of contact forces (normal + friction)
- Rigid-body fixture statics > natural frequency of a block on springs: f = √(k/m)/2π for the Z mode (sanity, order of magnitude)
- Lift-off, slip and clamping safety > a force pulling the part off the base locators makes them lift off
- Lift-off, slip and clamping safety > a large tangential force with small clamping makes a contact slip
- Lift-off, slip and clamping safety > slip safety factor scales ≈ with clamp force and exactly with μ
- Lift-off, slip and clamping safety > minimum clamp multiplier: at required scale the path just holds, below it does not
- Cutting load and feature error > slot force direction: +X feed pushes the part into the side locators; −X into the side clamp
- Cutting load and feature error > feature error = −(displacement at the cutting point), and scales linearly with the force (ap)
- Cutting load and feature error > locator spread: the narrow layout gives a much larger slot error and tilt than the good layout
- Cutting load and feature error > static push test returns a displacement along the force and agrees with the cut response
- Cutting load and feature error > error interpolation along the slot is inside the station range
- Stage C production problem > baseline fails
- Stage C production problem > the known solution passes every requirement
- Stage C production problem > only raising the clamp force on the poor layout is not enough
