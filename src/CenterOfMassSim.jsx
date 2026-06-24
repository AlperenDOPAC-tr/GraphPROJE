import React, { useState, useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Environment, Sky, Edges } from '@react-three/drei'
import { Physics, RigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { getGroundTexture } from './utils'
import { PlayIcon, PauseIcon, ResetIcon, LightBulbIcon, VectorIcon } from './Icons'

const VectorArrow = ({ origin, dir, length, color, visible }) => {
  const groupRef = useRef()
  const arrowRef = useRef()
  
  useEffect(() => {
    if (!groupRef.current) return;

    if (!arrowRef.current) {
      arrowRef.current = new THREE.ArrowHelper(
        new THREE.Vector3(...dir).normalize(),
        new THREE.Vector3(0, 0, 0),
        length,
        color,
        length * 0.2,
        length * 0.2
      )
      groupRef.current.add(arrowRef.current)
    } else {
      if (length <= 0.01) return; // Prevent ArrowHelper crash with zero length
      arrowRef.current.setDirection(new THREE.Vector3(...dir).normalize())
      arrowRef.current.setLength(length, length * 0.2, length * 0.2)
      arrowRef.current.setColor(new THREE.Color(color))
    }
  }, [dir, length, color])

  return (
    <group ref={groupRef} position={origin} visible={visible}></group>
  )
}

function PrismSystem({ width, height, tiltDeg, mass, g, isPlaying, showVectors, isNonUniform }) {
  const prismRef = useRef()
  
  const phi = tiltDeg * Math.PI / 180
  
  // Calculate offset if gravity is non-uniform (exaggerated shift downwards by 25% of height)
  const cogOffset = isNonUniform ? height * 0.25 : 0

  // Calculate initial position to pivot around bottom-right corner at (0,0,0)
  // By tilting RIGHT (negative Z rotation)
  const initialY = (width / 2) * Math.sin(phi) + (height / 2 - cogOffset) * Math.cos(phi)
  const initialX = -(width / 2) * Math.cos(phi) + (height / 2 - cogOffset) * Math.sin(phi)
  const initialRot = -phi

  const [comX, setComX] = useState(initialX)
  const [comY, setComY] = useState(initialY)

  useFrame(() => {
    if (prismRef.current) {
      const trans = prismRef.current.translation()
      setComX(trans.x)
      setComY(trans.y)
    }
  })

  // Whenever stopped, force the prism to exactly the starting position
  useEffect(() => {
    if (!isPlaying && prismRef.current) {
      prismRef.current.setTranslation({ x: initialX, y: initialY, z: 0 }, true)
      prismRef.current.setRotation(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, initialRot)), true)
      prismRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
      prismRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true)
    }
  }, [isPlaying, initialX, initialY, initialRot])

  const tipsOver = initialX > 0

  useFrame((state, delta) => {
    // If playing, we need to apply our own gravity at the CoG.
    // If isNonUniform is true, we must use custom gravity at local [0,0,0] (the CoG).
    // If isNonUniform is false, local [0,0,0] is both CoG and CoM, so custom gravity works perfectly either way!
    if (isPlaying && prismRef.current) {
      const pos = prismRef.current.translation()
      // applyImpulseAtPoint applies force * delta. We use mass * g * delta.
      prismRef.current.applyImpulseAtPoint({ x: 0, y: -mass * g * delta, z: 0 }, pos, true)
    }
  })

  return (
    <group>
      <RigidBody
        ref={prismRef}
        type={isPlaying ? "dynamic" : "kinematicPosition"}
        colliders="cuboid"
        mass={mass}
        restitution={0.2}
        friction={0.8}
        gravityScale={0} // Disable engine gravity so we can apply it exactly at CoG
        position={[initialX, initialY, 0]}
        rotation={[0, 0, initialRot]}
      >
        <group position={[0, cogOffset, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[width, height, 2]} />
            <meshStandardMaterial color={tipsOver ? "#f44336" : "#4caf50"} />
            <Edges color="#000" />
          </mesh>
          
          {/* Center of Mass Indicator (White) */}
          <mesh position={[0, 0, 1.05]}>
            <sphereGeometry args={[0.15, 16, 16]} />
            <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.5} />
          </mesh>
        </group>

        {/* Center of Gravity Indicator (Orange - Only visible if different) */}
        {isNonUniform && (
          <mesh position={[0, 0, 1.05]}>
            <sphereGeometry args={[0.15, 16, 16]} />
            <meshStandardMaterial color="#ff9800" emissive="#ff9800" emissiveIntensity={0.5} />
          </mesh>
        )}
      </RigidBody>

      {/* Ground */}
      <RigidBody type="fixed" friction={0.8} restitution={0.2}>
        <mesh position={[0, -0.5, 0]} receiveShadow>
          <boxGeometry args={[40, 1, 40]} />
          <meshStandardMaterial color="#ffffff" map={getGroundTexture(20, 20)} />
        </mesh>
      </RigidBody>

      {/* Pivot Point Marker */}
      <mesh position={[0, 0, 1.01]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial color="#ff9800" />
      </mesh>

      {/* Gravity Vector (Always points straight down from current CoG) */}
      <VectorArrow 
        origin={[comX, comY, 1.05]} 
        dir={[0, -1, 0]} 
        length={Math.max(0.1, Math.min(2 + mass * 0.05, comY))} 
        color={0xe91e63} 
        visible={showVectors && (!isPlaying || comY > height/2*0.8)} // hide when it falls flat
      />
      
      {/* Visual aid line showing the vertical drop from CoM */}
      {!isPlaying && showVectors && (
        <mesh position={[comX, comY / 2, 1.04]}>
          <boxGeometry args={[0.02, comY, 0.02]} />
          <meshBasicMaterial color={tipsOver ? "#f44336" : "#4caf50"} transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  )
}

export default function CenterOfMassSim() {
  const [hasStarted, setHasStarted]     = useState(false)
  const [isPlaying, setIsPlaying]       = useState(false)
  const [resetTrigger, setResetTrigger] = useState(0)
  const [showVectors, setShowVectors]   = useState(true)

  const [g, setG] = useState(9.81)
  const [mass, setMass] = useState(10)
  const [width, setWidth] = useState(2)
  const [height, setHeight] = useState(5)
  const [tiltDeg, setTiltDeg] = useState(15)
  const [isNonUniform, setIsNonUniform] = useState(false)

  const [lightAngle, setLightAngle]         = useState(45)
  const [lightIntensity, setLightIntensity] = useState(1.5)
  const [lightPanelOpen, setLightPanelOpen] = useState(false)

  const handlePlayPause = () => {
    if (!hasStarted) { setHasStarted(true); setIsPlaying(true); setResetTrigger(p => p + 1) }
    else setIsPlaying(!isPlaying)
  }
  
  const handleReset = () => { 
    setHasStarted(false); 
    setIsPlaying(false); 
    setResetTrigger(p => p + 1) 
  }

  const toggleBtnSt = (active) => ({
    padding: '4px 12px', borderRadius: '6px', border: 'none',
    background: active ? '#8b5cf6' : '#e2e8f0', color: active ? '#fff' : '#64748b',
    cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', transition: 'all 0.2s'
  })

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
    backdropFilter: 'blur(12px)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
    transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
  }

  // Calculate tipping math for UI
  const phi = tiltDeg * Math.PI / 180
  const cogOffset = isNonUniform ? height * 0.25 : 0
  const initialX = -(width / 2) * Math.cos(phi) + (height / 2 - cogOffset) * Math.sin(phi)
  const tipsOver = initialX > 0

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", background: "#111" }}>
      
      {/* SOL PANEL */}
      <div className="left-panel" style={panelSt}>
        <h2 style={titleSt}>CENTER OF GRAVITY</h2>

        <div style={{ ...cardSt, borderLeft: '4px solid #9e9e9e' }}>
          <label style={lblSt}>GRAVITY (g): {g.toFixed(2)} m/s²</label>
          <input type="range" min={1} max={25} step={0.1} value={g} disabled={isPlaying}
            onChange={e => setG(+e.target.value)} style={{ width: '100%', marginBottom: 12 }} />
            
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#333' }}>NON-UNIFORM GRAVITY</div>
              <div style={{ fontSize: '9px', color: '#64748b', marginTop: 2 }}>Lowers CoG away from CoM</div>
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button disabled={isPlaying} style={toggleBtnSt(!isNonUniform)} onClick={() => setIsNonUniform(false)}>OFF</button>
              <button disabled={isPlaying} style={toggleBtnSt(isNonUniform)} onClick={() => setIsNonUniform(true)}>ON</button>
            </div>
          </div>
        </div>

        <div style={{ ...cardSt, borderLeft: '4px solid #4caf50' }}>
          <label style={lblSt}>PRISM WIDTH: {width.toFixed(1)} m</label>
          <input type="range" min={1} max={6} step={0.5} value={width} disabled={isPlaying}
            onChange={e => setWidth(+e.target.value)} style={{ width: '100%', marginBottom: 12 }} />

          <label style={lblSt}>PRISM HEIGHT: {height.toFixed(1)} m</label>
          <input type="range" min={1} max={15} step={0.5} value={height} disabled={isPlaying}
            onChange={e => setHeight(+e.target.value)} style={{ width: '100%' }} />
        </div>

        <div style={{ ...cardSt, borderLeft: '4px solid #ff9800' }}>
          <label style={lblSt}>INITIAL TILT: {tiltDeg}°</label>
          <input type="range" min={0} max={60} step={1} value={tiltDeg} disabled={isPlaying}
            onChange={e => setTiltDeg(+e.target.value)} style={{ width: '100%', marginBottom: 12 }} />

          <label style={lblSt}>MASS: {mass} kg</label>
          <input type="range" min={1} max={100} step={1} value={mass} disabled={isPlaying}
            onChange={e => setMass(+e.target.value)} style={{ width: '100%' }} />
        </div>

        <div style={{ ...cardSt, padding: '16px', background: tipsOver ? 'rgba(244, 67, 54, 0.05)' : 'rgba(76, 175, 80, 0.05)', textAlign: 'center', border: `1px solid ${tipsOver ? '#fca5a5' : '#86efac'}`, borderLeft: tipsOver ? '4px solid #ef4444' : '4px solid #22c55e' }}>
          <div style={{ fontSize: '16px', fontWeight: '900', color: tipsOver ? '#ef4444' : '#22c55e' }}>
            {tipsOver ? "WILL TIP OVER!" : "STABLE"}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: 8, fontWeight: 'bold' }}>
            {tipsOver 
              ? "Center of Gravity is outside the base of support." 
              : "Center of Gravity is inside the base of support."}
          </div>
        </div>
        
      </div>

      {/* SAĞ BUTONLAR */}
      <button onClick={() => setLightPanelOpen(!lightPanelOpen)}
        style={{ ...iconBtnBase, top: '194px', background: lightPanelOpen ? '#ffffff' : 'rgba(15,15,20,0.85)' }}
        title="Light Controls">
        <LightBulbIcon width={24} height={24} fill={lightPanelOpen ? '#000' : '#fff'} />
      </button>
      {lightPanelOpen && (
        <div style={{ position:'absolute', top:'194px', right:'82px', zIndex:999,
          background:'rgba(255,255,255,0.9)', backdropFilter:'blur(8px)', padding:'16px',
          borderRadius:'12px', boxShadow:'0 8px 30px rgba(0,0,0,0.2)', width:'200px', fontFamily: '"Inter", sans-serif' }}>
          <label style={lblSt}>ANGLE: {lightAngle}°</label>
          <input type="range" min="0" max="360" step="1" value={lightAngle} onChange={e => setLightAngle(Number(e.target.value))} style={{ width:'100%', marginBottom:10 }} />
          <label style={lblSt}>INTENSITY: {lightIntensity.toFixed(1)}</label>
          <input type="range" min="0" max="3" step="0.1" value={lightIntensity} onChange={e => setLightIntensity(Number(e.target.value))} style={{ width:'100%' }} />
        </div>
      )}

      <button onClick={handlePlayPause}
        style={{ ...iconBtnBase, top:'252px', background: isPlaying ? '#ffffff' : 'rgba(15,15,20,0.85)' }}
        title="Play / Pause">
        {isPlaying ? <PauseIcon width={24} height={24} fill="#000" /> : <PlayIcon width={24} height={24} fill="#fff" />}
      </button>

      <button onClick={handleReset}
        style={{ ...iconBtnBase, top:'310px', background:'rgba(15,15,20,0.85)' }}
        title="Reset">
        <ResetIcon width={24} height={24} fill="#fff" />
      </button>

      <button onClick={() => setShowVectors(!showVectors)}
        style={{ ...iconBtnBase, top:'368px', background: showVectors ? '#ffffff' : 'rgba(15,15,20,0.85)' }}
        title="Toggle Vectors">
        <VectorIcon width={24} height={24} fill={showVectors ? '#000' : '#fff'} />
      </button>

      <Canvas shadows camera={{ position: [0, 8, 20], fov: 45 }}>
        <color attach="background" args={["#000000"]} />
        <ambientLight intensity={0.4} />
        <directionalLight
          castShadow
          position={[Math.cos(lightAngle * Math.PI / 180) * 20, Math.sin(lightAngle * Math.PI / 180) * 20, 10]}
          intensity={lightIntensity}
          shadow-mapSize={[2048, 2048]}
        >
          <orthographicCamera attach="shadow-camera" args={[-20, 20, 20, -20]} />
        </directionalLight>

        <Physics gravity={[0, -g, 0]} timeStep={1/60} paused={!isPlaying}>
          <PrismSystem 
            key={resetTrigger}
            width={width} 
            height={height} 
            tiltDeg={tiltDeg} 
            mass={mass} 
            g={g} 
            isPlaying={isPlaying} 
            showVectors={showVectors} 
            isNonUniform={isNonUniform}
          />
        </Physics>
        
        <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2 + 0.1} />
      </Canvas>
    </div>
  )
}
