import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { ResetIcon, VectorIcon, LightBulbIcon, EyeIcon } from './Icons'

const getColor = (q) => q > 0 ? '#ff1744' : q < 0 ? '#2979ff' : '#9e9e9e'

function Arrow3D({ startPos, vector, color, label, visible = true, scaleFactor = 1, maxLength = 15, textOffset = [0, 1.5, 0] }) {
  const groupRef = useRef()
  const length = vector.length()
  const dir = useMemo(() => vector.clone().normalize(), [vector])
  
  useEffect(() => {
    if (!groupRef.current || length === 0) return
    groupRef.current.position.set(startPos.x, startPos.y, startPos.z)
    const axis = new THREE.Vector3(0, 1, 0)
    const quaternion = new THREE.Quaternion().setFromUnitVectors(axis, dir)
    groupRef.current.quaternion.copy(quaternion)
  }, [startPos, vector, length, dir])

  if (!visible || length < 0.001) return null

  // Linear scale with a minimum length for visibility, clamped at maxLength
  const visualLength = Math.min(Math.max(length * scaleFactor, 3), maxLength)

  const textPos = [
    startPos.x + dir.x * visualLength + textOffset[0],
    startPos.y + dir.y * visualLength + textOffset[1],
    startPos.z + dir.z * visualLength + textOffset[2]
  ]

  return (
    <group>
      <group ref={groupRef}>
        <mesh position={[0, visualLength / 2, 0]}>
          <cylinderGeometry args={[0.1, 0.1, visualLength, 8]} />
          <meshBasicMaterial color={color} />
        </mesh>
        <mesh position={[0, visualLength + 0.4, 0]}>
          <coneGeometry args={[0.3, 0.8, 16]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>
      {label && (
        <Billboard position={textPos}>
          <Text fontSize={1.4} color={color} outlineWidth={0.08} outlineColor="#000" fontWeight="bold">
            {label}
          </Text>
        </Billboard>
      )}
    </group>
  )
}

function Scene({ q1, setQ1, pos1, setPos1, q2, setQ2, pos2, setPos2, posP, setPosP, showVectors, lightIntensity, resetKey }) {
  const { camera, gl } = useThree()
  const controlsRef = useRef()
  const draggingRef = useRef(null)
  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])

  const currentPos1 = useRef(new THREE.Vector3(pos1.x, 0, pos1.z))
  const currentPos2 = useRef(new THREE.Vector3(pos2.x, 0, pos2.z))
  const currentPosP = useRef(new THREE.Vector3(posP.x, 0, posP.z))

  useEffect(() => {
    currentPos1.current.set(pos1.x, 0, pos1.z)
    currentPos2.current.set(pos2.x, 0, pos2.z)
    currentPosP.current.set(posP.x, 0, posP.z)
  }, [pos1, pos2, posP])

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
      rc.ray.intersectPlane(groundPlane, pt)
      if (!pt) return

      const limit = 45
      const x = Math.max(-limit, Math.min(limit, pt.x))
      const z = Math.max(-limit, Math.min(limit, pt.z))

      if (draggingRef.current === '1') setPos1({ x, z })
      else if (draggingRef.current === '2') setPos2({ x, z })
      else if (draggingRef.current === 'P') setPosP({ x, z })
    }

    const onUp = () => {
      if (draggingRef.current) {
        draggingRef.current = null
        gl.domElement.style.cursor = 'default'
        if (controlsRef.current) controlsRef.current.enabled = true
      }
    }

    gl.domElement.addEventListener('pointermove', onMove)
    gl.domElement.addEventListener('pointerup', onUp)
    return () => {
      gl.domElement.removeEventListener('pointermove', onMove)
      gl.domElement.removeEventListener('pointerup', onUp)
    }
  }, [camera, gl, setPos1, setPos2, setPosP, groundPlane])

  const startDrag = (id) => (e) => {
    e.stopPropagation()
    draggingRef.current = id
    gl.domElement.style.cursor = 'grabbing'
    if (controlsRef.current) controlsRef.current.enabled = false
  }

  // Physics Calculations
  const k = 8.987 // 10^9 N m^2 / C^2. We scale it visually.
  
  // E-Field at Point P
  const r1P = new THREE.Vector3().subVectors(currentPosP.current, currentPos1.current)
  const dist1P = Math.max(r1P.length(), 0.5)
  const e1Mag = (k * Math.abs(q1)) / (dist1P * dist1P)
  const e1Vec = r1P.normalize().multiplyScalar(q1 >= 0 ? e1Mag : -e1Mag)

  const r2P = new THREE.Vector3().subVectors(currentPosP.current, currentPos2.current)
  const dist2P = Math.max(r2P.length(), 0.5)
  const e2Mag = (k * Math.abs(q2)) / (dist2P * dist2P)
  const e2Vec = r2P.normalize().multiplyScalar(q2 >= 0 ? e2Mag : -e2Mag)

  const eNetVec = new THREE.Vector3().addVectors(e1Vec, e2Vec)

  // E-Field that Q1 creates at Q2's position
  const r12 = new THREE.Vector3().subVectors(currentPos2.current, currentPos1.current)
  const dist12 = Math.max(r12.length(), 1)
  const e1on2Mag = (k * Math.abs(q1)) / (dist12 * dist12)
  const e1on2Vec = r12.clone().normalize().multiplyScalar(q1 >= 0 ? e1on2Mag : -e1on2Mag)

  // E-Field that Q2 creates at Q1's position
  const r21 = new THREE.Vector3().subVectors(currentPos1.current, currentPos2.current)
  const e2on1Mag = (k * Math.abs(q2)) / (dist12 * dist12)
  const e2on1Vec = r21.clone().normalize().multiplyScalar(q2 >= 0 ? e2on1Mag : -e2on1Mag)

  // Force between Q1 and Q2
  // Force magnitude: k * |q1*q2| / r^2
  const forceMag = (k * Math.abs(q1 * q2)) / (dist12 * dist12)
  // Direction on Q2 from Q1:
  // If same sign (repulsive), force on Q2 is ALONG r12.
  // If opposite sign (attractive), force on Q2 is OPPOSITE to r12.
  const sign = (q1 * q2 >= 0) ? 1 : -1
  const forceOn2 = r12.clone().normalize().multiplyScalar(forceMag * sign)
  const forceOn1 = forceOn2.clone().negate()

  return (
    <group>
      <ambientLight intensity={1.0} />
      <directionalLight position={[20, 50, 20]} intensity={lightIntensity} />
      <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.05} />

      {/* Ground Grid */}
      <gridHelper args={[100, 100, "#334155", "#1e293b"]} position={[0, -0.05, 0]} />
      {/* Invisible plane for raycasting */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} visible={false}>
        <planeGeometry args={[100, 100]} />
      </mesh>

      {/* Charge 1 */}
      <group position={[pos1.x, 1, pos1.z]}>
        <mesh onPointerDown={startDrag('1')} onPointerEnter={(e) => { if(!draggingRef.current) gl.domElement.style.cursor='grab' }} onPointerLeave={() => { if(!draggingRef.current) gl.domElement.style.cursor='default' }}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshStandardMaterial color={getColor(q1)} roughness={0.3} metalness={0.4} emissive={getColor(q1)} emissiveIntensity={0.2} />
        </mesh>
        <Billboard position={[0, 2.5, 0]}>
          <Text fontSize={0.8} color="#fff" outlineWidth={0.05} outlineColor="#000" fontWeight="bold">
            {q1 > 0 ? `+${q1}` : q1} µC
          </Text>
        </Billboard>
        {/* Force & E-Field Vectors on Q1 */}
        {q1 !== 0 && q2 !== 0 && (
          <group>
            <Arrow3D startPos={new THREE.Vector3(0, 0.6, 0)} vector={forceOn1} color="#00e676" label="F" visible={showVectors} scaleFactor={0.5} maxLength={20} textOffset={[0, 1.5, 0]} />
            <Arrow3D startPos={new THREE.Vector3(0, -0.6, 0)} vector={e2on1Vec} color="#ffeb3b" label="E" visible={showVectors} scaleFactor={0.5} maxLength={20} textOffset={[0, -1.5, 0]} />
          </group>
        )}
      </group>

      {/* Charge 2 */}
      <group position={[pos2.x, 1, pos2.z]}>
        <mesh onPointerDown={startDrag('2')} onPointerEnter={(e) => { if(!draggingRef.current) gl.domElement.style.cursor='grab' }} onPointerLeave={() => { if(!draggingRef.current) gl.domElement.style.cursor='default' }}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshStandardMaterial color={getColor(q2)} roughness={0.3} metalness={0.4} emissive={getColor(q2)} emissiveIntensity={0.2} />
        </mesh>
        <Billboard position={[0, 2.5, 0]}>
          <Text fontSize={0.8} color="#fff" outlineWidth={0.05} outlineColor="#000" fontWeight="bold">
            {q2 > 0 ? `+${q2}` : q2} µC
          </Text>
        </Billboard>
        {/* Force & E-Field Vectors on Q2 */}
        {q1 !== 0 && q2 !== 0 && (
          <group>
            <Arrow3D startPos={new THREE.Vector3(0, 0.6, 0)} vector={forceOn2} color="#00e676" label="F" visible={showVectors} scaleFactor={0.5} maxLength={20} textOffset={[0, 1.5, 0]} />
            <Arrow3D startPos={new THREE.Vector3(0, -0.6, 0)} vector={e1on2Vec} color="#ffeb3b" label="E" visible={showVectors} scaleFactor={0.5} maxLength={20} textOffset={[0, -1.5, 0]} />
          </group>
        )}
      </group>

      {/* Test Point P */}
      <group position={[posP.x, 1, posP.z]}>
        <mesh onPointerDown={startDrag('P')} onPointerEnter={(e) => { if(!draggingRef.current) gl.domElement.style.cursor='grab' }} onPointerLeave={() => { if(!draggingRef.current) gl.domElement.style.cursor='default' }}>
          <sphereGeometry args={[0.5, 32, 32]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.8} />
        </mesh>
        <Billboard position={[0, 1.5, 0]}>
          <Text fontSize={0.6} color="#fff" outlineWidth={0.04} outlineColor="#000" fontWeight="bold">
            Point P
          </Text>
        </Billboard>
        {/* Electric Field Vectors */}
        <Arrow3D startPos={new THREE.Vector3(0,0,0)} vector={e1Vec} color={getColor(q1)} visible={showVectors && q1 !== 0} scaleFactor={0.8} maxLength={15} />
        <Arrow3D startPos={new THREE.Vector3(0,0,0)} vector={e2Vec} color={getColor(q2)} visible={showVectors && q2 !== 0} scaleFactor={0.8} maxLength={15} />
        <Arrow3D startPos={new THREE.Vector3(0,0,0)} vector={eNetVec} color="#ffeb3b" label="E_net" visible={showVectors && (q1 !== 0 || q2 !== 0)} scaleFactor={0.8} maxLength={25} />
      </group>
    </group>
  )
}

export default function ElectricField() {
  const [resetKey, setResetKey] = useState(0)
  const [showVectors, setShowVectors] = useState(true)
  const [uiVisible, setUiVisible] = useState(true)
  const [lightPanelOpen, setLightPanelOpen] = useState(false)
  const [lightIntensity, setLightIntensity] = useState(1.5)

  // Charges
  const [q1, setQ1] = useState(5)
  const [pos1, setPos1] = useState({ x: -10, z: 0 })
  
  const [q2, setQ2] = useState(-5)
  const [pos2, setPos2] = useState({ x: 10, z: 0 })

  // Test Point P
  const [posP, setPosP] = useState({ x: 0, z: -10 })

  const handleReset = () => {
    setQ1(5)
    setPos1({ x: -10, z: 0 })
    setQ2(-5)
    setPos2({ x: 10, z: 0 })
    setPosP({ x: 0, z: -10 })
    setResetKey(k => k + 1)
  }

  // Calculate live stats for Telemetry
  const k = 8.987
  const r12Dist = Math.max(Math.sqrt((pos2.x - pos1.x)**2 + (pos2.z - pos1.z)**2), 1)
  const forceMag = (k * Math.abs(q1 * q2)) / (r12Dist * r12Dist)

  const e1dx = posP.x - pos1.x
  const e1dz = posP.z - pos1.z
  const r1pDist = Math.max(Math.sqrt(e1dx*e1dx + e1dz*e1dz), 0.5)
  const e1Mag = (k * Math.abs(q1)) / (r1pDist * r1pDist)
  const e1x = (e1dx / r1pDist) * (q1 >= 0 ? e1Mag : -e1Mag)
  const e1z = (e1dz / r1pDist) * (q1 >= 0 ? e1Mag : -e1Mag)

  const e2dx = posP.x - pos2.x
  const e2dz = posP.z - pos2.z
  const r2pDist = Math.max(Math.sqrt(e2dx*e2dx + e2dz*e2dz), 0.5)
  const e2Mag = (k * Math.abs(q2)) / (r2pDist * r2pDist)
  const e2x = (e2dx / r2pDist) * (q2 >= 0 ? e2Mag : -e2Mag)
  const e2z = (e2dz / r2pDist) * (q2 >= 0 ? e2Mag : -e2Mag)

  const eNetX = e1x + e2x
  const eNetZ = e1z + e2z
  const eNetMag = Math.sqrt(eNetX*eNetX + eNetZ*eNetZ)

  // E-field each charge creates at the OTHER charge's position
  const r12Dist3D = Math.max(Math.sqrt((pos2.x - pos1.x)**2 + (pos2.z - pos1.z)**2), 1)
  const e1on2Mag = (k * Math.abs(q1)) / (r12Dist3D * r12Dist3D)
  const e2on1Mag = (k * Math.abs(q2)) / (r12Dist3D * r12Dist3D)

  const panelStyle = {
    background: 'rgba(255,255,255,0.8)',
    backdropFilter: 'blur(8px)',
    padding: '20px',
    borderRadius: '12px',
    boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    border: '1px solid rgba(255,255,255,0.5)',
    width: '285px',
    color: '#333',
    maxHeight: 'calc(100vh - 40px)',
    overflowY: 'auto',
    position: "absolute",
    left: "20px",
    top: "20px",
    zIndex: 10,
    boxSizing: 'border-box'
  }

  const cardStyle = (color) => ({
    background: '#ffffff',
    padding: '10px',
    borderRadius: '8px',
    borderLeft: `4px solid ${color}`,
    boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
  })

  const lblStyle = { display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#555', marginBottom: 2, textTransform: "uppercase" }

  const iconBtnStyle = (active) => ({
    width: "48px", height: "48px", 
    background: active ? "#ffffff" : "rgba(15, 15, 20, 0.85)", 
    color: active ? "#000" : "#fff", 
    border: "none", borderRadius: "14px", 
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", 
    boxShadow: "0 4px 20px rgba(0,0,0,0.25)", 
    transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)", 
    backdropFilter: "blur(12px)"
  })

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#050505", fontFamily: "'Inter', sans-serif" }}>
      <Canvas shadows camera={{ position: [0, 35, 45], fov: 40 }} style={{ background: "#050505" }}>
        <color attach="background" args={["#050505"]} />
        <Scene 
          q1={q1} setQ1={setQ1} pos1={pos1} setPos1={setPos1}
          q2={q2} setQ2={setQ2} pos2={pos2} setPos2={setPos2}
          posP={posP} setPosP={setPosP}
          showVectors={showVectors}
          lightIntensity={lightIntensity}
          resetKey={resetKey}
        />
      </Canvas>

      {/* RIGHT PANEL - SETTINGS */}
      <button onClick={handleReset} style={{ ...iconBtnStyle(false), position: "absolute", top: "194px", right: "24px", zIndex: 1000 }} title="Reset Simulation">
        <ResetIcon width={24} height={24} fill="#fff" />
      </button>

      <button onClick={() => setLightPanelOpen(!lightPanelOpen)} style={{ ...iconBtnStyle(lightPanelOpen), position: "absolute", top: "252px", right: "24px", zIndex: 1000 }} title="Light Controls">
        <LightBulbIcon width={24} height={24} fill={lightPanelOpen ? "#000" : "#fff"} />
      </button>

      {lightPanelOpen && (
        <div style={{ position: 'absolute', top: '252px', right: '82px', zIndex: 999, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', padding: '16px', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.2)', border: '1px solid #eee', width: '220px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#333', textAlign: 'center' }}>LIGHT CONTROLS</h4>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#333', marginBottom: 4 }}>INTENSITY: {lightIntensity.toFixed(1)}</label>
          <input type="range" min="0" max="3" step="0.1" value={lightIntensity} onChange={e => setLightIntensity(Number(e.target.value))} style={{ width: '100%' }} />
        </div>
      )}

      <button onClick={() => setShowVectors(!showVectors)} style={{ ...iconBtnStyle(!showVectors), position: "absolute", top: "310px", right: "24px", zIndex: 1000 }} title="Toggle Vectors">
        <VectorIcon width={24} height={24} fill={showVectors ? "#fff" : "#000"} />
      </button>

      {/* LEFT PANEL */}
      {uiVisible && (
      <div style={panelStyle} className="left-panel">
        <h2 style={{ fontSize: "16px", margin: "0 0 4px 0", color: "#1e293b", fontWeight: "800", textAlign: "center" }}>ELECTRIC FIELD</h2>
        
        {/* CHARGE 1 */}
        <div style={cardStyle(getColor(q1))}>
          <h3 style={{ fontSize: "12px", margin: "0 0 8px 0", color: getColor(q1), fontWeight: "bold" }}>CHARGE 1 (Q1)</h3>
          <label style={lblStyle}>CHARGE: {q1} µC</label>
          <input type="range" min={-20} max={20} step={1} value={q1} onChange={e => setQ1(+e.target.value)} style={{ width: "100%", marginBottom: "8px", accentColor: getColor(q1) }} />
          
          <label style={lblStyle}>POS X: {pos1.x.toFixed(1)}</label>
          <input type="range" min={-45} max={45} step={0.5} value={pos1.x} onChange={e => setPos1({...pos1, x: +e.target.value})} style={{ width: "100%", marginBottom: "8px", accentColor: getColor(q1) }} />
          
          <label style={lblStyle}>POS Z: {pos1.z.toFixed(1)}</label>
          <input type="range" min={-45} max={45} step={0.5} value={pos1.z} onChange={e => setPos1({...pos1, z: +e.target.value})} style={{ width: "100%", accentColor: getColor(q1) }} />
        </div>

        {/* CHARGE 2 */}
        <div style={cardStyle(getColor(q2))}>
          <h3 style={{ fontSize: "12px", margin: "0 0 8px 0", color: getColor(q2), fontWeight: "bold" }}>CHARGE 2 (Q2)</h3>
          <label style={lblStyle}>CHARGE: {q2} µC</label>
          <input type="range" min={-20} max={20} step={1} value={q2} onChange={e => setQ2(+e.target.value)} style={{ width: "100%", marginBottom: "8px", accentColor: getColor(q2) }} />
          
          <label style={lblStyle}>POS X: {pos2.x.toFixed(1)}</label>
          <input type="range" min={-45} max={45} step={0.5} value={pos2.x} onChange={e => setPos2({...pos2, x: +e.target.value})} style={{ width: "100%", marginBottom: "8px", accentColor: getColor(q2) }} />
          
          <label style={lblStyle}>POS Z: {pos2.z.toFixed(1)}</label>
          <input type="range" min={-45} max={45} step={0.5} value={pos2.z} onChange={e => setPos2({...pos2, z: +e.target.value})} style={{ width: "100%", accentColor: getColor(q2) }} />
        </div>

        {/* POINT P */}
        <div style={cardStyle('#9e9e9e')}>
          <h3 style={{ fontSize: "12px", margin: "0 0 8px 0", color: "#757575", fontWeight: "bold" }}>TEST POINT (P)</h3>
          <label style={lblStyle}>POS X: {posP.x.toFixed(1)}</label>
          <input type="range" min={-45} max={45} step={0.5} value={posP.x} onChange={e => setPosP({...posP, x: +e.target.value})} style={{ width: "100%", marginBottom: "8px", accentColor: "#9e9e9e" }} />
          
          <label style={lblStyle}>POS Z: {posP.z.toFixed(1)}</label>
          <input type="range" min={-45} max={45} step={0.5} value={posP.z} onChange={e => setPosP({...posP, z: +e.target.value})} style={{ width: "100%", accentColor: "#9e9e9e" }} />
        </div>

        {/* TELEMETRY */}
        <div style={{ ...cardStyle('#ffeb3b'), borderLeftColor: '#fbc02d', background: '#ffffff' }}>
          <h3 style={{ fontSize: "11px", margin: "0 0 8px 0", color: "#f57f17", fontWeight: "bold" }}>TELEMETRY</h3>
          
          <div style={{ marginBottom: "8px" }}>
            <div style={{ fontSize: "11px", fontWeight: "bold", color: "#333" }}>Distances</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "11px", color: "#555" }}>Q1 ↔ Q2:</span>
                <span style={{ fontSize: "11px", fontWeight: "bold", color: "#333" }}>{r12Dist.toFixed(1)} m</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "11px", color: "#555" }}>Q1 ↔ Point P:</span>
                <span style={{ fontSize: "11px", fontWeight: "bold", color: "#333" }}>{r1pDist.toFixed(1)} m</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "11px", color: "#555" }}>Q2 ↔ Point P:</span>
                <span style={{ fontSize: "11px", fontWeight: "bold", color: "#333" }}>{r2pDist.toFixed(1)} m</span>
              </div>
            </div>
          </div>

          <div style={{ borderTop: "1px solid #eee", paddingTop: "8px", marginBottom: "8px" }}>
            <div style={{ fontSize: "11px", fontWeight: "bold", color: "#333" }}>Force between Q1 & Q2</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
              <span style={{ fontSize: "12px", fontWeight: "bold", color: "#00e676" }}>|F|: {forceMag.toFixed(2)} N</span>
              <span style={{ fontSize: "11px", fontWeight: "bold", color: "#757575" }}>{q1 * q2 > 0 ? '(Repulsive)' : q1 * q2 < 0 ? '(Attractive)' : '(None)'}</span>
            </div>
          </div>

          <div style={{ borderTop: "1px solid #eee", paddingTop: "8px", marginBottom: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "11px", fontWeight: "bold", color: "#333" }}>E between charges</span>
              <span style={{ fontSize: "11px", fontWeight: "bold", color: "#ffb300" }}>{((e1on2Mag + e2on1Mag) / 2).toFixed(2)} N/C</span>
            </div>
          </div>

          <div style={{ borderTop: "1px solid #eee", paddingTop: "8px" }}>
            <div style={{ fontSize: "11px", fontWeight: "bold", color: "#333", marginBottom: "4px" }}>E-Field at Point P</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
              <span style={{ fontSize: "11px", color: getColor(q1) }}>E(Q1→P):</span>
              <span style={{ fontSize: "11px", fontWeight: "bold", color: getColor(q1) }}>{e1Mag.toFixed(2)} N/C</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
              <span style={{ fontSize: "11px", color: getColor(q2) }}>E(Q2→P):</span>
              <span style={{ fontSize: "11px", fontWeight: "bold", color: getColor(q2) }}>{e2Mag.toFixed(2)} N/C</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", paddingTop: "4px", borderTop: "1px dashed #eee" }}>
              <span style={{ fontSize: "12px", fontWeight: "bold", color: "#ffb300" }}>|E_net|:</span>
              <span style={{ fontSize: "12px", fontWeight: "bold", color: "#ffb300" }}>{eNetMag.toFixed(2)} N/C</span>
            </div>
          </div>
        </div>

      </div>
      )}
    </div>
  )
}
