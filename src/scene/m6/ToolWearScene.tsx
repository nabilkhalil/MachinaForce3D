/**
 * Module 6 scene: side (finish) milling of a block on the machining centre, with the flank wear
 * land drawn on every flute (exaggerated width ∝ VB), plus an inset close-up of one cutting edge
 * (fresh edge outline, wear land on the clearance face, edge forces split into shearing and
 * ploughing parts). VB comes from the slider (manual) or from the growth model at the playback time.
 */
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { playback, useApp } from '../../state/store';
import { useToolWear } from '../../state/toolWearStore';
import { toolPose } from '../../state/pose';
import { ZCyl } from '../Machine';
import { Label } from '../LabScene';
import type { ForceView } from '../Forces';
import { cutterForce, feedToGlobal, TWO_PI } from '../../physics/millingForce';
import { CONDITION_LABEL, toolCondition, wearCutParams, wornCoefficients, type WearResult } from '../../physics/toolWear';

const L = 100; // block length (X), mm
const Y0 = -15; // uncut block face (material at Y ≥ Y0)
const TOP = 20;
const WEAR_VIS = 6; // visual exaggeration of the wear-land width on the 3D tool

/** VB used for display/forces: manual slider, or the growth model at the playback time. */
export function currentVB(r: WearResult | null = useToolWear.getState().result, station = playback.station): number {
  if (!r) return 0;
  if (!r.params.growthMode) return r.params.VB;
  const n = r.timeline.length;
  const i = Math.min(Math.max(Math.floor(station), 0), n - 1), j = Math.min(i + 1, n - 1), t = Math.min(Math.max(station - i, 0), 1);
  return r.timeline[i].VB + t * (r.timeline[j].VB - r.timeline[i].VB);
}

/** Material on +Y ⇒ up-milling feeds +X, down-milling −X (same convention as Module 3). */
function frame(r: WearResult, station: number) {
  const fs: 1 | -1 = r.params.mode === 'up' ? 1 : -1;
  const n = r.timeline.length;
  // the tool sweeps the block once per 1/4 of the timeline (repeated passes)
  const u = ((Math.max(station, 0) / Math.max(n - 1, 1)) * 4) % 1;
  const x = fs === 1 ? 5 + u * (L - 10) : L - 5 - u * (L - 10);
  const R = r.params.D / 2;
  return { fs, x, u, yc: Y0 + Math.min(r.params.ae, r.params.D) - R, zTip: TOP - r.params.ap, R };
}

export function toolWearForceView(): ForceView | null {
  const r = useToolWear.getState().result;
  if (!r) return null;
  const f = frame(r, playback.station);
  const { F, teeth } = cutterForce(playback.phi, wearCutParams(r.params, currentVB(r)));
  return {
    F: feedToGlobal(F, f.fs), teeth, contact: [f.x, f.yc + f.R * 0.9, f.zTip + r.params.ap / 2],
    tool: { x: f.x, y: f.yc }, feedSign: f.fs, R: f.R, patchWidth: 2, b: r.params.ap, active: true,
  };
}

export function ToolWearScene() {
  const result = useToolWear((s) => s.result);
  const params = useToolWear((s) => s.params);
  const cursor = useApp((s) => s.cursor);
  const showDims = useApp((s) => s.view.showDims && s.module === 6);
  const tool = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const ahead = useRef<THREE.Mesh>(null);
  const { D, N, ap, helixDeg } = params;
  const ae = Math.min(params.ae, D);
  const R = D / 2;
  const overhang = 45;
  const VBnow = result ? currentVB(result, cursor.station) : 0;
  const VBkey = Math.round(VBnow * 200) / 200;

  const flutes = useMemo(() => {
    const pitch = TWO_PI / N;
    const kb = (2 * Math.tan((helixDeg * Math.PI) / 180)) / D;
    const len = Math.min(overhang - 6, 2.5 * D);
    class H extends THREE.Curve<THREE.Vector3> {
      constructor(private a0: number, private r: number, private zMax: number) { super(); }
      getPoint(t: number, o = new THREE.Vector3()) { const z = t * this.zMax; const a = this.a0 + kb * z; return o.set(this.r * Math.cos(a), this.r * Math.sin(a), z); }
    }
    return {
      len,
      geos: Array.from({ length: N }, (_, j) => new THREE.TubeGeometry(new H(-j * pitch, R * 0.86, len), 48, R * 0.16, 6, false)),
      H, pitch,
    };
  }, [N, R, D, helixDeg]);

  // wear land along the engaged part of every cutting edge, width ∝ VB (exaggerated)
  const lands = useMemo(() => {
    if (VBkey <= 0) return [];
    const w = Math.min(0.12 + VBkey * WEAR_VIS * 0.5, R * 0.3);
    return Array.from({ length: N }, (_, j) => new THREE.TubeGeometry(new flutes.H(-j * flutes.pitch, R * 0.86 + R * 0.12, Math.min(ap, flutes.len)), 32, w, 6, false));
  }, [VBkey, N, R, ap, flutes]);
  useEffect(() => () => lands.forEach((g) => g.dispose()), [lands]);
  const cond = toolCondition(VBnow, params.VBcrit);
  const landColor = cond === 'fresh' ? '#d6b25e' : cond === 'normal' ? '#c2410c' : '#7f1d1d';

  useFrame(() => {
    const r = result;
    if (!r || !tool.current || !spin.current) return;
    const f = frame(r, playback.station);
    tool.current.position.set(f.x, f.yc, f.zTip);
    toolPose.x = f.x; toolPose.y = f.yc; toolPose.zTip = f.zTip; toolPose.overhang = overhang;
    spin.current.rotation.z = (f.fs === 1 ? Math.PI / 2 : -Math.PI / 2) - playback.phi;
    if (ahead.current) {
      const x0 = f.fs === 1 ? f.x : 0, x1 = f.fs === 1 ? L : f.x;
      const wdt = Math.max(x1 - x0, 0.01);
      ahead.current.position.set((x0 + x1) / 2, Y0 + ae / 2, TOP - ap / 2);
      ahead.current.scale.set(wdt, ae, ap);
    }
  });

  if (!result) return null;
  const steel = { color: '#b8c2cc', metalness: 0.45, roughness: 0.4 };
  const holderM = { color: '#5b6573', metalness: 0.8, roughness: 0.3 };
  return (
    <group>
      {/* block below the cut and the wall beside it; uncut layer ahead of the tool */}
      <mesh position={[L / 2, 0, (-15 + TOP - ap) / 2]}><boxGeometry args={[L, 30, TOP - ap + 15]} /><meshStandardMaterial {...steel} /></mesh>
      <mesh position={[L / 2, (Y0 + ae + 15) / 2, TOP - ap / 2]}><boxGeometry args={[L, 15 - (Y0 + ae), ap]} /><meshStandardMaterial {...steel} /></mesh>
      <mesh ref={ahead}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial {...steel} color="#9aa5b1" /></mesh>
      <group ref={tool}>
        <group ref={spin}>
          <ZCyl p={[0, 0, flutes.len / 2]} r={R * 0.72} h={flutes.len} m={{ color: '#8c96a3', metalness: 0.9, roughness: 0.25 }} />
          {flutes.geos.map((g, j) => <mesh key={j} geometry={g}><meshStandardMaterial color={j === 0 ? '#f59e0b' : '#a7b1bd'} metalness={0.9} roughness={0.25} /></mesh>)}
          {lands.map((g, j) => <mesh key={'w' + j} geometry={g}><meshStandardMaterial color={landColor} metalness={0.3} roughness={0.8} /></mesh>)}
          <ZCyl p={[0, 0, (flutes.len + overhang) / 2]} r={R * 0.98} h={overhang - flutes.len} m={{ color: '#8c96a3', metalness: 0.9, roughness: 0.25 }} />
          <ZCyl p={[0, 0, overhang + 12]} r={R + 3} r2={R + 12} h={24} m={holderM} />
          <ZCyl p={[0, 0, overhang + 34]} r={R + 12} h={20} m={holderM} />
          <ZCyl p={[0, 0, overhang + 52]} r={31} h={16} m={{ color: '#334155', metalness: 0.6, roughness: 0.4 }} />
          <ZCyl p={[0, 0, overhang + 65]} r={20} r2={14} h={10} m={holderM} />
        </group>
      </group>
      {showDims && <Line points={[[0, Y0 - 6, TOP], [L, Y0 - 6, TOP]]} color="#67e8f9" lineWidth={1} />}

    </group>
  );
}

/** Scene label, mounted permanently in LabScene (an Html label unmounted with the module throws in React 19). */
export function ToolWearLabel() {
  const module = useApp((s) => s.module);
  const showDims = useApp((s) => s.view.showDims);
  const result = useToolWear((s) => s.result);
  const p = useToolWear((s) => s.params);
  const cursor = useApp((s) => s.cursor);
  const VB = result ? currentVB(result, cursor.station) : 0;
  const tag = 'rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] text-cyan-200 ring-1 ring-cyan-700 whitespace-nowrap';
  return (
    <Label position={[L / 2, Y0 - 8, TOP + 4]} visible={module === 6 && showDims && !!result}>
      <span className={tag}>finish side milling · ae = {p.ae} mm · ap = {p.ap} mm · VB = {VB.toFixed(2)} mm ({CONDITION_LABEL[toolCondition(VB, p.VBcrit)]})</span>
    </Label>
  );
}

// ------------------------------------------------------------------ close-up of one cutting edge
const S = 22; // close-up scale: units per mm of VB
const ALPHA = (8 * Math.PI) / 180; // clearance angle
const GAMMA = (10 * Math.PI) / 180; // rake angle

function Arrow3({ from, vec, color }: { from: [number, number, number]; vec: [number, number]; color: string }) {
  const len = Math.hypot(vec[0], vec[1]);
  if (len < 0.05) return null;
  const ang = Math.atan2(vec[1], vec[0]) - Math.PI / 2;
  return (
    <group position={from} rotation={[0, 0, ang]}>
      <mesh position={[0, len * 0.42, 0]}><cylinderGeometry args={[0.18, 0.18, len * 0.84, 8]} /><meshBasicMaterial color={color} /></mesh>
      <mesh position={[0, len * 0.92, 0]}><coneGeometry args={[0.5, len * 0.16 + 0.4, 12]} /><meshBasicMaterial color={color} /></mesh>
    </group>
  );
}

function EdgeModel({ VB }: { VB: number }) {
  const p = useToolWear((s) => s.params);
  const vbS = Math.min(VB, 0.6) * S;
  const yW = vbS * Math.tan(ALPHA); // edge recession = height of the land above the fresh edge
  const H = 12, W = 12, Z = 7;
  const geo = useMemo(() => {
    const sh = new THREE.Shape();
    sh.moveTo(yW * Math.tan(GAMMA), yW); // worn edge on the rake face
    sh.lineTo(Math.max(vbS, 1e-3), yW); // flat wear land (flush with the machined surface)
    sh.lineTo(W * Math.cos(ALPHA), W * Math.sin(ALPHA)); // original flank face
    sh.lineTo(W * Math.cos(ALPHA), H);
    sh.lineTo(H * Math.tan(GAMMA), H); // rake face
    sh.closePath();
    return new THREE.ExtrudeGeometry(sh, { depth: Z, bevelEnabled: false });
  }, [vbS, yW]);
  useEffect(() => () => geo.dispose(), [geo]);
  const freshOutline: [number, number, number][] = [[H * Math.tan(GAMMA), H, Z + 0.02], [0, 0, Z + 0.02], [W * Math.cos(ALPHA), W * Math.sin(ALPHA), Z + 0.02]];
  // edge forces per unit length at the mean chip thickness, split into shearing (K·c h) and ploughing (K·e)
  const K = wornCoefficients(p.coeffs, VB, p.wear), K0 = p.coeffs;
  const phiSpan = Math.acos(1 - (2 * Math.min(p.ae, p.D)) / p.D);
  const hMean = (p.fz * (1 - Math.cos(phiSpan))) / Math.max(phiSpan, 1e-6);
  const fs = 7 / Math.max(K0.Ktc * hMean + K0.Kte, 1); // arrow scale: fresh tangential force = 7 units
  const tc = K.Ktc * hMean * fs, te = K.Kte * fs, rc = K.Krc * hMean * fs, re = K.Kre * fs;
  return (
    <group position={[-2, -2, -Z / 2]}>
      <mesh geometry={geo}><meshStandardMaterial color="#c5ccd6" metalness={0.35} roughness={0.45} /></mesh>
      {/* wear land on the clearance face, darker as it grows */}
      {vbS > 0.05 && (
        <mesh position={[(yW * Math.tan(GAMMA) + vbS) / 2, yW - 0.03, Z / 2]}>
          <boxGeometry args={[Math.max(vbS - yW * Math.tan(GAMMA), 0.05), 0.25, Z + 0.05]} />
          <meshStandardMaterial color={VB >= p.VBcrit ? '#7f1d1d' : VB >= 0.8 * p.VBcrit ? '#c2410c' : '#d6b25e'} emissive="#7c2d12" emissiveIntensity={0.3 + Math.min(VB / Math.max(p.VBcrit, 1e-6), 1) * 0.5} />
        </mesh>
      )}
      {/* the land itself faces the workpiece; show its extent on the visible side face as a bright bar */}
      {vbS > 0.05 && (
        <mesh position={[(yW * Math.tan(GAMMA) + vbS) / 2, yW + 0.3, Z + 0.06]}>
          <boxGeometry args={[Math.max(vbS - yW * Math.tan(GAMMA), 0.05), 0.6, 0.05]} />
          <meshBasicMaterial color={VB >= p.VBcrit ? '#ef4444' : VB >= 0.8 * p.VBcrit ? '#f97316' : '#facc15'} />
        </mesh>
      )}
      <Line points={freshOutline} color="#22d3ee" lineWidth={2} dashed dashSize={0.6} gapSize={0.4} />
      {/* workpiece: machined surface under the land, uncut layer ahead of the edge, chip on the rake face */}
      <mesh position={[0, yW - 3, Z / 2]}><boxGeometry args={[30, 6, Z + 2]} /><meshStandardMaterial color="#64748b" metalness={0.3} roughness={0.6} /></mesh>
      <mesh position={[-7.5, yW + 0.6, Z / 2]}><boxGeometry args={[15, 1.2, Z + 2]} /><meshStandardMaterial color="#94a3b8" metalness={0.3} roughness={0.6} /></mesh>
      <mesh position={[yW * Math.tan(GAMMA) - 0.6 + 2 * Math.sin(GAMMA), yW + 3, Z / 2]} rotation={[0, 0, -GAMMA]}><boxGeometry args={[1.2, 6, Z + 2]} /><meshStandardMaterial color="#cbd5e1" metalness={0.3} roughness={0.6} /></mesh>
      {/* forces ON THE TOOL edge: tangential (+x, opposing the cutting motion) and radial (+y, thrust) */}
      <group position={[0, 0, Z + 0.3]}>
        {/* drawn slightly above the edge so the wear-land bar stays visible */}
        <Arrow3 from={[0.2, yW + 1.6, 0]} vec={[tc, 0]} color="#fb923c" />
        <Arrow3 from={[0.2 + tc, yW + 1.6, 0]} vec={[te, 0]} color="#f43f5e" />
        <Arrow3 from={[-1.2, yW + 0.2, 0]} vec={[0, rc]} color="#c084fc" />
        <Arrow3 from={[-1.2, yW + 0.2 + rc, 0]} vec={[0, re]} color="#f43f5e" />
      </group>
    </group>
  );
}

/** Inset canvas (plain HTML labels). Kept mounted and hidden when not in Module 6 (unmounting a canvas portal throws in React 19). */
export function EdgeCloseUp({ visible }: { visible: boolean }) {
  const result = useToolWear((s) => s.result);
  const p = useToolWear((s) => s.params);
  const cursor = useApp((s) => s.cursor);
  const VB = result ? currentVB(result, cursor.station) : 0;
  const cond = toolCondition(VB, p.VBcrit);
  const Kw = wornCoefficients(p.coeffs, VB, p.wear);
  return (
    <div className={`pointer-events-none absolute right-2 top-2 z-10 hidden w-[250px] overflow-hidden rounded-lg bg-slate-950/90 ring-1 ring-slate-700 ${visible ? "md:block" : ""}`}>
      <div className="flex items-center justify-between px-2 pt-1 text-[10px]">
        <span className="font-semibold uppercase tracking-wider text-slate-400">Cutting edge close-up</span>
        <span className={cond === 'fresh' || cond === 'normal' ? 'text-emerald-300' : cond === 'approaching' ? 'text-amber-300' : 'text-rose-300'}>VB {VB.toFixed(2)} mm</span>
      </div>
      <div className="h-[140px]">
        <Canvas camera={{ position: [-3, 7, 30], fov: 42 }} dpr={[1, 2]} frameloop={visible ? "always" : "never"} onCreated={({ camera }) => camera.lookAt(1, 2.5, 0)}>
          <ambientLight intensity={0.9} />
          <directionalLight position={[-6, 14, 20]} intensity={1.4} />
          <EdgeModel VB={VB} />
        </Canvas>
      </div>
      <div className="space-y-0.5 px-2 pb-1.5 text-[9.5px] leading-tight text-slate-300">
        <div><span className="text-cyan-300">- - fresh edge</span> · <span className="text-amber-300">■ wear land VB</span> on the clearance face (×{S / 1} units/mm, not to scale)</div>
        <div><span className="text-orange-400">■ Ft shear</span> + <span className="text-rose-400">■ edge/ploughing</span> · <span className="text-purple-300">■ Fr shear</span> + <span className="text-rose-400">■ edge</span> (on the tool)</div>
        <div className="text-slate-400">Kte {Kw.Kte.toFixed(0)} · Kre {Kw.Kre.toFixed(0)} · Kae {Kw.Kae.toFixed(1)} N/mm — {CONDITION_LABEL[cond]}</div>
      </div>
    </div>
  );
}
