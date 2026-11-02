import { markRateGuideViewed } from './rateGuideState';

describe('markRateGuideViewed', () => {
  it('keeps transaction history so other home blocks stay visible', () => {
    const previous = {
      txCount: 3,
      latestTxHashes: ['0x1', '0x2', '0x3'],
      lastExposure_20250618_1: {
        time: 123,
        userViewedRate: false,
      },
    };

    expect(markRateGuideViewed(previous)).toEqual({
      txCount: 3,
      latestTxHashes: ['0x1', '0x2', '0x3'],
      lastExposure_20250618_1: {
        time: 123,
        userViewedRate: true,
      },
    });
  });

  it('creates the exposure metadata when it is missing', () => {
    expect(markRateGuideViewed({ txCount: 0 })).toEqual({
      txCount: 0,
      lastExposure_20250618_1: {
        time: -1,
        userViewedRate: true,
      },
    });
  });
});
