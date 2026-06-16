import React, { useState, useRef, useEffect, useMemo } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls, Text, Billboard, Edges } from "@react-three/drei"
import * as THREE from "three"
import { PlayIcon, PauseIcon, ResetIcon, SpeedIcon, VectorIcon, LightBulbIcon, EyeIcon } from "./Icons"
import { getGroundTexture } from "./utils"
import SpotLightFixture from "./SpotLightFixture"

// ─── GÜNEŞ IŞIĞI ─────────────────────────────────────────────────────────────
function SunLight({ lightAngle, intensity }) {
  const lightRef = useRef()
  const { scene } = useThree()

  useEffect(() => {
    if (lightRef.current) {
      scene.add(lightRef.current.target)
      return () => {
        if (lightRef.current) scene.remove(lightRef.current.target)
      }
    }
  }, [scene])

  const rad = lightAngle * Math.PI / 180
  const lightX = Math.cos(rad) * 60
  const lightZ = Math.sin(rad) * 60

  useEffect(() => {
    if (lightRef.current) {
      lightRef.current.target.position.set(0, 0, 0)
      lightRef.current.target.updateMatrixWorld()
    }
  }, [lightAngle])

  return (
    <directionalLight
      ref={lightRef}
      position={[lightX, 60, lightZ]}
      intensity={intensity}
      castShadow
      shadow-camera-left={-150}
      shadow-camera-right={150}
      shadow-camera-top={150}
      shadow-camera-bottom={-150}
      shadow-camera-near={0.5}
      shadow-camera-far={200}
      shadow-mapSize={[2048, 2048]}
      shadow-bias={-0.001}
    />
  )
}

// ─── ZEMİN ───────────────────────────────────────────────────────────────────
function Ground() {
  const texture = useMemo(() => getGroundTexture(15, 15), [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.55, 0]}>
        <boxGeometry args={[200, 200, 1]} />
        <meshStandardMaterial color="#ffffff" map={texture} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[200, 200]} />
        <shadowMaterial opacity={0.4} />
      </mesh>
    </group>
  )
}

// ─── DUVARLAR ────────────────────────────────────────────────────────────────
const ARENA_HALF = 100
const WALL_HEIGHT = 4
const WALL_THICKNESS = 1

function Walls() {
  const wallColor = '#555555'
  const h = WALL_HEIGHT
  const half = ARENA_HALF
  const t = WALL_THICKNESS
  return (
    <group>
      <mesh position={[0, h / 2, half]} castShadow receiveShadow>
        <boxGeometry args={[half * 2 + t * 2, h, t]} />
        <meshStandardMaterial color={wallColor} metalness={0.3} roughness={0.7} />
      </mesh>
      <mesh position={[0, h / 2, -half]} castShadow receiveShadow>
        <boxGeometry args={[half * 2 + t * 2, h, t]} />
        <meshStandardMaterial color={wallColor} metalness={0.3} roughness={0.7} />
      </mesh>
      <mesh position={[-half, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[t, h, half * 2]} />
        <meshStandardMaterial color={wallColor} metalness={0.3} roughness={0.7} />
      </mesh>
      <mesh position={[half, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[t, h, half * 2]} />
        <meshStandardMaterial color={wallColor} metalness={0.3} roughness={0.7} />
      </mesh>
    </group>
  )
}

// ─── HIZ VEKTÖR OKU ──────────────────────────────────────────────────────────
function VelocityArrow({ posX, posZ, vx, vz, color, label, visible }) {
  if (!visible) return null;
  const speed = Math.sqrt(vx * vx + vz * vz)
  if (speed < 0.1) return null

  const angle = Math.atan2(-vz, vx)
  const length = Math.max(1.5, speed / 2)
  const headLength = Math.min(0.7, length * 0.22)
  const shaftLength = length - headLength

  return (
    <group position={[posX, 2.3, posZ]} rotation={[0, angle, 0]}>
      {/* Gövde */}
      <mesh position={[shaftLength / 2, 0, 0]}>
        <boxGeometry args={[shaftLength, 0.14, 0.14]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} toneMapped={false} />
      </mesh>
      {/* Ok ucu */}
      <mesh position={[shaftLength + headLength / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.28, headLength, 10]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} toneMapped={false} />
      </mesh>
      {/* Etiket */}
      <Billboard position={[length / 2 + 0.5, 1.2, 0]}>
        <Text fontSize={0.4} color="#ffffff" fontWeight="bold" outlineWidth={0.03} outlineColor="#000000">
          {label}
        </Text>
      </Billboard>
    </group>
  )
}

function Scene({ 
  isPlaying, timeScale, resetKey,
  posA, setPosA, vA, angleA,
  posB, setPosB, vB, angleB,
  showVectors, lightAngle, lightIntensity,
  cameraMode
}) {
  const { camera, gl } = useThree()
  const controlsRef = useRef()
  const draggingRef = useRef(null)
  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])

  const refA = useRef()
  const refB = useRef()

  const radA = (angleA * Math.PI) / 180;
  const radB = (angleB * Math.PI) / 180;

  const vecA = new THREE.Vector3(vA * Math.cos(radA), 0, -vA * Math.sin(radA));
  const vecB = new THREE.Vector3(vB * Math.cos(radB), 0, -vB * Math.sin(radB));
  const relVecAB = vecA.clone().sub(vecB);
  const relVecBA = vecB.clone().sub(vecA);

  const currentPosA = useRef(new THREE.Vector3(posA.x, 0, posA.z));
  const currentPosB = useRef(new THREE.Vector3(posB.x, 0, posB.z));
  
  const prevPosA = useRef(new THREE.Vector3(posA.x, 0, posA.z));
  const prevPosB = useRef(new THREE.Vector3(posB.x, 0, posB.z));

  const CUBE1_COLOR = '#ff6d00'
  const CUBE2_COLOR = '#76ff03'

  useEffect(() => {
    currentPosA.current.set(posA.x, 0, posA.z);
    currentPosB.current.set(posB.x, 0, posB.z);
    prevPosA.current.copy(currentPosA.current);
    prevPosB.current.copy(currentPosB.current);
    if (refA.current) refA.current.position.copy(currentPosA.current);
    if (refB.current) refB.current.position.copy(currentPosB.current);
  }, [resetKey, posA, posB])

  // Snap camera when mode changes or reset happens
  useEffect(() => {
    if (cameraMode === 'A') {
      const t = currentPosA.current;
      camera.position.set(t.x, t.y + 10, t.z + 22);
      if (controlsRef.current) controlsRef.current.target.copy(t);
    } else if (cameraMode === 'B') {
      const t = currentPosB.current;
      camera.position.set(t.x, t.y + 10, t.z + 22);
      if (controlsRef.current) controlsRef.current.target.copy(t);
    } else if (cameraMode === 'Free') {
      camera.position.set(0, 18, 38);
      if (controlsRef.current) controlsRef.current.target.set(0, 0, 0);
    }
  }, [cameraMode, camera, resetKey])

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

      const limit = 98
      const x = Math.max(-limit, Math.min(limit, pt.x))
      const z = Math.max(-limit, Math.min(limit, pt.z))

      if (draggingRef.current === 'A') setPosA({ x, z })
      else setPosB({ x, z })
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
  }, [camera, gl, setPosA, setPosB, groundPlane])

  const startDrag = (id) => (e) => {
    e.stopPropagation()
    draggingRef.current = id
    gl.domElement.style.cursor = 'grabbing'
    if (controlsRef.current) controlsRef.current.enabled = false
  }

  useFrame((state, delta) => {
    if (isPlaying) {
      const dt = Math.min(delta, 0.05) * timeScale;
      
      const wallLimit = 100 - 1 - 1; // ARENA_HALF - CUBE_HALF - WALL_THICKNESS
      
      const isPushingIntoWall = (pos, vec) => {
        if (pos.x >= wallLimit && vec.x > 0) return true;
        if (pos.x <= -wallLimit && vec.x < 0) return true;
        if (pos.z >= wallLimit && vec.z > 0) return true;
        if (pos.z <= -wallLimit && vec.z < 0) return true;
        return false;
      }
      
      const clampPos = (pos) => {
        pos.x = Math.max(-wallLimit, Math.min(wallLimit, pos.x));
        pos.z = Math.max(-wallLimit, Math.min(wallLimit, pos.z));
      }

      if (!isPushingIntoWall(currentPosA.current, vecA)) {
        currentPosA.current.addScaledVector(vecA, dt);
        clampPos(currentPosA.current);
      }
      
      if (!isPushingIntoWall(currentPosB.current, vecB)) {
        currentPosB.current.addScaledVector(vecB, dt);
        clampPos(currentPosB.current);
      }

      if (refA.current) refA.current.position.copy(currentPosA.current);
      if (refB.current) refB.current.position.copy(currentPosB.current);
    }

    if (cameraMode === 'A') {
      const offset = new THREE.Vector3().subVectors(currentPosA.current, prevPosA.current);
      state.camera.position.add(offset);
      if (controlsRef.current) controlsRef.current.target.copy(currentPosA.current);
    } else if (cameraMode === 'B') {
      const offset = new THREE.Vector3().subVectors(currentPosB.current, prevPosB.current);
      state.camera.position.add(offset);
      if (controlsRef.current) controlsRef.current.target.copy(currentPosB.current);
    }

    prevPosA.current.copy(currentPosA.current);
    prevPosB.current.copy(currentPosB.current);
  });

  return (
    <group>
      <ambientLight intensity={0.6} />
      <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.05} />
      <SunLight lightAngle={lightAngle} intensity={lightIntensity} />
      <SpotLightFixture 
        lightPos={[Math.cos(lightAngle * Math.PI / 180) * 60, 60, Math.sin(lightAngle * Math.PI / 180) * 60]} 
        intensity={lightIntensity * 0.5} 
        target={[0,0,0]} 
        color="#fff" 
        height={3} 
        radius={1} 
      />

      {/* GROUND GRID */}
      <Ground />
      <Walls />

      {/* OBJECT A (ORANGE) */}
      <group ref={refA}>
        <mesh position={[0, 1, 0]} castShadow onPointerDown={startDrag('A')}>
          <boxGeometry args={[2, 2, 2]} />
          <meshStandardMaterial 
            color={CUBE1_COLOR} 
            emissive={CUBE1_COLOR}
            emissiveIntensity={0.2}
            roughness={0.15} 
            metalness={0.6}
          />
          <Edges scale={1.02} threshold={15} color="black" opacity={0.8} transparent />
        </mesh>
        <Text position={[0, 2.5, 0]} fontSize={0.8} color="#ffffff" outlineWidth={0.05} outlineColor="#000000" fontWeight="bold">
          A
        </Text>
        
        {/* V_A Absolute */}
        <VelocityArrow 
          posX={0} posZ={0} 
          vx={vecA.x} vz={vecA.z} 
          color="#ffb74d" 
          label="vA" 
          visible={showVectors && vA > 0} 
        />

        {/* V_A/B (Velocity of A relative to B) - what B sees A doing */}
        <VelocityArrow 
          posX={0} posZ={0} 
          vx={relVecAB.x} vz={relVecAB.z} 
          color="#fff176" 
          label="V_AB" 
          visible={showVectors && relVecAB.length() > 0} 
        />
      </group>

      {/* OBJECT B (GREEN) */}
      <group ref={refB}>
        <mesh position={[0, 1, 0]} castShadow onPointerDown={startDrag('B')}>
          <boxGeometry args={[2, 2, 2]} />
          <meshStandardMaterial 
            color={CUBE2_COLOR} 
            emissive={CUBE2_COLOR}
            emissiveIntensity={0.2}
            roughness={0.15} 
            metalness={0.6}
          />
          <Edges scale={1.02} threshold={15} color="black" opacity={0.8} transparent />
        </mesh>
        <Text position={[0, 2.5, 0]} fontSize={0.8} color="#ffffff" outlineWidth={0.05} outlineColor="#000000" fontWeight="bold">
          B
        </Text>

        {/* V_B Absolute */}
        <VelocityArrow 
          posX={0} posZ={0} 
          vx={vecB.x} vz={vecB.z} 
          color="#b2ff59" 
          label="vB" 
          visible={showVectors && vB > 0} 
        />

        {/* V_B/A (Velocity of B relative to A) - what A sees B doing */}
        <VelocityArrow 
          posX={0} posZ={0} 
          vx={relVecBA.x} vz={relVecBA.z} 
          color="#e040fb" 
          label="V_BA" 
          visible={showVectors && relVecBA.length() > 0} 
        />
      </group>

    </group>
  );
}

export default function RelativeVelocity() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [timeScale, setTimeScale] = useState(1)
  const [speedPanelOpen, setSpeedPanelOpen] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const [showVectors, setShowVectors] = useState(true)
  const [uiVisible, setUiVisible] = useState(true)
  const [cameraMode, setCameraMode] = useState('Free')

  // Light controls
  const [lightPanelOpen, setLightPanelOpen] = useState(false)
  const [lightAngle, setLightAngle] = useState(45)
  const [lightIntensity, setLightIntensity] = useState(1.5)

  // Initial States
  const [posA, setPosA] = useState({ x: -10, z: 5 })
  const [vA, setVA] = useState(10)
  const [angleA, setAngleA] = useState(0) // degrees

  const [posB, setPosB] = useState({ x: -10, z: -5 })
  const [vB, setVB] = useState(15)
  const [angleB, setAngleB] = useState(45) // degrees

  const handleReset = () => {
    setIsPlaying(false)
    setResetKey(k => k + 1)
  }

  // Calculate live relative stats
  const radA = (angleA * Math.PI) / 180;
  const radB = (angleB * Math.PI) / 180;
  const vecA = { x: vA * Math.cos(radA), z: -vA * Math.sin(radA) };
  const vecB = { x: vB * Math.cos(radB), z: -vB * Math.sin(radB) };
  
  const relAB = { x: vecA.x - vecB.x, z: vecA.z - vecB.z };
  const vABMag = Math.sqrt(relAB.x**2 + relAB.z**2);
  const vABAng = (Math.atan2(-relAB.z, relAB.x) * 180 / Math.PI + 360) % 360;

  const relBA = { x: vecB.x - vecA.x, z: vecB.z - vecA.z };
  const vBAMag = Math.sqrt(relBA.x**2 + relBA.z**2);
  const vBAAng = (Math.atan2(-relBA.z, relBA.x) * 180 / Math.PI + 360) % 360;

  // UI Styles matching CollisionMomentum
  const panelStyle = {
    background: 'rgba(255,255,255,0.7)',
    backdropFilter: 'blur(6px)',
    padding: '20px',
    borderRadius: '12px',
    boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    border: '1px solid #eee',
    width: '285px',
    color: '#333',
    maxHeight: 'calc(100vh - 40px)',
    overflowY: 'auto',
    position: "absolute",
    left: "20px",
    top: "20px",
    zIndex: 10
  }

  const cardStyle = (color) => ({
    background: '#f9f9f9',
    padding: '10px',
    borderRadius: '8px',
    borderLeft: `4px solid ${color}`,
  })

  const lblStyle = {
    display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#333', marginBottom: 2, textTransform: "uppercase"
  }

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

  const inputStyle = { width: "100%", padding: "4px", borderRadius: "4px", border: "1px solid #ccc", fontSize: "12px", fontFamily: "sans-serif" }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#000000", fontFamily: "'Inter', sans-serif" }}>
      <Canvas shadows camera={{ position: [0, 18, 38], fov: 40 }} style={{ background: "#000000" }}>
        <color attach="background" args={["#000000"]} />

        <Scene 
          isPlaying={isPlaying} 
          timeScale={timeScale} 
          resetKey={resetKey}
          posA={posA} setPosA={setPosA} vA={vA} angleA={angleA}
          posB={posB} setPosB={setPosB} vB={vB} angleB={angleB}
          showVectors={showVectors}
          lightAngle={lightAngle}
          lightIntensity={lightIntensity}
          cameraMode={cameraMode}
        />
      </Canvas>

      {/* LEFT PANEL */}
      {uiVisible && (
      <div style={panelStyle} className="left-panel">
        <h2 style={{ fontSize: "16px", margin: "0 0 4px 0", color: "#1e293b", fontWeight: "800", textAlign: "center" }}>RELATIVE VELOCITY</h2>
        
        {/* CAMERA MODE IN PANEL */}
        <div style={{ background: "#f0f0f0", padding: "10px", borderRadius: "8px", border: "1px solid #ddd", display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ ...lblStyle, marginBottom: "4px" }}>CAMERA VIEW:</label>
          <div style={{ display: "flex", gap: "4px", justifyContent: "space-between" }}>
            {['Free', 'A', 'B'].map((mode) => (
              <button 
                key={mode}
                onClick={() => setCameraMode(mode)}
                style={{
                  flex: 1, padding: "6px 0", borderRadius: "4px", border: "none", cursor: "pointer",
                  background: cameraMode === mode ? (mode === 'A' ? '#ff6d00' : mode === 'B' ? '#76ff03' : '#333') : "#e0e0e0",
                  color: cameraMode === mode ? (mode === 'B' ? '#000' : '#fff') : "#555",
                  fontWeight: "bold", fontSize: "11px", transition: "all 0.2s"
                }}
              >
                {mode === 'Free' ? 'Free' : `Obj ${mode}`}
              </button>
            ))}
          </div>
        </div>
        
        {/* OBJECT A CONTROLS */}
        <div style={cardStyle('#ff6d00')}>
          <h3 style={{ fontSize: "12px", margin: "0 0 8px 0", color: "#ff6d00", fontWeight: "bold" }}>OBJECT A (ORANGE)</h3>
          <label style={lblStyle}>SPEED (V_A): {vA} m/s</label>
          <input type="range" min={0} max={30} step={1} value={vA} onChange={e => { setVA(+e.target.value); handleReset() }} style={{ width: "100%", marginBottom: "8px", accentColor: "#ff6d00" }} />
          
          <label style={lblStyle}>DIRECTION: {angleA}°</label>
          <input type="range" min={0} max={360} step={1} value={angleA} onChange={e => { setAngleA(+e.target.value); handleReset() }} style={{ width: "100%", marginBottom: "8px", accentColor: "#ff6d00" }} />
          
          <label style={lblStyle}>POS X: {posA.x.toFixed(1)}</label>
          <input type="range" min={-50} max={50} step={0.5} value={posA.x} onChange={e => { setPosA({...posA, x: +e.target.value}); handleReset() }} style={{ width: "100%", marginBottom: "8px", accentColor: "#ff6d00" }} />
          
          <label style={lblStyle}>POS Z: {posA.z.toFixed(1)}</label>
          <input type="range" min={-50} max={50} step={0.5} value={posA.z} onChange={e => { setPosA({...posA, z: +e.target.value}); handleReset() }} style={{ width: "100%", accentColor: "#ff6d00" }} />
        </div>

        {/* OBJECT B CONTROLS */}
        <div style={cardStyle('#76ff03')}>
          <h3 style={{ fontSize: "12px", margin: "0 0 8px 0", color: "#558b2f", fontWeight: "bold" }}>OBJECT B (GREEN)</h3>
          <label style={lblStyle}>SPEED (V_B): {vB} m/s</label>
          <input type="range" min={0} max={30} step={1} value={vB} onChange={e => { setVB(+e.target.value); handleReset() }} style={{ width: "100%", marginBottom: "8px", accentColor: "#76ff03" }} />
          
          <label style={lblStyle}>DIRECTION: {angleB}°</label>
          <input type="range" min={0} max={360} step={1} value={angleB} onChange={e => { setAngleB(+e.target.value); handleReset() }} style={{ width: "100%", marginBottom: "8px", accentColor: "#76ff03" }} />
          
          <label style={lblStyle}>POS X: {posB.x.toFixed(1)}</label>
          <input type="range" min={-50} max={50} step={0.5} value={posB.x} onChange={e => { setPosB({...posB, x: +e.target.value}); handleReset() }} style={{ width: "100%", marginBottom: "8px", accentColor: "#76ff03" }} />
          
          <label style={lblStyle}>POS Z: {posB.z.toFixed(1)}</label>
          <input type="range" min={-50} max={50} step={0.5} value={posB.z} onChange={e => { setPosB({...posB, z: +e.target.value}); handleReset() }} style={{ width: "100%", accentColor: "#76ff03" }} />
        </div>

        {/* TELEMETRY */}
        <div style={{ ...cardStyle('#9c27b0'), borderLeftColor: '#9c27b0', background: '#ffffff' }}>
          <h3 style={{ fontSize: "11px", margin: "0 0 8px 0", color: "#4a148c", fontWeight: "bold" }}>TELEMETRY</h3>
          
          <div style={{ marginBottom: "8px" }}>
            <div style={{ fontSize: "11px", fontWeight: "bold", color: "#6a1b9a" }}>V_AB (A relative to B)</div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", fontWeight: "bold", color: "#333" }}>|V|: {vABMag.toFixed(1)} m/s</span>
              <span style={{ fontSize: "12px", fontWeight: "bold", color: "#333" }}>θ: {vABAng.toFixed(1)}°</span>
            </div>
          </div>

          <div style={{ borderTop: "1px solid #ce93d8", paddingTop: "8px" }}>
            <div style={{ fontSize: "11px", fontWeight: "bold", color: "#6a1b9a" }}>V_BA (B relative to A)</div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", fontWeight: "bold", color: "#333" }}>|V|: {vBAMag.toFixed(1)} m/s</span>
              <span style={{ fontSize: "12px", fontWeight: "bold", color: "#333" }}>θ: {vBAAng.toFixed(1)}°</span>
            </div>
          </div>
        </div>

      </div>
      )}

      {/* RIGHT PANEL CONTROLS */}
      <button onClick={() => setLightPanelOpen(!lightPanelOpen)} style={{ ...iconBtnStyle(lightPanelOpen), position: "absolute", top: "194px", right: "24px", zIndex: 1000 }} title="Light Controls">
        <LightBulbIcon width={24} height={24} fill={lightPanelOpen ? "#000" : "#fff"} />
      </button>

      {lightPanelOpen && (
        <div style={{ position: 'absolute', top: '194px', right: '82px', zIndex: 999, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)', padding: '16px', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.2)', border: '1px solid #eee', width: '220px', fontFamily: 'sans-serif' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#333', textAlign: 'center' }}>LIGHT CONTROLS</h4>
          <label style={lblStyle}>ANGLE: {lightAngle}°</label>
          <input type="range" min="0" max="360" step="1" value={lightAngle} onChange={e => setLightAngle(Number(e.target.value))} style={{ width: '100%', marginBottom: '10px' }} />
          <label style={lblStyle}>INTENSITY: {lightIntensity.toFixed(1)}</label>
          <input type="range" min="0" max="3" step="0.1" value={lightIntensity} onChange={e => setLightIntensity(Number(e.target.value))} style={{ width: '100%' }} />
        </div>
      )}

      <button onClick={() => setIsPlaying(!isPlaying)} style={{ ...iconBtnStyle(isPlaying), position: "absolute", top: "252px", right: "24px", zIndex: 1000 }} title="Play / Pause">
        {isPlaying ? <PauseIcon width={24} height={24} fill="#000" /> : <PlayIcon width={24} height={24} fill="#fff" />}
      </button>

      <button onClick={handleReset} style={{ ...iconBtnStyle(false), position: "absolute", top: "310px", right: "24px", zIndex: 1000 }} title="Reset">
        <ResetIcon width={24} height={24} fill="#fff" />
      </button>

      <button onClick={() => setSpeedPanelOpen(!speedPanelOpen)} style={{ ...iconBtnStyle(speedPanelOpen), position: "absolute", top: "368px", right: "24px", zIndex: 1000 }} title="Time Speed">
        <SpeedIcon width={24} height={24} fill={speedPanelOpen ? "#000" : "#fff"} />
      </button>

      {speedPanelOpen && (
        <div style={{
          position: 'absolute',
          top: '368px',
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

      <button onClick={() => setShowVectors(!showVectors)} style={{ ...iconBtnStyle(!showVectors), position: "absolute", top: "426px", right: "24px", zIndex: 1000 }} title="Toggle Vectors">
        <VectorIcon width={24} height={24} fill={showVectors ? "#fff" : "#000"} />
      </button>
    </div>
  )
}
