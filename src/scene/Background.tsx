import { useEffect, useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'

// A plain Texture assigned to scene.background is drawn as a full-screen quad, so a
// gradient painted on a 2D canvas gives a screen-space backdrop. Unlike a CSS gradient
// behind a transparent canvas, it also passes through post-processing correctly.
export default function Background({ inner = '#3d3352', outer = '#17121f' }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 512
    const ctx = canvas.getContext('2d')!
    const g = ctx.createRadialGradient(256, 220, 20, 256, 256, 380)
    g.addColorStop(0, inner)
    g.addColorStop(1, outer)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 512, 512)

    const t = new CanvasTexture(canvas)
    t.colorSpace = SRGBColorSpace
    return t
  }, [inner, outer])

  useEffect(() => () => texture.dispose(), [texture])

  // attach="background" sets scene.background on mount and resets it on unmount
  return <primitive attach="background" object={texture} />
}
