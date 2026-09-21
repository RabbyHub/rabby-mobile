const mockCancelFastL2 = jest.fn();
const mockCancelLatestTrade = jest.fn();
const mockPrewarmFastL2 = jest.fn(() => mockCancelFastL2);
const mockPrewarmFastL2HttpSnapshot = jest.fn(async () => true);
const mockWaitForFastL2HttpSnapshot = jest.fn(async () => true);
const mockPrewarmLatestTrade = jest.fn(() => mockCancelLatestTrade);
const mockPrepareLeverageSources = jest.fn(async () => ({
  accountLeverageConfiguration: null,
  zeroAddressLeverageBaseline: null,
}));
const mockGetSessionPrecision = jest.fn(() => ({
  mantissa: 2 as const,
  nSigFigs: 5 as const,
}));

jest.mock('@/hooks/perps/subscriptions/usePerpsFastL2', () => ({
  prewarmPerpsFastL2: (...args: unknown[]) => mockPrewarmFastL2(...args),
  prewarmPerpsFastL2HttpSnapshot: (...args: unknown[]) =>
    mockPrewarmFastL2HttpSnapshot(...args),
  waitForPerpsFastL2HttpSnapshot: (...args: unknown[]) =>
    mockWaitForFastL2HttpSnapshot(...args),
}));

jest.mock('@/hooks/perps/subscriptions/usePerpsLatestTrade', () => ({
  prewarmPerpsLatestTrade: (...args: unknown[]) =>
    mockPrewarmLatestTrade(...args),
}));

jest.mock('../session/perpsProMarketSession', () => ({
  getPerpsProSessionBookPrecision: (...args: unknown[]) =>
    mockGetSessionPrecision(...args),
}));

jest.mock('./perpsProZeroAddressLeverageBaseline', () => ({
  preparePerpsProLeverageSources: (...args: unknown[]) =>
    mockPrepareLeverageSources(...args),
}));

import type { PerpsProMarket } from '../model/market';
import {
  PERPS_PRO_ENTRY_INTENT_TIMEOUT_MS,
  prewarmPerpsProEntryIntent,
  prewarmPerpsProRealtimeDisplaySnapshot,
  prewarmPerpsProRealtimeIntent,
  resolvePerpsProRealtimeTarget,
  waitForPerpsProRealtimeDisplaySnapshot,
} from './perpsProEntryIntent';

const market = {
  canonicalCoin: 'BTC',
  marketKey: 'hyperliquid::BTC',
  marketData: { szDecimals: 5 },
  price: 63_000,
} as PerpsProMarket;

describe('prewarmPerpsProEntryIntent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('warms the exact account, market and remembered precision through shared owners', () => {
    const cancel = prewarmPerpsProEntryIntent({
      accountAddress: '0x341a1fBD51825E5a107DB54cCb3166DeBA145479',
      market,
    });

    expect(mockPrepareLeverageSources).toHaveBeenCalledWith(
      'BTC',
      '0x341a1fBD51825E5a107DB54cCb3166DeBA145479',
    );
    expect(mockGetSessionPrecision).toHaveBeenCalledWith('hyperliquid::BTC');
    expect(mockPrewarmFastL2).toHaveBeenCalledWith({
      coin: 'BTC',
      precision: { mantissa: 2, nSigFigs: 5 },
      timeoutMs: PERPS_PRO_ENTRY_INTENT_TIMEOUT_MS,
    });
    expect(mockPrewarmLatestTrade).toHaveBeenCalledWith({
      coin: 'BTC',
      timeoutMs: PERPS_PRO_ENTRY_INTENT_TIMEOUT_MS,
    });

    cancel();
    cancel();
    expect(mockCancelFastL2).toHaveBeenCalledTimes(1);
    expect(mockCancelLatestTrade).toHaveBeenCalledTimes(1);
  });

  it('skips FastL2 when the market has no valid price precision', () => {
    prewarmPerpsProEntryIntent({ market: { ...market, price: null } });

    expect(mockPrewarmFastL2).not.toHaveBeenCalled();
    expect(mockPrewarmLatestTrade).toHaveBeenCalledWith({
      coin: 'BTC',
      timeoutMs: PERPS_PRO_ENTRY_INTENT_TIMEOUT_MS,
    });
  });

  it('can warm only realtime owners for an already prepared market selection', () => {
    const cancel = prewarmPerpsProRealtimeIntent(market);

    expect(mockPrepareLeverageSources).not.toHaveBeenCalled();
    expect(mockPrewarmFastL2).toHaveBeenCalledTimes(1);
    expect(mockPrewarmLatestTrade).toHaveBeenCalledTimes(1);

    cancel();
    expect(mockCancelFastL2).toHaveBeenCalledTimes(1);
    expect(mockCancelLatestTrade).toHaveBeenCalledTimes(1);
  });

  it('resolves and warms the exact display target without creating a second owner', async () => {
    expect(resolvePerpsProRealtimeTarget(market)).toEqual({
      coin: 'BTC',
      precision: { mantissa: 2, nSigFigs: 5 },
    });

    await expect(prewarmPerpsProRealtimeDisplaySnapshot(market)).resolves.toBe(
      true,
    );
    await expect(
      waitForPerpsProRealtimeDisplaySnapshot(market, 123),
    ).resolves.toBe(true);

    expect(mockPrewarmFastL2HttpSnapshot).toHaveBeenCalledWith({
      coin: 'BTC',
      precision: { mantissa: 2, nSigFigs: 5 },
    });
    expect(mockWaitForFastL2HttpSnapshot).toHaveBeenCalledWith({
      coin: 'BTC',
      precision: { mantissa: 2, nSigFigs: 5 },
      timeoutMs: 123,
    });
    expect(mockPrewarmFastL2).not.toHaveBeenCalled();
    expect(mockPrewarmLatestTrade).not.toHaveBeenCalled();
  });

  it('skips exact display warming when the precision target is invalid', async () => {
    await expect(
      prewarmPerpsProRealtimeDisplaySnapshot({ ...market, price: null }),
    ).resolves.toBe(false);
    await expect(
      waitForPerpsProRealtimeDisplaySnapshot({ ...market, price: null }, 123),
    ).resolves.toBe(false);

    expect(mockPrewarmFastL2HttpSnapshot).not.toHaveBeenCalled();
    expect(mockWaitForFastL2HttpSnapshot).not.toHaveBeenCalled();
  });
});
