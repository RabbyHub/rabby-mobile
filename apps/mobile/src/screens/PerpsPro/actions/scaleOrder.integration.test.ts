import {
  ExchangeClient,
  type MultiOrderOutcome,
} from '@rabby-wallet/hyperliquid-sdk';
import { createPerpsProTradeFormState } from '../model/trade';
import {
  buildPerpsProScaleOrderCommand,
  executePerpsProScaleOrder,
  type PerpsProScaleContext,
} from './scaleOrder';

// JS integration: real calculator, immutable command, SDK signing payload and
// response parser. Only metadata/HTTP and the external signer are simulated.
it('preserves the sell preview in one HIP-3 request and consumes a partially accepted batch', async () => {
  const originalFetch = global.fetch;
  const requests: {
    action: {
      grouping: string;
      orders: { a: number; p: string; s: string; c: string }[];
    };
  }[] = [];
  const sign = jest.fn(async () => `0x${'0'.repeat(128)}1b`);
  global.fetch = jest.fn(async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    if (body.action) requests.push(body);
    const response = body.action
      ? {
          status: 'ok',
          response: {
            type: 'order',
            data: {
              statuses: [
                { resting: { oid: 1 } },
                { error: 'Post only would match' },
                { filled: { oid: 3, totalSz: '0.1', avgPx: '1000' } },
              ],
            },
          },
        }
      : [{ universe: [] }, { universe: [{ name: 'xyz:TEST', szDecimals: 2 }] }];
    return { ok: true, status: 200, json: async () => response } as Response;
  });
  try {
    const context: PerpsProScaleContext = {
      active: true,
      hasPermission: true,
      marketKey: 'xyz::TEST',
      coin: 'xyz:TEST',
      dexId: 'xyz',
      formRevision: 1,
      accountRuntime: {
        account: {
          address: '0xabc',
          type: 'PrivateKey',
          brandName: 'PrivateKey',
        },
        generation: 1,
        isInitialized: true,
      },
      runtime: {
        identity: '0xabc::PrivateKey',
        generation: 2,
        status: 'ready',
        phase: null,
        branch: 'selfSign',
        origin: 'runtime',
        error: null,
      },
      capacity: {
        availableQuote: '1000',
        leverage: 10,
        markPrice: '1100',
        maxTradeSize: '10',
        positionSize: '0',
      },
    };
    const command = buildPerpsProScaleOrderCommand({
      ...context,
      marketKey: context.marketKey!,
      capacity: context.capacity!,
      side: 'sell',
      form: {
        ...createPerpsProTradeFormState({ orderType: 'scale' }),
        amount: '1',
        scaleCount: '3',
        scaleDistribution: 'ascending',
        scaleLowerPrice: '1000',
        scaleUpperPrice: '1400',
      },
      reviewFacts: {
        amountUnit: 'base',
        displayBase: 'TEST',
        displayPair: 'TEST/USDC',
        formRevision: 1,
        generatedAt: 1,
        leverage: 10,
        marginMode: 'cross',
        markPrice: '1100',
        marketFillRiskEntryPrice: null,
        maxLeverage: 20,
        midPrice: '1100',
        pxDecimals: 2,
        quoteAsset: 'USDC',
        sourceTag: 'xyz',
        szDecimals: 2,
      },
    });
    const sdk = new ExchangeClient({
      masterAddress: '0xabc',
      externalSign: sign,
    });
    const dependencies = {
      getContext: () => context,
      submit: (
        params: Parameters<ExchangeClient['multiOrderWithOutcome']>[0],
        options?: Parameters<ExchangeClient['multiOrderWithOutcome']>[1],
      ): Promise<MultiOrderOutcome> =>
        sdk.multiOrderWithOutcome(params, options),
    };
    const result = await executePerpsProScaleOrder(command, dependencies);
    expect(result.kind).toBe('partialAccepted');
    expect(requests).toHaveLength(1);
    expect(sign).toHaveBeenCalledTimes(1);
    expect(requests[0].action.grouping).toBe('na');
    expect(
      requests[0].action.orders.map(order => [
        order.a,
        order.p,
        order.s,
        order.c,
      ]),
    ).toEqual(
      command.plan.orders.map((leg, index) => [
        110000,
        leg.price,
        leg.size,
        command.cloids[index],
      ]),
    );
    if ('legs' in result)
      expect(result.legs.map(leg => leg.kind)).toEqual([
        'accepted',
        'rejected',
        'accepted',
      ]);
    await executePerpsProScaleOrder(command, dependencies);
    expect(requests).toHaveLength(1);
  } finally {
    global.fetch = originalFetch;
  }
});
