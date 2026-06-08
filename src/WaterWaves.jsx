import React, { useState, useMemo, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, Grid } from "@react-three/drei"
import * as THREE from "three"

// ─── SHADER MATERIAL FOR WATER WAVES ─────────────────────────────────────────
const WaterWaveShader = {
  uniforms: {
    uTime: { value: 0 },
    uMode: { value: 0 }, // 0: Diffraction, 1: Refraction
    uLambda: { value: 2.0 },
    uFrequency: { value: 1.5 },
    uW: { value: 2.0 }, // Slit width
    uSlitCount: { value: 1 },
    uSlitDist: { value: 4.0 },
    uN2: { value: 2.0 }, // Refractive index (n2 / n1)
    uAngle: { value: 0 }, // Incident angle
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform float uMode;
    uniform float uLambda;
    uniform float uFrequency;
    uniform float uW;
    uniform int uSlitCount;
    uniform float uSlitDist;
    uniform float uN2;
    uniform float uAngle;

    varying vec2 vUv;
    #define PI 3.14159265359

    void main() {
      vec2 pos = (vUv - 0.5) * 40.0;
      float x = pos.x;
      float y = pos.y;
      
      float wave = 0.0;
      float depthColorFactor = 0.0; 
      
      float omega = 2.0 * PI * uFrequency; 
      float k = 2.0 * PI / uLambda;

      if (uMode < 0.5) {
        // ─── DIFFRACTION ───
        if (x < 0.0) {
           wave = sin(k * x - omega * uTime);
        } else {
          int N = 30;
          float sum = 0.0;
          for(int i = 0; i < N; i++) {
            float offset = -uW / 2.0 + uW * float(i) / float(N - 1);
            
            // First slit
            float sy1 = (uSlitCount == 2) ? (uSlitDist / 2.0 + offset) : offset;
            vec2 src1 = vec2(0.0, sy1);
            vec2 dir1 = pos - src1;
            float d1 = length(dir1);
            float ob1 = (1.0 + (dir1.x / d1)) * 0.5;
            sum += (sin(k * d1 - omega * uTime) / sqrt(max(d1, 0.1))) * ob1;
            
            // Second slit
            if (uSlitCount == 2) {
               float sy2 = -uSlitDist / 2.0 + offset;
               vec2 src2 = vec2(0.0, sy2);
               vec2 dir2 = pos - src2;
               float d2 = length(dir2);
               float ob2 = (1.0 + (dir2.x / d2)) * 0.5;
               sum += (sin(k * d2 - omega * uTime) / sqrt(max(d2, 0.1))) * ob2;
            }
          }
          float totalSources = (uSlitCount == 2) ? float(N * 2) : float(N);
          wave = sum * (sqrt(uW) / totalSources) * 3.5;
          if (uSlitCount == 2) wave *= 1.4; // Boost slightly for visibility
        }
      } else {
        // ─── REFRACTION ───
        float n1 = 1.0;
        float n2 = uN2;
        float k1 = k;
        float k2 = k1 * n2;
        
        float theta1 = uAngle;
        float sinTheta2 = (n1 / n2) * sin(theta1);
        
        if (x < 0.0) {
          vec2 k_i = vec2(k1 * cos(theta1), k1 * sin(theta1));
          float phase_i = dot(k_i, pos) - omega * uTime;
          
          vec2 k_r = vec2(-k1 * cos(theta1), k1 * sin(theta1));
          float phase_r = dot(k_r, pos) - omega * uTime;
          
          float R = 1.0;
          if (abs(sinTheta2) <= 1.0) {
             float theta2 = asin(sinTheta2);
             R = (cos(theta1) - n2 * cos(theta2)) / (cos(theta1) + n2 * cos(theta2));
          }
          
          wave = sin(phase_i) + R * sin(phase_r);
        } else {
          if (abs(sinTheta2) <= 1.0) {
            float theta2 = asin(sinTheta2);
            vec2 k_t = vec2(k2 * cos(theta2), k2 * sin(theta2));
            float phase_t = dot(k_t, pos) - omega * uTime;
            
            float R = (cos(theta1) - n2 * cos(theta2)) / (cos(theta1) + n2 * cos(theta2));
            float T = 1.0 + R; 
            wave = T * sin(phase_t);
          } else {
            wave = 0.0;
          }
          depthColorFactor = 1.0;
        }
      }
      
      vec3 deepColor = vec3(0.05, 0.3, 0.6); 
      vec3 shallowColor = vec3(0.2, 0.7, 0.9); 
      
      vec3 baseColor = mix(deepColor, shallowColor, depthColorFactor);
      
      float intensity = clamp(wave, -1.0, 1.0);
      // Reduce highlight so it doesn't look like an artifact
      vec3 highlight = vec3(0.6, 0.8, 1.0) * intensity * 0.4;
      vec3 finalColor = baseColor + highlight;
      
      if (uMode > 0.5 && abs(x) < 0.1) {
         finalColor += vec3(0.2);
      }
      
      gl_FragColor = vec4(finalColor, 0.65); 
    }
  `
}

function WavePlane({ mode, lambda, frequency, w, slitCount, slitDist, n2, angle }) {
  const materialRef = useRef()

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime
      materialRef.current.uniforms.uMode.value = mode === "diffraction" ? 0.0 : 1.0
      materialRef.current.uniforms.uLambda.value = lambda
      materialRef.current.uniforms.uFrequency.value = frequency
      materialRef.current.uniforms.uW.value = w
      materialRef.current.uniforms.uSlitCount.value = slitCount
      materialRef.current.uniforms.uSlitDist.value = slitDist
      materialRef.current.uniforms.uN2.value = n2
      materialRef.current.uniforms.uAngle.value = angle * Math.PI / 180
    }
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[39.5, 39.5, 128, 128]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={WaterWaveShader.vertexShader}
        fragmentShader={WaterWaveShader.fragmentShader}
        uniforms={THREE.UniformsUtils.clone(WaterWaveShader.uniforms)}
        side={THREE.DoubleSide}
        transparent={true}
      />
    </mesh>
  )
}

function PoolGeometry({ mode, w, slitCount, slitDist, depthRatio }) {
  const deepDepth = 12.0; 
  const shallowDepth = deepDepth * depthRatio;
  const poolSize = 40;
  
  // Calculate barriers dynamically
  const topBarrierZ = slitCount === 2 ? (slitDist/2 + w/2) : w/2;
  const topLength = 20 - topBarrierZ;
  const topCenter = (20 + topBarrierZ) / 2;
  
  const bottomBarrierZ = slitCount === 2 ? (-slitDist/2 - w/2) : -w/2;
  const bottomLength = 20 + bottomBarrierZ; // actually 20 - abs(bottomBarrierZ)
  const bottomCenter = (-20 + bottomBarrierZ) / 2;
  
  const midLength = slitCount === 2 ? (slitDist - w) : 0;
  
  return (
    <group>
      {/* REFRACTION POOL FLOORS */}
      {mode === "refraction" && (
        <group>
          {/* Deep Floor */}
          <mesh position={[-poolSize/4, -deepDepth, 0]} rotation={[-Math.PI/2, 0, 0]}>
            <planeGeometry args={[poolSize/2, poolSize]} />
            <meshBasicMaterial color="#0284c7" />
          </mesh>
          <Grid position={[-poolSize/4, -deepDepth + 0.1, 0]} args={[poolSize/2, poolSize]} cellColor="#38bdf8" sectionColor="#0284c7" fadeDistance={200} sectionSize={2} cellSize={1} />

          {/* Shallow Block (Solid box to prevent empty bottom & z-fighting) */}
          <mesh position={[poolSize/4, -(deepDepth + shallowDepth)/2, 0]}>
            <boxGeometry args={[poolSize/2, deepDepth - shallowDepth, poolSize]} />
            <meshBasicMaterial color="#0284c7" />
          </mesh>
          
          {/* Shallow Floor Top Plane (For consistent color & grid) */}
          <mesh position={[poolSize/4, -shallowDepth + 0.01, 0]} rotation={[-Math.PI/2, 0, 0]}>
             <planeGeometry args={[poolSize/2, poolSize]} />
             <meshBasicMaterial color="#38bdf8" />
          </mesh>
          <Grid position={[poolSize/4, -shallowDepth + 0.1, 0]} args={[poolSize/2, poolSize]} cellColor="#ffffff" sectionColor="#0284c7" fadeDistance={200} sectionSize={2} cellSize={1} />
        </group>
      )}

      {/* DIFFRACTION POOL FLOORS */}
      {mode === "diffraction" && (
        <group>
          {/* Flat Floor */}
          <mesh position={[0, -deepDepth, 0]} rotation={[-Math.PI/2, 0, 0]}>
            <planeGeometry args={[poolSize, poolSize]} />
            <meshBasicMaterial color="#0284c7" />
          </mesh>
          <Grid position={[0, -deepDepth + 0.1, 0]} args={[poolSize, poolSize]} cellColor="#38bdf8" sectionColor="#0284c7" fadeDistance={200} sectionSize={2} cellSize={1} />
          
          {/* Barriers */}
          <mesh position={[0.1, 0, topCenter]}>
            <boxGeometry args={[0.2, 2, topLength]} />
            <meshStandardMaterial color="#475569" roughness={1.0} metalness={0.0} />
          </mesh>
          <mesh position={[0.1, 0, bottomCenter]}>
            <boxGeometry args={[0.2, 2, bottomLength]} />
            <meshStandardMaterial color="#475569" roughness={1.0} metalness={0.0} />
          </mesh>
          {slitCount === 2 && midLength > 0 && (
            <mesh position={[0.1, 0, 0]}>
              <boxGeometry args={[0.2, 2, midLength]} />
              <meshStandardMaterial color="#475569" roughness={1.0} metalness={0.0} />
            </mesh>
          )}
        </group>
      )}
      
      {/* OUTER WALLS (POOL BORDERS) */}
      <mesh position={[-20, -deepDepth/2, 0]}>
        <boxGeometry args={[0.5, deepDepth, poolSize]} />
        <meshStandardMaterial color="#0c4a6e" />
      </mesh>
      <mesh position={[20, mode === "refraction" ? -shallowDepth/2 : -deepDepth/2, 0]}>
        <boxGeometry args={[0.5, mode === "refraction" ? shallowDepth : deepDepth, poolSize]} />
        <meshStandardMaterial color="#0c4a6e" />
      </mesh>
      <mesh position={[0, -deepDepth/2, -20]}>
        <boxGeometry args={[poolSize, deepDepth, 0.5]} />
        <meshStandardMaterial color="#0c4a6e" />
      </mesh>
      
      {/* FRONT WALL - GLASS (z=20) */}
      <mesh position={[0, -deepDepth/2, 20]}>
        <boxGeometry args={[poolSize, deepDepth, 0.5]} />
        {/* Optimized transparent material instead of expensive transmission physical material */}
        <meshStandardMaterial color="#bae6fd" opacity={0.25} transparent={true} roughness={0.1} />
      </mesh>

      {/* POOL BOTTOM CLOSURE (Visible from below) */}
      {/* Offset Y by -0.05 to completely prevent z-fighting with the interior floor meshes */}
      <mesh position={[0, -deepDepth - 0.05, 0]} rotation={[Math.PI/2, 0, 0]}>
        <planeGeometry args={[poolSize, poolSize]} />
        <meshStandardMaterial color="#082f49" />
      </mesh>
    </group>
  )
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function WaterWaves() {
  const [mode, setMode] = useState("diffraction")
  
  // Shared
  const [lambda, setLambda] = useState(2.0)
  const [frequency, setFrequency] = useState(1.5)
  
  // Diffraction
  const [slitWidth, setSlitWidth] = useState(2.0)
  const [slitCount, setSlitCount] = useState(1)
  const [slitDist, setSlitDist] = useState(6.0)
  
  // Refraction
  const [incidentAngle, setIncidentAngle] = useState(0)
  const [depthRatio, setDepthRatio] = useState(0.25)

  const n2 = 1.0 / Math.sqrt(depthRatio)

  // Live variables
  const speed1 = lambda * frequency;
  const speed2 = (lambda / n2) * frequency;

  // ─── STYLES ──────────────────────────────────────────────────────────────────
  const panelStyle = {
    position: 'absolute', top: '20px', left: '20px', width: '320px',
    background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)',
    borderRadius: '16px', border: '1px solid #eee', color: '#333',
    padding: '24px', boxSizing: 'border-box', overflowY: 'auto',
    maxHeight: 'calc(100vh - 40px)',
    fontFamily: '"Inter", sans-serif', zIndex: 10,
    boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
    display: 'flex', flexDirection: 'column', gap: '16px'
  }
  const titleStyle = { margin: '0 0 4px 0', fontSize: '18px', fontWeight: 900, textAlign: 'center', color: '#111' }
  const lblStyle = { display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }
  const cardStyle = { background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }
  const dataCardStyle = { background: '#1e293b', color: '#f8fafc', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #3b82f6', fontSize: '13px' }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000000', overflow: 'hidden', position: 'relative' }}>
      
      {/* ── CONTROL PANEL ── */}
      <div className="left-panel" style={panelStyle}>
        <h2 style={titleStyle}>WATER WAVES</h2>
        
        {/* Mode Switch */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <button 
            onClick={() => setMode("diffraction")} 
            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: mode === "diffraction" ? '#3b82f6' : '#e2e8f0', color: mode === "diffraction" ? '#fff' : '#475569', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', fontSize: '12px' }}
          >
            DIFFRACTION
          </button>
          <button 
            onClick={() => setMode("refraction")} 
            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: mode === "refraction" ? '#10b981' : '#e2e8f0', color: mode === "refraction" ? '#fff' : '#475569', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', fontSize: '12px' }}
          >
            REFRACTION
          </button>
        </div>

        {/* Live Variables */}
        <div style={dataCardStyle}>
          <div style={{ fontWeight: 'bold', color: '#94a3b8', marginBottom: '8px', fontSize: '11px', textTransform: 'uppercase' }}>LIVE VARIABLES</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>Frequency (f):</span> <strong>{frequency.toFixed(1)} Hz</strong>
          </div>
          {mode === "diffraction" ? (
             <div style={{ display: 'flex', justifyContent: 'space-between' }}>
               <span>Wave Speed (v):</span> <strong>{speed1.toFixed(1)} m/s</strong>
             </div>
          ) : (
             <>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                 <span>Speed (Deep) v₁:</span> <strong>{speed1.toFixed(1)} m/s</strong>
               </div>
               <div style={{ display: 'flex', justifyContent: 'space-between', color: '#38bdf8' }}>
                 <span>Speed (Shallow) v₂:</span> <strong>{speed2.toFixed(1)} m/s</strong>
               </div>
             </>
          )}
        </div>

        {/* Shared Properties */}
        <div style={cardStyle}>
          <label style={lblStyle}>WAVELENGTH (λ): {lambda.toFixed(1)} m</label>
          <input type="range" min={0.5} max={10.0} step={0.1} value={lambda} onChange={e => setLambda(+e.target.value)} style={{ width: '100%', marginBottom: '8px' }} />
          
          <label style={lblStyle}>FREQUENCY (f): {frequency.toFixed(1)} Hz</label>
          <input type="range" min={0.5} max={5.0} step={0.1} value={frequency} onChange={e => setFrequency(+e.target.value)} style={{ width: '100%' }} />
        </div>

        {/* Diffraction Properties */}
        {mode === "diffraction" && (
          <div style={cardStyle}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button 
                onClick={() => setSlitCount(1)} 
                style={{ flex: 1, padding: '6px', borderRadius: '6px', border: 'none', background: slitCount === 1 ? '#3b82f6' : '#e2e8f0', color: slitCount === 1 ? '#fff' : '#475569', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}
              >
                SINGLE SLIT
              </button>
              <button 
                onClick={() => setSlitCount(2)} 
                style={{ flex: 1, padding: '6px', borderRadius: '6px', border: 'none', background: slitCount === 2 ? '#8b5cf6' : '#e2e8f0', color: slitCount === 2 ? '#fff' : '#475569', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}
              >
                DOUBLE SLIT
              </button>
            </div>

            <label style={lblStyle}>SLIT WIDTH (w): {slitWidth.toFixed(1)} m</label>
            <input type="range" min={0.2} max={10.0} step={0.1} value={slitWidth} onChange={e => setSlitWidth(+e.target.value)} style={{ width: '100%', marginBottom: '8px' }} />
            
            {slitCount === 2 && (
              <>
                <label style={lblStyle}>SLIT DISTANCE (d): {slitDist.toFixed(1)} m</label>
                <input type="range" min={slitWidth + 0.5} max={15.0} step={0.1} value={slitDist} onChange={e => setSlitDist(+e.target.value)} style={{ width: '100%', marginBottom: '8px' }} />
              </>
            )}

            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px', padding: '8px', background: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              {slitCount === 1 ? (
                <><strong style={{color: '#3b82f6'}}>Physics Concept:</strong> When Slit Width (w) is comparable to or smaller than Wavelength (λ), waves bend significantly (Diffraction). When w &gt; λ, waves pass mostly straight.</>
              ) : (
                <><strong style={{color: '#8b5cf6'}}>Double Slit:</strong> Two wave sources interfere with each other, creating an alternating pattern of constructive (bright) and destructive (dark) fringes!</>
              )}
            </div>
          </div>
        )}

        {/* Refraction Properties */}
        {mode === "refraction" && (
          <div style={cardStyle}>
            <label style={lblStyle}>INCIDENT ANGLE: {incidentAngle}°</label>
            <input type="range" min={-80} max={80} step={1} value={incidentAngle} onChange={e => setIncidentAngle(+e.target.value)} style={{ width: '100%', marginBottom: '16px' }} />
            
            <label style={lblStyle}>SHALLOW DEPTH RATIO (h2/h1): {depthRatio.toFixed(2)}</label>
            <input type="range" min={0.1} max={1.0} step={0.05} value={depthRatio} onChange={e => setDepthRatio(+e.target.value)} style={{ width: '100%', marginBottom: '8px' }} />

            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px', padding: '8px', background: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <strong style={{color: '#10b981'}}>Physics Concept:</strong> In shallow water, wave speed (v) and wavelength (λ) decrease. Entering at an angle causes the wave to bend towards the normal (Snell's Law).
            </div>
          </div>
        )}
      </div>

      {/* ── 3D SCENE ── */}
      <Canvas camera={{ position: [0, 15, 25], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 20, 10]} intensity={1.5} />
        
        <OrbitControls makeDefault enablePan={true} enableZoom={true} />
        
        <WavePlane mode={mode} lambda={lambda} frequency={frequency} w={slitWidth} slitCount={slitCount} slitDist={slitDist} n2={n2} angle={incidentAngle} />
        <PoolGeometry mode={mode} w={slitWidth} slitCount={slitCount} slitDist={slitDist} depthRatio={depthRatio} />
        
      </Canvas>
    </div>
  )
}
