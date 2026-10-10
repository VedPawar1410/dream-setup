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
  const bar = splash.querySelector<HTMLElement>('.splash-bar i')!
  const pct = splash.querySelector<HTMLElement>('.splash-pct')!
  splash.classList.add('determinate')

  // Every three.js loader reports to the default manager. Its total grows as more files
  // are queued, so the raw ratio can dip; only ever moving forward keeps the bar honest.
  // The bar and the percentage both follow one tweened number, so they always agree.
  let target = 0
  const shown = { p: 0 }
  const render = () => {
    bar.style.transform = `scaleX(${shown.p})`
    pct.textContent = `${Math.round(shown.p * 100)}%`
  }
  const advance = (p: number) => {
    if (p <= target) return
    target = p
    gsap.to(shown, { p, duration: 0.4, ease: 'power2.out', overwrite: true, onUpdate: render })
  }
  advance(0.15) // the code itself is the first big chunk
  DefaultLoadingManager.onProgress = (_url, loaded, total) => advance(0.15 + 0.8 * (loaded / total))

  sceneReady.then(() => {
    advance(1)
    DefaultLoadingManager.onProgress = () => {}
    gsap
      .timeline({ delay: 0.45 }) // long enough to see it reach 100%
      .to('.splash-inner', { y: -10, autoAlpha: 0, duration: 0.35, ease: 'power2.in' })
      .to(splash, { autoAlpha: 0, duration: 0.6, ease: 'power2.out', onComplete: () => splash.remove() }, '-=0.1')
  })
}
