# CLAUDE.md

Project: MachinaForce3D
Status: Modules 1–6 implemented.
Stack: React 19, TypeScript, Vite, Three.js, Zustand, Recharts, Vitest.

## Architecture

- `src/physics`: engineering calculations
- `src/state`: Zustand stores
- `src/scene`: 3D components
- `src/ui`: controls and results
- `src/content`: teaching activities
- `src/sim`: simulation execution
- `tests`: engineering verification

## Development rules

1. Preserve existing working modules.
2. Reuse existing components and patterns.
3. Read only files relevant to the current task.
4. Make small, targeted changes.
5. Avoid adding dependencies unless essential.
6. Separate validated models from illustrative assumptions.
7. Add tests for every new physics calculation.
8. Run typecheck, tests and build before completion.
9. Keep responses concise.
10. Report changed files, tests and limitations.
11. Avoid full-file dumps and unnecessary documentation rewrites.
12. Do not commit or push unless explicitly requested.

## Known pitfall

React 19 + drei `<Html>`: unmounting an Html label (e.g. inside a module scene that unmounts on module switch) throws `removeChild`. Keep labels permanently mounted (see `Label` in `src/scene/LabScene.tsx`) and hide them with `visible`.
