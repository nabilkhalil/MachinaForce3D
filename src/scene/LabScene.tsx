import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Machine, Fixture } from './Machine';
import { WallMesh } from './WallMesh';
import { Tool } from './Tool';
import { Forces, module1ForceView } from './Forces';
import { playback, useApp } from '../state/store';
import { usePocket } from '../state/pocketStore';
import { PocketWall, BentTool, PocketDims, pocketForceView } from './m2/PocketScene';
import { ChatterScene, chatterForceView } from './m3/ChatterScene';
import { useChatter } from '../state/chatterStore';
import { useTurning } from '../state/turningStore';
import { LatheScene } from './m4/LatheScene';
import { useFixture } from '../state/fixtureStore';
import { FixtureScene, fixtureForceView } from './m5/FixtureScene';
import { useToolWear } from '../state/toolWearStore';
import { ToolWearLabel, ToolWearScene, toolWearForceView } from './m6/ToolWearScene';

function Env() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const tex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = tex;
    return () => { tex.dispose(); pm.dispose(); };
  }, [gl, scene]);
  return null;
}

/** Advances the playback cursor and mirrors it to the store at ~8 Hz. */
function PlaybackDriver() {
  const module = useApp((s) => s.module);
  const r1 = useApp((s) => s.result);
  const r2 = usePocket((s) => s.result);
  const r3 = useChatter((s) => s.result);
  const r4 = useTurning((s) => s.result);
  const r5 = useFixture((s) => s.result);
  const r6 = useToolWear((s) => s.result);
  const nStations = module === 6 ? (r6 ? r6.timeline.length : 0) : module === 5 ? (r5 ? r5.stations.length : 0) : module === 4 ? (r4 ? r4.stations.length : 0) : module === 3 ? (r3 ? r3.sim.x.length : 0) : module === 2 ? (r2 ? r2.stations.length : 0) : r1 ? r1.stations.length : 0;
  const rate = module === 3 ? (r3 ? r3.sim.stepsPerTooth * 2 : 128) : 4; // module 3: 2 tooth periods per second at 1×
  const result = nStations > 0 ? { stations: { length: nStations } } : null;
  const setCursor = useApp((s) => s.setCursor);
  const setPlaying = useApp((s) => s.setPlaying);
  const acc = useRef(0);
  useFrame((_, dtRaw) => {
    if (!result) return;
    const dt = Math.min(dtRaw, 0.1);
    if (playback.playing) {
      playback.station += dt * rate * playback.speed;
      if (module !== 3) playback.phi = (playback.phi + dt * playback.spinRate * 2 * Math.PI * Math.min(playback.speed, 2)) % (2 * Math.PI);
      if (playback.station >= result.stations.length - 1) {
        playback.station = result.stations.length - 1;
        setPlaying(false);
      }
    }
    acc.current += dt;
    if (acc.current > 0.125) {
      acc.current = 0;
      setCursor(playback.station, playback.phi);
    }
  });
  return null;
}

export function AxisTriad({ at, visible = true, size = 14 }: { at: [number, number, number]; visible?: boolean; size?: number }) {
  const L = size;
  const axes: { d: [number, number, number]; c: string; l: string }[] = [
    { d: [L, 0, 0], c: '#ef4444', l: 'X' },
    { d: [0, L, 0], c: '#22c55e', l: 'Y' },
    { d: [0, 0, L], c: '#3b82f6', l: 'Z' },
  ];
  return (
    <group position={at}>
      {axes.map((a) => (
        <group key={a.l}>
          <Line points={[[0, 0, 0], a.d]} color={a.c} lineWidth={3} visible={visible} />
          <Html position={a.d.map((v) => v * 1.15) as [number, number, number]} center style={{ pointerEvents: 'none', display: visible ? 'block' : 'none' }}>
            <span className="text-xs font-bold" style={{ color: a.c }}>{a.l}</span>
          </Html>
        </group>
      ))}
    </group>
  );
}

/** Html label that is never unmounted (React 19 + drei Html throws on unmount); hidden via CSS. */
export function Label({ position, visible, children }: { position: [number, number, number]; visible: boolean; children: React.ReactNode }) {
  return (
    <Html position={position} center style={{ pointerEvents: 'none', display: visible ? 'block' : 'none' }}>
      {children}
    </Html>
  );
}

function Dimensions() {
  const p = useApp((s) => s.params);
  const show = useApp((s) => s.view.showDims && s.module === 1);
  const L = p.wallLength, H = p.wallHeight, t = p.wallThickness;
  const yd = -22;
  const tag = 'rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] text-cyan-200 ring-1 ring-cyan-700 whitespace-nowrap';
  return (
    <group>
      {show && (
        <>
          <Line points={[[0, yd, 0], [L, yd, 0]]} color="#67e8f9" lineWidth={1} />
          <Line points={[[0, yd + 2, 0], [0, yd - 2, 0]]} color="#67e8f9" lineWidth={1} />
          <Line points={[[L, yd + 2, 0], [L, yd - 2, 0]]} color="#67e8f9" lineWidth={1} />
          <Line points={[[L + 6, -1, 0], [L + 6, -1, H]]} color="#67e8f9" lineWidth={1} />
        </>
      )}
      <Label position={[L / 2, yd - 3, 0]} visible={show}><span className={tag}>L = {L} mm</span></Label>
      <Label position={[L + 9, -1, H / 2]} visible={show}><span className={tag}>H = {H} mm</span></Label>
      <Label position={[L / 2, 0, H + 6]} visible={show}><span className={tag}>t = {t.toFixed(2)} ± {p.tolerance.toFixed(2)} mm (nominal)</span></Label>
    </group>
  );
}

function CameraRig() {
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  const camera = useThree((s) => s.camera);
  const module = useApp((s) => s.module);
  const L1 = useApp((s) => s.params.wallLength);
  const H1 = useApp((s) => s.params.wallHeight);
  const L2 = usePocket((s) => s.params.wallLength);
  const H2 = usePocket((s) => s.params.pocketDepth);
  const L4 = useTurning((s) => s.params.L);
  const fx = useFixture((s) => s.params);
  const L = module === 6 ? 100 : module === 3 ? 80 : module === 2 ? L2 : L1, H = module === 6 || module === 3 ? 20 : module === 2 ? H2 : H1;
  const preset = useApp((s) => s.view.camPreset);
  const nonce = useApp((s) => s.view.camNonce);
  useEffect(() => {
    if (!controls) return;
    // machine (x, y, z) → three (x, z, −y)
    const t = new THREE.Vector3(L / 2, H / 2, 0);
    const d: Record<string, [number, number, number]> = {
      iso: [100, 65, 125], front: [0, 5, 165], top: [0, 170, 1], side: [170, 10, 0], machine: [900, 600, 1500],
    };
    if (module === 4) {
      // lathe: spindle axis along world X (lathe Z), shaft centre at (L/2, 0, 0)
      const t4 = new THREE.Vector3(L4 / 2, 0, 0);
      const d4: Record<string, [number, number, number]> = {
        iso: [90, 210, 470], front: [0, 20, 560], top: [0, 600, 1], side: [560, 80, 0], machine: [300, 650, 1300],
      };
      const o = d4[preset] ?? d4.iso;
      controls.target.copy(t4);
      camera.position.set(t4.x + o[0], t4.y + o[1], t4.z + o[2]);
      controls.update();
      return;
    }
    if (module === 5) {
      // block 0..Lx × 0..Ly × 0..Lz (machine) → centre in three (Lx/2, Lz/2, −Ly/2)
      const t5 = new THREE.Vector3(fx.Lx / 2, fx.Lz / 2, -fx.Ly / 2);
      const d5: Record<string, [number, number, number]> = {
        iso: [250, 230, 340], front: [0, 40, 420], top: [0, 460, 1], side: [440, 50, 0], machine: [900, 600, 1500],
      };
      const o = d5[preset] ?? d5.iso;
      controls.target.copy(preset === 'machine' ? new THREE.Vector3(0, 150, -200) : t5);
      camera.position.set(t5.x + o[0], t5.y + o[1], t5.z + o[2]);
      controls.update();
      return;
    }
    const off = d[preset] ?? d.iso;
    controls.target.copy(preset === 'machine' ? new THREE.Vector3(0, 150, -200) : t);
    camera.position.set(t.x + off[0], t.y + off[1], t.z + off[2]);
    controls.update();
  }, [controls, camera, L, H, L4, fx.Lx, fx.Ly, fx.Lz, preset, nonce, module]);
  return null;
}

export function LabScene() {
  const showMachine = useApp((s) => s.view.showMachine);
  const module = useApp((s) => s.module);
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      camera={{ position: [125, 85, 150], fov: 38, near: 1, far: 20000 }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.localClippingEnabled = true; }}
    >
      <color attach="background" args={['#0b1220']} />
      <fog attach="fog" args={['#0b1220', 1200, 4000]} />
      <Env />
      <hemisphereLight args={['#dbeafe', '#1e293b', 0.6]} />
      <directionalLight position={[300, 600, 400]} intensity={1.6} />
      <directionalLight position={[-400, 200, -300]} intensity={0.5} />
      <PlaybackDriver />
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} minDistance={20} maxDistance={3500} target={[25, 20, 0]} />
      <CameraRig />
      {/* Machine frame: Z up. three.js is Y-up, so rotate −90° about X: (x, y, z) → (x, z, −y). */}
      <group rotation={[-Math.PI / 2, 0, 0]}>
        {showMachine && module !== 4 && <Machine />}
        {module === 4 ? null : module === 6 ? (
          <>
            <Fixture />
            <ToolWearScene />
          </>
        ) : module === 5 ? (
          <FixtureScene />
        ) : module === 1 ? (
          <>
            <Fixture />
            <WallMesh />
            <Tool />
          </>
        ) : module === 2 ? (
          <>
            <PocketWall />
            <BentTool />
          </>
        ) : (
          <>
            <Fixture />
            <ChatterScene />
          </>
        )}
        <Dimensions />
        <PocketDims />
        <ToolWearLabel />
        {/* shared across modules so their Html labels are never unmounted */}
        <Forces getView={module === 6 ? toolWearForceView : module === 5 ? fixtureForceView : module === 3 ? chatterForceView : module === 2 ? pocketForceView : module1ForceView} enabled={module !== 4} />
        <AxisTriad at={module === 5 ? [-50, -50, 0] : [-24, -26, 0]} visible={module !== 4} />
      </group>
      {/* Lathe frame (Module 4): lathe (x, y, z) → three (z, y, −x): spindle axis along world X,
          the tool on the far side of the shaft (rear-turret convention, +X away from the operator). */}
      <group rotation={[0, Math.PI / 2, 0]}>
        <LatheScene />
      </group>
      <gridHelper args={[4000, 40, '#1e3a5f', '#14243a']} position={[25, -715, 0]} />
    </Canvas>
  );
}
