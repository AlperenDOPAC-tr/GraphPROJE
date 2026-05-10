import React, { useState } from "react"
import FallingCubes from "./FallingCubes"
import InclinedPlane from "./InclinedPlane"

export default function App() {
  const [mode, setMode] = useState("falling")

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#fff" }}>
      {/* MENÜ - Her zaman en üstte durur */}
      <div style={{ position: 'absolute', top: '20px', width: '100%', display: 'flex', justifyContent: 'center', gap: '20px', zIndex: 100 }}>
        <button onClick={() => setMode("falling")} style={menuBtn(mode === "falling")}>SERBEST DÜŞÜŞ</button>
        <button onClick={() => setMode("ramp")} style={menuBtn(mode === "ramp")}>EĞİK DÜZLEM</button>
      </div>

      {/* Seçilen simülasyonu yükle (Canvas'lar bu dosyaların içinde olacak) */}
      {mode === "falling" ? <FallingCubes /> : <InclinedPlane />}
    </div>
  )
}

const menuBtn = (active) => ({
  padding: '12px 24px', borderRadius: '30px', border: 'none', cursor: 'pointer',
  background: active ? '#000' : '#eee', color: active ? '#fff' : '#000', fontWeight: 'bold'
})