/**
 * Thin-wall workpiece rendered directly from the simulation's stock height field.
 * - Solid mesh: current stock + (optionally exaggerated) elastic displacement, colour-mapped.
 * - Ghost: the same stock without displacement (original/undeformed geometry).
 * Geometry is rebuilt from the exact arrays the solver uses, so visual and computed stock agree.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { playback, useApp } from '../state/store';
import { applyEdits, type SimResult } from '../physics/process';
import { cloneStock, type StockGrid } from '../physics/stock';
import { sampleW } from '../physics/plateFE';
import { instantState } from '../sim/instant';
import { diverging, sequential } from '../lib/colormap';

/** Shared, mutable "display" info read by the colour bar. */
export const wallDisplay = { maxDisp: 0, devRange: 0.1, scale: 1e-6 };

export function buildIndex(nx: number, nz: number) {
  // vertex layout: front grid (nx+1)(nz+1), back grid (nx+1)(nz+1)
  const V = (nx + 1) * (nz + 1);
  const vid = (face: 0 | 1, i: number, k: number) => face * V + k * (nx + 1) + i;
  const idx: number[] = [];
  for (let k = 0; k < nz; k++)
    for (let i = 0; i < nx; i++) {
      // front face (normal −Y): wind so it faces −Y
      const a = vid(0, i, k), b = vid(0, i + 1, k), c = vid(0, i + 1, k + 1), d = vid(0, i, k + 1);
      idx.push(a, b, c, a, c, d);
      const a2 = vid(1, i, k), b2 = vid(1, i + 1, k), c2 = vid(1, i + 1, k + 1), d2 = vid(1, i, k + 1);
      idx.push(a2, c2, b2, a2, d2, c2);
    }
  for (let i = 0; i < nx; i++) {
    // top cap
    const a = vid(0, i, nz), b = vid(0, i + 1, nz), c = vid(1, i + 1, nz), d = vid(1, i, nz);
    idx.push(a, b, c, a, c, d);
  }
  for (let k = 0; k < nz; k++) {
    // end caps x = 0 and x = L
    const a = vid(0, 0, k), b = vid(1, 0, k), c = vid(1, 0, k + 1), d = vid(0, 0, k + 1);
    idx.push(a, c, b, a, d, c);
    const e = vid(0, nx, k), f = vid(1, nx, k), g = vid(1, nx, k + 1), h = vid(0, nx, k + 1);
    idx.push(e, f, g, e, g, h);
  }
  return idx;
}

/** Vertex face position = mean of the (up to 4) adjacent cells. */
export function vertexFace(s: StockGrid, arr: Float32Array, i: number, k: number) {
  let sum = 0, n = 0;
  for (const di of [-1, 0]) for (const dk of [-1, 0]) {
    const ci = i + di, ck = k + dk;
    if (ci < 0 || ck < 0 || ci >= s.nxC || ck >= s.nzC) continue;
    sum += arr[ck * s.nxC + ci]; n++;
  }
  return sum / n;
}

export function WallMesh() {
  const result = useApp((s) => s.result);
  const view = useApp((s) => s.view);
  const { gl } = useThree();
  useEffect(() => { gl.localClippingEnabled = true; }, [gl]);

  const state = useRef<{ res: SimResult | null; stock: StockGrid | null; applied: number }>({ res: null, stock: null, applied: -1 });

  const geo = useMemo(() => {
    if (!result) return null;
    const s = result.stock0;
    const V = (s.nxC + 1) * (s.nzC + 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * V * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(2 * V * 3), 3));
    g.setIndex(buildIndex(s.nxC, s.nzC));
    const ghost = new THREE.BufferGeometry();
    ghost.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * V * 3), 3));
    ghost.setIndex(g.getIndex());
    state.current = { res: result, stock: cloneStock(result.stock0), applied: -1 };
    return { g, ghost, V };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const clip = useMemo(() => [new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0)], []);

  useFrame(() => {
    if (!result || !geo) return;
    const st = state.current;
    const s = st.stock!;
    clip[0].constant = result.params.wallLength / 2;
    // sync stock with playback cursor (edits up to and including the current station)
    const target = Math.floor(Math.min(Math.max(playback.station, 0), result.stations.length - 1));
    if (target < st.applied) {
      s.front.set(result.stock0.front); s.back.set(result.stock0.back); st.applied = -1;
    }
    if (target > st.applied) { applyEdits(result, s, st.applied + 1, target); st.applied = target; }

    const inst = instantState(result, playback.station, playback.phi);
    const wUnit = inst.station.wUnit;
    const load = inst.wallLoad;
    const ex = view.exaggeration;
    const pos = geo.g.getAttribute('position') as THREE.BufferAttribute;
    const col = geo.g.getAttribute('color') as THREE.BufferAttribute;
    const gpos = geo.ghost.getAttribute('position') as THREE.BufferAttribute;
    const P = pos.array as Float32Array, C = col.array as Float32Array, G = gpos.array as Float32Array;
    const nx = s.nxC, nz = s.nzC;
    const tNom = result.params.wallThickness;
    const devR = Math.max(result.params.tolerance * 2, 0.02);
    wallDisplay.devRange = devR;

    // first pass: displacement magnitudes for normalisation
    let maxW = 1e-9;
    const wv = new Float32Array((nx + 1) * (nz + 1));
    for (let k = 0; k <= nz; k++)
      for (let i = 0; i <= nx; i++) {
        const w = sampleW(result.mesh, wUnit, i * s.dx, k * s.dz) * load;
        wv[k * (nx + 1) + i] = w;
        maxW = Math.max(maxW, Math.abs(w));
      }
    wallDisplay.maxDisp = maxW;
    // stable colour scale: peak deflection at this station over a full revolution
    const scale = Math.max(inst.station.wallDeflPeak, 1e-6);
    wallDisplay.scale = scale;

    for (let k = 0; k <= nz; k++)
      for (let i = 0; i <= nx; i++) {
        const x = i * s.dx, z = k * s.dz;
        const yf = vertexFace(s, s.front, i, k);
        const yb = vertexFace(s, s.back, i, k);
        const w = wv[k * (nx + 1) + i];
        let c: [number, number, number];
        if (view.colorMode === 'displacement') c = sequential(Math.abs(w) / scale);
        else c = diverging((yb - yf - tNom) / devR);
        for (const face of [0, 1] as const) {
          const v = face * geo.V + k * (nx + 1) + i;
          const y = face === 0 ? yf : yb;
          P[3 * v] = x; P[3 * v + 1] = y + w * ex; P[3 * v + 2] = z;
          G[3 * v] = x; G[3 * v + 1] = y; G[3 * v + 2] = z;
          C[3 * v] = c[0]; C[3 * v + 1] = c[1]; C[3 * v + 2] = c[2];
        }
      }
    pos.needsUpdate = true; col.needsUpdate = true; gpos.needsUpdate = true;
    geo.g.computeVertexNormals();
    geo.g.computeBoundingSphere();
    geo.ghost.computeBoundingSphere();
  });

  if (!geo || !result) return null;
  const planes = view.section ? clip : [];
  return (
    <group>
      <mesh geometry={geo.g}>
        <meshStandardMaterial vertexColors metalness={0.15} roughness={0.55} side={THREE.DoubleSide} clippingPlanes={planes} />
      </mesh>
      {view.showGhost && view.exaggeration > 1 && (
        <mesh geometry={geo.ghost}>
          <meshBasicMaterial color="#e2e8f0" wireframe transparent opacity={0.12} clippingPlanes={planes} />
        </mesh>
      )}
      {/* base block: part of the blank, clamped in the vise */}
      <mesh position={[result.params.wallLength / 2, 0, -7.5]}>
        <boxGeometry args={[result.params.wallLength + 20, 30, 15]} />
        <meshStandardMaterial color="#b8c2cc" metalness={0.4} roughness={0.4} clippingPlanes={planes} />
      </mesh>
    </group>
  );
}
