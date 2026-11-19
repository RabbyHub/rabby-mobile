import type {
  Cloid,
  ExchangeClient,
  MultiOrderOutcome,
  OrderStatusResponse,
} from '@rabby-wallet/hyperliquid-sdk';
import { v4 as uuid } from 'uuid';
import { PERPS_BUILDER_INFO } from '@/constant/perps';
import type { Account } from '@/core/startupServices/preference';
import { isSamePerpsActionAccount } from '@/hooks/perps/actions/accountGuard';
import {
  getPerpsRuntimeIdentity,
  type PerpsRuntimeSnapshot,
} from '@/hooks/perps/runtime/perpsRuntimeState';
import type { PerpsAccountRuntimeContext } from '@/hooks/perps/usePerpsStore';
import { createPerpsScaleCloid } from '@/utils/perpsScaleCloid';
import type { PerpsProOrderReviewFacts } from '../model/orderReview';
import {
  buildPerpsProScalePlan,
  estimatePerpsProScaleCost,
  PerpsProScaleError,
  validatePerpsProScaleCapacity,
  type PerpsProScaleCapacity,
  type PerpsProScalePlan,
} from '../model/scaleOrder';
import type {
  PerpsProTradeFormState,
  PerpsProTradeSide,
  PerpsProTradeTif,
} from '../model/trade';

export type PerpsProScaleOrderPreview = Readonly<{
  type: 'scaleOrder';
  accountGeneration: number;
  runtimeGeneration: number;
  runtimeIdentity: string | null;
  coin: string;
  dexId: string;
  marketKey: string;
  side: PerpsProTradeSide;
  reduceOnly: boolean;
  tif: PerpsProTradeTif;
  plan: PerpsProScalePlan;
  cost: string | null;
  reviewFacts: PerpsProOrderReviewFacts;
}>;

export type PerpsProScaleOrderCommand = PerpsProScaleOrderPreview &
  Readonly<{
    account: Readonly<Pick<Account, 'address' | 'type'>>;
    runtimeIdentity: string;
    cloids: readonly Cloid[];
  }>;

export const buildPerpsProScaleOrderPreview = ({
  accountRuntime,
  runtime,
  coin,
  dexId,
  marketKey,
  form,
  side,
  reviewFacts,
  positionSize,
}: {
  accountRuntime: PerpsAccountRuntimeContext;
  runtime: PerpsRuntimeSnapshot;
  coin: string;
  dexId: string;
  marketKey: string;
  form: PerpsProTradeFormState;
  side: PerpsProTradeSide;
  reviewFacts: PerpsProOrderReviewFacts;
  positionSize: string | null;
}): PerpsProScaleOrderPreview => {
  const account = accountRuntime.account;
  if (
    form.orderType !== 'scale' ||
    form.amountUnit !== 'base' ||
    form.attachedTpSl.enabled ||
    form.bboEnabled
  )
    throw new Error('Scale order context changed');
  const plan = buildPerpsProScalePlan({
    lowerPrice: form.scaleLowerPrice,
    upperPrice: form.scaleUpperPrice,
    size: form.amount,
    count: form.scaleCount,
    distribution: form.scaleDistribution,
    side,
    szDecimals: reviewFacts.szDecimals,
  });
  return Object.freeze({
    type: 'scaleOrder',
    accountGeneration: accountRuntime.generation,
    runtimeGeneration: runtime.generation,
    runtimeIdentity: account ? getPerpsRuntimeIdentity(account) : null,
    coin,
    dexId,
    marketKey,
    side,
    reduceOnly: form.reduceOnly,
    tif: form.tif,
    plan,
    cost: estimatePerpsProScaleCost(
      plan,
      side,
      form.reduceOnly,
      positionSize,
      reviewFacts.leverage,
    ),
    reviewFacts: Object.freeze({ ...reviewFacts }),
  });
};

/** Bind only the displayed plan to the original account, immediately before execution. */
export function buildPerpsProScaleOrderCommand(
  preview: PerpsProScaleOrderPreview,
  accountRuntime: PerpsAccountRuntimeContext,
  runtime: PerpsRuntimeSnapshot,
  createId: () => string = uuid,
): PerpsProScaleOrderCommand | null {
  const account = accountRuntime.account;
  if (
    !account ||
    !accountRuntime.isInitialized ||
    runtime.status !== 'ready' ||
    preview.accountGeneration !== accountRuntime.generation ||
    preview.runtimeGeneration !== runtime.generation ||
    preview.runtimeIdentity !== getPerpsRuntimeIdentity(account) ||
    !runtime.identity ||
    runtime.identity !== preview.runtimeIdentity
  )
    return null;
  const cloids = preview.plan.orders.map(() =>
    createPerpsScaleCloid(createId()),
  );
  if (new Set(cloids).size !== cloids.length)
    throw new Error('Duplicate Scale order identifiers');
  return Object.freeze({
    ...preview,
    account: Object.freeze({ address: account.address, type: account.type }),
    runtimeIdentity: runtime.identity,
    cloids: Object.freeze(cloids),
  });
}

export type PerpsProScaleContext = {
  active: boolean;
  accountRuntime: PerpsAccountRuntimeContext;
  runtime: PerpsRuntimeSnapshot;
  marketKey: string | null;
  coin: string;
  dexId: string;
  formRevision: number;
  hasPermission: boolean;
  capacity: PerpsProScaleCapacity | null;
};

export const isPerpsProScaleContextCurrent = (
  command: PerpsProScaleOrderCommand,
  context: PerpsProScaleContext,
  expectedRevision = command.reviewFacts.formRevision,
) =>
  context.active &&
  context.hasPermission &&
  context.accountRuntime.isInitialized &&
  context.accountRuntime.generation === command.accountGeneration &&
  isSamePerpsActionAccount(context.accountRuntime.account, command.account) &&
  context.runtime.status === 'ready' &&
  context.runtime.generation === command.runtimeGeneration &&
  context.runtime.identity === command.runtimeIdentity &&
  context.marketKey === command.marketKey &&
  context.coin === command.coin &&
  context.dexId === command.dexId &&
  context.formRevision === expectedRevision;

// A submitted preview is consumed even if its response is lost. No automatic resubmission.
const consumed = new WeakSet<PerpsProScalePlan>();
export const executePerpsProScaleOrder = async (
  command: PerpsProScaleOrderCommand,
  dependencies: {
    getContext: () => PerpsProScaleContext;
    submit: ExchangeClient['multiOrderWithOutcome'];
  },
): Promise<MultiOrderOutcome> => {
  if (consumed.has(command.plan))
    return { kind: 'contextChanged', phase: 'entry' };
  if (
    !Object.isFrozen(command) ||
    !Object.isFrozen(command.plan) ||
    !Object.isFrozen(command.plan.orders) ||
    !command.plan.orders.every(Object.isFrozen) ||
    !Object.isFrozen(command.account) ||
    !Object.isFrozen(command.cloids) ||
    !Object.isFrozen(command.reviewFacts)
  )
    return {
      kind: 'requestFailed',
      phase: 'validation',
      error: 'Invalid Scale order snapshot',
    };
  let capacityError: PerpsProScaleError | undefined;
  const guard = () => {
    capacityError = undefined;
    const context = dependencies.getContext();
    if (!isPerpsProScaleContextCurrent(command, context) || !context.capacity)
      return false;
    try {
      validatePerpsProScaleCapacity({
        plan: command.plan,
        facts: context.capacity,
        reduceOnly: command.reduceOnly,
        side: command.side,
      });
      return true;
    } catch (error) {
      if (error instanceof PerpsProScaleError) capacityError = error;
      return false;
    }
  };
  if (!guard()) {
    if (capacityError) throw capacityError;
    return { kind: 'contextChanged', phase: 'entry' };
  }
  consumed.add(command.plan);
  let result: MultiOrderOutcome;
  try {
    result = await dependencies.submit(
      {
        grouping: 'na',
        builder: PERPS_BUILDER_INFO,
        orders: command.plan.orders.map((order, index) => ({
          coin: command.coin,
          isBuy: command.side === 'buy',
          limitPx: order.price,
          sz: order.size,
          reduceOnly: command.reduceOnly,
          cloid: command.cloids[index],
          orderType: { limit: { tif: command.tif } },
        })),
      },
      { isContextCurrent: guard },
    );
  } catch {
    const requestLegs = command.cloids.map((cloid, index) => ({
      cloid,
      index,
    }));
    return {
      kind: 'unknownOutcome',
      evidence: { requestLegs, transportPhase: 'dispatched' },
      legs: requestLegs.map(leg => ({
        ...leg,
        kind: 'unresolved',
        reason: 'transportUnknown',
      })),
    };
  }
  if (
    result.kind === 'requestFailed' ||
    result.kind === 'userCancelled' ||
    result.kind === 'contextChanged'
  )
    consumed.delete(command.plan);
  if (result.kind === 'contextChanged' && capacityError) throw capacityError;
  return result;
};

/** One bounded read pass, scoped explicitly to the original account. UnknownOid stays unknown. */
export const reconcilePerpsProScaleOrders = async (
  command: PerpsProScaleOrderCommand,
  result: MultiOrderOutcome,
  dependencies: {
    isCurrent: () => boolean;
    getOrderStatus: (
      cloid: Cloid,
      address: string,
    ) => Promise<OrderStatusResponse>;
  },
) => {
  if (!('legs' in result)) return [];
  const unresolved = result.legs.filter(leg => leg.kind === 'unresolved');
  const found: { cloid: Cloid; response: OrderStatusResponse }[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, unresolved.length) }, async () => {
      while (next < unresolved.length && dependencies.isCurrent()) {
        const leg = unresolved[next++];
        try {
          const response = await dependencies.getOrderStatus(
            leg.cloid,
            command.account.address,
          );
          if (dependencies.isCurrent())
            found.push({ cloid: leg.cloid, response });
        } catch {
          /* A failed read does not establish a rejected order. */
        }
      }
    }),
  );
  return found;
};
