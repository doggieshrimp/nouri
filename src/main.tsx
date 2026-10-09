import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import CalorieTracker from './CalorieTracker.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CalorieTracker />
  </StrictMode>,
)
