import type {
  MultiOrderOutcome,
  ExchangeClient,
} from '@rabby-wallet/hyperliquid-sdk';
import { createPerpsProTradeFormState } from '../model/trade';
import {
  buildPerpsProScaleOrderCommand,
  buildPerpsProScaleOrderPreview,
  executePerpsProScaleOrder,
  reconcilePerpsProScaleOrders,
  type PerpsProScaleContext,
} from './scaleOrder';

const context: PerpsProScaleContext = {
  active: true,
  hasPermission: true,
  marketKey: 'xyz::TEST',
  coin: 'xyz:TEST',
  dexId: 'xyz',
  formRevision: 3,
  accountRuntime: {
    account: { address: '0xabc', type: 'PrivateKey', brandName: 'PrivateKey' },
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
const command = () => {
  let id = 0;
  const preview = buildPerpsProScaleOrderPreview({
    ...context,
    accountRuntime: context.accountRuntime,
    runtime: context.runtime,
    marketKey: context.marketKey!,
    positionSize: context.capacity!.positionSize,
    form: {
      ...createPerpsProTradeFormState({ orderType: 'scale' }),
      amount: '1',
      scaleCount: '5',
      scaleLowerPrice: '1000',
      scaleUpperPrice: '1400',
    },
    side: 'sell',
    reviewFacts: {
      amountUnit: 'base',
      displayBase: 'TEST',
      displayPair: 'TEST/USDC',
      formRevision: 3,
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
  return buildPerpsProScaleOrderCommand(
    preview,
    context.accountRuntime,
    context.runtime,
    () => (++id).toString(16).padStart(32, '0'),
  )!;
};
const unknown = (batch: ReturnType<typeof command>): MultiOrderOutcome => ({
  kind: 'unknownOutcome',
  evidence: {
    requestLegs: batch.cloids.map((cloid, index) => ({ cloid, index })),
    transportPhase: 'dispatched',
  },
  legs: batch.cloids.map((cloid, index) => ({
    cloid,
    index,
    kind: 'unresolved',
    reason: 'transportUnknown',
  })),
});

describe('Scale command submission', () => {
  it('submits the frozen preview once, retaining cloid order and builder, and blocks repeat confirmation', async () => {
    const batch = command();
    const submit = jest.fn<
      ReturnType<ExchangeClient['multiOrderWithOutcome']>,
      Parameters<ExchangeClient['multiOrderWithOutcome']>
    >(async () => unknown(batch));
    const dependencies = { getContext: () => context, submit };
    expect((await executePerpsProScaleOrder(batch, dependencies)).kind).toBe(
      'unknownOutcome',
    );
    expect(submit.mock.calls[0][0]).toMatchObject({
      grouping: 'na',
      builder: { fee: 40 },
    });
    expect(
      submit.mock.calls[0][0].orders.map(order => [
        order.limitPx,
        order.sz,
        order.cloid,
      ]),
    ).toEqual(
      batch.plan.orders.map((leg, index) => [
        leg.price,
        leg.size,
        batch.cloids[index],
      ]),
    );
    expect((await executePerpsProScaleOrder(batch, dependencies)).kind).toBe(
      'contextChanged',
    );
    expect(submit).toHaveBeenCalledTimes(1);
  });
  it('checks context and capacity again through the SDK guard, and allows an explicit cancelled preview to be confirmed again', async () => {
    const batch = command();
    let live = context;
    const submit = jest.fn(async (_params, options) => {
      live = {
        ...context,
        accountRuntime: { ...context.accountRuntime, generation: 9 },
      };
      expect(options.isContextCurrent()).toBe(false);
      return { kind: 'userCancelled', phase: 'signing' } as const;
    });
    expect(
      (
        await executePerpsProScaleOrder(batch, {
          getContext: () => live,
          submit,
        })
      ).kind,
    ).toBe('userCancelled');
    expect(
      (
        await executePerpsProScaleOrder(batch, {
          getContext: () => live,
          submit,
        })
      ).kind,
    ).toBe('contextChanged');
    live = {
      ...context,
      capacity: { ...context.capacity!, maxTradeSize: '0' },
    };
    await expect(
      executePerpsProScaleOrder(batch, {
        getContext: () => live,
        submit,
      }),
    ).rejects.toThrow('capacity');
    live = context;
    await executePerpsProScaleOrder(batch, { getContext: () => live, submit });
    expect(submit).toHaveBeenCalledTimes(2);
  });
  it('preserves the balance error when funds disappear between signing and dispatch', async () => {
    const batch = command();
    let live = context;
    await expect(
      executePerpsProScaleOrder(batch, {
        getContext: () => live,
        submit: async (_params, options) => {
          live = {
            ...context,
            capacity: { ...context.capacity!, availableQuote: '0' },
          };
          expect(await options!.isContextCurrent!()).toBe(false);
          return { kind: 'contextChanged', phase: 'beforeDispatch' };
        },
      }),
    ).rejects.toThrow('capacity');
  });
  it('bounds reconciliation to four requests using the original address and stops starting reads on scene loss', async () => {
    const batch = command();
    let active = true;
    const finish: (() => void)[] = [];
    const getOrderStatus = jest.fn(async (_cloid, address) => {
      expect(address).toBe('0xabc');
      await new Promise<void>(resolve => finish.push(resolve));
      return { status: 'unknownOid' } as const;
    });
    const pending = reconcilePerpsProScaleOrders(batch, unknown(batch), {
      isCurrent: () => active,
      getOrderStatus,
    });
    expect(getOrderStatus).toHaveBeenCalledTimes(4);
    active = false;
    finish.forEach(resolve => resolve());
    expect(await pending).toEqual([]);
    expect(getOrderStatus).toHaveBeenCalledTimes(4);
  });
});
