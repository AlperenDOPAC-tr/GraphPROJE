import React, { useState, useRef, useEffect, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, Stars, Line, Text, Billboard } from "@react-three/drei"
import * as THREE from "three"
import { PlayIcon, PauseIcon, ResetIcon, EyeIcon, VectorIcon } from "./Icons"

function SweepMesh({ sweep }) {
  const geom = useMemo(() => {
    const pts = sweep.points
    if (!pts || pts.length < 2) return null
    // Create triangles: (0,0,0) -> pts[i] -> pts[i+1]
    const vertices = []
    for (let i = 0; i < pts.length - 1; i++) {
      vertices.push(0, 0, 0)
      vertices.push(pts[i].x, pts[i].y, pts[i].z)
      vertices.push(pts[i+1].x, pts[i+1].y, pts[i+1].z)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.computeVertexNormals()
    return geometry
  }, [sweep.points])

  if (!geom) return null

  return (
    <group>
      <mesh geometry={geom}>
        <meshBasicMaterial color={sweep.color} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
      {/* Outline for the arc */}
      <line>
        <bufferGeometry attach="geometry" {...new THREE.BufferGeometry().setFromPoints(sweep.points)} />
        <lineBasicMaterial attach="material" color={sweep.color} linewidth={2} />
      </line>
      {/* Connect edges to center */}
      <line>
        <bufferGeometry attach="geometry" {...new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), sweep.points[0]])} />
        <lineBasicMaterial attach="material" color={sweep.color} transparent opacity={0.5} />
      </line>
      <line>
        <bufferGeometry attach="geometry" {...new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), sweep.points[sweep.points.length-1]])} />
        <lineBasicMaterial attach="material" color={sweep.color} transparent opacity={0.5} />
      </line>
      
      <Billboard position={sweep.textPos}>
        <Text fontSize={1.2} color={sweep.color} outlineWidth={0.08} outlineColor="#000" fontWeight="bold">
          {sweep.area.toFixed(1)} m²
        </Text>
      </Billboard>
    </group>
  )
}

function PhysicsCore({ isPlaying, starMass, planetMass, initDist, initVel, resetKey, G, setLiveStats, showSweep, sweepDuration, showVectors }) {
  const planetRef = useRef()
  const trailRef = useRef()
  const velGroup = useRef()
  const forceGroup = useRef()
  const velTextRef = useRef()
  const forceTextRef = useRef()
  
  const path = useRef([])
  const pos = useRef(new THREE.Vector3(initDist, 0, 0))
  const vel = useRef(new THREE.Vector3(0, 0, -initVel)) // Orbit in XZ plane
  
  const [statsUpdateTimer, setStatsUpdateTimer] = useState(0)

  // Sweep states
  const sweepTimer = useRef(0)
  const isSweeping = useRef(false)
  const currentSweepPoints = useRef([])
  const currentSweepArea = useRef(0)
  const currentSweepStartAngle = useRef(0)
  const [finishedSweeps, setFinishedSweeps] = useState([])
  
  const sweepColorCounter = useRef(0)
  const totalAngle = useRef(0)
  const lastAngle = useRef(0)

  // Reset logic
  useEffect(() => {
    pos.current.set(initDist, 0, 0)
    vel.current.set(0, 0, -initVel)
    path.current = [pos.current.clone()]
    
    // Clear sweeps
    sweepTimer.current = 0
    isSweeping.current = false
    currentSweepPoints.current = []
    currentSweepArea.current = 0
    currentSweepStartAngle.current = 0
    setFinishedSweeps([])
    sweepColorCounter.current = 0
    totalAngle.current = 0
    lastAngle.current = 0
    if (trailRef.current) {
      trailRef.current.geometry.setFromPoints(path.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  useFrame((state, delta) => {
    // 1. Calculate live force and orbit type REGARDLESS of playing state
    const rCurrent = pos.current.length()
    const fMag = (G * starMass * planetMass) / (rCurrent * rCurrent)
    const vSpeed = vel.current.length()
    
    // Throttle UI Updates (every ~100ms)
    const t = state.clock.getElapsedTime()
    if (t - statsUpdateTimer > 0.1) {
      setStatsUpdateTimer(t)
      
      const energy = (vSpeed * vSpeed) / 2 - (G * starMass) / rCurrent
      let type = "Elliptical"
      // Added a small epsilon (-0.1) for floating point precision when calculating escape velocity
      if (energy >= -0.1) type = "Escape"
      else {
        const eCirc = -(G * starMass) / (2 * rCurrent)
        if (Math.abs(energy - eCirc) / Math.abs(eCirc) < 0.05) type = "Circular"
      }

      setLiveStats({ vel: vSpeed, dist: rCurrent, force: fMag, type: type })
    }

    // Update Vectors visually REGARDLESS of playing state
    const updateArrow = (groupRef, dirVec, len) => {
      if (groupRef.current && len > 0.1 && showVectors) {
        groupRef.current.visible = true
        groupRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirVec.clone().normalize())
        groupRef.current.children[0].scale.y = len
        groupRef.current.children[0].position.y = len / 2
        groupRef.current.children[1].position.y = len
      } else if (groupRef.current) {
        groupRef.current.visible = false
      }
    }

    const updateText = (textRef, dirVec, len) => {
      if (textRef.current) {
        if (len > 0.1 && showVectors) {
          textRef.current.visible = true
          textRef.current.position.copy(dirVec.clone().normalize().multiplyScalar(len + 0.8))
        } else {
          textRef.current.visible = false
        }
      }
    }

    const vLen = vSpeed * 0.2
    updateArrow(velGroup, vel.current, vLen)
    updateText(velTextRef, vel.current, vLen)

    const fDir = pos.current.clone().normalize().negate()
    const fLen = Math.min(fMag * 0.05, 10)
    updateArrow(forceGroup, fDir, fLen)
    updateText(forceTextRef, fDir, fLen)

    // Update planet visual position regardless of play state
    if (planetRef.current) {
      planetRef.current.position.copy(pos.current)
    }

    // 2. Physics integration ONLY if playing
    if (!isPlaying) return
    let timeToSimulate = Math.min(delta, 0.05) // cap dt for stability

    const sweepColors = ["#a855f7", "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#ec4899", "#14b8a6"]

    // 3. Swept Area Logic with Exact Timing and Continuous Tiling
    while (timeToSimulate > 0) {
      let stepDt = timeToSimulate
      if (showSweep) {
        const timeRemainingInSweep = sweepDuration - sweepTimer.current
        if (stepDt > timeRemainingInSweep) {
          stepDt = timeRemainingInSweep
        }
      }

      const oldPos = pos.current.clone()
      const isFarAway = pos.current.length() > 60

      // 1. Initialize sweep state BEFORE physics step
      if (showSweep && !isFarAway) {
        if (!isSweeping.current) {
          isSweeping.current = true
          currentSweepPoints.current = [oldPos.clone()]
          currentSweepArea.current = 0
          sweepTimer.current = 0
          currentSweepStartAngle.current = totalAngle.current
        }
      } else if (showSweep && isFarAway && isSweeping.current) {
        // Abort sweep if it escapes the simulation area
        isSweeping.current = false
        currentSweepPoints.current = []
        currentSweepArea.current = 0
        sweepTimer.current = 0
      }

      // Sub-stepping for higher integration accuracy (Semi-implicit Euler)
      const subSteps = 10
      const subDt = stepDt / subSteps

      for (let i = 0; i < subSteps; i++) {
        const r = pos.current.length()
        if (r < 2) continue // Crashed into star!

        const rSq = r * r
        const forceMag = G * starMass * planetMass / rSq
        const accelMag = forceMag / planetMass // a = F/m = G * M / r^2
        
        const accelDir = pos.current.clone().normalize().negate()
        const accel = accelDir.multiplyScalar(accelMag)

        const subOldPos = pos.current.clone()

        vel.current.addScaledVector(accel, subDt)
        pos.current.addScaledVector(vel.current, subDt)

        const currentAng = Math.atan2(pos.current.z, pos.current.x)
        let dAng = currentAng - lastAngle.current
        if (dAng > Math.PI) dAng -= 2 * Math.PI
        if (dAng < -Math.PI) dAng += 2 * Math.PI
        totalAngle.current += dAng
        lastAngle.current = currentAng

        if (showSweep && !isFarAway) {
          const cross = new THREE.Vector3().crossVectors(subOldPos, pos.current)
          currentSweepArea.current += 0.5 * cross.length()
        }
      }

      // 3. Post-physics Sweep logic
      if (showSweep && !isFarAway) {
        const lastPt = currentSweepPoints.current[currentSweepPoints.current.length - 1]
        // Add point for geometry
        if (lastPt.distanceTo(pos.current) > 0.1 || Math.abs(sweepDuration - (sweepTimer.current + stepDt)) < 0.0001) {
          currentSweepPoints.current.push(pos.current.clone())
        }

        sweepTimer.current += stepDt

        if (sweepTimer.current >= sweepDuration - 0.0001) {
          const capturedPoints = [...currentSweepPoints.current]
          const capturedArea = currentSweepArea.current
          const startAng = currentSweepStartAngle.current
          const midPt = capturedPoints[Math.floor(capturedPoints.length / 2)]
          const textPos = midPt ? midPt.clone().multiplyScalar(0.6) : new THREE.Vector3()
          textPos.y = 0.5
          
          const endAng = totalAngle.current
          const colorIndex = sweepColorCounter.current % sweepColors.length
          sweepColorCounter.current += 1

          setFinishedSweeps(prev => {
            const filtered = prev.filter(swp => Math.abs(endAng - swp.startAngle) < 2 * Math.PI)
            return [...filtered, {
              points: capturedPoints,
              area: capturedArea,
              textPos,
              startAngle: startAng,
              endAngle: endAng,
              color: sweepColors[colorIndex]
            }]
          })

          // Setup next sweep to tile perfectly without gaps
          isSweeping.current = true
          currentSweepPoints.current = [pos.current.clone()]
          currentSweepArea.current = 0
          sweepTimer.current = 0
          currentSweepStartAngle.current = totalAngle.current
        }
      }

      timeToSimulate -= stepDt
    }

    // Dynamic old sweep deletion upon earliest overlap
    if (finishedSweeps.length > 0) {
      const currentAng = totalAngle.current
      let needsUpdate = false
      for (let i = 0; i < finishedSweeps.length; i++) {
        if (Math.abs(currentAng - finishedSweeps[i].startAngle) >= 2 * Math.PI) {
          needsUpdate = true
          break
        }
      }
      if (needsUpdate) {
        setFinishedSweeps(prev => prev.filter(swp => Math.abs(currentAng - swp.startAngle) < 2 * Math.PI))
      }
    }

    // Update trail
    if (path.current.length === 0 || path.current[path.current.length-1].distanceTo(pos.current) > 0.2) {
      path.current.push(pos.current.clone())
      if (path.current.length > 500) path.current.shift()
      if (trailRef.current) {
        trailRef.current.geometry.setFromPoints(path.current)
      }
    }
  })

  // Dynamic sizing based on mass
  const pRadius = Math.max(0.2, Math.cbrt(planetMass) * 0.4)

  return (
    <group>
      {/* Orbit Trail */}
      <line ref={trailRef}>
        <bufferGeometry />
        <lineBasicMaterial color="#3b82f6" transparent opacity={0.6} linewidth={2} />
      </line>

      {/* Planet */}
      <group ref={planetRef} position={[initDist, 0, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[pRadius, 32, 32]} />
          <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.4} roughness={0.4} metalness={0.6} />
        </mesh>
        
        {/* Vectors */}
        <group ref={velGroup}>
          <mesh position={[0, 1, 0]} castShadow><cylinderGeometry args={[0.1, 0.1, 1, 8]} /><meshBasicMaterial color="#ef4444" /></mesh>
          <mesh position={[0, 2, 0]} castShadow><coneGeometry args={[0.3, 0.6, 8]} /><meshBasicMaterial color="#ef4444" /></mesh>
        </group>
        <Billboard ref={velTextRef}>
          <Text fontSize={1} color="#ef4444" outlineWidth={0.08} outlineColor="#fff" fontWeight="bold">v</Text>
        </Billboard>

        <group ref={forceGroup}>
          <mesh position={[0, 1, 0]} castShadow><cylinderGeometry args={[0.1, 0.1, 1, 8]} /><meshBasicMaterial color="#eab308" /></mesh>
          <mesh position={[0, 2, 0]} castShadow><coneGeometry args={[0.3, 0.6, 8]} /><meshBasicMaterial color="#eab308" /></mesh>
        </group>
        <Billboard ref={forceTextRef}>
          <Text fontSize={1} color="#eab308" outlineWidth={0.08} outlineColor="#fff" fontWeight="bold">F</Text>
        </Billboard>
      </group>

      {/* Render Swept Areas */}
      {showSweep && finishedSweeps.map((swp, i) => (
        <SweepMesh key={i} sweep={swp} />
      ))}
    </group>
  )
}

export default function KeplerSim() {
  const [isPlaying, setIsPlaying] = useState(false)
  
  const [starMass, setStarMass] = useState(1000)
  const [planetMass, setPlanetMass] = useState(1)
  const [initDist, setInitDist] = useState(15)
  const [initVel, setInitVel] = useState(8.16) // ~sqrt(1000/15) for circular orbit
  const [resetKey, setResetKey] = useState(0)
  
  const [showSweep, setShowSweep] = useState(false)
  const [sweepDuration, setSweepDuration] = useState(2)
  const [showVectors, setShowVectors] = useState(true)
  const [uiVisible, setUiVisible] = useState(true)

  const [liveStats, setLiveStats] = useState({ vel: 0, dist: 0, force: 0, type: "Unknown" })

  const G = 1

  const handleReset = () => {
    setIsPlaying(false)
    setResetKey(k => k + 1)
  }

  // Circular velocity helper
  const setCircularVelocity = () => {
    const vCirc = Math.sqrt((G * starMass) / initDist)
    setInitVel(parseFloat(vCirc.toFixed(2)))
    handleReset()
  }

  // Escape velocity helper
  const setEscapeVelocity = () => {
    const vEsc = Math.sqrt((2 * G * starMass) / initDist)
    setInitVel(parseFloat(vEsc.toFixed(2)))
    handleReset()
  }

  const lblStyle = { fontSize: "11px", fontWeight: "bold", color: "#64748b", marginBottom: "4px", display: "block", textTransform: "uppercase", letterSpacing: "0.5px" }
  const panelStyle = { position: "absolute", background: "rgba(255, 255, 255, 0.95)", backdropFilter: "blur(10px)", padding: "20px", borderRadius: "16px", boxShadow: "0 10px 30px rgba(0,0,0,0.15)", zIndex: 10, width: "320px" }
  const iconBtnStyle = (active) => ({ width: "48px", height: "48px", background: active ? "#ffffff" : "rgba(15, 15, 20, 0.85)", color: active ? "#000" : "#fff", border: "none", borderRadius: "14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: active ? "0 4px 12px rgba(0,0,0,0.15)" : "0 4px 20px rgba(0,0,0,0.25)", transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)", backdropFilter: "blur(12px)" })

  const dataCardStyle = { background: "#0f172a", borderRadius: "12px", padding: "16px", marginBottom: "16px", color: "#f8fafc", boxShadow: "inset 0 2px 10px rgba(0,0,0,0.5)", border: "1px solid #1e293b" }
  const cardStyle = { background: "#ffffff", borderRadius: "12px", padding: "16px", boxShadow: "0 4px 15px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0", marginBottom: "16px" }
  const rowStyle = { display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "12px" }

  const sRadius = Math.max(1, Math.cbrt(starMass) * 0.25)

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#000000", fontFamily: "'Inter', sans-serif" }}>
      <Canvas camera={{ position: [0, 25, 35], fov: 50 }}>
        <color attach="background" args={["#000000"]} />
        <ambientLight intensity={0.2} />
        <pointLight position={[0, 0, 0]} intensity={2} color="#facc15" distance={100} />
        <OrbitControls makeDefault enableDamping dampingFactor={0.05} />

        {/* Central Star */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[sRadius, 32, 32]} />
          <meshBasicMaterial color="#facc15" />
        </mesh>
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[sRadius * 1.2, 32, 32]} />
          <meshBasicMaterial color="#facc15" transparent opacity={0.3} blending={THREE.AdditiveBlending} />
        </mesh>

        {/* Gravity Field (Area of Effect) */}
        {[1, 2, 3, 4, 5, 6].map((i) => {
          const r = sRadius * 2 * i;
          return (
            <mesh key={i} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[r, r + 0.1, 64]} />
              <meshBasicMaterial color="#facc15" transparent opacity={0.25 - i * 0.035} />
            </mesh>
          )
        })}

        {/* Visual XZ Grid for reference */}
        <gridHelper args={[100, 100, "#1e293b", "#0f172a"]} position={[0, -0.1, 0]} />

        <PhysicsCore 
          isPlaying={isPlaying} 
          starMass={starMass} 
          planetMass={planetMass} 
          initDist={initDist} 
          initVel={initVel} 
          resetKey={resetKey}
          G={G}
          setLiveStats={setLiveStats}
          showSweep={showSweep}
          sweepDuration={sweepDuration}
          showVectors={showVectors}
        />
      </Canvas>

      {/* LEFT PANEL */}
      {uiVisible && (
        <div style={{ ...panelStyle, left: "20px", top: "20px" }}>
          <h2 style={{ fontSize: "18px", margin: "0 0 20px 0", color: "#1e293b", fontWeight: "800", textAlign: "center" }}>GRAVITY & KEPLER</h2>
        
        {/* LIVE TELEMETRY DATA CARD */}
        <div style={{ ...dataCardStyle, borderLeft: "4px solid #ef4444" }}>
          <div style={{ fontWeight: "bold", color: "#94a3b8", marginBottom: "10px", fontSize: "11px", textTransform: "uppercase" }}>LIVE TELEMETRY</div>
          
          <div style={rowStyle}>
            <span>Distance (r):</span>
            <strong style={{ color: "#f8fafc" }}>{liveStats.dist.toFixed(1)} m</strong>
          </div>
          <div style={rowStyle}>
            <span>Velocity (v):</span>
            <strong style={{ color: "#ef4444" }}>{liveStats.vel.toFixed(1)} m/s</strong>
          </div>
          <div style={rowStyle}>
            <span>Gravity Force (F):</span>
            <strong style={{ color: "#eab308" }}>{liveStats.force.toFixed(1)} N</strong>
          </div>
          <div style={{ ...rowStyle, marginBottom: 0, paddingTop: "8px", borderTop: "1px solid #334155" }}>
            <span>Orbit Type:</span>
            <strong style={{ color: "#a855f7" }}>{liveStats.type}</strong>
          </div>
        </div>

        {/* ORBIT CONTROLS CARD */}
        <div style={cardStyle}>
          <label style={lblStyle}>STAR MASS (M): {starMass}</label>
          <input type="range" min={100} max={3000} step={10} value={starMass} onChange={e => { setStarMass(+e.target.value); handleReset() }} style={{ width: "100%", marginBottom: "16px", accentColor: "#facc15" }} />

          <label style={lblStyle}>PLANET MASS (m): {planetMass}</label>
          <input type="range" min={0.1} max={10} step={0.1} value={planetMass} onChange={e => { setPlanetMass(+e.target.value); handleReset() }} style={{ width: "100%", marginBottom: "16px", accentColor: "#3b82f6" }} />

          <label style={lblStyle}>INITIAL DISTANCE (R₀): {initDist}</label>
          <input type="range" min={5} max={30} step={1} value={initDist} onChange={e => { setInitDist(+e.target.value); handleReset() }} style={{ width: "100%", marginBottom: "16px", accentColor: "#22c55e" }} />

          <label style={lblStyle}>INITIAL VELOCITY (v₀): {initVel}</label>
          <input type="range" min={0} max={20} step={0.1} value={initVel} onChange={e => { setInitVel(+e.target.value); handleReset() }} style={{ width: "100%", marginBottom: "16px", accentColor: "#ef4444" }} />

          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={setCircularVelocity} style={{ flex: 1, padding: "8px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "bold", color: "#334155" }}>CIRCULAR ORBIT</button>
            <button onClick={setEscapeVelocity} style={{ flex: 1, padding: "8px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "bold", color: "#334155" }}>ESCAPE VELOCITY</button>
          </div>
        </div>

        {/* KEPLER SWEEP CONTROLS */}
        <div style={{ ...dataCardStyle, borderLeft: "4px solid #a855f7", marginBottom: "0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showSweep ? "12px" : "0" }}>
            <span style={{ fontSize: "11px", fontWeight: "bold", color: "#94a3b8", textTransform: "uppercase" }}>Kepler's 2nd Law</span>
            <button onClick={() => { setShowSweep(!showSweep); handleReset() }} style={{ padding: "4px 10px", background: showSweep ? "#a855f7" : "#334155", color: "#fff", border: "none", borderRadius: "4px", fontSize: "11px", fontWeight: "bold", cursor: "pointer" }}>
              {showSweep ? "ON" : "OFF"}
            </button>
          </div>
          {showSweep && (
            <>
              <label style={{ ...lblStyle, color: "#94a3b8" }}>SWEEP DURATION: {sweepDuration}s</label>
              <input type="range" min={1} max={10} step={1} value={sweepDuration} onChange={e => { setSweepDuration(+e.target.value); handleReset() }} style={{ width: "100%", accentColor: "#a855f7" }} />
            </>
          )}
        </div>

      </div>
      )}

      {/* RIGHT PANEL CONTROLS */}
      <button onClick={() => setUiVisible(!uiVisible)} style={{ ...iconBtnStyle(!uiVisible), position: "absolute", top: "136px", right: "24px", zIndex: 1000 }} title="Toggle UI">
        <EyeIcon width={24} height={24} fill={!uiVisible ? "#000" : "#fff"} />
      </button>

      <button onClick={() => setIsPlaying(!isPlaying)} style={{ ...iconBtnStyle(isPlaying), position: "absolute", top: "194px", right: "24px", zIndex: 1000 }} title="Play / Pause">
        {isPlaying ? <PauseIcon width={24} height={24} fill="#000" /> : <PlayIcon width={24} height={24} fill="#fff" />}
      </button>

      <button onClick={handleReset} style={{ ...iconBtnStyle(false), position: "absolute", top: "252px", right: "24px", zIndex: 1000 }} title="Reset">
        <ResetIcon width={24} height={24} fill="#fff" />
      </button>

      <button onClick={() => setShowVectors(!showVectors)} style={{ ...iconBtnStyle(!showVectors), position: "absolute", top: "310px", right: "24px", zIndex: 1000 }} title="Toggle Vectors">
        <VectorIcon width={24} height={24} fill={showVectors ? "#fff" : "#000"} />
      </button>
    </div>
  )
}
