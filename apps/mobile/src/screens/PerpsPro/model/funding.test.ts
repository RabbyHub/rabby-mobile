import type { FundingHistoryItem } from '@rabby-wallet/hyperliquid-sdk';

import {
  annualizePerpsFundingRate,
  calculateEstimatedPerpsFunding,
  formatPerpsFundingCountdown,
  getPerpsEstimatedFundingState,
  getNextPerpsFundingTime,
  getPerpsFundingCountdownMs,
  getPerpsFundingDirection,
  PERPS_PRO_FUNDING_SCHEDULE,
  selectPerpsSignedPositionSize,
  selectPreviousPerpsFunding,
} from './funding';

describe('Perps Pro funding model', () => {
  it('derives every hourly funding consumer from one Pro-local schedule', () => {
    expect(PERPS_PRO_FUNDING_SCHEDULE).toEqual({
      countdownRefreshMs: 1000,
      historyLookbackIntervals: 6,
      historyLookbackMs: 21_600_000,
      intervalHours: 1,
      intervalLabel: '1h',
      intervalMs: 3_600_000,
      intervalsPerYear: 8760,
    });
  });

  it('uses the real one-hour annualization and direction semantics', () => {
    expect(annualizePerpsFundingRate('0.0001')).toBeCloseTo(0.876);
    expect(getPerpsFundingDirection('0.0001')).toBe('long-pays-short');
    expect(getPerpsFundingDirection('-0.0001')).toBe('short-pays-long');
    expect(getPerpsFundingDirection('0')).toBe('none');
  });

  it('calibrates countdown from a server-time sample', () => {
    const { intervalMs } = PERPS_PRO_FUNDING_SCHEDULE;
    const serverTime = 10 * intervalMs + 15 * 60 * 1000;
    const receivedAt = 1000;
    expect(getNextPerpsFundingTime(serverTime)).toBe(11 * intervalMs);
    expect(
      getPerpsFundingCountdownMs(
        { receivedAt, serverTime },
        receivedAt + 5 * 60 * 1000,
      ),
    ).toBe(40 * 60 * 1000);
    expect(formatPerpsFundingCountdown(40 * 60 * 1000)).toBe('00:40:00');
    expect(formatPerpsFundingCountdown(null)).toBe('--:--');
  });

  it('selects the latest valid history item before the boundary', () => {
    const history: FundingHistoryItem[] = [
      { coin: 'BTC', fundingRate: '0.1', premium: '0', time: 100 },
      { coin: 'BTC', fundingRate: '0.2', premium: '0', time: 200 },
      { coin: 'BTC', fundingRate: 'bad', premium: '0', time: 250 },
      { coin: 'BTC', fundingRate: '0.3', premium: '0', time: 300 },
    ];
    expect(selectPreviousPerpsFunding(history, 300)).toEqual(history[1]);
  });

  it('calculates signed estimated funding cash flow', () => {
    expect(
      calculateEstimatedPerpsFunding({
        signedPositionSize: '2',
        oraclePrice: '100',
        fundingRate: '0.01',
      }),
    ).toBe(-2);
    expect(
      calculateEstimatedPerpsFunding({
        signedPositionSize: '-2',
        oraclePrice: '100',
        fundingRate: '0.01',
      }),
    ).toBe(2);
    expect(
      calculateEstimatedPerpsFunding({
        signedPositionSize: '2',
        oraclePrice: '',
        fundingRate: '0.01',
      }),
    ).toBeNull();
    expect(
      calculateEstimatedPerpsFunding({
        signedPositionSize: '0',
        oraclePrice: '100',
        fundingRate: '0.01',
      }),
    ).toBeNull();
  });

  it('distinguishes account loading, no position, missing market data, and ready', () => {
    expect(
      getPerpsEstimatedFundingState({
        accountReady: false,
        signedPositionSize: '2',
        oraclePrice: '100',
        fundingRate: '0.01',
      }),
    ).toEqual({ status: 'loading-account', value: null });
    expect(
      getPerpsEstimatedFundingState({
        accountReady: true,
        signedPositionSize: null,
        oraclePrice: '100',
        fundingRate: '0.01',
      }),
    ).toEqual({ status: 'no-position', value: null });
    expect(
      getPerpsEstimatedFundingState({
        accountReady: true,
        signedPositionSize: '0',
        oraclePrice: '100',
        fundingRate: '0.01',
      }),
    ).toEqual({ status: 'no-position', value: null });
    expect(
      getPerpsEstimatedFundingState({
        accountReady: true,
        signedPositionSize: '2',
        oraclePrice: '',
        fundingRate: '0.01',
      }),
    ).toEqual({ status: 'missing-market-data', value: null });
  });

  it.each([
    ['2', '0.01', -2],
    ['-2', '0.01', 2],
    ['2', '-0.01', 2],
    ['-2', '-0.01', -2],
  ])(
    'keeps long/short and positive/negative rate signs for size %s and rate %s',
    (signedPositionSize, fundingRate, value) => {
      expect(
        getPerpsEstimatedFundingState({
          accountReady: true,
          signedPositionSize,
          oraclePrice: '100',
          fundingRate,
        }),
      ).toEqual({ status: 'ready', value });
    },
  );

  it('selects the exact canonical BTC/ETH position and ignores stale data while switching accounts', () => {
    const positions = [
      { position: { coin: 'BTC', szi: '1' }, type: 'oneWay' },
      { position: { coin: 'ETH', szi: '-2' }, type: 'oneWay' },
    ];

    expect(selectPerpsSignedPositionSize(positions, 'BTC')).toBe('1');
    expect(selectPerpsSignedPositionSize(positions, 'ETH')).toBe('-2');
    expect(selectPerpsSignedPositionSize(positions, 'btc')).toBeNull();
    expect(
      getPerpsEstimatedFundingState({
        accountReady: false,
        signedPositionSize: selectPerpsSignedPositionSize(positions, 'BTC'),
        oraclePrice: '100',
        fundingRate: '0.01',
      }),
    ).toEqual({ status: 'loading-account', value: null });
  });
});
