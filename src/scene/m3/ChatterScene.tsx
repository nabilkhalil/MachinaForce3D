/**
 * Module 3 scene: side milling of a block. The tool position, rotation and vibration come
 * from the time-domain simulation; the machined face is coloured by the vibration amplitude
 * recorded when the tool passed (chatter marks).
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { playback, useApp } from '../../state/store';
import { useChatter } from '../../state/chatterStore';
import { toolPose } from '../../state/pose';
import { sequential } from '../../lib/colormap';
import { ZCyl } from '../Machine';
import { Label } from '../LabScene';
import type { ForceView } from '../Forces';
import type { ChatterResult } from '../../physics/chatter';

const L = 80; // block length (X), mm
const Y0 = -15; // uncut block face (material at Y ≥ Y0)
const TOP = 20; // block top (Z)
const BINS = 160;

export const chatterLive = { vibScale: 0.01, frame: 0 };

/** Feed direction: material on +Y ⇒ up-milling feeds +X, down-milling −X. */
const feedSignOf = (r: ChatterResult): 1 | -1 => (r.params.mode === 'up' ? 1 : -1);

export function chatterFrame(r: ChatterResult, station: number) {
  const n = r.sim.x.length;
  const i = Math.min(Math.max(Math.floor(station), 0), n - 1);
  const fs = feedSignOf(r);
  const u = i / Math.max(n - 1, 1);
  const x = fs === 1 ? 5 + u * (L - 10) : L - 5 - u * (L - 10);
  const R = r.params.D / 2;
  const yc = Y0 + r.params.ae - R;
  return { i, fs, x, yc, zTip: TOP - r.params.ap, R };
}

export function chatterForceView(): ForceView | null {
  const r = useChatter.getState().result;
  if (!r || !r.sim.x.length) return null;
  const f = chatterFrame(r, playback.station);
  const Fx = f.fs * r.sim.Fx[f.i], Fy = f.fs * r.sim.Fy[f.i];
  return {
    F: { Fx, Fy, Fz: 0 }, teeth: [], contact: [f.x, f.yc + f.R * 0.9, f.zTip + r.params.ap / 2],
    tool: { x: f.x, y: f.yc }, feedSign: f.fs, R: f.R, patchWidth: 2, b: r.params.ap, active: true,
  };
}

export function ChatterScene() {
  const result = useChatter((s) => s.result);
  const params = useChatter((s) => s.params);
  const ex = useApp((s) => s.view.exaggeration);
  const showDims = useApp((s) => s.view.showDims && s.module === 3);
  const tool = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const ahead = useRef<THREE.Mesh>(null);
  const D = params.D, R = D / 2, N = params.N, ap = params.ap, ae = params.ae;
  const overhang = 50;

  const flutes = useMemo(() => {
    const pitch = (2 * Math.PI) / N;
    const kb = (2 * Math.tan((30 * Math.PI) / 180)) / D;
    const len = Math.min(overhang - 6, 3 * D);
    class H extends THREE.Curve<THREE.Vector3> {
      constructor(private a0: number) { super(); }
      getPoint(t: number, o = new THREE.Vector3()) { const z = t * len; const a = this.a0 + kb * z; return o.set(R * 0.86 * Math.cos(a), R * 0.86 * Math.sin(a), z); }
    }
    return { len, geos: Array.from({ length: N }, (_, j) => new THREE.TubeGeometry(new H(-j * pitch), 48, R * 0.16, 6, false)) };
  }, [N, R, D]);

  // machined-face strip: vertices along X (top and bottom edge), coloured by vibration
  const face = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array((BINS + 1) * 2 * 3), col = new Float32Array((BINS + 1) * 2 * 3);
    const idx: number[] = [];
    for (let b = 0; b < BINS; b++) { const a = 2 * b, c = 2 * b + 1, d = 2 * b + 2, e = 2 * b + 3; idx.push(a, d, c, c, d, e); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    return g;
  }, []);

  // per-bin vibration amplitude (deviation of y from its mean over the bin's frames)
  const binAmp = useMemo(() => {
    if (!result || !result.sim.y.length) return null;
    const y = result.sim.y, n = y.length;
    let mean = 0; for (let i = 0; i < n; i++) mean += y[i]; mean /= n;
    const amp = new Float32Array(BINS);
    let mx = 1e-9;
    for (let b = 0; b < BINS; b++) {
      const i0 = Math.floor((b / BINS) * n), i1 = Math.max(i0 + 1, Math.floor(((b + 1) / BINS) * n));
      let m = 0; for (let i = i0; i < i1; i++) m = Math.max(m, Math.abs(y[i] - mean));
      amp[b] = m; mx = Math.max(mx, m);
    }
    // colour scale: 50 µm saturates (typical visible chatter marks); stable cuts stay cool
    return { amp, scale: Math.max(0.05, 0), mx };
  }, [result]);

  useFrame(() => {
    const r = result;
    if (!r || !r.sim.x.length || !tool.current || !spin.current) return;
    const f = chatterFrame(r, playback.station);
    chatterLive.frame = f.i;
    playback.phi = r.sim.phi[f.i];
    // vibration (feed frame → machine) exaggerated
    const vx = f.fs * r.sim.x[f.i], vy = f.fs * r.sim.y[f.i];
    tool.current.position.set(f.x + vx * ex, f.yc + vy * ex, f.zTip);
    toolPose.x = f.x; toolPose.y = f.yc; toolPose.zTip = f.zTip; toolPose.overhang = overhang;
    spin.current.rotation.z = (f.fs === 1 ? Math.PI / 2 : -Math.PI / 2) - r.sim.phi[f.i];
    // uncut material ahead of the tool
    if (ahead.current) {
      const x0 = f.fs === 1 ? f.x : 0, x1 = f.fs === 1 ? L : f.x;
      const w = Math.max(x1 - x0, 0.01);
      ahead.current.position.set((x0 + x1) / 2, Y0 + ae / 2, TOP - ap / 2);
      ahead.current.scale.set(w, ae, ap);
    }
    // machined face behind the tool
    if (binAmp) {
      const P = (face.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
      const C = (face.getAttribute('color') as THREE.BufferAttribute).array as Float32Array;
      const n = r.sim.y.length;
      const progress = f.i / Math.max(n - 1, 1);
      for (let b = 0; b <= BINS; b++) {
        const u = b / BINS; // along the cut direction
        const x = f.fs === 1 ? 5 + u * (L - 10) : L - 5 - u * (L - 10);
        const cut = u <= progress;
        const a = cut ? binAmp.amp[Math.min(b, BINS - 1)] : 0;
        const c = cut ? sequential(Math.min(a / binAmp.scale, 1)) : [0.55, 0.6, 0.66];
        const yFace = Y0 + ae + (cut ? 0 : -0.01);
        for (const k of [0, 1]) {
          const v = 2 * b + k;
          P[3 * v] = x; P[3 * v + 1] = yFace - 0.02; P[3 * v + 2] = k === 0 ? TOP - ap : TOP;
          C[3 * v] = c[0]; C[3 * v + 1] = c[1]; C[3 * v + 2] = c[2];
        }
      }
      face.getAttribute('position').needsUpdate = true;
      face.getAttribute('color').needsUpdate = true;
      face.computeBoundingSphere();
      chatterLive.vibScale = binAmp.scale;
    }
  });

  if (!result) return null;
  const steel = { color: '#b8c2cc', metalness: 0.45, roughness: 0.4 };
  const holderM = { color: '#5b6573', metalness: 0.8, roughness: 0.3 };
  const tag = 'rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] text-cyan-200 ring-1 ring-cyan-700 whitespace-nowrap';
  return (
    <group>
      {/* block below the cut, and the remaining wall beside the cut */}
      <mesh position={[L / 2, 0, (-15 + TOP - ap) / 2]}><boxGeometry args={[L, 30, TOP - ap + 15]} /><meshStandardMaterial {...steel} /></mesh>
      <mesh position={[L / 2, (Y0 + ae + 15) / 2, TOP - ap / 2]}><boxGeometry args={[L, 15 - (Y0 + ae), ap]} /><meshStandardMaterial {...steel} /></mesh>
      <mesh ref={ahead}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial {...steel} color="#9aa5b1" /></mesh>
      <mesh geometry={face}><meshStandardMaterial vertexColors side={THREE.DoubleSide} metalness={0.2} roughness={0.5} /></mesh>
      {/* tool */}
      <group ref={tool}>
        <group ref={spin}>
          <ZCyl p={[0, 0, flutes.len / 2]} r={R * 0.72} h={flutes.len} m={{ color: '#8c96a3', metalness: 0.9, roughness: 0.25 }} />
          {flutes.geos.map((g, j) => <mesh key={j} geometry={g}><meshStandardMaterial color={j === 0 ? '#f59e0b' : '#a7b1bd'} metalness={0.9} roughness={0.25} /></mesh>)}
          <ZCyl p={[0, 0, (flutes.len + overhang) / 2]} r={R * 0.98} h={overhang - flutes.len} m={{ color: '#8c96a3', metalness: 0.9, roughness: 0.25 }} />
          <ZCyl p={[0, 0, overhang + 12]} r={R + 3} r2={R + 12} h={24} m={holderM} />
          <ZCyl p={[0, 0, overhang + 34]} r={R + 12} h={20} m={holderM} />
          <ZCyl p={[0, 0, overhang + 52]} r={31} h={16} m={{ color: '#334155', metalness: 0.6, roughness: 0.4 }} />
          <ZCyl p={[0, 0, overhang + 65]} r={20} r2={14} h={10} m={holderM} />
        </group>
      </group>
      {showDims && <Line points={[[0, Y0 - 6, TOP], [L, Y0 - 6, TOP]]} color="#67e8f9" lineWidth={1} />}
      <Label position={[L / 2, Y0 - 8, TOP + 4]} visible={showDims}><span className={tag}>side milling · ae = {ae} mm · ap = {ap} mm</span></Label>
      <Label position={[L + 6, Y0 + ae, TOP - ap / 2]} visible={showDims}><span className={tag}>machined face: colour = vibration (chatter marks)</span></Label>
    </group>
  );
}
