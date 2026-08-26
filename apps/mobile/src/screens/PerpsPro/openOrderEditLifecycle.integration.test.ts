import type { Account } from '@/core/startupServices/preference';
import type { PerpsModifyOpenOrderDependencies } from '@/hooks/perps/actions/modifyOpenOrder';
import { ExchangeClient, type OpenOrder } from '@rabby-wallet/hyperliquid-sdk';
import {
  recoverTypedSignature,
  SignTypedDataVersion,
} from '@metamask/eth-sig-util';
import {
  prepareL1ActionTypedData,
  signL1AgentAction,
} from '@rabby-wallet/hyperliquid-sdk/dist/utils/signer';

jest.mock('@ledgerhq/react-native-hw-transport-ble', () => ({
  __esModule: true,
  default: class IntegrationTestBleTransport {},
}));

import { buildPerpsOpenOrderViewModel } from './model/openOrder';

let buildPerpsModifyOpenOrderCommand: typeof import('@/hooks/perps/actions/modifyOpenOrder').buildPerpsModifyOpenOrderCommand;
let executePerpsModifyOpenOrder: typeof import('@/hooks/perps/actions/modifyOpenOrder').executePerpsModifyOpenOrder;

const account = {
  address: '0x0000000000000000000000000000000000000163',
  brandName: 'Rabby',
  type: 'PrivateKey',
} as Account;

const agentPrivateKey =
  '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const agentAddress = '0xfcad0b19bb29d4674531d6f115237e16afce377c';

type CapturedModifyRequest = {
  action: {
    oid: number;
    order: {
      a: number;
      b: boolean;
      p: string;
      r: boolean;
      s: string;
      t: {
        trigger: {
          isMarket: boolean;
          triggerPx: string;
          tpsl: 'sl' | 'tp';
        };
      };
    };
    type: string;
  };
  nonce: number;
  signature: { r: string; s: string; v: number };
};

const joinSignature = ({ r, s, v }: CapturedModifyRequest['signature']) =>
  `${r}${s.slice(2)}${v.toString(16).padStart(2, '0')}`;

const makeTriggerLimitOrder = (
  overrides: Partial<OpenOrder> = {},
): OpenOrder => ({
  cloid: null,
  coin: 'BTC',
  isPositionTpsl: false,
  isTrigger: true,
  limitPx: '105',
  oid: 163,
  orderType: 'Take Profit Limit',
  origSz: '0.5',
  reduceOnly: false,
  side: 'B',
  sz: '0.5',
  tif: null,
  timestamp: 1,
  triggerCondition: 'Above',
  triggerPx: '110',
  ...overrides,
});

describe('Perps Pro open order edit lifecycle integration', () => {
  beforeAll(async () => {
    jest.useFakeTimers();
    try {
      const action = await import('@/hooks/perps/actions/modifyOpenOrder');
      buildPerpsModifyOpenOrderCommand =
        action.buildPerpsModifyOpenOrderCommand;
      executePerpsModifyOpenOrder = action.executePerpsModifyOpenOrder;
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('projects an opening Conditional Limit through one direct modify', async () => {
    let liveOrder = makeTriggerLimitOrder();
    const before = buildPerpsOpenOrderViewModel(liveOrder);
    const modifyOrder = jest.fn(
      async (
        params: Parameters<PerpsModifyOpenOrderDependencies['modifyOrder']>[0],
      ) => {
        const trigger = params.orderType as {
          trigger: { triggerPx: string };
        };
        liveOrder = {
          ...liveOrder,
          limitPx: params.limitPx,
          sz: params.sz,
          triggerPx: trigger.trigger.triggerPx,
        };
        return { response: { type: 'default' }, status: 'ok' };
      },
    );
    const dependencies: PerpsModifyOpenOrderDependencies = {
      getCurrentAccount: () => account,
      getCurrentDex: () => '',
      getOrderStatus: async () => ({ status: 'unknownOid' }),
      hasPermission: () => true,
      modifyOrder,
      refreshClearinghouse: jest.fn(),
      refreshOpenOrders: jest.fn(),
    };

    expect(before.editKind).toBe('triggerLimit');
    const command = buildPerpsModifyOpenOrderCommand({
      account,
      baseSize: '0.4',
      cloid: before.cloid,
      coin: before.coin,
      dexId: '',
      editKind: 'triggerLimit',
      expectedIsPositionTpsl: before.isPositionTpsl,
      expectedLimitPrice: before.limitPrice!,
      expectedOrderType: before.orderType,
      expectedRemainingSize: before.remainingSize,
      expectedTriggerPrice: before.triggerPrice,
      limitPrice: '106',
      marketKey: 'hyperliquid::BTC',
      oid: before.oid,
      pxDecimals: 2,
      reduceOnly: before.reduceOnly,
      side: before.side,
      szDecimals: 3,
      triggerKind: before.triggerKind,
      triggerPrice: '112',
    });

    await expect(
      executePerpsModifyOpenOrder(command, dependencies),
    ).resolves.toEqual({ kind: 'updated', refreshError: undefined });
    expect(modifyOrder).toHaveBeenCalledTimes(1);
    expect(modifyOrder).toHaveBeenCalledWith({
      coin: 'BTC',
      isBuy: true,
      limitPx: '106',
      oid: 163,
      orderType: {
        trigger: { isMarket: false, triggerPx: '112', tpsl: 'tp' },
      },
      reduceOnly: false,
      sz: '0.4',
    });
    expect(buildPerpsOpenOrderViewModel(liveOrder)).toMatchObject({
      editKind: 'triggerLimit',
      limitPrice: '106',
      remainingSize: '0.4',
      triggerPrice: '112',
    });
  });

  it('signs a Conditional modify that the canonical server wire recovers to the intended agent', async () => {
    const nonce = 1_777_777_777_777;
    jest.spyOn(Date, 'now').mockReturnValue(nonce);

    let captured: CapturedModifyRequest | null = null;
    const exchange = new ExchangeClient({
      agentPrivateKey,
      masterAddress: account.address,
    });
    const sdkBoundaries = exchange as unknown as {
      httpClient: {
        exchange: (request: CapturedModifyRequest) => Promise<unknown>;
      };
      symbolConversion: { getAssetIndex: (coin: string) => Promise<number> };
    };
    sdkBoundaries.symbolConversion = {
      getAssetIndex: async coin => (coin === 'BTC' ? 0 : -1),
    };
    sdkBoundaries.httpClient = {
      exchange: async request => {
        captured = request;
        return { response: { type: 'default' }, status: 'ok' };
      },
    };

    const liveOrder = makeTriggerLimitOrder();
    const command = buildPerpsModifyOpenOrderCommand({
      account,
      baseSize: '0.4',
      cloid: null,
      coin: 'BTC',
      dexId: '',
      editKind: 'triggerLimit',
      expectedIsPositionTpsl: false,
      expectedLimitPrice: liveOrder.limitPx,
      expectedOrderType: liveOrder.orderType,
      expectedRemainingSize: liveOrder.sz,
      expectedTriggerPrice: liveOrder.triggerPx,
      limitPrice: '106',
      marketKey: 'hyperliquid::BTC',
      oid: liveOrder.oid,
      pxDecimals: 2,
      reduceOnly: liveOrder.reduceOnly,
      side: 'buy',
      szDecimals: 3,
      triggerKind: 'takeProfit',
      triggerPrice: '112',
    });
    const dependencies: PerpsModifyOpenOrderDependencies = {
      getCurrentAccount: () => account,
      getCurrentDex: () => '',
      getOrderStatus: async () => ({
        order: { order: liveOrder, status: 'open', statusTimestamp: 1 },
        status: 'order',
      }),
      hasPermission: () => true,
      modifyOrder: params => exchange.modifyOrder(params),
      refreshClearinghouse: jest.fn(),
      refreshOpenOrders: jest.fn(),
    };

    await expect(
      executePerpsModifyOpenOrder(command, dependencies),
    ).resolves.toEqual({ kind: 'updated', refreshError: undefined });
    expect(captured).not.toBeNull();

    const request = captured!;
    expect(Object.keys(request.action.order.t.trigger)).toEqual([
      'isMarket',
      'triggerPx',
      'tpsl',
    ]);
    const trigger = request.action.order.t.trigger;
    const canonicalAction = {
      type: request.action.type,
      oid: request.action.oid,
      order: {
        a: request.action.order.a,
        b: request.action.order.b,
        p: request.action.order.p,
        s: request.action.order.s,
        r: request.action.order.r,
        t: {
          trigger: {
            isMarket: trigger.isMarket,
            triggerPx: trigger.triggerPx,
            tpsl: trigger.tpsl,
          },
        },
      },
    };
    const canonicalTypedData = prepareL1ActionTypedData({
      action: canonicalAction,
      isTestnet: false,
      nonce: request.nonce,
    });

    expect(
      recoverTypedSignature({
        data: canonicalTypedData,
        signature: joinSignature(request.signature),
        version: SignTypedDataVersion.V4,
      }).toLowerCase(),
    ).toBe(agentAddress);

    const legacyAction = {
      ...canonicalAction,
      order: {
        ...canonicalAction.order,
        t: {
          trigger: {
            isMarket: trigger.isMarket,
            tpsl: trigger.tpsl,
            triggerPx: trigger.triggerPx,
          },
        },
      },
    };
    expect(
      recoverTypedSignature({
        data: canonicalTypedData,
        signature: joinSignature(
          signL1AgentAction(agentPrivateKey, legacyAction, false, nonce),
        ),
        version: SignTypedDataVersion.V4,
      }).toLowerCase(),
    ).not.toBe(agentAddress);
  });
});
