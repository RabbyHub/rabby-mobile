import { useMemo, useState } from 'react';

import './App.less';

import rabbyLogo from '/rabby-logo.svg';

import { makeRabbySchemeUrl } from '../utils';

const URL_EXAMPLES = [
  'app.uniswap.org',
  'debank.com',
  'superrare.com',
  'defillama.com',
  'opensea.io',
  'zapper.fi',
  'aave.com',
  'paras.id',
  'app.sushi.com',
];

function App() {
  const [targetLink, setTargetLink] = useState(URL_EXAMPLES[0]);

  const rabbySchemeUrls = useMemo(() => {
    return {
      debugUrl: makeRabbySchemeUrl('mobile-debug', targetLink),
      regressionUrl: makeRabbySchemeUrl('mobile-regression', targetLink),
      productionUrl: makeRabbySchemeUrl('mobile-production', targetLink),
    };
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
          <input
            className="input"
            value={targetLink}
            onChange={e => setTargetLink(e.target.value)}
            placeholder="input target link"
          />
        </div>
        <div className="url-matrix">
          {URL_EXAMPLES.map(url_e => {
            return (
              <span
                key={`u-${url_e}`}
                className="url-example"
                onClick={() => setTargetLink(url_e)}
              >
                {url_e}
              </span>
            );
          })}
        </div>

        <div className="divider" />

        <div className='openbtn-matrix'>
          <a
            target="_blank"
            href={rabbySchemeUrls.regressionUrl}
            className="anchor-button open-rabby">
            Regression
          </a>
          <a
            target="_blank"
            href={rabbySchemeUrls.productionUrl}
            className="anchor-button open-rabby">
            Production
          </a>
          <a
            target="_blank"
            href={rabbySchemeUrls.debugUrl}
            className="anchor-button open-rabby">
            Debug
          </a>
        </div>
      </div>
    </>
  );
}

export default App;
