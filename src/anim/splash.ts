import { DefaultLoadingManager } from 'three'
import { gsap } from './gsap'
import { sceneReady } from './intro'

/**
 * Take over the HTML splash once the JS has arrived: switch the bar from its sweeping
 * placeholder to real progress, then fade it away as the scene's first frames land, so
 * the intro swoop is the first thing you see.
 */
export function runSplash() {
  const splash = document.getElementById('splash')
  if (!splash) return
  const bar = splash.querySelector('.splash-bar i')
  splash.classList.add('determinate')

  // Every three.js loader reports to the default manager. Its total grows as more files
  // are queued, so the raw ratio can dip; only ever moving forward keeps the bar honest.
  let shown = 0
  const advance = (p: number) => {
    if (p <= shown) return
    shown = p
    gsap.to(bar, { scaleX: p, duration: 0.4, ease: 'power2.out', overwrite: true })
  }
  advance(0.15) // the code itself is the first big chunk
  DefaultLoadingManager.onProgress = (_url, loaded, total) => advance(0.15 + 0.8 * (loaded / total))

  sceneReady.then(() => {
    advance(1)
    DefaultLoadingManager.onProgress = () => {}
    gsap
      .timeline({ delay: 0.15 })
      .to('.splash-inner', { y: -10, autoAlpha: 0, duration: 0.35, ease: 'power2.in' })
      .to(splash, { autoAlpha: 0, duration: 0.6, ease: 'power2.out', onComplete: () => splash.remove() }, '-=0.1')
  })
}
