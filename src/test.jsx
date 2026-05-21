import React, { useRef, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics, RigidBody, BallCollider } from '@react-three/rapier'
import { createRoot } from 'react-dom/client'

function App() {
  const rbRef = useRef(null)
  
  useEffect(() => {
    if (rbRef.current) {
      console.log('RigidBody object keys:', Object.keys(rbRef.current))
      console.log('has setAdditionalMassProperties?', typeof rbRef.current.setAdditionalMassProperties)
    }
  }, [])

  return (
    <Canvas>
      <Physics>
        <RigidBody ref={rbRef}>
          <BallCollider args={[1]} />
        </RigidBody>
      </Physics>
    </Canvas>
  )
}

const root = createRoot(document.getElementById('root'))
root.render(<App />)
