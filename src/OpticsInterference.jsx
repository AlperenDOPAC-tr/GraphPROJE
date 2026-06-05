import React, { useState, useMemo, useRef } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls, Text, Billboard, Edges, Environment, Grid } from "@react-three/drei"
import { getGroundTexture } from "./utils"
import * as THREE from "three"

// ─── UTILS ───────────────────────────────────────────────────────────────────
// Convert Wavelength (nm) to RGB
function waveLengthToRGB(Wavelength) {
  let factor, Red, Green, Blue
  if (Wavelength >= 380 && Wavelength < 440) {
    Red = -(Wavelength - 440) / (440 - 380)
    Green = 0.0
    Blue = 1.0
  } else if (Wavelength >= 440 && Wavelength < 490) {
    Red = 0.0
    Green = (Wavelength - 440) / (490 - 440)
    Blue = 1.0
  } else if (Wavelength >= 490 && Wavelength < 510) {
    Red = 0.0
    Green = 1.0
    Blue = -(Wavelength - 510) / (510 - 490)
  } else if (Wavelength >= 510 && Wavelength < 580) {
    Red = (Wavelength - 510) / (580 - 510)
    Green = 1.0
    Blue = 0.0
  } else if (Wavelength >= 580 && Wavelength < 645) {
    Red = 1.0
    Green = -(Wavelength - 645) / (645 - 580)
    Blue = 0.0
  } else if (Wavelength >= 645 && Wavelength <= 780) {
    Red = 1.0
    Green = 0.0
    Blue = 0.0
  } else {
    Red = 0.0
    Green = 0.0
    Blue = 0.0
  }
  // Intensity falls off near limits
  if (Wavelength >= 380 && Wavelength < 420) {
    factor = 0.3 + 0.7 * (Wavelength - 380) / (420 - 380)
  } else if (Wavelength >= 420 && Wavelength < 701) {
    factor = 1.0
  } else if (Wavelength >= 701 && Wavelength <= 780) {
    factor = 0.3 + 0.7 * (780 - Wavelength) / (780 - 700)
  } else {
    factor = 0.0
  }
  return new THREE.Color(
    Red === 0.0 ? 0 : (Red * factor),
    Green === 0.0 ? 0 : (Green * factor),
    Blue === 0.0 ? 0 : (Blue * factor)
  )
}

// ─── SHADER MATERIAL FOR SCREEN ──────────────────────────────────────────────
const InterferenceShader = {
  uniforms: {
    uColor: { value: new THREE.Color(1, 0, 0) },
    uL: { value: 2.0 }, // Screen distance (m)
    uLambda: { value: 600e-9 }, // Wavelength (m)
    uD: { value: 0.1e-3 }, // Slit separation (m)
    uW: { value: 0.02e-3 }, // Slit width (m)
    uN: { value: 1.0 }, // Medium refractive index
    uMode: { value: 1 }, // 0: Single, 1: Double
    uRotation: { value: 0 }, // Slit rotation (radians)
    uPhaseShift: { value: 0 }, // Glass phase shift
    uIntensity: { value: 1.0 },
    uScreenScale: { value: 1.0 }, // To map local coordinates
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    uniform float uL;
    uniform float uLambda;
    uniform float uD;
    uniform float uW;
    uniform float uN;
    uniform int uMode;
    uniform float uRotation;
    uniform float uPhaseShift;
    uniform float uIntensity;
    uniform float uScreenScale;

    varying vec2 vUv;

    #define PI 3.14159265359

    void main() {
      // Map UV (0 to 1) to physical screen coordinates (m)
      // Screen width is uScreenScale (e.g., 2.0 meters wide)
      vec2 pos = (vUv - 0.5) * uScreenScale;
      
      // Remove old coordinate rotation, because Y-axis rotation stretches the pattern, not rotates it.
      float x = pos.x;
      float y = pos.y;

      float sinTheta = x / sqrt(x*x + uL*uL);
      
      // Physics for rotated slit (Y-axis):
      float effW = uW * cos(uRotation);
      float effD = uD * cos(uRotation);
      float rotPhase = (2.0 * PI / uLambda) * uD * sin(uRotation);

      // Diffraction envelope (Single Slit)
      float beta = (PI * effW * uN * sinTheta) / uLambda;
      float sinc = (abs(beta) < 1e-6) ? 1.0 : sin(beta) / beta;
      float envelope = sinc * sinc;

      float intensity = 0.0;
      if (uMode == 0) {
        // Single Slit
        intensity = envelope;
      } else {
        // Double Slit
        float alpha = (PI * effD * uN * sinTheta) / uLambda + uPhaseShift * 0.5 + rotPhase * 0.5;
        float interference = cos(alpha) * cos(alpha);
        intensity = interference * envelope;
      }

      // Add beam profile falloff (laser beam isn't infinite)
      float r = length(pos);
      float beamFalloff = exp(- (r*r) / (uScreenScale * uScreenScale * 0.15));
      
      intensity *= beamFalloff * uIntensity;

      // Map to color and add some bloom-like over-saturation
      vec3 finalColor = uColor * intensity * 2.0;
      
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
}

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function LaserBeam({ color, distance }) {
  // A simple glowing beam from laser to slit
  return (
    <mesh position={[0, 0, distance / 2]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.02, 0.02, distance, 16]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} transparent opacity={0.6} />
    </mesh>
  )
}

function OpticsScene({ L, lambda, d, w, n, mode, rotation, glassPos, glassThickness, glassN, laserDist }) {
  const shaderRef = useRef()
  const color = useMemo(() => waveLengthToRGB(lambda), [lambda])

  // Calculate phase shift from glass plate
  // If glass is over slit 1 (top half in rotated frame, etc)
  // We simplify: Glass phase shift = (2pi/lambda) * (glassN - n) * glassThickness
  // For UI simplicity, glassPos will linearly blend phase shift from 0 to max
  // Slit positions in the simulation are roughly x = -0.1 and x = +0.1
  const leftCovered = Math.abs(glassPos - (-0.1)) < 0.075 ? 1 : 0
  const rightCovered = Math.abs(glassPos - 0.1) < 0.075 ? 1 : 0
  const maxPhaseShift = (2 * Math.PI / (lambda * 1e-9)) * (glassN - n) * (glassThickness * 1e-3)
  const currentPhaseShift = maxPhaseShift * (rightCovered - leftCovered)

  useFrame(() => {
    if (shaderRef.current) {
      shaderRef.current.uniforms.uColor.value = color
      shaderRef.current.uniforms.uL.value = L
      shaderRef.current.uniforms.uLambda.value = lambda * 1e-9
      shaderRef.current.uniforms.uD.value = d * 1e-3
      shaderRef.current.uniforms.uW.value = w * 1e-3
      shaderRef.current.uniforms.uN.value = n
      shaderRef.current.uniforms.uMode.value = mode === "single" ? 0 : 1
      shaderRef.current.uniforms.uRotation.value = (rotation * Math.PI) / 180
      shaderRef.current.uniforms.uPhaseShift.value = currentPhaseShift
      shaderRef.current.uniforms.uScreenScale.value = 0.2 // Zoom in to see the mm-scale fringes
    }
  })

  // Physical Layout
  const screenDistance = L * 2 // Scale factor for visuals
  const screenWidth = 4.0

  return (
    <>
      <group position={[0, 1, -screenDistance / 2]}>
        {/* ── LASER SOURCE ── */}
        <group position={[0, 0, -laserDist]}>
          <mesh position={[0, 0, -0.2]}>
            <boxGeometry args={[0.3, 0.3, 0.6]} />
            <meshStandardMaterial color="#222" metalness={0.8} roughness={0.2} />
          </mesh>
          <LaserBeam color={color} distance={laserDist} />
        </group>

      {/* ── SLIT PLATE ── */}
      <group position={[0, 0, 0]}>
        <mesh rotation={[0, (rotation * Math.PI) / 180, 0]}>
          <boxGeometry args={[1, 1, 0.05]} />
          <meshStandardMaterial color="#333" metalness={0.5} roughness={0.5} />
          {/* Visual Slits */}
          {mode === "single" ? (
            <mesh position={[0, 0, 0.026]}>
              <planeGeometry args={[0.05, 0.5]} />
              <meshBasicMaterial color="#000" />
            </mesh>
          ) : (
            <group position={[0, 0, 0.026]}>
              <mesh position={[-0.1, 0, 0]}><planeGeometry args={[0.02, 0.5]} /><meshBasicMaterial color="#000" /></mesh>
              <mesh position={[0.1, 0, 0]}><planeGeometry args={[0.02, 0.5]} /><meshBasicMaterial color="#000" /></mesh>
            </group>
          )}
          {/* Glass Plate Vis */}
          <mesh position={[glassPos, 0, 0.05]}>
            <boxGeometry args={[0.15, 0.6, 0.02]} />
            <meshStandardMaterial color="cyan" transparent opacity={0.6} clearcoat={1} />
          </mesh>
        </mesh>
      </group>

      {/* ── DIFFRACTED BEAM (Cone visualization) ── */}
      <mesh position={[0, 0, screenDistance / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[screenWidth / 2, 0.05, screenDistance, 32, 1, true]} />
        <meshStandardMaterial color={color} transparent opacity={0.05} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* ── SCREEN ── */}
      <mesh position={[0, 0, screenDistance]} castShadow receiveShadow>
        <planeGeometry args={[screenWidth, screenWidth]} />
        <shaderMaterial ref={shaderRef} args={[InterferenceShader]} side={THREE.DoubleSide} transparent />
        <Edges color="#555" />
      </mesh>

      </group>

      {/* ── STATIC GROUND ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow>
        <planeGeometry args={[10, 15]} />
        <meshStandardMaterial color="white" map={getGroundTexture()} roughness={0.8} metalness={0.2} />
      </mesh>
    </>
  )
}

export default function OpticsInterference() {
  const [mode, setMode] = useState("double") // "single" | "double"
  const [L, setL] = useState(2.0) // Screen distance (m)
  const [laserDist, setLaserDist] = useState(2.0) // Laser distance (m)
  const [lambda, setLambda] = useState(532) // Wavelength (nm)
  const [d, setD] = useState(0.1) // Slit separation (mm)
  const [w, setW] = useState(0.02) // Slit width (mm)
  const [n, setN] = useState(1.0) // Medium refractive index
  const [rotation, setRotation] = useState(0) // Slit rotation (deg)
  
  const [glassPos, setGlassPos] = useState(0) // 0 to 1
  const [glassThickness, setGlassThickness] = useState(0.01) // mm
  const [glassN, setGlassN] = useState(1.5) // Glass refractive index

  const dx = useMemo(() => {
    // dx = (L * lambda) / (d * n) for double, (L * lambda) / (w * n) for single
    const activeDivisor = mode === "double" ? (d * 1e-3) : (w * 1e-3)
    return (L * (lambda * 1e-9)) / (activeDivisor * n)
  }, [L, lambda, d, w, n, mode])

  const dx_mm = (dx * 1000).toFixed(2)

  // ─── STYLES ──────────────────────────────────────────────────────────────────
  const panelStyle = {
    position: 'absolute', top: '20px', left: '20px', width: '285px',
    background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(6px)',
    borderRadius: '12px', border: '1px solid #eee', color: '#333',
    padding: '20px', boxSizing: 'border-box', overflowY: 'auto',
    maxHeight: 'calc(100vh - 40px)',
    fontFamily: '"Inter", sans-serif', zIndex: 10,
    boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
    display: 'flex', flexDirection: 'column', gap: '12px'
  }
  const titleStyle = { margin: '0 0 4px 0', fontSize: '14px', fontWeight: 800, textAlign: 'center', color: '#000' }
  const lblStyle = { display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }
  const cardStyle = { background: '#f9f9f9', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #b000ff' }
  const singleCardStyle = { ...cardStyle, borderLeft: '4px solid #00e5ff' }
  
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000000', overflow: 'hidden', position: 'relative' }}>
      <div style={panelStyle}>
        <h2 style={titleStyle}>Double & Single Slit</h2>

        <div style={mode === "single" ? singleCardStyle : cardStyle}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button onClick={() => setMode("single")} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: mode === "single" ? '#00e5ff' : '#e0e0e0', color: mode === "single" ? '#000' : '#666', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', fontSize: '11px' }}>SINGLE</button>
            <button onClick={() => setMode("double")} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: mode === "double" ? '#b000ff' : '#e0e0e0', color: mode === "double" ? '#fff' : '#666', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', fontSize: '11px' }}>DOUBLE</button>
          </div>

          <label style={lblStyle}>SLIT ROTATION: {rotation}°</label>
          <input type="range" min={-70} max={70} step={1} value={rotation} onChange={e => setRotation(+e.target.value)} style={{ width: '100%', marginBottom: 12 }} />

          <label style={lblStyle}>WAVELENGTH (λ): {lambda} nm</label>
          <input type="range" min={380} max={750} step={1} value={lambda} onChange={e => setLambda(+e.target.value)} style={{ width: '100%', marginBottom: 12 }} />

          <label style={lblStyle}>SCREEN DISTANCE (L): {L.toFixed(1)} m</label>
          <input type="range" min={0.5} max={5.0} step={0.1} value={L} onChange={e => setL(+e.target.value)} style={{ width: '100%', marginBottom: 12 }} />

          <label style={lblStyle}>LASER DISTANCE: {laserDist.toFixed(1)} m</label>
          <input type="range" min={0.5} max={5.0} step={0.1} value={laserDist} onChange={e => setLaserDist(+e.target.value)} style={{ width: '100%', marginBottom: 12 }} />

          {mode === "double" && (
            <>
              <label style={lblStyle}>SLIT SEPARATION (d): {d.toFixed(2)} mm</label>
              <input type="range" min={0.05} max={0.5} step={0.01} value={d} onChange={e => setD(+e.target.value)} style={{ width: '100%', marginBottom: 12 }} />
            </>
          )}

          <label style={lblStyle}>SLIT WIDTH (w): {w.toFixed(2)} mm</label>
          <input type="range" min={0.01} max={0.2} step={0.01} value={w} onChange={e => setW(+e.target.value)} style={{ width: '100%', marginBottom: 12 }} />
          
          <label style={lblStyle}>MEDIUM REF. INDEX (n): {n.toFixed(2)}</label>
          <input type="range" min={1.0} max={2.0} step={0.01} value={n} onChange={e => setN(+e.target.value)} style={{ width: '100%', marginBottom: 12 }} />
        </div>

        <div style={mode === "single" ? singleCardStyle : cardStyle}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '11px', color: '#333' }}>GLASS PHASE SHIFT</h4>
          <label style={lblStyle}>GLASS X-POSITION: {glassPos.toFixed(2)} m</label>
          <input type="range" min={-0.3} max={0.3} step={0.01} value={glassPos} onChange={e => setGlassPos(+e.target.value)} style={{ width: '100%', marginBottom: 12 }} />
          
          <label style={lblStyle}>GLASS REF. INDEX: {glassN.toFixed(2)}</label>
          <input type="range" min={1.1} max={2.5} step={0.01} value={glassN} onChange={e => setGlassN(+e.target.value)} style={{ width: '100%', marginBottom: 12 }} />
          
          <label style={lblStyle}>THICKNESS: {glassThickness.toFixed(3)} mm</label>
          <input type="range" min={0.001} max={0.05} step={0.001} value={glassThickness} onChange={e => setGlassThickness(+e.target.value)} style={{ width: '100%' }} />
        </div>

      </div>

      {/* ── FRINGE WIDTH BAR (dx) ── */}
      <div style={{
        position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)',
        padding: '12px 24px', borderRadius: '12px', border: '1px solid #eee',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', zIndex: 10,
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
      }}>
        <div style={{ color: '#666', fontSize: '11px', fontWeight: 'bold' }}>FRINGE WIDTH (Δx)</div>
        <div style={{ color: '#000', fontSize: '24px', fontWeight: '900' }}>{dx_mm} <span style={{fontSize:'14px', color: '#666'}}>mm</span></div>
        <div style={{ width: '200px', height: '6px', background: '#ddd', borderRadius: '3px', overflow: 'hidden', marginTop: '4px' }}>
          <div style={{ width: `${Math.min(100, (dx_mm / 50) * 100)}%`, height: '100%', background: mode === "single" ? '#00e5ff' : '#b000ff', transition: 'width 0.3s' }} />
        </div>
      </div>

      <Canvas shadows camera={{ position: [2, 2, 6], fov: 45 }}>
        <color attach="background" args={['#0a0a10']} />
        <ambientLight intensity={1.5} />
        <directionalLight position={[5, 10, 5]} intensity={2.5} castShadow />
        <Environment preset="city" />
        <Grid infiniteGrid fadeDistance={20} sectionColor="#444" cellColor="#222" position={[0, -2, 0]} />
        
        <OpticsScene 
          L={L} lambda={lambda} d={d} w={w} n={n} mode={mode} rotation={rotation}
          glassPos={glassPos} glassThickness={glassThickness} glassN={glassN} laserDist={laserDist}
        />

        <OrbitControls makeDefault />
      </Canvas>
    </div>
  )
}
