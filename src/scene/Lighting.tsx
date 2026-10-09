import { Environment, Lightformer } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { DirectionalLight, HemisphereLight, PointLight } from 'three'
import { atmo } from './atmosphere'

// Every value here follows the live atmosphere (see atmosphere.ts) each frame, so a
// weather change glides the sun, sky light and fill together.
export default function Lighting() {
  const sun = useRef<DirectionalLight>(null!)
  const hemi = useRef<HemisphereLight>(null!)
  const fill = useRef<PointLight>(null!)

  useFrame(({ scene }) => {
    sun.current.color.copy(atmo.sunColor)
    sun.current.intensity = atmo.sunIntensity
    sun.current.position.copy(atmo.sunPos)
    hemi.current.color.copy(atmo.hemiSky)
    hemi.current.groundColor.copy(atmo.hemiGround)
    hemi.current.intensity = atmo.hemiIntensity
    fill.current.intensity = atmo.fill
    scene.environmentIntensity = atmo.env
  })

  return (
    <>
      {/* Sky light from above, bounce from below: a cheap stand-in for global illumination */}
      <hemisphereLight ref={hemi} />

      {/* The sun (or moon) sits behind the north wall, so windows throw light patches on the floor */}
      <directionalLight ref={sun} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02}>
        <orthographicCamera attach="shadow-camera" args={[-6, 6, 6, -6, 0.5, 25]} />
      </directionalLight>

      {/* Soft warm fill so shadowed corners aren't dead black */}
      <pointLight ref={fill} position={[0, 2.2, 0.5]} distance={9} decay={2} color="#ffd2a6" />

      {/* Image-based light built from glowing panels: soft reflections without loading
          an HDR file from a CDN at runtime. Resolution 128 is plenty for blurry reflections. */}
      <Environment resolution={128}>
        <Lightformer form="rect" intensity={2} color="#fff1dc" position={[0, 5, -9]} scale={[10, 5, 1]} />
        <Lightformer form="rect" intensity={1} color="#c9d8ff" position={[-9, 3, 0]} rotation-y={Math.PI / 2} scale={[10, 4, 1]} />
        <Lightformer form="circle" intensity={1.5} position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={6} />
      </Environment>
    </>
  )
}
