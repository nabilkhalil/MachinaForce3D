/**
 * End mill + collet holder. Flute ridges follow the same helix, tooth count and
 * immersion-angle convention as the force model, so the visible edges coincide with
 * the teeth whose forces are drawn.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { playback, useApp } from '../state/store';
import { instantState } from '../sim/instant';
import { ZCyl } from './Machine';
import { toolPose } from '../state/pose';

const carbide = { color: '#8c96a3', metalness: 0.9, roughness: 0.25 };
const holderM = { color: '#5b6573', metalness: 0.8, roughness: 0.3 };

class Helix extends THREE.Curve<THREE.Vector3> {
  constructor(private r: number, private len: number, private a0: number, private kb: number) { super(); }
  getPoint(t: number, out = new THREE.Vector3()) {
    const z = t * this.len;
    const a = this.a0 + this.kb * z;
    return out.set(this.r * Math.cos(a), this.r * Math.sin(a), z);
  }
}

export function Tool() {
  const result = useApp((s) => s.result);
  const params = useApp((s) => s.params);
  const exploded = useApp((s) => s.view.exploded);
  const g = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const ex = useRef(0);
  const D = params.D, R = D / 2, N = params.N, L = params.overhang;
  const fluteLen = Math.min(L - 4, Math.max(3 * D, 20));
  const kb = (2 * Math.tan((params.helixDeg * Math.PI) / 180)) / D;

  const flutes = useMemo(() => {
    const pitch = (2 * Math.PI) / N;
    return Array.from({ length: N }, (_, j) => new THREE.TubeGeometry(new Helix(R * 0.86, fluteLen, -j * pitch, kb), 64, R * 0.16, 6, false));
  }, [N, R, fluteLen, kb]);

  useFrame((_, dt) => {
    ex.current += ((exploded ? 1 : 0) - ex.current) * Math.min(1, dt * 4);
    if (!result || !g.current || !spin.current) return;
    const s = instantState(result, playback.station, playback.phi);
    g.current.position.set(s.tool.x, s.tool.y, s.tool.zTip + ex.current * 60);
    toolPose.x = s.tool.x; toolPose.y = s.tool.y; toolPose.zTip = s.tool.zTip; toolPose.overhang = result.params.overhang;
    // tooth 0 at immersion φ sits at machine angle atan2(s·cosφ, s·sinφ) = base − φ
    const base = s.pass.feedSign === 1 ? Math.PI / 2 : -Math.PI / 2;
    spin.current.rotation.z = base - playback.phi;
  });

  return (
    <group ref={g}>
      <group ref={spin}>
        <ZCyl p={[0, 0, fluteLen / 2]} r={R * 0.72} h={fluteLen} m={carbide} seg={24} />
        {flutes.map((geo, j) => (
          <mesh key={j} geometry={geo}>
            <meshStandardMaterial {...carbide} color={j === 0 ? '#f59e0b' : '#a7b1bd'} />
          </mesh>
        ))}
        <ZCyl p={[0, 0, (fluteLen + L) / 2]} r={R * 0.98} h={L - fluteLen} m={carbide} seg={24} />
        {/* collet nut + holder body (gauge length 70 mm) */}
        <ZCyl p={[0, 0, L + 12]} r={R + 3} r2={R + 12} h={24} m={holderM} />
        <ZCyl p={[0, 0, L + 34]} r={R + 12} h={20} m={holderM} />
        <ZCyl p={[0, 0, L + 52]} r={31} h={16} m={{ color: '#334155', metalness: 0.6, roughness: 0.4 }} />
        <ZCyl p={[0, 0, L + 65]} r={20} r2={14} h={10} m={holderM} />
      </group>
    </group>
  );
}
