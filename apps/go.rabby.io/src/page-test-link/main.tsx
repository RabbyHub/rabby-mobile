import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../component-index/index.less'
import App from './App.tsx'

console.debug('[debug] mode', import.meta.env.MODE);
const canRender = ['mobile-debug', 'mobile-regression'].includes(import.meta.env.MODE);

if (canRender) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
