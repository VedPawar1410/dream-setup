import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { sceneReady } from '../anim/intro'
import { CATALOG } from '../catalog/catalog'
import { requestThumbnail } from '../catalog/thumbnails'

/**
 * Pays first-use costs before anyone asks for them. Measured with a 4x slower CPU, the
 * first switch to Blueprint froze for ~160 ms and the first Decorate for ~80 ms, both one-
 * offs: three.js compiles a material's shader the first time it draws it, and the catalog
 * renders its card thumbnails on first open. Once the intro has settled this compiles every
 * material in the scene (hidden ones too; compileAsync uses the browser's background shader
 * compiler where available) and starts the first catalog tab's thumbnails in idle time.
 */
export default function WarmUp() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  useEffect(() => {
    let cancelled = false
    let timer = 0
    void sceneReady.then(() => {
      timer = window.setTimeout(() => {
        if (cancelled) return
        void gl.compileAsync(scene, camera).catch(() => {}) // a missed warm-up just means the old one-off cost
        CATALOG.filter((it) => it.category === 'desk').forEach(requestThumbnail)
      }, 3000) // after the intro swoop, so it doesn't compete with it
    })
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [gl, scene, camera])

  return null
}
