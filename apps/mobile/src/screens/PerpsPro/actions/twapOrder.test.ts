import { createPerpsProTradeFormState } from '../model/trade';
import {
  buildPerpsProTwapOrderCommand,
  executePerpsProTwapOrder,
  validatePerpsProTwapCapacity,
  type PerpsProTwapContext,
} from './twapOrder';
import type { TwapSubmissionOutcome } from '@rabby-wallet/hyperliquid-sdk';
const context: PerpsProTwapContext = {
  active: true,
  hasPermission: true,
  marketKey: 'xyz::TEST',
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
    midPrice: '1100',
    maxTradeSize: '10',
    positionSize: '0',
  },
};
const command = () => {
  return buildPerpsProTwapOrderCommand({
    coin: 'xyz:TEST',
    dexId: 'xyz',
    accountRuntime: context.accountRuntime,
    runtime: context.runtime,
    marketKey: context.marketKey!,
    capacity: context.capacity!,
    form: {
      ...createPerpsProTradeFormState({ orderType: 'twap' }),
      amountUnit: 'base',
      amount: '1',
      twapDuration: '1439',
      twapRandomize: true,
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
};

test('freezes base size, randomization and duration; does not retry an ambiguous dispatch', async () => {
  const prepared = command();
  const submit = jest.fn(
    async (): Promise<TwapSubmissionOutcome> => ({
      kind: 'unknownOutcome',
      evidence: { nonce: 1, transportPhase: 'dispatched' },
    }),
  );
  const deps = { submit, getContext: () => context };
  expect((await executePerpsProTwapOrder(prepared, deps)).kind).toBe(
    'unknownOutcome',
  );
  expect(submit.mock.calls[0][0]).toEqual({
    coin: 'xyz:TEST',
    isBuy: false,
    sz: '1',
    durationMins: 1439,
    randomize: true,
    reduceOnly: false,
  });
  expect((await executePerpsProTwapOrder(prepared, deps)).kind).toBe(
    'contextChanged',
  );
  expect(submit).toHaveBeenCalledTimes(1);
});

test('blocks stale generations and a price drop below minimum without resizing the order', async () => {
  const prepared = command();
  const submit = jest.fn();
  await executePerpsProTwapOrder(prepared, {
    submit,
    getContext: () => ({
      ...context,
      accountRuntime: { ...context.accountRuntime, generation: 2 },
    }),
  });
  expect(submit).not.toHaveBeenCalled();
  expect(() =>
    validatePerpsProTwapCapacity(prepared, {
      ...context.capacity!,
      midPrice: '99',
    }),
  ).toThrow('amountTooSmall');
  expect(prepared.baseSize).toBe('1');
});
