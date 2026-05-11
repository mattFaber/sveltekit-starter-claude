# Roadmap: 2D Universe Physics Sandbox

N-body gravitational simulation with WebGPU compute shaders (tiled all-pairs O(n²) GPU algorithm), Leapfrog integration, instanced rendering with HDR bloom, and a SvelteKit UI layer. Physics stays entirely on the GPU — no CPU readback during the simulation loop. Simulation units (AU/M☉/yr) replace SI to preserve float32 precision at astronomical scales.

UI is built with **Atomic Design** (atoms → molecules → organisms → templates → pages). Every mouse/touch interaction has a keyboard-accessible and screen-reader-accessible UI control equivalent — no interaction is pointer-only.

---

## Atomic Design Component Hierarchy

```
src/lib/components/
  atoms/                # Primitive, stateless UI elements
    Button/             # Icon + label variants, aria-label required
    Slider/             # Range input, aria-valuenow/min/max, labeled
    Badge/              # Body type chip (STAR, PLANET…)
    NumberInput/        # Mass/velocity numeric fields with units label
    Icon/               # SVG icon wrapper, aria-hidden by default
    Toggle/             # On/off switch, role="switch"
  molecules/            # Composed from atoms, single responsibility
    BodyTypeSelector/   # Row of Badge buttons (role="radiogroup")
    VelocityControl/    # NumberInput pair (vx, vy) + magnitude display
    TimeScaleControl/   # Slider + numeric readout + label
    PresetCard/         # Card with name, description, load Button
  organisms/            # Feature-complete UI sections
    SpawnPanel/         # BodyTypeSelector + VelocityControl + spawn Button
    BodyInspector/      # Selected body properties panel
    TimeControls/       # Play/pause + TimeScaleControl + elapsed display
    HUD/                # FPS, body count, GPU time badges
    PresetMenu/         # Grid of PresetCard molecules
  templates/
    SimulationLayout/   # Canvas + sidebar + HUD overlay layout
  pages/
    SimulationPage/     # Composes template, wires engine state
```

## Accessibility Contract

Every pointer interaction has a UI control equivalent:

| Pointer gesture | Keyboard / UI control equivalent |
|---|---|
| Drag on canvas to pan | Arrow keys (canvas `tabindex="0"`) |
| Scroll wheel to zoom | `+` / `-` keys; Zoom In/Out `Button` atoms in HUD |
| Click+drag to set spawn velocity | `SpawnPanel` form: body type + vx/vy inputs + Spawn button |
| Click body to select | Tab-navigable body list in `BodyInspector` |
| Drag time slider | `TimeScaleControl` molecule (`<input type="range">` + `NumberInput`) |

Canvas: `role="application"`, `aria-label="2D gravity simulation"`, `tabindex="0"`. Body count and pause state announced via `aria-live="polite"`.

---

## Phase 1 — Foundation

**Goal:** WebGPU initialized, bodies in GPU buffers, forces computed, Leapfrog integration running. Verify with a 2-body Kepler orbit.

- [x] 1. Install `@webgpu/types` for TypeScript definitions
- [x] 2. `src/lib/simulation/engine/WebGPUDevice.ts` — async init, `navigator.gpu` guard, graceful fallback
- [x] 3. `src/lib/simulation/physics/units.ts` — SI ↔ sim units (G = 4π² in AU³/M☉/yr²)
- [x] 4. `src/lib/simulation/physics/bodies.ts` — `BodyData` interface, `BodyType` enum
- [x] 5. `src/lib/simulation/compute/NBodyCompute.ts` — ping-pong buffers, compute pipeline
- [x] 6. `src/lib/simulation/compute/nbody.wgsl` — tiled all-pairs shader, Leapfrog integration
- [x] 7. `src/lib/simulation/engine/NBodyEngine.ts` — `step(dt)`, `render()`, `destroy()`
- [x] 8. **Verify**: 2-body Kepler orbit unit test — 15/15 passing

*Steps 2–5 can run in parallel.*

---

## Phase 2 — Rendering

**Goal:** Bodies visible on screen with glow, camera working.

- [x] 9. `src/lib/simulation/render/shaders/particle.vert.wgsl` — instanced quad, zero-copy from compute buffer
- [x] 10. `src/lib/simulation/render/shaders/particle.frag.wgsl` — SDF circle, radial glow, color by body type
- [x] 11. `src/lib/simulation/render/ParticleRenderer.ts` — instanced pipeline, HDR offscreen target
- [x] 12. `src/lib/simulation/render/BloomPass.ts` — 4-pass: threshold → H blur → V blur → composite
- [x] 13. `src/lib/simulation/viewport/Camera.ts` — pan/zoom math, world↔screen transforms
- [x] 14. `src/lib/components/SimulationCanvas.svelte` — `$effect` lifecycle, rAF loop, resize observer

*Steps 9–12 can run in parallel. Step 14 depends on 11–13.*

---

## Phase 3 — Interaction

**Goal:** Spawn, select, time controls. Every pointer gesture has a keyboard/form equivalent.

- [ ] 15. `src/lib/simulation/viewport/controls.ts` — pointer + keyboard events (arrow keys = pan, `+/-` = zoom)
- [ ] 16. `src/lib/components/molecules/SpawnOverlay.svelte` — velocity arrow on canvas drag (pointer shortcut only)
- [ ] 17. `src/lib/components/organisms/SpawnPanel` — form-based spawn; primary accessible path
- [ ] 18. `src/lib/components/organisms/BodyInspector` — body properties + tab-navigable body list
- [ ] 19. `src/lib/components/organisms/TimeControls` — play/pause, time scale, elapsed time
- [ ] 20. `src/lib/components/organisms/HUD` — FPS/body count/GPU time; `aria-live` announcements
- [ ] 21. Canvas a11y — `role="application"`, `tabindex="0"`, click-to-select via CPU snapshot

*Steps 16–20 can run in parallel. Step 21 depends on 15.*

---

## Phase 4 — Presets & Body Merging

**Goal:** Rich starting scenarios, bodies merge on collision.

- [ ] 22. `src/lib/simulation/physics/merger.ts` — `active=0` merge flag, CPU-side merge logic
- [ ] 23. `src/lib/simulation/presets/solar-system.ts` — Sun + 8 planets
- [ ] 24. `src/lib/simulation/presets/binary-stars.ts` — binary star system
- [ ] 25. `src/lib/simulation/presets/galaxy-collision.ts` — two colliding disk galaxies
- [ ] 26. `src/lib/simulation/presets/index.ts` — preset registry
- [ ] 27. `src/lib/components/organisms/PresetMenu` — keyboard-navigable preset grid

*Steps 23–25 are fully parallel. Step 26 depends on 23–25.*

---

## Phase 5 — Polish & Optimisation

**Goal:** Trails, adaptive timestep, performance guardrails.

- [ ] 28. Trail ring buffer — opt-in GPU trails, `Toggle` atom in HUD
- [ ] 29. Adaptive timestep — per-body min-safe-dt, 1 float GPU readback/frame
- [ ] 30. Body count control — `Slider` + `NumberInput` molecule with `aria-live` announcement
- [ ] 31. Canvas2D + Web Worker fallback — Euler integration, all UI controls remain functional

---

## GPU Buffer Layout

```
Ping-pong A/B  (f32×4 per body):  [ x, y, vx, vy ]               × N_bodies
Properties     (f32×4 per body):  [ mass, radius, type, active ]   × N_bodies
```

- Type stored as `f32` to avoid WGSL struct alignment issues
- `active = 0` marks merged/deleted bodies — skipped cheaply in compute shader
- Vertex shader reads ping-pong output buffer directly — zero GPU→CPU→GPU round-trip

---

## Key Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| GPU algorithm | Tiled all-pairs O(n²) | Handles ~16k bodies @60fps; Barnes-Hut is a separate larger effort |
| Integration | Leapfrog (velocity-Verlet) | Symplectic — conserves energy long-term; 4× cheaper than RK4 |
| Units | AU / M☉ / yr (G = 4π²) | Keeps float32 values in [1e-3, 1e3] — prevents precision loss |
| Rendering | Zero-copy instanced quads | Vertex shader reads compute buffer directly |
| Bloom | 4-pass texture pipeline | Standard HDR glow, runs entirely in texture space |
| Body merging | CPU-side every N frames | GPU merge has race conditions; CPU latency is imperceptible |
| Component structure | Atomic Design | Atoms stateless + individually tested; organisms own feature state |
| Accessibility | UI controls are primary path | Canvas gestures are shortcuts; SpawnPanel, body list, keyboard nav are the complete accessible interface |

---

## Verification Checklist

- [ ] **Kepler orbit** — period matches T² ∝ a³ within 1% after 10 orbits
- [ ] **Energy conservation** — total KE + PE drifts < 0.1% per 100 steps
- [ ] **Merge momentum** — momentum conserved after body collision
- [ ] **Preset smoke tests** — no NaN bodies in any preset
- [ ] `npm run check` — 0 TypeScript errors
- [ ] `npm run test:unit` — atoms, molecules, `units.ts`, `Camera.ts`, preset factories
- [ ] `npm run test:e2e` — spawn via SpawnPanel form, pause/resume via TimeControls, `axe` audit (0 critical violations)
- [ ] **Manual a11y audit** — full keyboard-only walkthrough; VoiceOver/NVDA `aria-live` verified

---

## Notes

- **WebGPU support**: Chrome 113+, Edge 113+ fully supported; Firefox/Safari partial. Step 31 covers the gap.
- **Body count ceiling**: ~10k @ 60fps realistic on mid-range GPU. HUD warns below 30fps.
- **Trails are opt-in**: 10k × 64 points × 8 bytes ≈ 5MB GPU bandwidth per frame.
