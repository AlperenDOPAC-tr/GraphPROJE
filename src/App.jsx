import React, { useState } from "react"
import FallingCubes from "./FallingCubes"
import InclinedPlane from "./InclinedPlane"
import ProjectileMotion from "./ProjectileMotion"
import ForceVectors from "./ForceVectors"
import CollisionMomentum from "./CollisionMomentum"
import OpticsSimulation from "./OpticsSimulation"
import HarmonicMotion from "./HarmonicMotion"

const simulations = [
  { id: "falling", name: "Free Fall", image: "/images/freefall.jpg" },
  { id: "ramp", name: "Inclined Plane", image: "/images/inclined.jpg" },
  { id: "projectile", name: "Projectile Motion", image: "/images/projectile.jpg" },
  { id: "forces", name: "Force Vectors", image: "/images/forcevectors.jpg" },
  { id: "collision", name: "Collision", image: "/images/collision.jpg" },
  { id: "optics", name: "Optics & Mirrors", image: "/images/optics.jpg" },
  { id: "harmonic", name: "Harmonic Motion", image: "/images/harmonic.png" },
]

export default function App() {
  const [mode, setMode] = useState("falling")
  const [menuOpen, setMenuOpen] = useState(false)

  const handleSelect = (id) => {
    setMode(id)
    setMenuOpen(false)
  }

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#fff" }}>
      {/* MENÜ BUTONU - Sağ üst */}
      <button
        id="menu-toggle-btn"
        onClick={() => setMenuOpen(!menuOpen)}
        style={menuToggleStyle}
        title="Simulations"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'center', justifyContent: 'center' }}>
          <span style={barStyle(menuOpen, 0)} />
          <span style={barStyle(menuOpen, 1)} />
          <span style={barStyle(menuOpen, 2)} />
        </div>
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
          {simulations.map((sim) => (
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
      </div>

      {/* Seçilen simülasyonu yükle */}
      {mode === "falling" && <FallingCubes />}
      {mode === "ramp" && <InclinedPlane />}
      {mode === "projectile" && <ProjectileMotion />}
      {mode === "forces" && <ForceVectors />}
      {mode === "collision" && <CollisionMomentum />}
      {mode === "optics" && <OpticsSimulation />}
      {mode === "harmonic" && <HarmonicMotion />}
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