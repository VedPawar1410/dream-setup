import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { Raycaster, Vector2, type Mesh, type Object3D } from 'three'
import { gsap } from '../anim/gsap'
import { useUi } from '../store/uiStore'
import { focusPoint } from './photo'

const isShown = (o: Object3D | null) => {
  for (; o; o = o.parent) if (!o.visible) return false
  return true
}

/** In photo mode, clicking the scene focuses the depth of field on whatever you clicked. */
export default function PhotoFocus() {
  const { gl, scene, camera } = useThree()

  useEffect(() => {
    const canvas = gl.domElement
    const raycaster = new Raycaster()
    const ndc = new Vector2()
    let down: { x: number; y: number } | null = null

    const onDown = (e: PointerEvent) => void (down = { x: e.clientX, y: e.clientY })
    const onUp = (e: PointerEvent) => {
      const clicked = down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6
      down = null
      if (!clicked || !useUi.getState().photo) return
      const r = canvas.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      // Only solid, visible meshes count (not rain particles or hidden helpers)
      const hit = raycaster.intersectObjects(scene.children, true).find((h) => (h.object as Mesh).isMesh && isShown(h.object))
      if (!hit) return
      focusPoint.copy(hit.point)
      ring(e.clientX, e.clientY)
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointerup', onUp)
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointerup', onUp)
    }
  }, [gl, scene, camera])

  return null
}

/** A focus ring that tightens where you clicked, like a camera's AF point. */
function ring(x: number, y: number) {
  const el = document.createElement('div')
  el.className = 'focus-ring'
  el.style.left = `${x}px`
  el.style.top = `${y}px`
  document.body.appendChild(el)
  gsap
    .timeline({ onComplete: () => el.remove() })
    .fromTo(el, { scale: 1.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'power3.out' })
    .to(el, { opacity: 0, duration: 0.4, delay: 0.5 })
}
