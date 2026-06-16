import React, { useState, useEffect, useRef } from "react"
import { PlayIcon, PauseIcon, ResetIcon, SpeedIcon, LightBulbIcon } from './Icons'
import ClockScaler from './ClockScaler'
import * as THREE from "three"
import { Canvas, useFrame } from "@react-three/fiber"
import { Physics, useBox } from "@react-three/cannon"
import { OrbitControls, Text, Billboard } from "@react-three/drei"
import { getGroundTexture, getCubeTexture } from "./utils"
import SpotLightFixture from "./SpotLightFixture"

const Controls = ({ 
  mass1, setMass1, mass2, setMass2, 
  height1, setHeight1, height2, setHeight2,
  fluidDensity, setFluidDensity, scenario, setScenario, 
  gravity, setGravity,
  lightInt, setLightInt, 
  lightDir, setLightDir,
  lightPanelOpen, setLightPanelOpen,
  hasStarted, isPlaying, onPlayPause, onReset, times, running,
  speedPanelOpen, setSpeedPanelOpen,
  timeScale, setTimeScale
}) => {
  const finished = hasStarted && !running.r1 && (scenario === "1cube" || !running.r2);
  return (
  <>
  <div className="left-panel" style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10, fontFamily: 'sans-serif', color: '#333' }}>
    <div style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(6px)', padding: '20px', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid #eee', width: '285px' }}>
      <h3 style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#000', textAlign: 'center' }}>FREE FALL</h3>
      
      {/* SCENARIOS */}
      <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '6px', borderRadius: '8px', marginBottom: '8px' }}>
        <button onClick={() => !hasStarted && setScenario('1cube')} style={{
          flex: 1, padding: '6px 4px', border: 'none', background: scenario === '1cube' ? '#2563eb' : '#e2e8f0',
          color: scenario === '1cube' ? '#fff' : '#475569', fontWeight: 'bold', fontSize: '11px',
          cursor: hasStarted ? 'not-allowed' : 'pointer', transition: '0.2s', borderRadius: '6px'
        }}>
          1 Cube
        </button>
        <button onClick={() => !hasStarted && setScenario('2cubes')} style={{
          flex: 1, padding: '6px 4px', border: 'none', background: scenario === '2cubes' ? '#2563eb' : '#e2e8f0',
          color: scenario === '2cubes' ? '#fff' : '#475569', fontWeight: 'bold', fontSize: '11px',
          cursor: hasStarted ? 'not-allowed' : 'pointer', transition: '0.2s', borderRadius: '6px'
        }}>
          2 Cubes
        </button>
      </div>

      {/* 1. KÜP */}
      <div style={{ background: (hasStarted && !running.r1) ? '#e8f5e9' : '#f9f9f9', padding: '10px', borderRadius: '8px', border: (hasStarted && !running.r1) ? '2px solid #4caf50' : '2px solid transparent', transition: 'all 0.3s' }}>
        <label style={{ fontSize: '11px', color: '#d81b60', fontWeight: 'bold', display: 'block' }}>1. CUBE (PINK)</label>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginTop: '6px' }}><span>Mass: {mass1} kg</span></div>
        <input type="range" min="1" max="100" value={mass1} onChange={(e) => setMass1(Number(e.target.value))} disabled={hasStarted} style={{ width: '100%', margin: '4px 0' }} />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginTop: '6px' }}><span>Height: {height1} m</span></div>
        <input type="range" min="5" max="50" step="1" value={height1} onChange={(e) => setHeight1(Number(e.target.value))} disabled={hasStarted} style={{ width: '100%', margin: '4px 0 8px 0' }} />

        <div style={{ fontSize: (hasStarted && !running.r1) ? '14px' : '12px', fontWeight: 'bold', color: (hasStarted && !running.r1) ? '#2e7d32' : '#d81b60', textAlign: 'right' }}>
          Time: {times.t1.toFixed(3)} s
        </div>
      </div>

      {/* 2. KÜP */}
      {scenario === '2cubes' && (
      <div style={{ background: (hasStarted && !running.r2) ? '#e8f5e9' : '#f9f9f9', padding: '10px', borderRadius: '8px', border: (hasStarted && !running.r2) ? '2px solid #4caf50' : '2px solid transparent', transition: 'all 0.3s' }}>
        <label style={{ fontSize: '11px', color: '#00acc1', fontWeight: 'bold', display: 'block' }}>2. CUBE (BLUE)</label>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginTop: '6px' }}><span>Mass: {mass2} kg</span></div>
        <input type="range" min="1" max="100" value={mass2} onChange={(e) => setMass2(Number(e.target.value))} disabled={hasStarted} style={{ width: '100%', margin: '4px 0' }} />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginTop: '6px' }}><span>Height: {height2} m</span></div>
        <input type="range" min="5" max="50" step="1" value={height2} onChange={(e) => setHeight2(Number(e.target.value))} disabled={hasStarted} style={{ width: '100%', margin: '4px 0 8px 0' }} />

        <div style={{ fontSize: (hasStarted && !running.r2) ? '14px' : '12px', fontWeight: 'bold', color: (hasStarted && !running.r2) ? '#2e7d32' : '#00acc1', textAlign: 'right' }}>
          Time: {times.t2.toFixed(3)} s
        </div>
      </div>
      )}

      {/* SÜRTÜNME VE YERÇEKİMİ */}
      <div style={{ background: '#f9f9f9', padding: '10px', borderRadius: '8px' }}>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold' }}>GRAVITY: {gravity.toFixed(2)} m/s²</label>
        <div style={{ position: 'relative', margin: '8px 0 16px 0', paddingBottom: '15px' }}>
          <input type="range" min="0" max="25" step="0.01" value={gravity} onChange={(e) => setGravity(Number(e.target.value))} disabled={hasStarted} style={{ width: '100%' }} />
          <div style={{ position: 'absolute', top: '20px', left: `${(9.81 / 25) * 100}%`, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '2px', height: '4px', background: '#000000' }}></div>
            <span style={{ fontSize: '9px', color: '#000000', fontWeight: 'bold' }}>Earth (9.81)</span>
          </div>
        </div>

        <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginTop: '10px' }}>FLUID DENSITY (ρ): {fluidDensity.toFixed(3)} kg/m³</label>
        <div style={{ position: 'relative', margin: '8px 0 16px 0', paddingBottom: '15px' }}>
          <input type="range" min="0" max="5" step="0.005" value={fluidDensity} onChange={(e) => setFluidDensity(Number(e.target.value))} disabled={hasStarted} style={{ width: '100%' }} />
          <div style={{ position: 'absolute', top: '20px', left: `${(1.225 / 5) * 100}%`, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '2px', height: '4px', background: '#000000' }}></div>
            <span style={{ fontSize: '9px', color: '#000000', fontWeight: 'bold' }}>Air (1.22)</span>
          </div>
          <div style={{ position: 'absolute', top: '20px', left: `0%`, transform: 'translateX(0%)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '9px', color: '#666', fontWeight: 'bold', marginTop: '4px' }}>Vacuum</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  {/* Play/Pause Butonu */}
  <button
    onClick={onPlayPause}
    style={{
      position: 'absolute',
      top: '252px',
      right: '24px',
      zIndex: 1000,
      width: '48px',
      height: '48px',
      borderRadius: '14px',
      border: 'none',
      background: isPlaying ? '#ffffff' : 'rgba(15, 15, 20, 0.85)',
      backdropFilter: 'blur(12px)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
      transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
    }}
    title="Play / Pause"
  >
    {isPlaying ? <PauseIcon width={24} height={24} fill="#000000" /> : <PlayIcon width={24} height={24} fill="#ffffff" />}
  </button>

  {/* Reset Butonu */}
  <button
    onClick={onReset}
    style={{
      position: 'absolute',
      top: '310px',
      right: '24px',
      zIndex: 1000,
      width: '48px',
      height: '48px',
      borderRadius: '14px',
      border: 'none',
      background: 'rgba(15, 15, 20, 0.85)',
      backdropFilter: 'blur(12px)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
      transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
    }}
    title="Reset Simulation"
  >
    <ResetIcon width={24} height={24} fill="#ffffff" />
  </button>

  {/* Hız Kontrol (Slow Motion) Butonu */}
  <button
    onClick={() => setSpeedPanelOpen(!speedPanelOpen)}
    style={{
      position: 'absolute',
      top: '368px',
      right: '24px',
      zIndex: 1000,
      width: '48px',
      height: '48px',
      borderRadius: '14px',
      border: 'none',
      background: speedPanelOpen ? '#ffffff' : 'rgba(15, 15, 20, 0.85)',
      backdropFilter: 'blur(12px)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
      transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
    }}
    title="Time Speed"
  >
    <SpeedIcon width={24} height={24} fill={speedPanelOpen ? '#000000' : '#ffffff'} />
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

  {/* Işık Kontrol Butonu */}
  <button
    onClick={() => setLightPanelOpen(!lightPanelOpen)}
    style={{
      position: 'absolute',
      top: '194px',
      right: '24px',
      zIndex: 1000,
      width: '48px',
      height: '48px',
      borderRadius: '14px',
      border: 'none',
      background: lightPanelOpen ? '#ffffff' : 'rgba(15, 15, 20, 0.85)',
      backdropFilter: 'blur(12px)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
      transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
      fontSize: '22px',
    }}
    title="Light Controls"
  ><LightBulbIcon width={24} height={24} fill={lightPanelOpen ? "#000" : "#fff"} /></button>

  {lightPanelOpen && (
    <div style={{
      position: 'absolute',
      top: '194px',
      right: '82px',
      zIndex: 999,
      background: 'rgba(255,255,255,0.85)',
      backdropFilter: 'blur(8px)',
      padding: '16px',
      borderRadius: '12px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
      border: '1px solid #eee',
      width: '220px',
      fontFamily: 'sans-serif',
    }}>
      <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#333', textAlign: 'center' }}>LIGHT CONTROLS</h4>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>ANGLE: {lightDir}°</label>
      <input type="range" min="0" max="360" step="1" value={lightDir} onChange={e => setLightDir(Number(e.target.value))} style={{ width: '100%', marginBottom: '10px' }} />
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>INTENSITY: {lightInt.toFixed(1)}</label>
      <input type="range" min="0" max="3" step="0.1" value={lightInt} onChange={e => setLightInt(Number(e.target.value))} style={{ width: '100%' }} />
    </div>
  )}
  </>
)}

function HeightChart({ maxHeight }) {
  const lines = [];
  for (let i = 0; i <= maxHeight; i += 5) {
    lines.push(
      <group key={i} position={[0, i, -3]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[30, 0.05, 0.05]} />
          <meshBasicMaterial color="#ffff00" transparent opacity={0.3} />
        </mesh>
        <Billboard position={[-16, 0.5, 0]}>
          <Text fontSize={1.2} color="#ffff00" outlineWidth={0.05} outlineColor="black">
            {i}m
          </Text>
        </Billboard>
        <Billboard position={[16, 0.5, 0]}>
          <Text fontSize={1.2} color="#ffff00" outlineWidth={0.05} outlineColor="black">
            {i}m
          </Text>
        </Billboard>
      </group>
    );
  }
  return <group>{lines}</group>;
}

function Ground() {
  const [ref] = useBox(() => ({ type: "Static", args: [40, 1, 40], position: [0, -0.5, 0] }))
  
  const texture = React.useMemo(() => getGroundTexture(10, 10), []);

  return (
    <mesh ref={ref} receiveShadow>
      <boxGeometry args={[40, 1, 40]} />
      <meshStandardMaterial color="#ffffff" map={texture} />
    </mesh>
  )
}

function FallingCubeStatic({ position, mass, texture, size }) {
  return (
    <mesh position={position} castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color="white" map={texture} />
      <Text position={[0, 0, 1.01]} fontSize={0.5} color="white" fontWeight="bold" outlineWidth={0.07} outlineColor="black" anchorX="center" anchorY="middle">
        {`${mass} kg`}
      </Text>
      <Text position={[0, 0, -1.01]} rotation={[0, Math.PI, 0]} fontSize={0.5} color="white" fontWeight="bold">
        {`${mass} kg`}
      </Text>
    </mesh>
  )
}

function FallingCubePhysics({ position, color, mass, fluidDensity, onHit }) {
  const hasHit = useRef(false)
  const size = [2, 2, 2];
  const rawDamping = (fluidDensity * 2.0) / mass;
  const dampingValue = Math.max(0, Math.min(rawDamping, 0.99));
  const texture = React.useMemo(() => getCubeTexture(color), [color]);

  const [ref] = useBox(() => ({ 
    mass: mass, 
    position,
    args: size,
    linearDamping: dampingValue, 
    onCollide: () => {
      if (!hasHit.current) {
        hasHit.current = true
        onHit()
      }
    }
  }))

  return (
    <mesh ref={ref} castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color="white" map={texture} />
      <Text position={[0, 0, 1.01]} fontSize={0.5} color="white" fontWeight="bold" outlineWidth={0.07} outlineColor="black" anchorX="center" anchorY="middle">
        {`${mass} kg`}
      </Text>
      <Text position={[0, 0, -1.01]} rotation={[0, Math.PI, 0]} fontSize={0.5} color="white" fontWeight="bold">
        {`${mass} kg`}
      </Text>
    </mesh>
  )
}

function FallingCube({ position, color, mass, started, fluidDensity, onHit }) {
  const size = [2, 2, 2];
  const texture = React.useMemo(() => getCubeTexture(color), [color]);

  if (!started) {
    return <FallingCubeStatic position={position} mass={mass} texture={texture} size={size} />
  }
  return <FallingCubePhysics position={position} color={color} mass={mass} fluidDensity={fluidDensity} onHit={onHit} />
}

export default function App() {
  const [mass1, setMass1] = useState(5)
  const [mass2, setMass2] = useState(50)
  const [height1, setHeight1] = useState(25)
  const [height2, setHeight2] = useState(25)
  const [fluidDensity, setFluidDensity] = useState(1.225)
  const [scenario, setScenario] = useState("2cubes")
  const [gravity, setGravity] = useState(9.81)
  const [lightInt, setLightInt] = useState(2.5)
  const [lightDir, setLightDir] = useState(45)
  const [lightPanelOpen, setLightPanelOpen] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speedPanelOpen, setSpeedPanelOpen] = useState(false)
  const [timeScale, setTimeScale] = useState(1)
  const [times, setTimes] = useState({ t1: 0, t2: 0 })
  const [running, setRunning] = useState({ r1: false, r2: false })
  const [resetTrigger, setResetTrigger] = useState(0)

  const startTimeRef = useRef(0)

  const handlePlayPause = () => {
    if (!hasStarted) {
      startTimeRef.current = Date.now()
      setHasStarted(true)
      setIsPlaying(true)
      setRunning({ r1: true, r2: scenario === "2cubes" })
      setTimes({ t1: 0, t2: 0 })
    } else {
      setIsPlaying(!isPlaying)
    }
  }

  const resetSimulation = () => {
    setHasStarted(false)
    setIsPlaying(false)
    setRunning({ r1: false, r2: false })
    setTimes({ t1: 0, t2: 0 })
    setResetTrigger(prev => prev + 1)
  }

  useEffect(() => {
    let interval
    let lastTime = Date.now()
    if ((running.r1 || running.r2) && isPlaying) {
      interval = setInterval(() => {
        const now = Date.now()
        const dt = ((now - lastTime) / 1000) * timeScale
        lastTime = now
        setTimes(prev => ({
          t1: running.r1 ? prev.t1 + dt : prev.t1,
          t2: running.r2 ? prev.t2 + dt : prev.t2
        }))
      }, 10)
    }
    return () => clearInterval(interval)
  }, [running.r1, running.r2, isPlaying, timeScale])

  const lightRadius = 25
  const lightPos = [
    Math.sin((lightDir * Math.PI) / 180) * lightRadius,
    30,
    Math.cos((lightDir * Math.PI) / 180) * lightRadius,
  ]

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000000" }}>
      <Controls 
        mass1={mass1} setMass1={setMass1} mass2={mass2} setMass2={setMass2} 
        height1={height1} setHeight1={setHeight1} height2={height2} setHeight2={setHeight2}
        fluidDensity={fluidDensity} setFluidDensity={setFluidDensity} scenario={scenario} setScenario={setScenario}
        gravity={gravity} setGravity={setGravity}
        lightInt={lightInt} setLightInt={setLightInt}
        lightDir={lightDir} setLightDir={setLightDir}
        lightPanelOpen={lightPanelOpen} setLightPanelOpen={setLightPanelOpen}
        hasStarted={hasStarted} running={running} onPlayPause={handlePlayPause} onReset={resetSimulation}
        times={times} isPlaying={isPlaying}
        speedPanelOpen={speedPanelOpen} setSpeedPanelOpen={setSpeedPanelOpen}
        timeScale={timeScale} setTimeScale={setTimeScale}
      />
      
      <Canvas shadows camera={{ position: [30, 25, 30], fov: 35 }} style={{ background: "#000000" }}>
        <color attach="background" args={["#000000"]} />
        <ClockScaler timeScale={timeScale} />
        <ambientLight intensity={0.6} />
        
        <directionalLight 
          position={lightPos} 
          intensity={lightInt} 
          castShadow 
          shadow-camera-left={-25}
          shadow-camera-right={25}
          shadow-camera-top={50}
          shadow-camera-bottom={-25}
          shadow-camera-near={0.5}
          shadow-camera-far={120}
          shadow-mapSize={[2048, 2048]} 
        />
        
        <OrbitControls makeDefault />
        <SpotLightFixture lightPos={lightPos} intensity={lightInt} />
        
        <Physics isPaused={!isPlaying} gravity={[0, -gravity, 0]} key={resetTrigger}>
          <Ground />
          <HeightChart maxHeight={50} />
          {/* Küpler arası mesafe boyut büyüdüğü için biraz açıldı */}
          <FallingCube position={[scenario === "1cube" ? 0 : -5, height1, 0]} color="#d81b60" mass={mass1} started={hasStarted} fluidDensity={fluidDensity} onHit={() => setRunning(p => ({ ...p, r1: false }))} />
          {scenario === "2cubes" && <FallingCube position={[5, height2, 0]} color="#00acc1" mass={mass2} started={hasStarted} fluidDensity={fluidDensity} onHit={() => setRunning(p => ({ ...p, r2: false }))} />}
        </Physics>
      </Canvas>
    </div>
  )
}