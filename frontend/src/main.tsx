import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import './shared/styles/global.css'
import './shared/styles/operations.css'
import './shared/styles/abastecimiento.css'
import './shared/styles/auth.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

