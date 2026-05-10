import React, { useState, useRef, useEffect } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Physics, useBox, useSphere } from "@react-three/cannon"
import { OrbitControls, Text } from "@react-three/drei"

// --- 1. FİZİKSEL BİLEŞENLER ---

function Ground() {
  const [ref] = useBox(() => ({ type: "Static", args: [60, 1, 60], position: [0, -0.5, 0] }))
  return (
    <mesh ref={ref} receiveShadow>
      <boxGeometry args={[60, 1, 60]} />
      <meshStandardMaterial color="#f0f0f0" />
    </mesh>
  )
}

function Ramp({ position, friction }) {
  const args = [15, 0.5, 30]
  const rotation = [0.4, 0, 0]
  useBox(() => ({ 
    type: "Static", args, rotation, position,
    material: { friction, restitution: 0 }
  }), [friction])

  return (
    <mesh rotation={rotation} position={position} receiveShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial color="#999" />
    </mesh>
  )
}

function Competitor({ type, pos, color, name, started, friction, mass, onFinish }) {
  const args = type === "box" ? [2, 2, 2] : [1]
  const isFinished = useRef(false) // Tek seferlik tetikleme için
  
  const [ref] = (type === "box" ? useBox : useSphere)(() => ({
    mass: started ? mass : 0,
    position: pos,
    args,
    rotation: type === "box" ? [0.4, 0, 0] : [0, 0, 0],
    material: { friction, restitution: 0 },
  }), [started, friction, mass])

  // HER KAREDE KONTROL ET
  useFrame(() => {
    if (started && !isFinished.current && ref.current) {
      // Z pozisyonu 13.5'i geçtiği an durdur (Bitiş Z=14'te)
      if (ref.current.position.z >= 13.5) {
        isFinished.current = true;
        onFinish(name);
        console.log(`${name} BİTİŞE VARDI!`); // Kontrol için konsola yazar
      }
    }
  })

  // Sıfırla dendiğinde kontrolü aç
  useEffect(() => {
    if (!started) isFinished.current = false;
  }, [started])

  return (
    <mesh ref={ref} castShadow>
      {type === "box" ? <boxGeometry args={args} /> : <sphereGeometry args={[1, 32, 32]} />}
      <meshStandardMaterial color={isFinished.current ? "#4CAF50" : color} />
      <Text position={[0, 0, 1.2]} fontSize={0.5} color="white" fontWeight="bold" outlineWidth={0.05} outlineColor="black">
        {name}
      </Text>
    </mesh>
  )
}

// --- 2. ANA EĞİK DÜZLEM ORTAMI ---

export default function InclinedPlane() {
  const [started, setStarted] = useState(false)
  const [friction, setFriction] = useState(0.1)
  const [mass1, setMass1] = useState(5)
  const [mass2, setMass2] = useState(5)
  
  const [times, setTimes] = useState({ t1: 0, t2: 0 })
  const [running, setRunning] = useState({ r1: false, r2: false })
  const startTimeRef = useRef(0)

  const handleStart = () => {
    setTimes({ t1: 0, t2: 0 })
    setRunning({ r1: true, r2: true })
    startTimeRef.current = Date.now()
    setStarted(true)
  }

  const handleReset = () => {
    setStarted(false)
    setRunning({ r1: false, r2: false })
    setTimes({ t1: 0, t2: 0 })
    startTimeRef.current = 0
  }

  const handleFinish = (name) => {
    if (name === "KÜP") setRunning(p => ({ ...p, r1: false }));
    if (name === "KÜRE") setRunning(p => ({ ...p, r2: false }));
  }

  useEffect(() => {
    let interval;
    if (running.r1 || running.r2) {
      interval = setInterval(() => {
        const delta = (Date.now() - startTimeRef.current) / 1000
        setTimes(prev => ({
          t1: running.r1 ? delta : prev.t1,
          t2: running.r2 ? delta : prev.t2
        }))
      }, 20)
    }
    return () => clearInterval(interval)
  }, [running.r1, running.r2]) // Sadece r1 veya r2 değişince interval'i güncelle

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      
      <div style={{ 
        position: 'absolute', top: '80px', left: '20px', zIndex: 10, 
        background: 'white', padding: '20px', borderRadius: '12px', 
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)', width: '250px', fontFamily: 'sans-serif'
      }}>
        <h3 style={{ margin: '0 0 10px 0', textAlign: 'center' }}>Rampa Testi</h3>

        <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Sürtünme: {friction.toFixed(2)}</label>
        <input type="range" min="0" max="1" step="0.01" value={friction} onChange={e => setFriction(Number(e.target.value))} disabled={started} style={{ width: '100%', marginBottom: '10px' }} />

        <div style={{ padding: '8px', background: '#fce4ec', borderRadius: '8px', marginBottom: '8px' }}>
          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#d81b60' }}>Küp: {mass1}kg</label>
          <input type="range" min="1" max="100" value={mass1} onChange={e => setMass1(Number(e.target.value))} disabled={started} style={{ width: '100%' }} />
          <div style={{ fontSize: '15px', fontWeight: 'bold' }}>{times.t1.toFixed(2)} sn</div>
        </div>

        <div style={{ padding: '8px', background: '#e0f7fa', borderRadius: '8px', marginBottom: '15px' }}>
          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#00acc1' }}>Küre: {mass2}kg</label>
          <input type="range" min="1" max="100" value={mass2} onChange={e => setMass2(Number(e.target.value))} disabled={started} style={{ width: '100%' }} />
          <div style={{ fontSize: '15px', fontWeight: 'bold' }}>{times.t2.toFixed(2)} sn</div>
        </div>

        <button onClick={started ? handleReset : handleStart} style={{ 
          width: '100%', padding: '12px', cursor: 'pointer', 
          background: started ? '#f44336' : '#222', color: 'white', 
          border: 'none', borderRadius: '8px', fontWeight: 'bold' 
        }}>
          {started ? "SIFIRLA" : "BAŞLAT"}
        </button>
      </div>

      <Canvas shadows camera={{ position: [30, 20, 30], fov: 35 }}>
        <color attach="background" args={["#ffffff"]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 30, 10]} intensity={1.5} castShadow />
        <OrbitControls makeDefault />

        <Physics gravity={[0, -9.81, 0]} key={started ? 'active' : 'idle'}>
          <Ground />
          <Ramp position={[0, 6, 0]} friction={friction} />
          
          {/* Bitiş Hattı (Görsel) */}
          <mesh position={[0, 0.4, 14]}>
            <boxGeometry args={[20, 0.1, 0.5]} />
            <meshStandardMaterial color="red" />
          </mesh>
          
          <Competitor type="box" name="KÜP" color="hotpink" pos={[-4, 11.58, -10]} friction={friction} mass={mass1} started={started} onFinish={handleFinish} />
          <Competitor type="sphere" name="KÜRE" color="cyan" pos={[4, 11.58, -10]} friction={friction} mass={mass2} started={started} onFinish={handleFinish} />
        </Physics>
      </Canvas>
    </div>
  )
}