import { Environment, Lightformer } from '@react-three/drei'

// "Sunny afternoon" for now; Phase 5 turns these values into weather presets that GSAP
// tweens between.
export default function Lighting() {
  return (
    <>
      {/* Sky-blue from above, warm bounce from below: a cheap stand-in for global illumination */}
      <hemisphereLight args={['#dfe8ff', '#7a5c48', 0.9]} />

      {/* The sun sits behind the north wall, so the window throws a bright patch on the floor */}
      <directionalLight
        position={[3.5, 6.5, -7]}
        intensity={3.4}
        color="#ffe2b8"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      >
        <orthographicCamera attach="shadow-camera" args={[-6, 6, 6, -6, 0.5, 25]} />
      </directionalLight>

      {/* Soft warm fill so shadowed corners aren't dead black */}
      <pointLight position={[0, 2.2, 0.5]} intensity={2.5} distance={9} decay={2} color="#ffd2a6" />

      {/* Image-based light built from glowing panels: soft reflections without loading
          an HDR file from a CDN at runtime. Resolution 128 is plenty for blurry reflections. */}
      <Environment resolution={128} environmentIntensity={0.45}>
        <Lightformer form="rect" intensity={2} color="#fff1dc" position={[0, 5, -9]} scale={[10, 5, 1]} />
        <Lightformer form="rect" intensity={1} color="#c9d8ff" position={[-9, 3, 0]} rotation-y={Math.PI / 2} scale={[10, 4, 1]} />
        <Lightformer form="circle" intensity={1.5} position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={6} />
      </Environment>
    </>
  )
}
