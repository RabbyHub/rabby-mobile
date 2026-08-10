import type {
  L2Book,
  NormalTpslBatchResult,
} from '@rabby-wallet/hyperliquid-sdk';

jest.mock('@/core/apis/perps', () => ({
  apisPerps: { getPerpsSDK: jest.fn() },
}));

import type { PerpsAttachedTpSlJournalEntry } from '@/core/services/perpsService';

import type { PerpsProAttachedTpSlEvaluation } from '../model/tpsl';
import type { PerpsProOpenOrderCommand } from './openOrder';
import {
  buildPerpsProAttachedTpSlCommand,
  executePerpsProAttachedTpSl,
  getPerpsProAttachedTpSlPositionIdentity,
  validatePerpsProAttachedTpSlCommand,
  type PerpsProAttachedTpSlGuardContext,
} from './openOrderWithAttachedTpSl';

const parent = (
  execution: PerpsProOpenOrderCommand['execution'] = {
    kind: 'market',
    midPrice: '101',
  },
): PerpsProOpenOrderCommand =>
  Object.freeze({
    account: Object.freeze({ address: '0xabc', type: 'PrivateKey' }),
    baseSize: '2',
    coin: 'BTC',
    dexId: '',
    execution: Object.freeze(execution),
    marketKey: 'BTC:USDC',
    orderType: execution.kind === 'limit' ? 'limit' : 'market',
    quoteAmount: '202',
    reduceOnly: false,
    side: 'buy',
    type: 'openOrder',
  });

const attached = (
  overrides: Partial<PerpsProAttachedTpSlEvaluation> = {},
): PerpsProAttachedTpSlEvaluation => ({
  errors: [],
  expectedEntryPrice: '101',
  liquidationPrice: '50',
  normalizedBaseSize: '2',
  side: 'buy',
  sl: {
    estimatedPnl: '-22',
    estimatedRoi: '-108.91',
    kind: 'sl',
    mode: 'price',
    rawMagnitude: '90',
    triggerPrice: '90',
  },
  tp: {
    estimatedPnl: '18',
    estimatedRoi: '89.1',
    kind: 'tp',
    mode: 'price',
    rawMagnitude: '110',
    triggerPrice: '110',
  },
  ...overrides,
});

const book = (ask = '101'): L2Book => ({
  coin: 'BTC',
  levels: [[{ n: 1, px: '100', sz: '10' }], [{ n: 1, px: ask, sz: '10' }]],
  time: 10,
});

const accountRuntime = {
  account: {
    address: '0xabc',
    brandName: 'PrivateKey',
    type: 'PrivateKey',
  },
  generation: 3,
  isInitialized: true,
};
const runtime = {
  branch: 'selfSign' as const,
  error: null,
  generation: 4,
  identity: '0xabc::PrivateKey',
  origin: 'runtime' as const,
  phase: null,
  status: 'ready' as const,
};

const uuids = [
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  'command-id',
];

const build = (
  overrides: Partial<
    Parameters<typeof buildPerpsProAttachedTpSlCommand>[0]
  > = {},
) => {
  const values = [...uuids];
  return buildPerpsProAttachedTpSlCommand({
    accountRuntime,
    amountUnit: 'quote',
    attached: attached(),
    displayBase: 'BTC',
    displayPair: 'BTC/USDC',
    leverage: 10,
    liquidationGap: -0.5,
    marginMode: 'cross',
    markPrice: '100',
    maxLeverage: 50,
    marketSnapshot: {
      bookTime: 10,
      expectedEntryPrice: '101',
      normalizedBaseSize: '2',
      sessionKey: 'BTC:1',
    },
    parent: parent(),
    position: null,
    pxDecimals: 2,
    quoteAsset: 'USDC',
    runtime,
    szDecimals: 2,
    uuid: () => values.shift()!,
    ...overrides,
  });
};

const guardContext = (
  overrides: Partial<PerpsProAttachedTpSlGuardContext> = {},
): PerpsProAttachedTpSlGuardContext => ({
  accountRuntime,
  active: true,
  book: book(),
  bookSessionKey: 'BTC:1',
  bookStatus: 'ready',
  coin: 'BTC',
  dexId: '',
  liquidationPrice: '50',
  marketKey: 'BTC:USDC',
  maxBaseSize: '10',
  positionIdentity: getPerpsProAttachedTpSlPositionIdentity(null),
  runtime,
  ...overrides,
});

const evidence = {
  nonce: 1,
  rawStatuses: [],
  requestLegs: [],
  transportPhase: 'response' as const,
};

const fullAccepted = (command = build()): NormalTpslBatchResult => ({
  evidence,
  kind: 'fullAccepted',
  legs: [
    {
      acceptance: 'filled',
      cloid: command.cloids.parent,
      kind: 'accepted',
      oid: 1,
      rawStatus: {},
      role: 'parent',
    },
    ...(command.cloids.takeProfit
      ? [
          {
            acceptance: 'resting' as const,
            cloid: command.cloids.takeProfit,
            kind: 'accepted' as const,
            oid: 2,
            rawStatus: {},
            role: 'takeProfit' as const,
          },
        ]
      : []),
    ...(command.cloids.stopLoss
      ? [
          {
            acceptance: 'resting' as const,
            cloid: command.cloids.stopLoss,
            kind: 'accepted' as const,
            oid: 3,
            rawStatus: {},
            role: 'stopLoss' as const,
          },
        ]
      : []),
  ],
});

const createDependencies = (
  command: ReturnType<typeof build>,
  result: NormalTpslBatchResult = fullAccepted(command),
) => {
  let entries: PerpsAttachedTpSlJournalEntry[] = [];
  const limitOrder = jest.fn(async () => result);
  const marketOrder = jest.fn(async () => result);
  return {
    dependencies: {
      getGuardContext: () => guardContext(),
      journal: {
        getEntries: () => entries,
        remove: (commandId: string) => {
          entries = entries.filter(entry => entry.commandId !== commandId);
        },
        upsert: (entry: PerpsAttachedTpSlJournalEntry) => {
          entries = [
            ...entries.filter(item => item.commandId !== entry.commandId),
            entry,
          ];
        },
      },
      limitOrder,
      marketOrder,
      now: jest.fn().mockReturnValueOnce(1).mockReturnValue(2),
    },
    getEntries: () => entries,
    limitOrder,
    marketOrder,
  };
};

describe('Perps Pro attached TP/SL command and executor', () => {
  it('freezes command facts and creates stable distinct cloids', () => {
    const command = build();

    expect(Object.isFrozen(command)).toBe(true);
    expect(command.cloids).toEqual({
      parent: '0x11111111111111111111111111111111',
      stopLoss: '0x33333333333333333333333333333333',
      takeProfit: '0x22222222222222222222222222222222',
    });
    expect(command.commandId).toBe('command-id');
    expect(command.reviewFacts).toMatchObject({
      expectedEntryPrice: '101',
      liquidationPrice: '50',
      markPrice: '100',
    });
  });

  it('fails closed for changed runtime, L2 session, depth or VWAP', () => {
    const command = build();
    expect(
      validatePerpsProAttachedTpSlCommand(command, guardContext()),
    ).toEqual({ ok: true });
    expect(
      validatePerpsProAttachedTpSlCommand(
        command,
        guardContext({ runtime: { ...runtime, generation: 5 } }),
      ),
    ).toMatchObject({ ok: false, reason: 'accountOrRuntime' });
    expect(
      validatePerpsProAttachedTpSlCommand(
        command,
        guardContext({ bookSessionKey: 'BTC:2' }),
      ),
    ).toMatchObject({ ok: false, reason: 'bookIdentity' });
    expect(
      validatePerpsProAttachedTpSlCommand(
        command,
        guardContext({ book: book('102') }),
      ),
    ).toMatchObject({ ok: false, reason: 'expectedEntryPrice' });
    expect(
      validatePerpsProAttachedTpSlCommand(
        command,
        guardContext({ book: { ...book(), levels: [[], []] } }),
      ),
    ).toMatchObject({ ok: false, reason: 'bookUnavailable' });
    expect(
      validatePerpsProAttachedTpSlCommand(
        command,
        guardContext({ maxBaseSize: '1.99' }),
      ),
    ).toMatchObject({ ok: false, reason: 'availableToTrade' });
  });

  it('submits one Market normalTpsl batch and persists accepted leg evidence', async () => {
    const command = build();
    const setup = createDependencies(command);

    await expect(
      executePerpsProAttachedTpSl(
        command,
        setup.dependencies.getGuardContext,
        setup.dependencies,
      ),
    ).resolves.toMatchObject({ kind: 'fullAccepted' });
    expect(setup.marketOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        cloids: command.cloids,
        midPx: '101',
        size: '2',
        slTriggerPx: '90',
        tpTriggerPx: '110',
      }),
    );
    expect(setup.limitOrder).not.toHaveBeenCalled();
    expect(setup.getEntries()[0]).toMatchObject({
      outcome: 'fullAccepted',
    });
  });

  it('maps a GTC Limit parent without using the legacy API', async () => {
    const command = build({
      marketSnapshot: {
        bookTime: 10,
        expectedEntryPrice: '99',
        normalizedBaseSize: '2',
        sessionKey: 'BTC:1',
      },
      parent: parent({ kind: 'limit', limitPrice: '99', tif: 'Gtc' }),
      attached: attached({ expectedEntryPrice: '99' }),
    });
    const setup = createDependencies(command);

    await executePerpsProAttachedTpSl(
      command,
      setup.dependencies.getGuardContext,
      setup.dependencies,
    );
    expect(setup.limitOrder).toHaveBeenCalledWith(
      expect.objectContaining({ limitPx: '99', tif: 'Gtc' }),
    );
    expect(setup.marketOrder).not.toHaveBeenCalled();
    expect(
      validatePerpsProAttachedTpSlCommand(
        command,
        guardContext({
          book: {
            ...book(),
            levels: [
              [{ n: 1, px: '98', sz: '0.01' }],
              [{ n: 1, px: '100', sz: '0.01' }],
            ],
          },
        }),
      ),
    ).toEqual({ ok: true });
  });

  it('removes prepared state for user cancellation but keeps unknown transport state', async () => {
    const command = build();
    const cancelled = createDependencies(command, {
      kind: 'userCancelled',
      phase: 'signing',
    });
    await expect(
      executePerpsProAttachedTpSl(
        command,
        cancelled.dependencies.getGuardContext,
        cancelled.dependencies,
      ),
    ).resolves.toEqual({ kind: 'userCancelled' });
    expect(cancelled.getEntries()).toEqual([]);

    const unknown = createDependencies(command, {
      evidence: { ...evidence, transportPhase: 'dispatched' },
      kind: 'unknownOutcome',
      legs: [],
      phase: 'dispatched',
    });
    await expect(
      executePerpsProAttachedTpSl(
        command,
        unknown.dependencies.getGuardContext,
        unknown.dependencies,
      ),
    ).resolves.toMatchObject({ kind: 'unknownOutcome' });
    expect(unknown.getEntries()[0]?.outcome).toBe('unknown');
  });

  it('blocks a duplicate unresolved submission before calling the SDK', async () => {
    const command = build();
    const setup = createDependencies(command);
    setup.dependencies.journal.getEntries = () => [
      {
        accountAddress: command.parent.account.address,
        accountType: command.parent.account.type,
        cloids: command.cloids,
        coin: command.parent.coin,
        commandId: 'old-command',
        createdAt: 0,
        dexId: command.parent.dexId,
        legs: [],
        marketKey: command.parent.marketKey,
        outcome: 'unknown',
        parentFingerprint: command.parentFingerprint,
        parentSide: command.parent.side,
        updatedAt: 0,
        version: 1,
      },
    ];

    await expect(
      executePerpsProAttachedTpSl(
        command,
        setup.dependencies.getGuardContext,
        setup.dependencies,
      ),
    ).resolves.toMatchObject({
      kind: 'requestFailed',
      reason: 'unresolvedSubmission',
    });
    expect(setup.marketOrder).not.toHaveBeenCalled();
  });
});
