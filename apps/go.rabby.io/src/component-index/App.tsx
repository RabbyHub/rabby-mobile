import './App.less'

// const mode = import.meta.env.MODE

import rabbyLogo from '/rabby-logo.svg'
import AppleStoreLogo from '/link-apple.svg'
import GooglePlayLogo from '/link-googleplay.svg'

import { makeRabbySchemeUrl } from '../utils';
import { useMemo } from 'react';

const searchParams = new URLSearchParams(window.location.search);
const targetLink = decodeURIComponent(searchParams.get('dapp') || '');

function App({
  mode
}: {
  mode: 'mobile-debug' | 'mobile-regression' | 'mobile-production'
}) {
  const rabbySchemeUrl = useMemo(() => {
    return makeRabbySchemeUrl(mode, targetLink);
  }, [mode]);
  console.debug('[debug] rabbySchemeUrl', rabbySchemeUrl);

  return (
    <>
      <div>
        <a href="https://rabby.io" target="_blank">
          <img src={rabbyLogo} className="logo rabby" alt="Rabby logo" />
        </a>
      </div>
      {!targetLink ? (
          <h2>⚠️ Invalid Target</h2>
      ) : (
        <>
          <h2>Opening Rabby Mobile app...</h2>
          <div className="card">
            <p>
              If the app does not open automatically, please click the button below:
              <a target='_blank' href={rabbySchemeUrl} className='anchor-button open-rabby'>
                Open Rabby Mobile
              </a>
            </p>
          </div>

          <div className='divider' />

          <div className='card '>
            <p>Haven't installed Rabby Mobile yet? Install it from:</p>
            <div className='store'>
              <a href="https://apps.apple.com/us/app/rabby-wallet-crypto-evm/id6474381673" target="_blank">
                <img src={AppleStoreLogo} className="logo linking" alt="App Store logo" />
              </a>
              <a href="https://play.google.com/store/apps/details?id=com.debank.rabbymobile" target="_blank">
                <img src={GooglePlayLogo} className="logo linking" alt="Google Play logo" />
              </a>
            </div>
          </div>
        </>
      )}
    </>
  )
}

export default App
