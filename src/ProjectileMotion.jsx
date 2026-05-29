import React, { useState, useRef } from "react"
import * as THREE from "three"
import { Canvas, useFrame } from "@react-three/fiber"
import { Physics, RigidBody, CuboidCollider, BallCollider, useBeforePhysicsStep } from "@react-three/rapier"
import { OrbitControls, Text, Billboard, Line } from "@react-three/drei"
import { getGroundTexture, getSphereTexture, getTowerTexture } from "./utils"

// ─── ZEMİN ─────────────────────────────────────────────────────────────────
function Ground() {


  // Kulenin sol ucu X: -27'de. Zemin buradan başlayıp 300 birim sağa gidecek. Merkez: 123
  const texture = React.useMemo(() => getGroundTexture(50, 10), []);

  return (
    <RigidBody name="ground" type="fixed" colliders={false}>
      <mesh receiveShadow position={[123, -0.5, 0]}>
        <boxGeometry args={[300, 1, 40]} />
        <meshStandardMaterial color="#ffffff" map={texture} />
      </mesh>
      <CuboidCollider args={[150, 0.5, 20]} position={[123, -0.5, 0]} />
    </RigidBody>
  )
}

// ─── FİZİK SAATİ ────────────────────────────────────────────────────────────
const DT = 1 / 60;
function PhysicsClock({ started, onTick }) {
  const stepRef = useRef(0)
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

// ─── KULE ──────────────────────────────────────────────────────────────────
function Tower({ height, position }) {
  if (height <= 0) return null;
  const texture = React.useMemo(() => getTowerTexture(), []);
  return (
    <RigidBody type="fixed" colliders={false} position={position}>
      <mesh receiveShadow castShadow position={[0, height / 2, 0]}>
        <boxGeometry args={[4, height, 4]} />
        <meshStandardMaterial color="white" map={texture} />
      </mesh>
      <CuboidCollider args={[2, height / 2, 2]} position={[0, height / 2, 0]} />
    </RigidBody>
  )
}

// ─── ANALİTİK ÇİZELGE (RULER) ──────────────────────────────────────────────
function HeightChart({ maxHeight }) {
  const lines = [];
  // Her 5 metrede bir çizgi
  for (let i = 0; i <= maxHeight; i += 5) {
    lines.push(
      <group key={i} position={[0, i, 0]}>
        <mesh position={[20, 0, -10]}>
          <boxGeometry args={[60, 0.1, 0.1]} />
          <meshBasicMaterial color="#ffff00" transparent opacity={0.3} />
        </mesh>
        <Billboard position={[-12, 0.5, -10]}>
          <Text fontSize={2} color="#ffff00" outlineWidth={0.1} outlineColor="black">
            {i}m
          </Text>
        </Billboard>
      </group>
    );
  }

  return <group>{lines}</group>;
}

// ─── YATAY MESAFE ÇİZELGESİ (RULER) ─────────────────────────────────────────
function DistanceChart({ maxDistance, startX }) {
  const lines = [];
  // Her 10 metrede bir çizgi
  for (let i = 0; i <= maxDistance; i += 10) {
    lines.push(
      <group key={i} position={[startX + i, 0.1, 0]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.1, 0.1, 40]} />
          <meshBasicMaterial color="#00ff00" transparent opacity={0.3} />
        </mesh>
        <Billboard position={[0, 0.5, 20]}>
          <Text fontSize={2} color="#00ff00" outlineWidth={0.1} outlineColor="black">
            {i}m
          </Text>
        </Billboard>
      </group>
    );
  }
  return <group>{lines}</group>;
}

// ─── ATIŞ OKU (GÖRSEL) ──────────────────────────────────────────────────────
function LaunchArrow({ angle, velocity }) {
  if (velocity === 0) return null;
  const rad = (angle * Math.PI) / 180;
  // Hızla orantılı bir uzunluk, çok uzun veya çok kısa olmasın
  const length = Math.max(3, velocity / 2.5);
  
  return (
    <group rotation={[0, 0, rad]}>
      {/* Çubuk (X ekseni boyunca) */}
      <mesh position={[length / 2, 0, 0]}>
        <boxGeometry args={[length, 0.2, 0.2]} />
        <meshBasicMaterial color="#ff0044" />
      </mesh>
      {/* Okun ucu */}
      <mesh position={[length, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.6, 1.2, 8]} />
        <meshBasicMaterial color="#ff0044" />
      </mesh>
    </group>
  )
}

// ─── KÜRE (ATIŞ CİSMİ) ─────────────────────────────────────────────────────
function ProjectileSphere({ position, velocity, angle, started, mass, onHit, onProgress, finished }) {
  const bodyRef = useRef(null)
  const lastVel = useRef(0)
  const lastVy = useRef(0)
  const maxH = useRef(0)
  const lastPointTime = useRef(0)
  const frameCount = useRef(0)
  
  // reset maxH on new start
  React.useEffect(() => {
    if (started) {
      maxH.current = 0;
      lastPointTime.current = 0;
      frameCount.current = 0;
    }
  }, [started]);
  
  // started state değiştiğinde, eğer started=true ise hızı uygula
  React.useEffect(() => {
    if (started && bodyRef.current) {
      const rad = (angle * Math.PI) / 180;
      const vx = velocity * Math.cos(rad);
      const vy = velocity * Math.sin(rad);
      // Rapier'de doğrudan hızı ayarlayabiliriz
      bodyRef.current.setLinvel({ x: vx, y: vy, z: 0 }, true);
    }
  }, [started, velocity, angle]);

  // Her frame'de hızı takip et (çarpmadan hemen önceki hızı yakalamak için)
  useFrame((state) => {
    if (started && !finished && bodyRef.current) {
      frameCount.current++;
      const v = bodyRef.current.linvel();
      let speed = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
      
      // Rapier motoru "fixed" konumdan "dynamic" konuma geçerken ilk birkaç frame hızı 0 verebilir.
      // Bu durumu yakalayıp ilk hızı (velocity) atayarak enerji barlarındaki sıçramayı engelliyoruz.
      if (frameCount.current < 5 && speed < 0.1) {
        speed = velocity;
      }

      lastVel.current = speed;
      lastVy.current = v.y; // Sadece düşüşte olduğunu anlamak için Y hızını da kaydedelim
      
      const posX = bodyRef.current.translation().x;
      const posY = bodyRef.current.translation().y;
      
      const dist = Math.max(0, posX - (-23));
      // Yükseklik: Cismin merkezi Y ekseninde, yarıçap 1 olduğu için yerden yüksekliği Y - 1'dir.
      const currentHeight = Math.max(0, posY - 1);
      
      if (currentHeight > maxH.current) {
        maxH.current = currentHeight;
      }
      
      if (onProgress) {
        // Saniyede ~20 nokta (50ms'de bir) iz için kayıt alalım
        let newPoint = null;
        const now = state.clock.getElapsedTime();
        if (now - lastPointTime.current > 0.05) {
          newPoint = [posX, bodyRef.current.translation().y, bodyRef.current.translation().z];
          lastPointTime.current = now;
        }
        
        onProgress(speed, dist, currentHeight, maxH.current, newPoint);
      }
    }
  });

  // mass properties (basit küre)
  const radius = 1;
  const I = (2 / 5) * mass * radius * radius;
  const massProps = {
    mass: mass,
    centerOfMass: { x: 0, y: 0, z: 0 },
    principalAngularInertia: { x: I, y: I, z: I },
    angularInertiaLocalFrame: { w: 1, x: 0, y: 0, z: 0 }
  };

  const texture = React.useMemo(() => getSphereTexture("cyan"), []);

  return (
    <RigidBody
      ref={bodyRef}
      type={started ? "dynamic" : "fixed"} // Başlayana kadar havada sabit kalsın
      colliders={false}
      position={position}
      massProperties={massProps}
      restitution={0.5} // Biraz seksin
      linearDamping={0} // Enerji korunumunun kusursuz olması için hava sürtünmesini (damping) sıfırlıyoruz
      angularDamping={0}
      onCollisionEnter={() => {
        if (started && !finished && bodyRef.current) {
          const posY = bodyRef.current.translation().y;
          // Yere çarptığını anlamak için hem Y pozisyonu düşük olmalı
          // hem de cisim AŞAĞI doğru düşüyor olmalı (Y hızı negatif olmalı)
          // Bu sayede yerden fırlatıldığında anında durması engellenir
          if (posY < 2 && lastVy.current < -0.1) {
            // Mesafe = Mevcut X - Başlangıç X (-23)
            const posX = bodyRef.current.translation().x;
            const distance = Math.max(0, posX - (-23));
            onHit(lastVel.current, distance, maxH.current);
          }
        }
      }}
    >
      <mesh castShadow>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial color="white" map={texture} />
      </mesh>
      {/* Başlamadan önce fırlatma yönünü gösteren ok */}
      {!started && <LaunchArrow angle={angle} velocity={velocity} />}
      <BallCollider args={[radius]} />
    </RigidBody>
  )
}

// ─── ANA BİLEŞEN ───────────────────────────────────────────────────────────
export default function ProjectileMotion() {
  const [started, setStarted] = useState(false)
  const [towerHeight, setTowerHeight] = useState(20)
  const [velocity, setVelocity] = useState(15)
  const [angle, setAngle] = useState(0)
  const [mass, setMass] = useState(5)
  
  // Işık ayarları
  const [lightAngle, setLightAngle] = useState(45)
  const [lightIntensity, setLightIntensity] = useState(1.5)
  
  // İzleme state'leri
  const [elapsed, setElapsed] = useState(0)
  const [finalVel, setFinalVel] = useState(0)
  const [finalDist, setFinalDist] = useState(0)
  const [currentHeight, setCurrentHeight] = useState(towerHeight)
  const [maxHeight, setMaxHeight] = useState(towerHeight)
  const [finished, setFinished] = useState(false)
  const runningRef = useRef(false)
  
  // İzleme: Yörünge İzi (Trail)
  const [trails, setTrails] = useState([]) // Tüm eski izler
  const [currentTrail, setCurrentTrail] = useState([]) // O anki canlı uçuş izi
  const currentTrailRef = useRef([])

  // Reset işlemi için benzersiz anahtar
  const [simKey, setSimKey] = useState(0)

  const handleStart = () => {
    setElapsed(0)
    setFinalVel(velocity) // Set explicitly to avoid 0 before first frame
    setFinalDist(0)
    setCurrentHeight(towerHeight)
    setMaxHeight(towerHeight)
    setFinished(false)
    runningRef.current = true
    
    // İz sıfırlama (mevcut uçuş için)
    currentTrailRef.current = [[towerX + 2, towerHeight + 1, 0]]; // Başlangıç noktası
    setCurrentTrail([[towerX + 2, towerHeight + 1, 0]]);
    
    setStarted(true)

    // Eğer yerden (kule 0) ve yatay (açı 0) atılıyorsa, top havalanamayacağı için uçuş anında biter
    if (towerHeight === 0 && angle === 0) {
      setTimeout(() => {
        handleHit(velocity, 0, 0);
      }, 50); // UI'ın güncellenmesi için ufak bir gecikme
    }
  }

  const handleReset = () => {
    setStarted(false)
    runningRef.current = false
    setElapsed(0)
    setFinalVel(velocity) // Reset explicitly
    setFinalDist(0)
    setCurrentHeight(towerHeight)
    setMaxHeight(towerHeight)
    setFinished(false)
    setCurrentTrail([])
    currentTrailRef.current = []
    setSimKey(prev => prev + 1) // Physics evrenini sıfırlar
  }

  const handleClearTrails = () => {
    setTrails([]);
    setCurrentTrail([]);
    currentTrailRef.current = [];
  }

  const handleTick = (time) => {
    if (runningRef.current) {
      setElapsed(time)
    }
  }

  const handleProgress = (speed, dist, curHeight, maxH, newPoint) => {
    if (runningRef.current) {
      setFinalVel(speed)
      setFinalDist(dist)
      setCurrentHeight(curHeight)
      setMaxHeight(maxH)
      
      if (newPoint) {
        currentTrailRef.current.push(newPoint);
        setCurrentTrail([...currentTrailRef.current]);
      }
    }
  }

  const handleHit = (measuredSpeed, distance, measuredMaxH) => {
    if (runningRef.current) {
      runningRef.current = false;
      
      // Teorik hesaplamalar
      const theoreticalSpeed = Math.sqrt(Math.pow(velocity, 2) + 2 * 9.81 * towerHeight);
      
      let theoreticalMaxHeight = towerHeight;
      if (angle > 0) {
        const rad = (angle * Math.PI) / 180;
        const vy = velocity * Math.sin(rad);
        theoreticalMaxHeight = towerHeight + (Math.pow(vy, 2) / (2 * 9.81));
      }
      
      setFinalVel(theoreticalSpeed);
      setFinalDist(distance);
      setMaxHeight(theoreticalMaxHeight);
      setCurrentHeight(0); // Yere çarptığı için yükseklik 0
      
      // Çarpma noktasını da ize ekle ve kalıcı izlere kaydet
      const finalPoint = [currentTrailRef.current[currentTrailRef.current.length-1]?.[0] || 0, 1, 0];
      currentTrailRef.current.push(finalPoint);
      setCurrentTrail([...currentTrailRef.current]);
      
      setTrails(prev => [...prev, currentTrailRef.current]);
      
      setFinished(true);
    }
  }

  // Kulenin merkez X pozisyonu
  const towerX = -25;

  // Enerji Hesaplamaları
  const displayVelocity = (!started && !finished) ? velocity : finalVel;
  const currentKE = 0.5 * mass * Math.pow(displayVelocity, 2);
  const currentPE = mass * 9.81 * currentHeight;
  const totalEnergy = currentKE + currentPE;
  const initialEnergy = (0.5 * mass * Math.pow(velocity, 2)) + (mass * 9.81 * towerHeight);
  const maxEnergy = Math.max(initialEnergy, totalEnergy) || 1;
  const kePercent = Math.min(100, Math.max(0, (currentKE / maxEnergy) * 100));
  const pePercent = Math.min(100, Math.max(0, (currentPE / maxEnergy) * 100));

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", background: "#000000" }}>
      
      {/* KONTROL PANELİ */}
      <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10, fontFamily: 'sans-serif' }}>
        <div style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(6px)', padding: '20px', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid #eee', width: '285px', color: '#333' }}>
          <h3 style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#000', textAlign: 'center' }}>PROJECTILE MOTION</h3>

          {/* AYARLAR */}
          <div style={{ background: '#f9f9f9', padding: '10px', borderRadius: '8px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px', color: '#333' }}>
              TOWER HEIGHT: {towerHeight}m
            </label>
            <input type="range" min="0" max="40" step="1"
              value={towerHeight} onChange={e => {
                const val = Number(e.target.value);
                setTowerHeight(val);
                setCurrentHeight(val);
                setMaxHeight(val);
              }}
              disabled={started} style={{ width: '100%', marginBottom: '10px' }} />

            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px', color: '#333' }}>
              INITIAL VELOCITY (V): {velocity} m/s
            </label>
            <input type="range" min="0" max="40" step="1"
              value={velocity} onChange={e => setVelocity(Number(e.target.value))}
              disabled={started} style={{ width: '100%', marginBottom: '10px' }} />

            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px', color: '#333' }}>
              LAUNCH ANGLE: {angle}°
            </label>
            <input type="range" min="0" max="85" step="1"
              value={angle} onChange={e => setAngle(Number(e.target.value))}
              disabled={started} style={{ width: '100%', marginBottom: '10px' }} />

            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px', color: '#333' }}>
              OBJECT MASS: {mass} kg
            </label>
            <input type="range" min="1" max="100" step="1"
              value={mass} onChange={e => setMass(Number(e.target.value))}
              disabled={started} style={{ width: '100%' }} />
          </div>

          {/* SONUÇLAR / CANLI TAKİP */}
          <div style={{ background: finished ? '#e8f5e9' : '#f9f9f9', padding: '10px', borderRadius: '8px', border: finished ? '2px solid #4caf50' : '2px solid transparent', transition: 'all 0.3s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '11px', color: finished ? '#4caf50' : '#333', fontWeight: 'bold' }}>{finished ? "RESULTS" : "LIVE TRACKING"}</label>
            </div>
            <div style={{ fontSize: finished ? '16px' : '13px', fontWeight: 'bold', color: finished ? '#2e7d32' : '#333', marginTop: '8px' }}>
              Time: {elapsed.toFixed(3)} s
            </div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: finished ? '#1976d2' : '#555', marginTop: '4px' }}>
              Horizontal Distance: {finalDist.toFixed(2)} m
            </div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: finished ? '#ff9800' : '#555', marginTop: '4px' }}>
              {finished ? "Max Height: " : "Height: "} {(finished ? maxHeight : currentHeight).toFixed(2)} m
            </div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: finished ? '#d81b60' : '#555', marginTop: '4px' }}>
              {finished ? "Impact Speed: " : "Live Speed: "} {finalVel.toFixed(2)} m/s
            </div>

            {/* ENERJİ BARLARI */}
            <div style={{ marginTop: '16px', borderTop: '1px solid #ddd', paddingTop: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '4px', color: '#ff3d00' }}>KINETIC ENERGY: {(currentKE).toFixed(0)} J</div>
              <div style={{ width: '100%', background: '#e0e0e0', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${kePercent}%`, background: '#ff3d00', height: '100%' }} />
              </div>
              
              <div style={{ fontSize: '11px', fontWeight: 'bold', marginTop: '8px', marginBottom: '4px', color: '#2979ff' }}>POTENTIAL ENERGY: {(currentPE).toFixed(0)} J</div>
              <div style={{ width: '100%', background: '#e0e0e0', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${pePercent}%`, background: '#2979ff', height: '100%' }} />
              </div>
            </div>
          </div>

          {!started ? (
            <button onClick={handleStart} style={{ padding: '14px', cursor: 'pointer', background: '#000', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>START</button>
          ) : (
            <button onClick={handleReset} style={{ padding: '14px', cursor: 'pointer', background: '#eee', color: '#000', border: '1px solid #ddd', borderRadius: '8px', fontWeight: 'bold' }}>RESET</button>
          )}
          
          {trails.length > 0 && (
            <button onClick={handleClearTrails} style={{ padding: '8px', marginTop: '10px', cursor: 'pointer', background: '#ffebee', color: '#d32f2f', border: '1px solid #ef9a9a', borderRadius: '8px', fontWeight: 'bold', fontSize: '11px' }}>
              CLEAR TRAILS
            </button>
          )}
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: '20px', left: '20px', zIndex: 10, fontFamily: 'sans-serif', color: '#333' }}>
        <div style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(6px)', padding: '20px', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid #eee', width: '285px' }}>
          <h3 style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#000', textAlign: 'center' }}>LIGHT CONTROLS</h3>
          <div style={{ background: '#f9f9f9', padding: '10px', borderRadius: '8px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>LIGHT ANGLE: {lightAngle}°</label>
            <input type="range" min="0" max="360" step="1" value={lightAngle} onChange={e => setLightAngle(Number(e.target.value))} style={{ width: '100%', marginBottom: '10px' }} />

            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>LIGHT INTENSITY: {lightIntensity.toFixed(1)}</label>
            <input type="range" min="0" max="3" step="0.1" value={lightIntensity} onChange={e => setLightIntensity(Number(e.target.value))} style={{ width: '100%' }} />
          </div>
        </div>
      </div>

      {/* 3D SAHNE */}
      <Canvas shadows camera={{ position: [0, 20, 50], fov: 45 }} style={{ background: "#000000" }}>
        <color attach="background" args={["#000000"]} />
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[Math.cos(lightAngle * Math.PI / 180) * 50, 40, Math.sin(lightAngle * Math.PI / 180) * 50]} 
          intensity={lightIntensity} 
          castShadow
          shadow-camera-left={-40} shadow-camera-right={40}
          shadow-camera-top={40}  shadow-camera-bottom={-40}
          shadow-camera-near={0.5} shadow-camera-far={100}
          shadow-mapSize={[2048, 2048]}
        />
        <OrbitControls makeDefault />

        <Physics key={simKey} gravity={[0, -9.81, 0]} timeStep={1/60}>
          <PhysicsClock started={started} onTick={handleTick} />
          <Ground />
          <Tower height={towerHeight} position={[towerX, 0, 0]} />
          
          {/* Kürenin konumu: kulenin sağ ucunda (çatıda sürtünmemesi için), yarıçapı kadar (1 birim) yukarıda */}
          <ProjectileSphere 
            position={[towerX + 2, towerHeight + 1, 0]} 
            velocity={velocity} 
            angle={angle}
            mass={mass} 
            started={started}
            finished={finished}
            onHit={handleHit}
            onProgress={handleProgress}
          />
          
          <HeightChart maxHeight={50} />
          <DistanceChart maxDistance={200} startX={-23} />
          
          {/* Kalıcı İzler */}
          {trails.map((trail, idx) => (
            <Line key={idx} points={trail} color="yellow" dashed dashSize={2} gapSize={2} lineWidth={2} />
          ))}
          
          {/* O anki uçuşun izi */}
          {currentTrail.length > 1 && (
            <Line points={currentTrail} color="yellow" dashed dashSize={2} gapSize={2} lineWidth={2} />
          )}
          
        </Physics>
      </Canvas>
    </div>
  )
}
