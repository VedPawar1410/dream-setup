import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import { atmo, atmoVersion } from './atmosphere'

// A plain Texture assigned to scene.background is drawn as a full-screen quad, so a
// gradient painted on a 2D canvas gives a screen-space backdrop that also passes through
// post-processing. It repaints only when the atmosphere actually changes.
export default function Background() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 256
    const t = new CanvasTexture(canvas)
    t.colorSpace = SRGBColorSpace
    return t
  }, [])
  useEffect(() => () => texture.dispose(), [texture])

  const painted = useRef(-1)
  useFrame(() => {
    if (painted.current === atmoVersion.v) return
    painted.current = atmoVersion.v
    const canvas = texture.image as HTMLCanvasElement
    const ctx = canvas.getContext('2d')!
    const g = ctx.createRadialGradient(128, 110, 10, 128, 128, 190)
    g.addColorStop(0, atmo.bgInner.getStyle()) // getStyle gives sRGB, which a canvas expects
    g.addColorStop(1, atmo.bgOuter.getStyle())
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 256)
    // Telling three.js to re-upload a canvas texture is renderer state, not React state
    // oxlint-disable-next-line react/immutability
    texture.needsUpdate = true
  })

  // attach="background" sets scene.background on mount and resets it on unmount
  return <primitive attach="background" object={texture} />
}
