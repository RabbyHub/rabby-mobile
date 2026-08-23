jest.mock('@/core/apis/perps', () => ({
  apisPerps: { getPerpsSDK: jest.fn() },
}));

jest.mock('@/hooks/perps/usePerpsStore', () => ({
  fetchClearinghouseStateHttp: jest.fn(),
  fetchPositionOpenOrdersHttp: jest.fn(),
  getDexByCoin: jest.fn(() => ''),
  perpsStore: { getState: jest.fn(() => ({ currentPerpsAccount: null })) },
}));

import { createPerpsProTradeFormState } from '../model/trade';
import {
  buildPerpsProOpenOrderCommand,
  executePerpsProOpenOrder,
  finalizePerpsProBboOpenOrderCommand,
  type PerpsProOpenOrderDependencies,
} from './openOrder';

const account = {
  address: '0x0000000000000000000000000000000000000001',
  type: 'watch',
};

const build = (overrides = {}) =>
  buildPerpsProOpenOrderCommand({
    account,
    bboPrice: null,
    coin: 'BTC',
    dexId: '',
    form: {
      ...createPerpsProTradeFormState(),
      amount: '63',
      ...overrides,
    },
    marketKey: 'hyperliquid::BTC',
    marketPrice: '63000',
    side: 'buy',
    szDecimals: 5,
  });

const dependencies = (
  overrides: Partial<PerpsProOpenOrderDependencies> = {},
): PerpsProOpenOrderDependencies => ({
  conditionalLimit: jest.fn(async () => ({
    status: 'ok',
    response: { data: { statuses: [{ resting: { oid: 1 } }] } },
  })),
  conditionalMarket: jest.fn(async () => ({
    status: 'ok',
    response: { data: { statuses: [{ resting: { oid: 1 } }] } },
  })),
  getCurrentAccount: () => account,
  getCurrentDex: () => '',
  hasPermission: () => true,
  limitOrder: jest.fn(async () => ({
    status: 'ok',
    response: { data: { statuses: [{ resting: { oid: 1 } }] } },
  })),
  marketOrder: jest.fn(async () => ({
    status: 'ok',
    response: { data: { statuses: [{ filled: { oid: 1 } }] } },
  })),
  refreshClearinghouse: jest.fn(),
  refreshOpenOrders: jest.fn(),
  ...overrides,
});

describe('Perps Pro open order action', () => {
  it('builds a protocol base-size market command', () => {
    expect(build()).toMatchObject({
      baseSize: '0.001',
      execution: {
        kind: 'market',
        slippageReferenceMidPrice: '63000',
      },
      orderType: 'market',
      quoteAmount: '63',
    });
  });

  it('keeps Market amount conversion separate from the SDK Mid anchor', () => {
    const command = buildPerpsProOpenOrderCommand({
      account,
      amountReferencePrice: '509.31304347826086956522',
      bboPrice: null,
      coin: 'xyz:MSFT',
      dexId: 'xyz',
      form: {
        ...createPerpsProTradeFormState(),
        amount: '12',
      },
      marketKey: 'xyz::xyz:MSFT',
      marketPrice: '509.21',
      side: 'buy',
      szDecimals: 3,
    });

    expect(command).toMatchObject({
      baseSize: '0.023',
      execution: {
        kind: 'market',
        slippageReferenceMidPrice: '509.21',
      },
    });
    expect(Number(command.quoteAmount)).toBeCloseTo(11.7142, 8);
  });

  it('reports the effective SP500 minimum after base-size quantization', () => {
    expect(() =>
      buildPerpsProOpenOrderCommand({
        account,
        amountReferencePrice: '7673',
        bboPrice: null,
        coin: 'xyz:SP500',
        dexId: 'xyz',
        form: {
          ...createPerpsProTradeFormState(),
          amount: '10',
        },
        marketKey: 'xyz::xyz:SP500',
        marketPrice: '7673',
        side: 'buy',
        szDecimals: 3,
      }),
    ).toThrow('Minimum amount is 15.35');
  });

  it('keeps the 10 USDC minimum message when precision does not raise it', () => {
    expect(() => build({ amount: '9' })).toThrow('Minimum amount is 10');
  });

  it('maps conditional limit without a TIF field', () => {
    expect(
      build({
        conditionalExecution: 'limit',
        conditionalLimitPrice: '65100',
        orderType: 'conditional',
        triggerPrice: '65000',
      }).execution,
    ).toEqual({
      kind: 'conditionalLimit',
      limitPrice: '65100',
      referencePrice: '63000',
      tpsl: 'sl',
      triggerPrice: '65000',
    });
  });

  it('uses the selected TIF only for a manual Limit order', () => {
    expect(
      build({ limitPrice: '62000', orderType: 'limit', tif: 'Ioc' }).execution,
    ).toEqual({ kind: 'limit', limitPrice: '62000', tif: 'Ioc' });
  });

  it('freezes a BBO strategy without freezing its numeric price', () => {
    const command = buildPerpsProOpenOrderCommand({
      account,
      bboPrice: '63010',
      bboSessionKey: 'BTC:1',
      coin: 'BTC',
      dexId: '',
      form: {
        ...createPerpsProTradeFormState(),
        amount: '63.01',
        bboEnabled: true,
        limitPrice: '1',
        orderType: 'limit',
        tif: 'Gtc',
      },
      marketKey: 'hyperliquid::BTC',
      marketPrice: '63000',
      side: 'buy',
      szDecimals: 5,
    });
    expect(command.execution).toEqual({
      kind: 'bboLimit',
      strategy: 'cp1',
    });
    expect(finalizePerpsProBboOpenOrderCommand(command, '63020')).toMatchObject(
      {
        execution: { kind: 'limit', limitPrice: '63020', tif: 'Gtc' },
        quoteAmount: '63.02',
      },
    );
  });

  it('hard-gates attached TP/SL at the parent command builder', () => {
    const base = createPerpsProTradeFormState();
    expect(() =>
      build({
        attachedTpSl: {
          ...base.attachedTpSl,
          enabled: true,
          tp: { mode: 'price', rawMagnitude: '64000' },
        },
      }),
    ).toThrow('Attached TP/SL must use its dedicated executor');
  });

  it('executes Conditional Market through trigger params without a TIF', async () => {
    const deps = dependencies();
    await executePerpsProOpenOrder(
      build({
        orderType: 'conditional',
        triggerPrice: '64000',
      }),
      deps,
    );

    expect(deps.conditionalMarket).toHaveBeenCalledWith({
      builder: expect.any(Object),
      coin: 'BTC',
      isBuy: true,
      reduceOnly: false,
      size: '0.001',
      tpsl: 'sl',
      triggerPx: '64000',
    });
    expect(deps.limitOrder).not.toHaveBeenCalled();
  });

  it('executes Conditional Limit with fixed limit and trigger prices', async () => {
    const deps = dependencies();
    await executePerpsProOpenOrder(
      build({
        conditionalExecution: 'limit',
        conditionalLimitPrice: '64100',
        orderType: 'conditional',
        triggerPrice: '64000',
      }),
      deps,
    );

    expect(deps.conditionalLimit).toHaveBeenCalledWith({
      builder: expect.any(Object),
      coin: 'BTC',
      isBuy: true,
      limitPx: '64100',
      reduceOnly: false,
      size: '0.00098',
      tpsl: 'sl',
      triggerPx: '64000',
    });
  });

  it('sends an ALO order to Hyperliquid instead of replacing its rejection', async () => {
    const serverError =
      'Post only order would have immediately matched, bbo was 63000.';
    const deps = dependencies({
      limitOrder: jest.fn(async () => ({
        status: 'ok',
        response: { data: { statuses: [{ error: serverError }] } },
      })),
    });
    const command = build({
      limitPrice: '63000',
      orderType: 'limit',
      tif: 'Alo',
    });

    await expect(executePerpsProOpenOrder(command, deps)).resolves.toEqual({
      error: serverError,
      failureReason: 'requestFailed',
      kind: 'failed',
    });
    expect(deps.limitOrder).toHaveBeenCalledWith(
      expect.objectContaining({ limitPx: '63000', tif: 'Alo' }),
    );
  });

  it('hard-gates legacy attached fields at the executor without SDK calls', async () => {
    const deps = dependencies();
    const command = {
      ...build(),
      tpTriggerPrice: '64000',
    };
    await expect(executePerpsProOpenOrder(command, deps)).resolves.toEqual({
      error: 'Attached TP/SL real execution is not enabled',
      failureReason: 'requestFailed',
      kind: 'failed',
    });
    expect(deps.marketOrder).not.toHaveBeenCalled();
    expect(deps.refreshClearinghouse).not.toHaveBeenCalled();
    expect(deps.refreshOpenOrders).not.toHaveBeenCalled();
  });

  it('hard-gates an attached command if it reaches the legacy executor', async () => {
    const deps = dependencies();
    await expect(
      executePerpsProOpenOrder(
        {
          attached: {},
          parent: build(),
          type: 'openOrderWithAttachedTpSl',
        } as unknown as PerpsProOpenOrderCommand,
        deps,
      ),
    ).resolves.toEqual({
      error: 'Attached TP/SL real execution is not enabled',
      failureReason: 'requestFailed',
      kind: 'failed',
    });
    expect(deps.marketOrder).not.toHaveBeenCalled();
    expect(deps.refreshClearinghouse).not.toHaveBeenCalled();
    expect(deps.refreshOpenOrders).not.toHaveBeenCalled();
  });

  it('executes market and refreshes clearinghouse after a fill', async () => {
    const deps = dependencies();
    await expect(
      executePerpsProOpenOrder(build(), deps),
    ).resolves.toMatchObject({
      kind: 'filled',
      oid: 1,
    });
    expect(deps.marketOrder).toHaveBeenCalledWith(
      expect.objectContaining({ midPx: '63000', size: '0.001' }),
    );
    expect(deps.refreshClearinghouse).toHaveBeenCalledWith('');
  });

  it('blocks a stale account before the SDK call', async () => {
    const deps = dependencies({ getCurrentAccount: () => null });
    await expect(executePerpsProOpenOrder(build(), deps)).resolves.toEqual({
      kind: 'staleContext',
    });
    expect(deps.marketOrder).not.toHaveBeenCalled();
  });

  it('blocks a region-restricted Trade Form before the SDK call', async () => {
    const deps = dependencies({ hasPermission: () => false });

    await expect(executePerpsProOpenOrder(build(), deps)).resolves.toEqual({
      failureReason: 'regionRestricted',
      kind: 'failed',
    });
    expect(deps.marketOrder).not.toHaveBeenCalled();
    expect(deps.refreshClearinghouse).not.toHaveBeenCalled();
  });

  it('rejects an unresolved BBO command before the SDK call', async () => {
    const deps = dependencies();
    const command = buildPerpsProOpenOrderCommand({
      account,
      bboPrice: '63010',
      bboSessionKey: 'BTC:1',
      coin: 'BTC',
      dexId: '',
      form: {
        ...createPerpsProTradeFormState({ orderType: 'limit' }),
        amount: '63.01',
        bboEnabled: true,
      },
      marketKey: 'hyperliquid::BTC',
      marketPrice: '63000',
      side: 'buy',
      szDecimals: 5,
    });

    await expect(executePerpsProOpenOrder(command, deps)).resolves.toEqual({
      error: 'BBO price must be finalized immediately before submission',
      failureReason: 'requestFailed',
      kind: 'failed',
    });
    expect(deps.limitOrder).not.toHaveBeenCalled();
  });

  it('marks a timeout as unknown outcome instead of retryable failure', async () => {
    const deps = dependencies({
      marketOrder: jest.fn(async () => {
        throw new Error('Request timeout');
      }),
    });
    await expect(executePerpsProOpenOrder(build(), deps)).resolves.toEqual({
      error: 'Request timeout',
      kind: 'unknownOutcome',
      refreshError: undefined,
    });
    expect(deps.refreshClearinghouse).toHaveBeenCalledWith('');
    expect(deps.refreshOpenOrders).toHaveBeenCalledWith('');
  });
});
