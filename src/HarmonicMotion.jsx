import React, { useState, useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text, Billboard } from '@react-three/drei'
import { PlayIcon, PauseIcon, ResetIcon, SpeedIcon, LightBulbIcon, VectorIcon } from './Icons'
import ClockScaler from './ClockScaler'
import * as THREE from 'three'
import { getGroundTexture } from './utils'

// ─── STYLES ──────────────────────────────────────────────────────────────────
const panelStyle = {
  background: 'rgba(255, 255, 255, 0.85)',
  backdropFilter: 'blur(10px)',
  padding: '16px',
  borderRadius: '12px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
  border: '1px solid rgba(255,255,255,0.4)',
  width: '280px',
  maxHeight: '90vh',
  overflowY: 'auto'
}

const cardStyle = (color) => ({
  background: 'rgba(255,255,255,0.6)',
  borderRadius: '8px',
  padding: '12px',
  marginBottom: '12px',
  borderLeft: `4px solid ${color}`,
  boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
})

const lblStyle = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 'bold',
  color: '#444',
  marginBottom: '4px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
}

const btnStyle = {
  flex: 1,
  padding: '10px 0',
  border: 'none',
  borderRadius: '6px',
  fontWeight: 'bold',
  fontSize: '12px',
  cursor: 'pointer',
  transition: 'all 0.2s',
  color: '#fff',
  textShadow: '0 1px 2px rgba(0,0,0,0.2)'
}

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const PENDULUM_COLOR = '#e91e63'
const SPRING_COLOR = '#2196f3'

// ─── ARROW HELPER ─────────────────────────────────────────────────────────────
function VectorArrow({ origin, dir, length, color, label, visible, labelOffset }) {
  const groupRef = useRef(null)
  const billRef  = useRef(null)
  const txtRef   = useRef(null)

  const arrow = useMemo(() => {
    const d = new THREE.Vector3(...dir).normalize()
    return new THREE.ArrowHelper(d, new THREE.Vector3(), 1, color)
  }, [color])

  // labelOffset: [x, y, z] ek ofset — etiketlerin üst üste binmesini önler
  const lo = labelOffset || [0, 0, 0]

  useFrame(() => {
    if (!groupRef.current) return
    const len = Math.max(0.3, length)
    const headLen = Math.min(0.6, Math.max(0.2, len * 0.2))
    const d = new THREE.Vector3(...dir)
    if (d.lengthSq() < 0.0001) { arrow.visible = false; if (txtRef.current) txtRef.current.visible = false; return }
    d.normalize()
    arrow.setDirection(d)
    arrow.setLength(len, headLen, headLen * 0.5)
    arrow.visible = visible

    // Etiketi okun ucunun yanına koy
    if (billRef.current) {
      billRef.current.position.set(
        d.x * (len + 0.3) + lo[0],
        d.y * (len + 0.3) + lo[1] + 0.15,
        d.z * (len + 0.3) + lo[2]
      )
    }
    if (txtRef.current) {
      txtRef.current.visible = visible
    }
  })

  return (
    <group ref={groupRef} position={origin}>
      <primitive object={arrow} />
      <Billboard ref={billRef}>
        <Text ref={txtRef} fontSize={0.45} color={`#${color.toString(16).padStart(6,'0')}`}
              outlineWidth={0.04} outlineColor="#000" anchorX="center" anchorY="bottom">
          {label}
        </Text>
      </Billboard>
    </group>
  )
}

// ─── 3D COMPONENTS ────────────────────────────────────────────────────────────
function ThickLine({ points, color, radius = 0.04 }) {
  const segments = []
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i]
    const p2 = points[i + 1]
    const dx = p2[0] - p1[0]
    const dy = p2[1] - p1[1]
    const len = Math.sqrt(dx * dx + dy * dy)
    const midX = (p1[0] + p2[0]) / 2
    const midY = (p1[1] + p2[1]) / 2
    const angle = Math.atan2(-dx, dy)
    segments.push(
      <mesh key={i} position={[midX, midY, p1[2]]} rotation={[0, 0, angle]} castShadow>
        <cylinderGeometry args={[radius, radius, len, 8]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
    )
  }
  return <group>{segments}</group>
}

// ─── SARKAÇ ───────────────────────────────────────────────────────────────────
function Pendulum({ length, mass, angle, angularVel, g, pivot, showVectors }) {
  const radius = Math.cbrt(mass) * 0.3

  const endX = pivot[0] + length * Math.sin(angle)
  const endY = pivot[1] - length * Math.cos(angle)
  const endZ = pivot[2]

  // ── HIZ: Teğet yönü (ipe dik, hareket yönünde) ──
  const tangentSpeed = Math.abs(angularVel * length)
  const vSign = angularVel >= 0 ? 1 : -1
  const vDirX = vSign * Math.cos(angle)
  const vDirY = vSign * Math.sin(angle)

  // ── TEĞETSEL İVME: Dengeye doğru, yay boyunca ──
  // a_t = g * sin(θ), yönü dengeye doğru
  const atMag = g * Math.abs(Math.sin(angle))
  const atSign = angle > 0 ? -1 : 1
  const atX = atSign * Math.cos(angle)
  const atY = atSign * Math.sin(angle)

  // ── MERKEZCİL İVME: İp boyunca, pivota doğru ──
  // a_c = v²/L = ω²·L
  const acMag = angularVel * angularVel * length
  // Radyal birim vektör (cisimden pivota): (-sinθ, cosθ)
  const acX = -Math.sin(angle)
  const acY = Math.cos(angle)

  // ── NET İVME: Teğetsel + Merkezcil toplamı ──
  const aNetX = atX * atMag + acX * acMag
  const aNetY = atY * atMag + acY * acMag
  const aNetMag = Math.sqrt(aNetX * aNetX + aNetY * aNetY)

  // ── NET KUVVET: F = m * a ──
  const fNetMag = mass * aNetMag

  // Normalize
  const aNetDirX = aNetMag > 0.001 ? aNetX / aNetMag : 0
  const aNetDirY = aNetMag > 0.001 ? aNetY / aNetMag : 0

  const vLen = Math.max(0.3, tangentSpeed * 0.3)
  const aLen = Math.max(0.3, aNetMag * 0.15)
  const fLen = Math.max(0.3, fNetMag * 0.04)

  return (
    <group>
      <ThickLine points={[pivot, [endX, endY, endZ]]} color="#555" radius={0.03} />
      <mesh position={[endX, endY, endZ]} castShadow receiveShadow>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial color={PENDULUM_COLOR} roughness={0.2} metalness={0.5} />
      </mesh>

      <VectorArrow origin={[endX, endY, endZ + 2]} dir={[vDirX, vDirY, 0]} length={vLen}
        color={0x00dd44} label={`v: ${tangentSpeed.toFixed(2)} m/s`}
        visible={showVectors && tangentSpeed > 0.01} labelOffset={[0, 0.8, 0]} />
      <VectorArrow origin={[endX, endY, endZ + 2]} dir={[aNetDirX, aNetDirY, 0]} length={aLen}
        color={0xffcc00} label={`a: ${aNetMag.toFixed(2)} m/s²`}
        visible={showVectors && aNetMag > 0.01} labelOffset={[0, 0, 0]} />
      <VectorArrow origin={[endX, endY, endZ + 2]} dir={[aNetDirX, aNetDirY, 0]} length={fLen}
        color={0xff3333} label={`Fnet: ${fNetMag.toFixed(1)} N`}
        visible={showVectors && fNetMag > 0.01} labelOffset={[0, -0.8, 0]} />
    </group>
  )
}

// ─── YAY-KÜTLE ────────────────────────────────────────────────────────────────
function SpringMass({ springK, mass, yPos, yEq, vel, g, pivot, showVectors }) {
  const size = Math.cbrt(mass) * 0.5
  const endY = yPos + size / 2
  const L0 = 4
  const springLength = pivot[1] - endY

  const points = []
  const segments = 20
  for (let i = 0; i <= segments; i++) {
    const y = pivot[1] - (i / segments) * springLength
    const x = pivot[0] + (i === 0 || i === segments ? 0 : (i % 2 === 0 ? 0.3 : -0.3))
    points.push([x, y, pivot[2]])
  }

  const displacement = yPos - yEq
  const springForce  = -springK * displacement
  const netForce     = springForce
  const accel        = netForce / mass
  const speed = Math.abs(vel)

  const vDir  = vel >= 0 ? [0, 1, 0] : [0, -1, 0]
  const fDir  = netForce >= 0 ? [0, 1, 0] : [0, -1, 0]
  const aDir  = fDir

  const vLen = Math.max(0.3, speed * 0.3)
  const fLen = Math.max(0.3, Math.abs(netForce) * 0.04)
  const aLen = Math.max(0.3, Math.abs(accel) * 0.15)

  // Vektörleri cismin sağına offset'le yerleştir, üst üste binmesinler
  const ox = pivot[0] + size * 0.8

  return (
    <group>
      <ThickLine points={points} color="#777" radius={0.05} />
      <mesh position={[pivot[0], yPos, pivot[2]]} castShadow receiveShadow>
        <boxGeometry args={[size, size, size]} />
        <meshStandardMaterial color={SPRING_COLOR} roughness={0.3} metalness={0.2} />
      </mesh>

      <VectorArrow origin={[ox, yPos, pivot[2] + 2]} dir={vDir} length={vLen}
        color={0x00dd44} label={`v: ${speed.toFixed(2)} m/s`}
        visible={showVectors && speed > 0.01} labelOffset={[0.8, 0, 0]} />
      <VectorArrow origin={[ox + 1.4, yPos, pivot[2] + 2]} dir={aDir} length={aLen}
        color={0xffcc00} label={`a: ${Math.abs(accel).toFixed(2)} m/s²`}
        visible={showVectors && Math.abs(netForce) > 0.05} labelOffset={[0.8, 0, 0]} />
      <VectorArrow origin={[ox + 2.8, yPos, pivot[2] + 2]} dir={fDir} length={fLen}
        color={0xff3333} label={`F: ${Math.abs(netForce).toFixed(1)} N`}
        visible={showVectors && Math.abs(netForce) > 0.05} labelOffset={[0.8, 0, 0]} />
    </group>
  )
}

function Room() {
  return (
    <group>
      {/* Background Wall - Enlarged */}
      <mesh position={[0, 4.5, -7.25]} receiveShadow>
        <boxGeometry args={[45, 25, 0.5]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.9} />
      </mesh>

      {/* Mounting rod for Pendulum */}
      <mesh position={[-5, 8, -3.625]} castShadow receiveShadow>
        <boxGeometry args={[0.2, 0.2, 7.25]} />
        <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.4} />
      </mesh>
      
      {/* Mounting rod for Spring */}
      <mesh position={[5, 8, -3.625]} castShadow receiveShadow>
        <boxGeometry args={[0.2, 0.2, 7.25]} />
        <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  )
}

function SimulationEngine({ hasStarted, isPlaying, resetTrigger, g, pL, pM, sK, sM, setPState, setSState }) {
  const timeRef = useRef(0)
  const thetaMax = Math.PI / 6
  const L0 = 4
  const amplitude = 2.5

  useFrame((_, delta) => {
    if (!hasStarted) {
      timeRef.current = 0
      setPState({ angle: thetaMax, angularVel: 0, v: 0 })
      const delta_y = ((sM * g) / sK) * 0.05
      const yEq = 8 - L0 - delta_y
      setSState({ y: yEq - amplitude, yEq, vel: 0, v: 0 })
      return
    }
    if (!isPlaying) return

    const dt = Math.min(delta, 1/30)
    timeRef.current += dt
    const t = timeRef.current

    const w_p = Math.sqrt(g / pL)
    const angle = thetaMax * Math.cos(w_p * t)
    const angularVel = -thetaMax * w_p * Math.sin(w_p * t)
    const p_v = Math.abs(pL * angularVel)
    setPState({ angle, angularVel, v: Math.abs(p_v) })

    const w_s = Math.sqrt(sK / sM)
    const delta_y = ((sM * g) / sK) * 0.05
    const yEq = 8 - L0 - delta_y
    const y = yEq - amplitude * Math.cos(w_s * t)
    const vel = amplitude * w_s * Math.sin(w_s * t)
    const s_v = Math.abs(vel)
    setSState({ y, yEq, vel, v: s_v })
  })

  return null
}

export default function HarmonicMotion() {
  const [hasStarted, setHasStarted]     = useState(false)
  const [isPlaying, setIsPlaying]       = useState(false)
  const [resetTrigger, setResetTrigger] = useState(0)
  const [speedPanelOpen, setSpeedPanelOpen] = useState(false)
  const [timeScale, setTimeScale]       = useState(1)
  const [showVectors, setShowVectors]   = useState(false)

  const [g, setG] = useState(9.8)

  const [pL, setPL] = useState(6)
  const [pM, setPM] = useState(5)
  const [pState, setPState] = useState({ angle: Math.PI / 6, angularVel: 0, v: 0 })

  const [sK, setSK] = useState(30)
  const [sM, setSM] = useState(5)
  const [sState, setSState] = useState({ y: 0, yEq: 0, vel: 0, v: 0 })

  const [lightAngle, setLightAngle]         = useState(45)
  const [lightIntensity, setLightIntensity] = useState(1.5)
  const [lightPanelOpen, setLightPanelOpen] = useState(false)

  const T_pendulum = 2 * Math.PI * Math.sqrt(pL / g)
  const T_spring   = 2 * Math.PI * Math.sqrt(sM / sK)

  const handlePlayPause = () => {
    if (!hasStarted) { setHasStarted(true); setIsPlaying(true); setResetTrigger(p => p + 1) }
    else setIsPlaying(!isPlaying)
  }
  const handleReset = () => { setHasStarted(false); setIsPlaying(false); setResetTrigger(p => p + 1) }

  const iconBtnBase = {
    position: 'absolute', right: '24px', zIndex: 1000,
    width: '48px', height: '48px', borderRadius: '14px', border: 'none',
    backdropFilter: 'blur(12px)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
    transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
  }

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", background: "#111" }}>

      <div className="left-panel" style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10, fontFamily: 'sans-serif' }}>
        <div className="left-panel" style={panelStyle}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#000', textAlign: 'center' }}>
            HARMONIC MOTION
          </h3>

          <div style={cardStyle('#9e9e9e')}>
            <label style={lblStyle}>GRAVITY (g): {g.toFixed(1)} m/s²</label>
            <input type="range" min={1} max={25} step={0.1} value={g}
              onChange={e => setG(+e.target.value)}
              disabled={hasStarted} style={{ width: '100%' }} />
          </div>

          <div style={cardStyle(PENDULUM_COLOR)}>
            <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#333', marginBottom: 8 }}>PENDULUM</div>
            <label style={lblStyle}>LENGTH (L): {pL.toFixed(1)} m</label>
            <input type="range" min={1} max={10} step={0.1} value={pL}
              onChange={e => setPL(+e.target.value)}
              disabled={hasStarted} style={{ width: '100%', marginBottom: 6 }} />
            <label style={lblStyle}>MASS (m): {pM.toFixed(1)} kg</label>
            <input type="range" min={1} max={20} step={1} value={pM}
              onChange={e => setPM(+e.target.value)}
              disabled={hasStarted} style={{ width: '100%', marginBottom: 6 }} />
            <div style={{ marginTop: 8, fontSize: '16px', fontWeight: 'bold', color: PENDULUM_COLOR }}>
              T = {T_pendulum.toFixed(2)} s
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: '10px', color: '#666', fontWeight: 'bold', marginBottom: '2px' }}>
                SPEED: {pState.v?.toFixed(2) || '0.00'} m/s
              </div>
              <div style={{ width: '100%', height: '8px', background: '#e0e0e0', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, ((pState.v || 0) / 10) * 100)}%`, height: '100%', background: PENDULUM_COLOR }} />
              </div>
            </div>
          </div>

          <div style={cardStyle(SPRING_COLOR)}>
            <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#333', marginBottom: 8 }}>SPRING-MASS</div>
            <label style={lblStyle}>SPRING CONSTANT (k): {sK} N/m</label>
            <input type="range" min={10} max={100} step={1} value={sK}
              onChange={e => setSK(+e.target.value)}
              disabled={hasStarted} style={{ width: '100%', marginBottom: 6 }} />
            <label style={lblStyle}>MASS (m): {sM.toFixed(1)} kg</label>
            <input type="range" min={1} max={20} step={1} value={sM}
              onChange={e => setSM(+e.target.value)}
              disabled={hasStarted} style={{ width: '100%', marginBottom: 6 }} />
            <div style={{ marginTop: 8, fontSize: '16px', fontWeight: 'bold', color: SPRING_COLOR }}>
              T = {T_spring.toFixed(2)} s
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: '10px', color: '#666', fontWeight: 'bold', marginBottom: '2px' }}>
                SPEED: {sState.v?.toFixed(2) || '0.00'} m/s
              </div>
              <div style={{ width: '100%', height: '8px', background: '#e0e0e0', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, ((sState.v || 0) / 20) * 100)}%`, height: '100%', background: SPRING_COLOR }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <button onClick={() => setLightPanelOpen(!lightPanelOpen)}
        style={{ ...iconBtnBase, top: '194px', background: lightPanelOpen ? '#ffffff' : 'rgba(15,15,20,0.85)' }}
        title="Light Controls">
        <LightBulbIcon width={24} height={24} fill={lightPanelOpen ? '#000' : '#fff'} />
      </button>
      {lightPanelOpen && (
        <div style={{ position:'absolute', top:'194px', right:'82px', zIndex:999,
          background:'rgba(255,255,255,0.85)', backdropFilter:'blur(8px)', padding:'16px',
          borderRadius:'12px', boxShadow:'0 8px 30px rgba(0,0,0,0.2)', border:'1px solid #eee',
          width:'220px', fontFamily:'sans-serif' }}>
          <h4 style={{ margin:'0 0 10px 0', fontSize:'12px', color:'#333', textAlign:'center' }}>LIGHT CONTROLS</h4>
          <label style={{ display:'block', fontSize:'11px', fontWeight:'bold', color:'#333' }}>ANGLE: {lightAngle}°</label>
          <input type="range" min="0" max="360" step="1" value={lightAngle} onChange={e => setLightAngle(Number(e.target.value))} style={{ width:'100%', marginBottom:'10px' }} />
          <label style={{ display:'block', fontSize:'11px', fontWeight:'bold', color:'#333' }}>INTENSITY: {lightIntensity.toFixed(1)}</label>
          <input type="range" min="0" max="3" step="0.1" value={lightIntensity} onChange={e => setLightIntensity(Number(e.target.value))} style={{ width:'100%' }} />
        </div>
      )}

      <button onClick={handlePlayPause}
        style={{ ...iconBtnBase, top:'252px', background: isPlaying ? '#ffffff' : 'rgba(15,15,20,0.85)' }}
        title="Play / Pause">
        {isPlaying ? <PauseIcon width={24} height={24} fill="#000000" /> : <PlayIcon width={24} height={24} fill="#ffffff" />}
      </button>

      <button onClick={handleReset}
        style={{ ...iconBtnBase, top:'310px', background:'rgba(15,15,20,0.85)' }}
        title="Reset Simulation">
        <ResetIcon width={24} height={24} fill="#ffffff" />
      </button>

      <button onClick={() => setSpeedPanelOpen(!speedPanelOpen)}
        style={{ ...iconBtnBase, top:'368px', background: speedPanelOpen ? '#ffffff' : 'rgba(15,15,20,0.85)' }}
        title="Time Speed">
        <SpeedIcon width={24} height={24} fill={speedPanelOpen ? '#000000' : '#ffffff'} />
      </button>
      {speedPanelOpen && (
        <div style={{ position:'absolute', top:'368px', right:'82px', zIndex:999,
          background:'rgba(255,255,255,0.85)', backdropFilter:'blur(8px)', padding:'16px',
          borderRadius:'12px', boxShadow:'0 8px 30px rgba(0,0,0,0.2)', border:'1px solid #eee',
          width:'200px', fontFamily:'sans-serif' }}>
          <h4 style={{ margin:'0 0 10px 0', fontSize:'12px', color:'#333', textAlign:'center' }}>TIME SPEED</h4>
          <label style={{ display:'block', fontSize:'11px', fontWeight:'bold', color:'#333' }}>SPEED: {timeScale.toFixed(2)}x</label>
          <input type="range" min="0.1" max="1" step="0.1" value={timeScale} onChange={e => setTimeScale(Number(e.target.value))} style={{ width:'100%' }} />
        </div>
      )}

      <button onClick={() => setShowVectors(!showVectors)}
        style={{ ...iconBtnBase, top:'426px', background: showVectors ? '#ffffff' : 'rgba(15,15,20,0.85)' }}
        title="Toggle Vectors">
        <VectorIcon width={24} height={24} fill={showVectors ? '#000000' : '#ffffff'} />
      </button>



      <Canvas shadows camera={{ position: [0, 2, 25], fov: 50 }}>
        <color attach="background" args={['#111']} />
        <ClockScaler timeScale={timeScale} />

        <ambientLight intensity={0.5} />
        <directionalLight castShadow
          position={[Math.cos(lightAngle * Math.PI / 180) * 30, 0, Math.sin(lightAngle * Math.PI / 180) * 30]}
          intensity={lightIntensity} shadow-mapSize={[2048, 2048]}>
          <orthographicCamera attach="shadow-camera" args={[-20, 20, 20, -20, 0.1, 100]} />
        </directionalLight>

        <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2 + 0.2} />

        <SimulationEngine
          hasStarted={hasStarted} isPlaying={isPlaying} resetTrigger={resetTrigger} g={g}
          pL={pL} pM={pM} setPState={setPState}
          sK={sK} sM={sM} setSState={setSState}
        />

        <Room />

        <Pendulum
          length={pL} mass={pM} angle={pState.angle}
          angularVel={pState.angularVel ?? 0} g={g}
          pivot={[-5, 8, 0]} showVectors={showVectors}
        />
        <SpringMass
          springK={sK} mass={sM} yPos={sState.y}
          yEq={sState.yEq ?? sState.y} vel={sState.vel ?? 0} g={g}
          pivot={[5, 8, 0]} showVectors={showVectors}
        />
      </Canvas>
    </div>
  )
}
