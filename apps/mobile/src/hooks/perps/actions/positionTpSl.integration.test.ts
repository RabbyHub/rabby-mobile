import type { Account } from '@/core/startupServices/preference';
import type { AssetPosition, OpenOrder } from '@rabby-wallet/hyperliquid-sdk';
import { buildPerpsPositions } from '@/screens/PerpsPro/model/position';
import { buildPositionTpSlSummary } from '@/screens/PerpsPro/model/positionTpSl';
import type { PositionTpSlDependencies } from './positionTpSl';

jest.mock('@ledgerhq/react-native-hw-transport-ble', () => ({
  __esModule: true,
  default: class IntegrationTestBleTransport {},
}));

let action: typeof import('./positionTpSl');
let perpsStore: typeof import('../usePerpsStore').perpsStore;
let previousState: ReturnType<typeof perpsStore.getState>;

const account = {
  address: '0x0000000000000000000000000000000000000547',
  brandName: 'Rabby',
  type: 'PrivateKey',
} as Account;

const position = (short = false): AssetPosition => ({
  type: 'oneWay',
  position: {
    coin: 'BTC',
    cumFunding: { allTime: '0', sinceChange: '0', sinceOpen: '0' },
    entryPx: '100',
    leverage: { type: 'cross', value: 10 },
    liquidationPx: short ? '120' : '80',
    marginUsed: '10',
    maxLeverage: 50,
    positionValue: '100',
    returnOnEquity: '0',
    szi: short ? '-1' : '1',
    unrealizedPnl: '0',
  },
});

const order = (
  oid: number,
  tp: boolean,
  triggerPx: string,
  short = false,
): OpenOrder => ({
  coin: 'BTC',
  isPositionTpsl: true,
  isTrigger: true,
  reduceOnly: true,
  oid,
  orderType: tp ? 'Take Profit Market' : 'Stop Market',
  origSz: '0',
  sz: '0',
  limitPx: triggerPx,
  side: short ? 'B' : 'A',
  tif: null,
  timestamp: oid,
  triggerCondition: '',
  triggerPx,
});
const response = (statuses: unknown[]) => ({
  status: 'ok',
  response: { data: { statuses } },
});

const readPosition = () =>
  buildPerpsPositions(
    perpsStore.getState().currentClearinghouseState?.assetPositions ?? [],
    perpsStore.getState().openOrders,
  )[0]!;

// A stateful exchange boundary. Repository Store, model, command and executor
// stay real; no signer, SDK request or real order can run through this adapter.
const exchangeSession = (
  orders: OpenOrder[],
  options: {
    short?: boolean;
    cancelFailure?: number;
    createFailure?: 'tp' | 'sl';
    refreshFailure?: boolean;
  } = {},
) => {
  let remoteOrders = [...orders];
  let nextOid = 100;
  const requests: Array<
    | { type: 'cancel'; oid: number }
    | {
        type: 'create';
        params: Parameters<PositionTpSlDependencies['placePosition']>[0];
      }
  > = [];
  perpsStore.setState({
    currentPerpsAccount: account,
    currentClearinghouseState: {
      assetPositions: [position(options.short)],
    } as NonNullable<
      ReturnType<typeof perpsStore.getState>['currentClearinghouseState']
    >,
    openOrders: [...orders],
  });
  const dependencies: PositionTpSlDependencies = {
    getCurrentAccount: () => perpsStore.getState().currentPerpsAccount,
    getLiveMark: () => '100',
    getLiveOpenOrders: () => perpsStore.getState().openOrders,
    getLiveSignedSize: () =>
      perpsStore.getState().currentClearinghouseState?.assetPositions[0]
        ?.position.szi ?? null,
    resolveDex: () => '',
    cancelOrder: async (_coin, oid) => {
      requests.push({ type: 'cancel', oid });
      if (options.cancelFailure === oid)
        return response([{ error: 'Cancel rejected' }]);
      remoteOrders = remoteOrders.filter(item => item.oid !== oid);
      return response(['success']);
    },
    placePosition: async params => {
      requests.push({ type: 'create', params });
      const statuses = (['tp', 'sl'] as const).flatMap<unknown>(kind => {
        const trigger = kind === 'tp' ? params.tpTriggerPx : params.slTriggerPx;
        if (!trigger) return [];
        if (options.createFailure === kind)
          return [{ error: 'Create rejected' }];
        const oid = nextOid++;
        remoteOrders.push(order(oid, kind === 'tp', trigger, options.short));
        return [{ resting: { oid } }];
      });
      return response(statuses);
    },
    placePartial: async () => {
      throw new Error('Full Position must not call partial placement');
    },
    refresh: async () => {
      if (options.refreshFailure) throw new Error('Refresh unavailable');
      perpsStore.setState({ openOrders: [...remoteOrders] });
    },
  };
  const command = (
    legs: Parameters<typeof action.buildPerpsPositionTpSlCommand>[0]['legs'],
  ) => {
    const view = readPosition();
    return action.buildPerpsPositionTpSlCommand({
      account,
      coin: view.coin,
      direction: view.direction,
      expectedPositionSize: view.baseSize,
      legs,
      markPrice: '100',
      pxDecimals: 2,
      scope: 'position',
      szDecimals: 3,
    });
  };
  return { command, dependencies, requests };
};

describe('Full-position TP/SL command and live projection integration', () => {
  beforeAll(async () => {
    jest.useFakeTimers();
    try {
      action = await import('./positionTpSl');
      ({ perpsStore } = await import('../usePerpsStore'));
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });
  beforeEach(() => {
    previousState = perpsStore.getState();
  });
  afterEach(() => {
    perpsStore.setState(previousState);
  });

  it.each([false, true])(
    'replaces only the selected changed leg while retaining its companion (short=%s)',
    async short => {
      const tp = order(7, true, short ? '90' : '110', short);
      const sl = order(8, false, short ? '110' : '90', short);
      const session = exchangeSession([tp, sl], { short });
      const triggerPrice = short ? '85' : '115';
      const command = session.command([
        { kind: 'takeProfit', replaceOid: 7, size: null, triggerPrice },
      ]);
      expect(command.legs[0]?.size).toBeNull();
      const result = await action.executePerpsPositionTpSl(
        command,
        session.dependencies,
      );
      expect(result.kind).toBe('success');
      expect(session.requests).toEqual([
        { type: 'cancel', oid: 7 },
        {
          type: 'create',
          params: expect.objectContaining({
            isBuy: !short,
            slippage: 0.08,
            tpTriggerPx: triggerPrice,
            slTriggerPx: undefined,
          }),
        },
      ]);
      const summary = buildPositionTpSlSummary(
        readPosition().tpslOrders,
        '100',
      );
      expect(summary.takeProfit.positionOrders[0]).toMatchObject({
        oid: 100,
        scope: 'position',
        remainingSize: '0',
        triggerPrice,
      });
      expect(summary.stopLoss.positionOrders[0]?.oid).toBe(8);
    },
  );

  it('adds a missing leg without cancelling the existing protection', async () => {
    const session = exchangeSession([order(7, true, '110')]);
    const command = session.command([
      { kind: 'stopLoss', replaceOid: null, size: null, triggerPrice: '90' },
    ]);
    const result = await action.executePerpsPositionTpSl(
      command,
      session.dependencies,
    );
    expect(result.kind).toBe('success');
    expect(session.requests).toEqual([
      {
        type: 'create',
        params: expect.objectContaining({
          slTriggerPx: '90',
          tpTriggerPx: undefined,
        }),
      },
    ]);
    expect(
      readPosition()
        .tpslOrders.map(item => item.oid)
        .sort(),
    ).toEqual([100, 7]);
  });

  it('reports a replacement failure after cancellation while preserving a successful new companion', async () => {
    const session = exchangeSession([order(7, true, '110')], {
      createFailure: 'tp',
    });
    const command = session.command([
      { kind: 'takeProfit', replaceOid: 7, triggerPrice: '115' },
      { kind: 'stopLoss', replaceOid: null, triggerPrice: '90' },
    ]);
    const result = await action.executePerpsPositionTpSl(
      command,
      session.dependencies,
    );
    expect(result).toMatchObject({
      kind: 'partial',
      legs: [
        { kind: 'takeProfit', cancel: 'success', create: 'failed' },
        { kind: 'stopLoss', cancel: 'notRequired', create: 'success' },
      ],
    });
    expect(readPosition().tpslOrders).toEqual([
      expect.objectContaining({ kind: 'stopLoss', oid: 100 }),
    ]);
    expect(session.requests).toHaveLength(2);
  });

  it('does not create a replacement when the old leg cannot be cancelled', async () => {
    const session = exchangeSession(
      [order(7, true, '110'), order(8, false, '90')],
      { cancelFailure: 7 },
    );
    const result = await action.executePerpsPositionTpSl(
      session.command([
        { kind: 'takeProfit', replaceOid: 7, triggerPrice: '115' },
      ]),
      session.dependencies,
    );
    expect(result.kind).toBe('failed');
    expect(session.requests).toEqual([{ type: 'cancel', oid: 7 }]);
    expect(readPosition().tpslOrders.map(item => item.oid)).toEqual([7, 8]);
  });

  it.each(['duplicate', 'account', 'closed', 'reversed', 'replaced'] as const)(
    'rejects a %s context before any exchange mutation',
    async change => {
      const session = exchangeSession([order(7, true, '110')]);
      const command = session.command([
        { kind: 'takeProfit', replaceOid: 7, triggerPrice: '115' },
      ]);
      if (change === 'duplicate')
        perpsStore.setState({
          openOrders: [order(7, true, '110'), order(9, true, '112')],
        });
      if (change === 'account')
        perpsStore.setState({ currentPerpsAccount: null });
      if (change === 'closed' || change === 'reversed')
        perpsStore.setState({
          currentClearinghouseState: {
            ...perpsStore.getState().currentClearinghouseState!,
            assetPositions: change === 'closed' ? [] : [position(true)],
          },
        });
      if (change === 'replaced')
        perpsStore.setState({ openOrders: [order(9, true, '112')] });
      expect(
        await action.executePerpsPositionTpSl(command, session.dependencies),
      ).toMatchObject({ kind: 'staleContext' });
      expect(session.requests).toEqual([]);
    },
  );

  it('keeps exchange acceptance distinct from a failed refresh without retrying', async () => {
    const session = exchangeSession([order(7, true, '110')], {
      refreshFailure: true,
    });
    const result = await action.executePerpsPositionTpSl(
      session.command([{ kind: 'stopLoss', triggerPrice: '90' }]),
      session.dependencies,
    );
    expect(result).toMatchObject({
      kind: 'success',
      refreshError: 'Refresh unavailable',
    });
    expect(session.requests).toHaveLength(1);
    expect(readPosition().tpslOrders.map(item => item.oid)).toEqual([7]);
  });
});
