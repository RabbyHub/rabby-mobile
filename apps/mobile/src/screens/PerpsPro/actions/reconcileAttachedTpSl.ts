import type {
  ClearinghouseState,
  OpenOrder,
  OrderStatusResponse,
  WsFill,
} from '@rabby-wallet/hyperliquid-sdk';

import { apisPerps } from '@/core/apis/perps';
import type {
  PerpsAttachedTpSlJournalEntry,
  PerpsAttachedTpSlJournalLeg,
} from '@/core/services/perpsService';
import { sleep } from '@/utils/async';

export type PerpsProAttachedTpSlReconciliationKind =
  | 'childRejected'
  | 'fullAccepted'
  | 'parentRejected'
  | 'partialOutcome'
  | 'unknownOutcome';

export type PerpsProAttachedTpSlReconciliation = {
  clearinghouse: ClearinghouseState | null;
  errors: string[];
  fills: WsFill[];
  kind: PerpsProAttachedTpSlReconciliationKind;
  legs: PerpsAttachedTpSlJournalLeg[];
  openOrders: OpenOrder[];
};

export interface ReconcileAttachedTpSlDependencies {
  getClearinghouse: (
    address: string,
    dexId: string,
  ) => Promise<ClearinghouseState>;
  getFills: (address: string) => Promise<WsFill[]>;
  getOpenOrders: (address: string, dexId: string) => Promise<OpenOrder[]>;
  getOrderStatus: (
    cloid: `0x${string}`,
    address: string,
  ) => Promise<OrderStatusResponse>;
  sleep: (milliseconds: number) => Promise<unknown>;
}

const defaultDependencies: ReconcileAttachedTpSlDependencies = {
  getClearinghouse: (address, dexId) =>
    apisPerps
      .getPerpsSDK()
      .info.getClearingHouseState(address, dexId || undefined),
  getFills: address =>
    apisPerps.getPerpsSDK().info.getUserFills(address, false),
  getOpenOrders: (address, dexId) =>
    apisPerps
      .getPerpsSDK()
      .info.getFrontendOpenOrders(address, dexId || undefined),
  getOrderStatus: (cloid, address) =>
    apisPerps.getPerpsSDK().info.getOrderStatus(cloid, address),
  sleep,
};

const rejectedLifecycle = (status: string) =>
  status === 'rejected' || status.toLowerCase().endsWith('rejected');

const reconcileLeg = async (
  leg: PerpsAttachedTpSlJournalLeg,
  address: string,
  getOrderStatus: ReconcileAttachedTpSlDependencies['getOrderStatus'],
): Promise<PerpsAttachedTpSlJournalLeg> => {
  const knownRejected = leg.kind === 'rejected';
  try {
    const result = await getOrderStatus(leg.cloid, address);
    if (result.status === 'unknownOid') {
      return knownRejected || leg.kind === 'accepted'
        ? leg
        : { ...leg, kind: 'unresolved', status: 'unknownOid' };
    }
    const status = result.order.status;
    if (knownRejected) {
      return {
        ...leg,
        oid: result.order.order.oid,
        status,
      };
    }
    if (rejectedLifecycle(status)) {
      return {
        ...leg,
        error: status,
        kind: 'rejected',
        oid: result.order.order.oid,
        status,
      };
    }
    return {
      ...leg,
      kind: 'accepted',
      oid: result.order.order.oid,
      status,
    };
  } catch (error) {
    if (knownRejected) return leg;
    return {
      ...leg,
      error: error instanceof Error ? error.message : String(error),
      kind: leg.kind === 'accepted' ? 'accepted' : 'unresolved',
    };
  }
};

const requestLegs = (
  entry: PerpsAttachedTpSlJournalEntry,
): PerpsAttachedTpSlJournalLeg[] => {
  const existing = new Map(entry.legs.map(leg => [leg.role, leg]));
  return [
    existing.get('parent') ?? {
      cloid: entry.cloids.parent,
      kind: 'unresolved' as const,
      role: 'parent' as const,
    },
    ...(entry.cloids.takeProfit
      ? [
          existing.get('takeProfit') ?? {
            cloid: entry.cloids.takeProfit,
            kind: 'unresolved' as const,
            role: 'takeProfit' as const,
          },
        ]
      : []),
    ...(entry.cloids.stopLoss
      ? [
          existing.get('stopLoss') ?? {
            cloid: entry.cloids.stopLoss,
            kind: 'unresolved' as const,
            role: 'stopLoss' as const,
          },
        ]
      : []),
  ];
};

export const classifyPerpsProAttachedTpSlReconciliation = (
  legs: readonly PerpsAttachedTpSlJournalLeg[],
): PerpsProAttachedTpSlReconciliationKind => {
  const parent = legs.find(leg => leg.role === 'parent');
  const accepted = legs.filter(leg => leg.kind === 'accepted').length;
  const rejected = legs.filter(leg => leg.kind === 'rejected').length;
  const unresolved = legs.filter(leg => leg.kind === 'unresolved').length;
  if (legs.length > 0 && accepted === legs.length) return 'fullAccepted';
  if (unresolved > 0) {
    return accepted > 0 || rejected > 0 ? 'partialOutcome' : 'unknownOutcome';
  }
  if (parent?.kind === 'rejected' && accepted === 0) {
    return 'parentRejected';
  }
  if (parent?.kind === 'accepted' && rejected > 0) {
    return 'childRejected';
  }
  return 'partialOutcome';
};

const settled = (legs: readonly PerpsAttachedTpSlJournalLeg[]) =>
  legs.every(leg => leg.kind !== 'unresolved');

const findOpenOrderByCloid = (
  orders: readonly OpenOrder[],
  cloid: string,
): OpenOrder | null => {
  for (const order of orders) {
    if (order.cloid?.toLowerCase() === cloid.toLowerCase()) return order;
    const child = findOpenOrderByCloid(order.children ?? [], cloid);
    if (child) return child;
  }
  return null;
};

const applySupportingEvidence = (
  legs: readonly PerpsAttachedTpSlJournalLeg[],
  openOrders: readonly OpenOrder[],
  fills: readonly WsFill[],
  coin: string,
) =>
  legs.map(leg => {
    if (leg.kind === 'rejected') return leg;
    const openOrder = findOpenOrderByCloid(openOrders, leg.cloid);
    if (openOrder) {
      return {
        ...leg,
        acceptance: 'resting' as const,
        kind: 'accepted' as const,
        oid: openOrder.oid,
        status: 'open',
      };
    }
    if (
      leg.oid !== undefined &&
      fills.some(fill => fill.oid === leg.oid && fill.coin === coin)
    ) {
      return {
        ...leg,
        acceptance: 'filled' as const,
        kind: 'accepted' as const,
        status: 'filled',
      };
    }
    return leg;
  });

export const reconcilePerpsProAttachedTpSl = async (
  entry: PerpsAttachedTpSlJournalEntry,
  dependencies: ReconcileAttachedTpSlDependencies = defaultDependencies,
): Promise<PerpsProAttachedTpSlReconciliation> => {
  let legs = requestLegs(entry);
  const errors: string[] = [];
  const delays = [0, 250, 750];
  for (const delay of delays) {
    if (delay > 0) await dependencies.sleep(delay);
    legs = await Promise.all(
      legs.map(leg =>
        reconcileLeg(leg, entry.accountAddress, dependencies.getOrderStatus),
      ),
    );
    if (settled(legs)) break;
  }
  let openOrders: OpenOrder[] = [];
  let fills: WsFill[] = [];
  let clearinghouse: ClearinghouseState | null = null;
  const supporting = await Promise.allSettled([
    dependencies.getOpenOrders(entry.accountAddress, entry.dexId),
    dependencies.getFills(entry.accountAddress),
    dependencies.getClearinghouse(entry.accountAddress, entry.dexId),
  ]);
  if (supporting[0].status === 'fulfilled') openOrders = supporting[0].value;
  else errors.push(String(supporting[0].reason));
  if (supporting[1].status === 'fulfilled') fills = supporting[1].value;
  else errors.push(String(supporting[1].reason));
  if (supporting[2].status === 'fulfilled') clearinghouse = supporting[2].value;
  else errors.push(String(supporting[2].reason));
  legs = applySupportingEvidence(legs, openOrders, fills, entry.coin);
  return {
    clearinghouse,
    errors,
    fills,
    kind: classifyPerpsProAttachedTpSlReconciliation(legs),
    legs,
    openOrders,
  };
};
