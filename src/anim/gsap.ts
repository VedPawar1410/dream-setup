import { useGSAP } from '@gsap/react'
import gsap from 'gsap'

// Register plugins once, in one place. Every other module imports gsap from here
// so we never accidentally use an unregistered plugin.
gsap.registerPlugin(useGSAP)

export { gsap, useGSAP }
