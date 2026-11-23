/**
 * Module 7 scene: an aluminium part with a rectangular pocket and a thin floor on the machining
 * centre. The floor surface shows the remaining stock (progressive removal), bends with the
 * exaggerated FE deflection of the current station, and is coloured by the instantaneous
 * deflection or by the final thickness deviation. Undeformed reference grid, underside supports,
 * optional section cut at y = W/2.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { playback, useApp } from '../../state/store';
import { useThinFloor } from '../../state/thinFloorStore';
import { toolPose } from '../../state/pose';
import { cssColor, sequential } from '../../lib/colormap';
import { TABLE_TOP, ZCyl } from '../Machine';
import { Label } from '../LabScene';
import type { ForceView } from '../Forces';
import { sampleW } from '../../physics/plateFE';
import { cutterForce, TWO_PI } from '../../physics/millingForce';
import { endEdgeFz, toGlobal, type ThinFloorResult } from '../../physics/thinFloor';

const WALL = 12; // surrounding structure thickness, mm
const RISE = 15; // wall height above the floor top, mm
const UNDER = 15; // open depth under the floor, mm
export const floorLive = { station: 0, wTool: 0, wMax: 0 };

export function floorStation(r: ThinFloorResult, s = playback.station) {
  const n = r.stations.length;
  const i = Math.min(Math.max(Math.floor(s), 0), n - 1), j = Math.min(i + 1, n - 1), t = Math.min(Math.max(s - i, 0), 1);
  const a = r.stations[i], b = r.stations[j];
  return { i, st: a, x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
}

export function thinFloorForceView(): ForceView | null {
  const r = useThinFloor.getState().result;
  if (!r) return null;
  const p = r.params;
  const { st, x, y } = floorStation(r);
  const active = st.ae > 0 && !st.link && st.apEff > 0;
  let Fx = 0, Fy = 0, Fz = 0;
  if (active) {
    const F = cutterForce(playback.phi, { D: p.D, N: p.N, fz: st.fz, b: st.apEff, ae: st.ae, mode: st.mode, K: p.coeffs, helixDeg: p.helixDeg, dz: Math.max(st.apEff / 4, 0.02) }).F;
    [Fx, Fy] = toGlobal(F.Fx, F.Fy, st.theta);
    Fz = F.Fz + endEdgeFz(p, st.ae, st.mode, st.fz, playback.phi);
  }
  const zb = p.allowance - (st.layer + 1) * r.apLayer;
  return { F: { Fx, Fy, Fz }, teeth: [], contact: [x, y, zb + 0.5], tool: { x, y }, feedSign: 1, R: p.D / 2, patchWidth: 2, b: Math.max(st.apEff, 0.1), active };
}

/** Section and view helpers kept permanently mounted (Html labels must not unmount in React 19). */
export function ThinFloorLabels() {
  const module = useApp((s) => s.module);
  const showDims = useApp((s) => s.view.showDims);
  const r = useThinFloor((s) => s.result);
  const cursor = useApp((s) => s.cursor);
  const on = module === 7 && !!r;
  const p = r?.params;
  const fs = r ? floorStation(r, cursor.station) : null;
  const tag = 'rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] text-cyan-200 ring-1 ring-cyan-700 whitespace-nowrap tabular-nums';
  return (
    <>
      <Label position={p && fs ? [fs.x, fs.y, 8] : [0, 0, 0]} visible={on && showDims && !!fs && fs.st.apEff > 0}>
        <span className={tag}>w under cutter {fs ? (fs.st.wTool * 1000).toFixed(1) : ''} µm · max {fs ? (fs.st.wMax * 1000).toFixed(1) : ''} µm</span>
      </Label>
      <Label position={p ? [p.L / 2, -WALL - 10, RISE + 6] : [0, 0, 0]} visible={on && showDims}>
        <span className={tag}>pocket {p?.L} × {p?.W} mm · floor {p?.tFinal} mm ± {p ? (p.tol * 1000).toFixed(0) : ''} µm</span>
      </Label>
    </>
  );
}

export function ThinFloorScene() {
  const result = useThinFloor((s) => s.result);
  const display = useThinFloor((s) => s.display);
  const section = useThinFloor((s) => s.section);
  const ex = useApp((s) => s.view.exaggeration);
  const gl = useThree((s) => s.gl);
  const topRef = useRef<THREE.Mesh>(null);
  const botRef = useRef<THREE.Mesh>(null);
  const tool = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const last = useRef({ station: -1, ex: -1, display: '' });
  const p = result?.params;

  useEffect(() => { gl.localClippingEnabled = true; }, [gl]);
  // clipping planes are in world space: machine +Y is three −Z (scene rotated −90° about X); keep machine y ≥ W/2
  const clip = useMemo(() => (section && p ? [new THREE.Plane(new THREE.Vector3(0, 0, -1), -p.W / 2)] : []), [section, p]);

  // floor top / bottom grids (vertex per cell corner)
  const grids = useMemo(() => {
    if (!result) return null;
    const { nxC, nyC } = result;
    const mk = () => {
      const g = new THREE.BufferGeometry();
      const nv = (nxC + 1) * (nyC + 1);
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
      const idx: number[] = [];
      for (let i = 0; i < nxC; i++) for (let j = 0; j < nyC; j++) {
        const a = i * (nyC + 1) + j, b = (i + 1) * (nyC + 1) + j, c = b + 1, d = a + 1;
        idx.push(a, b, c, a, c, d);
      }
      g.setIndex(idx);
      return g;
    };
    return { top: mk(), bot: mk() };
  }, [result]);
  useEffect(() => () => { grids?.top.dispose(); grids?.bot.dispose(); }, [grids]);

  const flutes = useMemo(() => {
    if (!p) return null;
    const R = p.D / 2, len = Math.min(34, 3 * p.D), kb = (2 * Math.tan((p.helixDeg * Math.PI) / 180)) / p.D;
    class H extends THREE.Curve<THREE.Vector3> {
      constructor(private a0: number) { super(); }
      getPoint(t: number, o = new THREE.Vector3()) { const z = t * len; const a = this.a0 + kb * z; return o.set(R * 0.86 * Math.cos(a), R * 0.86 * Math.sin(a), z); }
    }
    return { len, R, geos: Array.from({ length: p.N }, (_, j) => new THREE.TubeGeometry(new H(-(j * TWO_PI) / p.N), 48, R * 0.16, 6, false)) };
  }, [p]);

  useFrame(() => {
    const r = result;
    if (!r || !grids) return;
    const pp = r.params;
    const fs = floorStation(r);
    const zb = pp.allowance - (fs.st.layer + 1) * r.apLayer;
    if (tool.current) tool.current.position.set(fs.x, fs.y, zb);
    if (spin.current) spin.current.rotation.z = -playback.phi;
    toolPose.x = fs.x; toolPose.y = fs.y; toolPose.zTip = zb; toolPose.overhang = 40;
    floorLive.station = fs.i; floorLive.wTool = fs.st.wTool; floorLive.wMax = fs.st.wMax;
    if (last.current.station === fs.i && last.current.ex === ex && last.current.display === display) return;
    last.current = { station: fs.i, ex, display };
    const { nxC, nyC, err, firstCut, layers, apLayer, mesh } = r;
    const w = fs.st.w;
    const wRef = Math.max(r.summary.maxDeflection, 1e-6);
    const tol = Math.max(pp.tol, 1e-6);
    const P = (grids.top.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
    const C = (grids.top.getAttribute('color') as THREE.BufferAttribute).array as Float32Array;
    const PB = (grids.bot.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
    const CB = (grids.bot.getAttribute('color') as THREE.BufferAttribute).array as Float32Array;
    const cellTop = (i: number, j: number) => {
      const idx = i * nyC + j;
      let top = pp.allowance;
      for (let L = 0; L < layers; L++) {
        const fc = firstCut[L][idx];
        if (fc >= 0 && fc <= fs.i) top = L === layers - 1 ? (Number.isFinite(err[idx]) ? err[idx] : 0) : pp.allowance - (L + 1) * apLayer;
      }
      return top;
    };
    const cellDone = (i: number, j: number) => { const fc = firstCut[layers - 1][i * nyC + j]; return fc >= 0 && fc <= fs.i; };
    const grey = [0.62, 0.66, 0.7];
    for (let i = 0; i <= nxC; i++) for (let j = 0; j <= nyC; j++) {
      const x = (i / nxC) * pp.L, y = (j / nyC) * pp.W;
      // vertex height = mean of adjacent cells
      let s = 0, n = 0, done = 0, e = 0, ne = 0;
      for (const [di, dj] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
        const ci = i + di, cj = j + dj;
        if (ci < 0 || cj < 0 || ci >= nxC || cj >= nyC) continue;
        s += cellTop(ci, cj); n++;
        if (cellDone(ci, cj)) { done++; const v = err[ci * nyC + cj]; if (Number.isFinite(v)) { e += v; ne++; } }
      }
      const top = n ? s / n : 0;
      const wv = sampleW(mesh, w, x, y); // down +
      const v = i * (nyC + 1) + j;
      P[3 * v] = x; P[3 * v + 1] = y; P[3 * v + 2] = top - ex * wv;
      PB[3 * v] = x; PB[3 * v + 1] = y; PB[3 * v + 2] = -pp.tFinal - ex * wv;
      let col: number[];
      if (display === 'deflection') col = sequential(Math.min(Math.abs(wv) / wRef, 1));
      else col = done && ne ? sequential(Math.min(Math.abs(e / ne) / tol, 1)) : grey;
      C[3 * v] = col[0]; C[3 * v + 1] = col[1]; C[3 * v + 2] = col[2];
      CB[3 * v] = 0.45; CB[3 * v + 1] = 0.5; CB[3 * v + 2] = 0.56;
    }
    for (const g of [grids.top, grids.bot]) {
      g.getAttribute('position').needsUpdate = true;
      g.getAttribute('color').needsUpdate = true;
      g.computeVertexNormals();
      g.computeBoundingSphere();
    }
  });

  if (!result || !p || !grids || !flutes) return null;
  const { L, W, tFinal } = p;
  const zBot = -tFinal - UNDER;
  const alu = { color: '#c3cad3', metalness: 0.45, roughness: 0.4, clippingPlanes: clip, side: THREE.DoubleSide };
  const wallH = RISE - zBot;
  const holderM = { color: '#5b6573', metalness: 0.8, roughness: 0.3 };
  const pins = p.under === 'centre' ? [[L / 2, W / 2]] : p.under === 'pins4' ? [[L / 3, W / 3], [2 * L / 3, W / 3], [L / 3, 2 * W / 3], [2 * L / 3, 2 * W / 3]] : [];
  const refGrid: [number, number, number][][] = [];
  for (let k = 0; k <= 4; k++) { refGrid.push([[0, (k / 4) * W, 0], [L, (k / 4) * W, 0]]); refGrid.push([[(k / 4) * L, 0, 0], [(k / 4) * L, W, 0]]); }
  return (
    <group>
      {/* parallels on the table under the surrounding structure */}
      {[-WALL / 2, W + WALL / 2].map((y) => <mesh key={y} position={[L / 2, y, (TABLE_TOP + zBot) / 2]}><boxGeometry args={[L + 2 * WALL + 30, WALL, zBot - TABLE_TOP]} /><meshStandardMaterial color="#334155" metalness={0.6} roughness={0.45} clippingPlanes={clip} /></mesh>)}
      {/* surrounding structure (4 walls) */}
      <mesh position={[L / 2, -WALL / 2, zBot + wallH / 2]}><boxGeometry args={[L + 2 * WALL, WALL, wallH]} /><meshStandardMaterial {...alu} /></mesh>
      <mesh position={[L / 2, W + WALL / 2, zBot + wallH / 2]}><boxGeometry args={[L + 2 * WALL, WALL, wallH]} /><meshStandardMaterial {...alu} /></mesh>
      <mesh position={[-WALL / 2, W / 2, zBot + wallH / 2]}><boxGeometry args={[WALL, W, wallH]} /><meshStandardMaterial {...alu} /></mesh>
      <mesh position={[L + WALL / 2, W / 2, zBot + wallH / 2]}><boxGeometry args={[WALL, W, wallH]} /><meshStandardMaterial {...alu} /></mesh>
      {/* floor: top (stock / machined surface, deformed) and bottom */}
      <mesh ref={topRef} geometry={grids.top}><meshStandardMaterial vertexColors metalness={0.25} roughness={0.5} side={THREE.DoubleSide} clippingPlanes={clip} /></mesh>
      <mesh ref={botRef} geometry={grids.bot}><meshStandardMaterial vertexColors metalness={0.25} roughness={0.6} side={THREE.DoubleSide} clippingPlanes={clip} /></mesh>
      {/* undeformed reference: nominal final floor top */}
      {refGrid.map((pts, k) => <Line key={k} points={pts} color="#22d3ee" lineWidth={1} dashed dashSize={2} gapSize={1.5} transparent opacity={0.6} />)}
      {/* underside supports */}
      {pins.map(([x, y], k) => <ZCyl key={k} p={[x, y, (zBot - tFinal) / 2]} r={3} h={-tFinal - zBot} m={{ color: '#f59e0b', metalness: 0.6, roughness: 0.35 }} />)}
      {p.under === 'bed' && <mesh position={[L / 2, W / 2, (zBot - tFinal) / 2 - 0.2]}><boxGeometry args={[L - 1, W - 1, -tFinal - zBot - 0.4]} /><meshStandardMaterial color="#a16207" transparent opacity={0.55} clippingPlanes={clip} /></mesh>}
      {/* tool */}
      <group ref={tool}>
        <group ref={spin}>
          <ZCyl p={[0, 0, flutes.len / 2]} r={flutes.R * 0.72} h={flutes.len} m={{ color: '#8c96a3', metalness: 0.9, roughness: 0.25 }} />
          {flutes.geos.map((g, j) => <mesh key={j} geometry={g}><meshStandardMaterial color={j === 0 ? '#f59e0b' : '#a7b1bd'} metalness={0.9} roughness={0.25} /></mesh>)}
          <ZCyl p={[0, 0, (flutes.len + 40) / 2]} r={flutes.R * 0.98} h={40 - flutes.len} m={{ color: '#8c96a3', metalness: 0.9, roughness: 0.25 }} />
          <ZCyl p={[0, 0, 40 + 12]} r={flutes.R + 3} r2={flutes.R + 12} h={24} m={holderM} />
          <ZCyl p={[0, 0, 40 + 34]} r={flutes.R + 12} h={20} m={holderM} />
          <ZCyl p={[0, 0, 40 + 52]} r={31} h={16} m={{ color: '#334155', metalness: 0.6, roughness: 0.4 }} />
          <ZCyl p={[0, 0, 40 + 65]} r={20} r2={14} h={10} m={holderM} />
        </group>
      </group>
    </group>
  );
}

/** Colour bar for the floor display (HTML, used in the results panel). */
export function floorStops() {
  return Array.from({ length: 11 }, (_, i) => cssColor(sequential(i / 10))).join(',');
}
