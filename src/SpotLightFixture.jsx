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
      {/* ── Spot ışığı (gerçek ışık kaynağı, parlaklık ekler) ── */}
      <spotLight
        position={[0, 0, 0]}
        angle={Math.PI / 6}
        penumbra={0.6}
        intensity={intensity * 8}
        color={color}
        distance={80}
        castShadow={false}
        target-position={[0, -100, 0]}
      />
    </group>
  )
}
