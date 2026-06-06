import React, { useState, useMemo, useRef, useEffect } from "react"
import { LightBulbIcon } from './Icons'
import * as THREE from "three"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls, Text, Billboard, Line } from "@react-three/drei"
import SpotLightFixture from "./SpotLightFixture"

// ─── RENK PALETİ ────────────────────────────────────────────────────────────
const VECTOR_COLORS = [
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
]
const RESULTANT_COLOR = '#ef4444'
const SUBSCRIPTS = ['₁','₂','₃','₄','₅','₆','₇','₈','₉','₁₀','₁₁','₁₂']

// ─── GÜNEŞ IŞIĞI ─────────────────────────────────────────────────────────────
function SunLight({ lightAngle, intensity }) {
  const lightRef = useRef()
  const { scene } = useThree()

  useEffect(() => {
    if (lightRef.current) {
      scene.add(lightRef.current.target)
      return () => {
        if (lightRef.current) {
          scene.remove(lightRef.current.target)
        }
      }
    }
  }, [scene])

  const rad = lightAngle * Math.PI / 180
  const lightX = Math.cos(rad) * 40
  const lightY = 40
  const lightZ = Math.sin(rad) * 40

  useEffect(() => {
    if (lightRef.current) {
      lightRef.current.target.position.set(0, 0, 0)
      lightRef.current.target.updateMatrixWorld()
    }
  }, [lightAngle])

  return (
    <directionalLight
      ref={lightRef}
      position={[lightX, lightY, lightZ]}
      intensity={intensity}
      castShadow
      shadow-camera-left={-30}
      shadow-camera-right={30}
      shadow-camera-top={30}
      shadow-camera-bottom={-30}
      shadow-camera-near={0.5}
      shadow-camera-far={100}
      shadow-mapSize={[2048, 2048]}
      shadow-bias={-0.001}
    />
  )
}

// ─── ZEMİN ───────────────────────────────────────────────────────────────────
function Ground() {
  return null
}

// ─── 3D KUVVET OKU ───────────────────────────────────────────────────────────
// Vektörler XZ düzleminde (Y=0.05), X ekseni → Three.js X, Y ekseni → Three.js -Z
function ForceArrow({ magnitude, angle, color, isResultant = false, isSelected = false }) {
  // Açıyı 3D'ye çevir: angle=0 → +X, angle=90 → -Z yönü
  const angleRad = (angle * Math.PI) / 180
  if (magnitude < 0.05) return null

  const headLength = Math.min(0.6, magnitude * 0.18)
  const headRadius = isResultant ? 0.28 : 0.18
  const shaftW = isResultant ? 0.14 : 0.1
  const shaftLength = magnitude - headLength
  const yPos = isResultant ? 0.12 : 0.08

  return (
    <group position={[0, yPos, 0]} rotation={[0, angleRad, 0]}>
      {/* Gövde (X ekseni boyunca) */}
      <mesh position={[shaftLength / 2, 0, 0]} castShadow>
        <boxGeometry args={[shaftLength, shaftW, shaftW]} />
        <meshStandardMaterial
          color={color}
          roughness={0.4}
          metalness={0.2}
        />
      </mesh>
      {/* Ok Ucu */}
      <mesh
        position={[shaftLength + headLength / 2, 0, 0]}
        rotation={[0, 0, -Math.PI / 2]}
        castShadow
      >
        <coneGeometry args={[headRadius, headLength, 16]} />
        <meshStandardMaterial
          color={color}
          roughness={0.4}
          metalness={0.2}
        />
      </mesh>
      {/* Seçili glow efekti */}
      {isSelected && (
        <mesh position={[magnitude / 2, -0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[magnitude + 0.6, 0.6]} />
          <meshBasicMaterial color={color} transparent opacity={0.15} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* Büyüklük etiketi */}
      <Billboard position={[magnitude / 2, 0.6, 0]}>
        <Text
          fontSize={0.35}
          color={color}
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.03}
          outlineColor="#000000"
        >
          {magnitude.toFixed(1)}N
        </Text>
      </Billboard>
    </group>
  )
}

// ─── BİLEŞKE KESİKLİ ÇİZGİLER ──────────────────────────────────────────────
// XZ düzleminde: Fx → X yönü, Fy → -Z yönü
function ResultantDashes({ resultant }) {
  if (!resultant || resultant.magnitude < 0.05) return null
  const { fx, fy } = resultant
  const y = 0.06

  return (
    <group>
      {/* Fx bileşeni — X ekseni boyunca */}
      {Math.abs(fx) > 0.01 && (
        <Line
          points={[[0, y, 0], [fx, y, 0]]}
          color={RESULTANT_COLOR}
          lineWidth={1.5}
          dashed
          dashSize={0.25}
          gapSize={0.2}
        />
      )}
      {/* Fy bileşeni — -Z ekseni boyunca (Fx ucundan) */}
      {Math.abs(fy) > 0.01 && (
        <Line
          points={[[fx, y, 0], [fx, y, -fy]]}
          color={RESULTANT_COLOR}
          lineWidth={1.5}
          dashed
          dashSize={0.25}
          gapSize={0.2}
        />
      )}
    </group>
  )
}

// ─── EKSEN ÇİZGİLERİ VE BÜYÜKLÜK İŞARETLERİ ────────────────────────────────
// X ekseni: Three.js +X yönü, Y ekseni: Three.js -Z yönü
function Axes({ range = 10 }) {
  const tickSize = 0.15
  const y = 0.03 // Zeminin hemen üstü

  const xTicks = useMemo(() => {
    const ticks = []
    for (let i = -range; i <= range; i++) {
      if (i === 0) continue
      ticks.push(
        <group key={`xt-${i}`}>
          {/* Tick çizgisi */}
          <mesh position={[i, y, 0]}>
            <boxGeometry args={[0.04, 0.02, tickSize * 2]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          {/* Sayı etiketi */}
          <Billboard position={[i, y + 0.05, 0.45]}>
            <Text fontSize={0.28} color="#ffffff" outlineWidth={0.015} outlineColor="#000000">
              {i}
            </Text>
          </Billboard>
        </group>
      )
    }
    return ticks
  }, [range])

  const yTicks = useMemo(() => {
    const ticks = []
    for (let i = -range; i <= range; i++) {
      if (i === 0) continue
      ticks.push(
        <group key={`yt-${i}`}>
          {/* Tick çizgisi */}
          <mesh position={[0, y, -i]}>
            <boxGeometry args={[tickSize * 2, 0.02, 0.04]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          {/* Sayı etiketi */}
          <Billboard position={[-0.45, y + 0.05, -i]}>
            <Text fontSize={0.28} color="#ffffff" outlineWidth={0.015} outlineColor="#000000">
              {i}
            </Text>
          </Billboard>
        </group>
      )
    }
    return ticks
  }, [range])

  return (
    <group>
      {/* X Ekseni çizgisi */}
      <mesh position={[0, y, 0]}>
        <boxGeometry args={[range * 2 + 0.6, 0.06, 0.06]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {/* Y Ekseni çizgisi (Three.js -Z yönünde) */}
      <mesh position={[0, y, 0]}>
        <boxGeometry args={[0.06, 0.06, range * 2 + 0.6]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* X ok ucu */}
      <mesh position={[range + 0.4, y, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.18, 0.5, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {/* Y ok ucu (-Z yönü) */}
      <mesh position={[0, y, -(range + 0.4)]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.18, 0.5, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Eksen etiketleri */}
      <Billboard position={[range + 0.9, 0.3, 0]}>
        <Text fontSize={0.5} color="#ffffff" fontWeight="bold">
          X
        </Text>
      </Billboard>
      <Billboard position={[0, 0.3, -(range + 0.9)]}>
        <Text fontSize={0.5} color="#ffffff" fontWeight="bold">
          Y
        </Text>
      </Billboard>

      {/* Orijin etiketi */}
      <Billboard position={[-0.35, 0.15, 0.35]}>
        <Text fontSize={0.3} color="#ffffff" fontWeight="bold" outlineWidth={0.02} outlineColor="#000000">
          0
        </Text>
      </Billboard>

      {xTicks}
      {yTicks}
    </group>
  )
}

// ─── ZEMIN GRID ÇİZGİLERİ ───────────────────────────────────────────────────
function FloorGrid({ range = 10 }) {
  const lines = useMemo(() => {
    const result = []
    for (let i = -range; i <= range; i++) {
      const isMajor = i % 5 === 0
      const color = isMajor ? "#0ea5e9" : "#1e3a8a" // Açık mavi (neon) / Koyu lacivert
      const lw = isMajor ? 1.5 : 0.6
      const y = -0.49 // Zeminin (y=-0.5) tam üstü

      // X yönünde çizgiler (Z sabit)
      result.push(
        <Line
          key={`gx-${i}`}
          points={[[-range, y, i], [range, y, i]]}
          color={color}
          lineWidth={lw}
        />
      )
      // Z yönünde çizgiler (X sabit)
      result.push(
        <Line
          key={`gz-${i}`}
          points={[[i, y, -range], [i, y, range]]}
          color={color}
          lineWidth={lw}
        />
      )
    }
    return result
  }, [range])

  return <group>{lines}</group>
}

// ─── ORİJİN İŞARETÇİSİ ──────────────────────────────────────────────────────
function OriginMarker() {
  return (
    <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.15, 24]} />
      <meshBasicMaterial color="#333333" />
    </mesh>
  )
}

// ─── ANA BİLEŞEN ────────────────────────────────────────────────────────────
export default function ForceVectors() {
  const [vectors, setVectors] = useState([])
  const [selectedVectorId, setSelectedVectorId] = useState(null)
  const [nextId, setNextId] = useState(1)

  // Işık ayarları
  const [lightAngle, setLightAngle] = useState(45)
  const [lightIntensity, setLightIntensity] = useState(1.5)
  const [lightPanelOpen, setLightPanelOpen] = useState(false)

  // Bileşke hesapla
  const resultant = useMemo(() => {
    if (vectors.length === 0) return { magnitude: 0, angle: 0, fx: 0, fy: 0 }

    let fx = 0, fy = 0
    vectors.forEach(v => {
      const rad = (v.angle * Math.PI) / 180
      fx += v.magnitude * Math.cos(rad)
      fy += v.magnitude * Math.sin(rad)
    })

    const magnitude = Math.sqrt(fx * fx + fy * fy)
    const angleDeg = (Math.atan2(fy, fx) * 180) / Math.PI
    return {
      magnitude,
      angle: angleDeg < 0 ? angleDeg + 360 : angleDeg,
      fx,
      fy
    }
  }, [vectors])

  const addVector = () => {
    const colorIndex = vectors.length % VECTOR_COLORS.length
    const newVector = {
      id: nextId,
      magnitude: 3,
      angle: vectors.length * 45,
      color: VECTOR_COLORS[colorIndex],
    }
    setVectors(prev => [...prev, newVector])
    setSelectedVectorId(nextId)
    setNextId(prev => prev + 1)
  }

  const removeVector = (id) => {
    setVectors(prev => prev.filter(v => v.id !== id))
    if (selectedVectorId === id) setSelectedVectorId(null)
  }

  const updateVector = (id, field, value) => {
    setVectors(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v))
  }

  const clearAll = () => {
    setVectors([])
    setSelectedVectorId(null)
  }

  // SpotLightFixture pozisyonu
  const spotLightPos = [
    Math.cos(lightAngle * Math.PI / 180) * 40,
    40,
    Math.sin(lightAngle * Math.PI / 180) * 40
  ]

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", background: "#000000" }}>

      {/* ─── KONTROL PANELİ ───────────────────────────────────────────── */}
      <div className="left-panel" style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10, fontFamily: 'sans-serif' }}>
        <div style={{
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
          maxHeight: 'calc(100vh - 120px)',
          overflowY: 'auto',
        }}>
          <h3 style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#000', textAlign: 'center' }}>
            FORCE VECTORS
          </h3>

          {/* Vektör Ekle Butonu */}
          <button
            id="add-vector-btn"
            onClick={addVector}
            style={{
              padding: '14px',
              cursor: 'pointer',
              background: '#000',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '12px',
              letterSpacing: '0.5px',
            }}
          >
            + ADD FORCE VECTOR
          </button>

          {/* Vektör Listesi */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}>
            {vectors.map((v, index) => {
              const isSelected = v.id === selectedVectorId
              const fx = v.magnitude * Math.cos(v.angle * Math.PI / 180)
              const fy = v.magnitude * Math.sin(v.angle * Math.PI / 180)

              return (
                <div
                  key={v.id}
                  id={`vector-card-${v.id}`}
                  onClick={() => setSelectedVectorId(v.id)}
                  style={{
                    background: isSelected ? '#f0f0ff' : '#f9f9f9',
                    padding: '10px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    border: isSelected ? `2px solid ${v.color}` : '2px solid transparent',
                    transition: 'all 0.2s',
                    boxShadow: isSelected ? `0 2px 12px ${v.color}33` : 'none',
                  }}
                >
                  {/* Başlık */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        background: v.color,
                        boxShadow: `0 0 8px ${v.color}88`,
                        flexShrink: 0,
                      }} />
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#222' }}>
                        F{SUBSCRIPTS[index] || `(${index + 1})`}
                      </span>
                    </div>
                    <button
                      id={`delete-vector-${v.id}`}
                      onClick={(e) => { e.stopPropagation(); removeVector(v.id) }}
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '6px',
                        border: 'none',
                        background: '#fee2e2',
                        color: '#dc2626',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        padding: 0,
                        lineHeight: 1,
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Açı kontrolü */}
                  <div style={{ marginBottom: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#333' }}>ANGLE</label>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#222' }}>{Math.round(v.angle)}°</span>
                    </div>
                    <input
                      type="range"
                      min={0} max={360} step={1}
                      value={v.angle}
                      onChange={(e) => updateVector(v.id, 'angle', Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>

                  {/* Büyüklük kontrolü */}
                  <div style={{ marginBottom: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#333' }}>MAGNITUDE</label>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#222' }}>{v.magnitude.toFixed(1)} N</span>
                    </div>
                    <input
                      type="range"
                      min={0.5} max={10} step={0.1}
                      value={v.magnitude}
                      onChange={(e) => updateVector(v.id, 'magnitude', Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>

                  {/* Bileşen gösterimi */}
                  <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: '600',
                      color: '#666',
                      background: '#e8e8e8',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}>
                      Fx: {fx.toFixed(2)}
                    </span>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: '600',
                      color: '#666',
                      background: '#e8e8e8',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}>
                      Fy: {fy.toFixed(2)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Bileşke Bilgi Kutusu */}
          {vectors.length > 0 && (
            <div style={{
              background: '#fff5f5',
              padding: '10px',
              borderRadius: '8px',
              border: `2px solid ${RESULTANT_COLOR}44`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  background: RESULTANT_COLOR,
                  boxShadow: `0 0 10px ${RESULTANT_COLOR}88`,
                }} />
                <span style={{ fontSize: '12px', fontWeight: '700', color: RESULTANT_COLOR, letterSpacing: '0.5px' }}>
                  RESULTANT
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555' }}>
                  <span>|F| =</span>
                  <span style={{ fontWeight: '700', color: '#222' }}>{resultant.magnitude.toFixed(2)} N</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555' }}>
                  <span>θ =</span>
                  <span style={{ fontWeight: '700', color: '#222' }}>{resultant.magnitude > 0.05 ? resultant.angle.toFixed(1) : '—'}°</span>
                </div>
                <div style={{
                  display: 'flex',
                  gap: '6px',
                  marginTop: '4px',
                  paddingTop: '6px',
                  borderTop: '1px solid #fecaca',
                }}>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '600',
                    color: RESULTANT_COLOR,
                    background: '#fef2f2',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: '1px solid #fecaca',
                  }}>
                    Fx: {resultant.fx.toFixed(2)}
                  </span>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '600',
                    color: RESULTANT_COLOR,
                    background: '#fef2f2',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: '1px solid #fecaca',
                  }}>
                    Fy: {resultant.fy.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Tümünü Temizle */}
          {vectors.length > 0 && (
            <button
              id="clear-all-vectors-btn"
              onClick={clearAll}
              style={{
                padding: '8px',
                cursor: 'pointer',
                background: '#ffebee',
                color: '#d32f2f',
                border: '1px solid #ef9a9a',
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '11px',
              }}
            >
              CLEAR ALL
            </button>
          )}
        </div>
      </div>

      {/* ─── IŞIK KONTROLLERİ BUTONU (SAĞ ÜST) ────────────────────────── */}
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

      {/* ─── 3D SAHNE ─────────────────────────────────────────────────── */}
      <Canvas
        shadows
        camera={{ position: [20, 16, 20], fov: 40 }}
        style={{ background: "#000000" }}
      >
        <color attach="background" args={["#000000"]} />
        <ambientLight intensity={0.6} />
        <SunLight lightAngle={lightAngle} intensity={lightIntensity} />
        <OrbitControls makeDefault />
        <SpotLightFixture
          lightPos={spotLightPos}
          target={[0, 0, 0]}
          intensity={lightIntensity}
        />

        <Ground />
        <FloorGrid range={10} />
        <Axes range={10} />
        <OriginMarker />

        {/* Kuvvet Vektörleri */}
        {vectors.map(v => (
          <ForceArrow
            key={v.id}
            magnitude={v.magnitude}
            angle={v.angle}
            color={v.color}
            isSelected={v.id === selectedVectorId}
          />
        ))}

        {/* Bileşke Kuvvet Vektörü */}
        {vectors.length > 0 && resultant.magnitude > 0.05 && (
          <>
            <ForceArrow
              magnitude={resultant.magnitude}
              angle={resultant.angle}
              color={RESULTANT_COLOR}
              isResultant={true}
            />
            <ResultantDashes resultant={resultant} />
          </>
        )}
      </Canvas>
    </div>
  )
}
