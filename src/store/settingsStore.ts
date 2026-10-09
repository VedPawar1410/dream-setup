import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type Quality = 'auto' | 'high' | 'low'
export type Tier = 'high' | 'low'

type Settings = {
  sound: boolean
  quality: Quality
  tourDone: boolean
  /** What "auto" has settled on for this device. Measured live, never saved. */
  autoTier: Tier
}

// Player preferences, kept apart from rooms. They live in localStorage rather than
// IndexedDB because they're tiny and must be readable synchronously before the first
// frame (quality decides the canvas resolution). persist() also survives storage
// being blocked: the settings just won't stick.
export const useSettings = create<Settings>()(
  persist(
    (): Settings => ({ sound: true, quality: 'auto', tourDone: false, autoTier: 'high' }),
    {
      name: 'dream-setup:settings',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ sound, quality, tourDone }) => ({ sound, quality, tourDone }),
    },
  ),
)

/** The quality tier actually in use. */
export const useTier = () => useSettings((s) => (s.quality === 'auto' ? s.autoTier : s.quality))
