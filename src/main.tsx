import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { runSplash } from './anim/splash'
import { initSound } from './audio/sound'
import { startingBackend } from './backend/auth'
import { isUploadPage } from './backend/customItems'
import { bootShared, sharedTokenInUrl } from './backend/share'
import { bootSaves } from './persistence/saves'
import { useUi } from './store/uiStore'

runSplash()

// Load your saved room before the first render, so the scene never flashes the default
// Signed in on this browser? Then your account's rooms open; otherwise this browser's
// A share link (?s=…) opens that room view-only instead, without touching your saves
const shareToken = sharedTokenInUrl()
if (shareToken) await bootShared(shareToken)
else await bootSaves(await startingBackend())
initSound()
// Opened from the "upload from phone" QR code: go straight to the upload panel
if (isUploadPage()) useUi.setState({ addItemOpen: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
