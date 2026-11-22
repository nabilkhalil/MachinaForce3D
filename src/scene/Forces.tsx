/**
 * Force vectors at the tool–workpiece contact. Components are drawn in the SAME machine
 * frame as the equations and graphs. The user chooses whether the arrows show the force
 * acting on the tool or on the workpiece (equal and opposite).
 */
import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { playback, useApp } from '../state/store';
import { instantState, toothXY } from '../sim/instant';
import type { ForceVector, ToothState } from '../physics/millingForce';

/** What the force overlay needs from either module at the current cursor. */
export interface ForceView {
  F: ForceVector;
  teeth: ToothState[];
  contact: [number, number, number];
  tool: { x: number; y: number };
  feedSign: 1 | -1;
  R: number;
  patchWidth: number;
  b: number;
  active: boolean;
}

export function module1ForceView(): ForceView | null {
  const r = useApp.getState().result;
  if (!r) return null;
  const s = instantState(r, playback.station, playback.phi);
  return {
    F: s.F, teeth: s.teeth, contact: s.contact, tool: s.tool, feedSign: s.pass.feedSign, R: r.params.D / 2,
    patchWidth: Math.max(s.station.patch.x1 - s.station.patch.x0, 0.5), b: s.station.b, active: s.station.ae > 0,
  };
}

const UP = new THREE.Vector3(0, 1, 0);

/** Arrow whose geometry is unit length along +Y, scaled/oriented each frame. */
function useArrow() {
  const ref = useRef<THREE.Group>(null);
  const set = (origin: THREE.Vector3, vec: THREE.Vector3, minLen = 0.0) => {
    const g = ref.current;
    if (!g) return;
    const len = vec.length();
    if (len < 1e-6 || len < minLen) { g.visible = false; return; }
    g.visible = true;
    g.position.copy(origin);
    g.quaternion.setFromUnitVectors(UP, vec.clone().normalize());
    g.scale.set(1, len, 1);
  };
  return { ref, set };
}

function Arrow({ api, color, radius = 0.7 }: { api: ReturnType<typeof useArrow>; color: string; radius?: number }) {
  // shaft 0..0.8, head 0.8..1 (in unit length); head is not length-scaled perfectly but reads well
  return (
    <group ref={api.ref}>
      {/* drawn on top of the geometry so the vectors stay readable inside the tool/wall */}
      <mesh position={[0, 0.4, 0]} renderOrder={10}>
        <cylinderGeometry args={[radius, radius, 0.8, 10]} />
        <meshBasicMaterial color={color} depthTest={false} transparent opacity={0.95} />
      </mesh>
      <mesh position={[0, 0.9, 0]} renderOrder={10}>
        <coneGeometry args={[radius * 2.6, 0.2, 14]} />
        <meshBasicMaterial color={color} depthTest={false} transparent opacity={0.95} />
      </mesh>
    </group>
  );
}

export const FORCE_COLORS = { Fx: '#ef4444', Fy: '#22c55e', Fz: '#3b82f6', F: '#f59e0b', Ft: '#fb923c', Fr: '#c084fc' };

export function Forces({ getView = module1ForceView, enabled = true }: { getView?: () => ForceView | null; enabled?: boolean }) {
  const view = useApp((s) => s.view);
  const ax = useArrow(), ay = useArrow(), az = useArrow(), ar = useArrow();
  const teethT = [useArrow(), useArrow(), useArrow(), useArrow(), useArrow(), useArrow()];
  const teethR = [useArrow(), useArrow(), useArrow(), useArrow(), useArrow(), useArrow()];
  const label = useRef<THREE.Group>(null);
  const contactMark = useRef<THREE.Mesh>(null);
  const [txt, setTxt] = useState({ Fx: 0, Fy: 0, Fz: 0, F: 0, on: true });
  const zero = new THREE.Vector3();
  const tick = useRef(0);

  useFrame((_, dt) => {
    const s = enabled ? getView() : null;
    if (!s) {
      for (const a of [ax, ay, az, ar, ...teethT, ...teethR]) a.set(zero, zero);
      if (contactMark.current) contactMark.current.visible = false;
      if (txt.on) setTxt({ ...txt, on: false });
      return;
    }
    const sign = view.forceOn === 'tool' ? 1 : -1;
    const k = view.forceScale;
    const o = new THREE.Vector3(...s.contact);
    const show = view.showForces;
    const F = { x: sign * s.F.Fx, y: sign * s.F.Fy, z: sign * s.F.Fz };
    ax.set(o, show ? new THREE.Vector3(F.x * k, 0, 0) : new THREE.Vector3());
    ay.set(o, show ? new THREE.Vector3(0, F.y * k, 0) : new THREE.Vector3());
    az.set(o, show ? new THREE.Vector3(0, 0, F.z * k) : new THREE.Vector3());
    ar.set(o, show ? new THREE.Vector3(F.x * k, F.y * k, F.z * k) : new THREE.Vector3());
    if (label.current) label.current.position.set(o.x + F.x * k, o.y + F.y * k, o.z + F.z * k + 3);
    if (contactMark.current) {
      contactMark.current.position.set(s.contact[0], s.contact[1], s.contact[2]);
      contactMark.current.scale.set(s.patchWidth, 0.4, Math.max(s.b, 0.3));
      contactMark.current.visible = s.active;
    }
    // per-tooth tangential and radial components (feed frame → machine frame)
    const R = s.R;
    const fs = s.feedSign;
    for (let j = 0; j < 6; j++) {
      const t = s.teeth[j];
      if (!t || !t.engaged || !view.showToothForces) {
        teethT[j].set(o, new THREE.Vector3()); teethR[j].set(o, new THREE.Vector3()); continue;
      }
      const [dx, dy] = toothXY(t.phi, R, fs);
      const p = new THREE.Vector3(s.tool.x + dx, s.tool.y + dy, s.contact[2]);
      // on tool: Ft opposes edge velocity → feed-frame (−cosφ, sinφ); Fr toward axis → (−sinφ, −cosφ)
      const ft = new THREE.Vector3(-Math.cos(t.phi) * fs, Math.sin(t.phi) * fs, 0).multiplyScalar(sign * t.Ft * k);
      const fr = new THREE.Vector3(-Math.sin(t.phi) * fs, -Math.cos(t.phi) * fs, 0).multiplyScalar(sign * t.Fr * k);
      teethT[j].set(p, ft); teethR[j].set(p, fr);
    }
    tick.current += dt;
    if (tick.current > 0.12) {
      tick.current = 0;
      setTxt({ Fx: F.x, Fy: F.y, Fz: F.z, F: Math.hypot(F.x, F.y, F.z), on: true });
    }
  });

  return (
    <group>
      <mesh ref={contactMark}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#f43f5e" transparent opacity={0.55} depthTest={false} />
      </mesh>
      <Arrow api={ax} color={FORCE_COLORS.Fx} />
      <Arrow api={ay} color={FORCE_COLORS.Fy} />
      <Arrow api={az} color={FORCE_COLORS.Fz} />
      <Arrow api={ar} color={FORCE_COLORS.F} radius={0.9} />
      {teethT.map((a, j) => <Arrow key={'t' + j} api={a} color={FORCE_COLORS.Ft} radius={0.45} />)}
      {teethR.map((a, j) => <Arrow key={'r' + j} api={a} color={FORCE_COLORS.Fr} radius={0.45} />)}
      {/* kept mounted (hidden when off): unmounting an updating Html portal throws in React 19 */}
      <group ref={label}>
        <Html center style={{ pointerEvents: 'none', display: view.showForces && txt.on ? 'block' : 'none' }} zIndexRange={[10, 0]}>
          <div className="whitespace-nowrap rounded bg-slate-900/85 px-2 py-1 text-[10px] leading-tight text-slate-100 shadow ring-1 ring-slate-600 tabular-nums">
              <div className="font-semibold text-amber-300">|F| {txt.F.toFixed(1)} N <span className="font-normal text-slate-400">on {view.forceOn}</span></div>
              <div><span className="text-red-400">Fx</span> {txt.Fx.toFixed(1)} · <span className="text-green-400">Fy</span> {txt.Fy.toFixed(1)} · <span className="text-blue-400">Fz</span> {txt.Fz.toFixed(1)}</div>
          </div>
        </Html>
      </group>
    </group>
  );
}
