import React, { useState, useRef, useMemo, useEffect } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, Text } from "@react-three/drei"
import * as THREE from "three"
import { PlayIcon, PauseIcon, ResetIcon, LightBulbIcon } from "./Icons"

// ─── PHYSICS CONSTANTS ───────────────────────────────────────────────────────
const HC = 1240 // nm * eV
const METALS = {
  "Sodium (Na)": { phi: 2.28, color: "#cbd5e1" },
  "Zinc (Zn)": { phi: 4.30, color: "#94a3b8" },
  "Platinum (Pt)": { phi: 6.35, color: "#f8fafc" },
}

// ─── HELPER: Wavelength to RGB ───────────────────────────────────────────────
function wavelengthToColor(wl) {
  let R, G, B;
  if (wl < 380) { R = 0.6; G = 0.0; B = 1.0; } // Deep Violet for UV
  else if (wl >= 380 && wl < 440) { R = -(wl - 440) / (440 - 380); G = 0.0; B = 1.0; }
  else if (wl >= 440 && wl < 490) { R = 0.0; G = (wl - 440) / (490 - 440); B = 1.0; }
  else if (wl >= 490 && wl < 510) { R = 0.0; G = 1.0; B = -(wl - 510) / (510 - 490); }
  else if (wl >= 510 && wl < 580) { R = (wl - 510) / (580 - 510); G = 1.0; B = 0.0; }
  else if (wl >= 580 && wl < 645) { R = 1.0; G = -(wl - 645) / (645 - 580); B = 0.0; }
  else if (wl >= 645 && wl <= 780) { R = 1.0; G = 0.0; B = 0.0; }
  else { R = 0.5; G = 0.0; B = 0.0; } // Deep Red for IR

  const factor = wl < 400 ? 0.7 : (wl > 700 ? 0.7 : 1.0);
  return new THREE.Color(R * factor, G * factor, B * factor);
}

// ─── 3D COMPONENTS ───────────────────────────────────────────────────────────

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
    <mesh position={[0, -4, 0]} receiveShadow>
      <boxGeometry args={[60, 1, 60]} />
      <meshStandardMaterial map={tex} roughness={0.8} metalness={0.1} />
    </mesh>
  )
}

function BatteryAndWires({ voltage, current }) {
  const battX = 0, battY = -2.5, battH = 2.0;
  const wireThick = 0.08;
  const cx = -1.5, ax = 1.5; // Cathode and Anode X positions

  const leftWire = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cx, 0, 0),
      new THREE.Vector3(cx, battY, 0),
      new THREE.Vector3(battX - 0.5, battY, 0)
    ])
    return new THREE.TubeGeometry(curve, 20, wireThick, 8, false)
  }, [cx, battX, battY])

  const rightWire = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(ax, 0, 0),
      new THREE.Vector3(ax, battY, 0),
      new THREE.Vector3(battX + 0.5, battY, 0)
    ])
    return new THREE.TubeGeometry(curve, 20, wireThick, 8, false)
  }, [ax, battX, battY])

  return (
    <group>
      <mesh geometry={leftWire} castShadow><meshStandardMaterial color="#1e293b" metalness={0.5} /></mesh>
      <mesh geometry={rightWire} castShadow><meshStandardMaterial color="#dc2626" metalness={0.5} /></mesh>

      <mesh position={[battX, battY, 0]} castShadow>
        <boxGeometry args={[2.0, 1.0, 1.0]} />
        <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.3} />
      </mesh>
      
      {/* Terminals */}
      <mesh position={[battX - 1.0, battY, 0]}><boxGeometry args={[0.2, 0.4, 0.4]} /><meshStandardMaterial color="#64748b" /></mesh>
      <mesh position={[battX + 1.0, battY, 0]}><boxGeometry args={[0.2, 0.4, 0.4]} /><meshStandardMaterial color="#ef4444" /></mesh>

      {/* 3D Ammeter on the right wire */}
      <group position={[1.5, battY, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.8, 0.6, 0.6]} />
          <meshStandardMaterial color="#0f172a" metalness={0.4} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0, 0.31]}>
          <boxGeometry args={[0.6, 0.4, 0.05]} />
          <meshBasicMaterial color="#e2e8f0" />
        </mesh>
        <Text position={[0, 0.05, 0.34]} fontSize={0.12} color="#000" anchorX="center" anchorY="middle" fontWeight="bold">
          μA
        </Text>
        <Text position={[0, -0.08, 0.34]} fontSize={0.15} color="#dc2626" anchorX="center" anchorY="middle" fontWeight="bold">
          {current > 0 ? (current * 10).toFixed(2) : "0.00"}
        </Text>
      </group>

      <Text position={[battX, battY, 0.55]} fontSize={0.4} color="#fff" anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#000">
        {voltage.toFixed(1)} V
      </Text>
      <Text position={[battX - 0.7, battY, 0.55]} fontSize={0.4} color="#fff" anchorX="center" anchorY="middle">-</Text>
      <Text position={[battX + 0.7, battY, 0.55]} fontSize={0.4} color="#ef4444" anchorX="center" anchorY="middle">+</Text>
    </group>
  )
}

function Photons({ isPlaying, wavelength, intensity, timeScale }) {
  const meshRef = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const photons = useRef([])
  
  const color = useMemo(() => wavelengthToColor(wavelength), [wavelength])
  const count = Math.floor(intensity)
  const speed = 8.0 // fast light
  
  useMemo(() => {
    photons.current = []
    for(let i=0; i < count; i++) {
      photons.current.push({
        x: Math.random() * 2.9, // local X from nozzle (2.9) to cathode (0)
        y: (Math.random() - 0.5) * 1.5,
        z: (Math.random() - 0.5) * 1.5,
      })
    }
  }, [count])

  useFrame((_, delta) => {
    if (!meshRef.current) return
    const dt = isPlaying ? delta * timeScale : 0
    photons.current.forEach((p, i) => {
      if (isPlaying) {
        p.x -= speed * dt
        if (p.x < 0) {
          p.x = 2.9 // Nozzle tip
          p.y = (Math.random() - 0.5) * 1.5
          p.z = (Math.random() - 0.5) * 1.5
        }
      }
      dummy.position.set(p.x, p.y, p.z)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <sphereGeometry args={[0.06, 8, 8]} />
      <meshBasicMaterial color={color} />
    </instancedMesh>
  )
}

function Electrons({ isPlaying, kMax, voltage, intensity, timeScale }) {
  const meshRef = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const electrons = useRef([])
  
  // if kMax <= 0, no electrons emitted
  const emits = kMax > 0
  const count = emits ? Math.floor(intensity) : 0
  
  useMemo(() => {
    electrons.current = []
    for(let i=0; i < count; i++) {
      electrons.current.push({
        x: -1.5 + Math.random() * 3,
        y: (Math.random() - 0.5) * 1.2,
        z: (Math.random() - 0.5) * 1.2,
        v: Math.max(0.5, Math.sqrt(Math.max(0, kMax)) * 2.0),
        delay: 0
      })
    }
  }, [count, kMax])

  useFrame((_, delta) => {
    if (!meshRef.current) return
    const dt = isPlaying ? delta * timeScale : 0
    
    electrons.current.forEach((p, i) => {
      if (isPlaying) {
        if (p.delay > 0) {
          p.delay -= dt;
          dummy.position.set(-100, 0, 0); // hide
        } else {
          // Accelerate. V is the total voltage drop. Distance is 3 units (-1.5 to 1.5)
          const a = voltage * 2.0; 
          p.v += a * dt;
          
          // Initial emission speed at cathode:
          if (p.x === -1.5) {
            p.v = Math.max(0.5, Math.sqrt(kMax) * 2.0); // Baseline speed based on K_max
          }
          
          p.x += p.v * dt;
          
          // Kinetic energy check (stopping potential logic):
          // If it stops and reverses:
          if (p.v < 0 && p.x <= -1.5) {
            // Re-absorbed by cathode
            p.x = -1.5;
            p.delay = Math.random() * 0.5;
          }
          
          // Hit the anode:
          if (p.x >= 1.5) {
            p.x = -1.5;
            p.v = Math.max(0.5, Math.sqrt(kMax) * 2.0);
            p.y = (Math.random() - 0.5) * 1.2;
            p.z = (Math.random() - 0.5) * 1.2;
            p.delay = Math.random() * 0.8; // Random delay to create a continuous stream
          }
          
          dummy.position.set(p.x, p.y, p.z)
        }
      } else {
        dummy.position.set(p.x, p.y, p.z)
      }
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  if (count === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <sphereGeometry args={[0.06, 8, 8]} />
      <meshBasicMaterial color="#38bdf8" />
    </instancedMesh>
  )
}

function Flashlight({ wavelength }) {
  const color = useMemo(() => wavelengthToColor(wavelength), [wavelength])
  return (
    <group position={[4, 0, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.6, 0.8, 2, 32]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[-1.05, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.6, 0.6, 0.1, 32]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <pointLight position={[-1, 0, 0]} color={color} intensity={2} distance={10} />
    </group>
  )
}

function VacuumTube() {
  return (
    <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0]}>
      <cylinderGeometry args={[1.8, 1.8, 5.0, 32]} />
      <meshStandardMaterial color="#cbd5e1" transparent opacity={0.15} metalness={0.9} roughness={0.0} depthWrite={false} />
    </mesh>
  )
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function PhotoelectricSim() {
  const [isPlaying, setIsPlaying] = useState(true)
  const [resetTrigger, setResetTrigger] = useState(0)

  // 3D Environment Light Controls
  const [lightPanelOpen, setLightPanelOpen] = useState(false)
  const [lightDir, setLightDir] = useState(135)
  const [lightInt, setLightInt] = useState(1.5)

  const [wavelength, setWavelength] = useState(400) // nm
  const [intensity, setIntensity] = useState(50) // 0 to 100
  const [metalName, setMetalName] = useState("Sodium (Na)")
  const [voltage, setVoltage] = useState(0.0) // -10V to 10V
  const [timeScale, setTimeScale] = useState(1.0)

  // Physics Calculations
  const metal = METALS[metalName]
  const photonE = HC / wavelength // eV
  const kMax = photonE - metal.phi // eV
  const freq14 = (3000 / wavelength).toFixed(2) // in 10^14 Hz
  
  // Calculate if electrons reach anode
  const reachesAnode = kMax > 0 && (voltage >= 0 || kMax + voltage > 0)
  
  // Current logic: proportional to intensity, 0 if it doesn't reach.
  const current = reachesAnode ? (intensity / 100) * Math.min(1.0, 1.0 + voltage/10) : 0

  const handleReset = () => { 
    setIsPlaying(false)
    setResetTrigger(p => p + 1)
    setWavelength(400)
    setIntensity(50)
    setVoltage(0.0)
    setMetalName("Sodium (Na)")
  }

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
  const lblSt = { display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }
  const cardSt = { background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }
  
  const iconBtnBase = {
    position: 'absolute', right: '24px', zIndex: 1000,
    width: '48px', height: '48px', borderRadius: '14px', border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
  }

  const statValSt = { fontSize: '18px', fontWeight: 900, color: '#0f172a' }
  const statUnitSt = { fontSize: '11px', color: '#64748b', marginLeft: '4px' }

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", background: "#050505" }}>
      
      {/* LEFT PANEL */}
      <div className="left-panel" style={panelSt}>
        <h2 style={titleSt}>PHOTOELECTRIC EFFECT</h2>

        <div style={{ ...cardSt, borderLeft: '4px solid #f59e0b' }}>
          <label style={lblSt}>WAVELENGTH: {wavelength} nm</label>
          <input type="range" min={200} max={750} step={5} value={wavelength}
            onChange={e => setWavelength(+e.target.value)} style={{ width: '100%', marginBottom: 12 }} />
          
          <label style={lblSt}>INTENSITY: {intensity}%</label>
          <input type="range" min={0} max={100} step={1} value={intensity}
            onChange={e => setIntensity(+e.target.value)} style={{ width: '100%' }} />
        </div>

        <div style={{ ...cardSt, borderLeft: '4px solid #3b82f6' }}>
          <label style={lblSt}>BATTERY VOLTAGE: {voltage.toFixed(1)} V</label>
          <input type="range" min={-10} max={10} step={0.1} value={voltage}
            onChange={e => setVoltage(+e.target.value)} style={{ width: '100%' }} />
        </div>

        <div style={{ ...cardSt, borderLeft: '4px solid #10b981' }}>
          <label style={lblSt}>CATHODE METAL</label>
          <select value={metalName} onChange={e => setMetalName(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', fontFamily: 'inherit', fontWeight: 'bold' }}>
            {Object.keys(METALS).map(m => (
              <option key={m} value={m}>{m} (Φ = {METALS[m].phi} eV)</option>
            ))}
          </select>
        </div>

        {/* INFO PANEL */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div style={{ ...cardSt, padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', marginBottom: 2 }}>FREQUENCY (f)</div>
            <div style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>{freq14}<span style={statUnitSt}>x10¹⁴ Hz</span></div>
          </div>
          <div style={{ ...cardSt, padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', marginBottom: 2 }}>PHOTON ENERGY</div>
            <div style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>{photonE.toFixed(2)}<span style={statUnitSt}>eV</span></div>
          </div>
          <div style={{ ...cardSt, padding: '10px', textAlign: 'center', gridColumn: 'span 2' }}>
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', marginBottom: 2 }}>MAX KINETIC ENERGY (Ek)</div>
            <div style={{ ...statValSt, color: kMax > 0 ? '#10b981' : '#ef4444' }}>
              {kMax > 0 ? kMax.toFixed(2) : "0.00"}<span style={statUnitSt}>eV</span>
            </div>
          </div>
        </div>
        
        <div style={{ ...cardSt, padding: '16px', background: current > 0 ? 'rgba(59, 130, 246, 0.1)' : '#f8fafc', border: `1px solid ${current > 0 ? '#93c5fd' : '#e2e8f0'}`, textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: '#333', fontWeight: 'bold', marginBottom: 4 }}>PHOTOELECTRIC CURRENT</div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: current > 0 ? '#2563eb' : '#94a3b8' }}>
            {current > 0 ? (current * 10).toFixed(2) : "0.00"}<span style={{ fontSize: '14px', marginLeft: 4 }}>µA</span>
          </div>
        </div>
      </div>

      {/* RIGHT BUTTONS */}
      <button onClick={() => setLightPanelOpen(!lightPanelOpen)}
        style={{ ...iconBtnBase, top: '194px', background: lightPanelOpen ? '#ffffff' : 'rgba(15,15,20,0.85)' }} title="Light Controls">
        <LightBulbIcon fill={lightPanelOpen ? "#000" : "#fff"} />
      </button>
      {lightPanelOpen && (
        <div style={{ position: "absolute", top: "194px", right: "82px", zIndex: 999,
          background: "rgba(255,255,255,0.85)", backdropFilter: "blur(8px)",
          padding: "16px", borderRadius: "12px", boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
          border: "1px solid #eee", width: "220px", fontFamily: "sans-serif" }}>
          <h4 style={{ margin: "0 0 10px 0", fontSize: "12px", color: "#333", textAlign: "center" }}>LIGHT CONTROLS</h4>
          <label style={lblSt}>ANGLE: {lightDir}°</label>
          <input type="range" min="0" max="360" step="1" value={lightDir} onChange={e => setLightDir(+e.target.value)} style={{ width: "100%", marginBottom: "10px" }} />
          <label style={lblSt}>INTENSITY: {lightInt.toFixed(1)}</label>
          <input type="range" min="0" max="3" step="0.1" value={lightInt} onChange={e => setLightInt(+e.target.value)} style={{ width: "100%" }} />
        </div>
      )}

      <button onClick={() => setIsPlaying(!isPlaying)}
        style={{ ...iconBtnBase, top: '252px', background: isPlaying ? '#ffffff' : 'rgba(15,15,20,0.85)' }}>
        {isPlaying ? <PauseIcon fill="#000" /> : <PlayIcon fill="#fff" />}
      </button>

      <button onClick={handleReset} style={{ ...iconBtnBase, top: '310px', background: 'rgba(15,15,20,0.85)' }}>
        <ResetIcon fill="#fff" />
      </button>

      <Canvas shadows camera={{ position: [0, 1, 9], fov: 45 }}>
        <color attach="background" args={["#050505"]} />
        <ambientLight intensity={0.7} />
        <directionalLight 
          position={[Math.cos((lightDir * Math.PI) / 180) * 20, 10, Math.sin((lightDir * Math.PI) / 180) * 20]} 
          intensity={lightInt} 
          castShadow 
        />

        <CheckerGround />
        
        <group position={[0, 1, 0]}>
          <VacuumTube />
          
          {/* Light Source Angled from Top Right */}
          <group position={[-1.5, 0, 0]} rotation={[0, 0, Math.PI / 4]}>
            <Flashlight wavelength={wavelength} />
            <Photons key={`photons-${resetTrigger}`} isPlaying={isPlaying} wavelength={wavelength} intensity={intensity} timeScale={timeScale} />
          </group>
          
          {/* Cathode */}
          <mesh position={[-1.5, 0, 0]} castShadow>
            <boxGeometry args={[0.2, 2, 2]} />
            <meshStandardMaterial color={metal.color} metalness={0.2} roughness={0.4} />
          </mesh>
          <Text position={[-2.5, 1.8, 0]} fontSize={0.3} color="#fff" anchorX="center" anchorY="middle">Cathode</Text>

          {/* Anode */}
          <mesh position={[1.5, 0, 0]} castShadow>
            <boxGeometry args={[0.2, 2, 2]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.2} roughness={0.4} />
          </mesh>
          <Text position={[2.5, 1.8, 0]} fontSize={0.3} color="#fff" anchorX="center" anchorY="middle">Anode</Text>
          
          <BatteryAndWires voltage={voltage} current={current} />
          
          <Electrons key={`electrons-${resetTrigger}`} isPlaying={isPlaying} kMax={kMax} voltage={voltage} intensity={intensity} timeScale={timeScale} />
        </group>

        <OrbitControls makeDefault />
      </Canvas>
    </div>
  )
}
