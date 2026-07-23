"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";

function SpiderWebGeometry() {
  const meshRef = useRef<THREE.Group>(null);
  const { pointer } = useThree();

  // Create web sphere geometry
  const webLines = useMemo(() => {
    const lines: { start: THREE.Vector3; end: THREE.Vector3 }[] = [];

    // Radial lines from center
    const radialCount = 16;
    const ringCount = 5;
    const maxRadius = 2;

    for (let i = 0; i < radialCount; i++) {
      const angle = (i / radialCount) * Math.PI * 2;
      const x = Math.cos(angle) * maxRadius;
      const y = Math.sin(angle) * maxRadius;
      lines.push({
        start: new THREE.Vector3(0, 0, 0),
        end: new THREE.Vector3(x, y, 0),
      });
    }

    // Concentric rings
    for (let ring = 1; ring <= ringCount; ring++) {
      const radius = (ring / ringCount) * maxRadius;
      const segments = 32;
      for (let i = 0; i < segments; i++) {
        const a1 = (i / segments) * Math.PI * 2;
        const a2 = ((i + 1) / segments) * Math.PI * 2;
        lines.push({
          start: new THREE.Vector3(
            Math.cos(a1) * radius,
            Math.sin(a1) * radius,
            Math.sin(a1 * 3 + ring) * 0.15
          ),
          end: new THREE.Vector3(
            Math.cos(a2) * radius,
            Math.sin(a2) * radius,
            Math.sin(a2 * 3 + ring) * 0.15
          ),
        });
      }
    }

    return lines;
  }, []);

  // Create spider emblem shape
  const spiderShape = useMemo(() => {
    const shape = new THREE.Shape();

    // Spider body - central oval
    const bodyPoints = 32;
    for (let i = 0; i <= bodyPoints; i++) {
      const angle = (i / bodyPoints) * Math.PI * 2;
      const x = Math.cos(angle) * 0.25;
      const y = Math.sin(angle) * 0.4;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }

    return shape;
  }, []);

  useFrame((state) => {
    if (!meshRef.current) return;

    // Slow continuous rotation
    meshRef.current.rotation.z += 0.002;
    meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.15;

    // Subtle mouse response
    meshRef.current.rotation.x = pointer.y * 0.15;
    meshRef.current.rotation.y += pointer.x * 0.15;
  });

  return (
    <group ref={meshRef}>
      {/* Web lines */}
      {webLines.map((line, i) => {
        const points = [line.start, line.end];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        return (
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error — R3F line element conflicts with SVG line type
          <line key={i} geometry={geometry}>
            <lineBasicMaterial
              color="#E23636"
              transparent
              opacity={0.4 + Math.random() * 0.3}
              linewidth={1}
            />
          </line>
        );
      })}

      {/* Central spider emblem */}
      <mesh position={[0, 0, 0.1]}>
        <shapeGeometry args={[spiderShape]} />
        <meshBasicMaterial color="#E23636" transparent opacity={0.9} />
      </mesh>

      {/* Spider head */}
      <mesh position={[0, 0.55, 0.1]}>
        <circleGeometry args={[0.15, 16]} />
        <meshBasicMaterial color="#E23636" transparent opacity={0.9} />
      </mesh>

      {/* Spider legs - 8 legs radiating out */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const legLength = 0.8 + Math.random() * 0.3;
        const midAngle = angle + (i % 2 === 0 ? 0.3 : -0.3);

        const points = [
          new THREE.Vector3(
            Math.cos(angle) * 0.2,
            Math.sin(angle) * 0.35,
            0.1
          ),
          new THREE.Vector3(
            Math.cos(midAngle) * legLength * 0.6,
            Math.sin(midAngle) * legLength * 0.6,
            0.1
          ),
          new THREE.Vector3(
            Math.cos(angle) * legLength,
            Math.sin(angle) * legLength,
            0.1
          ),
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        return (
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error — R3F line element conflicts with SVG line type
          <line key={`leg-${i}`} geometry={geometry}>
            <lineBasicMaterial color="#E23636" transparent opacity={0.85} linewidth={2} />
          </line>
        );
      })}

      {/* Outer glow ring */}
      <mesh position={[0, 0, -0.05]}>
        <ringGeometry args={[1.8, 2.1, 64]} />
        <meshBasicMaterial
          color="#E23636"
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Inner glow */}
      <mesh position={[0, 0, -0.02]}>
        <circleGeometry args={[0.8, 32]} />
        <meshBasicMaterial
          color="#E23636"
          transparent
          opacity={0.08}
        />
      </mesh>
    </group>
  );
}

export default function SpiderEmblem3D() {
  return (
    <div
      className="absolute z-10 pointer-events-auto"
      style={{
        width: "min(400px, 50vw)",
        height: "min(400px, 50vw)",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        style={{ background: "transparent" }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[5, 5, 5]} intensity={0.8} color="#E23636" />
        <Float speed={2} rotationIntensity={0.2} floatIntensity={0.3}>
          <SpiderWebGeometry />
        </Float>
      </Canvas>
    </div>
  );
}
