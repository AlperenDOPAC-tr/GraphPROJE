import React, { useState, useRef, useMemo, useEffect } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, Text, Line, Cylinder, Box, Sphere } from "@react-three/drei"
import * as THREE from "three"
import { LightBulbIcon, EyeIcon } from "./Icons"
import SpotLightFixture from "./SpotLightFixture"

// ─── CHECKER GROUND ───
function CheckerGround() {
  const tex = useMemo(() => {
    const canvas = document.createElement("canvas")
    canvas.width = 512; canvas.height = 512
    const ctx = canvas.getContext("2d")
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 512, 512)
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 256, 256); ctx.fillRect(256, 256, 256, 256)
    const t = new THREE.CanvasTexture(canvas)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(12, 12); t.anisotropy = 16
    return t
  }, [])
  return (
    <mesh position={[0, -0.5, 0]} receiveShadow>
      <boxGeometry args={[100, 1, 60]} />
      <meshStandardMaterial map={tex} roughness={0.8} metalness={0.1} />
    </mesh>
  )
}

// ─── ARROW HELPER ───
function Arrow({ start, end, color = "#fff", width = 3, headSize = 0.5 }) {
  const vStart = new THREE.Vector3(...start)
  const vEnd = new THREE.Vector3(...end)
  const direction = vEnd.clone().sub(vStart).normalize()
  const length = vStart.distanceTo(vEnd)
  
  const quaternion = new THREE.Quaternion()
  quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)

  return (
    <group position={start} quaternion={quaternion}>
      <mesh position={[0, length / 2, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, length, 8]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[0, length, 0]}>
        <coneGeometry args={[headSize * 0.4, headSize, 12]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.2} />
      </mesh>
    </group>
  )
}

// ─── MOD 1: MAGNETIC FLUX (ROTATING LOOP) ───
function ModeFlux({ bField, area, angle }) {
  const fluxVal = bField * area * Math.cos(angle * Math.PI / 180)
  const linesCount = Math.max(1, Math.floor(bField * 2))
  const side = Math.sqrt(area)

  return (
    <group>
      <mesh position={[-15, 5, 0]} castShadow receiveShadow>
        <boxGeometry args={[4, 10, 14]} />
        <meshStandardMaterial color="#ef4444" roughness={0.4} metalness={0.5} />
      </mesh>
      <Text position={[-12.9, 5, 0]} rotation={[0, Math.PI/2, 0]} fontSize={3} color="#fff" outlineWidth={0.1} outlineColor="#000">N</Text>
      
      <mesh position={[15, 5, 0]} castShadow receiveShadow>
        <boxGeometry args={[4, 10, 14]} />
        <meshStandardMaterial color="#3b82f6" roughness={0.4} metalness={0.5} />
      </mesh>
      <Text position={[12.9, 5, 0]} rotation={[0, -Math.PI/2, 0]} fontSize={3} color="#fff" outlineWidth={0.1} outlineColor="#000">S</Text>

      {Array.from({ length: linesCount }).map((_, i) => {
        const zOff = (i - linesCount/2 + 0.5) * (10 / linesCount)
        return (
          <Line key={i} points={[[-13, 5, zOff], [13, 5, zOff]]} color="#ef4444" lineWidth={2} transparent opacity={0.4} />
        )
      })}
      <BFieldParticles count={bField * 10} />

      <group position={[0, 5, 0]} rotation={[0, (angle * Math.PI) / 180, 0]}>
        <mesh castShadow>
          <torusGeometry args={[side, 0.2, 16, 4]} />
          <meshStandardMaterial color="#facc15" metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh rotation={[Math.PI/2, 0, 0]}>
          <planeGeometry args={[side*2, side*2]} />
          <meshBasicMaterial color="#22c55e" transparent opacity={0.2} side={THREE.DoubleSide} />
        </mesh>
        <Arrow start={[0,0,0]} end={[0,0,side + 2]} color="#22c55e" />
        <Text position={[0, 0.5, side + 2.5]} fontSize={1} color="#22c55e" outlineWidth={0.05} outlineColor="#000">n</Text>
      </group>
    </group>
  )
}

function BFieldParticles({ count }) {
  const groupRef = useRef()
  const particles = useMemo(() => {
    return Array.from({ length: count }).map(() => ({
      x: -13 + Math.random() * 26,
      y: 1 + Math.random() * 8,
      z: -5 + Math.random() * 10,
      speed: 10 + Math.random() * 10
    }))
  }, [count])

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.children.forEach((mesh, i) => {
        mesh.position.x += particles[i].speed * delta
        if (mesh.position.x > 13) mesh.position.x = -13
      })
    }
  })

  return (
    <group ref={groupRef}>
      {particles.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  )
}

// ─── MOD 2: FARADAY (MAGNET & COIL) ───
function ModeFaraday({ magnetX, magnetStr, turns }) {
  const [velocity, setVelocity] = useState(0)
  const prevX = useRef(magnetX)
  
  useFrame((state, delta) => {
    const v = (magnetX - prevX.current) / (delta || 0.01)
    setVelocity(v)
    prevX.current = magnetX

    // Direct DOM manipulation for UI bar to avoid React re-renders every frame
    const emfVal = Math.abs(v * magnetStr * turns * 0.05)
    const domBar = document.getElementById("ui-emf-bar-fill")
    const domText = document.getElementById("ui-emf-text")
    if (domBar && domText) {
      const widthPercent = Math.min(100, (emfVal / 5) * 100)
      domBar.style.width = `${widthPercent}%`
      domBar.style.background = emfVal > 3 ? "#ef4444" : "#facc15"
      domText.innerText = emfVal.toFixed(1) + " V"
    }
  })

  const emf = Math.abs(velocity * magnetStr * turns * 0.05)
  const intensity = Math.min(5, emf)
  const bulbColor = "#facc15" // Always glow yellow

  return (
    <group>
      {/* Magnet */}
      <group position={[magnetX, 6.5, 0]}>
        <mesh position={[-2, 0, 0]} castShadow>
          <boxGeometry args={[4, 2, 2]} />
          <meshStandardMaterial color="#ef4444" roughness={0.4} metalness={0.5} />
        </mesh>
        <Text position={[-3, 0, 1.1]} fontSize={1.2} color="#fff">N</Text>
        <mesh position={[2, 0, 0]} castShadow>
          <boxGeometry args={[4, 2, 2]} />
          <meshStandardMaterial color="#3b82f6" roughness={0.4} metalness={0.5} />
        </mesh>
        <Text position={[3, 0, 1.1]} fontSize={1.2} color="#fff">S</Text>
      </group>

      {/* Coil */}
      <group position={[0, 6.5, 0]}>
        {Array.from({ length: turns }).map((_, i) => (
          <mesh key={i} position={[(i - turns/2) * 0.5, 0, 0]} rotation={[0, Math.PI/2, 0]} castShadow>
            <torusGeometry args={[3, 0.2, 16, 32]} />
            <meshStandardMaterial color="#d97706" metalness={0.9} roughness={0.3} />
          </mesh>
        ))}
        <Line points={[[-turns/4, -3, 0], [-turns/4, -6, 0], [-1, -6, 0], [-1, -5.5, 0]]} color="#94a3b8" lineWidth={3} />
        <Line points={[[turns/4, -3, 0], [turns/4, -6, 0], [1, -6, 0], [1, -5.5, 0]]} color="#94a3b8" lineWidth={3} />
      </group>

      {/* Lightbulb resting on ground (y=0.5 means bottom is y=0) */}
      <group position={[0, 0.5, 0]}>
        <mesh position={[0, 0, 0]} castShadow>
          <cylinderGeometry args={[0.6, 0.6, 1, 16]} />
          <meshStandardMaterial color="#475569" metalness={0.8} />
        </mesh>
        <mesh position={[0, 1.2, 0]}>
          <sphereGeometry args={[1.2, 32, 32]} />
          <meshStandardMaterial color={intensity > 0.1 ? bulbColor : "#94a3b8"} transparent opacity={0.6} />
        </mesh>
        {intensity > 0.1 && (
          <pointLight position={[0, 1.2, 0]} intensity={intensity * 2} color={bulbColor} distance={20} />
        )}
      </group>
    </group>
  )
}

// REMOVED OERSTED COMPONENTS

export default function InductionSim() {
  const [activeTab, setActiveTab] = useState("flux")

  // Flux state
  const [bField, setBField] = useState(5)
  const [area, setArea] = useState(16)
  const [angle, setAngle] = useState(0)

  // Faraday state
  const [magnetX, setMagnetX] = useState(15)
  const [magnetStr, setMagnetStr] = useState(5)
  const [turns, setTurns] = useState(5)

  // Removed Oersted state

  // Light
  const [lightPanelOpen, setLightPanelOpen] = useState(false)
  const [lightDir, setLightDir] = useState(45)
  const [lightInt, setLightInt] = useState(1.5)

  const lx = Math.cos((lightDir * Math.PI) / 180) * 30
  const lz = Math.sin((lightDir * Math.PI) / 180) * 30
  const ly = 30

  // Styles
  const panelStyle = {
    position: "absolute", left: "20px", top: "20px",
    width: "340px", maxHeight: "calc(100vh - 40px)",
    background: "rgba(255,255,255,0.95)", backdropFilter: "blur(16px)",
    padding: "24px", borderRadius: "20px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.1)", overflowY: "auto",
    fontFamily: "sans-serif", zIndex: 10
  }

  const lblStyle = { display: "block", fontSize: "11px", fontWeight: "bold", color: "#64748b", marginBottom: "6px" }
  const cardStyle = { background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0" }
  
  const iconBtnStyle = (active) => ({
    position: "absolute", right: "24px", zIndex: 1000,
    width: "48px", height: "48px", borderRadius: "14px", border: "none",
    background: active ? "#ffffff" : "rgba(15, 15, 20, 0.85)",
    backdropFilter: "blur(12px)", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 4px 20px rgba(0,0,0,0.25)", transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
  })

  const tabStyle = (active) => ({
    flex: 1, padding: "10px 0", textAlign: "center", cursor: "pointer",
    background: active ? "#3b82f6" : "transparent",
    color: active ? "#fff" : "#475569",
    borderRadius: "10px", fontSize: "13px", fontWeight: "bold",
    transition: "all 0.2s"
  })

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden", background: "#050505" }}>
      
      {/* LEFT PANEL */}
      <div className="left-panel" style={panelStyle}>
        
        {/* TABS */}
        <div style={{ display: "flex", gap: "4px", background: "#e2e8f0", padding: "4px", borderRadius: "10px", marginBottom: "20px" }}>
          <div style={tabStyle(activeTab === "flux")} onClick={() => setActiveTab("flux")}>FLUX</div>
          <div style={tabStyle(activeTab === "faraday")} onClick={() => setActiveTab("faraday")}>FARADAY</div>
        </div>

        {/* FLUX MODE UI */}
        {activeTab === "flux" && (
          <div style={cardStyle}>
            <div style={{ background: "#fff", borderLeft: "4px solid #facc15", padding: "12px", borderRadius: "8px", marginBottom: "20px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: "11px", color: "#64748b" }}>MAGNETIC FLUX (Φ) = B · A · cos(θ)</div>
              <div style={{ fontSize: "24px", fontWeight: "bold", color: "#d97706", marginTop: "4px" }}>
                {(bField * area * Math.cos(angle * Math.PI / 180)).toFixed(1)} Wb
              </div>
            </div>

            <label style={lblStyle}>MAGNETIC FIELD (B): {bField} T</label>
            <input type="range" min={1} max={10} step={0.5} value={bField} onChange={e => setBField(+e.target.value)} style={{ width: "100%", marginBottom: "16px", accentColor: "#ef4444" }} />
            
            <label style={lblStyle}>LOOP AREA (A): {area} m²</label>
            <input type="range" min={4} max={25} step={1} value={area} onChange={e => setArea(+e.target.value)} style={{ width: "100%", marginBottom: "16px", accentColor: "#22c55e" }} />
            
            <label style={lblStyle}>ROTATION ANGLE (θ): {angle}°</label>
            <input type="range" min={0} max={360} step={1} value={angle} onChange={e => setAngle(+e.target.value)} style={{ width: "100%", accentColor: "#3b82f6" }} />
          </div>
        )}

        {/* FARADAY MODE UI */}
        {activeTab === "faraday" && (
          <div style={cardStyle}>
            <div style={{ background: "#fff", borderLeft: "4px solid #facc15", padding: "12px", borderRadius: "8px", marginBottom: "20px", fontSize: "12px", color: "#475569", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
              Drag the magnet through the coil to induce an Electromotive Force (EMF)!
              <br/><br/>
              <b>ε = -N · (dΦ / dt)</b>
            </div>

            {/* LIVE DOM EMF BAR */}
            <div style={{ marginBottom: "24px", background: "#e2e8f0", padding: "10px", borderRadius: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "11px", fontWeight: "bold", color: "#64748b" }}>LIVE EMF OUTPUT</span>
                <span id="ui-emf-text" style={{ fontSize: "12px", fontWeight: "bold", color: "#d97706" }}>0.0 V</span>
              </div>
              <div style={{ width: "100%", height: "12px", background: "#cbd5e1", borderRadius: "6px", overflow: "hidden" }}>
                <div id="ui-emf-bar-fill" style={{ width: "0%", height: "100%", background: "#facc15", transition: "width 0.1s linear, background 0.2s" }} />
              </div>
            </div>

            <label style={lblStyle}>MAGNET POSITION (Drag Fast!)</label>
            <input type="range" min={-15} max={15} step={0.1} value={magnetX} onChange={e => setMagnetX(+e.target.value)} style={{ width: "100%", marginBottom: "16px", accentColor: "#ef4444" }} />
            
            <label style={lblStyle}>MAGNET STRENGTH: {magnetStr} T</label>
            <input type="range" min={1} max={10} step={1} value={magnetStr} onChange={e => setMagnetStr(+e.target.value)} style={{ width: "100%", marginBottom: "16px", accentColor: "#3b82f6" }} />
            
            <label style={lblStyle}>COIL TURNS (N): {turns}</label>
            <input type="range" min={1} max={20} step={1} value={turns} onChange={e => setTurns(+e.target.value)} style={{ width: "100%", accentColor: "#d97706" }} />
          </div>
        )}

        {/* Removed Oersted Mode UI */}
      </div>

      {/* RIGHT SIDE ICON BUTTONS */}
      <button onClick={() => setLightPanelOpen(!lightPanelOpen)}
        className="ui-element"
        style={{ ...iconBtnStyle(lightPanelOpen), top: "194px" }} title="Light Controls">
        <LightBulbIcon width={24} height={24} fill={lightPanelOpen ? "#000" : "#fff"} />
      </button>
      
      {lightPanelOpen && (
        <div className="ui-element" style={{ position: "absolute", top: "194px", right: "82px", zIndex: 999,
          background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)",
          padding: "16px", borderRadius: "12px", boxShadow: "0 8px 30px rgba(0,0,0,0.1)",
          border: "1px solid #e2e8f0", width: "220px", fontFamily: "sans-serif", color: "#1e293b" }}>
          <h4 style={{ margin: "0 0 10px 0", fontSize: "12px", color: "#475569", textAlign: "center" }}>LIGHT CONTROLS</h4>
          <label style={lblStyle}>ANGLE: {lightDir}°</label>
          <input type="range" min="0" max="360" step="1" value={lightDir} onChange={e => setLightDir(+e.target.value)} style={{ width: "100%", marginBottom: "10px" }} />
          <label style={lblStyle}>INTENSITY: {lightInt.toFixed(1)}</label>
          <input type="range" min="0" max="3" step="0.1" value={lightInt} onChange={e => setLightInt(+e.target.value)} style={{ width: "100%" }} />
        </div>
      )}

      {/* 3D SCENE */}
      <Canvas shadows camera={{ position: [0, 20, 45], fov: 45 }}>
        <color attach="background" args={["#050505"]} />
        <ambientLight intensity={1.5} />
        <directionalLight
          position={[lx, ly, lz]}
          intensity={lightInt * 2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={0.5}
          shadow-camera-far={120}
          shadow-camera-left={-30}
          shadow-camera-right={30}
          shadow-camera-top={30}
          shadow-camera-bottom={-30}
        />
        <pointLight position={[0, 15, 0]} intensity={1.5} color="#cbd5e1" />
        <SpotLightFixture lightPos={[lx, ly, lz]} intensity={lightInt * 1.5} target={[0, 0, 0]} color="#fffbe6" height={2} radius={0.8} />
        
        <OrbitControls makeDefault enablePan target={[0, 5, 0]} maxPolarAngle={Math.PI/2 - 0.05} />
        
        <CheckerGround />
        
        {activeTab === "flux" && <ModeFlux bField={bField} area={area} angle={angle} />}
        {activeTab === "faraday" && <ModeFaraday magnetX={magnetX} magnetStr={magnetStr} turns={turns} />}
      </Canvas>
    </div>
  )
}
