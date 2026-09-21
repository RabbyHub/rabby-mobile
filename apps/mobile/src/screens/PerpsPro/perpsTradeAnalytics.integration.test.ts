jest.mock('@ledgerhq/react-native-hw-transport-ble', () => ({
  __esModule: true,
  default: class IntegrationTestBleTransport {},
}));

import type { PositionTpSlDependencies } from '@/hooks/perps/actions/positionTpSl';

let buildPerpsPositionTpSlCommand: typeof import('@/hooks/perps/actions/positionTpSl').buildPerpsPositionTpSlCommand;
let executePerpsPositionTpSl: typeof import('@/hooks/perps/actions/positionTpSl').executePerpsPositionTpSl;
let reportPerpsProPositionTpSlHistory: typeof import('./analytics/manualTradeHistory').reportPerpsProPositionTpSlHistory;
let reportSpy: jest.SpyInstance;

const account = Object.freeze({
  address: '0x1111111111111111111111111111111111111111',
  type: 'PrivateKeyring',
});

describe('Perps Pro trade analytics integration', () => {
  beforeAll(async () => {
    jest.useFakeTimers();
    try {
      const [positionTpSl, analytics, statsModule] = await Promise.all([
        import('@/hooks/perps/actions/positionTpSl'),
        import('./analytics/manualTradeHistory'),
        import('@/utils/stats'),
      ]);
      buildPerpsPositionTpSlCommand =
        positionTpSl.buildPerpsPositionTpSlCommand;
      executePerpsPositionTpSl = positionTpSl.executePerpsPositionTpSl;
      reportPerpsProPositionTpSlHistory =
        analytics.reportPerpsProPositionTpSlHistory;
      reportSpy = jest
        .spyOn(statsModule.stats, 'report')
        .mockImplementation(() => {});
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  beforeEach(() => {
    reportSpy.mockClear();
  });

  afterAll(() => {
    reportSpy.mockRestore();
  });

  it('reports each newly accepted Partial Position TP/SL leg from the real Action result', async () => {
    const command = buildPerpsPositionTpSlCommand({
      account,
      coin: 'BTC',
      direction: 'long',
      expectedPositionSize: '1',
      legs: [
        {
          kind: 'takeProfit',
          replaceOid: null,
          size: '0.25',
          triggerPrice: '110',
        },
        {
          kind: 'stopLoss',
          replaceOid: null,
          size: '0.25',
          triggerPrice: '90',
        },
      ],
      markPrice: '100',
      pxDecimals: 2,
      scope: 'partial',
      szDecimals: 3,
    });
    let nextOid = 10;
    const dependencies: PositionTpSlDependencies = {
      cancelOrder: async () => {
        throw new Error('Unexpected cancel boundary');
      },
      getCurrentAccount: () => account,
      getLiveMark: () => '100',
      getLiveOpenOrders: () => [],
      getLiveSignedSize: () => '1',
      placePartial: async () => ({
        response: {
          data: { statuses: [{ resting: { oid: nextOid++ } }] },
        },
        status: 'ok',
      }),
      placePosition: async () => {
        throw new Error('Unexpected full-position boundary');
      },
      refresh: async () => undefined,
      resolveDex: () => '',
    };

    const result = await executePerpsPositionTpSl(command, dependencies);

    expect(result).toMatchObject({
      kind: 'success',
      legs: [
        { create: 'success', kind: 'takeProfit', oid: 10 },
        { create: 'success', kind: 'stopLoss', oid: 11 },
      ],
    });
    expect(
      reportPerpsProPositionTpSlHistory(command, result, {
        leverage: 5,
        marginMode: 'cross',
      }),
    ).toBe(2);
    expect(reportSpy.mock.calls.map(call => call[1])).toEqual([
      expect.objectContaining({
        price: '110',
        size: '0.25',
        trade_side: 'close long',
        trade_type: 'pro partial position take profit',
      }),
      expect.objectContaining({
        price: '90',
        size: '0.25',
        trade_side: 'close long',
        trade_type: 'pro partial position stop loss',
      }),
    ]);
  });
});
