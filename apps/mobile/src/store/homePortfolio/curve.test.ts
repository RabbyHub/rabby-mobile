import {
  createInitialHomeAccountProjection,
  reduceHomeAccountProjection,
} from './model';
import { buildHomeCurveProjection } from './curve';

const ADDRESS_A = '0xaaa';
const ADDRESS_B = '0xbbb';

const CURVE_POINT = {
  value: 100,
  netWorth: '$100',
  change: '$10',
  rawChange: 10,
  isLoss: false,
  changePercent: '10.00%',
  timestamp: 1,
  dateString: 'date',
  clockTimeString: 'time',
  dateTimeString: 'datetime',
};

function resolveAccounts(addresses: string[]) {
  return reduceHomeAccountProjection(createInitialHomeAccountProjection(), {
    selectedAddresses: addresses,
    hasResolvedSelection: true,
    matteredAccountLength: addresses.length,
    hasResolvedMatteredAccountLength: true,
    hasFetchedAccounts: true,
    isFetchingAccounts: false,
  });
}

describe('home curve projection', () => {
  it('does not publish a curve from an older account selection', () => {
    const projection = buildHomeCurveProjection({
      account: resolveAccounts([ADDRESS_B]),
      sceneAddresses: [ADDRESS_A],
      list: [CURVE_POINT],
      curveValueMap: {
        [ADDRESS_A]: [{ timestamp: 1, usd_value: 100 }],
      },
      isSceneLoading: false,
      isSceneComputing: false,
    });

    expect(projection).toMatchObject({
      availability: 'loading',
      value: undefined,
      sourceAddresses: [],
      missingAddresses: [ADDRESS_B],
    });
  });

  it('publishes a settled curve only for the matching selection', () => {
    const projection = buildHomeCurveProjection({
      account: resolveAccounts([ADDRESS_A]),
      sceneAddresses: [ADDRESS_A],
      list: [CURVE_POINT],
      curveValueMap: {
        [ADDRESS_A]: [{ timestamp: 1, usd_value: 100 }],
      },
      isSceneLoading: false,
      isSceneComputing: false,
    });

    expect(projection).toMatchObject({
      availability: 'ready',
      sourceAddresses: [ADDRESS_A],
      missingAddresses: [],
      value: { list: [CURVE_POINT] },
    });
  });

  it('keeps an active matched curve in loading availability', () => {
    const projection = buildHomeCurveProjection({
      account: resolveAccounts([ADDRESS_A]),
      sceneAddresses: [ADDRESS_A],
      list: [CURVE_POINT],
      curveValueMap: {
        [ADDRESS_A]: [{ timestamp: 1, usd_value: 100 }],
      },
      isSceneLoading: true,
      isSceneComputing: false,
    });

    expect(projection).toMatchObject({
      availability: 'loading',
      value: { list: [CURVE_POINT] },
      activity: {
        isFetchingRemote: true,
        isActive: true,
      },
    });
  });

  it('distinguishes a settled empty curve from loading', () => {
    const projection = buildHomeCurveProjection({
      account: resolveAccounts([ADDRESS_A]),
      sceneAddresses: [ADDRESS_A],
      list: [],
      curveValueMap: {},
      isSceneLoading: false,
      isSceneComputing: false,
    });

    expect(projection).toMatchObject({
      availability: 'empty',
      value: { list: [] },
    });
  });
});
