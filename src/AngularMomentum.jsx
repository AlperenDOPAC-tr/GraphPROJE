import React, { useState, useMemo, useRef } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls, Edges, Text } from "@react-three/drei"
import * as THREE from "three"
import { getGroundTexture } from "./utils"
import { LightBulbIcon, TimeIcon, SpeedIcon } from './Icons'

// ─── FİZİK MOTORU VE SAHNE ───────────────────────────────────────────────────
function AngularScene({ diskMass, diskRadius, cubeMass, isPlaying, isPaused, hasStarted, setHasStarted, lockedLTotal, setLockedLTotal, simData, setSimData, setIsDraggingParent, timeScale }) {
  const diskRef = useRef()
  const cubeRef = useRef()
  const [cubePos, setCubePos] = useState(new THREE.Vector3(diskRadius * 0.5, 0.25, 0))
  const [isDraggingLocal, setIsDraggingLocal] = useState(false)
  const angleRef = useRef(0)

  // Clamp cube position when radius changes
  React.useEffect(() => {
    const r_current = Math.sqrt(cubePos.x * cubePos.x + cubePos.z * cubePos.z)
    const maxR = Math.max(0, diskRadius - 0.25)
    if (r_current > maxR && r_current > 0) {
      const scale = maxR / r_current
      setCubePos(new THREE.Vector3(cubePos.x * scale, 0.25, cubePos.z * scale))
    }
  }, [diskRadius, cubePos.x, cubePos.z])

  // Calculate moments of inertia
  const r_cube = Math.sqrt(cubePos.x * cubePos.x + cubePos.z * cubePos.z)
  const I_disk = 0.5 * diskMass * diskRadius * diskRadius
  const I_cube = cubeMass * r_cube * r_cube
  const I_total = I_disk + I_cube

  // L_total is always constant. This makes omega dynamically change immediately based on I_total!
  const displayLTotal = 150
  const omega = displayLTotal / I_total

  const L_disk = I_disk * omega
  const L_cube = I_cube * omega

  const v_disk = omega * diskRadius
  const v_cube = omega * r_cube

  // Update panel data
  useFrame(() => {
    if (isPlaying && !isPaused) {
      angleRef.current += omega * 0.016 * timeScale // approx dt with timeScale
    }
    if (diskRef.current) {
      diskRef.current.rotation.y = angleRef.current
    }
    
    setSimData({
      I_disk, I_cube, I_total,
      L_disk, L_cube, L_total: displayLTotal,
      omega, r_cube, v_disk, v_cube
    })
  })

  const handlePointerDown = (e) => {
    e.stopPropagation()
    e.target.setPointerCapture(e.pointerId)
    setIsDraggingLocal(true)
    setIsDraggingParent(true)
  }

  const handlePointerUp = (e) => {
    e.stopPropagation()
    e.target.releasePointerCapture(e.pointerId)
    setIsDraggingLocal(false)
    setIsDraggingParent(false)
  }

  const handlePointerMove = (e) => {
    if (!isDraggingLocal) return
    e.stopPropagation()
    // Local point on the disk plane (Y=0)
    const point = e.point.clone()
    point.applyAxisAngle(new THREE.Vector3(0, 1, 0), -angleRef.current)
    
    let x = point.x
    let z = point.z
    
    // Constrain to disk radius
    const dist = Math.sqrt(x*x + z*z)
    if (dist > diskRadius - 0.25) { // 0.25 is half cube size
      const scale = (diskRadius - 0.25) / dist
      x *= scale
      z *= scale
    }
    
    setCubePos(new THREE.Vector3(x, 0.25, z))
  }

  return (
    <group>
      {/* ── DRAG PLANE (Invisible) ── */}
      <mesh 
        rotation={[-Math.PI/2, 0, 0]} 
        position={[0, 0.25, 0]}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerOut={handlePointerUp}
        onPointerMove={handlePointerMove}
        visible={false}
      >
        <circleGeometry args={[diskRadius, 64]} />
        <meshBasicMaterial transparent opacity={0.1} color="red" side={THREE.DoubleSide} />
      </mesh>

      <group ref={diskRef}>
        {/* ── DISK ── */}
        <mesh position={[0, -0.1, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[diskRadius, diskRadius, 0.2, 64]} />
          <meshStandardMaterial color="#3b82f6" metalness={0.4} roughness={0.6} />
          {/* Radial lines to see rotation clearly */}
          <mesh position={[0, 0.101, 0]} rotation={[-Math.PI/2, 0, 0]}>
            <circleGeometry args={[diskRadius - 0.1, 32]} />
            <meshBasicMaterial color="#2563eb" wireframe />
          </mesh>
        </mesh>

        {/* ── CUBE ── */}
        <mesh 
          position={cubePos} 
          castShadow 
          receiveShadow
        >
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial color={isDraggingLocal ? "#facc15" : "#f59e0b"} metalness={0.5} roughness={0.3} />
          <Edges color="#b45309" />
        </mesh>
      </group>

      {/* ── GROUND ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#ffffff" map={getGroundTexture(15, 15)} roughness={0.8} metalness={0.2} />
      </mesh>
    </group>
  )
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function AngularMomentum() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isDraggingParent, setIsDraggingParent] = useState(false)
  
  const [lightPanelOpen, setLightPanelOpen] = useState(false)
  const [lightDir, setLightDir] = useState(45)
  const [lightInt, setLightInt] = useState(1.2)

  const [timePanelOpen, setTimePanelOpen] = useState(false)
  const [timeScale, setTimeScale] = useState(1.0)
  
  const [isPaused, setIsPaused] = useState(false)

  const [diskMass, setDiskMass] = useState(10) // kg
  const [diskRadius, setDiskRadius] = useState(3.0) // m
  const [cubeMass, setCubeMass] = useState(5) // kg

  const [simData, setSimData] = useState({
    I_disk: 0, I_cube: 0, I_total: 0,
    L_disk: 0, L_cube: 0, L_total: 0,
    omega: 0, r_cube: 0
  })

  // ─── STYLES ──────────────────────────────────────────────────────────────────
  const panelStyle = {
    position: 'absolute', top: '20px', left: '20px', width: '320px',
    background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)',
    borderRadius: '16px', border: '1px solid #eee', color: '#333',
    padding: '24px', boxSizing: 'border-box', overflowY: 'auto',
    maxHeight: 'calc(100vh - 40px)',
    fontFamily: '"Inter", sans-serif', zIndex: 10,
    boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
    display: 'flex', flexDirection: 'column', gap: '16px'
  }
  const titleStyle = { margin: '0 0 4px 0', fontSize: '18px', fontWeight: 900, textAlign: 'center', color: '#111' }
  const sectionTitleStyle = { margin: '8px 0 4px 0', fontSize: '12px', fontWeight: 800, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }
  const lblStyle = { display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }
  const cardStyle = { background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }
  const valStyle = { fontSize: '16px', fontWeight: 900, color: '#0f172a' }
  const unitStyle = { fontSize: '10px', color: '#64748b', fontWeight: 'bold' }

  const barBgStyle = { width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginTop: '6px' }
  const barFillStyle = (color, width) => ({ height: '100%', background: color, width: `${Math.min(100, Math.max(0, width))}%`, transition: 'width 0.1s linear' } )

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000000', overflow: 'hidden', position: 'relative' }}>
      <div style={panelStyle}>
        <h2 style={titleStyle}>ANGULAR MOMENTUM</h2>
        
        {/* Controls */}
        <div style={cardStyle}>
          <label style={lblStyle}>CUBE MASS (m): {cubeMass.toFixed(1)} kg</label>
          <input type="range" min={1} max={50} step={1} value={cubeMass} onChange={e => setCubeMass(+e.target.value)} style={{ width: '100%', marginBottom: 12 }} />

          <label style={lblStyle}>DISK MASS (M): {diskMass.toFixed(1)} kg</label>
          <input type="range" min={5} max={100} step={1} value={diskMass} onChange={e => setDiskMass(+e.target.value)} style={{ width: '100%', marginBottom: 12 }} />
          
          <label style={lblStyle}>DISK RADIUS (R): {diskRadius.toFixed(1)} m</label>
          <input type="range" min={2} max={6} step={0.1} value={diskRadius} onChange={e => setDiskRadius(+e.target.value)} style={{ width: '100%' }} />
        </div>

        {/* Live Data */}
        <div style={{...cardStyle, borderLeft: '4px solid #f59e0b'}}>
          <div style={sectionTitleStyle}>MOMENT OF INERTIA (I)</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{fontSize: '11px', color: '#475569', fontWeight: 'bold'}}>I_disk</span>
            <span><span style={valStyle}>{simData.I_disk.toFixed(1)}</span> <span style={unitStyle}>kg·m²</span></span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px' }}>
            <span style={{fontSize: '11px', color: '#475569', fontWeight: 'bold'}}>I_cube (m·r²)</span>
            <span><span style={valStyle}>{simData.I_cube.toFixed(1)}</span> <span style={unitStyle}>kg·m²</span></span>
          </div>
          <div style={{ height: '1px', background: '#e2e8f0', margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{fontSize: '12px', color: '#0f172a', fontWeight: '900'}}>I_total</span>
            <span><span style={{...valStyle, color: '#f59e0b'}}>{simData.I_total.toFixed(1)}</span> <span style={unitStyle}>kg·m²</span></span>
          </div>
        </div>

        <div style={{...cardStyle, borderLeft: '4px solid #10b981'}}>
          <div style={sectionTitleStyle}>ANGULAR VELOCITY (ω)</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{fontSize: '12px', color: '#0f172a', fontWeight: '900'}}>ω</span>
            <span><span style={{...valStyle, color: '#10b981'}}>{simData.omega.toFixed(2)}</span> <span style={unitStyle}>rad/s</span></span>
          </div>
          <div style={barBgStyle}>
             <div style={barFillStyle('#10b981', (simData.omega / 10) * 100)} />
          </div>
        </div>

        <div style={{...cardStyle, borderLeft: '4px solid #0ea5e9'}}>
          <div style={sectionTitleStyle}>LINEAR VELOCITY (v)</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{fontSize: '11px', color: '#475569', fontWeight: 'bold'}}>v_disk (edge)</span>
            <span><span style={{...valStyle, color: '#0ea5e9'}}>{simData.v_disk?.toFixed(1) || 0}</span> <span style={unitStyle}>m/s</span></span>
          </div>
          <div style={{...barBgStyle, height: '6px', marginTop: '4px'}}>
             <div style={barFillStyle('#0ea5e9', ((simData.v_disk || 0) / 30) * 100)} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '8px' }}>
            <span style={{fontSize: '11px', color: '#475569', fontWeight: 'bold'}}>v_cube</span>
            <span><span style={{...valStyle, color: '#0ea5e9'}}>{simData.v_cube?.toFixed(1) || 0}</span> <span style={unitStyle}>m/s</span></span>
          </div>
          <div style={{...barBgStyle, height: '6px', marginTop: '4px'}}>
             <div style={barFillStyle('#0ea5e9', ((simData.v_cube || 0) / 30) * 100)} />
          </div>
        </div>

        <div style={{...cardStyle, borderLeft: '4px solid #8b5cf6'}}>
          <div style={sectionTitleStyle}>ANGULAR MOMENTUM (L)</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{fontSize: '12px', color: '#0f172a', fontWeight: '900'}}>L_total (Constant)</span>
            <span><span style={{...valStyle, color: '#8b5cf6'}}>{simData.L_total.toFixed(1)}</span> <span style={unitStyle}>kg·m²/s</span></span>
          </div>
          <div style={barBgStyle}>
             <div style={barFillStyle('#8b5cf6', (simData.L_total / 200) * 100)} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '12px' }}>
            <span style={{fontSize: '11px', color: '#475569', fontWeight: 'bold'}}>L_disk</span>
            <span><span style={{...valStyle, color: '#3b82f6'}}>{simData.L_disk.toFixed(1)}</span> <span style={unitStyle}>kg·m²/s</span></span>
          </div>
          <div style={{...barBgStyle, height: '6px', marginTop: '4px'}}>
             <div style={barFillStyle('#3b82f6', simData.L_total > 0 ? (simData.L_disk / simData.L_total) * 100 : 0)} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '8px' }}>
            <span style={{fontSize: '11px', color: '#475569', fontWeight: 'bold'}}>L_cube</span>
            <span><span style={{...valStyle, color: '#f59e0b'}}>{simData.L_cube.toFixed(1)}</span> <span style={unitStyle}>kg·m²/s</span></span>
          </div>
          <div style={{...barBgStyle, height: '6px', marginTop: '4px'}}>
             <div style={barFillStyle('#f59e0b', simData.L_total > 0 ? (simData.L_cube / simData.L_total) * 100 : 0)} />
          </div>
        </div>

        {/* Start Button */}
        <button 
          onClick={() => setIsPlaying(!isPlaying)} 
          style={{ width: '100%', padding: '14px', borderRadius: '8px', border: 'none', background: '#000', color: '#fff', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '8px' }}
        >
          {isPlaying ? "⏸ PAUSE" : "▶ START"}
        </button>
      </div>

      {/* Işık Kontrol Butonu */}
      <button
        onClick={() => { setLightPanelOpen(!lightPanelOpen); setTimePanelOpen(false); }}
        style={{ position: 'absolute', top: '136px', right: '24px', zIndex: 1000, width: '48px', height: '48px', borderRadius: '14px', border: 'none', background: lightPanelOpen ? '#ffffff' : 'rgba(15, 15, 20, 0.85)', backdropFilter: 'blur(12px)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.25)', transition: 'all 0.3s' }}
        title="Light Controls"
      >
        <LightBulbIcon width={24} height={24} fill={lightPanelOpen ? "#000" : "#fff"} />
      </button>

      {lightPanelOpen && (
        <div style={{ position: 'absolute', top: '136px', right: '82px', zIndex: 999, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)', padding: '16px', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.2)', border: '1px solid #eee', width: '220px', fontFamily: 'sans-serif' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#333', textAlign: 'center' }}>LIGHT CONTROLS</h4>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>ANGLE: {lightDir}°</label>
          <input type="range" min="0" max="360" step="1" value={lightDir} onChange={e => setLightDir(Number(e.target.value))} style={{ width: '100%', marginBottom: '10px' }} />
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>INTENSITY: {lightInt.toFixed(1)}</label>
          <input type="range" min="0" max="3" step="0.1" value={lightInt} onChange={e => setLightInt(Number(e.target.value))} style={{ width: '100%' }} />
        </div>
      )}

      {/* Freeze Time Butonu */}
      <button
        onClick={() => setIsPaused(!isPaused)}
        style={{ position: 'absolute', top: '194px', right: '24px', zIndex: 1000, width: '48px', height: '48px', borderRadius: '14px', border: 'none', background: isPaused ? '#ffffff' : 'rgba(15, 15, 20, 0.85)', backdropFilter: 'blur(12px)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.25)', transition: 'all 0.3s' }}
        title="Freeze Time"
      >
        <TimeIcon width={24} height={24} stroke={isPaused ? '#000000' : '#ffffff'} />
      </button>

      {/* Zaman Kontrol Butonu */}
      <button
        onClick={() => { setTimePanelOpen(!timePanelOpen); setLightPanelOpen(false); }}
        style={{ position: 'absolute', top: '252px', right: '24px', zIndex: 1000, width: '48px', height: '48px', borderRadius: '14px', border: 'none', background: timePanelOpen ? '#ffffff' : 'rgba(15, 15, 20, 0.85)', backdropFilter: 'blur(12px)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.25)', transition: 'all 0.3s' }}
        title="Time Scale"
      >
        <SpeedIcon width={24} height={24} fill={timePanelOpen ? '#000000' : '#ffffff'} />
      </button>

      {timePanelOpen && (
        <div style={{
          position: 'absolute',
          top: '252px',
          right: '82px',
          zIndex: 999,
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(8px)',
          padding: '16px',
          borderRadius: '12px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
          border: '1px solid #eee',
          width: '200px',
          fontFamily: 'sans-serif',
        }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#333', textAlign: 'center' }}>TIME SPEED</h4>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>SPEED: {timeScale.toFixed(2)}x</label>
          <input type="range" min="0.1" max="1" step="0.1" value={timeScale} onChange={e => setTimeScale(Number(e.target.value))} style={{ width: '100%' }} />
        </div>
      )}

      {/* ── 3D SAHNE ─────────────────────────────────────────────────── */}
      <Canvas shadows camera={{ position: [0, 8, 12], fov: 45 }}>
        <color attach="background" args={["#000000"]} />
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[10 * Math.cos(lightDir * Math.PI/180), 20, 10 * Math.sin(lightDir * Math.PI/180)]}
          intensity={lightInt}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
        />
        
        <AngularScene 
          diskMass={diskMass} diskRadius={diskRadius} cubeMass={cubeMass}
          isPlaying={isPlaying} isPaused={isPaused}
          simData={simData} setSimData={setSimData} setIsDraggingParent={setIsDraggingParent}
          timeScale={timeScale}
        />

        <OrbitControls makeDefault enabled={!isDraggingParent} />
      </Canvas>
    </div>
  )
}
