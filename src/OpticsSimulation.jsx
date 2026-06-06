import React, { useState, useRef, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Text, Billboard, Line } from '@react-three/drei'
import { LightBulbIcon } from './Icons'
import * as THREE from 'three'

// ─── STYLES ──────────────────────────────────────────────────────────────────
const panelStyle = {
  background: 'rgba(255, 255, 255, 0.85)',
  backdropFilter: 'blur(10px)',
  padding: '16px',
  borderRadius: '12px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
  border: '1px solid rgba(255,255,255,0.4)',
  width: '280px',
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

const btnStyle = (active) => ({
  flex: 1,
  padding: '6px 0',
  border: 'none',
  borderRadius: '4px',
  background: active ? '#2196f3' : '#e0e0e0',
  color: active ? '#fff' : '#333',
  fontWeight: 'bold',
  fontSize: '11px',
  cursor: 'pointer',
  transition: 'all 0.2s'
})

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const OBJECT_COLOR = '#e91e63'
const IMAGE_COLOR = '#9c27b0'
const LIGHT_COLOR = '#ffeb3b'
const MIRROR_COLOR = '#81d4fa'
const RAY_OBJ_COLOR = '#f48fb1'
const RAY_LIGHT_COLOR = '#fff59d'

// ─── 3D COMPONENTS ───────────────────────────────────────────────────────────

// Ok objesi (Cisim veya Görüntü)
function ArrowObject({ x, height, color, isVirtual }) {
  const isUpright = height > 0
  const absH = Math.abs(height)
  const shaftH = Math.max(0.1, absH - 1)
  const headH = Math.min(1, absH)
  const dir = isUpright ? 1 : -1

  return (
    <group position={[x, 0, 0]}>
      {/* Şeffaflık ayarı: sanal görüntü ise daha şeffaf */}
      <mesh position={[0, dir * (shaftH / 2), 0]}>
        <cylinderGeometry args={[0.2, 0.2, shaftH, 16]} />
        <meshStandardMaterial color={color} transparent opacity={isVirtual ? 0.4 : 0.9} />
      </mesh>
      <mesh position={[0, dir * (shaftH + headH / 2), 0]}>
        <coneGeometry args={[0.5, headH, 16]} />
        <meshStandardMaterial color={color} transparent opacity={isVirtual ? 0.4 : 0.9} />
      </mesh>
      <Billboard position={[0, dir * absH + (isUpright ? 0.8 : -0.8), 0]}>
        <Text fontSize={0.6} color={color} fontWeight="bold" outlineWidth={0.03} outlineColor="#fff">
          {isVirtual ? "IMAGE" : "OBJECT"}
        </Text>
      </Billboard>
    </group>
  )
}

function MirrorGeometry({ type, focalLength }) {
  // Ayna şekli
  if (type === 'plane') {
    return (
      <mesh position={[0, 5, 0]}>
        <boxGeometry args={[0.5, 20, 10]} />
        <meshStandardMaterial color={MIRROR_COLOR} transparent opacity={0.6} roughness={0.1} metalness={0.8} />
      </mesh>
    )
  }

  // Çukur / Tümsek kavisli ayna
  const R = 2 * focalLength
  const absR = Math.abs(R)
  const isConcave = type === 'concave'
  
  // Basit kavis için bir silindir dilimi kullanacağız
  // Theta (açı) = Yükseklik / Yarıçap
  const angle = 20 / absR 
  
  return (
    <group position={[isConcave ? absR : -absR, 5, 0]}>
      <mesh rotation={[0, isConcave ? 0 : Math.PI, 0]}>
        <cylinderGeometry args={[absR, absR, 10, 32, 1, false, -angle/2 - Math.PI/2, angle]} />
        <meshStandardMaterial color={MIRROR_COLOR} transparent opacity={0.6} roughness={0.1} metalness={0.8} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

// ─── MAIN APP COMPONENT ──────────────────────────────────────────────────────
export default function OpticsSimulation() {
  const [mirrorType, setMirrorType] = useState('concave') // plane, concave, convex
  const [focalLength, setFocalLength] = useState(15) // Absolute value
  
  const [objX, setObjX] = useState(-25)
  const [objH, setObjH] = useState(6)
  
  const [lightX, setLightX] = useState(-10)

  const [showObjRays, setShowObjRays] = useState(true)
  const [showLightRays, setShowLightRays] = useState(false)

  const [lightAngle, setLightAngle] = useState(45)
  const [lightIntensity, setLightIntensity] = useState(1.5)
  const [lightPanelOpen, setLightPanelOpen] = useState(false)

  // ─── PHYSICS CALCULATIONS ──────────────────────────────────────────────────
  
  // Odak uzaklığı (Çukur için pozitif, Tümsek için negatif)
  let f = 0
  if (mirrorType === 'plane') f = Infinity
  else if (mirrorType === 'concave') f = focalLength
  else if (mirrorType === 'convex') f = -focalLength

  // Cisim hesaplamaları
  const do_obj = -objX // Cismin aynaya uzaklığı (pozitif)
  let di_obj = 0
  let M = 1
  let imageH = objH
  let imageX = objX
  let isObjAtFocus = false

  if (mirrorType === 'plane') {
    di_obj = -do_obj
    M = 1
    imageX = -di_obj
    imageH = objH
  } else {
    // 1/f = 1/do + 1/di  => di = (f * do) / (do - f)
    if (Math.abs(do_obj - f) < 0.1) {
      isObjAtFocus = true
      di_obj = Infinity
      M = Infinity
    } else {
      di_obj = (f * do_obj) / (do_obj - f)
      M = -di_obj / do_obj
      imageX = -di_obj
      imageH = objH * M
    }
  }

  const isObjVirtual = di_obj < 0

  // Işık kaynağı hesaplamaları
  const do_light = -lightX
  let di_light = 0
  let lightImageX = 0
  let isLightAtFocus = false

  if (mirrorType === 'plane') {
    di_light = -do_light
    lightImageX = -di_light
  } else {
    if (Math.abs(do_light - f) < 0.1) {
      isLightAtFocus = true
      di_light = Infinity
    } else {
      di_light = (f * do_light) / (do_light - f)
      lightImageX = -di_light
    }
  }

  // Işın yolları oluşturma
  const createRay = (start, hit, image) => {
    // 1. Gelen ışın (start -> hit)
    const rayIn = [start, hit]
    // 2. Yansıyan ışın (hit -> image yönünde uzat)
    // Hit'den image'e giden vektör:
    const dx = image[0] - hit[0]
    const dy = image[1] - hit[1]
    
    let endX, endY
    let virtualEnd = null

    if (image[0] < 0) {
      // Görüntü GERÇEK (Aynanın önünde)
      // Işın hit noktasından geçer ve eksi sonsuza doğru gider
      // image noktası üzerinden geçirerek uzat
      const t = -60 / dx // dx negatif olmalı
      endX = hit[0] + dx * t
      endY = hit[1] + dy * t
    } else {
      // Görüntü SANAL (Aynanın arkasında)
      // Yansıyan ışın hit noktasından eksi x'e doğru gider
      // Ama aynanın arkasındaki image noktasından çıkıyormuş gibi görünür
      const t = -60 / dx // dx pozitif
      endX = hit[0] - dx * t // ters yöne uzat (aynanın önü)
      endY = hit[1] - dy * t
      virtualEnd = [hit, image] // Kesikli çizgi için
    }

    const rayOut = [hit, [endX, endY, 0]]
    return { rayIn, rayOut, virtualEnd }
  }

  // Cismin temel ışınları
  const objRays = []
  if (!isObjAtFocus) {
    // Işın 1: Asal eksene paralel gelir, görüntü noktasından geçer
    objRays.push(createRay([objX, objH, 0], [0, objH, 0], [imageX, imageH, 0]))
    // Işın 2: Tepe noktasına gelir, görüntü noktasından geçer
    objRays.push(createRay([objX, objH, 0], [0, 0, 0], [imageX, imageH, 0]))
  }

  // Lazer (Işık kaynağı) ışınları
  const lightRays = []
  if (!isLightAtFocus) {
    // Aynanın üstüne ve altına vuran iki lazer ışını
    lightRays.push(createRay([lightX, 0.5, 0], [0, 8, 0], [lightImageX, 0]))
    lightRays.push(createRay([lightX, 0.5, 0], [0, -2, 0], [lightImageX, 0]))
  }

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", background: "#050510" }}>
      
      {/* ─── KONTROL PANELİ ───────────────────────────────────────────── */}
      <div className="left-panel" style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10, fontFamily: 'sans-serif' }}>
        <div className="left-panel" style={panelStyle}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#000', textAlign: 'center' }}>
            OPTICS & MIRRORS
          </h3>

          <div style={cardStyle('#81d4fa')}>
            <label style={lblStyle}>MIRROR TYPE</label>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
              <button onClick={() => setMirrorType('plane')} style={btnStyle(mirrorType === 'plane')}>PLANE</button>
              <button onClick={() => setMirrorType('concave')} style={btnStyle(mirrorType === 'concave')}>CONCAVE</button>
              <button onClick={() => setMirrorType('convex')} style={btnStyle(mirrorType === 'convex')}>CONVEX</button>
            </div>

            {mirrorType !== 'plane' && (
              <>
                <label style={lblStyle}>FOCAL LENGTH: {focalLength} u</label>
                <input type="range" min={5} max={30} step={1} value={focalLength}
                  onChange={e => setFocalLength(+e.target.value)}
                  style={{ width: '100%', marginBottom: 6 }} />
              </>
            )}
          </div>

          <div style={cardStyle(OBJECT_COLOR)}>
            <label style={lblStyle}>OBJECT POS (X): {objX.toFixed(1)}</label>
            <input type="range" min={-40} max={-2} step={0.5} value={objX}
              onChange={e => setObjX(+e.target.value)}
              style={{ width: '100%', marginBottom: 6 }} />

            <label style={lblStyle}>OBJECT HEIGHT: {objH.toFixed(1)}</label>
            <input type="range" min={1} max={10} step={0.5} value={objH}
              onChange={e => setObjH(+e.target.value)}
              style={{ width: '100%', marginBottom: 6 }} />

            {!isObjAtFocus && (
              <div style={{ marginTop: 8, fontSize: '12px', color: '#333' }}>
                <div>Image X: <b>{imageX.toFixed(1)}</b></div>
                <div>Image H: <b>{imageH.toFixed(1)}</b></div>
                <div>Type: <b>{isObjVirtual ? 'VIRTUAL (Sanal)' : 'REAL (Gerçek)'}</b></div>
              </div>
            )}
            {isObjAtFocus && <div style={{ color: 'red', fontSize: '12px', fontWeight: 'bold' }}>IMAGE AT INFINITY</div>}
            
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" id="chk-obj-rays" checked={showObjRays} onChange={e => setShowObjRays(e.target.checked)} style={{ cursor: 'pointer' }} />
              <label htmlFor="chk-obj-rays" style={{ fontSize: '11px', fontWeight: 'bold', color: '#333', cursor: 'pointer' }}>SHOW OBJECT RAYS</label>
            </div>
          </div>

          <div style={cardStyle(LIGHT_COLOR)}>
            <label style={lblStyle}>LIGHT SOURCE (X): {lightX.toFixed(1)}</label>
            <input type="range" min={-40} max={-2} step={0.5} value={lightX}
              onChange={e => setLightX(+e.target.value)}
              style={{ width: '100%', marginBottom: 6 }} />
              
            {!isLightAtFocus && (
              <div style={{ marginTop: 8, fontSize: '12px', color: '#333' }}>
                <div>Focus Point (X): <b>{lightImageX.toFixed(1)}</b></div>
              </div>
            )}
            
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" id="chk-light-rays" checked={showLightRays} onChange={e => setShowLightRays(e.target.checked)} style={{ cursor: 'pointer' }} />
              <label htmlFor="chk-light-rays" style={{ fontSize: '11px', fontWeight: 'bold', color: '#333', cursor: 'pointer' }}>SHOW LIGHT RAYS</label>
            </div>
          </div>

        </div>
      </div>

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
          top: '252px',
          right: '24px',
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
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>ANGLE: {lightAngle}°</label>
          <input type="range" min="0" max="360" step="1" value={lightAngle} onChange={e => setLightAngle(Number(e.target.value))} style={{ width: '100%', marginBottom: '10px' }} />
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>INTENSITY: {lightIntensity.toFixed(1)}</label>
          <input type="range" min="0" max="3" step="0.1" value={lightIntensity} onChange={e => setLightIntensity(Number(e.target.value))} style={{ width: '100%' }} />
        </div>
      )}

      {/* ─── 3D SCENE ──────────────────────────────────────────────────────── */}
      <Canvas camera={{ position: [0, 15, 45], fov: 45 }}>
        <color attach="background" args={['#050510']} />
        
        <ambientLight intensity={0.4} />
        <directionalLight 
          position={[
            Math.cos(lightAngle * Math.PI / 180) * 30, 
            20, 
            Math.sin(lightAngle * Math.PI / 180) * 30
          ]} 
          intensity={lightIntensity} 
        />

        <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2 + 0.1} />

        {/* Zemin Izgarası */}
        <gridHelper args={[100, 100, '#222', '#111']} position={[0, -0.01, 0]} />

        {/* X Ekseni Asal Eksen */}
        <Line points={[[-50, 0, 0], [50, 0, 0]]} color="#ffffff" lineWidth={2} />

        {/* Ayna */}
        <MirrorGeometry type={mirrorType} focalLength={focalLength} />
        <Billboard position={[0, -2, 0]}>
          <Text fontSize={1} color="#81d4fa">MIRROR</Text>
        </Billboard>

        {/* Odak Noktası İşaretçileri */}
        {mirrorType !== 'plane' && (
          <>
            <mesh position={[-focalLength, 0, 0]}>
              <sphereGeometry args={[0.3]} />
              <meshBasicMaterial color="#4caf50" />
            </mesh>
            <Billboard position={[-focalLength, -1, 0]}>
              <Text fontSize={0.8} color="#4caf50">F</Text>
            </Billboard>

            {/* Merkez Noktası (2F) */}
            <mesh position={[-2 * focalLength, 0, 0]}>
              <sphereGeometry args={[0.3]} />
              <meshBasicMaterial color="#ff9800" />
            </mesh>
            <Billboard position={[-2 * focalLength, -1, 0]}>
              <Text fontSize={0.8} color="#ff9800">2F</Text>
            </Billboard>
          </>
        )}

        {/* Cisim */}
        <ArrowObject x={objX} height={objH} color={OBJECT_COLOR} isVirtual={false} />

        {/* Görüntü */}
        {!isObjAtFocus && (
          <ArrowObject x={imageX} height={imageH} color={IMAGE_COLOR} isVirtual={isObjVirtual} />
        )}

        {/* Işık Kaynağı */}
        <mesh position={[lightX, 0.5, 0]}>
          <sphereGeometry args={[0.6]} />
          <meshBasicMaterial color={LIGHT_COLOR} />
          <pointLight color={LIGHT_COLOR} intensity={2} distance={20} />
        </mesh>
        <Billboard position={[lightX, -1, 0]}>
          <Text fontSize={0.8} color={LIGHT_COLOR}>LIGHT</Text>
        </Billboard>

        {/* Işın Çizimleri */}
        {showObjRays && objRays.map((r, i) => (
          <group key={`obj-ray-${i}`}>
            <Line points={r.rayIn} color={RAY_OBJ_COLOR} lineWidth={2} />
            <Line points={r.rayOut} color={RAY_OBJ_COLOR} lineWidth={2} />
            {r.virtualEnd && (
              <Line points={r.virtualEnd} color={RAY_OBJ_COLOR} lineWidth={1.5} dashed dashScale={2} dashSize={0.5} gapSize={0.2} />
            )}
          </group>
        ))}

        {showLightRays && lightRays.map((r, i) => (
          <group key={`light-ray-${i}`}>
            <Line points={r.rayIn} color={RAY_LIGHT_COLOR} lineWidth={1.5} />
            <Line points={r.rayOut} color={RAY_LIGHT_COLOR} lineWidth={1.5} />
            {r.virtualEnd && (
              <Line points={r.virtualEnd} color={RAY_LIGHT_COLOR} lineWidth={1} dashed dashScale={2} dashSize={0.5} gapSize={0.2} />
            )}
          </group>
        ))}

      </Canvas>
    </div>
  )
}
