import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../component-index/index.less'
import App from '../component-index/App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App mode="mobile-regression" />
  </StrictMode>,
)
