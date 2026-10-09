import { useGSAP } from '@gsap/react'
import gsap from 'gsap'

// Register plugins once, in one place. Every other module imports gsap from here
// so we never accidentally use an unregistered plugin.
gsap.registerPlugin(useGSAP)

/**
 * The OS "reduce motion" setting. Big camera swoops are the kind of motion it exists
 * for, so those get shorter and straighter; small UI fades stay as they are.
 */
export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

export { gsap, useGSAP }
