import { useMemo, useState } from 'react'

import './App.less'

import rabbyLogo from '/rabby-logo.svg'

import { makeRabbySchemeUrl } from '../utils';

function App() {
  const [ targetLink, setTargetLink ] = useState('app.uniswap.org');

  const rabbySchemeUrls = useMemo(() => {
    return {
      debugUrl: makeRabbySchemeUrl('mobile-debug', targetLink),
      regressionUrl: makeRabbySchemeUrl('mobile-regression', targetLink),
      productionUrl: makeRabbySchemeUrl('mobile-production', targetLink),
    }
  }, [targetLink]);

  return (
    <>
      <div>
        <a href="https://rabby.io" target="_blank">
          <img src={rabbyLogo} className="logo rabby" alt="Rabby logo" />
        </a>
      </div>
      <h2>Generate Links</h2>
      <div className="card">
        <div>
          <input className='input' value={targetLink} onChange={(e) => setTargetLink(e.target.value)} placeholder='input target link' />
        </div>

        <div className='divider' />

        <p>
          <a target='_blank' href={rabbySchemeUrls.debugUrl} className='anchor-button open-rabby'>
            Open Rabby(Debug)
          </a>
          <a target='_blank' href={rabbySchemeUrls.regressionUrl} className='anchor-button open-rabby'>
            Open Rabby(Regression)
          </a>
          <a target='_blank' href={rabbySchemeUrls.productionUrl} className='anchor-button open-rabby'>
            Open Rabby(Production)
          </a>
        </p>
      </div>
    </>
  )
}

export default App
