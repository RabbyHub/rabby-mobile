import {
  ExchangeClient,
  InfoClient,
  type Cloid,
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

import type { PerpsProOrderReviewFacts } from '../model/orderReview';
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

export type PerpsProAttachedTpSlMarketSnapshot = {
  entrySource: 'fullL2' | 'limit' | 'midFallback';
  expectedEntryPrice: string;
  normalizedBaseSize: string;
};

export type PerpsProAttachedTpSlReviewFacts = PerpsProOrderReviewFacts & {
  expectedEntryPrice: string;
  liquidationGap: number | null;
  liquidationPrice: string | null;
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
  reviewFacts: PerpsProAttachedTpSlReviewFacts;
  runtimeGeneration: number;
  runtimeIdentity: string;
  type: 'openOrderWithAttachedTpSl';
};

export type PerpsProAttachedTpSlGuardContext = {
  accountRuntime: PerpsAccountRuntimeContext;
  active: boolean;
  coin: string;
  dexId: string;
  hasPermission: boolean;
  marketKey: string | null;
  runtime: PerpsRuntimeSnapshot;
};

export type PerpsProAttachedTpSlGuardFailureReason =
  | 'accountOrRuntime'
  | 'commandIdentity'
  | 'expectedEntryPrice'
  | 'invalidDirection'
  | 'invalidTrigger'
  | 'marketIdentity'
  | 'normalizedBaseSize'
  | 'regionRestricted';

export type PerpsProAttachedTpSlGuardResult =
  | { ok: true }
  | {
      leg?: 'sl' | 'tp';
      ok: false;
      reason: PerpsProAttachedTpSlGuardFailureReason;
    };

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
  | {
      kind: 'staleContext';
      leg?: 'sl' | 'tp';
      reason?: PerpsProAttachedTpSlGuardFailureReason;
    }
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

export const getPerpsProAttachedTpSlBatchError = (
  batch: NormalTpslBatchResult | undefined,
  roles?: ReadonlySet<'parent' | 'stopLoss' | 'takeProfit'>,
) => {
  if (!batch || !('legs' in batch)) return undefined;
  const errors = batch.legs.flatMap(leg =>
    leg.kind === 'rejected' && (!roles || roles.has(leg.role))
      ? [leg.error.trim()]
      : [],
  );
  return [...new Set(errors)].filter(Boolean).join('\n') || undefined;
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
  formRevision = 0,
  generatedAt = Date.now(),
  leverage,
  liquidationGap,
  marginMode,
  markPrice,
  maxLeverage,
  midPrice = markPrice,
  marketSnapshot,
  parent,
  pxDecimals,
  quoteAsset,
  runtime,
  sourceTag = null,
  szDecimals,
  uuid = uuidV4,
}: {
  accountRuntime: PerpsAccountRuntimeContext;
  amountUnit: PerpsProTradeAmountUnit;
  attached: PerpsProAttachedTpSlEvaluation;
  displayBase: string;
  displayPair: string;
  formRevision?: number;
  generatedAt?: number;
  leverage: number;
  liquidationGap: number | null;
  marginMode: 'cross' | 'isolated';
  markPrice: string;
  maxLeverage: number;
  midPrice?: string;
  marketSnapshot: PerpsProAttachedTpSlMarketSnapshot;
  parent: PerpsProOpenOrderCommand;
  pxDecimals: number;
  quoteAsset: string;
  runtime: PerpsRuntimeSnapshot;
  sourceTag?: string | null;
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
    !new BigNumber(marketSnapshot.normalizedBaseSize).eq(parent.baseSize) ||
    (attachedParent.execution.kind === 'limit'
      ? marketSnapshot.entrySource !== 'limit'
      : marketSnapshot.entrySource !== 'fullL2' &&
        marketSnapshot.entrySource !== 'midFallback')
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
    reviewFacts: Object.freeze({
      amountUnit,
      displayBase,
      displayPair,
      expectedEntryPrice: attached.expectedEntryPrice,
      formRevision,
      generatedAt,
      leverage,
      liquidationGap,
      liquidationPrice: attached.liquidationPrice,
      marginMode,
      markPrice,
      marketFillRiskEntryPrice:
        attachedParent.execution.kind === 'market'
          ? attached.expectedEntryPrice
          : null,
      maxLeverage,
      midPrice,
      pxDecimals,
      quoteAsset,
      sourceTag,
      szDecimals,
    }),
    runtimeGeneration: runtime.generation,
    runtimeIdentity: runtime.identity,
    type: 'openOrderWithAttachedTpSl' as const,
  });
};

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
    !Object.isFrozen(command.reviewFacts)
  ) {
    return { ok: false, reason: 'commandIdentity' };
  }
  if (!context.hasPermission) {
    return { ok: false, reason: 'regionRestricted' };
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
    context.dexId !== command.parent.dexId
  ) {
    return { ok: false, reason: 'marketIdentity' };
  }
  if (
    !new BigNumber(command.parent.baseSize).eq(
      command.marketSnapshot.normalizedBaseSize,
    )
  ) {
    return { ok: false, reason: 'normalizedBaseSize' };
  }
  const expectedEntryPrice = command.marketSnapshot.expectedEntryPrice;
  if (
    !positive(expectedEntryPrice) ||
    !new BigNumber(command.attached.expectedEntryPrice).eq(expectedEntryPrice)
  ) {
    return { ok: false, reason: 'expectedEntryPrice' };
  }
  if (command.parent.execution.kind === 'limit') {
    if (
      command.marketSnapshot.entrySource !== 'limit' ||
      !new BigNumber(command.parent.execution.limitPrice).eq(expectedEntryPrice)
    ) {
      return { ok: false, reason: 'expectedEntryPrice' };
    }
  } else if (
    command.marketSnapshot.entrySource !== 'fullL2' &&
    command.marketSnapshot.entrySource !== 'midFallback'
  ) {
    return { ok: false, reason: 'expectedEntryPrice' };
  }
  const errors = validatePerpsProFrozenAttachedTpSl({
    attached: command.attached,
    expectedEntryPrice,
  });
  return errors.length > 0
    ? {
        leg: errors[0]?.leg,
        ok: false,
        reason: errors[0]?.code ?? 'invalidTrigger',
      }
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
    return {
      kind: 'staleContext',
      leg: initialGuard.leg,
      reason: initialGuard.reason,
    };
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
    return {
      kind: 'staleContext',
      leg: finalGuard.leg,
      reason: finalGuard.reason,
    };
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
            midPx: command.parent.execution.slippageReferenceMidPrice,
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
