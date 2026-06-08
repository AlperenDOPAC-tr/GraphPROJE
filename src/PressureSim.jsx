import React, { useState, useMemo } from "react"
import { Canvas } from "@react-three/fiber"
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
    canvas.width = 512
    canvas.height = 512
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, 512, 512)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 256, 256)
    ctx.fillRect(256, 256, 256, 256)
    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(10, 10)
    texture.anisotropy = 16
    return texture
  }, [])

  return (
    <mesh position={[0, -0.5, 0]} receiveShadow>
      <boxGeometry args={[40, 1, 40]} />
      <meshStandardMaterial map={tex} roughness={0.8} metalness={0.1} />
    </mesh>
  )
}

export default function PressureSim() {
  const [mass, setMass] = useState(50)
  const [sideLength, setSideLength] = useState(2.0)
  const [density, setDensity] = useState(2.0)
  
  const [lightPanelOpen, setLightPanelOpen] = useState(false)
  const [lightDir, setLightDir] = useState(45)
  const [lightInt, setLightInt] = useState(1.5)

  const g = 9.8
  const force = mass * g
  const area = sideLength * sideLength
  const pressure = force / area
  const maxPressure = 980
  const maxCompression = 6.0
  const baseSpringHeight = 8.0
  const compression = (pressure / maxPressure) * maxCompression
  const currentSpringHeight = baseSpringHeight - compression
  const plateThickness = 0.4
  const plateY = currentSpringHeight + plateThickness / 2
  const boxHeight = Math.min(20.0, Math.max(0.5, mass / (density * area * 1.6)))
  const boxY = currentSpringHeight + plateThickness + boxHeight / 2
  const solidColor = new THREE.Color().lerpColors(new THREE.Color("#3b82f6"), new THREE.Color("#ef4444"), pressure / maxPressure)

  const lightDirRad = (lightDir * Math.PI) / 180
  const lx = Math.cos(lightDirRad) * 20
  const lz = Math.sin(lightDirRad) * 20
  const ly = 20

  const panelStyle = {
    position: 'absolute', top: '20px', left: '20px', width: '320px',
    background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
    borderRadius: '16px', border: '1px solid #eee', color: '#333',
    padding: '24px', boxSizing: 'border-box', overflowY: 'auto',
    maxHeight: 'calc(100vh - 40px)', fontFamily: '"Inter", sans-serif', zIndex: 10,
    boxShadow: '0 12px 40px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '16px'
  }
  const lblStyle = { display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }
  const cardStyle = { background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }
  const dataCardStyle = { background: '#1e293b', color: '#f8fafc', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #f59e0b', fontSize: '13px' }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000000', overflow: 'hidden', position: 'relative' }}>
      <div className="left-panel" style={panelStyle}>
        <div style={dataCardStyle}>
          <div style={{ fontWeight: 'bold', color: '#94a3b8', marginBottom: '8px', fontSize: '11px', textTransform: 'uppercase' }}>SOLID PRESSURE</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>Force (F = mg):</span> <strong>{force.toFixed(1)} N</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>Surface Area (A):</span> <strong>{area.toFixed(2)} m²</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fbbf24', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #334155' }}>
            <span>Pressure (P = F/A):</span> <strong>{pressure.toFixed(1)} Pa</strong>
          </div>
        </div>

        <div style={cardStyle}>
          <label style={lblStyle}>OBJECT MASS (m): {mass} kg</label>
          <input type="range" min={1} max={100} step={1} value={mass} onChange={e => setMass(+e.target.value)} style={{ width: '100%', marginBottom: '16px' }} />
          
          <label style={lblStyle}>SURFACE SIDE LENGTH (s): {sideLength.toFixed(1)} m</label>
          <input type="range" min={1.0} max={5.0} step={0.1} value={sideLength} onChange={e => setSideLength(+e.target.value)} style={{ width: '100%', marginBottom: '8px' }} />
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', marginBottom: '16px' }}>Area (A) = {sideLength.toFixed(1)} × {sideLength.toFixed(1)} = {area.toFixed(2)} m²</div>

          <label style={lblStyle}>OBJECT DENSITY (ρ): {density.toFixed(1)}</label>
          <input type="range" min={0.5} max={10.0} step={0.1} value={density} onChange={e => setDensity(+e.target.value)} style={{ width: '100%', marginBottom: '4px' }} />
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Density only affects the height (volume) for a fixed mass.</div>
        </div>
      </div>

      <button
        onClick={() => setLightPanelOpen(!lightPanelOpen)}
        style={{
          position: 'absolute', top: '194px', right: '24px', zIndex: 1000, width: '48px', height: '48px',
          borderRadius: '14px', border: 'none', background: lightPanelOpen ? '#ffffff' : 'rgba(15, 15, 20, 0.85)',
          backdropFilter: 'blur(12px)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)', transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)', fontSize: '22px',
        }}
        title="Light Controls"
      ><LightBulbIcon width={24} height={24} fill={lightPanelOpen ? "#000" : "#fff"} /></button>

      {lightPanelOpen && (
        <div style={{
          position: 'absolute', top: '194px', right: '82px', zIndex: 999, background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(8px)', padding: '16px', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
          border: '1px solid #eee', width: '220px', fontFamily: 'sans-serif',
        }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#333', textAlign: 'center' }}>LIGHT CONTROLS</h4>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>ANGLE: {lightDir}°</label>
          <input type="range" min="0" max="360" step="1" value={lightDir} onChange={e => setLightDir(Number(e.target.value))} style={{ width: '100%', marginBottom: '10px' }} />
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>INTENSITY: {lightInt.toFixed(1)}</label>
          <input type="range" min="0" max="3" step="0.1" value={lightInt} onChange={e => setLightInt(Number(e.target.value))} style={{ width: '100%' }} />
        </div>
      )}

      <Canvas shadows camera={{ position: [10, 15, 25], fov: 45 }}>
        <ambientLight intensity={0.5 + lightInt * 0.2} />
        <directionalLight position={[lx, ly, lz]} intensity={lightInt} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} shadow-camera-near={0.5} shadow-camera-far={100} />
        <pointLight position={[-10, 10, -10]} intensity={0.5} />
        
        <SpotLightFixture lightPos={[lx, ly, lz]} intensity={lightInt} target={[0, 0, 0]} color="#fffbe6" height={2} radius={0.8} />
        <OrbitControls makeDefault enablePan={true} enableZoom={true} target={[0, 4, 0]} />
        <CheckerGround />
        
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
          <Text position={[0, boxY, sideLength/2 + 0.1]} fontSize={0.6} color="white" anchorX="center" anchorY="middle" outlineWidth={0.05} outlineColor="#000">
            {mass} kg
          </Text>
        </group>
      </Canvas>
    </div>
  )
}
