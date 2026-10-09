import { Canvas } from '@react-three/fiber'
import { select } from './scene/blueprintActions'
import { selectItem } from './scene/decorateActions'
import Experience from './scene/Experience'
import { useUi } from './store/uiStore'
import Hud from './ui/Hud'

export default function App() {
  return (
    <>
      <Canvas
        // PCF; three.js removed PCFSoftShadowMap (which plain `shadows` asks for)
        shadows="percentage"
        dpr={[1, 2]}
        // Narrow FOV flattens perspective toward the original's isometric "dollhouse" look
        camera={{ fov: 30, near: 0.1, far: 100 }}
        // Antialiasing happens in post (SMAA), so the default framebuffer doesn't need MSAA
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          // Per-material clipping planes (the wall cutaway) are off by default in three.js
          gl.localClippingEnabled = true
        }}
        // A click that hits nothing interactive (and wasn't a drag) clears the selection
        onPointerMissed={() => {
          const ui = useUi.getState()
          if (!ui.carry) select(null)
          if (!ui.carryItem) selectItem(null)
        }}
      >
        <Experience />
      </Canvas>
      <Hud />
    </>
  )
}
