import {
  getPerpsProSessionBookPrecision,
  resetPerpsProMarketSessionForTests,
  setPerpsProSessionBookPrecision,
} from './perpsProMarketSession';

describe('perpsProMarketSession book precision', () => {
  beforeEach(() => {
    resetPerpsProMarketSessionForTests();
  });

  afterEach(() => {
    resetPerpsProMarketSessionForTests();
  });

  it('keeps protocol precision parameters isolated by market key', () => {
    setPerpsProSessionBookPrecision('hyperliquid::BTC', {
      mantissa: 2,
      nSigFigs: 5,
    });
    setPerpsProSessionBookPrecision('xyz::xyz:AAPL', {
      mantissa: null,
      nSigFigs: 4,
    });

    expect(getPerpsProSessionBookPrecision('hyperliquid::BTC')).toEqual({
      mantissa: 2,
      nSigFigs: 5,
    });
    expect(getPerpsProSessionBookPrecision('xyz::xyz:AAPL')).toEqual({
      mantissa: null,
      nSigFigs: 4,
    });
    expect(getPerpsProSessionBookPrecision('hyperliquid::ETH')).toBeNull();
  });

  it('clears all remembered precision when the process session resets', () => {
    setPerpsProSessionBookPrecision('hyperliquid::BTC', {
      mantissa: null,
      nSigFigs: 5,
    });

    resetPerpsProMarketSessionForTests();

    expect(getPerpsProSessionBookPrecision('hyperliquid::BTC')).toBeNull();
  });
});
