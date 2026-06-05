import { useRef, useEffect } from 'react'
import { useThree } from '@react-three/fiber'

/**
 * ClockScaler – R3F'in dahili saatinin getDelta() çıktısını ölçekleyerek
 * fizik motorları (Rapier, Cannon) ve özel useFrame döngüleri dahil
 * tüm bileşenlerin zaman akışını yavaşlatır/hızlandırır.
 *
 * Kullanım: <Canvas> ... <ClockScaler timeScale={0.5} /> ... </Canvas>
 */
export default function ClockScaler({ timeScale }) {
  const { clock } = useThree()
  const tsRef = useRef(timeScale)
  tsRef.current = timeScale

  useEffect(() => {
    const original = clock.getDelta.bind(clock)
    clock.getDelta = () => original() * tsRef.current
    return () => { clock.getDelta = original }
  }, [clock])

  return null
}
