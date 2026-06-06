import React, { useState } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, Text } from "@react-three/drei"
import * as THREE from "three"
import { getGroundTexture } from "./utils"

// ─── RENKLER ────────────────────────────────────────────────────────────────
const COLORS = [
  { char: 'W', hex: '#ffffff', name: 'White' },
  { char: 'R', hex: '#ff0000', name: 'Red' },
  { char: 'G', hex: '#00ff00', name: 'Green' },
  { char: 'B', hex: '#0000ff', name: 'Blue' },
  { char: 'C', hex: '#00ffff', name: 'Cyan' },
  { char: 'M', hex: '#ff00ff', name: 'Magenta' },
  { char: 'Y', hex: '#ffff00', name: 'Yellow' }
]

const LIGHT_COLORS = [
  { hex: '#ffffff', name: 'White (RGB)' },
  { hex: '#ff0000', name: 'Red (R)' },
  { hex: '#00ff00', name: 'Green (G)' },
  { hex: '#0000ff', name: 'Blue (B)' },
  { hex: '#00ffff', name: 'Cyan (G+B)' },
  { hex: '#ff00ff', name: 'Magenta (R+B)' },
  { hex: '#ffff00', name: 'Yellow (R+G)' }
]

// ─── SAHNE ──────────────────────────────────────────────────────────────────
function LightScene({ lightColor }) {
  const groundTex = getGroundTexture()

  return (
    <>
      {/* ── ORTAM IŞIĞI (Seçilen Renkte Tüm Odayı Aydınlatır) ── */}
      <ambientLight intensity={0.5} color={lightColor} />

      {/* ── YÖNLÜ IŞIK (Seçilen Renkte, Gölgeler ve Derinlik İçin) ── */}
      <directionalLight
        position={[0, 5, 10]}
        intensity={2.0}
        color={lightColor}
        castShadow
      />

      {/* ── ZEMİN ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial map={groundTex} roughness={0.8} />
      </mesh>

      {/* ── DUVAR ── */}
      <mesh position={[0, 2.5, -0.5]} receiveShadow>
        <boxGeometry args={[14, 5, 1]} />
        <meshStandardMaterial color="#222222" roughness={0.9} />
      </mesh>

      {/* ── HARFLER (Baş Harfler) ── */}
      {COLORS.map((item, index) => {
        const xPos = -6 + index * 2
        return (
          <group key={index} position={[xPos, 2.5, 0.01]}>
            <Text
              fontSize={1.5}
              fontWeight="bold"
              anchorX="center"
              anchorY="middle"
            >
              <meshLambertMaterial attach="material" color={item.hex} />
              {item.char}
            </Text>
            {/* Alt Etiket (Harfin Orijinal Rengi) */}
            <Text
              position={[0, -1.8, 0]}
              fontSize={0.25}
              color="#aaaaaa"
              anchorX="center"
              anchorY="middle"
            >
              <meshBasicMaterial attach="material" color="#aaaaaa" />
              {item.name}
            </Text>
          </group>
        )
      })}
    </>
  )
}

// ─── RENK ŞEMALARI (CSS ile Dinamik Üretilmiş) ──────────────────────────────
const VennRGB = () => (
  <div style={{ position: 'relative', width: '140px', height: '140px', background: '#000', borderRadius: '12px', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', top: '5%', left: '25%', width: '50%', height: '50%', background: '#ff0000', borderRadius: '50%', mixBlendMode: 'screen' }} />
    <div style={{ position: 'absolute', bottom: '10%', left: '10%', width: '50%', height: '50%', background: '#00ff00', borderRadius: '50%', mixBlendMode: 'screen' }} />
    <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: '50%', height: '50%', background: '#0000ff', borderRadius: '50%', mixBlendMode: 'screen' }} />
  </div>
)

const VennCMY = () => (
  <div style={{ position: 'relative', width: '140px', height: '140px', background: '#fff', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
    <div style={{ position: 'absolute', top: '5%', left: '25%', width: '50%', height: '50%', background: '#ffff00', borderRadius: '50%', mixBlendMode: 'multiply' }} />
    <div style={{ position: 'absolute', bottom: '10%', left: '10%', width: '50%', height: '50%', background: '#ff00ff', borderRadius: '50%', mixBlendMode: 'multiply' }} />
    <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: '50%', height: '50%', background: '#00ffff', borderRadius: '50%', mixBlendMode: 'multiply' }} />
  </div>
)

// ─── ANA BİLEŞEN ────────────────────────────────────────────────────────────
export default function LightColors() {
  const [selectedLight, setSelectedLight] = useState('#ffffff')

  // UI Stilleri
  const panelStyle = { position: 'absolute', top: 24, left: 24, zIndex: 10, display: 'flex', flexDirection: 'column', gap: '16px', width: '320px', fontFamily: "'Inter', sans-serif" }
  const cardStyle = { background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(12px)', borderRadius: '16px', padding: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.4)', borderLeft: '4px solid #3b82f6' }
  const sectionTitleStyle = { margin: '0 0 12px 0', fontSize: '13px', fontWeight: '800', letterSpacing: '0.5px', color: '#1e293b' }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000000', overflow: 'hidden', position: 'relative' }}>
      
      {/* ── KONTROL PANELİ ── */}
      <div className="left-panel" style={panelStyle}>
        
        {/* Ortam Rengi Kartı */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>ENVIRONMENT COLOR</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {LIGHT_COLORS.map(light => (
              <button
                key={light.name}
                onClick={() => setSelectedLight(light.hex)}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  border: selectedLight === light.hex ? '2px solid #000' : '2px solid transparent',
                  background: light.hex,
                  color: ['#ffffff', '#00ffff', '#00ff00', '#ffff00'].includes(light.hex) ? '#000' : '#fff',
                  fontWeight: 'bold',
                  fontSize: '11px',
                  cursor: 'pointer',
                  boxShadow: selectedLight === light.hex ? `0 4px 12px ${light.hex}` : 'none',
                  textShadow: ['#ffffff', '#00ffff', '#00ff00', '#ffff00'].includes(light.hex) ? 'none' : '0 1px 3px rgba(0,0,0,0.8)',
                  transition: 'all 0.2s'
                }}
              >
                {light.name}
              </button>
            ))}
          </div>
        </div>

        {/* Renk Şemaları (Venn Diyagramları) Kartı */}
        <div style={{...cardStyle, borderLeft: '4px solid #f59e0b'}}>
          <div style={sectionTitleStyle}>COLOR MIXING CHARTS</div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', marginTop: '16px', gap: '24px' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <VennRGB />
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>ADDITIVE (Light)</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <VennCMY />
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>SUBTRACTIVE (Pigment)</span>
            </div>

          </div>
        </div>

      </div>

      {/* ── 3D SAHNE ── */}
      <Canvas flat shadows camera={{ position: [0, 2.5, 12], fov: 45 }}>
        <color attach="background" args={["#000000"]} />
        <LightScene lightColor={selectedLight} />
        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 + 0.1} />
      </Canvas>

    </div>
  )
}
