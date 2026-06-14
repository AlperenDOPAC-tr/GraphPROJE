import React, { useState, useRef, useMemo, useEffect } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, Text, Line, Cylinder, Box, Sphere } from "@react-three/drei"
import * as THREE from "three"
import { LightBulbIcon, EyeIcon, PlayIcon, PauseIcon, ResetIcon, SpeedIcon } from "./Icons"
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

// ─── MOD 3: OERSTED (TWO WIRES) ───

// Animated current particles inside the wire
function CurrentFlow({ current, length, isPlaying, timeScale }) {
  const groupRef = useRef()
  const count = 10
  const speed = current * 0.1
  
  useFrame((state, delta) => {
    if (!isPlaying) return
    if (groupRef.current) {
      groupRef.current.children.forEach(mesh => {
        mesh.position.z += speed * delta * timeScale
        if (speed > 0 && mesh.position.z > length/2) mesh.position.z -= length
        if (speed < 0 && mesh.position.z < -length/2) mesh.position.z += length
      })
    }
  })

  return (
    <group ref={groupRef}>
      {Array.from({ length: count }).map((_, i) => (
        <mesh key={i} position={[0, 0, -length/2 + (i * length)/count]}>
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
      ))}
    </group>
  )
}

// Animated B-Field rings (XY Plane around the Z-axis wire)
function AnimatedBField({ current, isPlaying, timeScale }) {
  const groupRef = useRef()
  const speed = current * 0.03
  const scale = Math.max(0.2, Math.abs(current) / 10)

  useFrame((state, delta) => {
    if (!isPlaying) return
    if (groupRef.current) {
      groupRef.current.rotation.z += speed * delta * timeScale
    }
  })

  if (current === 0) return null

  const rings = []
  for (let r = 3; r <= 9; r += 3) {
    const curve = new THREE.EllipseCurve(0, 0, r, r, 0, 2 * Math.PI, false, 0)
    const points = curve.getPoints(50).map(p => new THREE.Vector3(p.x, p.y, 0))
    const path = new THREE.CatmullRomCurve3(points)
    
    rings.push(
      <group key={r}>
        <mesh>
          <tubeGeometry args={[path, 64, 0.1 * scale, 8, true]} />
          <meshStandardMaterial color="#3b82f6" transparent opacity={0.4} />
        </mesh>
        {Array.from({length: 6}).map((_, i) => {
          const a = (i * Math.PI * 2) / 6
          const px = Math.cos(a)*r
          const py = Math.sin(a)*r
          const dirOffset = current < 0 ? Math.PI : 0
          return (
            <group key={i} position={[px, py, 0]} rotation={[0, 0, a + dirOffset]}>
              <mesh position={[0, 0, 0]}>
                <coneGeometry args={[0.5 * scale, 1.5 * scale, 12]} />
                <meshStandardMaterial color="#3b82f6" />
              </mesh>
            </group>
          )
        })}
      </group>
    )
  }

  return <group ref={groupRef}>{rings}</group>
}

function ModeOersted({ i1, i2, wireDist, pointX, isPlaying, timeScale }) {
  const force = i1 * i2
  const isAttracting = force > 0
  
  const x1 = -wireDist / 2
  const x2 = wireDist / 2
  
  const dx1 = pointX - x1
  const dx2 = pointX - x2
  
  const safeDx1 = Math.abs(dx1) < 0.1 ? (dx1 >= 0 ? 0.1 : -0.1) : dx1
  const safeDx2 = Math.abs(dx2) < 0.1 ? (dx2 >= 0 ? 0.1 : -0.1) : dx2
  
  const b1 = i1 / safeDx1
  const b2 = i2 / safeDx2
  const bNet = b1 + b2
  
  const bNetScale = Math.min(10, Math.abs(bNet) * 2)
  const bNetDir = bNet >= 0 ? 1 : -1
  
  return (
    <group>
      <group position={[-wireDist/2, 5, 0]}>
        <Cylinder args={[0.6, 0.6, 30]} rotation={[Math.PI/2, 0, 0]} castShadow>
          <meshStandardMaterial color="#94a3b8" metalness={0.8} transparent opacity={0.6} />
        </Cylinder>
        <CurrentFlow current={i1} length={30} isPlaying={isPlaying} timeScale={timeScale} />
        {i1 !== 0 && <Arrow start={[0, 0, i1 > 0 ? -10 : 10]} end={[0, 0, i1 > 0 ? 10 : -10]} color="#ef4444" width={6} headSize={2.5} />}
        <Text position={[0, 4, 3]} fontSize={2} color="#ef4444" outlineWidth={0.15} outlineColor="#000">
          I1 = {Math.abs(i1)}A
        </Text>
        <AnimatedBField current={i1} isPlaying={isPlaying} timeScale={timeScale} />
      </group>

      <group position={[wireDist/2, 5, 0]}>
        <Cylinder args={[0.6, 0.6, 30]} rotation={[Math.PI/2, 0, 0]} castShadow>
          <meshStandardMaterial color="#94a3b8" metalness={0.8} transparent opacity={0.6} />
        </Cylinder>
        <CurrentFlow current={i2} length={30} isPlaying={isPlaying} timeScale={timeScale} />
        {i2 !== 0 && <Arrow start={[0, 0, i2 > 0 ? -10 : 10]} end={[0, 0, i2 > 0 ? 10 : -10]} color="#ef4444" width={6} headSize={2.5} />}
        <Text position={[0, 4, 3]} fontSize={2} color="#ef4444" outlineWidth={0.15} outlineColor="#000">
          I2 = {Math.abs(i2)}A
        </Text>
        <AnimatedBField current={i2} isPlaying={isPlaying} timeScale={timeScale} />
      </group>

      {force !== 0 && (
        <group position={[0, 6, -15]}>
          <Text position={[0, 2, 0]} fontSize={1.2} color="#fbbf24">
            {isAttracting ? "Attracting Force" : "Repelling Force"}
          </Text>
          {isAttracting ? (
             <group>
               <Arrow start={[-wireDist/2 + 2, 0, 0]} end={[-1, 0, 0]} color="#d97706" />
               <Arrow start={[wireDist/2 - 2, 0, 0]} end={[1, 0, 0]} color="#d97706" />
             </group>
          ) : (
             <group>
               <Arrow start={[-wireDist/2 - 1, 0, 0]} end={[-wireDist + 2, 0, 0]} color="#d97706" />
               <Arrow start={[wireDist/2 + 1, 0, 0]} end={[wireDist - 2, 0, 0]} color="#d97706" />
             </group>
          )}
        </group>
      )}

      <group position={[pointX, 5, 3]}>
        <mesh>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshStandardMaterial color="#8b5cf6" />
        </mesh>
        <Text position={[0, -1.5, 0]} fontSize={1.2} color="#8b5cf6">
          X
        </Text>
        {Math.abs(bNet) > 0.05 && (
          <Arrow 
            start={[0, bNetDir > 0 ? 0.5 : -0.5, 0]} 
            end={[0, bNetDir > 0 ? 0.5 + bNetScale : -0.5 - bNetScale, 0]} 
            color="#22c55e" 
            width={4} 
            headSize={1.5} 
          />
        )}
        <Text position={[0, bNetDir > 0 ? bNetScale + 2.2 : -bNetScale - 2.2, 3]} fontSize={1} color="#16a34a" outlineWidth={0.05} outlineColor="#fff">
          B: {Math.abs(bNet).toFixed(1)}
        </Text>
      </group>
    </group>
  )
}

// ─── MOD 4: LORENTZ FORCE ───

function BFieldGrid({ bFieldDir, bStrength }) {
  const points = useMemo(() => {
    const pts = []
    for (let x = -30; x <= 30; x += 5) {
      for (let y = -10; y <= 30; y += 5) {
        pts.push([x, y, 0])
      }
    }
    return pts
  }, [])

  const opacity = Math.min(0.8, 0.2 + (bStrength / 10) * 0.6)

  return (
    <group position={[0,0,-1]}>
      {points.map((p, i) => (
        <group key={i} position={p}>
          {bFieldDir === -1 ? (
             <group>
               <Line points={[[-0.5, -0.5, 0], [0.5, 0.5, 0]]} color="#3b82f6" lineWidth={2} transparent opacity={opacity} />
               <Line points={[[-0.5, 0.5, 0], [0.5, -0.5, 0]]} color="#3b82f6" lineWidth={2} transparent opacity={opacity} />
             </group>
          ) : (
             <mesh>
               <circleGeometry args={[0.3, 16]} />
               <meshBasicMaterial color="#ef4444" transparent opacity={opacity} />
             </mesh>
          )}
        </group>
      ))}
    </group>
  )
}

function ModeLorentz({ chargeSign, chargeMag, particleMass, bFieldDir, velocity, bStrength, resetKey, isPlaying, timeScale }) {
  const particleRef = useRef()
  const trailRef = useRef()
  const path = useRef([])
  const currentVel = useRef(new THREE.Vector3(velocity, 0, 0))
  const currentPos = useRef(new THREE.Vector3(-20, 5, 0))

  useEffect(() => {
    // Sadece resetlendiğinde veya parçacık özellikleri değiştiğinde sıfırla (hız değişimi hariç)
    currentPos.current.set(-20, 5, 0)
    currentVel.current.set(velocity, 0, 0)
    path.current = [new THREE.Vector3(-20, 5, 0)]
    if (trailRef.current) {
      trailRef.current.geometry.setFromPoints(path.current)
    }
  }, [resetKey]) // removed velocity from dependencies so it doesn't reset position!
  
  useFrame((state, delta) => {
    if (!isPlaying) return
    if (!particleRef.current) return
    const dt = Math.min(delta, 0.05) * timeScale

    // F = q(v x B). B is purely in Z.
    // scale down B for better visual turning radius: R = v / (qB)
    const B = new THREE.Vector3(0, 0, bFieldDir * bStrength * 0.5) 
    
    // a = (q/m) * (v x B)
    const a = new THREE.Vector3().crossVectors(currentVel.current, B).multiplyScalar((chargeSign * chargeMag) / particleMass)

    currentVel.current.addScaledVector(a, dt)
    // Magnetic force does no work, so speed must remain constant! 
    // This prevents the Euler integration error (outward spiraling).
    currentVel.current.normalize().multiplyScalar(velocity)
    
    currentPos.current.addScaledVector(currentVel.current, dt)

    particleRef.current.position.copy(currentPos.current)

    // Update trail geometry directly
    if (path.current.length === 0 || path.current[path.current.length-1].distanceTo(currentPos.current) > 0.5) {
      path.current.push(currentPos.current.clone())
      if (path.current.length > 300) path.current.shift() // max trail length
      if (trailRef.current) {
        trailRef.current.geometry.setFromPoints(path.current)
      }
    }
  })

  const pColor = chargeSign > 0 ? "#ef4444" : "#3b82f6"
  const signText = chargeSign > 0 ? "+" : "-"

  return (
    <group>
      <BFieldGrid bFieldDir={bFieldDir} bStrength={bStrength} />
      
      <line ref={trailRef}>
        <bufferGeometry />
        <lineBasicMaterial color={pColor} transparent opacity={0.6} linewidth={3} />
      </line>
      
      <group ref={particleRef} position={[-20, 5, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.8, 32, 32]} />
          <meshStandardMaterial color={pColor} roughness={0.4} metalness={0.6} />
        </mesh>
        <Text position={[0, 0, 1]} fontSize={1} color="#fff">{signText}</Text>
      </group>
      
      {/* Start Gun / Emitter visual */}
      <group position={[-22, 5, 0]} rotation={[0, 0, -Math.PI/2]}>
        <mesh castShadow>
          <cylinderGeometry args={[1, 1, 4, 16]} />
          <meshStandardMaterial color="#475569" metalness={0.8} />
        </mesh>
      </group>
    </group>
  )
}

export default function MagneticFieldSim() {
  const [activeTab, setActiveTab] = useState("oersted")

  // Oersted state
  const [i1, setI1] = useState(10)
  const [i2, setI2] = useState(-10)
  const [wireDist, setWireDist] = useState(12)
  const [pointX, setPointX] = useState(0)

  // Lorentz state
  const [chargeSign, setChargeSign] = useState(1) // +1 or -1
  const [chargeMag, setChargeMag] = useState(1) // 1 to 5
  const [particleMass, setParticleMass] = useState(1) // 1 to 10
  const [bFieldDir, setBFieldDir] = useState(-1) // -1 (In, Cross), +1 (Out, Dot)
  const [velocity, setVelocity] = useState(15)
  const [bStrength, setBStrength] = useState(5)

  // Global standard state
  const [isPlaying, setIsPlaying] = useState(true)
  const [timeScale, setTimeScale] = useState(1)
  const [resetKey, setResetKey] = useState(0)

  const [lightPanelOpen, setLightPanelOpen] = useState(false)
  const [lightDir, setLightDir] = useState(45)
  const [lightInt, setLightInt] = useState(1.5)

  const lx = Math.cos((lightDir * Math.PI) / 180) * 30
  const lz = Math.sin((lightDir * Math.PI) / 180) * 30
  const ly = 30

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
      
      <div className="left-panel" style={panelStyle}>
        
        {/* TABS */}
        <div style={{ display: "flex", gap: "4px", background: "#e2e8f0", padding: "4px", borderRadius: "10px", marginBottom: "20px" }}>
          <div style={tabStyle(activeTab === "oersted")} onClick={() => setActiveTab("oersted")}>OERSTED</div>
          <div style={tabStyle(activeTab === "lorentz")} onClick={() => setActiveTab("lorentz")}>LORENTZ FORCE</div>
        </div>
        {/* OERSTED MODE UI */}
        {activeTab === "oersted" && (
          <div style={cardStyle}>
            <div style={{ background: "#fff", borderLeft: "4px solid #3b82f6", padding: "12px", borderRadius: "8px", marginBottom: "20px", fontSize: "12px", color: "#475569", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
              Animated currents create rotating magnetic fields! Scale & direction of the fields update live.
            </div>

            <label style={lblStyle}>WIRE DISTANCE: {wireDist} m</label>
            <input type="range" min={6} max={25} step={1} value={wireDist} onChange={e => setWireDist(+e.target.value)} style={{ width: "100%", marginBottom: "16px", accentColor: "#8b5cf6" }} />

            <label style={lblStyle}>WIRE 1 CURRENT: {Math.abs(i1)} A</label>
            <div style={{ display: "flex", gap: "10px", marginBottom: "16px", alignItems: "center" }}>
              <input type="range" min={0} max={20} step={1} value={Math.abs(i1)} onChange={e => setI1(Math.sign(i1 || 1) * +e.target.value)} style={{ flex: 1, accentColor: "#ef4444" }} />
              <button onClick={() => setI1(-i1)} style={{ padding: "6px 10px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>
                FLIP DIR
              </button>
            </div>
            
            <label style={lblStyle}>WIRE 2 CURRENT: {Math.abs(i2)} A</label>
            <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "20px" }}>
              <input type="range" min={0} max={20} step={1} value={Math.abs(i2)} onChange={e => setI2(Math.sign(i2 || 1) * +e.target.value)} style={{ flex: 1, accentColor: "#ef4444" }} />
              <button onClick={() => setI2(-i2)} style={{ padding: "6px 10px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>
                FLIP DIR
              </button>
            </div>

            <div style={{ background: "#e2e8f0", padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
              <label style={lblStyle}>OBSERVATION POINT X: {pointX.toFixed(1)} m</label>
              <input type="range" min={-20} max={20} step={0.5} value={pointX} onChange={e => setPointX(+e.target.value)} style={{ width: "100%", marginBottom: "12px", accentColor: "#8b5cf6" }} />
              
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#475569", marginBottom: "4px" }}>
                <span>Dist to W1: <b>{Math.abs(pointX - (-wireDist/2)).toFixed(1)} m</b></span>
                <span>Dist to W2: <b>{Math.abs(pointX - (wireDist/2)).toFixed(1)} m</b></span>
              </div>
              
              <div style={{ fontSize: "12px", color: "#166534", fontWeight: "bold", background: "#dcfce7", padding: "6px", borderRadius: "4px", textAlign: "center", marginTop: "8px" }}>
                NET B-FIELD (Y-AXIS) = {((i1 / (Math.abs(pointX - (-wireDist/2)) || 0.1)) + (i2 / (Math.abs(pointX - (wireDist/2)) || 0.1))).toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {/* LORENTZ FORCE UI */}
        {activeTab === "lorentz" && (
          <div style={cardStyle}>

            <label style={lblStyle}>CHARGE SIGN (q)</label>
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              <button onClick={() => setChargeSign(1)} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: chargeSign === 1 ? "2px solid #ef4444" : "1px solid #cbd5e1", background: chargeSign === 1 ? "#fee2e2" : "#fff", color: "#ef4444", fontWeight: "bold", cursor: "pointer" }}>
                POSITIVE (+)
              </button>
              <button onClick={() => setChargeSign(-1)} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: chargeSign === -1 ? "2px solid #3b82f6" : "1px solid #cbd5e1", background: chargeSign === -1 ? "#dbeafe" : "#fff", color: "#3b82f6", fontWeight: "bold", cursor: "pointer" }}>
                NEGATIVE (-)
              </button>
            </div>

            <label style={lblStyle}>CHARGE MAGNITUDE: {chargeMag} C</label>
            <input type="range" min={1} max={5} step={1} value={chargeMag} onChange={e => setChargeMag(+e.target.value)} style={{ width: "100%", marginBottom: "16px", accentColor: chargeSign > 0 ? "#ef4444" : "#3b82f6" }} />

            <label style={lblStyle}>MAGNETIC FIELD DIRECTION (B)</label>
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              <button onClick={() => setBFieldDir(-1)} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: bFieldDir === -1 ? "2px solid #64748b" : "1px solid #cbd5e1", background: bFieldDir === -1 ? "#f1f5f9" : "#fff", color: "#475569", fontWeight: "bold", cursor: "pointer" }}>
                INWARD (X)
              </button>
              <button onClick={() => setBFieldDir(1)} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: bFieldDir === 1 ? "2px solid #64748b" : "1px solid #cbd5e1", background: bFieldDir === 1 ? "#f1f5f9" : "#fff", color: "#475569", fontWeight: "bold", cursor: "pointer" }}>
                OUTWARD (•)
              </button>
            </div>

            <label style={lblStyle}>B-FIELD STRENGTH: {bStrength} T</label>
            <input type="range" min={1} max={10} step={0.5} value={bStrength} onChange={e => setBStrength(+e.target.value)} style={{ width: "100%", marginBottom: "16px", accentColor: "#64748b" }} />

            <label style={lblStyle}>PARTICLE MASS (m): {particleMass} kg</label>
            <input type="range" min={1} max={10} step={1} value={particleMass} onChange={e => setParticleMass(+e.target.value)} style={{ width: "100%", marginBottom: "16px", accentColor: "#eab308" }} />

            <label style={lblStyle}>PARTICLE VELOCITY (v): {velocity} m/s</label>
            <input type="range" min={5} max={30} step={1} value={velocity} onChange={e => setVelocity(+e.target.value)} style={{ width: "100%", marginBottom: "10px", accentColor: chargeSign > 0 ? "#ef4444" : "#3b82f6" }} />
          
            <div style={{ background: "#e2e8f0", padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", marginTop: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#475569", marginBottom: "8px", fontWeight: "bold" }}>
                <span>LORENTZ FORCE (F = qvB)</span>
                <span>{(chargeMag * velocity * bStrength).toFixed(0)} N</span>
              </div>
              <div style={{ height: "8px", background: "#cbd5e1", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, (chargeMag * velocity * bStrength) / 15)}%`, background: "#eab308", transition: "width 0.2s" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT SIDE ICON BUTTONS */}
      
      {/* LIGHT BULB (194px) */}
      <button onClick={() => setLightPanelOpen(!lightPanelOpen)}
        className="ui-element"
        style={{ ...iconBtnStyle(lightPanelOpen), top: "194px" }} title="Light Controls">
        <LightBulbIcon width={24} height={24} fill={lightPanelOpen ? "#000" : "#fff"} />
      </button>

      {/* PLAY/PAUSE (252px) */}
      <button onClick={() => setIsPlaying(!isPlaying)}
        className="ui-element"
        style={{ ...iconBtnStyle(isPlaying), top: "252px" }} title="Play / Pause">
        {isPlaying ? <PauseIcon width={24} height={24} fill="#000000" /> : <PlayIcon width={24} height={24} fill="#ffffff" />}
      </button>

      {/* RESET (310px) */}
      <button onClick={() => setResetKey(k => k + 1)}
        className="ui-element"
        style={{ ...iconBtnStyle(false), top: "310px" }} title="Reset">
        <ResetIcon width={24} height={24} fill="#ffffff" />
      </button>

      {/* TIME SCALE (368px) */}
      <button onClick={() => setTimeScale(t => t === 1 ? 0.2 : 1)}
        className="ui-element"
        style={{ ...iconBtnStyle(timeScale !== 1), top: "368px" }} title="Slow Motion">
        <SpeedIcon width={24} height={24} fill={timeScale !== 1 ? "#000000" : "#ffffff"} />
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
        
        <gridHelper args={[100, 100, "#334155", "#1e293b"]} position={[0, -0.5, 0]} />
        {activeTab === "oersted" && <ModeOersted i1={i1} i2={i2} wireDist={wireDist} pointX={pointX} isPlaying={isPlaying} timeScale={timeScale} />}
        {activeTab === "lorentz" && <ModeLorentz chargeSign={chargeSign} chargeMag={chargeMag} particleMass={particleMass} bFieldDir={bFieldDir} velocity={velocity} bStrength={bStrength} resetKey={resetKey} isPlaying={isPlaying} timeScale={timeScale} />}
      </Canvas>
    </div>
  )
}
