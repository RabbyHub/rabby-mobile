import { APP_VERSIONS } from '@/constant';
import type { Account } from '@/core/startupServices/preference';
import type {
  PerpsCloseAllConfirmedFill,
  PerpsCloseAllPositionsCommand,
} from '@/hooks/perps/actions/closeAllPositions';
import type { PerpsClosePositionCommand } from '@/hooks/perps/actions/closePosition';
import type { PerpsConfirmedOrder } from '@/hooks/perps/actions/confirmedOrder';
import { getStatsReportSide } from '@/utils/perpsStats';
import { stats } from '@/utils/stats';
import BigNumber from 'bignumber.js';

import type { PerpsProOpenOrderCommand } from '../actions/openOrder';
import type { PerpsProAttachedTpSlCommand } from '../actions/openOrderWithAttachedTpSl';

export type PerpsProManualTradeType =
  | 'close all market'
  | 'close limit'
  | 'close market'
  | 'limit'
  | 'market';

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
  if (!payload) return false;
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
  if (
    !confirmed ||
    !command.reviewFacts ||
    (command.orderType !== 'market' && command.orderType !== 'limit')
  ) {
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
    tradeType: command.orderType,
  });
};

export const reportPerpsProOpenOrderHistory = reportOpenOrder;

export const reportPerpsProAttachedParentHistory = (
  command: PerpsProAttachedTpSlCommand,
  confirmed: PerpsConfirmedOrder | undefined,
) => reportOpenOrder(command.parent, confirmed);

export const reportPerpsProClosePositionHistory = (
  command: PerpsClosePositionCommand,
  confirmed: PerpsConfirmedOrder | undefined,
) => {
  if (!confirmed) return false;
  return reportPerpsProManualTradeHistory({
    account: command.account,
    coin: command.coin,
    isBuy: command.direction === 'short',
    leverage: command.reportingFacts.leverage,
    marginMode: command.reportingFacts.marginMode,
    price: confirmed.price,
    reduceOnly: true,
    size: confirmed.size,
    tradeType: command.orderType === 'market' ? 'close market' : 'close limit',
  });
};

export const reportPerpsProCloseAllHistory = (
  command: PerpsCloseAllPositionsCommand,
  confirmedFills: readonly PerpsCloseAllConfirmedFill[] | undefined,
) => {
  if (!confirmedFills?.length) return 0;
  const positions = new Map(
    command.clearinghouseState.assetPositions.map(item => [
      item.position.coin,
      item.position,
    ]),
  );
  return confirmedFills.reduce((count, fill) => {
    const position = positions.get(fill.coin);
    const signedSize = positiveDecimal(new BigNumber(fill.signedSize).abs());
    if (!position || !signedSize) return count;
    const reported = reportPerpsProManualTradeHistory({
      account: command.account,
      coin: fill.coin,
      isBuy: new BigNumber(fill.signedSize).lt(0),
      leverage: position.leverage.value,
      marginMode: position.leverage.type === 'isolated' ? 'isolated' : 'cross',
      price: fill.price,
      reduceOnly: true,
      size: fill.size,
      tradeType: 'close all market',
    });
    return count + Number(reported);
  }, 0);
};
