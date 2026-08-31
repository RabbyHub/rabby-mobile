jest.mock('@/core/apis/perps', () => ({ apisPerps: {} }));
jest.mock('@/hooks/perps/usePerpsStore', () => ({
  fetchClearinghouseStateHttp: jest.fn(),
  fetchPositionOpenOrdersHttp: jest.fn(),
  getDexByCoin: jest.fn(() => ''),
  perpsStore: { getState: jest.fn(() => ({})) },
}));

import type { OpenOrder } from '@rabby-wallet/hyperliquid-sdk';

import {
  buildPerpsPositionTpSlCommand,
  executePerpsPositionTpSl,
  PERPS_POSITION_TPSL_SLIPPAGE,
  type PositionTpSlDependencies,
} from './positionTpSl';
import { PerpsActionUserCancelledError } from './actionError';

const account = {
  address: '0x0000000000000000000000000000000000000001',
  type: 'hd' as const,
};

const openOrder = (overrides: Partial<OpenOrder> = {}): OpenOrder => ({
  coin: 'BTC',
  isPositionTpsl: false,
  isTrigger: true,
  limitPx: '0',
  oid: 7,
  orderType: 'Take Profit Market',
  origSz: '0.5',
  reduceOnly: true,
  side: 'A',
  sz: '0.5',
  tif: null,
  timestamp: 1,
  triggerCondition: 'Price above 110',
  triggerPx: '110',
  ...overrides,
});

const accepted = (oid = 99) => ({
  response: { data: { statuses: [{ resting: { oid } }] } },
  status: 'ok',
});

const cancelled = () => ({
  response: { data: { statuses: ['success'] } },
  status: 'ok',
});

const dependencies = (
  overrides: Partial<PositionTpSlDependencies> = {},
): PositionTpSlDependencies => ({
  cancelOrder: jest.fn().mockResolvedValue(cancelled()),
  getCurrentAccount: jest.fn(() => account),
  getLiveMark: jest.fn(() => '100'),
  getLiveOpenOrders: jest.fn(() => [openOrder()]),
  getLiveSignedSize: jest.fn(() => '1'),
  placePartial: jest.fn().mockResolvedValue(accepted()),
  placePosition: jest.fn().mockResolvedValue(accepted()),
  refresh: jest.fn().mockResolvedValue(undefined),
  resolveDex: jest.fn(() => ''),
  ...overrides,
});

const command = (
  overrides: Partial<Parameters<typeof buildPerpsPositionTpSlCommand>[0]> = {},
) =>
  buildPerpsPositionTpSlCommand({
    account,
    coin: 'BTC',
    direction: 'long',
    expectedPositionSize: '1',
    legs: [
      {
        kind: 'takeProfit',
        replaceOid: 7,
        size: '0.5',
        triggerPrice: '110',
      },
    ],
    markPrice: '100',
    pxDecimals: 2,
    scope: 'partial',
    szDecimals: 3,
    ...overrides,
  });

describe('Perps position TP/SL action', () => {
  it('builds an immutable command and validates each amount against the position', () => {
    const result = command();
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.legs)).toBe(true);
    expect(() =>
      command({
        legs: [{ kind: 'takeProfit', size: '1.001', triggerPrice: '110' }],
      }),
    ).toThrow('Invalid partial Position TP/SL amount');
  });

  it('validates TP and SL against Mark for long and short positions', () => {
    expect(() =>
      command({
        legs: [{ kind: 'takeProfit', size: '0.5', triggerPrice: '99' }],
      }),
    ).toThrow('Invalid Position TP/SL trigger price');
    expect(() =>
      command({
        direction: 'short',
        legs: [{ kind: 'stopLoss', size: '0.5', triggerPrice: '99' }],
      }),
    ).toThrow('Invalid Position TP/SL trigger price');
  });

  it('rejects a direct trigger that violates Hyperliquid price precision', () => {
    expect(() =>
      command({
        legs: [{ kind: 'takeProfit', size: '0.5', triggerPrice: '110.123' }],
      }),
    ).toThrow('Invalid Position TP/SL trigger price');
  });

  it('strictly cancels before creating and passes 8% slippage', async () => {
    const callOrder: string[] = [];
    const deps = dependencies({
      cancelOrder: jest.fn(async () => {
        callOrder.push('cancel');
        return cancelled();
      }),
      placePartial: jest.fn(async params => {
        callOrder.push('create');
        expect(params).toMatchObject({
          coin: 'BTC',
          isBuy: false,
          reduceOnly: true,
          size: '0.5',
          slippage: PERPS_POSITION_TPSL_SLIPPAGE,
          tpsl: 'tp',
          triggerPx: '110',
        });
        return accepted();
      }),
    });

    await expect(
      executePerpsPositionTpSl(command(), deps),
    ).resolves.toMatchObject({
      kind: 'success',
      legs: [{ cancel: 'success', create: 'success', oid: 99 }],
    });
    expect(callOrder).toEqual(['cancel', 'create']);
    expect(deps.refresh).toHaveBeenCalledWith('');
  });

  it('rejects a direct Open Orders edit when the expected trigger fingerprint changed', async () => {
    const deps = dependencies({
      getLiveOpenOrders: jest.fn(() => [openOrder({ triggerPx: '111' })]),
    });
    const value = command({
      legs: [
        {
          expectedOrder: {
            execution: 'market',
            remainingSize: '0.5',
            side: 'A',
            triggerPrice: '110',
          },
          kind: 'takeProfit',
          replaceOid: 7,
          size: '0.4',
          triggerPrice: '112',
        },
      ],
    });

    await expect(executePerpsPositionTpSl(value, deps)).resolves.toEqual({
      kind: 'staleContext',
      legs: [],
    });
    expect(deps.cancelOrder).not.toHaveBeenCalled();
    expect(deps.placePartial).not.toHaveBeenCalled();
  });

  it('matches a replacement fingerprint by coin and oid across markets', async () => {
    const deps = dependencies({
      getLiveOpenOrders: jest.fn(() => [
        openOrder({ coin: 'ETH', triggerPx: '999' }),
        openOrder(),
      ]),
    });
    const value = command({
      legs: [
        {
          expectedOrder: {
            execution: 'market',
            remainingSize: '0.5',
            side: 'A',
            triggerPrice: '110',
          },
          kind: 'takeProfit',
          replaceOid: 7,
          size: '0.4',
          triggerPrice: '112',
        },
      ],
    });

    await expect(executePerpsPositionTpSl(value, deps)).resolves.toMatchObject({
      kind: 'success',
      legs: [{ cancel: 'success', create: 'success' }],
    });
    expect(deps.cancelOrder).toHaveBeenCalledTimes(1);
  });

  it('creates TP and SL as independent partial triggers even when combined coverage exceeds 100%', async () => {
    const deps = dependencies({ getLiveOpenOrders: jest.fn(() => []) });
    const value = command({
      legs: [
        { kind: 'takeProfit', size: '0.75', triggerPrice: '110' },
        { kind: 'stopLoss', size: '0.75', triggerPrice: '90' },
      ],
    });

    await expect(executePerpsPositionTpSl(value, deps)).resolves.toMatchObject({
      kind: 'success',
      legs: [
        { create: 'success', kind: 'takeProfit' },
        { create: 'success', kind: 'stopLoss' },
      ],
    });
    expect(deps.placePartial).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ reduceOnly: true, size: '0.75', tpsl: 'tp' }),
    );
    expect(deps.placePartial).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ reduceOnly: true, size: '0.75', tpsl: 'sl' }),
    );
  });

  it('never creates when cancellation fails', async () => {
    const deps = dependencies({
      cancelOrder: jest.fn().mockResolvedValue({
        response: { data: { statuses: [{ error: 'no order' }] } },
        status: 'ok',
      }),
    });

    await expect(
      executePerpsPositionTpSl(command(), deps),
    ).resolves.toMatchObject({
      kind: 'failed',
      legs: [{ cancel: 'failed', create: 'notAttempted' }],
    });
    expect(deps.placePartial).not.toHaveBeenCalled();
    expect(deps.refresh).not.toHaveBeenCalled();
  });

  it('reports the irreversible cancel-success create-failure state as partial', async () => {
    const deps = dependencies({
      placePartial: jest.fn().mockRejectedValue(new Error('create failed')),
    });

    await expect(
      executePerpsPositionTpSl(command(), deps),
    ).resolves.toMatchObject({
      failureReason: 'requestFailed',
      kind: 'partial',
      legs: [
        {
          cancel: 'success',
          create: 'failed',
          error: 'create failed',
        },
      ],
    });
    expect(deps.refresh).toHaveBeenCalled();
  });

  it('revalidates live size after cancellation before creating a partial order', async () => {
    let reads = 0;
    const deps = dependencies({
      getLiveSignedSize: jest.fn(() => {
        reads += 1;
        return reads <= 2 ? '1' : '0.25';
      }),
    });

    const result = await executePerpsPositionTpSl(command(), deps);
    expect(result).toMatchObject({
      kind: 'partial',
      legs: [
        {
          cancel: 'success',
          create: 'notAttempted',
          error: 'Position size changed before TP/SL creation',
        },
      ],
    });
    expect(deps.placePartial).not.toHaveBeenCalled();
  });

  it('blocks before any mutation when the latest Mark invalidates a trigger', async () => {
    const deps = dependencies({ getLiveMark: jest.fn(() => '111') });

    await expect(executePerpsPositionTpSl(command(), deps)).resolves.toEqual({
      kind: 'staleContext',
      legs: [],
    });
    expect(deps.cancelOrder).not.toHaveBeenCalled();
  });

  it('creates position TP and SL in one grouped request and maps response order by kind', async () => {
    const deps = dependencies({
      getLiveOpenOrders: jest.fn(() => []),
      placePosition: jest.fn().mockResolvedValue({
        response: {
          data: {
            statuses: [{ resting: { oid: 10 } }, { resting: { oid: 11 } }],
          },
        },
        status: 'ok',
      }),
    });
    const full = command({
      legs: [
        { kind: 'stopLoss', triggerPrice: '90' },
        { kind: 'takeProfit', triggerPrice: '110' },
      ],
      scope: 'position',
    });

    const result = await executePerpsPositionTpSl(full, deps);
    expect(deps.placePosition).toHaveBeenCalledWith(
      expect.objectContaining({
        isBuy: true,
        slTriggerPx: '90',
        slippage: 0.08,
        tpTriggerPx: '110',
      }),
    );
    expect(result.legs).toEqual([
      expect.objectContaining({ kind: 'stopLoss', oid: 11 }),
      expect.objectContaining({ kind: 'takeProfit', oid: 10 }),
    ]);
  });

  it('stops the remaining workflow when a signer cancellation occurs', async () => {
    const deps = dependencies({
      cancelOrder: jest
        .fn()
        .mockRejectedValue(new PerpsActionUserCancelledError()),
    });
    const value = command({
      legs: [
        {
          kind: 'takeProfit',
          replaceOid: 7,
          size: '0.5',
          triggerPrice: '110',
        },
        {
          kind: 'stopLoss',
          size: '0.5',
          triggerPrice: '90',
        },
      ],
    });

    const result = await executePerpsPositionTpSl(value, deps);
    expect(result.failureReason).toBe('userCancelled');
    expect(deps.cancelOrder).toHaveBeenCalledTimes(1);
    expect(deps.placePartial).not.toHaveBeenCalled();
  });

  it('preserves the irreversible cancel result when creation signing is cancelled', async () => {
    const deps = dependencies({
      placePartial: jest
        .fn()
        .mockRejectedValue(new PerpsActionUserCancelledError()),
    });

    await expect(
      executePerpsPositionTpSl(command(), deps),
    ).resolves.toMatchObject({
      failureReason: 'userCancelled',
      kind: 'partial',
      legs: [{ cancel: 'success', create: 'failed' }],
    });
    expect(deps.refresh).toHaveBeenCalled();
  });

  it('reconciles a partially accepted grouped Position TP/SL response after SDK rejection', async () => {
    let liveOrders: OpenOrder[] = [];
    const deps = dependencies({
      getLiveOpenOrders: jest.fn(() => liveOrders),
      placePosition: jest.fn().mockRejectedValue(new Error('SL rejected')),
      refresh: jest.fn(async () => {
        liveOrders = [
          openOrder({
            isPositionTpsl: true,
            oid: 88,
            sz: '0',
            triggerPx: '110',
          }),
        ];
      }),
    });
    const value = command({
      legs: [
        { kind: 'takeProfit', triggerPrice: '110' },
        { kind: 'stopLoss', triggerPrice: '90' },
      ],
      scope: 'position',
    });

    const result = await executePerpsPositionTpSl(value, deps);
    expect(result.kind).toBe('partial');
    expect(result.legs).toEqual([
      expect.objectContaining({
        create: 'success',
        kind: 'takeProfit',
        oid: 88,
      }),
      expect.objectContaining({ create: 'failed', kind: 'stopLoss' }),
    ]);
  });
});
