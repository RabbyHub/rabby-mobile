import { APP_VERSIONS } from '@/constant';
import type { Account } from '@/core/startupServices/preference';
import type {
  PerpsCloseAllConfirmedFill,
  PerpsCloseAllPositionsCommand,
} from '@/hooks/perps/actions/closeAllPositions';
import type { PerpsClosePositionCommand } from '@/hooks/perps/actions/closePosition';
import type { PerpsConfirmedOrder } from '@/hooks/perps/actions/confirmedOrder';
import type {
  PerpsPositionTpSlCommand,
  PerpsPositionTpSlResult,
} from '@/hooks/perps/actions/positionTpSl';
import { getStatsReportSide } from '@/utils/perpsStats';
import { stats } from '@/utils/stats';
import BigNumber from 'bignumber.js';

import type { PerpsProOpenOrderCommand } from '../actions/openOrder';
import type { PerpsProAttachedTpSlCommand } from '../actions/openOrderWithAttachedTpSl';

export type PerpsProManualTradeType =
  | 'pro close all market'
  | 'pro close limit'
  | 'pro close market'
  | 'pro limit'
  | 'pro market'
  | 'pro partial position stop loss'
  | 'pro partial position take profit'
  | 'pro position stop loss'
  | 'pro position take profit'
  | 'pro stop loss in market'
  | 'pro stop loss limit'
  | 'pro stop loss market'
  | 'pro stop market in limit'
  | 'pro take profit in limit'
  | 'pro take profit in market'
  | 'pro take profit limit'
  | 'pro take profit market';

export type PerpsProConfirmedAttachedTpSlChild = Readonly<{
  acceptance: 'filled' | 'resting';
  oid: number;
  role: 'stopLoss' | 'takeProfit';
}>;

export type PerpsProPositionTpSlReportingFacts = Readonly<{
  leverage: number | string;
  marginMode: 'cross' | 'isolated';
}>;

export type PerpsProManualTradeHistoryInput = Readonly<{
  account: Pick<Account, 'address' | 'type'>;
  coin: string;
  createdAt?: number;
  isBuy: boolean;
  leverage: number | string;
  marginMode: 'cross' | 'isolated';
  price: string;
  reduceOnly: boolean;
  size: string;
  tradeType: PerpsProManualTradeType;
}>;

export type PerpsProManualTradeHistoryPayload = Readonly<{
  address_type: string;
  app_version: string;
  coin: string;
  created_at: number;
  leverage: string;
  margin_mode: 'cross' | 'isolated';
  price: string;
  service_provider: 'hyperliquid';
  size: string;
  trade_side: string;
  trade_type: PerpsProManualTradeType;
  trade_usd_value: string;
  user_addr: string;
}>;

const positiveDecimal = (value: unknown) => {
  const result = new BigNumber(
    (value as string | number | null | undefined) ?? Number.NaN,
  );
  return result.isFinite() && result.gt(0) ? result : null;
};

export const buildPerpsProManualTradeHistoryPayload = (
  input: PerpsProManualTradeHistoryInput,
): PerpsProManualTradeHistoryPayload | null => {
  const size = positiveDecimal(input.size);
  const price = positiveDecimal(input.price);
  const coin = input.coin.trim();
  if (!input.account.address || !coin || !size || !price) {
    return null;
  }
  return {
    address_type: input.account.type || '',
    app_version: APP_VERSIONS.fromNative || '0',
    coin,
    created_at: input.createdAt ?? Date.now(),
    leverage: String(input.leverage),
    margin_mode: input.marginMode,
    price: price.toFixed(),
    service_provider: 'hyperliquid',
    size: size.toFixed(),
    trade_side: getStatsReportSide(input.isBuy, input.reduceOnly),
    trade_type: input.tradeType,
    trade_usd_value: size.multipliedBy(price).toFixed(2),
    user_addr: input.account.address,
  };
};

export const reportPerpsProManualTradeHistory = (
  input: PerpsProManualTradeHistoryInput,
) => {
  const payload = buildPerpsProManualTradeHistoryPayload(input);
  if (!payload) {
    return false;
  }
  try {
    stats.report('perpsTradeHistory', payload);
    return true;
  } catch {
    return false;
  }
};

const reportOpenOrder = (
  command: PerpsProOpenOrderCommand,
  confirmed: PerpsConfirmedOrder | undefined,
) => {
  if (!confirmed || !command.reviewFacts) {
    return false;
  }
  const tradeType: PerpsProManualTradeType | null =
    command.execution.kind === 'market'
      ? 'pro market'
      : command.execution.kind === 'limit'
      ? 'pro limit'
      : command.execution.kind === 'conditionalMarket'
      ? command.execution.tpsl === 'tp'
        ? 'pro take profit market'
        : 'pro stop loss market'
      : command.execution.kind === 'conditionalLimit'
      ? command.execution.tpsl === 'tp'
        ? 'pro take profit limit'
        : 'pro stop loss limit'
      : null;
  if (!tradeType) {
    return false;
  }
  return reportPerpsProManualTradeHistory({
    account: command.account,
    coin: command.coin,
    isBuy: command.side === 'buy',
    leverage: command.reviewFacts.leverage,
    marginMode: command.reviewFacts.marginMode,
    price: confirmed.price,
    reduceOnly: command.reduceOnly,
    size: confirmed.size,
    tradeType,
  });
};

export const reportPerpsProOpenOrderHistory = reportOpenOrder;

export const reportPerpsProAttachedOrderHistory = (
  command: PerpsProAttachedTpSlCommand,
  confirmedParent: PerpsConfirmedOrder | undefined,
  confirmedChildren: readonly PerpsProConfirmedAttachedTpSlChild[] | undefined,
) => {
  const parentReported = reportOpenOrder(command.parent, confirmedParent);
  if (!confirmedParent || !confirmedChildren?.length) {
    return Number(parentReported);
  }
  const execution = command.parent.execution.kind;
  const childTradeTypes = {
    stopLoss:
      execution === 'market'
        ? ('pro stop loss in market' as const)
        : ('pro stop market in limit' as const),
    takeProfit:
      execution === 'market'
        ? ('pro take profit in market' as const)
        : ('pro take profit in limit' as const),
  };
  const seen = new Set<PerpsProConfirmedAttachedTpSlChild['role']>();
  const childCount = confirmedChildren.reduce((count, child) => {
    if (seen.has(child.role)) {
      return count;
    }
    seen.add(child.role);
    const leg =
      child.role === 'takeProfit' ? command.attached.tp : command.attached.sl;
    if (!leg) {
      return count;
    }
    const reported = reportPerpsProManualTradeHistory({
      account: command.parent.account,
      coin: command.parent.coin,
      isBuy: command.parent.side === 'sell',
      leverage: command.reviewFacts.leverage,
      marginMode: command.reviewFacts.marginMode,
      price: leg.triggerPrice,
      reduceOnly: true,
      size: command.parent.baseSize,
      tradeType: childTradeTypes[child.role],
    });
    return count + Number(reported);
  }, 0);
  return Number(parentReported) + childCount;
};

export const reportPerpsProPositionTpSlHistory = (
  command: PerpsPositionTpSlCommand,
  result: PerpsPositionTpSlResult,
  reportingFacts: PerpsProPositionTpSlReportingFacts,
) => {
  const tradeTypes =
    command.scope === 'partial'
      ? {
          stopLoss: 'pro partial position stop loss' as const,
          takeProfit: 'pro partial position take profit' as const,
        }
      : {
          stopLoss: 'pro position stop loss' as const,
          takeProfit: 'pro position take profit' as const,
        };
  return result.legs.reduce((count, resultLeg) => {
    if (resultLeg.create !== 'success') {
      return count;
    }
    const commandLeg = command.legs.find(leg => leg.kind === resultLeg.kind);
    if (!commandLeg || commandLeg.replaceOid !== null) {
      return count;
    }
    const size =
      command.scope === 'partial'
        ? commandLeg.size ?? ''
        : command.expectedPositionSize;
    const reported = reportPerpsProManualTradeHistory({
      account: command.account,
      coin: command.coin,
      isBuy: command.direction === 'short',
      leverage: reportingFacts.leverage,
      marginMode: reportingFacts.marginMode,
      price: commandLeg.triggerPrice,
      reduceOnly: true,
      size,
      tradeType: tradeTypes[commandLeg.kind],
    });
    return count + Number(reported);
  }, 0);
};

export const reportPerpsProClosePositionHistory = (
  command: PerpsClosePositionCommand,
  confirmed: PerpsConfirmedOrder | undefined,
) => {
  if (!confirmed) {
    return false;
  }
  return reportPerpsProManualTradeHistory({
    account: command.account,
    coin: command.coin,
    isBuy: command.direction === 'short',
    leverage: command.reportingFacts.leverage,
    marginMode: command.reportingFacts.marginMode,
    price: confirmed.price,
    reduceOnly: true,
    size: confirmed.size,
    tradeType:
      command.orderType === 'market' ? 'pro close market' : 'pro close limit',
  });
};

export const reportPerpsProCloseAllHistory = (
  command: PerpsCloseAllPositionsCommand,
  confirmedFills: readonly PerpsCloseAllConfirmedFill[] | undefined,
) => {
  if (!confirmedFills?.length) {
    return 0;
  }
  const positions = new Map(
    command.clearinghouseState.assetPositions.map(item => [
      item.position.coin,
      item.position,
    ]),
  );
  return confirmedFills.reduce((count, fill) => {
    const position = positions.get(fill.coin);
    const signedSize = positiveDecimal(new BigNumber(fill.signedSize).abs());
    if (!position || !signedSize) {
      return count;
    }
    const reported = reportPerpsProManualTradeHistory({
      account: command.account,
      coin: fill.coin,
      isBuy: new BigNumber(fill.signedSize).lt(0),
      leverage: position.leverage.value,
      marginMode: position.leverage.type === 'isolated' ? 'isolated' : 'cross',
      price: fill.price,
      reduceOnly: true,
      size: fill.size,
      tradeType: 'pro close all market',
    });
    return count + Number(reported);
  }, 0);
};
