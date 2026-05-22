import React, { useState, useEffect, useRef } from "react"
import * as THREE from "three"
import { Canvas } from "@react-three/fiber"
import { Physics, useBox } from "@react-three/cannon"
import { OrbitControls, Text } from "@react-three/drei"
import { getGroundTexture, getCubeTexture } from "./utils"

const Controls = ({ 
  mass1, setMass1, mass2, setMass2, 
  airRes, setAirRes, 
  lightInt, setLightInt, 
  lightDir, setLightDir,
  started, running, onStart, onReset, times 
}) => {
  const finished = started && !running.r1 && !running.r2;
  return (
  <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10, fontFamily: 'sans-serif', color: '#333' }}>
    <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid #eee', width: '280px' }}>
      <h3 style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#000', textAlign: 'center' }}>FREE FALL</h3>
      
      {/* 1. KÜP */}
      <div style={{ background: (started && !running.r1) ? '#e8f5e9' : '#f9f9f9', padding: '10px', borderRadius: '8px', border: (started && !running.r1) ? '2px solid #4caf50' : '2px solid transparent', transition: 'all 0.3s' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '11px', color: '#d81b60', fontWeight: 'bold' }}>1. CUBE (PINK): {mass1} kg</label>
        </div>
        <input type="range" min="1" max="100" value={mass1} onChange={(e) => setMass1(Number(e.target.value))} disabled={started} style={{ width: '100%', margin: '8px 0' }} />
        <div style={{ fontSize: (started && !running.r1) ? '14px' : '12px', fontWeight: 'bold', color: (started && !running.r1) ? '#2e7d32' : '#d81b60', textAlign: 'right' }}>
          Time: {times.t1.toFixed(3)} s
        </div>
      </div>

      {/* 2. KÜP */}
      <div style={{ background: (started && !running.r2) ? '#e8f5e9' : '#f9f9f9', padding: '10px', borderRadius: '8px', border: (started && !running.r2) ? '2px solid #4caf50' : '2px solid transparent', transition: 'all 0.3s' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '11px', color: '#00acc1', fontWeight: 'bold' }}>2. CUBE (BLUE): {mass2} kg</label>
        </div>
        <input type="range" min="1" max="100" value={mass2} onChange={(e) => setMass2(Number(e.target.value))} disabled={started} style={{ width: '100%', margin: '8px 0' }} />
        <div style={{ fontSize: (started && !running.r2) ? '14px' : '12px', fontWeight: 'bold', color: (started && !running.r2) ? '#2e7d32' : '#00acc1', textAlign: 'right' }}>
          Time: {times.t2.toFixed(3)} s
        </div>
      </div>

      {/* IŞIK VE SÜRTÜNME */}
      <div style={{ background: '#f9f9f9', padding: '10px', borderRadius: '8px' }}>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold' }}>LIGHT INTENSITY: {lightInt.toFixed(1)}</label>
        <input type="range" min="0" max="10" step="0.5" value={lightInt} onChange={(e) => setLightInt(Number(e.target.value))} style={{ width: '100%' }} />

        <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginTop: '10px' }}>LIGHT ANGLE: {lightDir}°</label>
        <input type="range" min="0" max="360" step="1" value={lightDir} onChange={(e) => setLightDir(Number(e.target.value))} style={{ width: '100%' }} />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
          <input type="checkbox" checked={airRes} onChange={(e) => setAirRes(e.target.checked)} disabled={started} id="air" />
          <label htmlFor="air" style={{ fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}>AIR RESISTANCE</label>
        </div>
      </div>

      {!started ? (
        <button onClick={onStart} style={{ padding: '14px', cursor: 'pointer', background: '#000', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>START</button>
      ) : (
        <button onClick={onReset} style={{ padding: '14px', cursor: 'pointer', background: '#eee', color: '#000', border: '1px solid #ddd', borderRadius: '8px', fontWeight: 'bold' }}>RESET</button>
      )}
    </div>
  </div>
)}

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

function FallingCube({ position, color, mass, started, airRes, onHit }) {
  const hasHit = useRef(false)
  const size = [2, 2, 2]; // Küpler büyütüldü

  // Hava sürtünmesi etkisi (Kütle arttıkça yavaşlama azalır)
  const dampingValue = airRes ? (1 - (mass / 101)) * 0.85 : 0;
  
  const texture = React.useMemo(() => getCubeTexture(color), [color]);

  const [ref] = useBox(() => ({ 
    mass: started ? mass : 0, 
    position,
    args: size,
    linearDamping: dampingValue, 
    onCollide: () => {
      if (!hasHit.current && started) {
        hasHit.current = true
        onHit()
      }
    }
  }), [started, airRes, mass])

  return (
    <mesh ref={ref} castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color="white" map={texture} />
      
      <Text
        position={[0, 0, 1.01]} 
        fontSize={0.5}
        color="white"
        fontWeight="bold"    // <--- Yazıyı kalınlaştırır
        outlineWidth={0.07}  // <--- Opsiyonel: Yazıyı daha da belirgin yapar
        outlineColor="black" // <--- Opsiyonel: Yazı etrafına ince siyah hat çeker
        anchorX="center"
        anchorY="middle"
      >
        {`${mass} kg`}
      </Text>
      
      <Text 
        position={[0, 0, -1.01]} 
        rotation={[0, Math.PI, 0]} 
        fontSize={0.5} 
        color="white"
        fontWeight="bold"    // <--- Arka yüzdeki yazıyı da kalınlaştırır
      >
        {`${mass} kg`}
      </Text>
    </mesh>
  )
}

export default function App() {
  const [mass1, setMass1] = useState(5)
  const [mass2, setMass2] = useState(50)
  const [airRes, setAirRes] = useState(true)
  const [lightInt, setLightInt] = useState(2.5)
  const [lightDir, setLightDir] = useState(45)
  const [started, setStarted] = useState(false)
  const [times, setTimes] = useState({ t1: 0, t2: 0 })
  const [running, setRunning] = useState({ r1: false, r2: false })
  
  const startTimeRef = useRef(0)

  const startSimulation = () => {
    startTimeRef.current = Date.now()
    setStarted(true)
    setRunning({ r1: true, r2: true })
    setTimes({ t1: 0, t2: 0 })
  }

  const resetSimulation = () => {
    setStarted(false)
    setRunning({ r1: false, r2: false })
    setTimes({ t1: 0, t2: 0 })
  }

  useEffect(() => {
    let interval
    if (running.r1 || running.r2) {
      interval = setInterval(() => {
        const totalElapsed = (Date.now() - startTimeRef.current) / 1000
        setTimes(prev => ({
          t1: running.r1 ? totalElapsed : prev.t1,
          t2: running.r2 ? totalElapsed : prev.t2
        }))
      }, 10)
    }
    return () => clearInterval(interval)
  }, [running.r1, running.r2])

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
        airRes={airRes} setAirRes={setAirRes}
        lightInt={lightInt} setLightInt={setLightInt}
        lightDir={lightDir} setLightDir={setLightDir}
        started={started} running={running} onStart={startSimulation} onReset={resetSimulation}
        times={times}
      />
      
      <Canvas shadows camera={{ position: [30, 25, 30], fov: 35 }} style={{ background: "#000000" }}>
        <color attach="background" args={["#000000"]} />
        <ambientLight intensity={0.6} />
        
        <directionalLight 
          position={lightPos} 
          intensity={lightInt} 
          castShadow 
          shadow-camera-left={-25}
          shadow-camera-right={25}
          shadow-camera-top={30}
          shadow-camera-bottom={-25}
          shadow-camera-near={0.5}
          shadow-camera-far={80}
          shadow-mapSize={[2048, 2048]} 
        />
        
        <OrbitControls makeDefault />
        
        <Physics gravity={[0, -9.81, 0]} key={started ? 'active' : 'idle'}>
          <Ground />
          {/* Küpler arası mesafe boyut büyüdüğü için biraz açıldı */}
          <FallingCube position={[-5, 25, 0]} color="#d81b60" mass={mass1} started={started} airRes={airRes} onHit={() => setRunning(p => ({ ...p, r1: false }))} />
          <FallingCube position={[5, 25, 0]} color="#00acc1" mass={mass2} started={started} airRes={airRes} onHit={() => setRunning(p => ({ ...p, r2: false }))} />
        </Physics>
      </Canvas>
    </div>
  )
}