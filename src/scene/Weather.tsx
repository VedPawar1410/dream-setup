import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { BufferAttribute, BufferGeometry, ShaderMaterial } from 'three'
import { useRoom } from '../store/roomStore'
import { setAtmosphere } from './atmosphere'
import { THICKNESS } from './dimensions'
import { rgbMaterials } from './sceneRefs'
import { syncViewUniforms, viewUniforms } from './windowView'

/** Glue between the stored weather and the live scene, plus the effects that run every frame. */
export default function Weather() {
  const weather = useRoom((s) => s.doc.atmosphere.weather)
  const rgbCycle = useRoom((s) => s.doc.atmosphere.rgbCycle)
  const first = useRef(true)

  useEffect(() => {
    setAtmosphere(weather, first.current) // the first load snaps; later changes ease
    first.current = false
  }, [weather])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    syncViewUniforms(t)
    if (rgbCycle) {
      // Sweep every RGB part through the rainbow, each a little ahead of the last
      let i = 0
      for (const mat of rgbMaterials) mat.emissive.setHSL((t * 0.08 + i++ * 0.12) % 1, 0.8, 0.55)
    }
  })

  // When the cycle stops, put each RGB part back to its own colour
  useEffect(() => {
    if (rgbCycle) return
    for (const mat of rgbMaterials) if (mat.userData.rgbRest) mat.emissive.copy(mat.userData.rgbRest)
  }, [rgbCycle])

  return <Precipitation />
}

const COUNT = 1400
const TOP = 7

/** Seeded randomness keeps the scatter pure: same room size, same pattern, every time. */
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

function scatter(width: number, depth: number) {
  const random = rng(42)
  const halfW = width / 2 + THICKNESS + 0.35
  const halfD = depth / 2 + THICKNESS + 0.35
  const reachW = halfW + 2.5
  const reachD = halfD + 2.5
  const positions = new Float32Array(COUNT * 3)
  const seeds = new Float32Array(COUNT)
  for (let i = 0; i < COUNT; ) {
    const x = (random() * 2 - 1) * reachW
    const z = (random() * 2 - 1) * reachD
    if (Math.abs(x) < halfW && Math.abs(z) < halfD) continue // inside the room: try again
    positions.set([x, random() * TOP, z], i * 3)
    seeds[i++] = random()
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(positions, 3))
  g.setAttribute('aSeed', new BufferAttribute(seeds, 1))
  return g
}

/**
 * Rain or snow around the diorama, never through it: particles are scattered in a ring
 * outside the room's footprint, so the room stays dry like a snow globe. One draw call;
 * falling and swaying happen in the vertex shader.
 */
function Precipitation() {
  const { width, depth } = useRoom((s) => s.doc.shell)

  const geometry = useMemo(() => scatter(width, depth), [width, depth])
  useEffect(() => () => geometry.dispose(), [geometry])

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uTime: viewUniforms.uTime, uRain: viewUniforms.uRain, uSnow: viewUniforms.uSnow, uTop: { value: TOP }, uPx: { value: 1 } },
        transparent: true,
        depthWrite: false,
        vertexShader: /* glsl */ `
          uniform float uTime, uRain, uSnow, uTop, uPx;
          attribute float aSeed;
          varying float vSnowy;
          void main() {
            float snowy = uSnow / max(uRain + uSnow, 0.001);
            float speed = mix(6.5, 0.9, snowy) * (0.8 + aSeed * 0.4);
            vec3 p = position;
            p.y = mod(p.y - uTime * speed, uTop) - 0.6;
            p.x += sin(uTime * 0.9 + aSeed * 6.28) * 0.18 * snowy;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            // A real-world size (metres) turned into pixels at this depth
            gl_PointSize = mix(0.085, 0.06, snowy) * uPx / -mv.z;
            vSnowy = snowy;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uRain, uSnow;
          varying float vSnowy;
          void main() {
            vec2 p = gl_PointCoord - 0.5;
            float streak = smoothstep(0.5, 0.0, length(p * vec2(7.0, 1.0))); // rain: tall and thin
            float flake = smoothstep(0.5, 0.15, length(p));                   // snow: soft dot
            float a = mix(streak, flake, vSnowy) * max(uRain, uSnow) * mix(0.4, 0.75, vSnowy);
            if (a < 0.01) discard;
            gl_FragColor = vec4(mix(vec3(0.75, 0.83, 0.95), vec3(1.0), vSnowy), a);
          }
        `,
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])

  // Pixels per metre at distance 1: half the canvas height over tan(fov/2). Keeps drops the
  // same real size on any screen and pixel density.
  useFrame(({ camera, size, viewport }) => {
    // Shader uniforms are renderer state, updated per frame by design
    // oxlint-disable-next-line react/immutability
    material.uniforms.uPx.value = size.height * viewport.dpr * 0.5 * camera.projectionMatrix.elements[5]
  })

  return <points geometry={geometry} material={material} frustumCulled={false} />
}
