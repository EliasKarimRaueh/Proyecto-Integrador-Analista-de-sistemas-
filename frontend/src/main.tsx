import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import './shared/styles/global.css'
import './shared/styles/operations.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

