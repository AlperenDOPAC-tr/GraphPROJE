import React, { useState, useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text, Line } from '@react-three/drei'
import { LightBulbIcon, TimeIcon, SpeedIcon } from './Icons'
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

const startBtnStyle = { ...btnStyle, background: 'linear-gradient(135deg, #4caf50, #2e7d32)' }
const resetBtnStyle = { ...btnStyle, background: 'linear-gradient(135deg, #f44336, #c62828)' }

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const PENDULUM_COLOR = '#e91e63'
const SPRING_COLOR = '#2196f3'
const ROOM_COLOR = '#e0e5ec'

// ─── 3D COMPONENTS ───────────────────────────────────────────────────────────

// Kalın Çizgi (Gölgelerin çalışması için Line yerine Cylinder kullanılır)
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
    const angle = Math.atan2(-dx, dy) // Z ekseni etrafında dönüş
    
    segments.push(
      <mesh key={i} position={[midX, midY, p1[2]]} rotation={[0, 0, angle]} castShadow>
        <cylinderGeometry args={[radius, radius, len, 8]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
    )
  }
  return <group>{segments}</group>
}

// Sarkaç
function Pendulum({ length, mass, angle, pivot }) {
  const radius = Math.cbrt(mass) * 0.3 // Kütleye göre boyut

  const endX = pivot[0] + length * Math.sin(angle)
  const endY = pivot[1] - length * Math.cos(angle)
  const endZ = pivot[2]

  return (
    <group>
      {/* İp (Gölge atabilmesi için ThickLine kullanıyoruz) */}
      <ThickLine points={[pivot, [endX, endY, endZ]]} color="#555" radius={0.03} />
      
      {/* Kütle (Küre) */}
      <mesh position={[endX, endY, endZ]} castShadow receiveShadow>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial color={PENDULUM_COLOR} roughness={0.2} metalness={0.5} />
      </mesh>
    </group>
  )
}

// Yay
function SpringMass({ springK, mass, yPos, pivot }) {
  const size = Math.cbrt(mass) * 0.5 // Kütleye göre küp boyutu
  
  // Yayın uç noktası (küpün üstü)
  const endY = yPos + size / 2
  
  // Yay görseli (Zikzak Line)
  const points = []
  const segments = 20
  const springLength = pivot[1] - endY
  
  for (let i = 0; i <= segments; i++) {
    const y = pivot[1] - (i / segments) * springLength
    const x = pivot[0] + (i === 0 || i === segments ? 0 : (i % 2 === 0 ? 0.3 : -0.3))
    points.push([x, y, pivot[2]])
  }

  return (
    <group>
      {/* Yay (Gölge atabilmesi için ThickLine kullanıyoruz) */}
      <ThickLine points={points} color="#777" radius={0.05} />
      
      {/* Kütle (Küp) */}
      <mesh position={[pivot[0], yPos, pivot[2]]} castShadow receiveShadow>
        <boxGeometry args={[size, size, size]} />
        <meshStandardMaterial color={SPRING_COLOR} roughness={0.3} metalness={0.2} />
      </mesh>
    </group>
  )
}

// Ortam Odası (Zemin, Arka Duvar, Tavan)
function Room() {
  const groundTex = useMemo(() => getGroundTexture(6, 3), [])
  return (
    <group>
      {/* Tavan */}
      <mesh position={[0, 8.25, 0]} receiveShadow>
        <boxGeometry args={[30, 0.5, 15]} />
        <meshStandardMaterial map={groundTex} roughness={0.8} />
      </mesh>
      {/* Arka Duvar */}
      <mesh position={[0, 1.5, -7.25]} receiveShadow>
        <boxGeometry args={[30, 13.5, 0.5]} />
        <meshStandardMaterial map={groundTex} roughness={0.9} />
      </mesh>
      {/* Zemin */}
      <mesh position={[0, -5.25, 0]} receiveShadow>
        <boxGeometry args={[30, 0.5, 15]} />
        <meshStandardMaterial map={groundTex} roughness={0.7} />
      </mesh>

      {/* Tavan Kirişi Göstergesi */}
      <mesh position={[0, 8, 0]} receiveShadow>
        <boxGeometry args={[20, 0.2, 1]} />
        <meshStandardMaterial color="#444" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  )
}

// Simülasyon Yöneticisi
function SimulationEngine({ started, isPaused, g, pL, pM, sK, sM, setPState, setSState }) {
  const timeRef = useRef(0)
  
  // Başlangıç değerleri
  const thetaMax = Math.PI / 6 // 30 derece
  const L0 = 4 // Yayın serbest boyu
  const amplitude = 2.5 // Yayın salınım genliği
  
  useFrame((_, delta) => {
    if (!started) {
      timeRef.current = 0
      
      // Sarkaç başlangıç konumu
      setPState({ angle: thetaMax, v: 0 })
      
      // Yay başlangıç konumu (Denge noktası + genlik)
      const delta_y = ((sM * g) / sK) * 0.05 // Görsel olarak uzamayı sınırla
      const yEq = 8 - L0 - delta_y // Denge noktası
      setSState({ y: yEq - amplitude, v: 0 })
      return
    }

    if (isPaused) return

    const dt = Math.min(delta, 1/30)
    timeRef.current += dt
    const t = timeRef.current

    // Sarkaç Analitik Çözümü: θ(t) = θ_max * cos(√(g/L) * t)
    const w_p = Math.sqrt(g / pL)
    const angle = thetaMax * Math.cos(w_p * t)
    const p_v = Math.abs(pL * w_p * thetaMax * Math.sin(w_p * t))
    setPState({ angle, v: p_v })

    // Yay Analitik Çözümü: y(t) = y_eq - A * cos(√(k/m) * t)
    const w_s = Math.sqrt(sK / sM)
    const delta_y = ((sM * g) / sK) * 0.05 // Görsel olarak uzamayı sınırla
    const yEq = 8 - L0 - delta_y
    const y = yEq - amplitude * Math.cos(w_s * t)
    const s_v = Math.abs(amplitude * w_s * Math.sin(w_s * t))
    setSState({ y, v: s_v })
  })

  return null
}

// ─── MAIN APP COMPONENT ──────────────────────────────────────────────────────
export default function HarmonicMotion() {
  const [started, setStarted] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [speedPanelOpen, setSpeedPanelOpen] = useState(false)
  const [timeScale, setTimeScale] = useState(1)
  
  const [g, setG] = useState(9.8)
  
  const [pL, setPL] = useState(6)
  const [pM, setPM] = useState(5)
  const [pState, setPState] = useState({ angle: Math.PI / 6, v: 0 })
  
  const [sK, setSK] = useState(30)
  const [sM, setSM] = useState(5)
  const [sState, setSState] = useState({ y: 0, v: 0 })

  const [lightAngle, setLightAngle] = useState(45)
  const [lightIntensity, setLightIntensity] = useState(1.5)
  const [lightPanelOpen, setLightPanelOpen] = useState(false)

  // Periyot Hesaplamaları
  const T_pendulum = 2 * Math.PI * Math.sqrt(pL / g)
  const T_spring = 2 * Math.PI * Math.sqrt(sM / sK)

  const handleStart = () => setStarted(true)
  const handleReset = () => setStarted(false)

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", background: "#111" }}>
      
      {/* ─── KONTROL PANELİ ───────────────────────────────────────────── */}
      <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10, fontFamily: 'sans-serif' }}>
        <div style={panelStyle}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#000', textAlign: 'center' }}>
            HARMONIC MOTION
          </h3>

          <div style={cardStyle('#9e9e9e')}>
            <label style={lblStyle}>GRAVITY (g): {g.toFixed(1)} m/s²</label>
            <input type="range" min={1} max={25} step={0.1} value={g}
              onChange={e => setG(+e.target.value)}
              disabled={started} style={{ width: '100%' }} />
          </div>

          <div style={cardStyle(PENDULUM_COLOR)}>
            <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#333', marginBottom: 8 }}>PENDULUM (Sarkaç)</div>
            
            <label style={lblStyle}>LENGTH (L): {pL.toFixed(1)} m</label>
            <input type="range" min={1} max={10} step={0.1} value={pL}
              onChange={e => setPL(+e.target.value)}
              disabled={started} style={{ width: '100%', marginBottom: 6 }} />

            <label style={lblStyle}>MASS (m): {pM.toFixed(1)} kg</label>
            <input type="range" min={1} max={20} step={1} value={pM}
              onChange={e => setPM(+e.target.value)}
              disabled={started} style={{ width: '100%', marginBottom: 6 }} />

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
            <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#333', marginBottom: 8 }}>SPRING-MASS (Yay)</div>
            
            <label style={lblStyle}>SPRING CONSTANT (k): {sK} N/m</label>
            <input type="range" min={10} max={100} step={1} value={sK}
              onChange={e => setSK(+e.target.value)}
              disabled={started} style={{ width: '100%', marginBottom: 6 }} />

            <label style={lblStyle}>MASS (m): {sM.toFixed(1)} kg</label>
            <input type="range" min={1} max={20} step={1} value={sM}
              onChange={e => setSM(+e.target.value)}
              disabled={started} style={{ width: '100%', marginBottom: 6 }} />

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

          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            {!started ? (
              <button onClick={handleStart} style={startBtnStyle}>START</button>
            ) : (
              <button onClick={handleReset} style={resetBtnStyle}>RESET</button>
            )}
          </div>
        </div>
      </div>

      {/* Zamanı Durdur (Freeze) Butonu */}
      <button
        onClick={() => setIsPaused(!isPaused)}
        style={{
          position: 'absolute',
          top: '194px',
          right: '24px',
          zIndex: 1000,
          width: '48px',
          height: '48px',
          borderRadius: '14px',
          border: 'none',
          background: isPaused ? '#ffffff' : 'rgba(15, 15, 20, 0.85)',
          backdropFilter: 'blur(12px)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}
        title="Freeze Time"
      >
        <TimeIcon width={24} height={24} stroke={isPaused ? '#000000' : '#ffffff'} />
      </button>

      {/* Hız Kontrol (Slow Motion) Butonu */}
      <button
        onClick={() => setSpeedPanelOpen(!speedPanelOpen)}
        style={{
          position: 'absolute',
          top: '252px',
          right: '24px',
          zIndex: 1000,
          width: '48px',
          height: '48px',
          borderRadius: '14px',
          border: 'none',
          background: speedPanelOpen ? '#ffffff' : 'rgba(15, 15, 20, 0.85)',
          backdropFilter: 'blur(12px)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}
        title="Time Speed"
      >
        <SpeedIcon width={24} height={24} fill={speedPanelOpen ? '#000000' : '#ffffff'} />
      </button>

      {speedPanelOpen && (
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

      {/* Işık Kontrol Butonu */}
      <button
        onClick={() => setLightPanelOpen(!lightPanelOpen)}
        style={{
          position: 'absolute',
          top: '136px',
          right: '24px',
          zIndex: 1000,
          width: '48px',
          height: '48px',
          borderRadius: '14px',
          border: 'none',
          background: lightPanelOpen ? '#ffffff' : 'rgba(15, 15, 20, 0.85)',
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
        <LightBulbIcon width={24} height={24} fill={lightPanelOpen ? "#000" : "#fff"} />
      </button>

      {lightPanelOpen && (
        <div style={{
          position: 'absolute',
          top: '136px',
          right: '82px',
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

      {/* ─── 3D SCENE ──────────────────────────────────────────────────────── */}
      <Canvas shadows camera={{ position: [0, 2, 25], fov: 50 }}>
        <color attach="background" args={['#111']} />
        <ClockScaler timeScale={timeScale} />
        
        <ambientLight intensity={0.5} />
        <directionalLight 
          castShadow
          position={[
            Math.cos(lightAngle * Math.PI / 180) * 30, 
            0, 
            Math.sin(lightAngle * Math.PI / 180) * 30
          ]} 
          intensity={lightIntensity} 
          shadow-mapSize={[2048, 2048]}
        >
          <orthographicCamera attach="shadow-camera" args={[-20, 20, 20, -20, 0.1, 100]} />
        </directionalLight>

        <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2 + 0.2} />

        <SimulationEngine 
          started={started} isPaused={isPaused} g={g} 
          pL={pL} pM={pM} setPState={setPState}
          sK={sK} sM={sM} setSState={setSState}
        />

        <Room />

        <Pendulum length={pL} mass={pM} angle={pState.angle} pivot={[-5, 8, 0]} />
        <SpringMass springK={sK} mass={sM} yPos={sState.y} pivot={[5, 8, 0]} />

      </Canvas>
    </div>
  )
}
