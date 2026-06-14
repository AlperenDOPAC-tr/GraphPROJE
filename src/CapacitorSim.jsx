import React, { useState, useRef, useMemo, useCallback } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, Text } from "@react-three/drei"
import * as THREE from "three"
import { LightBulbIcon, PlayIcon, PauseIcon, ResetIcon, SpeedIcon } from "./Icons"
import SpotLightFixture from "./SpotLightFixture"

const EPS0 = 8.854e-12

// ─── CHECKER GROUND ──────────────────────────────────────────────────────────
function CheckerGround() {
  const tex = useMemo(() => {
    const canvas = document.createElement("canvas")
    canvas.width = 512; canvas.height = 512
    const ctx = canvas.getContext("2d")
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 512, 512)
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 256, 256); ctx.fillRect(256, 256, 256, 256)
    const t = new THREE.CanvasTexture(canvas)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(10, 10); t.anisotropy = 16
    return t
  }, [])
  return (
    <mesh position={[0, -0.5, 0]} receiveShadow>
      <boxGeometry args={[60, 1, 60]} />
      <meshStandardMaterial map={tex} roughness={0.8} metalness={0.1} />
    </mesh>
  )
}

// ─── PLATES ──────────────────────────────────────────────────────────────────
// chargeCount is always a perfect square so the grid never has gaps
function Plate({ position, size, isPositive }) {
  const color = isPositive ? "#ef4444" : "#3b82f6"
  const glowColor = isPositive ? "#ff6b6b" : "#60a5fa"

  // Perfect square grid based on plate size only – no voltage dependency
  const gridN = Math.max(2, Math.min(7, Math.round(size / 1.1)))

  const chargePositions = useMemo(() => {
    const positions = []
    for (let row = 0; row < gridN; row++) {
      for (let col = 0; col < gridN; col++) {
        const x = gridN > 1 ? (col / (gridN - 1) - 0.5) * size * 0.82 : 0
        const y = gridN > 1 ? (row / (gridN - 1) - 0.5) * size * 0.82 : 0
        positions.push([x, y])
      }
    }
    return positions
  }, [gridN, size])

  const faceZ = isPositive ? size * 0.05 + 0.12 : -(size * 0.05 + 0.12)

  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[size, size, size * 0.1]} />
        <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh>
        <boxGeometry args={[size + 0.04, size + 0.04, size * 0.1 + 0.02]} />
        <meshStandardMaterial color={glowColor} transparent opacity={0.2} depthWrite={false} />
      </mesh>
      {chargePositions.map((pos, i) => (
        <Text key={i} position={[pos[0], pos[1], faceZ]} fontSize={size * 0.08} color="#fff" anchorX="center" anchorY="middle">
          {isPositive ? "+" : "\u2212"}
        </Text>
      ))}
      <Text position={[0, size / 2 + 0.5, 0]} fontSize={0.5} color={color} anchorX="center">
        {isPositive ? "+ Plate" : "\u2212 Plate"}
      </Text>
    </group>
  )
}

// ─── CIRCUIT DECORATION ──────────────────────────────────────────────────────────
function CircuitDecoration({ plateSep, plateSize, voltage }) {
  const battX = plateSize / 2 + 4.0 // battery to the right
  const battH = 3.6
  const battY = battH / 2 // sit on ground
  const wireThick = 0.07
  const wireY = 0.1 // wire on the ground

  // Red wire: + plate (z: -plateSep/2) to battery + terminal
  const redWire = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(plateSize / 2, 0.5, -plateSep / 2),
      new THREE.Vector3(plateSize / 2 + 1, wireY, -plateSep / 2),
      new THREE.Vector3(battX, wireY, -plateSep / 4),
      new THREE.Vector3(battX, wireY, 0),
      new THREE.Vector3(battX, battH, 0),
    ])
    return new THREE.TubeGeometry(curve, 50, wireThick, 8, false)
  }, [plateSep, plateSize, battX, battH])

  // Black wire: - plate (z: plateSep/2) to battery - terminal
  const blackWire = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(plateSize / 2, 0.5, plateSep / 2),
      new THREE.Vector3(plateSize / 2 + 1, wireY, plateSep / 2),
      new THREE.Vector3(battX, wireY, plateSep / 4),
      new THREE.Vector3(battX, wireY, 0),
      new THREE.Vector3(battX, 0, 0),
    ])
    return new THREE.TubeGeometry(curve, 50, wireThick, 8, false)
  }, [plateSep, plateSize, battX])

  return (
    <group>
      {/* Red wire (+) */}
      <mesh geometry={redWire} castShadow>
        <meshStandardMaterial color="#dc2626" metalness={0.1} roughness={0.5} />
      </mesh>

      {/* Black wire (-) */}
      <mesh geometry={blackWire} castShadow>
        <meshStandardMaterial color="#1e293b" metalness={0.1} roughness={0.5} />
      </mesh>

      {/* Battery body */}
      <mesh position={[battX, battY, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.7, 0.7, battH, 32]} />
        <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Battery stripe (label band) */}
      <mesh position={[battX, battY + 0.5, 0]}>
        <cylinderGeometry args={[0.72, 0.72, 0.8, 32]} />
        <meshStandardMaterial color="#facc15" metalness={0.2} roughness={0.4} />
      </mesh>
      {/* Positive terminal (top, connects to red wire) */}
      <mesh position={[battX, battH + 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.28, 0.3, 16]} />
        <meshStandardMaterial color="#ef4444" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Negative terminal (bottom, connects to black wire) */}
      <mesh position={[battX, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.4, 0.4, 0.2, 16]} />
        <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Labels facing the plates (-X axis) so they are visible from between the plates */}
      {/* Voltage */}
      <Text position={[battX - 0.73, battY + 0.5, 0]} rotation={[0, -Math.PI / 2, 0]} fontSize={0.5} color="#ffffff" anchorX="center" anchorY="middle" fontWeight="bold" outlineWidth={0.05} outlineColor="#000000">
        {voltage}V
      </Text>
      
      {/* Terminal labels */}
      <Text position={[battX, battH + 0.6, 0]} rotation={[0, 0, 0]} fontSize={0.5} color="#ef4444" anchorX="center" anchorY="middle" fontWeight="bold">
        +
      </Text>

      {/* Minus sign on the battery body */}
      <Text position={[battX - 0.71, battY - 1.2, 0]} rotation={[0, -Math.PI / 2, 0]} fontSize={0.6} color="#ffffff" anchorX="center" anchorY="middle" fontWeight="bold" outlineWidth={0.05} outlineColor="#000000">
        −
      </Text>
    </group>
  )
}

// ─── FIELD LINES ─────────────────────────────────────────────────────────────
function FieldLines({ gap, plateSize, voltage, numLines, timeScale }) {
  const meshRef = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  // Gentle speed: proportional to voltage, stays observable
  const speed = Math.max(0.15, voltage / 80)

  const state = useRef([])
  useMemo(() => {
    state.current = []
    // Perfect symmetric grid: gridN x gridN lines, evenly spaced
    const gridN = Math.max(1, Math.min(4, Math.round(Math.sqrt(numLines))))
    for (let row = 0; row < gridN; row++) {
      for (let col = 0; col < gridN; col++) {
        for (let p = 0; p < 5; p++) {
          const x = gridN > 1 ? (col / (gridN - 1) - 0.5) * plateSize * 0.78 : 0
          const y = gridN > 1 ? (row / (gridN - 1) - 0.5) * plateSize * 0.78 : 0
          state.current.push({ lx: x, ly: y, z: -gap / 2 + (p / 5) * gap })
        }
      }
    }
  }, [numLines, gap, plateSize])

  const actualCount = useMemo(() => {
    const gridN = Math.max(1, Math.min(4, Math.round(Math.sqrt(numLines))))
    return gridN * gridN * 5
  }, [numLines])

  useFrame((_, delta) => {
    if (!meshRef.current) return
    const dt = delta * timeScale
    state.current.forEach((p, i) => {
      p.z += speed * dt * 2.5
      if (p.z > gap / 2) p.z = -gap / 2
      const progress = (p.z + gap / 2) / gap
      const alpha = Math.sin(progress * Math.PI)
      dummy.position.set(p.lx, p.ly, p.z)
      dummy.scale.setScalar(0.09 + alpha * 0.13)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  if (voltage < 1) return null
  return (
    <instancedMesh ref={meshRef} args={[null, null, actualCount]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial color="#facc15" emissive="#fde047" emissiveIntensity={2.0} transparent opacity={0.9} />
    </instancedMesh>
  )
}

// ─── TEST CHARGE ─────────────────────────────────────────────────────────────
// Real physics: particle has q = 1 μC, m = 1 mg → q/m = 1
// Therefore: a = (q/m)·E = E_field (m/s²)
// Displayed force: F = q·E = 1e-6 × E_field (N) = E_field (μN)
// Displayed velocity: velRef in m/s (1 scene unit = 1 m)
function TestCharge({ eField, gap, onReset, onUpdate, running, timeScale }) {
  const meshRef = useRef()
  const velRef = useRef(0)
  const posRef = useRef(-gap / 2 + 0.4) // starts just in front of + plate

  useMemo(() => {
    velRef.current = 0
    posRef.current = -gap / 2 + 0.4
  }, [gap])

  useFrame((_, delta) => {
    if (!meshRef.current) return
    if (!running) {
      meshRef.current.position.z = posRef.current
      return
    }
    // Fixed timestep for deterministic results (independent of frame rate)
    const FIXED_DT = 1 / 60
    const dt = FIXED_DT * timeScale
    velRef.current += eField * dt
    posRef.current += velRef.current * dt

    if (posRef.current >= gap / 2 - 0.3) {
      posRef.current = gap / 2 - 0.3
      velRef.current = 0
      onReset(); return
    }
    meshRef.current.position.z = posRef.current
    onUpdate(eField, velRef.current)
  })

  return (
    <group>
      <mesh ref={meshRef} position={[0, 0, -gap / 2 + 0.4]} castShadow>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color="#a855f7" emissive="#a855f7" emissiveIntensity={0.8} />
      </mesh>
      <Text position={[0, 0.65, -gap / 2 + 0.4]} fontSize={0.35} color="#a855f7" anchorX="center">q+</Text>
    </group>
  )
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function CapacitorSim() {
  const [voltage, setVoltage] = useState(50)
  const [plateSep, setPlateSep] = useState(6)
  const [plateArea, setPlateArea] = useState(25)
  const [kappa, setKappa] = useState(1.0)

  const [chargeVisible, setChargeVisible] = useState(false)
  const [chargeRunning, setChargeRunning] = useState(false)
  const [chargeKey, setChargeKey] = useState(0)
  const [timeScale, setTimeScale] = useState(1.0)
  const [particleForce, setParticleForce] = useState(0)
  const [particleVel, setParticleVel] = useState(0)

  const [lightPanelOpen, setLightPanelOpen] = useState(false)
  const [speedPanelOpen, setSpeedPanelOpen] = useState(false)
  const [lightDir, setLightDir] = useState(45)
  const [lightInt, setLightInt] = useState(1.5)

  // Physics
  const plateSize = Math.sqrt(plateArea)
  const C = (kappa * EPS0 * plateArea) / plateSep
  const Q = C * voltage
  const E_field = voltage / plateSep
  const U = 0.5 * C * voltage * voltage
  // Fewer field lines: max 12
  const numFieldLines = Math.max(3, Math.min(12, Math.round(voltage / 15 + plateSep / 4)))

  const handlePlayPause = useCallback(() => {
    if (!chargeVisible) {
      setChargeVisible(true)
      setChargeRunning(true)
    } else {
      setChargeRunning(r => !r)
    }
  }, [chargeVisible])

  const handleReset = useCallback(() => {
    setChargeRunning(false)
    setChargeVisible(false)
    setParticleForce(0)
    setParticleVel(0)
    setChargeKey(k => k + 1)
  }, [])

  const lastUpdateTime = useRef(0)
  const handleParticleUpdate = useCallback((f, v) => {
    const now = Date.now()
    if (now - lastUpdateTime.current < 80) return
    lastUpdateTime.current = now
    setParticleForce(f)
    setParticleVel(v)
  }, [])

  const handleParticleHit = useCallback(() => {
    setChargeRunning(false)
  }, [])

  const lightDirRad = (lightDir * Math.PI) / 180
  const lx = Math.cos(lightDirRad) * 20
  const lz = Math.sin(lightDirRad) * 20
  const ly = 20

  // Dielectric label from kappa
  const kappaLabel = kappa <= 1.5 ? "Air" : kappa <= 5.0 ? "Paper" : kappa <= 8.5 ? "Glass" : "Ceramic"

  const DIELECTRIC_TICKS = [
    { label: "Air", value: 1.0 },
    { label: "Paper", value: 3.5 },
    { label: "Glass", value: 7.0 },
    { label: "Ceramic", value: 10.0 },
  ]

  // ─── STYLES ───
  const panelStyle = {
    position: "absolute", top: "20px", left: "20px", width: "320px",
    background: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)",
    borderRadius: "16px", border: "1px solid #eee", color: "#333",
    padding: "24px", boxSizing: "border-box", overflowY: "auto",
    maxHeight: "calc(100vh - 40px)", fontFamily: '"Inter", sans-serif', zIndex: 10,
    boxShadow: "0 12px 40px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column", gap: "16px",
  }
  const lblStyle = { display: "block", fontSize: "12px", fontWeight: "bold", color: "#333", marginBottom: "4px" }
  const cardStyle = { background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0" }
  const dataCardStyle = { background: "#1e293b", color: "#f8fafc", padding: "12px", borderRadius: "8px", fontSize: "13px" }
  const rowStyle = { display: "flex", justifyContent: "space-between", marginBottom: "6px" }

  // Right-side icon button style (same as other sims)
  const iconBtnStyle = (active) => ({
    position: "absolute", right: "24px", zIndex: 1000,
    width: "48px", height: "48px", borderRadius: "14px", border: "none",
    background: active ? "#ffffff" : "rgba(15,15,20,0.85)",
    backdropFilter: "blur(12px)", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 4px 20px rgba(0,0,0,0.25)", transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
  })

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000", overflow: "hidden", position: "relative" }}>

      {/* LEFT PANEL */}
      <div className="left-panel" style={panelStyle}>

        {/* CAPACITOR DATA */}
        <div style={{ ...dataCardStyle, borderLeft: "4px solid #facc15" }}>
          <div style={{ fontWeight: "bold", color: "#94a3b8", marginBottom: "10px", fontSize: "11px", textTransform: "uppercase" }}>CAPACITOR</div>
          <div style={rowStyle}>
            <span>Capacitance (C):</span>
            <strong style={{ color: "#facc15" }}>{(C * 1e12).toFixed(2)} pF</strong>
          </div>
          <div style={rowStyle}>
            <span>Stored Charge (Q):</span>
            <strong style={{ color: "#f97316" }}>{(Q * 1e12).toFixed(2)} pC</strong>
          </div>
          <div style={rowStyle}>
            <span>Electric Field (E):</span>
            <strong style={{ color: "#ef4444" }}>{E_field.toFixed(1)} V/m</strong>
          </div>
          <div style={{ ...rowStyle, marginBottom: 0, paddingTop: "8px", borderTop: "1px solid #334155" }}>
            <span>Stored Energy (U):</span>
            <strong style={{ color: "#a855f7" }}>{(U * 1e12).toFixed(2)} pJ</strong>
          </div>
        </div>

        {/* PARTICLE DATA */}
        <div style={{ ...dataCardStyle, borderLeft: "4px solid #a855f7" }}>
          <div style={{ fontWeight: "bold", color: "#94a3b8", marginBottom: "2px", fontSize: "11px", textTransform: "uppercase" }}>TEST PARTICLE (q+)</div>
          <div style={{ fontSize: "10px", color: "#475569", marginBottom: "2px" }}>q = 1 μC, m = 1 mg → a = E (m/s²)</div>
          <div style={rowStyle}>
            <span>Force (F = qE):</span>
            {/* Always show force — it only depends on E field, not on whether particle is moving */}
            <strong style={{ color: "#f97316" }}>{E_field.toFixed(2)} μN</strong>
          </div>
          <div style={{ ...rowStyle, marginBottom: "10px" }}>
            <span>Velocity:</span>
            <strong style={{ color: "#22c55e" }}>{chargeVisible ? Math.abs(particleVel).toFixed(2) : "—"} m/s</strong>
          </div>
          <div style={{ width: "100%", height: "7px", background: "#334155", borderRadius: "4px", overflow: "hidden" }}>
            <div style={{
              width: `${chargeVisible ? Math.min(100, Math.abs(particleVel) / 20 * 100) : 0}%`,
              height: "100%", background: "linear-gradient(90deg, #22c55e, #facc15)",
              transition: "width 0.1s", borderRadius: "4px"
            }} />
          </div>
          <div style={{ fontSize: "10px", color: "#475569", marginTop: "4px" }}>velocity bar (max display: 20 m/s)</div>
        </div>

        {/* CONTROLS */}
        <div style={cardStyle}>
          <label style={lblStyle}>VOLTAGE (V): {voltage} V</label>
          <input type="range" min={1} max={100} step={1} value={voltage}
            onChange={e => setVoltage(+e.target.value)} style={{ width: "100%", marginBottom: "14px" }} />

          <label style={lblStyle}>PLATE SEPARATION (d): {plateSep.toFixed(1)} m</label>
          <input type="range" min={2} max={12} step={0.5} value={plateSep}
            onChange={e => setPlateSep(+e.target.value)} style={{ width: "100%", marginBottom: "14px" }} />

          <label style={lblStyle}>PLATE AREA (A): {plateArea} m²</label>
          <input type="range" min={4} max={64} step={1} value={plateArea}
            onChange={e => setPlateArea(+e.target.value)} style={{ width: "100%", marginBottom: "14px" }} />

          {/* DIELECTRIC SLIDER */}
          <label style={lblStyle}>
            DIELECTRIC (κ): {kappa.toFixed(1)} — <span style={{ color: "#6366f1", fontWeight: "bold" }}>{kappaLabel}</span>
          </label>
          <input type="range" min={1} max={10} step={0.1} value={kappa}
            onChange={e => setKappa(+e.target.value)}
            style={{ width: "100%", marginBottom: "4px", accentColor: "#6366f1" }} />
          {/* Tick labels */}
          <div style={{ position: "relative", width: "100%", height: "18px" }}>
            {DIELECTRIC_TICKS.map(t => (
              <span key={t.label} style={{
                position: "absolute", left: `${((t.value - 1) / 9) * 100}%`,
                transform: "translateX(-50%)", fontSize: "10px", whiteSpace: "nowrap",
                fontWeight: Math.abs(kappa - t.value) < 0.6 ? "bold" : "normal",
                color: Math.abs(kappa - t.value) < 0.6 ? "#6366f1" : "#64748b",
              }}>{t.label}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT SIDE ICON BUTTONS (same as other sims) ── */}

      {/* Light */}
      <button onClick={() => setLightPanelOpen(!lightPanelOpen)}
        style={{ ...iconBtnStyle(lightPanelOpen), top: "194px" }} title="Light Controls">
        <LightBulbIcon width={24} height={24} fill={lightPanelOpen ? "#000" : "#fff"} />
      </button>
      {lightPanelOpen && (
        <div style={{ position: "absolute", top: "194px", right: "82px", zIndex: 999,
          background: "rgba(255,255,255,0.85)", backdropFilter: "blur(8px)",
          padding: "16px", borderRadius: "12px", boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
          border: "1px solid #eee", width: "220px", fontFamily: "sans-serif" }}>
          <h4 style={{ margin: "0 0 10px 0", fontSize: "12px", color: "#333", textAlign: "center" }}>LIGHT CONTROLS</h4>
          <label style={lblStyle}>ANGLE: {lightDir}°</label>
          <input type="range" min="0" max="360" step="1" value={lightDir} onChange={e => setLightDir(+e.target.value)} style={{ width: "100%", marginBottom: "10px" }} />
          <label style={lblStyle}>INTENSITY: {lightInt.toFixed(1)}</label>
          <input type="range" min="0" max="3" step="0.1" value={lightInt} onChange={e => setLightInt(+e.target.value)} style={{ width: "100%" }} />
        </div>
      )}

      {/* Play/Pause */}
      <button onClick={handlePlayPause}
        style={{ ...iconBtnStyle(chargeRunning), top: "252px" }} title="Play / Pause">
        {chargeRunning
          ? <PauseIcon width={24} height={24} fill="#000000" />
          : <PlayIcon width={24} height={24} fill="#ffffff" />}
      </button>

      {/* Reset */}
      <button onClick={handleReset}
        style={{ ...iconBtnStyle(false), top: "310px" }} title="Reset Particle">
        <ResetIcon width={24} height={24} fill="#ffffff" />
      </button>

      {/* Speed */}
      <button onClick={() => setSpeedPanelOpen(!speedPanelOpen)}
        style={{ ...iconBtnStyle(speedPanelOpen), top: "368px" }} title="Time Speed">
        <SpeedIcon width={24} height={24} fill={speedPanelOpen ? "#000" : "#fff"} />
      </button>
      {speedPanelOpen && (
        <div style={{ position: "absolute", top: "368px", right: "82px", zIndex: 999,
          background: "rgba(255,255,255,0.85)", backdropFilter: "blur(8px)",
          padding: "16px", borderRadius: "12px", boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
          border: "1px solid #eee", width: "220px", fontFamily: "sans-serif" }}>
          <h4 style={{ margin: "0 0 10px 0", fontSize: "12px", color: "#333", textAlign: "center" }}>TIME SPEED</h4>
          <label style={lblStyle}>SCALE: {timeScale.toFixed(1)}x</label>
          <input type="range" min={0.1} max={2} step={0.1} value={timeScale}
            onChange={e => setTimeScale(+e.target.value)} style={{ width: "100%", marginBottom: "6px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#64748b" }}>
            <span>0.1x slow</span><span>1x normal</span><span>2x fast</span>
          </div>
        </div>
      )}

      {/* 3D SCENE */}
      <Canvas shadows camera={{ position: [0, 12, 22], fov: 50 }}>
        <color attach="background" args={["#000000"]} />
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[lx, ly, lz]}
          intensity={lightInt}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={0.5}
          shadow-camera-far={120}
          shadow-camera-left={-25}
          shadow-camera-right={25}
          shadow-camera-top={25}
          shadow-camera-bottom={-10}
          shadow-bias={-0.0005}
        />
        <pointLight position={[0, 8, 0]} intensity={0.6} color="#60a5fa" />
        <SpotLightFixture lightPos={[lx, ly, lz]} intensity={lightInt} target={[0, 0, 0]} color="#fffbe6" height={2} radius={0.8} />
        <OrbitControls makeDefault enablePan target={[0, 3, 0]} />
        <CheckerGround />

        <Plate position={[0, plateSize / 2, -plateSep / 2]} size={plateSize} isPositive={true} />
        <Plate position={[0, plateSize / 2, plateSep / 2]} size={plateSize} isPositive={false} />

        <CircuitDecoration plateSep={plateSep} plateSize={plateSize} voltage={voltage} />

        <group position={[0, plateSize / 2, 0]}>
          <FieldLines gap={plateSep} plateSize={plateSize} voltage={voltage} numLines={numFieldLines} timeScale={timeScale} />
        </group>

        {chargeVisible && (
          <group position={[0, plateSize / 2, 0]} key={chargeKey}>
            <TestCharge
              eField={E_field}
              gap={plateSep}
              running={chargeRunning}
              timeScale={timeScale}
              onReset={handleParticleHit}
              onUpdate={handleParticleUpdate}
            />
          </group>
        )}

        <Text position={[plateSize / 2 + 1, plateSize / 2, 0]} fontSize={0.4} color="#facc15" anchorX="left">E</Text>
      </Canvas>
    </div>
  )
}
