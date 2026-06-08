import React, { useState, useMemo, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, Text } from "@react-three/drei"
import * as THREE from "three"
import { LightBulbIcon } from "./Icons"
import SpotLightFixture from "./SpotLightFixture"

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

function AnimatedLiquidObject({ targetY, size, mass }) {
  const meshRef = useRef()
  
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, targetY, 1.5 * delta)
    }
  })

  return (
    <mesh ref={meshRef} position={[0, targetY, 0]} castShadow receiveShadow>
      <boxGeometry args={[size, size, size]} />
      <meshStandardMaterial color="#f59e0b" roughness={0.4} />
      <Text position={[0, 0, size/2 + 0.02]} fontSize={size * 0.3} color="white" anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#000">
        {mass} kg
      </Text>
      <Text position={[0, 0, -(size/2 + 0.02)]} rotation={[0, Math.PI, 0]} fontSize={size * 0.3} color="white" anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#000">
        {mass} kg
      </Text>
      <Text position={[size/2 + 0.02, 0, 0]} rotation={[0, Math.PI/2, 0]} fontSize={size * 0.3} color="white" anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#000">
        {mass} kg
      </Text>
      <Text position={[-(size/2 + 0.02), 0, 0]} rotation={[0, -Math.PI/2, 0]} fontSize={size * 0.3} color="white" anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#000">
        {mass} kg
      </Text>
    </mesh>
  )
}

export default function BuoyancySim() {
  const [liqMass, setLiqMass] = useState(10)
  const [liqVolume, setLiqVolume] = useState(15)
  const [liqDensity, setLiqDensity] = useState(1.0)

  const [lightPanelOpen, setLightPanelOpen] = useState(false)
  const [lightDir, setLightDir] = useState(45)
  const [lightInt, setLightInt] = useState(1.5)

  const g = 9.8
  const objDensity = liqMass / liqVolume
  const objWeight = liqMass * g
  
  let status, V_sub, F_b, F_n, objTargetY
  const containerLiquidLevel = 10.0
  const objSize = Math.max(1.0, Math.cbrt(liqVolume) * 0.8)
  const epsilon = 0.02
  
  if (objDensity < liqDensity - epsilon) {
    status = "FLOATING"
    V_sub = liqMass / liqDensity
    F_b = objWeight
    F_n = 0
    const submergedFraction = V_sub / liqVolume
    const submergedDepth = objSize * submergedFraction
    objTargetY = containerLiquidLevel - submergedDepth + (objSize / 2)
  } else if (objDensity > liqDensity + epsilon) {
    status = "SINKING"
    V_sub = liqVolume
    F_b = V_sub * liqDensity * g
    F_n = objWeight - F_b
    objTargetY = objSize / 2
  } else {
    status = "SUSPENDED"
    V_sub = liqVolume
    F_b = objWeight
    F_n = 0
    objTargetY = containerLiquidLevel / 2
  }

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
  const dataCardStyle = { background: '#1e293b', color: '#f8fafc', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #0ea5e9', fontSize: '13px' }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000000', overflow: 'hidden', position: 'relative' }}>
      <div className="left-panel" style={panelStyle}>
        <div style={dataCardStyle}>
          <div style={{ fontWeight: 'bold', color: '#94a3b8', marginBottom: '8px', fontSize: '11px', textTransform: 'uppercase' }}>BUOYANCY</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>Gravity Force (G):</span> <strong style={{ color: '#ef4444' }}>{objWeight.toFixed(1)} N ↓</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>Buoyant Force (Fb):</span> <strong style={{ color: '#3b82f6' }}>{F_b.toFixed(1)} N ↑</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>Normal Force (Fn):</span> <strong style={{ color: '#fbbf24' }}>{F_n.toFixed(1)} N ↑</strong>
          </div>
          <div style={{ width: '100%', height: '12px', background: '#334155', borderRadius: '6px', overflow: 'hidden', marginTop: '6px', marginBottom: '6px', display: 'flex' }}>
            <div style={{ width: `${(F_b / objWeight) * 100}%`, background: '#3b82f6', transition: 'width 0.3s' }} title="Buoyant Force" />
            <div style={{ width: `${(F_n / objWeight) * 100}%`, background: '#fbbf24', transition: 'width 0.3s' }} title="Normal Force" />
          </div>
          <div style={{ fontSize: '9px', textAlign: 'center', color: '#94a3b8', marginTop: '2px', marginBottom: '8px' }}>
            Upward Forces (Blue: Fb, Yellow: Fn) balancing Gravity (Red)
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: status === "FLOATING" ? '#22c55e' : status === "SUSPENDED" ? '#a855f7' : '#fbbf24', paddingTop: '8px', borderTop: '1px solid #334155' }}>
            <span>Status:</span> <strong>{status}</strong>
          </div>
        </div>

        <div style={cardStyle}>
          <label style={lblStyle}>OBJECT MASS: {liqMass} kg</label>
          <input type="range" min={1} max={50} step={1} value={liqMass} onChange={e => setLiqMass(+e.target.value)} style={{ width: '100%', marginBottom: '16px' }} />
          
          <label style={lblStyle}>OBJECT VOLUME: {liqVolume} Unit³</label>
          <input type="range" min={1} max={50} step={1} value={liqVolume} onChange={e => setLiqVolume(+e.target.value)} style={{ width: '100%', marginBottom: '8px' }} />
          
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginTop: '4px', marginBottom: '2px' }}>
            <span>Submerged: {V_sub.toFixed(1)}</span>
            <span>Total: {liqVolume.toFixed(1)}</span>
          </div>
          <div style={{ width: '100%', height: '6px', background: '#cbd5e1', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
            <div style={{ width: `${(V_sub / liqVolume) * 100}%`, background: '#0ea5e9', height: '100%', transition: 'width 0.3s' }} title="Submerged Volume" />
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '16px' }}>Obj Density: {(liqMass/liqVolume).toFixed(2)}</div>

          <label style={lblStyle}>LIQUID DENSITY: {liqDensity.toFixed(2)}</label>
          <input type="range" min={0.5} max={3.0} step={0.01} value={liqDensity} onChange={e => setLiqDensity(+e.target.value)} style={{ width: '100%', marginBottom: '4px' }} />
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Water is 1.0. Oil is ~0.9. Saltwater is ~1.03.</div>
        </div>
        <div style={{ fontSize: '11px', color: '#64748b', padding: '12px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <strong style={{color: '#0ea5e9'}}>Physics Concept:</strong> An object floats if its density is less than the liquid. The liquid pushes up with a force equal to the weight of the displaced liquid.
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
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI/2, 0, 0]} receiveShadow>
            <planeGeometry args={[13.8, 13.8]} />
            <meshStandardMaterial color="#0f172a" roughness={0.8} metalness={0.1} />
          </mesh>
          <mesh position={[0, 5, 0]} receiveShadow renderOrder={1}>
            <boxGeometry args={[14, 10, 14]} />
            <meshStandardMaterial color="#ffffff" opacity={0.15} transparent depthWrite={false} roughness={0.1} metalness={0.3} side={THREE.BackSide} />
          </mesh>
          <mesh position={[0, 5.01, 0]} receiveShadow renderOrder={2}>
            <boxGeometry args={[13.8, 9.98, 13.8]} />
            <meshStandardMaterial color="#0ea5e9" transparent opacity={0.6} depthWrite={false} roughness={0.0} metalness={0.2} />
          </mesh>
          <AnimatedLiquidObject targetY={objTargetY} size={objSize} mass={liqMass} />
        </group>
      </Canvas>
    </div>
  )
}
