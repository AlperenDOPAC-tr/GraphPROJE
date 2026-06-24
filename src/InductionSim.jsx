import React, { useState, useRef, useMemo, useEffect } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls, Text, Line, Cylinder, Box, Sphere } from "@react-three/drei"
import * as THREE from "three"
import { LightBulbIcon, EyeIcon, PlayIcon, PauseIcon, ResetIcon, VectorIcon } from "./Icons"
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

      <group position={[0, 5, 0]} rotation={[0, (angle * Math.PI) / 180 + Math.PI/2, 0]}>
        <mesh castShadow>
          <torusGeometry args={[side, 0.2, 16, 4]} />
          <meshStandardMaterial color="#facc15" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* Removed transparent green plane (the 'glow' effect) */}
        <Arrow start={[0,0,0]} end={[0, 0, 2.5]} color="#22c55e" headSize={0.4} />
        <Text position={[0, 0.5, 3.2]} fontSize={1.2} color="#22c55e" outlineWidth={0.05} outlineColor="#000" fontWeight="bold">n</Text>
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
function ModeFaraday({ magnetX, setMagnetX, setAutoSpeed, controlsRef, magnetStr, turns, autoSpeed, magnetFlip, showVectors }) {
  const { gl, camera } = useThree()
  const currentPos = useRef(magnetX)
  const prevPos = useRef(magnetX)
  const dir = useRef(1)
  const smoothedV = useRef(0)
  const draggingRef = useRef(false)
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), [])
  
  useEffect(() => {
    const onMove = (e) => {
      if (!draggingRef.current) return
      const rect = gl.domElement.getBoundingClientRect()
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      )
      const rc = new THREE.Raycaster()
      rc.setFromCamera(mouse, camera)
      const pt = new THREE.Vector3()
      rc.ray.intersectPlane(plane, pt)
      if (pt) {
        let x = Math.max(-15, Math.min(15, pt.x))
        setMagnetX(x)
      }
    }
    const onUp = () => {
      if (draggingRef.current) {
        draggingRef.current = false
        gl.domElement.style.cursor = 'default'
        if (controlsRef && controlsRef.current) controlsRef.current.enabled = true
      }
    }
    gl.domElement.addEventListener('pointermove', onMove)
    gl.domElement.addEventListener('pointerup', onUp)
    gl.domElement.addEventListener('pointerleave', onUp)
    return () => {
      gl.domElement.removeEventListener('pointermove', onMove)
      gl.domElement.removeEventListener('pointerup', onUp)
      gl.domElement.removeEventListener('pointerleave', onUp)
    }
  }, [gl, camera, setMagnetX, plane, controlsRef])
  
  const magnetGroupRef = useRef()
  const bulbMeshRef = useRef()
  const pointLightRef = useRef()

  const velGroup = useRef()
  const forceGroup = useRef()
  const bGroup = useRef()
  const velTextRef = useRef()
  const forceTextRef = useRef()
  const bTextRef = useRef()

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    let rawV = 0
    if (autoSpeed > 0) {
      currentPos.current += dir.current * autoSpeed * dt
      rawV = dir.current * autoSpeed
      if (currentPos.current > 15) {
        currentPos.current = 15; dir.current = -1
      }
      if (currentPos.current < -15) {
        currentPos.current = -15; dir.current = 1
      }
      prevPos.current = currentPos.current
    } else {
      rawV = (magnetX - prevPos.current) / dt
      prevPos.current = magnetX
      currentPos.current = magnetX
    }

    if (magnetGroupRef.current) {
      magnetGroupRef.current.position.x = currentPos.current
    }

    smoothedV.current = THREE.MathUtils.lerp(smoothedV.current, rawV, 0.15)

    // Realistic EMF Physics: e = -N * v * d(Phi)/dx
    // Flux gradient shape: x * exp(-0.08 * x^2)
    const x = currentPos.current
    const fluxGradient = x * Math.exp(-0.08 * x * x)
    const emfVal = Math.abs(smoothedV.current * fluxGradient * magnetStr * turns * 0.15)

    // Direct DOM manipulation for UI bar to avoid React re-renders every frame
    const domBar = document.getElementById("ui-emf-bar-fill")
    const domText = document.getElementById("ui-emf-text")
    if (domBar && domText) {
      // Divided by 30 so it reaches 100% when emfVal is around 900
      const widthPercent = Math.min(100, (Math.sqrt(emfVal) / 30) * 100)
      domBar.style.width = `${widthPercent}%`
      domBar.style.background = emfVal > 800 ? "#ef4444" : "#facc15"
      domText.innerText = emfVal.toFixed(1) + " V"
    }

    // Direct 3D manipulation for Lightbulb
    const intensity = Math.min(10, Math.sqrt(emfVal) * 0.3)
    if (bulbMeshRef.current && pointLightRef.current) {
      if (intensity > 0.1) {
        bulbMeshRef.current.material.color.set("#facc15")
        bulbMeshRef.current.material.emissive.set("#facc15")
        bulbMeshRef.current.material.emissiveIntensity = intensity * 0.2
        bulbMeshRef.current.material.opacity = 0.8
        pointLightRef.current.intensity = intensity * 2
      } else {
        bulbMeshRef.current.material.color.set("#94a3b8")
        bulbMeshRef.current.material.emissive.set("#000000")
        bulbMeshRef.current.material.opacity = 0.6
        pointLightRef.current.intensity = 0
      }
    }

    // Update vector arrows on the magnet
    const updateArrow = (groupRef, dirVec, len) => {
      if (groupRef.current && len > 0.1) {
        groupRef.current.visible = true
        groupRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirVec.clone().normalize())
        groupRef.current.children[0].scale.y = len
        groupRef.current.children[0].position.y = len / 2
        groupRef.current.children[1].position.y = len
      } else if (groupRef.current) {
        groupRef.current.visible = false
      }
    }

    const updateText = (textRef, basePos, dirVec, len) => {
      if (textRef.current) {
        if (len > 0.1) {
          textRef.current.visible = true
          textRef.current.position.copy(basePos).addScaledVector(dirVec.clone().normalize(), len + 0.8)
        } else {
          textRef.current.visible = false
        }
      }
    }

    // Velocity vector
    const vDir = new THREE.Vector3(smoothedV.current > 0 ? 1 : -1, 0, 0)
    const vLen = Math.abs(smoothedV.current) * 0.2
    updateArrow(velGroup, vDir, vLen)
    updateText(velTextRef, new THREE.Vector3(0, 1.5, 0), vDir, vLen)
    
    // Lenz's Law opposing magnetic force (F)
    const fDir = new THREE.Vector3(smoothedV.current > 0 ? -1 : 1, 0, 0)
    const fLen = emfVal * 0.15
    updateArrow(forceGroup, fDir, fLen)
    updateText(forceTextRef, new THREE.Vector3(0, -1.5, 0), fDir, fLen)

    // B-field of the magnet (points outward from N pole)
    if (bGroup.current) {
      const bDir = new THREE.Vector3(-magnetFlip, 0, 0)
      const bLen = magnetStr * 0.5
      bGroup.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bDir)
      bGroup.current.children[0].scale.y = bLen
      bGroup.current.children[0].position.y = bLen / 2
      bGroup.current.children[1].position.y = bLen

      if (bTextRef.current) {
        bTextRef.current.position.copy(new THREE.Vector3(magnetFlip === 1 ? -4 : 4, 0, 0)).addScaledVector(bDir, bLen + 0.8)
      }
    }
  })

  return (
    <group>
      {/* Magnet */}
      <group ref={magnetGroupRef} position={[magnetX, 6.5, 0]}
        onPointerDown={(e) => {
          e.stopPropagation()
          draggingRef.current = true
          setAutoSpeed(0)
          gl.domElement.style.cursor = 'grabbing'
          if (controlsRef && controlsRef.current) controlsRef.current.enabled = false
        }}
        onPointerEnter={(e) => {
          if (!draggingRef.current) gl.domElement.style.cursor = 'grab'
        }}
        onPointerLeave={(e) => {
          if (!draggingRef.current) gl.domElement.style.cursor = 'default'
        }}
      >
        <mesh position={[-2, 0, 0]} castShadow>
          <boxGeometry args={[4, 2, 2]} />
          <meshStandardMaterial color={magnetFlip === 1 ? "#ef4444" : "#3b82f6"} roughness={0.4} metalness={0.5} />
        </mesh>
        <Text position={[-3, 0, 1.1]} fontSize={1.2} color="#fff">{magnetFlip === 1 ? "N" : "S"}</Text>
        <mesh position={[2, 0, 0]} castShadow>
          <boxGeometry args={[4, 2, 2]} />
          <meshStandardMaterial color={magnetFlip === 1 ? "#3b82f6" : "#ef4444"} roughness={0.4} metalness={0.5} />
        </mesh>
        <Text position={[3, 0, 1.1]} fontSize={1.2} color="#fff">{magnetFlip === 1 ? "S" : "N"}</Text>

        {showVectors && (
          <>
            {/* VELOCITY VECTOR */}
            <group ref={velGroup} position={[0, 1.5, 0]}>
              <mesh position={[0, 1, 0]} castShadow><cylinderGeometry args={[0.1, 0.1, 1, 8]} /><meshBasicMaterial color="#ef4444" /></mesh>
              <mesh position={[0, 2, 0]} castShadow><coneGeometry args={[0.3, 0.6, 8]} /><meshBasicMaterial color="#ef4444" /></mesh>
            </group>
            <Text ref={velTextRef} fontSize={1.3} color="#ef4444" outlineWidth={0.12} outlineColor="#fff" fontWeight="bold">v</Text>

            {/* OPPOSING FORCE VECTOR (Lenz's Law) */}
            <group ref={forceGroup} position={[0, -1.5, 0]}>
              <mesh position={[0, 1, 0]} castShadow><cylinderGeometry args={[0.1, 0.1, 1, 8]} /><meshBasicMaterial color="#eab308" /></mesh>
              <mesh position={[0, 2, 0]} castShadow><coneGeometry args={[0.3, 0.6, 8]} /><meshBasicMaterial color="#eab308" /></mesh>
            </group>
            <Text ref={forceTextRef} fontSize={1.3} color="#eab308" outlineWidth={0.12} outlineColor="#fff" fontWeight="bold">F(Lenz)</Text>

            {/* B-FIELD VECTOR */}
            <group ref={bGroup} position={[magnetFlip === 1 ? -4 : 4, 0, 0]}>
              <mesh position={[0, 1, 0]} castShadow><cylinderGeometry args={[0.1, 0.1, 1, 8]} /><meshBasicMaterial color="#06b6d4" /></mesh>
              <mesh position={[0, 2, 0]} castShadow><coneGeometry args={[0.3, 0.6, 8]} /><meshBasicMaterial color="#06b6d4" /></mesh>
            </group>
            <Text ref={bTextRef} fontSize={1.3} color="#06b6d4" outlineWidth={0.12} outlineColor="#fff" fontWeight="bold">B</Text>
          </>
        )}
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
        <mesh position={[0, 1.2, 0]} ref={bulbMeshRef}>
          <sphereGeometry args={[1.2, 32, 32]} />
          <meshStandardMaterial color="#94a3b8" transparent opacity={0.6} />
        </mesh>
        <pointLight ref={pointLightRef} position={[0, 1.2, 0]} intensity={0} color="#facc15" distance={20} />
      </group>
    </group>
  )
}

// REMOVED OERSTED COMPONENTS

export default function InductionSim() {
  const controlsRef = useRef()
  const [activeTab, setActiveTab] = useState("flux")

  // Flux state
  const [bField, setBField] = useState(5)
  const [area, setArea] = useState(16)
  const [angle, setAngle] = useState(0)

  // Faraday state
  const [magnetX, setMagnetX] = useState(15)
  const [magnetStr, setMagnetStr] = useState(5)
  const [turns, setTurns] = useState(5)
  const [autoSpeed, setAutoSpeed] = useState(0) // 0=Manual, 10=Slow, 25=Medium, 50=Fast
  const [magnetFlip, setMagnetFlip] = useState(1) // 1: N left, -1: N right
  const [showVectors, setShowVectors] = useState(true)

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
        
        <h2 style={{ fontSize: "18px", margin: "0 0 20px 0", color: "#1e293b", fontWeight: "800", textAlign: "center" }}>ELECTROMAGNETIC INDUCTION</h2>

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
            <input type="range" min={-15} max={15} step={0.1} value={magnetX} onChange={e => { setMagnetX(+e.target.value); setAutoSpeed(0); }} style={{ width: "100%", marginBottom: "16px", accentColor: "#ef4444" }} disabled={autoSpeed > 0} />
            
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              <button onClick={() => setMagnetFlip(f => -f)} style={{ flex: 1, padding: "10px", background: "#f1f5f9", border: "2px solid #cbd5e1", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", color: "#334155" }}>
                FLIP POLES ({magnetFlip === 1 ? "N-S" : "S-N"})
              </button>
            </div>

            <label style={lblStyle}>AUTO MOVE MAGNET</label>
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              <button onClick={() => setAutoSpeed(0)} style={{ flex: 1, padding: "6px", background: autoSpeed === 0 ? "#ef4444" : "#fff", color: autoSpeed === 0 ? "#fff" : "#475569", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>MANUAL</button>
              <button onClick={() => setAutoSpeed(15)} style={{ flex: 1, padding: "6px", background: autoSpeed === 15 ? "#ef4444" : "#fff", color: autoSpeed === 15 ? "#fff" : "#475569", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>SLOW</button>
              <button onClick={() => setAutoSpeed(30)} style={{ flex: 1, padding: "6px", background: autoSpeed === 30 ? "#ef4444" : "#fff", color: autoSpeed === 30 ? "#fff" : "#475569", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>MED</button>
              <button onClick={() => setAutoSpeed(60)} style={{ flex: 1, padding: "6px", background: autoSpeed === 60 ? "#ef4444" : "#fff", color: autoSpeed === 60 ? "#fff" : "#475569", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>FAST</button>
            </div>
            
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

      {/* VECTOR TOGGLE (252px) */}
      {activeTab === "faraday" && (
        <button onClick={() => setShowVectors(!showVectors)}
          className="ui-element"
          style={{ ...iconBtnStyle(!showVectors), top: "252px" }} title="Toggle Vectors">
          <VectorIcon width={24} height={24} fill={showVectors ? "#fff" : "#000"} />
        </button>
      )}
      
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
        
        <OrbitControls ref={controlsRef} makeDefault enablePan target={[0, 5, 0]} maxPolarAngle={Math.PI/2 - 0.05} />
        
        <CheckerGround />
        
        {activeTab === "flux" && <ModeFlux bField={bField} area={area} angle={angle} />}
        {activeTab === "faraday" && <ModeFaraday magnetX={magnetX} setMagnetX={setMagnetX} setAutoSpeed={setAutoSpeed} controlsRef={controlsRef} magnetStr={magnetStr} turns={turns} autoSpeed={autoSpeed} magnetFlip={magnetFlip} showVectors={showVectors} />}
      </Canvas>
    </div>
  )
}
