import { Canvas } from '@react-three/fiber'
import { useRef } from 'react'
import { gsap, useGSAP } from './anim/gsap'
import Experience from './scene/Experience'

export default function App() {
  const hud = useRef<HTMLDivElement>(null)

  // useGSAP scopes selectors to `hud` and reverts every tween on unmount,
  // so StrictMode's double-mount in dev doesn't stack animations.
  useGSAP(
    () => {
      gsap.from('.hud > *', { y: 16, opacity: 0, duration: 0.9, stagger: 0.12, ease: 'power3.out', delay: 0.3 })
    },
    { scope: hud },
  )

  return (
    <>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [6, 5, 6], fov: 40 }}>
        <Experience />
      </Canvas>
      <div className="hud" ref={hud}>
        <h1 className="title">Dream Setup</h1>
        <p className="subtitle">Phase 0: scaffold check</p>
      </div>
    </>
  )
}
