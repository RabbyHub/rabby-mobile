const mode = import.meta.env.MODE

import rabbyLogo from '/rabby-logo.svg'
import './App.less'

import { formatRabbySchemaUrl } from './utils';

const rabbySchemaUrl = formatRabbySchemaUrl(mode, window.location.href);
console.debug('[debug] rabbySchemaUrl', rabbySchemaUrl);

function App() {
  return (
    <>
      <div>
        <a href="https://rabby.io" target="_blank">
          <img src={rabbyLogo} className="logo react" alt="Rabby logo" />
        </a>
      </div>
      <h2>Opening Rabby Mobile app...</h2>
      <div className="card">
        If the app does not open automatically, please click the button below:
        <a target='_blank' href={rabbySchemaUrl} className='anchor-button'>
          Open Rabby Mobile
        </a>
      </div>
    </>
  )
}

export default App
