import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { PerspectiveCamera } from 'three'
import { useUi } from '../store/uiStore'

/**
 * On a phone in decorate mode the bottom sheet covers the lower half of the screen,
 * and the camera frames the room on the whole screen, so half of it sits behind the
 * sheet. This slides the rendered view up (a view offset: the camera itself doesn't
 * move) so the room is centred in the gap between the header and the sheet. Picking
 * still lines up, because raycasts use the same offset projection.
 */
export default function PhoneFraming() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const size = useThree((s) => s.size)
  const target = useRef(0)
  const current = useRef(0)

  useEffect(() => {
    // DOM reads only when the UI changes, never per frame
    const measure = () => {
      const s = useUi.getState()
      const panel = s.sheet && document.querySelector<HTMLElement>(s.sheet === 'catalog' ? '.catalog' : '.inspector')
      const sheetUp = innerWidth <= 640 && s.mode === 'decorate' && !s.carryItem && !s.photo && !!panel
      if (!sheetUp) return void (target.current = 0)
      const headerBottom = document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0
      const covered = innerHeight - panel.getBoundingClientRect().top
      target.current = Math.max(0, (covered - headerBottom) / 2)
    }
    const later = () => requestAnimationFrame(measure) // after React has applied the change
    later()
    const unsubscribe = useUi.subscribe(later)
    addEventListener('resize', later)
    return () => {
      unsubscribe()
      removeEventListener('resize', later)
    }
  }, [])

  // A resize rebuilds the projection; re-apply the offset at the new canvas size
  useEffect(() => {
    if (current.current) camera.setViewOffset(size.width, size.height, 0, current.current, size.width, size.height)
  }, [camera, size])

  useFrame((_, dt) => {
    const gap = target.current - current.current
    if (Math.abs(gap) < 0.5 && current.current === target.current) return
    current.current = Math.abs(gap) < 0.5 ? target.current : current.current + gap * Math.min(1, dt * 8)
    if (current.current === 0) camera.clearViewOffset()
    else camera.setViewOffset(size.width, size.height, 0, current.current, size.width, size.height)
  })

  return null
}
