import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import type {
  WsUserFunding,
  WsUserHistoricalOrders,
} from '@rabby-wallet/hyperliquid-sdk';
import { useEffect } from 'react';

import {
  subscribePerpsProHistoryEvents,
  type PerpsProHistoryRawEvent,
} from '@/hooks/perps/history/perpsHistoryEvents';

import { PERPS_PRO_HISTORY_CASHFLOW_LIMIT } from '../constants';
import { mergePerpsProHistoryRows } from '../model/historyModel';
import { perpsProHistoryRepository } from '../repository/perpsProHistoryRepository';
import type {
  PerpsProFundingFact,
  PerpsProHistoryRow,
  PerpsProHistoryTab,
} from '../types';
import {
  getPerpsProHistoryOldestTime,
  getPerpsProHistoryRowsStatus,
  getPerpsProHistoryTabLimit,
  type UpdatePerpsProHistoryTabState,
} from './perpsProHistoryControllerState';

type MapRawRows = (
  tab: PerpsProHistoryTab,
  rawItems: unknown[],
  accountAddress: string,
) => PerpsProHistoryRow[];

const mergeRealtimeRows = (
  tab: PerpsProHistoryTab,
  rows: PerpsProHistoryRow[],
  updateTabState: UpdatePerpsProHistoryTabState,
) => {
  updateTabState(tab, previous => {
    const merged = mergePerpsProHistoryRows(
      rows,
      previous.rows,
      getPerpsProHistoryTabLimit(tab),
    );
    return {
      ...previous,
      oldestLoadedTime: getPerpsProHistoryOldestTime(merged),
      rows: merged,
      status:
        previous.status === 'idle' || previous.status === 'loading'
          ? previous.status
          : getPerpsProHistoryRowsStatus(merged),
    };
  });
};

export const usePerpsProHistorySubscriptions = ({
  accountAddress,
  accountGeneration,
  activeTab,
  enabled,
  isSubscriptionCurrent,
  mapRawRows,
  updateTabState,
}: {
  accountAddress: string | null;
  accountGeneration: number;
  activeTab: PerpsProHistoryTab;
  enabled: boolean;
  isSubscriptionCurrent: (
    tab: PerpsProHistoryTab,
    subscribedAddress: string,
    subscribedGeneration: number,
  ) => boolean;
  mapRawRows: MapRawRows;
  updateTabState: UpdatePerpsProHistoryTabState;
}) => {
  useEffect(() => {
    if (!enabled || !accountAddress) {
      return;
    }
    const handleRawEvent = (event: PerpsProHistoryRawEvent) => {
      const tab: PerpsProHistoryTab =
        event.kind === 'fills' ? 'trade' : 'transaction';
      if (
        activeTab !== tab ||
        !isSubscriptionCurrent(tab, accountAddress, accountGeneration) ||
        !isSameAddress(event.accountAddress, accountAddress)
      ) {
        return;
      }
      mergeRealtimeRows(
        tab,
        mapRawRows(tab, event.items as unknown[], accountAddress),
        updateTabState,
      );
    };

    if (activeTab === 'trade' || activeTab === 'transaction') {
      return subscribePerpsProHistoryEvents(handleRawEvent);
    }
    if (activeTab === 'orders') {
      return perpsProHistoryRepository.subscribeOrders(
        (payload: WsUserHistoricalOrders) => {
          if (
            !isSubscriptionCurrent(
              'orders',
              accountAddress,
              accountGeneration,
            ) ||
            !isSameAddress(payload.user, accountAddress)
          ) {
            return;
          }
          mergeRealtimeRows(
            'orders',
            mapRawRows('orders', payload.orderHistory, accountAddress),
            updateTabState,
          );
        },
      );
    }
    return perpsProHistoryRepository.subscribeFunding(
      (payload: WsUserFunding) => {
        if (
          !isSubscriptionCurrent(
            'funding',
            accountAddress,
            accountGeneration,
          ) ||
          !isSameAddress(payload.user, accountAddress)
        ) {
          return;
        }
        const facts: PerpsProFundingFact[] = payload.fundings.map(item => ({
          ...item,
        }));
        const rows = mapRawRows('funding', facts, accountAddress);
        updateTabState('funding', previous => {
          const merged = mergePerpsProHistoryRows(
            rows,
            previous.rows,
            PERPS_PRO_HISTORY_CASHFLOW_LIMIT,
          );
          return {
            ...previous,
            oldestLoadedTime: getPerpsProHistoryOldestTime(merged),
            rows: merged,
            status:
              previous.status === 'idle' || previous.status === 'loading'
                ? previous.status
                : getPerpsProHistoryRowsStatus(merged),
          };
        });
      },
    );
  }, [
    accountAddress,
    accountGeneration,
    activeTab,
    enabled,
    isSubscriptionCurrent,
    mapRawRows,
    updateTabState,
  ]);
};
