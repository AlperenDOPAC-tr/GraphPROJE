import React, { useState, useRef, useMemo, useCallback } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, Text } from "@react-three/drei"
import * as THREE from "three"
import { LightBulbIcon } from "./Icons"
import SpotLightFixture from "./SpotLightFixture"

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
    t.repeat.set(12, 12); t.anisotropy = 16
    return t
  }, [])
  return (
    <mesh position={[0, -0.5, 0]} receiveShadow>
      <boxGeometry args={[80, 1, 40]} />
      <meshStandardMaterial map={tex} roughness={0.8} metalness={0.1} />
    </mesh>
  )
}

// ─── GENERATOR ───────────────────────────────────────────────────────────────
function Generator({ position, voltage }) {
  const groupRef = useRef()
  useFrame(({ clock }) => {
    if (groupRef.current) {
      // Rotate the generator shaft to show it's "running"
      groupRef.current.children[1].rotation.x = clock.getElapsedTime() * 2
    }
  })

  return (
    <group position={position} ref={groupRef}>
      {/* Body */}
      <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[3, 3, 4]} />
        <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Shaft */}
      <mesh position={[2, 1.5, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.5, 0.5, 2, 16]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Label */}
      <Text position={[0, 3.5, 0]} fontSize={0.6} color="#facc15" anchorX="center">
        AC GEN
      </Text>
      <Text position={[0, 1.5, 2.05]} fontSize={0.8} color="#facc15" anchorX="center" outlineWidth={0.05} outlineColor="#000">
        {voltage}V
      </Text>
    </group>
  )
}

// ─── TRANSFORMER ─────────────────────────────────────────────────────────────
// A basic E-I or square core transformer
function Transformer({ position, label, np, ns, isStepUp }) {
  const coreMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#334155", metalness: 0.8, roughness: 0.2 }), [])
  
  // Dynamically size the coils based on turns (just for visual representation)
  const pSize = 1.0 + (np / 100) * 1.5
  const sSize = 1.0 + (ns / 100) * 1.5

  const pColor = "#ef4444" // red for primary
  const sColor = "#3b82f6" // blue for secondary

  return (
    <group position={position}>
      {/* Iron Core */}
      {/* Left Leg */}
      <mesh position={[-1.5, 2.5, 0]} castShadow receiveShadow material={coreMaterial}>
        <boxGeometry args={[1, 5, 1.5]} />
      </mesh>
      {/* Right Leg */}
      <mesh position={[1.5, 2.5, 0]} castShadow receiveShadow material={coreMaterial}>
        <boxGeometry args={[1, 5, 1.5]} />
      </mesh>
      {/* Top Yoke */}
      <mesh position={[0, 4.5, 0]} castShadow receiveShadow material={coreMaterial}>
        <boxGeometry args={[4, 1, 1.5]} />
      </mesh>
      {/* Bottom Yoke */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow material={coreMaterial}>
        <boxGeometry args={[4, 1, 1.5]} />
      </mesh>

      {/* Primary Coil (Left Leg) */}
      <mesh position={[-1.5, 2.5, 0]} castShadow>
        <cylinderGeometry args={[1.2, 1.2, pSize, 32]} />
        {/* Striped texture to look like wire turns could be added, using simple color for now */}
        <meshStandardMaterial color={pColor} roughness={0.6} />
      </mesh>

      {/* Secondary Coil (Right Leg) */}
      <mesh position={[1.5, 2.5, 0]} castShadow>
        <cylinderGeometry args={[1.2, 1.2, sSize, 32]} />
        <meshStandardMaterial color={sColor} roughness={0.6} />
      </mesh>

      {/* Labels */}
      <Text position={[0, 5.5, 0]} fontSize={0.6} color="#fff" anchorX="center" outlineWidth={0.03} outlineColor="#000">
        {label}
      </Text>
      <Text position={[-1.5, 0.5, 0.8]} fontSize={0.4} color={pColor} anchorX="center" outlineWidth={0.02} outlineColor="#000">
        Np:{np}
      </Text>
      <Text position={[1.5, 0.5, 0.8]} fontSize={0.4} color={sColor} anchorX="center" outlineWidth={0.02} outlineColor="#000">
        Ns:{ns}
      </Text>
    </group>
  )
}

// ─── TRANSMISSION LINES ──────────────────────────────────────────────────────
function TransmissionLines({ x1, x2, vMid }) {
  const poleY = 8
  
  // Power poles
  const poles = [-3, 3].map(offset => {
    const x = (x1 + x2) / 2 + offset
    return (
      <group position={[x, 0, 0]} key={offset}>
        {/* Wood pole */}
        <mesh position={[0, poleY / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.2, 0.3, poleY, 8]} />
          <meshStandardMaterial color="#78350f" roughness={0.9} />
        </mesh>
        {/* Crossarm */}
        <mesh position={[0, poleY - 0.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.3, 0.3, 3]} />
          <meshStandardMaterial color="#78350f" roughness={0.9} />
        </mesh>
      </group>
    )
  })

  // Wires
  const wireThick = 0.05
  const sag = 1.0 // wire sag

  const wireMats = [
    new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.5 }),
    new THREE.MeshStandardMaterial({ color: "#dc2626", roughness: 0.5 })
  ]

  const createWire = (zOffset, mat) => {
    const p1 = new THREE.Vector3(x1, 2.5, 0) // from T1 secondary
    const p2 = new THREE.Vector3((x1 + x2) / 2 - 3, poleY - 0.5, zOffset) // pole 1
    const p3 = new THREE.Vector3((x1 + x2) / 2 + 3, poleY - 0.5, zOffset) // pole 2
    const p4 = new THREE.Vector3(x2, 2.5, 0) // to T2 primary

    // Quick hack for sag: intermediate points
    const curve = new THREE.CatmullRomCurve3([
      p1,
      new THREE.Vector3((p1.x + p2.x)/2, (p1.y + p2.y)/2 - sag/2, zOffset/2),
      p2,
      new THREE.Vector3((p2.x + p3.x)/2, (p2.y + p3.y)/2 - sag, zOffset),
      p3,
      new THREE.Vector3((p3.x + p4.x)/2, (p3.y + p4.y)/2 - sag/2, zOffset/2),
      p4
    ])

    return (
      <mesh castShadow>
        <tubeGeometry args={[curve, 40, wireThick, 6, false]} />
        <primitive object={mat} attach="material" />
      </mesh>
    )
  }

  // Energy flow effect when running
  // If vMid is very high, maybe add some subtle glowing rings or arrows
  return (
    <group>
      {poles}
      {createWire(-1.3, wireMats[0])}
      {createWire(1.3, wireMats[1])}
      <Text position={[(x1 + x2) / 2, poleY + 0.5, 0]} fontSize={0.6} color="#f97316" anchorX="center" outlineWidth={0.04} outlineColor="#000">
        {Math.round(vMid)}V (Transmission)
      </Text>
    </group>
  )
}

// ─── LOAD (LIGHTBULB) ────────────────────────────────────────────────────────
function Lightbulb({ position, voltage, nominalVoltage = 220 }) {
  // Brightness based on voltage vs nominal
  // If voltage is too high, it might blow up, but let's just make it super bright
  const intensity = Math.max(0, Math.min(5, (voltage / nominalVoltage) * 2))
  const color = intensity > 3 ? "#ffffff" : "#facc15"
  
  return (
    <group position={position}>
      {/* Base */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.4, 0.4, 1, 16]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Glass Bulb */}
      <mesh position={[0, 2.0, 0]} castShadow>
        <sphereGeometry args={[1.2, 32, 32]} />
        <meshStandardMaterial 
          color={intensity > 0.1 ? color : "#fff"} 
          emissive={color} 
          emissiveIntensity={intensity} 
          transparent opacity={intensity > 0.1 ? 0.9 : 0.4} 
        />
      </mesh>
      {intensity > 0 && (
        <pointLight position={[0, 2.0, 0]} intensity={intensity * 2} distance={20} color={color} />
      )}
      
      <Text position={[0, 4.0, 0]} fontSize={0.6} color="#fff" anchorX="center" outlineWidth={0.03} outlineColor="#000">
        Load
      </Text>
      <Text position={[0, -0.2, 1.2]} fontSize={0.5} color={intensity > 3 ? "#ef4444" : "#22c55e"} anchorX="center" outlineWidth={0.03} outlineColor="#000">
        {Math.round(voltage)}V
      </Text>
    </group>
  )
}

// ─── MAIN SIMULATION COMPONENT ───────────────────────────────────────────────
export default function TransformerSim() {
  const [vIn, setVIn] = useState(100)
  
  // Transformer 1 (Step-Up usually)
  const [np1, setNp1] = useState(10)
  const [ns1, setNs1] = useState(100)

  // Transformer 2 (Step-Down usually)
  const [np2, setNp2] = useState(100)
  const [ns2, setNs2] = useState(10)


  // UI Panels
  const [lightPanelOpen, setLightPanelOpen] = useState(false)
  const [speedPanelOpen, setSpeedPanelOpen] = useState(false)
  const [lightDir, setLightDir] = useState(45)
  const [lightInt, setLightInt] = useState(1.5)

  // Physics Calculations
  const activeVIn = vIn
  const vMid = activeVIn * (ns1 / np1)
  const vOut = vMid * (ns2 / np2)

  // Layout positions
  const genX = -18
  const t1X = -10
  const t2X = 8
  const loadX = 16

  const lx = Math.cos((lightDir * Math.PI) / 180) * 20
  const lz = Math.sin((lightDir * Math.PI) / 180) * 20
  const ly = 20

  // ─── STYLES ───
  const panelStyle = {
    position: "absolute", top: "20px", left: "20px", width: "340px",
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
        
        {/* DATA DISPLAY */}
        <div style={{ ...dataCardStyle, borderLeft: "4px solid #facc15" }}>
          <div style={{ fontWeight: "bold", color: "#94a3b8", marginBottom: "10px", fontSize: "11px", textTransform: "uppercase" }}>VOLTAGE MONITOR</div>
          <div style={rowStyle}>
            <span>Input (V_in):</span>
            <strong style={{ color: "#facc15" }}>{vIn.toFixed(0)} V</strong>
          </div>
          <div style={rowStyle}>
            <span>Transmission (V_mid):</span>
            <strong style={{ color: "#f97316" }}>{vMid.toFixed(0)} V</strong>
          </div>
          <div style={{ ...rowStyle, marginBottom: 0, paddingTop: "8px", borderTop: "1px solid #334155" }}>
            <span>Output (V_out):</span>
            <strong style={{ color: vOut > 250 ? "#ef4444" : "#22c55e" }}>{vOut.toFixed(0)} V</strong>
          </div>
        </div>

        {/* CONTROLS */}
        <div style={cardStyle}>
          <label style={lblStyle}>INPUT VOLTAGE: {vIn} V</label>
          <input type="range" min={10} max={500} step={10} value={vIn}
            onChange={e => setVIn(+e.target.value)} style={{ width: "100%", marginBottom: "16px" }} />

          {/* T1 */}
          <div style={{ marginBottom: "16px", padding: "8px", background: "#fff", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <h4 style={{ margin: "0 0 10px 0", fontSize: "11px", color: "#64748b" }}>TRANSFORMER 1 (Step-Up)</h4>
            <label style={{...lblStyle, fontSize: "10px", color: "#ef4444"}}>PRIMARY TURNS (Np1): {np1}</label>
            <input type="range" min={5} max={200} step={5} value={np1}
              onChange={e => setNp1(+e.target.value)} style={{ width: "100%", marginBottom: "8px", accentColor: "#ef4444" }} />
            <label style={{...lblStyle, fontSize: "10px", color: "#3b82f6"}}>SECONDARY TURNS (Ns1): {ns1}</label>
            <input type="range" min={5} max={200} step={5} value={ns1}
              onChange={e => setNs1(+e.target.value)} style={{ width: "100%", accentColor: "#3b82f6" }} />
          </div>

          {/* T2 */}
          <div style={{ padding: "8px", background: "#fff", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <h4 style={{ margin: "0 0 10px 0", fontSize: "11px", color: "#64748b" }}>T2 (Step-Down)</h4>
            <label style={{...lblStyle, fontSize: "10px", color: "#ef4444"}}>PRIMARY TURNS (Np2): {np2}</label>
            <input type="range" min={5} max={200} step={5} value={np2}
              onChange={e => setNp2(+e.target.value)} style={{ width: "100%", marginBottom: "8px", accentColor: "#ef4444" }} />
            <label style={{...lblStyle, fontSize: "10px", color: "#3b82f6"}}>SECONDARY TURNS (Ns2): {ns2}</label>
            <input type="range" min={5} max={200} step={5} value={ns2}
              onChange={e => setNs2(+e.target.value)} style={{ width: "100%", accentColor: "#3b82f6" }} />
          </div>
        </div>
      </div>

      {/* ── RIGHT SIDE ICON BUTTONS ── */}

      {/* Light */}
      <button onClick={() => setLightPanelOpen(!lightPanelOpen)}
        className="ui-element"
        style={{ ...iconBtnStyle(lightPanelOpen), top: "194px" }} title="Light Controls">
        <LightBulbIcon width={24} height={24} fill={lightPanelOpen ? "#000" : "#fff"} />
      </button>
      {lightPanelOpen && (
        <div className="ui-element" style={{ position: "absolute", top: "194px", right: "82px", zIndex: 999,
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


      {/* 3D SCENE */}
      <Canvas shadows camera={{ position: [0, 15, 35], fov: 45 }}>
        <color attach="background" args={["#000000"]} />
        <ambientLight intensity={1.2} />
        <directionalLight
          position={[lx, ly, lz]}
          intensity={lightInt * 1.5}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={0.5}
          shadow-camera-far={120}
          shadow-camera-left={-30}
          shadow-camera-right={30}
          shadow-camera-top={30}
          shadow-camera-bottom={-10}
          shadow-bias={-0.0005}
        />
        <pointLight position={[0, 10, 0]} intensity={1.5} color="#cbd5e1" />
        
        {/* Adds nice soft highlighting */}
        <SpotLightFixture lightPos={[lx, ly, lz]} intensity={lightInt * 1.5} target={[0, 0, 0]} color="#fffbe6" height={2} radius={0.8} />
        
        <OrbitControls makeDefault enablePan target={[0, 5, 0]} maxPolarAngle={Math.PI/2 - 0.05} />
        <CheckerGround />

        <Generator position={[genX, 0, 0]} voltage={activeVIn} />
        
        {/* Wire from Generator to T1 */}
        <mesh castShadow>
          <tubeGeometry args={[new THREE.CatmullRomCurve3([
            new THREE.Vector3(genX, 1.5, 0),
            new THREE.Vector3(genX + 2, 0.5, 0),
            new THREE.Vector3(t1X - 2, 0.5, 0),
            new THREE.Vector3(t1X - 1.5, 2.5, 0)
          ]), 20, 0.08, 8, false]} />
          <meshStandardMaterial color="#1e293b" roughness={0.5} />
        </mesh>

        <Transformer position={[t1X, 0, 0]} label="T1" np={np1} ns={ns1} isStepUp={true} />
        
        <TransmissionLines x1={t1X + 1.5} x2={t2X - 1.5} vMid={vMid} />
        
        <Transformer position={[t2X, 0, 0]} label="T2" np={np2} ns={ns2} isStepUp={false} />

        {/* Wire from T2 to Load */}
        <mesh castShadow>
          <tubeGeometry args={[new THREE.CatmullRomCurve3([
            new THREE.Vector3(t2X + 1.5, 2.5, 0),
            new THREE.Vector3(t2X + 2, 0.5, 0),
            new THREE.Vector3(loadX - 1, 0.5, 0),
            new THREE.Vector3(loadX, 1.0, 0)
          ]), 20, 0.08, 8, false]} />
          <meshStandardMaterial color="#1e293b" roughness={0.5} />
        </mesh>

        <Lightbulb position={[loadX, 0, 0]} voltage={vOut} />
      </Canvas>
    </div>
  )
}
