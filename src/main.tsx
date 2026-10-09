import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { runSplash } from './anim/splash'
import { initSound } from './audio/sound'
import { bootSaves } from './persistence/saves'

runSplash()

// Load your saved room before the first render, so the scene never flashes the default
await bootSaves()
initSound()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
