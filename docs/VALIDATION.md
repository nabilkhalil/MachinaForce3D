# Verification record

Run with `npm test`. Last run: 2026-11-22, **68 / 68 passed** (Module 1: 47, Module 2: 21) (Vitest 3, Node 22).

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
