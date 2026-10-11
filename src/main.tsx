import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { applyAppearance, loadAppearance } from './lib/appearance.ts'
import CalorieTracker from './CalorieTracker.tsx'

// Apply saved reading settings before the first render to avoid a flash of the defaults.
applyAppearance(loadAppearance())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CalorieTracker />
  </StrictMode>,
)
