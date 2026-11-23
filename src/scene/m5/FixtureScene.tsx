/**
 * Module 5 scene: a steel block on a 3-2-1 fixture (subplate, locator pins, strap and screw
 * clamps). A slot is milled along X. The block is drawn displaced by the (exaggerated)
 * rigid-body motion computed at the current cutter station and angle; contacts are coloured
 * by state (stick / slip / lift-off), the slot floor by the feature error.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { playback, useApp } from '../../state/store';
import { useFixture } from '../../state/fixtureStore';
import { toolPose } from '../../state/pose';
import { sequential } from '../../lib/colormap';
import { TABLE_TOP, ZCyl } from '../Machine';
import { Label } from '../LabScene';
import type { ForceView } from '../Forces';
import { cutterForce, feedToGlobal, TWO_PI } from '../../physics/millingForce';
import { slotCutParams, type FixResult, type FixtureElement } from '../../physics/fixture';

const BINS = 80;
const MAX_ELS = 11;
const SUB_TOP = -14; // subplate top; locator pins reach the part at z = 0
export const fixtureLive = { station: 0, angle: 0, ey: 0, ez: 0, errScale: 0.02 };

const STATUS_COLOR: Record<string, string> = { stick: '#22c55e', slip: '#f59e0b', lift: '#ef4444', idle: '#64748b' };

/** Station index, tool x and the sampled-angle index at the playback cursor. */
export function fixtureFrame(r: FixResult, station: number, phi: number) {
  const n = r.stations.length;
  const i = Math.min(Math.max(Math.floor(station), 0), n - 1);
  const j = Math.min(i + 1, n - 1);
  const t = Math.min(Math.max(station - i, 0), 1);
  const x = r.stations[i].x + t * (r.stations[j].x - r.stations[i].x);
  const pitch = TWO_PI / r.params.N;
  const nA = r.params.angleSamples;
  const a = Math.floor(((((phi % pitch) + pitch) % pitch) / pitch) * nA) % nA;
  return { i, x, a, feedSign: (r.params.feedDir === '+X' ? 1 : -1) as 1 | -1 };
}

export function fixtureForceView(): ForceView | null {
  const r = useFixture.getState().result;
  if (!r) return null;
  const p = r.params;
  const f = fixtureFrame(r, playback.station, playback.phi);
  const cp = slotCutParams(p);
  const { F, teeth } = cutterForce(playback.phi, cp);
  const G = feedToGlobal(F, f.feedSign);
  const zc = p.Lz - p.ap / 2;
  return {
    F: G, teeth, contact: [f.x, p.slotY, zc], tool: { x: f.x, y: p.slotY }, feedSign: f.feedSign, R: p.D / 2,
    patchWidth: 2, b: p.ap, active: true,
  };
}

/** Visual fixture hardware for one element (pin, pad, clamp arm or screw block). */
function Element({ e, r, status, Lx, Ly, Lz }: { e: FixtureElement; r: number; status: string; Lx: number; Ly: number; Lz: number }) {
  const hw = { color: '#475569', metalness: 0.7, roughness: 0.35 };
  const c = STATUS_COLOR[status];
  const [x, y, z] = e.p;
  if (e.kind === 'locator') {
    if (e.n[2] === 1) // base pin from the subplate
      return (
        <group>
          <ZCyl p={[x, y, SUB_TOP / 2]} r={r} h={-SUB_TOP} m={hw} />
          <ZCyl p={[x, y, -0.6]} r={r * 0.8} h={1.2} m={{ color: c, emissive: c, emissiveIntensity: 0.5 }} />
        </group>
      );
    // side (−Y face) or end (−X face) locator: post on the subplate with a horizontal pin
    const alongY = e.n[1] === 1;
    const post: [number, number, number] = alongY ? [x, y - 14, (SUB_TOP + z + 6) / 2] : [x - 14, y, (SUB_TOP + z + 6) / 2];
    const ph = z + 6 - SUB_TOP;
    return (
      <group>
        <mesh position={post}><boxGeometry args={[16, 16, ph]} /><meshStandardMaterial {...hw} /></mesh>
        <mesh position={alongY ? [x, y - 3, z] : [x - 3, y, z]} rotation={alongY ? [0, 0, 0] : [0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[r * 0.8, r * 0.8, 6, 16]} />
          <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.5} />
        </mesh>
      </group>
    );
  }
  if (e.n[2] === -1) {
    // strap clamp: pad on the top face, arm toward the nearer Y edge, stud down to the subplate
    const toward = y < Ly / 2 ? -1 : 1;
    const edge = toward < 0 ? 0 : Ly;
    const yEnd = edge + toward * 26;
    const armL = Math.abs(yEnd - y) + 10;
    return (
      <group>
        <ZCyl p={[x, y, Lz + 2]} r={5} h={4} m={{ color: c, emissive: c, emissiveIntensity: 0.5 }} />
        <mesh position={[x, (y + yEnd) / 2, Lz + 7]}><boxGeometry args={[18, armL, 8]} /><meshStandardMaterial {...hw} /></mesh>
        <ZCyl p={[x, yEnd, (SUB_TOP + Lz + 12) / 2]} r={4} h={Lz + 12 - SUB_TOP} m={{ color: '#94a3b8', metalness: 0.8, roughness: 0.3 }} />
        <ZCyl p={[x, yEnd, Lz + 13]} r={7} h={4} m={hw} />
      </group>
    );
  }
  // screw clamp on the +Y or +X face
  const alongY = e.n[1] === -1;
  const blockP: [number, number, number] = alongY ? [x, Ly + 24, (SUB_TOP + z + 10) / 2] : [Lx + 24, y, (SUB_TOP + z + 10) / 2];
  const bh = z + 10 - SUB_TOP;
  return (
    <group>
      <mesh position={blockP}><boxGeometry args={[22, 22, bh]} /><meshStandardMaterial {...hw} /></mesh>
      <mesh position={alongY ? [x, Ly + 7, z] : [Lx + 7, y, z]} rotation={alongY ? [0, 0, 0] : [0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[3, 3, 14, 12]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={alongY ? [x, Ly + 1, z] : [Lx + 1, y, z]} rotation={alongY ? [0, 0, 0] : [0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[6, 6, 2, 16]} />
        <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

export function FixtureScene() {
  const result = useFixture((s) => s.result);
  const params = useFixture((s) => s.params);
  const ex = useApp((s) => s.view.exaggeration);
  const showDims = useApp((s) => s.view.showDims && s.module === 5);
  const cursor = useApp((s) => s.cursor);
  const part = useRef<THREE.Group>(null);
  const ahead = useRef<THREE.Mesh>(null);
  const tool = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const { Lx, Ly, Lz, D, N, ap, slotY } = params;
  const R = D / 2;
  const overhang = 45;

  const flutes = useMemo(() => {
    const pitch = TWO_PI / N;
    const kb = (2 * Math.tan((30 * Math.PI) / 180)) / D;
    const len = Math.min(overhang - 6, 2.5 * D);
    class H extends THREE.Curve<THREE.Vector3> {
      constructor(private a0: number) { super(); }
      getPoint(t: number, o = new THREE.Vector3()) { const z = t * len; const a = this.a0 + kb * z; return o.set(R * 0.86 * Math.cos(a), R * 0.86 * Math.sin(a), z); }
    }
    return { len, geos: Array.from({ length: N }, (_, j) => new THREE.TubeGeometry(new H(-j * pitch), 48, R * 0.16, 6, false)) };
  }, [N, R, D]);

  // slot floor strip coloured by feature error
  const floor = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((BINS + 1) * 2 * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array((BINS + 1) * 2 * 3), 3));
    const idx: number[] = [];
    for (let b = 0; b < BINS; b++) { const a = 2 * b, c = 2 * b + 1, d = 2 * b + 2, e = 2 * b + 3; idx.push(a, d, c, c, d, e); }
    g.setIndex(idx);
    return g;
  }, []);

  useFrame(() => {
    const r = result;
    if (!r || !part.current) return;
    const p = r.params;
    const f = fixtureFrame(r, playback.station, playback.phi);
    const st = r.stations[f.i];
    fixtureLive.station = f.i; fixtureLive.angle = f.a; fixtureLive.ey = st.ey; fixtureLive.ez = st.ez;
    // rigid-body displacement about the centroid, exaggerated
    const q = st.qs;
    const c = new THREE.Vector3(p.Lx / 2, p.Ly / 2, p.Lz / 2);
    // drawn motion is capped so that an unrestrained part (no static solution) stays on screen
    const th = new THREE.Vector3(q[f.a * 6 + 3], q[f.a * 6 + 4], q[f.a * 6 + 5]).multiplyScalar(ex);
    if (th.length() > 0.06) th.setLength(0.06);
    const quat = new THREE.Quaternion();
    const ang = th.length();
    if (ang > 1e-12) quat.setFromAxisAngle(th.clone().normalize(), ang);
    const d = new THREE.Vector3(q[f.a * 6], q[f.a * 6 + 1], q[f.a * 6 + 2]).multiplyScalar(ex);
    if (d.length() > 5) d.setLength(5);
    // position such that the centroid moves by d and the body rotates about the centroid
    const pos = c.clone().add(d).sub(c.clone().applyQuaternion(quat));
    part.current.position.copy(pos);
    part.current.quaternion.copy(quat);
    // tool
    const zTip = p.Lz - p.ap;
    if (tool.current) tool.current.position.set(f.x, p.slotY, zTip);
    if (spin.current) spin.current.rotation.z = (f.feedSign === 1 ? Math.PI / 2 : -Math.PI / 2) - playback.phi;
    toolPose.x = f.x; toolPose.y = p.slotY; toolPose.zTip = zTip; toolPose.overhang = overhang;
    // uncut slot material ahead of the tool (part-local frame)
    const x0 = p.D / 2 + 2, x1 = p.Lx - p.D / 2 - 2;
    if (ahead.current) {
      const a0 = f.feedSign === 1 ? f.x : 0, a1 = f.feedSign === 1 ? p.Lx : f.x;
      const w = Math.max(a1 - a0, 0.01);
      ahead.current.position.set((a0 + a1) / 2, p.slotY, p.Lz - p.ap / 2);
      ahead.current.scale.set(w, p.D, p.ap);
    }
    // floor strip: machined part coloured by |error| / tolerance
    const P = (floor.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
    const C = (floor.getAttribute('color') as THREE.BufferAttribute).array as Float32Array;
    const xsMin = Math.min(x0, x1), xsMax = Math.max(x0, x1);
    const tol = Math.max(p.tolerance, 1e-6);
    fixtureLive.errScale = tol;
    for (let b = 0; b <= BINS; b++) {
      const x = xsMin + ((xsMax - xsMin) * b) / BINS;
      const cut = f.feedSign === 1 ? x <= f.x : x >= f.x;
      // nearest station
      let k = 0, best = Infinity;
      for (let s = 0; s < r.stations.length; s++) { const dd = Math.abs(r.stations[s].x - x); if (dd < best) { best = dd; k = s; } }
      const e = Math.hypot(r.stations[k].ey, r.stations[k].ez);
      const col = cut ? sequential(Math.min(e / tol, 1)) : [0.5, 0.55, 0.6];
      for (const s of [0, 1]) {
        const v = 2 * b + s;
        P[3 * v] = x; P[3 * v + 1] = p.slotY + (s === 0 ? -R + 0.3 : R - 0.3); P[3 * v + 2] = p.Lz - p.ap + 0.05;
        C[3 * v] = col[0]; C[3 * v + 1] = col[1]; C[3 * v + 2] = col[2];
      }
    }
    floor.getAttribute('position').needsUpdate = true;
    floor.getAttribute('color').needsUpdate = true;
    floor.computeBoundingSphere();
  });

  if (!result) return null;
  const steel = { color: '#b8c2cc', metalness: 0.45, roughness: 0.4 };
  const els = result.els;
  const st = result.stations[Math.min(Math.max(Math.floor(cursor.station), 0), result.stations.length - 1)];
  const status = (i: number) => {
    if (!result.preloaded[i] && st.contacts[i]?.status === 'lift') return 'idle';
    return st.contacts[i]?.status ?? 'idle';
  };
  const tag = 'rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] text-cyan-200 ring-1 ring-cyan-700 whitespace-nowrap';
  const etag = 'rounded bg-slate-900/80 px-1 py-0.5 text-[9px] text-slate-200 ring-1 ring-slate-600 whitespace-nowrap tabular-nums';
  const yS0 = slotY - R, yS1 = slotY + R;
  return (
    <group>
      {/* subplate on the machine table */}
      <mesh position={[Lx / 2, Ly / 2, (TABLE_TOP + SUB_TOP) / 2]}>
        <boxGeometry args={[Lx + 90, Ly + 90, SUB_TOP - TABLE_TOP]} />
        <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.45} />
      </mesh>
      {els.map((e, i) => <Element key={e.id + i} e={e} r={e.kind === 'locator' ? 5 : 5} status={status(i)} Lx={Lx} Ly={Ly} Lz={Lz} />)}
      {/* workpiece (displaced rigid body) */}
      <group ref={part}>
        <mesh position={[Lx / 2, Ly / 2, (Lz - ap) / 2]}><boxGeometry args={[Lx, Ly, Lz - ap]} /><meshStandardMaterial {...steel} /></mesh>
        <mesh position={[Lx / 2, yS0 / 2, Lz - ap / 2]}><boxGeometry args={[Lx, Math.max(yS0, 0.01), ap]} /><meshStandardMaterial {...steel} /></mesh>
        <mesh position={[Lx / 2, (yS1 + Ly) / 2, Lz - ap / 2]}><boxGeometry args={[Lx, Math.max(Ly - yS1, 0.01), ap]} /><meshStandardMaterial {...steel} /></mesh>
        <mesh ref={ahead}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial {...steel} color="#9aa5b1" /></mesh>
        <mesh geometry={floor}><meshStandardMaterial vertexColors side={THREE.DoubleSide} metalness={0.2} roughness={0.5} /></mesh>
      </group>
      {/* tool */}
      <group ref={tool}>
        <group ref={spin}>
          <ZCyl p={[0, 0, flutes.len / 2]} r={R * 0.72} h={flutes.len} m={{ color: '#8c96a3', metalness: 0.9, roughness: 0.25 }} />
          {flutes.geos.map((g, j) => <mesh key={j} geometry={g}><meshStandardMaterial color={j === 0 ? '#f59e0b' : '#a7b1bd'} metalness={0.9} roughness={0.25} /></mesh>)}
          <ZCyl p={[0, 0, (flutes.len + overhang) / 2]} r={R * 0.98} h={overhang - flutes.len} m={{ color: '#8c96a3', metalness: 0.9, roughness: 0.25 }} />
          <ZCyl p={[0, 0, overhang + 12]} r={R + 3} r2={R + 12} h={24} m={{ color: '#5b6573', metalness: 0.8, roughness: 0.3 }} />
          <ZCyl p={[0, 0, overhang + 34]} r={R + 12} h={20} m={{ color: '#5b6573', metalness: 0.8, roughness: 0.3 }} />
          {/* flange + taper up to the spindle nose (holder gauge length 70 mm, as in the Machine model) */}
          <ZCyl p={[0, 0, overhang + 52]} r={31} h={16} m={{ color: '#334155', metalness: 0.6, roughness: 0.4 }} />
          <ZCyl p={[0, 0, overhang + 65]} r={20} r2={14} h={10} m={{ color: '#5b6573', metalness: 0.8, roughness: 0.3 }} />
        </group>
      </group>
      {showDims && (
        <>
          <Line points={[[0, -30, 0], [Lx, -30, 0]]} color="#67e8f9" lineWidth={1} />
          <Line points={[[Lx + 34, 0, Lz], [Lx + 34, slotY, Lz]]} color="#67e8f9" lineWidth={1} />
        </>
      )}
      <Label position={[Lx / 2, Ly / 2, Lz + 40]} visible={!st.restrained || st.lifted || st.slipping}>
        <span className="whitespace-nowrap rounded bg-rose-900/90 px-2 py-1 text-[11px] font-semibold text-rose-50 ring-1 ring-rose-500">{!st.restrained ? 'PART NOT HELD — would be dislodged' : st.lifted ? 'LIFT-OFF at a contact' : 'SLIP at a contact'}</span>
      </Label>
      <Label position={[Lx / 2, -34, 0]} visible={showDims}><span className={tag}>{Lx} × {Ly} × {Lz} mm block · datum = locators</span></Label>
      <Label position={[Lx + 40, slotY / 2, Lz]} visible={showDims}><span className={tag}>slot Y = {slotY} mm · depth {ap} mm</span></Label>
      {/* contact forces (fixed count so the Html portals are never unmounted) */}
      {Array.from({ length: MAX_ELS }, (_, i) => {
        const e = els[i];
        const c = st.contacts[i];
        const pos: [number, number, number] = e ? [e.p[0] - e.n[0] * 16, e.p[1] - e.n[1] * 16, e.p[2] - e.n[2] * 12 + (e.n[2] === 0 ? 10 : 0)] : [0, 0, 0];
        return (
          <Label key={'cl' + i} position={pos} visible={showDims && !!e && !!c}>
            <span className={etag} style={{ borderLeft: `3px solid ${c ? STATUS_COLOR[status(i)] : '#64748b'}` }}>{e?.id} {c ? `${c.N.toFixed(0)} N` : ''}</span>
          </Label>
        );
      })}
    </group>
  );
}
