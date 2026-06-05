import React, { useState, useMemo, useRef, useEffect } from "react"
import * as THREE from "three"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls, Text, Billboard } from "@react-three/drei"
import { getGroundTexture, getCubeTexture } from "./utils"
import SpotLightFixture from "./SpotLightFixture"

// ─── SABİTLER ────────────────────────────────────────────────────────────────
const CUBE_SIZE = 2
const CUBE1_COLOR = '#d81b60'
const CUBE2_COLOR = '#00acc1'
const CUBE1_ARROW = '#ff4081'
const CUBE2_ARROW = '#00e5ff'

// ─── GÜNEŞ IŞIĞI ─────────────────────────────────────────────────────────────
function SunLight({ lightAngle, intensity }) {
  const lightRef = useRef()
  const { scene } = useThree()

  useEffect(() => {
    if (lightRef.current) {
      scene.add(lightRef.current.target)
      return () => {
        if (lightRef.current) scene.remove(lightRef.current.target)
      }
    }
  }, [scene])

  const rad = lightAngle * Math.PI / 180
  const lightX = Math.cos(rad) * 60
  const lightZ = Math.sin(rad) * 60

  useEffect(() => {
    if (lightRef.current) {
      lightRef.current.target.position.set(0, 0, 0)
      lightRef.current.target.updateMatrixWorld()
    }
  }, [lightAngle])

  return (
    <directionalLight
      ref={lightRef}
      position={[lightX, 60, lightZ]}
      intensity={intensity}
      castShadow
      shadow-camera-left={-50}
      shadow-camera-right={50}
      shadow-camera-top={50}
      shadow-camera-bottom={-50}
      shadow-camera-near={0.5}
      shadow-camera-far={200}
      shadow-mapSize={[2048, 2048]}
      shadow-bias={-0.001}
    />
  )
}

const ARENA_HALF = 25 // Yarı arena boyutu (toplam 50x50)
const WALL_HEIGHT = 3
const WALL_THICKNESS = 0.5

// ─── ZEMİN ───────────────────────────────────────────────────────────────────
function Ground() {
  const texture = useMemo(() => getGroundTexture(15, 15), [])
  return (
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
      <boxGeometry args={[ARENA_HALF * 2, ARENA_HALF * 2, 1]} />
      <meshStandardMaterial color="#ffffff" map={texture} />
    </mesh>
  )
}

// ─── DUVARLAR ────────────────────────────────────────────────────────────────
function Walls() {
  const wallColor = '#555555'
  const h = WALL_HEIGHT
  const half = ARENA_HALF
  const t = WALL_THICKNESS
  return (
    <group>
      {/* Ön duvar (+Z) */}
      <mesh position={[0, h / 2, half]} castShadow receiveShadow>
        <boxGeometry args={[half * 2 + t * 2, h, t]} />
        <meshStandardMaterial color={wallColor} metalness={0.3} roughness={0.7} />
      </mesh>
      {/* Arka duvar (-Z) */}
      <mesh position={[0, h / 2, -half]} castShadow receiveShadow>
        <boxGeometry args={[half * 2 + t * 2, h, t]} />
        <meshStandardMaterial color={wallColor} metalness={0.3} roughness={0.7} />
      </mesh>
      {/* Sol duvar (-X) */}
      <mesh position={[-half, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[t, h, half * 2]} />
        <meshStandardMaterial color={wallColor} metalness={0.3} roughness={0.7} />
      </mesh>
      {/* Sağ duvar (+X) */}
      <mesh position={[half, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[t, h, half * 2]} />
        <meshStandardMaterial color={wallColor} metalness={0.3} roughness={0.7} />
      </mesh>
    </group>
  )
}

// ─── HIZ VEKTÖR OKU ──────────────────────────────────────────────────────────
function VelocityArrow({ posX, posZ, vx, vz, color, label }) {
  const speed = Math.sqrt(vx * vx + vz * vz)
  if (speed < 0.1) return null

  const angle = Math.atan2(-vz, vx)
  const length = Math.max(1.5, speed / 2)
  const headLength = Math.min(0.7, length * 0.22)
  const shaftLength = length - headLength

  return (
    <group position={[posX, CUBE_SIZE + 0.3, posZ]} rotation={[0, angle, 0]}>
      {/* Gövde */}
      <mesh position={[shaftLength / 2, 0, 0]}>
        <boxGeometry args={[shaftLength, 0.14, 0.14]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} toneMapped={false} />
      </mesh>
      {/* Ok ucu */}
      <mesh position={[shaftLength + headLength / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.28, headLength, 10]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} toneMapped={false} />
      </mesh>
      {/* Etiket */}
      <Billboard position={[length / 2, 0.6, 0]}>
        <Text fontSize={0.32} color={color} fontWeight="bold" outlineWidth={0.02} outlineColor="#000">
          {label}
        </Text>
      </Billboard>
    </group>
  )
}

// ─── 3D SAHNE ────────────────────────────────────────────────────────────────
function Scene({
  cube1, cube2, setCube1, setCube2,
  started, collisionType,
  simData, setSimData,
  collided, setCollided,
  lightAngle, lightIntensity,
}) {
  const { camera, gl } = useThree()
  const controlsRef = useRef()
  const draggingRef = useRef(null)
  const group1Ref = useRef()
  const group2Ref = useRef()

  // Simülasyon ref'leri (useFrame performansı için)
  const pos1 = useRef({ x: 0, z: 0 })
  const pos2 = useRef({ x: 0, z: 0 })
  const vel1 = useRef({ x: 0, z: 0 })
  const vel2 = useRef({ x: 0, z: 0 })
  const collidedRef = useRef(false)
  const mergedRef = useRef(false)

  // Dokular
  const tex1 = useMemo(() => getCubeTexture(CUBE1_COLOR), [])
  const tex2 = useMemo(() => getCubeTexture(CUBE2_COLOR), [])

  // Raycasting düzlemi (y=0, zeminde)
  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])

  // SpotLight pozisyonu
  const spotPos = useMemo(() => [
    Math.cos(lightAngle * Math.PI / 180) * 60, 60,
    Math.sin(lightAngle * Math.PI / 180) * 60
  ], [lightAngle])

  // ── Simülasyon başlatma ──
  useEffect(() => {
    if (started) {
      pos1.current = { x: cube1.x, z: cube1.z }
      pos2.current = { x: cube2.x, z: cube2.z }

      const r1 = cube1.angle * Math.PI / 180
      vel1.current = { x: cube1.speed * Math.cos(r1), z: -cube1.speed * Math.sin(r1) }

      const r2 = cube2.angle * Math.PI / 180
      vel2.current = { x: cube2.speed * Math.cos(r2), z: -cube2.speed * Math.sin(r2) }

      collidedRef.current = false
      mergedRef.current = false
    }
  }, [started])

  // ── Sürükleme (Drag) yönetimi ──
  useEffect(() => {
    const onMove = (e) => {
      if (!draggingRef.current || started) return

      const rect = gl.domElement.getBoundingClientRect()
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      )
      const rc = new THREE.Raycaster()
      rc.setFromCamera(mouse, camera)
      const pt = new THREE.Vector3()
      rc.ray.intersectPlane(groundPlane, pt)
      if (!pt) return

      const limit = ARENA_HALF - CUBE_SIZE / 2 - WALL_THICKNESS
      const x = Math.max(-limit, Math.min(limit, pt.x))
      const z = Math.max(-limit, Math.min(limit, pt.z))

      if (draggingRef.current === 1) setCube1(p => ({ ...p, x, z }))
      else setCube2(p => ({ ...p, x, z }))
    }

    const onUp = () => {
      if (draggingRef.current) {
        draggingRef.current = null
        gl.domElement.style.cursor = 'default'
        if (controlsRef.current) controlsRef.current.enabled = true
      }
    }

    gl.domElement.addEventListener('pointermove', onMove)
    gl.domElement.addEventListener('pointerup', onUp)
    return () => {
      gl.domElement.removeEventListener('pointermove', onMove)
      gl.domElement.removeEventListener('pointerup', onUp)
    }
  }, [camera, gl, started, setCube1, setCube2, groundPlane])

  const startDrag = (id) => (e) => {
    if (started) return
    e.stopPropagation()
    draggingRef.current = id
    gl.domElement.style.cursor = 'grabbing'
    if (controlsRef.current) controlsRef.current.enabled = false
  }

  // ── Fizik döngüsü ──
  useFrame((_, delta) => {
    // Başlamadan önce: config'ten pozisyon güncelle
    if (!started) {
      if (group1Ref.current) group1Ref.current.position.set(cube1.x, 1, cube1.z)
      if (group2Ref.current) group2Ref.current.position.set(cube2.x, 1, cube2.z)
      return
    }

    const dt = Math.min(delta, 1 / 30)

    // Pozisyon güncelle
    pos1.current.x += vel1.current.x * dt
    pos1.current.z += vel1.current.z * dt
    pos2.current.x += vel2.current.x * dt
    pos2.current.z += vel2.current.z * dt

    // Duvar çarpışması
    const wallLimit = ARENA_HALF - CUBE_SIZE / 2 - WALL_THICKNESS
    const bounceWall = (pos, vel) => {
      if (pos.x > wallLimit) { pos.x = wallLimit; vel.x = -Math.abs(vel.x) }
      if (pos.x < -wallLimit) { pos.x = -wallLimit; vel.x = Math.abs(vel.x) }
      if (pos.z > wallLimit) { pos.z = wallLimit; vel.z = -Math.abs(vel.z) }
      if (pos.z < -wallLimit) { pos.z = -wallLimit; vel.z = Math.abs(vel.z) }
    }
    bounceWall(pos1.current, vel1.current)
    bounceWall(pos2.current, vel2.current)

    // Çarpışma tespiti
    if (!collidedRef.current) {
      const dx = pos2.current.x - pos1.current.x
      const dz = pos2.current.z - pos1.current.z
      const dist = Math.sqrt(dx * dx + dz * dz)

      if (dist < CUBE_SIZE) {
        collidedRef.current = true
        const nx = dist > 0.001 ? dx / dist : 1
        const nz = dist > 0.001 ? dz / dist : 0
        const m1 = cube1.mass, m2 = cube2.mass

        // Normal yöndeki hız bileşenleri
        const v1n = vel1.current.x * nx + vel1.current.z * nz
        const v2n = vel2.current.x * nx + vel2.current.z * nz

        if (collisionType === 'elastic') {
          // ── Esnek Çarpışma ──
          const v1n_new = ((m1 - m2) * v1n + 2 * m2 * v2n) / (m1 + m2)
          const v2n_new = ((m2 - m1) * v2n + 2 * m1 * v1n) / (m1 + m2)

          vel1.current.x += (v1n_new - v1n) * nx
          vel1.current.z += (v1n_new - v1n) * nz
          vel2.current.x += (v2n_new - v2n) * nx
          vel2.current.z += (v2n_new - v2n) * nz

          // Çakışmayı çöz
          const overlap = CUBE_SIZE - dist
          pos1.current.x -= nx * overlap / 2
          pos1.current.z -= nz * overlap / 2
          pos2.current.x += nx * overlap / 2
          pos2.current.z += nz * overlap / 2
        } else {
          // ── Esnek Olmayan Çarpışma ──
          const total = m1 + m2
          const cvx = (m1 * vel1.current.x + m2 * vel2.current.x) / total
          const cvz = (m1 * vel1.current.z + m2 * vel2.current.z) / total

          vel1.current = { x: cvx, z: cvz }
          vel2.current = { x: cvx, z: cvz }
          mergedRef.current = true

          // Birleşme noktası
          const cx = (pos1.current.x * m1 + pos2.current.x * m2) / total
          const cz = (pos1.current.z * m1 + pos2.current.z * m2) / total
          pos1.current = { x: cx - nx * 1.01, z: cz - nz * 1.01 }
          pos2.current = { x: cx + nx * 1.01, z: cz + nz * 1.01 }
        }

        setCollided(true)
      }
    }

    // Mesh pozisyon güncelle
    if (group1Ref.current) group1Ref.current.position.set(pos1.current.x, 1, pos1.current.z)
    if (group2Ref.current) group2Ref.current.position.set(pos2.current.x, 1, pos2.current.z)

    // UI için state güncelle
    setSimData({
      pos1: { ...pos1.current }, pos2: { ...pos2.current },
      vel1: { ...vel1.current }, vel2: { ...vel2.current },
    })
  })

  // ── Ok parametreleri hesapla ──
  let aPos1, aPos2, aVx1, aVz1, aVx2, aVz2, aSpd1, aSpd2

  if (started && simData) {
    aPos1 = simData.pos1; aPos2 = simData.pos2
    aVx1 = simData.vel1.x; aVz1 = simData.vel1.z
    aVx2 = simData.vel2.x; aVz2 = simData.vel2.z
    aSpd1 = Math.sqrt(aVx1 * aVx1 + aVz1 * aVz1)
    aSpd2 = Math.sqrt(aVx2 * aVx2 + aVz2 * aVz2)
  } else {
    aPos1 = { x: cube1.x, z: cube1.z }; aPos2 = { x: cube2.x, z: cube2.z }
    const r1 = cube1.angle * Math.PI / 180, r2 = cube2.angle * Math.PI / 180
    aVx1 = cube1.speed * Math.cos(r1); aVz1 = -cube1.speed * Math.sin(r1); aSpd1 = cube1.speed
    aVx2 = cube2.speed * Math.cos(r2); aVz2 = -cube2.speed * Math.sin(r2); aSpd2 = cube2.speed
  }

  return (
    <>
      <ambientLight intensity={0.6} />
      <SunLight lightAngle={lightAngle} intensity={lightIntensity} />
      <OrbitControls ref={controlsRef} makeDefault />
      <SpotLightFixture lightPos={spotPos} target={[0, 0, 0]} intensity={lightIntensity} />

      <Ground />
      <Walls />

      {/* ── Küp 1 (Pembe) ── */}
      <group ref={group1Ref} position={[cube1.x, 1, cube1.z]}>
        <mesh
          castShadow
          onPointerDown={startDrag(1)}
          onPointerEnter={() => { if (!started && !draggingRef.current) gl.domElement.style.cursor = 'grab' }}
          onPointerLeave={() => { if (!draggingRef.current) gl.domElement.style.cursor = 'default' }}
        >
          <boxGeometry args={[CUBE_SIZE, CUBE_SIZE, CUBE_SIZE]} />
          <meshStandardMaterial color="white" map={tex1} />
        </mesh>
        {/* Kütle etiketi */}
        <Billboard position={[0, 1.6, 0]}>
          <Text fontSize={0.45} color={CUBE1_COLOR} fontWeight="bold" outlineWidth={0.02} outlineColor="#000">
            {cube1.mass} kg
          </Text>
        </Billboard>
      </group>

      {/* ── Küp 2 (Cyan) ── */}
      <group ref={group2Ref} position={[cube2.x, 1, cube2.z]}>
        <mesh
          castShadow
          onPointerDown={startDrag(2)}
          onPointerEnter={() => { if (!started && !draggingRef.current) gl.domElement.style.cursor = 'grab' }}
          onPointerLeave={() => { if (!draggingRef.current) gl.domElement.style.cursor = 'default' }}
        >
          <boxGeometry args={[CUBE_SIZE, CUBE_SIZE, CUBE_SIZE]} />
          <meshStandardMaterial color="white" map={tex2} />
        </mesh>
        <Billboard position={[0, 1.6, 0]}>
          <Text fontSize={0.45} color={CUBE2_COLOR} fontWeight="bold" outlineWidth={0.02} outlineColor="#000">
            {cube2.mass} kg
          </Text>
        </Billboard>
      </group>

      {/* ── Hız Okları ── */}
      <VelocityArrow posX={aPos1.x} posZ={aPos1.z} vx={aVx1} vz={aVz1} color={CUBE1_ARROW} label={`${aSpd1.toFixed(1)} m/s`} />
      <VelocityArrow posX={aPos2.x} posZ={aPos2.z} vx={aVx2} vz={aVz2} color={CUBE2_ARROW} label={`${aSpd2.toFixed(1)} m/s`} />
    </>
  )
}

// ─── ANA BİLEŞEN ────────────────────────────────────────────────────────────
export default function CollisionMomentum() {
  const [cube1, setCube1] = useState({ x: -8, z: 0, mass: 25, speed: 8, angle: 0 })
  const [cube2, setCube2] = useState({ x: 8, z: 0, mass: 25, speed: 8, angle: 180 })
  const [collisionType, setCollisionType] = useState('elastic')
  const [started, setStarted] = useState(false)
  const [collided, setCollided] = useState(false)
  const [simData, setSimData] = useState(null)

  const [lightAngle, setLightAngle] = useState(45)
  const [lightIntensity, setLightIntensity] = useState(1.5)
  const [lightPanelOpen, setLightPanelOpen] = useState(false)

  const handleStart = () => { setCollided(false); setSimData(null); setStarted(true) }
  const handleReset = () => { setStarted(false); setCollided(false); setSimData(null) }

  // ── Momentum hesaplamaları ──
  const p1_before = cube1.mass * cube1.speed
  const p2_before = cube2.mass * cube2.speed

  // Çarpışma öncesi toplam momentum vektörel
  const r1 = cube1.angle * Math.PI / 180, r2 = cube2.angle * Math.PI / 180
  const totalPx_before = cube1.mass * cube1.speed * Math.cos(r1) + cube2.mass * cube2.speed * Math.cos(r2)
  const totalPz_before = cube1.mass * cube1.speed * Math.sin(r1) + cube2.mass * cube2.speed * Math.sin(r2)
  const totalP_before = Math.sqrt(totalPx_before ** 2 + totalPz_before ** 2)

  let speed1_now = cube1.speed, speed2_now = cube2.speed
  let p1_now = p1_before, p2_now = p2_before
  let totalP_now = totalP_before

  if (started && simData) {
    speed1_now = Math.sqrt(simData.vel1.x ** 2 + simData.vel1.z ** 2)
    speed2_now = Math.sqrt(simData.vel2.x ** 2 + simData.vel2.z ** 2)
    p1_now = cube1.mass * speed1_now
    p2_now = cube2.mass * speed2_now
    const tPx = cube1.mass * simData.vel1.x + cube2.mass * simData.vel2.x
    const tPz = cube1.mass * simData.vel1.z + cube2.mass * simData.vel2.z
    totalP_now = Math.sqrt(tPx ** 2 + tPz ** 2)
  }

  const maxP = 1000 // max: 50kg × 20m/s = 1000

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", background: "#000000" }}>

      {/* ─── KONTROL PANELİ ───────────────────────────────────────────── */}
      <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10, fontFamily: 'sans-serif' }}>
        <div style={panelStyle}>
          <h3 style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#000', textAlign: 'center' }}>
            COLLISION & MOMENTUM
          </h3>

          {/* ── KÜP 1 KARTI ── */}
          <div style={cardStyle(CUBE1_COLOR, collided)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: CUBE1_COLOR }} />
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#222' }}>CUBE 1 (PINK)</span>
            </div>

            <label style={lblStyle}>POSITION X: {cube1.x.toFixed(1)}</label>
            <input type="range" min={-22} max={22} step={0.5} value={cube1.x}
              onChange={e => setCube1(p => ({ ...p, x: +e.target.value }))}
              disabled={started} style={{ width: '100%', marginBottom: 6 }} />

            <label style={lblStyle}>POSITION Z: {cube1.z.toFixed(1)}</label>
            <input type="range" min={-22} max={22} step={0.5} value={cube1.z}
              onChange={e => setCube1(p => ({ ...p, z: +e.target.value }))}
              disabled={started} style={{ width: '100%', marginBottom: 6 }} />

            <label style={lblStyle}>MASS: {cube1.mass} kg</label>
            <input type="range" min={1} max={50} step={1} value={cube1.mass}
              onChange={e => setCube1(p => ({ ...p, mass: +e.target.value }))}
              disabled={started} style={{ width: '100%', marginBottom: 6 }} />

            <label style={lblStyle}>SPEED: {cube1.speed} m/s</label>
            <input type="range" min={0} max={20} step={0.5} value={cube1.speed}
              onChange={e => setCube1(p => ({ ...p, speed: +e.target.value }))}
              disabled={started} style={{ width: '100%', marginBottom: 6 }} />

            <label style={lblStyle}>DIRECTION: {cube1.angle}°</label>
            <input type="range" min={0} max={360} step={1} value={cube1.angle}
              onChange={e => setCube1(p => ({ ...p, angle: +e.target.value }))}
              disabled={started} style={{ width: '100%', marginBottom: 6 }} />

            {/* Momentum göstergesi */}
            <div style={{ marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label style={{ ...lblStyle, color: CUBE1_COLOR }}>MOMENTUM:</label>
                <label style={{ ...lblStyle, color: CUBE1_COLOR }}>{p1_now.toFixed(1)} / 1000</label>
              </div>
              <div style={barBgStyle}>
                <div style={{ ...barFillStyle, width: `${(p1_now / maxP) * 100}%`, background: CUBE1_COLOR }} />
              </div>
            </div>
          </div>

          {/* ── KÜP 2 KARTI ── */}
          <div style={cardStyle(CUBE2_COLOR, collided)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: CUBE2_COLOR }} />
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#222' }}>CUBE 2 (CYAN)</span>
            </div>

            <label style={lblStyle}>POSITION X: {cube2.x.toFixed(1)}</label>
            <input type="range" min={-22} max={22} step={0.5} value={cube2.x}
              onChange={e => setCube2(p => ({ ...p, x: +e.target.value }))}
              disabled={started} style={{ width: '100%', marginBottom: 6 }} />

            <label style={lblStyle}>POSITION Z: {cube2.z.toFixed(1)}</label>
            <input type="range" min={-22} max={22} step={0.5} value={cube2.z}
              onChange={e => setCube2(p => ({ ...p, z: +e.target.value }))}
              disabled={started} style={{ width: '100%', marginBottom: 6 }} />

            <label style={lblStyle}>MASS: {cube2.mass} kg</label>
            <input type="range" min={1} max={50} step={1} value={cube2.mass}
              onChange={e => setCube2(p => ({ ...p, mass: +e.target.value }))}
              disabled={started} style={{ width: '100%', marginBottom: 6 }} />

            <label style={lblStyle}>SPEED: {cube2.speed} m/s</label>
            <input type="range" min={0} max={20} step={0.5} value={cube2.speed}
              onChange={e => setCube2(p => ({ ...p, speed: +e.target.value }))}
              disabled={started} style={{ width: '100%', marginBottom: 6 }} />

            <label style={lblStyle}>DIRECTION: {cube2.angle}°</label>
            <input type="range" min={0} max={360} step={1} value={cube2.angle}
              onChange={e => setCube2(p => ({ ...p, angle: +e.target.value }))}
              disabled={started} style={{ width: '100%', marginBottom: 6 }} />

            <div style={{ marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label style={{ ...lblStyle, color: CUBE2_COLOR }}>MOMENTUM:</label>
                <label style={{ ...lblStyle, color: CUBE2_COLOR }}>{p2_now.toFixed(1)} / 1000</label>
              </div>
              <div style={barBgStyle}>
                <div style={{ ...barFillStyle, width: `${(p2_now / maxP) * 100}%`, background: CUBE2_COLOR }} />
              </div>
            </div>
          </div>

          {/* ── ÇARPIŞMA TÜRÜ ── */}
          <div style={{ background: '#f9f9f9', padding: '10px', borderRadius: '8px' }}>
            <label style={{ ...lblStyle, marginBottom: 6, display: 'block' }}>COLLISION TYPE</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                id="btn-elastic"
                onClick={() => setCollisionType('elastic')}
                disabled={started}
                style={toggleBtnStyle(collisionType === 'elastic', '#4caf50')}
              >
                ELASTIC
              </button>
              <button
                id="btn-inelastic"
                onClick={() => setCollisionType('inelastic')}
                disabled={started}
                style={toggleBtnStyle(collisionType === 'inelastic', '#ff9800')}
              >
                INELASTIC
              </button>
            </div>
          </div>

          {/* ── TOPLAM MOMENTUM ── */}
          <div style={{
            background: collided ? '#e8f5e9' : '#f9f9f9',
            padding: '10px', borderRadius: '8px',
            border: collided ? '2px solid #4caf50' : '2px solid transparent',
            transition: 'all 0.3s',
          }}>
            <label style={{ ...lblStyle, color: collided ? '#2e7d32' : '#333' }}>
              TOTAL MOMENTUM (VECTOR)
            </label>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: collided ? '#2e7d32' : '#333', marginTop: 4 }}>
              {totalP_now.toFixed(2)} kg·m/s
            </div>
            {collided && (
              <div style={{ fontSize: '10px', color: '#666', marginTop: 4 }}>
                Before: {totalP_before.toFixed(2)} kg·m/s
              </div>
            )}
          </div>

          {/* ── Esnek olmayan: Ortak momentum ── */}
          {collided && collisionType === 'inelastic' && simData && (
            <div style={{
              background: '#fff3e0', padding: '10px', borderRadius: '8px',
              border: '2px solid #ff9800',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#ff9800' }} />
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#e65100' }}>MERGED SYSTEM</span>
              </div>
              <div style={{ fontSize: '11px', color: '#555', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={rowStyle}>
                  <span>Combined Mass:</span>
                  <span style={{ fontWeight: 700 }}>{(cube1.mass + cube2.mass)} kg</span>
                </div>
                <div style={rowStyle}>
                  <span>Combined Speed:</span>
                  <span style={{ fontWeight: 700 }}>{speed1_now.toFixed(2)} m/s</span>
                </div>
                <div style={rowStyle}>
                  <span>Combined Momentum:</span>
                  <span style={{ fontWeight: 700, color: '#e65100' }}>{totalP_now.toFixed(2)} kg·m/s</span>
                </div>
              </div>
            </div>
          )}

          {/* ── START / RESET ── */}
          {!started ? (
            <button id="btn-start" onClick={handleStart} style={startBtnStyle}>START</button>
          ) : (
            <button id="btn-reset" onClick={handleReset} style={resetBtnStyle}>RESET</button>
          )}
        </div>
      </div>

      {/* ─── IŞIK KONTROLLERİ BUTONU (SAĞ ÜST) ────────────────────────── */}
      <button
        onClick={() => setLightPanelOpen(!lightPanelOpen)}
        style={{
          position: 'absolute',
          top: '78px',
          right: '24px',
          zIndex: 1000,
          width: '48px',
          height: '48px',
          borderRadius: '14px',
          border: 'none',
          background: lightPanelOpen ? 'rgba(255,200,0,0.9)' : 'rgba(15, 15, 20, 0.85)',
          backdropFilter: 'blur(12px)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
          fontSize: '22px',
        }}
        title="Light Controls"
      >
        ☀️
      </button>

      {lightPanelOpen && (
        <div style={{
          position: 'absolute',
          top: '136px',
          right: '24px',
          zIndex: 999,
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(8px)',
          padding: '16px',
          borderRadius: '12px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
          border: '1px solid #eee',
          width: '220px',
          fontFamily: 'sans-serif',
        }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#333', textAlign: 'center' }}>LIGHT CONTROLS</h4>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>ANGLE: {lightAngle}°</label>
          <input type="range" min="0" max="360" step="1" value={lightAngle} onChange={e => setLightAngle(Number(e.target.value))} style={{ width: '100%', marginBottom: '10px' }} />
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>INTENSITY: {lightIntensity.toFixed(1)}</label>
          <input type="range" min="0" max="3" step="0.1" value={lightIntensity} onChange={e => setLightIntensity(Number(e.target.value))} style={{ width: '100%' }} />
        </div>
      )}

      {/* ─── 3D SAHNE ─────────────────────────────────────────────────── */}
      <Canvas shadows camera={{ position: [35, 28, 35], fov: 40 }} style={{ background: "#000000" }}>
        <color attach="background" args={["#000000"]} />
        <Scene
          cube1={cube1} cube2={cube2}
          setCube1={setCube1} setCube2={setCube2}
          started={started} collisionType={collisionType}
          simData={simData} setSimData={setSimData}
          collided={collided} setCollided={setCollided}
          lightAngle={lightAngle} lightIntensity={lightIntensity}
        />
      </Canvas>
    </div>
  )
}

/* ─── STİLLER ─────────────────────────────────────────────────────────────── */

const panelStyle = {
  background: 'rgba(255,255,255,0.7)',
  backdropFilter: 'blur(6px)',
  padding: '20px',
  borderRadius: '12px',
  boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  border: '1px solid #eee',
  width: '285px',
  color: '#333',
  maxHeight: 'calc(100vh - 120px)',
  overflowY: 'auto',
}

const cardStyle = (color, finished) => ({
  background: finished ? '#f5f5f5' : '#f9f9f9',
  padding: '10px',
  borderRadius: '8px',
  borderLeft: `4px solid ${color}`,
})

const lblStyle = {
  display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#333', marginBottom: 2,
}

const barBgStyle = {
  width: '100%', background: '#e0e0e0', height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 3,
}

const barFillStyle = {
  height: '100%', borderRadius: 3, transition: 'width 0.15s',
}

const rowStyle = {
  display: 'flex', justifyContent: 'space-between', fontSize: '11px',
}

const toggleBtnStyle = (active, color) => ({
  flex: 1, padding: '8px', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '11px',
  cursor: 'pointer',
  background: active ? color : '#e0e0e0',
  color: active ? '#fff' : '#666',
  transition: 'all 0.2s',
})

const startBtnStyle = {
  padding: '14px', cursor: 'pointer', background: '#000', color: '#fff',
  border: 'none', borderRadius: '8px', fontWeight: 'bold',
}

const resetBtnStyle = {
  padding: '14px', cursor: 'pointer', background: '#eee', color: '#000',
  border: '1px solid #ddd', borderRadius: '8px', fontWeight: 'bold',
}
