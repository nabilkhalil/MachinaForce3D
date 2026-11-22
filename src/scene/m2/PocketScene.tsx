/**
 * Module 2 scene: deep pocket in a rigid block, wall surface from the stock model, and a
 * segmented end mill whose segments are displaced by the computed bending deflection.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { Label } from '../LabScene';
import * as THREE from 'three';
import { playback, useApp } from '../../state/store';
import { usePocket } from '../../state/pocketStore';
import { toolPose } from '../../state/pose';
import { pocketInstant } from '../../sim/pocketInstant';
import { sampleBeam, toolSections } from '../../physics/toolBeam';
import { toolSpecOf, type PocketResult } from '../../physics/pocketProcess';
import { cloneStock, type StockGrid } from '../../physics/stock';
import { buildIndex, vertexFace } from '../WallMesh';
import { diverging } from '../../lib/colormap';
import { ZCyl, TABLE_TOP } from '../Machine';
import type { ForceView } from '../Forces';

/** Live values for the panels (written each frame). */
export const pocketLive = { tipDefl: 0, holderDefl: 0, devRange: 0.05 };

export function pocketForceView(): ForceView | null {
  const r = usePocket.getState().result;
  if (!r) return null;
  const s = pocketInstant(r, playback.station, playback.phi);
  return { F: s.F, teeth: s.teeth, contact: s.contact, tool: s.tool, feedSign: s.pass.feedSign, R: r.params.D / 2, patchWidth: 1.5, b: s.station.b, active: s.station.ae > 0 };
}

const BACK_Y = 2; // the wall-face mesh closes onto the block at Y = 2 mm

export function PocketWall() {
  const result = usePocket((s) => s.result);
  const view = useApp((s) => s.view);
  const st = useRef<{ stock: StockGrid | null; applied: number }>({ stock: null, applied: -1 });
  const clip = useMemo(() => [new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0)], []);

  const geo = useMemo(() => {
    if (!result) return null;
    const s = result.stock0;
    const V = (s.nxC + 1) * (s.nzC + 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * V * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(2 * V * 3), 3));
    g.setIndex(buildIndex(s.nxC, s.nzC));
    st.current = { stock: cloneStock(result.stock0), applied: -1 };
    return { g, V };
  }, [result]);

  useFrame(() => {
    if (!result || !geo || !st.current.stock) return;
    const s = st.current.stock;
    clip[0].constant = result.params.wallLength / 2;
    const target = Math.floor(Math.min(Math.max(playback.station, 0), result.stations.length - 1));
    if (target < st.current.applied) { s.front.set(result.stock0.front); st.current.applied = -1; }
    for (let q = st.current.applied + 1; q <= target; q++) {
      const e = result.stations[q].edit;
      for (let j = 0; j < e.idx.length; j++) s.front[e.idx[j]] = e.val[j];
    }
    st.current.applied = target;
    const P = (geo.g.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
    const C = (geo.g.getAttribute('color') as THREE.BufferAttribute).array as Float32Array;
    const devR = Math.max(result.params.tolerance * 2, 0.01);
    pocketLive.devRange = devR;
    const ex = view.exaggeration;
    const nx = s.nxC, nz = s.nzC;
    for (let k = 0; k <= nz; k++)
      for (let i = 0; i <= nx; i++) {
        const yf = vertexFace(s, s.front, i, k);
        const c = diverging(-yf / devR);
        for (const face of [0, 1] as const) {
          const v = face * geo.V + k * (nx + 1) + i;
          P[3 * v] = i * s.dx; P[3 * v + 1] = face === 0 ? yf * ex : BACK_Y; P[3 * v + 2] = k * s.dz;
          C[3 * v] = c[0]; C[3 * v + 1] = c[1]; C[3 * v + 2] = c[2];
        }
      }
    geo.g.getAttribute('position').needsUpdate = true;
    geo.g.getAttribute('color').needsUpdate = true;
    geo.g.computeVertexNormals();
    geo.g.computeBoundingSphere();
  });

  if (!result || !geo) return null;
  const p = result.params;
  const L = p.wallLength, H = p.pocketDepth;
  const planes = view.section ? clip : [];
  const steel = { color: '#a9b3bd', metalness: 0.55, roughness: 0.38, clippingPlanes: planes };
  return (
    <group>
      <mesh geometry={geo.g}>
        <meshStandardMaterial vertexColors metalness={0.2} roughness={0.5} side={THREE.DoubleSide} clippingPlanes={planes} />
      </mesh>
      {/* block behind the wall, pocket floor, far pocket wall (translucent so the wall stays visible) */}
      <mesh position={[L / 2, (BACK_Y + 45) / 2, (H - 20) / 2]}><boxGeometry args={[L + 30, 45 - BACK_Y, H + 20]} /><meshStandardMaterial {...steel} /></mesh>
      <mesh position={[L / 2, (-45 + BACK_Y) / 2, -10]}><boxGeometry args={[L + 30, 45 + BACK_Y, 20]} /><meshStandardMaterial {...steel} /></mesh>
      <mesh position={[L / 2, -40, H / 2]}><boxGeometry args={[L + 30, 10, H]} /><meshStandardMaterial {...steel} transparent opacity={0.18} depthWrite={false} /></mesh>
      {/* parallels and table support */}
      {[-30, 30].map((y) => (
        <mesh key={y} position={[L / 2, y, (TABLE_TOP - 20) / 2]}><boxGeometry args={[L + 10, 10, -TABLE_TOP - 20]} /><meshStandardMaterial color="#2b3440" metalness={0.5} roughness={0.5} /></mesh>
      ))}
      {[-8, L + 8].map((x) => (
        <mesh key={x} position={[x, 30, H + 4]}><boxGeometry args={[14, 40, 8]} /><meshStandardMaterial color="#0e7490" metalness={0.3} roughness={0.5} /></mesh>
      ))}
    </group>
  );
}

class HelixPiece extends THREE.Curve<THREE.Vector3> {
  constructor(private r: number, private z0: number, private z1: number, private a0: number, private kb: number) { super(); }
  getPoint(t: number, out = new THREE.Vector3()) {
    const z = this.z0 + t * (this.z1 - this.z0);
    const a = this.a0 + this.kb * z;
    return out.set(this.r * Math.cos(a), this.r * Math.sin(a), z);
  }
}

const SEGMENTS = 30;
const carbide = { color: '#8c96a3', metalness: 0.9, roughness: 0.25 };
const holderM = { color: '#5b6573', metalness: 0.8, roughness: 0.3 };

/** End mill built from short spinning segments, each offset by the computed deflection δ(s). */
export function BentTool() {
  const result = usePocket((s) => s.result);
  const params = usePocket((s) => s.params);
  const exaggeration = useApp((s) => s.view.exaggeration);
  const exploded = useApp((s) => s.view.exploded);
  const root = useRef<THREE.Group>(null);
  const holder = useRef<THREE.Group>(null);
  const segRefs = useRef<(THREE.Group | null)[]>([]);
  const spinRefs = useRef<(THREE.Group | null)[]>([]);
  const ex = useRef(0);
  const D = params.D, R = D / 2, N = params.N, L = params.overhang;
  const kb = (2 * Math.tan((params.helixDeg * Math.PI) / 180)) / D;

  const segs = useMemo(() => {
    const secs = toolSections(toolSpecOf(params));
    const pitch = (2 * Math.PI) / N;
    return Array.from({ length: SEGMENTS }, (_, k) => {
      // tool-local z from the tip: segment k spans [z0, z1]
      const z0 = (k / SEGMENTS) * L, z1 = ((k + 1) / SEGMENTS) * L;
      const sMid = L - 0.5 * (z0 + z1);
      const sec = secs.find((q) => sMid >= q.s0 - 1e-9 && sMid <= q.s1 + 1e-9) ?? secs[secs.length - 1];
      const tubes = sec.name === 'flutes'
        ? Array.from({ length: N }, (_, j) => new THREE.TubeGeometry(new HelixPiece(R * 0.86, z0, z1, -j * pitch, kb), 6, R * 0.16, 6, false))
        : [];
      const r = sec.name === 'flutes' ? R * 0.72 : sec.name === 'neck' ? params.neckDiameter / 2 : R * 0.98;
      return { z0, z1, sMid, r, tubes, name: sec.name };
    });
  }, [params, N, R, L, kb]);

  useFrame((_, dt) => {
    ex.current += ((exploded ? 1 : 0) - ex.current) * Math.min(1, dt * 4);
    const r: PocketResult | null = result;
    if (!r || !root.current) return;
    const s = pocketInstant(r, playback.station, playback.phi);
    root.current.position.set(s.tool.x, s.tool.y, s.tool.zTip + ex.current * 60);
    toolPose.x = s.tool.x; toolPose.y = s.tool.y; toolPose.zTip = s.tool.zTip; toolPose.overhang = r.params.overhang;
    const fx = s.F.Fx, fy = s.F.Fy;
    const ud = s.pass.unitDelta;
    const base = s.pass.feedSign === 1 ? Math.PI / 2 : -Math.PI / 2;
    segs.forEach((sg, k) => {
      const d = sampleBeam(r.grid, ud, sg.sMid);
      const g = segRefs.current[k];
      if (g) g.position.set(d * fx * exaggeration, d * fy * exaggeration, 0);
      const sp = spinRefs.current[k];
      if (sp) sp.rotation.z = base - playback.phi;
    });
    const d0 = ud[0];
    if (holder.current) holder.current.position.set(d0 * fx * exaggeration, d0 * fy * exaggeration, 0);
    pocketLive.tipDefl = ud[ud.length - 1] * Math.hypot(fx, fy);
    pocketLive.holderDefl = d0 * Math.hypot(fx, fy);
  });

  return (
    <group ref={root}>
      {segs.map((sg, k) => (
        <group key={k} ref={(el) => { segRefs.current[k] = el; }}>
          <group ref={(el) => { spinRefs.current[k] = el; }}>
            <ZCyl p={[0, 0, (sg.z0 + sg.z1) / 2]} r={sg.r} h={sg.z1 - sg.z0 + 0.05} m={sg.name === 'neck' ? { ...carbide, color: '#7c8794' } : carbide} seg={20} />
            {sg.tubes.map((t, j) => (
              <mesh key={j} geometry={t}><meshStandardMaterial {...carbide} color={j === 0 ? '#f59e0b' : '#a7b1bd'} /></mesh>
            ))}
          </group>
        </group>
      ))}
      <group ref={holder}>
        <ZCyl p={[0, 0, L + 12]} r={R + 3} r2={R + 12} h={24} m={holderM} />
        <ZCyl p={[0, 0, L + 34]} r={R + 12} h={20} m={holderM} />
        <ZCyl p={[0, 0, L + 52]} r={31} h={16} m={{ color: '#334155', metalness: 0.6, roughness: 0.4 }} />
        <ZCyl p={[0, 0, L + 65]} r={20} r2={14} h={10} m={holderM} />
      </group>
    </group>
  );
}

export function PocketDims() {
  const p = usePocket((s) => s.params);
  const show = useApp((s) => s.view.showDims && s.module === 2);
  const L = p.wallLength, H = p.pocketDepth;
  const tag = 'rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] text-cyan-200 ring-1 ring-cyan-700 whitespace-nowrap';
  return (
    <group>
      {show && (
        <>
          <Line points={[[0, -46, H + 1], [L, -46, H + 1]]} color="#67e8f9" lineWidth={1} />
          <Line points={[[L + 18, 0, 0], [L + 18, 0, H]]} color="#67e8f9" lineWidth={1} />
        </>
      )}
      <Label position={[L / 2, -46, H + 5]} visible={show}><span className={tag}>wall length {L} mm</span></Label>
      <Label position={[L + 22, 0, H / 2]} visible={show}><span className={tag}>pocket depth {H} mm</span></Label>
      <Label position={[L / 2, -2, -4]} visible={show}><span className={tag}>wall Y = 0 ± {p.tolerance.toFixed(3)} mm</span></Label>
    </group>
  );
}
