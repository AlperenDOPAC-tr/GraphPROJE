import React, { useState } from "react"
import FallingCubes from "./FallingCubes"
import InclinedPlane from "./InclinedPlane"
import ProjectileMotion from "./ProjectileMotion"
import ForceVectors from "./ForceVectors"
import CollisionMomentum from "./CollisionMomentum"
import OpticsSimulation from "./OpticsSimulation"
import OpticsInterference from "./OpticsInterference"
import HarmonicMotion from "./HarmonicMotion"
import AngularMomentum from "./AngularMomentum"
import LightColors from "./LightColors"
import { EyeIcon } from "./Icons"
import WaterWaves from "./WaterWaves"
import PressureSim from "./PressureSim"
import BuoyancySim from "./BuoyancySim"
import ErrorBoundary from "./ErrorBoundary"

const simulations = [
  { id: "falling", name: "Free Fall", image: "/images/freefall.jpg" },
  { id: "ramp", name: "Inclined Plane", image: "/images/inclined.jpg" },
  { id: "projectile", name: "Projectile Motion", image: "/images/projectile.jpg" },
  { id: "forces", name: "Force Vectors", image: "/images/forcevectors.jpg" },
  { id: "collision", name: "Collision", image: "/images/collision.jpg" },
  { id: "optics", name: "Optics & Mirrors", image: "/images/optics.jpg" },
  { id: "interference", name: "Double & Single Slit", image: "/images/doubleslit.jpg" },
  { id: "harmonic", name: "Harmonic Motion", image: "/images/harmonic.png" },
  { id: "angular", name: "Angular Momentum", image: "/images/angular.png" },
  { id: "lightcolors", name: "Light Color Mixing", image: "/images/lightcolors.jpg" },
  { id: "waterwaves", name: "Water Waves", image: "/images/waters.jpg" },
  { id: "pressure", name: "Solid Pressure", image: "/images/pressure.png" },
  { id: "buoyancy", name: "Buoyancy", image: "/images/buoyancy.png" }
]

export default function App() {
  const [mode, setMode] = useState("falling")
  const [menuOpen, setMenuOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)

  const itemsPerPage = 8
  const totalPages = Math.ceil(simulations.length / itemsPerPage)
  const displayedSims = simulations.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage)

  React.useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const [uiHidden, setUiHidden] = useState(false)
  React.useEffect(() => {
    if (uiHidden) document.body.classList.add('hide-ui')
    else document.body.classList.remove('hide-ui')
  }, [uiHidden])

  React.useEffect(() => {
    // Menüden başka simülasyona geçince odak modunu (hide-ui) kapat
    setUiHidden(false)
  }, [mode])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.error(err))
    } else if (document.exitFullscreen) {
      document.exitFullscreen()
    }
  }

  const handleSelect = (id) => {
    setMode(id)
    setMenuOpen(false)
  }

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#fff" }}>
      {/* MENÜ AÇMA BUTONU */}
      <button
        id="menu-toggle-btn"
        onClick={() => setMenuOpen(!menuOpen)}
        style={menuToggleStyle}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <span style={barStyle(menuOpen, 0)} />
          <span style={barStyle(menuOpen, 1)} />
          <span style={barStyle(menuOpen, 2)} />
        </div>
      </button>

      {/* FULLSCREEN BUTONU */}
      <button
        onClick={toggleFullscreen}
        style={{
          ...menuToggleStyle,
          top: '78px',
          background: isFullscreen ? '#ffffff' : 'rgba(15, 15, 20, 0.85)',
        }}
        title="Toggle Fullscreen"
      >
        <svg fill={isFullscreen ? '#000000' : '#ffffff'} width="24" height="24" viewBox="0 0 1920 1920" xmlns="http://www.w3.org/2000/svg">
          <path d="M1146.616-.012V232.38h376.821L232.391 1523.309v-376.705H0V1920h773.629v-232.39H396.69L1687.737 396.68V773.5h232.275V-.011z" fillRule="evenodd"></path>
        </svg>
      </button>

      {/* FOCUS MODE (EYE) BUTONU */}
      <button
        onClick={() => setUiHidden(!uiHidden)}
        style={{
          ...menuToggleStyle,
          top: '136px',
          background: uiHidden ? '#ffffff' : 'rgba(15, 15, 20, 0.85)',
        }}
        title="Toggle Focus Mode"
      >
        <EyeIcon width={24} height={24} fill={uiHidden ? '#000000' : '#ffffff'} />
      </button>

      {/* OVERLAY */}
      {menuOpen && (
        <div
          id="menu-overlay"
          onClick={() => setMenuOpen(false)}
          style={overlayStyle}
        />
      )}

      {/* MENÜ PANELİ */}
      <div style={panelStyle(menuOpen)}>
        <div style={cardsContainerStyle}>
          {displayedSims.map((sim) => (
            <div
              key={sim.id}
              id={`sim-card-${sim.id}`}
              onClick={() => handleSelect(sim.id)}
              style={cardStyle(mode === sim.id)}
            >
              <div style={imageWrapperStyle}>
                <img
                  src={sim.image}
                  alt={sim.name}
                  style={imageStyle}
                />
              </div>
              <div style={cardLabelStyle}>
                <span style={cardNameStyle}>{sim.name}</span>
              </div>
            </div>
          ))}
        </div>

        {/* PAGINATION CONTROLS */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              style={paginationBtnStyle(currentPage === 0)}
            >
              Previous
            </button>
            <span style={{ fontSize: '13px', fontWeight: 'normal', fontFamily: 'Arial, sans-serif', color: '#475569' }}>
              Page {currentPage + 1} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage === totalPages - 1}
              style={paginationBtnStyle(currentPage === totalPages - 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Seçilen simülasyonu yükle */}
      <ErrorBoundary>
        {mode === "falling" && <FallingCubes />}
        {mode === "ramp" && <InclinedPlane />}
        {mode === "projectile" && <ProjectileMotion />}
        {mode === "forces" && <ForceVectors />}
        {mode === "collision" && <CollisionMomentum />}
        {mode === "optics" && <OpticsSimulation />}
        {mode === "interference" && <OpticsInterference />}
        {mode === "harmonic" && <HarmonicMotion />}
        {mode === "angular" && <AngularMomentum />}
        {mode === "lightcolors" && <LightColors />}
        {mode === "waterwaves" && <WaterWaves />}
        {mode === "pressure" && <PressureSim />}
        {mode === "buoyancy" && <BuoyancySim />}
      </ErrorBoundary>
    </div>
  )
}

/* ─── Stiller ─── */

const menuToggleStyle = {
  position: 'absolute',
  top: '20px',
  right: '24px',
  zIndex: 1000,
  width: '48px',
  height: '48px',
  borderRadius: '14px',
  border: 'none',
  background: 'rgba(15, 15, 20, 0.85)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
  transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
}

const barStyle = (open, index) => {
  const base = {
    display: 'block',
    width: '22px',
    height: '2.5px',
    background: '#fff',
    borderRadius: '2px',
    transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
    transformOrigin: 'center',
  }
  if (open && index === 0) return { ...base, transform: 'translateY(7.5px) rotate(45deg)' }
  if (open && index === 1) return { ...base, opacity: 0, transform: 'scaleX(0)' }
  if (open && index === 2) return { ...base, transform: 'translateY(-7.5px) rotate(-45deg)' }
  return base
}

const overlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  background: 'rgba(0,0,0,0.45)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  zIndex: 500,
  animation: 'fadeIn 0.25s ease-out',
}

const panelStyle = (open) => ({
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: open ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0.85)',
  opacity: open ? 1 : 0,
  pointerEvents: open ? 'auto' : 'none',
  zIndex: 600,
  background: 'rgba(255,255,255,0.95)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius: '20px',
  padding: '20px',
  boxShadow: '0 24px 80px rgba(0,0,0,0.18)',
  transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
})



const cardsContainerStyle = {
  display: 'flex',
  gap: '16px',
  justifyContent: 'center',
  flexWrap: 'wrap',
}

const cardStyle = (active) => ({
  position: 'relative',
  width: '180px',
  borderRadius: '16px',
  overflow: 'hidden',
  cursor: 'pointer',
  background: '#fff',
  border: active ? '2.5px solid #6366f1' : '2px solid rgba(0,0,0,0.06)',
  boxShadow: active
    ? '0 8px 30px rgba(99,102,241,0.35)'
    : '0 4px 20px rgba(0,0,0,0.08)',
  transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
  transform: 'translateY(0) scale(1)',
})



const imageWrapperStyle = {
  width: '100%',
  height: '140px',
  overflow: 'hidden',
  background: '#f0f1f5',
}

const imageStyle = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
}

const cardLabelStyle = {
  padding: '8px 8px',
  textAlign: 'center',
}

const cardNameStyle = {
  fontSize: '12px',
  fontWeight: '600',
  color: '#333',
  fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
}

const paginationBtnStyle = (disabled) => ({
  padding: '8px 20px',
  background: disabled ? '#e2e8f0' : '#000000',
  color: disabled ? '#94a3b8' : '#ffffff',
  border: 'none',
  borderRadius: '8px',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontWeight: '600',
  fontSize: '13px',
  transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
  boxShadow: disabled ? 'none' : '0 4px 12px rgba(0,0,0,0.25)',
})