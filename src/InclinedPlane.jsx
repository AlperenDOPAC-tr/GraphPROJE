import React, { useState, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import {
  Physics, RigidBody, CuboidCollider, BallCollider, useBeforePhysicsStep
} from "@react-three/rapier"
import { OrbitControls, Text, Billboard } from "@react-three/drei"

// ─── SABİTLER ──────────────────────────────────────────────────────────────
// Ramp açısı: tan(0.5) ≈ 0.546  →  max μ = 0.53 < 0.546  →  küp HERKESTE kayar
const RAMP_ANGLE = 0.5
const RAMP_POS   = [0, 7.2, 0]
const KUP_POS    = [-4, 12.6, -7.3]   // ramp yüzeyinin tam üstü
const KURE_POS   = [ 4, 12.6, -7.3]
const DT         = 1 / 60             // Rapier sabit fizik adımı (s)

// ─── ZEMİN ─────────────────────────────────────────────────────────────────
function Ground({ friction }) {
  return (
    <RigidBody type="fixed" colliders={false}>
      <mesh receiveShadow position={[0, -0.5, 0]}>
        <boxGeometry args={[60, 1, 60]} />
        <meshStandardMaterial color="#eeeeee" />
      </mesh>
      <CuboidCollider args={[30, 0.5, 30]} position={[0, -0.5, 0]}
                      friction={friction} restitution={0} />
    </RigidBody>
  )
}

// ─── RAMPA ─────────────────────────────────────────────────────────────────
function Ramp({ friction }) {
  return (
    <RigidBody type="fixed" colliders={false}
               rotation={[RAMP_ANGLE, 0, 0]} position={RAMP_POS}>
      <mesh receiveShadow castShadow>
        <boxGeometry args={[15, 0.5, 30]} />
        <meshStandardMaterial color="#444444" />
      </mesh>
      {/* Collider'a direkt sürtünme → Rapier bunu kesin uygular */}
      <CuboidCollider args={[7.5, 0.25, 15]} friction={friction} restitution={0} />
    </RigidBody>
  )
}

// ─── GÖRSEL CİSİM (BAŞLAT öncesi, fizik yok) ───────────────────────────────
function CompetitorVisual({ type, pos, color, name }) {
  return (
    <mesh position={pos} rotation={type === "box" ? [RAMP_ANGLE, 0, 0] : [0, 0, 0]} castShadow>
      {type === "box" ? <boxGeometry args={[2, 2, 2]} /> : <sphereGeometry args={[1, 32, 32]} />}
      <meshStandardMaterial color={color} />
      <Text position={[0, 0, 1.2]} fontSize={0.5} color="white"
            fontWeight="bold" outlineWidth={0.05} outlineColor="black">
        {name}
      </Text>
    </mesh>
  )
}

// ─── FİZİKSEL CİSİM (BAŞLAT sonrası, Rapier) ───────────────────────────────
function CompetitorPhysics({ type, pos, color, name, friction, distribution, mass }) {
  let massProps = undefined;

  if (type === "sphere") {
    // radius = 1
    const I_full = (2 / 5) * mass * 1 * 1; // 2.0
    const I_hollow = (2 / 3) * mass * 1 * 1; // 3.333...
    const I = distribution === "hollow" ? I_hollow : I_full;
    
    massProps = {
      mass: mass,
      centerOfMass: { x: 0, y: 0, z: 0 },
      principalAngularInertia: { x: I, y: I, z: I },
      angularInertiaLocalFrame: { w: 1, x: 0, y: 0, z: 0 }
    };
  } else {
    // For box, calculate standard inertia or just let Rapier handle it via mass prop
    // Actually, if we just supply mass={mass} it works, but since we can't mix mass and massProperties,
    // we'll conditionally pass mass or massProperties to RigidBody.
  }

  return (
    <RigidBody
      type="dynamic"
      colliders={false}
      mass={type === "box" ? mass : undefined}
      massProperties={type === "sphere" ? massProps : undefined}
      restitution={0}
      linearDamping={0}
      angularDamping={0}
      position={pos}
      rotation={type === "box" ? [RAMP_ANGLE, 0, 0] : [0, 0, 0]}
    >
      <mesh castShadow>
        {type === "box" ? <boxGeometry args={[2, 2, 2]} /> : <sphereGeometry args={[1, 32, 32]} />}
        <meshStandardMaterial color={color} />
        <Text position={[0, 0, 1.2]} fontSize={0.5} color="white"
              fontWeight="bold" outlineWidth={0.05} outlineColor="black">
          {name}
        </Text>
      </mesh>
      {/* Collider'a sürtünme → fizik temas hesabı doğru */}
      {type === "box"
        ? <CuboidCollider args={[1, 1, 1]} friction={friction} restitution={0} />
        : <BallCollider   args={[1]}       friction={friction} restitution={0} />}
    </RigidBody>
  )
}

// ─── BİTİŞ SENSÖRÜ (görünmez, geçişli) ────────────────────────────────────
function FinishSensor({ position, onHit }) {
  const hitRef = useRef(false)
  return (
    <RigidBody
      type="fixed"
      sensor                         // Rapier: fiziksel temas YOK, sadece tespit
      position={position}
      rotation={[RAMP_ANGLE, 0, 0]}  // Bitiş çizgisi rampa açısına dik olacak şekilde eğildi
      onIntersectionEnter={() => {   // Herhangi bir dinamik cisim girince tetikle
        if (!hitRef.current) { hitRef.current = true; onHit() }
      }}
    >
      <CuboidCollider args={[4, 8, 0.4]} />
    </RigidBody>
  )
}

// ─── FİZİK SAATI ────────────────────────────────────────────────────────────
// useBeforePhysicsStep: Rapier her sabit adımdan ÖNCE çağırır.
// DT = 1/60 s → stepRef * DT = geçen fizik süresi (deterministik, kare hızından bağımsız).
function PhysicsClock({ started, onTick }) {
  const stepRef = useRef(0)

  // Ref'leri render'da güncelle → stale closure yok
  const startedRef = useRef(started); startedRef.current = started
  const onTickRef  = useRef(onTick);  onTickRef.current  = onTick

  useBeforePhysicsStep(() => {
    if (startedRef.current) stepRef.current++
  })

  useFrame(() => {
    if (startedRef.current) {
      onTickRef.current(stepRef.current * DT)
    }
  })

  return null
}

// ─── AÇI GÖSTERGESİ ──────────────────────────────────────────────────────────
function AngleIndicator({ side }) {
  const x = side === "left" ? -8 : 8;
  const pos = [x, 0, 13.16]
  
  // Yazıyı yaydan dışarı almak için X ekseninde ötele (sol için daha sola, sağ için daha sağa)
  const textX = side === "left" ? -1.5 : 1.5;
  
  return (
    <group position={pos}>
      {/* Yatay çizgi (X=0, Z=-1.5'e uzanır) */}
      <mesh position={[0, 0.05, -1.5]}>
        <boxGeometry args={[0.1, 0.1, 3]} />
        <meshBasicMaterial color="#ffc107" />
      </mesh>
      
      {/* Rampa çizgisi */}
      <group rotation={[RAMP_ANGLE, 0, 0]}>
        <mesh position={[0, 0.05, -1.5]}>
          <boxGeometry args={[0.1, 0.1, 3]} />
          <meshBasicMaterial color="#ffc107" />
        </mesh>
      </group>

      {/* Açı Yayı (Arc) */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[1.5, 1.6, 32, 1, 0, RAMP_ANGLE]} />
        <meshBasicMaterial color="#ffc107" side={2} />
      </mesh>

      {/* Metin (Kameraya her zaman dönük olması için Billboard kullanıyoruz) */}
      <Billboard position={[textX, 0.8, -1.0]}>
        <Text fontSize={0.8} color="#ffc107" outlineWidth={0.05} outlineColor="black" fontWeight="bold">
          {(RAMP_ANGLE * 180 / Math.PI).toFixed(1)}°
        </Text>
      </Billboard>
    </group>
  )
}

// ─── CANVAS İÇİ SAHNE ──────────────────────────────────────────────────────
function Scene({ friction, distribution, realWorldMode, mass1, mass2, started, onFinish, onTick }) {
  // Küp kaydığı için gerçek dünyada statik sürtünme yerine daha düşük olan kinetik sürtünmeye maruz kalır.
  // Küre ise yuvarlandığı için kayma yapmaz ve statik tutunma (yüksek sürtünme) ile çalışır.
  const boxFriction = realWorldMode ? friction * 0.6 : friction;

  return (
    <>
      <PhysicsClock started={started} onTick={onTick} />
      <Ground friction={friction} />
      <Ramp   friction={friction} />
      <AngleIndicator side="left" />
      <AngleIndicator side="right" />

      {/* Görsel kırmızı bitiş çizgisi */}
      <mesh position={[0, 0.4, 14]} rotation={[RAMP_ANGLE, 0, 0]}>
        <boxGeometry args={[20, 0.1, 0.5]} />
        <meshStandardMaterial color="red" />
      </mesh>

      {!started ? (
        /* BAŞLAT öncesi: saf görsel */
        <>
          <CompetitorVisual type="box"    pos={KUP_POS}  color="hotpink" name="CUBE"  />
          <CompetitorVisual type="sphere" pos={KURE_POS} color="cyan"    name="SPHERE" />
        </>
      ) : (
        /* Simülasyon aktif: Rapier fizik + sensörler */
        <>
          <CompetitorPhysics type="box"    pos={KUP_POS}  color="hotpink" name="CUBE"  friction={boxFriction} mass={mass1} />
          <CompetitorPhysics type="sphere" pos={KURE_POS} color="cyan"    name="SPHERE" friction={friction} distribution={distribution} mass={mass2} />
          <FinishSensor position={[-4, 6, 14]} onHit={() => onFinish("CUBE")}  />
          <FinishSensor position={[ 4, 6, 14]} onHit={() => onFinish("SPHERE")} />
        </>
      )}
    </>
  )
}

// ─── ANA BİLEŞEN ───────────────────────────────────────────────────────────
export default function InclinedPlane() {
  const [started,  setStarted]  = useState(false)
  const [friction, setFriction] = useState(0.05)
  const [distribution, setDistribution] = useState("full")
  const [realWorldMode, setRealWorldMode] = useState(true)
  const [mass1,    setMass1]    = useState(5)
  const [mass2,    setMass2]    = useState(5)
  const [lightAngle, setLightAngle] = useState(45)
  const [lightIntensity, setLightIntensity] = useState(1.5)
  const [times,    setTimes]    = useState({ t1: 0, t2: 0 })
  const [finished, setFinished] = useState({ f1: false, f2: false })

  const lightRad = (lightAngle * Math.PI) / 180;
  const lightPos = [Math.cos(lightRad) * 30, 30, Math.sin(lightRad) * 30];

  const r1Running = useRef(false)
  const r2Running = useRef(false)

  const handleStart = () => {
    setTimes({ t1: 0, t2: 0 })
    setFinished({ f1: false, f2: false })
    r1Running.current = true
    r2Running.current = true
    setStarted(true)
    // Timer PhysicsClock tarafından ilk adımda başlatılır
  }

  const handleReset = () => {
    r1Running.current = false
    r2Running.current = false
    setStarted(false)
    setFinished({ f1: false, f2: false })
    setTimes({ t1: 0, t2: 0 })
  }

  // PhysicsClock her frame bu fonksiyonu çağırır
  const handleTick = (elapsed) => {
    setTimes(prev => ({
      t1: r1Running.current ? elapsed : prev.t1,
      t2: r2Running.current ? elapsed : prev.t2,
    }))
  }

  const handleFinish = (name) => {
    if (name === "CUBE")  { r1Running.current = false; setFinished(p => ({ ...p, f1: true })) }
    if (name === "SPHERE") { r2Running.current = false; setFinished(p => ({ ...p, f2: true })) }
  }

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", background: "#000000" }}>

      {/* KONTROL PANELİ */}
      <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10, fontFamily: 'sans-serif' }}>
        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid #eee', width: '285px', color: '#333' }}>
          <h3 style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#000', textAlign: 'center' }}>INCLINED PLANE</h3>

          <div style={{ background: '#f9f9f9', padding: '10px', borderRadius: '8px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
              FRICTION COEFFICIENT (μ): {friction.toFixed(2)}
            </label>
            <input type="range" min="0" max="0.50" step="0.01"
              value={friction} onChange={e => setFriction(Number(e.target.value))}
              disabled={started} style={{ width: '100%' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#999', marginTop: '2px' }}>
              <span>Slippery (μ=0)</span><span>Rough (μ=0.50)</span>
            </div>
            
            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #ddd', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input type="checkbox" id="realWorld" checked={realWorldMode} 
                     onChange={e => setRealWorldMode(e.target.checked)} disabled={started} />
              <label htmlFor="realWorld" style={{ fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                Real World (Kinetic Friction)
              </label>
            </div>
          </div>

          {/* IŞIK AYARLARI */}
          <div style={{ background: '#f5f5f5', padding: '10px', borderRadius: '8px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px', color: '#333' }}>
              LIGHT ANGLE: {lightAngle}°
            </label>
            <input type="range" min="0" max="360" value={lightAngle} onChange={e => setLightAngle(Number(e.target.value))} style={{ width: '100%' }} />
            
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', margin: '8px 0 4px 0', color: '#333' }}>
              LIGHT INTENSITY: {lightIntensity.toFixed(1)}
            </label>
            <input type="range" min="0" max="3" step="0.1" value={lightIntensity} onChange={e => setLightIntensity(Number(e.target.value))} style={{ width: '100%' }} />
          </div>

          {/* KÜP */}
          <div style={{ background: finished.f1 ? '#e8f5e9' : '#f9f9f9', padding: '10px', borderRadius: '8px', border: finished.f1 ? '2px solid #4caf50' : '2px solid transparent', transition: 'all 0.3s', marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '11px', color: '#d81b60', fontWeight: 'bold' }}>CUBE (PINK): {mass1} kg</label>
            </div>
            <input type="range" min="1" max="100" value={mass1}
              onChange={e => setMass1(Number(e.target.value))} disabled={started} style={{ width: '100%' }} />
            <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>Only slides.</div>
            <div style={{ fontSize: finished.f1 ? '18px' : '13px', fontWeight: 'bold', color: finished.f1 ? '#2e7d32' : '#333', transition: 'all 0.3s', marginTop: '8px' }}>
              {times.t1.toFixed(3)} s
            </div>
          </div>

          {/* KÜRE */}
          <div style={{ background: finished.f2 ? '#e8f5e9' : '#f9f9f9', padding: '10px', borderRadius: '8px', border: finished.f2 ? '2px solid #4caf50' : '2px solid transparent', transition: 'all 0.3s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '11px', color: '#00acc1', fontWeight: 'bold' }}>SPHERE (BLUE): {mass2} kg</label>
            </div>
            <input type="range" min="1" max="100" value={mass2}
              onChange={e => setMass2(Number(e.target.value))} disabled={started} style={{ width: '100%' }} />
            <select 
              value={distribution} 
              onChange={e => setDistribution(e.target.value)} 
              disabled={started}
              style={{ 
                width: '100%', 
                marginTop: '8px', 
                padding: '6px 8px', 
                fontSize: '11px',
                fontWeight: 'bold',
                borderRadius: '6px', 
                border: '1px solid #ccc', 
                background: '#fff', 
                color: '#333',
                cursor: started ? 'not-allowed' : 'pointer',
                outline: 'none',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <option value="full">Solid Sphere (Spins fast)</option>
              <option value="hollow">Hollow Sphere (Spins slow)</option>
            </select>
            <div style={{ fontSize: finished.f2 ? '18px' : '13px', fontWeight: 'bold', color: finished.f2 ? '#2e7d32' : '#333', transition: 'all 0.3s', marginTop: '8px' }}>
              {times.t2.toFixed(3)} s
            </div>
          </div>

          {!started ? (
            <button onClick={handleStart} style={{ padding: '14px', cursor: 'pointer', background: '#000', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>START</button>
          ) : (
            <button onClick={handleReset} style={{ padding: '14px', cursor: 'pointer', background: '#eee', color: '#000', border: '1px solid #ddd', borderRadius: '8px', fontWeight: 'bold' }}>RESET</button>
          )}
        </div>
      </div>

      <Canvas shadows camera={{ position: [30, 20, 30], fov: 35 }} style={{ background: "#000000" }}>
        <color attach="background" args={["#000000"]} />
        <ambientLight intensity={0.6} />
        <directionalLight
          position={lightPos} intensity={lightIntensity} castShadow
          shadow-camera-left={-30} shadow-camera-right={30}
          shadow-camera-top={30}  shadow-camera-bottom={-30}
          shadow-camera-near={0.5} shadow-camera-far={100}
          shadow-mapSize={[2048, 2048]}
        />
        <gridHelper args={[60, 60, "#444444", "#222222"]} position={[0, 0.01, 0]} />
        <OrbitControls makeDefault />

        {/*
          key: her yeni simülasyon için Physics tamamen sıfırlanır
          timeStep: 1/60 s sabit → Rapier deterministik çalışır
        */}
        <Physics
          key={started ? 'active' : 'idle'}
          gravity={[0, -9.81, 0]}
          timeStep={DT}
        >
          <Scene
            friction={friction}
            distribution={distribution}
            realWorldMode={realWorldMode}
            mass1={mass1}
            mass2={mass2}
            started={started}
            onFinish={handleFinish}
            onTick={handleTick}
          />
        </Physics>
      </Canvas>
    </div>
  )
}