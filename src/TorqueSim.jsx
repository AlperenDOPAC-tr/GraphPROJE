import React, { useState, useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text, Billboard, Edges } from '@react-three/drei'
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { getGroundTexture } from './utils'
import { PlayIcon, PauseIcon, ResetIcon, LightBulbIcon, VectorIcon } from './Icons'

// ─── STYLES ──────────────────────────────────────────────────────────────────
const panelStyle = {
  background: 'rgba(255, 255, 255, 0.85)',
  backdropFilter: 'blur(10px)',
  padding: '16px',
  borderRadius: '12px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
  border: '1px solid rgba(255,255,255,0.4)',
  width: '300px',
  maxHeight: '90vh',
  overflowY: 'auto'
}

const cardStyle = (color) => ({
  background: 'rgba(255,255,255,0.6)',
  borderRadius: '8px',
  padding: '12px',
  marginBottom: '12px',
  borderLeft: `4px solid ${color}`,
  boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
})

const lblStyle = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 'bold',
  color: '#444',
  marginBottom: '4px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
}

const iconBtnBase = {
  position: 'absolute', right: '24px', zIndex: 1000,
  width: '48px', height: '48px', borderRadius: '14px', border: 'none',
  backdropFilter: 'blur(12px)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
  transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
}

// ─── VECTOR ARROW ────────────────────────────────────────────────────────────
function VectorArrow({ origin, originRef, dir, length, color, label, visible, labelOffset = [0,0,0], shiftBack = false }) {
  const groupRef = useRef(null)
  const billRef  = useRef(null)
  const txtRef   = useRef(null)

  const arrow = useMemo(() => {
    const d = new THREE.Vector3(...dir).normalize()
    return new THREE.ArrowHelper(d, new THREE.Vector3(), 1, color)
  }, [color])

  useFrame(() => {
    if (!groupRef.current) return
    
    if (originRef && originRef.current) {
      groupRef.current.position.copy(originRef.current)
    }
    const len = Math.max(0.5, length)
    const headLen = Math.min(0.8, Math.max(0.3, len * 0.25))
    const d = new THREE.Vector3(...dir)
    if (d.lengthSq() < 0.0001) { arrow.visible = false; if (txtRef.current) txtRef.current.visible = false; return }
    d.normalize()
    arrow.setDirection(d)
    arrow.setLength(len, headLen, headLen * 0.5)
    
    if (shiftBack) {
      arrow.position.copy(d).multiplyScalar(-len)
    } else {
      arrow.position.set(0, 0, 0)
    }
    
    arrow.visible = visible

    if (billRef.current) {
      if (shiftBack) {
        billRef.current.position.set(
          -d.x * (len + 0.5) + labelOffset[0],
          -d.y * (len + 0.5) + labelOffset[1],
          -d.z * (len + 0.5) + labelOffset[2]
        )
      } else {
        billRef.current.position.set(
          d.x * (len + 0.5) + labelOffset[0],
          d.y * (len + 0.5) + labelOffset[1],
          d.z * (len + 0.5) + labelOffset[2]
        )
      }
    }
    if (txtRef.current) {
      txtRef.current.visible = visible
    }
  })

  return (
    <group ref={groupRef} position={origin}>
      <primitive object={arrow} />
      <Billboard ref={billRef}>
        <Text ref={txtRef} fontSize={0.6} color={`#${color.toString(16).padStart(6,'0')}`}
              outlineWidth={0.05} outlineColor="#000" anchorX="center" anchorY="middle">
          {label}
        </Text>
      </Billboard>
    </group>
  )
}

// ─── SCENE COMPONENTS ────────────────────────────────────────────────────────
function LeverSystem({ mass, massPos, massSide, force, forcePos, forceSide, fulcrumPos, isPlaying, showVectors, resetTrigger, g, netTorque, torqueMassZ, torqueForceZ }) {
  const leverRef = useRef(null)
  
  const shiftX = -fulcrumPos
  
  const massPosLocal = useMemo(() => new THREE.Vector3(massPos * massSide, 0.2, 0), [massPos, massSide])
  const forcePosLocal = useMemo(() => new THREE.Vector3(forcePos * forceSide, 0.2, 0), [forcePos, forceSide])
  
  const massPosWorld = useRef(new THREE.Vector3())
  const forcePosWorld = useRef(new THREE.Vector3())
  
  // Vectors for visual rendering refs
  const massArrowBase = useRef(new THREE.Vector3())
  const forceArrowBase = useRef(new THREE.Vector3())

  useFrame((state, delta) => {
    if (!leverRef.current) return
    
    const trans = leverRef.current.translation()
    const rot = leverRef.current.rotation()
    const quat = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w)
    
    massPosWorld.current.copy(massPosLocal).applyQuaternion(quat).add(trans)
    forcePosWorld.current.copy(forcePosLocal).applyQuaternion(quat).add(trans)
    
    // Set mass arrow base to the bottom of the mass
    massArrowBase.current.copy(massPosWorld.current)
    // Keep force arrow directly at the force point
    forceArrowBase.current.copy(forcePosWorld.current)
    
    if (isPlaying) {
      if (Math.abs(netTorque) < 5) {
        // Enforce perfect stillness when balanced
        leverRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true)
      } else {
        // Damping to make it stable
        const angVel = leverRef.current.angvel()
        leverRef.current.applyTorqueImpulse({ x: 0, y: 0, z: -angVel.z * 5 * delta }, true)

        const euler = new THREE.Euler().setFromQuaternion(quat)
        const maxAngle = 30 * Math.PI / 180
        
        let shouldApplyForces = true
        
        // netTorque > 0 means CCW torque, which tilts LEFT, pushing euler.z positive
        if (euler.z >= maxAngle && netTorque > 0) {
          shouldApplyForces = false
          leverRef.current.setRotation(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, maxAngle)), true)
          leverRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true)
        } 
        // netTorque < 0 means CW torque, which tilts RIGHT, pushing euler.z negative
        else if (euler.z <= -maxAngle && netTorque < 0) {
          shouldApplyForces = false
          leverRef.current.setRotation(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -maxAngle)), true)
          leverRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true)
        }

        if (shouldApplyForces) {
          // Apply forces as impulses (Force * dt)
          const mpW = { x: massPosWorld.current.x, y: massPosWorld.current.y, z: massPosWorld.current.z }
          const fpW = { x: forcePosWorld.current.x, y: forcePosWorld.current.y, z: forcePosWorld.current.z }
          
          leverRef.current.applyImpulseAtPoint({ x: 0, y: -mass * g * delta, z: 0 }, mpW, true)
          leverRef.current.applyImpulseAtPoint({ x: 0, y: -force * delta, z: 0 }, fpW, true)
        }
      }
    }
  })
  
  const massSize = Math.cbrt(mass) * 0.4
  const groundTex = useMemo(() => getGroundTexture(10, 5), [])

  return (
    <group>
      {/* Fulcrum (Destek) */}
      <mesh position={[fulcrumPos, -1, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0, 1, 2, 4]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      
      {/* Lever (Kaldıraç) */}
      <RigidBody 
        ref={leverRef} 
        type="dynamic" 
        enabledTranslations={[false, false, false]} 
        enabledRotations={[false, false, true]}
        position={[fulcrumPos, 0, 0]}
        colliders={false}
        ccd={true}
        mass={20} // Heavy lever to keep it relatively stable
      >
        <CuboidCollider args={[10, 0.1, 1]} position={[shiftX, 0.1, 0]} restitution={0} friction={1} />
        {/* Balancer collider to keep Center of Mass exactly at [0,0,0] (the fulcrum) */}
        <CuboidCollider args={[10, 0.1, 1]} position={[-shiftX, 0.1, 0]} sensor={true} />
        
        <mesh position={[shiftX, 0.1, 0]} castShadow receiveShadow>
          <boxGeometry args={[20, 0.2, 2]} />
          <meshStandardMaterial color="#fcd34d" roughness={0.8} />
          <Edges color="#b45309" />
        </mesh>
        
        {/* Rulers (Cetvel çizgileri) */}
        {Array.from({ length: 19 }).map((_, i) => {
          const x = i - 9 + shiftX;
          if (x === shiftX) return null;
          return (
            <mesh key={i} position={[x, 0.21, 0]}>
              <boxGeometry args={[0.05, 0.02, 1.8]} />
              <meshBasicMaterial color="rgba(0,0,0,0.2)" />
            </mesh>
          )
        })}

        {/* Mass Object */}
        <mesh position={[massPos * massSide, 0.2 + massSize / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[massSize, massSize, massSize]} />
          <meshStandardMaterial color="#e91e63" />
          <Edges color="black" />
        </mesh>
      </RigidBody>
      
      {/* Vectors */}
      <VectorArrow 
        origin={[0, 0, 0]} 
        originRef={massArrowBase}
        dir={[0, -1, 0]} 
        length={Math.min(4, Math.max(1, mass * 0.1))} 
        color={0xe91e63} 
        label={`W = ${(mass*g).toFixed(0)} N`} 
        visible={showVectors} 
        labelOffset={[0, -0.5, 0]}
        shiftBack={false}
      />
      <VectorArrow 
        origin={[0, 0, 0]} 
        originRef={forceArrowBase}
        dir={[0, force < 0 ? 1 : -1, 0]} 
        length={Math.min(4, Math.max(1, Math.abs(force) * 0.05))} 
        color={0x2196f3} 
        label={`F = ${Math.abs(force).toFixed(0)} N`} 
        visible={showVectors} 
        labelOffset={[0, force < 0 ? -0.5 : 0.5, 0]}
        shiftBack={true}
      />

      {/* Torque Vectors */}
      <VectorArrow 
        origin={[fulcrumPos, 0, 0.5]} 
        dir={[0, 0, torqueMassZ >= 0 ? 1 : -1]} 
        length={Math.min(5, Math.max(1, Math.abs(torqueMassZ) * 0.002))} 
        color={0xe91e63} 
        label={`τ_Load = ${Math.abs(torqueMassZ).toFixed(0)} N·m`} 
        visible={showVectors} 
        labelOffset={[0, 0.5, 0]}
      />
      <VectorArrow 
        origin={[fulcrumPos, 0, -0.5]} 
        dir={[0, 0, torqueForceZ >= 0 ? 1 : -1]} 
        length={Math.min(5, Math.max(1, Math.abs(torqueForceZ) * 0.002))} 
        color={0x2196f3} 
        label={`τ_Force = ${Math.abs(torqueForceZ).toFixed(0)} N·m`} 
        visible={showVectors} 
        labelOffset={[0, -0.5, 0]}
      />
    </group>
  )
}

// ─── MAIN APP COMPONENT ──────────────────────────────────────────────────────
export default function TorqueSim() {
  const [hasStarted, setHasStarted]     = useState(false)
  const [isPlaying, setIsPlaying]       = useState(false)
  const [resetTrigger, setResetTrigger] = useState(0)
  const [showVectors, setShowVectors]   = useState(true)

  const [g, setG] = useState(9.81)

  const [mass, setMass] = useState(50)
  const [massPos, setMassPos] = useState(5)
  const [massSide, setMassSide] = useState(-1) // -1 for left, 1 for right

  const [force, setForce] = useState(250)
  const [forcePos, setForcePos] = useState(5)
  const [forceSide, setForceSide] = useState(1) // -1 for left, 1 for right

  const [fulcrumPos, setFulcrumPos] = useState(0)

  useEffect(() => {
    const maxMassDist = massSide === -1 ? 10 + fulcrumPos : 10 - fulcrumPos
    const maxForceDist = forceSide === -1 ? 10 + fulcrumPos : 10 - fulcrumPos
    
    setMassPos(m => Math.max(0.5, Math.min(m, maxMassDist - 0.5)))
    setForcePos(f => Math.max(0.5, Math.min(f, maxForceDist - 0.5)))
  }, [fulcrumPos, massSide, forceSide])

  const [lightAngle, setLightAngle]         = useState(45)
  const [lightIntensity, setLightIntensity] = useState(1.5)
  const [lightPanelOpen, setLightPanelOpen] = useState(false)

  const handlePlayPause = () => {
    if (!hasStarted) { setHasStarted(true); setIsPlaying(true); setResetTrigger(p => p + 1) }
    else setIsPlaying(!isPlaying)
  }
  const handleReset = () => { setHasStarted(false); setIsPlaying(false); setResetTrigger(p => p + 1) }

  const torqueMassZ = -1 * mass * g * massPos * massSide
  const torqueForceZ = -1 * force * forcePos * forceSide
  const netTorque = torqueMassZ + torqueForceZ
  
  const toggleBtnStyle = (active) => ({
    padding: '2px 8px', borderRadius: '4px', border: 'none',
    background: active ? '#444' : '#ddd', color: active ? '#fff' : '#444',
    cursor: 'pointer', fontSize: '10px', fontWeight: 'bold'
  })

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", background: "#111" }}>
      
      {/* SOL PANEL */}
      <div className="left-panel" style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10, fontFamily: 'sans-serif' }}>
        <div style={panelStyle}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#000', textAlign: 'center' }}>
            TORQUE & LEVER
          </h3>

          <div style={cardStyle('#9e9e9e')}>
            <label style={lblStyle}>GRAVITY (g): {g.toFixed(2)} m/s²</label>
            <input type="range" min={1} max={25} step={0.1} value={g}
              onChange={e => setG(+e.target.value)} style={{ width: '100%' }} />
          </div>
          
          <div style={cardStyle('#8B4513')}>
            <label style={lblStyle}>FULCRUM POSITION: {fulcrumPos.toFixed(1)} m</label>
            <input type="range" min={-8} max={8} step={0.5} value={fulcrumPos}
              onChange={e => setFulcrumPos(+e.target.value)} style={{ width: '100%' }} />
          </div>

          <div style={cardStyle('#e91e63')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#333' }}>LOAD (MASS)</div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button style={toggleBtnStyle(massSide === -1)} onClick={() => setMassSide(-1)}>LEFT</button>
                <button style={toggleBtnStyle(massSide === 1)} onClick={() => setMassSide(1)}>RIGHT</button>
              </div>
            </div>
            
            <label style={lblStyle}>MASS: {mass} kg</label>
            <input type="range" min={1} max={200} step={1} value={mass}
              onChange={e => setMass(+e.target.value)} style={{ width: '100%', marginBottom: 6 }} />
            
            <label style={lblStyle}>DISTANCE TO FULCRUM: {massPos.toFixed(1)} m</label>
            <input type="range" min={0.5} max={massSide === -1 ? 10 + fulcrumPos - 0.5 : 10 - fulcrumPos - 0.5} step={0.1} value={massPos}
              onChange={e => setMassPos(+e.target.value)} style={{ width: '100%' }} />
            
            <div style={{ marginTop: 8, fontSize: '12px', color: '#555' }}>
              Torque: <b>{(mass * g * massPos).toFixed(0)} N·m</b> {mass === 0 ? '' : (massSide === -1 ? '(CCW)' : '(CW)')}
            </div>
          </div>

          <div style={cardStyle('#2196f3')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#333' }}>APPLIED FORCE</div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button style={toggleBtnStyle(forceSide === -1)} onClick={() => setForceSide(-1)}>LEFT</button>
                <button style={toggleBtnStyle(forceSide === 1)} onClick={() => setForceSide(1)}>RIGHT</button>
              </div>
            </div>
            
            <label style={lblStyle}>FORCE: {force} N</label>
            <input type="range" min={-1000} max={1000} step={10} value={force}
              onChange={e => setForce(+e.target.value)} style={{ width: '100%', marginBottom: 6 }} />
            
            <label style={lblStyle}>DISTANCE TO FULCRUM: {forcePos.toFixed(1)} m</label>
            <input type="range" min={0.5} max={forceSide === -1 ? 10 + fulcrumPos - 0.5 : 10 - fulcrumPos - 0.5} step={0.1} value={forcePos}
              onChange={e => setForcePos(+e.target.value)} style={{ width: '100%' }} />
            
            <div style={{ marginTop: 8, fontSize: '12px', color: '#555' }}>
              Torque: <b>{Math.abs(force * forcePos).toFixed(0)} N·m</b> 
              {force === 0 ? '' : (force > 0 
                ? (forceSide === -1 ? ' (CCW)' : ' (CW)') 
                : (forceSide === -1 ? ' (CW)' : ' (CCW)'))}
            </div>
          </div>

          <div style={{ marginTop: 16, padding: '12px', background: 'rgba(0,0,0,0.05)', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>NET TORQUE</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: Math.abs(netTorque) < 5 ? '#4caf50' : '#f44336' }}>
              {Math.abs(netTorque).toFixed(0)} N·m
            </div>
            <div style={{ fontSize: '12px', color: '#333', marginTop: 4 }}>
              {netTorque > 5 ? "Tilting Left ↺" : netTorque < -5 ? "Tilting Right ↻" : "Balanced"}
            </div>
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
          borderRadius:'12px', boxShadow:'0 8px 30px rgba(0,0,0,0.2)', width:'200px' }}>
          <label style={lblStyle}>ANGLE: {lightAngle}°</label>
          <input type="range" min="0" max="360" step="1" value={lightAngle} onChange={e => setLightAngle(Number(e.target.value))} style={{ width:'100%', marginBottom:10 }} />
          <label style={lblStyle}>INTENSITY: {lightIntensity.toFixed(1)}</label>
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

      <Canvas shadows camera={{ position: [0, 5, 25], fov: 45 }}>
        <color attach="background" args={['#111']} />
        
        <ambientLight intensity={0.6} />
        <directionalLight castShadow
          position={[Math.cos(lightAngle * Math.PI / 180) * 30, 20, Math.sin(lightAngle * Math.PI / 180) * 30]}
          intensity={lightIntensity} shadow-mapSize={[2048, 2048]}>
          <orthographicCamera attach="shadow-camera" args={[-25, 25, 25, -25, 0.1, 100]} />
        </directionalLight>

        <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2 + 0.1} />

        <Physics gravity={[0, -g, 0]} timeStep={1/60} paused={!isPlaying}>
          <LeverSystem 
            key={resetTrigger}
            mass={mass} massPos={massPos} massSide={massSide}
            force={force} forcePos={forcePos} forceSide={forceSide}
            fulcrumPos={fulcrumPos}
            isPlaying={isPlaying} 
            showVectors={showVectors} 
            resetTrigger={resetTrigger} 
            g={g} 
            netTorque={netTorque} 
            torqueMassZ={torqueMassZ} 
            torqueForceZ={torqueForceZ} 
          />
        </Physics>
      </Canvas>
    </div>
  )
}
