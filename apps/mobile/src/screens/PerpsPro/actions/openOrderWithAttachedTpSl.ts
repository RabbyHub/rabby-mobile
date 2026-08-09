import {
  ExchangeClient,
  InfoClient,
  type Cloid,
  type L2Book,
  type NormalTpslBatchResult,
  type NormalTpslCloids,
  type NormalTpslLimitOrderParams,
  type NormalTpslMarketOrderParams,
} from '@rabby-wallet/hyperliquid-sdk';
import BigNumber from 'bignumber.js';
import { v4 as uuidV4 } from 'uuid';

import { PERPS_BUILDER_INFO } from '@/constant/perps';
import { apisPerps } from '@/core/apis/perps';
import type { Account } from '@/core/startupServices/preference';
import { isSamePerpsActionAccount } from '@/hooks/perps/actions/accountGuard';
import type { PerpsAccountRuntimeContext } from '@/hooks/perps/usePerpsStore';
import {
  getPerpsRuntimeIdentity,
  type PerpsRuntimeSnapshot,
} from '@/hooks/perps/runtime/perpsRuntimeState';

import { estimatePerpsProMarketFill } from '../model/marketFillEstimate';
import type { PerpsProTradeAmountUnit } from '../model/trade';
import {
  validatePerpsProFrozenAttachedTpSl,
  type PerpsProAttachedTpSlEvaluation,
} from '../model/tpsl';
import type { PerpsProOpenOrderCommand } from './openOrder';
import {
  applyAttachedTpSlBatchToJournalEntry,
  createPreparedAttachedTpSlJournalEntry,
  defaultAttachedTpSlJournalDependencies,
  findAttachedTpSlSubmissionBlock,
  type AttachedTpSlJournalDependencies,
} from './attachedTpSlJournal';

export type PerpsProAttachedTpSlPositionIdentity = {
  entryPx: string;
  marginUsed: string;
  szi: string;
};

export type PerpsProAttachedTpSlMarketSnapshot = {
  bookTime: number;
  expectedEntryPrice: string;
  normalizedBaseSize: string;
  sessionKey: string;
};

export type PerpsProAttachedTpSlReviewFacts = {
  amountUnit: PerpsProTradeAmountUnit;
  displayBase: string;
  displayPair: string;
  expectedEntryPrice: string;
  leverage: number;
  liquidationGap: number | null;
  liquidationPrice: string | null;
  marginMode: 'cross' | 'isolated';
  markPrice: string;
  maxLeverage: number;
  pxDecimals: number;
  quoteAsset: string;
  szDecimals: number;
};

type PerpsProAttachedTpSlParentCommand = Omit<
  PerpsProOpenOrderCommand,
  'execution'
> & {
  execution: Extract<
    PerpsProOpenOrderCommand['execution'],
    { kind: 'limit' | 'market' }
  >;
};

export type PerpsProAttachedTpSlCommand = {
  accountRuntimeGeneration: number;
  attached: PerpsProAttachedTpSlEvaluation;
  cloids: NormalTpslCloids;
  commandId: string;
  marketSnapshot: PerpsProAttachedTpSlMarketSnapshot;
  parent: PerpsProAttachedTpSlParentCommand;
  parentFingerprint: string;
  positionIdentity: PerpsProAttachedTpSlPositionIdentity;
  reviewFacts: PerpsProAttachedTpSlReviewFacts;
  runtimeGeneration: number;
  runtimeIdentity: string;
  type: 'openOrderWithAttachedTpSl';
};

export type PerpsProAttachedTpSlGuardContext = {
  accountRuntime: PerpsAccountRuntimeContext;
  active: boolean;
  book: L2Book | null;
  bookSessionKey: string | null;
  bookStatus: 'error' | 'idle' | 'loading' | 'ready' | 'stale';
  coin: string;
  dexId: string;
  liquidationPrice: string | null;
  marketKey: string | null;
  maxBaseSize: string | null;
  positionIdentity: PerpsProAttachedTpSlPositionIdentity;
  runtime: PerpsRuntimeSnapshot;
};

export type PerpsProAttachedTpSlGuardResult =
  | { ok: true }
  | { ok: false; reason: string };

export type PerpsProAttachedTpSlResult =
  | { batch: NormalTpslBatchResult; kind: 'fullAccepted' }
  | { batch: NormalTpslBatchResult; kind: 'parentRejected' }
  | { batch: NormalTpslBatchResult; kind: 'childRejected' }
  | { batch: NormalTpslBatchResult; kind: 'partialOutcome' }
  | {
      batch?: NormalTpslBatchResult;
      error?: string;
      kind: 'unknownOutcome';
    }
  | { kind: 'staleContext'; reason?: string }
  | { kind: 'userCancelled' }
  | {
      batch?: NormalTpslBatchResult;
      error: string;
      kind: 'requestFailed';
      reason?: 'unresolvedSubmission';
    };

const positive = (value: unknown) => {
  const result = new BigNumber(
    (value as string | number | null | undefined) ?? Number.NaN,
  );
  return result.isFinite() && result.gt(0) ? result : null;
};

const freezeAttached = (
  attached: PerpsProAttachedTpSlEvaluation,
): PerpsProAttachedTpSlEvaluation =>
  Object.freeze({
    ...attached,
    errors: Object.freeze([
      ...attached.errors,
    ]) as unknown as typeof attached.errors,
    sl: attached.sl ? Object.freeze({ ...attached.sl }) : null,
    tp: attached.tp ? Object.freeze({ ...attached.tp }) : null,
  });

const createCloid = (uuid: () => string): Cloid => {
  const value = uuid().replace(/-/gu, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/u.test(value)) {
    throw new Error('Unable to generate a valid attached TP/SL cloid');
  }
  return `0x${value}`;
};

export const getPerpsProAttachedTpSlPositionIdentity = (
  position?: { entryPx?: string; marginUsed?: string; szi?: string } | null,
): PerpsProAttachedTpSlPositionIdentity => ({
  entryPx: position?.entryPx ?? '',
  marginUsed: position?.marginUsed ?? '',
  szi: position?.szi ?? '0',
});

const getParentFingerprint = (parent: PerpsProOpenOrderCommand) =>
  JSON.stringify([
    parent.account.address.toLowerCase(),
    parent.account.type,
    parent.dexId,
    parent.marketKey,
    parent.coin,
    parent.side,
    parent.baseSize,
    parent.execution,
  ]);

export const buildPerpsProAttachedTpSlCommand = ({
  accountRuntime,
  amountUnit,
  attached,
  displayBase,
  displayPair,
  leverage,
  liquidationGap,
  marginMode,
  markPrice,
  maxLeverage,
  marketSnapshot,
  parent,
  position,
  pxDecimals,
  quoteAsset,
  runtime,
  szDecimals,
  uuid = uuidV4,
}: {
  accountRuntime: PerpsAccountRuntimeContext;
  amountUnit: PerpsProTradeAmountUnit;
  attached: PerpsProAttachedTpSlEvaluation;
  displayBase: string;
  displayPair: string;
  leverage: number;
  liquidationGap: number | null;
  marginMode: 'cross' | 'isolated';
  markPrice: string;
  maxLeverage: number;
  marketSnapshot: PerpsProAttachedTpSlMarketSnapshot;
  parent: PerpsProOpenOrderCommand;
  position?: { entryPx?: string; marginUsed?: string; szi?: string } | null;
  pxDecimals: number;
  quoteAsset: string;
  runtime: PerpsRuntimeSnapshot;
  szDecimals: number;
  uuid?: () => string;
}): PerpsProAttachedTpSlCommand => {
  if (
    parent.type !== 'openOrder' ||
    parent.reduceOnly ||
    (parent.execution.kind !== 'market' && parent.execution.kind !== 'limit') ||
    (parent.execution.kind === 'limit' && parent.execution.tif === 'Ioc')
  ) {
    throw new Error('Unsupported attached TP/SL parent order');
  }
  const attachedParent = parent as PerpsProAttachedTpSlParentCommand;
  if (
    attached.errors.length > 0 ||
    (!attached.tp && !attached.sl) ||
    attached.side !== parent.side ||
    !new BigNumber(attached.normalizedBaseSize).eq(parent.baseSize) ||
    !new BigNumber(attached.expectedEntryPrice).eq(
      marketSnapshot.expectedEntryPrice,
    ) ||
    !new BigNumber(marketSnapshot.normalizedBaseSize).eq(parent.baseSize)
  ) {
    throw new Error('Attached TP/SL evaluation does not match the parent');
  }
  if (
    !isSamePerpsActionAccount(accountRuntime.account, parent.account) ||
    !accountRuntime.isInitialized ||
    runtime.status !== 'ready' ||
    runtime.identity !== getPerpsRuntimeIdentity(parent.account)
  ) {
    throw new Error('Perps account runtime is not ready');
  }
  const cloids: NormalTpslCloids = Object.freeze({
    parent: createCloid(uuid),
    takeProfit: attached.tp ? createCloid(uuid) : undefined,
    stopLoss: attached.sl ? createCloid(uuid) : undefined,
  });
  return Object.freeze({
    accountRuntimeGeneration: accountRuntime.generation,
    attached: freezeAttached(attached),
    cloids,
    commandId: uuid(),
    marketSnapshot: Object.freeze({ ...marketSnapshot }),
    parent: attachedParent,
    parentFingerprint: getParentFingerprint(attachedParent),
    positionIdentity: Object.freeze(
      getPerpsProAttachedTpSlPositionIdentity(position),
    ),
    reviewFacts: Object.freeze({
      amountUnit,
      displayBase,
      displayPair,
      expectedEntryPrice: attached.expectedEntryPrice,
      leverage,
      liquidationGap,
      liquidationPrice: attached.liquidationPrice,
      marginMode,
      markPrice,
      maxLeverage,
      pxDecimals,
      quoteAsset,
      szDecimals,
    }),
    runtimeGeneration: runtime.generation,
    runtimeIdentity: runtime.identity,
    type: 'openOrderWithAttachedTpSl' as const,
  });
};

const samePositionIdentity = (
  left: PerpsProAttachedTpSlPositionIdentity,
  right: PerpsProAttachedTpSlPositionIdentity,
) =>
  left.entryPx === right.entryPx &&
  left.marginUsed === right.marginUsed &&
  left.szi === right.szi;

export const validatePerpsProAttachedTpSlCommand = (
  command: PerpsProAttachedTpSlCommand,
  context: PerpsProAttachedTpSlGuardContext,
): PerpsProAttachedTpSlGuardResult => {
  if (
    !Object.isFrozen(command) ||
    !Object.isFrozen(command.attached) ||
    !Object.isFrozen(command.attached.errors) ||
    (command.attached.tp != null && !Object.isFrozen(command.attached.tp)) ||
    (command.attached.sl != null && !Object.isFrozen(command.attached.sl)) ||
    !Object.isFrozen(command.cloids) ||
    !Object.isFrozen(command.marketSnapshot) ||
    !Object.isFrozen(command.parent) ||
    !Object.isFrozen(command.parent.account) ||
    !Object.isFrozen(command.parent.execution) ||
    !Object.isFrozen(command.positionIdentity) ||
    !Object.isFrozen(command.reviewFacts)
  ) {
    return { ok: false, reason: 'commandIdentity' };
  }
  if (
    !context.active ||
    !context.accountRuntime.isInitialized ||
    context.accountRuntime.generation !== command.accountRuntimeGeneration ||
    !isSamePerpsActionAccount(
      context.accountRuntime.account,
      command.parent.account,
    ) ||
    context.runtime.status !== 'ready' ||
    context.runtime.identity !== command.runtimeIdentity ||
    context.runtime.generation !== command.runtimeGeneration
  ) {
    return { ok: false, reason: 'accountOrRuntime' };
  }
  if (
    context.marketKey !== command.parent.marketKey ||
    context.coin !== command.parent.coin ||
    context.dexId !== command.parent.dexId ||
    !samePositionIdentity(context.positionIdentity, command.positionIdentity)
  ) {
    return { ok: false, reason: 'marketOrPosition' };
  }
  const maxBaseSize = positive(context.maxBaseSize);
  if (!maxBaseSize || new BigNumber(command.parent.baseSize).gt(maxBaseSize)) {
    return { ok: false, reason: 'availableToTrade' };
  }
  if (
    context.bookStatus !== 'ready' ||
    !context.book ||
    context.bookSessionKey !== command.marketSnapshot.sessionKey ||
    context.book.coin !== command.parent.coin ||
    context.book.time < command.marketSnapshot.bookTime
  ) {
    return { ok: false, reason: 'bookIdentity' };
  }
  if (
    !new BigNumber(command.parent.baseSize).eq(
      command.marketSnapshot.normalizedBaseSize,
    )
  ) {
    return { ok: false, reason: 'normalizedBaseSize' };
  }
  let expectedEntryPrice: string;
  if (command.parent.execution.kind === 'market') {
    const estimate = estimatePerpsProMarketFill({
      amount: command.parent.baseSize,
      amountUnit: 'base',
      book: context.book,
      coin: command.parent.coin,
      sessionKey: context.bookSessionKey,
      side: command.parent.side,
      status: context.bookStatus,
      szDecimals: command.reviewFacts.szDecimals,
    });
    if (!estimate.ok) return { ok: false, reason: estimate.error };
    if (
      !new BigNumber(estimate.estimate.expectedEntryPrice).eq(
        command.marketSnapshot.expectedEntryPrice,
      )
    ) {
      return { ok: false, reason: 'expectedEntryPrice' };
    }
    expectedEntryPrice = estimate.estimate.expectedEntryPrice;
  } else {
    const levels = context.book.levels;
    const bestBid = positive(levels[0]?.[0]?.px);
    const bestAsk = positive(levels[1]?.[0]?.px);
    const limit = positive(command.parent.execution.limitPrice);
    if (!bestBid || !bestAsk || !limit) {
      return { ok: false, reason: 'bookUnavailable' };
    }
    if (
      command.parent.execution.tif === 'Alo' &&
      ((command.parent.side === 'buy' && limit.gte(bestAsk)) ||
        (command.parent.side === 'sell' && limit.lte(bestBid)))
    ) {
      return { ok: false, reason: 'aloWouldMatch' };
    }
    if (
      !new BigNumber(command.parent.execution.limitPrice).eq(
        command.marketSnapshot.expectedEntryPrice,
      )
    ) {
      return { ok: false, reason: 'expectedEntryPrice' };
    }
    expectedEntryPrice = command.parent.execution.limitPrice;
  }
  const errors = validatePerpsProFrozenAttachedTpSl({
    attached: command.attached,
    expectedEntryPrice,
    liquidationPrice: context.liquidationPrice,
  });
  return errors.length > 0
    ? { ok: false, reason: errors[0]?.code ?? 'attachedTpSl' }
    : { ok: true };
};

export const hasPerpsProAttachedTpSlExecutionCapability = () =>
  typeof ExchangeClient.prototype.marketOrderOpenWithNormalTpsl ===
    'function' &&
  typeof ExchangeClient.prototype.limitOrderOpenWithNormalTpsl === 'function' &&
  typeof InfoClient.prototype.getOrderStatus === 'function';

export interface PerpsProAttachedTpSlExecutionDependencies {
  getGuardContext: () => PerpsProAttachedTpSlGuardContext;
  journal: AttachedTpSlJournalDependencies;
  limitOrder: (
    params: NormalTpslLimitOrderParams,
  ) => Promise<NormalTpslBatchResult>;
  marketOrder: (
    params: NormalTpslMarketOrderParams,
  ) => Promise<NormalTpslBatchResult>;
  now: () => number;
}

const getExchange = () => {
  const exchange = apisPerps.getPerpsSDK().exchange;
  if (!exchange) throw new Error('Hyperliquid exchange client unavailable');
  return exchange;
};

const defaultExecutionDependencies = (
  getGuardContext: () => PerpsProAttachedTpSlGuardContext,
): PerpsProAttachedTpSlExecutionDependencies => ({
  getGuardContext,
  journal: defaultAttachedTpSlJournalDependencies,
  limitOrder: params => getExchange().limitOrderOpenWithNormalTpsl(params),
  marketOrder: params => getExchange().marketOrderOpenWithNormalTpsl(params),
  now: Date.now,
});

export const executePerpsProAttachedTpSl = async (
  command: PerpsProAttachedTpSlCommand,
  getGuardContext: () => PerpsProAttachedTpSlGuardContext,
  dependencies: PerpsProAttachedTpSlExecutionDependencies = defaultExecutionDependencies(
    getGuardContext,
  ),
): Promise<PerpsProAttachedTpSlResult> => {
  const initialGuard = validatePerpsProAttachedTpSlCommand(
    command,
    dependencies.getGuardContext(),
  );
  if (!initialGuard.ok) {
    return { kind: 'staleContext', reason: initialGuard.reason };
  }
  let prepared = createPreparedAttachedTpSlJournalEntry({
    accountAddress: command.parent.account.address,
    accountType: command.parent.account.type,
    cloids: command.cloids,
    coin: command.parent.coin,
    commandId: command.commandId,
    createdAt: dependencies.now(),
    dexId: command.parent.dexId,
    marketKey: command.parent.marketKey,
    parentFingerprint: command.parentFingerprint,
    parentSide: command.parent.side,
  });
  try {
    const entries = await dependencies.journal.getEntries();
    const block = findAttachedTpSlSubmissionBlock(entries, prepared);
    if (block) {
      return {
        error: 'A previous attached TP/SL submission is unresolved',
        kind: 'requestFailed',
        reason: 'unresolvedSubmission',
      };
    }
    await dependencies.journal.upsert(prepared);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      kind: 'requestFailed',
    };
  }
  const finalGuard = validatePerpsProAttachedTpSlCommand(
    command,
    dependencies.getGuardContext(),
  );
  if (!finalGuard.ok) {
    await Promise.resolve(dependencies.journal.remove(command.commandId)).catch(
      () => undefined,
    );
    return { kind: 'staleContext', reason: finalGuard.reason };
  }
  let batch: NormalTpslBatchResult;
  try {
    const common = {
      builder: PERPS_BUILDER_INFO,
      cloids: command.cloids,
      coin: command.parent.coin,
      isBuy: command.parent.side === 'buy',
      reduceOnly: false,
      size: command.parent.baseSize,
      slTriggerPx: command.attached.sl?.triggerPrice,
      tpTriggerPx: command.attached.tp?.triggerPrice,
    };
    batch =
      command.parent.execution.kind === 'market'
        ? await dependencies.marketOrder({
            ...common,
            midPx: command.marketSnapshot.expectedEntryPrice,
          })
        : await dependencies.limitOrder({
            ...common,
            limitPx: command.parent.execution.limitPrice,
            tif: command.parent.execution.tif,
          });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      kind: 'unknownOutcome',
    };
  }
  if (
    batch.kind === 'userCancelled' ||
    batch.kind === 'requestFailed' ||
    batch.kind === 'parentRejected'
  ) {
    await Promise.resolve(dependencies.journal.remove(command.commandId)).catch(
      () => undefined,
    );
    if (batch.kind === 'userCancelled') return { kind: 'userCancelled' };
    if (batch.kind === 'requestFailed') {
      return { batch, error: batch.error, kind: 'requestFailed' };
    }
    return { batch, kind: 'parentRejected' };
  }
  prepared = applyAttachedTpSlBatchToJournalEntry(
    prepared,
    batch,
    dependencies.now(),
  );
  try {
    await dependencies.journal.upsert(prepared);
  } catch {
    // The pre-dispatch entry remains durable. Do not reinterpret the batch.
  }
  return { batch, kind: batch.kind } as PerpsProAttachedTpSlResult;
};

export const isPerpsProAttachedTpSlAccount = (
  account: Pick<Account, 'address' | 'type'> | null,
  command: PerpsProAttachedTpSlCommand,
) => isSamePerpsActionAccount(account, command.parent.account);
