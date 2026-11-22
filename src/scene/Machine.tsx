/**
 * Generic 3-axis vertical machining centre (C-frame, moving table/saddle, Z-head).
 * Rendered in the WORKPIECE frame: the table carries the part (static here), the saddle
 * moves with the tool's X, and base + column + head move with the tool's X and Y.
 * This reproduces the real relative motion (ISO 841: axes describe tool motion relative
 * to the workpiece) while keeping the part still for close-up study.
 * Generic geometry — not a model of any commercial machine.
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { useApp } from '../state/store';
import { toolPose } from '../state/pose';

const body = { color: '#c9d1d9', metalness: 0.35, roughness: 0.45 };
const accent = { color: '#0e7490', metalness: 0.3, roughness: 0.5 };
const dark = { color: '#2b3440', metalness: 0.5, roughness: 0.5 };
const steel = { color: '#9aa4ae', metalness: 0.85, roughness: 0.28 };

export const TABLE_TOP = -55;

function Box({ p, s, m, ...rest }: { p: [number, number, number]; s: [number, number, number]; m: object; castShadow?: boolean }) {
  return (
    <mesh position={p} {...rest}>
      <boxGeometry args={s} />
      <meshStandardMaterial {...m} />
    </mesh>
  );
}

/** Cylinder along machine Z (three's cylinder is along its local Y). */
export function ZCyl({ p, r, r2, h, m, seg = 32 }: { p: [number, number, number]; r: number; r2?: number; h: number; m: object; seg?: number }) {
  return (
    <mesh position={p} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[r2 ?? r, r, h, seg]} />
      <meshStandardMaterial {...m} />
    </mesh>
  );
}

export function Machine() {
  const exploded = useApp((s) => s.view.exploded);
  const frame = useRef<Group>(null); // base + column (moves with tool X,Y)
  const saddle = useRef<Group>(null); // moves with tool X
  const head = useRef<Group>(null); // Z head (moves with tool Z)
  const table = useRef<Group>(null);
  const ex = useRef(0);

  useFrame((_, dt) => {
    ex.current += ((exploded ? 1 : 0) - ex.current) * Math.min(1, dt * 4);
    const tx = toolPose.x, ty = toolPose.y, tz = toolPose.zTip;
    const gauge = toolPose.overhang;
    if (frame.current) frame.current.position.set(tx, ty, -ex.current * 160);
    if (saddle.current) saddle.current.position.set(tx, 0, -ex.current * 120);
    if (table.current) table.current.position.set(0, 0, -ex.current * 80);
    // spindle nose sits at tip + overhang + holder gauge length (70 mm)
    if (head.current) head.current.position.set(0, 0, tz + gauge + 70 + ex.current * 60);
  });

  return (
    <group>
      {/* table: carries the vise and part */}
      <group ref={table}>
        <Box p={[25, 0, TABLE_TOP - 25]} s={[760, 380, 50]} m={dark} />
        {[-120, -40, 40, 120].map((y) => (
          <Box key={y} p={[25, y, TABLE_TOP - 1]} s={[760, 14, 2.5]} m={{ color: '#11161c' }} />
        ))}
      </group>
      {/* saddle */}
      <group ref={saddle}>
        <Box p={[25 - 0, 0, TABLE_TOP - 95]} s={[520, 460, 90]} m={body} />
      </group>
      {/* base + column + Z-head ways, fixed to the machine frame */}
      <group ref={frame}>
        <Box p={[0, 260, TABLE_TOP - 400]} s={[1100, 1200, 520]} m={body} />
        <Box p={[0, -330, TABLE_TOP - 300]} s={[1100, 20, 300]} m={accent} />
        <Box p={[0, 620, 350]} s={[560, 380, 1500]} m={body} />
        <Box p={[0, 420, 350]} s={[400, 20, 1400]} m={dark} />
        <Box p={[-170, 430, 350]} s={[40, 30, 1300]} m={steel} />
        <Box p={[170, 430, 350]} s={[40, 30, 1300]} m={steel} />
        <group ref={head}>
          {/* spindle head carriage */}
          <Box p={[0, 230, 240]} s={[360, 420, 420]} m={body} />
          <Box p={[0, 14.5, 240]} s={[300, 9, 340]} m={accent} />
          <ZCyl p={[0, 0, 45]} r={60} h={90} m={dark} />
          <ZCyl p={[0, 0, 3]} r={45} h={6} m={steel} />
        </group>
      </group>
    </group>
  );
}

/** Precision vise with the workpiece base block (part of the blank). */
export function Fixture() {
  const exploded = useApp((s) => s.view.exploded);
  const g = useRef<Group>(null);
  const ex = useRef(0);
  useFrame((_, dt) => {
    ex.current += ((exploded ? 1 : 0) - ex.current) * Math.min(1, dt * 4);
    if (g.current) g.current.position.z = -ex.current * 45;
  });
  return (
    <group ref={g}>
      <Box p={[25, 0, TABLE_TOP + 12.5]} s={[150, 130, 25]} m={dark} />
      <Box p={[25, -36, -26]} s={[150, 42, 48]} m={steel} />
      <Box p={[25, 36, -26]} s={[150, 42, 48]} m={steel} />
      <Box p={[25, 64, -26]} s={[60, 14, 30]} m={accent} />
    </group>
  );
}
