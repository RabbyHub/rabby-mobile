import BigNumber from 'bignumber.js';
import type {
  ExchangeClient,
  TwapSubmissionOutcome,
} from '@rabby-wallet/hyperliquid-sdk';
import type { Account } from '@/core/startupServices/preference';
import { isSamePerpsActionAccount } from '@/hooks/perps/actions/accountGuard';
import {
  getPerpsRuntimeIdentity,
  type PerpsRuntimeSnapshot,
} from '@/hooks/perps/runtime/perpsRuntimeState';
import type { PerpsAccountRuntimeContext } from '@/hooks/perps/usePerpsStore';
import type { PerpsProOrderReviewFacts } from '../model/orderReview';
import type { PerpsProTradeFormState, PerpsProTradeSide } from '../model/trade';
import {
  validatePerpsProTwapDraft,
  type PerpsProTwapValidationError,
} from '../model/twapOrder';

export class PerpsProTwapError extends Error {
  constructor(
    public readonly code:
      | PerpsProTwapValidationError
      | 'capacity'
      | 'reduceOnly'
      | 'contextChanged',
  ) {
    super(code);
  }
}

export type PerpsProTwapCapacity = {
  availableQuote: string;
  maxTradeSize: string;
  maxUsdValueSize?: string | number | null;
  positionSize: string;
  midPrice: string;
  leverage: number;
};

export type PerpsProTwapOrderCommand = Readonly<{
  type: 'twapOrder';
  account: Readonly<Pick<Account, 'address' | 'type'>>;
  accountGeneration: number;
  runtimeGeneration: number;
  runtimeIdentity: string;
  coin: string;
  dexId: string;
  marketKey: string;
  side: PerpsProTradeSide;
  baseSize: string;
  durationMinutes: number;
  randomize: boolean;
  reduceOnly: boolean;
  reviewFacts: PerpsProOrderReviewFacts;
}>;

export const validatePerpsProTwapCapacity = (
  command: Pick<
    PerpsProTwapOrderCommand,
    'baseSize' | 'durationMinutes' | 'side' | 'reduceOnly' | 'reviewFacts'
  >,
  facts: PerpsProTwapCapacity,
) => {
  const available = new BigNumber(facts.availableQuote);
  const maximum = new BigNumber(facts.maxTradeSize);
  const position = new BigNumber(facts.positionSize);
  if (
    !available.isFinite() ||
    available.lt(0) ||
    !maximum.isFinite() ||
    maximum.lt(0) ||
    !position.isFinite() ||
    !Number.isSafeInteger(facts.leverage) ||
    facts.leverage <= 0
  )
    throw new PerpsProTwapError('capacity');
  const closable = (command.side === 'buy' ? position.lt(0) : position.gt(0))
    ? position.abs()
    : new BigNumber(0);
  const size = new BigNumber(command.baseSize);
  if (command.reduceOnly && (closable.isZero() || size.gt(closable)))
    throw new PerpsProTwapError('reduceOnly');
  const validation = validatePerpsProTwapDraft({
    baseSize: command.baseSize,
    midPrice: facts.midPrice,
    durationDraft: String(command.durationMinutes),
    szDecimals: command.reviewFacts.szDecimals,
    maximumBaseSize: (command.reduceOnly
      ? BigNumber.minimum(maximum, closable)
      : maximum
    ).toFixed(),
  });
  const error = validation.amountError ?? validation.durationError;
  if (error) throw new PerpsProTwapError(error);
  if (validation.baseSize !== command.baseSize)
    throw new PerpsProTwapError('invalidPrecision');
  const usdCap = new BigNumber(facts.maxUsdValueSize ?? NaN);
  if (
    usdCap.isFinite() &&
    usdCap.gt(0) &&
    new BigNumber(validation.notional!).gt(usdCap)
  )
    throw new PerpsProTwapError('amountExceedsMaximum');
  const newSize = BigNumber.maximum(0, size.minus(closable));
  if (
    !command.reduceOnly &&
    newSize.times(facts.midPrice).gt(available.times(facts.leverage))
  )
    throw new PerpsProTwapError('capacity');
};

export const buildPerpsProTwapOrderCommand = ({
  accountRuntime,
  runtime,
  coin,
  dexId,
  marketKey,
  side,
  form,
  reviewFacts,
  capacity,
}: {
  accountRuntime: PerpsAccountRuntimeContext;
  runtime: PerpsRuntimeSnapshot;
  coin: string;
  dexId: string;
  marketKey: string;
  side: PerpsProTradeSide;
  form: PerpsProTradeFormState;
  reviewFacts: PerpsProOrderReviewFacts;
  capacity: PerpsProTwapCapacity;
}): PerpsProTwapOrderCommand => {
  const account = accountRuntime.account;
  if (
    !account ||
    !accountRuntime.isInitialized ||
    runtime.status !== 'ready' ||
    runtime.identity !== getPerpsRuntimeIdentity(account) ||
    form.orderType !== 'twap' ||
    form.amountUnit !== 'base' ||
    form.attachedTpSl.enabled ||
    form.bboEnabled
  )
    throw new PerpsProTwapError('contextChanged');
  const validated = validatePerpsProTwapDraft({
    baseSize: form.amount,
    midPrice: capacity.midPrice,
    szDecimals: reviewFacts.szDecimals,
    durationDraft: form.twapDuration,
  });
  const error = validated.amountError ?? validated.durationError;
  if (error || !validated.baseSize || validated.durationMinutes === null)
    throw new PerpsProTwapError(error ?? 'contextChanged');
  const command: PerpsProTwapOrderCommand = Object.freeze({
    type: 'twapOrder',
    account: Object.freeze({ address: account.address, type: account.type }),
    accountGeneration: accountRuntime.generation,
    runtimeGeneration: runtime.generation,
    runtimeIdentity: runtime.identity,
    coin,
    dexId,
    marketKey,
    side,
    baseSize: validated.baseSize,
    durationMinutes: validated.durationMinutes,
    randomize: form.twapRandomize,
    reduceOnly: form.reduceOnly,
    reviewFacts: Object.freeze({ ...reviewFacts }),
  });
  validatePerpsProTwapCapacity(command, capacity);
  return command;
};

export type PerpsProTwapContext = {
  active: boolean;
  accountRuntime: PerpsAccountRuntimeContext;
  runtime: PerpsRuntimeSnapshot;
  marketKey: string | null;
  formRevision: number;
  hasPermission: boolean;
  capacity: PerpsProTwapCapacity | null;
};

export const isPerpsProTwapContextCurrent = (
  command: PerpsProTwapOrderCommand,
  context: PerpsProTwapContext,
) =>
  context.active &&
  context.hasPermission &&
  context.accountRuntime.isInitialized &&
  context.accountRuntime.generation === command.accountGeneration &&
  isSamePerpsActionAccount(context.accountRuntime.account, command.account) &&
  context.runtime.status === 'ready' &&
  context.runtime.identity === command.runtimeIdentity &&
  context.runtime.generation === command.runtimeGeneration &&
  context.marketKey === command.marketKey &&
  context.formRevision === command.reviewFacts.formRevision;

const consumed = new WeakSet<PerpsProTwapOrderCommand>();
export const executePerpsProTwapOrder = async (
  command: PerpsProTwapOrderCommand,
  dependencies: {
    getContext: () => PerpsProTwapContext;
    submit: ExchangeClient['placeTwapOrderWithOutcome'];
  },
): Promise<TwapSubmissionOutcome> => {
  if (
    consumed.has(command) ||
    !Object.isFrozen(command) ||
    !Object.isFrozen(command.account) ||
    !Object.isFrozen(command.reviewFacts)
  )
    return { kind: 'contextChanged', phase: 'entry' };
  const guard = () => {
    const context = dependencies.getContext();
    if (!isPerpsProTwapContextCurrent(command, context) || !context.capacity)
      return false;
    try {
      validatePerpsProTwapCapacity(command, context.capacity);
      return true;
    } catch {
      return false;
    }
  };
  if (!guard()) return { kind: 'contextChanged', phase: 'entry' };
  consumed.add(command);
  return dependencies.submit(
    {
      coin: command.coin,
      isBuy: command.side === 'buy',
      sz: command.baseSize,
      durationMins: command.durationMinutes,
      randomize: command.randomize,
      reduceOnly: command.reduceOnly,
    },
    { isContextCurrent: guard },
  );
};
