import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { runSplash } from './anim/splash'
import { initSound } from './audio/sound'
import { startingBackend } from './backend/auth'
import { bootSaves } from './persistence/saves'

runSplash()

// Load your saved room before the first render, so the scene never flashes the default
// Signed in on this browser? Then your account's rooms open; otherwise this browser's
await bootSaves(await startingBackend())
initSound()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
