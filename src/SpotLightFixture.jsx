import React, { useRef } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"

/**
 * SpotLightFixture — Sahnede görünür silindirik spot ışığı cismi.
 *
 * Props:
 *   lightPos   : [x, y, z]  — directionalLight'ın konumu (ışık kaynağının pozisyonu)
 *   intensity  : number     — parlaklık (emissive şiddetini ayarlar)
 *   target     : [x, y, z]  — ışığın baktığı nokta (varsayılan: [0, 0, 0])
 *   color      : string     — ışık rengi (varsayılan: "#fffbe6")
 *   height     : number     — silindir yüksekliği (varsayılan: 3)
 *   radius     : number     — silindir yarıçapı (varsayılan: 0.8)
 */
export default function SpotLightFixture({
  lightPos = [10, 30, 10],
  intensity = 1.5,
  target = [0, 0, 0],
  color = "#fffbe6",
  height = 3,
  radius = 0.8,
}) {
  const groupRef = useRef()

  // Silindir, her frame ışık pozisyonuna bakacak (hedef noktaya yöneliyor)
  useFrame(() => {
    if (groupRef.current) {
      const from = new THREE.Vector3(...lightPos)
      const to = new THREE.Vector3(...target)
      const dir = new THREE.Vector3().subVectors(to, from).normalize()

      // Silindirin konumu
      groupRef.current.position.set(from.x, from.y, from.z)

      // Silindiri hedef noktaya doğru döndür
      // Silindirin varsayılan ekseni Y yukarı → hedef yönüne hizala
      const up = new THREE.Vector3(0, 1, 0)
      const quat = new THREE.Quaternion().setFromUnitVectors(up, dir)
      groupRef.current.quaternion.copy(quat)
    }
  })

  // Emissive şiddeti ışık yoğunluğuyla orantılı
  const emissiveIntensity = Math.max(0.5, intensity * 1.5)

  return (
    <group ref={groupRef}>
      {/* ── Ana Gövde (koyu metal silindir) ── */}
      <mesh position={[0, height * 0.3, 0]}>
        <cylinderGeometry args={[radius * 0.6, radius, height * 0.6, 16]} />
        <meshStandardMaterial
          color="#f5e6a3"
          metalness={0.7}
          roughness={0.35}
        />
      </mesh>

      {/* ── Lens / Cam (parıltılı ışık yüzeyi) ── */}
      <mesh position={[0, -height * 0.05, 0]}>
        <cylinderGeometry args={[radius * 1.05, radius * 0.9, height * 0.15, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          transparent
          opacity={0.92}
          toneMapped={false}
        />
      </mesh>

      {/* ── Spot ışığı (gerçek ışık kaynağı, opsiyonel parlaklık ekler) ── */}
      <spotLight
        position={[0, -height * 0.1, 0]}
        angle={Math.PI / 6}
        penumbra={0.6}
        intensity={intensity * 8}
        color={color}
        distance={80}
        castShadow={false}
        target-position={[0, -100, 0]}
      />

      {/* ── Montaj halka ── */}
      <mesh position={[0, height * 0.6, 0]}>
        <torusGeometry args={[radius * 0.35, 0.08, 8, 16]} />
        <meshStandardMaterial color="#333" metalness={0.8} roughness={0.4} />
      </mesh>
    </group>
  )
}
