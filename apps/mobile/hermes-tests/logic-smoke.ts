import '@exodus/patch-broken-hermes-typed-arrays';

import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils/dist/types';
import BigNumber from 'bignumber.js';
import * as Yup from 'yup';
import {
  add0x,
  ellipsis,
  formatAddressToShow,
  isStrictHexString,
  shortEllipsisAddress,
} from '../src/utils/address';
import {
  EIP7702RevokeMiniGasLimit,
  getEIP7702MiniGasLimit,
  removeLeadingZeroes,
} from '../src/utils/7702';
import { getBrandColors } from '../src/utils/brand';
import { coerceNumber, coerceSecond } from '../src/utils/coerce';
import { patchCurveData } from '../src/utils/curve';
import {
  FormValuesOnSubmit,
  createAmountComparer,
  shouldIgnoreAmountChangeInMaxMode,
} from '../src/utils/form';
import {
  getFormikErrorsCount,
  getFormikTouchedCount,
  setFieldValueAndTouched,
  validateFormikSchema,
} from '../src/utils/patch';
import {
  defaultTokenFilter,
  includeLpTokensFilter,
  isLpToken,
  lpTokenFilter,
} from '../src/utils/lpToken';
import {
  calcPercent,
  formatAmount,
  formatNetworth,
  formatNum,
  formatPriceMainsite,
  numFormat,
  numberToWords,
  unreadCountFormat,
} from '../src/utils/math';
import {
  complexProtocol2ProtocolItem,
  portfolioToIProtocolPortfolio,
  protocolEntity2IProtocolItem,
} from '../src/utils/protocol';
import PromiseFlow from '../src/utils/promiseFlow';
import {
  getQuotePollingResumeDelay,
  hasQuotePollingPauseReason,
  shouldScheduleQuotePolling,
  updateQuotePollingPauseReason,
} from '../src/utils/quotePolling';
import { cached } from '../src/utils/cache';
import { ellipsisOverflowedText } from '../src/utils/text';
import { getTokenIcon, SYMBOL_MAP } from '../src/utils/tokenIcon';
import {
  formatDappOriginToShow,
  isPossibleDomain,
  withHttp,
} from '../src/utils/url';
import {
  addWhitelistRecord,
  mergeWhitelistAddresses,
  normalizeWhitelistAddresses,
  sortWhitelistRecords,
  sortWhitelistRecordsForSend,
} from '../src/utils/whitelist';

type TestFn = () => void | Promise<void>;

const tests: Array<{ name: string; run: TestFn }> = [];

function test(name: string, run: TestFn) {
  tests.push({ name, run });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function formatValue(value: unknown) {
  return JSON.stringify(value);
}

function assertEqual(actual: unknown, expected: unknown, message?: string) {
  if (actual !== expected) {
    throw new Error(
      message ||
        `expected ${formatValue(expected)}, received ${formatValue(actual)}`,
    );
  }
}

test('Hermes runtime is active', () => {
  assert(
    !!(globalThis as typeof globalThis & { HermesInternal?: unknown })
      .HermesInternal,
    'HermesInternal should be present when this suite runs',
  );
});

test('Hermes typed array patch preserves subclass results', () => {
  class TestArray extends Uint16Array {
    hello() {
      return 'hi there';
    }
  }

  const input = new TestArray([1, 2, 3]);
  const subarrayResult = input.subarray(1);
  const mapResult = input.map(value => value * 2);
  const filterResult = input.filter(value => value > 1);
  const sliceResult = input.slice(1);

  assert(subarrayResult instanceof TestArray, 'subarray should keep subclass');
  assert(mapResult instanceof TestArray, 'map should keep subclass');
  assert(filterResult instanceof TestArray, 'filter should keep subclass');
  assert(sliceResult instanceof TestArray, 'slice should keep subclass');
  assertEqual(subarrayResult.hello(), 'hi there');
  assertEqual(mapResult[2], 6);
  assertEqual(filterResult.length, 2);
  assertEqual(sliceResult[0], 2);
});

test('address helpers match the Node Jest baseline', () => {
  assertEqual(ellipsis('0x1234567890', 4), '0x1234...7890');
  assertEqual(shortEllipsisAddress('0x1234567890', 4), '0x12...7890');
  assertEqual(
    formatAddressToShow('0xABCDEF1234567890', { length: 4 }),
    '0xabcd...7890',
  );
  assertEqual(
    formatAddressToShow('0xABCDEF1234567890', { ellipsis: false }),
    '0xabcdef1234567890',
  );
  assertEqual(add0x('abc'), '0xabc');
  assertEqual(add0x('0Xabc'), '0xabc');
  assertEqual(isStrictHexString('0xabc123'), true);
  assertEqual(isStrictHexString('abc123'), false);
});

test('number coercion keeps falsy handling stable', () => {
  assertEqual(coerceNumber('12.34'), 12.34);
  assertEqual(coerceNumber('not-a-number', 7), 7);
  assertEqual(coerceNumber('', 7), 0);
  assertEqual(coerceSecond(undefined, 6000), 0);
  assertEqual(coerceSecond('4.5', 6000), 4.5);
});

test('EIP-7702 helpers keep hex normalization stable', () => {
  assertEqual(removeLeadingZeroes(undefined), undefined);
  assertEqual(removeLeadingZeroes('0x0'), '0x');
  assertEqual(removeLeadingZeroes('0x0000002a'), '0x2a');
  assertEqual(removeLeadingZeroes('0x2a'), '0x2a');
  assertEqual(
    getEIP7702MiniGasLimit(1),
    `0x${EIP7702RevokeMiniGasLimit.toString(16)}`,
  );
  assertEqual(getEIP7702MiniGasLimit(60001), '0xea61');
  assertEqual(
    getEIP7702MiniGasLimit(''),
    `0x${EIP7702RevokeMiniGasLimit.toString(16)}`,
  );
});

test('math display helpers match the Node Jest baseline', () => {
  assertEqual(numFormat(0, undefined, '$', true), '+$0');
  assertEqual(numFormat(-0.1234), '-0.1234');
  assertEqual(numFormat(1_234_000_000, undefined, '$'), '$1.2B');
  assertEqual(unreadCountFormat(-1), '');
  assertEqual(unreadCountFormat(100, 99), '99+');
  assertEqual(calcPercent(undefined, 5), '+100.00%');
  assertEqual(calcPercent(10, 5), '-50.00%');
  assertEqual(formatNum(undefined), '-');
  assertEqual(formatNum(0, 2, { keepPostiveSign: true }), '+0');
  assertEqual(formatNetworth(2_000_000_000), '$2.00B');
  assertEqual(formatPriceMainsite(0.1234), '$0.1234');
  assertEqual(formatAmount(15_000), '15,000.00');
  assertEqual(numberToWords(3421), 'three thousand four hundred twenty one');
});

test('text and URL helpers stay runtime-neutral', () => {
  assertEqual(ellipsisOverflowedText('abcdef', 3), 'abc...');
  assertEqual(ellipsisOverflowedText('abc', 3), 'abc');
  assertEqual(isPossibleDomain('rabby.io'), true);
  assertEqual(isPossibleDomain('localhost'), false);
  assertEqual(formatDappOriginToShow('https://rabby.io'), 'rabby.io');
  assertEqual(withHttp('rabby.io'), 'https://rabby.io');
});

test('brand and token icon lookup tables stay deterministic', () => {
  assertEqual(
    getBrandColors('binance', true).brandColor,
    'rgba(255, 170, 0, 1)',
  );
  assertEqual(
    getBrandColors(KEYRING_CLASS.HARDWARE.LEDGER, false).brandColor,
    'rgba(255, 255, 255, 1)',
  );
  assertEqual(getBrandColors('unknown', true).brandBg, 'rgba(0, 0, 0, 0.2)');

  assertEqual(SYMBOL_MAP['DAI.e'], 'DAI');
  assert(getTokenIcon('').includes('default.'), 'empty symbol uses default');
  assert(getTokenIcon('DAI.e').includes('/dai/'), 'symbol alias resolves icon');
  assert(
    getTokenIcon('NOT_A_REAL_TOKEN').includes('default.'),
    'unknown symbol uses default',
  );
});

test('form submit guards keep amount comparison stable', () => {
  const emptyForm = new FormValuesOnSubmit<{ amount: string }>();
  assertEqual(emptyForm.hasSnapshot(), false);
  assertEqual(emptyForm.compare({ amount: '1' }).isChanged, true);

  const form = new FormValuesOnSubmit<{
    amount: string;
    amountMode: 'exact' | 'max';
    bn: BigNumber;
    note: string;
  }>({
    comparers: {
      amount: createAmountComparer(),
      note: (oldValue, newValue) => oldValue.trim() !== newValue.trim(),
    },
  });

  form.save({
    amount: '1.000',
    amountMode: 'max',
    bn: new BigNumber('2'),
    note: 'hello',
  });

  const unchanged = form.compare({
    amount: '1',
    amountMode: 'max',
    bn: new BigNumber('2.0'),
    note: ' hello ',
  });
  assertEqual(unchanged.isChanged, false);

  const amountDrift = form.compare({
    amount: '0.999',
    amountMode: 'max',
    bn: new BigNumber('2.0'),
    note: ' hello ',
  });
  assertEqual(amountDrift.isChanged, true);
  assertEqual(
    shouldIgnoreAmountChangeInMaxMode(amountDrift, form.getSnapshot()!, {
      amount: '0.999',
      amountMode: 'max',
      bn: new BigNumber('2.0'),
      note: ' hello ',
    }),
    true,
  );
});

test('formik patch helpers keep validation semantics in Hermes', () => {
  assertEqual(
    getFormikErrorsCount({
      errors: {
        amount: 'required',
        note: '',
        to: 'invalid',
      },
    } as never),
    2,
  );
  assertEqual(
    getFormikTouchedCount({
      amount: true,
      note: false,
      to: true,
    } as never),
    2,
  );

  const calls: string[] = [];
  setFieldValueAndTouched(
    {
      setFieldTouched: (field: string, touched: boolean, shouldValidate) => {
        calls.push(`touched:${field}:${touched}:${shouldValidate}`);
      },
      setFieldValue: (field: string, value: unknown, shouldValidate) => {
        calls.push(`value:${field}:${value}:${shouldValidate}`);
      },
    } as never,
    ['name', 'Rabby', false],
    true,
  );
  assertEqual(
    calls.join('|'),
    'touched:name:true:false|value:name:Rabby:false',
  );

  const schema = Yup.object({
    name: Yup.string().required('name is required'),
    age: Yup.number().min(18, 'too young').required('age is required'),
  });
  assertEqual(
    JSON.stringify(validateFormikSchema({ name: 'Rabby', age: 17 }, schema)),
    JSON.stringify({ age: 'too young' }),
  );
  assertEqual(
    JSON.stringify(validateFormikSchema({ name: 'Rabby', age: 18 }, schema)),
    JSON.stringify({}),
  );
});

test('promise flow composes async middleware in Hermes', async () => {
  const flow = new PromiseFlow<{ steps: string[]; value: number }>();

  flow.use(async (ctx, next) => {
    ctx.steps.push('outer:start');
    await next();
    ctx.steps.push('outer:end');
  });

  flow.use(async (ctx, next) => {
    ctx.steps.push('inner:start');
    ctx.value += 1;
    await next();
    ctx.steps.push('inner:end');
  });

  const ctx = { steps: [] as string[], value: 0 };
  await flow.callback()(ctx, async () => {
    ctx.steps.push('tail');
  });

  assertEqual(
    ctx.steps.join('|'),
    'outer:start|inner:start|tail|inner:end|outer:end',
  );
  assertEqual(ctx.value, 1);
});

test('cached helper keeps ttl and force semantics in Hermes', async () => {
  let now = 1000;
  let calls = 0;
  const originalNow = Date.now;
  const wrapped = cached(async (value: string) => {
    calls += 1;
    return `${value}:${calls}`;
  }, 1000);

  Date.now = () => now;
  try {
    assertEqual(await wrapped(['first'], 'same-key', false), 'first:1');

    now = 1500;
    assertEqual(await wrapped(['ignored'], 'same-key', false), 'first:1');
    assertEqual(calls, 1);

    now = 1700;
    assertEqual(await wrapped(['forced'], 'same-key', true), 'forced:2');
    assertEqual(calls, 2);

    now = 2601;
    assertEqual(await wrapped(['still-cached'], 'same-key', false), 'forced:2');
    assertEqual(calls, 2);

    now = 2701;
    assertEqual(await wrapped(['expired'], 'same-key', false), 'expired:3');
    assertEqual(calls, 3);
  } finally {
    Date.now = originalNow;
  }
});

test('protocol portfolio conversion sorts and sums net worth', () => {
  const portfolio = portfolioToIProtocolPortfolio({
    pool: { id: 'pool-1' },
    position_index: '2',
    name: 'Pool position',
    asset_token_list: [
      { price: 2, amount: 3 },
      { price: 1, amount: -4 },
    ],
    stats: null,
  } as never);
  assertEqual(portfolio.id, 'pool-12');
  assertEqual(portfolio.netWorth, 10);
  assertEqual(portfolio._sumTokenRealUsdValue, 2);

  const entity = protocolEntity2IProtocolItem({
    id: 'protocol-1',
    name: 'Aave',
    logo_url: 'logo',
    chain: 'eth',
    site_url: 'site',
    owner_addr: '0xowner',
    portfolio_item_list: JSON.stringify([
      {
        pool: { id: 'small' },
        position_index: '',
        name: 'Small',
        asset_token_list: [{ price: 1, amount: 1 }],
      },
      {
        pool: { id: 'large' },
        position_index: '',
        name: 'Large',
        asset_token_list: [{ price: 5, amount: 2 }],
      },
    ]),
  });
  assertEqual(entity.netWorth, 11);
  assertEqual(entity._portfolios[0].id, 'large');
  assertEqual(entity._portfolios[1].id, 'small');

  const complex = complexProtocol2ProtocolItem(
    {
      id: 'protocol-2',
      name: 'Compound',
      logo_url: 'logo',
      chain: 'eth',
      site_url: 'site',
      portfolio_item_list: [
        {
          pool: { id: 'p1' },
          position_index: '',
          name: 'P1',
          asset_token_list: [{ price: 3, amount: 1 }],
        },
      ],
    } as never,
    '0xowner',
  );
  assertEqual(complex.owner_addr, '0xowner');
  assertEqual(complex.netWorth, 3);
});

test('curve and lp token filters stay deterministic', () => {
  const patched = patchCurveData(
    [
      { timestamp: 30, price: 3 },
      { timestamp: 40, price: 4 },
    ],
    10,
    10,
  );

  assertEqual(patched.length, 4);
  assertEqual(patched[0].timestamp, 10);
  assertEqual(patched[0].price, 0);

  assertEqual(defaultTokenFilter({ is_verified: false }), false);
  assertEqual(defaultTokenFilter({ is_core: null, protocol_id: 'uni' }), false);
  assertEqual(
    includeLpTokensFilter({ is_core: false, protocol_id: 'uni' }),
    true,
  );
  assertEqual(
    isLpToken({
      is_verified: true,
      is_core: false,
      protocol_id: 'uni',
    }),
    true,
  );
  assertEqual(
    lpTokenFilter(
      {
        is_verified: true,
        is_core: false,
        protocol_id: 'uni',
      },
      false,
    ),
    false,
  );
});

test('quote polling pause state is deterministic', () => {
  assertEqual(
    shouldScheduleQuotePolling({ enabled: true, paused: false }),
    true,
  );
  assertEqual(
    shouldScheduleQuotePolling({ enabled: true, paused: true }),
    false,
  );
  assertEqual(getQuotePollingResumeDelay({ deadline: 2000, now: 1250 }), 750);
  assertEqual(getQuotePollingResumeDelay({ deadline: 2000, now: 2500 }), 0);
  assertEqual(getQuotePollingResumeDelay({ deadline: null, now: 2500 }), null);

  let state = updateQuotePollingPauseReason({
    state: {},
    reason: 'slippage',
    paused: true,
  });
  state = updateQuotePollingPauseReason({
    state,
    reason: 'gas',
    paused: true,
  });
  assertEqual(hasQuotePollingPauseReason(state), true);

  state = updateQuotePollingPauseReason({
    state,
    reason: 'slippage',
    paused: false,
  });
  assertEqual(hasQuotePollingPauseReason(state), true);

  state = updateQuotePollingPauseReason({
    state,
    reason: 'gas',
    paused: false,
  });
  assertEqual(hasQuotePollingPauseReason(state), false);
});

test('whitelist normalization and sorting keep address rules stable', () => {
  assertEqual(
    normalizeWhitelistAddresses([
      '0x1111111111111111111111111111111111111111',
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222'.toUpperCase(),
    ]).join(','),
    [
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
    ].join(','),
  );

  assertEqual(
    mergeWhitelistAddresses(
      [
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
      ],
      [
        '0x2222222222222222222222222222222222222222'.toUpperCase(),
        '0x3333333333333333333333333333333333333333',
      ],
    ).join(','),
    [
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
      '0x3333333333333333333333333333333333333333',
    ].join(','),
  );

  assertEqual(
    addWhitelistRecord(
      [
        {
          address: '0x1111111111111111111111111111111111111111',
        },
      ],
      '0x2222222222222222222222222222222222222222',
      123,
    )[1].addedAt,
    123,
  );

  assertEqual(
    sortWhitelistRecords(
      [
        { address: '0xcccccccccccccccccccccccccccccccccccccccc' },
        { address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
        { address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
      ],
      {
        '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb': 200,
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa': 100,
      },
    )[0].address,
    '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  );

  assertEqual(
    sortWhitelistRecordsForSend(
      [
        {
          address: '0xcccccccccccccccccccccccccccccccccccccccc',
          addedAt: 300,
        },
        { address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      ],
      {},
    )[0].address,
    '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  );
});

async function runTests() {
  const failures: Array<{ name: string; message: string }> = [];

  for (const item of tests) {
    try {
      await item.run();
      console.log(`[hermes-logic] PASS ${item.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ name: item.name, message });
      console.error(`[hermes-logic] FAIL ${item.name}: ${message}`);
    }
  }

  const result = {
    engine: 'hermes',
    passed: tests.length - failures.length,
    failed: failures.length,
    failures,
  };

  console.log(`__RABBY_HERMES_LOGIC_TEST_RESULT__${JSON.stringify(result)}`);

  if (failures.length) {
    throw new Error(`${failures.length} Hermes logic test(s) failed`);
  }
}

runTests().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[hermes-logic] FATAL ${message}`);
  throw error;
});
