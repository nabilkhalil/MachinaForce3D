/**
 * Module 4 scene: generic two-axis CNC lathe in the LATHE frame (Z = spindle axis from the chuck
 * face, X radial toward the tool, Y up). The parent group maps lathe → three.js coordinates.
 * The shaft surface is rebuilt from the simulated diameter profile; its centre line is offset by
 * the computed deflection under the current passive force (exaggerated, labelled).
 * Always mounted (hidden outside Module 4) so its Html labels are never unmounted.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { playback, useApp } from '../../state/store';
import { useTurning } from '../../state/turningStore';
import type { TurnResult } from '../../physics/turning';
import { diverging } from '../../lib/colormap';
import { Forces, type ForceView } from '../Forces';
import { AxisTriad, Label } from '../LabScene';

const SEG = 36;
export const latheLive = { shaftDefl: 0, devRange: 0.04 };

/** Cylinder along lathe Z (three's cylinder is along local Y). */
function ZC({ p, r, r2, h, m, seg = 32 }: { p: [number, number, number]; r: number; r2?: number; h: number; m: object; seg?: number }) {
  return (
    <mesh position={p} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[r2 ?? r, r, h, seg]} />
      <meshStandardMaterial {...m} />
    </mesh>
  );
}
function Box({ p, s, m }: { p: [number, number, number]; s: [number, number, number]; m: object }) {
  return <mesh position={p}><boxGeometry args={s} /><meshStandardMaterial {...m} /></mesh>;
}

function toolState(r: TurnResult, station: number) {
  const n = r.stations.length;
  const sf = Math.min(Math.max(station, 0), n - 1);
  const i = Math.floor(sf);
  const st = r.stations[i];
  let z = st.z;
  if (i + 1 < n && r.stations[i + 1].pass === st.pass) z += (r.stations[i + 1].z - st.z) * (sf - i);
  const pass = r.passes[st.pass];
  return { i, st, pass, z, rTip: pass.target / 2 + st.e };
}

export function turnForceView(): ForceView | null {
  const r = useTurning.getState().result;
  if (!r) return null;
  const t = toolState(r, playback.station);
  const towardChuck = r.params.feedDir === 'toward-chuck';
  // forces ON THE TOOL in the lathe frame: Fc → −Y, Ff opposes the feed motion, Fp → +X
  return {
    F: { Fx: t.st.Fp, Fy: -t.st.Fc, Fz: towardChuck ? t.st.Ff : -t.st.Ff },
    teeth: [], contact: [t.rTip, 0, t.z], tool: { x: t.rTip, y: 0 }, feedSign: 1, R: 0, patchWidth: 1, b: 1, active: t.st.ap > 0,
  };
}

export function LatheScene() {
  const module = useApp((s) => s.module);
  const view = useApp((s) => s.view);
  const result = useTurning((s) => s.result);
  const params = useTurning((s) => s.params);
  const active = module === 4;
  const chuck = useRef<THREE.Group>(null);
  const carriage = useRef<THREE.Group>(null);
  const tip = useRef<THREE.Group>(null);
  const st = useRef<{ dia: Float32Array | null; applied: number; key: TurnResult | null }>({ dia: null, applied: -1, key: null });
  const L = params.L;

  const geo = useMemo(() => {
    if (!result) return null;
    const nZ = result.dia0.length;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nZ * SEG * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nZ * SEG * 3), 3));
    const idx: number[] = [];
    for (let k = 0; k < nZ - 1; k++) for (let j = 0; j < SEG; j++) {
      const a = k * SEG + j, b = k * SEG + ((j + 1) % SEG), c = (k + 1) * SEG + j, d = (k + 1) * SEG + ((j + 1) % SEG);
      idx.push(a, c, b, b, c, d);
    }
    g.setIndex(idx);
    st.current = { dia: new Float32Array(result.dia0), applied: -1, key: result };
    return g;
  }, [result]);

  useFrame((_, dt) => {
    if (!active || !result || !geo || !st.current.dia) return;
    const r = result;
    const dia = st.current.dia;
    const target = Math.floor(Math.min(Math.max(playback.station, 0), r.stations.length - 1));
    if (target < st.current.applied) { dia.set(r.dia0); st.current.applied = -1; }
    for (let q = st.current.applied + 1; q <= target; q++) { const e = r.stations[q].edits; for (let j = 0; j < e.idx.length; j++) dia[e.idx[j]] = e.val[j]; }
    st.current.applied = target;
    const t = toolState(r, playback.station);
    const ex = view.exaggeration;
    const Fp = t.st.Fp;
    const nodes = r.nodes, us = t.st.unitShape;
    const wAt = (z: number) => {
      const nEl = nodes.length - 1, l = L / nEl;
      const e = Math.min(Math.floor(Math.max(z, 0) / l), nEl - 1), u = (Math.max(z, 0) - e * l) / l;
      return (us[e] * (1 - u) + us[e + 1] * u) * Fp; // away from the tool (−X)
    };
    latheLive.shaftDefl = wAt(t.z);
    const devR = Math.max(r.params.tolerance * 2, 0.01);
    latheLive.devRange = devR;
    const P = (geo.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
    const C = (geo.getAttribute('color') as THREE.BufferAttribute).array as Float32Array;
    const spin = playback.phi;
    for (let k = 0; k < dia.length; k++) {
      const z = k * r.dz;
      const rad = dia[k] / 2;
      const cx = -wAt(z) * ex;
      const turned = dia[k] < r.params.d0 - 1e-6;
      const base = turned ? diverging((dia[k] - r.params.dT) / devR) : ([0.62, 0.66, 0.72] as [number, number, number]);
      for (let j = 0; j < SEG; j++) {
        const th = (j / SEG) * Math.PI * 2;
        const v = k * SEG + j;
        P[3 * v] = cx + rad * Math.cos(th); P[3 * v + 1] = rad * Math.sin(th); P[3 * v + 2] = z;
        // a dark stripe that rotates with the spindle shows the rotation
        const ang = ((th - spin) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        const shade = ang < 0.18 ? 0.55 : 1;
        C[3 * v] = base[0] * shade; C[3 * v + 1] = base[1] * shade; C[3 * v + 2] = base[2] * shade;
      }
    }
    geo.getAttribute('position').needsUpdate = true;
    geo.getAttribute('color').needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    if (chuck.current) chuck.current.rotation.z = -spin;
    if (carriage.current) carriage.current.position.set(0, 0, t.z);
    if (tip.current) tip.current.position.set(t.rTip + (t.st.toolDefl * ex), 0, 0);
    void dt;
  });

  const steel = { color: '#c9d1d9', metalness: 0.35, roughness: 0.45 };
  const dark = { color: '#2b3440', metalness: 0.5, roughness: 0.5 };
  const accent = { color: '#0e7490', metalness: 0.3, roughness: 0.5 };
  const metal = { color: '#9aa4ae', metalness: 0.85, roughness: 0.28 };
  const d0 = params.d0;
  const tag = 'rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] text-cyan-200 ring-1 ring-cyan-700 whitespace-nowrap';
  const showDims = active && view.showDims;
  const tail = params.workholding !== 'chuck';
  const centres = params.workholding === 'centres';
  const machine = view.showMachine;
  return (
    <group visible={active}>
      {/* machine structure */}
      {machine && (
        <group>
          <Box p={[60, -190, L / 2]} s={[360, 120, L + 700]} m={steel} />
          <Box p={[0, 20, -180]} s={[300, 300, 220]} m={steel} />
          <Box p={[0, 20, -60]} s={[300, 300, 8]} m={accent} />
        </group>
      )}
      {/* chuck (rotating) */}
      <group ref={chuck}>
        <ZC p={[0, 0, -50]} r={85} h={40} m={dark} />
        {centres ? (
          <>
            <ZC p={[0, 0, -12]} r={0.01} r2={12} h={24} m={metal} />
            <Box p={[0, d0 / 2 + 14, 12]} s={[18, 28, 14]} m={accent} />
          </>
        ) : (
          [0, 1, 2].map((j) => {
            const a = (j * 2 * Math.PI) / 3;
            const rr = d0 / 2 + 16;
            return (
              <mesh key={j} position={[rr * Math.cos(a), rr * Math.sin(a), -15]} rotation={[0, 0, a]}>
                <boxGeometry args={[32, 18, 30]} />
                <meshStandardMaterial {...metal} />
              </mesh>
            );
          })
        )}
      </group>
      {/* shaft */}
      {geo && <mesh geometry={geo}><meshStandardMaterial vertexColors metalness={0.3} roughness={0.45} /></mesh>}
      {/* tailstock */}
      {tail && (
        <group>
          <ZC p={[0, 0, L + 5]} r={12} r2={0.01} h={10} m={metal} />
          <ZC p={[0, 0, L + 40]} r={24} h={60} m={metal} />
          {machine && <Box p={[0, -20, L + 150]} s={[200, 220, 160]} m={steel} />}
        </group>
      )}
      {/* steady rest */}
      {params.steadyRest && (
        <group position={[0, 0, params.steadyZ]}>
          <mesh rotation={[0, 0, 0]}>
            <torusGeometry args={[d0 / 2 + 45, 8, 10, 40]} />
            <meshStandardMaterial {...accent} />
          </mesh>
          {[Math.PI / 2, Math.PI / 2 + (2 * Math.PI) / 3, Math.PI / 2 + (4 * Math.PI) / 3].map((a, j) => (
            <mesh key={j} position={[(d0 / 2 + 22) * Math.cos(a), (d0 / 2 + 22) * Math.sin(a), 0]} rotation={[0, 0, a]}>
              <boxGeometry args={[40, 8, 8]} />
              <meshStandardMaterial {...metal} />
            </mesh>
          ))}
        </group>
      )}
      {/* carriage, cross-slide, tool holder and insert (follow the tool Z) */}
      <group ref={carriage}>
        {machine && <Box p={[150, -110, 0]} s={[220, 40, 140]} m={dark} />}
        <group ref={tip}>
          <Box p={[60, 0, 0]} s={[100, 20, 20]} m={dark} />
          {/* rhombic insert: tip at the origin of this group */}
          <mesh position={[5, 0, 0]} rotation={[Math.PI / 2, 0, Math.PI / 4]}>
            <boxGeometry args={[8, 8, 3]} />
            <meshStandardMaterial color="#f59e0b" metalness={0.6} roughness={0.35} />
          </mesh>
        </group>
      </group>
      <Forces getView={turnForceView} enabled={active} />
      <AxisTriad at={[-40, 60, -10]} visible={active} size={40} />
      <Label position={[0, -d0 / 2 - 30, L / 2]} visible={showDims}><span className={tag}>L = {L} mm · Ø{params.d0} → Ø{params.dT.toFixed(2)} ± {params.tolerance.toFixed(3)} mm · L/D = {(L / params.dT).toFixed(1)}</span></Label>
      <Label position={[0, 70, -20]} visible={showDims}><span className={tag}>chuck{centres ? ' + head centre' : ''}</span></Label>
      <Label position={[0, 60, L + 30]} visible={showDims && tail}><span className={tag}>{centres ? 'tail centre' : 'tailstock live centre'}</span></Label>
      <Label position={[0, d0 / 2 + 70, params.steadyZ]} visible={showDims && params.steadyRest}><span className={tag}>steady rest</span></Label>
    </group>
  );
}
