import React, { useState, useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Billboard, Text, Edges } from '@react-three/drei'
import * as THREE from 'three'
import { getGroundTexture } from './utils'
import { PlayIcon, PauseIcon, ResetIcon, VectorIcon, LightBulbIcon } from './Icons'

// ─── ICON BTN ─────────────────────────────────────────────────────────────────
const iconBtnBase = {
  position: 'absolute', right: '24px', zIndex: 1000, width: '48px', height: '48px',
  borderRadius: '14px', border: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 4px 20px rgba(0,0,0,0.25)', transition: 'all 0.3s',
  backdropFilter: 'blur(12px)'
}

// ─── VECTOR ARROW ─────────────────────────────────────────────────────────────
function VectorArrow({ posRef, dirRef, lengthRef, color, labelRef, visibleRef }) {
  const groupRef = useRef()
  const billRef  = useRef()
  const txtRef   = useRef()

  const arrow = useMemo(() => {
    return new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, color, 0.4, 0.2
    )
  }, [color])

  useFrame(() => {
    if (!groupRef.current) return
    const pos = posRef.current
    const dir = dirRef.current
    const len = Math.max(0.3, lengthRef.current)
    const vis = visibleRef.current
    groupRef.current.position.copy(pos)
    const d = dir.clone()
    if (d.lengthSq() < 0.0001) { arrow.visible = false; return }
    d.normalize()
    const headLen = Math.min(8.0, len * 0.3)
    arrow.setDirection(d)
    arrow.setLength(len, headLen, headLen * 0.5)
    arrow.visible = vis
    if (billRef.current) {
      billRef.current.position.copy(d).multiplyScalar(len + 8.0)
      billRef.current.visible = vis
    }
    if (txtRef.current) txtRef.current.text = labelRef.current
  })

  return (
    <group ref={groupRef}>
      <primitive object={arrow} />
      <Billboard ref={billRef}>
        <Text ref={txtRef} fontSize={5.5}
          color={`#${color.toString(16).padStart(6, '0')}`}
          outlineWidth={0.4} outlineColor="#000"
          anchorX="center" anchorY="middle">
          {' '}
        </Text>
      </Billboard>
    </group>
  )
}

// ─── SIMULATION SCENE ─────────────────────────────────────────────────────────
function SimulationScene({ omega, initialR, friction, bankAngle, mass, isPlaying }) {
  const turntableRef = useRef()
  const cubeRef = useRef()

  const trackRadius = 110
  const baseThick = 4.0
  const g = 9.81
  const theta = bankAngle * Math.PI / 180
  const isbanked = theta > 0.01

  // Bank angle visual: a wedge ring (sloped track) sitting on the flat disk
  const wedgeBotR = Math.max(5.0, initialR - 20) // Start the slope safely inside the cube
  const wedgeTopR = trackRadius
  const bankRise = isbanked ? (wedgeTopR - wedgeBotR) * Math.tan(theta) : 0

  const wedgePoints = useMemo(() => {
    if (!isbanked) return []
    return [
      new THREE.Vector2(wedgeBotR, 0),
      new THREE.Vector2(wedgeTopR, 0),
      new THREE.Vector2(wedgeTopR, bankRise),
      new THREE.Vector2(wedgeBotR, 0)
    ]
  }, [wedgeBotR, wedgeTopR, bankRise, isbanked])

  // Height on the surface at radius r
  const surfaceH = (r) => {
    if (!isbanked || r <= wedgeBotR) return baseThick
    if (r >= wedgeTopR) return baseThick + bankRise
    return baseThick + (r - wedgeBotR) * Math.tan(theta)
  }
  const th_cube = (isbanked && initialR > wedgeBotR) ? theta : 0
  const surfaceY = surfaceH(initialR) + 5.0 / Math.cos(th_cube)

  // Theory
  const th_stable = (isbanked && initialR > wedgeBotR) ? theta : 0
  const F_outward_stable = mass * omega * omega * initialR * Math.cos(th_stable) - mass * g * Math.sin(th_stable)
  const F_fric_max_stable = mass * friction * (g * Math.cos(th_stable) + omega * omega * initialR * Math.sin(th_stable))
  
  const willSlipOut = F_outward_stable > F_fric_max_stable
  const willSlipIn  = F_outward_stable < -F_fric_max_stable
  const willSlip = willSlipOut || willSlipIn

  // Animation
  const timeRef = useRef(0)
  const flyRef = useRef(null)
  const flyDelayRef = useRef(0)

  useFrame((_, delta) => {
    if (!turntableRef.current || !cubeRef.current) return

    // Only advance time when playing
    if (isPlaying) {
      timeRef.current += delta
    }

    const angle = omega * timeRef.current

    // Platform remains stationary (car on a track model)
    // turntableRef.current.rotation.y = angle

    const fly = flyRef.current

    // Smooth transition function for angle (cube width is 10)
    const getSmoothTh = (r) => {
      const halfW = 5.0
      if (r >= wedgeBotR + halfW) return theta
      if (r <= wedgeBotR - halfW) return 0
      return ((r - (wedgeBotR - halfW)) / (halfW * 2)) * theta
    }

    if (!fly) {
      // ── STABLE: cube rotates at radius R ──
      const x = initialR * Math.cos(angle)
      const z = -initialR * Math.sin(angle)
      
      const tilt = getSmoothTh(initialR)
      const currentSurfaceY = surfaceH(initialR) + 5.0 / Math.cos(tilt)
      
      cubeRef.current.position.set(x, currentSurfaceY, z)
      cubeRef.current.rotation.set(0, angle, tilt, 'YXZ')
      
      cubeRef.current.visible = true
      

      // Velocity: dP/dt = (-Rω sinα, 0, -Rω cosα)
      const speed = omega * initialR
      const vx = -speed * Math.sin(angle)
      const vz = -speed * Math.cos(angle)
                        
      // Centripetal force toward center
            const reqFc = mass * omega * omega * initialR
                  
      // Check fly-off (only when playing)
      if (isPlaying && willSlip) {
        flyDelayRef.current += delta
        if (flyDelayRef.current > 1.0) {
          flyRef.current = {
            r: initialR, vs: 0, angle: angle,
            offEdge: false,
            edgeX: 0, edgeZ: 0, edgeVx: 0, edgeVz: 0, edgeVy: 0, edgeTime: 0
          }
        }
      } else {
        flyDelayRef.current = 0
      }
    } else if (!fly.offEdge) {
      // ── SLIDING on surface ──
      const th = getSmoothTh(fly.r)
      const F_outward = mass * omega * omega * fly.r * Math.cos(th) - mass * g * Math.sin(th)
      const F_fric_max = mass * friction * (g * Math.cos(th) + omega * omega * fly.r * Math.sin(th))

      let a_s = 0
      if (fly.vs > 0.01) {
        a_s = (F_outward - F_fric_max) / mass // sliding out
      } else if (fly.vs < -0.01) {
        a_s = (F_outward + F_fric_max) / mass // sliding in
      } else {
        if (F_outward > F_fric_max) a_s = (F_outward - F_fric_max) / mass
        else if (F_outward < -F_fric_max) a_s = (F_outward + F_fric_max) / mass
      }

      fly.vs += a_s * delta
      fly.r += fly.vs * Math.cos(th) * delta
      fly.angle += omega * delta

      // Inner boundary (flat center)
      if (fly.r < 0.4) {
        fly.r = 0.4
        fly.vs = 0
      }

      // Height on the surface at current radius
      const flyY = surfaceH(Math.min(fly.r, wedgeTopR)) + 5.0 / Math.cos(th)

      const x = fly.r * Math.cos(fly.angle)
      const z = -fly.r * Math.sin(fly.angle)
      cubeRef.current.position.set(x, flyY, z)
      
      cubeRef.current.rotation.set(0, fly.angle, th, 'YXZ')
      
      

      const vTang = omega * fly.r
      const vr = fly.vs * Math.cos(th)
      const vy_vec = fly.vs * Math.sin(th)
      const vx = -vTang * Math.sin(fly.angle) + vr * Math.cos(fly.angle)
      const vz = -vTang * Math.cos(fly.angle) - vr * Math.sin(fly.angle)
      const speed = Math.sqrt(vx * vx + vy_vec * vy_vec + vz * vz)
      
                        
            const reqFc = mass * omega * omega * fly.r
                  
      if (fly.r >= trackRadius) {
        fly.offEdge = true
        fly.edgeTime = timeRef.current
        fly.edgeX = x
        fly.edgeZ = z
        fly.edgeVx = vx
        fly.edgeVz = vz
        fly.edgeVy = vy_vec
        fly.edgeY = flyY
      }
    } else {
      // ── OFF THE EDGE: projectile ──
      const dt = timeRef.current - fly.edgeTime
      const x = fly.edgeX + fly.edgeVx * dt
      const z = fly.edgeZ + fly.edgeVz * dt
      const y = (fly.edgeY || surfaceY) + (fly.edgeVy || 0) * dt - 0.5 * g * dt * dt

      if (y < -50) {
        cubeRef.current.visible = false
                        return
      }

      cubeRef.current.position.set(x, Math.max(-35, y), z)
      
      // Keep tumbling in flight
      cubeRef.current.rotation.x += delta * 3
      cubeRef.current.rotation.z += delta * 2
      
      cubeRef.current.visible = true
      

      const vy = -g * dt
      const vel = new THREE.Vector3(fly.edgeVx, vy, fly.edgeVz)
      const speed = vel.length()
                                  }
  })

  return (
    <group>
      {/* TURNTABLE */}
      <group ref={turntableRef}>
        {/* Flat base platform */}
        <mesh castShadow receiveShadow position={[0, baseThick / 2, 0]}>
          <cylinderGeometry args={[trackRadius, trackRadius, baseThick, 64]} />
          <meshStandardMaterial color="#991b1b" roughness={0.7} metalness={0.2} />
        </mesh>

        {/* Wedge ring for bank angle */}
        {isbanked && (
          <mesh castShadow receiveShadow position={[0, baseThick, 0]}>
            <latheGeometry args={[wedgePoints, 64]} />
            <meshStandardMaterial color="#ef4444" roughness={0.6} metalness={0.4} />
          </mesh>
        )}

        {/* Base Rim wireframe */}
        <mesh position={[0, baseThick + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[trackRadius - 0.2, trackRadius, 64]} />
          <meshBasicMaterial color="#fca5a5" />
        </mesh>

        {/* Sloped Rim wireframe */}
        {isbanked && (
          <mesh position={[0, baseThick + bankRise + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[trackRadius - 0.2, trackRadius, 64]} />
            <meshBasicMaterial color="#f87171" />
          </mesh>
        )}

        {/* Concentric rings on the platform */}
        {[2, 4, 6, 8].filter(r => r < trackRadius).map(r => (
          <mesh key={r} position={[0, surfaceH(r) + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[r - 0.03, r + 0.03, 64]} />
            <meshBasicMaterial color={r > wedgeBotR ? "#f87171" : "#fca5a5"} transparent opacity={0.5} side={THREE.DoubleSide} />
          </mesh>
        ))}

        {/* Radial lines */}
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2
          return (
            <group key={i} rotation={[0, a, 0]}>
              {/* Flat part */}
              <mesh position={[wedgeBotR / 2, baseThick + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[wedgeBotR, 0.04]} />
                <meshBasicMaterial color="#fca5a5" transparent opacity={0.4} side={THREE.DoubleSide} />
              </mesh>
              {/* Sloped part */}
              {isbanked && (
                <mesh 
                  position={[wedgeBotR + (trackRadius - wedgeBotR)/2, baseThick + bankRise/2 + 0.01, 0]} 
                  rotation={[-Math.PI / 2, -theta, 0]}
                >
                  <planeGeometry args={[(trackRadius - wedgeBotR) / Math.cos(theta), 0.04]} />
                  <meshBasicMaterial color="#f87171" transparent opacity={0.4} side={THREE.DoubleSide} />
                </mesh>
              )}
            </group>
          )
        })}

        {/* Center dot */}
        <mesh position={[0, baseThick + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.3, 16]} />
          <meshBasicMaterial color="#fca5a5" />
        </mesh>
      </group>

      {/* PILLAR */}
      <mesh position={[0, -20, 0]}>
        <cylinderGeometry args={[4, 6, 35, 16]} />
        <meshStandardMaterial color="#7f1d1d" metalness={0.5} roughness={0.5} />
      </mesh>

      {/* GROUND */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -37.5, 0]} receiveShadow>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial color="#ffffff" map={getGroundTexture(40, 40)} roughness={0.8} metalness={0.2} />
      </mesh>

      {/* CUBE */}
      <mesh ref={cubeRef} position={[initialR, surfaceY, 0]} castShadow receiveShadow>
        <boxGeometry args={[10, 10, 10]} />
        <meshStandardMaterial color="#22c55e" roughness={0.3} metalness={0.5} />
        <Edges color="#166534" />
      </mesh>

      </group>
  )
}

export default function CircularMotion() {
  const [speedUI,     setSpeedUI]   = useState(20.0)
  const [initialR,    setInitialR]  = useState(10.0)
  const [friction,    setFriction]  = useState(0.2)
  const [bankAngle,   setBankAngle] = useState(15.0)
  const [mass,        setMass]      = useState(10.0)
  const [isPlaying,   setIsPlaying] = useState(false)
    const [resetKey,    setResetKey]  = useState(0)
  const [hasStarted, setHasStarted]   = useState(false)

  const [lightAngle,     setLightAngle]     = useState(45)
  const [lightIntensity, setLightIntensity] = useState(1.8)
  const [lightPanelOpen, setLightPanelOpen] = useState(false)

  const handlePlay = () => {
    if (!hasStarted) { setHasStarted(true); setIsPlaying(true); setResetKey(k => k + 1) }
    else setIsPlaying(p => !p)
  }
  const handleReset = () => { setHasStarted(false); setIsPlaying(false); setResetKey(k => k + 1) }

  // ─── Theory ───
  const g = 9.81
  const thetaRad = bankAngle * Math.PI / 180
  const wedgeBotR = Math.max(5.0, initialR - 20)
  const isbanked = thetaRad > 0.01
  const th_ui = (isbanked && initialR > wedgeBotR) ? thetaRad : 0

  const denomMax = 1 - friction * Math.tan(th_ui)
  const denomMin = 1 + friction * Math.tan(th_ui)

  const maxFc = denomMax > 0.001 ? mass * g * (Math.tan(th_ui) + friction) / denomMax : Infinity
  const minFc = Math.max(0, mass * g * (Math.tan(th_ui) - friction) / denomMin)

  const maxSpeed = isFinite(maxFc) ? Math.sqrt(maxFc * initialR / mass) : Infinity
  const minSpeed = Math.sqrt(minFc * initialR / mass)

  const reqFc = mass * (speedUI * speedUI) / initialR
  const willSlipOut = reqFc > maxFc
  const willSlipIn  = reqFc < minFc
  const willSlip = willSlipOut || willSlipIn
  const omegaPass = speedUI / initialR

  const isSlipping = willSlip
  const barColor = isSlipping ? '#ef4444' : '#3b82f6'
  const maxDisplay = isFinite(maxFc) ? maxFc : Math.max(10, reqFc * 1.5)
  const barPct = Math.min(100, Math.max(0, (reqFc / maxDisplay) * 100))
  const weight = mass * g

  // ─── Styles (identical to AngularMomentum) ───
  const panelSt = {
    position: 'absolute', top: '20px', left: '20px', width: '320px',
    background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)',
    borderRadius: '16px', border: '1px solid #eee', color: '#333',
    padding: '24px', boxSizing: 'border-box', overflowY: 'auto',
    maxHeight: 'calc(100vh - 40px)',
    fontFamily: '"Inter", sans-serif', zIndex: 10,
    boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
    display: 'flex', flexDirection: 'column', gap: '16px'
  }
  const titleSt = { margin: '0 0 4px 0', fontSize: '18px', fontWeight: 900, textAlign: 'center', color: '#111' }
  const sectionSt = { margin: '8px 0 4px 0', fontSize: '12px', fontWeight: 800, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }
  const lblSt = { display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }
  const cardSt = { background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }
  const valSt = { fontSize: '16px', fontWeight: 900, color: '#0f172a' }
  const unitSt = { fontSize: '10px', color: '#64748b', fontWeight: 'bold' }
  const barBgSt = { width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginTop: '6px' }
  const barFillSt = (color, w) => ({ height: '100%', background: color, width: `${Math.min(100, Math.max(0, w))}%`, transition: 'width 0.1s linear' })

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000000', overflow: 'hidden', position: 'relative' }}>

      {/* LEFT PANEL */}
      <div className="left-panel" style={panelSt}>
        <h2 style={titleSt}>CIRCULAR MOTION</h2>

        {/* Controls */}
        <div style={cardSt}>
          <label style={lblSt}>LINEAR SPEED (v): {speedUI.toFixed(1)} m/s ({(speedUI * 3.6).toFixed(1)} km/h)</label>
          <input type="range" min="1" max="100" step="1" value={speedUI}
            onChange={e => setSpeedUI(+e.target.value)} style={{ width: '100%', marginBottom: 12 }} />

          <label style={lblSt}>RADIUS (R): {initialR.toFixed(1)} m</label>
          <input type="range" min="1" max="100" step="1" value={initialR}
            onChange={e => setInitialR(+e.target.value)} style={{ width: '100%', marginBottom: 12 }} />

          <label style={lblSt}>FRICTION (u): {friction.toFixed(2)}</label>
          <input type="range" min="0.05" max="1" step="0.01" value={friction}
            onChange={e => setFriction(+e.target.value)} style={{ width: '100%', marginBottom: 12 }} />

          <label style={lblSt}>BANK ANGLE (th): {bankAngle} deg</label>
          <input type="range" min="0" max="60" step="1" value={bankAngle}
            onChange={e => setBankAngle(+e.target.value)} style={{ width: '100%', marginBottom: 12 }} />

          <label style={lblSt}>MASS (m): {mass.toFixed(1)} kg</label>
          <input type="range" min="0.5" max="50" step="0.5" value={mass}
            onChange={e => setMass(+e.target.value)} style={{ width: '100%' }} />
        </div>

        {/* Centripetal Force */}
        <div style={{ ...cardSt, borderLeft: isSlipping ? '4px solid #ef4444' : '4px solid #3b82f6' }}>
          <div style={sectionSt}>CENTRIPETAL FORCE</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', color: '#475569', fontWeight: 'bold' }}>Max available</span>
            <span><span style={{ ...valSt, color: '#22c55e' }}>{isFinite(maxFc) ? maxFc.toFixed(1) : 'Inf'}</span> <span style={unitSt}>N</span></span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '11px', color: '#475569', fontWeight: 'bold' }}>Required (mw²R)</span>
            <span><span style={{ ...valSt, color: isSlipping ? '#ef4444' : '#0f172a' }}>{reqFc.toFixed(1)}</span> <span style={unitSt}>N</span></span>
          </div>
          <div style={barBgSt}>
            <div style={barFillSt(barColor, barPct)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '8px' }}>
            <span style={{ fontSize: '11px', color: '#475569', fontWeight: 'bold' }}>Min required</span>
            <span><span style={{ ...valSt, color: '#f59e0b' }}>{minFc.toFixed(1)}</span> <span style={unitSt}>N</span></span>
          </div>
          <div style={{ height: '1px', background: '#e2e8f0', margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '11px', color: '#475569', fontWeight: 'bold' }}>Weight (mg)</span>
            <span><span style={valSt}>{weight.toFixed(1)}</span> <span style={unitSt}>N</span></span>
          </div>
          {isSlipping && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#ef4444', fontWeight: 'bold', textAlign: 'center' }}>
              {willSlipOut ? "SLIP: TOO FAST (SLIDING OUT)" : "SLIP: TOO SLOW (SLIDING IN)"}
            </div>
          )}
        </div>

        {/* Linear Velocity */}
        <div style={{ ...cardSt, borderLeft: '4px solid #0ea5e9' }}>
          <div style={sectionSt}>LINEAR SPEED</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', color: '#475569', fontWeight: 'bold' }}>v_max available</span>
            <span><span style={{ ...valSt, color: '#10b981' }}>{isFinite(maxSpeed) ? maxSpeed.toFixed(1) : 'Inf'}</span> <span style={unitSt}>m/s</span></span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '11px', color: '#475569', fontWeight: 'bold' }}>v (current)</span>
            <span><span style={{ ...valSt, color: '#0ea5e9' }}>{speedUI.toFixed(1)}</span> <span style={unitSt}>m/s</span></span>
          </div>
          <div style={barBgSt}>
            <div style={barFillSt('#0ea5e9', isFinite(maxSpeed) ? (speedUI / Math.max(speedUI, maxSpeed)) * 100 : (speedUI / 50) * 100)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '8px' }}>
            <span style={{ fontSize: '11px', color: '#475569', fontWeight: 'bold' }}>v_min required</span>
            <span><span style={{ ...valSt, color: '#f59e0b' }}>{minSpeed.toFixed(1)}</span> <span style={unitSt}>m/s</span></span>
          </div>
        </div>

        {/* Angular Velocity */}
        <div style={{ ...cardSt, borderLeft: '4px solid #f59e0b' }}>
          <div style={sectionSt}>ANGULAR VELOCITY</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '11px', color: '#475569', fontWeight: 'bold' }}>w = v/R</span>
            <span><span style={{ ...valSt, color: '#f59e0b' }}>{(speedUI / initialR).toFixed(2)}</span> <span style={unitSt}>rad/s</span></span>
          </div>
          <div style={barBgSt}>
            <div style={barFillSt('#f59e0b', ((speedUI / initialR) / 10) * 100)} />
          </div>
        </div>
      </div>

      {/* RIGHT BUTTONS */}
      <button onClick={() => setLightPanelOpen(o => !o)}
        style={{ ...iconBtnBase, top: '194px', background: lightPanelOpen ? '#ffffff' : 'rgba(15,15,20,0.85)' }}>
        <LightBulbIcon width={24} height={24} fill={lightPanelOpen ? '#000' : '#fff'} />
      </button>
      {lightPanelOpen && (
        <div style={{
          position: 'absolute', top: '194px', right: '82px', zIndex: 999,
          background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)',
          padding: '16px', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
          border: '1px solid #eee', width: '200px', fontFamily: '"Inter", sans-serif'
        }}>
          <label style={lblSt}>ANGLE: {lightAngle} deg</label>
          <input type="range" min="0" max="360" step="1" value={lightAngle}
            onChange={e => setLightAngle(+e.target.value)} style={{ width: '100%', marginBottom: 10 }} />
          <label style={lblSt}>INTENSITY: {lightIntensity.toFixed(1)}</label>
          <input type="range" min="0" max="3" step="0.1" value={lightIntensity}
            onChange={e => setLightIntensity(+e.target.value)} style={{ width: '100%' }} />
        </div>
      )}

      <button onClick={handlePlay}
        style={{ ...iconBtnBase, top: '252px', background: isPlaying ? '#ffffff' : 'rgba(15,15,20,0.85)' }}>
        {isPlaying
          ? <PauseIcon width={24} height={24} fill="#000" />
          : <PlayIcon  width={24} height={24} fill="#fff" />}
      </button>

      <button onClick={handleReset}
        style={{ ...iconBtnBase, top: '310px', background: 'rgba(15,15,20,0.85)' }}>
        <ResetIcon width={24} height={24} fill="#fff" />
      </button>

      
      <Canvas shadows camera={{ position: [0, 20, 45], fov: 45 }}>
        <color attach="background" args={['#000000']} />
        <ambientLight intensity={0.5} />
        <directionalLight castShadow
          position={[Math.cos(lightAngle * Math.PI / 180) * 30, 20, Math.sin(lightAngle * Math.PI / 180) * 30]}
          intensity={lightIntensity} shadow-mapSize={[2048, 2048]}>
          <orthographicCamera attach="shadow-camera" args={[-20, 20, 20, -20, 0.1, 80]} />
        </directionalLight>
        <OrbitControls makeDefault minPolarAngle={0.1} maxPolarAngle={Math.PI / 2.1} />
        <group scale={0.1}>
          <SimulationScene
            key={resetKey}
            omega={omegaPass} initialR={initialR} friction={friction} bankAngle={bankAngle}
            mass={mass} isPlaying={isPlaying}
          />
        </group>
      </Canvas>
    </div>
  )
}
