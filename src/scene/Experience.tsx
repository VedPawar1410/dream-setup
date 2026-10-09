import { PerformanceMonitor } from '@react-three/drei'
import { useEffect, useState } from 'react'
import { sceneReady } from '../anim/intro'
import { useSettings } from '../store/settingsStore'
import Background from './Background'
import Blueprint from './Blueprint'
import CameraRig from './CameraRig'
import Lighting from './Lighting'
import PhotoFocus from './PhotoFocus'
import PostFX from './PostFX'
import RoomShell from './RoomShell'
import Weather from './Weather'

const setAutoTier = (tier: 'high' | 'low') => useSettings.setState({ autoTier: tier })

/**
 * On "Auto" quality, watch the frame rate and drop to the low tier when it sags. It starts
 * a few seconds after the intro, so the shader-compile stall at load doesn't count against
 * the device. After three flip-flops between tiers it settles on low for good.
 */
function AutoQuality() {
  const auto = useSettings((s) => s.quality === 'auto')
  const [warm, setWarm] = useState(false)
  useEffect(() => {
    let timer = 0
    sceneReady.then(() => (timer = window.setTimeout(() => setWarm(true), 4000)))
    return () => clearTimeout(timer)
  }, [])
  if (!auto || !warm) return null
  return (
    <PerformanceMonitor
      flipflops={3}
      onDecline={() => setAutoTier('low')}
      onIncline={() => setAutoTier('high')}
      onFallback={() => setAutoTier('low')}
    />
  )
}

export default function Experience() {
  return (
    <>
      <AutoQuality />
      <Background />
      <Lighting />
      <RoomShell />
      <Weather />
      <Blueprint />
      <CameraRig />
      <PostFX />
      <PhotoFocus />
    </>
  )
}
