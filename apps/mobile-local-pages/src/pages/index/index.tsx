import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'

import '../../imports';

import './index.less'
import './App.less'

import { resolvePublicResourcePath } from '../../utils/webview-resources'
import { onDomReady } from '../../utils/webview-runtime';

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <a href="https://rabby.io" target="_blank">
          <img src={resolvePublicResourcePath('/rabby-logo.svg')} className="logo" alt="Rabby logo" />
        </a>
      </div>
      <h1>Built in page</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Rabby and React logos to learn more
      </p>
    </>
  )
}

onDomReady().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
})
