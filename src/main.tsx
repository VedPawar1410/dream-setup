import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { bootSaves } from './persistence/saves'

// Load your saved room before the first render, so the scene never flashes the default
await bootSaves()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
