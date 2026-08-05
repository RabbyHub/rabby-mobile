import type { MarketData } from '@/hooks/perps/usePerpsStore';

import { buildPerpsProMarket } from './market';
import { resolveInitialPerpsProMarket } from './resolveInitialMarket';

const market = (name: string, dexId = '') =>
  buildPerpsProMarket({
    index: 0,
    logoUrl: '',
    name,
    displayName: name.includes(':') ? name.split(':')[1]! : name,
    quoteAsset: 'USDC',
    maxLeverage: 40,
    minLeverage: 1,
    maxUsdValueSize: '1',
    szDecimals: 2,
    pxDecimals: 2,
    dayBaseVlm: '0',
    dayNtlVlm: '0',
    funding: '0',
    markPx: '1',
    midPx: '1',
    openInterest: '0',
    oraclePx: '1',
    premium: '0',
    prevDayPx: '1',
    dexId,
  } satisfies MarketData);

describe('resolveInitialPerpsProMarket', () => {
  const eth = market('ETH');
  const btc = market('BTC');
  const apple = market('xyz:AAPL', 'xyz');
  const markets = [eth, btc, apple];

  it('uses exact canonical navigation market before session', () => {
    expect(
      resolveInitialPerpsProMarket({
        markets,
        navigationMarket: 'xyz:AAPL',
        sessionMarketKey: btc.marketKey,
      }),
    ).toBe(apple);
  });

  it('does not guess navigation market casing or display names', () => {
    expect(
      resolveInitialPerpsProMarket({
        markets,
        navigationMarket: 'aapl',
        sessionMarketKey: eth.marketKey,
      }),
    ).toBe(eth);
  });

  it('falls back through session, native BTC, first and null', () => {
    expect(
      resolveInitialPerpsProMarket({
        markets,
        sessionMarketKey: apple.marketKey,
      }),
    ).toBe(apple);
    expect(resolveInitialPerpsProMarket({ markets })).toBe(btc);
    expect(resolveInitialPerpsProMarket({ markets: [eth, apple] })).toBe(eth);
    expect(resolveInitialPerpsProMarket({ markets: [] })).toBeNull();
  });
});
