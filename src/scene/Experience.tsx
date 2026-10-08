import { ContactShadows, OrbitControls } from '@react-three/drei'
import { useRef } from 'react'
import type { Mesh } from 'three'
import { gsap, useGSAP } from '../anim/gsap'

// Phase 0 smoke test: proves R3F renders, drei loads, and GSAP can drive three.js objects.
// Replaced by the real room in Phase 1.
export default function Experience() {
  const cube = useRef<Mesh>(null!)

  // GSAP tweens plain JS numbers, so it can animate a THREE.Vector3 directly.
  // Animating the mesh itself (not React state) means no re-renders while it plays.
  useGSAP(() => {
    gsap.from(cube.current.scale, { x: 0, y: 0, z: 0, duration: 1.2, ease: 'elastic.out(1, 0.5)', delay: 0.4 })
    gsap.from(cube.current.position, { y: 3, duration: 1, ease: 'bounce.out', delay: 0.4 })
  })

  return (
    <>
      <color attach="background" args={['#1b1622']} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[4, 8, 3]} intensity={2} castShadow />

      <mesh ref={cube} position={[0, 0.5, 0]} castShadow>
        <boxGeometry />
        <meshStandardMaterial color="#b18cff" />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial color="#3a3046" />
      </mesh>
      <ContactShadows position={[0, 0.01, 0]} opacity={0.5} blur={2} />

      <OrbitControls makeDefault enableDamping />
    </>
  )
}
