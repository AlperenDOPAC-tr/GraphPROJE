import React, { useState, useMemo, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, Text } from "@react-three/drei"
import * as THREE from "three"
import { LightBulbIcon } from "./Icons"
import SpotLightFixture from "./SpotLightFixture"

function Spring({ height, radius, turns, thickness }) {
  const geometry = useMemo(() => {
    const points = []
    const segments = 100
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const y = t * height
      const angle = t * turns * Math.PI * 2
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      points.push(new THREE.Vector3(x, y, z))
    }
    const curve = new THREE.CatmullRomCurve3(points)
    return new THREE.TubeGeometry(curve, segments, thickness, 8, false)
  }, [height, radius, turns, thickness])
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />
    </mesh>
  )
}

function CheckerGround() {
  const tex = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512; canvas.height = 512
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, 512, 512)
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 256, 256); ctx.fillRect(256, 256, 256, 256)
    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(20, 20); texture.anisotropy = 16
    return texture
  }, [])
  return (
    <mesh position={[0, -0.5, 0]} receiveShadow>
      <boxGeometry args={[80, 1, 80]} />
      <meshStandardMaterial map={tex} roughness={0.8} metalness={0.1} />
    </mesh>
  )
}

const getFluidColor = (d) => {
  if (d < 1000) return new THREE.Color().lerpColors(new THREE.Color("#fde047"), new THREE.Color("#3b82f6"), (d - 500) / 500)
  if (d < 1500) return new THREE.Color().lerpColors(new THREE.Color("#3b82f6"), new THREE.Color("#a855f7"), (d - 1000) / 500)
  return new THREE.Color().lerpColors(new THREE.Color("#a855f7"), new THREE.Color("#ef4444"), Math.min(1, (d - 1500) / 500))
}

// Animated gas particles inside cylinder
function GasParticles({ count, temperature, cylinderRadius, pistonY }) {
  const meshRef = useRef()
  const velocities = useRef([])
  const positions = useRef([])
  const initialized = useRef(false)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const speedFactor = Math.sqrt(temperature / 300)

  if (!initialized.current) {
    for (let i = 0; i < count; i++) {
      const r = Math.random() * (cylinderRadius - 0.4)
      const angle = Math.random() * Math.PI * 2
      positions.current.push(Math.cos(angle) * r, Math.random() * 8 + 0.5, Math.sin(angle) * r)
      velocities.current.push((Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.08)
    }
    initialized.current = true
  }

  useFrame(() => {
    if (!meshRef.current) return
    const sf = speedFactor
    const maxR = cylinderRadius - 0.4
    const py = pistonY
    for (let i = 0; i < count; i++) {
      const bi = i * 3
      positions.current[bi]     += velocities.current[bi]     * sf
      positions.current[bi + 1] += velocities.current[bi + 1] * sf
      positions.current[bi + 2] += velocities.current[bi + 2] * sf
      const rx = positions.current[bi]; const rz = positions.current[bi + 2]
      const dist = Math.sqrt(rx * rx + rz * rz)
      if (dist > maxR) {
        velocities.current[bi] *= -1; velocities.current[bi + 2] *= -1
        positions.current[bi] = (rx / dist) * (maxR - 0.01)
        positions.current[bi + 2] = (rz / dist) * (maxR - 0.01)
      }
      if (positions.current[bi + 1] < 0.3) { velocities.current[bi + 1] = Math.abs(velocities.current[bi + 1]); positions.current[bi + 1] = 0.31 }
      if (positions.current[bi + 1] > py - 0.3) { velocities.current[bi + 1] = -Math.abs(velocities.current[bi + 1]); positions.current[bi + 1] = py - 0.31 }
      dummy.position.set(positions.current[bi], positions.current[bi + 1], positions.current[bi + 2])
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  const t = Math.min(1, (temperature - 100) / 900)
  const particleColor = new THREE.Color().lerpColors(new THREE.Color("#60a5fa"), new THREE.Color("#ef4444"), t)
  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <sphereGeometry args={[0.18, 8, 8]} />
      <meshStandardMaterial color={particleColor} emissive={particleColor} emissiveIntensity={0.5} />
    </instancedMesh>
  )
}

// Curved tube via CatmullRom (from balloon to U-tube left arm)
function CurvedPipe({ points, radius = 0.25, color = "#64748b" }) {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)))
    return new THREE.TubeGeometry(curve, 40, radius, 12, false)
  }, [points, radius])
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
    </mesh>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function PressureSim() {
  const [activeTab, setActiveTab] = useState('solid')
  const [fluidMode, setFluidMode] = useState('sensor')
  const [gasMode, setGasMode] = useState('ideal')

  // Solid
  const [mass, setMass] = useState(50)
  const [sideLength, setSideLength] = useState(2.0)
  const [solidDensity, setSolidDensity] = useState(2.0)

  // Fluid
  const [fluidDensity, setFluidDensity] = useState(1000)
  const [sensorY, setSensorY] = useState(5.0)
  const [uFluid1Density, setUFluid1Density] = useState(1000)
  const [uFluid2Density, setUFluid2Density] = useState(800)

  // Gas — Cylinder (left, independent)
  const [gasTemp, setGasTemp] = useState(300)
  const [gasMoles, setGasMoles] = useState(1.0)
  const [pistonH, setPistonH] = useState(10.0)

  // Gas — Manometer (right, independent)
  const [balloonPressure, setBalloonPressure] = useState(150000) // Pa
  const [altitude, setAltitude] = useState(0)                   // m
  const [manoFluidDensity, setManoFluidDensity] = useState(13600) // Hg default

  // Light
  const [lightPanelOpen, setLightPanelOpen] = useState(false)
  const [lightDir, setLightDir] = useState(45)
  const [lightInt, setLightInt] = useState(1.5)

  const g = 9.8; const R = 8.314

  // Solid physics
  const force = mass * g
  const area = sideLength * sideLength
  const solidPressure = force / area
  const solidCompression = (solidPressure / 980) * 6.0
  const currentSpringHeight = 8.0 - solidCompression
  const plateThickness = 0.4
  const plateY = currentSpringHeight + plateThickness / 2
  const boxHeight = Math.min(20.0, Math.max(0.5, mass / (solidDensity * area * 1.6)))
  const boxY = currentSpringHeight + plateThickness + boxHeight / 2
  const solidColor = new THREE.Color().lerpColors(new THREE.Color("#3b82f6"), new THREE.Color("#ef4444"), solidPressure / 980)

  // Fluid physics
  const containerFluidHeight = 10
  const sensorDepth = containerFluidHeight - sensorY
  const fluidPressure = fluidDensity * g * sensorDepth
  const h1 = 10.0 * uFluid2Density / (uFluid1Density + uFluid2Density)
  const h2 = 10.0 * uFluid1Density / (uFluid1Density + uFluid2Density)

  // Cylinder (independent) — use pistonH as volume in Liters for realistic pressure
  const cylRadius = 3.0
  const gasVolumeLiters = pistonH * 10          // pistonH slider = 10x liters (1-18 → 10-180 L)
  const gasVolumeM3 = gasVolumeLiters * 0.001    // convert to m³
  const gasPressure = (gasMoles * R * gasTemp) / gasVolumeM3  // Pa

  // Manometer (independent) — P_gaz = P0 + h·d·g
  const P0 = 101325
  const atmPressure = P0 * Math.exp(-altitude / 8500)
  const deltaP_mano = balloonPressure - atmPressure
  const hDiff = deltaP_mano / (manoFluidDensity * g)  // physical h in meters

  // Visual scaling for manometer arms:
  // Map physical hDiff directly to visual units (1 physical meter = 1 visual unit). 
  // Since difference is 2*visHalf, visHalf is hDiff/2.
  const ARM_VIS_HALF = 10.0
  const visHalf = Math.max(-ARM_VIS_HALF, Math.min(ARM_VIS_HALF, hDiff / 2))
  const manoBase = 7.0
  const manoLeftH  = Math.max(0.2, manoBase - visHalf)
  const manoRightH = Math.max(0.2, manoBase + visHalf)

  const getManoColor = (d) => {
    return new THREE.Color().lerpColors(new THREE.Color("#3b82f6"), new THREE.Color("#94a3b8"), (d - 1000) / 12600)
  }
  const manoColor = getManoColor(manoFluidDensity)

  const lightDirRad = (lightDir * Math.PI) / 180
  const lx = Math.cos(lightDirRad) * 20
  const lz = Math.sin(lightDirRad) * 20
  const ly = 20

  const panelStyle = {
    position: 'absolute', top: '20px', left: '20px', width: '340px',
    background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
    borderRadius: '16px', border: '1px solid #eee', color: '#333',
    padding: '20px', boxSizing: 'border-box', overflowY: 'auto',
    maxHeight: 'calc(100vh - 40px)', fontFamily: '"Inter", sans-serif', zIndex: 10,
    boxShadow: '0 12px 40px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '14px'
  }
  const lblStyle = { display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }
  const cardStyle = { background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }
  const dataCardStyle = { background: '#1e293b', color: '#f8fafc', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #f59e0b', fontSize: '12px' }
  const tabBtnStyle = (active) => ({
    flex: 1, padding: '7px 4px', border: 'none', background: active ? '#2563eb' : '#e2e8f0',
    color: active ? '#fff' : '#475569', fontWeight: 'bold', fontSize: '11px',
    cursor: 'pointer', transition: '0.2s', borderRadius: '8px'
  })
  const row = (label, value, hi) => (
    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
      <span style={{ color: hi ? '#fbbf24' : '#94a3b8' }}>{label}</span>
      <strong style={{ color: hi ? '#fbbf24' : undefined }}>{value}</strong>
    </div>
  )

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000000', overflow: 'hidden', position: 'relative' }}>
      <div className="left-panel" style={panelStyle}>
        <div style={{ display: 'flex', gap: '6px', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
          <button style={tabBtnStyle(activeTab === 'solid')} onClick={() => setActiveTab('solid')}>SOLID</button>
          <button style={tabBtnStyle(activeTab === 'fluid')} onClick={() => setActiveTab('fluid')}>FLUID</button>
          <button style={tabBtnStyle(activeTab === 'gas')} onClick={() => setActiveTab('gas')}>GAS</button>
        </div>

        {activeTab === 'solid' && (
          <>
            <div style={dataCardStyle}>
              {row('Force (F = mg):', `${force.toFixed(1)} N`)}
              {row('Area (A):', `${area.toFixed(2)} m²`)}
              {row('Pressure (P = F/A):', `${solidPressure.toFixed(1)} Pa`, true)}
            </div>
            <div style={cardStyle}>
              <label style={lblStyle}>MASS (m): {mass} kg</label>
              <input type="range" min={1} max={100} step={1} value={mass} onChange={e => setMass(+e.target.value)} style={{ width: '100%', marginBottom: '14px' }} />
              <label style={lblStyle}>SIDE LENGTH (s): {sideLength.toFixed(1)} m</label>
              <input type="range" min={1.0} max={5.0} step={0.1} value={sideLength} onChange={e => setSideLength(+e.target.value)} style={{ width: '100%', marginBottom: '8px' }} />
              <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '14px' }}>Area = {area.toFixed(2)} m²</div>
              <label style={lblStyle}>DENSITY (ρ): {solidDensity.toFixed(1)}</label>
              <input type="range" min={0.5} max={10.0} step={0.1} value={solidDensity} onChange={e => setSolidDensity(+e.target.value)} style={{ width: '100%' }} />
            </div>
          </>
        )}

        {activeTab === 'fluid' && (
          <>
            <div style={{ display: 'flex', gap: '6px', background: '#e2e8f0', padding: '4px', borderRadius: '10px', marginBottom: '14px' }}>
              <button style={tabBtnStyle(fluidMode === 'sensor')} onClick={() => setFluidMode('sensor')}>CONTAINER</button>
              <button style={tabBtnStyle(fluidMode === 'utube')} onClick={() => setFluidMode('utube')}>U-TUBE</button>
            </div>
            {fluidMode === 'sensor' && (
              <div style={dataCardStyle}>
              {row('Depth (h):', `${sensorDepth.toFixed(1)} m`)}
              {row('Pressure (P = ρgh):', `${fluidPressure.toFixed(0)} Pa`, true)}
              </div>
            )}
            {fluidMode === 'utube' && (
              <div style={dataCardStyle}>
              {row('Left (h₁):', `${h1.toFixed(1)} m`)}
              {row('Right (h₂):', `${h2.toFixed(1)} m`)}
              </div>
            )}
            {fluidMode === 'sensor' && (
            <div style={cardStyle}>
              <label style={lblStyle}>FLUID DENSITY: {fluidDensity} kg/m³</label>
              <input type="range" min={500} max={2000} step={10} value={fluidDensity} onChange={e => setFluidDensity(+e.target.value)} style={{ width: '100%', marginBottom: '14px' }} />
              <label style={lblStyle}>SENSOR HEIGHT (y): {sensorY.toFixed(1)} m</label>
              <input type="range" min={0} max={10} step={0.1} value={sensorY} onChange={e => setSensorY(+e.target.value)} style={{ width: '100%' }} />
            </div>
            )}
            {fluidMode === 'utube' && (
            <div style={cardStyle}>
              <label style={lblStyle}>LEFT DENSITY (ρ₁): {uFluid1Density}</label>
              <input type="range" min={500} max={2000} step={10} value={uFluid1Density} onChange={e => setUFluid1Density(+e.target.value)} style={{ width: '100%', marginBottom: '14px' }} />
              <label style={lblStyle}>RIGHT DENSITY (ρ₂): {uFluid2Density}</label>
              <input type="range" min={500} max={2000} step={10} value={uFluid2Density} onChange={e => setUFluid2Density(+e.target.value)} style={{ width: '100%' }} />
            </div>
            )}
          </>
        )}

        {activeTab === 'gas' && (
          <>
            <div style={{ display: 'flex', gap: '6px', background: '#e2e8f0', padding: '4px', borderRadius: '10px', marginBottom: '14px' }}>
              <button style={tabBtnStyle(gasMode === 'ideal')} onClick={() => setGasMode('ideal')}>IDEAL GAS</button>
              <button style={tabBtnStyle(gasMode === 'mano')} onClick={() => setGasMode('mano')}>MANOMETER</button>
            </div>
            {gasMode === 'ideal' && (
              <div style={dataCardStyle}>
              {row('Volume (V):', `${gasVolumeLiters.toFixed(0)} L`)}
              {row('Gas Pressure:', `${(gasPressure / 1000).toFixed(1)} kPa`, true)}
              </div>
            )}
            {gasMode === 'mano' && (
              <div style={dataCardStyle}>
              {row('Balloon Pressure:', `${(balloonPressure / 1000).toFixed(2)} kPa`, true)}
              {row('Altitude:', `${altitude.toLocaleString()} m`)}
              {row('P₀ (atm):', `${(atmPressure / 1000).toFixed(2)} kPa`)}
              {row('ΔP:', `${(deltaP_mano / 1000).toFixed(2)} kPa`)}
              {row('h (diff):', `${Math.abs(hDiff).toFixed(3)} m`)}
              </div>
            )}
            {gasMode === 'ideal' && (
            <div style={cardStyle}>
              <label style={lblStyle}>TEMPERATURE (T): {gasTemp} K</label>
              <input type="range" min={100} max={1000} step={10} value={gasTemp} onChange={e => setGasTemp(+e.target.value)} style={{ width: '100%', marginBottom: '14px' }} />
              <label style={lblStyle}>MOLES (n): {gasMoles.toFixed(1)} mol</label>
              <input type="range" min={0.1} max={5} step={0.1} value={gasMoles} onChange={e => setGasMoles(+e.target.value)} style={{ width: '100%', marginBottom: '14px' }} />
              <label style={lblStyle}>PISTON HEIGHT (→Volume): {gasVolumeLiters.toFixed(0)} L</label>
              <input type="range" min={1} max={18} step={0.1} value={pistonH} onChange={e => setPistonH(+e.target.value)} style={{ width: '100%' }} />
            </div>
            )}
            {gasMode === 'mano' && (
            <div style={cardStyle}>
              <label style={lblStyle}>BALLOON PRESSURE: {(balloonPressure / 1000).toFixed(0)} kPa</label>
              <input type="range" min={50000} max={300000} step={1000} value={balloonPressure} onChange={e => setBalloonPressure(+e.target.value)} style={{ width: '100%', marginBottom: '14px' }} />
              <label style={lblStyle}>ALTITUDE: {altitude.toLocaleString()} m</label>
              <input type="range" min={0} max={10000} step={100} value={altitude} onChange={e => setAltitude(+e.target.value)} style={{ width: '100%', marginBottom: '14px' }} />
              <label style={lblStyle}>FLUID DENSITY (ρ): {manoFluidDensity} kg/m³</label>
              <input type="range" min={800} max={13600} step={100} value={manoFluidDensity} onChange={e => setManoFluidDensity(+e.target.value)} style={{ width: '100%', marginBottom: '4px' }} />
              <div style={{ fontSize: '10px', color: '#64748b' }}>Water=1000, Mercury=13600</div>
            </div>
            )}
          </>
        )}
      </div>

      {/* LIGHT BUTTON */}
      <button onClick={() => setLightPanelOpen(!lightPanelOpen)} style={{
        position: 'absolute', top: '136px', right: '24px', zIndex: 1000, width: '48px', height: '48px',
        borderRadius: '14px', border: 'none', background: lightPanelOpen ? '#ffffff' : 'rgba(15, 15, 20, 0.85)',
        backdropFilter: 'blur(12px)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)', transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
      }} title="Light Controls">
        <LightBulbIcon width={24} height={24} fill={lightPanelOpen ? "#000" : "#fff"} />
      </button>
      {lightPanelOpen && (
        <div style={{
          position: 'absolute', top: '136px', right: '82px', zIndex: 999, background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(8px)', padding: '16px', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
          border: '1px solid #eee', width: '220px', fontFamily: 'sans-serif',
        }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#333', textAlign: 'center' }}>LIGHT CONTROLS</h4>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>ANGLE: {lightDir}&deg;</label>
          <input type="range" min="0" max="360" step="1" value={lightDir} onChange={e => setLightDir(+e.target.value)} style={{ width: '100%', marginBottom: '10px' }} />
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>INTENSITY: {lightInt.toFixed(1)}</label>
          <input type="range" min="0" max="3" step="0.1" value={lightInt} onChange={e => setLightInt(+e.target.value)} style={{ width: '100%' }} />
        </div>
      )}

      <Canvas shadows camera={{ position: [0, 20, 50], fov: 45 }}>
        <ambientLight intensity={0.5 + lightInt * 0.2} />
        <directionalLight position={[lx, ly, lz]} intensity={lightInt} castShadow shadow-mapSize={[2048, 2048]} />
        <pointLight position={[-10, 10, -10]} intensity={0.5} />
        <SpotLightFixture lightPos={[lx, ly, lz]} intensity={lightInt} target={[0, 0, 0]} color="#fffbe6" height={2} radius={0.8} />
        <OrbitControls makeDefault enablePan={true} enableZoom={true} target={[0, 10, 0]} />
        <CheckerGround />

        {/* ── SOLID TAB ── */}
        {activeTab === 'solid' && (
          <group>
            <Spring height={currentSpringHeight} radius={2.0} turns={5} thickness={0.3} />
            <mesh position={[0, plateY, 0]} receiveShadow castShadow>
              <cylinderGeometry args={[4, 4, plateThickness, 32]} />
              <meshStandardMaterial color="#fef08a" metalness={0.2} roughness={0.6} />
            </mesh>
            <mesh position={[0, boxY, 0]} receiveShadow castShadow>
              <boxGeometry args={[sideLength, boxHeight, sideLength]} />
              <meshStandardMaterial color={solidColor} />
            </mesh>
            <Text position={[0, boxY, sideLength / 2 + 0.1]} fontSize={0.6} color="white" anchorX="center" anchorY="middle" outlineWidth={0.05} outlineColor="#000">
              {mass} kg
            </Text>
          </group>
        )}

        {/* ── FLUID TAB ── */}
        {activeTab === 'fluid' && (
          <group>
            {/* Container */}
            {fluidMode === 'sensor' && (
            <group position={[0, 0.15, 0]}>
              <mesh renderOrder={1} position={[0, containerFluidHeight / 2, 0]}>
                <boxGeometry args={[9.8, containerFluidHeight, 9.8]} />
                <meshStandardMaterial color={getFluidColor(fluidDensity)} transparent opacity={0.85} roughness={0.2} metalness={0.1} depthWrite={false} />
              </mesh>
              <mesh renderOrder={2} position={[0, 6, 0]}>
                <boxGeometry args={[10.2, 12.2, 10.2]} />
                <meshStandardMaterial transparent opacity={0.12} color="#aaddff" depthWrite={false} side={THREE.BackSide} />
              </mesh>
              <mesh renderOrder={3} position={[0, 6, 0]}>
                <boxGeometry args={[10.2, 12.2, 10.2]} />
                <meshStandardMaterial transparent opacity={0.18} color="#aaddff" depthWrite={false} />
              </mesh>
              <mesh renderOrder={4} position={[0, sensorY, 0]}>
                <sphereGeometry args={[0.4, 32, 32]} />
                <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.8} />
              </mesh>
              <Text renderOrder={10} position={[0, sensorY + 1.0, 0]} fontSize={0.8} color="white" outlineWidth={0.06} outlineColor="#000" depthOffset={-50}>
                {fluidPressure.toFixed(0)} Pa
              </Text>
            </group>
            )}
            {/* U-Tube */}
            {fluidMode === 'utube' && (
            <group position={[0, 0.8, 0]}>
              <mesh renderOrder={1} position={[-3, 3 + h1 / 2, 0]}>
                <cylinderGeometry args={[0.6, 0.6, h1, 32]} />
                <meshStandardMaterial color={getFluidColor(uFluid1Density)} depthWrite={false} />
              </mesh>
              <mesh renderOrder={1} position={[3, 3 + h2 / 2, 0]}>
                <cylinderGeometry args={[0.6, 0.6, h2, 32]} />
                <meshStandardMaterial color={getFluidColor(uFluid2Density)} depthWrite={false} />
              </mesh>
              <mesh renderOrder={1} position={[0, 3, 0]} rotation={[Math.PI, 0, 0]}>
                <torusGeometry args={[3, 0.6, 16, 64, Math.PI]} />
                <meshStandardMaterial color={getFluidColor(uFluid1Density)} depthWrite={false} />
              </mesh>
              {[[-3, 3 + 25 / 2], [3, 3 + 25 / 2]].map(([x, y], i) => (
                <group key={i}>
                  <mesh renderOrder={2} position={[x, y, 0]}>
                    <cylinderGeometry args={[0.8, 0.8, 25, 32]} />
                    <meshStandardMaterial transparent opacity={0.15} color="#aaddff" depthWrite={false} side={THREE.BackSide} />
                  </mesh>
                  <mesh renderOrder={3} position={[x, y, 0]}>
                    <cylinderGeometry args={[0.8, 0.8, 25, 32]} />
                    <meshStandardMaterial transparent opacity={0.25} color="#aaddff" depthWrite={false} />
                  </mesh>
                </group>
              ))}
              <mesh renderOrder={2} position={[0, 3, 0]} rotation={[Math.PI, 0, 0]}>
                <torusGeometry args={[3, 0.8, 16, 64, Math.PI]} />
                <meshStandardMaterial transparent opacity={0.15} color="#aaddff" depthWrite={false} side={THREE.BackSide} />
              </mesh>
              <mesh renderOrder={3} position={[0, 3, 0]} rotation={[Math.PI, 0, 0]}>
                <torusGeometry args={[3, 0.8, 16, 64, Math.PI]} />
                <meshStandardMaterial transparent opacity={0.25} color="#aaddff" depthWrite={false} />
              </mesh>
              <mesh renderOrder={4} position={[0, 3, 0]}>
                <boxGeometry args={[8, 0.06, 0.06]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
              <Text renderOrder={5} position={[-4.5, 3 + h1 / 2, 0]} fontSize={0.8} color="white" outlineWidth={0.05} outlineColor="#000" depthOffset={-20}>h1</Text>
              <Text renderOrder={5} position={[4.5, 3 + h2 / 2, 0]} fontSize={0.8} color="white" outlineWidth={0.05} outlineColor="#000" depthOffset={-20}>h2</Text>
            </group>
            )}
          </group>
        )}

        {/* ── GAS TAB ── */}
        {activeTab === 'gas' && (
          <group>

            {/* ─ LEFT: Cylinder (independent) ─ */}
            {gasMode === 'ideal' && (
            <group position={[0, 0, 0]}>
              {/* Glass cylinder wall - positioned so bottom is at y=0 */}
              <mesh renderOrder={2} position={[0, 10, 0]}>
                <cylinderGeometry args={[cylRadius + 0.15, cylRadius + 0.15, 20, 32, 1, true]} />
                <meshStandardMaterial transparent opacity={0.2} color="#aaddff" depthWrite={false} side={THREE.DoubleSide} />
              </mesh>
              {/* Bottom cap */}
              <mesh position={[0, 0.15, 0]}>
                <cylinderGeometry args={[cylRadius + 0.15, cylRadius + 0.15, 0.3, 32]} />
                <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.2} />
              </mesh>
              {/* Gas particles */}
              <GasParticles count={40} temperature={gasTemp} cylinderRadius={cylRadius} pistonY={pistonH} />
              {/* Piston */}
              <mesh position={[0, pistonH, 0]}>
                <cylinderGeometry args={[cylRadius, cylRadius, 0.6, 32]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
              </mesh>
              {/* Piston rod */}
              <mesh position={[0, pistonH + 3.3, 0]}>
                <cylinderGeometry args={[0.3, 0.3, 6, 16]} />
                <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.1} />
              </mesh>
              <Text renderOrder={10} position={[0, pistonH + 1.5, 0]} fontSize={0.85} color="white" outlineWidth={0.06} outlineColor="#000" depthOffset={-50}>
                {(gasPressure / 1000).toFixed(2)} kPa
              </Text>
              <Text renderOrder={10} position={[0, 1.5, 0]} fontSize={0.75} color="#fbbf24" outlineWidth={0.05} outlineColor="#000" depthOffset={-50}>
                T = {gasTemp} K
              </Text>
            </group>
            )}

            {/* ─ RIGHT: Balloon + Manometer (P_gaz = P₀ + h·ρ·g) ─ */}
            {/* Group shifted right, everything above y=0 */}
            {gasMode === 'mano' && (
            <group position={[0, 0, 0]}>
              {/* ── Gas Balloon (sphere) at left of U-tube ── */}
              <mesh renderOrder={1} position={[-8, 12, 0]}>
                <sphereGeometry args={[3, 32, 32]} />
                <meshStandardMaterial color="#fca5a5" transparent opacity={0.75} depthWrite={false} />
              </mesh>
              <Text renderOrder={10} position={[-8, 12.3, 3.1]} fontSize={0.9} color="white" outlineWidth={0.07} outlineColor="#7f1d1d" depthOffset={-50}>
                gas
              </Text>
              <Text renderOrder={10} position={[-8, 10.5, 3.1]} fontSize={0.65} color="#fbbf24" outlineWidth={0.05} outlineColor="#000" depthOffset={-50}>
                {(balloonPressure / 1000).toFixed(0)} kPa
              </Text>

              {/* ── Connecting tube: balloon right side → UP → RIGHT → DOWN into left arm top ── */}
              {/* This makes an upside-down U connecting balloon to left arm at y=22 */}
              <CurvedPipe
                points={[
                  [-5.1, 12, 0],   // balloon right side
                  [-4.5, 15, 0],   // curve up
                  [-3, 23, 0],     // top of arch
                  [-1.5, 23, 0],   // above left arm top
                  [-1.5, 22, 0],   // enter left arm top
                ]}
                radius={0.22}
                color="#475569"
              />

              {/* ── U-Tube Glass: left arm (gas/closed) x=-1.5, right arm (atm/open) x=1.5 ── */}
              {/* Bottom U-bend: torus at y=2, radius=1.5 → bottom of torus at y=0.5 */}
              <mesh renderOrder={2} position={[0, 2, 0]} rotation={[Math.PI, 0, 0]}>
                <torusGeometry args={[1.5, 0.5, 16, 64, Math.PI]} />
                <meshStandardMaterial transparent opacity={0.15} color="#aaddff" depthWrite={false} side={THREE.BackSide} />
              </mesh>
              <mesh renderOrder={3} position={[0, 2, 0]} rotation={[Math.PI, 0, 0]}>
                <torusGeometry args={[1.5, 0.5, 16, 64, Math.PI]} />
                <meshStandardMaterial transparent opacity={0.3} color="#aaddff" depthWrite={false} />
              </mesh>
              {/* Left arm (closed - gas side) */}
              <mesh renderOrder={2} position={[-1.5, 12, 0]}>
                <cylinderGeometry args={[0.5, 0.5, 20, 32]} />
                <meshStandardMaterial transparent opacity={0.15} color="#aaddff" depthWrite={false} side={THREE.BackSide} />
              </mesh>
              <mesh renderOrder={3} position={[-1.5, 12, 0]}>
                <cylinderGeometry args={[0.5, 0.5, 20, 32]} />
                <meshStandardMaterial transparent opacity={0.3} color="#aaddff" depthWrite={false} />
              </mesh>
              {/* Right arm (open - atmosphere side) */}
              <mesh renderOrder={2} position={[1.5, 12, 0]}>
                <cylinderGeometry args={[0.5, 0.5, 20, 32]} />
                <meshStandardMaterial transparent opacity={0.15} color="#aaddff" depthWrite={false} side={THREE.BackSide} />
              </mesh>
              <mesh renderOrder={3} position={[1.5, 12, 0]}>
                <cylinderGeometry args={[0.5, 0.5, 20, 32]} />
                <meshStandardMaterial transparent opacity={0.3} color="#aaddff" depthWrite={false} />
              </mesh>

              {/* ── Fluids ── */}
              {/* Left arm fluid */}
              <mesh renderOrder={1} position={[-1.5, 2 + manoLeftH / 2, 0]}>
                <cylinderGeometry args={[0.38, 0.38, manoLeftH, 32]} />
                <meshStandardMaterial color={manoColor} metalness={0.4} roughness={0.2} depthWrite={false} />
              </mesh>
              {/* Right arm fluid */}
              <mesh renderOrder={1} position={[1.5, 2 + manoRightH / 2, 0]}>
                <cylinderGeometry args={[0.38, 0.38, manoRightH, 32]} />
                <meshStandardMaterial color={manoColor} metalness={0.4} roughness={0.2} depthWrite={false} />
              </mesh>
              {/* Bottom fluid in U-bend */}
              <mesh renderOrder={1} position={[0, 2, 0]} rotation={[Math.PI, 0, 0]}>
                <torusGeometry args={[1.5, 0.38, 16, 64, Math.PI]} />
                <meshStandardMaterial color={manoColor} metalness={0.4} roughness={0.2} depthWrite={false} />
              </mesh>

              {/* ── P₀ arrow at top of right arm (pointing DOWN) ── */}
              {/* Arrow shaft */}
              <mesh renderOrder={4} position={[1.5, 23.5, 0]}>
                <cylinderGeometry args={[0.07, 0.07, 1.5, 8]} />
                <meshBasicMaterial color="#a3e635" />
              </mesh>
              {/* Arrow head (cone pointing down) */}
              <mesh renderOrder={4} position={[1.5, 22.5, 0]} rotation={[Math.PI, 0, 0]}>
                <coneGeometry args={[0.22, 0.6, 8]} />
                <meshBasicMaterial color="#a3e635" />
              </mesh>
              <Text renderOrder={10} position={[3.0, 24.0, 0]} fontSize={0.75} color="#a3e635" outlineWidth={0.05} outlineColor="#000" depthOffset={-20}>
                P0
              </Text>
              <Text renderOrder={10} position={[3.0, 22.8, 0]} fontSize={0.6} color="white" outlineWidth={0.04} outlineColor="#000" depthOffset={-20}>
                {(atmPressure / 1000).toFixed(1)} kPa
              </Text>

              {/* ── h indicator between fluid surfaces ── */}
              {Math.abs(manoRightH - manoLeftH) > 0.05 && (
                <>
                  {/* Dashed reference line at lower fluid surface level */}
                  <mesh renderOrder={4} position={[0, 2 + Math.min(manoLeftH, manoRightH), 0]}>
                    <boxGeometry args={[5, 0.05, 0.05]} />
                    <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
                  </mesh>
                  {/* Vertical h bar */}
                  <mesh renderOrder={4} position={[3.5, 2 + (manoLeftH + manoRightH) / 2, 0]}>
                    <boxGeometry args={[0.07, Math.abs(manoRightH - manoLeftH), 0.07]} />
                    <meshBasicMaterial color="#fbbf24" />
                  </mesh>
                  {/* Tick marks at top and bottom of h bar */}
                  <mesh renderOrder={4} position={[3.5, 2 + manoLeftH, 0]}>
                    <boxGeometry args={[0.4, 0.07, 0.07]} />
                    <meshBasicMaterial color="#fbbf24" />
                  </mesh>
                  <mesh renderOrder={4} position={[3.5, 2 + manoRightH, 0]}>
                    <boxGeometry args={[0.4, 0.07, 0.07]} />
                    <meshBasicMaterial color="#fbbf24" />
                  </mesh>
                  {/* h label */}
                  <Text renderOrder={10} position={[4.8, 2 + (manoLeftH + manoRightH) / 2, 0]} fontSize={0.85} color="#fbbf24" outlineWidth={0.05} outlineColor="#000" depthOffset={-20}>
                    h
                  </Text>
                  <Text renderOrder={10} position={[4.8, 2 + (manoLeftH + manoRightH) / 2 - 1.4, 0]} fontSize={0.6} color="white" outlineWidth={0.04} outlineColor="#000" depthOffset={-20}>
                    {Math.abs(hDiff).toFixed(3)}m
                  </Text>
                </>
              )}

              {/* Altitude label on right side of manometer */}
              <Text renderOrder={10} position={[6.5, 26, 0]} fontSize={0.75} color="#a78bfa" outlineWidth={0.05} outlineColor="#000" depthOffset={-20}>
                {altitude.toLocaleString()} m
              </Text>
            </group>
            )}
          </group>
        )}
      </Canvas>
    </div>
  )
}

