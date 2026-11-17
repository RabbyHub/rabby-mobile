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
  validatePerpsProScaleCapacity,
  type PerpsProScaleCapacity,
  type PerpsProScalePlan,
} from '../model/scaleOrder';
import type {
  PerpsProTradeFormState,
  PerpsProTradeSide,
  PerpsProTradeTif,
} from '../model/trade';

export type PerpsProScaleOrderCommand = Readonly<{
  type: 'scaleOrder';
  account: Readonly<Pick<Account, 'address' | 'type'>>;
  accountGeneration: number;
  runtimeGeneration: number;
  runtimeIdentity: string;
  coin: string;
  dexId: string;
  marketKey: string;
  side: PerpsProTradeSide;
  reduceOnly: boolean;
  tif: PerpsProTradeTif;
  plan: PerpsProScalePlan;
  cloids: readonly Cloid[];
  cost: string;
  reviewFacts: PerpsProOrderReviewFacts;
}>;

export const buildPerpsProScaleOrderCommand = ({
  accountRuntime,
  runtime,
  coin,
  dexId,
  marketKey,
  form,
  side,
  reviewFacts,
  capacity,
  createId = uuid,
}: {
  accountRuntime: PerpsAccountRuntimeContext;
  runtime: PerpsRuntimeSnapshot;
  coin: string;
  dexId: string;
  marketKey: string;
  form: PerpsProTradeFormState;
  side: PerpsProTradeSide;
  reviewFacts: PerpsProOrderReviewFacts;
  capacity: PerpsProScaleCapacity;
  createId?: () => string;
}): PerpsProScaleOrderCommand => {
  const account = accountRuntime.account;
  if (
    !account ||
    !accountRuntime.isInitialized ||
    runtime.status !== 'ready' ||
    runtime.identity !== getPerpsRuntimeIdentity(account) ||
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
  const cost = validatePerpsProScaleCapacity({
    plan,
    facts: capacity,
    reduceOnly: form.reduceOnly,
    side,
  });
  const cloids = plan.orders.map(() => createPerpsScaleCloid(createId()));
  if (new Set(cloids).size !== cloids.length)
    throw new Error('Duplicate Scale order identifiers');
  return Object.freeze({
    type: 'scaleOrder',
    account: Object.freeze({ address: account.address, type: account.type }),
    accountGeneration: accountRuntime.generation,
    runtimeGeneration: runtime.generation,
    runtimeIdentity: runtime.identity,
    coin,
    dexId,
    marketKey,
    side,
    reduceOnly: form.reduceOnly,
    tif: form.tif,
    plan,
    cost,
    cloids: Object.freeze(cloids),
    reviewFacts: Object.freeze({ ...reviewFacts }),
  });
};

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
  context.formRevision === command.reviewFacts.formRevision;

// A submitted preview is consumed even if its response is lost. No automatic resubmission.
const consumed = new WeakSet<PerpsProScaleOrderCommand>();
export const executePerpsProScaleOrder = async (
  command: PerpsProScaleOrderCommand,
  dependencies: {
    getContext: () => PerpsProScaleContext;
    submit: ExchangeClient['multiOrderWithOutcome'];
  },
): Promise<MultiOrderOutcome> => {
  if (consumed.has(command)) return { kind: 'contextChanged', phase: 'entry' };
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
  const guard = () => {
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
    } catch {
      return false;
    }
  };
  if (!guard()) return { kind: 'contextChanged', phase: 'entry' };
  consumed.add(command);
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
    consumed.delete(command);
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
